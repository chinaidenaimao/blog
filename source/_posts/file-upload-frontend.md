---
title: "文件上传与下载的前端封装"
date: 2025-12-12 22:10:00
cover: /img/covers/frontend-design.jpg
top_img: /img/covers/frontend-design.jpg
description: "上传接口的复杂度不在\"接收文件\"——那是 8 行代码的事。 真正的复杂度在四件事：校验（类型/大小/安全）、存储（本地/对象存储抽象）、 归属（谁传的、属于哪个…"
categories:
  - 前端
tags:
  - 文件上传
  - Vue
  - 封装
---

> **📋 摘要：核心判断**
> 上传接口的复杂度**不在"接收文件"**——那是 8 行代码的事。
> 真正的复杂度在四件事：**校验**（类型/大小/安全）、**存储**（本地/对象存储抽象）、
> **归属**（谁传的、属于哪个业务）、**下载**（权限 + 中文名 + 断点）。
>
> 本页按「能跑 → 能用 → 安全 → 企业级」四层递进，最后一层是可以直接落地的完整实现。

---

## 一、最小可用（8 行，只适合 demo）
```
from fastapi import FastAPI, UploadFile, File

app = FastAPI()

@app.post("/upload")
async def upload(file: UploadFile = File(...)):
    content = await file.read()                      # 全量读进内存
    with open(f"uploads/{file.filename}", "wb") as f:  # 直接用客户端文件名
        f.write(content)
    return {"filename": file.filename}
```

> **🚫 危险：这段代码有四个致命问题**
> 1. **大文件 OOM**：`await file.read()` 把整个文件读进内存，传个 2GB 视频直接把进程打死
> 2. **路径穿越**：`file.filename` 可能是 `../../etc/passwd` 或 `..\\..\\web.config`
> 3. **无任何校验**：传 `.php` / `.html` / 可执行文件照样落盘
> 4. **无归属**：不知道谁传的，删不掉也查不到

---

## 二、必须知道的三条底层事实

### 2.1 依赖 `python-multipart`，否则直接 422
```
pip install python-multipart
```

缺这个包时，FastAPI 会在启动或首次请求时报
`Form data requires "python-multipart" to be installed`。

### 2.2 `UploadFile` 不是"内存里的文件"

`UploadFile` 包装的是 Starlette 的 `SpooledTemporaryFile`：

- 小于阈值（默认 1MB）→ 留在**内存**
- 超过阈值 → 自动**落到临时磁盘文件**

所以 `await file.read()` 拿到的是**完整字节串**（这才是 OOM 的原因），
而 `file.file` 是底层文件对象，可以配合 `shutil.copyfileobj` 做流式拷贝。

| 写法 | 内存占用 | 适用 |
|---|---|---|
| `bytes = File(...)` | 全量进内存 | ❌ 只适合极小文件 |
| `await file.read()` | 全量进内存 | ❌ 同上 |
| `await file.read(chunk)` 循环 | 恒定（chunk 大小） | ✅ 推荐 |
| `shutil.copyfileobj(file.file, out)` | 恒定 | ✅ 但会阻塞事件循环，需放线程池 |

### 2.3 `content_type` 和扩展名都不可信

- `content_type` 是**客户端自己填的**，`curl -F "file=@x.exe;type=image/png"` 就能伪造
- 扩展名同理，改个名字就行

真正可信的是**文件头魔数（magic number）**。但魔数也只是"弱校验"——
`.docx` / `.xlsx` / `.zip` 的魔数都是 `PK\x03\x04`，无法区分；
要做强校验得上 `python-magic`（依赖 libmagic）或直接解析文件结构。

---

## 三、生产级单文件上传

### 3.1 目录结构
```
├── router.py           # 视图层
├── schema.py           # FileRespVO / FileQuery
├── service.py          # 业务：校验、落盘、入库
├── model.py            # FileRecord 表
├── constants.py        # 大小限制、白名单、魔数表
└── storage/
    ├── base.py         # StorageBackend 抽象
    ├── local.py        # 本地磁盘实现
    └── s3.py           # 对象存储实现（OSS/S3/MinIO 通用）
```

