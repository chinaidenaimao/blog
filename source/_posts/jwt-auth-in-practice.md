---
title: "给项目加 JWT 登录鉴权：完整八步"
date: 2026-07-11 22:20:00
cover: /img/covers/security.jpg
top_img: /img/covers/security.jpg
description: "我现在想在我的项目中加入 JWT 登录鉴权，我该怎么去操作，写出操作详情。"
categories:
  - 后端
tags:
  - JWT
  - 鉴权
  - 工程实践
---

> **❓ 问题**
> 我现在想在我的项目中加入 JWT 登录鉴权，我该怎么去操作，写出操作详情。

---

## 🎯 一句话回答

**分 8 步**：① 修密码列长度（前置必做）→ ② 装 PyJWT → ③ 加配置 → ④ 写 `utils/jwt.py` →
⑤ 写 `core/deps.py` 鉴权依赖 → ⑥ 改 login 返回 token → ⑦ 给路由挂依赖 → ⑧ 测试。

**核心思路**：登录成功签发一个**签过名的 token**，之后每个请求带 `Authorization: Bearer <token>`，
后端验签通过就放行。用户密码**不再需要每次都查库比对**，服务端也**不用存 session**（无状态）。

---

## ✅ 第 0 步：密码列长度（已完成）

> **✅ 完成：2026-09-11 已修复**
> `model/user.py` 和数据库都已改成 `String(255)` / `varchar(255)`。
> 实测确认：argon2 哈希现在完整存下来（长度 97），`zhangsan` 用户登录返回 **200** ✅

---

## ⚠️ 第 0.5 步：清掉历史遗留的脏密码（新发现，必做）

> **🚫 危险：库里有 3 种不同格式的密码，其中 2 种会让登录返回 **500****
> **实测结果**（我启动了服务逐个调用 `/api/user/login`）：
>
> | id | username | 密码格式 | 调用结果 |
> | :-- | :--- | :--- | :--- |
> | 1 | `string` | **明文** `string` | 🔴 **HTTP 500** |
> | 2 | `name` | **bcrypt** `$2b$12$...` | 🔴 **HTTP 500** |
> | 3 | `zhangsan` | argon2 ✅ | 🟢 HTTP 200 |
> | 5,6,7 | `123123`/`admin`/`user` | argon2 ✅ | 🟠 HTTP 401（密码不对） |
> | 8,9,10 | `teacher01`/`teacher02`/`lisi` | argon2 ✅ | 🟢 HTTP 200 |
>
> 500 的响应体：
>
```
> {"code":500,"msg":"服务器异常:hash could not be identified","data":null}
>
```

> **⚠️ 注意：为什么是 500 而不是 401 —— 这是真正的 bug**
> `utils/password.py` 里：
>
```
> pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")
>
```
> **只注册了 argon2 一种算法**。
> `pwd_context.verify()` 遇到无法识别的哈希格式时，**不是返回 False，而是抛 `UnknownHashError`**。
>
> 于是 `server/user.py` 的这段逻辑失效了：
>
```
> if db_user is None or not verify_password(user.password, db_user.password):
>     raise HTTPException(401, "用户名或密码错误")
> #                          ↑ 根本走不到这里，verify_password 先抛异常了
>
```
> 异常一路冒泡到 全局异常处理 → **500 + MySQL/库内部错误信息**。
>
> 对比实测（argon2 用户传错密码）：
>
```
> HTTP 401 {"detail":"用户名或密码错误"}     ← 正常路径 ✅
>
```
> 同一个接口，**表现不一致**。

### 修复方式（二选一）

**方案 A：修 `utils/password.py`，让它兼容多种格式**（推荐）

```python
from passlib.context import CryptContext

# 加上 bcrypt，passlib 会自动识别哈希前缀并选择对应算法
# deprecated="auto" 的作用：非首选的算法仍能验证通过，但新密码只用 argon2
pwd_context = CryptContext(schemes=["argon2", "bcrypt"], deprecated="auto")


def get_password_hash(password) -> str:
    return pwd_context.hash(password)      # 新密码仍用 argon2


def verify_password(plain_password, hashed_password) -> bool:
    try:
        return pwd_context.verify(plain_password, hashed_password)
    except Exception:
        # 明文/损坏的哈希会抛异常，统一按"验证失败"处理，避免变成 500return False
```

