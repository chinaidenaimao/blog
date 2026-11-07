---
title: "从零搭一个 FastAPI + LangChain 大模型接口"
date: 2026-06-27 21:30:00
cover: /img/covers/ai-neural.jpg
top_img: /img/covers/ai-neural.jpg
description: "本教程从零搭建生产可用级别的FastAPI项目，包含分层架构、异步数据库、全局异常处理、路由管理，并集成 LangChain 实现大模型问答接口（普通问答\\+流…"
categories:
  - 后端
tags:
  - FastAPI
  - LangChain
  - 实战
---

## 一、项目整体介绍

本教程从零搭建**生产可用级别的FastAPI项目**，包含分层架构、异步数据库、全局异常处理、路由管理，并集成 LangChain 实现大模型问答接口（普通问答\+流式打字机问答），全程模块化开发，无冗余代码，可直接用于二次开发。

**环境要求**：Python ≥ 3\.10（推荐3\.12）

**技术栈**：FastAPI \+ 异步SQLAlchemy \+ MySQL \+ Pydantic v2 \+ LangChain \+ SSE流式输出

## 二、项目目录结构```plain
fastapi-demo/
├── app/
│   ├── __init__.py
│   ├── main.py                # 项目入口
│   ├── core/                  # 核心配置
│   │   ├── __init__.py
│   │   ├── config.py          # 环境变量配置
│   │   └── exceptions.py      # 全局异常捕获
│   ├── api/                   # 接口路由
│   │   ├── __init__.py
│   │   ├── deps.py            # 通用依赖项
│   │   └── v1/                # v1版本接口
│   │       ├── __init__.py
│   │       ├── user.py        # 用户业务接口
│   │       ├── ai.py          # LangChain大模型接口
│   │       └── router.py      # 路由汇总
│   ├── models/                # 数据库ORM模型
│   │   ├── __init__.py
│   │   └── user.py
│   ├── schemas/               # Pydantic校验/序列化模型
│   │   ├── __init__.py
│   │   └── user.py
│   ├── crud/                  # 数据库CRUD业务逻辑
│   │   ├── __init__.py
│   │   └── user.py
│   ├── db/                    # 数据库连接配置
│   │   ├── __init__.py
│   │   └── session.py
│   └── services/              # 业务服务层
│       ├── __init__.py
│       └── langchain_service.py # LangChain核心逻辑
├── .env                       # 环境变量配置文件
├── .gitignore                 # Git忽略文件
├── requirements.txt           # 项目依赖清单
└── run.py                     # 项目启动脚本
```

## 三、安装项目依赖

### 3\.1 编写 requirements\.txt```txt
fastapi>=0.112.0
uvicorn[standard]>=0.30.0
pydantic-settings>=2.5.2
sqlalchemy>=2.0
aiomysql>=0.2.0
python-dotenv>=1.0.0
langchain>=0.3.0
langchain-openai>=0.2.0
```

### 3\.2 安装依赖```bash
pip install -r requirements.txt
```

### 3\.3 导出/更新项目依赖（必备）

使用 `pipreqs` 智能导出项目实际用到的依赖（避免冗余包）

```bash
# 安装工具
pip install pipreqs
# 扫描项目生成依赖文件
pipreqs ./ --encoding=utf-8 --force
```

## 四、环境变量配置（\.env）

项目根目录新建 `.env` 文件，配置数据库和大模型参数

```env
# 项目配置ENV=dev
API_PREFIX=/api/v1

# MySQL数据库配置
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=123456
DB_NAME=fastapi_demo

# LLM大模型配置（兼容OpenAI、DeepSeek、通义千问等OpenAI格式接口）
LLM_BASE_URL=https://api.openai.com/v1
LLM_API_KEY=sk-xxxx你的密钥
LLM_MODEL=gpt-4o-mini
```

## 五、核心配置文件编写

### 5\.1 全局配置（app/core/config\.py）```python
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    # 项目基础配置
    ENV: str = "dev"
    API_PREFIX: str = "/api/v1"

    # 数据库配置DB_HOST: strDB_PORT: intDB_USER: str
    DB_PASSWORD: str
    DB_NAME: str

    # 大模型配置
    LLM_BASE_URL: str
    LLM_API_KEY: str
    LLM_MODEL: str

    @property
    def DATABASE_URL(self) -> str:
        # 异步MySQL连接字符串
        return f"mysql+aiomysql://{self.DB_USER}:{self.DB_PASSWORD}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"

