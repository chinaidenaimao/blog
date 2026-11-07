---
title: 写作环境折腾记：从 Typora 到 Obsidian
date: 2026-03-05 22:20:00
cover: /img/album/daily/cat-by-window.jpg
top_img: /img/album/daily/cat-by-window.jpg
description: "工具换了四轮，最后留在 Obsidian 的理由只有一个：双链。"
categories:
  - 开发日常
tags:
  - 工具
  - Obsidian
  - 写作
---

## 用过的东西

- **Typora**：好看，所见即所得，但一篇一篇是孤岛
- **VS Code + Markdown Preview**：写代码顺手，写文章太"工程师"
- **Notion**：协作强，离线弱，导出 Markdown 一堆多余格式
- **Obsidian**：本地文件、双链、插件生态

最后留在 Obsidian，理由只有一个：**笔记之间能互相指认**。

## 双链到底解决了什么

以前写笔记，写完之后就再也找不到了。搜索只能搜到关键词，搜不到"我当时为什么这么想"。

双链把笔记变成一张网：

```markdown
JWT 的验签流程见 [[认证机制详解]]，和 [[事务边界该由谁提交]] 是两类问题。
```

半年后再看，顺着链接就能回到当时的上下文。

## 代价

Obsidian 的语法不是标准 Markdown：

- `[[wiki 链接]]`
- `![[图片]]`
- `> [!note]` callout
- 手写 `## 目录` 配一堆 `- [[#锚点]]`

这些放到博客里全是**乱码**。

## 所以后来写了个转换脚本

一开始是手工改，改到第三篇就放弃了。后来写了 `tools/import-obsidian.py`，自动处理：

- wiki 链接 → 纯文本或别名
- 图片引用 → 拷贝到 `source/img/posts/<slug>/` 并改写路径
- callout → 加粗引用块
- 手写目录 → 整块删掉（主题右侧自带 TOC）

现在从 Obsidian 到博客，只有一条命令：

```bash
python tools/import-obsidian.py
```

## 一点反思

工具选型最怕的是"为了工具而工具"。

我花在折腾写作环境上的时间，大概能写完十篇文章。但另一方面，**如果环境不顺手，那十篇根本不会存在**。

所以这笔账算不清。只能说：折腾到某个点就该停，然后开始写。
