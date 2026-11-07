---
title: "用 Passlib 做密码加密：从明文到 bcrypt"
date: 2026-06-02 21:50:00
cover: /img/covers/security.jpg
top_img: /img/covers/security.jpg
description: "Passlib 是 Python 中最流行的密码哈希库，提供了："
categories:
  - 后端
tags:
  - Passlib
  - 安全
  - Python
---

## 今日学习内容

### 一、Passlib 简介

**Passlib** 是 Python 中最流行的密码哈希库，提供了：
- 多种哈希算法支持（bcrypt、argon2、scrypt 等）
- 自动加盐（salt）处理
- 密码验证功能
- 向后兼容性（算法升级无缝迁移）

**安装方式：**
```bash
# 基础安装
pip install passlib

# 如果需要使用 bcrypt 算法
pip install passlib[bcrypt]

# 如果需要使用 argon2 算法（推荐，更安全）
pip install passlib[argon2]
```

---

### 二、核心概念

#### 1. 密码哈希 vs 加密

| 特性 | 哈希（Hash） | 加密（Encryption） |
|------|-------------|-------------------|
| 可逆性 | ❌ 不可逆 | ✅ 可逆 |
| 用途 | 密码存储 | 数据保护 |
| 速度 | 越慢越好（防暴力破解） | 越快越好 |
| 示例 | bcrypt, argon2 | AES, RSA |

**密码存储应该使用哈希，不是加密！**

#### 2. 加盐（Salt）

盐是随机生成的字符串，与密码组合后再哈希：
```
密码: "mypassword"
盐: "a8f5f167f44f4964e6c998dee827110c"
组合: "a8f5f167f44f4964e6c998dee827110c:mypassword"
哈希: "$2b$12$LJ3m4ys3Pz..."
```

**为什么需要盐？**
- 防止彩虹表攻击（预先计算的哈希字典）
- 相同密码产生不同哈希值
- 每次加密结果都不同

#### 3. 工作因子（Work Factor）

控制哈希计算的迭代次数，越大越安全但越慢：
```
工作因子 12: ~250ms
工作因子 14: ~1s
工作因子 16: ~4s
```

---

### 三、基本使用

#### 1. 创建 CryptContext```python
from passlib.context import CryptContext

# 推荐配置：使用 bcrypt + 自动加盐
pwd_context = CryptContext(
    schemes=["bcrypt"],      # 使用的算法
    deprecated="auto"        # 自动弃用旧算法
)
```

#### 2. 密码哈希```python
# 原文密码
password = "mypassword123"

# 哈希密码（自动加盐）
hashed_password = pwd_context.hash(password)
print(hashed_password)
# 输出: $2b$12$LJ3m4ys3Pz0wA6x3K5J3Y.9Q7X8V2N4M6B1C3D5E7F9G1H2I3

# 注意：每次哈希结果都不同（因为盐是随机的）
hashed_password_2 = pwd_context.hash(password)
print(hashed_password_2)
# 输出: $2b$12$kR4m8x2Pz9wB6x3K5J3Y.8Q7X8V2N4M6B1C3D5E7F9G1H2I4
```

#### 3. 密码验证```python
# 验证密码是否匹配
password_to_check = "mypassword123"
is_valid = pwd_context.verify(password_to_check, hashed_password)
print(is_valid)  # True

# 验证错误密码
wrong_password = "wrongpassword"
is_valid = pwd_context.verify(wrong_password, hashed_password)
print(is_valid)  # False
```

#### 4. 检查是否需要重新哈希```python
# 当算法或工作因子更新时，旧密码可能需要重新哈希
needs_rehash = pwd_context.needs_update(hashed_password)
print(needs_rehash)  # False (如果配置没变)

# 如果更新了工作因子
pwd_context_v2 = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto",
    bcrypt__rounds=14  # 增加工作因子
)
needs_rehash = pwd_context_v2.needs_update(hashed_password)
print(needs_rehash)  # True (需要重新哈希)
```

---

### 四、常用算法对比

#### 1. bcrypt（经典选择）```python
from passlib.context import CryptContext

pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto",
    bcrypt__rounds=12  # 工作因子
)
```

**优点：**
- 成熟稳定，广泛使用
- 大多数框架和语言都支持

**缺点：**
- 密码长度限制（72 字节）
- 已经有 20 年历史

#### 2. argon2（推荐）```python
from passlib.context import CryptContext

