---
title: "CRUD 层实现：把数据库操作收口"
date: 2026-03-18 21:40:00
cover: /img/covers/crud-layer.svg
top_img: /img/covers/crud-layer.svg
description: "CRUD 层负责数据库的增删改查操作，是连接路由层和模型层的桥梁。"
categories:
  - 后端
tags:
  - CRUD
  - ORM
  - 分层
---

## 📋 概述

CRUD 层负责数据库的增删改查操作，是连接路由层和模型层的桥梁。

## 📁 文件结构```crud/
├── users.py        # 用户 CRUD
├── news.py         # 新闻 CRUD
├── favorite.py     # 收藏 CRUD
└── history.py      # 历史记录 CRUD
```

## 👤 第一步：实现用户 CRUD

### crud/users.py```pythonimport uuid
from datetime import timedelta, datetime

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from models.users import User, UserToken
from sqlalchemy import select, func, update
from schemas.users import UserRequest, UpdateUserInfoRequest, UpdatePasswordRequest
from utils.security import get_hashed_password, verify_password

# 根据用户名获取用户
async def get_user_by_username(db: AsyncSession, username: str):
    """根据用户名查询用户"""
    res = await db.execute(select(User).where(User.username == username))
    return res.scalar_one_or_none()

# 创建用户
async def create_user(db: AsyncSession, user_data: UserRequest):
    """创建新用户"""
    hashed_password = get_hashed_password(user_data.password)
    user = User(username=user_data.username, password=hashed_password)
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user

# 创建用户访问令牌
async def create_token(db: AsyncSession, user_id: int):
    """创建或更新用户 Token"""
    token = str(uuid.uuid4())
    expires_at = datetime.now() + timedelta(days=7)

    res = await db.execute(select(UserToken).where(UserToken.user_id == user_id))
    user_token = res.scalar_one_or_none()

    if user_token:
        user_token.token = token
        user_token.expires_at = expires_at
    else:
        user_token = UserToken(user_id=user_id, token=token, expires_at=expires_at)
        db.add(user_token)

    await db.commit()
    return token

# 用户认证
async def authenticate_user(db: AsyncSession, username: str, password: str):
    """验证用户登录"""
    user = await db.execute(select(User).where(User.username == username))
    user = user.scalar_one_or_none()
    if not user:
        return None
    if not verify_password(password, user.password):
        return None
    return user

# 获取用户信息
async def get_user_info(db: AsyncSession, token: str):
    """根据 Token 获取用户信息"""
    res = await db.execute(select(UserToken).where(UserToken.token == token))
    user_token = res.scalar_one_or_none()
    if not user_token or user_token.expires_at < datetime.now():
        return None

    user = await db.execute(select(User).where(User.id == user_token.user_id))
    user_data = user.scalar_one_or_none()
    return user_data

# 更新用户信息
async def update_user_info(db: AsyncSession, user: User, user_update: UpdateUserInfoRequest):
    """更新用户信息"""
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="用户不存在")

    query = update(User).where(User.username == user.username).values(
        **user_update.model_dump(exclude_unset=True, exclude_none=True)
    )
    res = await db.execute(query)
    await db.commit()

    if res.rowcount == 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="用户不存在")

    await db.refresh(user)
    return user

# 修改密码
async def update_user_password(db: AsyncSession, user: User, password: UpdatePasswordRequest):
    """修改用户密码"""
    if not verify_password(password.old_password, user.password):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="密码错误")

    new_password = get_hashed_password(password.new_password)
    res = await db.execute(
        update(User).where(User.username == user.username).values(password=new_password)
    )
    await db.commit()

    if res.rowcount == 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="用户不存在")

    return None
```

**关键点：**
- `select()`：查询数据
- `db.add()`：添加数据
- `db.commit()`：提交事务
- `db.refresh()`：刷新对象
- `update()`：更新数据
- `func.count()`：聚合函数

## 📰 第二步：实现新闻 CRUD

### crud/news.py```python
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, update
from models.news import Categories, News

async def get_categories(db: AsyncSession, skip: int = 0, limit: int = 100):
    """获取所有分类"""
    res = await db.execute(select(Categories).offset(skip).limit(limit))
    return res.scalars().all()

async def get_news(db: AsyncSession, category_id: int, skip: int = 0, limit: int = 100):
    """获取指定分类的新闻"""
    res = await db.execute(
        select(News)
        .where(News.category_id == category_id)
        .offset(skip)
        .limit(limit)
    )
    return res.scalars().all()

async def get_news_count(db: AsyncSession, category_id: int):
    """获取指定分类的新闻数量"""
    res = await db.execute(
        select(func.count(News.id))
        .where(News.category_id == category_id)
    )
    return res.scalar_one()

async def get_news_detail(db: AsyncSession, news_id: int):
    """获取新闻详情"""
    res = await db.execute(select(News).where(News.id == news_id))
    return res.scalar_one_or_none()

async def update_news_view(db: AsyncSession, news_id: int):
    """更新新闻访问量"""
    stmt = update(News).where(News.id == news_id).values(views=News.views + 1)
    res = await db.execute(stmt)
    return res.rowcount > 0

async def get_related_news(db: AsyncSession, news_id: int, category_id: int):
    """获取相关新闻"""
    res = await db.execute(
        select(News)
        .where(News.category_id == category_id)
        .where(News.id != news_id)
        .order_by(News.views.desc(), News.publish_time.desc())
        .offset(0)
        .limit(5)
    )
    return res.scalars().all()
```

## ⭐ 第三步：实现收藏 CRUD

### crud/favorite.py```python
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, update, delete
from fastapi import HTTPException
from models.favorite import Favorite
from models.news import News

