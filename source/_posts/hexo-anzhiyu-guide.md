---
title: 用 AnZhiYu 搭一个好看的二次元博客
date: 2026-11-04 22:30:00
cover: /img/cover-summer.jpg
description: 从零开始，用 Hexo + AnZhiYu 搭一个带看板娘、音乐球和说说页的二次元博客，附完整配置思路。
categories:
  - 前端
tags:
  - Hexo
  - 建站
  - 教程
top_img: /img/cover-summer.jpg
---

## 为什么选 AnZhiYu

Hexo 的主题很多，但真正"二次元味"拉满的其实没几个。AnZhiYu 基于 Butterfly 二次开发，把二次元博客常见的那套东西都内置了：

- Live2D 看板娘
- 左下角音乐球
- 瀑布流「说说」和「相册」
- 评论弹幕、中控台换主题色
- PWA、本地搜索、AI 摘要

不用自己拼装，配置里开个开关就有了。

## 安装

```bash
# 初始化站点
hexo init my-blog
cd my-blog

# 拉取主题
git clone -b main https://github.com/anzhiyu-c/hexo-theme-anzhiyu.git themes/anzhiyu

# 主题依赖的渲染器
npm install hexo-renderer-pug hexo-renderer-stylus --save
```

然后把站点配置里的主题名改掉：

```yaml
# _config.yml
theme: anzhiyu
```

## 覆盖配置

主题的 `_config.yml` 有一千多行。**不要直接改它**，否则下次更新主题就全丢了。正确做法是复制一份到根目录：

```bash
cp themes/anzhiyu/_config.yml _config.anzhiyu.yml
```

之后所有修改都写在 `_config.anzhiyu.yml` 里，它的优先级更高。

## 几个值得先调的地方

| 配置项 | 作用 |
| --- | --- |
| `avatar.img` | 头像，建议放本地 `/img/avatar.jpg` |
| `index_img` | 首页大图 |
| `cover.default_cover` | 文章没有封面时用的默认图 |
| `menu` | 顶部导航，注意缩进 |
| `local_search.enable` | 站内搜索，需要 `hexo-generator-searchdb` |
| `nav_music` | 左下角音乐球 |

## 说说和相册

这两个页面需要 `source/_data/` 下的数据文件：

```yaml
# source/_data/essay.yml
- title: 即刻短文
  subTitle: 咸鱼的日常生活。
  tips: 随时随地，分享生活
  limit: 30
  essay_list:
    - content: 今天天气很好
      date: 2026/11/06
      image:
        - /img/cover-summer.jpg
```

相册稍微麻烦一点：每个相册要在 `album.yml` 里写 `path_name`，然后**单独建一个页面**，`type` 设为 `album_detail`，路径必须和 `path_name` 一致。

## 踩坑记录

1. `menu` 的缩进错一格，导航就会整块消失。
2. 图片路径用 `/img/xxx.jpg` 而不是 `img/xxx.jpg`，否则子页面会 404。
3. 主题自带的图片都在作者图床上，建议全部换成本地图，加载快也更稳。

搭完之后最大的感受是：**好看的东西会让人想写东西**。这大概就是换主题最实际的价值。
