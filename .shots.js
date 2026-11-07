const puppeteer = require('puppeteer-core');

(async () => {
  const b = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu', '--no-proxy-server', '--hide-scrollbars']
  });
  const p = await b.newPage();
  await p.setViewport({ width: 1440, height: 900 });

  const errors = [];
  p.on('pageerror', e => errors.push(e.message));

  const shot = async (name, url, full = false) => {
    const t0 = Date.now();
    await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 40000 });
    await p.waitForFunction(() => {
      const l = document.querySelector('#loading-box');
      return !l || l.classList.contains('loaded');
    }, { timeout: 20000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 1200));
    await p.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 700) {
        window.scrollTo(0, y);
        await new Promise(r => setTimeout(r, 60));
      }
      window.scrollTo(0, 0);
      await new Promise(r => setTimeout(r, 400));
    });
    await p.screenshot({ path: `.shot-${name}.png`, fullPage: full });
    const broken = await p.evaluate(() =>
      Array.from(document.images).filter(i => i.complete && i.naturalWidth === 0).map(i => i.getAttribute('src')).slice(0, 4)
    );
    console.log(`${name}: ${Date.now() - t0}ms broken=${broken.length} ${broken.join(',')}`);
  };

  await shot('about', 'http://127.0.0.1:4000/about/', true);
  await shot('home', 'http://127.0.0.1:4000/');
  await shot('album', 'http://127.0.0.1:4000/album/');

  if (errors.length) console.log('JS errors:', errors.slice(0, 3));
  await b.close();
})();
