---
title: "认证机制详解：JWT 与 Session 怎么选"
date: 2026-04-02 22:20:00
cover: /img/covers/security.jpg
top_img: /img/covers/security.jpg
description: "本项目采用 Token 认证机制，使用 UUID 作为 Token，支持 Bearer token 格式。"
categories:
  - 后端
tags:
  - JWT
  - Session
  - 认证
---

## 📋 概述

本项目采用 **Token 认证**机制，使用 UUID 作为 Token，支持 `Bearer token` 格式。

## 🔐 认证流程```
┌─────────────────────────────────────────────────────────────┐
│                      用户登录                                │
│              POST /api/user/login                           │
│              {username, password}                           │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    验证用户名密码                             │
│              authenticate_user()                            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    生成 Token                                │
│              create_token()                                 │
│              Token = UUID                                   │
│              有效期 = 7天                                    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    返回 Token                                │
│              {"token": "xxx", "userInfo": {...}}            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    前端存储 Token                             │
│              localStorage / Cookie                          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    后续请求携带 Token                          │
│              Header: Authorization: Bearer xxx              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    验证 Token                                │
│              get_current_user()                             │
│              查询 user_token 表                              │
│              检查是否过期                                    │
└─────────────────────────────────────────────────────────────┘
```

## 👤 用户注册

### 请求```http
POST /api/user/register
Content-Type: application/json

{
  "username": "testuser",
  "password": "123456"
}
```

### 响应```json{"code": 200,
  "message": "注册成功",
  "data": {
    "token": "550e8400-e29b-41d4-a716-446655440000",
    "userInfo": {
      "id": 1,
      "username": "testuser",
      "nickname": null,
      "avatar": null,
      "gender": null,
      "bio": "无简介"
    }
  }
}
```

### 实现代码```python
# router/user.py
@router.post("/register")
async def register(user_data: UserRequest, db: AsyncSession = Depends(get_db)):
    # 1. 检查用户名是否存在
    existing_user = await get_user_by_username(db, user_data.username)
    if existing_user:
        raise HTTPException(status_code=400, detail="用户名已存在")

    # 2. 创建用户（密码加密）
    user_data_obj = await create_user(db, user_data)

    # 3. 生成 Token
    token = await create_token(db, user_data_obj.id)

    # 4. 返回响应
    res_data = UserAuthResponse(
        token=token,
        user_info=UserInfoResponse.model_validate(user_data_obj)
    )
    return success_response(message='注册成功', data=res_data)
```

## 🔑 用户登录

### 请求```http
POST /api/user/login
Content-Type: application/json

{
  "username": "testuser",
  "password": "123456"
}
```

### 响应```json{"code": 200,
  "message": "登录成功",
  "data": {
    "token": "550e8400-e29b-41d4-a716-446655440000",
    "userInfo": {
      "id": 1,
      "username": "testuser",
      "nickname": null,
      "avatar": null,
      "gender": null,
      "bio": "无简介"
    }
  }
}
```

### 实现代码```python
# router/user.py
@router.post("/login")
async def login(user_data: UserRequest, db: AsyncSession = Depends(get_db)):
    # 1. 验证用户名密码
    user = await authenticate_user(db, user_data.username, user_data.password)
    if not user:
        raise HTTPException(status_code=401, detail="用户名或密码错误")

    # 2. 生成 Token
    token = await create_token(db, user.id)

    # 3. 返回响应
    res_data = UserAuthResponse(
        token=token,
        user_info=UserInfoResponse.model_validate(user)
    )
    return success_response(message='登录成功', data=res_data)
```

## 🔍 Token 验证

### 请求```http
GET /api/user/info
Authorization: Bearer 550e8400-e29b-41d4-a716-446655440000
```

### 响应```json{"code": 200,
  "message": "获取用户信息成功",
  "data": {
    "id": 1,
    "username": "testuser",
    "nickname": null,
    "avatar": null,
    "gender": null,
    "bio": "无简介"
  }
}
```

### 实现代码```python
# utils/auth.py
async def get_current_user(
        authorization: str = Header(..., alias="Authorization"),
        db: AsyncSession = Depends(get_db),
):
    """获取当前用户"""
    # 1. 提取 Token
    token = authorization
    if token.startswith("Bearer "):
        token = token[7:]

    # 2. 查询用户
    user = await users.get_user_info(db, token)
    if not user:
        raise HTTPException(status_code=401, detail="token无效")

    return user
