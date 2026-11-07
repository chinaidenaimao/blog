---
title: "FastAPI 文件上传：校验、存储与返回"
date: 2026-06-14 22:00:00
cover: /img/covers/fastapi-file-upload.svg
top_img: /img/covers/fastapi-file-upload.svg
description: "FastAPI 提供了 File 和 UploadFile 来处理文件上传。"
categories:
  - 后端
tags:
  - FastAPI
  - 文件上传
  - Python
---

## 今日学习内容

### 一、FastAPI 文件上传基础

FastAPI 提供了 `File` 和 `UploadFile` 来处理文件上传。

#### 1.1 两种上传方式对比

| 特性   | `bytes`    | `UploadFile`          |
| ---- | ---------- | --------------------- |
| 内存占用 | 全部加载到内存    | 流式处理，大文件友好            |
| 文件名  | ❌          | ✅ `file.filename`     |
| 内容类型 | ❌          | ✅ `file.content_type` |
| 异步支持 | ❌          | ✅ `await file.read()` |
| 推荐场景 | 小文件 (<1MB) | 所有场景                  |

#### 1.2 基础用法```python
from fastapi import FastAPI, File, UploadFile
from fastapi.responses import JSONResponse
import shutil
from pathlib import Path

app = FastAPI()

# 1. 简单文件上传（内存中处理，小文件）
@app.post("/upload-simple")
async def upload_simple(file: bytes = File(...)):
    # file 是 bytes 类型，适合小文件
    return {"filename": len(file)}

# 2. 推荐方式：UploadFile（大文件友好，支持流式处理）
@app.post("/upload-file")
async def upload_file(file: UploadFile = File(...)):
    # file.filename - 原始文件名
    # file.content_type - MIME 类型
    # file.file - 文件对象（SpooledTemporaryFile）
    
    # 保存到服务器
    save_path = Path(f"uploads/{file.filename}")
    save_path.parent.mkdir(parents=True, exist_ok=True)
    
    with open(save_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    return {
        "filename": file.filename,
        "content_type": file.content_type,
        "size": save_path.stat().st_size
    }
```

### 二、进阶用法

#### 2.1 限制文件大小和类型```python
from fastapi import FastAPI, File, UploadFile, HTTPException
import magic  # python-magic 库

app = FastAPI()

# 配置
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
ALLOWED_TYPES = {"image/jpeg", "image/png", "application/pdf"}

@app.post("/upload-validated")
async def upload_validated(file: UploadFile = File(...)):
    # 检查文件大小
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="文件太大")
    
    # 检查文件类型（通过魔数，不依赖扩展名）
    mime = magic.from_buffer(content, mime=True)
    if mime not in ALLOWED_TYPES:
        raise HTTPException(status_code=415, detail=f"不支持的文件类型: {mime}")
    
    # 重置文件指针
    await file.seek(0)
    
    # 保存文件...
    return {"filename": file.filename, "type": mime}
```

#### 2.2 多文件上传```python
from typing import List

@app.post("/upload-multiple")
async def upload_multiple(files: List[UploadFile] = File(...)):
    results = []
    for file in files:
        save_path = Path(f"uploads/{file.filename}")
        with open(save_path, "wb") as buffer:
            shutil.copyobj(file.file, buffer)
        results.append({"filename": file.filename})
    return {"uploaded": results}
```

#### 2.3 带额外数据的文件上传```python
from pydantic import BaseModel

class UploadMetadata(BaseModel):
    description: str
    tags: List[str] = []

@app.post("/upload-with-metadata")
async def upload_with_metadata(
    file: UploadFile = File(...),
    description: str = "",
    tags: str = ""  # 或者用 Form(...)
):
    # description 和 tags 作为表单字段
    save_path = Path(f"uploads/{file.filename}")
    with open(save_path, "wb") as buffer:
        shutil.copyobj(file.file, buffer)
    
    return {
        "filename": file.filename,
        "description": description,
        "tags": tags.split(",") if tags else []
    }
```

### 三、异步文件处理（推荐）```python
import aiofiles

@app.post("/upload-async")
async def upload_async(file: UploadFile = File(...)):
    save_path = Path(f"uploads/{file.filename}")
    save_path.parent.mkdir(parents=True, exist_ok=True)
    
    # 异步写入
    async with aiofiles.open(save_path, "wb") as buffer:
        content = await file.read()
        await buffer.write(content)
    
    return {"filename": file.filename, "size": len(content)}
