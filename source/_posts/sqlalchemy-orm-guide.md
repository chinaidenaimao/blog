---
title: "SQLAlchemy ORM 完整教程"
date: 2026-03-12 21:30:00
cover: /img/cover-night.jpg
top_img: /img/cover-night.jpg
description: "从零开始学习 SQLAlchemy ORM，掌握数据库操作的最佳实践"
categories:
  - 后端
tags:
  - SQLAlchemy
  - Python
  - ORM
  - 数据库
---

> 从零开始学习 SQLAlchemy ORM，掌握数据库操作的最佳实践

## 1. ORM 简介

### 什么是 ORM？
ORM（Object-Relational Mapping）是一种编程技术，用于在面向对象编程语言中转换不兼容的数据类型。它将数据库表映射为 Python 类，将行映射为对象。

### 为什么选择 SQLAlchemy？
- ✅ **功能强大**：支持复杂查询和关系
- ✅ **性能优秀**：高效的查询构建
- ✅ **灵活性高**：支持原生 SQL 和 ORM 两种模式
- ✅ **社区活跃**：丰富的文档和插件
- ✅ **FastAPI 集成**：与 FastAPI 完美配合

### ORM vs 原生 SQL
| 特性 | ORM | 原生 SQL |
|------|-----|----------|
| 学习曲线 | 低 | 中 |
| 开发速度 | 快 | 慢 |
| 性能 | 中 | 高 |
| 灵活性 | 中 | 高 |
| 安全性 | 高 | 中 |

---

## 2. 安装与配置

### 2.1 安装 SQLAlchemy```bash
# 基础安装
pip install sqlalchemy

# 安装额外依赖
pip install sqlalchemy[asyncio]  # 异步支持
pip install alembic  # 数据库迁移
```

### 2.2 安装数据库驱动```bash
# SQLite（Python 内置）
# 无需额外安装

# PostgreSQL
pip install psycopg2-binary

# MySQL
pip install mysqlclient

# 异步驱动
pip install asyncpg  # PostgreSQL 异步
pip install aiosqlite  # SQLite 异步
```

### 2.3 验证安装```python
import sqlalchemy
print(sqlalchemy.__version__)
```

---

## 3. 数据库连接

### 3.1 基本连接```python
from sqlalchemy.ext.asyncio import AsyncSession,async_sessionmaker,create_async_engine  
#数据库配置  
ASYNC_DATABASE_URL="mysql+aiomysql://root:123456@localhost:3306/learn_pdf?charset=utf8mb4"  
  
#创建数据库引擎  
async_engine=create_async_engine(  
    ASYNC_DATABASE_URL,  
    echo=True,  
    pool_size=10,  
    max_overflow=20,  
)  
  
# 异步会话工厂  
AsyncSessionLocal = async_sessionmaker(  
    bind=async_engine,  
    class_=AsyncSession,  
    expire_on_commit=False,  
)  
  
async def get_db():  
    async with AsyncSessionLocal() as session:  
        try:  
            yield session  
            await session.commit()  
        except Exception as e:  
            await session.rollback()  
            raise e  
        finally:  
            await session.close()
```

### 3.2 异步连接```python
from sqlalchemy.ext.asyncio import create_async_engine

# 异步 SQLite
engine = create_async_engine("sqlite+aiosqlite:///./sql_app.db")

# 异步 PostgreSQL
engine = create_async_engine("postgresql+asyncpg://user:password@localhost/dbname")
```

### 3.3 连接池管理```python
from sqlalchemy import create_engine
from sqlalchemy.pool import QueuePool

engine = create_engine(
    "sqlite:///./sql_app.db",
    poolclass=QueuePool,
    pool_size=10,
    max_overflow=20,
    pool_timeout=30,
    pool_recycle=1800,
    pool_pre_ping=True
)

# 使用连接
with engine.connect() as connection:
    result = connection.execute("SELECT 1")
```

---

## 4. 模型定义

### 4.1 基本模型```python
from sqlalchemy import Column, Integer, String, Boolean, DateTime
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime

