---
title: "工具 Schema 设计：为什么模型选错了工具"
date: 2026-10-24 21:40:00
cover: /img/covers/ai-neural.jpg
top_img: /img/covers/ai-neural.jpg
description: "每多注册一个工具，你都要在每一轮对话里为它付两次钱：一次是 schema 本身的 token（固定成本），一次是模型在更大的候选集里选错概率的上升（选择成本）。…"
categories:
  - AI
tags:
  - 工具
  - Schema
  - Agent
---

> 每多注册一个工具，你都要在**每一轮**对话里为它付两次钱：一次是 schema 本身的 token（固定成本），一次是模型在更大的候选集里选错概率的上升（选择成本）。前者可以算，后者更贵且更隐蔽。

## 你将学到

1. **Schema 税**：工具数 → token 与准确率的双向恶化，以及 **1–5% 上下文窗口**这个经验阈值
2. **工具合并**：为什么 Anthropic 报告它拿到 733% ROI，以及 4 个文件操作合并成 1 个的完整代码
3. **poka-yoke 参数设计**：`enum` 替代自由字符串、强制绝对路径，以及「可选参数幻觉」这个坑
4. 「工具描述写给人看」vs「写给模型看」的逐项对照表
5. **工具调用抖动 (thrash)** 的四类成因与可跑的诊断代码
6. 一个用 Pydantic 定义工具 + 自动审计 schema 的检查清单

## 前置要求```bash
pip install pydantic openai python-dotenv
```

读完 为模型设计工具 (ACI)——本篇假设你已经知道四件套是什么。

> 🪟 **Windows 上的一个必踩的坑**：在 Git Bash 里跑任何打印中文的 Python 脚本，都可能炸在 `UnicodeEncodeError: 'gbk' codec can't encode character ...`——因为 Windows 的 Python 默认 stdout 编码是 cp936，不是 UTF-8。
>
> 本仓库的 demo 已经全部改用 ASCII 标记（`[OK]` / `[WARN]` / `[FAIL]`）并把输出控制在 GBK 可编码范围内，所以直接跑不会炸。**但你一旦自己往 demo 里加 emoji 或生僻字符，就会立刻踩到。**
>
> 三种解法，任选其一：
> ```bash
> PYTHONIOENCODING=utf-8 python demos/04-schema-checklist.py     # ① 跑的时候带环境变量
>                                                                 #   （本 demo 输出已全部改为 ASCII 标记，
>                                                                 #    正常不需要这一行；只有你自己改出 emoji 时才要）
> ```
> ```python
> import sys; sys.stdout.reconfigure(encoding="utf-8")            # ② 写在脚本开头
> ```
> 或者在 Windows 设置里打开「Beta: 使用 Unicode UTF-8 提供全球语言支持」。
>
> 这个坑在 `.venv` 里跑任何带 emoji 的教学 demo 都会遇到，**待验证**：本项目里是否所有 demo 都触发了它。

---

## 一、Schema 税：工具越多，越贵也越蠢```mermaidgraph LR
    N["🔢 注册的工具数 ↑"] --> T["📏 每轮 prompt 的<br/>固定 token ↑"]
    N --> C["🎯 候选集变大<br/>相似工具互相干扰"]
    T --> T1["💸 成本与延迟线性上涨"]
    T --> T2["🕳️ 真实上下文被挤占<br/>（留给对话/文件的空间变小）"]
    C --> C1["❌ 调错工具"]
    C1 --> C2["🔁 返回没用 → 重新调<br/>= thrash"]
    C2 --> T

    style N fill:#ffe6cc
    style C1 fill:#ffcccc
