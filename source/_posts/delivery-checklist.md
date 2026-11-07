---
title: "项目落地蓝图与检查清单"
date: 2026-05-26 22:30:00
cover: /img/covers/planning.jpg
top_img: /img/covers/planning.jpg
description: "把 02-前端工程化封装-Vue 与 03-后端工程化封装-FastAPI 的内容组装成一个可执行的落地方案： 目录树 → 命名约定 → 前后端契约 → 四阶段…"
categories:
  - 工程实践
tags:
  - 落地
  - 清单
  - 方法论
---

> **📋 摘要：本页用途**
> 把 02-前端工程化封装-Vue 与 03-后端工程化封装-FastAPI 的内容组装成一个**可执行的落地方案**：
> 目录树 → 命名约定 → 前后端契约 → 四阶段路线 → 验收 checklist → 反模式。

---

## 一、完整目录树

### 1.1 前端（Vue 3 + Vite + TS + Pinia + Element Plus）```web/
├── .env                      # 共享配置
├── .env.development          # 开发（走 Vite 代理）
├── .env.test                 # 测试环境
├── .env.production           # 生产（Nginx 反代）
├── .env.local                # 本地覆盖（gitignore）
├── index.html
├── vite.config.ts
├── tsconfig.json             # 只做 references 聚合
├── tsconfig.base.json        # 共享编译选项
├── tsconfig.app.json         # 应用代码
├── tsconfig.node.json        # 构建脚本
├── eslint.config.mjs
├── stylelint.config.mjs
├── commitlint.config.js
├── lefthook.yml / .husky/
├── openapi.json              # ← FastAPI 导出的规范（自动生成）
├── src/
│   ├── main.ts               # 应用入口：pinia → router → directives → mount
│   ├── App.vue
│   ├── api/                  # ★ 只放类型与路径常量
│   │   ├── types.ts          #   PageResult<T> / 通用类型
│   │   ├── schema.d.ts       #   ← openapi-typescript 生成（勿手改）
│   │   └── system/
│   │       ├── user.ts       #   UserVO / UserQuery / USER_API
│   │       ├── role.ts
│   │       └── menu.ts
│   ├── service/              # ★ 运行时逻辑
│   │   ├── request/
│   │   │   ├── index.ts      #   axios 实例 + 拦截器
│   │   │   ├── shared.ts     #   纯函数（token 刷新单飞等）
│   │   │   └── type.ts       #   RequestConfig / ApiResponse
│   │   └── api/
│   │       ├── auth.ts       #   login / logout / refresh / getUserInfo
│   │       ├── user.ts
│   │       └── index.ts
│   ├── router/
│   │   ├── index.ts          #   createRouter + setupRouterGuard
│   │   ├── routes/
│   │   │   ├── index.ts      #   staticRoutes / rootRoute / fallbackRoute
│   │   │   └── modules/      #   按域拆分的静态路由
│   │   ├── guard/
│   │   │   ├── index.ts      #   注册器
│   │   │   ├── route.ts      #   鉴权 + 动态路由注入
│   │   │   ├── progress.ts   #   NProgress
│   │   │   └── title.ts      #   document.title
│   │   └── access.ts         #   菜单树 → 路由树（纯函数）
│   ├── store/
│   │   ├── index.ts          #   pinia 实例 + 持久化插件
│   │   └── modules/
│   │       ├── auth/         #   index.ts + shared.ts
│   │       ├── route/
│   │       ├── tab/
│   │       ├── app/
│   │       └── dict/
│   ├── layouts/
│   │   ├── base-layout/
│   │   └── modules/          #   header / sidebar / tabbar / main
│   ├── components/
│   │   ├── common/           #   通用（PageContainer / SvgIcon）
│   │   ├── advanced/         #   业务无关高阶组件
│   │   │   ├── pro-table/    #   ★ 表格二次封装
│   │   │   ├── pro-form/     #   ★ 表单二次封装
│   │   │   └── pro-search/   #   查询栏
│   │   └── custom/           #   业务组件
│   ├── composables/          #   组合式函数（业务无关）
│   ├── hooks/
│   │   ├── common/           #   useAccess / useLoading / useDialog
│   │   └── business/         #   useUserSelect / useDeptTree
│   ├── directives/
│   │   ├── index.ts          #   setupDirectives
│   │   └── permission.ts     #   v-permission
│   ├── utils/
│   │   ├── auth.ts           #   token 读写
│   │   ├── storage.ts        #   localStorage / sessionStorage 封装
│   │   └── common.ts
│   ├── constants/
│   │   ├── env.ts            #   ★ 环境变量统一出口（不直接用 import.meta.env）
│   │   ├── app.ts
│   │   └── reg.ts            #   正则
│   ├── typings/
│   │   ├── env.d.ts
│   │   ├── router.d.ts       #   RouteMeta 扩展
│   │   └── global.d.ts
│   ├── locales/
│   ├── styles/
│   └── views/
│       ├── _builtin/         #   login / 403 / 404 / 500
│       ├── dashboard/
│       └── system/           #   与后端模块一一对应
│           ├── user/index.vue
│           ├── role/index.vue
│           └── menu/index.vue
```

### 1.2 后端（FastAPI + SQLAlchemy 2.0 + Pydantic v2）```server/
├── main.py                   # 入口：create_app()
├── run.py                    # 本地启动脚本
├── pyproject.toml            # uv / poetry 依赖
├── alembic.ini
├── .env.example
├── .pre-commit-config.yaml
├── Dockerfile
├── docker-compose.yml
├── backend/
│   ├── app/                  # ★ 业务模块（按域分包）
│   │   ├── router.py         #   聚合所有模块路由
│   │   ├── auth/             #   认证模块
│   │   │   ├── router.py
│   │   │   ├── schema.py
│   │   │   ├── service.py
│   │   │   ├── crud.py
│   │   │   └── model.py
│   │   ├── system/           #   系统管理模块
│   │   │   ├── __init__.py   #   自注册 ModuleSpec
│   │   │   ├── user/{router,schema,service,crud,model,dependencies}.py
│   │   │   ├── role/…
│   │   │   ├── menu/…
│   │   │   └── dept/…
│   │   └── monitor/          #   监控模块（在线用户、操作日志、定时任务）
│   ├── common/               # ★ 跨域共享的技术能力
│   │   ├── exception/
│   │   │   ├── errors.py
│   │   │   └── exception_handler.py
│   │   ├── response/
│   │   │   ├── response_code.py
│   │   │   ├── response_schema.py     # ResponseModel[T] / PageResult[T]
│   │   │   └── auto_route.py          # 可选：自动包装
│   │   ├── security/
│   │   │   ├── jwt.py
│   │   │   ├── deps.py                # CurrentUser / get_token_payload
│   │   │   ├── permission.py          # require_permission 工厂
│   │   │   └── rbac.py                # 权限码聚合
│   │   ├── context.py                 # ContextVar（trace_id / tenant / scope）
│   │   ├── log.py                     # loguru 装配
│   │   ├── crud.py                    # CRUDBase[T, C, U]
│   │   ├── pagination.py              # Pagination 依赖
│   │   ├── data_permission.py         # 行级数据权限（事件）
│   │   ├── tenant.py                  # 多租户（可选）
│   │   ├── cache.py
│   │   ├── limiter.py                 # 限流
│   │   ├── i18n.py
│   │   ├── model.py                   # 公共字段 Mixin（id/create_time/...）
│   │   ├── enums.py
│   │   └── observability/
│   │       ├── otel.py
│   │       └── prometheus/
│   ├── core/
│   │   ├── conf.py                    # Settings（pydantic-settings）
│   │   ├── registrar.py               # ModuleRegistrar
│   │   └── path_conf.py               # 路径常量
│   ├── database/
│   │   ├── db.py                      # engine / session / get_db
│   │   ├── redis.py
│   │   └── base.py                    # Base + 命名约定
│   ├── middleware/
│   │   ├── trace_middleware.py        # ★ 最外层
│   │   ├── access_log_middleware.py
│   │   ├── jwt_auth_middleware.py     # 可选（与依赖式二选一）
│   │   ├── opera_log_middleware.py
│   │   └── i18n_middleware.py
│   ├── plugin/                        # 可选：插件化
│   │   ├── core.py
│   │   ├── installer.py
│   │   └── <plugin_name>/{__init__.py,plugin.toml,router.py}
│   ├── locale/
│   │   ├── zh-CN.json
│   │   └── en-US.json
│   ├── utils/
│   │   ├── snowflake.py               # 分布式 ID
│   │   ├── serializers.py             # 自定义 JSON 序列化
│   │   ├── tree.py                    # 树形结构构建
│   │   └── …
│   ├── alembic/
│   │   ├── env.py
│   │   └── versions/
│   ├── static/                        # 上传文件（挂载 /static）
│   └── tests/
│       ├── conftest.py                # 依赖覆盖
│       └── system/test_user.py
└── deploy/
    ├── docker-compose/
    ├── nginx.conf
    └── supervisor/