Base = declarative_base()

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), index=True)
    email = Column(String(100), unique=True, index=True)
    hashed_password = Column(String(100))
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<User(id={self.id}, name='{self.name}', email='{self.email}')>"
```

### 4.2 字段类型```python
from sqlalchemy import (
    Column, Integer, String, Float, Boolean, 
    DateTime, Date, Time, Text, JSON, 
    ForeignKey, Enum
)
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()

class Product(Base):
    __tablename__ = "products"

    # 整数
    id = Column(Integer, primary_key=True)
    
    # 字符串
    name = Column(String(100), nullable=False)
    description = Column(Text)
    
    # 浮点数
    price = Column(Float, nullable=False)
    
    # 布尔
    is_available = Column(Boolean, default=True)
    
    # 日期时间
    created_at = Column(DateTime, default=datetime.utcnow)
    release_date = Column(Date)
    
    # JSON
    metadata = Column(JSON)
    
    # 枚举
    class Status(str, Enum):
        ACTIVE = "active"
        INACTIVE = "inactive"
    
    status = Column(Enum(Status), default=Status.ACTIVE)
```

### 4.3 约束和索引```python
from sqlalchemy import Column, Integer, String, CheckConstraint, Index
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    username = Column(String(50), unique=True, nullable=False)
    email = Column(String(100), unique=True, nullable=False)
    age = Column(Integer)

    # 约束
    __table_args__ = (
        CheckConstraint('age >= 0 AND age <= 150', name='check_age_range'),
        Index('idx_user_email', 'email'),
        Index('idx_user_username', 'username'),
    )
```

---

## 5. 创建数据

### 5.1 创建表```python
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()

# 定义模型
class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    name = Column(String(50))

# 创建引擎
engine = create_engine("sqlite:///./sql_app.db")

# 创建所有表
Base.metadata.create_all(bind=engine)

# 删除所有表
Base.metadata.drop_all(bind=engine)
```

### 5.2 插入单条数据```python
from sqlalchemy.orm import Session

# 创建会话
session = Session(bind=engine)

# 创建用户对象
user = User(name="John", email="john@example.com")

# 添加到会话
session.add(user)

# 提交事务
session.commit()

# 刷新获取最新数据
session.refresh(user)
print(user.id)
```

### 5.3 插入多条数据```python
# 批量创建users = [
    User(name="John", email="john@example.com"),
    User(name="Jane", email="jane@example.com"),
    User(name="Bob", email="bob@example.com")
]

# 批量添加
session.add_all(users)
session.commit()

# 使用字典创建
user_data = {"name": "Alice", "email": "alice@example.com"}
user = User(**user_data)
session.add(user)
session.commit()
```

### 5.4 批量插入```python
from sqlalchemy.orm import Session

# 使用 bulk_save_objects
users_data = [
    {"name": "User1", "email": "user1@example.com"},
    {"name": "User2", "email": "user2@example.com"},
    {"name": "User3", "email": "user3@example.com"}
]

users = [User(**data) for data in users_data]
session.bulk_save_objects(users)
session.commit()

# 使用 bulk_insert_mappings
session.bulk_insert_mappings(User, users_data)
session.commit()
```

---

## 6. 查询数据

### 6.1 基本查询```python
from sqlalchemy.orm import Session

# 查询所有
users = session.query(User).all()

# 查询第一个
user = session.query(User).first()

# 查询按条件
user = session.query(User).filter(User.name == "John").first()

# 查询单个
user = session.query(User).filter(User.id == 1).one()

# 查询数量
count = session.query(User).count()
```

### 6.2 过滤条件```python
# 等于
users = session.query(User).filter(User.name == "John").all()

# 不等于
users = session.query(User).filter(User.name != "John").all()

# 大于/小于
users = session.query(User).filter(User.age > 18).all()
users = session.query(User).filter(User.age >= 18).all()
users = session.query(User).filter(User.age < 60).all()
users = session.query(User).filter(User.age <= 60).all()

# 包含
users = session.query(User).filter(User.name.in_(["John", "Jane"])).all()

# 不包含
users = session.query(User).filter(User.name.notin_(["John", "Jane"])).all()

