---
title: "从本地到上线的部署清单"
date: 2026-04-27 22:40:00
cover: /img/covers/deployment-guide.svg
top_img: /img/covers/deployment-guide.svg
description: "┌─────────────────────────────────────────────────────────────────┐"
categories:
  - 后端
tags:
  - 部署
  - 运维
  - 清单
---

﻿# ?? 部署指南

## 1. 部署架构

### 1.1 开发环境```
┌─────────────────────────────────────────────────────────────────┐
│                        开发环境架构                               │
│                                                                 │
│  ┌──────────────────┐    ┌──────────────────┐                   │
│  │   Vite Dev       │    │   Uvicorn        │                   │
│  │   Server         │───?│   + Reload       │                   │
│  │   (Port 5173)    │    │   (Port 8000)    │                   │
│  └──────────────────┘    └──────────────────┘                   │
│           │                       │                             │
│           │ proxy /api            │                             │
│           ▼                       ▼                             │
│  ┌──────────────────┐    ┌──────────────────┐                   │
│  │   浏览器         │    │   SQLite         │                   │
│  │                  │    │   (learn_pdf.db) │                   │
│  └──────────────────┘    └──────────────────┘                   │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 生产环境```
┌─────────────────────────────────────────────────────────────────┐
│                        生产环境架构                               │
│                                                                 │
│  ┌──────────────────┐                                           │
│  │   Nginx          │                                           │
│  │   (Port 80/443)  │                                           │
│  └────────┬─────────┘                                           │
│           │                                                     │
│     ┌─────┴─────┐                                               │
│     │           │                                               │
│     ▼           ▼                                               │
│  ┌──────┐   ┌──────────────────┐                                │
│  │ 静态 │   │   Gunicorn       │                                │
│  │ 文件 │   │   + Uvicorn      │                                │
│  │ 前端 │   │   Workers        │                                │
│  └──────┘   │   (Port 8000)    │                                │
│             └────────┬─────────┘                                │
│                      │                                          │
│            ┌─────────┴─────────┐                                │
│            │                   │                                │
│            ▼                   ▼                                │
│     ┌────────────┐     ┌────────────┐                          │
│     │ PostgreSQL │     │   Redis    │                          │
│     │  数据库    │     │   缓存     │                          │
│     └────────────┘     └────────────┘                          │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. 开发环境搭建

### 2.1 环境要求

| 工具 | 版本 | 说明 |
|------|------|------|
| Node.js | >= 18 | 前端运行时 |
| Python | >= 3.10 | 后端运行时 |
| npm/yarn/pnpm | 最新 | 包管理器 |
| Git | >= 2.0 | 版本控制 |

### 2.2 后端搭建```bash
# 1. 进入后端目录cd backend

# 2. 创建虚拟环境
python -m venv venv

# 3. 激活虚拟环境
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# 4. 安装依赖
pip install -r requirements.txt

# 5. 配置环境变量
cp .env.example .env
# 编辑 .env 文件，填写必要的配置

# 6. 初始化数据库
alembic upgrade head

# 7. 启动开发服务器
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 2.3 前端搭建```bash
# 1. 进入前端目录cd frontend

# 2. 安装依赖npm install

# 3. 配置环境变量
cp .env.example .env.local
# 编辑 .env.local 文件

# 4. 启动开发服务器npm run dev```

### 2.4 访问地址

| 服务 | 地址 | 说明 |
|------|------|------|
| 前端 | http://localhost:5173 | Vue 开发服务器 |
| 后端 API | http://localhost:8000 | FastAPI 服务 |
| API 文档 | http://localhost:8000/docs | Swagger UI |
| API 文档 | http://localhost:8000/redoc | ReDoc |

---

## 3. 生产环境部署

### 3.1 Docker 部署

#### 3.1.1 后端 Dockerfile

```dockerfile
# backend/Dockerfile
FROM python:3.11-slim

WORKDIR /app

# 安装系统依赖
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# 复制依赖文件
COPY requirements.txt .

# 安装 Python 依赖
RUN pip install --no-cache-dir -r requirements.txt

# 复制应用代码COPY . .

# 创建上传目录
RUN mkdir -p uploads

# 暴露端口EXPOSE 8000

# 启动命令
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]
```