```

### 四、静态文件服务（下载）```python
from fastapi.staticfiles import StaticFiles

# 挂载上传目录为静态文件
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# 访问：http://localhost:8000/uploads/filename.jpg```

### 五、完整示例：图片上传服务```python
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import FileResponse
from pathlib import Path
import uuid
import aiofiles

app = FastAPI()

UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

ALLOWED_TYPES = {"image/jpeg", "image/png", "image/gif", "image/webp"}

@app.post("/images")
async def upload_image(file: UploadFile = File(...)):
    # 验证类型
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(415, "仅支持 JPEG, PNG, GIF, WebP")
    
    # 生成唯一名
    ext = file.filename.split(".")[-1]
    filename = f"{uuid.uuid4().hex}.{ext}"
    save_path = UPLOAD_DIR / filename
    
    # 异步保存
    async with aiofiles.open(save_path, "wb") as f:
        content = await file.read()
        await f.write(content)
    
    return {
        "id": filename,
        "url": f"/images/{filename}",
        "size": len(content)
    }

@app.get("/images/{filename}")
async def get_image(filename: str):
    path = UPLOAD_DIR / filename
    if not path.exists():
        raise HTTPException(404, "图片不存在")
    return FileResponse(path)
```

### 六、大文件上传的问题与解决方案

#### 6.1 主要问题

##### 问题 1：内存溢出（最严重）```python
# ❌ 危险：小文件用 bytes，大文件会撑爆内存
@app.post("/upload")
async def upload(file: bytes = File(...)):  # 1GB 文件 → 内存占用 1GB
    pass
```

**后果：**
- 服务器内存耗尽
- 进程被 OOM Killer 杀死
- 所有用户受影响

##### 问题 2：请求超时```默认情况：
├── 客户端超时：无限制（浏览器可能 300s）
├── FastAPI/Uvicorn：无默认超时
├── Nginx：60s
└── 云服务（AWS ALB）：60s
```

**表现：** 上传到 99% 突然失败，用户需要重头开始

##### 问题 3：请求体大小限制```python
# Uvicorn 默认无限制，但中间件/代理可能有限制
# Nginx 默认：client_max_body_size 1m;  ← 只有 1MB！```

**表现：** 返回 `413 Request Entity Too Large`

##### 问题 4：临时文件问题```python
# UploadFile 使用 SpooledTemporaryFile
# 小于 1MB → 存内存
# 大于 1MB → 写入 /tmp 目录

# 问题：
# - /tmp 磁盘空间不足
# - 并发上传撑爆磁盘
# - 临时文件未清理（内存泄漏）```

##### 问题 5：并发上传雪崩```
10 个用户同时上传 1GB 文件：
├── 内存需求：10GB
├── 磁盘 I/O：争抢
└── 结果：全部超时或崩溃
```

#### 6.2 解决方案

##### 方案 1：流式处理（必须）```python
import aiofiles

@app.post("/upload-stream")
async def upload_stream(file: UploadFile = File(...)):
    save_path = Path(f"uploads/{file.filename}")
    
    # ✅ 流式写入，内存占用恒定（~8KB）
    async with aiofiles.open(save_path, "wb") as f:
        while chunk := await file.read(8192):  # 每次读 8KB
            await f.write(chunk)
    
    return {"size": save_path.stat().st_size}
```

##### 方案 2：分块上传（断点续传）```python
# 前端分片
# - 文件切成 5MB 一片
# - 每片独立上传
# - 失败只重传失败的片
# - 最后服务端合并

@app.post("/upload/chunk")
async def upload_chunk(
    file: UploadFile = File(...),
    chunk_number: int = Form(...),
    total_chunks: int = Form(...),
    file_id: str = Form(...)
):
    chunk_path = Path(f"temp/{file_id}/chunk_{chunk_number}")
    chunk_path.parent.mkdir(exist_ok=True)
    
    async with aiofiles.open(chunk_path, "wb") as f:
        content = await file.read()
        await f.write(content)
    
    # 检查是否所有分片都上传完成
    uploaded = len(list(chunk_path.parent.glob("chunk_*")))
    if uploaded == total_chunks:
        await merge_chunks(file_id, total_chunks)
    
    return {"uploaded": uploaded, "total": total_chunks}
