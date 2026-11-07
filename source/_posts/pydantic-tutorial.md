---
title: "Pydantic 数据模型教程：校验、序列化与配置"
date: 2026-02-28 23:00:00
cover: /img/covers/api-flow.jpg
top_img: /img/covers/api-flow.jpg
description: "从零开始学习 Pydantic，掌握数据验证、序列化和类型安全的最佳实践"
categories:
  - 后端
tags:
  - Pydantic
  - Python
  - 数据校验
---

> 从零开始学习 Pydantic，掌握数据验证、序列化和类型安全的最佳实践

## 1. Pydantic 简介

### 什么是 Pydantic？
Pydantic 是一个基于 Python 类型提示的数据验证库，它使用 Python 的类型注解来验证数据，并提供清晰的错误信息。

### 为什么选择 Pydantic？
- ✅ **类型安全**：利用 Python 类型提示进行验证
- ✅ **快速高效**：核心验证逻辑用 Rust 编写
- ✅ **易于使用**：简洁的 API 和清晰的错误信息
- ✅ **JSON 支持**：完美支持 JSON 数据验证
- ✅ **FastAPI 集成**：FastAPI 的核心依赖

### 与其他库对比
| 特性 | Pydantic | Marshmallow | attrs |
|------|----------|-------------|-------|
| 性能 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ |
| 类型提示 | ✅ | ❌ | ✅ |
| JSON Schema | ✅ | ❌ | ❌ |
| FastAPI 集成 | ✅ | ❌ | ❌ |
| 学习曲线 | 低 | 中 | 中 |

---

## 2. 安装与环境

### 2.1 安装 Pydantic```bash
# 基础安装
pip install pydantic

# 安装额外依赖
pip install pydantic[email]  # 邮箱验证
pip install pydantic-settings  # 配置管理
```

### 2.2 验证安装```python
import pydantic
print(pydantic.__version__)
```

### 2.3 创建第一个模型```python
from pydantic import BaseModel

class User(BaseModel):
    id: int
    name: str
    email: str

# 创建用户实例
user = User(id=1, name="John", email="john@example.com")
print(user)
```

---

## 3. 基础模型

### 3.1 基本模型定义```python
from pydantic import BaseModel
from typing import Optional

class User(BaseModel):
    id: int
    name: str
    email: str
    age: Optional[int] = None  # 可选字段
    is_active: bool = True     # 默认值

# 创建用户
user = User(id=1, name="John", email="john@example.com")
print(user.dict())  # 转换为字典
```

### 3.2 字段类型```python
from pydantic import BaseModel
from typing import List, Dict, Optional
from datetime import datetime

class Product(BaseModel):
    id: int
    name: str
    price: float
    tags: List[str] = []
    metadata: Dict[str, str] = {}
    created_at: datetime
    is_available: bool = True
```

### 3.3 模型操作```python
# 创建模型
user = User(id=1, name="John", email="john@example.com")

# 访问字段
print(user.name)  # John
print(user.email)  # john@example.com

# 转换为字典
user_dict = user.dict()

# 转换为 JSON
user_json = user.json()

# 复制模型
user_copy = user.copy()

# 更新字段
user_copy.name = "Jane"
```

---

## 4. 字段验证

### 4.1 基本验证```python
from pydantic import BaseModel, Field

class User(BaseModel):
    id: int
    name: str = Field(..., min_length=1, max_length=50)
    email: str = Field(..., regex=r'^[\w\.-]+@[\w\.-]+\.\w+$')
    age: int = Field(..., gt=0, lt=150)
    password: str = Field(..., min_length=8)
```

### 4.2 字段约束```python
from pydantic import BaseModel, Field, EmailStr, HttpUrl

class User(BaseModel):
    # 字符串约束
    username: str = Field(..., min_length=3, max_length=20, pattern=r'^[a-zA-Z0-9_]+$')
    
    # 数字约束
    age: int = Field(..., ge=0, le=150)  # ge: >=, le: <=
    score: float = Field(..., gt=0, lt=100)  # gt: >, lt: <
    
    # 特殊类型
    email: EmailStr
    website: Optional[HttpUrl] = None
