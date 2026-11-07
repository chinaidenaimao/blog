---
title: "检查点、中断与持久化"
date: 2026-08-08 22:40:00
cover: /img/covers/checkpoint-interrupt.svg
top_img: /img/covers/checkpoint-interrupt.svg
description: "- Agent 怎么记住「我们刚才聊到哪」？ - 怎么在执行到一半时暂停，等人审批，然后继续？ - 服务崩了，正在跑的任务怎么办？ 这三个问题的答案都是同一个东…"
categories:
  - AI
tags:
  - LangGraph
  - 持久化
  - 中断
---

> **📋 摘要：本页回答**
> - Agent 怎么记住「我们刚才聊到哪」？
> - 怎么在执行到一半时暂停，等人审批，然后继续？
> - 服务崩了，正在跑的任务怎么办？
>
> 这三个问题的答案都是同一个东西：**checkpointer（检查点）**。
> 本页所有代码实跑验证。

---

## 一、三层记忆，别混淆

| 层 | 载体 | 生命周期 | 典型用途 |
|---|---|---|---|
| **短期状态** | `checkpointer` + `thread_id` | 一个会话内 | 多轮对话、断点续跑 |
| **长期记忆** | `store` | 跨会话 | 用户偏好、累积的知识 |
| **外部记忆** | 向量库 / 数据库 | 你自己管 | RAG、业务数据 |

```python
app = graph.compile(
    checkpointer=InMemorySaver(),   # 短期：会话状态
    store=InMemoryStore(),          # 长期：跨会话记忆
)
```

> **🚫 危险：没有 checkpointer，以下功能全部不可用**
> - `interrupt()` 人机协同
> - `get_state()` / `get_state_history()`
> - 崩溃恢复
>
> 调用 `get_state` 时会直接报：
> ```
> ValueError: No checkpointer set
> ```
> 这是最常见的配置遗漏。

---

## 二、`thread_id`：会话的身份证```python
config = {"configurable": {"thread_id": "user-42-session-7"}}

app.invoke({"messages": [HumanMessage("我叫小王")]}, config)
app.invoke({"messages": [HumanMessage("我叫什么")]}, config)   # 能记住
```

`thread_id` 是 checkpointer 里所有状态的**命名空间**。同一个 `thread_id` 共享一段历史，不同的完全隔离。

> **💡 提示：`thread_id` 怎么设计**
> - **单聊会话**：`f"user:{user_id}:chat:{chat_id}"`
> - **后台任务**：`f"task:{task_id}"`
> - **多租户**：务必把 `tenant_id` 编进去，否则串数据
>
> 生产环境要用**稳定的、可复现的** ID。用随机 UUID 会导致「刷新页面后历史全丢」。

---

## 三、`interrupt()`：执行到一半，交还控制权```python
from langgraph.graph import END, START, StateGraph
from langgraph.types import Command
from langgraph.checkpoint.memory import InMemorySaver


class State(TypedDict):
    value: str


def human_node(state: State):
    answer = interrupt({"question": "请确认是否继续？"})
    return {"value": f"已确认:{answer}"}


g = StateGraph(State)
g.add_node("human", human_node)
g.set_entry_point("human")
g.set_finish_point("human")
app = g.compile(checkpointer=InMemorySaver())

cfg = {"configurable": {"thread_id": "t1"}}

# 第一次调用：在 interrupt 处暂停
r1 = app.invoke({"value": ""}, cfg)
print(r1["__interrupt__"])
# [Interrupt(value={'question': '请确认是否继续？'}, id='32214e80...', response_schema=None)]

# 查看当前状态
print(app.get_state(cfg).next)      # ('human',) —— 还停在这个节点

# 人做完决策，恢复执行
r2 = app.invoke(Command(resume="同意"), cfg)
print(r2["value"])                  # 已确认:同意
```

**实跑观察到的三个关键点：**

1. `interrupt(x)` 的返回值 `x` 会出现在 `result["__interrupt__"]` 里，`id` 是这次中断的唯一标识
2. `get_state(cfg).next` 显示图还停在哪个节点——**这是给前端做「待审批」状态的依据**
3. 恢复时用 `Command(resume=...)`，`resume` 的值会成为 `interrupt()` 的返回值

> **⚠️ 注意：`interrupt()` 的返回值是「人给的值」，不是异常**
> 节点函数里 `interrupt(...)` 这行**看起来像抛异常，实际是暂停**。
> 恢复后，代码会从 `interrupt()` 这一行**继续往下走**，返回值就是 `resume` 的内容。
>
> 所以 `interrupt()` 后面的代码才是「人批准之后要做的事」。

### 3.1 多个中断点```python
def node(state):
    a = interrupt("第一步审批")
    b = interrupt("第二步审批")
    return {"value": f"{a} / {b}"}
```

多个 `interrupt` 会依次暂停。恢复时 `resume` 按**中断顺序**依次消费。
也可以传 list：`Command(resume=["同意第一步", "同意第二步"])`。

---

## 四、Durable Execution：崩了能接着跑

配了 checkpointer 后，LangGraph 会把每个节点的执行结果落盘。

**效果**：用同一个 `thread_id` 重新 invoke，**已经成功的节点会被跳过**，从失败点继续。

```python
# 假设任务跑到第 3 步挂了try:
    app.invoke(input, {"configurable": {"thread_id": "job-1"}})
except Exception:
    pass

