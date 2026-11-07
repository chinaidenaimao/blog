// 给文章抓配图：维基共享资源（免费、无水印）→ 校验 → 裁成 1600x1000
// 用法：node tools/fetch-covers.js [slug ...]
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { execFile } = require('child_process');
const { promisify } = require('util');

const exec = promisify(execFile);
const ROOT = path.join(__dirname, '..');
const POSTS = path.join(ROOT, 'source', '_posts');
const OUT = path.join(ROOT, 'source', 'img', 'covers');

// 站内实拍图（日常生活类用自己的照片）
const ALBUM = {
  'diary-picking-theme': '/img/album/daily/morning-coffee.jpg',
  'diary-cover-rule': '/img/album/daily/rain-window.jpg',
  'diary-writing-setup': '/img/album/daily/cat-by-window.jpg',
  'diary-import-notes': '/img/album/night/lit-shop.jpg',
  'diary-hexo-clean': '/img/album/night/neon-rain-street.jpg',
  'diary-image-compression': '/img/album/travel/colorful-street.jpg',
  'night-coding-playlist': '/img/album/night/warm-street-night.jpg',
  'hello-anzhiyu': '/img/banner.jpg',
  'why-hexo-2026': '/img/cover-night.jpg',
  'hexo-anzhiyu-guide': '/img/cover-summer.jpg',
};

// 主题 → 候选查询词（按 slug 哈希轮换，避免所有文章撞同一张图）
const TOPICS = [
  [/langgraph|langchain|agent|mcp|prompt|function.?calling|上下文|记忆|中间件/i,
    ['neural network', 'artificial intelligence', 'machine learning', 'deep learning']],
  [/fastapi|flask|django|python/i,
    ['python programming', 'source code screen', 'programmer laptop', 'computer code']],
  [/sqlalchemy|orm|mysql|数据库|sql/i,
    ['data center server', 'database server', 'server rack', 'hard disk drive']],
  [/vue|javascript|typescript|css|前端|html/i,
    ['javascript code', 'web development', 'html code screen', 'web design']],
  [/jwt|认证|鉴权|安全|密码/i,
    ['encryption', 'padlock computer security', 'cyber security', 'password security']],
  [/nginx|部署|运维|docker|上线/i,
    ['server room', 'network switch', 'cloud computing', 'computer network']],
  [/架构|分层|工程化|封装|重构/i,
    ['software development', 'programmer office', 'computer workspace', 'code review']],
  [/面试|简历|速记/i,
    ['job interview', 'office meeting', 'business meeting', 'office desk']],
  [/项目|清单|蓝图|方法论/i,
    ['project planning', 'sticky notes', 'whiteboard planning', 'kanban board']],
];

const CAT_DEFAULT = {
  前端: ['web development', 'javascript code', 'computer screen code'],
  后端: ['server room', 'programming', 'data center'],
  AI: ['artificial intelligence', 'neural network', 'robot technology'],
  工程实践: ['software development', 'team meeting', 'project planning'],
  开发日常: ['workspace desk', 'coffee laptop', 'desk night'],
  生活: ['quiet landscape', 'street photography', 'morning light'],
  二次元: ['anime city', 'japanese street night', 'akihabara'],
};

// 明显不适合当封面的文件名
const BAD_NAME = /diagram|chart|\bmap\b|scale|poster|logo|icon|screenshot|graph|table|\.pdf|document|portrait|infographic|signature|album|cover art|scan/i;

function hashOf(s) { let n = 0; for (const c of s) n = (n * 31 + c.charCodeAt(0)) % 9973; return n; }

function queriesFor(title, cat, slug) {
  const text = `${slug} ${title}`;
  for (const [re, qs] of TOPICS) if (re.test(text)) return qs;
  return CAT_DEFAULT[cat] || ['technology'];
}

