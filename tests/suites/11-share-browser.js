// Real-browser checks for sharing by QR code (headless Chromium):
//  - the code drawn on the sender's screen really decodes to what was shared
//  - a second browser, whose camera is a fake video of those codes, scans them and adds the restaurants
//  - scanning a photo of a code works
//  - the share and scan cards fit on a small phone
// The reading is done by the bundled reader (jsQR), which is what iPhones use. Android phones use their own.
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

// a Y4M video (the format Chrome's fake camera plays) showing each QR matrix in turn on a white card
function writeVideo(file, matrices, framesEach = 6) {
  const W = 640, H = 480, chroma = Buffer.alloc((W / 2) * (H / 2), 128);
  const chunks = [Buffer.from(`YUV4MPEG2 W${W} H${H} F10:1 Ip A1:1 C420jpeg\n`)];
  for (const m of matrices) {
    const n = m.length, quiet = 4, scale = Math.floor(420 / (n + quiet * 2));
    const side = (n + quiet * 2) * scale, ox = (W - side) >> 1, oy = (H - side) >> 1;
    const y = Buffer.alloc(W * H, 60);   // a grey "table" around the phone screen
    for (let py = 0; py < side; py++) for (let px = 0; px < side; px++) {
      const mx = Math.floor(px / scale) - quiet, my = Math.floor(py / scale) - quiet;
      const dark = mx >= 0 && my >= 0 && mx < n && my < n && m[my][mx];
      y[(oy + py) * W + ox + px] = dark ? 16 : 235;
    }
    for (let f = 0; f < framesEach; f++) chunks.push(Buffer.from('FRAME\n'), y, chroma, chroma);
  }
  fs.writeFileSync(file, Buffer.concat(chunks));
}

const kura = () => sample({ items: [{ id: 'i1', desc: 'Green tea', price: 300 }] });
const many = () => Array.from({ length: 6 }, (_, k) => sample({ id: 'm' + k, name: 'Place ' + k + ' くら', currency: 'AUD',
  plates: ['#e5484d', '#f5a524', '#f2d74a', '#4cb782', '#3e8ef7', '#8b5cf6'].map((c, i) => plate('p' + i, c, 250 + i * 50)),
  items: ['Green tea', 'Miso soup', 'Edamame', 'Gyoza'].map((d, i) => ({ id: 'i' + i, desc: d, price: 300 + i * 100 })) }));