# 模糊查询
users = session.query(User).filter(User.name.like("%John%")).all()
users = session.query(User).filter(User.name.ilike("%john%")).all()  # 忽略大小写

# 多条件
users = session.query(User).filter(
    User.name == "John",
    User.age > 18
).all()

# 或条件
from sqlalchemy import or_
users = session.query(User).filter(
    or_(User.name == "John", User.name == "Jane")
).all()
```

### 6.3 排序和分页```python
# 排序
users = session.query(User).order_by(User.name).all()
users = session.query(User).order_by(User.name.desc()).all()
users = session.query(User).order_by(User.age.asc(), User.name.desc()).all()

# 分页
users = session.query(User).offset(0).limit(10).all()
users = session.query(User).paginate(page=1, per_page=10).all()

# 去重
users = session.query(User.name).distinct().all()
```

### 6.4 聚合查询```python
from sqlalchemy import func

# 计数
count = session.query(func.count(User.id)).scalar()

# 求和
total_age = session.query(func.sum(User.age)).scalar()

# 平均值
avg_age = session.query(func.avg(User.age)).scalar()

# 最大/最小值
max_age = session.query(func.max(User.age)).scalar()
min_age = session.query(func.min(User.age)).scalar()

# 分组聚合
results = session.query(
    User.department,
    func.count(User.id),
    func.avg(User.age)
).group_by(User.department).all()
```

---

## 7. 更新数据

### 7.1 更新单条记录```python
# 查询并更新
user = session.query(User).filter(User.id == 1).first()
user.name = "Jane"
session.commit()

# 直接更新
session.query(User).filter(User.id == 1).update({"name": "Jane"})
session.commit()
```

### 7.2 批量更新```python
# 批量更新
session.query(User).filter(
    User.age < 18
).update({"is_active": False})
session.commit()

# 使用表达式更新
from sqlalchemy import update
session.execute(
    update(User)
    .where(User.age < 18)
    .values(is_active=False)
)
session.commit()
```

### 7.3 更新并返回```python
# 更新并返回更新后的对象
user = session.query(User).filter(User.id == 1).first()
user.name = "Jane"
session.commit()
session.refresh(user)
print(user)
```

---

## 8. 删除数据

### 8.1 删除单条记录```python
# 查询并删除
user = session.query(User).filter(User.id == 1).first()
session.delete(user)
session.commit()

# 直接删除
session.query(User).filter(User.id == 1).delete()
session.commit()
```

### 8.2 批量删除```python
# 批量删除
session.query(User).filter(User.is_active == False).delete()
session.commit()

# 删除所有
session.query(User).delete()
session.commit()
```

### 8.3 软删除```python
class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True)
    name = Column(String(50))
    is_deleted = Column(Boolean, default=False)
    deleted_at = Column(DateTime, nullable=True)

# 软删除
user = session.query(User).filter(User.id == 1).first()
user.is_deleted = True
user.deleted_at = datetime.utcnow()
session.commit()

# 查询未删除的用户
active_users = session.query(User).filter(User.is_deleted == False).all()
```

---

## 9. 关系映射

### 9.1 一对一关系```python
from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship, declarative_base

Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True)
    name = Column(String(50))
    
    # 一对一关系
    profile = relationship("Profile", back_populates="user", uselist=False)

class Profile(Base):
    __tablename__ = "profiles"
    
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True)
    bio = Column(Text)
    
    # 反向关系
    user = relationship("User", back_populates="profile")
```

### 9.2 一对多关系```python
class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True)
    name = Column(String(50))
    
    # 一对多关系
    posts = relationship("Post", back_populates="author", cascade="all, delete-orphan")

class Post(Base):
    __tablename__ = "posts"
    
    id = Column(Integer, primary_key=True)
    title = Column(String(100))
    content = Column(Text)
    author_id = Column(Integer, ForeignKey("users.id"))
    
    # 反向关系
    author = relationship("User", back_populates="posts")
```

### 9.3 多对多关系```python
from sqlalchemy import Table, Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship

