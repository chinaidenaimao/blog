---
title: "ORM 增删查改的几种写法与坑"
date: 2026-05-18 22:30:00
cover: /img/covers/infra-server.jpg
top_img: /img/covers/infra-server.jpg
description: "学习了 SQLAlchemy ORM 的核心操作：增（Create）、删（Delete）、查（Read）。"
categories:
  - 后端
tags:
  - SQLAlchemy
  - ORM
  - 笔记
---

## 📚 今日学习内容

学习了 SQLAlchemy ORM 的核心操作：增（Create）、删（Delete）、查（Read）。

---

## 一、增加操作（Create）

### 1. 添加单条记录
```
from sqlalchemy.ext.asyncio import AsyncSession
from models import User

async def create_user(session: AsyncSession):
    # 方式1：直接创建对象
    new_user = User(name="张三", email="zhangsan@example.com", age=25)
    session.add(new_user)
    await session.commit()
    await session.refresh(new_user)  # 刷新获取数据库生成的字段（如id）
    return new_user

    # 方式2：使用字典解包
    user_data = {"name": "李四", "email": "lisi@example.com", "age": 30}
    new_user = User(**user_data)
    session.add(new_user)
    await session.commit()
```

### 2. 批量添加
```
async def batch_create_users(session: AsyncSession):
    users = [
        User(name="用户1", email="user1@example.com", age=20),
        User(name="用户2", email="user2@example.com", age=22),
        User(name="用户3", email="user3@example.com", age=24),
    ]
    session.add_all(users)  # 批量添加
    await session.commit()
    return users
```

### 3. 添加后立即获取ID
```
async def create_and_get_id(session: AsyncSession):
    new_user = User(name="王五", email="wangwu@example.com", age=28)
    session.add(new_user)
    await session.commit()

    # 方式1：commit后通过对象获取
    print(f"新用户ID: {new_user.id}")

    # 方式2：使用refresh（如果ID是数据库生成的）
    await session.refresh(new_user)
    print(f"新用户ID: {new_user.id}")
```

---

## 二、查询操作（Read）

### 1. 基础查询
```
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from models import User

# 查询所有用户
async def get_all_users(session: AsyncSession):
    result = await session.execute(select(User))
    users = result.scalars().all()  # 获取所有对象
    return users

# 查询单个用户（按主键）
async def get_user_by_id(session: AsyncSession, user_id: int):
    result = await session.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()  # 返回单个对象或None
    return user

# 使用get方法（推荐，更简洁）
async def get_user(session: AsyncSession, user_id: int):
    user = await session.get(User, user_id)  # 直接按主键查询
    return user
```

### 2. 条件查询
```
# 精确匹配
result = await session.execute(
    select(User).where(User.name == "张三")
)

# 多条件查询（AND）
result = await session.execute(
    select(User).where(User.age >= 18, User.name.like("%张%"))
)

# OR 条件
from sqlalchemy import or_
result = await session.execute(
    select(User).where(
        or_(User.age < 18, User.name == "未成年")
    )
)

# IN 查询
result = await session.execute(
    select(User).where(User.id.in_([1, 2, 3]))
)

# 排序
result = await session.execute(
    select(User).order_by(User.age.desc())  # 降序
)

# 限制返回数量
result = await session.execute(
    select(User).limit(10).offset(0)  # 分页：每页10条，第0页
)
```

### 3. 聚合查询
```
from sqlalchemy import func

# 统计数量
result = await session.execute(
    select(func.count(User.id))
)
count = result.scalar()

# 求平均值
result = await session.execute(
    select(func.avg(User.age))
)
avg_age = result.scalar()

# 最大值/最小值
result = await session.execute(
    select(func.max(User.age), func.min(User.age))
)
max_age, min_age = result.one()
```

### 4. 关联查询（预加载）
```
from sqlalchemy.orm import selectinload, joinedload

# 假设有 User 和 Post 的一对多关系
# 预加载关联数据（避免N+1问题）
async def get_users_with_posts(session: AsyncSession):
    # 方式1：selectinload（推荐，生成IN查询）
    result = await session.execute(
        select(User).options(selectinload(User.posts))
    )
    users = result.scalars().all()

    # 方式2：joinedload（JOIN查询）
    result = await session.execute(
        select(User).options(joinedload(User.posts))
    )
    users = result.scalars().unique().all()

    return users
```

---

## 三、删除操作（Delete）

### 1. 删除单条记录
```
async def delete_user(session: AsyncSession, user_id: int):
    # 先查询
    user = await session.get(User, user_id)
    if user:
        await session.delete(user)  # 删除
        await session.commit()
        return True
    return False
```

### 2. 批量删除
```
from sqlalchemy import delete

# 删除所有年龄小于18的用户
async def delete未成年_users(session: AsyncSession):
    result = await session.execute(
        delete(User).where(User.age < 18)
    )
    await session.commit()
    print(f"删除了 {result.rowcount} 条记录")
```

