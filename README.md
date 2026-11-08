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
│  ├─ import-obsidian.py    # 把 Obsidian 笔记批量导入成文章
│  ├─ gen-covers.js         # 按 slug 生成矢量封面
│  └─ compress-images.js    # 压缩 source/img 下的图片
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
| `source/_data/about.yml` | **关于页**的全部内容：姓名、简介、技能、生涯、城市、性格、追番、音乐偏好 |
| `source/_data/creativity.yml` | 关于页技能图标的名称/配色（图标在 `source/img/skills/`） |
| `source/_data/link.yml` | 友链 |
| `source/img/` | 头像、首页大图、文章封面（换成自己的图） |
| `source/robots.txt` | 部署后把 `Sitemap:` 换成正式域名 |

## 页面说明

| 页面 | 数据来源 |
| --- | --- |
| 关于 `/about/` | `source/_data/about.yml`（富布局，卡片式） |
| 相册 `/album/` | `source/_data/album.yml` + 每个相册的 `type: album_detail` 页面 |
| 即刻短文 `/essay/` | `source/_data/essay.yml` |
| 友人帐 `/link/` | `source/_data/link.yml` |
| 分类 / 标签 / 归档 | Hexo 生成器自动生成 |

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
(源文件路径, "slug", "标题", "2026-08-28 21:00:00", "AI", ["Agent", "LLM"]),
```

```bash
python tools/import-obsidian.py   # 重新导入（会覆盖同名文章）
node tools/gen-covers.js          # 给新增文章补封面
```

> 脚本放在 `tools/` 而不是 `scripts/`，因为 Hexo 会把 `scripts/` 下的所有文件当插件加载。

目前接的 7 个仓库：

| 变量 | 路径 | 内容 |
| --- | --- | --- |
| `VAULT_FRONTEND` | `D:\ai-demo\obsidian` | 前端面试手册、FastAPI 系列 |
| `VAULT_AGENT` | `D:\ai-demo\langchian\obsidian` | Agent 学习路径 v2 |
| `VAULT_DB` | `E:\leran\db\server\obsidian` | 项目文档、问题解答 |
| `VAULT_RAG` | `D:\ai-demo\RAG\obsidian-vault` | 前后端工程化、LangChain/LangGraph |
| `VAULT_AILAB` | `D:\ai-demo\AI_laboratory\...\docs` | LangGraph 系列 |
| `VAULT_PDF` | `D:\ai-demo\learn-PDF\docs` | 项目架构、部署文档 |
| `VAULT_TOUTIAO` | `D:\ai-demo\python\toutiao_houtai\docs` | 从零搭后台系列 |

## 封面

封面分三类，都在 `source/img/covers/`（共 19 张，4.4MB）：

| 类型 | 用在 | 来源 |
| --- | --- | --- |
| **AI 生成插画** 15 张 | 技术类文章 | 日系动画风格，按主题分簇：AI / 后端 / 数据库 / 前端 / 安全 / 部署 / 架构 / 面试 |
| **站内实拍** | 开发日常、生活 | `source/img/album/` 里的照片（咖啡、猫、夜街、旅行） |
| **动漫图** 3 张 | 精选文章 | 首页大图、欢迎、为什么用 Hexo |

分配逻辑在 `tools/process-covers.js`：

- 按**发布日期倒序**分配（和首页顺序一致），保证**相邻两篇不会撞同一张图**
- 关键词匹配优先（`langgraph` → AI 簇，`mysql` → 数据库簇），匹配不到用分类兜底
- 站内实拍和动漫图会被跳过，不会被覆盖

换封面只要把新图丢进 `source/img/covers/`，然后改 `process-covers.js` 里的 `CLUSTER` 映射。

> 之前用过按 slug 生成的 SVG 渐变封面（`tools/gen-covers.js`），太寡淡已经弃用，脚本留着当备选。

### 想再抓网络图？

`tools/fetch-covers.js` 走维基共享资源，能按关键词搜免费无水印的横图并自动裁成 1600x1000。实际测试下来质量参差（经常搜到教材插图、图表），所以现在只作为补充手段。

## 性能说明

这个站有 60 篇文章、230+ 张配图，在 Windows 上构建时踩过两个坑：

1. **`hexo clean` 极慢**：删 409 个文件要 **3 分钟**，而原生 `rm -rf public` 只要 **2 秒**。已用 `npm run clean`（Node 的 `fs.rmSync`）替代，降到 3.6 秒。
2. **搜索索引预加载**：60 篇全文的 `search.xml` 接近 **3MB**，主题默认 `preload: true` 会让每个页面都拉一遍。已改为 `preload: false`，点击搜索时才加载。

图片也做过压缩（`node tools/compress-images.js`），`source/img` 从 33MB 压到 12.6MB，文件名不变，重复执行只会处理还没压过的图。

另外两篇面试手册（JavaScript 204KB / CSS 107KB 源码）生成的 HTML 分别是 800KB / 951KB，页面高度 4 万像素——这是浏览器端"卡"的主要来源。如果介意，可以把它们按章节拆成多篇。

## SEO

- `sitemap.xml`：由 `hexo-generator-sitemap` 生成，含分类和标签
- `robots.txt`：`source/robots.txt`，部署后记得改里面的域名
- `atom.xml`：RSS 订阅
- Open Graph 元标签：主题已开启

## 部署（GitHub Pages）

线上地址：**https://chinaidenaimao.github.io/blog/**
仓库：https://github.com/chinaidenaimao/blog

### 怎么发布

```bash
git add -A
git commit -m "更新文章"
git push
```

推上去之后 GitHub Actions 自动构建并部署，大约 1–2 分钟生效。看进度：
https://github.com/chinaidenaimao/blog/actions

### 本地 vs 线上

| | 配置 | root |
| --- | --- | --- |
| 本地预览 | `_config.yml` | `/` |
| 线上构建 | `_config.yml` + `_config.prod.yml` | `/blog/` |

工作流里用的是 `npx hexo generate --config _config.yml,_config.prod.yml`，所以本地预览不用改任何东西。

### 两个必须知道的坑

1. **主题是直接放在仓库里的，不是 submodule。**
   最早用 submodule，CI 检出时 `themes/anzhiyu` 是空目录，Hexo 生成出一堆 0 字节的 HTML，页面全白。
   现在主题文件都提交在仓库里。想升级主题：把新版解压覆盖 `themes/anzhiyu/`，再 `git add -A` 提交。
   原来的 `.git` 备份在 `D:/ai-demo/anzhiyu-theme-git-backup`。

2. **子路径下不能写死绝对路径。**
   站点在 `/blog/` 下，任何 `url(/img/xxx.jpg)` 都会 404。已经处理过的地方：
   - `source/css/custom.css` → 并入 `themes/anzhiyu/source/css/_extra/custom.css`（随主题样式包一起打包）
   - `themes/anzhiyu/layout/includes/additional-js.pug` → `random.js` 改用 `url_for()`
   - `themes/anzhiyu/layout/category.pug` / `includes/categoryGroup.pug` → 面包屑改用 `url_for()`
   - `index_img` 是内联样式不走 `url_for`，改为在 `custom.css` 里覆盖 `#page-header.full_page`

以后加自定义 CSS，写进 `_extra/custom.css`，用相对路径 `../img/xxx` 就不会错。

### 其他平台

Vercel / Netlify：构建命令 `npm run build`，发布目录 `public`，记得把 `_config.yml` 的 `url` 改成正式域名。

## 已知事项

- **左下角音乐球已关闭**：默认的 Meting API（`api.i-meto.com`）请求不返回，会卡住 `window.onload`，导致加载动画不消失。想开启的话，在 `_config.anzhiyu.yml` 里把 `nav_music.enable` 设为 `true`，并把 `CDN.option.meting_api` 换成可用的 Meting 服务地址。
- **评论系统未配置**：`comments` 目前是关闭状态。要评论的话推荐 Twikoo（Vercel 一键部署）或 Waline，配置后填 `twikoo.envId` / `waline.serverURL`。
- **主题升级**：`git -C themes/anzhiyu pull` 后注意核对 `_config.anzhiyu.yml` 是否有新增配置项。