> **📝 说明：`deprecated="auto"` 是关键**
> 它的语义是：「**能验证**用旧算法（bcrypt）存的密码，但**新哈希只用首选算法**（argon2）」。
> 这正是渐进式迁移需要的——老用户照常登录，新注册的用 argon2。

**方案 B：直接清理掉这些脏数据**

```sql
-- 先看清楚要删什么
SELECT id, username, LEFT(password, 12) AS prefix, LENGTH(password) AS len
FROM user
WHERE password NOT LIKE '$argon2%';

-- 确认后删除（这些是测试数据，无业务价值）
DELETE FROM user WHERE password NOT LIKE '$argon2%';
```

> **⚠️ 注意：别漏了明文那条**
> id=1 的 `string` / `string` 是**明文密码**直接入库的，
> 无论从安全还是功能角度都必须处理掉。见 密码加密。

### 验证
```
# 修复后再测，应该返回 401 而不是 500
curl -i -X POST http://127.0.0.1:8000/api/user/login \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"string\",\"password\":\"whatever\"}"
# 预期 HTTP 401 {"detail":"用户名或密码错误"}
```

详见 用户表 user · 密码加密 · 待办与已知问题

---

## 📦 第 1 步：安装 JWT 库

> **📝 说明：选 PyJWT，不要选 python-jose**
> | 库 | 状态 | 建议 |
> | :--- | :--- | :--- |
> | `python-jose` | 维护停滞，新版 Python 兼容性有风险 | ❌ |
> | **`PyJWT`** | 官方推荐，持续维护，纯 Python | ✅ |
>
> 你的环境是 **Python 3.14**，比较新，`python-jose` 容易出兼容问题。
> 而且你的 `cryptography 50.0.1` 已经装好了，PyJWT 用 HS256 时**连额外依赖都不需要**。

```bash
.venv\Scripts\python.exe -m pip install PyJWT
```

> **💡 提示：为什么 HS256 不需要额外依赖**
> HS256 = HMAC-SHA256，Python 标准库自带的 `hmac` 模块就能算。
> 只有 RS256/ES256（非对称）才需要 `cryptography`（你已经有）。

---

## ⚙️ 第 2 步：加配置

### 2.1 生成密钥
```
.venv\Scripts\python.exe -c "import secrets; print(secrets.token_urlsafe(32))"
```

> **🚫 危险：不要手写 `"secret"` / `"123456"` 这种密钥**
> 密钥一旦泄漏，**任何人都能伪造 token** 冒充任意用户。
> 必须用密码学安全的随机数生成。
>
> 而且**绝对不要把真实密钥提交到 git**。

### 2.2 修改 `.env
```
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=123456
DB_NAME=school_db
api_url=/api

# ↓ 新增
JWT_SECRET_KEY=把上面生成的那串粘进来
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=60
```

### 2.3 修改 `core/config.py
```
class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file='.env', env_file_encoding='utf-8')
    ENV: str = 'development'

    DB_HOST: str
    DB_PORT: int
    DB_USER: str
    DB_PASSWORD: str
    DB_NAME: str
    api_url: str

    # ↓ 新增
    JWT_SECRET_KEY: str                              # 无默认值 → 忘了配会启动报错，这是好事
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 60                     # token 有效期 60 分钟
```

> **💡 提示：`JWT_SECRET_KEY` 故意不给默认值**
> 没配 `.env` 时应用**启动就报错**，而不是用一个弱默认密钥悄悄跑起来。
> 这叫 **fail-fast**，比线上出事才发现好得多。
> 对比 `DB_HOST` 等字段也是同样的写法。

详见 技术栈与依赖

---

## 🔐 第 3 步：写 token 签发/校验工具

**新建文件 `utils/jwt.py`**：

