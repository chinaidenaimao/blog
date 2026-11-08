---
title: hexo clean 要 3 分钟，我把它干到 3 秒
date: 2026-11-07 16:20:00
cover: /img/album/night/neon-rain-street.jpg
top_img: /img/album/night/neon-rain-street.jpg
description: "一次构建 10 分 45 秒，内部只用了 3.29 秒——剩下 10 分钟全耗在删文件上。"
categories:
  - 开发日常
tags:
  - Hexo
  - 性能
  - 排查
---

## 现象

改完配置重新构建，去泡了杯咖啡，回来还在转。

`hexo generate` 的输出明明写着：

```
INFO  385 files generated in 3.29 s
```

但命令行里 `time` 报的是 **10 分 45 秒**。

## 拆开看

分别计时：

| 命令 | 实际耗时 |
| --- | --- |
| `hexo generate` 内部 | 3–4 秒 |
| `hexo generate` 整体 | 12 秒 |
| `hexo clean` | **3 分 01 秒** |
| `rm -rf public`（同样的目录） | **2.3 秒** |

同一个目录，同一批文件，`hexo clean` 比原生删除慢 **78 倍**。

## 为什么

`hexo clean` 走的是 Node 的 `rimraf`，在 Windows 上逐文件 unlink。每次 unlink 都会被 Defender 实时扫描拦一下，409 个文件 × 几百毫秒 ≈ 3 分钟。

`rm -rf` 是系统调用直接删目录树，绕过了大部分开销。

还有个放大器：**dev server 在后台跑着**。它监听整个目录，`clean` 删文件时句柄被占，删除失败要重试，于是 3 分钟变成了 10 分钟。

## 改法

把 `hexo clean` 换掉，直接用 `fs.rmSync`：

```jso
n
{
  "scripts": {
    "clean": "node -e \"const f=require('fs');f.rmSync('public',{recursive:true,force:true});f.rmSync('db.json',{force:true})\"",
    "rebuild": "npm run clean && hexo generate"
  }
}
```

`fs.rmSync` 带 `recursive: true` 在 Windows 上走的是同一套系统调用，比 rimraf 的逐文件循环快得多。

结果：

```
clean   3.6s   （原来 181s）
rebuild 14s    （原来 3 分钟起步）
```

## 顺带修的另一件事

`search.xml` 有 **1.87MB**——34 篇文章的全文索引。

主题默认 `local_search.preload: true`，意思是**每个页面**都预加载这 1.87MB 并解析一遍。

改成 `false`，点开搜索框才加载。首屏立刻轻了。

## 小结

性能问题最容易犯的错是"猜"。

我一开始以为是文章太多、图片太大，甚至想过去优化 Markdown 渲染。实际测下来，**99% 的时间花在一个我根本没注意的命令上**。

先测，再改。这句话很老套，但每次都能省下几个小时。
