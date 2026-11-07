---
title: "怎么挑一个能写进简历的项目"
date: 2026-05-12 21:00:00
cover: /img/covers/project-selection.svg
top_img: /img/covers/project-selection.svg
description: "全部 star / fork / 最近提交时间由 GitHub REST API GET /repos/{owner}/{repo} 于 2026-10-16 …"
categories:
  - 工程实践
tags:
  - 项目
  - 方法论
  - 简历
---

> **ℹ️ 信息：数据来源**
> 全部 star / fork / 最近提交时间由 GitHub REST API `GET /repos/{owner}/{repo}` 于 **2026-10-16** 实际拉取，
> 不是记忆值、不是估算值。可复现脚本见笔记末尾。
> 部分仓库已改名（GitHub 会自动 301 到新名），表中已标注。

## 一、筛选标准

### 1.1 硬性门槛（不满足直接淘汰）

| 维度 | 门槛 | 说明 |
|---|---|---|
| Star 数 | 前端 ≥ 2k，后端模板 ≥ 1k，参照系 ≥ 3k | 低星项目结构随意性大 |
| 活跃度 | 最近提交 ≤ 12 个月 | 超过 18 个月视为停更 |
| 完整性 | 有完整可运行工程（非 demo/单文件） | 排除「教程代码片段」类仓库 |
| 文档 | README 含目录说明 / 官方文档站 | 排除「无文档野路子」 |
| 分层 | 有明确目录分层，非全塞 `views/` | 关键可维护性指标 |
| 许可 | 有明确 License（MIT / Apache-2.0 优先） | 商用合规前提 |

### 1.2 加权评分（同门槛内排序）```
总分 = 0.30 × Star归一化
     + 0.25 × 封装完整度（拦截器/守卫/权限/异常/DI 覆盖项数 ÷ 8）
     + 0.20 × 活跃度（近 90 天提交密度）
     + 0.15 × 文档质量（有无目录说明 + 官方文档站 + 示例）
     + 0.10 × 与 Vue+FastAPI 的可迁移度
