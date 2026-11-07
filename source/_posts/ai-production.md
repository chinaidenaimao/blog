---
title: "AI 应用生产落地与选型"
date: 2026-08-16 21:20:00
cover: /img/covers/ai-production.svg
top_img: /img/covers/ai-production.svg
description: "前面的笔记讲「怎么用」，这一页讲「什么时候用、怎么上线、哪里会翻车」。 包含一个选型决策树、FastAPI 集成方案、以及一份踩坑清单。"
categories:
  - AI
tags:
  - 选型
  - 生产
  - AI
---

> **📋 摘要：本页目标**
> 前面的笔记讲「怎么用」，这一页讲「什么时候用、怎么上线、哪里会翻车」。
> 包含一个选型决策树、FastAPI 集成方案、以及一份踩坑清单。

---

## 一、选型：先问「真的需要 Agent 吗」```mermaidgraph TD
    A["需求"] --> B{"步骤固定吗?"}
    B -->|"固定"| C["普通代码/工作流引擎<br/>别用 LLM 编排"]
    B -->|"不固定"| D{"需要多轮决策吗?"}
    D -->|"不需要"| E["单次或几次 LLM 调用<br/>自己写函数即可"]
    D -->|"需要"| F{"需要循环/人工介入/长任务?"}
    F -->|"不需要"| G["create_agent 够了"]
    F -->|"需要"| H["自己画 StateGraph"]
```

| 场景 | 推荐 | 理由 |
|---|---|---|
| 总结、分类、抽取、翻译 | **不用框架** | 一次调用，`openai.chat.completions` 或 `init_chat_model` 足够 |
| 固定的多步流程 | **普通代码** | 流程确定时 LLM 只增加不确定性和成本 |
| 目标明确、路径不定、可拆成工具 | `create_agent` | 这正是它的设计场景 |
| 需要条件分支、并行、人工审批、断点续跑 | **StateGraph** | 模板表达不了，需要自己画图 |
| 多 Agent 协作 | StateGraph + 子图 | `create_agent` 本身是图，可当节点嵌进去 |

> **🚫 危险：最常见的过度设计**
> 用 Agent 做一个「三步固定流程」——先总结、再翻译、再分类。
>
> 这会带来三个问题：**成本翻倍**（每步都要带上下文）、**延迟不可控**（多轮循环）、
> **结果不确定**（同样输入可能走不同路径）。
>
> **路径完全确定的，用普通代码。**

---

## 二、`create_agent` vs 自己画图

| | `create_agent` | StateGraph |
|---|---|---|
| 代码量 | 10 行 | 100+ 行 |
| 灵活性 | 模型→工具循环 | 任意图结构 |
| 可控性 | 靠中间件 | 完全控制 |
| 适合 | 80% 的 Agent 需求 | 复杂编排 |
| 调试难度 | 低 | 高（要画图、看状态） |

> **💡 提示：实践中的渐进路径**
> 1. 先用 `create_agent` + 中间件，能覆盖大部分需求
> 2. 不够了，**不要推翻重来**——`create_agent` 返回的就是 `CompiledStateGraph`，
>    可以用 `add_node` 往上面继续加，或者把它当子图嵌进自己的图
>
> ```python
> agent = create_agent(model=..., tools=[...])
>
> g = StateGraph(MyState)
> g.add_node("router", router_node)
> g.add_node("agent", agent)          # ← 整个 Agent 作为一个节点
> g.add_node("review", review_node)
> ```

---

## 三、可观测性：LangSmith

不上 LangSmith，Agent 出问题你基本是盲猜。

```bash
pip install langsmith
```

```bash
# .env
LANGSMITH_TRACING=true
LANGSMITH_API_KEY=lsv2_...
LANGSMITH_PROJECT=my-agent-prod
```

**零代码改动**——LangChain 自动埋点。你能看到：

- 每次 `invoke` 的完整轨迹（哪些节点、耗时、输入输出）
- 每次模型调用的 prompt / completion / token 数 / 成本
- 每次工具调用的参数与结果
- `interrupt` 发生在哪、谁批准的
- 失败栈

> **💡 提示：自托管替代**
> 不能上云的话，用 OpenTelemetry：
> ```python
> from langchain_core.tracers import ConsoleCallbackHandler
> agent.invoke(input, config={"callbacks": [ConsoleCallbackHandler()]})
> ```
> 生产上接 OTel Collector → Jaeger/Tempo，比 LangSmith 麻烦但数据在自己手里。

---

## 四、流式到前端

Agent 延迟高，**必须流式**。两种协议：

### 4.1 SSE（Server-Sent Events）```python
from fastapi import FastAPI
from fastapi.responses import StreamingResponse