# 修复问题后，用同一个 thread_id 再跑一次
# → 前 3 步直接读 checkpoint，不会重复执行
result = app.invoke(input, {"configurable": {"thread_id": "job-1"}})
```

> **💡 提示：这解决了 Agent 最烦的一类问题**
> 「工具调用成功、模型调用超时」——重跑时工具又执行一遍，副作用（发邮件、扣款）重复了。
>
> 有了 checkpoint，重跑只会从超时那一步继续。**这也是 Agent 敢做长任务的前提。**

> **⚠️ 注意：幂等仍然要自己做**
> Checkpoint 能保证「已成功的节点不重跑」，但保证不了「节点内部的部分副作用」。
> 比如节点里先发了邮件再失败，重跑时这个节点整体重来，邮件还是会发第二次。
> **副作用操作必须幂等**（加去重键、状态机、分布式锁）。

---

## 五、时间旅行：回滚到任意历史状态```python
history = list(app.get_state_history(cfg))
# 实跑输出：快照数=3，各快照 n 值=[1, 0, None]
#            ↑ 最新的在最前面```

每个 `StateSnapshot` 包含：

| 字段 | 含义 |
|---|---|
| `values` | 该时刻的完整状态 |
| `next` | 下一步要执行的节点 |
| `config` | 恢复到这一刻所需的配置 |
| `metadata` | 步骤号、触发来源等 |
| `created_at` | 时间戳 |

**回滚并重跑：**

```python
old = [s for s in history if s.values.get("n") == 0][-1]
app.invoke(None, old.config)          # 传 None 表示沿用快照里的输入
print(app.get_state(cfg).values["n"])  # 从旧状态重新跑出来的结果
```

> **💡 提示：时间旅行的真实用途**
> 1. **调试**：Agent 走偏了，回滚到分叉点换个人工输入重来
> 2. **A/B 对比**：同一初始状态跑两条路径，比较结果
> 3. **人工修正**：`update_state` 改掉某个错误字段，再从这点往后跑
>
> 这是 LangGraph 相比「自己写 Agent 循环」最独特的优势。

### 5.1 直接改状态```python
app.update_state(cfg, {"value": "人工修正后的值"})
# 之后从这一点继续执行```

---

## 六、`Store`：跨会话的长期记忆```python
from langgraph.store.memory import InMemoryStore

store = InMemoryStore()

# 签名：put(namespace, key, value)
store.put(("users",), "u1", {"pref": {"lang": "zh"}})

item = store.get(("users",), "u1")
# Item(namespace=['users'], key='u1', value={'pref': {'lang': 'zh'}}, created_at=..., updated_at=...)

values = store.search(("users",))
# [{'pref': {'lang': 'zh'}}]```

> **📝 说明：`namespace` 是元组，`key` 是字符串**
> ```python
> store.put(("users", "u1"), {...})        # ✗ 报错：missing 1 required positional argument: 'value'
> store.put(("users",), "u1", {...})       # ✓
> ```
> namespace 用元组表达层级，天然支持「按租户/按用户/按项目」隔离。

**在 Agent 里用：**

```python
from langchain.tools import ToolRuntime


@tool
def remember(uid: str, key: str, val: str, runtime: ToolRuntime) -> str:
    """记住用户的长期偏好

    Args:
        uid: 用户 ID
        key: 偏好名
        val: 偏好值
    """
    ns = ("users", uid)
    cur = runtime.store.get(ns, key)
    runtime.store.put(ns, key, {**(cur.value if cur else {}), key: val})
    return "已记住"


agent = create_agent(
    model="openai:gpt-4o-mini",
    tools=[remember],
    store=store,          # ← 关键：把 store 传进去
)
```

> **💡 提示：checkpointer 与 store 的分工**
> | | checkpointer | store |
> |---|---|---|
> | 粒度 | 整个图的状态快照 | 单个 key-value |
> | 生命周期 | 会话结束可清理 | 长期保留 |
> | 查询 | 只能按 thread_id 取整段 | 可按 namespace 检索 |
> | 用途 | 多轮对话、断点续跑 | 用户偏好、知识积累 |

---

## 七、生产环境的持久化选型

| 场景 | 用什么 |
|---|---|
| 本地开发 / 单机 Demo | `InMemorySaver`（重启即丢） |
| 单机小应用 | `SqliteSaver.from_conn_string("checkpoints.db")` |
| 多实例部署 | **PostgresSaver**（LangGraph Platform 默认） |
| 长任务 / 高并发 | PostgresSaver + 连接池，或 LangGraph Cloud |

```python
from langgraph.checkpoint.sqlite import SqliteSaver

# from_conn_string 是上下文管理器，返回 Iterator
with SqliteSaver.from_conn_string("checkpoints.sqlite") as saver:
    app = graph.compile(checkpointer=saver)
    app.invoke(input, config)
```

> **⚠️ 注意：`InMemorySaver` 不能用于多进程/多实例**
> 它存在进程内存里。Gunicorn 多 worker、K8s 多 Pod 场景下，
> 请求落到不同实例就读不到 checkpoint，`get_state` 直接报错。
> **上多实例必须换 PostgresSaver。**

---

## 八、验收清单

- [ ] 理解三层记忆（checkpointer / store / 外部）的分工
- [ ] 知道没有 checkpointer 时 `interrupt` 和 `get_state` 都不可用
- [ ] 跑通过 `interrupt()` + `Command(resume=...)` 的完整闭环
- [ ] 理解 durable execution：重跑会跳过已成功节点
- [ ] 会用 `get_state_history` 做时间旅行
- [ ] 分得清 `store.put(namespace, key, value)` 的三个参数
- [ ] 知道多实例部署必须用 PostgresSaver

---

## 相关笔记

- 14-LangGraph 核心原语 — `compile(checkpointer=...)` 之前的图怎么画
- 13-中间件机制 — `HumanInTheLoopMiddleware` 就是本节能力的一行封装
- 16-生产落地与选型 — 部署与可观测性
- 10-LangChain 与 LangGraph 索引

---
- 返回 10-LangChain 与 LangGraph 索引