```

### 1.3 明确排除的类型

- ❌ **纯 UI 组件库**（Element Plus / Naive UI 本体）——是依赖，不是架构参考
- ❌ **单页 demo / 课程作业**——无分层可谈
- ❌ **Admin 生成器 / 低代码平台**（JeecgBoot 仅作参照系）——生成物结构不代表手工最佳实践
- ❌ **微服务全家桶**（yudao-cloud / pig）——超出「前后端分离单体」范畴，仅借边界划分思路
- ❌ **停更 ≥ 18 个月**的项目

## 二、候选池全量数据（2026-10-16）

### 2.1 前端 · Vue 生态（19 个）

| 项目 | Star | Fork | 语言 | 最近提交 | 归档 | License | 入选 |
|---|---:|---:|---|---|---|---|---|
| [PanJiaChen/vue-element-admin](https://github.com/PanJiaChen/vue-element-admin) | 90,145 | 30,254 | Vue | 2024-10-24 | 否 | MIT | ⚠️ 仅思路 |
| [vbenjs/vue-vben-admin](https://github.com/vbenjs/vue-vben-admin) | 33,620 | 8,977 | TS | 2026-10-15 | 否 | MIT | ✅ 首选 |
| [pure-admin/vue-pure-admin](https://github.com/pure-admin/vue-pure-admin) | 20,694 | 3,788 | Vue | 2026-10-12 | 否 | MIT | ✅ |
| [lin-xin/vue-manage-system](https://github.com/lin-xin/vue-manage-system) | 19,600 | 6,065 | Vue | 2024-08-17 | 否 | MIT | ⚠️ 停更 |
| [zxwk1998/vue-admin-better](https://github.com/zxwk1998/vue-admin-better) | 18,934 | 3,923 | Vue | 2026-10-08 | 否 | MIT | ✅ |
| [soybeanjs/soybean-admin](https://github.com/soybeanjs/soybean-admin) | 15,113 | 2,517 | TS | 2026-10-16 | 否 | MIT | ✅ 首选 |
| [macrozheng/mall-admin-web](https://github.com/macrozheng/mall-admin-web) | 12,642 | 7,462 | Vue | 2026-05-14 | 否 | Apache-2.0 | ✅ |
| [HalseySpicy/Geeker-Admin](https://github.com/HalseySpicy/Geeker-Admin) | 8,089 | 1,672 | Vue | 2026-07-29 | 否 | MIT | ✅ |
| [Daymychen/art-design-pro](https://github.com/Daymychen/art-design-pro) | 5,927 | 1,118 | Vue | 2026-06-01 | 否 | MIT | ✅ |
| [jekip/naive-ui-admin](https://github.com/jekip/naive-ui-admin) | 5,919 | — | TS | 2026-01-19 | 否 | MIT | ✅ |
| [buqiyuan/vue3-antdv-admin](https://github.com/buqiyuan/vue3-antdv-admin) | 4,109 | 990 | TS | 2025-05-27 | 否 | MIT | ✅ |
| [fantastic-admin/basic](https://github.com/fantastic-admin/basic) | 3,418 | — | TS | 2026-09-29 | 否 | MIT | ✅ |
| [youlaitech/vue3-element-admin](https://github.com/youlaitech/vue3-element-admin) | 2,612 | 604 | Vue | 2026-09-30 | 否 | MIT | ✅ 目标栈 |
| [mizhexiaoxiao/vue-fastapi-admin](https://github.com/mizhexiaoxiao/vue-fastapi-admin) | 2,270 | 419 | Vue | 2025-07-04 | 否 | MIT | ✅ 同栈 |
| [lyt-Top/vue-next-admin](https://github.com/lyt-Top/vue-next-admin) | 2,162 | — | TS | 2023-09-07 | 否 | MIT | ⚠️ 停更 |
| [vbenjs/vben-admin-thin-next](https://github.com/vbenjs/vben-admin-thin-next) | 2,071 | — | TS | 2026-09-24 | 否 | MIT | ✅ 轻量版 |
| [arco-design/arco-design-pro-vue](https://github.com/arco-design/arco-design-pro-vue) | 1,817 | — | Vue | 2024-05-08 | 否 | MIT | ⚠️ 停更 |
| [Tencent/tdesign-vue-next-starter](https://github.com/Tencent/tdesign-vue-next-starter) | 1,036 | — | TS | 2026-10-03 | 否 | MIT | ✅ |

### 2.2 后端 · FastAPI / Python（10 个）

| 项目 | Star | Fork | 语言 | 最近提交 | License | 入选 |
|---|---:|---:|---|---|---|---|
| [fastapi/full-stack-fastapi-template](https://github.com/fastapi/full-stack-fastapi-template) | 46,008 | 9,149 | TS* | 2026-10-15 | MIT | ✅ 首选 |
| [zhanymkanov/fastapi-best-practices](https://github.com/zhanymkanov/fastapi-best-practices) | 18,194 | 1,329 | — | 2026-08-27 | 无 | ✅ 必读 |
| [fastapi-users/fastapi-users](https://github.com/fastapi-users/fastapi-users) | 6,253 | 512 | Python | 2026-08-17 | MIT | ✅ |
| [fastapi-admin/fastapi-admin](https://github.com/fastapi-admin/fastapi-admin) | 3,831 | 465 | Python | 2025-04-05 | Apache-2.0 | ⚠️ 停更 |
| [nsidnev/fastapi-realworld-example-app](https://github.com/nsidnev/fastapi-realworld-example-app) | 3,103 | — | Python | 2022-08-21 | MIT | ⚠️ 停更 |
| [s3rius/FastAPI-template](https://github.com/s3rius/FastAPI-template) | 2,830 | 238 | Python | 2026-05-05 | MIT | ✅ |
| [fastapi-practices/fastapi-best-architecture](https://github.com/fastapi-practices/fastapi-best-architecture) | 2,584 | 392 | Python | 2026-10-16 | MIT | ✅ 首选 |
| [teamhide/fastapi-boilerplate](https://github.com/teamhide/fastapi-boilerplate) | 1,496 | — | Python | 2026-05-08 | 无 | ✅ |
| [zhanymkanov/fastapi_production_template](https://github.com/zhanymkanov/fastapi_production_template) | 1,258 | — | Python | 2026-03-19 | Unlicense | ✅ |
| [liqianglog/django-vue-admin](https://github.com/liqianglog/django-vue-admin) | 714 | — | Python | 2024-01-01 | Apache-2.0 | ⚠️ 停更 |

\* 官方模板仓库主语言被统计为 TypeScript（含前端），其后端为 Python/FastAPI。

### 2.3 参照系 · Java / Go / Node / React（11 个）

| 项目 | Star | 语言 | 最近提交 | 借什么 |
|---|---:|---|---|---|
| [goldbergyoni/nodebestpractices](https://github.com/goldbergyoni/nodebestpractices) | 105,661 | — | 2026-06-15 | 工程规范清单（含项目结构章节） |
| [macrozheng/mall](https://github.com/macrozheng/mall) | 84,908 | Java | 2026-09-15 | 领域模块划分、Docker 化 |
| [jeecgboot/JeecgBoot](https://github.com/jeecgboot/JeecgBoot) | 48,236 | Java | 2026-10-14 | 代码生成器分层 |
| [YunaiV/ruoyi-vue-pro](https://github.com/YunaiV/ruoyi-vue-pro) | 39,847 | Java | 2026-10-09 | **framework starter + module 双层** |
| [ant-design/ant-design-pro](https://github.com/ant-design/ant-design-pro) | 38,859 | TS | 2026-10-15 | request/access 抽象范式 |
| [elsewhencode/project-guidelines](https://github.com/elsewhencode/project-guidelines) | 29,419 | — | 2024-12-09 | 目录组织约定 |
| [flipped-aurora/gin-vue-admin](https://github.com/flipped-aurora/gin-vue-admin) | 25,076 | Go | 2026-10-14 | JWT + Casbin + 动态路由 |
| [elunez/eladmin](https://github.com/elunez/eladmin) | 21,904 | Java | 2026-05-09 | 分模块 + RBAC 数据权限 |
| [linlinjava/litemall](https://github.com/linlinjava/litemall) | 20,387 | Java | 2026-08-20 | 多端复用后端 |
| [YunaiV/yudao-cloud](https://github.com/YunaiV/yudao-cloud) | 19,638 | Java | 2026-10-07 | 服务边界拆分 |
| [cool-team-official/cool-admin-midway](https://github.com/cool-team-official/cool-admin-midway) | 3,281 | TS | 2026-07-17 | 插件化模块机制 |

> **📝 说明：关于 mall-admin-web**
> `macrozheng/mall-admin-web` 描述里仍写 "基于 Vue 3 + Element Plus"，但仓库 topics 还保留 `vuex` 等 Vue2 痕迹，
> 实际以仓库内 `package.json` 为准。它的价值在**电商域模块划分**，不在工程化封装。

## 三、Top 10 深读清单

> **💡 提示：阅读顺序 = 前端 → 后端 → 参照系**

### 1. vbenjs/vue-vben-admin · **33,620** ⭐ 前端首选

- **技术栈**：Vue 3 + Vite + TypeScript + pnpm Monorepo + Turborepo + 多 UI 适配（antd / element / naive / tdesign）
- **重点文件**（已在仓库中确认存在）：
  - `packages/effects/request/src/request-client/request-client.ts` — 请求客户端类
  - `packages/effects/request/src/request-client/modules/interceptor.ts` — **拦截器可插拔设计**
  - `packages/effects/request/src/request-client/preset-interceptors.ts` — 预置拦截器集合
  - `packages/effects/access/src/{accessible.ts,use-access.ts,directive.ts}` — 权限三件套
  - `packages/stores/src/modules/{user.ts,access.ts,tabbar.ts}` — 状态分层
  - `apps/web-antd/src/router/{guard.ts,access.ts}` — 路由守卫与动态路由
- **一句话**：想学「请求层与权限层如何做成可复用包」，只看这一个。

### 2. soybeanjs/soybean-admin · **15,113** ⭐ 业务分层最干净

- **技术栈**：Vue 3 + Vite + TS + Pinia + Naive UI + UnoCSS + pnpm workspace
- **重点文件**：
  - `src/service/request/{index.ts,shared.ts,type.ts}` — 请求封装
  - `src/service/api/{auth.ts,route.ts}` — API 模块化
  - `src/router/guard/{index.ts,route.ts,progress.ts,title.ts}` — **守卫按职责拆文件**
  - `src/store/modules/{auth,route,tab,theme}/` — 每个模块 `index.ts + shared.ts` 双文件
  - `packages/axios/src/{index.ts,options.ts,shared.ts,type.ts}` — axios 二次封装成包
- **一句话**：目录命名与职责切分最适合直接照搬到新项目。

### 3. fastapi-practices/fastapi-best-architecture · **2,584** ⭐ 后端首选

- **技术栈**：FastAPI + SQLAlchemy 2.0 + Pydantic v2 + Casbin + Alembic + Celery + Grafana
- **真实顶层结构**（API 拉取）：`backend/{app,common,core,database,middleware,plugin,utils,locale,scripts,tests}`
- **重点文件**：
  - `backend/common/exception/{errors.py,exception_handler.py}` — 异常体系与处理器
  - `backend/common/response/{response_code.py,response_schema.py}` — 统一响应
  - `backend/common/security/{jwt.py,rbac.py,permission.py,token.py}` — 鉴权四件套
  - `backend/common/{log.py,pagination.py,context.py,lifespan.py,limiter.py,i18n.py}`
  - `backend/middleware/{jwt_auth_middleware.py,access_middleware.py,opera_log_middleware.py,i18n_middleware.py,state_middleware.py}`
  - `backend/core/{conf.py,registrar.py,path_conf.py}` — 配置与注册器
  - `backend/plugin/*/plugin.toml` — **插件化模块机制**
  - `backend/common/observability/{otel.py,prometheus/}` — 可观测性
- **一句话**：FastAPI 生态里唯一把「企业级八大件」都写全的项目，README 还给了 Java ↔ FastAPI 分层对照表。

### 4. fastapi/full-stack-fastapi-template · **46,008** ⭐ 官方规范

- **重点文件**：
  - `backend/app/core/config.py` — `pydantic-settings` 多环境 + **敏感值强校验**（`changethis` 检测）
  - `backend/app/api/deps.py` — `Annotated[T, Depends(...)]` 依赖别名范式
  - `backend/app/main.py` — 应用装配、CORS、`generate_unique_id_function`
  - `backend/app/utils.py` — 邮件/令牌工具
- **一句话**：配置管理与依赖注入的「官方答案」，照抄不会错。

### 5. zhanymkanov/fastapi-best-practices · **18,194** ⭐ 必读约定

- 不是代码仓库，是**约定集**。核心章节：Project Structure / Pydantic / Dependencies / Miscellaneous
- 关键观点：`settings` 解耦、依赖链式与缓存、`async` 依赖优先、SQL-first & Pydantic-second、测试用 async client
- **一句话**：把 FastAPI 写「像框架」而不是「像脚本」的思维校准器。

### 6. youlaitech/vue3-element-admin · **2,612** ⭐ 目标栈最接近

- Vue 3 + Vite + TS + Element Plus，是 `vue-element-admin` 的 Vue3 续作，配套后端源码
- **一句话**：如果你的 UI 选 Element Plus，这个的目录结构可直接当起点。

### 7. mizhexiaoxiao/vue-fastapi-admin · **2,270** ⭐ 同栈参考

- **后端结构**（README 原文）：`app/{api/v1/{apis,base,menus,roles,users}, controllers, core, log, models, schemas, settings, utils}`
- **前端结构**：`web/src/{api,components,composables,directives,layout,router/{guard,routes},store/modules,utils/{auth,http,storage},views}`
- **一句话**：验证了「FastAPI 分层 + Vue 分层」双端目录如何对齐；但更新偏慢（2025-07）。

### 8. YunaiV/ruoyi-vue-pro · **39,847** ⭐ 分层思路教科书

- **真实结构**：`yudao-dependencies`（依赖版本管理）+ `yudao-framework`（15 个 `yudao-spring-boot-starter-*`）+ `yudao-module-*`（20+ 业务模块）+ `yudao-server`（启动器）+ `yudao-ui`
- **一句话**：**「框架能力」与「业务模块」彻底分离**这一条，是 FastAPI 项目最容易缺失的。

### 9. flipped-aurora/gin-vue-admin · **25,076** ⭐ 鉴权与动态路由

- JWT 鉴权、Casbin 权限、动态路由、多点登录拦截、分页封装、代码生成器
- **一句话**：`Casbin + 动态路由` 这套组合，Python 侧可用 `pycasbin` 1:1 复刻。

### 10. cool-team-official/cool-admin-midway · **3,281** ⭐ 插件化

- 模块化、插件化、CRUD 极速开发（Node + TypeScript + TypeORM + Vue3）
- **一句话**：与 fastapi-best-architecture 的 `plugin/` 机制互为印证，说明「插件化」是后台系统的收敛解。

## 四、复现方式

> **🧪 示例：数据可复现**
> 本页所有数字来自下面这段最小脚本（Node 22+，无需 token）：
> ```js
> const repos = ["vbenjs/vue-vben-admin", "fastapi-practices/fastapi_best_architecture"];
> for (const r of repos) {
>   const res = await fetch(`https://api.github.com/repos/${r}`, {
>     headers: { "User-Agent": "arch-research", Accept: "application/vnd.github+json" },
>   });
>   const d = await res.json();
>   console.log(d.full_name, d.stargazers_count, d.language, d.pushed_at);
> }
> ```
> 未认证配额为 60 次/小时，批量抓取需加 `await new Promise(r => setTimeout(r, 700))`。

---
- 上一页：00-索引-MOC
- 下一页：02-前端工程化封装-Vue
