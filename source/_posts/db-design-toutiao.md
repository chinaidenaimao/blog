---
title: "一个内容后台的数据库设计"
date: 2026-02-22 21:20:00
cover: /img/covers/db-design-toutiao.svg
top_img: /img/covers/db-design-toutiao.svg
description: "id int NOT NULL AUTOINCREMENT COMMENT '用户ID',"
categories:
  - 后端
tags:
  - 数据库
  - 设计
  - 实战
---

## 📊 数据库表结构

### 1. 用户表（user）存储用户基本信息。```sql
CREATE TABLE `user` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '用户ID',
  `username` varchar(50) NOT NULL COMMENT '用户名',
  `password` varchar(255) NOT NULL COMMENT '密码（加密存储）',
  `nickname` varchar(50) DEFAULT NULL COMMENT '昵称',
  `avatar` varchar(255) DEFAULT NULL COMMENT '头像URL',
  `gender` varchar(10) DEFAULT 'unknown' COMMENT '性别',
  `bio` varchar(500) DEFAULT '无简介' COMMENT '个人简介',
  `phone` varchar(20) DEFAULT NULL COMMENT '手机号',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `username_UNIQUE` (`username`),
  UNIQUE KEY `phone_UNIQUE` (`phone`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户表';
```

### 2. 用户令牌表（user_token）存储用户登录令牌。```sql
CREATE TABLE `user_token` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '用户令牌ID',
  `user_id` int NOT NULL COMMENT '用户ID',
  `token` varchar(255) NOT NULL COMMENT '访问令牌',
  `expires_at` datetime NOT NULL COMMENT '过期时间',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  FOREIGN KEY (`user_id`) REFERENCES `user`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户令牌表';
```

### 3. 新闻分类表（news_category）存储新闻分类信息。```sql
CREATE TABLE `news_category` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '分类id',
  `name` varchar(50) NOT NULL COMMENT '分类名称',
  `sort_order` int NOT NULL DEFAULT 0 COMMENT '排序顺序',
  PRIMARY KEY (`id`),
  UNIQUE KEY `name_UNIQUE` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='新闻分类表';
```

### 4. 新闻表（news）存储新闻内容。```sql
CREATE TABLE `news` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '新闻id',
  `title` varchar(100) NOT NULL COMMENT '新闻标题',
  `description` varchar(255) NOT NULL COMMENT '新闻描述',
  `content` varchar(255) NOT NULL COMMENT '新闻内容',
  `image` varchar(255) NOT NULL COMMENT '新闻图片',
  `author` varchar(50) NOT NULL COMMENT '作者',
  `category_id` int NOT NULL COMMENT '分类ID',
  `views` int NOT NULL DEFAULT 0 COMMENT '点击量',
  `publish_time` datetime NOT NULL COMMENT '发布时间',
  PRIMARY KEY (`id`),
  INDEX `fk_news_category_id` (`category_id`),
  INDEX `idx_publish_time` (`publish_time`),
  FOREIGN KEY (`category_id`) REFERENCES `news_category`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='新闻表';
```

### 5. 收藏表（favorite）存储用户收藏的新闻。```sql
CREATE TABLE `favorite` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '收藏id',
  `user_id` int NOT NULL COMMENT '用户id',
  `news_id` int NOT NULL COMMENT '新闻id',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '收藏时间',
  PRIMARY KEY (`id`),
  FOREIGN KEY (`user_id`) REFERENCES `user`(`id`),
  FOREIGN KEY (`news_id`) REFERENCES `news`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='收藏表';
```

### 6. 历史记录表（history）存储用户浏览历史。```sql
CREATE TABLE `history` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '历史id',
  `user_id` int NOT NULL COMMENT '用户id',
  `news_id` int NOT NULL COMMENT '新闻id',
  `view_time` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '查看时间',
  PRIMARY KEY (`id`),
  FOREIGN KEY (`user_id`) REFERENCES `user`(`id`),
  FOREIGN KEY (`news_id`) REFERENCES `news`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='历史记录表';
```

## 🔗 表关系图```
┌─────────────────┐     ┌─────────────────┐
│      user       │     │    user_token   │
├─────────────────┤     ├─────────────────┤
│ id (PK)         │◄────│ user_id (FK)    │
│ username        │     │ token           │
│ password        │     │ expires_at      │
│ nickname        │     └─────────────────┘
│ avatar          │
│ gender          │
│ bio             │
│ phone           │
│ created_at      │
│ updated_at      │
└─────────────────┘
        │
        │ 1:N
        ▼
┌─────────────────┐     ┌─────────────────┐
│    favorite     │     │     history     │
├─────────────────┤     ├─────────────────┤
│ id (PK)         │     │ id (PK)         │
│ user_id (FK)    │     │ user_id (FK)    │
│ news_id (FK)    │     │ news_id (FK)    │
│ created_at      │     │ view_time       │
└─────────────────┘     └─────────────────┘
        │                       │
        │ N:1                   │ N:1
        ▼                       ▼
┌─────────────────┐     ┌─────────────────┐
│      news       │     │  news_category  │
├─────────────────┤     ├─────────────────┤
│ id (PK)         │     │ id (PK)         │
│ title           │◄────│ name            │
│ description     │     │ sort_order      │
│ content         │     └─────────────────┘
│ image           │
│ author          │
│ category_id(FK) │
│ views           │
│ publish_time    │
└─────────────────┘
```

## 📐 ORM 模型定义

### models/base.py```python
from sqlalchemy.orm import DeclarativeBase

class Base(DeclarativeBase):
    pass
```

### models/users.py```python
from typing import Optional
from sqlalchemy import DateTime, Integer, String, Index, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from datetime import datetime
from models.base import Base

class User(Base):
    __tablename__ = 'user'

    __table_args__ = (
        Index('username_UNIQUE', 'username', unique=True),
        Index('phone_UNIQUE', 'phone', unique=True),
    )
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True, comment='用户ID')
    username: Mapped[str] = mapped_column(String(50), nullable=False, comment='用户名')
    password: Mapped[str] = mapped_column(String(255), nullable=False, comment='密码（加密存储）')
    nickname: Mapped[Optional[str]] = mapped_column(String(50), nullable=True, comment='昵称')
    avatar: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, comment='头像URL')
    gender: Mapped[Optional[str]] = mapped_column(String(10), nullable=True, default='unknown', comment='性别')
    bio: Mapped[Optional[str]] = mapped_column(String(500), nullable=True, comment='个人简介', default='无简介')
    phone: Mapped[Optional[str]] = mapped_column(String(20), nullable=True, comment='手机号')
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, comment='创建时间')
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, onupdate=datetime.now, comment='更新时间')

class UserToken(Base):
    __tablename__ = 'user_token'

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True, comment='用户令牌ID')
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey('user.id'), nullable=False, comment='用户ID')
    token: Mapped[str] = mapped_column(String(255), nullable=False, comment='访问令牌')
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, comment='过期时间')
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, comment='创建时间')
```

## 🔄 自动创建表

项目启动时会自动创建表。确保在 `main.py` 中导入模型：

```python
import models  # 确保所有模型注册到Base.metadata
```

## 📝 下一步

数据库设计完成后，查看 [03-模型层实现.md](./03-模型层实现.md) 了解如何实现数据模型。