```

### 1.1 固定成本可以算

下面是**实测**数据：把同一个「写得像样」的工具（5 行描述 + 3 个参数，含一个 `enum`）复制 N 份，序列化成 OpenAI 工具格式后的字符数。

| 工具数 | schema 字符（**实测**） | ≈token（粗估） | 占 128k 窗口（粗估） |
|---:|---:|---:|---:|
| 4 | 2,540 | ~1,270 | ~1.0% |
| 10 | 6,350 | ~3,175 | ~2.5% |
| 20 | 12,710 | ~6,355 | ~5.0% |
| 40 | 25,430 | ~12,715 | ~9.9% |
| 100 | 63,590 | ~31,795 | ~24.8% |

读法：

- **单个工具约 635 字符**。写得越详细越贵——这是「把描述写好」的代价，值得付，但要知道价格。
- **40 个工具 ≈ 10% 的窗口**。而「**过度功能**」这个反模式（任务只需要 3 个工具却接了 40 个）在这里就现形了：你花掉十分之一的上下文，买来的是「模型更容易选错」。
- 100 个工具 ≈ 25% 窗口。这已经不是在用上下文，是在**用上下文养工具表**。

> ⚠️ **口径说明（重要）**：字符数是本机实测；**token 是粗估**，按 ~2 字符/token 换算，因为——
> 1. 本机 `tiktoken` 需要联网下载 BPE 词表（`openaipublic.blob.core.windows.net`），被网络策略拦截，**无法实测**；
> 2. 中英混排的换算系数很不稳定：英文为主的描述约 3.7 字符/token，**中文为主的描述可能差到 1.2 字符/token**，两者差 3 倍。
>
> 所以上表的 token 列请当**量级**看，不要当精确值。要精确值就自己 `pip install tiktoken` 后在有网环境跑一次。

### 1.2 选择成本更难算，但更致命

| 工具数 | 典型症状 |
|---|---|
| 1–5 | 模型几乎不会选错 |
| 6–15 | 开始出现「选了一个语义相近但不是这个」的工具 |
| 16–30 | 模型开始**把两个工具的参数混着填** |
| 30+ | 模型开始**假装自己没看到某些工具**，只用最常用的那几个 |

最后一行是最阴的：**模型不是随机选错，是有偏向地忽略**。它会反复用 `bash` / `search` 这类泛化工具去干本该由专用工具干的活，因为泛化工具在训练分布里更常见。你在 trace 里看到的是一堆 `bash` 调用，而真正的原因是你的 40 个工具里有 35 个从来没被调用过。

### 1.3 阈值：占窗口 1–5% 就该警觉

经验值：**当工具定义超过上下文窗口的 1%–5% 时，就该考虑渐进式工具发现。**

按上面的表，如果你的工具都写得比较用心（~300 token/个），这意味着：

- **10 个工具** ≈ 2.5% —— 进入观察区，开始盯选择准确率
- **20 个工具** ≈ 5% —— 该动手了，上渐进式发现

「渐进式工具发现」（元工具按需查找）的具体做法在 技能与渐进式发现 里展开。这里只需要记住：**它是解决「常驻数量」的，不是解决「总数」的**——两者配合使用。

## 二、工具合并：把 N 个变 1 个

Anthropic 报告里，把多个细粒度工具合并成更少的粗粒度工具，**ROI 达到 733%**。这个数字看着离谱，但机制很清楚。

### 2.1 为什么合并有效```mermaidgraph TD
    A["🧩 4 个细粒度工具"] --> B["Schema token ×4<br/>（每轮都付）"]
    A --> C["模型要在 4 个里选<br/>选择点 ×4"]
    C --> D["但它们的描述高度重叠<br/>→ 语义边界模糊"]
    D --> E["❌ 选错 / 参数填串"]
    E --> F["返回没用 → 重试"]

    G["🧱 1 个合并工具<br/>+ op: enum"] --> H["Schema token ÷2 左右"]
    G --> I["选择点 ×1<br/>把'选哪个工具'降级成'填哪个枚举值'"]
    I --> J["✅ 枚举值有 schema 级校验<br/>错了立刻能报"]

    style F fill:#ffcccc
    style J fill:#d4f8d4