### 3.2 数据表：存 `file_id`，不存 URL
```
# app/file/model.py
from datetime import datetime
from sqlalchemy import String, BigInteger, DateTime, Index, func
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base


class FileRecord(Base):
    __tablename__ = "sys_file"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    # 内容指纹：用于秒传与去重
    hash: Mapped[str] = mapped_column(String(64), index=True, comment="sha256")
    # 原始文件名（仅用于下载时回显，绝不用于拼路径）
    origin_name: Mapped[str] = mapped_column(String(255))
    # 存储层 key，如 2026/10/17/9f2c....pdf
    storage_key: Mapped[str] = mapped_column(String(512), unique=True)
    size: Mapped[int] = mapped_column(BigInteger)
    mime: Mapped[str] = mapped_column(String(128))
    ext: Mapped[str] = mapped_column(String(16))
    # 归属
    uploader_id: Mapped[int] = mapped_column(BigInteger, index=True)
    biz_type: Mapped[str] = mapped_column(String(32), default="common", comment="头像/合同/附件")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    __table_args__ = (Index("idx_hash_size", "hash", "size"),)
```

> **💡 提示：为什么业务表存 `file_id` 而不是 `url`**
> 存 URL 的问题：换存储（本地 → OSS）、换域名、加 CDN 签名时，**全表都要改**。
> 存 `file_id` 后，URL 在下载接口里**动态生成**，存储迁移对业务表零影响。
> 这是文件模块最重要的一条设计决策。

### 3.3 常量与魔数表
```
# app/file/constants.py
MAX_FILE_SIZE = 20 * 1024 * 1024          # 单文件 20MB
MAX_IMAGE_SIZE = 5 * 1024 * 1024          # 图片 5MB
CHUNK_SIZE = 1024 * 1024                  # 流式读 1MB

# 白名单：按 biz_type 区分允许的类型
ALLOWED_EXT: dict[str, set[str]] = {
    "image": {".jpg", ".jpeg", ".png", ".gif", ".webp"},
    "doc":   {".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".txt", ".csv"},
    "video": {".mp4", ".webm"},
}

# 魔数签名（弱校验，足以挡住 99% 的改名攻击）
MAGIC_SIGNATURES: list[tuple[bytes, set[str]]] = [
    (b"\xff\xd8\xff", {".jpg", ".jpeg"}),
    (b"\x89PNG\r\n\x1a\n", {".png"}),
    (b"GIF87a", {".gif"}),
    (b"GIF89a", {".gif"}),
    (b"RIFF", {".webp"}),                       # 需再看 8-11 字节是否为 WEBP
    (b"%PDF-", {".pdf"}),
    (b"PK\x03\x04", {".zip", ".docx", ".xlsx", ".pptx"}),   # OOXML 本质是 zip
    (b"\xd0\xcf\x11\xe0", {".doc", ".xls", ".ppt"}),        # 老版 Office
    (b"\x00\x00\x00", {".mp4"}),                # 需再看 4-7 字节是否为 ftyp
]


def sniff_ok(head: bytes, ext: str) -> bool:
    """用文件头判断类型是否与扩展名匹配"""
    for sig, exts in MAGIC_SIGNATURES:
        if head.startswith(sig):
            return ext in exts
    return False
```

> **⚠️ 注意：魔数校验的边界**
> 它只能回答"文件头看起来像不像这个类型"，不能证明文件内容无害。
> - `.docx` 与 `.zip` 无法用魔数区分 → 要区分只能解析 zip 内的 `[Content_Types].xml`
> - 真正的安全要靠**白名单 + 存储隔离 + 不执行 + 病毒扫描**，而不是靠魔数

