// Real-browser checks (headless Chromium): service worker, offline use, Cloudflare-style redirects, phone layout.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { sample, stateWith, plate, wait } = require('../lib/harness');
const { start } = require('../lib/server');

exports.slow = true;

function chromePath() {
  const c = [process.env.CHROME_PATH, '/opt/pw-browsers/chromium', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'];
  return c.find(p => p && fs.existsSync(p) && fs.statSync(p).isFile());
}
function loadPuppeteer() {
  const cache = path.join(os.homedir(), '.cache', 'sushi-test-deps', 'node_modules');
  for (const p of ['puppeteer-core', path.join(cache, 'puppeteer-core')]) { try { return require(p); } catch {} }
  return null;
}

exports.run = async t => {
  const puppeteer = loadPuppeteer(), exe = chromePath();
  if (!puppeteer || !exe) { console.log('      (browser checks skipped: ' + (!puppeteer ? 'puppeteer-core not installed (npm install puppeteer-core in ~/.cache/sushi-test-deps)' : 'no Chrome/Chromium found; set CHROME_PATH') + ')'); return; }
  const { server, url } = await start();
  const browser = await puppeteer.launch({ executablePath: exe, headless: true, args: ['--no-sandbox', '--disable-gpu'] });
  try {
    const page = await browser.newPage();
    const problems = [];
    page.on('response', r => { if (r.status() >= 400) problems.push('HTTP ' + r.status() + ' ' + r.url()); });
    page.on('pageerror', e => problems.push('pageerror: ' + e.message));
    page.on('console', m => { if (m.type() === 'error') problems.push('console: ' + m.text()); });
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });

    // loads through the redirecting server, installs the service worker
    const res = await page.goto(url + '/index.html', { waitUntil: 'networkidle0' });
    t.eq('/index.html redirects to / and loads', [res.status(), new URL(page.url()).pathname], [200, '/']);
    t.check('landing page shows', (await page.content()).includes('Get started'));
    const swReady = await page.evaluate(async () => { const r = await navigator.serviceWorker.ready; return !!r.active; });
    t.eq('service worker active', swReady, true);
    await page.reload({ waitUntil: 'networkidle0' });
    t.eq('reload is controlled by the worker', await page.evaluate(() => !!navigator.serviceWorker.controller), true);
    const hasPlates = await page.evaluate(() => document.body.textContent.includes('Sushi Train Track'));
    t.eq('page renders after reload (redirected responses handled)', hasPlates, true);

    // offline: the app still opens
    await page.setOfflineMode(true);
    await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
    t.check('works offline', (await page.content()).includes('Get started'));
    await page.setOfflineMode(false);

    // other pages are not swallowed by the worker
    await page.goto(url + '/privacy', { waitUntil: 'networkidle0' });
    t.eq('privacy page is the privacy page', await page.title(), 'Privacy Policy · Sushi Train Track');
    const links = await (await browser.newPage()).goto(url + '/.well-known/assetlinks.json');
    const body = JSON.parse(await links.text());
    t.eq('assetlinks.json is served at the well-known address', body[0].target.package_name, 'com.robsofficetips.sushitraintrack');
    t.check('assetlinks has real fingerprints', body[0].target.sha256_cert_fingerprints.length >= 1 && body[0].target.sha256_cert_fingerprints.every(f => /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(f)), body[0].target.sha256_cert_fingerprints);

    // phone layout with five plates plus the add circle (six slots) and some items
    const six = sample({ plates: ['#e5484d', '#f5a524', '#f2d74a', '#4cb782', '#3e8ef7'].map((c, i) => plate('q' + i, c, 300 + i * 100)) });
    const state = stateWith([six], { r1: { counts: { q0: 3, q4: 12 }, extras: [{ id: 'e1', price: 350, desc: 'Green tea' }, { id: 'e2', price: 350, desc: 'Green tea' }] } });
    const p2 = await browser.newPage();
    await p2.setViewport({ width: 360, height: 640, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await p2.evaluateOnNewDocument(s => { if (!localStorage.getItem('plateTally.v1')) localStorage.setItem('plateTally.v1', s); }, JSON.stringify(state));
    await p2.goto(url + '/', { waitUntil: 'networkidle0' });
    await p2.evaluate(() => go('bill'));
    const m = await p2.evaluate(() => {
      const r = el => { const b = el.getBoundingClientRect(); return { top: b.top, bottom: b.bottom, left: b.left, right: b.right, width: b.width, height: b.height }; };
      const btns = [...document.querySelectorAll('.plate-btn')].map(r);
      const dock = r(document.querySelector('.dock-tab'));
      return { overflowX: document.documentElement.scrollWidth - innerWidth, n: btns.length, lowest: Math.max(...btns.map(b => b.bottom)), dockTop: dock.top, dockBottom: dock.bottom, vh: innerHeight, total: r(document.getElementById('total')) };
    });
    t.eq('no sideways scrolling at 360px', m.overflowX <= 0, true);
    t.eq('5 plates + the add circle are all there', m.n, 6);
    t.check('plates sit above the drawer bar', m.lowest <= m.dockTop + 1, m);
    t.check('drawer bar is on screen', m.dockBottom <= m.vh + 1 && m.dockTop < m.vh, m);
    t.check('total is visible', m.total.top >= 0 && m.total.bottom < m.vh && m.total.width > 20, m.total);
    // more plates than fit: the plates carry on behind the drawer (no dark band beside it), and scrolling to the end brings the last one above the handle
    const many = sample({ plates: ['#e5484d', '#f5a524', '#a0522d', '#ffffff', '#8b5cf6', '#9ca3af', '#4cb782'].map((c, i) => plate('m' + i, c, 300 + i * 100)) });
    const p3 = await browser.newPage();
    await p3.setViewport({ width: 375, height: 667, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await p3.evaluateOnNewDocument(s => { if (!localStorage.getItem('plateTally.v1')) localStorage.setItem('plateTally.v1', s); }, JSON.stringify(stateWith([many], {})));
    await p3.goto(url + '/', { waitUntil: 'networkidle0' });
    await p3.evaluate(() => go('bill'));
    const behind = await p3.evaluate(() => {
      const sc = document.querySelector('.scroll'), r = e => e.getBoundingClientRect();
      const before = { scrollBottom: r(sc).bottom, tabTop: r(document.querySelector('.dock-tab')).top, vh: innerHeight, scrolls: sc.scrollHeight > sc.clientHeight };
      sc.scrollTop = sc.scrollHeight;
      const last = Math.max(...[...document.querySelectorAll('.plate-btn')].map(b => r(b).bottom));
      return { ...before, last, tabTopAfter: r(document.querySelector('.dock-tab')).top };
    });
    t.check('the plate area runs on down behind the drawer', behind.scrollBottom >= behind.vh - 1, behind);
    t.check('with 7 plates the list scrolls', behind.scrolls, behind);
    t.check('scrolled to the end, the + circle clears the handle', behind.last <= behind.tabTopAfter + 1, behind);
    await p3.close();
    await p2.tap('.plate-btn[data-id="q1"]');
    t.eq('a real tap adds a plate', await p2.evaluate(() => S.bills.r1.counts.q1), 1);
    // open the drawer: it rises, the field is on screen, and the screen does not scroll
    await p2.tap('.dock-tab');
    await wait(500);
    const d = await p2.evaluate(() => { const r = e => { const b = document.querySelector(e).getBoundingClientRect(); return { top: b.top, bottom: b.bottom, width: b.width }; }; return { dockTop: r('#dock').top, input: r('#xdesc'), vh: innerHeight, scrollY: scrollY, active: document.activeElement && document.activeElement.id }; });
    t.check('open drawer shows the add field', d.input.top > d.dockTop && d.input.bottom <= d.vh, d);
    t.check('opening does not focus a field (keyboard stays down)', d.active !== 'xdesc', d.active);
    t.eq('page itself did not scroll', d.scrollY, 0);
    // the privacy page has no icon link, so browsers ask for /favicon.ico and get a harmless 404
    const real = problems.filter(x => !x.includes('/favicon.ico') && !x.includes('Failed to load resource'));
    t.eq('no errors in the page', real, []);
  } finally { await browser.close(); server.close(); }
};
