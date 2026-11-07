---
title: "Vue 工程化封装：目录、路由与请求层"
date: 2025-11-28 21:30:00
cover: /img/covers/frontend-design.jpg
top_img: /img/covers/frontend-design.jpg
description: "请求拦截器 · 响应拦截器 · 路由守卫 · 状态管理 · 权限控制 · 环境配置 · API 统一封装 每节结构：标杆项目怎么做的（含真实文件路径） → 可直…"
categories:
  - 前端
tags:
  - Vue
  - 工程化
  - 前端
---

> **📋 摘要：本页覆盖**
> 请求拦截器 · 响应拦截器 · 路由守卫 · 状态管理 · 权限控制 · 环境配置 · API 统一封装
> 每节结构：**标杆项目怎么做的（含真实文件路径） → 可直接用的代码 → 落地建议**

---

## 0. 先看目录分层：三种流派

三个高星项目代表了三种截然不同的组织哲学，选哪种取决于团队规模。

| 流派 | 代表 | Star | 结构特征 | 适用 |
|---|---|---:|---|---|
| **扁平单应用** | [vue-element-admin](https://github.com/PanJiaChen/vue-element-admin) | 90,145 | `src/{api,router,store,utils,views,components}` | 单人/小团队，1 个后台 |
| **业务分层单应用** | [soybean-admin](https://github.com/soybeanjs/soybean-admin) | 15,113 | `src/service`（请求+API）独立于 `src/api` | 3–10 人，1–2 个后台 |
| **Monorepo 多应用** | [vue-vben-admin](https://github.com/vbenjs/vue-vben-admin) | 33,620 | `apps/*` + `packages/*` + `internal/*` | 多产品线 / 多 UI 库复用 |

### soybean-admin 的 `src/` 分层（推荐中小团队直接照搬）```src/
├── api/            # 仅放类型与接口声明
├── service/
│   ├── request/    # axios 实例 + 拦截器 + 类型  ← 与 api 分离是精髓
│   │   ├── index.ts
│   │   ├── shared.ts
│   │   └── type.ts
│   └── api/        # 业务接口函数（auth.ts / route.ts）
├── router/
│   ├── guard/      # 守卫按职责拆文件：route / progress / title
│   ├── routes/     # 路由表
│   └── elegant/    # 自动生成（imports / routes / transform）
├── store/
│   ├── modules/    # auth / route / tab / theme，每个 index.ts + shared.ts
│   └── plugins/    # 持久化等 Pinia 插件
├── hooks/          # common/ + business/
├── locales/
├── typings/        # 全局类型：router.d.ts / storage.d.ts / app.d.ts
└── views/
```

> **💡 提示：关键差异**
> `src/api` 只放**接口的类型与路径声明**，`src/service` 才放**运行时逻辑**。
> 这样类型可被 mock、测试、OpenAPI 生成器安全引用，不会把 axios 实例拖进依赖图。

### vben 的 monorepo 分层（推荐多产品线）```apps/
├── web-antd/       # 每个 UI 库一个可独立部署的应用
├── web-ele/
├── web-naive/
├── web-tdesign/
└── backend-mock/   # Nitro 写的 mock 服务，与前端同仓
packages/
├── @core/          # base / composables / preferences / ui-kit
├── effects/        # access / request / layouts / plugins / hooks / common-ui
├── stores/         # 全局状态
├── locales/  icons/  utils/  types/  constants/  styles/
internal/
├── vite-config/    # 共享构建配置
├── lint-configs/   # eslint / stylelint / commitlint 共享配置
└── tsconfig/       # tsconfig 分层（base/library/node/web/web-app）
```

> **💡 提示：可直接借鉴的一条**
> `internal/lint-configs/*` 把 ESLint / Stylelint / Commitlint 配置抽成**独立包**，
> 各 app 只写一行 `extends`。这是 monorepo 下规范不漂移的关键。

---

## 1. 请求拦截器

### 1.1 标杆做法

| 项目 | 实现 | 设计亮点 |
|---|---|---|
| vben | `packages/effects/request/src/request-client/request-client.ts`<br>`.../modules/interceptor.ts`<br>`.../preset-interceptors.ts` | **拦截器注册式**：`client.addRequestInterceptor(fn)`，可插拔、可测试、按注册序执行 |
| soybean | `packages/axios/src/index.ts`<br>`src/service/request/index.ts` | **工厂函数**：`createRequest()` / `createFlatRequest()` 返回两个语义不同的实例 |
| vue-fastapi-admin | `web/src/utils/http/` | 传统 axios 实例 + 拦截器，简单直接 |

vben 把拦截器拆成 `modules/interceptor.ts` 里的独立类，好处是**每个拦截器可以单测**，且调用顺序显式可控：

```ts
// 概念示意：vben 的 RequestClient 拦截器管理
type RequestInterceptor = (config: RequestConfig) => RequestConfig | Promise<RequestConfig>;

class RequestClient {
  private requestInterceptors: RequestInterceptor[] = [];
  addRequestInterceptor(fn: RequestInterceptor) {
    this.requestInterceptors.push(fn);
    return this;
  }
}
```

### 1.2 落地实现（Vue 3 + TS + axios）```ts
// src/service/request/index.ts
import axios, {
  type AxiosInstance,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from 'axios';
import { useAuthStore } from '@/store/modules/auth';
import { getToken } from '@/utils/auth';

const BASE_URL = import.meta.env.VITE_API_BASE_URL;
const TIMEOUT = Number(import.meta.env.VITE_API_TIMEOUT ?? 15000);

/** 业务请求配置：在 axios 原生配置上扩展自定义项 */
export interface RequestOptions {
  /** 是否自动携带 token，默认 true */
  withToken?: boolean;
  /** 是否把响应体直接摊平（只返回 data 字段），默认 true */
  flatResponse?: boolean;
  /** 是否静默处理错误（不弹 toast），默认 false */
  silent?: boolean;
  /** 失败是否自动重试次数，默认 0 */
  retryCount?: number;
}

export type RequestConfig<D = unknown> = AxiosRequestConfig<D> & RequestOptions;

const instance: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: TIMEOUT,
  headers: { 'Content-Type': 'application/json;charset=utf-8' },
});

/* ---------- 请求拦截器 ---------- */
instance.interceptors.request.use(
  (config: InternalAxiosRequestConfig & RequestOptions) => {
    // 1) 注入 traceId：与后端日志的 trace_id 对齐，便于全链路排查
    config.headers.set('X-Request-Id', crypto.randomUUID());

    // 2) 注入语言，配合后端 i18n 中间件
    config.headers.set('Accept-Language', navigator.language);

    // 3) 注入 token（可关闭，用于登录/刷新接口）
    if (config.withToken !== false) {
      const token = getToken();
      if (token) config.headers.set('Authorization', `Bearer ${token}`);
    }

    // 4) GET 请求加时间戳防浏览器缓存（按需）
    if (config.method?.toLowerCase() === 'get' && config.params) {
      config.params._t = Date.now();
    }

    return config;
  },
  (error) => Promise.reject(error),
);

export { instance };
```

### 1.3 落地建议

- ✅ **拦截器只做「横切」的事**：注入 header、拼签名、日志埋点。业务判断放业务层。
- ✅ **`withToken` 这类开关要设计出来**，否则登录接口会被迫 hack。
- ✅ **注入 `X-Request-Id`**，并让后端日志记录它——这是前后端联调效率提升最大的一行代码。
- ❌ 不要在请求拦截器里做异步的「刷新 token 后重放」，那是响应拦截器的活。

---

## 2. 响应拦截器

### 2.1 标杆做法

后端统一响应体（03-后端工程化封装-FastAPI#3. 统一响应结构）决定了前端响应拦截器的形态。
主流约定：

```jsonc
// 成功
{ "code": 200, "msg": "success", "data": { } }
// 业务失败
{ "code": 40100, "msg": "用户名或密码错误", "data": null }
```

### 2.2 落地实现：含 token 刷新「单飞」与并发队列

> **⚠️ 注意：最容易写错的地方**
> 401 时如果每个失败请求都各自去刷新 token，会**并发打爆刷新接口**。
> 正确做法是「单飞（single-flight）」：第一个请求负责刷新，其余请求挂起排队，刷新完成后统一重放。

```ts
// src/service/request/index.ts（续）
import { ElMessage } from 'element-plus';
import { useAuthStore } from '@/store/modules/auth';

interface ApiResponse<T = unknown> {
  code: number;
  msg: string;
  data: T;
}

/** 刷新令牌的单飞控制 */
let refreshPromise: Promise<string> | null = null;

async function refreshTokenOnce(): Promise<string> {
  // 已有刷新在进行中，复用同一个 Promise —— 这就是单飞
  if (!refreshPromise) {
    refreshPromise = useAuthStore()
      .refreshToken()
      .finally(() => { refreshPromise = null; });
  }
  return refreshPromise;
}

instance.interceptors.response.use(
  (response) => {
    const body = response.data as ApiResponse;
    const opts = response.config as RequestConfig;

    // 非标准响应体（文件流、第三方接口）直接放行
    if (response.config.responseType === 'blob') return response.data;
    if (typeof body?.code === 'undefined') return response.data;

    // 业务成功
    if (body.code === 200) {
      return opts.flatResponse === false ? body : body.data;
    }

    // 业务失败：交由后端 response_code 体系驱动
    if (!opts.silent) ElMessage.error(body.msg || '请求失败');
    return Promise.reject(new BizError(body.code, body.msg, body.data));
  },
  async (error) => {
    const { response, config } = error;
    const opts = (config ?? {}) as RequestConfig;

    // ---- 401：令牌过期，单飞刷新后重放 ----
    if (response?.status === 401 && !config._retried) {
      config._retried = true;
      try {
        await refreshTokenOnce();
        return instance.request(config);   // 重放原请求
      } catch {
        useAuthStore().logout();
        return Promise.reject(error);
      }
    }

    // ---- 网络层错误码映射 ----
    const message = {
      400: '请求参数有误',
      403: '没有权限访问该资源',
      404: '请求的资源不存在',
      422: '参数校验未通过',
      429: '操作过于频繁，请稍后重试',
      500: '服务器内部错误',
      502: '网关错误',
      503: '服务暂不可用',
    }[response?.status] ?? (error.code === 'ECONNABORTED' ? '请求超时' : '网络异常');

    if (!opts.silent) ElMessage.error(message);
    return Promise.reject(error);
  },
);

/** 业务异常：携带 code，便于上层按码分支处理 */
export class BizError extends Error {
  constructor(public code: number, msg: string, public data?: unknown) {
    super(msg);
    this.name = 'BizError';
  }
}
```

### 2.3 落地建议

- ✅ **401 与 403 必须区分**：401 是「你是谁不知道」→ 刷新/跳登录；403 是「知道你是谁但没权限」→ 提示无权限，**不要**踢回登录页。
- ✅ 把 `flatResponse` 做成开关：`const res = await request.get<Page<User>>(...)` 拿到的直接是 `data`，减少 `res.data.data`。
- ✅ 业务错误码用一个 `BizError` 包装，避免上层到处 `if (res.code !== 200)`。
- ✅ 响应拦截器内**不要**直接 `router.push`，通过 `authStore.logout()` 间接处理，避免循环依赖。
- ⚠️ 重放请求要标记 `_retried`，否则刷新失败会无限递归。

---

## 3. API 统一封装

### 3.1 分层：类型 / 请求函数 / 组合式 Hook```ts
// src/api/system/user.ts —— 只放类型与路径常量
export interface UserVO {
  id: number;
  username: string;
  nickname?: string;
  deptId?: number;
  status: 0 | 1;
  createTime: string;
}

export interface UserQuery {
  page?: number;
  pageSize?: number;
  username?: string;
  status?: 0 | 1;
}

export const USER_API = {
  list: '/api/v1/system/users',
  detail: (id: number) => `/api/v1/system/users/${id}`,
  create: '/api/v1/system/users',
  update: (id: number) => `/api/v1/system/users/${id}`,
  remove: (id: number) => `/api/v1/system/users/${id}`,
} as const;
```

```ts
// src/service/api/user.ts —— 只放请求函数
import { request } from '@/service/request';
import { USER_API, type UserVO, type UserQuery } from '@/api/system/user';
import type { PageResult } from '@/api/types';

export const userApi = {
  list: (params: UserQuery) =>
    request.get<PageResult<UserVO>>(USER_API.list, { params }),

  detail: (id: number) =>
    request.get<UserVO>(USER_API.detail(id)),

  create: (data: Partial<UserVO>) =>
    request.post<UserVO>(USER_API.create, data),

  update: (id: number, data: Partial<UserVO>) =>
    request.put<UserVO>(USER_API.update(id), data),

  remove: (id: number) =>
    request.delete<void>(USER_API.remove(id)),

  /** 导出：responseType=blob，跳过统一响应体解析 */
  export: (params: UserQuery) =>
    request.get<Blob>(`${USER_API.list}/export`, {
      params,
      responseType: 'blob',
      flatResponse: false,
    }),
};
```

### 3.2 ⭐ 关键增量：用 FastAPI 的 OpenAPI 自动生成前端类型

这是 **Vue + FastAPI 组合最大的效率杠杆**——FastAPI 天然产出 OpenAPI 3.1 规范，前端可以据此自动生成 TS 类型，消灭「后端改字段、前端不知情」。

```bash
# package.json scripts
# 1) 从运行中的 FastAPI 拉取 openapi.json
"api:sync": "curl -s http://localhost:8000/api/v1/openapi.json -o openapi.json",

# 2) 生成 TS 类型与调用客户端
"api:gen": "openapi-typescript openapi.json -o src/api/schema.d.ts",
"api:gen:client": "openapi-typescript-codegen -i openapi.json -o src/api/generated --client axios"
```

```ts
// src/api/schema.d.ts 由 openapi-typescript 生成，直接复用
import type { components } from '@/api/schema';
export type UserVO = components['schemas']['UserRespVO'];
export type PageResult<T> = components['schemas']['PageResult_' & string] & { list: T[] };
```

> **💡 提示：三种落地强度，按团队接受度递进**
> 1. **弱**：手工维护 TS 类型（现状，易漂移）
> 2. **中**：CI 里跑 `api:sync && api:gen`，类型不一致就构建失败 ← **推荐起点**
> 3. **强**：全量用 `openapi-typescript-codegen` 生成调用函数，业务层只做组合

### 3.3 落地建议

- ✅ API 路径统一收敛到常量对象，禁止在业务组件里写裸字符串路径。
- ✅ 请求函数返回**已解包的类型**（`Promise<UserVO>` 而不是 `Promise<AxiosResponse>`）。
- ✅ 每个领域一个文件（`user.ts` / `role.ts` / `menu.ts`），文件内导出 `xxxApi` 对象。
- ✅ 分页/导出/上传这三类「特殊形态」统一在 `service/request` 里提供专用方法，不要每个业务各写一遍。

---

## 4. 路由守卫

### 4.1 标杆做法：守卫按职责拆文件

| 项目 | 文件 | 职责 |
|---|---|---|
| soybean | `src/router/guard/index.ts` | 注册器，统一 `setupRouterGuard()` |
| | `src/router/guard/route.ts` | 鉴权、动态路由注入 |
| | `src/router/guard/progress.ts` | NProgress 进度条 |
| | `src/router/guard/title.ts` | document.title |
| vben | `apps/web-antd/src/router/guard.ts` | 单一守卫 + `createRouterGuard` |
| | `apps/web-antd/src/router/access.ts` | 动态路由生成（与守卫解耦） |
| vue-fastapi-admin | `web/src/router/guard/` | 目录形式 |

> **💡 提示：精髓**
> **「守卫（流程控制）」与「动态路由生成（数据获取 + 转换）」必须分文件**。
> 前者是纯流程，后者是纯函数 + 请求，混在一起后极难测试。

### 4.2 三类路由的划分```ts
// src/router/routes/index.ts
/** 1) 静态路由：所有人可见，无需鉴权 */
export const staticRoutes: RouteRecordRaw[] = [
  { path: '/login', name: 'Login', component: () => import('@/views/login/index.vue'), meta: { title: '登录' } },
  { path: '/403', name: 'Forbidden', component: () => import('@/views/error/403.vue') },
  { path: '/404', name: 'NotFound', component: () => import('@/views/error/404.vue') },
];

/** 2) 根路由：布局壳，其 children 由动态路由注入 */
export const rootRoute: RouteRecordRaw = {
  path: '/',
  name: 'Root',
  component: () => import('@/layouts/base-layout/index.vue'),
  redirect: '/workbench',
  children: [],
};

/** 3) 兜底路由：必须在动态路由注入后添加 */
export const fallbackRoute: RouteRecordRaw = {
  path: '/:pathMatch(.*)*',
  name: 'CatchAll',
  redirect: '/404',
};
```

### 4.3 守卫实现```ts
// src/router/guard/route.ts
import type { Router } from 'vue-router';
import { useAuthStore } from '@/store/modules/auth';
import { useRouteStore } from '@/store/modules/route';
import { getToken } from '@/utils/auth';

/** 无需登录即可访问的路由名 */
const WHITE_LIST = new Set(['Login', 'Forbidden', 'NotFound']);

export function createRouteGuard(router: Router) {
  router.beforeEach(async (to) => {
    const authStore = useAuthStore();
    const routeStore = useRouteStore();
    const token = getToken();

    // ---- 场景 1：未登录 ----
    if (!token) {
      if (WHITE_LIST.has(to.name as string)) return true;
      return { name: 'Login', query: { redirect: to.fullPath } };
    }

    // ---- 场景 2：已登录但访问登录页 → 回首页 ----
    if (to.name === 'Login') return { path: '/' };

    // ---- 场景 3：已登录但动态路由尚未初始化 ----
    if (!routeStore.isRouteInitialized) {
      try {
        // 1. 拉取用户信息（含权限码、角色）
        await authStore.loadUserInfo();
        // 2. 拉取菜单树并生成动态路由
        const dynamicRoutes = await routeStore.generateRoutes(authStore.roles);
        dynamicRoutes.forEach((r) => router.addRoute(r));
        // 3. 注入兜底路由（必须在动态路由之后）
        router.addRoute(fallbackRoute);
        // 4. 用 replace 重进当前目标，让新路由生效
        return { ...to, replace: true };
      } catch (e) {
        await authStore.logout();
        return { name: 'Login', query: { redirect: to.fullPath } };
      }
    }

    return true;
  });
}
```

```ts
// src/router/guard/progress.ts
import NProgress from 'nprogress';
import 'nprogress/nprogress.css';
import type { Router } from 'vue-router';

NProgress.configure({ showSpinner: false, minimum: 0.15 });

export function createProgressGuard(router: Router) {
  router.beforeEach(() => { NProgress.start(); return true; });
  router.afterEach(() => { NProgress.done(); });
  router.onError(() => { NProgress.done(); });
}
```

```ts
// src/router/guard/title.ts
import type { Router } from 'vue-router';

const BASE_TITLE = import.meta.env.VITE_APP_TITLE;

export function createTitleGuard(router: Router) {
  router.afterEach((to) => {
    document.title = to.meta?.title ? `${to.meta.title} - ${BASE_TITLE}` : BASE_TITLE;
  });
}
```

```ts
// src/router/index.ts —— 注册器，聚合所有守卫
import { createRouter, createWebHistory } from 'vue-router';
import { staticRoutes, rootRoute } from './routes';
import { createRouteGuard } from './guard/route';
import { createProgressGuard } from './guard/progress';
import { createTitleGuard } from './guard/title';

const router = createRouter({
  history: createWebHistory(import.meta.env.VITE_BASE_URL),
  routes: [rootRoute, ...staticRoutes],
  scrollBehavior: () => ({ left: 0, top: 0 }),
});

export function setupRouterGuard() {
  createProgressGuard(router);
  createRouteGuard(router);
  createTitleGuard(router);
}

export { router };
```

### 4.4 落地建议

- ✅ **`return { ...to, replace: true }` 是动态路由的必备写法**，否则首次进入的目标路由不会被匹配到（典型症状：白屏或跳 404）。
- ✅ 白名单用 `Set<RouteName>` 而不是 `string[]`，避免前缀误匹配。
- ✅ 兜底 404 路由**必须在 `addRoute` 动态路由之后**添加，否则动态路由永远匹配不上。
- ✅ 守卫里只做「判权限、取数据、重定向」，不要写业务逻辑。
- ⚠️ 用 `pinia` 前必须确保 `app.use(pinia)` 早于 `setupRouterGuard()`，否则守卫内 `useAuthStore()` 会报错。

---

## 5. 状态管理（Pinia）

### 5.1 标杆做法：模块化 + 双文件

soybean 的每个 store 模块都是**双文件**：

```
src/store/modules/auth/
├── index.ts     # store 定义（state / getters / actions）
└── shared.ts    # 纯函数：与 store 无关的可测逻辑
```

vben 把 store 抽成独立包 `packages/stores/src/modules/{user,access,tabbar,timezone}.ts`，通过 `packages/stores/src/setup.ts` 统一注册 Pinia 插件。

### 5.2 模块划分与边界

| 模块 | 职责 | 不该做什么 |
|---|---|---|
| `auth` | token、用户信息、角色、权限码 | 不存 UI 状态 |
| `route` | 菜单树、动态路由、`isRouteInitialized` | 不做请求拦截 |
| `tab` | 多页签、缓存名单 | 不存业务数据 |
| `app` | 侧栏折叠、语言、主题、设备类型 | 不存鉴权信息 |
| `dict` | 字典缓存（高频只读数据） | 不做写操作 |

```ts
// src/store/modules/auth/index.ts
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { authApi } from '@/service/api/auth';
import { setToken, clearToken, getToken } from '@/utils/auth';
import type { UserVO } from '@/api/system/user';

export const useAuthStore = defineStore('auth', () => {
  /* ---- state ---- */
  const token = ref<string>(getToken() ?? '');
  const userInfo = ref<UserVO | null>(null);
  const roles = ref<string[]>([]);
  const permissions = ref<string[]>([]);

  /* ---- getters ---- */
  const isLogin = computed(() => Boolean(token.value));
  const isSuperAdmin = computed(() => roles.value.includes('super_admin'));

  /* ---- actions ---- */
  async function login(payload: { username: string; password: string }) {
    const res = await authApi.login(payload);
    token.value = res.accessToken;
    setToken(res.accessToken);          // 持久化到 localStorage
    return res;
  }

  async function loadUserInfo() {
    const res = await authApi.getUserInfo();
    userInfo.value = res.user;
    roles.value = res.roles;
    permissions.value = res.permissions;
    return res;
  }

  async function refreshToken() {
    const res = await authApi.refresh();
    token.value = res.accessToken;
    setToken(res.accessToken);
    return res.accessToken;
  }

  async function logout() {
    try { await authApi.logout(); } catch { /* 忽略登出接口失败 */ }
    token.value = '';
    userInfo.value = null;
    roles.value = [];
    permissions.value = [];
    clearToken();
  }

  return { token, userInfo, roles, permissions, isLogin, isSuperAdmin, login, loadUserInfo, refreshToken, logout };
});
```

```ts
// src/store/index.ts —— Pinia 实例 + 持久化插件
import { createPinia } from 'pinia';
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate';

export const pinia = createPinia();
pinia.use(piniaPluginPersistedstate);
```

### 5.3 落地建议

- ✅ **统一用 Setup Store（组合式）**，比 Options Store 的类型推导更准，也更好复用逻辑。
- ✅ **token 单独持久化，不要整 store 持久化**——`userInfo`、`permissions` 应每次刷新重拉，避免权限变更后前端仍显示旧菜单。
- ✅ 高频只读数据（字典、枚举）放 `dict` store 并做**缓存 + TTL**，不要每个页面各拉一次。
- ✅ `shared.ts` 模式值得学：把「菜单树 → 路由树」这类转换写成**纯函数**，可单测、可在 store 外复用。
- ❌ 不要在 store 里直接操作 `router`，通过返回值让守卫决定跳转。

---

## 6. 权限控制

### 6.1 四个层级（缺一不可）

| 层级 | 控制对象 | 实现位置 | 标杆 |
|---|---|---|---|
| L1 路由级 | 能否进入某页面 | `router.addRoute` 动态注册 | vben `router/access.ts` |
| L2 菜单级 | 侧栏显示哪些项 | 后端返回菜单树 → 生成路由 | vben `api/core/menu.ts` |
| L3 按钮级 | 能否点某个按钮 | `v-permission` 指令 + `useAccess()` | vben `effects/access/src/directive.ts` |
| L4 接口级 | 能否调某个接口 | **后端** RBAC / Casbin | 03-后端工程化封装-FastAPI#8. 鉴权 |

> **🚫 危险：最常见的安全事故**
> **只做 L1/L2/L3，不做 L4。** 前端的权限控制全部可被绕过（改 JS、直接调接口）。
> 前端权限是「体验」，后端权限才是「安全」。二者必须用**同一套权限码**。

### 6.2 权限码设计（前后端共用）```
格式：<域>:<资源>:<动作>
示例：
  system:user:list     查询用户列表
  system:user:create   新增用户
  system:user:delete   删除用户
  system:role:assign   分配角色
  *:*:*                超级管理员通配
```

### 6.3 按钮级权限：指令 + Hook```ts
// src/directives/permission.ts
import type { App, Directive, DirectiveBinding } from 'vue';
import { useAuthStore } from '@/store/modules/auth';

type Value = string | string[] | { all?: string[]; any?: string[] };

function check(value: Value): boolean {
  const { permissions, isSuperAdmin } = useAuthStore();
  if (isSuperAdmin) return true;                     // 超管直通
  if (typeof value === 'string') return permissions.includes(value);
  if (Array.isArray(value)) return value.every((p) => permissions.includes(p));
  if (value.all) return value.all.every((p) => permissions.includes(p));
  if (value.any) return value.any.some((p) => permissions.includes(p));
  return false;
}

const vPermission: Directive<HTMLElement, Value> = {
  mounted(el, binding: DirectiveBinding<Value>) {
    if (!check(binding.value)) {
      // 直接移除比 display:none 更安全（避免被改样式恢复）
      el.parentNode?.removeChild(el);
    }
  },
};

export function setupDirectives(app: App) {
  app.directive('permission', vPermission);
}
```

```vue
<!-- 用法 -->
<template>
  <!-- 单权限 -->
  <el-button v-permission="'system:user:create'" type="primary">新增</el-button>

  <!-- 多权限（全部满足） -->
  <el-button v-permission="['system:user:update', 'system:user:delete']">批量操作</el-button>

  <!-- 组合式：需要在 JS 里判断时 -->
  <el-table-column v-if="hasAccess.any(['system:user:update'])" label="操作">
    <template #default="{ row }">
      <el-button @click="edit(row)">编辑</el-button>
    </template>
  </el-table-column>
</template>

<script setup lang="ts">
import { useAccess } from '@/hooks/common/use-access';

const hasAccess = useAccess();
function edit(row: any) { /* ... */ }
</script>
```

```ts
// src/hooks/common/use-access.ts —— 对标 vben 的 useAccess
import { useAuthStore } from '@/store/modules/auth';

export function useAccess() {
  const authStore = useAuthStore();

  const has = (code: string) => authStore.isSuperAdmin || authStore.permissions.includes(code);
  const any = (codes: string[]) => authStore.isSuperAdmin || codes.some(has);
  const all = (codes: string[]) => authStore.isSuperAdmin || codes.every(has);

  return { has, any, all };
}
```

### 6.4 动态路由生成（菜单树 → 路由树）```ts
// src/router/access.ts —— 纯函数，可单测
import type { RouteRecordRaw } from 'vue-router';

export interface MenuVO {
  id: number;
  name: string;
  path: string;
  component: string;      // 后端返回的组件路径，如 "system/user/index"
  icon?: string;
  type: 'CATALOG' | 'MENU' | 'BUTTON';
  permission?: string;
  children?: MenuVO[];
}

// Vite 的 glob 导入：把字符串路径映射成真实组件
const modules = import.meta.glob('@/views/**/*.vue');

function resolveComponent(componentPath: string) {
  const key = `/src/views/${componentPath}.vue`;
  return modules[key] ?? (() => import('@/views/error/404.vue'));
}

/** 菜单树 → 路由树 */
export function transformMenuToRoutes(menus: MenuVO[]): RouteRecordRaw[] {
  return menus
    .filter((m) => m.type !== 'BUTTON')      // 按钮不生成路由
    .map((menu) => {
      const route: RouteRecordRaw = {
        path: menu.path,
        name: menu.name,
        meta: {
          title: menu.name,
          icon: menu.icon,
          permission: menu.permission,
          keepAlive: true,
        },
        children: [],
      } as RouteRecordRaw;

      if (menu.children?.length) {
        route.children = transformMenuToRoutes(menu.children);
      } else if (menu.component) {
        route.component = resolveComponent(menu.component);
      }
      return route;
    });
}
```

> **💡 提示：两种动态路由方案怎么选**
> | 方案 | 做法 | 优点 | 缺点 |
> |---|---|---|---|
> | **后端下发组件路径** | 后端存 `component: "system/user/index"` | 菜单改了不用发版 | 前后端强耦合，组件重命名要同步改库 |
> | **前端全量注册 + 按权限过滤** | 前端维护完整路由表，按 `meta.permission` 过滤 | 类型安全、可静态分析 | 新增菜单要发版 |
>
> **推荐**：中后台用前者（运营可自助配菜单），C 端用后者（路由固定、权限简单）。

### 6.5 落地建议

- ✅ 权限码**必须**前后端共用一套字符串，建议由后端在菜单/权限接口里下发，前端不硬编码。
- ✅ `v-permission` 用 **DOM 移除** 而非 `display:none`。
- ✅ 超管走通配 `*:*:*` 而不是把全部权限塞进数组（否则权限数组会膨胀到几百项）。
- ✅ `transformMenuToRoutes` 抽成纯函数放 `shared.ts`，方便写单测覆盖边界（空 children、未知组件）。
- ❌ 不要用 `role === 'admin'` 这类硬编码判断，角色会变，权限码不会。

---

## 7. 环境配置

### 7.1 标杆做法：多文件 + 类型声明 + 构建期校验

| 项目 | 文件 | 特点 |
|---|---|---|
| vben | `apps/web-antd/.env`<br>`.env.development`<br>`.env.production`<br>`.env.analyze` | **每个 app 独立 env**（monorepo 必需） |
| soybean | `.env` / `.env.test` / `.env.prod` | 多了 test 环境 |
| vue-fastapi-admin | `web/.env.*` | 常规三件套 |

### 7.2 落地实现```bash
# .env                  —— 所有环境共享
VITE_APP_TITLE=Vue FastAPI Admin
VITE_API_BASE_URL=/api
VITE_API_TIMEOUT=15000
VITE_BASE_URL=/

# .env.development      —— 开发环境（走 Vite 代理）
VITE_API_BASE_URL=/api
VITE_PROXY_TARGET=http://127.0.0.1:8000
VITE_MOCK_ENABLED=true

# .env.test             —— 测试环境
VITE_API_BASE_URL=https://test-api.example.com/api
VITE_MOCK_ENABLED=false

# .env.production       —— 生产环境（同域，由 Nginx 反代）
VITE_API_BASE_URL=/api
VITE_MOCK_ENABLED=false
VITE_DROP_CONSOLE=true
```

```ts
// src/typings/env.d.ts —— 让 import.meta.env 有类型
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_TITLE: string;
  readonly VITE_API_BASE_URL: string;
  readonly VITE_API_TIMEOUT?: string;
  readonly VITE_BASE_URL: string;
  readonly VITE_PROXY_TARGET?: string;
  readonly VITE_MOCK_ENABLED?: string;
  readonly VITE_DROP_CONSOLE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

```ts
// src/constants/env.ts —— 统一出口，业务代码不直接用 import.meta.env
const raw = import.meta.env;

/** 缺失即抛错：把「配置错误」从运行时提前到构建时 */
function required(key: keyof ImportMetaEnv): string {
  const value = raw[key];
  if (!value) throw new Error(`[env] 缺少必需的环境变量：${key}`);
  return value;
}

export const ENV = {
  mode: raw.MODE,
  isDev: raw.DEV,
  isProd: raw.PROD,
  appTitle: required('VITE_APP_TITLE'),
  apiBaseUrl: required('VITE_API_BASE_URL'),
  apiTimeout: Number(raw.VITE_API_TIMEOUT ?? 15000),
  baseUrl: raw.VITE_BASE_URL ?? '/',
  mockEnabled: raw.VITE_MOCK_ENABLED === 'true',
} as const;
```

```ts
// vite.config.ts —— 开发代理，解决跨域
import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');

  return {
    base: env.VITE_BASE_URL ?? '/',
    plugins: [vue()],
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: env.VITE_PROXY_TARGET ?? 'http://127.0.0.1:8000',
          changeOrigin: true,
          // FastAPI 的路径已带 /api/v1 前缀，通常不需要 rewrite
          // rewrite: (p) => p.replace(/^\/api/, ''),
        },
      },
    },
    esbuild: {
      // 生产构建剥离 console / debugger
      drop: env.VITE_DROP_CONSOLE === 'true' ? ['console', 'debugger'] : [],
    },
    build: {
      chunkSizeWarningLimit: 1500,
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-vue': ['vue', 'vue-router', 'pinia'],
            'vendor-ui': ['element-plus'],
          },
        },
      },
    },
  };
});
```

### 7.3 落地建议

- ✅ **只暴露 `VITE_` 前缀变量**，其余变量不会被打进客户端产物——不要在 `.env` 里写密钥。
- ✅ 业务代码**只从 `src/constants/env.ts` 读配置**，不直接 `import.meta.env`，便于以后换实现（如运行时配置）。
- ✅ 生产环境用 `VITE_API_BASE_URL=/api` + Nginx 反代，**避免跨域**（比 CORS 配置更省心，也避免 `allow_credentials` 的坑）。
- ✅ `.env.local` 加入 `.gitignore`，用于开发者本地覆盖。
- ⚠️ Vite 的 `import.meta.env` 是**构建期静态替换**，无法运行时改。若需运行时配置（同一份产物多环境部署），要用 `/config.js` 方案。

---

## 8. 工程规范（被低估的一环）

| 项 | 工具 | 标杆做法 |
|---|---|---|
| 代码检查 | ESLint (flat config) | vben `internal/lint-configs/eslint-config` 抽成独立包 |
| 格式化 | Prettier / oxfmt | vben 已迁移到 `oxfmt` + `oxlint`（Rust 实现，快） |
| 样式检查 | Stylelint | soybean `stylelint.config.mjs` |
| 提交规范 | Commitlint + Husky/lefthook | vben `lefthook.yml` + `.commitlintrc.js` |
| 版本发布 | Changesets | vben `.changeset/`（monorepo 必需） |
| 类型检查 | vue-tsc | `tsconfig` 分层：base / library / node / web |
| 单元测试 | Vitest + Vue Test Utils | soybean `packages/*/src/__tests__` |
| E2E | Playwright | vben `playground/playwright.config.ts` |

> **💡 提示：一个高性价比的小改动**
> 把 `tsconfig.json` 拆成 `base.json` + `web-app.json` + `node.json`（参照 vben `internal/tsconfig/`），
> 前端代码与构建脚本分开约束，能消掉大量「构建脚本里用了 DOM 类型」的报错。

---

## 相关笔记

- 03-后端工程化封装-FastAPI — 响应拦截器依赖的「统一响应结构」在这里定义
- 05-落地蓝图与检查清单 — 前端目录树与验收 checklist
- 06-重点项目案例卡片 — 本节各项目的完整拆解

---
- 上一页：01-项目筛选清单
- 下一页：03-后端工程化封装-FastAPI