async function search(q, offset) {
  const url = 'https://commons.wikimedia.org/w/api.php?action=query&generator=search'
    + `&gsrsearch=${encodeURIComponent(q + ' filetype:bitmap')}&gsrnamespace=6&gsrlimit=25&gsroffset=${offset || 0}`
    + '&prop=imageinfo&iiprop=url|size|mime&iiurlwidth=1600&format=json';
  const { stdout } = await exec('curl', ['-s', '--noproxy', '*', '--max-time', '30', url], { maxBuffer: 20 * 1024 * 1024 });
  let d;
  try { d = JSON.parse(stdout); } catch (e) { return []; }
  if (!d.query || !d.query.pages) return [];
  return Object.values(d.query.pages)
    .map(p => ({ title: p.title, info: (p.imageinfo || [])[0] }))
    .filter(x => x.info && /^image\/(jpeg|png|webp)$/.test(x.info.mime || ''))
    .filter(x => !BAD_NAME.test(x.title))
    .filter(x => x.info.width >= 1200 && x.info.width > x.info.height * 1.15 && x.info.width < x.info.height * 3)
    .sort((a, b) => (/(unsplash|photo)/i.test(b.title) ? 1 : 0) - (/(unsplash|photo)/i.test(a.title) ? 1 : 0));
}

async function download(url) {
  const tmp = path.join(OUT, '.dl.tmp');
  try {
    await exec('curl', ['-sL', '--noproxy', '*', '--max-time', '40', '-o', tmp, url]);
    if (!fs.existsSync(tmp)) return null;
    const size = fs.statSync(tmp).size;
    if (size < 40 * 1024 || size > 15 * 1024 * 1024) return null;
    const meta = await sharp(tmp, { failOn: 'none' }).metadata();
    if (!meta.width || meta.width < 900) return null;
    return { tmp, width: meta.width, height: meta.height };
  } catch (e) { return null; }
}

async function save(src, slug) {
  await sharp(src)
    .resize(1600, 1000, { fit: 'cover', position: 'attention' })
    .jpeg({ quality: 82, mozjpeg: true })
    .toFile(path.join(OUT, slug + '.jpg'));
}

function listPosts() {
  return fs.readdirSync(POSTS).filter(f => f.endsWith('.md')).map(f => {
    const slug = f.replace(/\.md$/, '');
    const raw = fs.readFileSync(path.join(POSTS, f), 'utf8');
    const title = (raw.match(/^title:\s*"?(.*?)"?$/m) || [, slug])[1];
    const cat = (raw.match(/^categories:\s*\n\s*-\s*(.+)$/m) || [, ''])[1].trim();
    return { slug, title, cat };
  });
}

const used = new Set();

async function main() {
  const only = process.argv.slice(2);
  fs.mkdirSync(OUT, { recursive: true });
  const list = listPosts().filter(p => only.length === 0 || only.includes(p.slug));
  let ok = 0, fail = [];

  for (const { slug, title, cat } of list) {
    if (ALBUM[slug]) {
      const src = path.join(ROOT, 'source', ALBUM[slug]);
      if (fs.existsSync(src)) {
        await save(src, slug);
        console.log(`  ✓ ${slug}  (站内实拍)`);
        ok++;
        continue;
      }
    }

    const qs = queriesFor(title, cat, slug);
    let done = false;

    for (let i = 0; i < qs.length && !done; i++) {
      const q = qs[(hashOf(slug) + i) % qs.length];
      for (const offset of [0, 25]) {
        let items = [];
        try { items = await search(q, offset); } catch (e) { items = []; }
        for (const it of items) {
          const key = it.info.url;
          if (used.has(key)) continue;
          const r = await download(it.info.thumburl || it.info.url);
          if (r) {
            used.add(key);
            await save(r.tmp, slug);
            try { fs.unlinkSync(r.tmp); } catch (e) {}
            console.log(`  ✓ ${slug}  ${r.width}x${r.height}  «${q}»  ${it.title.replace('File:', '').slice(0, 36)}`);
            ok++; done = true;
            break;
          }
        }
        if (done || items.length < 25) break;
      }
    }

    if (!done) { console.log(`  ✗ ${slug}  没有可用图`); fail.push(slug); }
    await new Promise(r => setTimeout(r, 250));
  }

  console.log(`\n完成 ${ok} 张，失败 ${fail.length} 张`);
  if (fail.length) console.log('失败：', fail.join(' '));
}

main();