# 全局单例配置实例
settings = Settings()
```

### 5\.2 全局异常处理（app/core/exceptions\.py）```python
from fastapi import Request, FastAPI
from fastapi.responses import JSONResponse

def register_exception_handler(app: FastAPI):
    # 全局统一异常捕获
    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception):
        return JSONResponse(
            status_code=500,
            content={"code": 500, "msg": f"服务器异常:{str(exc)}", "data": None}
        )
```

## 六、数据库异步配置

### 6\.1 数据库会话（app/db/session\.py）```python
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base
from app.core.config import settings

# 创建异步数据库引擎
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=True,  # 开发环境打印SQL日志，生产环境关闭
    pool_pre_ping=True
)

# 创建异步会话工厂
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False
)

# 数据库模型基类
Base = declarative_base()

# 数据库依赖注入
async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        yield session
```

### 6\.2 数据库模型（app/models/user\.py）```python
from sqlalchemy import Column, Integer, String, DateTime, func
from app.db.session import Base

class User(Base):
    __tablename__ = "user"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=False, comment="用户名")
    email = Column(String(100), unique=True, nullable=True, comment="邮箱")
    create_time = Column(DateTime, default=func.now(), comment="创建时间")
```

## 七、数据校验模型（Schemas）

app/schemas/user\.py

```python
from pydantic import BaseModel, ConfigDict
from datetime import datetime

# 创建用户请求模型
class UserCreate(BaseModel):
    username: str
    email: str | None = None

