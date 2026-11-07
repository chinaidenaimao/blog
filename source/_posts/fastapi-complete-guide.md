---
title: "FastAPI 完整教程：从路由到依赖注入"
date: 2026-02-14 21:20:00
cover: /img/cover-night.jpg
top_img: /img/cover-night.jpg
description: "从零开始学习 FastAPI，构建高性能的现代 Web API"
categories:
  - 后端
tags:
  - FastAPI
  - Python
  - 教程
---

> 从零开始学习 FastAPI，构建高性能的现代 Web API

## 1. FastAPI 简介

### 什么是 FastAPI？
FastAPI 是一个现代、快速（高性能）的 Web 框架，用于构建 API，基于 Python 3.6+ 类型提示。

### 为什么选择 FastAPI？
- ⚡ **高性能**：基于 Starlette 和 Pydantic，性能与 Node.js 和 Go 相当
- 🚀 **开发速度快**：提高开发速度 200% 到 300%
- 🔧 **减少 bug**：减少 40% 的人为错误
- 📖 **直观的 API**：自动生成交互式文档
- 🔒 **类型安全**：完整的类型提示支持

### 与其他框架对比
| 特性 | FastAPI | Flask | Django |
|------|---------|-------|--------|
| 性能 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ |
| 类型安全 | ✅ | ❌ | ❌ |
| 自动生成文档 | ✅ | ❌ | ❌ |
| 异步支持 | ✅ | ✅ | ✅ |
| 学习曲线 | 低 | 低 | 中 |

---

## 2. 环境准备

### 2.1 安装 Python
确保已安装 Python 3.6 或更高版本：
```bash
python --version
```

### 2.2 创建虚拟环境```bash
# 创建虚拟环境
python -m venv fastapi-env

# 激活虚拟环境
# Windows
fastapi-env\Scripts\activate

# macOS/Linux
source fastapi-env/bin/activate
```

### 2.3 安装 FastAPI```bash
# 安装 FastAPI 和 uvicorn
pip install fastapi uvicorn

# 安装可选依赖
pip install python-multipart  # 支持表单数据
pip install python-jose[cryptography]  # JWT 支持
pip install passlib[bcrypt]  # 密码加密
pip install sqlalchemy  # 数据库 ORM
```

### 2.4 创建项目结构```bash
mkdir fastapi-project
cd fastapi-project
mkdir app
touch main.py
```

---

## 3. 第一个 FastAPI 应用

### 3.1 最简单的示例
创建 `main.py` 文件：
```python
from fastapi import FastAPI

# 创建 FastAPI 实例
app = FastAPI()

# 定义根路由
@app.get("/")
def read_root():
    return {"Hello": "World"}
```

### 3.2 运行应用```bash
uvicorn main:app --reload
```

### 3.3 访问应用
- 访问 API：http://127.0.0.1:8000/
- 访问交互式文档：http://127.0.0.1:8000/docs
- 访问 ReDoc 文档：http://127.0.0.1:8000/redoc

---

## 4. 运行应用

### 4.1 开发模式```bash
# 使用 --reload 参数，代码修改后自动重启
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 4.2 生产模式```bash
# 不使用 --reload，使用多个 worker
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4
```

### 4.3 参数说明
- `--host 0.0.0.0`：监听所有网络接口
- `--port 8000`：指定端口号
- `--reload`：开发模式，代码修改自动重启
- `--workers 4`：生产模式，4个工作进程

---

## 5. 路径参数

### 5.1 基本路径参数```python
@app.get("/users/{user_id}")
def read_user(user_id: int):
    return {"user_id": user_id}
```

### 5.2 多个路径参数```python
@app.get("/users/{user_id}/items/{item_id}")
def read_user_item(user_id: int, item_id: int):
    return {"user_id": user_id, "item_id": item_id}
```

### 5.3 预定义路径参数```python
from enum import Enum

class ModelName(str, Enum):
    alexnet = "alexnet"
    resnet = "resnet"
    lenet = "lenet"

@app.get("/models/{model_name}")
def get_model(model_name: ModelName):
    if model_name == ModelName.alexnet:
        return {"model_name": model_name, "message": "Deep Learning FTW!"}
    return {"model_name": model_name, "message": "Have some residuals"}
```

---

## 6. 查询参数

### 6.1 基本查询参数```python
from typing import Optional

@app.get("/items/")
def read_items(skip: int = 0, limit: int = 10):
    return {"skip": skip, "limit": limit}
```

### 6.2 可选查询参数```python
@app.get("/items/{item_id}")
def read_item(item_id: str, q: Optional[str] = None):
    if q:
        return {"item_id": item_id, "q": q}
    return {"item_id": item_id}
