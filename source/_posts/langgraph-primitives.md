---
title: "LangGraph 核心原语：节点、边、状态"
date: 2026-07-30 21:10:00
cover: /img/covers/ai-neural.jpg
top_img: /img/covers/ai-neural.jpg
description: "能自己画一张图，而不是只会调 createagent 模板。 只用四个原语：State（状态）+ Node（节点）+ Edge（边）+ Reducer（合并规则…"
categories:
  - AI
tags:
  - LangGraph
  - Agent
  - 原语
---

> **📋 摘要：本页目标**
> 能自己画一张图，而不是只会调 `create_agent` 模板。
>
> 只用四个原语：**State（状态）+ Node（节点）+ Edge（边）+ Reducer（合并规则）**。
> 本章所有代码实跑验证，包括错误用法的真实报错信息。

---

## 一、最小可运行例子```python
from typing import Annotated, TypedDict

from langgraph.graph import END, START, StateGraph


class State(TypedDict):
    messages: Annotated[list, lambda a, b: a + b]   # reducer：拼接
    rounds: int


def node_a(state: State):
    return {"messages": ["A 执行"], "rounds": state["rounds"] + 1}


def should_loop(state: State):
    return "a" if state["rounds"] < 3 else END


g = StateGraph(State)
g.add_node("a", node_a)
g.set_entry_point("a")
g.add_conditional_edges("a", should_loop)

app = g.compile()
out = app.invoke({"messages": [], "rounds": 0})
# 实跑结果：rounds = 3，messages = ['A 执行', 'A 执行', 'A 执行']```四个原语都在这里了：```
StateGraph(State)         ← State：状态长什么样
g.add_node("a", node_a)   ← Node：一个处理步骤
g.set_entry_point("a")    ← Edge：从哪开始
g.add_conditional_edges   ← Edge：根据状态决定去哪
```

---

## 二、State 与 Reducer：状态怎么合并```python
class State(TypedDict):
    messages: Annotated[list, lambda a, b: a + b]
    rounds: int
```

`Annotated[类型, reducer函数]` 里的 reducer 决定了**节点返回该字段时，新值怎么和旧值合并**。

| 写法 | 合并行为 |
|---|---|
| `rounds: int`（无 reducer） | **覆盖**——节点返回几就是几 |
| `messages: Annotated[list, lambda a, b: a + b]` | **追加** |
| `Annotated[list, operator.add]` | 追加（等价写法） |
| `Annotated[int, max]` | 取较大值 |
| 自定义函数 | 任意逻辑 |

> **🚫 危险：没有 reducer 的字段是「覆盖」语义**
> 节点返回 `{"messages": [...]}` 而 `messages` 没配 reducer，**整个历史会被替换掉**。
>
> 这是新手最常踩的坑：图跑起来消息越来越少。
> 正确做法是配 reducer，或者只返回「增量」。

```python
# 常见 reducer
from typing import Annotated
import operator

class State(TypedDict):
    docs: Annotated[list[str], operator.add]        # 列表追加
    best_score: Annotated[float, max]               # 保留最大值
    seen: Annotated[set[str], lambda a, b: a | b]   # 集合并集
```

---

## 三、Node：返回增量，不是全量```python
def my_node(state: State) -> dict:
    # state 是当前完整状态
    # 返回值是「要合并进去的增量」
    return {"docs": ["新文档"], "best_score": 0.95}
```

节点签名可以是：

```python
def node(state): ...                          # 只用状态
def node(state, config): ...                  # 加上运行配置（thread_id、callbacks）
async def node(state): ...                    # 异步节点
```

> **💡 提示：节点返回 `{}` 表示「只读，不改状态」**
> 比如一个只做日志或外部通知的节点。

---

## 四、Edge：固定边与条件边

### 4.1 固定边```python
g.add_edge("a", "b")          # a 执行完必然去 b
g.add_edge(START, "a")        # 等价 g.set_entry_point("a")
g.add_edge("b", END)          # 等价 g.set_finish_point("b")
```

### 4.2 条件边```python
def route(state: State) -> str:
    if state["error"]:
        return "handle_error"
    return "next"


g.add_conditional_edges("a", route)
# 或显式列出所有可能目标（推荐，图能自检）
g.add_conditional_edges("a", route, ["handle_error", "next"])
```

条件边函数返回**目标节点名**（字符串）或 `END`。

---

## 五、`Send`：并行 fan-out

需要「一个输入派生 N 个并行任务」时用 `Send`。典型场景：批量处理、map-reduce。

```python
from langgraph.types import Send


class State(TypedDict):
    topics: list[str]
    results: Annotated[list[str], lambda a, b: a + b]


def fan_out(state: State):
    return [Send("worker", {"topic": t}) for t in state["topics"]]


