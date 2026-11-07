---
title: "数据库设计与实践：从范式到索引"
date: 2026-03-26 22:40:00
cover: /img/covers/database-design-practice.svg
top_img: /img/covers/database-design-practice.svg
description: "从零开始学习数据库设计，掌握关系型数据库的最佳实践"
categories:
  - 后端
tags:
  - 数据库
  - 设计
  - MySQL
---

> 从零开始学习数据库设计，掌握关系型数据库的最佳实践

## 1. 数据库基础

### 什么是数据库？
数据库是一个按照数据结构来组织、存储和管理数据的仓库。它允许用户高效地存储、检索和管理数据。

### 数据库类型```
┌─────────────────────────────────────────────────────────────┐
│                      数据库类型                              │
├─────────────────────────────────────────────────────────────┤
│  关系型数据库 (RDBMS)                                        │
│  ├── MySQL                                                   │
│  ├── PostgreSQL                                              │
│  ├── SQLite                                                  │
│  └── Oracle                                                  │
│                                                              │
│  NoSQL 数据库                                                │
│  ├── MongoDB (文档型)                                        │
│  ├── Redis (键值型)                                          │
│  ├── Cassandra (列族型)                                      │
│  └── Neo4j (图数据库)                                        │
└─────────────────────────────────────────────────────────────┘
```

### 关键概念
- **表 (Table)**：数据的集合，类似于 Excel 工作表
- **行 (Row)**：表中的一条记录
- **列 (Column)**：表中的一个字段
- **主键 (Primary Key)**：唯一标识一行的字段
- **外键 (Foreign Key)**：关联其他表的字段

---

## 2. 关系型数据库

### 2.1 关系模型
关系模型是基于集合论和谓词逻辑的数据库模型。数据以二维表的形式组织，表之间通过键建立关系。

### 2.2 关系类型```python
# 一对一关系 (1:1)
# 用户 ↔ 用户资料class User:id: intname: str

class UserProfile:
    user_id: int  # 外键
    bio: str

# 一对多关系 (1:N)
# 用户 → 文章class User:id: intname: str

class Post:
    id: int
    title: str
    author_id: int  # 外键

# 多对多关系 (M:N)
# 文章 ↔ 标签class Post:id: inttitle: str

class Tag:
    id: int
    name: str

class PostTag:  # 关联表
    post_id: int
    tag_id: int
```

### 2.3 关系数据库优势
- ✅ **数据完整性**：通过约束确保数据准确性
- ✅ **减少冗余**：通过范式化减少重复数据
- ✅ **事务支持**：ACID 特性保证数据一致性
- ✅ **查询灵活**：支持复杂查询和关联

---

## 3. 数据类型

### 3.1 数值类型```sql
-- 整数类型
TINYINT        -- 1 字节，-128 到 127
SMALLINT       -- 2 字节，-32768 到 32767
MEDIUMINT      -- 3 字节
INT            -- 4 字节
BIGINT         -- 8 字节

-- 浮点类型
FLOAT          -- 单精度浮点
DOUBLE         -- 双精度浮点
DECIMAL(M,D)   -- 精确小数
```

### 3.2 字符串类型```sql
-- 字符串类型
CHAR(N)        -- 固定长度字符串
VARCHAR(N)     -- 可变长度字符串
TEXT           -- 长文本
MEDIUMTEXT     -- 中等长度文本
LONGTEXT       -- 长文本

-- 特殊字符串
BINARY(N)      -- 固定长度二进制
VARBINARY(N)   -- 可变长度二进制
BLOB           -- 二进制大对象
```

### 3.3 日期时间类型```sql
-- 日期时间类型
DATE           -- 日期
TIME           -- 时间
DATETIME       -- 日期时间
TIMESTAMP      -- 时间戳
YEAR           -- 年份
```

### 3.4 Python 映射```python
from sqlalchemy import Column, Integer, String, Float, DateTime, Text
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()

class Product(Base):
    __tablename__ = "products"
    
    # 整数
    id = Column(Integer, primary_key=True)
    
    # 字符串
    name = Column(String(100))
    description = Column(Text)
    
    # 浮点数
    price = Column(Float)
    
    # 日期时间
    created_at = Column(DateTime)
```

---

## 4. 约束和索引

### 4.1 约束类型```sql
-- 主键约束
CREATE TABLE users (
    id INT PRIMARY KEY,
    name VARCHAR(50)
);

-- 唯一约束
CREATE TABLE users (
    id INT PRIMARY KEY,
    email VARCHAR(100) UNIQUE
);

