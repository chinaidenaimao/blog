---
title: 图片压缩：33MB → 12.6MB
date: 2026-11-07 17:10:00
cover: /img/covers/diary-image-compression.svg
top_img: /img/covers/diary-image-compression.svg
description: "压了 169 张图，省了 57%，肉眼几乎看不出差别。"
categories:
  - 开发日常
tags:
  - 性能
  - 图片
  - 工具
---

## 起因

站点一共 240 多张图，`source/img` 占了 **33MB**。

每次 `hexo generate` 都要把它们从 `source` 拷到 `public`，一次 16MB 的 I/O——不算致命，但很烦。

## 方案对比

| 方案 | 结果 |
| --- | --- |
| 转 WebP 并改文件名 | 体积最小，但要改所有引用，容易漏 |
| 在线压缩工具 | 一张一张传，240 张不现实 |
| sharp 原地重编码 | 文件名不变，零引用改动 ✅ |

选了第三种。

## 脚本

```javascript
const img = sharp(file, { failOn: 'none' });
const meta = await img.metadata();

if (ext === '.png') {
  await img.resize({ width: Math.min(meta.width, 1400), withoutEnlargement: true })
    .png({ compressionLevel: 9, palette: true, quality: 80 })
    .toFile(tmp);
} else {
  await img.resize({ width: Math.min(meta.width, 1600), withoutEnlargement: true })
    .jpeg({ quality: 82, mozjpeg: true })
    .toFile(tmp);
}
```

两个关键点：

1. **先写到 `.tmp`，比原图小 8% 以上才替换**，否则丢弃。避免"压完反而更大"的尴尬。
2. **PNG 用调色板**（`palette: true`）。截图类图片色彩数少，调色板压缩几乎无损，体积能砍一半。

## 结果

```
压缩 169 张，跳过 75 张
30.6MB → 13.1MB  省了 17.4MB (57%)
```

跳过的那 75 张是本来就小的图（<20KB）或者压缩收益不到 8% 的。

## 顺带踩的坑

导入脚本每次跑都会重新拷贝图片，**把压缩好的图覆盖回原图**。

第一次发现的时候，我压了两遍才反应过来。

修法很简单，拷贝前判断一下：

```python
if not os.path.exists(dst2):
    shutil.copyfile(src, dst2)
```

## 另一个发现

有 4 张 AI 生成的插画，右下角带「AI生成」水印。

统一裁掉底部 70px：

```javascript
await sharp(p)
  .extract({ left: 0, top: 0, width: m.width, height: m.height - 70 })
  .toFile(tmp);
```

裁完之后才发现，水印其实在画面里挺显眼的——只是之前没注意。

## 关于封面

文章的封面不是照片，是**按 slug 生成的 SVG 风景**：渐变天空 + 日/月 + 山脊或城市剪影。

好处是：

- 每篇都不一样（配色和构图由 slug 的哈希决定）
- 一张几 KB，240 张加起来还没一张照片大
- 风格统一，列表看起来像一套东西

生成脚本在 `tools/gen-covers.js`，想换风格改里面的 `PALETTES` 就行。