### 3.4 存储抽象（关键：业务代码不碰 `open()`）
```
# app/file/storage/base.py
from abc import ABC, abstractmethod
from collections.abc import AsyncIterator


class StorageBackend(ABC):
    """存储后端抽象：本地 / OSS / S3 / MinIO 共用同一套接口"""

    @abstractmethod
    async def save(self, key: str, stream: AsyncIterator[bytes]) -> int:
        """写入并返回字节数"""

    @abstractmethod
    async def open(self, key: str) -> AsyncIterator[bytes]:
        """流式读出"""

    @abstractmethod
    async def delete(self, key: str) -> None: ...

    @abstractmethod
    def public_url(self, key: str) -> str | None:
        """公开可访问 URL；私有资源返回 None，走下载接口"""
```

```python
# app/file/storage/local.py
from collections.abc import AsyncIterator
from pathlib import Path

import anyio

from app.file.storage.base import StorageBackend
from core.conf import settings


class LocalStorage(StorageBackend):
    def __init__(self, root: Path) -> None:
        self.root = root
        self.root.mkdir(parents=True, exist_ok=True)

    def _path(self, key: str) -> Path:
        # 双保险：即使 key 被污染，也不会跳出 root
        p = (self.root / key).resolve()
        if not str(p).startswith(str(self.root.resolve())):
            raise ValueError("非法存储路径")
        return p

    async def save(self, key: str, stream: AsyncIterator[bytes]) -> int:
        path = self._path(key)
        path.parent.mkdir(parents=True, exist_ok=True)
        total = 0
        async with await anyio.open_file(path, "wb") as out:
            async for chunk in stream:
                await out.write(chunk)
                total += len(chunk)
        return total

    async def open(self, key: str) -> AsyncIterator[bytes]:
        async with await anyio.open_file(self._path(key), "rb") as f:
            while chunk := await f.read(1024 * 1024):
                yield chunk

    async def delete(self, key: str) -> None:
        await anyio.Path(self._path(key)).unlink(missing_ok=True)

    def public_url(self, key: str) -> str | None:
        return f"{settings.STATIC_BASE_URL}/{key}"
```

> **📝 说明：为什么用 `anyio.open_file` 而不是 `aiofiles`**
> `anyio` 已经是 FastAPI 的间接依赖（Starlette 用 anyio 做线程池），
> 直接用它**不引入新依赖**。`aiofiles` 也行，只是多一个包。