pwd_context = CryptContext(
    schemes=["argon2"],
    deprecated="auto",
    argon2__memory_cost=65536,   # 64MB 内存消耗
    argon2__time_cost=3,         # 3 次迭代
    argon2__parallelism=4        # 4 个并行线程
)
```

**优点：**
- 2015 年密码哈希竞赛获胜者
- 抵抗 GPU/ASIC 攻击
- 可调节内存消耗

**缺点：**
- 需要额外安装 `passlib[argon2]`

#### 3. scrypt```python
from passlib.context import CryptContext

pwd_context = CryptContext(
    schemes=["scrypt"],
    deprecated="auto",
    scrypt__n=16384,   # CPU/内存成本参数
    scrypt__r=8,       # 块大小
    scrypt__p=1        # 并行化参数
)
```

#### 4. 算法选择建议

| 场景 | 推荐算法 |
|------|---------|
| 新项目 | argon2 |
| 已有 bcrypt 项目 | 继续使用 bcrypt |
| 需要兼容性 | bcrypt |
| 高安全性要求 | argon2 或 scrypt |

---

### 五、FastAPI 实战示例

#### 1. 完整的用户认证模块```python
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from passlib.context import CryptContext
from jose import JWTError, jwt
from datetime import datetime, timedelta

# ==================== 配置 ====================

# Passlib 密码上下文
pwd_context = CryptContext(
    schemes=["argon2"],
    deprecated="auto"
)

# JWT 配置
SECRET_KEY = "your-secret-key-keep-it-safe"  # 生产环境请用环境变量
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# ==================== 数据模型 ====================

class UserCreate(BaseModel):
    username: str
    email: str
    password: str

class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    is_active: bool

    class Config:
        from_attributes = True  # Pydantic v2

class Token(BaseModel):
    access_token: str
    token_type: str

# ==================== 密码工具函数 ====================

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """验证密码"""
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    """生成密码哈希"""
    return pwd_context.hash(password)

def needs_rehash(hashed_password: str) -> bool:
    """检查是否需要重新哈希"""
    return pwd_context.needs_update(hashed_password)

# ==================== API 路由 ====================

app = FastAPI()

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

@app.post("/register", response_model=UserResponse)
async def register(user: UserCreate, db: AsyncSession = Depends(get_db)):
    """用户注册"""
    # 检查用户名是否已存在
    result = await db.execute(select(User).where(User.username == user.username))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="用户名已存在"
        )

    # 创建新用户（密码会自动哈希）
    db_user = User(
        username=user.username,
        email=user.email,
        hashed_password=get_password_hash(user.password)
    )
    db.add(db_user)
    await db.commit()
    await db.refresh(db_user)

    return db_user

@app.post("/token", response_model=Token)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db)
):
    """用户登录"""
    # 查找用户
    result = await db.execute(select(User).where(User.username == form_data.username))
    user = result.scalar_one_or_none()

    # 验证密码
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户名或密码错误",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # 检查是否需要重新哈希（例如算法升级后）
    if needs_rehash(user.hashed_password):
        user.hashed_password = get_password_hash(form_data.password)
        await db.commit()

    # 创建访问令牌
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username},
        expires_delta=access_token_expires
    )

    return {"access_token": access_token, "token_type": "bearer"}
```

#### 2. 使用 Pydantic 验证密码强度```python
from pydantic import BaseModel, field_validator

class UserCreate(BaseModel):
    username: str
    email: str
    password: str

    @field_validator('password')
    @classmethod
    def validate_password(cls, v):
        """验证密码强度"""
        if len(v) < 8:
            raise ValueError('密码长度至少 8 位')
        if not any(c.isupper() for c in v):
            raise ValueError('密码必须包含大写字母')
        if not any(c.islower() for c in v):
            raise ValueError('密码必须包含小写字母')
        if not any(c.isdigit() for c in v):
            raise ValueError('密码必须包含数字')
        return v
```

---

### 六、安全最佳实践

#### 1. 密码策略```python
# 推荐的密码策略配置
PASSWORD_CONFIG = {
    "min_length": 8,
    "require_uppercase": True,
    "require_lowercase": True,
    "require_digit": True,
    "require_special": True,
    "max_length": 128  # 防止 DoS 攻击
}

