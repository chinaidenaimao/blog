---
title: "FastAPI 模块化路由入门"
date: 2026-04-21 20:20:00
cover: /img/covers/dev-desk.jpg
top_img: /img/covers/dev-desk.jpg
description: "学习时间：2026-07-02 学习进度：刚开始"
categories:
  - 后端
tags:
  - FastAPI
  - 工程化
  - Python
---

> 学习时间：2026-07-02
> 学习进度：刚开始

## 📌 什么是模块化路由？

把不同功能的路由拆分到不同文件中，让代码更清晰、更好维护。

---

## 1. 基础：APIRouter 的创建```python
from fastapi import APIRouter

# 创建一个路由器
router = APIRouter()
```

**就像创建了一个"路由容器"，可以在里面添加多个路由。**

---

## 2. 在路由器上定义路由```python
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

---

## 3. 在主应用中注册路由器```python
from fastapi import FastAPI
from routers import users  # 导入路由文件

app = FastAPI()

# 把路由器"挂载"到主应用上
app.include_router(users.router)
```

---

## 4. 目录结构示例```项目目录/
├── main.py              # 主应用入口
├── routers/             # 路由文件夹
│   ├── __init__.py      # 空文件，让 Python 认识这个文件夹
│   ├── users.py         # 用户相关路由
│   └── items.py         # 商品相关路由
```

---

## 5. 添加前缀（prefix）```python
# 给这个路由器的所有路由添加统一前缀
app.include_router(
    users.router,
    prefix="/api"      # 所有路由都会变成 /api/xxx
)
```

效果：
- `/users` → `/api/users`
- `/users/1` → `/api/users/1`

---

## 6. 添加标签（tags）```python
# tags 用于 API 文档中的分组
app.include_router(
    users.router,
    tags=["用户模块"]
)
```

---

## 7. 导入的写法

### 文件：`main.py````python
from fastapi import FastAPI

# 方式1：直接导入模块
from routers import users
from routers import items

app = FastAPI()
app.include_router(users.router)
app.include_router(items.router)
```

### 文件：`routers/users.py````python
from fastapi import APIRouter

router = APIRouter()

@router.get("/users")
async def get_users():
    return []
```

### 文件：`routers/__init__.py````python
# 这个文件可以是空的，但必须存在
# 它的作用是让 Python 把 routers 文件夹识别为"包"```

---

## 📝 今日学习小结

- [ ] 知道了 APIRouter 是什么
- [ ] 知道了怎么在路由器上定义路由
- [ ] 知道了怎么在主应用中注册路由器
- [ ] 了解了目录结构的基本组织方式
- [ ] 了解了 prefix 和 tags 的作用
- [ ] 了解了导入的写法

---

## ❓ 遇到的问题

> 等待学习中补充

---

## 🔗 相关笔记

- FastAPI 快速参考
- Python FastAPI 完整教程

---

#FastAPI #学习笔记 #模块化路由