-- 非空约束
CREATE TABLE users (
    id INT PRIMARY KEY,
    name VARCHAR(50) NOT NULL
);

-- 检查约束
CREATE TABLE users (
    id INT PRIMARY KEY,
    age INT CHECK (age >= 0 AND age <= 150)
);

-- 外键约束
CREATE TABLE posts (
    id INT PRIMARY KEY,
    title VARCHAR(100),
    author_id INT,
    FOREIGN KEY (author_id) REFERENCES users(id)
);
```

### 4.2 索引类型```sql
-- 基本索引
CREATE INDEX idx_users_email ON users(email);

-- 唯一索引
CREATE UNIQUE INDEX idx_users_email ON users(email);

-- 复合索引
CREATE INDEX idx_users_name_email ON users(name, email);

-- 部分索引
CREATE INDEX idx_users_active ON users(id) WHERE is_active = true;

-- 全文索引
CREATE FULLTEXT INDEX idx_posts_content ON posts(content);
```

### 4.3 Python 映射```python
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
    )
```

---

## 5. ER 图设计

### 5.1 ER 图符号```
┌─────────────────────────────────────────────────────────────┐
│                      ER 图符号                              │
├─────────────────────────────────────────────────────────────┤
│  实体 (Entity)        ╔═══════════╗                         │
│                       ║  实体名称  ║                         │
│                       ╚═══════════╝                         │
│                                                              │
│  属性 (Attribute)     (属性名称)                            │
│                                                              │
│  关系 (Relationship)  ───────────                           │
│                                                              │
│  主键 (Primary Key)   # 属性名称                            │
│                                                              │
│  外键 (Foreign Key)   * 属性名称                            │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 博客系统 ER 图```
╔═══════════╗         ╔═══════════╗         ╔═══════════╗
║   Users   ║         ║   Posts   ║         ║   Tags    ║
╠═══════════╣         ╠═══════════╣         ╠═══════════╣
║ #id       ║────────▶║ #id       ║◀────────║ #id       ║
║  name     ║    1:N  ║  title    ║   M:N   ║  name     ║
║  email    ║         ║  content  ║         ╚═══════════╝
║  password ║         ║  author_id║                │
╚═══════════╝         ║  created_at║               │
                      ╚═══════════╝                │
                            │                      │
                            └──────────────────────┘
                                 PostTags
                            (关联表)
```

### 5.3 设计步骤
1. **识别实体**：找出系统中的主要对象
2. **定义属性**：为每个实体定义属性
3. **识别关系**：确定实体之间的关系
4. **定义基数**：确定关系的基数（1:1, 1:N, M:N）
5. **规范化**：应用范式化原则
6. **验证**：检查设计是否满足需求

---

## 6. 范式化

### 6.1 第一范式 (1NF)
每个属性都是原子的，不可再分。

```sql
-- 违反 1NF
CREATE TABLE users (
    id INT PRIMARY KEY,
    name VARCHAR(50),
    phones VARCHAR(200)  -- 存储多个电话号码
);

-- 符合 1NF
CREATE TABLE users (
    id INT PRIMARY KEY,
    name VARCHAR(50)
);

CREATE TABLE user_phones (
    id INT PRIMARY KEY,
    user_id INT,
    phone VARCHAR(20),
    FOREIGN KEY (user_id) REFERENCES users(id)
);
```

### 6.2 第二范式 (2NF)
满足 1NF，且非主属性完全依赖于主键。

```sql
-- 违反 2NF
CREATE TABLE order_items (
    order_id INT,
    product_id INT,
    product_name VARCHAR(100),  -- 依赖于 product_id，不是 order_id
    quantity INT,
    PRIMARY KEY (order_id, product_id)
);

-- 符合 2NF
CREATE TABLE orders (
    id INT PRIMARY KEY,
    customer_id INT,
    order_date DATE
);

CREATE TABLE products (
    id INT PRIMARY KEY,
    name VARCHAR(100),
    price DECIMAL(10,2)
);

CREATE TABLE order_items (
    order_id INT,
    product_id INT,
    quantity INT,
    PRIMARY KEY (order_id, product_id),
    FOREIGN KEY (order_id) REFERENCES orders(id),
    FOREIGN KEY (product_id) REFERENCES products(id)
);
```

### 6.3 第三范式 (3NF)
满足 2NF，且非主属性不传递依赖于主键。