```

### 4.3 错误处理```python
from pydantic import BaseModel, Field, ValidationError

class User(BaseModel):
    name: str = Field(..., min_length=1)
    age: int = Field(..., gt=0)

try:
    user = User(name="", age=-5)
except ValidationError as e:
    print(e.errors())
    # [{'loc': ('name',), 'msg': 'ensure this value has at least 1 characters', 'type': 'value_error.min_length', ...}]
```

---

## 5. 字段类型

### 5.1 基本类型```python
from pydantic import BaseModel
from typing import Optional, List, Dict, Set, Tuple
from datetime import datetime, date, time
from decimal import Decimal
from uuid import UUID
	from enum import Enum

class AllTypes(BaseModel):
    # 字符串name: str
    email: Optional[str] = None
    
    # 数字age: intscore: float
    price: Decimal
    
    # 布尔
    is_active: bool
    
    # 日期时间
    created_at: datetime
    birthday: Optional[date] = None
    
    # 特殊类型id: UUID
    
    # 集合
    tags: List[str]
    metadata: Dict[str, str]
    unique_ids: Set[int]
    
    # 枚举
    class Color(str, Enum):
        RED = "red"
        GREEN = "green"
        BLUE = "blue"
    
    color: Color
```

### 5.2 特殊类型```python
from pydantic import BaseModel, Field
from typing import Annotated
from pydantic import Field

class User(BaseModel):
    # 邮箱验证
    email: EmailStr
    
    # URL 验证
    website: HttpUrl
    
    # IP 地址
    ip_address: IPv4Address
    
    # 文件路径
    file_path: FilePath
    
    # 目录路径
    dir_path: DirectoryPath
    
    # 信用卡号
    credit_card: str = Field(..., pattern=r'^\d{4}-\d{4}-\d{4}-\d{4}$')
```

### 5.3 自定义类型```python
from pydantic import BaseModel, Field, validator
from typing import Annotated

# 自定义类型别名
PositiveInt = Annotated[int, Field(gt=0)]
NonEmptyStr = Annotated[str, Field(min_length=1)]

class Product(BaseModel):
    id: PositiveInt
    name: NonEmptyStr
    price: PositiveInt
```

---

## 6. 模型验证

### 6.1 验证方法```python
from pydantic import BaseModel, ValidationError

class User(BaseModel):
    name: str
    age: int

# 验证数据try:
    user = User(**{"name": "John", "age": 25})
    print(user)
except ValidationError as e:
    print(e)

# 验证字典
data = {"name": "John", "age": 25}
user = User.validate(data)

# 验证 JSON
json_str = '{"name": "John", "age": 25}'
user = User.parse_raw(json_str)

# 验证文件
user = User.parse_file("user.json")
```

### 6.2 自定义验证```python
from pydantic import BaseModel, validator

class User(BaseModel):
    name: str
    password: str
    password_confirm: str

    @validator('name')
    def name_must_not_be_empty(cls, v):
        if not v.strip():
            raise ValueError('名字不能为空')
        return v.strip()

    @validator('password_confirm')
    def passwords_match(cls, v, values):
        if 'password' in values and v != values['password']:
            raise ValueError('密码不匹配')
        return v
```

### 6.3 模型验证```python
from pydantic import BaseModel, validator, root_validator

class User(BaseModel):
    name: str
    email: str
    age: int

    @root_validator
    def check_age_email(cls, values):
        age = values.get('age')
        email = values.get('email')
        
        if age and age < 18 and email and 'admin' in email:
            raise ValueError('未成年人不能使用管理员邮箱')
        
        return values
```

---

## 7. 模型序列化

### 7.1 转换方法```python
from pydantic import BaseModel
from typing import List

class User(BaseModel):
    id: int
    name: str
    email: str

class UserList(BaseModel):
    users: List[User]

# 创建数据users = [
    User(id=1, name="John", email="john@example.com"),
    User(id=2, name="Jane", email="jane@example.com")
]

user_list = UserList(users=users)

# 转换为字典
dict_data = user_list.dict()

# 转换为 JSON
json_data = user_list.json()

