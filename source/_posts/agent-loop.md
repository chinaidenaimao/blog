---
title: "手写第一个 Agent Loop"
date: 2026-09-19 23:00:00
cover: /img/banner.jpg
top_img: /img/banner.jpg
description: "整个 Agent 领域只有一个真正的核心机制，就是这篇要写的 while 循环。所有框架——LangChain、LangGraph、CrewAI、Claude …"
categories:
  - AI
tags:
  - Agent
  - 实战
  - Loop
---

> 整个 Agent 领域只有**一个**真正的核心机制，就是这篇要写的 `while` 循环。所有框架——LangChain、LangGraph、CrewAI、Claude Agent SDK——都只是这个循环的不同包装。

## 你将学到

1. 一个**能跑通**的最小 agent loop（约 60 行，不依赖任何 Agent 框架）
2. 循环里每一步为什么必须那样写——尤其是三条**照抄网上示例会报错**的规则
3. 消息序列在 wire 层真实长什么样
4. 工业级实现（`pi`、`pi-agent`）在这个最小版本上加了什么

## 前置要求```bash
pip install openai python-dotenv
```

`.env` 里需要有（见项目根 `.env.example`）：

```
MIMO_API_KEY=你的key
MIMO_BASE_URL=https://api.xiaomimimo.com/v1
MIMO_MODEL=mimo-v2.5
```

---

## 一、先看结论：Agent Loop 长什么样```mermaid
sequenceDiagram
    participant U as 用户
    participant A as 应用层(你的循环)
    participant M as LLM

    U->>A: "北京和上海今天哪个热？"
    A->>M: messages + tools
    M->>A: tool_calls: get_weather("北京"), get_weather("上海")
    Note over A: 你的代码真正执行函数
    A->>M: role=tool 两条结果
    M->>A: tool_calls: 无 → 输出最终文本
    A->>U: "上海更热，32°C vs 28°C"
```

**关键点**：循环的**退出条件是「模型这一轮没有再要求调用工具」**，不是「模型说了什么」。模型永远在决定「继续调工具」还是「给出最终答案」，你的代码只负责执行和回填。

## 二、最小可运行实现```python
# demos/02-agent-loop.pyimport jsonimport os
from datetime import date

from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()

client = OpenAI(
    api_key=os.getenv("MIMO_API_KEY"),
    base_url=os.getenv("MIMO_BASE_URL"),
)
MODEL = os.getenv("MIMO_MODEL", "mimo-v2.5")

# ---------- 1. 工具：先用普通 Python 函数写，后面再转 schema ----------

def get_weather(city: str) -> dict:
    """真实项目里这里会调天气 API；教学用假数据。"""
    fake = {"北京": (28, "晴"), "上海": (32, "多云")}
    temp, cond = fake.get(city, (25, "未知"))
    return {"city": city, "temp_c": temp, "condition": cond, "date": str(date.today())}


def calculator(expression: str) -> dict:
    """只允许四则运算，避免 eval 任意代码执行。"""
    allowed = set("0123456789+-*/(). ")
    if not set(expression) <= allowed:
        return {"error": f"表达式含非法字符，只允许四则运算：{expression!r}"}
    try:
        return {"result": eval(expression, {"__builtins__": {}}, {})}
    except Exception as exc:
        return {"error": f"计算失败：{exc}"}


# 工具名 → 函数的映射。循环靠这个表把模型的要求派发到真实代码。
TOOL_IMPL = {"get_weather": get_weather, "calculator": calculator}

# ---------- 2. 工具 schema：写给模型看的说明书 ----------TOOLS = [{
        "type": "function",
        "function": {
            "name": "get_weather",
            "description": "查询指定城市今天的天气。只支持中国城市。",
            "parameters": {
                "type": "object",
                "properties": {
                    "city": {"type": "string", "description": "城市中文名，如 '北京'"},
                },
                "required": ["city"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "calculator",
            "description": "计算一个四则运算表达式的值。当需要做数学计算时使用。",
            "parameters": {
                "type": "object",
                "properties": {
                    "expression": {"type": "string", "description": "如 '(28+32)/2'"},
                },
                "required": ["expression"],
            },
        },
    },
]

# ---------- 3. 循环本体 ----------

SYSTEM_PROMPT = "你是一个助手。需要查天气或做计算时调用工具，不要凭记忆回答。"


