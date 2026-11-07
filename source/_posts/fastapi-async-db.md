---
title: "FastAPI 异步数据库：async session 怎么用"
date: 2026-05-06 23:10:00
cover: /img/cover-night.jpg
top_img: /img/cover-night.jpg
description: "FastAPI + SQLAlchemy 异步操作学习笔记"
categories:
  - 后端
tags:
  - FastAPI
  - 异步
  - SQLAlchemy
---

> FastAPI + SQLAlchemy 异步操作学习笔记

## 今日学习内容

### 核心知识点

#### 1. 异步数据库连接配置```python
ASYNC_DATA_BASE_URL = 'mysql+aiomysql://root:123456@localhost:3306/fastapi_db?charset=utf8mb4'

async_engine = create_async_engine(
    ASYNC_DATA_BASE_URL,
    echo=True,        # 打印SQL语句，调试用
    pool_size=10,     # 连接池大小
    max_overflow=20,  # 最大溢出连接数
)
```

**关键理解：**
- `mysql+aiomysql`：使用 aiomysql 驱动实现异步MySQL连接
- `echo=True`：开发环境开启SQL日志，生产环境应关闭
- `pool_size=10`：基础连接池保持10个连接
- `max_overflow=20`：高峰期最多额外20个连接

---

#### 2. SQLAlchemy ORM 模型定义```python
class Base(DeclarativeBase):
    create_time: Mapped[datetime] = mapped_column(
        DateTime,
        insert_default=datetime.now,
        default=datetime.now(),  # 注意：这里有坑！
        comment='创建时间'
    )
    update_time: Mapped[datetime] = mapped_column(
        DateTime,
        insert_default=datetime.now,
        default=datetime.now(),  # 注意：这里有坑！
        comment='更新时间'
    )
```

**⚠️ 发现问题：**

`default=datetime.now()` 这个写法有问题！
- `datetime.now()` 只在类定义时执行一次，之后所有实例都用同一个时间
- 应该改为 `default=datetime.now`（不带括号），这样每次创建实例时才执行

---

#### 3. 模型表结构```python
# 书籍表
class Book(Base):
    __tablename__ = 'books'
    id: Mapped[int] = mapped_column(primary_key=True, comment='id')
    bookname: Mapped[str] = mapped_column(String(255), comment='书名')
    author: Mapped[str] = mapped_column(String(255), comment='作者')
    price: Mapped[float] = mapped_column(Float, comment='价格')
    publish: Mapped[str] = mapped_column(String(255), comment='出版')

# 用户表
class User(Base):
    __tablename__ = 'users'
    id: Mapped[int] = mapped_column(primary_key=True, comment='id')
    name: Mapped[str] = mapped_column(String(255), comment='用户名')
    password: Mapped[str] = mapped_column(String(255), comment='密码')
    email: Mapped[str] = mapped_column(String(255), comment='邮箱')
    phone: Mapped[str] = mapped_column(String(255), comment='手机号')
    address: Mapped[str] = mapped_column(String(255), comment='地址')
```

---

#### 4. 应用启动时自动建表```python
async def create_table():
    async with async_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

@app.on_event('startup')
async def startup():
    await create_table()
```

**关键点：**
- `run_sync()`：将同步的 `create_all` 包装成异步执行
- `Base.metadata.create_all`：根据所有继承Base的模型类创建表
- `@app.on_event('startup')`：FastAPI启动时自动执行

---

#### 5. 异步会话工厂（重点！）```python
AsyncSessionLocal = async_sessionmaker(
    bind=async_engine,          # 绑定异步引擎
    class_=AsyncSession,        # 使用异步会话类
    expire_on_commit=False,     # 提交后不禁用对象属性
)
```

**理解：**
- `async_sessionmaker`：创建异步会话的工厂（类似同步的 `sessionmaker`）
- `expire_on_commit=False`：提交后对象属性仍然可访问，避免再次查询

---

**🔍 深入理解：异步会话工厂是什么？**

> **一句话理解：** 异步会话工厂 = "数据库连接的生产线"，每次调用它，就自动生产一个可以操作数据库的"会话对象"。

**🏭 生活类比：工厂模式**
```
🏭 工厂（async_sessionmaker）
   ↓ 生产