def validate_password_strength(password: str) -> bool:
    """验证密码强度"""
    if len(password) < PASSWORD_CONFIG["min_length"]:
        return False
    if len(password) > PASSWORD_CONFIG["max_length"]:
        return False
    if PASSWORD_CONFIG["require_uppercase"] and not any(c.isupper() for c in password):
        return False
    if PASSWORD_CONFIG["require_lowercase"] and not any(c.islower() for c in password):
        return False
    if PASSWORD_CONFIG["require_digit"] and not any(c.isdigit() for c in password):
        return False
    if PASSWORD_CONFIG["require_special"] and not any(not c.isalnum() for c in password):
        return False
    return True
```

#### 2. 防止时序攻击```pythonimport hmac

def secure_compare(a: str, b: str) -> bool:
    """恒定时间比较，防止时序攻击"""
    return hmac.compare_digest(a.encode(), b.encode())

# 在验证密码时使用
def verify_password_secure(plain_password: str, hashed_password: str) -> bool:
    """安全的密码验证"""
    return pwd_context.verify(plain_password, hashed_password)
```

#### 3. 速率限制```python
from fastapi import Request
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

@app.post("/login")
@limiter.limit("5/minute")  # 每分钟最多 5 次尝试
async def login(request: Request, ...):
    """带速率限制的登录"""
    pass
```

#### 4. 环境变量管理```pythonimport os
from dotenv import load_dotenv

load_dotenv()

# 从环境变量读取敏感配置
SECRET_KEY = os.getenv("SECRET_KEY")
DATABASE_URL = os.getenv("DATABASE_URL")

# .env 文件示例：
# SECRET_KEY=your-super-secret-key
# DATABASE_URL=mysql+aiomysql://user:password@localhost/dbname
```

---

### 七、常见问题解答

#### Q1: 为什么 bcrypt 密码长度限制 72 字节？```python
# bcrypt 的设计限制，超过 72 字节的部分会被截断
password = "a" * 100  # 100 个字符
hashed = pwd_context.hash(password)

# 解决方案：先用 SHA-256 哈希，再用 bcrypt
import hashlib

def hash_password_long(password: str) -> str:
    """处理长密码"""
    if len(password.encode()) > 72:
        # 先用 SHA-256 哈希
        password_hash = hashlib.sha256(password.encode()).hexdigest()
        return pwd_context.hash(password_hash)
    return pwd_context.hash(password)
```

#### Q2: 如何迁移旧密码哈希？```python
# 假设旧系统使用 MD5（不推荐，仅作示例）
import hashlib

def migrate_old_password(old_hash: str, plain_password: str) -> str:
    """迁移旧密码到新系统"""
    # 验证旧密码
    old_hash_check = hashlib.md5(plain_password.encode()).hexdigest()
    if old_hash_check != old_hash:
        raise ValueError("密码错误")

    # 用新算法重新哈希
    return pwd_context.hash(plain_password)

# 在登录时检查并迁移
async def login_with_migration(user: User, password: str):
    """登录并自动迁移旧密码"""
    if user.password_version == 1:  # 旧版本
        if not migrate_old_password(user.hashed_password, password):
            raise HTTPException(status_code=401, detail="密码错误")

        # 迁移到新版本
        user.hashed_password = get_password_hash(password)
        user.password_version = 2
        await db.commit()
    else:
        if not verify_password(password, user.hashed_password):
            raise HTTPException(status_code=401, detail="密码错误")
```

#### Q3: 如何测试密码哈希功能？```python
import pytest
from passlib.context import CryptContext

def test_password_hashing():
    """测试密码哈希和验证"""
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

    password = "testpassword123"

    # 测试哈希
    hashed = pwd_context.hash(password)
    assert hashed != password
    assert hashed.startswith("$2b$")

    # 测试验证
    assert pwd_context.verify(password, hashed)
    assert not pwd_context.verify("wrongpassword", hashed)

    # 测试每次哈希结果不同
    hashed2 = pwd_context.hash(password)
    assert hashed != hashed2

    # 测试 needs_update
    assert not pwd_context.needs_update(hashed)
```

---

### 八、FastAPI 响应格式封装（补充）

#### 1. 统一响应函数```python
from fastapi.responses import JSONResponse
from fastapi.encoders import jsonable_encoder

def success_response(message: str = 'success', data=None):
    content = {'code': 200, 'message': message, 'data': data}
    return JSONResponse(content=jsonable_encoder(content))
```

**作用：**
- `jsonable_encoder` - 将 Pydantic 模型、datetime 等转为 JSON 兼容格式
- 统一返回结构：`{code, message, data}`

#### 2. Pydantic 模型分层设计```python
# 基础模型（可复用字段）
class UserInfoBase(BaseModel):
    nickname: Optional[str] = None
    avatar: Optional[str] = None
    gender: Optional[str] = None
    bio: Optional[str] = None