app = FastAPI()


@app.post("/chat")
async def chat(payload: ChatReq):
    async def gen():
        # updates 流：驱动前端的步骤指示器
        for event in agent.stream(
            {"messages": payload.messages},
            stream_mode="updates",
            config={"configurable": {"thread_id": payload.thread_id}},
        ):
            for node, out in event.items():
                yield f"event: step\ndata: {node}\n\n"

        # messages 流：驱动正文打字机
        async for chunk, meta in agent.astream(
            {"messages": payload.messages},
            stream_mode="messages",
            config={"configurable": {"thread_id": payload.thread_id}},
        ):
            if chunk.content:
                yield f"event: token\ndata: {chunk.content}\n\n"

        yield "event: done\ndata: [DONE]\n\n"

    return StreamingResponse(gen(), media_type="text/event-stream")
```

### 4.2 等模型厂商的 SSE 协议

如果要给前端用 Vercel AI SDK 之类的客户端，可以让 LangGraph 输出对应格式。
自建成本不低，**优先考虑直接用 LangGraph Platform**（见下）。

---

## 五、部署

### 5.1 方案对比

| 方案 | 适合 | 成本 |
|---|---|---|
| 直接嵌入 FastAPI | 已有后端，Agent 是其中一个模块 | 低 |
| LangGraph Platform（云） | 快速上线、要官方流式协议 | 中 |
| LangGraph Server（自托管 Docker） | 数据不能出网 | 中 |
| 纯 LangChain + 自己的编排 | 简单 Agent | 低 |

> **💡 提示：大多数团队的正确答案**
> **把 Agent 当成 FastAPI 里的一个 service**，不要一上来就拆独立服务。
>
> 理由：Agent 需要你的业务数据、权限校验、用户体系，拆开后要么重复造轮子，要么跨服务调用。
> 等 Agent 成为独立产品线再拆。

### 5.2 嵌入 FastAPI 的目录结构```server/├── app/
│   ├── agent/                 # ★ Agent 模块，与其它业务域平级
│   │   ├── graph.py           # create_agent / StateGraph 组装
│   │   ├── tools/             # 该 Agent 的工具
│   │   ├── middleware.py      # 中间件配置
│   │   ├── prompts.py         # 提示词（集中管理，别散落）
│   │   └── router.py          # SSE 流式接口
│   ├── system/
│   └── ...
├── common/                    # 复用之前的架构
└── core/conf.py               # API Key、模型名、限额都在这里
```

> **📝 说明：Agent 模块要遵守你现有的分层**
> `graph.py` 是**组装**（等价 router 层之上的装配），工具内部该调 `service` 就调 `service`，
> 不要让 Agent 绕过业务层直接操作数据库。见 03-后端工程化封装-FastAPI。

### 5.3 checkpointer 必须外置```python
# 单机
from langgraph.checkpoint.sqlite import SqliteSaver

with SqliteSaver.from_conn_string(settings.DB_URL) as saver:
    app = graph.compile(checkpointer=saver)

# 多实例：必须 PostgresSaver
# pip install langgraph-checkpoint-postgres
from langgraph.checkpoint.postgres import PostgresSaver
```

> **🚫 危险：多实例下 `InMemorySaver` 是事故源**
> 请求落到 Pod A，checkpoint 存在 Pod A 内存；下个请求落到 Pod B，读不到状态，
> `interrupt` 恢复直接失败。**上 K8s 就必须 PostgresSaver。**

---

## 六、接入 MCP 工具

MCP（Model Context Protocol）让你直接用别人写好的工具服务器，不用自己包一遍。

```bash
pip install langchain-mcp-adapters
```

```python
from langchain_mcp_adapters.client import MultiServerMCPClient

