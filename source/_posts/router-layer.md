---
title: "路由层实现：把接口按模块拆开"
date: 2026-03-04 22:00:00
cover: /img/covers/dev-night.jpg
top_img: /img/covers/dev-night.jpg
description: "路由层（Router）负责定义 API 接口，处理 HTTP 请求和响应。"
categories:
  - 后端
tags:
  - FastAPI
  - 路由
  - 分层
---

## 📋 概述

路由层（Router）负责定义 API 接口，处理 HTTP 请求和响应。

## 📁 文件结构
```
├── news.py         # 新闻接口
├── user.py         # 用户接口
├── favorite.py     # 收藏接口
└── history.py      # 历史记录接口
```

## 📰 第一步：实现新闻路由

### router/news.py
```
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from crud.news import (
    get_categories,
    get_news,
    get_news_count,
    get_news_detail,
    update_news_view,
    get_related_news
)
from config.db_config import get_db

# 创建路由器
router = APIRouter(prefix="/api/news", tags=["news"])

# 获取新闻分类
@router.get("/categories")
async def categories(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db)
):
    """获取所有新闻分类"""
    categories = await get_categories(db, skip=skip, limit=limit)
    return {
        'code': 200,
        'message': 'success',
        'data': categories
    }

# 获取新闻列表
@router.get("/list")
async def get_news_list(
    category_id: int = Query(..., alias="categoryId"),
    page: int = 1,
    page_size: int = Query(10, alias="pageSize", le=100),
    db: AsyncSession = Depends(get_db)
):
    """获取新闻列表（分页）"""
    news_list = await get_news(
        db,
        category_id,
        skip=(page - 1) * page_size,
        limit=page_size
    )
    total = await get_news_count(db, category_id)
    has_more = total > page * page_size

    return {
        'code': 200,
        'message': 'success',
        'data': {
            'list': news_list,
            'total': total,
            'hasMore': has_more,
        }
    }

# 获取新闻详情
@router.get("/detail")
async def get_news_detail(
    news_id: int = Query(..., alias="id"),
    db: AsyncSession = Depends(get_db)
):
    """获取新闻详情"""
    news = await get_news_detail(db, news_id)
    if not news:
        raise HTTPException(status_code=404, detail="news not found")

    # 更新访问量
    update_view = await update_news_view(db, news_id)
    if not update_view:
        raise HTTPException(status_code=404, detail="update news view failed")

    # 获取相关新闻
    related_news = await get_related_news(db, news_id, news.category_id)

    return {
        'code': 200,
        'message': 'success',
        'data': {
            "id": news.id,
            "title": news.title,
            "description": news.description,
            "content": news.content,
            "image": news.image,
            "author": news.author,
            "publishTime": news.publish_time,
            "categoryId": news.category_id,
            "views": news.views,
            "relatedNews": related_news
        }
    }
```

## 👤 第二步：实现用户路由

### router/user.py
```
from fastapi import HTTPException, APIRouter, Depends, status
from schemas.users import (
    UserRequest,
    UserInfoResponse,
    UserAuthResponse,
    UpdateUserInfoRequest,
    UpdatePasswordRequest
)
from utils.response import success_response
from config.db_config import get_db
from sqlalchemy.ext.asyncio import AsyncSession
from crud.users import (
    create_user,
    get_user_by_username,
    create_token,
    authenticate_user,
    update_user_info,
    update_user_password
)
from utils.auth import get_current_user

# 创建路由器
router = APIRouter(prefix="/api/user", tags=["user"])

# 用户注册
@router.post("/register")
async def register(
    user_data: UserRequest,
    db: AsyncSession = Depends(get_db)
):
    """用户注册"""
    # 检查用户名是否存在
    existing_user = await get_user_by_username(db, user_data.username)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="用户名已存在"
        )

    # 创建用户
    user_data_obj = await create_user(db, user_data)
    token = await create_token(db, user_data_obj.id)

    # 返回响应
    res_data = UserAuthResponse(
        token=token,
        user_info=UserInfoResponse.model_validate(user_data_obj)
    )
    return success_response(message='注册成功', data=res_data)

# 用户登录
@router.post("/login")
async def login(
    user_data: UserRequest,
    db: AsyncSession = Depends(get_db)
):
    """用户登录"""
    user = await authenticate_user(db, user_data.username, user_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户名或密码错误"
        )

    token = await create_token(db, user.id)
    res_data = UserAuthResponse(
        token=token,
        user_info=UserInfoResponse.model_validate(user)
    )
    return success_response(message='登录成功', data=res_data)

# 获取用户信息
@router.get("/info")
async def get_info(user=Depends(get_current_user)):
    """获取当前用户信息"""
    res_data = UserInfoResponse.model_validate(user)
    return success_response(message='获取用户信息成功', data=res_data)

# 更新用户信息
@router.put("/update")
async def put_update(
    user_update: UpdateUserInfoRequest,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """更新用户信息"""
    user_data = await update_user_info(db, user, user_update)
    return success_response(
        message='更新用户信息成功',
        data=UserInfoResponse.model_validate(user_data)
    )

# 修改密码
@router.put("/password")
async def update_password(
    password: UpdatePasswordRequest,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """修改用户密码"""
    await update_user_password(db, user, password)
    return success_response(message='更新用户密码成功')
```