```

### 6.3 多个查询参数```python
@app.get("/search/")
def search_items(
    keyword: str,
    category: Optional[str] = None,
    min_price: float = 0,
    max_price: float = 1000
):
    return {
        "keyword": keyword,
        "category": category,
        "min_price": min_price,
        "max_price": max_price
    }
```

---

## 7. 请求体

### 7.1 基本请求体```python
from pydantic import BaseModel

class Item(BaseModel):
    name: str
    description: Optional[str] = None
    price: float
    tax: Optional[float] = None

@app.post("/items/")
def create_item(item: Item):
    return item
```

### 7.2 请求体 + 路径参数```python
@app.put("/items/{item_id}")
def update_item(item_id: int, item: Item):
    return {"item_id": item_id, **item.dict()}
```

### 7.3 多个请求体```python
class User(BaseModel):
    username: str
    email: str

class Item(BaseModel):
    name: str
    price: float

@app.post("/users/{user_id}/items/")
def create_user_item(user_id: int, user: User, item: Item):
    return {
        "user_id": user_id,
        "user": user,
        "item": item
    }
```

---

## 8. 响应模型

### 8.1 基本响应模型```python
from pydantic import BaseModel

class Item(BaseModel):
    name: str
    description: Optional[str] = None
    price: float
    tax: Optional[float] = None

class ItemResponse(BaseModel):
    name: str
    price: float
    tax: float

@app.post("/items/", response_model=ItemResponse)
def create_item(item: Item):
    return item
```

### 8.2 响应模型过滤```python
class ItemCreate(BaseModel):
    name: str
    description: Optional[str] = None
    price: float