client = MultiServerMCPClient({
    "filesystem": {
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-filesystem", "/data"],
        "transport": "stdio",
    },
    "github": {
        "url": "https://api.githubcopilot.com/mcp/",
        "transport": "http",
    },
})

tools = await client.get_tools()
agent = create_agent(model="openai:gpt-4o-mini", tools=tools)
```

> **⚠️ 注意：第三方 MCP 工具必须当「不可信输入」处理**
> MCP 工具返回的内容会进入模型上下文，**它是一段可被注入的文本**。
> 恶意或失控的 MCP 服务器可以让你家的 Agent 执行任意操作。
> 只连自己控制的服务器；权限最小化；高危工具照旧配 `HumanInTheLoopMiddleware`。

---

## 七、踩坑清单

| 现象 | 原因 | 解法 |
|---|---|---|
| 自定义模型报 `NotImplementedError` | 没实现 `bind_tools` | 补一个返回 `self` 的实现 |
| `Send` 报 `InvalidUpdateError` | 从节点返回了 `Send` 列表 | 改成条件边返回 |
| `get_state` 报 `No checkpointer set` | `compile()` 没传 checkpointer | 补上 |
| Agent 无限循环，费用暴涨 | 没设调用限额 | `ModelCallLimitMiddleware` |
| `GraphRecursionError` | 超过默认 `recursion_limit=25` | 先查环的退出条件，再考虑调大 |
| 多轮对话「失忆」 | 每次都用新 `thread_id` | 用稳定 ID，见第 15 篇 |
| 长会话报上下文超限 | 历史无限增长 | `SummarizationMiddleware` 或换长上下文模型 |
| PII 泄露到输出 | `PIIMiddleware` 的 `apply_to_output` 默认 `False` | 显式打开 |
| 多 Pod 部署状态丢失 | 用了 `InMemorySaver` | 换 `PostgresSaver` |
| 重跑导致副作用重复 | 节点非幂等 | 加去重键 / 状态机 / 分布式锁 |
| 用 `create_react_agent` 报弃用警告 | 旧入口 | 改 `from langchain.agents import create_agent` |
| 装了 `langchain-classic` | 跟着旧教程走 | 卸载，用 1.x API |

---

## 八、反模式

> **⚠️ 注意：这些设计看起来合理，实际有害**

| 反模式 | 问题 |
|---|---|
| 用 Agent 做固定流程 | 成本、延迟、不确定性全部恶化 |
| 提示词散落在代码各处 | 无法 review、无法 A/B、无法回滚 |
| 不设调用限额 | 一个死循环就能烧掉一个月预算 |
| 依赖模型「自觉」遵守安全规则 | 提示词注入可绕过，必须有代码级闸门 |
| 工具返回整个数据库表 | 撑爆上下文，先聚合再返回 |
| 把业务逻辑写进提示词 | 不可测试、不可回归 |
| 不上 tracing | 出问题只能猜 |
| 一次给模型 50 个工具 | 选择困难、token 浪费；用 `LLMToolSelectorMiddleware` 或分组 |

---

## 九、验收清单

- [ ] 能画出选型决策树，并说清「什么情况不该用 Agent」
- [ ] 知道 `create_agent` 可以当节点嵌进自己的图
- [ ] 配好了 LangSmith 或 OTel tracing
- [ ] 实现了 SSE 流式接口
- [ ] 生产环境用了外置 checkpointer
- [ ] 给高危工具配了人工审批
- [ ] 检查过一遍第七节的踩坑清单

---

## 相关笔记

- 15-检查点、中断与持久化 — checkpointer / store 的详细机制
- 13-中间件机制 — 人机协同、限额、摘要
- 03-后端工程化封装-FastAPI — Agent 服务最终要落到这套架构上
- 10-LangChain 与 LangGraph 索引

---
- 返回 10-LangChain 与 LangGraph 索引