```python
"""JWT 签发与校验。

一句话逻辑：
    签发 = 把用户 id 和过期时间打包，用密钥签名；
    校验 = 用同一个密钥验签，失败就抛异常。
"""
from datetime import datetime, timedelta, timezone

import jwt  # PyJWT

from core.config import settings


def create_access_token(user_id: int, expires_minutes: int | None = None) -> str:
    """签发 access token。"""
    now = datetime.now(timezone.utc)
    expire = now + timedelta(minutes=expires_minutes or settings.JWT_EXPIRE_MINUTES)

    payload = {
        # ⚠️ sub 必须是字符串！PyJWT 2.10+ 收到 int 会在解码时抛 InvalidSubjectError
        "sub": str(user_id),
        "exp": expire,   # 过期时间，PyJWT 会自动校验
        "iat": now,      # 签发时间
    }
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    """校验并解析 token，失败会抛 jwt 的异常。"""
    return jwt.decode(
        token,
        settings.JWT_SECRET_KEY,
        algorithms=[settings.JWT_ALGORITHM],   # ⚠️ 必须是列表，且必须写死算法
    )
```

> **🚫 危险：两个必须注意的安全点**
> **① `sub` 必须是字符串**
>
```
> "sub": str(user_id),   # ✅
> "sub": user_id,        # ❌ int，PyJWT 2.10+ 解码时直接报错
>
```
> JWT 规范（RFC 7519）要求 `sub` 是字符串。
> 你的 `user.id` 是 `int`，这里**必须转换**，否则会踩坑。
>
> **② `algorithms` 必须显式指定**
>
```
> jwt.decode(token, key, algorithms=["HS256"])   # ✅
> jwt.decode(token, key)                          # ❌ PyJWT 会直接报错
>
```
> 如果不指定算法，攻击者可以把 header 改成 `{"alg": "none"}` 伪造 token。
> 指定了算法就杜绝了这种攻击。PyJWT 2.x 强制要求传这个参数。

> **📝 说明：为什么用 `datetime.now(timezone.utc)` 而不是 `datetime.now()`**
> 用**带时区**的 UTC 时间，避免服务器时区变动导致 token 提前/延后过期。
> PyJWT 内部按 UTC 校验 `exp`，本地时间写进去会差 8 小时（中国时区）。

---

## 🛡️ 第 4 步：写鉴权依赖

**新建文件 `core/deps.py`**：

```python
"""FastAPI 依赖：从请求头解析 token，取出当前登录用户。"""
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from db.session import get_db
from model.user import User
from utils.jwts import decode_token

# auto_error=False：没带 token 时不自动抛错，由我们自己控制错误信息
bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_user(
        credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
        db: AsyncSession = Depends(get_db),
) -> User:
    """校验 Authorization: Bearer <token>，返回当前用户。"""
    # 401 必须带 WWW-Authenticate 头，这是 HTTP 规范要求
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        headers={"WWW-Authenticate": "Bearer"},
    )

    if credentials is None:
        unauthorized.detail = "未提供登录凭证"
        raise unauthorized

    try:
        payload = decode_token(credentials.credentials)
    except jwt.ExpiredSignatureError:
        unauthorized.detail = "登录已过期，请重新登录"
        raise unauthorized
    except jwt.InvalidTokenError:
        unauthorized.detail = "无效的登录凭证"
        raise unauthorized

    user_id = payload.get("sub")
    if user_id is None:
        unauthorized.detail = "无效的登录凭证"
        raise unauthorized

    user = await db.get(User, int(user_id))
    if user is None:
        # token 有效，但用户已被删除
        unauthorized.detail = "用户不存在或已被删除"
        raise unauthorized

    return user
```

> **📝 说明：为什么还要查一次数据库？**
> token 里只有 `user_id`，不含用户名等信息。
> 查库有两个作用：
> 1. 拿到完整的 `User` 对象给业务用
> 2. **确认用户还存在** —— 否则删了用户，他的 token 在过期前仍然有效
>
> 代价是每个请求多一次主键查询（走索引，很快）。
> 想省掉可以只信 token 不查库，但安全性下降。

