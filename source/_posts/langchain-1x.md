---
title: "LangChain 1.x 心智模型与最小上手"
date: 2026-06-20 22:00:00
cover: /img/covers/ai-hologram.jpg
top_img: /img/covers/ai-hologram.jpg
description: "从零跑通第一个 Agent。只讲必须知道的，不讲历史、不讲原理——那些在后面几篇。 所有代码都在 langchain 1.4.7 上实跑通过。"
categories:
  - AI
tags:
  - LangChain
  - LLM
  - 入门
---

> **📋 摘要：本页目标**
> 从零跑通第一个 Agent。只讲**必须知道的**，不讲历史、不讲原理——那些在后面几篇。
> 所有代码都在 `langchain 1.4.7` 上实跑通过。

---

## 一、先建立正确的心智模型

LangChain 1.x 的世界里只有四个东西：

```
模型（Model）  →  工具（Tool）  →  中间件（Middleware）  →  图（Graph）
  会思考            会行动            横切关注点           把上面三个编排起来
```

`create_agent` 就是把这四样拼成一个**可运行的图**：

```python
from langchain.agents import create_agent

agent = create_agent(
    model="openai:gpt-4o-mini",
    tools=[get_weather],
    system_prompt="你是天气助手",
)
```

> **💡 提示：`model` 可以是字符串**
> LangChain 1.x 支持**模型标识符**，格式是 `"provider:model-name"`：
> `"openai:gpt-4o"` / `"anthropic:claude-sonnet-4-5"` / `"google_genai:gemini-2.5-pro"`。
>
> 它等价于：
> ```python
> from langchain.chat_models import init_chat_model
> model = init_chat_model("openai:gpt-4o-mini")
> ```
> 需要更多控制（超时、重试、base_url）时用 `init_chat_model`，否则直接用字符串。

---

## 二、环境准备```bash
python -m venv venv
./venv/Scripts/pip install "langchain==1.4.7" "langchain-openai" "langgraph==1.2.16"

# 用到哪个 provider 装哪个：
# pip install langchain-anthropic langchain-google-genai``````bash
# .env —— 只放服务端密钥
OPENAI_API_KEY=sk-...
```

> **⚠️ 注意：密钥不要进代码**
> LangChain 会读环境变量，不需要在代码里传 key。
> 如果用了 `load_dotenv()`，确保 `.env` 在 `.gitignore` 里。

---

## 三、消息体系

Agent 的所有状态都是**消息列表**。五种消息类型必须分清：

| 类型 | 谁产生 | 作用 |
|---|---|---|
| `SystemMessage` | 开发者 | 系统提示词，定义角色与规则 |
| `HumanMessage` | 用户 | 用户输入 |
| `AIMessage` | 模型 | 模型输出，可能带 `tool_calls` |
| `ToolMessage` | 框架 | 工具执行结果，通过 `tool_call_id` 关联回某次调用 |
| `AIMessageChunk` | 模型 | 流式输出的分片 |

```python
from langchain_core.messages import HumanMessage, SystemMessage

messages = [
    SystemMessage(content="你是简洁的助手，回答不超过 50 字"),
    HumanMessage(content="用一句话解释什么是索引"),
]
```

> **🚫 危险：`ToolMessage` 的 `tool_call_id` 不能错**
> 每个 `ToolMessage` 必须带上它所回应的那次 `tool_calls[].id`。
> 对不上的话，模型会报错或者行为错乱。框架自动处理这件事，但你自己拼消息历史时会踩到。

---

## 四、定义工具

用 `@tool` 装饰器，**docstring 就是工具的说明书**——模型靠它决定什么时候调用。

```python
from langchain_core.tools import tool


@tool
def get_weather(city: str) -> str:
    """查询指定城市的实时天气

    Args:
        city: 城市名，例如「北京」「上海」
    """
    return f"{city}：晴，26℃，东南风 2 级"
```

三条硬规则：

1. **参数必须有类型注解**，框架用它生成 JSON Schema 给模型
2. **docstring 写清楚「什么时候该用这个工具」**，不只是「这个工具做什么」
3. **返回 `str` 或可 JSON 序列化的对象**，不要返回复杂对象

```python
# 需要更精细控制时，用显式参数
from pydantic import BaseModel, Field


class WeatherQuery(BaseModel):
    city: str = Field(description="城市名")
    days: int = Field(default=1, ge=1, le=7, description="预报天数，1-7")


@tool(args_schema=WeatherQuery)
def get_weather_forecast(city: str, days: int = 1) -> str:
    """查询未来几天天气预报。需要多天预报时用这个，单日天气用 get_weather。"""
    return f"{city} 未来 {days} 天：晴到多云"
```

> **💡 提示：多个工具时，docstring 要写「区分度」**
> 如果两个工具功能接近，模型会选错。在 docstring 里明确写「什么场景用 A，什么场景用 B」。

---

## 五、第一个可运行的 Agent```python
from langchain.agents import create_agent
from langchain_core.messages import HumanMessage