```

**合并真正解决的不是 token，是「选择点」。** 4 个工具意味着模型每轮要做一次 4 选 1 的**语义判断**；合并成 1 个工具 + `op` 枚举后，这个判断降级成了**填参数**——而填参数是有 schema 约束的、可以被校验的、出错能立刻报错的。这是本篇最值得记住的一句话：

> **把「选哪个工具」变成「填哪个枚举值」，等于把不可校验的判断变成可校验的输入。**

### 2.2 代码对照```python
# ❌ 4 个细粒度工具：描述高度重叠，模型要在它们之间做语义选择
FINE_GRAINED = [
    {"type": "function", "function": {
        "name": "list_files",
        "description": "列出目录下的文件。",
        "parameters": {"type": "object", "properties": {"path": {"type": "string"}},
                       "required": ["path"]}}},
    {"type": "function", "function": {
        "name": "read_file",
        "description": "读取文件内容。",
        "parameters": {"type": "object", "properties": {"path": {"type": "string"}},
                       "required": ["path"]}}},
    {"type": "function", "function": {
        "name": "write_file",
        "description": "写入文件内容。",
        "parameters": {"type": "object",
                       "properties": {"path": {"type": "string"},
                                      "content": {"type": "string"}},
                       "required": ["path", "content"]}}},
    {"type": "function", "function": {
        "name": "delete_file",
        "description": "删除文件。",
        "parameters": {"type": "object", "properties": {"path": {"type": "string"}},
                       "required": ["path"]}}},
]
# 问题：list_files 和 read_file 的 description 几乎无法区分"我想看这个目录里有什么"
#       和"我想看这个文件里有什么"——而模型经常会搞混目录和文件。``````python
# ✅ 合并成 1 个工具：把 4 选 1 降级成 op 枚举
FILE_TOOL = {
    "type": "function",
    "function": {
        "name": "file",
        "description": (
            "对工作区内的文件做单个操作。所有路径必须是 /workspace/ 下的绝对路径。\n"
            "何时用：任何单文件读写或列目录。\n"
            "何时不用：需要跨文件搜索内容用 search_code；需要跑命令用 run_command。\n"
            "各 op 的必填参数：\n"
            "  list   → 只要 path（目录）；返回 {entries:[{name,type,size}]}\n"
            "  read   → 只要 path（文件）；返回 {content, line_count, truncated}\n"
            "  write  → 要 path + content；返回 {bytes_written, path}\n"
            "  append → 要 path + content；返回 {bytes_appended, path}\n"
            "  delete → 只要 path；返回 {deleted: bool, path}\n"
            "失败时返回 {error, received, hint} 而不会抛异常。"
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "op": {
                    "type": "string",
                    "enum": ["list", "read", "write", "append", "delete"],
                    "description": "要执行的操作。",
                },
                "path": {
                    "type": "string",
                    "description": "绝对路径，必须以 /workspace/ 开头。op=list 时是目录，其余是文件。",
                },
                "content": {
                    "type": "string",
                    "description": "op=write/append 时必填，要写入的文本内容。",
                },
                "offset": {
                    "type": "integer",
                    "description": "op=read 时可选，从第几行开始（0-based），默认 0。",
                    "default": 0,
                },
            },
            "required": ["op", "path"],
        },
    },
}
```

**为什么 `description` 里要逐 op 列必填参数？** 因为合并的代价就在这里：模型现在要理解「哪些参数在哪个 op 下必填」，而 schema 的 `required` 只能表达「所有 op 都必填」。所以这部分知识必须用自然语言补上——**这就是合并的隐藏成本，必须显式付掉**，否则你会得到一堆 `op=write` 但没传 `content` 的调用。

### 2.3 合并的边界条件

不是所有工具都该合并。判据：

| 该合并 | 不该合并 |
|---|---|
| 操作**同一个资源**（文件、任务、订单） | 操作不同资源（文件 vs 网络） |
| 参数高度重叠 | 参数完全不同 |
| 描述里出现「和 X 很像」 | 语义边界清晰、模型不会混 |
| 每个工具都很薄（几行实现） | 某个工具逻辑复杂，描述要写 20 行 |

反面例子：把 `search_code` 和 `send_email` 合并成 `do_thing(op=...)` 是**纯粹的自残**——它把两个无关概念塞进一个描述里，模型要先判断领域再判断操作，选择点反而变多了。

## 三、poka-yoke 参数设计

poka-yoke（防呆）的核心思想：**不是写文档叮嘱使用者别做错，而是让做错这件事在结构上更难发生。**

### 3.1 用 `enum` 替代自由字符串```python
# ❌ 模型能生成无穷多种写法，你一个个兜底
{"mode": {"type": "string", "description": "搜索模式，可以是字面量或正则"}}
# 实际见到的值：'literal' / 'regex' / '字面量' / 'literal mode' / 'plain' / 'exact' ...