> **💡 提示：为什么用 `HTTPBearer` 而不是 `OAuth2PasswordBearer`**
> | | `HTTPBearer` ✅ | `OAuth2PasswordBearer` |
> | :--- | :--- | :--- |
> | 登录接口格式 | **保持现有 JSON** | 强制 `form-data` |
> | 需要额外依赖 | 无 | `python-multipart` |
> | Swagger 体验 | 点 Authorize 粘贴 token | 弹窗输用户名密码 |
>
> 你已经有了 `POST /api/user/login` 接收 JSON 的实现，
> **用 `HTTPBearer` 不用改动现有 API 契约**，前端无感。
>
> 如果你更想要 Swagger 里输用户名密码的体验，改用 `OAuth2PasswordBearer(tokenUrl="/api/user/login")`，
> 并把登录接口改成 `OAuth2PasswordRequestForm`，但需要额外 `pip install python-multipart`。

> **📝 说明：依赖缓存：同一个请求内 session 是共享的**
> 注意 `get_current_user` 依赖 `get_db`，路由函数**也**依赖 `get_db`。
> FastAPI 默认 `use_cache=True`，同一请求内**相同依赖只执行一次**，
> 所以两者拿到的是**同一个 `AsyncSession`**，不会重复开连接。✅
>
> 这是个容易担心的点，但 FastAPI 已经帮你处理好了。

---

## 🎫 第 5 步：加 token 响应模型

**修改 `schema/user.py`**：

```python
from pydantic import BaseModel, ConfigDict, Field
from datetime import datetime


class UserCreate(BaseModel):
    username: str
    password: str


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)   # ← 顺手补上（原来漏了）
    id: int
    username: str
    create_time: datetime


# ↓ 新增
class TokenResponse(BaseModel):
    access_token: str = Field(description="访问令牌")
    token_type: str = Field(default="bearer", description="令牌类型")
    expires_in: int = Field(description="有效期（秒）")
```

> **💡 提示：顺手修掉 `UserResponse` 缺的 `from_attributes=True`**
> 其他三个模块的 Response 都有，只有用户模块漏了。
> 见 待办与已知问题 第 14 条。

---

## 🔧 第 6 步：改登录接口返回 token

### 6.1 修改 `server/user.py`

在文件末尾**新增**一个函数（`login` 保持不变，职责分离）：

```python
from schema.user import TokenResponse
from utils.jwts import create_access_token
from core.config import settings


def build_token_response(user: User) -> TokenResponse:
    """把用户对象包成 token 响应。纯计算，不需要 db。"""
    return TokenResponse(
        access_token=create_access_token(user.id),
        token_type="bearer",
        expires_in=settings.JWT_EXPIRE_MINUTES * 60,
    )
```

> **📝 说明：为什么单独抽一个函数**
> `login` 负责**校验身份**，`build_token_response` 负责**签发令牌**。
> 以后加「刷新 token」「第三方登录」时，签发逻辑可以直接复用。

### 6.2 修改 `router/user.py
```
from schema.user import UserCreate, UserResponse, TokenResponse
from server.user import create_user, get_user_by_id, login, build_token_response
from core.deps import get_current_user


@router.post("/login", response_model=TokenResponse)      # ← 响应模型改了
async def login_router(user: UserCreate, db: AsyncSession = Depends(get_db)):
    db_user = await login(db, user)                        # 校验用户名密码
    return build_token_response(db_user)                   # 签发 token
```

> **🚫 危险：这是一个**破坏性变更****
> 登录接口的响应体从 `{id, username, create_time}` 变成了
> `{access_token, token_type, expires_in}`。
> **前端必须同步改**：登录后要把 `access_token` 存起来。

### 6.3 新增 `/me` 接口（获取当前用户）
```
@router.get("/me", response_model=UserResponse)
async def read_me(current_user: User = Depends(get_current_user)):
    """用 token 换取当前登录用户信息。"""
    return current_user
```

> **⚠️ 注意：路由顺序有坑！**
> `/me` 必须写在 `/{user_id}` **前面**，否则 `/api/user/me` 会被
> `/{user_id}` 匹配走，然后 `int("me")` 转换失败报 **422**。
>
> 正确顺序：
>
```
> @router.get("/me", ...)          # ← 具体路径在前
> @router.get("/{user_id}", ...)   # ← 通配路径在后
>
```
> FastAPI 按**声明顺序**匹配，先声明先命中。

---

## 🔒 第 7 步：给业务路由挂上鉴权

有三种粒度，**推荐第一种**：

### 方式 A：整个模块保护（推荐）

在 `router/student.py` / `course.py` / `score.py` 里，**只改一行**：