# 转换为 JSON 并格式化
json_pretty = user_list.json(indent=2)
```

### 7.2 序列化选项```python
from pydantic import BaseModel
from typing import Optional

class User(BaseModel):
    id: int
    name: str
    email: str
    password: str
    age: Optional[int] = None

user = User(id=1, name="John", email="john@example.com", password="secret123")

# 排除字段
print(user.dict(exclude={"password"}))
# {'id': 1, 'name': 'John', 'email': 'john@example.com', 'age': None}

# 只包含某些字段
print(user.dict(include={"id", "name"}))
# {'id': 1, 'name': 'John'}

# 递归排除
class Company(BaseModel):
    name: str
    users: List[User]

company = Company(name="ACME", users=[user])
print(company.dict(exclude={"users": {"password"}}))
```

### 7.3 自定义序列化```python
from pydantic import BaseModel
from pydantic.json import pydantic_encoder

class User(BaseModel):
    id: int
    name: str
    created_at: datetime

    class Config:
        json_encoders = {
            datetime: lambda v: v.strftime("%Y-%m-%d %H:%M:%S")
        }

user = User(id=1, name="John", created_at=datetime.now())
print(user.json())
```

---

## 8. 嵌套模型

### 8.1 基本嵌套```python
from pydantic import BaseModel
from typing import List, Optional

class Address(BaseModel):
    street: str
    city: str
    country: str
    postal_code: str

class User(BaseModel):
    id: int
    name: str
    address: Address
    addresses: List[Address] = []

# 创建嵌套模型
address = Address(street="123 Main St", city="New York", country="USA", postal_code="10001")
user = User(id=1, name="John", address=address, addresses=[address])
```

### 8.2 复杂嵌套```python
from pydantic import BaseModel
from typing import List, Dict, Optional

class Color(BaseModel):
    name: str
    hex_code: str

class Size(BaseModel):
    name: str
    dimensions: Dict[str, float]

class Product(BaseModel):
    id: int
    name: str
    colors: List[Color]
    sizes: List[Size]
    metadata: Dict[str, str] = {}

# 创建复杂嵌套
product = Product(
    id=1,
    name="T-Shirt",
    colors=[Color(name="Red", hex_code="#FF0000")],
    sizes=[Size(name="M", dimensions={"width": 50, "height": 70})]
)
```

### 8.3 循环引用```python
from pydantic import BaseModel
from typing import Optional, List

class User(BaseModel):
    id: int
    name: str
    friends: List['User'] = []

# 更新前向引用
User.update_forward_refs()

# 创建循环引用
user1 = User(id=1, name="John")
user2 = User(id=2, name="Jane")
user1.friends.append(user2)
user2.friends.append(user1)
```

---

## 9. 自定义验证器

### 9.1 字段验证器```python
from pydantic import BaseModel, field_validator

class User(BaseModel):
    name: str
    email: str
    age: int

    @field_validator('name')
    @classmethod
    def validate_name(cls, v):
        if len(v) < 2:
            raise ValueError('名字至少需要2个字符')
        return v.title()

    @field_validator('email')
    @classmethod
    def validate_email(cls, v):
        if '@' not in v:
            raise ValueError('无效的邮箱地址')
        return v.lower()
```

### 9.2 模型验证器```python
from pydantic import BaseModel, model_validator

class User(BaseModel):
    password: str
    password_confirm: str

    @model_validator(mode='after')
    def check_passwords(self):
        if self.password != self.password_confirm:
            raise ValueError('密码不匹配')
        return self
```

### 9.3 可重用验证器```python
from pydantic import BaseModel, validator
from functools import partial

def validate_length(min_length: int, max_length: int, v: str) -> str:
    if len(v) < min_length:
        raise ValueError(f'长度不能少于{min_length}个字符')
    if len(v) > max_length:
        raise ValueError(f'长度不能超过{max_length}个字符')
    return v

class User(BaseModel):
    name: str
    email: str

    _validate_name = validator('name', allow_reuse=True)(
        partial(validate_length, 2, 50)
    )
    _validate_email = validator('email', allow_reuse=True)(
        partial(validate_length, 5, 100)
    )