### 3.5 Service：流式 + 限额 + 魔数 + 秒传
```
# app/file/service.py
import hashlib
from datetime import date
from pathlib import Path
from uuid import uuid4

from fastapi import UploadFile

from app.file.constants import ALLOWED_EXT, CHUNK_SIZE, MAX_FILE_SIZE, sniff_ok
from app.file.model import FileRecord
from app.file.storage.base import StorageBackend
from common.exception.errors import ClientException
from common.response.response_code import ResponseCode


class FileService:
    def __init__(self, db: SessionDep, storage: StorageBackend) -> None:
        self.db = db
        self.storage = storage

    async def upload(
        self,
        file: UploadFile,
        *,
        uploader_id: int,
        biz_type: str = "common",
        max_size: int = MAX_FILE_SIZE,
    ) -> FileRecord:
        # ---- 1. 扩展名白名单 ----
        origin_name = (file.filename or "").strip()
        ext = Path(origin_name).suffix.lower()
        allowed = ALLOWED_EXT.get(biz_type, ALLOWED_EXT["doc"] | ALLOWED_EXT["image"])
        if ext not in allowed:
            raise ClientException(f"不支持的文件类型：{ext or '未知'}")

        # ---- 2. 流式读取：累计大小 + 算 hash + 取文件头 ----
        # 注意：这里先写临时 key，校验通过后再改名，避免脏文件
        tmp_key = f"_tmp/{uuid4().hex}{ext}"
        hasher = hashlib.sha256()
        head = b""
        total = 0
        exceeded = False

        async def _iter():
            nonlocal head, total, exceeded
            while chunk := await file.read(CHUNK_SIZE):
                total += len(chunk)
                if total > max_size:
                    exceeded = True
                    raise ClientException(
                        code=ResponseCode.PARAMS_ERROR,
                        msg=f"文件超过 {max_size // 1024 // 1024}MB",
                        http_status=413,
                    )
                if len(head) < 16:
                    head += chunk[: 16 - len(head)]
                hasher.update(chunk)
                yield chunk

        try:
            await self.storage.save(tmp_key, _iter())
        except Exception:
            await self.storage.delete(tmp_key)   # 失败清理，避免残留
            raise
        finally:
            await file.close()

        # ---- 3. 魔数校验 ----
        if not sniff_ok(head, ext):
            await self.storage.delete(tmp_key)
            raise ClientException("文件内容与扩展名不匹配")

        # ---- 4. 秒传：同 hash 同大小直接复用 ----
        digest = hasher.hexdigest()
        existing = await self._get_by_hash(digest, total)
        if existing:
            await self.storage.delete(tmp_key)
            return existing

        # ---- 5. 正式入库：key 用日期分目录，避免单目录文件过多 ----
        storage_key = f"{date.today():%Y/%m/%d}/{uuid4().hex}{ext}"
        await self.storage.save(storage_key, self._replay(tmp_key))
        await self.storage.delete(tmp_key)

        record = FileRecord(
            hash=digest,
            origin_name=origin_name[:255],
            storage_key=storage_key,
            size=total,
            mime=file.content_type or "application/octet-stream",
            ext=ext,
            uploader_id=uploader_id,
            biz_type=biz_type,
        )
        self.db.add(record)
        await self.db.flush()
        return record
```

> **💡 提示：为什么要"先写临时 key 再改名"**
> 因为**校验是在流式读取过程中完成的**——读到第 3MB 才发现超限，
> 此时已经写了 3MB 到磁盘。如果直接写正式 key，就会留下**没有数据库记录的孤儿文件**。
>
> 写临时目录 + 校验通过后二次落位，能保证「存储里有的文件，库里一定有记录」。
> 线上再配一个定时任务扫 `_tmp/` 清理超过 1 小时的残留即可。

### 3.6 Router：鉴权 + 统一响应
```
# app/file/router.py
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, UploadFile

from app.file.schema import FileRespVO
from app.file.service import FileService, get_file_service
from common.response.response_schema import ResponseModel
from common.security.deps import CurrentActiveUser

router = APIRouter(prefix="/files", tags=["文件"])


@router.post("", response_model=ResponseModel[FileRespVO], summary="上传单个文件")
async def upload_file(
    file: Annotated[UploadFile, File(description="文件")],
    user: CurrentActiveUser,
    service: Annotated[FileService, Depends(get_file_service)],
    biz_type: Annotated[str, Form()] = "common",
):
    record = await service.upload(file, uploader_id=user.id, biz_type=biz_type)
    return ResponseModel.ok(FileRespVO.model_validate(record))
```

```python
# 多文件：注意 list[UploadFile]
@router.post("/batch", response_model=ResponseModel[list[FileRespVO]])
async def upload_batch(
    files: Annotated[list[UploadFile], File(description="最多 9 个")],
    user: CurrentActiveUser,
    service: Annotated[FileService, Depends(get_file_service)],
):
    if len(files) > 9:
        raise ClientException("一次最多上传 9 个文件")
    return ResponseModel.ok([...])
```

> **⚠️ 注意：多文件不要串行 await 里做耗时操作**
> 批量上传时若在循环里做图片压缩、病毒扫描这类 CPU/阻塞操作，
> 会占满事件循环。用 `run_in_threadpool` 或 `asyncio.gather` 包一层线程池。

---