# 关联表
user_roles = Table(
    'user_roles',
    Base.metadata,
    Column('user_id', Integer, ForeignKey('users.id')),
    Column('role_id', Integer, ForeignKey('roles.id'))
)

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True)
    name = Column(String(50))
    
    # 多对多关系
    roles = relationship("Role", secondary=user_roles, back_populates="users")

class Role(Base):
    __tablename__ = "roles"
    
    id = Column(Integer, primary_key=True)
    name = Column(String(50))
    
    # 反向关系
    users = relationship("User", secondary=user_roles, back_populates="roles")
```

### 9.4 关系查询```python
# 查询关系数据
user = session.query(User).first()
print(user.posts)  # 访问用户的所有文章

# 预加载关系数据
from sqlalchemy.orm import joinedload

users = session.query(User).options(joinedload(User.posts)).all()

# 子查询加载
from sqlalchemy.orm import subqueryload

users = session.query(User).options(subqueryload(User.posts)).all()

# 动态加载
users = session.query(User).options(selectinload(User.posts)).all()
```

---

## 10. 查询构建

### 10.1 复杂查询```python
from sqlalchemy import and_, or_, not_, func

# 复杂条件
users = session.query(User).filter(
    and_(
        User.age >= 18,
        User.age <= 60,
        or_(
            User.name.like("J%"),
            User.name.like("B%")
        )
    )
).all()

# 子查询
subquery = session.query(func.max(User.age)).scalar()
users = session.query(User).filter(User.age == subquery).all()

# EXISTS 查询
from sqlalchemy import exists

subq = exists().where(Post.author_id == User.id)
users = session.query(User).filter(subq).all()
```

### 10.2 联合查询```python
from sqlalchemy import union, union_all, intersect, except_

# UNION
query1 = session.query(User.name).filter(User.age > 18)
query2 = session.query(User.name).filter(User.age < 60)
result = session.query(User.name).filter(
    User.name.in_(query1.union(query2))
).all()

# UNION ALL
result = session.query(User.name).filter(
    User.name.in_(query1.union_all(query2))
).all()
```

### 10.3 窗口函数```python
from sqlalchemy import func, over

# 排名
rank = func.rank().over(order_by=User.age.desc())
users = session.query(User, rank).all()

# 分区排名
rank = func.rank().over(
    partition_by=User.department,
    order_by=User.age.desc()
)
```

---

## 11. 事务管理

### 11.1 基本事务```python
from sqlalchemy.orm import Session

# 创建会话
session = Session(bind=engine)

try:
    # 开始事务
    user = User(name="John", email="john@example.com")
    session.add(user)
    
    # 提交事务
    session.commit()
except Exception as e:
    # 回滚事务
    session.rollback()
    print(f"Error: {e}")
finally:
    # 关闭会话
    session.close()
```

### 11.2 上下文管理器```python
from contextlib import contextmanager

@contextmanager
def get_session():
    session = Session(bind=engine)
    try:
        yield session
        session.commit()
    except Exception as e:
        session.rollback()
        raise e
    finally:
        session.close()

# 使用
with get_session() as session:
    user = User(name="John", email="john@example.com")
    session.add(user)
```

### 11.3 嵌套事务```python
# 使用 SAVEPOINT
with session.begin():
    user = User(name="John", email="john@example.com")
    session.add(user)
    
    # 嵌套事务
    with session.begin_nested():
        post = Post(title="Hello", author=user)
        session.add(post)
```

---

## 12. 性能优化

### 12.1 预加载```python
from sqlalchemy.orm import joinedload, subqueryload, selectinload

# joinedload - 使用 JOIN 查询
users = session.query(User).options(joinedload(User.posts)).all()

# subqueryload - 使用子查询
users = session.query(User).options(subqueryload(User.posts)).all()

# selectinload - 使用 IN 查询
users = session.query(User).options(selectinload(User.posts)).all()

# 动态加载
users = session.query(User).options(lazyload(User.posts)).all()
```

### 12.2 批量操作```python
# 批量插入
session.bulk_insert_mappings(User, [
    {"name": "User1", "email": "user1@example.com"},
    {"name": "User2", "email": "user2@example.com"}
])