### 3. 软删除（推荐）
```
from sqlalchemy import update
from datetime import datetime

# 软删除：标记为已删除，不真正删除数据
async def soft_delete_user(session: AsyncSession, user_id: int):
    await session.execute(
        update(User)
        .where(User.id == user_id)
        .values(is_deleted=True, deleted_at=datetime.now())
    )
    await session.commit()

# 查询时排除已删除的
async def get_active_users(session: AsyncSession):
    result = await session.execute(
        select(User).where(User.is_deleted == False)
    )
    return result.scalars().all()
```

---

## 四、更新操作（Update）

### 1. 更新单条记录
```
async def update_user(session: AsyncSession, user_id: int, new_data: dict):
    user = await session.get(User, user_id)
    if user:
        for key, value in new_data.items():
            setattr(user, key, value)  # 动态设置属性
        await session.commit()
        await session.refresh(user)
        return user
    return None
```

### 2. 批量更新
```
# 批量更新所有用户
await session.execute(
    update(User).values(is_active=True)
)

# 条件批量更新
await session.execute(
    update(User)
    .where(User.age < 18)
    .values(is_minor=True)
)
```

---

## 五、完整示例：CRUD API
```
from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional
from models import User
from database import get_session

app = FastAPI()

# Pydantic模型
class UserCreate(BaseModel):
    name: str
    email: str
    age: int

class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    age: Optional[int] = None

class UserResponse(BaseModel):
    id: int
    name: str
    email: str
    age: int

    class Config:
        from_attributes = True

# 创建用户
@app.post("/users/", response_model=UserResponse)
async def create_user(user: UserCreate, session: AsyncSession = Depends(get_session)):
    db_user = User(**user.model_dump())
    session.add(db_user)
    await session.commit()
    await session.refresh(db_user)
    return db_user

# 获取所有用户
@app.get("/users/", response_model=list[UserResponse])
async def read_users(
    skip: int = 0,
    limit: int = 100,
    session: AsyncSession = Depends(get_session)
):
    result = await session.execute(select(User).offset(skip).limit(limit))
    return result.scalars().all()

# 获取单个用户
@app.get("/users/{user_id}", response_model=UserResponse)
async def read_user(user_id: int, session: AsyncSession = Depends(get_session)):
    user = await session.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="用户不存在")
    return user

# 更新用户
@app.put("/users/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int,
    user_update: UserUpdate,
    session: AsyncSession = Depends(get_session)
):
    user = await session.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="用户不存在")

    update_data = user_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(user, key, value)

    await session.commit()
    await session.refresh(user)
    return user

# 删除用户
@app.delete("/users/{user_id}")
async def delete_user(user_id: int, session: AsyncSession = Depends(get_session)):
    user = await session.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="用户不存在")
    await session.delete(user)
    await session.commit()
    return {"message": "删除成功"}
```

---

## 六、常见坑与最佳实践

### ⚠️ 常见错误
```
# ❌ 错误：忘记await
result = session.execute(select(User))  # 错误！

# ✅ 正确：
result = await session.execute(select(User))

# ❌ 错误：commit后访问对象属性
user = User(name="test")
session.add(user)
session.commit()  # 错误！异步需要await
print(user.id)    # 错误！还未commit

# ✅ 正确：
session.add(user)
await session.commit()
await session.refresh(user)  # 刷新获取最新数据
print(user.id)
```

### ✅ 最佳实践

1. **始终使用 `await`** - 所有数据库操作都是异步的
2. **使用 `refresh()`** - commit后刷新对象获取数据库生成的字段
3. **批量操作用 `add_all()`** - 比逐个添加更高效
4. **预加载关联数据** - 使用 `selectinload` 避免 N+1 问题
5. **软删除优于硬删除** - 保留历史数据，便于恢复和审计
6. **使用 `exclude_unset=True`** - 更新时只更新传入的字段

---

## 七、数据库连接配置

### 1. 异步数据库引擎
```
from sqlalchemy.ext.asyncio import async_sessionmaker, AsyncSession, create_async_engine

# 数据库配置
ASYNC_DATABASE_URL = "mysql+aiomysql://root:123456@localhost:3306/news_app?charset=utf8mb4"

# 异步数据库引擎
async_engine = create_async_engine(
    ASYNC_DATABASE_URL,
    echo=True,          # 显示SQL语句（开发时开启，生产时关闭）
    pool_size=10,       # 连接池大小
    max_overflow=20,    # 最大溢出连接数
)
```

### 2. 异步会话工厂
```
# 异步会话工厂
AsyncSessionLocal = async_sessionmaker(
    bind=async_engine,
    class_=AsyncSession,
    expire_on_commit=False,  # commit后不自动过期对象属性
)
```

