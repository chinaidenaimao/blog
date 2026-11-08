#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
把 Obsidian 笔记导入成 Hexo 文章。

用法：
    python tools/import-obsidian.py

做的事：
  1. 读取 Obsidian 的 md（含 front-matter）
  2. 清理 Obsidian 专有语法：[[wiki 链接]]、![[图片]]、> [!callout]、%%注释%%
  3. 把引用的图片压缩成 webp 拷到 source/img/posts/<slug>/
  4. 生成 Hexo front-matter，写到 source/_posts/

以后想再加笔记，只要往 POSTS 里加一行，重新跑一遍即可。
"""

import os
import re
import sys
import shutil
import hashlib
import unicodedata

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
POST_DIR = os.path.join(ROOT, "source", "_posts")
IMG_DIR = os.path.join(ROOT, "source", "img", "posts")

VAULT_FRONTEND = r"D:\ai-demo\obsidian"
VAULT_AGENT = r"D:\ai-demo\langchian\obsidian"
VAULT_DB = r"E:\leran\db\server\obsidian"
VAULT_RAG = r"D:\ai-demo\RAG\obsidian-vault"
VAULT_AILAB = r"D:\ai-demo\AI_laboratory\ai-laboratory\docs"
VAULT_PDF = r"D:\ai-demo\learn-PDF\docs"
VAULT_TOUTIAO = r"D:\ai-demo\python\toutiao_houtai\docs"

# ---------------------------------------------------------------- 文章清单
# (源文件, slug, 标题, 日期, 分类, 标签, 封面)
POSTS = [
    # ---- 前端 ----
    (rf"{VAULT_FRONTEND}\前端面试手册\01-JavaScript\README.md", "fe-interview-javascript",
     "前端面试手册 · JavaScript 核心", "2025-11-16 21:00:00", "前端",
     ["JavaScript", "面试", "前端面试手册"]),

    (rf"{VAULT_FRONTEND}\前端面试手册\02-CSS\README.md", "fe-interview-css",
     "前端面试手册 · CSS 布局与渲染", "2025-12-03 22:10:00", "前端",
     ["CSS", "面试", "前端面试手册"]),

    (rf"{VAULT_FRONTEND}\前端面试手册\10-Git\README.md", "fe-interview-git",
     "前端面试手册 · Git 版本控制", "2025-12-21 20:30:00", "前端",
     ["Git", "面试", "前端面试手册"]),

    (rf"{VAULT_FRONTEND}\前端面试手册\13-设计模式\README.md", "fe-interview-patterns",
     "前端面试手册 · 设计模式", "2026-01-09 21:40:00", "前端",
     ["设计模式", "面试", "前端面试手册"]),

    # ---- 后端 ----
    (rf"{VAULT_FRONTEND}\python\python\MySQL 常用语句大全（完整版）.md", "mysql-cheatsheet",
     "MySQL 常用语句速查手册", "2026-01-27 22:00:00", "后端",
     ["MySQL", "SQL", "速查"]),

    (rf"{VAULT_FRONTEND}\python\python\Python FastAPI 完整教程.md", "fastapi-complete-guide",
     "FastAPI 完整教程：从路由到依赖注入", "2026-02-14 21:20:00", "后端",
     ["FastAPI", "Python", "教程"]),

    (rf"{VAULT_FRONTEND}\python\python\Pydantic 数据模型教程.md", "pydantic-tutorial",
     "Pydantic 数据模型教程：校验、序列化与配置", "2026-02-28 23:00:00", "后端",
     ["Pydantic", "Python", "数据校验"]),

    (rf"{VAULT_FRONTEND}\python\python\SQLAlchemy ORM 完整教程.md", "sqlalchemy-orm-guide",
     "SQLAlchemy ORM 完整教程", "2026-03-12 21:30:00", "后端",
     ["SQLAlchemy", "Python", "ORM", "数据库"]),

    (rf"{VAULT_FRONTEND}\python\python\数据库设计与实践教程.md", "database-design-practice",
     "数据库设计与实践：从范式到索引", "2026-03-26 22:40:00", "后端",
     ["数据库", "设计", "MySQL"]),

    (rf"{VAULT_FRONTEND}\python\python\FastAPI 实战 TODO 应用.md", "fastapi-todo-app",
     "FastAPI 实战：写一个 TODO 应用", "2026-04-08 21:00:00", "后端",
     ["FastAPI", "实战", "Python"]),

    (rf"{VAULT_FRONTEND}\python\python\FastAPI模块化路由入门.md", "fastapi-modular-router",
     "FastAPI 模块化路由入门", "2026-04-21 20:20:00", "后端",
     ["FastAPI", "工程化", "Python"]),

    (rf"{VAULT_FRONTEND}\python\python\2026-06-27-FastAPI异步数据库学习.md", "fastapi-async-db",
     "FastAPI 异步数据库：async session 怎么用", "2026-05-06 23:10:00", "后端",
     ["FastAPI", "异步", "SQLAlchemy"]),

    (rf"{VAULT_FRONTEND}\python\python\2026-07-02-ORM增删查操作学习.md", "orm-crud-notes",
     "ORM 增删查改的几种写法与坑", "2026-05-18 22:30:00", "后端",
     ["SQLAlchemy", "ORM", "笔记"]),

    (rf"{VAULT_FRONTEND}\python\python\2026-07-07-Passlib加密处理学习.md", "passlib-password-hash",
     "用 Passlib 做密码加密：从明文到 bcrypt", "2026-06-02 21:50:00", "后端",
     ["Passlib", "安全", "Python"]),

    (rf"{VAULT_FRONTEND}\python\python\2026-08-05-FastAPI文件上传学习.md", "fastapi-file-upload",
     "FastAPI 文件上传：校验、存储与返回", "2026-06-14 22:00:00", "后端",
     ["FastAPI", "文件上传", "Python"]),

    (rf"{VAULT_FRONTEND}\python\python\FastAPI从零搭建项目+LangChain大模型接口完整教程.md", "fastapi-langchain-api",
     "从零搭一个 FastAPI + LangChain 大模型接口", "2026-06-27 21:30:00", "后端",
     ["FastAPI", "LangChain", "实战"]),

    # ---- 工程实践 ----
    (rf"{VAULT_DB}\05-问题解答\Q-01-添加JWT登录鉴权.md", "jwt-auth-in-practice",
     "给项目加 JWT 登录鉴权：完整八步", "2026-07-11 22:20:00", "后端",
     ["JWT", "鉴权", "工程实践"]),

    (rf"{VAULT_DB}\05-问题解答\Q-07-Nginx反向代理详解.md", "nginx-reverse-proxy",
     "Nginx 反向代理详解：从配置到排错", "2026-07-25 21:00:00", "后端",
     ["Nginx", "部署", "工程实践"]),

    (rf"{VAULT_DB}\05-问题解答\Q-15-事务边界该由谁提交.md", "transaction-boundary",
     "事务边界该由谁提交？一次踩坑复盘", "2026-08-04 23:30:00", "后端",
     ["事务", "数据库", "工程实践"]),

    (rf"{VAULT_DB}\05-问题解答\Q-27-分页功能怎么设计成可复用.md", "reusable-pagination",
     "分页功能怎么设计成可复用组件", "2026-08-12 22:10:00", "后端",
     ["分页", "API设计", "工程实践"]),

    (rf"{VAULT_DB}\05-问题解答\Q-08-企业级异常处理工程化.md", "exception-handling",
     "企业级异常处理工程化：从 try/except 到全局兜底", "2026-08-20 21:40:00", "后端",
     ["异常处理", "架构", "工程实践"]),

    # ---- AI ----
    (rf"{VAULT_AGENT}\Agent学习路径-v2\01-地基\01-什么是AI-Agent.md", "what-is-ai-agent",
     "什么是 AI Agent：一条判据分清 Agent / LLM / Chatbot", "2026-08-28 21:00:00", "AI",
     ["Agent", "LLM", "概念"]),

    (rf"{VAULT_AGENT}\Agent学习路径-v2\01-地基\03-Prompt-工程.md", "prompt-engineering",
     "Prompt 工程：把指令写清楚比调参有用", "2026-09-05 22:30:00", "AI",
     ["Prompt", "LLM", "工程化"]),

    (rf"{VAULT_AGENT}\Agent学习路径-v2\02-工具与循环\01-Function-Calling原理.md", "function-calling",
     "Function Calling 原理：模型是怎么「调用」工具的", "2026-09-12 21:20:00", "AI",
     ["Function Calling", "Agent", "工具"]),

    (rf"{VAULT_AGENT}\Agent学习路径-v2\02-工具与循环\02-手写第一个Agent-Loop.md", "agent-loop",
     "手写第一个 Agent Loop", "2026-09-19 23:00:00", "AI",
     ["Agent", "实战", "Loop"]),

    (rf"{VAULT_AGENT}\Agent学习路径-v2\02-工具与循环\03-ReAct模式.md", "react-pattern",
     "ReAct 模式：思考、行动、观察的循环", "2026-09-26 21:10:00", "AI",
     ["ReAct", "Agent", "模式"]),

    (rf"{VAULT_AGENT}\Agent学习路径-v2\03-上下文与记忆\01-上下文工程总论.md", "context-engineering",
     "上下文工程总论：模型的记忆是有限的", "2026-10-03 22:40:00", "AI",
     ["上下文", "Agent", "记忆"]),

    (rf"{VAULT_AGENT}\Agent学习路径-v2\03-上下文与记忆\03-压缩与摘要策略.md", "context-compression",
     "上下文压缩与摘要策略", "2026-10-10 21:30:00", "AI",
     ["上下文", "压缩", "Agent"]),

    (rf"{VAULT_AGENT}\Agent学习路径-v2\05-多Agent与协议\01-MCP协议.md", "mcp-protocol",
     "MCP 协议：给 Agent 一个统一的工具插座", "2026-10-17 22:00:00", "AI",
     ["MCP", "协议", "Agent"]),

    (rf"{VAULT_AGENT}\Agent学习路径-v2\04-工具设计\02-工具Schema与选择准确率.md", "tool-schema-design",
     "工具 Schema 设计：为什么模型选错了工具", "2026-10-24 21:40:00", "AI",
     ["工具", "Schema", "Agent"]),

    # ---- 第二批：前端 ----
    (rf"{VAULT_RAG}\02-前端工程化封装-Vue.md", "vue-engineering",
     "Vue 工程化封装：目录、路由与请求层", "2025-11-28 21:30:00", "前端",
     ["Vue", "工程化", "前端"]),

    (rf"{VAULT_RAG}\09-文件上传与下载封装.md", "file-upload-frontend",
     "文件上传与下载的前端封装", "2025-12-12 22:10:00", "前端",
     ["文件上传", "Vue", "封装"]),

    # ---- 第二批：后端 ----
    (rf"{VAULT_RAG}\03-后端工程化封装-FastAPI.md", "fastapi-engineering",
     "FastAPI 工程化封装：分层、依赖与统一响应", "2026-01-18 21:00:00", "后端",
     ["FastAPI", "工程化", "架构"]),

    (rf"{VAULT_RAG}\04-跨栈架构思路转译.md", "cross-stack-architecture",
     "把 Java 的架构思路翻译成 Python", "2026-02-06 22:30:00", "后端",
     ["架构", "Java", "Python"]),

    (rf"{VAULT_TOUTIAO}\02-数据库设计.md", "db-design-toutiao",
     "一个内容后台的数据库设计", "2026-02-22 21:20:00", "后端",
     ["数据库", "设计", "实战"]),

    (rf"{VAULT_TOUTIAO}\07-路由层实现.md", "router-layer",
     "路由层实现：把接口按模块拆开", "2026-03-04 22:00:00", "后端",
     ["FastAPI", "路由", "分层"]),

    (rf"{VAULT_TOUTIAO}\06-CRUD层实现.md", "crud-layer",
     "CRUD 层实现：把数据库操作收口", "2026-03-18 21:40:00", "后端",
     ["CRUD", "ORM", "分层"]),

    (rf"{VAULT_TOUTIAO}\08-认证机制详解.md", "auth-mechanism",
     "认证机制详解：JWT 与 Session 怎么选", "2026-04-02 22:20:00", "后端",
     ["JWT", "Session", "认证"]),

    (rf"{VAULT_PDF}\ARCHITECTURE.md", "project-architecture",
     "项目架构文档怎么写：一份可复用的模板", "2026-04-14 21:10:00", "后端",
     ["架构", "文档", "工程化"]),

    (rf"{VAULT_PDF}\DEPLOYMENT.md", "deployment-guide",
     "从本地到上线的部署清单", "2026-04-27 22:40:00", "后端",
     ["部署", "运维", "清单"]),

    # ---- 第二批：方法论 ----
    (rf"{VAULT_RAG}\01-项目筛选清单.md", "project-selection",
     "怎么挑一个能写进简历的项目", "2026-05-12 21:00:00", "工程实践",
     ["项目", "方法论", "简历"]),

    (rf"{VAULT_RAG}\05-落地蓝图与检查清单.md", "delivery-checklist",
     "项目落地蓝图与检查清单", "2026-05-26 22:30:00", "工程实践",
     ["落地", "清单", "方法论"]),

    (rf"{VAULT_RAG}\08-面试自测与速记卡.md", "interview-cards",
     "面试自测与速记卡", "2026-06-08 21:50:00", "工程实践",
     ["面试", "速记", "方法论"]),

    # ---- 第二批：AI ----
    (rf"{VAULT_RAG}\11-LangChain 1.x 心智模型与最小上手.md", "langchain-1x",
     "LangChain 1.x 心智模型与最小上手", "2026-06-20 22:00:00", "AI",
     ["LangChain", "LLM", "入门"]),

    (rf"{VAULT_RAG}\12-工具调用与 Agent 循环.md", "tool-calling-loop",
     "工具调用与 Agent 循环", "2026-07-02 21:30:00", "AI",
     ["工具调用", "Agent", "循环"]),

    (rf"{VAULT_RAG}\13-中间件机制.md", "middleware-mechanism",
     "中间件机制：洋葱模型到底怎么穿", "2026-07-16 22:20:00", "AI",
     ["中间件", "LangChain", "架构"]),

    (rf"{VAULT_RAG}\14-LangGraph 核心原语.md", "langgraph-primitives",
     "LangGraph 核心原语：节点、边、状态", "2026-07-30 21:10:00", "AI",
     ["LangGraph", "Agent", "原语"]),

    (rf"{VAULT_RAG}\15-检查点、中断与持久化.md", "checkpoint-interrupt",
     "检查点、中断与持久化", "2026-08-08 22:40:00", "AI",
     ["LangGraph", "持久化", "中断"]),

    (rf"{VAULT_RAG}\16-生产落地与选型.md", "ai-production",
     "AI 应用生产落地与选型", "2026-08-16 21:20:00", "AI",
     ["选型", "生产", "AI"]),

    (rf"{VAULT_AILAB}\01-LangGraph基础入门.md", "langgraph-basics",
     "LangGraph 基础入门：从状态图开始", "2026-08-24 22:00:00", "AI",
     ["LangGraph", "Agent", "入门"]),
]

# ---------------------------------------------------------------- 置顶
# 首页顶部「荐」卡片的排序，数字越大越靠前（只对下面 POSTS 里的 slug 生效）
PINNED = {
    "what-is-ai-agent": 2,
    "fe-interview-javascript": 1,
}

# ---------------------------------------------------------------- 图片处理
IMAGE_EXT = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".svg"}

# 全局文件名索引，用于兜底查找图片
_name_index = {}


def build_index():
    for vault in (VAULT_FRONTEND, VAULT_AGENT, VAULT_DB, VAULT_RAG, VAULT_AILAB, VAULT_PDF, VAULT_TOUTIAO):
        for dp, dn, fn in os.walk(vault):
            dn[:] = [d for d in dn if d not in (".obsidian", ".git", "node_modules")]
            for f in fn:
                if os.path.splitext(f)[1].lower() in IMAGE_EXT:
                    _name_index.setdefault(f, os.path.join(dp, f))


def resolve_image(ref, note_dir):
    ref = ref.split("|")[0].strip()
    ref = ref.replace("\\", "/")
    for base in (note_dir, os.path.dirname(note_dir), os.path.dirname(os.path.dirname(note_dir))):
        p = os.path.join(base, ref.replace("/", os.sep))
        if os.path.isfile(p):
            return p
    return _name_index.get(os.path.basename(ref))


def convert_image(src, dst_dir, slug):
    """压缩成 webp，失败就原样拷贝"""
    name = hashlib.md5((slug + src).encode("utf-8")).hexdigest()[:10]
    dst = os.path.join(dst_dir, name + ".webp")
    if os.path.exists(dst):
        return os.path.basename(dst)
    try:
        from PIL import Image
        im = Image.open(src)
        if im.mode in ("RGBA", "LA", "P"):
            im = im.convert("RGBA")
        if im.width > 1100:
            im = im.resize((1100, int(im.height * 1100 / im.width)), Image.LANCZOS)
        im.save(dst, "WEBP", quality=78, method=4)
        return os.path.basename(dst)
    except Exception:
        ext = os.path.splitext(src)[1].lower() or ".png"
        dst2 = os.path.join(dst_dir, name + ext)
        # 已经拷过就别再覆盖（否则会把 tools/compress-images.js 压缩好的图还原成原图）
        if not os.path.exists(dst2):
            shutil.copyfile(src, dst2)
        return os.path.basename(dst2)


# ---------------------------------------------------------------- 文本清理
CALLOUT_LABEL = {
    "note": "📝 说明", "info": "ℹ️ 信息", "tip": "💡 提示", "hint": "💡 提示",
    "warning": "⚠️ 注意", "caution": "⚠️ 注意", "danger": "🚫 危险", "error": "🚫 错误",
    "question": "❓ 问题", "example": "🧪 示例", "summary": "📌 小结",
    "quote": "💬 引用", "todo": "✅ 待办", "success": "✅ 完成", "abstract": "📋 摘要",
}


def normalize_cjk(text):
    """PDF 提取常把汉字换成康熙部首（如 ⼯ → 工），只对部首区做 NFKC"""
    out = []
    for ch in text:
        if 0x2E80 <= ord(ch) <= 0x2FDF:
            out.append(unicodedata.normalize("NFKC", ch))
        else:
            out.append(ch)
    return "".join(out)


def merge_broken_headings(text):
    """PDF 里被硬换行切断的标题，重新拼回去"""
    lines = text.split("\n")
    out = []
    i = 0
    while i < len(lines):
        line = lines[i]
        if line.lstrip().startswith("#") and len(line.strip()) < 60:
            merged = line.rstrip()
            j = i + 1
            for _ in range(3):  # 最多拼 3 段
                k = j
                while k < len(lines) and not lines[k].strip():
                    k += 1
                if k >= len(lines):
                    break
                nxt = lines[k].strip()
                # 注意：不能把 ``` 代码围栏并进标题，否则围栏失效、示例 CSS 会作用到整页
                if nxt and len(nxt) <= 12 and not re.match(r"^[#\-*+>|!`]|^\d+[.)]\s", nxt):
                    merged += nxt
                    j = k + 1
                else:
                    break
            if j > i + 1:
                out.append(merged)
                i = j
                continue
        out.append(line)
        i += 1
    return "\n".join(out)


def clean_body(text, note_dir, slug):
    lines = text.split("\n")
    out = []
    img_dir = os.path.join(IMG_DIR, slug)
    os.makedirs(img_dir, exist_ok=True)
    used_img = 0

    # 去掉开头的手写目录（- [[#...]] 连续块）
    cleaned = []
    i = 0
    while i < len(lines):
        line = lines[i]
        if re.match(r"^\s*[-*]\s*\[\[#", line):
            # 跳过整段目录，直到遇到非目录行
            while i < len(lines) and (re.match(r"^\s*[-*]\s*\[\[#", lines[i]) or lines[i].strip() == ""):
                i += 1
            # 去掉目录后面紧跟的分隔线
            if i < len(lines) and re.match(r"^-{3,}$", lines[i].strip()):
                i += 1
            continue
        cleaned.append(line)
        i += 1
    lines = cleaned

    for line in lines:
        # 图片：![[xxx.png]] / ![[xxx.png|300]]
        def _wiki_img(m):
            nonlocal used_img
            p = resolve_image(m.group(1), note_dir)
            if not p:
                return ""
            fn = convert_image(p, img_dir, slug)
            used_img += 1
            return f"![](/img/posts/{slug}/{fn})"

        line = re.sub(r"!\[\[([^\]]+)\]\]", _wiki_img, line)

        # 图片：![alt](path)
        def _md_img(m):
            nonlocal used_img
            alt, ref = m.group(1), m.group(2)
            if ref.startswith(("http://", "https://", "/img/", "data:")):
                return m.group(0)
            p = resolve_image(ref, note_dir)
            if not p:
                return ""
            fn = convert_image(p, img_dir, slug)
            used_img += 1
            return f"![{alt}](/img/posts/{slug}/{fn})"

        line = re.sub(r"!\[([^\]]*)\]\(([^)]+)\)", _md_img, line)

        # wiki 链接：[[目标|别名]] / [[#锚点|别名]] / [[目标]]
        def _wiki(m):
            inner = m.group(1)
            parts = inner.split("|")
            if len(parts) > 1:
                return parts[1].strip()
            target = parts[0].strip().lstrip("#")
            return target

        line = re.sub(r"\[\[([^\]]+)\]\]", _wiki, line)

        # callout
        m = re.match(r"^(\s*>\s*)\[!(\w+)\]\s*(.*)$", line)
        if m:
            prefix, kind, title = m.group(1), m.group(2).lower(), m.group(3).strip()
            label = CALLOUT_LABEL.get(kind, "📝 说明")
            plain_label = label.split(" ", 1)[-1]
            if title and title != plain_label:
                line = f"{prefix}**{label}：{title}**"
            else:
                line = f"{prefix}**{label}**"

        out.append(line)

    text = "\n".join(out)
    text = re.sub(r"%%.*?%%", "", text, flags=re.S)          # %%注释%%
    text = re.sub(r"\n{4,}", "\n\n\n", text)                  # 多余空行

    # 目录被清空后，残留的“## 📑 目录”整块也去掉
    lines = text.split("\n")
    keep = []
    idx = 0
    toc_re = re.compile(r"^#{1,4}\s*(📑|📚|🗂)?\s*(目录|目錄|Table of Contents|TOC|教程目录|内容目录)\s*$", re.I)
    while idx < len(lines):
        line = lines[idx]
        if toc_re.match(line.strip()):
            # 往后找这一块的结束位置：分隔线、同级或更高级标题、或 60 行内没找到
            j = idx + 1
            end = None
            while j < len(lines) and j - idx < 80:
                s = lines[j].strip()
                if re.match(r"^-{3,}$", s):
                    end = j
                    break
                if re.match(r"^#{1,2}\s", s):
                    end = j
                    break
                j += 1
            if end is not None:
                idx = end + 1 if re.match(r"^-{3,}$", lines[end].strip()) else end
                continue
        keep.append(line)
        idx += 1
    text = "\n".join(keep)
    text = normalize_cjk(text)
    text = merge_broken_headings(text)
    text = re.sub(r"\n{4,}", "\n\n\n", text)
    return text.strip(), used_img


def parse_front_matter(text):
    meta = {}
    if text.startswith("---"):
        end = text.find("\n---", 3)
        if end != -1:
            fm = text[3:end]
            body = text[end + 4:]
            for line in fm.split("\n"):
                if ":" in line and not line.startswith((" ", "\t", "-")):
                    k, v = line.split(":", 1)
                    meta[k.strip()] = v.strip().strip('"').strip("'")
            return meta, body.lstrip("\n")
    return meta, text


def clean_inline(s):
    s = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", s)
    s = re.sub(r"[*_`#]", "", s)
    return re.sub(r"\s+", " ", s).strip()


def first_paragraph(body):
    """优先用开头的引用块当摘要（很多笔记把导语写在 > 里），否则取正文第一段"""
    lines = [l.strip() for l in body.split("\n")]

    quote = []
    for l in lines:
        if not l:
            if quote:
                break
            continue
        if l.startswith(">"):
            t = re.sub(r"^>\s*", "", l)
            t = re.sub(r"^\[!\w+\]\s*", "", t)
            if t and not re.fullmatch(r"\*\*.+\*\*", t):
                quote.append(t)
        elif quote:
            break

    text = clean_inline(" ".join(quote))
    if len(text) >= 20:
        return text[:80] + ("…" if len(text) > 80 else "")

    for l in lines:
        if not l:
            continue
        if re.match(r"^(#|>|\||```|---|!|<|[-*+]\s|\d+[.)]\s)", l):
            continue
        t = clean_inline(l)
        if len(t) >= 25:
            return t[:80] + ("…" if len(t) > 80 else "")
    return ""


def yaml_str(s):
    s = s.replace("\\", "\\\\").replace('"', '\\"').replace("\n", " ").strip()
    return '"' + s + '"'


def main():
    if not os.path.isdir(POST_DIR):
        sys.exit("找不到 source/_posts")
    build_index()
    os.makedirs(IMG_DIR, exist_ok=True)

    ok, skipped, total_imgs = 0, 0, 0
    for src, slug, title, date, cat, tags in POSTS:
        cover = f"/img/covers/{slug}.svg"
        if not os.path.isfile(src):
            print(f"  ✗ 源文件不存在：{src}")
            skipped += 1
            continue

        raw = open(src, encoding="utf-8").read()
        meta, body = parse_front_matter(raw)

        # 去掉正文里的 H1（标题交给 front-matter）
        body = re.sub(r"^\s*#\s+.*?\n", "", body, count=1)
        body = re.sub(r"^\s*>\s*\[!.*?\n", "", body, count=1) if body.startswith(">") else body

        body, imgs = clean_body(body, os.path.dirname(src), slug)
        total_imgs += imgs
        desc = first_paragraph(body)

        # 含 {{ }} / {% %} 的正文包一层 raw，避免被 Hexo 标签解析
        if re.search(r"\{\{|\{%", body):
            body = "{% raw %}\n" + body + "\n{% endraw %}"

        tag_lines = "\n".join(f"  - {t}" for t in tags)
        pin = f"\ntop_group_index: {PINNED[slug]}" if slug in PINNED else ""
        content = f"""---
title: {yaml_str(title)}
date: {date}
cover: {cover}
top_img: {cover}
description: {yaml_str(desc)}
categories:
  - {cat}
tags:
{tag_lines}{pin}
---

{body}
"""
        with open(os.path.join(POST_DIR, f"{slug}.md"), "w", encoding="utf-8") as f:
            f.write(content)
        ok += 1
        print(f"  ✓ {slug:34} 图 {imgs:3}  {title}")

    print(f"\n完成：导入 {ok} 篇，跳过 {skipped} 篇，图片 {total_imgs} 张")


if __name__ == "__main__":
    main()