## ⭐ 第三步：实现收藏路由

### router/favorite.py
```
from fastapi import APIRouter, Depends, Query, HTTPException, Body
from sqlalchemy.ext.asyncio import AsyncSession
from crud.favorite import (
    check_favorite_news,
    add_favorite_news,
    delete_favorite_news,
    get_favorite_news_count,
    get_favorite_news_list,
    delete_favorite_news_all
)
from config.db_config import get_db
from utils.auth import get_current_user
from schemas.favorite import Favorite, FavoritesResponse
from utils.response import success_response
from schemas.news import News_data

# 创建路由器
router = APIRouter(prefix="/api/favorite", tags=["favorite"])

# 检查是否收藏
@router.get("/check")
async def get_favorite_check_news(
    new_id: int = Query(..., alias='newsId', description='新闻id'),
    db: AsyncSession = Depends(get_db),
    user_data=Depends(get_current_user)
):
    """检查用户是否收藏了该新闻"""
    is_active = await check_favorite_news(db, new_id, user_data.id)
    return success_response(message='success', data={'isFavorite': is_active})

# 添加收藏
@router.post("/add")
async def add_favorite(
    news_id: int = Body(..., embed=True, description='新闻id', alias='newsId'),
    db: AsyncSession = Depends(get_db),
    user_data=Depends(get_current_user)
):
    """添加收藏"""
    favorite = await add_favorite_news(db, user_data.id, news_id)
    return success_response(
        message='success',
        data=Favorite.model_validate(favorite)
    )

# 取消收藏
@router.delete("/remove")
async def remove_favorite(
    news_id: int = Query(..., alias='newsId', description='新闻id'),
    db: AsyncSession = Depends(get_db),
    user_data=Depends(get_current_user)
):
    """取消收藏"""
    res = await delete_favorite_news(db, news_id, user_data.id)
    if not res:
        raise HTTPException(status_code=400, detail='删除收藏失败')
    return success_response(message='success')

# 获取收藏列表
@router.get("/list")
async def get_favorite_news_list_func(
    page: int = Query(..., alias='page', description='页码'),
    page_size: int = Query(..., alias='pageSize', description='每页数量'),
    db: AsyncSession = Depends(get_db),
    user_data=Depends(get_current_user)
):
    """获取收藏列表"""
    total = await get_favorite_news_count(db, user_data.id)
    has_more = total > page * page_size
    favorite_news = await get_favorite_news_list(
        db, user_data.id, page=page, page_size=page_size
    )

    # 转换为News_data模型，同时填充收藏时间
    news_list = []
    for news, favorite_time in favorite_news:
        news_data = News_data.model_validate(news)
        news_data.favoriteTime = favorite_time
        news_list.append(news_data)

    return success_response(
        message='success',
        data=FavoritesResponse.model_validate({
            'list': news_list,
            'total': total,
            'hasMore': has_more
        })
    )

# 一键清空收藏
@router.delete("/clear")
async def clear_favorite(
    db: AsyncSession = Depends(get_db),
    user_data=Depends(get_current_user)
):
    """清空所有收藏"""
    res = await delete_favorite_news_all(db, user_data.id)
    return success_response(message=f'成功删除收藏{res}条')
```

## 📜 第四步：实现历史记录路由