def run_agent(user_input: str, max_iterations: int = 10) -> str:
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": user_input},
    ]

    for step in range(max_iterations):
        response = client.chat.completions.create(
            model=MODEL, messages=messages, tools=TOOLS, tool_choice="auto",
        )
        msg = response.choices[0].message

        # ★ 规则 2：assistant 消息必须整体原样回填，包括 tool_calls
        messages.append(msg.model_dump(exclude_none=True))

        # ★ 退出条件：模型不再要求调工具
        if not msg.tool_calls:
            return msg.content or ""

        # 执行每一个工具调用，把结果回填
        for call in msg.tool_calls:
            name = call.function.name
            try:
                args = json.loads(call.function.arguments)
                result = TOOL_IMPL[name](**args)
            except KeyError:
                result = {"error": f"不存在名为 {name} 的工具"}
            except json.JSONDecodeError as exc:
                result = {"error": f"参数不是合法 JSON：{exc}"}
            except TypeError as exc:
                result = {"error": f"参数与工具签名不匹配：{exc}"}

            # ★ 规则 3：tool 消息靠 tool_call_id 与调用配对
            messages.append({
                "role": "tool",
                "tool_call_id": call.id,
                "content": json.dumps(result, ensure_ascii=False),
            })

    return f"⚠️ 达到最大迭代次数 {max_iterations}，已强制停止。"


if __name__ == "__main__":
    print(run_agent("北京和上海今天哪个更热？热多少度？"))
```

跑起来大概是：

```
[内部] get_weather({'city': '北京'})  → {'temp_c': 28, ...}
[内部] get_weather({'city': '上海'})  → {'temp_c': 32, ...}
[内部] calculator({'expression': '32-28'}) → {'result': 4}
上海更热，比北京高 4°C（32°C vs 28°C）。
```

注意最后**多了一轮** `calculator` 调用——模型不会自己做减法，它老老实实又调了一次工具。这正是「让模型接真实环境反馈」的意义。

## 三、三条必须记住的规则

这三条不遵守会直接报 400，是手写 agent 的第一道坎。

### 规则 1：`tool` 消息必须紧跟对应的 `assistant` 消息

OpenAI 兼容接口在服务端做校验：**每一个 `tool_call_id` 都要能找到匹配的 `tool` 消息，且要在它之后**。中间插入任何其他消息都会破坏配对。

所以「把历史裁掉一半然后接着跑」这个看起来很自然的优化，会在这里炸——见 历史裁剪与边界吸附。

### 规则 2：`assistant` 消息要**整体**回填常见错误是只回填文本：```python
# ❌ 错的：tool_calls 丢了，下一轮的 tool 消息找不到配对
messages.append({"role": "assistant", "content": msg.content})
```

正确做法是原样序列化整个 message 对象（上面代码里的 `msg.model_dump(exclude_none=True)`）。

> ⚠️ **待验证**：`exclude_none=True` 是为了避开部分兼容接口对 `content: null` 的挑剔。MiMo 上实测通过；换 provider 时若报参数错误，先检查这里。

### 规则 3：`tool` 消息的 `content` 必须是字符串

模型接口不接受 dict。必须 `json.dumps()`。用 `ensure_ascii=False` 保住中文可读性——这既省 token，也让日志好看。

## 四、这个最小版本缺什么

60 行能跑，但拿去做真事会立刻撞墙。下面每一项在后续笔记里展开：

| 缺失             | 后果                                         | 在哪讲                                  |
| -------------- | ------------------------------------------ | ------------------------------------ |
| 没有历史裁剪         | 长对话必然超上下文窗口                                | 历史裁剪     |
| 没有压缩           | 撞上窗口后只能粗暴截断，丢关键约束                          | 压缩策略       |
| 工具错误直接喂回，但没有重试 | 网络抖动会让整个循环崩                                | 错误回传与重试   |
| 串行执行工具         | 两个独立查询要等两轮                                 | 本篇下节                                 |
| 只能等全部输出        | 用户盯着空白屏幕                                   | 流式输出       |
| **没有权限控制**     | `calculator` 用 `eval`，换成 `run_bash` 就是 RCE | 权限与最小代理原则 |

## 五、并行工具调用

上面那段代码是**串行**的：美国东岸的天气和西岸的天气，明明互不相关，却要一个一个查。

模型其实一次就能返回多个 `tool_calls`（上面 `msg.tool_calls` 是个 list）。改造很简单：

```python
from concurrent.futures import ThreadPoolExecutor

with ThreadPoolExecutor(max_workers=4) as pool:
    results = list(pool.map(_execute_one, msg.tool_calls))

for call, result in zip(msg.tool_calls, results):
    messages.append({
        "role": "tool",
        "tool_call_id": call.id,
        "content": json.dumps(result, ensure_ascii=False),
    })
