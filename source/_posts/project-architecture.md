---
title: "项目架构文档怎么写：一份可复用的模板"
date: 2026-04-14 21:10:00
cover: /img/covers/team.jpg
top_img: /img/covers/team.jpg
description: "┌─────────────────────────────────────────────────────────────────┐"
categories:
  - 后端
tags:
  - 架构
  - 文档
  - 工程化
---

## 1. 系统架构概览```
┌─────────────────────────────────────────────────────────────────┐
│                        用户界面层 (Frontend)                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │ 文档上传  │  │ 题目提取  │  │ 排版编辑  │  │ 题库管理  │        │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘        │
│                         Vue 3 + TypeScript                      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP/WebSocket
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        API 网关层 (FastAPI)                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │ 文件上传  │  │ 文档解析  │  │ AI 提取   │  │ 排版服务  │        │
│  │   API    │  │   API    │  │   API    │  │   API    │        │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘        │
└─────────────────────────────────────────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   文档处理    │    │   AI 模块    │    │   数据存储    │
│   服务       │    │   (LangChain)│    │   (SQLite)   │
│ PyMuPDF      │    │ OpenAI API   │    │  SQLAlchemy  │
│ pdfplumber   │    │ Prompt 模板  │    │  Alembic     │
│ python-docx  │    │ Chain 编排   │    │              │
└──────────────┘    └──────────────┘    └──────────────┘
```

## 2. 分层架构设计

### 2.1 表现层 (Presentation Layer)
- **前端**: Vue 3 单页应用 (SPA)
- **职责**: 用户界面渲染、用户交互、状态管理、路由导航
- **技术**: Vue 3 Composition API + TypeScript + Element Plus

### 2.2 API 网关层 (API Gateway Layer)
- **后端**: FastAPI RESTful API
- **职责**: 请求路由、参数验证、权限控制、响应格式化
- **技术**: FastAPI + Pydantic + JWT 认证

### 2.3 业务逻辑层 (Business Logic Layer)
- **服务层**: 处理核心业务逻辑
- **职责**: 文档处理、题目提取、排版生成、用户管理
- **技术**: Python 异步服务 + 依赖注入

### 2.4 数据访问层 (Data Access Layer)
- **ORM**: SQLAlchemy 2.0
- **职责**: 数据库 CRUD、事务管理、数据迁移
- **技术**: SQLAlchemy + Alembic

### 2.5 基础设施层 (Infrastructure Layer)
- **存储**: 文件存储 (本地/S3)、数据库
- **外部服务**: OpenAI API、向量数据库 (可选)

## 3. 核心模块设计

### 3.1 文档处理模块 (Document Processor)```
文档上传 → 格式识别 → 内容提取 → 结构化解析 → 存储
   │           │           │           │
   ▼           ▼           ▼           ▼
 保存文件   识别类型   提取文本/图片  解析题目结构
```

**支持格式**:
| 格式 | 解析库 | 处理方式 |
|------|--------|----------|
| PDF | PyMuPDF/pdfplumber | 文本提取 + 布局分析 |
| Word (.docx) | python-docx | 段落/表格解析 |
| 图片 | Tesseract OCR | OCR 文字识别 |

**核心类**:
```python
class DocumentProcessor:
    async def process(file: UploadFile) -> DocumentContent
    async def extract_text(content: DocumentContent) -> str
    async def extract_images(content: DocumentContent) -> List[Image]
    async def parse_structure(text: str) -> DocumentStructure
```

### 3.2 AI 提取模块 (AI Extractor)```
文档内容 → Prompt 构建 → LLM 调用 → 结果解析 → 题目结构化
   │           │           │           │
   ▼           ▼           ▼           ▼
 文本输入   模板填充    模型推理    JSON 解析   题目对象
```

**LangChain Chain 流程**:
```python
# 1. 文档分块 (大文档分段处理)
document_chain = load_summarize_chain | split_documents

# 2. 题目提取
extraction_chain = ChatPromptTemplate | llm | JsonOutputParser

# 3. 完整流程
full_chain = document_processor | chunker | extraction_chain | validator
```

### 3.3 排版引擎 (Layout Engine)```
题目数据 → 模板选择 → 样式应用 → 布局计算 → 预览/导出
   │           │           │           │
   ▼           ▼           ▼           ▼
 JSON 数据   选择模板   CSS 样式    响应式布局   PDF/HTML