### router/history.py
```
from fastapi import APIRouter, Depends, Query, HTTPException, Body
from sqlalchemy.ext.asyncio import AsyncSession
from config.db_config import get_db
from utils.auth import get_current_user
from crud.history import (
    add_history,
    list_history,
    get_history_count,
    delete_history,
    clear_history
)
from utils.response import success_response
from schemas.history import History, HistoryResponse
from schemas.news import News_data

# 创建路由器
router = APIRouter(prefix='/api/history')

# 添加历史记录
@router.post('/add')
async def add_history_func(
    news_id: int = Body(..., embed=True, description='新闻ID', alias='newsId'),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """添加浏览历史"""
    res = await add_history(db, news_id, current_user.id)
    return success_response(
        message='添加成功',
        data=History.model_validate(res)
    )

# 获取历史列表
@router.get('/list')
async def list_history_func(
    page: int = Query(1, description='页码'),
    page_size: int = Query(10, description='每页数量', alias='pageSize'),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """获取历史记录列表"""
    res = await list_history(db, current_user.id, page, page_size)
    if not res:
        raise HTTPException(status_code=404, detail='没有历史记录')

    total = await get_history_count(db, current_user.id)
    has_more = total > page * page_size

    history_list = []
    for item, view_time in res:
        history_data = News_data.model_validate(item)
        history_data.viewTime = view_time
        history_list.append(history_data)

    return success_response(
        message='获取成功',
        data=HistoryResponse.model_validate({
            'list': history_list,
            'hasMore': has_more,
            'total': total
        })
    )

# 删除单条历史
@router.delete('/delete/{history_id}')
async def delete_history_func(
    history_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """删除单条历史记录"""
    success = await delete_history(db, history_id, current_user.id)
    if not success:
        raise HTTPException(status_code=404, detail='历史记录不存在')
    return success_response(message='删除成功')

# 清空历史
@router.delete('/clear')
async def clear_history_func(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """清空所有历史记录"""
    count = await clear_history(db, current_user.id)
    return success_response(message='清空成功', data={'deleted': count})
```

## 🔗 第五步：注册路由到 main.py
```
from fastapi import FastAPI
import models
from router import news, user, favorite, history
from utils.exceeption_handlers import register_exception_handlers

app = FastAPI()

# 注册异常处理
register_exception_handlers(app)

# 注册路由
app.include_router(news.router)
app.include_router(user.router)
app.include_router(favorite.router)
app.include_router(history.router)
```

## 📊 API 接口汇总

### 用户模块

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| POST | `/api/user/register` | 用户注册 | ❌ |
| POST | `/api/user/login` | 用户登录 | ❌ |
| GET | `/api/user/info` | 获取用户信息 | ✅ |
| PUT | `/api/user/update` | 更新用户信息 | ✅ |
| PUT | `/api/user/password` | 修改密码 | ✅ |

### 新闻模块

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | `/api/news/categories` | 获取分类 | ❌ |
| GET | `/api/news/list` | 获取新闻列表 | ❌ |
| GET | `/api/news/detail` | 获取新闻详情 | ❌ |

### 收藏模块

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | `/api/favorite/check` | 检查是否收藏 | ✅ |
| POST | `/api/favorite/add` | 添加收藏 | ✅ |
| DELETE | `/api/favorite/remove` | 取消收藏 | ✅ |
| GET | `/api/favorite/list` | 获取收藏列表 | ✅ |
| DELETE | `/api/favorite/clear` | 清空收藏 | ✅ |

### 历史记录模块

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| POST | `/api/history/add` | 添加历史记录 | ✅ |
| GET | `/api/history/list` | 获取历史列表 | ✅ |
| DELETE | `/api/history/delete/{id}` | 删除单条历史 | ✅ |
| DELETE | `/api/history/clear` | 清空历史 | ✅ |

## 🎯 最佳实践

1. **使用 APIRouter**：模块化路由
2. **添加标签**：`tags=["module"]` 方便分组
3. **使用依赖注入**：`Depends(get_db)` 注入数据库
4. **使用 Query/Body**：定义请求参数
5. **统一响应格式**：使用 `success_response()`

## 📝 下一步

路由层完成后，查看 [08-认证机制详解.md](./08-认证机制详解.md) 了解认证机制的详细实现。