## 四、下载：三个必须处理的点
```
# app/file/router.py（续）
from urllib.parse import quote
from fastapi.responses import StreamingResponse

from app.file.storage.deps import get_storage


@router.get("/{file_id}/download", summary="下载文件")
async def download(
    file_id: int,
    user: CurrentActiveUser,
    service: Annotated[FileService, Depends(get_file_service)],
    storage: Annotated[StorageBackend, Depends(get_storage)],
    inline: bool = False,
):
    record = await service.get_owned(file_id, user)   # 内部做归属/权限校验

    # 1) 中文文件名：必须用 RFC 5987 的 filename*=UTF-8'' 编码
    disposition = "inline" if inline else "attachment"
    encoded = quote(record.origin_name)
    headers = {
        "Content-Disposition": f"{disposition}; filename*=UTF-8''{encoded}",
        "Content-Length": str(record.size),
        "X-Content-Type-Options": "nosniff",
    }

    # 2) 流式返回，不要 read() 全部
    return StreamingResponse(
        storage.open(record.storage_key),
        media_type=record.mime,
        headers=headers,
    )
```

**三个必处理点**

| 点 | 不做会怎样 | 做法 |
|---|---|---|
| **中文文件名** | 下载下来是 `%E5%90%88%E5%90%8C.pdf` 或乱码 | `filename*=UTF-8''{quote(name)}` |
| **流式返回** | 大文件 OOM | `StreamingResponse` + 分块 `yield` |
| **权限校验** | 改个 `file_id` 就能下别人的合同 | 校验 `uploader_id` 或业务关联权限 |

> **💡 提示：断点续传下载**
> 直接用 Starlette 的 `FileResponse` 就自带 `Range` 支持（本地文件场景）：
>
```
> return FileResponse(path, filename=..., media_type=...)
>
```
> 但 `FileResponse` 只能读本地路径。对象存储场景要在 `StreamingResponse` 里
> 自己解析 `Range` 头并 `seek`，或者更省事：**给对象存储发一个带签名的临时 URL，让浏览器直连下载**。

---

## 五、秒传与分片上传

### 5.1 秒传（大文件必做）

**流程**：前端算 hash → 后端查是否已存在 → 存在则直接返回记录。

```python
async def _get_by_hash(self, digest: str, size: int) -> FileRecord | None:
    stmt = select(FileRecord).where(
        FileRecord.hash == digest, FileRecord.size == size
    )
    return (await self.db.execute(stmt)).scalar_one_or_none()
```

> **⚠️ 注意：秒传的安全陷阱**
> 如果只按 hash 复用，会出现**越权**：A 上传了机密文件，B 拿到 hash 后"秒传"，
> 就能直接下载 A 的文件。
>
> 正确做法：秒传**只复用物理存储**，但**必须为 B 新建一条 `FileRecord`**（独立的 `uploader_id`），
> 而不是把 A 的记录返回给 B。物理文件用引用计数或 hash 去重表管理生命周期。

### 5.2 分片上传（> 100MB 才需要）

**三个接口**

| 接口 | 方法 | 作用 |
|---|---|---|
| `/files/multipart/init` | POST | 返回 `upload_id` + **已上传的分片索引**（断点续传靠它） |
| `/files/multipart/{uid}/chunk/{index}` | PUT | 上传单个分片（raw body，不走 multipart） |
| `/files/multipart/{uid}/complete` | POST | 合并 + 校验整体 hash + 入库 |

```python
@router.put("/multipart/{upload_id}/chunk/{index}")
async def upload_chunk(
    upload_id: str,
    index: int,
    request: Request,
    user: CurrentActiveUser,
):
    meta = await redis_client.hgetall(f"upload:{upload_id}")
    if not meta:
        raise NotFoundException("上传会话不存在或已过期")

    # 直接读 raw body，避免 multipart 的额外开销
    part_path = TMP_DIR / upload_id / f"{index}.part"
    part_path.parent.mkdir(parents=True, exist_ok=True)
    async with await anyio.open_file(part_path, "wb") as f:
        async for chunk in request.stream():
            await f.write(chunk)

    await redis_client.sadd(f"upload:{upload_id}:parts", index)
    return ResponseModel.ok()
```