```sql
-- 违反 3NF
CREATE TABLE users (
    id INT PRIMARY KEY,
    name VARCHAR(50),
    department_id INT,
    department_name VARCHAR(50)  -- 依赖于 department_id，传递依赖于 id
);

-- 符合 3NF
CREATE TABLE users (
    id INT PRIMARY KEY,
    name VARCHAR(50),
    department_id INT,
    FOREIGN KEY (department_id) REFERENCES departments(id)
);

CREATE TABLE departments (
    id INT PRIMARY KEY,
    name VARCHAR(50)
);
```

---

## 7. 反范式化

### 7.1 为什么需要反范式化？
- **性能优化**：减少 JOIN 操作
- **查询简化**：减少复杂查询
- **缓存友好**：便于缓存数据

### 7.2 反范式化策略```sql
-- 添加冗余字段
CREATE TABLE posts (
    id INT PRIMARY KEY,
    title VARCHAR(100),
    content TEXT,
    author_id INT,
    author_name VARCHAR(50),  -- 冗余字段，避免 JOIN
    created_at TIMESTAMP
);

-- 使用汇总表
CREATE TABLE post_stats (
    post_id INT PRIMARY KEY,
    view_count INT DEFAULT 0,
    like_count INT DEFAULT 0,
    comment_count INT DEFAULT 0,
    FOREIGN KEY (post_id) REFERENCES posts(id)
);

-- 使用物化视图
CREATE MATERIALIZED VIEW user_post_stats AS
SELECT 
    u.id as user_id,
    u.name,
    COUNT(p.id) as post_count,
    AVG(p.view_count) as avg_views
FROM users u
LEFT JOIN posts p ON u.id = p.author_id
GROUP BY u.id, u.name;
```

---

## 8. 数据建模

### 8.1 概念模型```python
# 概念模型定义class User:"""用户实体"""id: int
    name: str
    email: str

class Post:
    """文章实体"""
    id: int
    title: str
    content: str
    author: User

class Comment:
    """评论实体"""
    id: int
    content: str
    post: Post
    author: User
```

### 8.2 逻辑模型```python
# 逻辑模型定义
from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True)
    name = Column(String(50), nullable=False)
    email = Column(String(100), unique=True, nullable=False)
    created_at = Column(DateTime, nullable=False)
    
    # 关系
    posts = relationship("Post", back_populates="author")
    comments = relationship("Comment", back_populates="author")

class Post(Base):
    __tablename__ = "posts"
    
    id = Column(Integer, primary_key=True)
    title = Column(String(100), nullable=False)
    content = Column(Text, nullable=False)
    author_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, nullable=False)
    
    # 关系
    author = relationship("User", back_populates="posts")
    comments = relationship("Comment", back_populates="post")

class Comment(Base):
    __tablename__ = "comments"
    
    id = Column(Integer, primary_key=True)
    content = Column(Text, nullable=False)
    post_id = Column(Integer, ForeignKey("posts.id"), nullable=False)
    author_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, nullable=False)
    
    # 关系
    post = relationship("Post", back_populates="comments")
    author = relationship("User", back_populates="comments")
```

### 8.3 物理模型```python
# 物理模型 - 考虑性能和存储
from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime, Index
from sqlalchemy.orm import relationship
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        Index('idx_user_email', 'email'),
        Index('idx_user_name', 'name'),
    )
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(50), nullable=False)
    email = Column(String(100), unique=True, nullable=False)
    password_hash = Column(String(128), nullable=False)
    created_at = Column(DateTime, nullable=False, server_default='CURRENT_TIMESTAMP')
    updated_at = Column(DateTime, nullable=False, server_default='CURRENT_TIMESTAMP')
    
    # 关系
    posts = relationship("Post", back_populates="author", lazy='dynamic')
```

---

## 9. DDL 操作

### 9.1 创建表```sql
-- 创建用户表
CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(128) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 创建文章表
CREATE TABLE posts (
    id INT PRIMARY KEY AUTO_INCREMENT,
    title VARCHAR(100) NOT NULL,
    content TEXT NOT NULL,
    author_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
);
```

### 9.2 修改表```sql
-- 添加列
ALTER TABLE users ADD COLUMN age INT;

-- 修改列
ALTER TABLE users MODIFY COLUMN name VARCHAR(100);

-- 删除列
ALTER TABLE users DROP COLUMN age;

-- 添加约束
ALTER TABLE users ADD CONSTRAINT chk_age CHECK (age >= 0 AND age <= 150);

-- 删除约束
ALTER TABLE users DROP CONSTRAINT chk_age;
```

### 9.3 删除表```sql
-- 删除表
DROP TABLE IF EXISTS posts;

-- 清空表
TRUNCATE TABLE posts;
```

---

## 10. DML 操作

### 10.1 插入数据```sql
-- 插入单条记录
INSERT INTO users (username, email, password_hash)
VALUES ('john', 'john@example.com', 'hashed_password');