# 批量更新
session.bulk_update_mappings(User, [
    {"id": 1, "name": "Updated1"},
    {"id": 2, "name": "Updated2"}
])

# 批量删除
session.query(User).filter(User.is_active == False).delete()
```

### 12.3 查询优化```python
# 只查询需要的列
users = session.query(User.id, User.name).all()

# 使用 with_entities
users = session.query(User).with_entities(User.id, User.name).all()

# 限制结果数量
users = session.query(User).limit(100).all()

# 使用索引
users = session.query(User).filter(User.email == "john@example.com").all()
```

---

## 13. FastAPI 集成

### 13.1 数据库配置```python
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

SQLALCHEMY_DATABASE_URL = "sqlite:///./sql_app.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, 
    connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# 依赖注入
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

### 13.2 CRUD 操作```python
from sqlalchemy.orm import Session
from . import models, schemas

def get_user(db: Session, user_id: int):
    return db.query(models.User).filter(models.User.id == user_id).first()

def get_user_by_email(db: Session, email: str):
    return db.query(models.User).filter(models.User.email == email).first()

def get_users(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.User).offset(skip).limit(limit).all()

def create_user(db: Session, user: schemas.UserCreate):
    db_user = models.User(
        email=user.email, 
        hashed_password=user.hashed_password
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

def update_user(db: Session, user_id: int, user: schemas.UserUpdate):
    db_user = db.query(models.User).filter(models.User.id == user_id).first()
    if db_user:
        for key, value in user.dict(exclude_unset=True).items():
            setattr(db_user, key, value)
        db.commit()
        db.refresh(db_user)
    return db_user

def delete_user(db: Session, user_id: int):
    db_user = db.query(models.User).filter(models.User.id == user_id).first()
    if db_user:
        db.delete(db_user)
        db.commit()
    return db_user
```

### 13.3 API 路由```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from . import crud, schemas, dependencies

router = APIRouter(
    prefix="/users",
    tags=["users"],
    responses={404: {"description": "Not found"}},
)

@router.get("/", response_model=list[schemas.User])
def read_users(
    skip: int = 0, 
    limit: int = 100, 
    db: Session = Depends(dependencies.get_db)
):
    users = crud.get_users(db, skip=skip, limit=limit)
    return users

@router.post("/", response_model=schemas.User)
def create_user(user: schemas.UserCreate, db: Session = Depends(dependencies.get_db)):
    db_user = crud.get_user_by_email(db, email=user.email)
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    return crud.create_user(db=db, user=user)

@router.get("/{user_id}", response_model=schemas.User)
def read_user(user_id: int, db: Session = Depends(dependencies.get_db)):
    db_user = crud.get_user(db, user_id=user_id)
    if db_user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return db_user
```

---

## 14. 数据库迁移

### 14.1 初始化 Alembic```bash
# 安装 Alembic
pip install alembic

# 初始化
alembic init alembic
```

### 14.2 配置 Alembic```python
# alembic.ini[alembic]
script_location = alembic
sqlalchemy.url = sqlite:///./sql_app.db

# alembic/env.py
from sqlalchemy import engine_from_config
from sqlalchemy.pool import Pool
from alembic import context

config = context.config
target_metadata = Base.metadata
```

### 14.3 创建迁移```bash
# 自动生成迁移
alembic revision --autogenerate -m "add users table"

# 执行迁移
alembic upgrade head

# 回滚迁移
alembic downgrade -1
```

### 14.4 手动编写迁移```python
# alembic/versions/xxx_add_users_table.py
from alembic import op
import sqlalchemy as sa

def upgrade():
    op.create_table(
        'users',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(50), nullable=True),
        sa.Column('email', sa.String(100), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )

def downgrade():
    op.drop_table('users')
```

---

## 15. 测试策略

### 15.1 测试数据库配置```python
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.declarative import declarative_base

# 测试数据库
SQLALCHEMY_DATABASE_URL = "sqlite:///./test.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, 
    connect_args={"check_same_thread": False}
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# 创建表
Base.metadata.create_all(bind=engine)

@pytest.fixture
def db_session():
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
```

### 15.2 测试 CRUD 操作```python
def test_create_user(db_session):
    user = User(name="John", email="john@example.com")
    db_session.add(user)
    db_session.commit()
    
    assert user.id is not None
    assert user.name == "John"

def test_get_user(db_session):
    user = User(name="John", email="john@example.com")
    db_session.add(user)
    db_session.commit()
    
    retrieved_user = db_session.query(User).filter(User.id == user.id).first()
    assert retrieved_user.name == "John"

def test_update_user(db_session):
    user = User(name="John", email="john@example.com")
    db_session.add(user)
    db_session.commit()
    
    user.name = "Jane"
    db_session.commit()
    
    updated_user = db_session.query(User).filter(User.id == user.id).first()
    assert updated_user.name == "Jane"

def test_delete_user(db_session):
    user = User(name="John", email="john@example.com")
    db_session.add(user)
    db_session.commit()
    
    db_session.delete(user)
    db_session.commit()
    
    deleted_user = db_session.query(User).filter(User.id == user.id).first()
    assert deleted_user is None
```

---

## 16. 生产部署

### 16.1 生产配置```python
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# 生产数据库配置
SQLALCHEMY_DATABASE_URL = "postgresql://user:password@localhost/dbname"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    pool_size=20,
    max_overflow=30,
    pool_pre_ping=True,
    pool_recycle=1800,
    echo=False
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
```

### 16.2 Docker 部署
```dockerfile
FROM python:3.9

WORKDIR /code

COPY ./requirements.txt /code/requirements.txt

RUN pip install --no-cache-dir --upgrade -r /code/requirements.txt

COPY ./app /code/app

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "80"]
```

### 16.3 监控和日志```python
import logging
from sqlalchemy import event

