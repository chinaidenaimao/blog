---
title: "FastAPI 实战：写一个 TODO 应用"
date: 2026-04-08 21:00:00
cover: /img/covers/api-flow.jpg
top_img: /img/covers/api-flow.jpg
description: "构建一个完整的 TODO 应用，包含用户认证、CRUD 操作、数据库集成。"
categories:
  - 后端
tags:
  - FastAPI
  - 实战
  - Python
---

## 🎯 项目目标
构建一个完整的 TODO 应用，包含用户认证、CRUD 操作、数据库集成。

## 📁 项目结构```todo-app/├── app/
│   ├── __init__.py
│   ├── main.py
│   ├── config.py
│   ├── database.py
│   ├── models.py
│   ├── schemas.py
│   ├── crud.py
│   ├── auth.py
│   ├── dependencies.py
│   └── routers/
│       ├── __init__.py
│       ├── users.py
│       └── todos.py
├── tests/
│   ├── __init__.py
│   ├── conftest.py
│   ├── test_users.py
│   └── test_todos.py
├── .env
├── requirements.txt
└── README.md
```

## 📄 核心文件

### 1. 主应用入口 (app/main.py)```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import users, todos
from app.config import settings
from app.database import engine
from app import models

# 创建数据库表
models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="TODO API",
    description="一个完整的 TODO 应用 API",
    version="1.0.0"
)

# CORS 中间件
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 包含路由
app.include_router(users.router)
app.include_router(todos.router)

@app.get("/")
def root():
    return {"message": "欢迎使用 TODO API"}

@app.get("/health")
def health_check():
    return {"status": "healthy"}
```

### 2. 数据库模型 (app/models.py)```python
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    username = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # 关联 todos
    todos = relationship("Todo", back_populates="owner")

class Todo(Base):
    __tablename__ = "todos"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    description = Column(String)
    completed = Column(Boolean, default=False)
    priority = Column(Integer, default=0)  # 0: 低, 1: 中, 2: 高
    due_date = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # 外键
    owner_id = Column(Integer, ForeignKey("users.id"))
    owner = relationship("User", back_populates="todos")
```

### 3. Pydantic 模型 (app/schemas.py)```python
from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime

# 用户相关模型
class UserBase(BaseModel):
    email: EmailStr
    username: str

class UserCreate(UserBase):
    password: str = Field(..., min_length=8)

class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    username: Optional[str] = None
    is_active: Optional[bool] = None

class UserInDB(UserBase):
    id: int
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        orm_mode = True

class User(UserInDB):
    pass

# TODO 相关模型
class TodoBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    priority: int = Field(0, ge=0, le=2)
    due_date: Optional[datetime] = None

class TodoCreate(TodoBase):
    pass

class TodoUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None
    completed: Optional[bool] = None
    priority: Optional[int] = Field(None, ge=0, le=2)
    due_date: Optional[datetime] = None

class TodoInDB(TodoBase):
    id: int
    completed: bool
    owner_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        orm_mode = True

class Todo(TodoInDB):
    pass

# 认证相关模型
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None
```

### 4. CRUD 操作 (app/crud.py)```python
from sqlalchemy.orm import Session
from sqlalchemy import and_
from datetime import datetime
from app import models, schemas
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# 用户 CRUD
def get_user(db: Session, user_id: int):
    return db.query(models.User).filter(models.User.id == user_id).first()

def get_user_by_email(db: Session, email: str):
    return db.query(models.User).filter(models.User.email == email).first()

def get_user_by_username(db: Session, username: str):
    return db.query(models.User).filter(models.User.username == username).first()

def get_users(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.User).offset(skip).limit(limit).all()

def create_user(db: Session, user: schemas.UserCreate):
    db_user = models.User(
        email=user.email,
        username=user.username,
        hashed_password=pwd_context.hash(user.password)
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

def update_user(db: Session, user_id: int, user: schemas.UserUpdate):
    db_user = get_user(db, user_id)
    if db_user:
        update_data = user.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_user, key, value)
        db.commit()
        db.refresh(db_user)
    return db_user