@tool
def get_weather(city: str) -> str:
    """查询城市实时天气

    Args:
        city: 城市名
    """
    return f"{city}：晴，26℃"


agent = create_agent(
    model="openai:gpt-4o-mini",
    tools=[get_weather],
    system_prompt="你是天气助手。用户问天气时必须调用工具，不要凭记忆回答。",
)

# invoke：一次性拿完整结果
result = agent.invoke({"messages": [HumanMessage(content="北京天气怎么样")]})
print(result["messages"][-1].content)
```

返回的 `result["messages"]` 是**完整消息历史**，最后一条才是最终回答。中间会夹着 `AIMessage`（带 tool_calls）和 `ToolMessage`。

---

## 六、流式输出

Agent 是「模型 → 工具 → 模型」的循环，延迟比单次调用高，**必须做流式**。

```python
# 方式一：stream_mode="messages"，逐 token 输出（适合直接显示给用户）
for chunk, metadata in agent.stream(
    {"messages": [HumanMessage(content="北京天气")]},
    stream_mode="messages",
):
    if chunk.content:
        print(chunk.content, end="", flush=True)

# 方式二：stream_mode="updates"，每个节点执行完推一次（适合显示进度）
for event in agent.stream(
    {"messages": [HumanMessage(content="北京天气")]},
    stream_mode="updates",
):
    for node_name, payload in event.items():
        print(f"[{node_name}] 完成")
```

| `stream_mode` | 推送时机 | 用途 |
|---|---|---|
| `"messages"` | 每个 token | 打字机效果 |
| `"updates"` | 每个节点完成 | 进度提示（「正在查询天气…」） |
| `"values"` | 每步后的完整状态 | 调试、状态快照 |

> **💡 提示：生产环境两个一起用**
> `"updates"` 驱动 UI 上的步骤指示器，`"messages"`` 驱动正文流式输出。
> 注意两条流要合并去重，否则文字会重复。

---

## 七、结构化输出

不想让模型回一段自然语言，而要一个确定结构的对象时用 `response_format`：

```python
from pydantic import BaseModel


class WeatherReport(BaseModel):
    city: str
    temperature: int
    summary: str


agent = create_agent(
    model="openai:gpt-4o-mini",
    tools=[],
    response_format=WeatherReport,
)

result = agent.invoke({"messages": [HumanMessage(content="北京天气")]})
report = result["structured_response"]   # WeatherReport 实例
print(report.city, report.temperature)
```

> **⚠️ 注意：官方默认策略可能不被所有模型支持**
> 上面这种直接传 Pydantic 类的写法用的是 `AutoStrategy`，部分模型不支持原生结构化输出。
> 显式指定更稳：
> ```python
> from langchain.agents.structured_output import ToolStrategy
> response_format=ToolStrategy(WeatherReport)
> ```
> 三种策略：`ProviderStrategy`（模型原生支持时最快）、`ToolStrategy`（用工具调用实现，兼容性最好）、`AutoStrategy`（自动选）。

---

## 八、没有 API Key 怎么办

**用桩模型**。这是本地开发和写测试的关键技巧，也是本套笔记所有示例的验证方式：

```python
from langchain_core.language_models import BaseChatModel
from langchain_core.messages import AIMessage
from langchain_core.outputs import ChatGeneration, ChatResult


class ScriptedModel(BaseChatModel):
    """按预定脚本依次返回，不发起任何网络请求"""

    script: list = []

    @property
    def _llm_type(self) -> str:
        return "scripted"

    def bind_tools(self, tools, **kwargs):
        # create_agent 内部会调用 model.bind_tools(tools)，必须实现return self

    def _generate(self, messages, stop=None, run_manager=None, **kw):
        msg = self.script.pop(0) if self.script else AIMessage(content="done")
        return ChatResult(generations=[ChatGeneration(message=msg)])


agent = create_agent(model=ScriptedModel(script=[...]), tools=[get_weather])
```

> **🚫 危险：桩模型必须实现 `bind_tools`**
> `create_agent` 内部会调用 `model.bind_tools(tools)`。
> 自定义模型不实现这个方法会直接抛 `NotImplementedError`——这是最常见的自定义模型报错。

---

## 九、本页验收清单

- [ ] 能说清四种「世界里的东西」：模型 / 工具 / 中间件 / 图
- [ ] 跑通了 `create_agent` 的最小示例
- [ ] 理解 `result["messages"]` 是完整历史，不是只有最终回答
- [ ] 会用 `stream_mode="messages"` 做打字机效果
- [ ] 会用 `response_format` 拿结构化对象
- [ ] 会用桩模型在无 Key 环境下开发

---

## 相关笔记

- 12-工具调用与 Agent 循环 — `create_agent` 内部到底建了什么图
- 13-中间件机制 — 人机协同、PII 脱敏、上下文摘要
- 14-LangGraph 核心原语 — 从「用 Agent」到「自己画图」
- 10-LangChain 与 LangGraph 索引

---
- 返回 10-LangChain 与 LangGraph 索引