📦 产品（AsyncSession）= 你可以拿着这个产品去数据库操作

就像：
👔 服装厂 → 生产 → 衣服（你穿衣服，不是穿工厂）
📱 手机厂 → 生产 → 手机（你用手机，不是用工厂）
```

**具体作用：**
```python
# 第1步：创建工厂（定义如何生产会话）
AsyncSessionLocal = async_sessionmaker(
    bind=async_engine,          # 指定用哪个数据库引擎
    class_=AsyncSession,        # 指定生产什么类型的会话
    expire_on_commit=False,     # 配置选项
)

# 第2步：使用工厂生产会话
async with AsyncSessionLocal() as session:
    # session 就是工厂生产出来的产品
    # 你可以用它来操作数据库
    result = await session.execute(select(Book))
```

**为什么需要工厂？**

| 问题 | 工厂如何解决 |
|------|-------------|
| 每次都手动创建连接很麻烦 | 工厂自动创建 |
| 需要统一配置（连接池等） | 工厂集中管理配置 |
| 需要确保会话正确关闭 | 工厂提供上下文管理 |
| 并发请求需要多个会话 | 工厂可以批量生产 |

**工厂的配置参数详解：**
```python
AsyncSessionLocal = async_sessionmaker(
    bind=async_engine,          # 绑定的数据库引擎（连接池）
    class_=AsyncSession,        # 会话类（异步版本）
    expire_on_commit=False,     # 提交后对象不失效
)
```

> **`expire_on_commit=False` 的意思：**
> - 默认 `True`：提交后，对象的属性会"过期"，下次访问要重新查询数据库
> - 设为 `False`：提交后，对象属性仍然可直接访问，不用重新查

**实际使用流程：**
```
1. 请求进入 FastAPI 路由
   ↓
2. Depends(get_dbbase) 触发依赖注入
   ↓
3. AsyncSessionLocal() 工厂生产一个 session
   ↓
4. session 被注入到路由函数
   ↓
5. 路由用 session 执行数据库操作
   ↓
6. 操作完成，自动提交/回滚/关闭 session
```

**简单代码演示：**
```python
# 创建工厂
AsyncSessionLocal = async_sessionmaker(bind=async_engine)

# 场景1：单次使用
async def demo():
    async with AsyncSessionLocal() as session:  # 工厂生产session
        result = await session.execute(select(Book))
        books = result.scalars().all()
    # 离开with块，session自动关闭

# 场景2：在FastAPI中使用（推荐）
async def get_db():
    async with AsyncSessionLocal() as session:
        yield session  # 把session交给FastAPI管理
```

**概念总结：**

| 概念 | 角色 | 类比 |
|------|------|------|
| `async_engine` | 数据库连接池 | 🏭 工厂的厂房 |
| `async_sessionmaker` | 会话工厂 | 🏭 生产线 |
| `AsyncSession` | 数据库会话 | 📦 产品（你实际使用的） |

> **核心思想：** 工厂模式让你不用关心"怎么创建会话"，只管"用会话做什么"。

---

#### 6. 依赖注入获取数据库会话（核心模式）```python
async def get_dbbase():
    async with AsyncSessionLocal() as session:
        try:
            yield session          # 返回会话给路由使用
            await session.commit() # 路由执行成功后提交
        except Exception as e:
            await session.rollback() # 发生异常回滚
            raise e                   # 重新抛出异常
        finally:
            await session.close()    # 最后关闭会话
```

**这是 FastAPI + SQLAlchemy 的标准依赖注入模式！**

**流程图：**
```
请求进入 → 创建session → yield给路由 → 路由执行
                ↓
        成功 → commit → close
        失败 → rollback → raise → close