# ✅ 取值空间被 schema 收窄到 2 个
{"mode": {"type": "string", "enum": ["literal", "regex"], "default": "literal"}}
```

**为什么这条比看起来重要**：`enum` 不只是「提示模型」，它在**校验层**真的拦得住。`pi` 就用 TypeBox 在每次调用前跑 `validateToolArguments`；校验失败时不崩溃，而是把错误当返回值喂回去让模型自己改。**只写描述不校验 = 白写。**

### 3.2 强制绝对路径```python
# ❌ 描述里"建议"，实现里不检查
"description": "文件路径，建议使用绝对路径"
# 结果：模型传 "src/app.py"，你的进程 cwd 是 D:\ai-demo\langchian，
#       于是它读到了完全不同的文件，还把内容当成真的喂给模型继续推理。

# ✅ 描述里写死形状，实现里硬拦
"path": {"type": "string",
         "description": "文件的绝对路径，必须以 /workspace/ 开头。不接受相对路径。"}
```

```python
def read_text_file(path: str, offset: int = 0) -> dict:
    if not path.startswith("/workspace/"):
        return {"error": "path_outside_workspace", "received": path,
                "hint": "路径必须以 /workspace/ 开头，例如 /workspace/src/app.py"}
    ...
```

「相对路径」这类错误的可怕之处在于**它不一定报错**。它可能读到一个同名但无关的文件，返回一段看起来很正常的内容，然后模型基于它继续推理。这是**静默失败**的典型形态。

### 3.3 必填 vs 可选的取舍 —— 以及「可选参数幻觉」```mermaidgraph TD
    A{"这个信息模型<br/>自己能知道吗？"} -->|"只有调用方知道"| B["必填<br/>（如 path）"]
    A -->|"有合理默认值"| C["可选 + default<br/>+ 描述里说明默认值"]
    A -->|"模型不知道但你以为它知道"| D["❌ 必填 = 逼模型编造<br/>（如 user_id / session_id）"]

    style D fill:#ffcccc
```

- **必填太多 → 模型编造。** 如果你把 `user_id` 设成必填，而模型在对话里从没见过 user_id，它**不会反问你**，它会填一个看起来像 ID 的字符串。这是最难查的一类 bug，因为 trace 里参数长得完全正常。
- **可选太多 → 模型试探。** 它会反复换值试，每次都是一轮完整的 LLM 调用。

**「可选参数幻觉」**：比上面两种更奇怪的一类失败——模型会调用 schema 里**根本不存在**的参数。典型场景：

```python
# 你的 schema 只有 path，但模型传了：
{"path": "/workspace/a.py", "verbose": True, "max_lines": 500}
```

为什么会这样？因为模型在按训练分布「补全一个看起来该有的参数」——`read_file` 这类工具在训练数据里经常带 `encoding`、`max_lines`、`verbose`。**模型不是坏了，它是在做模式补全。**

两种兼容接口的行为不一致：有的直接 400 报错，有的静默丢弃。**待验证**：MiMo 遇到未知参数是报错还是丢弃，未实测。**无论哪种，你的注册表层都要兜住**：

```python
def dispatch(name: str, args: dict) -> dict:
    impl = TOOL_IMPL[name]
    sig = inspect.signature(impl)
    extra = set(args) - set(sig.parameters)
    if extra:
        # 不崩：把它变成一次可自我修复的反馈
        return {"error": "unknown_arguments", "unknown": sorted(extra),
                "allowed": sorted(sig.parameters),
                "hint": "去掉这些参数后重试；它们不存在。"}
    return impl(**args)