# 响应模型（继承基础 + 添加必要字段）
class UserInfoResponse(UserInfoBase):
    username: str
    id: int
    model_config = ConfigDict(from_attributes=True)

# 认证响应（组合多个模型）
class UserAuthResponse(BaseModel):
    token: str
    user_info: UserInfoResponse = Field(..., alias='userInfo')
    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True  # 允许用 alias 赋值
    )
```

#### 3. 核心配置解析

| 配置项 | 作用 |
|--------|------|
| `from_attributes=True` | ORM 对象 → Pydantic 模型 |
| `alias='userInfo'` | Python 字段名 `user_info` → JSON 字段 `userInfo` |
| `populate_by_name=True` | 允许用 `user_info=` 赋值（否则必须用 `userInfo=`） |

#### 4. 使用流程```python
# 1. 创建用户
userData = await create_user(db, user_data)

# 2. 生成 token
token = await create_token(db, userData.id)

# 3. 构建响应模型
res_data = UserAuthResponse(
    token=token,
    user_info=UserInfoResponse.model_validate(userData)  # ORM → Pydantic
)

# 4. 返回统一格式
return success_response(message='注册成功', data=res_data)
```

#### 5. 最终 JSON 输出```json{"code": 200,
  "message": "注册成功",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "userInfo": {
      "id": 1,
      "username": "testuser",
      "nickname": "测试用户",
      "avatar": "https://...",
      "bio": "个人简介"
    }
  }
}
```

#### 6. 扩展：错误响应函数```python
def error_response(message: str = 'error', code: int = 400):
    return JSONResponse(
        status_code=code,
        content={'code': code, 'message': message, 'data': None}
    )

# 使用示例if not user:
    return error_response(message='用户不存在', code=404)
```

---

### 九、响应封装函数详解

#### 1. `success_response()` 函数```python
def success_response(message: str = 'success', data=None):
    content = {'code': 200, 'message': message, 'data': data}
    return JSONResponse(content=jsonable_encoder(content))
```

**作用：** 封装统一的成功响应格式

| 参数 | 说明 |
|------|------|
| `message` | 响应消息，默认 'success' |
| `data` | 响应数据，可以是任意类型 |

**返回：** `{code: 200, message: 'xxx', data: {...}}`

#### 2. `jsonable_encoder()` 函数```python
from fastapi.encoders import jsonable_encoder

# 转换前data = {
    "user": UserResponse(id=1, username="test"),  # Pydantic 对象
    "time": datetime.now()  # datetime 对象
}

# 转换后
jsonable_encoder(data)
# {
#     "user": {"id": 1, "username": "test"},  # 字典
#     "time": "2026-07-07T10:00:00"  # 字符串
# }```

**作用：** 将 Python 对象转为 JSON 兼容的字典

**能转换的类型：**
- ✅ Pydantic 模型 → 字典
- ✅ datetime → ISO 字符串
- ✅ UUID → 字符串
- ✅ 递归处理嵌套对象

#### 3. `model_validate()` 方法```python
# ORM 对象（来自 SQLAlchemy）
userData = User(id=1, username="test", bio="hello")

# 转为 Pydantic 模型
user_response = UserInfoResponse.model_validate(userData)
# UserInfoResponse(id=1, username="test", bio="hello")

# 也可以用字典
user_dict = {"id": 1, "username": "test"}
user_response = UserInfoResponse.model_validate(user_dict)
```

**作用：** 从 ORM 对象或字典创建 Pydantic 模型实例

**前提：** 需要配置 `from_attributes=True`

#### 4. `Field(..., alias='userInfo')` 别名配置```python
class UserAuthResponse(BaseModel):
    token: str
    user_info: UserInfoResponse = Field(..., alias='userInfo')
    #     ↑ Python 字段名                    ↑ JSON 字段名```

**作用：** 定义字段的别名（字段名转换）

| 用法 | 说明 |
|------|------|
| `...` | 必填字段 |
| `alias='userInfo'` | JSON 中用 `userInfo`，Python 中用 `user_info` |