```

---

**🔍 深入理解：依赖注入 vs 中间件**

> **用户提问：** 依赖注入是不是就是和中间件差不多，只是只在这个函数内部使用？

**✅ 理解对了一半！**

**依赖注入 = 为特定函数提供"局部服务"**
**中间件 = 为所有请求提供"全局服务"**

**核心区别：**

| 特性 | 中间件 (Middleware) | 依赖注入 (Depends) |
|------|-------------------|-------------------|
| 作用范围 | 全局（所有请求） | 局部（只在使用的函数） |
| 执行时机 | 每个请求都会执行 | 只有声明了才执行 |
| 使用场景 | 认证、日志、CORS | 数据库连接、权限检查、参数验证 |
| 代码位置 | `@app.middleware("http")` | 函数参数 `Depends()` |

**类比理解：**
```
🏪 中间件 = 商场保安
   → 所有进入商场的人都要检查
   → 全局生效

🔐 依赖注入 = 试衣间服务员
   → 只有需要试衣服的人才找她
   → 局部使用
```

**代码对比：**

```python
# 中间件：所有请求都执行
@app.middleware("http")
async def log_requests(request, call_next):
    print(f"请求开始: {request.url}")  # 每个请求都会打印
    response = await call_next(request)
    print(f"请求结束: {response.status_code}")
    return response

# 依赖注入：只有使用的函数才执行
async def get_db():
    async with AsyncSessionLocal() as session:
        yield session

@app.get("/books")
async def get_books(db: AsyncSession = Depends(get_db)):
    # 只有这个函数需要数据库
    return await db.execute(select(Book))

@app.get("/health")
async def health_check():
    # 这个函数不需要数据库，不会执行 get_db
    return {"status": "ok"}
```

**依赖注入的优势：**

| 优势 | 说明 |
|------|------|
| ✅ 按需使用 | 不需要数据库的路由不会创建连接 |
| ✅ 可复用 | 多个函数可以共用同一个依赖 |
| ✅ 易测试 | 可以轻松替换依赖进行测试 |
| ✅ 代码清晰 | 依赖关系一目了然 |

**实际场景：**

```
场景1：用户认证
├── 中间件：验证 token（所有接口都需要）
└── 依赖注入：获取当前用户信息（只有需要用户信息的接口）

场景2：数据库操作
├── 中间件：记录请求日志（所有接口都需要）
└── 依赖注入：创建数据库会话（只有操作数据库的接口）
```

**一句话总结：**
> 中间件是"全局过滤器"，依赖注入是"局部工具箱"。两者可以配合使用，各司其职！

---

#### 7. 路由中使用```python
@app.get('/books')
async def get_books(db: AsyncSession = Depends(get_dbbase)):
    res = await db.execute(select(Book))
    return res.scalars().all()
```

**执行流程：**
1. FastAPI 检测到 `Depends(get_dbbase)`
2. 调用 `get_dbbase()` 获取 session
3. 执行 `select(Book)` 查询所有书籍
4. `res.scalars().all()` 获取所有结果
5. 返回结果，自动提交/回滚/关闭

---

**🔍 深入理解：db 就是 session！**

> **用户提问：** 这里的 db 是不是返回的 session？
>
> **✅ 完全正确！** `db` 就是 `get_dbbase()` 返回的 `session` 对象！

**流程拆解：**

```python
# 第1步：定义依赖函数（生产session的工厂）
async def get_dbbase():
    async with AsyncSessionLocal() as session:  # 创建session
        yield session  # ← 返回session

# 第2步：路由使用依赖注入
@app.get('/books')
async def get_books(db: AsyncSession = Depends(get_dbbase)):
    #        ↑                ↑
    #        │                └── FastAPI自动调用get_dbbase()，拿到session
    #        └── 变量名（随便起，叫db、session、s都行）
    
    res = await db.execute(select(Book))  # db就是session，可以执行SQL
    return res.scalars().all()
```

**等价代码理解：**

```python
# 使用 Depends 的写法
@app.get('/books')
async def get_books(db: AsyncSession = Depends(get_dbbase)):
    return await db.execute(select(Book))

# 手动调用的等价写法（实际不用这么写）
@app.get('/books')
async def get_books():
    async for session in get_dbbase():  # 手动调用依赖函数
        return await session.execute(select(Book))