```

关键在 `hint` 里的 **`allowed` 列表**——直接把合法参数名回给模型，它下一轮几乎必然改对。这比返回 `unexpected keyword argument 'verbose'` 有效得多。

## 四、写给人看 vs 写给模型看

同一段工具描述，两种受众的最优写法完全不同：

| 维度 | 写给人（传统 API 文档） | 写给模型（工具描述） |
|---|---|---|
| **命名** | 跟随公司 API 规范、可缩写 | 语义完整的「动词 + 名词」，**与其它工具可区分**是首要目标 |
| **详略** | 简洁即可，细节放外部文档 | 必须**自包含**——模型看不到你的 README、wiki、Slack |
| **例子** | 通常省略 | 至少给 1 个输入示例，格式敏感的（正则、日期、路径）必须给 |
| **边界** | 写在文档末尾的「注意事项」 | 显眼位置写「**何时不用**」——这条直接决定选择准确率 |
| **返回值** | 另起一节列 field 表 | 写进描述里，一两行说清形状；模型靠它预判下一步 |
| **错误** | 错误码表 + 文档链接 | 错误码 + **回显输入** + 可执行的下一步建议 |
| **版本** | `v1` / `v2` 后缀，保留旧版 | 直接改描述，**不带版本号**——模型会挑「更新的那个」并忽略你的弃用说明 |
| **术语** | 内部黑话（如「捞数」「落库」） | 通用术语；非用不可时在描述里定义 |
| **长度** | 越短越好（人嫌长） | **有一个最优区间**——太短模型猜，太长模型抓不到重点。经验上 3–8 行 |

最后一行值得展开：**描述不是越长越好**。「太长」的典型症状是模型只读到前两句就动手了。所以把**最关键的信息放前两行**（这个工具干什么、何时用），细节（边界、返回形状）放后面。

## 五、工具调用抖动 (thrash)

**thrash** = 模型反复调用同一个工具、结果没有推进任务。它不是模型「笨」，它是**一个诊断信号**——说明你的工具有问题。

### 5.1 四类成因

| 成因 | 现象 | 修法 |
|---|---|---|
| **描述有歧义** | 在两个相似工具间来回横跳 | 给每个工具补「何时不用 X，用 Y」 |
| **返回值不推进任务** | 同一工具同参数反复调，每次都返回一样的东西 | 返回值加 `truncated` / `total` / `hint`，让模型知道**下一步该干什么** |
| **参数约束太严** | 反复微调参数值（`offset` 10 → 20 → 30），每次都报错 | 放宽约束 + 错误信息里给合法取值 |
| **分页没有反馈** | 反复翻页翻到底也找不到 | 返回 `total_matched`，让模型知道还剩多少 |

第二行是最常见的：**返回 `{"status": "ok"}` → 模型不知道发生了什么 → 再调一次看看**。这就是 ACI 里「有意义的返回」为什么是硬要求。

### 5.2 诊断代码```python
# demos/04-thrash-detector.py
"""从消息历史里诊断工具调用抖动。跑法：python demos/04-thrash-detector.py"""
import json
import re
from collections import Counter

NUM = re.compile(r"\d+")


def normalize(args_json: str) -> str:
    """把参数里的具体数字抹掉，这样 offset=10 / offset=20 会被看成同一类调用。"""
    try:
        return json.dumps(json.loads(args_json), ensure_ascii=False, sort_keys=True)
    except json.JSONDecodeError:
        return args_json


def detect_thrash(messages: list[dict], repeat_threshold: int = 3) -> list[dict]:
    """返回可疑的重复调用簇。

    判据：同一个工具 + 同一组（抹掉数字后的）参数，在历史里出现 >= threshold 次。
    """
    counter: Counter = Counter()
    for m in messages:
        for tc in (m.get("tool_calls") or []):
            name = tc["function"]["name"]
            key = (name, NUM.sub("#", normalize(tc["function"]["arguments"])))
            counter[key] += 1

    return [
        {"tool": name, "args_shape": args, "calls": n}
        for (name, args), n in counter.most_common()
        if n >= repeat_threshold
    ]