#### 5. `populate_by_name=True` 配置```python
# 没有配置时（默认 False）
res = UserAuthResponse(
    token="xxx",
    userInfo=user_info  # ❌ 必须用 alias
    # user_info=user_info  # ❌ 报错)

# 配置后
res = UserAuthResponse(
    token="xxx",
    user_info=user_info  # ✅ 用原字段名也可以
    # userInfo=user_info  # ✅ 用 alias 也可以)```

**作用：** 允许同时用原字段名或 alias 赋值

#### 6. `model_config` 配置总结```python
model_config = ConfigDict(
    from_attributes=True,    # 允许从 ORM 对象创建模型
    populate_by_name=True    # 允许用原字段名赋值
)
```

| 配置 | 默认值 | 说明 |
|------|--------|------|
| `from_attributes` | `False` | ORM 对象 → Pydantic |
| `populate_by_name` | `False` | 用原字段名而非 alias 赋值 |

#### 7. 数据流转图```
ORM 对象 (SQLAlchemy)
    ↓ model_validate()
Pydantic 模型 (UserInfoResponse)
    ↓ jsonable_encoder()
JSON 兼容字典
    ↓ JSONResponse()
HTTP 响应 (JSON 字符串)
```

---

### 十、FastAPI 全局异常处理

#### 1. 异常处理架构设计```python
import traceback
from fastapi import HTTPException, Request
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError, IntegrityError
from starlette import status

# 开发模式配置
DEBUG_MODE = True  # 生产环境设为 False
```

#### 2. HTTP 异常处理器```python
async def http_exception_handler(request: Request, exception: HTTPException) -> JSONResponse:
    """处理 HTTP 异常（400, 401, 403, 404 等）"""
    return JSONResponse(
        status_code=exception.status_code,
        content={
            'message': exception.detail,
            'code': exception.status_code,
            'data': None
        }
    )
```

**触发场景：**
- `raise HTTPException(status_code=400, detail="用户名已存在")`
- `raise HTTPException(status_code=401, detail="未授权")`
- `raise HTTPException(status_code=404, detail="用户不存在")`

#### 3. 数据库完整性异常处理器```python
async def integrity_exception_handler(request: Request, exception: IntegrityError) -> JSONResponse:
    """处理数据库完整性约束错误"""
    detail = None
    error_msg = str(exception.orig)

    # 解析常见错误
    if "username_UNIQUE" in error_msg or 'Duplicate entry' in error_msg:
        detail = '用户名已存在'
    elif "FOREIGN KEY" in error_msg:
        detail = '外键约束失败'
    else:
        detail = '未知错误'

    # 开发模式返回详细信息
    error_data = None
    if DEBUG_MODE:
        error_data = {
            'error_type': type(exception).__name__,
            'error_detail': str(exception),
            'traceback': traceback.format_exc(),
            'path': str(request.url)
        }

    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            'message': detail or '内部服务器错误',
            'code': status.HTTP_500_INTERNAL_SERVER_ERROR,
            'data': error_data
        }
    )
```

**触发场景：**
- 插入重复的唯一键（如用户名重复）
- 外键约束失败（如引用不存在的记录）

#### 4. SQLAlchemy 通用异常处理器```python
async def sqlalchemy_error_handler(request: Request, exception: SQLAlchemyError) -> JSONResponse:
    """处理其他 SQLAlchemy 数据库错误"""
    error_data = None
    if DEBUG_MODE:
        error_data = {
            'error_type': type(exception).__name__,
            'error_detail': str(exception),
            'traceback': traceback.format_exc(),
            'path': str(request.url)
        }

    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            'message': '数据库操作失败',
            'code': status.HTTP_500_INTERNAL_SERVER_ERROR,
            'data': error_data
        }
    )
```

**触发场景：**
- 数据库连接失败
- SQL 语法错误
- 表不存在
- 字段类型不匹配

#### 5. 通用异常处理器```python
async def exception_handler(request: Request, exception: Exception) -> JSONResponse:
    """处理所有未捕获的异常"""
    error_data = None
    if DEBUG_MODE:
        error_data = {
            'error_type': type(exception).__name__,
            'error_detail': str(exception),
            'traceback': traceback.format_exc(),
            'path': str(request.url)
        }

    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            'message': '内部服务器错误',
            'code': status.HTTP_500_INTERNAL_SERVER_ERROR,
            'data': error_data
        }
    )
```

**触发场景：**
- 所有未被其他处理器捕获的异常
- 兜底处理

#### 6. 注册异常处理器```python
from fastapi import FastAPI
from fastapi import HTTPException
from sqlalchemy.exc import SQLAlchemyError, IntegrityError
from utils.exception import (
    http_exception_handler,
    sqlalchemy_error_handler,
    integrity_exception_handler,
    exception_handler
)