```

---

## 10. 模型配置

### 10.1 基本配置```python
from pydantic import BaseModel

class User(BaseModel):
    name: str
    age: int

    class Config:
        # 模式配置
        model_config = {
            "arbitrary_types_allowed": True,
            "json_encoders": {
                "datetime": lambda v: v.isoformat()
            }
        }
```

### 10.2 Pydantic v2 配置```python
from pydantic import ConfigDict, BaseModel

class User(BaseModel):
    name: str
    age: int

    model_config = ConfigDict(
        # 基本配置
        validate_assignment=True,
        extra='forbid',
        frozen=True,
        
        # JSON 配置
        json_schema_extra={
            "examples": [
                {
                    "name": "John",
                    "age": 25
                }
            ]
        }
    )
```

### 10.3 环境变量配置```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    app_name: str = "My App"
    admin_email: str
    items_per_user: int = 50
    database_url: str = "sqlite:///./sql_app.db"

    class Config:
        env_file = ".env"
        env_file_encoding = 'utf-8'

# 使用
settings = Settings()
```

---

## 11. 继承与混合

### 11.1 基本继承```python
from pydantic import BaseModel

class BaseUser(BaseModel):
    id: int
    name: str

class User(BaseUser):
    email: str
    age: int

class AdminUser(User):
    is_admin: bool = True
    permissions: List[str] = []
```

### 11.2 Mixin 混合```python
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class TimestampMixin:
    created_at: datetime
    updated_at: Optional[datetime] = None

class SoftDeleteMixin:
    is_deleted: bool = False
    deleted_at: Optional[datetime] = None

class User(TimestampMixin, SoftDeleteMixin, BaseModel):
    id: int
    name: str
    email: str
```

### 11.3 抽象基类```python
from abc import ABC, abstractmethod
from pydantic import BaseModel

class AbstractBase(ABC, BaseModel):
    @abstractmethod
    def validate(self) -> bool:
        pass

class User(AbstractBase):
    name: str
    age: int

    def validate(self) -> bool:
        return self.age >= 0
```

---

## 12. 泛型模型

### 12.1 基本泛型```python
from pydantic import BaseModel
from typing import TypeVar, Generic, List

T = TypeVar('T')

class Response(BaseModel, Generic[T]):
    code: int
    message: str
    data: T

class User(BaseModel):
    id: int
    name: str

# 使用泛型
user_response = Response[User](
    code=200,
    message="success",
    data=User(id=1, name="John")
)

users_response = Response[List[User]](
    code=200,
    message="success",
    data=[User(id=1, name="John"), User(id=2, name="Jane")]
)
```

### 12.2 分页响应```python
from pydantic import BaseModel
from typing import TypeVar, Generic, List

T = TypeVar('T')

class PaginatedResponse(BaseModel, Generic[T]):
    items: List[T]
    total: int
    page: int
    page_size: int
    has_next: bool

class User(BaseModel):
    id: int
    name: str

# 使用分页响应
users = PaginatedResponse[User](
    items=[User(id=1, name="John")],
    total=100,
    page=1,
    page_size=10,
    has_next=True
)
```

---

## 13. API 请求模型

### 13.1 创建请求模型```python
from pydantic import BaseModel, Field, EmailStr
from typing import Optional

class UserCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=50)
    email: EmailStr
    password: str = Field(..., min_length=8)
    age: Optional[int] = Field(None, gt=0, lt=150)

class UserUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=50)
    email: Optional[EmailStr] = None
    age: Optional[int] = Field(None, gt=0, lt=150)
```

### 13.2 登录请求```python
from pydantic import BaseModel, Field, EmailStr

class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8)

class RegisterRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=50)
    email: EmailStr
    password: str = Field(..., min_length=8)
    password_confirm: str
```

### 13.3 搜索请求```python
from pydantic import BaseModel, Field
from typing import Optional, List

class SearchRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=100)
    filters: Optional[dict] = None
    page: int = Field(1, ge=1)
    page_size: int = Field(10, ge=1, le=100)
    sort_by: Optional[str] = None
    sort_order: Optional[str] = Field("asc", pattern="^(asc|desc)$")