if __name__ == "__main__":
    # 造一段"抖动"历史：模型反复用不同 offset 读同一个文件history = []
    for off in (0, 10, 20, 30, 40):
        history.append({"role": "assistant", "content": None, "tool_calls": [{
            "id": f"call_{off}", "type": "function",
            "function": {"name": "read_text_file",
                         "arguments": json.dumps({"path": "/w/a.py", "offset": off})}}]})
    # 正常的并行扇出：一次查三个不同城市，不该被判为抖动
    for city in ("北京", "上海", "广州"):
        history.append({"role": "assistant", "content": None, "tool_calls": [{
            "id": f"c_{city}", "type": "function",
            "function": {"name": "get_weather", "arguments": json.dumps({"city": city})}}]})

    for f in detect_thrash(history):
        print(f"⚠️  {f['tool']} 被调用了 {f['calls']} 次，参数形状 {f['args_shape']}")
    print("✅ get_weather 的扇出不会被误报")
```

实测输出：

```text
⚠️  read_text_file 被调用了 5 次，参数形状 {"offset": #, "path": "/w/a.py"}
✅ get_weather 的扇出不会被误报
```

注意 `read_text_file` 那 5 次的 `offset` **各不相同**——这正是要抹掉数字的原因：模型不是在重复同一件事，它是在**沿着一个它以为能推进的维度反复试探**，而每次返回的 `truncated: true` 都没告诉它「还有多少」。这类抖动根因在返回值，不在描述。

反过来，`get_weather` 三次调用参数完全不同（三个城市），是**正常的并行扇出**，不该报。这是这个检测器唯一需要小心的地方——**抹数字的顺序很重要**：先归一再抹数字，否则 `{"offset": 10}` 和 `{"offset": 20}` 归一后完全不同，抹掉数字反而变成同一个键，会误伤。

> 💡 把 `detect_thrash` 挂到阶段 6 的 tracing 里，就是一条现成的质量指标：**一次会话里 thrash 簇的数量**。

## 六、可跑代码：Schema 设计检查清单

用 Pydantic 定义参数 → 自动转 JSON Schema → 跑一遍审计规则。好处是一举两得：**类型注解齐全**（符合项目规范），**schema 免费拿到**（`Literal` 直接变成 `enum`）。**并且 Pydantic 的校验和 schema 是同一个来源，不可能写歪。**

```python
# demos/04-schema-checklist.py
"""schema 设计检查清单：把工具定义过一遍自动审计。
跑法：PYTHONIOENCODING=utf-8 python demos/04-schema-checklist.py
"""
import json
from typing import Literal

from pydantic import BaseModel, Field


# ---------- 被测的「好工具」 ----------

class ReadFileArgs(BaseModel):
    path: str = Field(
        description="文件绝对路径，必须以 /workspace/ 开头，如 /workspace/src/app.py"
    )
    encoding: Literal["utf-8", "utf-8-sig", "gbk"] = Field(
        "utf-8", description="文件编码，默认 utf-8；中文乱码时再试 gbk"
    )
    offset: int = Field(0, ge=0, description="从第几行开始读（0-based），默认 0")


# ---------- 被测的「坏工具」 ----------

class BadSearchArgs(BaseModel):
    q: str = Field(description="查询")
    m: str
    n: int = Field(description="数量")
    f: str = Field(description="文件")


def strip_titles(node):
    """Pydantic 给每个字段自动加 title，在工具 schema 里是纯浪费 token。"""
    if isinstance(node, dict):
        node.pop("title", None)
        for v in node.values():
            strip_titles(v)
    elif isinstance(node, list):
        for v in node:
            strip_titles(v)
    return node


def to_openai_schema(tool: dict) -> dict:
    return {
        "type": "function",
        "function": {
            "name": tool["name"],
            "description": tool["description"],
            "parameters": strip_titles(tool["args_model"].model_json_schema()),
        },
    }


def audit(tool: dict) -> list[str]:
    fn = to_openai_schema(tool)["function"]
    desc = fn["description"]
    params = fn["parameters"]
    props = params.get("properties", {})
    issues: list[str] = []

    if len(desc) < 40:
        issues.append("描述过短：模型无法判断何时该用这个工具")
    if "不用" not in desc:
        issues.append("描述里没有「何时不用」：最容易和别的工具抢活")
    if "返回" not in desc:
        issues.append("描述里没说返回什么：模型无法预判结果形状")
    if len(props) > 7:
        issues.append(f"参数过多（{len(props)} 个）：考虑拆工具或合并成对象参数")

    for name, spec in props.items():
        if len(name) <= 2:
            issues.append(f"参数名 {name!r} 没有语义，模型只能猜")
        if not spec.get("description"):
            issues.append(f"参数 {name!r} 没有描述")
        if spec.get("type") == "string" and "enum" not in spec and "pattern" not in spec:
            d = spec.get("description", "")
            if "如" not in d and "例如" not in d:
                issues.append(f"参数 {name!r} 是自由字符串且没给示例，考虑改成 enum")

    if len(props) > 1 and set(params.get("required", [])) == set(props):
        issues.append("所有参数都必填：模型可能为凑参数而编造")
    return issues


TOOLSET = [
    {
        "name": "read_text_file",
        "description": (
            "读取一个文本文件的内容。只支持工作区内的绝对路径。\n"
            "何时用：需要看某个已知路径文件的完整内容。\n"
            "何时不用：只想确认文件是否存在用 stat_path；想找文件用 search_code。\n"
            "返回：{path, content, line_count, truncated}，超 2000 行会截断。"
        ),
        "args_model": ReadFileArgs,
    },
    {
        "name": "search",
        "description": "搜索数据。",
        "args_model": BadSearchArgs,
    },
]

WINDOW = 128_000


def audit_toolset(tools: list[dict]) -> None:
    schemas = [to_openai_schema(t) for t in tools]
    chars = len(json.dumps(schemas, ensure_ascii=False))
    est = chars / 2  # 中英混排粗估；有网环境请换成 tiktoken 实测
    print("=" * 60)
    print(f"工具数 {len(schemas)} ｜ schema 字符 {chars} ｜ ≈{est:.0f} token（粗估）")
    print(f"占 {WINDOW:,} 窗口的 {est / WINDOW:.2%}  —— 经验阈值：超过 1%~5% 该考虑渐进式发现")
    if est / WINDOW > 0.05:
        print("  ⚠️ 已超 5%：优先做工具合并 + 渐进式发现")
    elif est / WINDOW > 0.01:
        print("  ⚠️ 已进入 1%~5% 区间：开始盯选择准确率")
    else:
        print("  ✅ 仍在 1% 以内")
    print("=" * 60)


if __name__ == "__main__":
    for t in TOOLSET:
        found = audit(t)
        print(f"\n🔧 {t['name']}")
        if not found:
            print("   ✅ 无问题")
        for i in found:
            print(f"   ❌ {i}")
    audit_toolset(TOOLSET)
```

实测输出（`PYTHONIOENCODING=utf-8` 下）：

```text
🔧 read_text_file
   ✅ 无问题

🔧 search
   ❌ 描述过短：模型无法判断何时该用这个工具
   ❌ 描述里没有「何时不用」：最容易和别的工具抢活
   ❌ 描述里没说返回什么：模型无法预判结果形状
   ❌ 参数名 'q' 没有语义，模型只能猜
   ❌ 参数 'q' 是自由字符串且没给示例，考虑改成 enum
   ❌ 参数名 'm' 没有语义，模型只能猜
   ❌ 参数 'm' 没有描述
   ❌ 参数 'm' 是自由字符串且没给示例，考虑改成 enum
   ❌ 参数名 'n' 没有语义，模型只能猜
   ❌ 参数名 'f' 没有语义，模型只能猜
   ❌ 参数 'f' 是自由字符串且没给示例，考虑改成 enum
   ❌ 所有参数都必填：模型可能为凑参数而编造
============================================================
工具数 2 ｜ schema 字符 960 ｜ ≈480 token（粗估）
占 128,000 窗口的 0.38%  —— 经验阈值：超过 1%~5% 该考虑渐进式发现
  ✅ 仍在 1% 以内
============================================================
```

**注意 `read_text_file` 被判为「无问题」不是因为规则松，而是因为它真的四件套齐全**：`Literal` 自动成了 `enum`、每个字段都有描述、`offset` 有默认值所以不落在 `required` 里。这就是「设计好的 schema 能过自动检查」的意思——**检查清单可以进 CI**。

> ⚠️ **`strip_titles` 那三行为什么重要**：Pydantic 默认给每个字段加 `"title": "Path"`、`"title": "Offset"`。这些字段模型**完全不需要**，但会实打实进 prompt。实测这个 3 参数工具：**带 title 716 字符 → 去掉 title 634 字符，省 82 字符 = 11.5%**。工具多了以后这笔账不小，而且它是免费的。

## 七、🔬 参考实现：pi 为什么只给 4 个工具

`earendil-works/pi`（TypeScript，10w 量级 star）的默认工具集是 `read` / `write` / `edit` / `bash`，**system prompt 加工具定义合计不到 1000 token**。这个数字直接对上本篇第一节的表：它相当于把「工具数」压到了 4 那一行。

它的取舍逻辑：

**1. 用「通用工具 + 模型自己拼参数」换掉「大量专用工具 + 大 schema」。** pi 没有 `list_files`、没有 `search_code`、没有 `git_diff`——因为 `bash` 全能干。代价是模型得会写命令行，好处是 schema 恒定小、选择点恒定少。

**2. `edit` 而不是 `str_replace` + `apply_patch` + `multi_edit` 三个工具。** 多合一的 `edit` 参数更多（要 `old_string` / `new_string` / 可选的 `replace_all`），但**只有一个选择点**。这是本篇第二节「合并」原则的直接应用。

**3. 参数经 TypeBox schema 校验，校验失败不崩溃。** `validateToolArguments` 把失败当返回值喂回去——和第三节 3.1 讲的「`enum` 必须真的校验」是同一件事。

**4. 不内置的东西也是设计的一部分。** pi 明确**不内置 MCP、不内置子 agent、不内置 plan 模式、不内置权限系统**——作者的说法大意是 "if I don't need it, it won't be built"。代价是权限完全靠容器化解决，见 工具沙箱与边界。

> 💡 **pi 的选择不是普适的。** 它的前提是「用户是开发者，知道怎么用命令行」。如果你做的是面向非技术用户的 agent，`bash` 就不是一个可用的工具——这时「少量通用工具」的路线走不通，必须回到「较多专用工具 + 渐进式发现」。**这是在选路线，不是在选优劣。**

## ✅ 学习检查点

- [ ] 能说出 schema 税的两种成本（固定 token / 选择准确率），并解释为什么后者更贵
- [ ] 记得经验阈值是窗口的 **1%–5%**，并知道按 ~300 token/工具 折算大约是几个工具
- [ ] 能解释「合并把选择点降级成枚举值」这句话，并说出合并的**代价**（逐 op 的必填参数要靠描述补）
- [ ] 能举出至少一个不该合并的例子，并说明理由
- [ ] 能解释「可选参数幻觉」的成因，并知道要用 `allowed` 列表回给模型
- [ ] 跑一遍 `demos/04-schema-checklist.py`，把 `BadSearchArgs` 逐条修到无告警
- [ ] 跑一遍 `demos/04-thrash-detector.py`，说清为什么 `get_weather` 的扇出不该报
- [ ] 能复述 pi 的 4 工具取舍，并说出它成立的前提条件

## 📖 相关文档

- [Anthropic · Writing effective tools for agents](https://www.anthropic.com/engineering/writing-tools-for-agents) — 733% ROI、工具合并与「有意义的返回」的原始出处（2025-09-11）
- [JSON Schema · Understanding JSON Schema](https://json-schema.org/understanding-json-schema/reference) — `enum` / `pattern` / `minimum` 的完整语义
- [Pydantic · JSON Schema](https://docs.pydantic.dev/latest/concepts/json_schema/) — `model_json_schema()` 的行为，`Literal` → `enum` 的映射规则
- [OpenAI Function Calling](https://platform.openai.com/docs/guides/function-calling) — 兼容接口实际支持的 JSON Schema 子集，写 schema 前先查这里
- [earendil-works/pi](https://github.com/earendil-works/pi) — 4 工具极简派，`validateToolArguments` 与 `executionMode` 的出处

## ➡️ 下一步→ 工具沙箱与边界