-- 插入多条记录
INSERT INTO users (username, email, password_hash)
VALUES 
    ('john', 'john@example.com', 'hashed_password_1'),
    ('jane', 'jane@example.com', 'hashed_password_2'),
    ('bob', 'bob@example.com', 'hashed_password_3');

-- 从查询插入
INSERT INTO user_backup (username, email)
SELECT username, email FROM users WHERE is_active = true;
```

### 10.2 更新数据```sql
-- 更新单条记录
UPDATE users SET email = 'newemail@example.com' WHERE id = 1;

-- 更新多条记录
UPDATE users SET is_active = false WHERE last_login < '2023-01-01';

-- 使用表达式更新
UPDATE posts SET view_count = view_count + 1 WHERE id = 1;
```

### 10.3 删除数据```sql
-- 删除单条记录
DELETE FROM users WHERE id = 1;

-- 删除多条记录
DELETE FROM users WHERE is_active = false;

-- 清空表
DELETE FROM users;
```

---

## 11. 查询优化

### 11.1 使用索引```sql
-- 创建索引
CREATE INDEX idx_users_email ON users(email);

-- 使用索引查询
SELECT * FROM users WHERE email = 'john@example.com';

-- 避免的查询（不使用索引）
SELECT * FROM users WHERE email LIKE '%john%';
```

### 11.2 优化查询```sql
-- 避免 SELECT *
SELECT id, username, email FROM users WHERE id = 1;

-- 使用 LIMIT
SELECT * FROM posts ORDER BY created_at DESC LIMIT 10;

-- 使用 EXPLAIN 分析查询
EXPLAIN SELECT * FROM users WHERE email = 'john@example.com';
```

### 11.3 连接优化```sql
-- 使用 INNER JOIN
SELECT u.username, p.title
FROM users u
INNER JOIN posts p ON u.id = p.author_id;

-- 使用 LEFT JOIN
SELECT u.username, COUNT(p.id) as post_count
FROM users u
LEFT JOIN posts p ON u.id = p.author_id
GROUP BY u.id;
```

---

## 12. 事务和锁

### 12.1 事务特性 (ACID)
- **原子性 (Atomicity)**：事务要么全部成功，要么全部失败
- **一致性 (Consistency)**：事务前后数据保持一致
- **隔离性 (Isolation)**：并发事务互不干扰
- **持久性 (Durability)**：事务提交后永久保存

### 12.2 事务控制```sql
-- 开始事务
START TRANSACTION;

-- 执行操作
INSERT INTO users (username, email) VALUES ('john', 'john@example.com');
UPDATE accounts SET balance = balance - 100 WHERE user_id = 1;

-- 提交事务
COMMIT;

-- 回滚事务
ROLLBACK;
```

### 12.3 锁机制```sql
-- 行锁
SELECT * FROM users WHERE id = 1 FOR UPDATE;

-- 表锁
LOCK TABLES users WRITE;

-- 读锁
SELECT * FROM users WHERE id = 1 LOCK IN SHARE MODE;
```

---

## 13. 数据库选型

### 13.1 选型考虑因素```
┌─────────────────────────────────────────────────────────────┐
│                    数据库选型考虑因素                        │
├─────────────────────────────────────────────────────────────┤
│  1. 数据结构                                                │
│     - 关系型数据 → MySQL, PostgreSQL                        │
│     - 文档型数据 → MongoDB                                  │
│     - 键值数据 → Redis                                      │
│                                                              │
│  2. 性能需求                                                │
│     - 高读取 → Redis, MySQL                                 │
│     - 高写入 → Cassandra, MongoDB                           │
│     - 复杂查询 → PostgreSQL                                 │
│                                                              │
│  3. 扩展性                                                  │
│     - 垂直扩展 → MySQL, PostgreSQL                          │
│     - 水平扩展 → Cassandra, MongoDB                         │
│                                                              │
│  4. 一致性要求                                              │
│     - 强一致性 → MySQL, PostgreSQL                          │
│     - 最终一致性 → MongoDB, Cassandra                       │
└─────────────────────────────────────────────────────────────┘
```

### 13.2 常见数据库对比
| 数据库 | 类型 | 优势 | 劣势 |
|--------|------|------|------|
| MySQL | 关系型 | 简单易用，生态丰富 | 功能相对简单 |
| PostgreSQL | 关系型 | 功能强大，扩展性好 | 学习曲线陡峭 |
| MongoDB | 文档型 | 灵活，易于扩展 | 事务支持有限 |
| Redis | 键值型 | 高性能，支持多种数据结构 | 持久化有限 |

---

## 14. 性能优化

### 14.1 查询优化```python
# 使用索引
from sqlalchemy import Index

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True)
    email = Column(String(100))
    
    __table_args__ = (
        Index('idx_user_email', 'email'),
    )

