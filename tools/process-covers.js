// 处理 AI 生成的封面：裁水印 → 重命名 → 按主题分配到文章（避免相邻重复）
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..');
const RAW = path.join(ROOT, 'source', 'img', 'covers', 'raw');
const OUT = path.join(ROOT, 'source', 'img', 'covers');
const POSTS = path.join(ROOT, 'source', '_posts');

// 文件名关键词 → 语义名
const NAMES = [
  ['神经网络', 'ai-neural'],
  ['全息人形', 'ai-hologram'],
  ['数据流管道', 'api-flow'],
  ['数据方块', 'data-blocks'],
  ['服务器阵列', 'infra-server'],
  ['数据中心走廊', 'infra-corridor'],
  ['全息蓝图', 'architecture'],
  ['便利贴', 'planning'],
  ['会议室', 'interview'],
  ['开放式办公室', 'team'],
  ['设计网页界面', 'frontend-design'],
  ['彩色代码字符', 'code-abstract'],
  ['钥匙与盾牌', 'security'],
  ['木制书桌', 'dev-desk'],
  ['少女坐在书桌前看屏幕', 'dev-night'],
];

async function processRaw() {
  if (!fs.existsSync(RAW)) {
    console.log('没有 raw 目录，跳过图片处理');
    return;
  }
  for (const f of fs.readdirSync(RAW).filter(x => x.endsWith('.png'))) {
    const hit = NAMES.find(([k]) => f.includes(k));
    if (!hit) { console.log('  跳过', f.slice(0, 30)); continue; }
    const src = path.join(RAW, f);
    const meta = await sharp(src).metadata();
    await sharp(src)
      .extract({ left: 0, top: 0, width: meta.width, height: meta.height - 68 })
      .resize(1600, 1000, { fit: 'cover', position: 'attention' })
      .jpeg({ quality: 84, mozjpeg: true })
      .toFile(path.join(OUT, hit[1] + '.jpg'));
    console.log('  ✓', hit[1] + '.jpg');
  }
}

// 主题 → 可用封面（轮换）
const CLUSTER = [
  [/langgraph|langchain|agent|mcp|prompt|function.?calling|上下文|记忆|中间件/i, ['ai-neural', 'ai-hologram', 'api-flow']],
  [/mysql|sqlalchemy|orm|数据库|sql/i, ['infra-server', 'data-blocks']],
  [/jwt|认证|鉴权|密码|安全/i, ['security']],
  [/nginx|部署|运维|docker|上线/i, ['infra-corridor', 'infra-server']],
  [/vue|javascript|typescript|css|前端|html/i, ['frontend-design', 'code-abstract']],
  [/架构|分层|工程化|封装|重构|跨栈/i, ['architecture', 'team']],
  [/面试|简历|速记|方法论|清单|蓝图|项目/i, ['interview', 'planning', 'team']],
  [/fastapi|flask|django|python|crud|路由|api/i, ['dev-night', 'dev-desk', 'api-flow']],
];

const CAT_FALLBACK = {
  前端: ['frontend-design', 'code-abstract'],
  后端: ['dev-night', 'dev-desk', 'api-flow', 'data-blocks'],
  AI: ['ai-neural', 'ai-hologram', 'api-flow'],
  工程实践: ['architecture', 'team', 'planning'],
};

// 站内实拍 / 手绘动漫图，保持不动
const KEEP = cur =>
  cur.includes('/img/album/') ||
  cur === '/img/banner.jpg' ||
  /\/img\/cover-(summer|night)\.jpg/.test(cur);

function poolFor(slug, title, cat) {
  const text = `${slug} ${title}`;
  for (const [re, names] of CLUSTER) if (re.test(text)) return names;
  return CAT_FALLBACK[cat] || null;
}

async function assign() {
  const files = fs.readdirSync(POSTS).filter(f => f.endsWith('.md'));

  // 按发布日期倒序（与首页顺序一致）
  const items = files.map(f => {
    const raw = fs.readFileSync(path.join(POSTS, f), 'utf8');
    const date = (raw.match(/^date:\s*(.+)$/m) || [, '1970-01-01'])[1].trim();
    return { f, raw, date };
  }).sort((a, b) => (a.date < b.date ? 1 : -1));

  const counters = {};
  let changed = 0;
  let prev = '';

  for (const { f, raw } of items) {
    const slug = f.replace(/\.md$/, '');
    const title = (raw.match(/^title:\s*"?(.*?)"?$/m) || [, ''])[1];
    const cat = (raw.match(/^categories:\s*\n\s*-\s*(.+)$/m) || [, ''])[1].trim();
    const cur = (raw.match(/^cover:\s*(.+)$/m) || [, ''])[1].trim();

    if (KEEP(cur)) { prev = cur; continue; }

    const pool = poolFor(slug, title, cat);
    if (!pool) continue;

    const key = pool.join('|');
    const i = (counters[key] = (counters[key] || 0) + 1) - 1;
    let pick = pool[i % pool.length];
    if (`/img/covers/${pick}.jpg` === prev) pick = pool[(i + 1) % pool.length];

    const cover = `/img/covers/${pick}.jpg`;
    prev = cover;
    if (cur === cover) continue;

    fs.writeFileSync(
      path.join(POSTS, f),
      raw.replace(/^cover:.*$/m, `cover: ${cover}`).replace(/^top_img:.*$/m, `top_img: ${cover}`)
    );
    changed++;
  }
  console.log(`更新封面 ${changed} 篇`);
}

(async () => {
  await processRaw();
  await assign();

  const svgs = fs.readdirSync(OUT).filter(f => f.endsWith('.svg'));
  for (const s of svgs) fs.unlinkSync(path.join(OUT, s));
  if (svgs.length) console.log(`清理旧 SVG ${svgs.length} 张`);
})();