```python
@router.post("/multipart/{upload_id}/complete")
async def complete(upload_id: str, user: CurrentActiveUser):
    total = int(await redis_client.hget(f"upload:{upload_id}", "chunks"))
    uploaded = await redis_client.smembers(f"upload:{upload_id}:parts")
    missing = [i for i in range(total) if str(i) not in uploaded]
    if missing:
        raise ClientException(f"分片不完整，缺失：{missing[:10]}")

    # 按序流式合并，边合并边算 hash
    hasher = hashlib.sha256()
    async def _merged():
        for i in range(total):
            async with await anyio.open_file(TMP_DIR / upload_id / f"{i}.part", "rb") as f:
                while chunk := await f.read(1024 * 1024):
                    hasher.update(chunk)
                    yield chunk
    ...
```

**分片设计要点**

- 分片大小建议 **5–10MB**（太小请求数爆炸，太大单次失败代价高）
- 分片**临时存本地磁盘**，合并后再上传对象存储（对象存储的 multipart upload 也可直接用，更省事）
- `upload_id` 的元信息（文件名、总大小、分片数、整体 hash）存 **Redis + TTL 24h**
- 必须有**过期清理**：否则用户传一半跑了，临时文件永远留着
- 前端并发上传 3–4 个分片即可，不要全并发

---

## 六、安全清单

> **🚫 危险：上传是 Web 里最容易被拿下的入口之一**

| 风险 | 防护 |
|---|---|
| **路径穿越** | 绝不使用客户端文件名拼路径；服务端生成 `uuid + 扩展名` |
| **可执行文件** | 扩展名白名单；存储目录**不可执行**（Nginx 里 `location ~ \.(php\|jsp\|sh)$ { deny all; }`） |
| **XSS（SVG/HTML）** | 禁止把 SVG/HTML 当图片直接 inline 返回；或下载时强制 `attachment` |
| **伪装类型** | 魔数校验 + 白名单；不能只看 `content_type` |
| **图片携带 payload** | 用 Pillow 重新编码（`img.save()` 一次），可剥离 EXIF 与多余数据 |
| **超大文件耗尽磁盘** | 应用层限额 **+ Nginx `client_max_body_size`**（默认只有 1MB，必改） |
| **越权下载** | 下载接口校验归属或业务权限；不要暴露静态目录 |
| **病毒/木马** | 企业级接入 ClamAV，上传后异步扫描，未通过则隔离 |
| **存储型 DoS** | 限流（按用户/IP）+ 单用户配额 |
| **文件名超长/空字节** | `origin_name[:255]` 截断，剔除 `\x00` |

---

## 七、前端配合（Vue + axios）

### 7.1 上传：不要手动设 `Content-Type
```
// src/service/api/file.ts
export const fileApi = {
  upload(file: File, bizType = 'common', onProgress?: (p: number) => void) {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('biz_type', bizType);

    return request.post<FileVO>('/files', fd, {
      // 关键：不要写 headers: { 'Content-Type': 'multipart/form-data' }
      // 浏览器必须自己生成带 boundary 的 Content-Type，手写会导致后端解析失败
      onUploadProgress: (e) => {
        if (e.total) onProgress?.(Math.round((e.loaded / e.total) * 100));
      },
    });
  },
};
```

> **⚠️ 注意：最常见的联调失败原因**
> 手动设置 `'Content-Type': 'multipart/form-data'` 会**丢掉 boundary 参数**，
> 后端报 `422` 或 `Expected multipart/form-data`。让浏览器自己设，一行都别写。