```

---

## 14. API 响应模型

### 14.1 基本响应```python
from pydantic import BaseModel
from typing import Optional, Any

class SuccessResponse(BaseModel):
    code: int = 200
    message: str = "success"
    data: Optional[Any] = None

class ErrorResponse(BaseModel):
    code: int
    message: str
    detail: Optional[str] = None
```

### 14.2 用户响应```python
from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class UserResponse(BaseModel):
    id: int
    name: str
    email: str
    age: Optional[int] = None
    is_active: bool = True
    created_at: datetime

class UserListResponse(BaseModel):
    users: List[UserResponse]
    total: int
    page: int
    page_size: int
```

### 14.3 分页响应```python
from pydantic import BaseModel
from typing import TypeVar, Generic, List

T = TypeVar('T')

class PaginatedResponse(BaseModel, Generic[T]):
    items: List[T]
    total: int
    page: int
    page_size: int
    has_next: bool
    has_prev: bool
```

---

## 15. 数据库模型

### 15.1 SQLAlchemy 模型```python
from sqlalchemy import Column, Integer, String, Boolean, DateTime
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime

Base = declarative_base()

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
```

### 15.2 Pydantic 模型转换```python
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

# 数据库模型
class UserDB(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    name = Column(String)
    email = Column(String)

# Pydantic 模型
class UserBase(BaseModel):
    name: str
    email: str

class UserCreate(UserBase):
    password: str

class UserResponse(UserBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True  # Pydantic v2
```

---

## 16. 配置管理

### 16.1 使用 pydantic-settings```python
from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    # 应用配置
    app_name: str = "My FastAPI App"
    app_version: str = "1.0.0"
    debug: bool = False
    
    # 数据库配置
    database_url: str = "sqlite:///./sql_app.db"
    database_echo: bool = False
    
    # 安全配置
    secret_key: str
    access_token_expire_minutes: int = 30
    
    # 外部服务
    redis_url: Optional[str] = None
    smtp_server: Optional[str] = None
    
    class Config:
        env_file = ".env"
        env_file_encoding = 'utf-8'
        case_sensitive = False

# 使用
settings = Settings()
```

### 16.2 环境变量文件```bash
# .env
APP_NAME=My FastAPI App
SECRET_KEY=your-secret-key-here
DATABASE_URL=postgresql://user:password@localhost/dbname
REDIS_URL=redis://localhost:6379
```

### 16.3 多环境配置```python
from pydantic_settings import BaseSettings
from typing import Optional

class DevelopmentSettings(BaseSettings):
    debug: bool = True
    database_url: str = "sqlite:///./dev.db"

class ProductionSettings(BaseSettings):
    debug: bool = False
    database_url: str

class TestingSettings(BaseSettings):
    debug: bool = True
    database_url: str = "sqlite:///./test.db"

def get_settings():
    import os
    env = os.getenv("ENVIRONMENT", "development")
    
    if env == "production":
        return ProductionSettings()
    elif env == "testing":
        return TestingSettings()
    else:
        return DevelopmentSettings()
```

---

## 🎯 下一步学习

### 推荐资源
- [Pydantic 官方文档](https://docs.pydantic.dev/)
- [Pydantic V2 迁移指南](https://docs.pydantic.dev/latest/migration/)
- [FastAPI 数据验证](https://fastapi.tiangolo.com/tutorial/body-validation/)

### 进阶主题
- 自定义类型
- 数据迁移
- 性能优化
- 测试策略

---

## 📝 笔记区

> 在这里记录你的学习笔记和心得

### 常用代码片段```python
# 快速创建模型
from pydantic import BaseModel

class User(BaseModel):
    id: int
    name: str
    email: str

# 验证数据
user = User(**{"id": 1, "name": "John", "email": "john@example.com"})

# 转换为字典
user_dict = user.dict()

# 转换为 JSON
user_json = user.json()
```

### 常见问题
1. **验证错误**：检查字段类型和约束
2. **序列化问题**：检查 Config 配置
3. **性能问题**：使用 `model_validate` 代替 `parse_obj`

---

*最后更新：2026年6月27日*

#Pydantic #Python #数据验证 #FastAPI #类型安全