def delete_user(db: Session, user_id: int):
    db_user = get_user(db, user_id)
    if db_user:
        db.delete(db_user)
        db.commit()
        return True
    return False

# TODO CRUD
def get_todo(db: Session, todo_id: int, user_id: int):
    return db.query(models.Todo).filter(
        and_(models.Todo.id == todo_id, models.Todo.owner_id == user_id)
    ).first()

def get_todos(db: Session, user_id: int, skip: int = 0, limit: int = 100):
    return db.query(models.Todo).filter(
        models.Todo.owner_id == user_id
    ).offset(skip).limit(limit).all()

def create_todo(db: Session, todo: schemas.TodoCreate, user_id: int):
    db_todo = models.Todo(**todo.dict(), owner_id=user_id)
    db.add(db_todo)
    db.commit()
    db.refresh(db_todo)
    return db_todo

def update_todo(db: Session, todo_id: int, todo: schemas.TodoUpdate, user_id: int):
    db_todo = get_todo(db, todo_id, user_id)
    if db_todo:
        update_data = todo.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_todo, key, value)
        db.commit()
        db.refresh(db_todo)
    return db_todo

def delete_todo(db: Session, todo_id: int, user_id: int):
    db_todo = get_todo(db, todo_id, user_id)
    if db_todo:
        db.delete(db_todo)
        db.commit()
        return True
    return False

def get_user_todos_by_status(db: Session, user_id: int, completed: bool):
    return db.query(models.Todo).filter(
        and_(models.Todo.owner_id == user_id, models.Todo.completed == completed)
    ).all()
```

### 5. 认证模块 (app/auth.py)```python
from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from app import crud, schemas, dependencies
from app.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="users/token")

def verify_password(plain_password: str, hashed_password: str):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str):
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.access_token_expire_minutes)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)
    return encoded_jwt

async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(dependencies.get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="无法验证凭据",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
        token_data = schemas.TokenData(username=username)
    except JWTError:
        raise credentials_exception
    user = crud.get_user_by_username(db, username=token_data.username)
    if user is None:
        raise credentials_exception
    return user

async def get_current_active_user(current_user: schemas.User = Depends(get_current_user)):
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="用户未激活")
    return current_user
```

### 6. 路由模块 (app/routers/todos.py)```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime
from app import crud, schemas, dependencies, auth

router = APIRouter(
    prefix="/todos",
    tags=["todos"],
    responses={404: {"description": "Not found"}},
)

@router.get("/", response_model=List[schemas.Todo])
def read_todos(
    skip: int = 0,
    limit: int = 100,
    completed: bool = None,
    db: Session = Depends(dependencies.get_db),
    current_user: schemas.User = Depends(auth.get_current_active_user)
):
    if completed is not None:
        todos = crud.get_user_todos_by_status(db, user_id=current_user.id, completed=completed)
    else:
        todos = crud.get_todos(db, user_id=current_user.id, skip=skip, limit=limit)
    return todos

@router.get("/{todo_id}", response_model=schemas.Todo)
def read_todo(
    todo_id: int,
    db: Session = Depends(dependencies.get_db),
    current_user: schemas.User = Depends(auth.get_current_active_user)
):
    db_todo = crud.get_todo(db, todo_id=todo_id, user_id=current_user.id)
    if db_todo is None:
        raise HTTPException(status_code=404, detail="TODO 不存在")
    return db_todo

@router.post("/", response_model=schemas.Todo)
def create_todo(
    todo: schemas.TodoCreate,
    db: Session = Depends(dependencies.get_db),
    current_user: schemas.User = Depends(auth.get_current_active_user)
):
    return crud.create_todo(db=db, todo=todo, user_id=current_user.id)

@router.put("/{todo_id}", response_model=schemas.Todo)
def update_todo(
    todo_id: int,
    todo: schemas.TodoUpdate,
    db: Session = Depends(dependencies.get_db),
    current_user: schemas.User = Depends(auth.get_current_active_user)
):
    db_todo = crud.update_todo(db, todo_id=todo_id, todo=todo, user_id=current_user.id)
    if db_todo is None:
        raise HTTPException(status_code=404, detail="TODO 不存在")
    return db_todo