```

---

## 二、命名与约定

### 2.1 分层命名

| 层 | 文件 | 类 / 函数命名 |
|---|---|---|
| 视图 | `router.py` | `list_users` / `get_user` / `create_user` |
| 传输 | `schema.py` | `UserQuery` / `UserCreateReq` / `UserUpdateReq` / `UserRespVO` |
| 业务 | `service.py` | `UserService.list_users()` |
| 数据 | `crud.py` | `UserCRUD` / `CRUDBase[User, ...]` |
| 实体 | `model.py` | `User`（SQLAlchemy） |
| 依赖 | `dependencies.py` | `UserServiceDep` / `RequireUserCreate` |
| 异常 | `common/exception/errors.py` | `UserNotFoundException` |
| 业务码 | `common/response/response_code.py` | `ResponseCode.USER_NOT_EXIST` |

### 2.2 Schema 后缀约定（强烈建议统一）

| 后缀 | 用途 | 示例 |
|---|---|---|
| `Req` | 入参（创建/更新） | `UserCreateReq` |
| `Query` | 查询参数 | `UserQuery` |
| `RespVO` | 出参视图对象 | `UserRespVO` |
| `VO` | 内部传输对象 | `UserVO` |
| `PageResult<T>` | 分页包装 | `PageResult[UserRespVO]` |

> **💡 提示：为什么不用 `UserCreate` / `UserResponse`**
> 混用会让 `schema.py` 里出现 `User`（model）、`UserCreate`、`UserResponse`、`UserOut`、`UserSchema` 五种命名风格。
> 定死后缀后，`Ctrl+P` 搜索 `UserRespVO` 一定能命中出参定义。

---

## 三、前后端契约（必须先定，再写代码）

### 3.1 统一响应体```jsonc// 成功
{ "code": 200, "msg": "success", "data": { "id": 1, "username": "admin" } }