```

**命名说明：**

| 变量名       | 含义          | 建议        |
| --------- | ----------- | --------- |
| `db`      | 通用名，表示数据库连接 | ✅ 推荐，简洁   |
| `session` | 更明确，表示会话对象  | ✅ 推荐，语义清晰 |
| `s`       | 太简短，不推荐     | ❌ 不推荐     |
|           |             |           |

```python
# 这些写法都是对的
async def get_books(db = Depends(get_dbbase)):      # db
async def get_books(session = Depends(get_dbbase)):  # session
async def get_books(s = Depends(get_dbbase)):        # s（不推荐）
```

**一句话总结：** `db` 只是变量名，`Depends(get_dbbase)` 才是核心，它会调用 `get_dbbase()` 并把返回的 `session` 赋值给 `db`。

---

## 知识点总结

| 概念    | 作用         | 关键代码                    |
| ----- | ---------- | ----------------------- |
| 异步引擎  | 管理异步数据库连接池 | `create_async_engine()` |
| ORM模型 | 定义表结构      | `class Book(Base)`      |
| 会话工厂  | 创建数据库会话    | `async_sessionmaker()`  |
| 依赖注入  | 自动管理会话生命周期 | `Depends(get_dbbase)`   |
| 异步查询  | 非阻塞数据库操作   | `await db.execute()`    |

---

## 代码优化建议

### 1. 修复时间字段问题

**⚠️ 重要发现：`insert_default` 和 `default` 不能同时使用！**

```python
# ❌ 错误：同时使用 insert_default 和 default 会导致冲突
class Base(DeclarativeBase):
    create_time: Mapped[datetime] = mapped_column(
        DateTime,
        insert_default=datetime.now,  # 冲突！
        default=datetime.now,         # 冲突！
        comment='创建时间'
    )

# ✅ 正确方案1：只使用 default（Python端默认值）
class Base(DeclarativeBase):
    create_time: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.now,  # 只用这个
        comment='创建时间'
    )

# ✅ 正确方案2：只使用 server_default（数据库端默认值）
from sqlalchemy import func

class Base(DeclarativeBase):
    create_time: Mapped[datetime] = mapped_column(
        DateTime,
        server_default=func.now(),  # 使用数据库的 NOW()
        comment='创建时间'
    )
```

**最佳实践推荐：**

```python
from sqlalchemy import func

class Base(DeclarativeBase):
    create_time: Mapped[datetime] = mapped_column(
        DateTime,
        server_default=func.now(),      # 数据库端设置默认值
        comment='创建时间'
    )
    update_time: Mapped[datetime] = mapped_column(
        DateTime,
        server_default=func.now(),      # 数据库端设置默认值
        onupdate=func.now(),            # 更新时数据库自动设置
        comment='更新时间'
    )
```

**原因分析：**
- `default`：Python 端默认值，创建对象时设置
- `server_default`：数据库端默认值，INSERT 时数据库设置
- `insert_default`：已废弃，不要使用
- 同时使用会导致 SQLAlchemy 生成错误的 SQL 语句

### 2. User表添加密码哈希（安全考虑）```python
# 实际项目中不要存储明文密码
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

class User(Base):
    # ...其他字段
    password: Mapped[str] = mapped_column(String(255), comment='密码哈希')
```

### 3. 配置文件管理数据库URL```python
# settings.py
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str = 'mysql+aiomysql://root:123456@localhost:3306/fastapi_db'
    
settings = Settings()
```

---

## 今日收获

- ✅ 理解了 FastAPI 异步数据库配置流程
- ✅ 掌握了 SQLAlchemy ORM 模型定义
- ✅ 学会了依赖注入管理数据库会话的模式
- ✅ 发现了 `datetime.now()` 的常见坑

## 待深入学习

- [ ] 查询过滤条件（where子句）
- [ ] 关系映射（一对多、多对多）
- [ ] 数据库迁移（Alembic）
- [ ] 性能优化（查询优化、连接池调优）

---

**学习笔记创建时间：** 2026-06-27
**关联笔记：** SQLAlchemy ORM 完整教程 | python的FastApi