# 设置日志
logging.basicConfig()
logging.getLogger('sqlalchemy.engine').setLevel(logging.INFO)

# 监听查询
@event.listens_for(engine, "before_cursor_execute")
def before_cursor_execute(conn, cursor, statement, parameters, context, executemany):
    import time
    conn.info.setdefault('query_start_time', []).append(time.time())

@event.listens_for(engine, "after_cursor_execute")
def after_cursor_execute(conn, cursor, statement, parameters, context, executemany):
    import time
    start_time = conn.info['query_start_time'].pop(-1)
    total = time.time() - start_time
    logging.info(f"Query executed in {total:.4f} seconds")
```
### 17.1创建orm数据库脚本
---
~~~python
import asyncio  
from db.session import engine,Base  
import model.user  
import model.students  #需要记得导入需要创建的对象
async def create_table():  
    async with engine.begin() as conn:  
        await conn.run_sync(Base.metadata.create_all)  
    print("✅建表执行完成")  
    await engine.dispose()  
  
if __name__ == '__main__':  
    asyncio.run(create_table())
~~~
## 🎯 下一步学习

### 推荐资源
- [SQLAlchemy 官方文档](https://docs.sqlalchemy.org/)
- [Alembic 文档](https://alembic.sqlalchemy.org/)
- [FastAPI 数据库文档](https://fastapi.tiangolo.com/tutorial/sql-databases/)

### 进阶主题
- 异步 SQLAlchemy
- 数据库分片
- 缓存策略
- 数据库监控

---

## 📝 笔记区

> 在这里记录你的学习笔记和心得

### 常用代码片段```python
# 快速查询
users = session.query(User).filter(User.is_active == True).all()

# 批量操作
session.bulk_insert_mappings(User, users_data)
session.commit()

# 关系查询
users = session.query(User).options(joinedload(User.posts)).all()
```

### 常见问题
1. **连接池问题**：检查 `pool_size` 和 `max_overflow` 配置
2. **N+1 查询问题**：使用 `joinedload` 或 `selectinload`
3. **事务问题**：确保正确使用 `commit()` 和 `rollback()`

---

*最后更新：2026年6月27日*

#SQLAlchemy #ORM #Python #数据库 #FastAPI
