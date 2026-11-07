# Shen 的小站

一个基于 **Hexo 8** + **AnZhiYu 1.7.1** 的二次元个人博客。

- 主题仓库：https://github.com/anzhiyu-c/hexo-theme-anzhiyu
- 主题文档：https://docs.anheyu.com/

## 快速开始

```bash
npm install      # 首次运行
npm run server   # 本地预览 http://localhost:4000
npm run build    # 生成静态文件到 public/
npm run clean    # 清空 public/ 和 db.json（比 hexo clean 快很多，见下方“性能”）
npm run rebuild  # clean + build
```

## 目录说明

```
├─ _config.yml           # 站点配置（标题、作者、URL、主题名）
├─ _config.anzhiyu.yml   # 主题配置（覆盖用，优先级高于主题内 _config.yml）
├─ tools/
│  └─ import-obsidian.py # 把 Obsidian 笔记批量导入成文章
├─ source/
│  ├─ _posts/            # 文章（Markdown）
│  ├─ _data/             # 说说 essay.yml / 相册 album.yml / 友链 link.yml
│  ├─ css/custom.css     # 自定义样式
│  ├─ img/               # 图片：banner.jpg / avatar.jpg / cover-*.jpg
│  │  └─ posts/          # 从 Obsidian 导入时自动拷贝的文章配图
│  ├─ about/  essay/  album/  link/  categories/  tags/
├─ themes/anzhiyu/       # 主题（不要直接改里面的 _config.yml）
└─ public/               # 构建产物
```

## 需要你替换的地方

| 位置 | 内容 |
| --- | --- |
| `_config.yml` | `title` / `author` / `description` / `url` |
| `_config.anzhiyu.yml` → `social` | GitHub、Bilibili、RSS 链接（现在是 `yourname` 占位） |
| `source/about/index.md` | 自我介绍、联系方式 |
| `source/_data/link.yml` | 友链 |
| `source/img/` | 头像、首页大图、文章封面（换成自己的图） |

## 写文章

```bash
npx hexo new post "文章标题"
```

Front-matter 建议：

```yaml
---
title: 文章标题
date: 2026-11-07 20:00:00
cover: /img/cover-summer.jpg   # 列表封面
top_img: /img/cover-summer.jpg # 文章页头图
description: 一句话摘要
categories:
  - 前端
tags:
  - Hexo
---
```

## 从 Obsidian 导入文章

`tools/import-obsidian.py` 会把 Obsidian 笔记转成 Hexo 文章，自动处理：

- `[[wiki 链接]]` → 纯文本 / 别名
- `![[图片]]`、`![](相对路径)` → 拷贝到 `source/img/posts/<slug>/` 并改写路径
- `> [!note]` callout → 加粗引用块
- 手写的 `## 目录` + `- [[#锚点]]` 整块删除（主题自带右侧 TOC）
- PDF 提取产生的康熙部首字符（`⼯` → `工`）、被硬换行切断的标题
- 正文含 `{{ }}` / `{% %}` 时自动包 `{% raw %}`，避免被 Hexo 标签解析

用法：编辑脚本顶部的 `POSTS` 列表，一行一篇文章：

```python
(源文件路径, "slug", "标题", "2026-08-28 21:00:00", "AI", ["Agent", "LLM"], "/img/banner.jpg"),
```

```bash
python tools/import-obsidian.py   # 重新导入（会覆盖同名文章）
```

> 脚本放在 `tools/` 而不是 `scripts/`，因为 Hexo 会把 `scripts/` 下的所有文件当插件加载。

## 性能说明

这个站有 34 篇文章、213 张配图，在 Windows 上构建时踩过两个坑：

1. **`hexo clean` 极慢**：删 409 个文件要 **3 分钟**，而原生 `rm -rf public` 只要 **2 秒**。已用 `npm run clean`（Node 的 `fs.rmSync`）替代，降到 3.6 秒。
2. **搜索索引预加载**：34 篇全文的 `search.xml` 有 **1.87MB**，主题默认 `preload: true` 会让每个页面都拉一遍。已改为 `preload: false`，点击搜索时才加载。

另外两篇面试手册（JavaScript 204KB / CSS 107KB 源码）生成的 HTML 分别是 800KB / 951KB，页面高度 4 万像素——这是浏览器端"卡"的主要来源。如果介意，可以把它们按章节拆成多篇。

## 部署

**Vercel / Netlify**：构建命令 `npm run build`，发布目录 `public`。

**GitHub Pages**：

```bash
npm install hexo-deployer-git --save
```

```yaml
# _config.yml
deploy:
  type: git
  repo: git@github.com:yourname/yourname.github.io.git
  branch: main
```

然后 `npx hexo clean && npx hexo g -d`。

> 部署前记得把 `_config.yml` 的 `url` 改成正式域名，否则 sitemap、RSS 和分享链接会指向 localhost。

## 已知事项

- **左下角音乐球已关闭**：默认的 Meting API（`api.i-meto.com`）请求不返回，会卡住 `window.onload`，导致加载动画不消失。想开启的话，在 `_config.anzhiyu.yml` 里把 `nav_music.enable` 设为 `true`，并把 `CDN.option.meting_api` 换成可用的 Meting 服务地址。
- **评论系统未配置**：`comments` 目前是关闭状态。要评论的话推荐 Twikoo（Vercel 一键部署）或 Waline，配置后填 `twikoo.envId` / `waline.serverURL`。
- **主题升级**：`git -C themes/anzhiyu pull` 后注意核对 `_config.anzhiyu.yml` 是否有新增配置项。