```

**但并行有前提**：工具之间不能有依赖，也不能互相干扰（比如一个写文件、一个读同一个文件）。`pi` 的做法是给工具加 `executionMode: "sequential" | "parallel"` 标记，只要这一批里**有一个**标了 `sequential`，整批退化成串行：

```ts
// pi: packages/agent/src/agent-loop.ts（简化）
const hasSequential = toolCalls.some(
  tc => tools.find(t => t.name === tc.name)?.executionMode === "sequential",
);
if (config.toolExecution === "sequential" || hasSequential)
  return executeSequential(...);
return executeParallel(...);
```

> 💡 这个「**批量降级**」而不是「逐个判断」的选择值得注意：它牺牲了一点并行度，换来「同一批工具的执行顺序对模型是可预测的」。对需要复现的调试场景，这比多省 200ms 重要。

## 六、🔬 参考实现：工业版加了什么

### `pi` 的双层循环

`pi`（`earendil-works/pi`）的主循环不是一个 `for`，而是**两层 `while`**：

```ts
while (true) {                                  // 外层：agent 本该停止后又来了新消息
  let hasMoreToolCalls = true;
  while (hasMoreToolCalls || pendingMessages.length > 0) {   // 内层：工具 + 插话
    ...
    if (await config.shouldStopAfterTurn?.(lastCompletedTurn)) return;  // 终止钩子
    pendingMessages = (await config.getSteeringMessages?.()) || [];     // 拉取用户插话
  }
  const followUp = (await config.getFollowUpMessages?.()) || [];
  if (followUp.length > 0) { pendingMessages = followUp; continue; }
  break;
}
```

为什么要外层？因为**真实用户在 agent 干活时会打字**。如果只用一个循环，用户那句话只能等 agent 完全停下来才被处理；`pi` 用 `getSteeringMessages()` 在每一轮之间拉取，把它作为下一轮的输入无缝注入。

这个点直接对应阶段 5 的 human-in-the-loop，但在阶段 2 就应该知道**循环得留出插话的口子**——事后再加会很痛苦。

### `pi` 的一个隐藏 bug 防护

如果模型输出被 token 上限截断（`stopReason === "length"`），流式解析器"尽力修复"出来的工具参数 JSON **可能语法合法、schema 也通过，但内容不完整**。直接执行会静默损坏文件。

`pi` 的选择是：这种情况下**整批工具调用全部判为失败**，让模型重发，绝不执行。

```ts
const batch = message.stopReason === "length"
  ? await failToolCallsFromTruncatedMessage(toolCalls, emit)   // 全部报错
  : await executeToolCalls(...);
```

> 💡 「宁可让模型重发，也不执行可能不完整的写操作」——这条原则在你给 agent 加 `write_file` 工具前必须想清楚。

### `pi-agent` 的一条纪律

Python 版 `pi-agent`（`Ashutosh0428/pi-agent`）只有约 150 行循环，但把**工具异常转成字符串**：

```python
def run(self, name, args, sandbox) -> str:
    try:
        return tool.handler(args, sandbox)
    except Exception as exc:      # surface the failure back to the model
        return f"Error running {name}: {exc}"
```

对比上面最小实现里的 `except` 分支——思路一样，但 `pi-agent` 是**在注册表层兜底**，意味着任何工具抛出的任何异常都不会漏掉。这个位置选得很讲究：只有一处，不可能忘。

## ✅ 学习检查点

- [ ] 能不看笔记默写出 agent loop 的骨架
- [ ] 能解释为什么 `assistant` 消息必须整体回填
- [ ] 能说出循环的两个退出条件（模型不再调工具 / 达到 max_iterations）
- [ ] 亲手跑通 `demos/02-agent-loop.py`，并故意把 `max_iterations` 设成 1 看会发生什么
- [ ] 能解释为什么「批量降级为串行」比「逐个判断」更好
- [ ] 知道 `stopReason === "length"` 时为什么不能执行写操作

## 📖 相关文档

- [OpenAI Function Calling](https://platform.openai.com/docs/guides/function-calling) — 官方工具调用文档，消息格式的权威来源
- [Anthropic · Building Effective Agents](https://www.anthropic.com/engineering/building-effective-agents) — 循环的停止条件与 ground-truth 反馈，必读
- [earendil-works/pi](https://github.com/earendil-works/pi) — 本篇引用的主循环源码
- [Ashutosh0428/pi-agent](https://github.com/Ashutosh0428/pi-agent) — Python 版约 150 行循环，适合逐行读

## ➡️ 下一步→ ReAct 模式