```python
from core.deps import get_current_user

router = APIRouter(
    prefix="/student",
    tags=["学生模块"],
    dependencies=[Depends(get_current_user)],   # ← 加这一行，全模块生效
)
```

> **💡 提示：为什么推荐这种**
> 一个模块的所有接口**通常都需要登录**。
> 写在 `APIRouter` 上只改一处，新增接口**自动继承**，不会漏。

### 方式 B：单个接口保护
```
@router.get("", dependencies=[Depends(get_current_user)])
async def list_students(db: AsyncSession = Depends(get_db)):
    ...
```

### 方式 C：既要鉴权又要用用户对象
```
@router.get("")
async def list_students(
    current_user: User = Depends(get_current_user),   # ← 拿到用户对象
    db: AsyncSession = Depends(get_db),
):
    # 比如：只返回当前用户班级的学生...
```

> **📝 说明：三个模块都要改**
> 学生模块 · 课程模块 · 成绩模块 各改一行。
> 用户模块的 `/create` 和 `/login` **不能加**（还没登录怎么登录）。

---

## ✅ 第 8 步：测试

### 8.1 启动服务
```
.venv\Scripts\python.exe -m uvicorn main:app --reload
```

### 8.2 先注册一个用户
```
curl -X POST http://127.0.0.1:8000/api/user/create ^
  -H "Content-Type: application/json" ^
  -d "{\"username\":\"admin\",\"password\":\"123456\"}"
```

### 8.3 登录拿 token
```
curl -X POST http://127.0.0.1:8000/api/user/login ^
  -H "Content-Type: application/json" ^
  -d "{\"username\":\"admin\",\"password\":\"123456\"}"
```

预期返回：

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIiwiZXhwIjoxNz...",
  "token_type": "bearer",
  "expires_in": 3600
}
```

### 8.4 带 token 访问受保护接口
```
curl http://127.0.0.1:8000/api/student ^
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

预期：`200` + 学生数组

### 8.5 验证鉴权真的生效
```
# 不带 token → 应该 401
curl -i http://127.0.0.1:8000/api/student

# 乱写 token → 应该 401
curl -i http://127.0.0.1:8000/api/student -H "Authorization: Bearer garbage"

# 格式错误（少了 Bearer）→ 应该 401
curl -i http://127.0.0.1:8000/api/student -H "Authorization: abc123"
```

预期响应：

```json
{"detail": "未提供登录凭证"}
```
带响应头 `WWW-Authenticate: Bearer`。

### 8.6 在 Swagger 里测

1. 打开 http://127.0.0.1:8000/docs
2. 调 `/api/user/login` 拿到 `access_token` 并复制
3. 点右上角 **Authorize** 🔓 按钮
4. 在 `Value` 里粘贴 token（**不要**手动加 `Bearer ` 前缀，Swagger 会自动加）
5. 之后所有接口都会自动带上 token

---

## 🧭 完整流程图
```
sequenceDiagram
    autonumber
    participant C as 客户端
    participant API as FastAPI
    participant DEP as core/deps.py
    participant DB as MySQL

    Note over C,DB: ① 登录
    C->>API: POST /api/user/login {username, password}
    API->>DB: SELECT * FROM user WHERE username=?
    DB-->>API: user (含 argon2 哈希)
    API->>API: verify_password() 校验
    API->>API: create_access_token(user.id)
    API-->>C: {access_token, token_type, expires_in}
    C->>C: 存入 localStorage

    Note over C,DB: ② 带 token 访问
    C->>API: GET /api/student<br/>Authorization: Bearer <token>
    API->>DEP: 触发 get_current_user 依赖
    DEP->>DEP: decode_token() 验签 + 查过期
    alt token 无效/过期
        DEP-->>C: 401 {"detail": "登录已过期..."}
    end
    DEP->>DB: SELECT * FROM user WHERE id=?
    DB-->>DEP: user
    DEP-->>API: current_user
    API->>DB: SELECT * FROM students
    DB-->>API: 学生列表
    API-->>C: 200 [ ... ]
```

---

## 🗂️ 改动清单