class ItemInDB(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    price: float
    created_at: datetime

@app.post("/items/", response_model=ItemInDB)
def create_item(item: ItemCreate):
    # 模拟数据库存储
    item_dict = item.dict()
    item_dict["id"] = 1
    item_dict["created_at"] = datetime.now()
    return item_dict
```

---

## 9. 数据验证

### 9.1 Pydantic 验证```python
from pydantic import BaseModel, Field, EmailStr

class User(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr
    age: int = Field(..., gt=0, lt=150)
    password: str = Field(..., min_length=8)
```

### 9.2 自定义验证器```python
from pydantic import validator

class Item(BaseModel):
    name: str
    price: float

    @validator('price')
    def price_must_be_positive(cls, v):
        if v <= 0:
            raise ValueError('价格必须大于0')
        return v
```

### 9.3 查询参数验证```python
from fastapi import Query

@app.get("/items/")
def read_items(
    q: str = Query(..., min_length=1, max_length=100, regex="^[a-zA-Z0-9]+$"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, le=100)
):
    return {"q": q, "skip": skip, "limit": limit}
```

---

## 10. 依赖注入

### 10.1 基本依赖```python
from fastapi import Depends

async def common_parameters(q: Optional[str] = None, skip: int = 0, limit: int = 100):
    return {"q": q, "skip": skip, "limit": limit}

@app("/items/")
async def read_items(commons: dict = Depends(common_parameters)):
    return commons
```

### 10.2 类依赖```python
class QueryParams:
    def __init__(self, q: Optional[str] = None, skip: int = 0, limit: int = 100):
        self.q = q
        self.skip = skip
        self.limit = limit

@app("/items/")
async def read_items(params: QueryParams = Depends()):
    return {"q": params.q, "skip": params.skip, "limit": params.limit}
```

### 10.3 数据库依赖```python
from sqlalchemy.orm import Session

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.get("/users/")
def read_users(db: Session = Depends(get_db)):
    return db.query(User).all()
```

---

## 11. 中间件

### 11.1 添加中间件```python
from fastapi import Request
import time

@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    process_time = time.time() - start_time
    response.headers["X-Process-Time"] = str(process_time)
    return response
```

### 11.2 CORS 中间件```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### 11.3 自定义中间件类```python
class TimingMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        start_time = time.time()
        await self.app(scope, receive, send)
        process_time = time.time() - start_time
        print(f"Request processed in {process_time} seconds")

app.add_middleware(TimingMiddleware)
```

---

## 12. 错误处理

### 12.1 HTTPException```python
from fastapi import HTTPException

@app.get("/items/{item_id}")
def read_item(item_id: int):
    if item_id == 0:
        raise HTTPException(status_code=404, detail="Item not found")
    return {"item_id": item_id}
```

### 12.2 自定义错误处理```python
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

class CustomException(Exception):
    def __init__(self, name: str, detail: str):
        self.name = name
        self.detail = detail

@app.exception_handler(CustomException)
async def custom_exception_handler(request: Request, exc: CustomException):
    return JSONResponse(
        status_code=418,
        content={"message": f"Oops! {exc.name} did something. There goes a rainbow..."}
    )
```

### 12.3 请求验证错误处理```python
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc):
    return JSONResponse(
        status_code=422,
        content={"detail": exc.errors()}
    )
```

---

## 13. 数据库集成

### 13.1 SQLAlchemy 配置```python
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

SQLALCHEMY_DATABASE_URL = "sqlite:///./sql_app.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()
```

### 13.2 数据库模型```python
from sqlalchemy import Column, Integer, String, Boolean
from .database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    is_active = Column(Boolean, default=True)
```

### 13.3 CRUD 操作```python
from sqlalchemy.orm import Session
from . import models, schemas

def get_user(db: Session, user_id: int):
    return db.query(models.User).filter(models.User.id == user_id).first()

def get_user_by_email(db: Session, email: str):
    return db.query(models.User).filter(models.User.email == email).first()

def create_user(db: Session, user: schemas.UserCreate):
    db_user = models.User(email=user.email, hashed_password=user.hashed_password)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user
```

---

## 14. 用户认证

### 14.1 JWT Token```python
from datetime import datetime, timedelta
from jose import JWTError, jwt
from passlib.context import CryptContext

SECRET_KEY = "your-secret-key-keep-it-secret"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt
```

### 14.2 认证路由```python
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

@app.post("/token")
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends()):
    user = authenticate_user(fake_users_db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token = create_access_token(data={"sub": user.username})
    return {"access_token": access_token, "token_type": "bearer"}
```

### 14.3 保护路由```python
async def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
        token_data = schemas.TokenData(username=username)
    except JWTError:
        raise credentials_exception
    user = get_user(fake_users_db, username=token_data.username)
    if user is None:
        raise credentials_exception
    return user

@app.get("/users/me/")
async def read_users_me(current_user: schemas.User = Depends(get_current_user)):
    return current_user
```

---

## 15. 项目结构

### 15.1 推荐项目结构```
fastapi-project/
├── app/
│   ├── __init__.py
│   ├── main.py
│   ├── config.py
│   ├── database.py
│   ├── models.py
│   ├── schemas.py
│   ├── crud.py
│   ├── dependencies.py
│   └── routers/
│       ├── __init__.py
│       ├── users.py
│       └── items.py
├── tests/
│   ├── __init__.py
│   └── test_api.py
├── requirements.txt
└── README.md
```

### 15.2 配置文件```python
# app/config.py
from pydantic import BaseSettings

class Settings(BaseSettings):
    app_name: str = "My FastAPI App"
    admin_email: str
    items_per_user: int = 50

    class Config:
        env_file = ".env"

settings = Settings()
```

### 15.3 路由组织```python
# app/routers/users.py
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from .. import crud, schemas, dependencies

router = APIRouter(
    prefix="/users",
    tags=["users"],
    responses={404: {"description": "Not found"}},
)

@router.get("/", response_model=list[schemas.User])
def read_users(skip: int = 0, limit: int = 100, db: Session = Depends(dependencies.get_db)):
    users = crud.get_users(db, skip=skip, limit=limit)
    return users
```

---

## 16. 部署上线

### 16.1 Docker 部署
```dockerfile
FROM python:3.9

WORKDIR /code

COPY ./requirements.txt /code/requirements.txt

RUN pip install --no-cache-dir --upgrade -r /code/requirements.txt

COPY ./app /code/app

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "80"]
```

### 16.2 Docker Compose```yaml
version: '3.8'

services:
  web:
    build: .
    ports:
      - "80:80"
    environment:
      - DATABASE_URL=postgresql://user:password@db:5432/dbname
    depends_on:
      - db

  db:
    image: postgres:12
    environment:
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=password
      - POSTGRES_DB=dbname
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

### 16.3 Nginx 配置```nginxserver {listen 80;
    server_name example.com;

    location / {
        proxy_pass http://web:80;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## 🎯 下一步学习

### 推荐资源
- [FastAPI 官方文档](https://fastapi.tiangolo.com/)
- [Pydantic 文档](https://docs.pydantic.dev/)
- [SQLAlchemy 文档](https://docs.sqlalchemy.org/)
- [Starlette 文档](https://www.starlette.io/)

### 进阶主题
- WebSocket 支持
- 后台任务
- 文件上传
- GraphQL 集成
- 微服务架构

---

## 📝 笔记区

> 在这里记录你的学习笔记和心得

### 常用命令```bash
# 安装依赖
pip install -r requirements.txt

# 运行测试pytest

# 格式化代码black .

# 类型检查mypy .```

### 常见问题
1. **CORS 错误**：确保添加了 CORS 中间件
2. **422 Validation Error**：检查请求体格式
3. **数据库连接错误**：检查数据库配置

---

*最后更新：2026年6月27日*

#FastAPI #Python #Web开发 #API开发