exports.run = async t => {
  const puppeteer = loadPuppeteer(), exe = chromePath();
  if (!puppeteer || !exe) { console.log('      (share browser checks skipped: no puppeteer-core or Chrome; see the browser suite)'); return; }
  const { server, url } = await start();
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'stt-share-'));
  const browsers = [];
  const launch = args => puppeteer.launch({ executablePath: exe, headless: true, args: ['--no-sandbox', '--disable-gpu', ...args] }).then(b => (browsers.push(b), b));
  const phone = async (b, state, opts = {}) => {
    const p = await (await b.createBrowserContext()).newPage();   // its own storage, like a separate phone
    p.problems = [];
    p.on('pageerror', e => p.problems.push('pageerror: ' + e.message));
    p.on('console', m => { if (m.type() === 'error') p.problems.push('console: ' + m.text()); });
    await p.setViewport({ width: 360, height: 640, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await p.evaluateOnNewDocument((s, noReader) => {
      if (!localStorage.getItem('plateTally.v1')) localStorage.setItem('plateTally.v1', s);
      if (noReader) delete window.BarcodeDetector;   // use the bundled reader, as an iPhone would
    }, JSON.stringify(state), !!opts.noReader);
    await p.goto(url + '/', { waitUntil: 'networkidle0' });
    return p;
  };
  try {
    // ---- the sender: what is on screen decodes to the shared text ----
    const sender = await launch([]);
    const a = await phone(sender, stateWith(many()));
    await a.evaluate(() => go('bill'));
    await a.tap('[data-act="menu"]'); await a.tap('[data-act="share"]'); await a.tap('[data-act="share-all"]');
    const shown = await a.evaluate(async () => {
      const svg = document.querySelector('#share-qr svg');
      const img = new Image(); img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(svg));
      await img.decode();
      const c = document.createElement('canvas'); c.width = c.height = 600;
      const x = c.getContext('2d'); x.drawImage(img, 0, 0, 600, 600);
      const code = jsQR(x.getImageData(0, 0, 600, 600).data, 600, 600);
      return { text: code && code.data, count: document.getElementById('qr-count') && document.getElementById('qr-count').textContent };
    });
    t.check('the code on screen reads back as part 1', /^STT1:[0-9a-z]+:1\/\d+:\{"v":1/.test(shown.text || ''), shown);
    t.check('a split share says so', /^Code 1 of [2-9]/.test(shown.count || ''), shown.count);
    // the share card fits a small phone
    const fit = await a.evaluate(() => { const r = s => { const b = document.querySelector(s).getBoundingClientRect(); return { top: b.top, bottom: b.bottom, left: b.left, right: b.right, width: b.width }; }; return { qr: r('#share-qr'), card: r('#modal .m-card'), vw: innerWidth, vh: innerHeight, overflowX: document.documentElement.scrollWidth - innerWidth }; });
    t.check('the code fits across the screen', fit.qr.left >= 0 && fit.qr.right <= fit.vw && fit.qr.width >= 250, fit);
    t.check('the card stays on screen (it scrolls inside if needed)', fit.card.top >= 0 && fit.card.bottom <= fit.vh, fit);
    t.eq('no sideways scrolling with the code showing', fit.overflowX <= 0, true);
    // every part, as module grids, for the fake camera
    const parts = await a.evaluate(() => shareParts(S.restaurants).map(p => {
      const q = qrcode(0, 'M'); q.addData(p, 'Byte'); q.make();
      const n = q.getModuleCount(), m = [];
      for (let y = 0; y < n; y++) { const row = []; for (let x = 0; x < n; x++) row.push(q.isDark(y, x) ? 1 : 0); m.push(row); }
      return m;
    }));
    t.eq('no errors on the sending phone', a.problems, []);
    // one restaurant, for the clash test
    const one = await phone(sender, stateWith([sample({ id: 'k', name: 'Place 2 くら', currency: 'AUD', plates: [plate('z', '#ffffff', 999)] })]));
    const oneMatrix = await one.evaluate(() => { const q = qrcode(0, 'M'); q.addData(shareParts(S.restaurants)[0], 'Byte'); q.make(); const n = q.getModuleCount(), m = []; for (let y = 0; y < n; y++) { const r = []; for (let x = 0; x < n; x++) r.push(q.isDark(y, x) ? 1 : 0); m.push(r); } return m; });

    // ---- the receiver: a real camera stream (a video of the codes) scanned by the bundled reader ----
    const video = path.join(tmp, 'codes.y4m');
    writeVideo(video, parts);
    const recv = await launch(['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--use-file-for-fake-video-capture=' + video]);
    const b = await phone(recv, stateWith([]), { noReader: true });
    await b.tap('.picker [data-act="share-receive"]');
    const fitScan = await b.evaluate(() => { const r = s => { const b = document.querySelector(s).getBoundingClientRect(); return { top: b.top, bottom: b.bottom, left: b.left, right: b.right, width: b.width }; }; return { box: r('.scan-box'), cancel: r('#modal .m-row .btn'), vh: innerHeight, vw: innerWidth }; });
    t.check('the camera view fits the screen', fitScan.box.left >= 0 && fitScan.box.right <= fitScan.vw, fitScan);
    let n = 0;
    for (let i = 0; i < 100 && n < 6; i++) { await wait(200); n = await b.evaluate(() => S.restaurants.length); }
    t.eq('the camera read every code and added all 6', n, 6);
    const r = await b.evaluate(() => ({ names: S.restaurants.map(x => x.name), plates: S.restaurants[0].plates.length, items: S.restaurants[0].items.map(i => i.desc),
      cameraOff: !scan.stream, report: document.querySelectorAll('#modal .imp-report li').length }));
    t.eq('names came across, Japanese included', r.names, ['Place 0 くら', 'Place 1 くら', 'Place 2 くら', 'Place 3 くら', 'Place 4 くら', 'Place 5 くら']);
    t.eq('plates and items came across', [r.plates, r.items], [6, ['Green tea', 'Miso soup', 'Edamame', 'Gyoza']]);
    t.check('camera turned off after reading', r.cameraOff);
    t.eq('report shows them', r.report, 6);
    t.eq('no errors on the receiving phone', b.problems, []);

    // a clash through the real camera: Place 2 is already there
    const video2 = path.join(tmp, 'one.y4m');
    writeVideo(video2, [oneMatrix], 10);
    await recv.close();   // one fake camera at a time
    const recv2 = await launch(['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--use-file-for-fake-video-capture=' + video2]);
    const c = await phone(recv2, stateWith(many()), { noReader: true });
    await c.select('#rest-select', '__receive');
    let asked = '';
    for (let i = 0; i < 60 && !/already have/.test(asked); i++) { await wait(200); asked = await c.evaluate(() => (document.querySelector('#modal h2') || {}).textContent || ''); }
    t.eq('the clash question comes up', asked, 'You already have “Place 2 くら”');
    await c.tap('#modal [data-c="replace"]');
    t.eq('replaced through a real scan', await c.evaluate(() => S.restaurants.find(x => x.id === 'm2').plates.map(p => p.price)), [999]);

    // ---- a photo of a code (no camera needed) ----
    const d = await phone(sender, stateWith([]), { noReader: true });
    await d.tap('.picker [data-act="share-receive"]');
    const added = await d.evaluate(async () => {
      const text = shareParts([{ name: 'Photo Sushi', currency: 'NZD', plates: [{ colour: '#3e8ef7', price: 420 }], items: [] }])[0];
      const q = qrcode(0, 'M'); q.addData(text, 'Byte'); q.make();
      const n = q.getModuleCount(), s = 8, c = document.createElement('canvas'); c.width = c.height = (n + 8) * s + 300;
      const x = c.getContext('2d'); x.fillStyle = '#777'; x.fillRect(0, 0, c.width, c.height);   // a photo: the code is off-centre on a grey table
      x.fillStyle = '#fff'; x.fillRect(200, 100, (n + 8) * s, (n + 8) * s); x.fillStyle = '#000';
      for (let yy = 0; yy < n; yy++) for (let xx = 0; xx < n; xx++) if (q.isDark(yy, xx)) x.fillRect(200 + (xx + 4) * s, 100 + (yy + 4) * s, s, s);
      const blob = await new Promise(ok => c.toBlob(ok, 'image/jpeg', 0.85));
      await scanFile(new File([blob], 'code.jpg', { type: 'image/jpeg' }));
      return S.restaurants.map(r => [r.name, r.currency, r.plates[0].price]);
    });
    t.eq('a photo of a code works', added, [['Photo Sushi', 'NZD', 420]]);
    const blank = await phone(sender, stateWith([]), { noReader: true });
    await blank.tap('.picker [data-act="share-receive"]');
    const none = await blank.evaluate(async () => {
      const c = document.createElement('canvas'); c.width = c.height = 200; c.getContext('2d').fillRect(0, 0, 50, 50);
      await scanFile(new File([await new Promise(ok => c.toBlob(ok))], 'x.png', { type: 'image/png' }));
      return document.getElementById('scan-status').textContent;
    });
    t.check('a photo without a code says so', /No code found/.test(none), none);
  } finally {
    for (const b of browsers) await b.close().catch(() => {});
    server.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
};