> **✅ 完成：前置步骤已全部完成（2026-09-11）**
> - ✅ `password` 列长度 50 → 255（模型 + 数据库）
> - ✅ `user` 表脏数据已清理（7 条全部为 argon2）
> - ✅ `verify_password` 已加 try/except 兜底
> - ✅ `model/user.py` 已补 `role` / `update_time`（RBAC 基础就绪）

| # | 文件 | 操作 | 状态 | 说明 |
| :-- | :--- | :--- | :--- | :--- |
| ~~0~~ | `model/user.py` + DB | 改 | ✅ 完成 | `password` 长度 50 → 255 |
| ~~0.5~~ | `utils/password.py` | 改 | ✅ 完成 | 异常兜底，脏密码不再返回 500 |
| ~~0.5~~ | DB `user` 表 | 清理 | ✅ 完成 | 已删除明文/bcrypt 记录 |
| **1** | — | **装** | ⬜ **从这里开始** | `pip install PyJWT` |
| **2** | `.env` | **改** | ⬜ | 加 3 个 JWT 配置 |
| **3** | `core/config.py` | **改** | ⬜ | 加 3 个字段 |
| **4** | `utils/jwt.py` | **新建** | ⬜ | 签发 / 校验 |
| **5** | `core/deps.py` | **新建** | ⬜ | `get_current_user` 依赖 |
| **6** | `schema/user.py` | **改** | ⬜ | 加 `TokenResponse`，补 `from_attributes` |
| **7** | `server/user.py` | **改** | ⬜ | 加 `build_token_response` |
| **8** | `router/user.py` | **改** | ⬜ | login 返回 token，加 `/me` |
| **9** | `router/student.py` | **改** | ⬜ | 挂 `dependencies` 一行 |
| **10** | `router/course.py` | **改** | ⬜ | 挂 `dependencies` 一行 |
| **11** | `router/score.py` | **改** | ⬜ | 挂 `dependencies` 一行 |
| 12 | `core/deps.py` | 改 | 🟡 可选 | 加 `require_role()` 做 RBAC |

### 完成后的自检清单
```
    A["登录返回 access_token"] --> B["带 token 访问 /api/student 返回 200"]
    B --> C["不带 token 返回 401"]
    C --> D["乱写 token 返回 401"]
    D --> E["过期 token 返回 401"]
    E --> F["Swagger 的 Authorize 按钮可用"]
    F --> G["✅ 完成"]
```

---

## ⚠️ 常见坑速查

> **⚠️ 注意：踩坑清单**
> | 现象 | 原因 | 解决 |
> | :--- | :--- | :--- |
> | 登录**返回 500** `hash could not be identified` | 该用户密码是 bcrypt/明文，`CryptContext` 只注册了 argon2 | `schemes=["argon2","bcrypt"]` + try/except |
> | 登录一直说密码错误 | `password` 列被截断 | ✅ 已修 |
> | `InvalidSubjectError` | `sub` 传了 int | `"sub": str(user_id)` |
> | `DecodeError: It is required that you pass in a value for the "algorithms"` | 没传 algorithms | `algorithms=["HS256"]` |
> | `/api/user/me` 报 422 | 被 `/{user_id}` 先匹配了 | `/me` 写在前面 |
> | 401 但不知道为啥 | 客户端少了 `Bearer ` 前缀 | `Authorization: Bearer xxx` |
> | token 刚发就过期 | 用了本地时间没带时区 | 用 `datetime.now(timezone.utc)` |
> | 改了代码不生效 | 表结构没重建 | `create_all` 不改已有表 |

---

## 🚀 后续可扩展

> **💡 提示：这三个是进阶方向，需要时再说**
> 1. **Refresh Token** —— access token 短期（15 分钟）+ refresh token 长期（7 天），
>    过期后用 refresh 换新 access，避免用户频繁重新登录。
> 2. **Token 黑名单** —— 无状态 JWT 的固有问题是**无法主动失效**。
>    要支持「登出」「踢人下线」，需要把已注销的 token 存入 Redis 直到过期。
> 3. **角色权限（RBAC）** —— ⭐ **见下节，你的数据库已经准备好了**

---

## 💡 意外发现：你的数据库已经具备 RBAC 的基础