# 使用查询优化
from sqlalchemy.orm import joinedload, selectinload

# 预加载关系数据
users = session.query(User).options(joinedload(User.posts)).all()

# 分页查询
users = session.query(User).offset(0).limit(10).all()
```

### 14.2 缓存策略```python
from functools import lru_cache
from sqlalchemy.orm import Session

@lru_cache(maxsize=128)
def get_user_by_id(user_id: int):
    return session.query(User).filter(User.id == user_id).first()

# 使用 Redis 缓存import redis

redis_client = redis.Redis(host='localhost', port=6379, db=0)

def get_user_with_cache(user_id: int):
    # 尝试从缓存获取
    cached_user = redis_client.get(f"user:{user_id}")
    if cached_user:
        return json.loads(cached_user)
    
    # 从数据库获取
    user = session.query(User).filter(User.id == user_id).first()
    if user:
        # 存入缓存
        redis_client.setex(
            f"user:{user_id}", 
            3600,  # 1小时过期
            json.dumps(user.__dict__)
        )
    
    return user
```

### 14.3 连接池优化```python
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
```

---

## 15. 安全最佳实践

### 15.1 SQL 注入防护```python
# 使用参数化查询
session.query(User).filter(User.email == email).first()

# 使用 ORM
user = session.query(User).filter(User.email == email).first()

# 避免的写法（SQL 注入风险）
# session.execute(f"SELECT * FROM users WHERE email = '{email}'")
```

### 15.2 密码安全```python
from passlib.context import CryptContext
from pydantic import BaseModel

# 密码加密
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

# 使用
hashed_password = get_password_hash("secret123")
is_valid = verify_password("secret123", hashed_password)
```

### 15.3 访问控制```python
from sqlalchemy.orm import Session
from fastapi import Depends, HTTPException

def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
):
    user = verify_token(token, db)
    if not user:
        raise HTTPException(
            status_code=401,
            detail="Invalid authentication credentials"
        )
    return user

def get_current_active_user(
    current_user: User = Depends(get_current_user)
):
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user
```

---

## 16. 监控和维护

### 16.1 性能监控```pythonimport time
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

### 16.2 数据库维护```python
# 定期备份
import subprocess
from datetime import datetime

def backup_database():
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_file = f"backup_{timestamp}.sql"
    
    subprocess.run([
        "mysqldump",
        "-u", "username",
        "-p=password",
        "database_name",
        f"--result-file={backup_file}"
    ])
    
    return backup_file

# 清理旧数据
def cleanup_old_data(days: int = 30):
    from datetime import datetime, timedelta
    
    cutoff_date = datetime.now() - timedelta(days=days)
    
    session.query(Post).filter(
        Post.created_at < cutoff_date
    ).delete()
    
    session.commit()
```

### 16.3 健康检查```python
from fastapi import FastAPI, Depends
from sqlalchemy.orm import Session

app = FastAPI()

@app.get("/health")
def health_check(db: Session = Depends(get_db)):
    try:
        # 检查数据库连接
        db.execute("SELECT 1")
        return {
            "status": "healthy",
            "database": "connected",
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "database": "disconnected",
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }
```

---

## 🎯 下一步学习

### 推荐资源
- [SQL 教程](https://www.w3schools.com/sql/)
- [数据库设计教程](https://www.guru99.com/database-design.html)
- [SQLAlchemy 文档](https://docs.sqlalchemy.org/)

### 进阶主题
- 数据库分片
- 读写分离
- 数据库集群
- 云数据库服务

---

## 📝 笔记区

> 在这里记录你的学习笔记和心得

### 常用 SQL 语句```sql
-- 查询
SELECT * FROM users WHERE email = 'john@example.com';

-- 插入
INSERT INTO users (username, email) VALUES ('john', 'john@example.com');

-- 更新
UPDATE users SET email = 'newemail@example.com' WHERE id = 1;

-- 删除
DELETE FROM users WHERE id = 1;
```

### 常见问题
1. **SQL 注入**：使用参数化查询
2. **性能问题**：使用索引和查询优化
3. **数据一致性**：使用事务和锁

---

*最后更新：2026年6月27日*

#数据库 #SQL #ORM #Python #FastAPI #数据库设计