```

##### 方案 3：限制并发和大小```python
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
import asyncio

# 限制同时上传数量
upload_semaphore = asyncio.Semaphore(3)  # 最多 3 个并发上传

@app.post("/upload-limited")
async def upload_limited(file: UploadFile = File(...)):
    async with upload_semaphore:  # 获取锁
        # 处理上传pass

# 请求体大小限制（在中间件层）
MAX_UPLOAD_SIZE = 100 * 1024 * 1024  # 100MB

class UploadLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if request.url.path.startswith("/upload"):
            content_length = request.headers.get("content-length")
            if content_length and int(content_length) > MAX_UPLOAD_SIZE:
                return JSONResponse(
                    status_code=413,
                    content={"detail": "文件太大，最大 100MB"}
                )
        return await call_next(request)
```

##### 方案 4：Nginx 配置```nginx
# nginx.conf
client_max_body_size 100m;  # 允许 100MB

# 超时设置
proxy_read_timeout 300s;
proxy_send_timeout 300s;

# 大文件缓冲
proxy_request_buffering off;  # 流式转发，不缓存整个请求体
```

##### 方案 5：云存储直传（推荐）```python
# 不经过你的服务器，直接上传到 OSS/S3import boto3

@app.get("/presigned-url")
async def get_presigned_url(filename: str):
    s3 = boto3.client('s3')
    url = s3.generate_presigned_url(
        'put_object',
        Params={'Bucket': 'my-bucket', 'Key': f'uploads/{filename}'},
        ExpiresIn=3600
    )
    return {"upload_url": url}

# 前端直接上传到 url，不经过你的服务器
# 优点：
# - 服务器零负载
# - 自动利用 CDN
# - 断点续传原生支持```

#### 6.3 最佳实践总结

| 问题 | 解决方案 | 优先级 |
|------|---------|--------|
| 内存溢出 | 流式处理 `file.read(chunk_size)` | ⭐⭐⭐ |
| 超时 | 分块上传 + 进度回调 | ⭐⭐⭐ |
| 大小限制 | Nginx + 中间件双重限制 | ⭐⭐ |
| 并发雪崩 | 信号量限制并发数 | ⭐⭐ |
| 服务器负载 | 云存储直传 | ⭐⭐⭐ |

#### 6.4 推荐架构```小文件（<5MB）：
客户端 → FastAPI → 流式写入磁盘

中文件（5MB-100MB）：
客户端 → FastAPI → 分块上传 → 合并

大文件（>100MB）：
客户端 → 预签名URL → 直传 OSS/S3 → 回调通知
```

## 今日收获

- [x] FastAPI 文件上传的两种方式：`bytes` vs `UploadFile`
- [x] `UploadFile` 的优势：流式处理、获取文件名/类型、异步支持
- [x] 文件大小和类型验证技巧（使用 python-magic）
- [x] 多文件上传处理
- [x] 带元数据的文件上传（表单字段组合）
- [x] 异步文件写入（aiofiles）
- [x] 静态文件服务配置（下载功能）
- [x] 完整的图片上传服务实现
- [x] 大文件上传的常见问题（内存溢出、超时、大小限制、并发雪崩）
- [x] 流式处理的重要性（`file.read(chunk_size)`）
- [x] 分块上传实现断点续传
- [x] 并发控制（信号量限制）
- [x] Nginx 大文件配置优化
- [x] 云存储直传方案（预签名 URL）

## 待深入学习

- [ ] 分块上传（断点续传）实现
- [ ] 云存储集成（AWS S3、阿里云 OSS）
- [ ] 文件处理流水线（压缩、水印、格式转换）
- [ ] 上传进度回调
- [ ] WebSocket 实时上传进度
- [ ] 文件去重（哈希校验）
- [ ] 安全性：病毒扫描、恶意文件检测
- [ ] 大文件上传的前端实现（JavaScript 分片逻辑）
- [ ] 上传任务队列（Celery/RQ 异步处理）

## 遇到的问题（待补充）

## 相关笔记

- Python FastAPI 完整教程
- FastAPI 快速参考
- 2026-07-07-Passlib加密处理+响应封装+异常处理

#FastAPI #文件上传 #Python #Web开发