> **📝 说明：数据库比 ORM 模型多出 3 列**
> **实测 `DESCRIBE user` 结果**（数据库真实结构）：
>
> | 列 | 类型 | 在 `model/user.py` 里？ |
> | :--- | :--- | :--- |
> | `id` | `int` PK | ✅ 有 |
> | `username` | `varchar(50)` UNIQUE | ✅ 有 |
> | `password` | `varchar(255)` | ✅ 有（已修） |
> | `email` | `varchar(100)` UNIQUE NULL | ❌ **没有** |
> | `create_time` | `datetime` | ✅ 有 |
> | `update_time` | `datetime` NOT NULL | ❌ **没有** |
> | `role` | `enum('student','teacher','admin')` | ❌ **没有** |

> **⚠️ 注意：这意味着「模型与数据库不同步」**
> `Base.metadata.create_all` **只建新表，不改已有表**，所以模型和实际库已经漂移了。
>
> **当前不影响运行**，因为多出的列都有默认值（`role` 默认 `student`、
> `update_time` 默认 `CURRENT_TIMESTAMP`、`email` 可空），ORM 插入时忽略它们即可。
>
> **但有两个隐患**：
> 1. `email` 是 **UNIQUE**，ORM 不写它 → 全是 NULL。MySQL 允许多行 NULL，所以暂时不冲突。
> 2. 你**读不到 `role`**，因为 ORM 模型里没有这个字段。

### 想吃上这个红利，改 3 处即可

**① `model/user.py` 补上字段**：

```python
from sqlalchemy import Column, Integer, String, DateTime, Enum, func

class User(Base):
    __tablename__ = "user"

    id: Mapped[int] = Column(Integer, primary_key=True)
    username: Mapped[str] = Column(String(50), unique=True, nullable=False, comment="用户名")
    password: Mapped[str] = Column(String(255), nullable=False, comment="密码哈希")
    email: Mapped[str | None] = Column(String(100), unique=True, nullable=True, comment="邮箱")
    role: Mapped[str] = Column(
        Enum('student', 'teacher', 'admin', name='role'),
        nullable=False, default='student', comment="角色",
    )
    create_time: Mapped[DateTime] = Column(DateTime, default=func.now(), nullable=False)
    update_time: Mapped[DateTime] = Column(
        DateTime, default=func.now(), onupdate=func.now(), nullable=False,
    )
```

**② token 里带上 role**（`utils/jwt.py`）：

```python
payload = {
    "sub": str(user_id),
    "role": role,          # ← 加这一行
    "exp": expire,
    "iat": now,
}
```

**③ 加一个角色依赖**（`core/deps.py`）：

```python
def require_role(*allowed: str):
    """用法：Depends(require_role("admin"))"""
    async def checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in allowed:
            raise HTTPException(403, "权限不足")
        return current_user
    return checker
```

然后就可以给敏感接口加限制：

```python
@router.delete("/{student_id}", dependencies=[Depends(require_role("admin"))])
async def delete_student(...):
    ...
```

> **⚠️ 注意：`role` 应该只信数据库，不信 token**
> 上面把 `role` 写进 token 是为了少查一次库，但**用户的角色被管理员改了之后，
> 旧 token 里的 role 还是旧的**，直到 token 过期才会更新。
> 对权限要求严格的场景，应该每次从数据库读 `current_user.role`（`get_current_user` 已经查了库，直接读就行）。
>
> 本项目的 `get_current_user` 本来就查库，所以**直接用 `current_user.role` 最稳妥**，
> token 里可以不放 role。

> **📝 说明：注意 `model/user.py` 缺 `email`/`role`/`update_time` 时的实际行为**
> 实测确认：**目前注册接口能正常插入**（多出的列都有默认值），
> 但 `UserResponse` 里也读不到这些新字段。
> 见 用户表 user 与 待办与已知问题。

---

## 🔗 相关笔记

- 用户模块 —— 现有登录接口的完整行为
- 用户表 user —— `password` 列长度问题
- 密码加密 —— argon2 哈希原理
- 全局异常处理 —— 401 与 500 的响应差异
- 分层架构约定 —— `deps.py` 放在哪一层合适
- 待办与已知问题 —— 无鉴权是 P1 问题，本篇是它的解决方案