# 检查用户是否收藏了该新闻
async def check_favorite_news(db: AsyncSession, news_id: int, user_id: int):
    """检查是否已收藏"""
    isactive = await db.execute(
        select(Favorite).where(Favorite.user_id == user_id, Favorite.news_id == news_id)
    )
    return isactive.scalar_one_or_none() is not None

# 添加收藏
async def add_favorite_news(db: AsyncSession, user_id: int, news_id: int):
    """添加收藏"""
    if await check_favorite_news(db, news_id, user_id):
        raise HTTPException(status_code=400, detail='用户已收藏该新闻')

    favorite = Favorite(user_id=user_id, news_id=news_id)
    db.add(favorite)
    await db.commit()
    await db.refresh(favorite)
    return favorite

# 删除收藏
async def delete_favorite_news(db: AsyncSession, news_id: int, user_id: int):
    """删除收藏"""
    res = await db.execute(
        select(Favorite).where(Favorite.news_id == news_id, Favorite.user_id == user_id)
    )
    favorite = res.scalar_one_or_none()

    if favorite is None:
        return False

    await db.delete(favorite)
    await db.commit()
    return True

# 获取收藏数量
async def get_favorite_news_count(db: AsyncSession, user_id: int):
    """获取收藏总数"""
    res = await db.execute(
        select(func.count(Favorite.id))
        .where(Favorite.user_id == user_id)
    )
    return res.scalar_one_or_none()

# 获取收藏列表
async def get_favorite_news_list(db: AsyncSession, user_id: int, page: int = 1, page_size: int = 10):
    """获取收藏的新闻列表"""
    res = await db.execute(
        select(News, Favorite.created_at)
        .join(Favorite, News.id == Favorite.news_id)
        .where(Favorite.user_id == user_id)
        .order_by(Favorite.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    return res.all()  # 返回 [(News, created_at), ...]

# 清空收藏
async def delete_favorite_news_all(db: AsyncSession, user_id: int):
    """清空所有收藏"""
    res = await db.execute(delete(Favorite).where(Favorite.user_id == user_id))
    await db.commit()
    return res.rowcount
```

**关键点：**
- `join()`：连接查询
- `delete()`：删除数据
- `offset()` 和 `limit()`：分页查询
- `order_by()`：排序

## 📜 第四步：实现历史记录 CRUD

### crud/history.py```python
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, update, delete
from fastapi import HTTPException
from models.news import News
from models.history import History

# 检查是否浏览过
async def check_history(db: AsyncSession, news_id: int, user_id: int):
    """检查是否已浏览过"""
    isactive = await db.execute(
        select(History).where(History.user_id == user_id, History.news_id == news_id)
    )
    return isactive.scalars().one_or_none()

# 添加历史记录
async def add_history(db: AsyncSession, news_id: int, user_id: int):
    """添加或更新历史记录"""
    res = await check_history(db, news_id, user_id)
    if res:
        # 更新浏览时间
        await db.execute(
            update(History).where(History.id == res.id).values(view_time=func.now())
        )
        await db.commit()
        return await check_history(db, news_id, user_id)

    # 创建新记录
    history = History(user_id=user_id, news_id=news_id)
    db.add(history)
    await db.commit()
    await db.refresh(history)
    return history

# 获取历史记录
async def list_history(db: AsyncSession, user_id: int, page: int, page_size: int):
    """获取历史记录列表"""
    res = await db.execute(
        select(News, History.view_time)
        .join(News, History.news_id == News.id)
        .where(History.user_id == user_id)
        .order_by(History.view_time.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    return res.all()

# 获取历史记录总数
async def get_history_count(db: AsyncSession, user_id: int):
    """获取历史记录总数"""
    res = await db.execute(
        select(func.count(History.id))
        .where(History.user_id == user_id)
    )
    return res.scalar_one()

# 删除单条历史记录
async def delete_history(db: AsyncSession, history_id: int, user_id: int):
    """删除单条历史记录"""
    result = await db.execute(
        delete(History).where(History.id == history_id, History.user_id == user_id)
    )
    await db.commit()
    return result.rowcount > 0

# 清空历史记录
async def clear_history(db: AsyncSession, user_id: int):
    """清空所有历史记录"""
    result = await db.execute(delete(History).where(History.user_id == user_id))
    await db.commit()
    return result.rowcount
```

## 📊 CRUD 操作总结

| 操作 | 方法 | 说明 |
|------|------|------|
| 查询单个 | `select().where().scalar_one_or_none()` | 查询一条记录 |
| 查询多个 | `select().where().scalars().all()` | 查询多条记录 |
| 分页查询 | `select().offset().limit()` | 分页查询 |
| 聚合查询 | `select(func.count())` | 统计数量 |
| 插入数据 | `db.add()` + `db.commit()` | 插入一条记录 |
| 更新数据 | `update().where().values()` + `db.commit()` | 更新记录 |
| 删除数据 | `delete().where()` + `db.commit()` | 删除记录 |
| 连接查询 | `select().join()` | 多表连接查询 |

## 🎯 最佳实践

1. **使用异步操作**：所有数据库操作都是异步的
2. **提交事务**：操作后调用 `db.commit()`
3. **刷新对象**：插入/更新后调用 `db.refresh()`
4. **错误处理**：在 CRUD 层抛出 HTTPException
5. **分页查询**：使用 `offset()` 和 `limit()`

## 📝 下一步

CRUD 层完成后，查看 [07-路由层实现.md](./07-路由层实现.md) 了解如何实现 API 接口。