// 分页成功
{
  "code": 200,
  "msg": "success",
  "data": { "page": 1, "page_size": 20, "total": 137, "list": [ /* ... */ ] }
}

// 业务失败
{ "code": 10001, "msg": "用户不存在", "data": null }

// 参数校验失败（422）
{
  "code": 40000,
  "msg": "Field required",
  "data": [{ "field": "username", "message": "Field required", "type": "missing" }]
}
```

### 3.2 契约对照表

| 项 | 约定 | 前端消费点 | 后端产出点 |
|---|---|---|---|
| 成功业务码 | `200` | 响应拦截器放行 | `ResponseCode.SUCCESS` |
| 分页字段 | `page` / `page_size` / `total` / `list` | `PageResult<T>` | `common/response/response_schema.py` |
| 分页入参 | `page`（从 1 起）/ `page_size`（≤200） | `PaginationDep` | `common/pagination.py` |
| 401 语义 | 未认证/令牌过期 → 前端刷新或跳登录 | 响应拦截器单飞刷新 | `UnauthorizedException` / `TokenExpiredException` |
| 403 语义 | 已认证但无权限 → **不跳登录** | 提示「无权限」 | `ForbiddenException` |
| 鉴权头 | `Authorization: Bearer <access_token>` | 请求拦截器注入 | `OAuth2PasswordBearer` |
| 追踪头 | `X-Request-Id` 双向透传 | 请求拦截器生成 → 响应拦截器可读 | `TraceMiddleware` |
| 时间格式 | ISO 8601 带时区：`2026-10-16T23:28:10+08:00` | dayjs 解析 | Pydantic 序列化 |
| 时间字段名 | `create_time` / `update_time`（snake_case） | 与后端完全一致 | 公共 Mixin |
| 主键 | 雪花 ID（`str` 传输，防 JS 精度丢失） | `id: string` | `utils/snowflake.py` |
| 空值 | 统一 `null`，不用 `""` 或 `-1` | `??` 兜底 | — |
| 布尔 | `true` / `false`，不用 `0/1` | — | 但状态字段可用 `0/1` 枚举 |
| 枚举 | 后端返回**字符串枚举值**，同时提供字典接口 | 字典 store 缓存 | `plugin/dict` 或 `system/dict` |
| 权限码 | `<域>:<资源>:<动作>`，如 `system:user:create` | `v-permission` | `require_permission(...)` |
| 文件上传 | `multipart/form-data`，字段名 `file` | `request.upload()` | `UploadFile` |
| 文件下载 | `Content-Disposition` + `responseType: blob` | `request.download()` | `FileResponse` |
| 接口前缀 | `/api/v1` | `VITE_API_BASE_URL=/api` + Nginx 反代 | `settings.API_V1_PREFIX` |

> **⚠️ 注意：雪花 ID 必须用字符串传输**
> JS 的 `Number` 安全整数上限是 2^53-1。雪花 ID 是 64 位，**必然溢出**。
> 后端要么在 schema 里把 ID 声明成 `str`，要么用 `json_encoders` 统一转字符串。

---

## 四、四阶段落地路线

> **📝 说明：原则**
> **每个阶段都能独立上线**。不要一次性把架构全铺开，那会导致项目「重构期」长达数月。

### 阶段一：地基（先把「接口通」这件事做对）

| 序号 | 任务 | 产出 |
|---|---|---|
| 1.1 | 定死前后端契约（§3） | 一份 `CONTRACT.md` |
| 1.2 | 后端：`core/conf.py` + `ResponseModel[T]` + 异常体系 + `register_exception_handlers` | 所有接口响应结构统一 |
| 1.3 | 后端：`TraceMiddleware` + `setup_logging` | 每条日志带 trace_id |
| 1.4 | 前端：`service/request` 实例 + 请求/响应拦截器 | 401 自动处理、错误统一提示 |
| 1.5 | 前端：`constants/env.ts` + `.env.*` 三件套 | 环境配置不散落 |
| 1.6 | 双端：Nginx 反代 `/api` 打通 | 本地无跨域 |

**验收**：一个 `/api/v1/ping` 接口，从点击到响应全链路可追踪（前端 Network 与后端日志能对上 trace_id）。

### 阶段二：鉴权与权限

| 序号 | 任务 |
|---|---|
| 2.1 | 后端：JWT 双令牌 + `get_current_user` 依赖 + Redis 黑名单 |
| 2.2 | 后端：角色-菜单-权限表 + `require_permission` 依赖工厂 + 权限码 Redis 缓存 |
| 2.3 | 后端：登录/刷新/登出/用户信息/菜单树 五个接口 |
| 2.4 | 前端：`auth` store（token 持久化）+ `refreshTokenOnce` 单飞 |
| 2.5 | 前端：路由守卫（白名单 + 动态路由注入 + 兜底 404） |
| 2.6 | 前端：`v-permission` 指令 + `useAccess()` |

**验收**：用两个不同角色的账号登录，侧栏菜单项不同；直接敲无权限的 URL 进 403；按钮级权限生效；**并且**用 Postman 直调无权限接口返回 403。

### 阶段三：工程化与复用

| 序号 | 任务 |
|---|---|
| 3.1 | 前端：`pro-table` / `pro-form` / `pro-search` 二次封装 |
| 3.2 | 前端：`dict` store（字典缓存 + TTL） |
| 3.3 | 后端：`CRUDBase` 泛型基类 + `PaginationDep` |
| 3.4 | 后端：`ModuleRegistrar` 模块自注册 |
| 3.5 | 双端：`api:sync` + `openapi-typescript` 类型自动生成接入 CI |
| 3.6 | 双端：ESLint / Prettier / Ruff / pre-commit / commitlint |

**验收**：新增一个 CRUD 模块（表 + 5 个接口 + 1 个页面）不超过 2 小时，且无需修改任何共享配置。

### 阶段四：企业级增强（按需）

| 任务 | 触发条件 |
|---|---|
| 行级数据权限（部门/本人） | 出现「不同部门看不同数据」需求 |
| 操作日志 + 审计表 | 合规要求 / 客户审计 |
| 多租户 | 转 SaaS |
| 限流 + 熔断 | 有对外接口 / 防刷 |
| OpenTelemetry + Grafana | 出现性能问题需要定位 |
| 插件化 | 客户按套餐启用模块 |
| 代码生成器 | CRUD 页面数量 > 30 |
| Celery 异步任务 | 出现耗时任务（报表导出、批量处理） |

> **🚫 危险：不要过早进入阶段四**
> 多租户、插件化、分布式事务都会显著增加复杂度。
> **没有真实需求就上，等于给自己挖坑**。FBA 的插件机制是给平台型产品准备的，不是给业务后台。

---

## 五、验收 Checklist

### 5.1 前端

- [ ] 请求拦截器注入 `Authorization` / `X-Request-Id` / `Accept-Language`
- [ ] `withToken` / `flatResponse` / `silent` 三个开关可用
- [ ] 响应拦截器统一处理业务码，返回已解包的 `data`
- [ ] 401 单飞刷新，且带 `_retried` 防死循环
- [ ] 401 与 403 分流（403 不跳登录页）
- [ ] 路由守卫：白名单、动态路由注入、`{ ...to, replace: true }`、兜底 404 后置注册
- [ ] 守卫按职责拆文件（route / progress / title）
- [ ] `transformMenuToRoutes` 是纯函数且有单测
- [ ] Pinia 按域分模块，**token 单独持久化**，权限每次重拉
- [ ] `v-permission` 用 DOM 移除实现；超管走 `*:*:*` 通配
- [ ] 环境变量只从 `constants/env.ts` 读取；`VITE_` 前缀外的变量不含密钥
- [ ] API 层「类型/路径」与「请求函数」分离
- [ ] 分页、上传、下载有统一封装，不在业务里重复写
- [ ] `openapi-typescript` 生成的类型进入 CI 校验
- [ ] ESLint / Prettier / Stylelint / Commitlint / Husky 全部生效
- [ ] `tsconfig` 分层（base / app / node）

### 5.2 后端

- [ ] `Settings` 用 `pydantic-settings`，枚举型配置用 `Literal` 约束
- [ ] 生产环境危险配置（debug、弱密钥、空 CORS）**启动即失败**
- [ ] `ResponseModel[T]` 是**泛型**（OpenAPI 能推导 data 类型）
- [ ] `PageResult[T]` 与前端字段名完全一致
- [ ] 异常体系分层：`AppException` → 客户端/服务端 → 各业务异常
- [ ] `register_exception_handlers` 覆盖：业务异常 / 校验异常 / HTTPException / 数据库异常 / 兜底
- [ ] 4xx 记 warning，5xx 记 error + 堆栈
- [ ] 生产环境错误响应只含 trace_id，不含堆栈
- [ ] `Depends` 全部用 `Annotated[X, Depends(...)]` + 类型别名
- [ ] 权限用 `require_permission(...)` 依赖工厂，无硬编码角色判断
- [ ] 中间件顺序正确（Trace 最外层），且知道「后注册先执行」
- [ ] `lifespan` 管理启动/关闭，不用已废弃的 `on_event`
- [ ] `generate_unique_id_function` 已定制（否则前端 SDK 函数名灾难）
- [ ] 日志固定字段、带 trace_id、生产 JSON、`diagnose=False`
- [ ] JWT 带 `jti`，登出写黑名单；access/refresh 分离
- [ ] 权限码 Redis 缓存，权限变更时主动失效
- [ ] `pool_pre_ping=True`、`expire_on_commit=False`
- [ ] 事务边界在 service，crud 只 `flush()`
- [ ] 通用 `CRUDBase` 泛型化，无重复分页代码
- [ ] `/health` 与 `/health/ready` 分离
- [ ] Ruff + pre-commit 生效；Alembic 迁移可回滚
- [ ] 测试用 `dependency_overrides` 替换 DB 与当前用户

### 5.3 协作

- [ ] `CONTRACT.md` 已定稿并被双方 review
- [ ] OpenAPI 文档（`/docs`）在测试环境可访问
- [ ] 前端 mock 基于同一份契约（vben 的 `backend-mock` 用 Nitro，值得借鉴）
- [ ] CI 包含：类型检查、Lint、单测、`api:gen` 一致性校验
- [ ] 错误码表维护在单一来源（后端 `response_code.py`），前端不硬编码

---

## 六、反模式清单

> **🚫 危险：见到这些就要警觉**

| 反模式 | 症状 | 正确做法 |
|---|---|---|
| **前端存权限真相** | 只在前端判断权限 | 后端每个接口独立校验（02-前端工程化封装-Vue#6. 权限控制） |
| **`res.data.data`** | 三层嵌套 | 响应拦截器解包 |
| **每个接口各写一套分页** | 复制粘贴 | `CRUDBase.list_page` + `PageResult[T]` |
| **路由守卫里写业务** | 守卫 500 行 | 守卫只做判权限/取数据/重定向 |
| **store 里直接操作 router** | 循环依赖 | 通过返回值让守卫跳转 |
| **`ResponseModel` 非泛型** | OpenAPI 里 data 是 `any` | 泛型化 |
| **异常里暴露 SQL / 堆栈** | 生产报错页面泄露表名 | 统一异常处理 + trace_id |
| **中间件里吞异常** | 500 变成空响应 | 中间件内 try/except 后重新抛出 |
| **`allow_origins=["*"]` + credentials** | 浏览器拒绝 | 显式列出来源，或同域 Nginx 反代 |
| **`SELECT *` + 惰性加载** | N+1 查询 | `selectinload` 显式预加载 |
| **大整数 ID 直接给前端** | JS 精度丢失，ID 后几位变 0 | 雪花 ID 用字符串传输 |
| **`.env` 里放密钥** | `VITE_` 变量被打进产物 | 密钥只放后端，前端拿不到 |
| **过早插件化** | 一个后台系统 200 个抽象层 | 阶段四才引入 |
| **无契约直接开写** | 联调时反复改字段 | 阶段一先定 `CONTRACT.md` |

---

## 相关笔记

- 02-前端工程化封装-Vue · 03-后端工程化封装-FastAPI · 04-跨栈架构思路转译
- 06-重点项目案例卡片 — 各条约定的来源项目

---
- 上一页：04-跨栈架构思路转译
- 下一页：06-重点项目案例卡片