### 3. 获取数据库会话（依赖注入）
```
async def get_db():
    async with AsyncSessionLocal as session:
        try:
            yield session
            await session.commit()
        except Exception as e:
            await session.rollback()
            raise e
        finally:
            await session.close()
```

### 4. 在 FastAPI 中使用
```
from fastapi import FastAPI, Depends
from sqlalchemy.ext.asyncio import AsyncSession

app = FastAPI()

@app.get("/users/")
async def get_users(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User))
    return result.scalars().all()
```

---

## 八、跨域中间件配置

### 1. 什么是跨域？

浏览器的安全策略：**同源策略**。只有协议、域名、端口都相同才算同源，否则就是跨域请求。

例如：
- `http://localhost:3000` → `http://localhost:8000` ❌ 跨域
- `http://localhost:3000` → `https://localhost:8000` ❌ 跨域

### 2. 安装 CORS 中间件

FastAPI 内置了 CORSMiddleware，不需要额外安装。

### 3. 基本配置
```
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

# 添加跨域中间件
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],           # 允许所有来源（开发时使用）
    allow_credentials=True,        # 允许携带认证信息（如 Cookie）
    allow_methods=["*"],           # 允许所有 HTTP 方法
    allow_headers=["*"],           # 允许所有请求头
)
```

### 4. 生产环境配置
```
# 生产环境应该指定具体的域名
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",   # 前端开发地址
        "https://yourdomain.com", # 生产环境域名
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)
```

### 5. 参数说明

| 参数 | 说明 |
|------|------|
| `allow_origins` | 允许的来源列表，`["*"]` 表示允许所有 |
| `allow_credentials` | 是否允许携带 Cookie 等认证信息 |
| `allow_methods` | 允许的 HTTP 方法，`["*"]` 表示允许所有 |
| `allow_headers` | 允许的请求头，`["*"]` 表示允许所有 |
| `allow_origin_regex` | 使用正则表达式匹配来源 |

### 6. 完整示例
```
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

# 跨域配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"message": "Hello World"}
```

---

## 九、模块化路由入门

### 1. 什么是 APIRouter？

把不同功能的路由拆分到不同文件中，让代码更清晰、更好维护。

```python
from fastapi import APIRouter

# 创建一个路由器
router = APIRouter()
```

### 2. 在路由器上定义路由
```
from fastapi import APIRouter

router = APIRouter()

# 和在 app 上定义路由一样，只是用 router
@router.get("/hello")
async def say_hello():
    return {"message": "Hello!"}

@router.post("/users")
async def create_user(name: str):
    return {"name": name}
```

### 3. 在主应用中注册路由器
```
from fastapi import FastAPI
from routers import users  # 导入路由文件

app = FastAPI()

# 把路由器"挂载"到主应用上
app.include_router(users.router)
```

### 4. 目录结构示例
```
├── main.py              # 主应用入口
├── routers/             # 路由文件夹
│   ├── __init__.py      # 空文件，让 Python 认识这个文件夹
│   ├── users.py         # 用户相关路由
│   └── items.py         # 商品相关路由
```

### 5. 添加前缀（prefix）
```
# 给这个路由器的所有路由添加统一前缀
app.include_router(
    users.router,
    prefix="/api"      # 所有路由都会变成 /api/xxx
)
```

效果：
- `/users` → `/api/users`
- `/users/1` → `/api/users/1`

### 6. 导入的写法

**文件：`main.py`**
```python
from fastapi import FastAPI
from routers import users
from routers import items

app = FastAPI()
app.include_router(users.router)
app.include_router(items.router)
```

**文件：`routers/users.py`**
```python
from fastapi import APIRouter

router = APIRouter()

@router.get("/users")
async def get_users():
    return []
```

**文件：`routers/__init__.py`**
```python
# 这个文件可以是空的，但必须存在
# 它的作用是让 Python 把 routers 文件夹识别为"包"
```

---

## 十、今日收获

1. 掌握了 ORM 的增删改查基本操作
2. 学会了条件查询、聚合查询、关联查询
3. 理解了软删除的概念和优势
4. 完成了完整的 CRUD API 示例
5. 了解了 APIRouter 模块化路由的基本用法
6. 知道了如何拆分路由到不同文件
7. 掌握了异步数据库引擎的配置方法
8. 理解了会话工厂和依赖注入的用法
9. 理解了跨域（CORS）的概念和原理
10. 学会了如何配置跨域中间件

## 十一、待深入学习

- [ ] 关系映射（一对多、多对多）的详细用法
- [ ] 数据库迁移（Alembic）的使用
- [ ] 查询性能优化技巧
- [ ] 事务管理的最佳实践
- [ ] 模块化路由的多模块嵌套使用
- [ ] 路由器的依赖注入
- [ ] tags 在 API 文档中的分组效果

---

**最后更新：** 2026-07-02