```

**排版系统设计**:
- **模板系统**: 预定义多种排版模板 (试卷、练习册、笔记)
- **样式引擎**: CSS 变量 + 动态样式注入
- **布局计算**: Flexbox/Grid 布局，响应式适配
- **预览渲染**: Vue 3 实时渲染预览
- **导出功能**: HTML → PDF (使用 Puppeteer/wkhtmltopdf)

## 4. 数据流设计

### 4.1 文档上传流程```用户上传文件↓
前端校验 (格式/大小)
    ↓
FormData 上传到后端
    ↓
后端保存文件 + 创建文档记录
    ↓
异步触发文档处理任务
    ↓
文档处理完成 → 更新状态
    ↓
前端轮询/WebSocket 获取状态
    ↓
显示处理结果
```

### 4.2 AI 提取流程```用户触发 AI 提取↓
后端加载文档内容
    ↓
构建 LangChain Prompt
    ↓
调用 LLM (带重试机制)
    ↓
解析 LLM 输出 (JSON)
    ↓
验证和清洗数据
    ↓
保存提取的题目
    ↓
返回题目列表
```

### 4.3 排版生成流程```用户选择题目 + 模板↓
前端收集排版参数
    ↓
发送排版请求到后端
    ↓
后端生成排版 HTML
    ↓
返回 HTML + CSS
    ↓
前端实时渲染预览
    ↓
用户调整参数 (实时更新)
    ↓
导出 PDF/保存排版
```

## 5. 错误处理策略

### 5.1 前端错误处理
```typescript
// API 错误统一处理
api.interceptors.response.use(
  (response) => response,
  (error) => {
    ElMessage.error(error.response?.data?.message || '请求失败')
    return Promise.reject(error)
  }
)
```

### 5.2 后端错误处理```python
# 统一错误响应格式
@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "code": exc.status_code,
            "message": exc.detail,
            "data": None
        }
    )
```

### 5.3 AI 调用错误处理```python
# 重试机制
@retry(max_attempts=3, delay=1)
async def call_llm(prompt: str) -> str:
    try:
        return await llm.ainvoke(prompt)
    except RateLimitError:
        await asyncio.sleep(2)
        raise
    except Exception as e:
        logger.error(f"LLM call failed: {e}")
        raise
```

## 6. 安全设计

### 6.1 认证授权
- JWT Token 认证
- Token 过期自动刷新
- 基于角色的访问控制 (RBAC)

### 6.2 文件安全
- 文件类型白名单校验
- 文件大小限制 (20MB)
- 文件名清洗 (防止路径遍历)
- 上传目录隔离

### 6.3 API 安全
- CORS 配置
- 请求频率限制
- 输入参数校验 (Pydantic)
- SQL 注入防护 (ORM)

## 7. 性能优化

### 7.1 前端优化
- 路由懒加载
- 组件异步加载
- 图片懒加载
- 虚拟滚动 (长列表)

### 7.2 后端优化
- 异步 I/O (async/await)
- 数据库连接池
- Redis 缓存 (可选)
- 后台任务 (Celery/ARQ)

### 7.3 AI 调用优化
- Prompt 缓存
- 批量处理
- 流式响应 (SSE)
- 超时控制

## 8. 可扩展性设计

### 8.1 插件化架构
- 文档处理器可扩展 (添加新格式)
- AI Chain 可替换 (不同模型)
- 排版模板可插拔

### 8.2 微服务拆分准备
- 服务层设计为独立模块
- API 网关统一入口
- 数据库可独立部署
- 消息队列解耦 (未来)

## 9. 开发环境架构```开发环境:
┌─────────────────────────────────────────┐
│  前端 (Vite Dev Server)                  │
│  - HMR 热更新                           │
│  - API 代理到后端                        │
│  - TypeScript 类型检查                   │
└─────────────────────────────────────────┘
                   │
                   │ proxy /api
                   ▼
┌─────────────────────────────────────────┐
│  后端 (Uvicorn + Reload)                │
│  - 自动重载                             │
│  - SQLite 数据库                         │
│  - 本地文件存储                          │
└─────────────────────────────────────────┘
```

## 10. 生产环境架构```生产环境:
┌─────────────────────────────────────────┐
│  Nginx (反向代理 + 静态资源)              │
│  - 前端静态文件                          │
│  - API 代理                             │
│  - SSL/TLS                              │
└─────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────┐
│  Gunicorn + Uvicorn Workers             │
│  - 多进程                               │
│  - PostgreSQL 数据库                     │
│  - 对象存储 (S3/OSS)                    │
│  - Redis 缓存                           │
└─────────────────────────────────────────┘
```