def register_exception_handlers(app: FastAPI):
    """注册所有异常处理器"""
    # 注意：注册顺序很重要，越具体的异常越先注册
    app.add_exception_handler(HTTPException, http_exception_handler)
    app.add_exception_handler(IntegrityError, integrity_exception_handler)
    app.add_exception_handler(SQLAlchemyError, sqlalchemy_error_handler)
    app.add_exception_handler(Exception, exception_handler)

# 在 main.py 中使用
app = FastAPI()
register_exception_handlers(app)
```

#### 7. 异常处理优先级```
请求 → HTTPException? → Yes → http_exception_handler
                  ↓ No
           IntegrityError? → Yes → integrity_exception_handler
                  ↓ No
          SQLAlchemyError? → Yes → sqlalchemy_error_handler
                  ↓ No
             Exception? → Yes → exception_handler (兜底)
```

#### 8. 生产环境配置建议```python
# 生产环境
DEBUG_MODE = False

# 返回给用户的错误信息（不暴露内部细节）
ERROR_MESSAGES = {
    400: '请求参数错误',
    401: '未授权，请先登录',
    403: '没有权限访问',
    404: '资源不存在',
    500: '服务器内部错误，请稍后重试'
}
```

#### 9. 响应格式示例

**开发模式：**
```json
{
  "message": "用户名已存在",
  "code": 500,
  "data": {
    "error_type": "IntegrityError",
    "error_detail": "(pymysql.err.IntegrityError) (1062, \"Duplicate entry 'test' for key 'username_UNIQUE'\")",
    "traceback": "Traceback (most recent call last):\n  File...",
    "path": "http://localhost:8000/api/register"
  }
}
```

**生产模式：**
```json
{
  "message": "用户名已存在",
  "code": 500,
  "data": null
}
```

---

## 今日收获

1. **理解了密码哈希 vs 加密的区别**
   - 哈希不可逆，适合密码存储
   - 加密可逆，适合数据保护

2. **掌握了 Passlib 核心 API**
   - `CryptContext`：配置哈希算法
   - `hash()`：生成密码哈希
   - `verify()`：验证密码
   - `needs_update()`：检查是否需要重新哈希

3. **了解了常用算法**
   - bcrypt：经典选择，但有 72 字节限制
   - argon2：推荐使用，更安全
   - scrypt：介于两者之间

4. **学会了 FastAPI 集成**
   - 用户注册时哈希密码
   - 用户登录时验证密码
   - 自动迁移旧密码哈希

5. **掌握了安全最佳实践**
   - 使用环境变量管理密钥
   - 实施速率限制
   - 验证密码强度
   - 防止时序攻击

6. **学会了响应格式封装**
   - 统一响应函数 `success_response()` / `error_response()`
   - `jsonable_encoder` 将 Pydantic 模型转为 JSON
   - Pydantic 模型分层设计：Base → Response
   - `model_validate()` 将 ORM 对象转为 Pydantic 模型
   - `alias` 实现字段名转换（Python snake_case → JSON camelCase）
   - `populate_by_name=True` 允许用原字段名赋值
   - 掌握了数据流转：ORM → Pydantic → 字典 → JSONResponse

7. **掌握了全局异常处理**
   - `HTTPException` 处理器：处理 400/401/403/404 等 HTTP 错误
   - `IntegrityError` 处理器：处理数据库完整性约束错误（如重复键）
   - `SQLAlchemyError` 处理器：处理通用数据库错误
   - `Exception` 处理器：兜底处理所有未捕获异常
   - 异常处理器注册顺序：越具体的异常越先注册
   - `DEBUG_MODE` 开发/生产模式切换
   - 生产环境不暴露内部错误细节

---

## 待深入学习

- [ ] Argon2 算法的详细配置和性能调优
- [ ] 多因素认证（MFA）集成
- [ ] 密码重置流程实现
- [ ] 密码历史记录（防止重复使用旧密码）
- [ ] 账户锁定机制（暴力破解防护）
- [ ] 密码过期策略
- [ ] 与其他认证系统集成（OAuth2、OpenID Connect）

---

## 遇到的问题（等待补充）

---

## 相关笔记

- Python FastAPI 完整教程
- Pydantic 数据模型教程
- 数据库设计与实践教程

---

#Python #FastAPI #安全 #密码哈希 #Passlib
