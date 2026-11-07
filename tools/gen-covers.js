// 按 slug 生成互不相同的矢量封面：抽象风景（天空 + 日/月 + 山脊或城市剪影）
// 输出到 source/img/covers/<slug>.svg，同一 slug 每次生成结果一致
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const OUT = path.join(__dirname, '..', 'source', 'img', 'covers');
const W = 1200;
const H = 800;

// [天空起点, 天空终点, 高光/日色]
const PALETTES = [
  ['#1b1035', '#7f7fd5', '#ffd9a0'], // 暮紫
  ['#2d1b4e', '#ff9a9e', '#fff0c9'], // 晚霞粉
  ['#0f2027', '#2c5364', '#a5f3fc'], // 深海夜
  ['#132a3a', '#63b3ed', '#fef3c7'], // 晴空
  ['#3a1c2b', '#f6d365', '#fff7d6'], // 黄昏橙
  ['#10312b', '#84fab0', '#f0fff4'], // 薄荷
  ['#241a45', '#5ee7df', '#e0fffb'], // 青紫
  ['#2b1b3d', '#d299c2', '#fff5e6'], // 薰衣草
  ['#06131f', '#30cfd0', '#c7fff9'], // 极光
  ['#2a0f22', '#ff758c', '#ffe4e6'], // 霓虹
  ['#120b2e', '#a8c0ff', '#e8ecff'], // 夜蓝
  ['#1d2b45', '#e0c3fc', '#fff8ff'], // 梦幻
];

const hash = s => crypto.createHash('md5').update(s).digest();
const pick = (b, i, n) => b[i % b.length] % n;

function glyphOf(category) {
  const map = { 前端: '前', 后端: '后', AI: '智', 生活: '生', 二次元: '幻', 开发日常: '日', 工程实践: '工' };
  return map[category] || (category || '文').slice(0, 1);
}

// 山脊线：从左到右若干控制点，用折线近似
function ridge(h, offset, baseY, amp, seed) {
  const pts = [];
  const n = 7;
  for (let i = 0; i <= n; i++) {
    const x = (W / n) * i;
    const y = baseY - ((h[(seed + i) % h.length] % amp) + amp * 0.25);
    pts.push(`${x.toFixed(0)},${y.toFixed(0)}`);
  }
  return `${offset},${H} ${pts.join(' ')} ${W},${H}`;
}

// 城市剪影：一排高低不一的楼
function skyline(h, baseY, seed) {
  const rects = [];
  let x = -20;
  let i = 0;
  while (x < W + 40) {
    const w = 46 + (h[(seed + i) % h.length] % 62);
    const bh = 30 + (h[(seed + i + 3) % h.length] % 130);
    rects.push(`<rect x="${x}" y="${baseY - bh}" width="${w}" height="${bh + (H - baseY)}" rx="3"/>`);
    // 零星窗户
    if ((h[(seed + i + 5) % h.length] % 3) === 0) {
      rects.push(`<rect x="${x + 10}" y="${baseY - bh + 16}" width="8" height="10" opacity="0.5"/>`);
    }
    x += w + 6;
    i++;
  }
  return rects.join('');
}

function build(slug) {
  const h = hash(slug);
  const [sky1, sky2, glow] = PALETTES[pick(h, 0, PALETTES.length)];
  const variant = pick(h, 1, 3); // 0 山 / 1 城市 / 2 海

  const sunX = 260 + (h[2] % 680);
  const sunY = 170 + (h[3] % 150);
  const sunR = 62 + (h[4] % 52);
  const baseY = 600 + (h[5] % 80);

  let scenery = '';
  if (variant === 0) {
    // 远山两层 + 太阳
    scenery = `
  <path d="${ridge(h, -40, baseY + 40, 150, 6)}" fill="${sky1}" opacity="0.55"/>
  <path d="${ridge(h, -40, baseY + 110, 210, 12)}" fill="${sky1}" opacity="0.9"/>`;
  } else if (variant === 1) {
    // 城市剪影
    scenery = `
  <g fill="${sky1}" opacity="0.92">${skyline(h, baseY + 30, 7)}</g>`;
  } else {
    // 海：地平线 + 倒影
    const reflect = [];
    for (let i = 0; i < 9; i++) {
      const y = baseY + 40 + i * 26;
      const w = sunR * (2.2 - i * 0.16);
      reflect.push(`<rect x="${sunX - w / 2}" y="${y}" width="${w}" height="6" rx="3" opacity="${0.28 - i * 0.025}"/>`);
    }
    scenery = `
  <rect x="0" y="${baseY + 30}" width="${W}" height="${H - baseY - 30}" fill="${sky1}" opacity="0.9"/>
  <g fill="${glow}">${reflect.join('')}</g>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0.35" y2="1">
      <stop offset="0%" stop-color="${sky1}"/>
      <stop offset="100%" stop-color="${sky2}"/>
    </linearGradient>
    <radialGradient id="sunGlow">
      <stop offset="0%" stop-color="${glow}" stop-opacity="0.95"/>
      <stop offset="55%" stop-color="${glow}" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="${glow}" stop-opacity="0"/>
    </radialGradient>
    <filter id="grain">
      <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch"/>
      <feColorMatrix type="saturate" values="0"/>
    </filter>
  </defs>

  <rect width="${W}" height="${H}" fill="url(#sky)"/>
  <circle cx="${sunX}" cy="${sunY}" r="${sunR * 3.2}" fill="url(#sunGlow)"/>
  <circle cx="${sunX}" cy="${sunY}" r="${sunR}" fill="${glow}" opacity="0.92"/>
  ${scenery}

  <rect width="${W}" height="${H}" filter="url(#grain)" opacity="0.06"/>
</svg>`;
}

function main() {
  const postsDir = path.join(__dirname, '..', 'source', '_posts');
  fs.mkdirSync(OUT, { recursive: true });
  const files = fs.readdirSync(postsDir).filter(f => f.endsWith('.md'));
  for (const f of files) {
    const slug = f.replace(/\.md$/, '');
    const raw = fs.readFileSync(path.join(postsDir, f), 'utf8');
    const m = raw.match(/^categories:\s*\n\s*-\s*(.+)$/m);
    fs.writeFileSync(path.join(OUT, slug + '.svg'), build(slug));
  }
  console.log(`生成 ${files.length} 张封面 -> source/img/covers/`);
}

if (require.main === module) main();
module.exports = { build };
