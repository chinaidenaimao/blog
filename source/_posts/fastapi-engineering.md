---
title: "FastAPI 工程化封装：分层、依赖与统一响应"
date: 2026-01-18 21:00:00
cover: /img/covers/team.jpg
top_img: /img/covers/team.jpg
description: "分层架构 · 全局异常处理 · 统一响应结构 · 依赖注入 · 中间件 · 配置管理 · 日志 · 鉴权 · 分模块分层 标杆来源：fastapi-best-a…"
categories:
  - 后端
tags:
  - FastAPI
  - 工程化
  - 架构
---

> **📋 摘要：本页覆盖**
> 分层架构 · 全局异常处理 · 统一响应结构 · 依赖注入 · 中间件 · 配置管理 · 日志 · 鉴权 · 分模块分层
> 标杆来源：[fastapi-best-architecture](https://github.com/fastapi-practices/fastapi-best-architecture)（2,584⭐）、
> [full-stack-fastapi-template](https://github.com/fastapi/full-stack-fastapi-template)（46,008⭐）、
> [fastapi-best-practices](https://github.com/zhanymkanov/fastapi-best-practices)（18,194⭐）

---

## 1. 分层架构：FastAPI 到底该怎么分层

### 1.1 三层架构（fastapi-best-architecture 的官方对照表）

> **💬 引用：原文摘录**
> 「mvc 架构作为常规设计模式，在 python web 中很常见，但是三层架构更令人着迷」
> 「我们并没有传统的多 app（微服务）目录结构（django、springBoot...），而是自以为是的目录结构」

该 README 直接给出了 Java ↔ FastAPI 的分层对照：

| 工作流程 | Java | fastapi-best-architecture |
|---|---|---|
| 视图 | controller | `api` |
| 数据传输 | dto | `schema` |
| 业务逻辑 | service + impl | `service` |
| 数据访问 | dao / mapper | `crud` |
| 模型 | model / entity | `model` |

> **💡 提示：为什么这个映射值得照抄**
> 它让「Java 转 Python」和「Python 转 Java」的工程师能在同一套词汇下沟通，
> 也让分层边界有了行业公认的判定标准：**跨层调用 = 架构违规**。

### 1.2 五种主流目录结构的实测对比

| 结构类型 | 代表项目 | Star | 特征 | 评价 |
|---|---|---:|---|---|
| **扁平单包** | 多数教程 | — | `main.py` + `routers/` + `models.py` | ❌ 超过 20 个接口即失控 |
| **官方模板式** | full-stack-fastapi-template | 46,008 | `app/{api,core,models,crud,utils}` | ✅ 规范，但业务增长后 `api/` 会膨胀 |
| **三层架构式** | fastapi-best-architecture | 2,584 | `backend/{app,common,core,database,middleware,plugin,utils}` | ✅✅ **企业级首选** |
| **按域分包式** | fastapi-best-practices 推荐 | 18,194 | `src/{auth,posts,profiles}/{router,schemas,service,dependencies}.py` | ✅✅ 域内高内聚，适合中大型 |
| **控制器式** | vue-fastapi-admin | 2,270 | `app/{api/v1,controllers,models,schemas,settings,utils}` | ✅ 简单直观，适合中小 |

### 1.3 推荐：三层架构 + 按域分包（融合两者）```backend/
├── main.py                     # 仅做应用装配，不写业务
├── app/
│   ├── router.py               # 聚合所有模块路由
│   └── <domain>/               # 每个业务域一个包
│       ├── router.py           # 视图层（等价 Java controller）
│       ├── schema.py           # 传输层（等价 Java dto/vo）
│       ├── service.py          # 业务层（等价 Java service）
│       ├── crud.py             # 数据层（等价 Java dao/mapper）
│       ├── model.py            # 实体层（等价 Java entity）
│       ├── dependencies.py     # 该域专属依赖
│       └── constants.py        # 该域枚举与常量
├── common/                     # 跨域共享的「技术能力」
│   ├── exception/              # 异常体系
│   ├── response/               # 统一响应
│   ├── security/               # JWT / RBAC / 权限
│   ├── context.py              # ContextVar 请求上下文
│   ├── log.py                  # 日志
│   ├── pagination.py           # 分页
│   └── enums.py / dataclasses.py / model.py
├── core/                       # 「框架装配」
│   ├── conf.py                 # 配置（pydantic-settings）
│   ├── registrar.py            # 组件注册器
│   └── path_conf.py            # 路径常量
├── database/
│   ├── db.py                   # engine / session 工厂
│   └── redis.py                # Redis 客户端
├── middleware/                 # 中间件
├── plugin/                     # 可插拔模块（可选，见 §11）
├── utils/                      # 无状态工具函数
├── locale/                     # i18n 词条
├── alembic/                    # 迁移
├── tests/
└── .env.example
```

> **📝 说明：fastapi-best-architecture 的真实顶层目录（API 实测）**
> ```
> backend/
> ├── app/           # router.py + admin/ + task/
> ├── common/        # cache, context, dataclasses, enums, exception/, i18n, lifespan,
> │                  # limiter, log, model, observability/, pagination, queue,
> │                  # response/, schema, security/, socketio/
> ├── core/          # conf.py, path_conf.py, registrar.py
> ├── database/      # db.py, redis.py
> ├── middleware/    # access_, i18n_, jwt_auth_, opera_log_, state_middleware.py
> ├── plugin/        # code_generator, config, dict, email, notice, oauth2（各带 plugin.toml）
> ├── utils/         # 28 个工具模块（含 trace_id.py, snowflake.py, serializers.py）
> ├── locale/  scripts/  static/  tests/
> ```

---

## 2. 配置管理

### 2.1 标杆做法：`pydantic-settings` + 敏感值强校验

`full-stack-fastapi-template` 的 `backend/app/core/config.py` 是官方答案，有两个值得学的细节：

**细节 1：用 `computed_field` 派生配置，而不是重复声明**

```python
@computed_field
@property
def emails_enabled(self) -> bool:
    return bool(self.SMTP_HOST and self.EMAILS_FROM_EMAIL)
```

**细节 2：启动即校验「默认密钥未改」——把安全事故挡在上线前**

```python
def _check_default_secret(self, var_name: str, value: str | None) -> None:
    if value == "changethis":
        message = (
            f'The value of {var_name} is "changethis", '
            "for security, please change it, at least for deployments."
        )
        if self.FASTAPI_ENV == "development":
            warnings.warn(message, stacklevel=1)
        else:
            raise ValueError(message)      # 生产环境直接启动失败

@model_validator(mode="after")
def _enforce_non_default_secrets(self) -> Self:
    self._check_default_secret("SECRET_KEY", self.SECRET_KEY)
    self._check_default_secret("FIRST_SUPERUSER_PASSWORD", self.FIRST_SUPERUSER_PASSWORD)
    return self
```

### 2.2 落地实现：分层配置 + 多环境```python
# core/conf.py
from functools import lru_cache
from typing import Literal

from pydantic import AnyHttpUrl, Field, PostgresDsn, computed_field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """全局配置：按「关注点」分组，而不是平铺"""

    model_config = SettingsConfigDict(
        env_file=(".env", f".env.{__import__('os').getenv('APP_ENV', 'development')}"),
        env_file_encoding="utf-8",
        env_ignore_empty=True,
        extra="ignore",
        case_sensitive=False,
    )

    # ---- 应用 ----
    APP_ENV: Literal["development", "testing", "production"] = "development"
    APP_NAME: str = "FastAPI Admin"
    APP_DEBUG: bool = False
    APP_VERSION: str = "1.0.0"
    APP_ROOT_PATH: str = ""

    # ---- API ----
    API_V1_PREFIX: str = "/api/v1"
    CORS_ORIGINS: list[AnyHttpUrl] = Field(default_factory=list)
    CORS_ALLOW_CREDENTIALS: bool = True

    # ---- 安全 ----
    SECRET_KEY: str = Field(..., min_length=32)
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24
    REFRESH_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7
    JWT_ALGORITHM: str = "HS256"
    PASSWORD_BCRYPT_ROUNDS: int = 12

    # ---- 数据库 ----
    DB_URL: PostgresDsn | None = None
    DB_POOL_SIZE: int = 20
    DB_MAX_OVERFLOW: int = 10
    DB_ECHO: bool = False

    # ---- Redis ----
    REDIS_URL: str = "redis://127.0.0.1:6379/0"

    # ---- 日志 ----
    LOG_LEVEL: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = "INFO"
    LOG_JSON: bool = False

    # ---- 限流 ----
    RATE_LIMIT_ENABLED: bool = True
    RATE_LIMIT_DEFAULT: str = "200/minute"

    @computed_field
    @property
    def is_prod(self) -> bool:
        return self.APP_ENV == "production"

    @computed_field
    @property
    def sync_db_url(self) -> str:
        """Alembic 等同步场景需要 psycopg 驱动"""
        return str(self.DB_URL).replace("postgresql+asyncpg://", "postgresql://")

    @model_validator(mode="after")
    def _guard_production(self) -> "Settings":
        if self.is_prod:
            if self.APP_DEBUG:
                raise ValueError("生产环境不允许开启 APP_DEBUG")
            if self.SECRET_KEY.startswith("dev-") or len(set(self.SECRET_KEY)) < 10:
                raise ValueError("生产环境 SECRET_KEY 强度不足")
            if not self.CORS_ORIGINS:
                raise ValueError("生产环境必须显式配置 CORS_ORIGINS")
        return self


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
```

> **💡 提示：`@lru_cache` 的意义**
> 配置只在**首次调用**时解析并校验一次，之后复用同一实例。
> 这也让 `get_settings` 可以作为 FastAPI 依赖被覆盖（测试时 `app.dependency_overrides[get_settings] = ...`）。

### 2.3 落地建议

- ✅ 用 `Literal[...]` 约束枚举型配置（`APP_ENV`），拼错会在启动时报错。
- ✅ 用 `computed_field` 派生配置，避免同一事实写两遍。
- ✅ **生产环境的危险配置一律 `raise ValueError`**，不要只打 warning。
- ✅ `.env.example` 提交到仓库，`.env` 加 `.gitignore`。
- ⚠️ `pydantic-settings` 的 `env_file` 是**列表**，后者覆盖前者——利用这个实现「基础 + 环境覆盖」。

---

## 3. 统一响应结构

### 3.1 两种流派

| 流派 | 响应体 | 优点 | 缺点 |
|---|---|---|---|
| **裸响应**（官方模板） | 直接返回业务对象，靠 HTTP 状态码表意 | 符合 REST、OpenAPI 干净 | 前端需区分「HTTP 错误」和「业务错误」 |
| **包装响应**（FBA / vue-fastapi-admin / 国内主流） | `{code, msg, data}` | 前端拦截器统一处理、业务码可扩展 | 需要额外处理 HTTP 状态与业务码的映射 |

> **💡 提示：建议**
> **对内部中后台**用包装响应（前端拦截器好写，02-前端工程化封装-Vue#2. 响应拦截器 依赖它）；
> **对外 Open API** 用裸响应 + HTTP 状态码。
> 二者可共存：加一个 `/api/v1/open/*` 前缀走裸响应。

### 3.2 落地实现```python
# common/response/response_code.py
from enum import IntEnum


class ResponseCode(IntEnum):
    """业务码规范：前 3 位对齐 HTTP 状态，后 2 位为业务细分"""
    SUCCESS = 200

    # 4xx 客户端
    PARAMS_ERROR = 40000
    UNAUTHORIZED = 40100
    TOKEN_EXPIRED = 40101
    TOKEN_INVALID = 40102
    FORBIDDEN = 40300
    PERMISSION_DENIED = 40301
    NOT_FOUND = 40400
    METHOD_NOT_ALLOWED = 40500
    TOO_MANY_REQUESTS = 42900

    # 5xx 服务端
    INTERNAL_ERROR = 50000
    SERVICE_UNAVAILABLE = 50300

    # 1xxxx 业务域（按模块划分段）
    USER_NOT_EXIST = 10001
    USER_PASSWORD_ERROR = 10002
    USER_DISABLED = 10003
    USERNAME_EXISTS = 10004
```

```python
# common/response/response_schema.py
from typing import Generic, TypeVar

from pydantic import BaseModel, Field

from common.response.response_code import ResponseCode

DataT = TypeVar("DataT")


class ResponseModel(BaseModel, Generic[DataT]):
    """统一响应结构：泛型保证 OpenAPI 能推导出 data 的真实类型"""
    code: int = Field(default=ResponseCode.SUCCESS, description="业务状态码")
    msg: str = Field(default="success", description="提示信息")
    data: DataT | None = Field(default=None, description="业务数据")

    @classmethod
    def ok(cls, data: DataT | None = None, msg: str = "success") -> "ResponseModel[DataT]":
        return cls(code=ResponseCode.SUCCESS, msg=msg, data=data)

    @classmethod
    def fail(cls, code: ResponseCode | int, msg: str | None = None) -> "ResponseModel[None]":
        return cls(code=int(code), msg=msg or "操作失败", data=None)


class PageResult(BaseModel, Generic[DataT]):
    """统一分页结构：与前端 PageResult<T> 一一对应"""
    page: int = Field(description="当前页，从 1 开始")
    page_size: int = Field(description="每页条数")
    total: int = Field(description="总条数")
    list: list[DataT] = Field(default_factory=list, description="数据列表")

    @property
    def pages(self) -> int:
        return (self.total + self.page_size - 1) // self.page_size if self.page_size else 0
```

```python
# app/system/user/router.py
from typing import Annotated
from fastapi import APIRouter, Depends, Query

from common.response.response_schema import PageResult, ResponseModel
from app.system.user.schema import UserQuery, UserRespVO
from app.system.user.service import UserService

router = APIRouter(prefix="/system/users", tags=["系统管理-用户"])


@router.get("", response_model=ResponseModel[PageResult[UserRespVO]], summary="用户分页列表")
async def list_users(
    query: Annotated[UserQuery, Query()],
    service: Annotated[UserService, Depends()],
):
    page = await service.list_users(query)
    return ResponseModel.ok(page)


@router.get("/{user_id}", response_model=ResponseModel[UserRespVO], summary="用户详情")
async def get_user(user_id: int, service: Annotated[UserService, Depends()]):
    return ResponseModel.ok(await service.get_user(user_id))
```

### 3.3 进阶：自动包装，业务层只返回裸数据

手动 `ResponseModel.ok(...)` 写多了很啰嗦。可以用自定义 `APIRoute` 自动包装：

```python
# common/response/auto_route.pyimport json
from collections.abc import Callable

from fastapi import Request, Response
from fastapi.routing import APIRoute

from common.response.response_schema import ResponseModel


class WrappedRoute(APIRoute):
    """自动把路由返回值包装成 ResponseModel"""

    def get_route_handler(self) -> Callable:
        original = super().get_route_handler()

        async def wrapper(request: Request) -> Response:
            response: Response = await original(request)
            # 文件流 / 已包装过 / 非 JSON 一律放行
            if response.headers.get("content-type", "").startswith(("application/octet-stream", "image/")):
                return response
            if response.status_code >= 400:
                return response
            body = json.loads(response.body)
            if isinstance(body, dict) and {"code", "msg", "data"} <= body.keys():
                return response          # 已经是标准结构
            wrapped = ResponseModel.ok(data=body)
            return Response(
                content=wrapped.model_dump_json(),
                media_type="application/json",
                status_code=response.status_code,
            )

        return wrapper
```

```python
# 使用：给需要自动包装的路由组挂上
router = APIRouter(prefix="/system/users", route_class=WrappedRoute)

@router.get("/{user_id}")
async def get_user(user_id: int, service: Annotated[UserService, Depends()]):
    return await service.get_user(user_id)   # 直接返回裸对象
```

### 3.4 落地建议

- ✅ 业务码**分段管理**（4xxxx 客户端、5xxxx 服务端、1xxxx 起业务域），避免全局冲突。
- ✅ `ResponseModel` 必须写成**泛型**，否则 OpenAPI 里 `data` 永远是 `any`，前端自动生成类型就废了。
- ✅ 分页结构固定为 `{page, page_size, total, list}` 并与前端 `PageResult<T>` 对齐。
- ⚠️ 自动包装要**显式排除**文件流、SSE、重定向，否则会破坏二进制响应。
- ⚠️ 自动包装会与 `response_model` 的类型推导打架，二选一，别同时用。

---

## 4. 全局异常处理

### 4.1 标杆做法

`fastapi-best-architecture` 的异常模块非常清晰：

```
backend/common/exception/
├── errors.py                 # 异常类定义
└── exception_handler.py      # 处理器注册
```

### 4.2 落地实现：异常体系```python
# common/exception/errors.py
from typing import Any

from common.response.response_code import ResponseCode


class AppException(Exception):
    """所有业务异常的基类：携带「业务码 + HTTP 状态 + 消息 + 上下文」"""

    code: int = int(ResponseCode.INTERNAL_ERROR)
    msg: str = "服务器内部错误"
    http_status: int = 500

    def __init__(
        self,
        msg: str | None = None,
        *,
        code: int | None = None,
        http_status: int | None = None,
        data: Any = None,
    ) -> None:
        self.msg = msg or self.msg
        self.code = code if code is not None else self.code
        self.http_status = http_status if http_status is not None else self.http_status
        self.data = data
        super().__init__(self.msg)


# ---- 客户端异常（4xx）----
class ClientException(AppException):
    http_status = 400
    code = int(ResponseCode.PARAMS_ERROR)


class UnauthorizedException(ClientException):
    http_status = 401
    code = int(ResponseCode.UNAUTHORIZED)
    msg = "未认证或登录已过期"


class TokenExpiredException(UnauthorizedException):
    code = int(ResponseCode.TOKEN_EXPIRED)
    msg = "登录已过期，请重新登录"


class ForbiddenException(ClientException):
    http_status = 403
    code = int(ResponseCode.FORBIDDEN)
    msg = "没有权限访问该资源"


class NotFoundException(ClientException):
    http_status = 404
    code = int(ResponseCode.NOT_FOUND)
    msg = "请求的资源不存在"


# ---- 服务端异常（5xx）----
class ServerException(AppException):
    http_status = 500
    code = int(ResponseCode.INTERNAL_ERROR)
    msg = "服务器内部错误"


# ---- 业务异常（示例：按域细分）----
class UserNotFoundException(ClientException):
    http_status = 404
    code = int(ResponseCode.USER_NOT_EXIST)
    msg = "用户不存在"


class PasswordErrorException(ClientException):
    http_status = 400
    code = int(ResponseCode.USER_PASSWORD_ERROR)
    msg = "用户名或密码错误"


class UserDisabledException(ForbiddenException):
    code = int(ResponseCode.USER_DISABLED)
    msg = "账号已被停用，请联系管理员"
```

### 4.3 落地实现：处理器注册```python
# common/exception/exception_handler.py
import logging

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from starlette.exceptions import HTTPException as StarletteHTTPException

from common.exception.errors import AppException
from common.response.response_code import ResponseCode
from common.response.response_schema import ResponseModel

logger = logging.getLogger(__name__)


def _payload(request: Request, code: int, msg: str, data=None) -> JSONResponse:
    """统一构造错误响应，并回写 trace_id 便于日志关联"""
    body = ResponseModel(code=code, msg=msg, data=data)
    return JSONResponse(
        status_code=getattr(request.state, "http_status", None) or 200,
        content=body.model_dump(),
        headers={"X-Request-Id": getattr(request.state, "trace_id", "-")},
    )


def register_exception_handlers(app: FastAPI) -> None:

    # ---------- 1) 业务异常：预期内的错误 ----------
    @app.exception_handler(AppException)
    async def _app_exception_handler(request: Request, exc: AppException):
        trace_id = getattr(request.state, "trace_id", "-")
        # 4xx 是预期行为，用 warning；5xx 是故障，用 error
        log = logger.warning if exc.http_status < 500 else logger.error
        log("[%s] %s %s -> %s(%s): %s",
            trace_id, request.method, request.url.path,
            exc.__class__.__name__, exc.code, exc.msg)

        return JSONResponse(
            status_code=exc.http_status,
            content=ResponseModel(code=exc.code, msg=exc.msg, data=exc.data).model_dump(),
            headers={"X-Request-Id": trace_id},
        )

    # ---------- 2) 参数校验失败：转成统一结构 ----------
    @app.exception_handler(RequestValidationError)
    async def _validation_handler(request: Request, exc: RequestValidationError):
        errors = []
        for e in exc.errors():
            # loc 形如 ("body", "username")，去掉首段更贴合前端表单字段名
            field = ".".join(str(x) for x in e["loc"][1:]) or "body"
            errors.append({"field": field, "message": e["msg"], "type": e["type"]})

        trace_id = getattr(request.state, "trace_id", "-")
        logger.warning("[%s] 参数校验失败 %s %s: %s", trace_id, request.method, request.url.path, errors)

        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content=ResponseModel(
                code=int(ResponseCode.PARAMS_ERROR),
                msg=errors[0]["message"] if errors else "参数校验失败",
                data=errors,
            ).model_dump(),
            headers={"X-Request-Id": trace_id},
        )

    # ---------- 3) HTTPException：保留语义，统一结构 ----------
    @app.exception_handler(StarletteHTTPException)
    async def _http_handler(request: Request, exc: StarletteHTTPException):
        return JSONResponse(
            status_code=exc.status_code,
            content=ResponseModel(code=exc.status_code * 100, msg=str(exc.detail), data=None).model_dump(),
        )

    # ---------- 4) 数据库异常：不要把 SQL 暴露给前端 ----------
    @app.exception_handler(IntegrityError)
    async def _integrity_handler(request: Request, exc: IntegrityError):
        trace_id = getattr(request.state, "trace_id", "-")
        logger.error("[%s] 数据完整性冲突: %s", trace_id, exc.orig)
        # 唯一索引冲突对用户是「可理解的业务错误」
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content=ResponseModel(
                code=int(ResponseCode.PARAMS_ERROR),
                msg="数据已存在或违反唯一性约束",
            ).model_dump(),
        )

    @app.exception_handler(SQLAlchemyError)
    async def _db_handler(request: Request, exc: SQLAlchemyError):
        trace_id = getattr(request.state, "trace_id", "-")
        logger.exception("[%s] 数据库异常", trace_id)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=ResponseModel(
                code=int(ResponseCode.INTERNAL_ERROR),
                msg="数据处理失败，请稍后重试",
            ).model_dump(),
        )

    # ---------- 5) 兜底：任何未捕获异常 ----------
    @app.exception_handler(Exception)
    async def _unhandled_handler(request: Request, exc: Exception):
        trace_id = getattr(request.state, "trace_id", "-")
        logger.exception("[%s] 未捕获异常 %s %s", trace_id, request.method, request.url.path)
        # 生产环境绝不返回堆栈
        detail = f"（追踪号：{trace_id}）" if not request.app.state.settings.APP_DEBUG else f"{exc!r}"
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=ResponseModel(
                code=int(ResponseCode.INTERNAL_ERROR),
                msg=f"服务器内部错误{detail}",
            ).model_dump(),
        )
```

### 4.4 落地建议

- ✅ **异常即文档**：`UserNotFoundException` 比 `raise HTTPException(404, "用户不存在")` 可读得多，且能被全局搜索。
- ✅ 每个业务异常**固定一个业务码**，前端可据此做差异化处理（如 `10003` 账号停用 → 弹专门提示）。
- ✅ 4xx 记 `warning`，5xx 记 `error` + `logger.exception`（带堆栈）——日志级别用错会让告警失效。
- ✅ 校验错误要把 `errors` 数组返回给前端，前端可精确定位到表单字段（注意剥掉 `loc` 的首段）。
- ✅ 生产环境错误信息只回传 **trace_id**，不回传堆栈。
- ⚠️ `@app.exception_handler(Exception)` **不会**捕获中间件内部的异常（Starlette 的 `ServerErrorMiddleware` 在最外层）。中间件里必须自己 try/except。
- ⚠️ 用 `BaseHTTPMiddleware` 时，异常会穿过它；用纯 ASGI 中间件要注意别吞掉异常。

---

## 5. 依赖注入（Depends）

> **💬 引用：fastapi-best-practices 的核心观点**
> 「Dependency calls are cached」——同一请求内，同一个依赖只执行一次，可以放心地层层复用。

### 5.1 官方模板的范式：`Annotated` 类型别名```python
# backend/app/api/deps.py（官方模板真实代码节选）
from collections.abc import Generator
from typing import Annotated

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jwt.exceptions import InvalidTokenError
from pydantic import ValidationError
from sqlmodel import Session

reusable_oauth2 = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_STR}/login/access-token")


def get_db() -> Generator[Session]:
    with Session(engine) as session:
        yield session


SessionDep = Annotated[Session, Depends(get_db)]
TokenDep = Annotated[str, Depends(reusable_oauth2)]


def get_current_user(session: SessionDep, token: TokenDep) -> User:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[security.ALGORITHM])
        token_data = TokenPayload(**payload)
    except (InvalidTokenError, ValidationError):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Could not validate credentials")
    user = session.get(User, token_data.sub)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]
```

> **💡 提示：为什么要写 `SessionDep = Annotated[Session, Depends(get_db)]`**
> 1. **可复用**：`SessionDep` 出现在几十个签名里，改一次 `get_db` 全局生效；
> 2. **可覆盖**：测试里 `app.dependency_overrides[get_db]` 直接换成测试库；
> 3. **类型安全**：IDE 能推导出 `session` 是 `Session`，而不是 `Any`。

### 5.2 依赖的四种形态```python
# app/system/user/dependencies.py

# ---- 形态 1：函数依赖（最常用）----
async def get_user_service(session: SessionDep) -> UserService:
    return UserService(session)


UserServiceDep = Annotated[UserService, Depends(get_user_service)]


# ---- 形态 2：类依赖（FastAPI 会自动注入 __init__ 的参数）----
class Pagination:
    def __init__(
        self,
        page: Annotated[int, Query(ge=1)] = 1,
        page_size: Annotated[int, Query(ge=1, le=200)] = 20,
    ) -> None:
        self.page = page
        self.page_size = page_size
        self.offset = (page - 1) * page_size


PaginationDep = Annotated[Pagination, Depends(Pagination)]


# ---- 形态 3：权限依赖工厂（返回依赖函数）----
def require_permission(*codes: str, mode: Literal["all", "any"] = "all"):
    """用法：Depends(require_permission("system:user:create"))"""
    async def _checker(current_user: CurrentUser) -> User:
        if current_user.is_superuser:
            return current_user
        owned = set(current_user.permissions)
        ok = set(codes) <= owned if mode == "all" else bool(set(codes) & owned)
        if not ok:
            raise ForbiddenException(f"缺少权限：{', '.join(codes)}")
        return current_user

    return _checker


RequireUserCreate = Annotated[User, Depends(require_permission("system:user:create"))]
RequireUserDelete = Annotated[User, Depends(require_permission("system:user:delete"))]


# ---- 形态 4：链式依赖（依赖的依赖）----
async def get_current_active_user(current_user: CurrentUser) -> User:
    if not current_user.is_active:
        raise UserDisabledException()
    return current_user


CurrentActiveUser = Annotated[User, Depends(get_current_active_user)]
```

```python
# 路由中使用：签名即文档
@router.post("", response_model=ResponseModel[UserRespVO])
async def create_user(
    data: UserCreateReq,
    service: UserServiceDep,
    _: RequireUserCreate,          # 只做权限校验，不用返回值
    operator: CurrentActiveUser,   # 需要当前用户
):
    return ResponseModel.ok(await service.create(data, operator_id=operator.id))
```

### 5.3 落地建议

- ✅ **统一用 `Annotated[X, Depends(...)]` + 类型别名**，别在参数默认值里写 `= Depends(...)`（官方模板已迁移到前者）。
- ✅ 依赖只做「获取/校验/组装」，**不写业务逻辑**。
- ✅ 优先写 `async def` 依赖；必须用同步阻塞 SDK 时，FastAPI 会自动丢到线程池。
- ✅ 权限用**依赖工厂**（`require_permission("...")`），比在每个路由里 `if not user.has(...)` 干净得多。
- ✅ 测试里用 `app.dependency_overrides` 替换依赖，不用 mock 全局对象。
- ⚠️ `yield` 依赖的清理逻辑在**响应发送之后**执行；若要保证「请求结束前完成」，用 `BackgroundTasks` 或中间件。

---

## 6. 中间件

### 6.1 标杆做法：FBA 的五个中间件，各司其职

| 文件 | 职责 | 关键点 |
|---|---|---|
| `middleware/state_middleware.py` | 把请求上下文写进 `request.state` | 供后续中间件与处理器读取 |
| `middleware/jwt_auth_middleware.py` | JWT 认证 | 与依赖式鉴权二选一 |
| `middleware/access_middleware.py` | 访问日志 | 记录 IP / UA / 耗时 |
| `middleware/opera_log_middleware.py` | 操作日志 | 写库，用于审计 |
| `middleware/i18n_middleware.py` | 国际化 | 按 `Accept-Language` 切换词条 |

> **💡 提示：中间件 vs 依赖，怎么选？**
> | | 中间件 | 依赖 |
> |---|---|---|
> | 作用范围 | **所有**请求（含未匹配路由） | 仅声明了它的路由 |
> | 能否访问路由信息 | 需要自己解析 | 天然有 |
> | 适合 | trace_id、CORS、GZip、访问日志、限流 | 鉴权、DB session、分页、权限 |
>
> **结论**：横切**基础设施**用中间件；**业务上下文**（当前用户、DB）用依赖。

### 6.2 落地实现：TraceId 中间件（最高性价比）```python
# common/context.py
from contextvars import ContextVar

# ContextVar 在 async 环境下是「请求级」的，天然隔离并发
request_id_ctx: ContextVar[str] = ContextVar("request_id", default="-")
current_user_id_ctx: ContextVar[int | None] = ContextVar("current_user_id", default=None)
```

```python
# middleware/trace_middleware.pyimport timeimport uuid

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from common.context import request_id_ctx

# 允许前端透传，实现「前端一次点击 → 后端全链路」串联
TRACE_HEADER = "X-Request-Id"


class TraceMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        trace_id = request.headers.get(TRACE_HEADER) or uuid.uuid4().hex
        token = request_id_ctx.set(trace_id)
        request.state.trace_id = trace_id

        start = time.perf_counter()
        try:
            response = await call_next(request)
        finally:
            cost_ms = (time.perf_counter() - start) * 1000
            request_id_ctx.reset(token)

        response.headers[TRACE_HEADER] = trace_id
        response.headers["X-Process-Time-Ms"] = f"{cost_ms:.2f}"
        return response
```

```python
# middleware/access_log_middleware.py
import logging
import time

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

from common.context import request_id_ctx

logger = logging.getLogger("app.access")

# 这些路径太吵，不打日志
SKIP_PATHS = {"/health", "/metrics", "/favicon.ico", "/docs", "/openapi.json"}


class AccessLogMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if request.url.path in SKIP_PATHS:
            return await call_next(request)

        start = time.perf_counter()
        response = await call_next(request)
        cost_ms = (time.perf_counter() - start) * 1000

        # 优先信任反向代理写入的 X-Forwarded-For 首个地址
        xff = request.headers.get("x-forwarded-for")
        client_ip = xff.split(",")[0].strip() if xff else (request.client.host if request.client else "-")

        logger.info(
            "[%s] %s %s %s -> %s %.1fms ua=%s",
            request_id_ctx.get(), client_ip, request.method, request.url.path,
            response.status_code, cost_ms, request.headers.get("user-agent", "-")[:60],
        )
        return response
```

### 6.3 应用装配（`main.py` 只做装配）```python
# main.py
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.routing import APIRoute

from app.router import api_router
from common.exception.exception_handler import register_exception_handlers
from common.log import setup_logging
from core.conf import settings
from database.db import close_db, init_db
from middleware.access_log_middleware import AccessLogMiddleware
from middleware.trace_middleware import TraceMiddleware


@asynccontextmanager
async def lifespan(app: FastAPI):
    """替代已废弃的 @app.on_event，把启动/关闭逻辑集中一处"""
    setup_logging()
    await init_db()
    yield
    await close_db()


def custom_generate_unique_id(route: APIRoute) -> str:
    """让前端生成的 SDK 函数名稳定可读：TagName-operationName"""
    tag = route.tags[0] if route.tags else "default"
    return f"{tag}-{route.name}"


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.APP_NAME,
        version=settings.APP_VERSION,
        debug=settings.APP_DEBUG,
        openapi_url=f"{settings.API_V1_PREFIX}/openapi.json",
        docs_url="/docs" if not settings.is_prod else None,
        redoc_url=None,
        lifespan=lifespan,
        generate_unique_id_function=custom_generate_unique_id,
        root_path=settings.APP_ROOT_PATH,
    )

    app.state.settings = settings

    # ---- 中间件：注册顺序与执行顺序相反（后注册的先执行）----
    app.add_middleware(AccessLogMiddleware)
    app.add_middleware(TraceMiddleware)          # 最外层：保证 trace_id 覆盖全部
    app.add_middleware(GZipMiddleware, minimum_size=1024)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[str(o) for o in settings.CORS_ORIGINS],
        allow_credentials=settings.CORS_ALLOW_CREDENTIALS,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["X-Request-Id", "Content-Disposition"],
    )

    # ---- 异常处理器 ----
    register_exception_handlers(app)

    # ---- 路由 ----
    app.include_router(api_router, prefix=settings.API_V1_PREFIX)

    return app


app = create_app()
```

### 6.4 落地建议

- ✅ **中间件执行顺序是倒序**（`add_middleware` 最后加的最先执行）。想清楚再排：Trace 最外层、CORS 次之、业务中间件靠内。
- ✅ 用 `lifespan` 替代 `@app.on_event("startup")`（后者已废弃）。
- ✅ `generate_unique_id_function` 一定要定制，否则前端生成的 SDK 函数名是 `read_users_api_v1_system_users_get` 这种。
- ✅ 生产环境关掉 `/docs` 和 `/redoc`。
- ⚠️ `BaseHTTPMiddleware` 有一定性能开销，且会吞掉 `StreamingResponse` 的部分行为。高并发场景考虑纯 ASGI 中间件。
- ⚠️ CORS 的 `allow_origins` **不能**用 `["*"]` 配合 `allow_credentials=True`，浏览器会拒绝。

---

## 7. 日志

### 7.1 目标

| 要求 | 实现 |
|---|---|
| 每条日志带 trace_id | `loguru` 的 `filter` 或 `logging.Filter` 注入 `request_id_ctx` |
| 生产输出 JSON（便于 ELK/Loki 采集） | `loguru.serialize=True` / `structlog` |
| 开发输出彩色可读格式 | `loguru` 默认格式 |
| 分级 + 轮转 + 保留 | `rotation="100 MB"`, `retention="30 days"` |
| 第三方库降噪 | `logging.getLogger("uvicorn.access").setLevel(WARNING)` |

### 7.2 落地实现（loguru）```python
# common/log.py
import logging
import sys

from loguru import logger

from common.context import request_id_ctx
from core.conf import settings


class InterceptHandler(logging.Handler):
    """把标准库 logging 的日志转发给 loguru，统一出口"""

    def emit(self, record: logging.LogRecord) -> None:
        try:
            level = logger.level(record.levelname).name
        except ValueError:
            level = record.levelno
        frame, depth = logging.currentframe(), 2
        while frame and frame.f_code.co_filename == logging.__file__:
            frame = frame.f_back
            depth += 1
        logger.opt(depth=depth, exception=record.exc_info).log(level, record.getMessage())


def _inject_trace_id(record) -> None:
    """给每条日志补上 trace_id"""
    record["extra"].setdefault("trace_id", request_id_ctx.get())


def setup_logging() -> None:
    logger.remove()

    if settings.APP_ENV == "development":
        fmt = (
            "<green>{time:HH:mm:ss.SSS}</green> | <level>{level: <8}</level> | "
            "<cyan>{extra[trace_id]}</cyan> | <level>{message}</level>"
        )
        logger.add(sys.stdout, level=settings.LOG_LEVEL, format=fmt, colorize=True)
    else:
        # 生产：JSON 单行，字段固定，便于采集与检索logger.add(sys.stdout,
            level=settings.LOG_LEVEL,
            serialize=True,
            backtrace=False,
            diagnose=False,        # 关闭变量值输出，防止泄漏敏感数据
        )

    logger.add(
        "logs/app_{time:YYYY-MM-DD}.log",
        level=settings.LOG_LEVEL,
        rotation="00:00",
        retention="30 days",
        compression="zip",
        enqueue=True,              # 多进程安全
        encoding="utf-8",
        serialize=settings.LOG_JSON,
    )

    logger.configure(patcher=_inject_trace_id)

    # 接管 uvicorn / sqlalchemy 的日志
    logging.basicConfig(handlers=[InterceptHandler()], level=0, force=True)
    for noisy in ("uvicorn.access", "sqlalchemy.engine.Engine", "asyncio", "multipart"):
        logging.getLogger(noisy).setLevel(logging.WARNING)


# 业务代码统一从这里导入
__all__ = ["logger", "setup_logging"]
```

### 7.3 落地建议

- ✅ 日志格式**固定字段**：`时间 | 级别 | trace_id | 用户ID | 消息`。字段漂移会让日志检索失效。
- ✅ 生产用 `serialize=True`，采集端按 `extra.trace_id` 聚合，一条链路一目了然。
- ✅ 关键业务操作单独写**操作日志表**（FBA 的 `opera_log_middleware`），而不是只靠文件日志——审计要求可查询。
- ✅ `diagnose=False`（生产），否则 loguru 会把局部变量值打进日志，可能泄漏密码。
- ⚠️ 不要在循环里打 `logger.debug`，`enqueue=True` 也救不了量级。
- ⚠️ 日志文件路径要能被容器挂载出去，否则重启即丢。

---

## 8. 鉴权

### 8.1 标杆组合

| 层 | 技术 | 标杆项目 |
|---|---|---|
| 认证 | JWT（access + refresh 双令牌） | 官方模板 / FBA / vue-fastapi-admin |
| 授权 | RBAC（角色-权限码） | eladmin / RuoYi |
| 精细授权 | Casbin（ABAC 能力） | gin-vue-admin（Go）/ FBA（pycasbin） |
| 数据权限 | 行级过滤（部门/本人） | RuoYi-Vue-Plus / yudao |
| 多端登录 | 单点/多点登录控制 | gin-vue-admin「多点登录拦截」 |

### 8.2 落地实现```python
# common/security/jwt.py
from datetime import UTC, datetime, timedelta
from typing import Any, Literal

import jwt
from pydantic import BaseModel

from common.exception.errors import TokenExpiredException, UnauthorizedException
from core.conf import settings


class TokenPayload(BaseModel):
    sub: str                                   # 用户 ID
    type: Literal["access", "refresh"]
    jti: str                                   # 令牌唯一 ID，用于登出黑名单
    exp: int
    iat: int


def create_token(user_id: int, token_type: Literal["access", "refresh"]) -> str:
    now = datetime.now(UTC)
    minutes = (
        settings.ACCESS_TOKEN_EXPIRE_MINUTES
        if token_type == "access"
        else settings.REFRESH_TOKEN_EXPIRE_MINUTES
    )
    payload = {
        "sub": str(user_id),
        "type": token_type,
        "jti": uuid.uuid4().hex,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=minutes)).timestamp()),
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_token(token: str, expect_type: Literal["access", "refresh"] = "access") -> TokenPayload:
    try:
        raw: dict[str, Any] = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[settings.JWT_ALGORITHM]
        )
    except jwt.ExpiredSignatureError as e:
        raise TokenExpiredException() from e
    except jwt.PyJWTError as e:
        raise UnauthorizedException("令牌无效") from e

    payload = TokenPayload(**raw)
    if payload.type != expect_type:
        raise UnauthorizedException(f"令牌类型错误，期望 {expect_type}")
    return payload
```

```python
# common/security/deps.py
from typing import Annotated

from fastapi import Depends
from fastapi.security import OAuth2PasswordBearer

from common.exception.errors import ForbiddenException, UnauthorizedException
from common.security.jwt import decode_token
from database.redis import redis_client

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)


async def get_token_payload(token: Annotated[str | None, Depends(oauth2_scheme)]) -> TokenPayload:
    if not token:
        raise UnauthorizedException("请先登录")
    payload = decode_token(token, expect_type="access")

    # 登出黑名单：jti 存在即已失效
    if await redis_client.exists(f"token:blacklist:{payload.jti}"):
        raise UnauthorizedException("登录状态已失效，请重新登录")

    return payload


async def get_current_user(
    payload: Annotated[TokenPayload, Depends(get_token_payload)],
    session: SessionDep,
) -> User:
    user = await session.get(User, int(payload.sub))
    if not user:
        raise UnauthorizedException("用户不存在")
    if not user.is_active:
        raise UserDisabledException()
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]
```

```python
# common/security/rbac.py —— 权限码校验（可选：升级为 Casbin）
async def load_user_permissions(session: AsyncSession, user: User) -> set[str]:
    """从角色-菜单-权限表聚合出权限码集合；结果可缓存进 Redis"""
    cache_key = f"user:perms:{user.id}"
    if cached := await redis_client.smembers(cache_key):
        return {c.decode() for c in cached}

    stmt = (
        select(Menu.permission)
        .join(RoleMenu, RoleMenu.menu_id == Menu.id)
        .join(UserRole, UserRole.role_id == RoleMenu.role_id)
        .where(UserRole.user_id == user.id, Menu.permission.is_not(None))
    )
    perms = {p for (p,) in (await session.execute(stmt)).all() if p}
    if perms:
        await redis_client.sadd(cache_key, *perms)
        await redis_client.expire(cache_key, 3600)   # 1 小时，权限变更时主动删
    return perms
```

> **💡 提示：为什么权限要缓存**
> 每个接口都要校验权限，每次都连表查角色-菜单是灾难。
> 缓存到 Redis 后，**权限变更时主动 `DEL user:perms:{id}`** 即可保证一致性。

### 8.3 落地建议

- ✅ **双令牌**：access 短（1 小时）、refresh 长（7 天）。前端 401 时用 refresh 换新 access，即 02-前端工程化封装-Vue#2. 响应拦截器 里的单飞逻辑。
- ✅ JWT 里带 `jti`，登出时写 Redis 黑名单，解决「JWT 无法主动失效」的痛点。
- ✅ 认证（401）与授权（403）用**不同异常类**，前端才能区分「重新登录」与「无权限提示」。
- ✅ 权限码从数据库聚合 + Redis 缓存，**不要在代码里硬编码角色判断**。
- ⚠️ `OAuth2PasswordBearer(auto_error=False)` 让缺 token 时抛你自己的异常，响应结构才统一。
- ⚠️ 不要在 JWT payload 里放敏感信息（它只是 base64，不是加密）。

---

## 9. 数据访问层

### 9.1 分层约定

| 层 | 允许做什么 | 禁止做什么 |
|---|---|---|
| `router` | 解析请求、调用 service、组装响应 | 不写 SQL、不写业务分支 |
| `service` | 业务规则、编排多个 crud、事务边界 | 不直接写 SQLAlchemy 语句 |
| `crud` | 单表增删改查、查询构造 | 不写业务判断 |
| `model` | 表结构、关系、约束 | 不含业务方法 |

### 9.2 落地实现```python
# database/db.py
from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from core.conf import settings

engine = create_async_engine(
    str(settings.DB_URL),
    echo=settings.DB_ECHO,
    pool_size=settings.DB_POOL_SIZE,
    max_overflow=settings.DB_MAX_OVERFLOW,
    pool_pre_ping=True,          # 断线自动重连，必开
    pool_recycle=3600,
)

async_session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def get_db() -> AsyncGenerator[AsyncSession]:
    async with async_session_factory() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


SessionDep = Annotated[AsyncSession, Depends(get_db)]


async def init_db() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)   # 生产建议只用 Alembic


async def close_db() -> None:
    await engine.dispose()
```

```python
# common/crud.py —— 通用 CRUD 基类
from typing import Any, Generic, TypeVar

from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from common.response.response_schema import PageResult

ModelT = TypeVar("ModelT")
CreateT = TypeVar("CreateT", bound=BaseModel)
UpdateT = TypeVar("UpdateT", bound=BaseModel)


class CRUDBase(Generic[ModelT, CreateT, UpdateT]):
    def __init__(self, model: type[ModelT]) -> None:
        self.model = model

    async def get(self, db: AsyncSession, pk: Any) -> ModelT | None:
        return await db.get(self.model, pk)

    async def list_page(
        self,
        db: AsyncSession,
        page: int,
        page_size: int,
        *filters: Any,
        order_by: Any = None,
    ) -> PageResult[ModelT]:
        # 总数与数据两条 SQL；数据用 limit/offset
        count_stmt = select(func.count()).select_from(self.model).where(*filters)
        total = (await db.execute(count_stmt)).scalar_one()

        stmt = select(self.model).where(*filters)
        stmt = stmt.order_by(order_by if order_by is not None else self.model.id.desc())
        stmt = stmt.limit(page_size).offset((page - 1) * page_size)
        rows = (await db.execute(stmt)).scalars().all()

        return PageResult(page=page, page_size=page_size, total=total, list=list(rows))

    async def create(self, db: AsyncSession, data: CreateT) -> ModelT:
        obj = self.model(**data.model_dump(exclude_unset=True))
        db.add(obj)
        await db.flush()          # 拿自增 ID，但不提交（事务由 service 控制）
        await db.refresh(obj)
        return obj

    async def update(self, db: AsyncSession, pk: Any, data: UpdateT) -> ModelT | None:
        obj = await self.get(db, pk)
        if obj is None:
            return None
        for k, v in data.model_dump(exclude_unset=True).items():
            setattr(obj, k, v)
        await db.flush()
        await db.refresh(obj)
        return obj

    async def remove(self, db: AsyncSession, pk: Any) -> bool:
        obj = await self.get(db, pk)
        if obj is None:
            return False
        await db.delete(obj)
        return True
```

```python
# app/system/user/service.py —— 事务边界在 service
class UserService:
    def __init__(self, db: SessionDep) -> None:
        self.db = db
        self.crud = CRUDBase[User, UserCreateReq, UserUpdateReq](User)

    async def create(self, data: UserCreateReq, operator_id: int) -> User:
        if await self.crud.exists_by_username(self.db, data.username):
            raise ClientException(code=ResponseCode.USERNAME_EXISTS, msg="用户名已存在")

        async with self.db.begin():            # 显式事务：多表操作要保证原子性
            user = await self.crud.create(self.db, data)
            await self.db.execute(
                insert(UserRole).values(user_id=user.id, role_id=data.role_id)
            )
        await redis_client.delete(f"user:perms:{user.id}")
        return user
```

### 9.3 落地建议

- ✅ **事务边界在 `service`，不在 `crud`**。`crud` 只 `flush()`，`service` 决定 `commit()`。
- ✅ `pool_pre_ping=True` 必开，否则数据库重启后连接池全是坏连接。
- ✅ 通用 `CRUDBase` 用**泛型**实现，业务 CRUD 继承它只补特有查询。
- ✅ `expire_on_commit=False`（async 场景必须），否则 commit 后访问属性会触发额外 IO 或报错。
- ⚠️ 不要用 `async with db.begin()` 包裹已经开始的隐式事务，会报「transaction already begun」。
- ⚠️ N+1 查询用 `selectinload` / `joinedload` 显式预加载，别靠惰性加载。

---

## 10. 分模块与插件化

### 10.1 模块化的三层境界

| 境界 | 做法 | 代表 |
|---|---|---|
| **L1 目录分模块** | 每个业务域一个包，互不 import | 大多数项目 |
| **L2 模块注册器** | 模块自带路由/中间件/生命周期，由注册器统一装配 | FBA `core/registrar.py` |
| **L3 插件化** | 模块可独立启停、带独立配置与依赖，运行时可插拔 | FBA `plugin/*/plugin.toml`、cool-admin |

### 10.2 落地实现：L2 注册器（性价比最高）```python
# core/registrar.py
from dataclasses import dataclass, field
from fastapi import APIRouter


@dataclass
class ModuleSpec:
    """一个业务模块的自描述"""
    name: str
    router: APIRouter
    prefix: str = ""
    order: int = 100


class ModuleRegistrar:
    """统一装配所有模块：新增模块只改一处"""

    def __init__(self) -> None:
        self._modules: list[ModuleSpec] = []

    def register(self, spec: ModuleSpec) -> None:
        self._modules.append(spec)

    def build_router(self) -> APIRouter:
        root = APIRouter()
        for spec in sorted(self._modules, key=lambda m: m.order):
            root.include_router(spec.router, prefix=spec.prefix)
        return root


registrar = ModuleRegistrar()
```

```python
# app/system/__init__.py
from core.registrar import ModuleSpec, registrar
from app.system.user.router import router as user_router
from app.system.role.router import router as role_router
from app.system.menu.router import router as menu_router

registrar.register(ModuleSpec(name="system", router=user_router, prefix="/system", order=10))
registrar.register(ModuleSpec(name="system", router=role_router, prefix="/system", order=11))
registrar.register(ModuleSpec(name="system", router=menu_router, prefix="/system", order=12))
```

```python
# app/router.py
from fastapi import APIRouter

from core.registrar import registrar

# 导入各模块包，触发其自注册（副作用导入）
import app.system  # noqa: F401
import app.monitor  # noqa: F401
import app.auth  # noqa: F401

api_router: APIRouter = registrar.build_router()
```

### 10.3 L3 插件化：FBA 的 `plugin.toml` 思路

FBA 每个插件目录都带一份 `plugin.toml`，声明自身元信息与依赖：

```
backend/plugin/
├── core.py           # 插件基类与生命周期
├── installer.py      # 安装/卸载
├── hooks.py          # 钩子机制
├── router.py         # 插件路由聚合
├── settings_source.py# 插件配置来源
├── errors.py  status.py  validator.py  requirements.py
├── code_generator/   # 各插件
│   ├── plugin.toml
│   └── README.md
├── dict/  email/  notice/  oauth2/  config/
```

> **💡 提示：什么项目才需要插件化**
> **不需要**：单一业务的后台管理系统（L2 注册器足够）。
> **需要**：SaaS 平台（客户按套餐启用模块）、低代码平台、需要第三方扩展的系统。
> 插件化会带来「运行时才发现问题」的代价，别过早引入。

### 10.4 落地建议

- ✅ 模块间**只允许通过 service 接口调用**，禁止跨模块直接 import 对方的 `crud`/`model`。
- ✅ 跨模块共享的东西（用户、字典、文件）上移到 `common` 或独立 `shared` 模块。
- ✅ 用 `order` 字段显式控制模块注册顺序（有依赖关系的模块需要）。
- ⚠️ 副作用导入（`import app.system`）会被 linter 判定为未使用，需要 `# noqa` 标注。

---

## 11. 收尾：可观测性与工程化

| 能力 | 方案 | 标杆 |
|---|---|---|
| 链路追踪 | OpenTelemetry + Tempo / Jaeger | FBA `common/observability/otel.py` |
| 指标 | Prometheus + Grafana | FBA `common/observability/prometheus/{fastapi,sqlalchemy,queue}.py` |
| 健康检查 | `/health`（存活）+ `/health/ready`（就绪） | 通用 |
| 限流 | slowapi / 自研 Redis 令牌桶 | FBA `common/limiter.py` |
| 数据库迁移 | Alembic（async 模式） | FBA `backend/alembic/` |
| 国际化 | 中间件 + JSON/YAML 词条 | FBA `locale/{en-US.json,zh-CN.yml}` |
| 代码规范 | Ruff（lint + format）+ pre-commit | FBA `.pre-commit-config.yaml` + `pyproject.toml` |
| 依赖管理 | uv（FBA）/ poetry（teamhide） | 见各仓库 |
| 部署 | Docker Compose + Nginx + supervisor | FBA `deploy/backend/` |
| 测试 | pytest + httpx.AsyncClient + dependency_overrides | `fastapi-best-practices` |

```python
# 健康检查：区分「活着」与「能干活」
@router.get("/health", tags=["系统"], include_in_schema=False)
async def health():
    return {"status": "ok"}


@router.get("/health/ready", tags=["系统"], include_in_schema=False)
async def ready(db: SessionDep):
    try:
        await db.execute(text("SELECT 1"))
        await redis_client.ping()
    except Exception as e:
        raise ServerException(f"依赖不可用: {e!s}")
    return {"status": "ready"}
```

> **💡 提示：测试用依赖覆盖（来自 `fastapi-best-practices`）**
> ```python
> # conftest.py
> @pytest.fixture
> async def client(app):
>     app.dependency_overrides[get_db] = override_get_db   # 换成测试库
>     app.dependency_overrides[get_current_user] = lambda: fake_user
>     async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
>         yield c
> ```
> 因为鉴权、DB 都做成了依赖，测试里替换它们只需两行——**这就是把能力做成依赖而非中间件的最大回报**。

---

## 相关笔记

- 02-前端工程化封装-Vue — 前端如何消费这里的统一响应与权限码
- 04-跨栈架构思路转译 — 本章各条思路在 Java/Go 里的原始形态
- 05-落地蓝图与检查清单 — 完整目录树与验收清单

---
- 上一页：02-前端工程化封装-Vue
- 下一页：04-跨栈架构思路转译
