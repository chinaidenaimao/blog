const puppeteer = require('puppeteer-core');

(async () => {
  const b = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars', '--proxy-server=http://127.0.0.1:7897']
  });
  const p = await b.newPage();
  await p.setViewport({ width: 1440, height: 950 });

  const failed = [];
  p.on('requestfailed', r => failed.push(r.url().slice(-60)));
  p.on('response', r => {
    if (r.status() >= 400 && r.url().includes('github.io')) failed.push(`${r.status()} ${r.url().slice(-60)}`);
  });

  await p.goto('https://chinaidenaimao.github.io/blog/', { waitUntil: 'networkidle2', timeout: 60000 });
  await new Promise(r => setTimeout(r, 3000));

  const info = await p.evaluate(() => {
    const el = document.querySelector('#random-banner');
    if (!el) return { found: false };
    const cs = getComputedStyle(el);
    return {
      found: true,
      bgImage: cs.backgroundImage,
      bgColor: cs.backgroundColor,
      height: Math.round(el.getBoundingClientRect().height),
      titleColor: getComputedStyle(document.querySelector('.banners-title-big') || document.body).color
    };
  });

  console.log(JSON.stringify(info, null, 1));
  console.log('失败请求:', failed.slice(0, 6));
  await p.screenshot({ path: '.shot-live.png' });
  await b.close();
})();