```

## 🗄️ 数据库实现

### Token 存储```python
# crud/users.py
async def create_token(db: AsyncSession, user_id: int):
    """创建或更新 Token"""
    token = str(uuid.uuid4())  # 生成 UUID
    expires_at = datetime.now() + timedelta(days=7)  # 7天有效期

    # 查询是否已有 Token
    res = await db.execute(select(UserToken).where(UserToken.user_id == user_id))
    user_token = res.scalar_one_or_none()

    if user_token:
        # 更新已有 Token
        user_token.token = token
        user_token.expires_at = expires_at
    else:
        # 创建新 Token
        user_token = UserToken(user_id=user_id, token=token, expires_at=expires_at)
        db.add(user_token)

    await db.commit()
    return token
```

### Token 验证```python
# crud/users.py
async def get_user_info(db: AsyncSession, token: str):
    """根据 Token 获取用户信息"""
    # 1. 查询 Token
    res = await db.execute(select(UserToken).where(UserToken.token == token))
    user_token = res.scalar_one_or_none()

    # 2. 检查 Token 是否存在且未过期
    if not user_token or user_token.expires_at < datetime.now():
        return None

    # 3. 查询用户
    user = await db.execute(select(User).where(User.id == user_token.user_id))
    user_data = user.scalar_one_or_none()

    return user_data
```

## 🔐 密码加密

### 加密流程```
明文密码 → bcrypt.hashpw() → 哈希密码（存储到数据库）
```

### 实现代码```python
# utils/security.py
import bcrypt

def get_hashed_password(password: str):
    """密码加密"""
    # bcrypt 有 72 字节限制
    if len(password.encode('utf-8')) > 72:
        password = password[:72]
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(plain_password, hashed_password):
    """密码验证"""
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))
```

### 使用示例```python
# 注册时加密密码
hashed_password = get_hashed_password("123456")
# 结果：$2b$12$LJ3m4ys3Lz0hQ8vQ8vQ8vO8vQ8vQ8vQ8vQ8vQ8vQ8vQ8vQ8vQ8v

# 登录时验证密码
is_valid = verify_password("123456", hashed_password)
# 结果：True```

## 🛡️ 安全特性

### 1. 密码加密
- 使用 `bcrypt` 算法
- 自动添加盐值
- 不可逆加密

### 2. Token 有效期
- 默认 7 天
- 登录时自动刷新
- 过期后需要重新登录

### 3. 请求头认证
- 使用 `Authorization` Header
- 支持 `Bearer token` 格式
- 通过依赖注入自动验证

## 📊 Token 数据结构```sql
CREATE TABLE `user_token` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '用户令牌ID',
  `user_id` int NOT NULL COMMENT '用户ID',
  `token` varchar(255) NOT NULL COMMENT '访问令牌',
  `expires_at` datetime NOT NULL COMMENT '过期时间',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  FOREIGN KEY (`user_id`) REFERENCES `user`(`id`)
);
```

## 🎯 最佳实践

1. **使用 HTTPS**：生产环境必须使用 HTTPS
2. **Token 有效期**：设置合理的过期时间
3. **密码强度**：要求用户使用强密码
4. **错误信息**：不要返回详细的错误信息
5. **日志记录**：记录登录失败尝试

## 🔧 扩展建议

### 1. JWT Token
当前使用 UUID Token，可以考虑使用 JWT：
- 包含用户信息
- 无需查询数据库
- 支持自定义声明

### 2. 刷新 Token
实现双 Token 机制：
- Access Token（短有效期）
- Refresh Token（长有效期）

### 3. 多设备登录支持用户在多个设备登录：
- 记录设备信息
- 支持单设备登出

## 📝 下一步

认证机制完成后，查看 [09-API测试指南.md](./09-API测试指南.md) 了解如何测试 API 接口。