#### 3.1.2 前端 Dockerfile

```dockerfile
# frontend/Dockerfile
# 构建阶段
FROM node:18-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# 生产阶段
FROM nginx:alpine

# 复制构建产物
COPY --from=builder /app/dist /usr/share/nginx/html

# 复制 Nginx 配置
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

#### 3.1.3 Nginx 配置```nginx
# frontend/nginx.confserver {listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    # 前端路由location / {
        try_files $uri $uri/ /index.html;
    }

    # API 代理
    location /api {
        proxy_pass http://backend:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 静态资源缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

#### 3.1.4 Docker Compose```yaml
# docker-compose.yml
version: '3.8'

services:
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    ports:
      - "80:80"
    depends_on:
      - backend
    networks:
      - app-network

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgresql+asyncpg://postgres:postgres@db:5432/learn_pdf
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - OPENAI_MODEL=${OPENAI_MODEL:-gpt-4}
    volumes:
      - uploads:/app/uploads
    depends_on:
      - db
    networks:
      - app-network

  db:
    image: postgres:15-alpine
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres
      - POSTGRES_DB=learn_pdf
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    networks:
      - app-network

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    networks:
      - app-network

volumes:
  postgres_data:
  uploads:

networks:
  app-network:
    driver: bridge
```

#### 3.1.5 启动服务```bash
# 构建并启动
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

---

### 3.2 传统部署

#### 3.2.1 后端部署```bash
# 1. 安装依赖
pip install gunicorn uvicorn[standard]

# 2. 启动 Gunicorn
gunicorn app.main:app \
    --workers 4 \
    --worker-class uvicorn.workers.UvicornWorker \
    --bind 0.0.0.0:8000 \
    --timeout 120 \
    --access-logfile /var/log/learn-pdf/access.log \
    --error-logfile /var/log/learn-pdf/error.log
```

#### 3.2.2 前端部署```bash
# 1. 构建
npm run build

# 2. 复制到 Nginx 目录
cp -r dist/* /var/www/learn-pdf/

# 3. 配置 Nginx (见上方 nginx.conf)```

#### 3.2.3 Nginx 安装配置```bash
# 安装 Nginx
sudo apt update
sudo apt install nginx

# 复制配置文件
sudo cp nginx.conf /etc/nginx/sites-available/learn-pdf

# 启用站点
sudo ln -s /etc/nginx/sites-available/learn-pdf /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default

# 测试配置
sudo nginx -t

# 重启 Nginx
sudo systemctl restart nginx
```

---

## 4. 环境变量配置

### 4.1 后端环境变量```env
# backend/.env

# 数据库
DATABASE_URL=sqlite+aiosqlite:///./learn_pdf.db
# 生产环境: DATABASE_URL=postgresql+asyncpg://user:pass@localhost/learn_pdf

# AI 配置
OPENAI_API_KEY=sk-your-api-key
OPENAI_MODEL=gpt-4
LLM_TIMEOUT=30

# 文件上传
UPLOAD_DIR=uploads
MAX_FILE_SIZE=20971520

# CORS
CORS_ORIGINS=["http://localhost:5173","http://localhost:80"]

# 安全
SECRET_KEY=your-secret-key-here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# 调试DEBUG=false```

### 4.2 前端环境变量```env
# frontend/.env

# API 地址
VITE_API_BASE_URL=http://localhost:8000/api/v1

# 应用配置
VITE_APP_TITLE=LearnPDF
VITE_APP_VERSION=1.0.0
```

---

## 5. 数据库部署

### 5.1 PostgreSQL 安装```bash
# Ubuntu/Debian
sudo apt update
sudo apt install postgresql postgresql-contrib

# 启动服务
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### 5.2 创建数据库```bash
# 切换到 postgres 用户
sudo -u postgres psql

# 创建数据库和用户
CREATE USER learn_pdf WITH PASSWORD 'your_password';
CREATE DATABASE learn_pdf OWNER learn_pdf;
GRANT ALL PRIVILEGES ON DATABASE learn_pdf TO learn_pdf;

# 退出\q```

### 5.3 数据库迁移```bash
# 配置 alembic.ini 中的数据库连接
# sqlalchemy.url = postgresql+asyncpg://learn_pdf:your_password@localhost/learn_pdf

# 执行迁移
alembic upgrade head
```

---

## 6. 监控和日志

### 6.1 应用日志```python
# app/core/logging.py
import logging
from logging.handlers import RotatingFileHandler

def setup_logging():
    # 创建日志目录import os
    os.makedirs("logs", exist_ok=True)
    
    # 配置日志
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        handlers=[
            RotatingFileHandler(
                "logs/app.log",
                maxBytes=10*1024*1024,  # 10MB
                backupCount=5
            ),
            logging.StreamHandler()
        ]
    )
```

### 6.2 健康检查```python
# app/api/v1/health.py
from fastapi import APIRouter
from sqlalchemy import text
from app.core.deps import get_db

router = APIRouter(tags=["health"])

@router.get("/health")
async def health_check(db=Depends(get_db)):
    try:
        # 检查数据库连接
        await db.execute(text("SELECT 1"))
        return {"status": "healthy", "database": "connected"}
    except Exception as e:
        return {"status": "unhealthy", "database": str(e)}
```

---

## 7. SSL/TLS 配置

### 7.1 Let's Encrypt```bash
# 安装 Certbot
sudo apt install certbot python3-certbot-nginx

# 获取证书
sudo certbot --nginx -d yourdomain.com

# 自动续期
sudo certbot renew --dry-run
```

### 7.2 Nginx SSL 配置```nginxserver {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    # SSL 配置
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # ... 其他配置}

# HTTP 重定向到 HTTPSserver {listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}
```

---

## 8. 性能优化

### 8.1 Gunicorn 配置```python
# gunicorn_config.py
import multiprocessing

# 工作进程数
workers = multiprocessing.cpu_count() * 2 + 1

# 工作类
worker_class = "uvicorn.workers.UvicornWorker"

# 超时
timeout = 120

# 保持连接
keepalive = 5

# 日志
accesslog = "/var/log/learn-pdf/access.log"
errorlog = "/var/log/learn-pdf/error.log"
loglevel = "info"
```

### 8.2 Nginx 缓存```nginx
# 静态资源缓存
location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}

# API 响应缓存 (可选)
location /api/v1/templates {
    proxy_cache_valid 200 10m;
    proxy_cache use_zone my_zone 10m;
}
```

---

## 9. 故障排查

### 9.1 常见问题

| 问题 | 原因 | 解决方案 |
|------|------|----------|
| 413 Request Entity Too Large | 文件过大 | 调整 Nginx `client_max_body_size` |
| 502 Bad Gateway | 后端未启动 | 检查 Gunicorn 进程 |
| CORS 错误 | 跨域配置 | 检查 `CORS_ORIGINS` 配置 |
| 数据库连接失败 | 连接配置错误 | 检查 `DATABASE_URL` |

### 9.2 日志查看```bash
# 查看 Nginx 日志
tail -f /var/log/nginx/error.log
tail -f /var/log/nginx/access.log

# 查看应用日志
tail -f /var/log/learn-pdf/error.log
tail -f /var/log/learn-pdf/access.log

# Docker 日志
docker-compose logs -f backend
docker-compose logs -f frontend
```

---

## 10. 备份策略

### 10.1 数据库备份```bash
# 创建备份脚本
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
pg_dump -U postgres learn_pdf > /backups/learn_pdf_$DATE.sql

# 保留最近 7 天的备份
find /backups -name "*.sql" -mtime +7 -delete
```

### 10.2 文件备份```bash
# 备份上传文件
tar -czf /backups/uploads_$(date +%Y%m%d).tar.gz /path/to/uploads
```

### 10.3 定时任务```bash
# 添加定时备份任务crontab -e

# 每天凌晨 2 点备份数据库
0 2 * * * /path/to/backup_db.sh

# 每周日凌晨 3 点备份文件
0 3 * * 0 /path/to/backup_files.sh
```
