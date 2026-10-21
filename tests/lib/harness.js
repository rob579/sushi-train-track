// Shared helpers for the check suites. Opens the BUILT page (dist/index.html) in jsdom, a small
// pretend browser, so no real phone or browser is needed.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');

function loadJsdom() {
  const cache = path.join(os.homedir(), '.cache', 'sushi-test-deps');
  for (const p of [undefined, path.join(cache, 'node_modules')]) {
    try { return require(p ? path.join(p, 'jsdom') : 'jsdom'); } catch {}
  }
  // not installed anywhere yet: install once into a cache folder outside the project
  fs.mkdirSync(cache, { recursive: true });
  execSync('npm init -y >/dev/null 2>&1; npm install jsdom@25 --no-audit --no-fund', { cwd: cache, stdio: 'inherit' });
  return require(path.join(cache, 'node_modules', 'jsdom'));
}
const { JSDOM, VirtualConsole } = loadJsdom();

function build() { execSync('sh build.sh', { cwd: ROOT, stdio: 'pipe' }); }
const html = () => fs.readFileSync(path.join(ROOT, 'dist', 'index.html'), 'utf8');
const wait = ms => new Promise(r => setTimeout(r, ms));

// handy test data (prices are in hundredths: 350 = 3.50)
const plate = (id, colour, price) => ({ id, colour, price });
const sample = (extra = {}) => Object.assign({
  id: 'r1', name: 'Kura', currency: 'USD', items: [],
  plates: [plate('p1', '#e5484d', 350), plate('p2', '#4cb782', 450), plate('p3', '#3e8ef7', 600)],
}, extra);
const stateWith = (restaurants, bills = {}, current) =>
  ({ restaurants, bills, current: current === undefined ? (restaurants[0] && restaurants[0].id) : current });

/**
 * Opens the app.
 *  search   : query string, e.g. '?app=play' or '?edition=free'
 *  state    : object stored as the saved app data
 *  storage  : extra localStorage entries {key: string}
 *  referrer : document referrer
 *  before   : function(window) run before the page's own code (to fake the Play billing service etc.)
 */
async function open(o = {}) {
  const errors = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => errors.push(String(e.message || e)));
  const dom = new JSDOM(html(), {
    url: 'https://sushi.test/' + (o.search || ''),
    ...(o.referrer ? { referrer: o.referrer } : {}),
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    virtualConsole: vc,
    beforeParse(w) {
      if (o.state) w.localStorage.setItem('plateTally.v1', JSON.stringify(o.state));
      for (const [k, v] of Object.entries(o.storage || {})) w.localStorage.setItem(k, v);
      for (const [k, v] of Object.entries(o.session || {})) w.sessionStorage.setItem(k, v);
      w.alerts = [];
      w.alert = m => w.alerts.push(String(m));
      w.confirm = () => true;
      w.scrollTo = () => {};
      w.matchMedia = w.matchMedia || (q => ({ matches: false, media: q, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }));
      if (o.before) o.before(w);
    },
  });
  const w = dom.window, d = w.document;
  await wait(20);
  const app = {
    window: w, document: d, errors,
    ev: code => w.eval(code),                       // run code inside the page
    S: () => w.eval('S'),
    saved: () => JSON.parse(w.localStorage.getItem('plateTally.v1') || 'null'),
    storage: () => Object.fromEntries(Object.keys(w.localStorage).map(k => [k, w.localStorage.getItem(k)])),
    $: s => d.querySelector(s),
    $$: s => [...d.querySelectorAll(s)],
    text: s => (d.querySelector(s) || {}).textContent || '',
    bodyText: () => d.body.textContent.replace(/\s+/g, ' '),
    click: s => { const e = typeof s === 'string' ? d.querySelector(s) : s; if (!e) throw new Error('click: nothing matches ' + s); e.click(); },
    act: (name, id) => app.click(`[data-act="${name}"]` + (id ? `[data-id="${id}"]` : '')),
    type: (s, v) => { const e = typeof s === 'string' ? d.querySelector(s) : s; if (!e) throw new Error('type: nothing matches ' + s); e.value = v; e.dispatchEvent(new w.Event('input', { bubbles: true })); return e; },
    change: (s, v) => { const e = d.querySelector(s); e.value = v; e.dispatchEvent(new w.Event('change', { bubbles: true })); },
    submit: s => d.querySelector(s).dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true })),
    wait,
    close: () => w.close(),
  };
  return app;
}

// tiny assertion helper; each suite gets one
function makeT(name) {
  const t = { name, passed: 0, failed: [], section: '' };
  t.check = (label, ok, detail) => {
    if (ok) t.passed++;
    else t.failed.push(`${label}${detail !== undefined ? '  -> ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)) : ''}`);
  };
  t.eq = (label, got, want) => t.check(label, JSON.stringify(got) === JSON.stringify(want), `got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`);
  return t;
}

module.exports = { open, build, makeT, sample, stateWith, plate, wait, ROOT };