def worker(state: dict):
    return {"results": [f"已处理:{state['topic']}"]}


g = StateGraph(State)
g.add_node("worker", worker)
g.set_conditional_entry_point(fan_out, ["worker"])   # ← 从条件边返回 Send
g.add_edge("worker", END)

app = g.compile()
out = app.invoke({"topics": ["A", "B", "C"], "results": []})
# 实跑结果：['已处理:A', '已处理:B', '已处理:C']```

> **🚫 危险：`Send` 只能从**条件边**返回，不能从节点返回**
> 如果你在节点里 `return [Send(...), Send(...)]`，会报：
> ```
> langgraph.errors.InvalidUpdateError:
>   Expected dict, got [Send(node='worker', arg={'topic': 'A'}), ...]
> ```
> 因为节点的返回值被当作「状态增量」，而 `Send` 列表不是 dict。
>
> **正确写法是 `add_conditional_edges(..., fan_out)` 或 `set_conditional_entry_point(fan_out, [...])`。**

> **💡 提示：`Send` 的两个参数**
> `Send(node, arg)`：`node` 是目标节点名，`arg` 是**只传给这个任务的局部状态**。
> 它不经过全局 state 的合并，直接作为该次节点调用的输入。

---

## 六、`Command`：一次同时做「改状态 + 跳转」```python
from langgraph.types import Command


class State(TypedDict):
    log: Annotated[list[str], lambda a, b: a + b]


def a_node(state: State):
    return Command(update={"log": ["跳转到 b"]}, goto="b")


def b_node(state: State):
    return {"log": ["b 执行"]}


g = StateGraph(State)
g.add_node("a", a_node)
g.add_node("b", b_node)
g.set_entry_point("a")
g.add_edge("b", END)

out = g.compile().invoke({"log": []})
# 实跑结果：['跳转到 b', 'b 执行']```实测签名：```python
Command(
    *,
    graph: str | None = None,        # 多图（子图）场景用
    update: Any | None = None,       # 状态增量
    resume: dict | Any | None = None,  # 配合 interrupt() 恢复
    goto: Send | Sequence[Send | str] | str = (),   # 跳转目标，可以是多个
)
```

> **💡 提示：什么时候用 `Command`，什么时候用条件边**
> | 场景 | 用什么 |
> |---|---|
> | 「根据状态决定去哪」 | 条件边 `add_conditional_edges` |
> | 「一个输入派生多个并行任务」 | 条件边返回 `Send` |
> | 「改状态的同时还要跳转」 | 节点返回 `Command` |
> | 「恢复被中断的图」 | `Command(resume=...)` |
>
> `Command` 的价值是把「改状态」和「控制流」合成一次返回，省掉一个中间节点。

---

## 七、编译与调用```python
app = g.compile()                          # 编译成可执行对象
app.compile(checkpointer=..., store=...)   # 带持久化，见第 15 篇

# 调用
app.invoke(input, config)                  # 一次性
app.stream(input, config, stream_mode=...) # 流式
await app.ainvoke(...)                     # 异步
```

`config` 里最重要的键：

```python
config = {
    "configurable": {
        "thread_id": "user-123-session-1",   # 会话 ID，checkpointer 靠它隔离
    },
    "recursion_limit": 25,                  # 图的最大步数，默认 25
}
```

> **⚠️ 注意：`recursion_limit` 默认只有 25**
> 复杂图（多轮工具调用 + 多节点）很容易超。超了会抛 `GraphRecursionError`。
> 但**不要无脑调大**——它通常是「图里有环没退出条件」的信号，先检查逻辑。

---

## 八、验证与可视化```python
g.validate()                              # 静态检查图是否合法

print(app.get_graph().draw_mermaid())     # 导出 Mermaid，可贴进 Markdown
```

`validate()` 会检查：孤立节点、`END` 不可达、条件边目标不存在等问题。
**提交代码前跑一次**，比运行时才发现要好。

---

## 九、验收清单

- [ ] 能独立写一个带 Reducer、条件边、循环的图
- [ ] 理解「无 reducer = 覆盖」这个语义
- [ ] 知道 `Send` 必须从条件边返回（并见过那个报错）
- [ ] 会用 `Command(update=..., goto=...)`
- [ ] 知道 `recursion_limit` 默认 25 及其含义
- [ ] 会用 `draw_mermaid()` 和 `validate()`

---

## 相关笔记

- 12-工具调用与 Agent 循环 — `create_agent` 就是这套原语的预设组合
- 15-检查点、中断与持久化 — `compile(checkpointer=...)` 之后的能力
- 13-中间件机制 — 中间件本质是往图里插逻辑
- 10-LangChain 与 LangGraph 索引

---
- 返回 10-LangChain 与 LangGraph 索引
