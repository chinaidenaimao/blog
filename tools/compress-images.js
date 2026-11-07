// 压缩 source/img 下的图片：保持文件名不变，只在不损失太多观感的前提下减体积
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'source', 'img');

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(png|jpe?g)$/i.test(e.name)) out.push(p);
  }
  return out;
}

(async () => {
  const files = walk(ROOT);
  let before = 0, after = 0, saved = 0, skipped = 0;

  for (const f of files) {
    const stat = fs.statSync(f);
    if (stat.size < 20 * 1024) { skipped++; continue; }
    before += stat.size;
    const ext = path.extname(f).toLowerCase();
    const tmp = f + '.tmp';

    try {
      const img = sharp(f, { failOn: 'none' });
      const meta = await img.metadata();

      if (ext === '.png') {
        // 有透明通道的保留 alpha，否则转调色板
        await img
          .resize({ width: Math.min(meta.width, 1400), withoutEnlargement: true })
          .png({ compressionLevel: 9, palette: true, quality: 80, effort: 7 })
          .toFile(tmp);
      } else {
        await img
          .resize({ width: Math.min(meta.width, 1600), withoutEnlargement: true })
          .jpeg({ quality: 82, mozjpeg: true })
          .toFile(tmp);
      }

      const newSize = fs.statSync(tmp).size;
      if (newSize < stat.size * 0.92) {
        fs.renameSync(tmp, f);
        after += newSize;
        saved++;
      } else {
        fs.unlinkSync(tmp);
        after += stat.size;
        skipped++;
      }
    } catch (e) {
      try { fs.existsSync(tmp) && fs.unlinkSync(tmp); } catch {}
      after += stat.size;
      skipped++;
    }
  }

  const mb = n => (n / 1024 / 1024).toFixed(1) + 'MB';
  console.log(`压缩 ${saved} 张，跳过 ${skipped} 张`);
  console.log(`${mb(before)} → ${mb(after)}  省了 ${mb(before - after)} (${Math.round((1 - after / before) * 100)}%)`);
})();