### 7.2 下载：`blob` + 从响应头解析文件名
```
async function download(fileId: number, fallbackName = 'download') {
  const res = await request.get<Blob>(`/files/${fileId}/download`, {
    responseType: 'blob',
    flatResponse: false,          // 跳过统一响应体解析
  });

  // 从 Content-Disposition 里取文件名（filename*=UTF-8''xxx）
  const cd = res.headers['content-disposition'] ?? '';
  const match = /filename\*=UTF-8''([^;]+)/i.exec(cd);
  const name = match ? decodeURIComponent(match[1]) : fallbackName;

  const url = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);        // 必须释放，否则内存泄漏
}
```

> **💡 提示：CORS 必须暴露这个头**
> 跨域时浏览器默认**读不到** `Content-Disposition`，需要在后端 CORS 里加：
>
```
> expose_headers=["Content-Disposition", "X-Request-Id"]
>
```
> 否则文件名永远是 `fallbackName`，这是"下载文件名不对"最常见的原因。

---

## 八、常见坑速查

| 现象 | 原因 | 解决 |
|---|---|---|
| `422 Unprocessable Entity` | 缺 `python-multipart` | `pip install python-multipart` |
| `413 Request Entity Too Large` | Nginx 默认 1MB | `client_max_body_size 20m;` |
| 大文件上传进程被杀 | `await file.read()` 全量进内存 | 改成 `read(CHUNK)` 循环 |
| 后端收不到文件 | 前端手写了 `Content-Type` | 删掉，让浏览器生成 boundary |
| 下载文件名乱码 | 没用 RFC 5987 编码 | `filename*=UTF-8''{quote(name)}` |
| 下载文件名是 `download` | CORS 没 expose `Content-Disposition` | 加 `expose_headers` |
| 上传后磁盘有文件但库里没有 | 校验失败但已落盘 | 临时 key + 校验通过后二次落位 |
| 上传接口拖慢整个服务 | 在 `async def` 里做图片压缩/病毒扫描 | `run_in_threadpool` 或改 `def` |
| 用户能下别人的文件 | 下载接口没校验归属 | 校验 `uploader_id` / 业务关联 |
| 中文文件名存进去变 `?` | 数据库字符集不是 utf8mb4 | 建库时指定 `utf8mb4` |

---

## 九、与 Java 的对照（04-跨栈架构思路转译 补充）

| Java / Spring | FastAPI |
|---|---|
| `MultipartFile` | `UploadFile` |
| `@RequestParam("file") MultipartFile file` | `file: UploadFile = File(...)` |
| `file.getOriginalFilename()` | `file.filename` |
| `file.getContentType()` | `file.content_type` |
| `file.getSize()` | `file.size`（或自己累计） |
| `file.transferTo(dest)` | `storage.save(key, stream)` |
| `MultipartFile[] files` | `list[UploadFile]` |
| `spring.servlet.multipart.max-file-size` | 应用层自己校验 + Nginx |
| `Resource` / `ResponseEntity` 下载 | `StreamingResponse` / `FileResponse` |
| `@MultipartConfig` | 无需配置 |

> **💡 提示：一个 Java 没有的坑**
> Spring 的 `MultipartFile` 有框架层的 `max-file-size` 配置，**超限在解析阶段就拒绝**。
> FastAPI 没有这层——`UploadFile` 会把文件完整接收（甚至落临时盘）之后你才拿到控制权。
> 所以 FastAPI 场景下 **Nginx 的 `client_max_body_size` 不是可选项，是必需品**。

---

## 相关笔记

- 03-后端工程化封装-FastAPI — 统一响应、异常、依赖注入、存储层定位
- 02-前端工程化封装-Vue — 请求封装、`flatResponse`、响应拦截器
- 05-落地蓝图与检查清单 — 前后端契约里的文件上传约定
- 04-跨栈架构思路转译 — 本页第九节的完整映射表
- 07-学习计划 — 建议放在 W5（数据层与横切设施）之后阅读

---
- 返回：00-索引-MOC