@router.delete("/{todo_id}")
def delete_todo(
    todo_id: int,
    db: Session = Depends(dependencies.get_db),
    current_user: schemas.User = Depends(auth.get_current_active_user)
):
    success = crud.delete_todo(db, todo_id=todo_id, user_id=current_user.id)
    if not success:
        raise HTTPException(status_code=404, detail="TODO 不存在")
    return {"message": "删除成功"}

@router.put("/{todo_id}/complete")
def complete_todo(
    todo_id: int,
    db: Session = Depends(dependencies.get_db),
    current_user: schemas.User = Depends(auth.get_current_active_user)
):
    todo_update = schemas.TodoUpdate(completed=True)
    db_todo = crud.update_todo(db, todo_id=todo_id, todo=todo_update, user_id=current_user.id)
    if db_todo is None:
        raise HTTPException(status_code=404, detail="TODO 不存在")
    return db_todo

@router.get("/stats/")
def get_todo_stats(
    db: Session = Depends(dependencies.get_db),
    current_user: schemas.User = Depends(auth.get_current_active_user)
):
    all_todos = crud.get_todos(db, user_id=current_user.id, limit=1000)
    completed = [t for t in all_todos if t.completed]
    pending = [t for t in all_todos if not t.completed]
    
    return {
        "total": len(all_todos),
        "completed": len(completed),
        "pending": len(pending),
        "completion_rate": len(completed) / len(all_todos) if all_todos else 0
    }
```

## 🚀 启动项目

### 1. 安装依赖```bash
pip install -r requirements.txt
```

### 2. 配置环境变量
创建 `.env` 文件：
```env
APP_NAME=TODO API
ADMIN_EMAIL=admin@example.com
DATABASE_URL=sqlite:///./todo.db
SECRET_KEY=your-super-secret-key-keep-it-safe
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
```

### 3. 启动应用```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 4. 测试 API```bash
# 1. 注册用户
curl -X POST "http://localhost:8000/users/" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","username":"testuser","password":"password123"}'

# 2. 获取 Token
curl -X POST "http://localhost:8000/users/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=testuser&password=password123"

# 3. 创建 TODO
curl -X POST "http://localhost:8000/todos/" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"学习 FastAPI","description":"完成教程","priority":2}'

# 4. 获取 TODO 列表
curl -X GET "http://localhost:8000/todos/" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 🧪 测试

### 运行测试```bashpytest```

### 测试示例```python
# tests/test_todos.py
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.declarative import declarative_base
from app.main import app
from app.database import get_db, Base

# 测试数据库
SQLALCHEMY_DATABASE_URL = "sqlite:///./test.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base.metadata.create_all(bind=engine)

def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)

def test_create_todo():
    # 注册用户
    user_data = {"email": "test@example.com", "username": "testuser", "password": "password123"}
    client.post("/users/", json=user_data)
    
    # 获取 token
    token_response = client.post("/users/token", data={"username": "testuser", "password": "password123"})
    token = token_response.json()["access_token"]
    
    # 创建 TODO
    todo_data = {"title": "测试 TODO", "description": "测试描述", "priority": 1}
    response = client.post(
        "/todos/",
        json=todo_data,
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["title"] == "测试 TODO"
    assert data["completed"] == False
```

## 📊 API 文档启动后访问：
- Swagger UI: http://127.0.0.1:8000/docs
- ReDoc: http://127.0.0.1:8000/redoc

## 🎯 功能特性✅ 用户注册和登录✅ JWT 认证
✅ TODO 的 CRUD 操作
✅ 按状态筛选 TODO
✅ TODO 统计功能
✅ 优先级设置
✅ 截止日期
✅ 数据库持久化
✅ 完整的错误处理
✅ 自动 API 文档

## 🚀 扩展功能可以继续添加：
- [ ] 标签系统
- [ ] 文件上传
- [ ] WebSocket 实时更新
- [ ] 邮件通知
- [ ] 数据导出
- [ ] 批量操作
- [ ] 分享功能

---

*最后更新：2026年6月27日*

#FastAPI #Python #TODO应用 #实战项目