# 用户信息返回模型
class UserResp(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    email: str | None
    create_time: datetime
```

## 八、数据库CRUD逻辑

app/crud/user\.py

```python
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.user import User
from app.schemas.user import UserCreate

# 创建用户
async def create_user(db: AsyncSession, obj_in: UserCreate) -> User:
    db_obj = User(username=obj_in.username, email=obj_in.email)
    db.add(db_obj)
    await db.commit()
    await db.refresh(db_obj)
    return db_obj

# 根据ID查询用户
async def get_user_by_id(db: AsyncSession, user_id: int) -> User | None:
    res = await db.execute(select(User).where(User.id == user_id))
    return res.scalar_one_or_none()
```

## 九、LangChain大模型服务层

app/services/langchain\_service\.py，实现普通问答\+流式问答

```python
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage
from app.core.config import settings

# 全局初始化大模型实例
llm = ChatOpenAI(
    base_url=settings.LLM_BASE_URL,
    api_key=settings.LLM_API_KEY,
    model=settings.LLM_MODEL,
    temperature=0.7,
    timeout=30
)

# 普通问答（一次性返回结果）
async def chat_normal(question: str, system_prompt: str = "你是一个乐于助人的助手") -> str:
    messages = [
        SystemMessage(content=system_prompt),
        HumanMessage(content=question)
    ]
    resp = await llm.ainvoke(messages)
    return resp.content

# 流式问答（SSE逐字输出）
async def chat_stream_generator(question: str, system_prompt: str = "你是一个乐于助人的助手"):
    messages = [
        SystemMessage(content=system_prompt),
        HumanMessage(content=question)
    ]
    async for chunk in llm.astream(messages):
        if chunk.content:
            yield chunk.content
```

## 十、接口路由编写

### 10\.1 用户接口（app/api/v1/user\.py）```python
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.schemas.user import UserCreate, UserResp
from app.crud.user import create_user, get_user_by_id

router = APIRouter(prefix="/user", tags=["用户管理"])

# 创建用户
@router.post("/", response_model=UserResp)
async def add_user(user_in: UserCreate, db: AsyncSession = Depends(get_db)):
    return await create_user(db, user_in)

# 根据ID查询用户
@router.get("/{user_id}", response_model=UserResp)
async def query_user(user_id: int, db: AsyncSession = Depends(get_db)):
    return await get_user_by_id(db, user_id)
```

### 10\.2 大模型AI接口（app/api/v1/ai\.py）```python
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.services.langchain_service import chat_normal, chat_stream_generator

router = APIRouter(prefix="/ai", tags=["AI大模型"])

# 对话请求参数模型
class ChatRequest(BaseModel):
    question: str
    system_prompt: str = "你是乐于助人的智能助手"

# 普通问答接口
@router.post("/chat")
async def chat(req: ChatRequest):
    answer = await chat_normal(req.question, req.system_prompt)
    return {"code": 200, "msg": "请求成功", "data": {"answer": answer}}

# 流式问答接口（前端打字机效果）
@router.post("/chat/stream")
async def chat_stream(req: ChatRequest):
    generator = chat_stream_generator(req.question, req.system_prompt)
    return StreamingResponse(
        generator,
        media_type="text/event-stream"
    )
```

### 10\.3 路由汇总（app/api/v1/router\.py）```python
from fastapi import APIRouter
from app.api.v1 import user, ai

api_router = APIRouter()
# 注册所有业务路由
api_router.include_router(user.router)
api_router.include_router(ai.router)
```

## 十一、项目主入口（app/main\.py）```python
from fastapi import FastAPI
from app.core.config import settings
from app.api.v1.router import api_router
from app.core.exceptions import register_exception_handler

# 初始化FastAPI实例
app = FastAPI(
    title="FastAPI+LangChain项目",
    version="1.0.0",
    description="集成数据库与大模型能力的后端服务"
)

# 注册全局异常处理
register_exception_handler(app)

# 注册业务路由
app.include_router(api_router, prefix=settings.API_PREFIX)

# 根路径测试
@app.get("/")
async def root():
    return {"msg": "项目启动成功！"}
```

## 十二、项目启动脚本（run\.py）```python
import uvicorn

if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True  # 开发环境热更新，生产环境关闭
    )
```

## 十三、项目启动与测试

### 13\.1 初始化数据库

手动打开MySQL，创建项目数据库：

```sql
CREATE DATABASE fastapi_demo DEFAULT CHARACTER SET utf8mb4;
```

### 13\.2 启动项目```bash
python run.py
```

### 13\.3 访问文档地址

- 交互式调试文档（Swagger）：`http://127.0.0.1:8000/docs`

- 静态正式文档（Redoc）：`http://127.0.0.1:8000/redoc`

### 13\.4 核心接口

- 用户创建：`POST /api/v1/user/`

- 用户查询：`GET /api/v1/user/{user_id}`

- AI普通问答：`POST /api/v1/ai/chat`

- AI流式问答：`POST /api/v1/ai/chat/stream`

## 十四、Redoc文档说明

Redoc 是 FastAPI 自带的**只读式API文档**，区别于可调试的 /docs：

- 特点：排版整洁、结构清晰、无调试按钮，适合对外交付给前端/对接方

- 缺陷：不支持在线接口调试，仅用于查阅文档

- 生产关闭方式：FastAPI初始化添加`redoc_url=None`

## 十五、常见扩展方向

1. 增加 Alembic 数据库迁移工具，自动管理数据表结构

2. 接入JWT登录鉴权，保护AI接口不被恶意调用

3. 新增LangChain对话记忆，实现多轮上下文对话

4. 集成RAG知识库，实现私有文档问答

5. 添加接口限流、日志记录、CORS跨域配置

## 十六、核心注意事项

- 大模型调用必须使用`ainvoke/astream` 异步方法，避免阻塞FastAPI事件循环

- 所有密钥、配置均存放于\.env文件，禁止硬编码到代码

- 开发环境开启reload、SQL日志，生产环境务必关闭

- 流式接口必须返回 StreamingResponse，不可包装JSON格式

> （注：部分内容可能由 AI 生成）
