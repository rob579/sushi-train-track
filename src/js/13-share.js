/* ============ share restaurants by QR code ============
   Nothing goes over the internet. The sending phone shows the restaurant setup (name, currency, plates,
   menu items; never the bill) as a QR code on its screen, and the receiving phone reads it with its camera.

   What is in a code (plain text, so any QR reader can read it back exactly):
     STT1:<set>:<part>/<parts>:<chunk>
   The chunks of one share, joined in order, are this JSON (ASCII only: other characters are written as \uXXXX):
     {"v":1,"r":[{"n":"Kura","c":"AUD","p":[["e5484d",350],...],"i":[["Green tea",300],...]}]}
   Prices are in hundredths, like everywhere else. A big share ("all restaurants") is split over several
   codes that the sending phone shows one after the other; the receiver collects them in any order. */
const SHARE_VERSION = 1;
const SHARE_PART_MAX = 600;          // characters of JSON per code: keeps each code easy to scan off a screen
const SHARE_CYCLE_MS = 1400;         // how long each code shows when there are several
const SHARE_LIMITS = { rests: 100, plates: 60, items: 300, text: 80, price: 1e9 };

/* plates match when they have a colour in common (a plate can have two colours) */
const plateColours = p => [p.colour, p.colour2].filter(Boolean).map(c => c.toLowerCase());
const sharesColour = (a, b) => plateColours(a).some(c => plateColours(b).includes(c));

/* ---- sending ---- */
function shareJson(list){
  const data = { v: SHARE_VERSION, r: list.map(r => {
    const o = { n: r.name, c: curOf(r), p: r.plates.map(p => { const a = [p.colour.replace('#', '').toLowerCase(), p.price]; if (p.colour2) a.push(p.colour2.replace('#', '').toLowerCase()); return a; }) };   // [colour, price, second colour if any]
    if ((r.items || []).length) o.i = r.items.map(it => [it.desc, it.price]);
    return o;
  }) };
  return JSON.stringify(data).replace(/[\u007f-￿]/g, ch => '\\u' + ch.charCodeAt(0).toString(16).padStart(4, '0'));
}
function shareParts(list){
  const json = shareJson(list), n = Math.max(1, Math.ceil(json.length / SHARE_PART_MAX));
  const set = uid().slice(0, 4), out = [];
  for (let i = 0; i < n; i++) out.push(`STT1:${set}:${i + 1}/${n}:` + json.slice(i * SHARE_PART_MAX, (i + 1) * SHARE_PART_MAX));
  return out;
}
/* the code as an SVG: black squares on white with the standard quiet border, sharp at any size */
function qrSvg(text){
  const q = qrcode(0, 'M');
  q.addData(text, 'Byte'); q.make();
  const n = q.getModuleCount(), pad = 4, size = n + pad * 2;
  let d = '';
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (q.isDark(y, x)) d += `M${x + pad} ${y + pad}h1v1h-1z`;
  return `<svg class="qr" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges" role="img" aria-label="QR code"><rect width="${size}" height="${size}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
}

function openShareMenu(){
  const r = rest(), many = S.restaurants.length > 1;
  showModal(`<h2>Share</h2>
    <p class="m-sub">Restaurants are shared by QR code, phone to phone. Nothing is sent over the internet.</p>
    <div class="share-opts">
      ${r ? `<button class="share-opt" data-act="share-one"><b>Share this restaurant</b><small>${esc(r.name)}: plates, prices and menu items</small></button>` : ''}
      ${many ? `<button class="share-opt" data-act="share-all"><b>Share all restaurants</b><small>All ${S.restaurants.length} of them</small></button>` : ''}
      <button class="share-opt" data-act="share-receive"><b>Receive from a friend</b><small>Scan the code on their phone</small></button>
    </div>
    <div class="m-row"><button class="btn" data-act="m-close">Close</button></div>`);
}

function openShareCode(list){
  const parts = shareParts(list), title = list.length === 1 ? esc(list[0].name) : `All ${list.length} restaurants`;
  const m = showModal(`<h2>${title}</h2>
    <p class="m-sub">On your friend's phone: open Sushi Train Track, choose <b>Share</b> then <b>Receive from a friend</b>, and point it at this code.</p>
    <div class="qr-wrap" id="share-qr">${qrSvg(parts[0])}</div>
    ${parts.length > 1 ? `<p class="qr-count" id="qr-count" role="status">Code 1 of ${parts.length}. They change by themselves, so just hold steady.</p>` : ''}
    <p class="qr-note">Shares the name, currency, plates, prices and menu items. Not your bill.</p>
    <div class="m-row"><button class="btn primary" data-act="m-close">Done</button></div>`);
  m.classList.add('share-modal');
  if (parts.length > 1) {
    let i = 0;
    const timer = setInterval(() => {
      const box = document.getElementById('share-qr'); if (!box) { clearInterval(timer); return; }
      i = (i + 1) % parts.length;
      box.innerHTML = qrSvg(parts[i]);
      const c = document.getElementById('qr-count'); if (c) c.textContent = `Code ${i + 1} of ${parts.length}. They change by themselves, so just hold steady.`;
    }, SHARE_CYCLE_MS);
    modalCleanup = () => clearInterval(timer);
  }
}

/* ---- reading a share back ---- */
/* returns { list } with clean restaurants (new ids), or { error } with a message for the person */
function parseShare(json){
  let o;
  try { o = JSON.parse(json); } catch { return { error: "That code couldn't be read. Ask your friend to show it again." }; }
  if (o && typeof o.v === 'number' && o.v > SHARE_VERSION) return { error: 'That code is from a newer version of Sushi Train Track. Update the app, then scan it again.' };
  const bad = { error: "That code doesn't contain restaurant details." };
  if (!o || o.v !== SHARE_VERSION || !Array.isArray(o.r) || !o.r.length || o.r.length > SHARE_LIMITS.rests) return bad;
  const text = v => typeof v === 'string' && v.trim() && v.trim().length <= SHARE_LIMITS.text ? v.trim() : null;
  const price = v => Number.isInteger(v) && v >= 0 && v <= SHARE_LIMITS.price ? v : null;
  const list = [];
  for (const r of o.r) {
    if (!r || typeof r !== 'object') return bad;
    const name = text(r.n), cur = typeof r.c === 'string' && /^[A-Z]{3}$/.test(r.c) ? r.c : null;
    if (!name || !cur || !Array.isArray(r.p) || !r.p.length || r.p.length > SHARE_LIMITS.plates) return bad;
    const plates = [], seen = new Set();
    for (const p of r.p) {
      if (!Array.isArray(p) || typeof p[0] !== 'string' || !/^[0-9a-f]{6}$/i.test(p[0]) || price(p[1]) === null) return bad;
      if (p[2] !== undefined && (typeof p[2] !== 'string' || !/^[0-9a-f]{6}$/i.test(p[2]))) return bad;
      const colour = '#' + p[0].toLowerCase(), colour2 = p[2] && p[2].toLowerCase() !== p[0].toLowerCase() ? '#' + p[2].toLowerCase() : null;
      if (seen.has(colour) || (colour2 && seen.has(colour2))) continue;
      seen.add(colour); if (colour2) seen.add(colour2);
      plates.push(Object.assign({ id: uid(), colour, price: p[1] }, colour2 ? { colour2 } : {}));
    }
    const items = [], seenI = new Set();
    if (r.i !== undefined && (!Array.isArray(r.i) || r.i.length > SHARE_LIMITS.items)) return bad;
    for (const it of r.i || []) {
      if (!Array.isArray(it) || !text(it[0]) || price(it[1]) === null) return bad;
      const k = text(it[0]).toLowerCase();
      if (seenI.has(k)) continue;
      seenI.add(k); items.push({ id: uid(), desc: text(it[0]), price: it[1] });
    }
    list.push({ id: uid(), name, currency: cur, plates, items });
  }
  return { list };
}

/* ---- the scanner ---- */
const scan = { stream: null, timer: null, parts: {}, set: null, n: 0, lastMsg: 0, done: false };
let qrDet;   // the phone's own QR reader, if it has one (undefined: not checked yet, null: none)
async function qrDetector(){
  if (qrDet !== undefined) return qrDet;
  qrDet = null;
  try {
    if ('BarcodeDetector' in window && (await BarcodeDetector.getSupportedFormats()).includes('qr_code')) qrDet = new BarcodeDetector({ formats: ['qr_code'] });
  } catch {}
  return qrDet;
}
/* all QR texts found in a video frame or picture. Falls back to the bundled reader (jsQR) */
async function detectQR(src, thorough){
  const det = await qrDetector();
  if (det) {
    try { const r = await det.detect(src); if (r.length || !thorough) return r.map(x => x.rawValue); } catch { if (!thorough) return []; }
  }
  const w = src.videoWidth || src.naturalWidth || src.width, h = src.videoHeight || src.naturalHeight || src.height;
  if (!w || !h || typeof jsQR !== 'function') return [];
  const k = Math.min(1, 1200 / Math.max(w, h)), cw = Math.round(w * k), ch = Math.round(h * k);
  const c = detectQR.canvas || (detectQR.canvas = document.createElement('canvas'));
  c.width = cw; c.height = ch;
  const ctx = c.getContext('2d', { willReadFrequently: true }); if (!ctx) return [];
  ctx.drawImage(src, 0, 0, cw, ch);
  const code = jsQR(ctx.getImageData(0, 0, cw, ch).data, cw, ch, { inversionAttempts: thorough ? 'attemptBoth' : 'dontInvert' });
  return code && code.data ? [code.data] : [];
}

function scanStatus(msg, kind){
  const el = document.getElementById('scan-status'); if (!el) return;
  el.textContent = msg; el.className = 'scan-status' + (kind ? ' ' + kind : '');
}
function scanStop(){
  clearTimeout(scan.timer); scan.timer = null;
  if (scan.stream) { scan.stream.getTracks().forEach(t => t.stop()); scan.stream = null; }
}
function openScanner(){
  Object.assign(scan, { parts: {}, set: null, n: 0, lastMsg: 0, done: false });
  showModal(`<h2>Receive from a friend</h2>
    <p class="m-sub">On their phone: <b>Share</b>, then <b>Share this restaurant</b>. Point your camera at the code that appears.</p>
    <div class="scan-box"><video id="scan-video" playsinline muted autoplay></video><div class="scan-frame" aria-hidden="true"></div></div>
    <p class="scan-status" id="scan-status" role="status">Starting the camera…</p>
    <label class="btn scan-photo">Scan a photo of the code instead<input type="file" id="scan-file" accept="image/*" hidden></label>
    <div class="m-row"><button class="btn" data-act="m-close">Cancel</button></div>`).classList.add('scan-modal');
  modalCleanup = () => { scan.done = true; scanStop(); };   // closing the scanner turns the camera off
  startCamera();
}
async function startCamera(){
  const md = navigator.mediaDevices;
  if (!md || !md.getUserMedia) { scanStatus("This browser can't use the camera here. Take a photo of the code and scan that instead.", 'warn'); return; }
  let stream;
  try { stream = await md.getUserMedia({ video: { facingMode: 'environment' }, audio: false }); }
  catch (e) {
    scanStatus(e && e.name === 'NotAllowedError'
      ? "The camera isn't allowed. Allow it for Sushi Train Track in your phone's settings, or scan a photo of the code instead."
      : "Couldn't start the camera. You can scan a photo of the code instead.", 'warn');
    return;
  }
  const v = document.getElementById('scan-video');
  if (!v || scan.done) { stream.getTracks().forEach(t => t.stop()); return; }   // closed while the camera was starting
  scan.stream = stream; v.srcObject = stream;
  try { await v.play(); } catch {}
  scanStatus('Point at the code. It reads by itself.');
  scanTick();
}
async function scanTick(){
  scan.timer = null;
  const v = document.getElementById('scan-video');
  if (!v || !scan.stream || scan.done) return;
  if (v.readyState >= 2) { for (const t of await detectQR(v, false)) { scanText(t); if (scan.done) return; } }
  if (scan.stream && !scan.done) scan.timer = setTimeout(scanTick, 200);
}
async function scanFile(file){
  if (!file) return;
  scanStatus('Reading the photo…');
  const url = URL.createObjectURL(file), img = new Image();
  try {
    img.src = url; await img.decode();
    const found = await detectQR(img, true);
    if (!found.length) { scanStatus("No code found in that photo. Try a sharper photo with the whole code in it.", 'warn'); return; }
    for (const t of found) { scanText(t, true); if (scan.done) return; }
  } catch { scanStatus("Couldn't open that photo.", 'warn'); }
  finally { URL.revokeObjectURL(url); }
}
/* one QR text read by the camera or from a photo */
function scanText(text, fromPhoto){
  const m = /^STT1:([0-9a-z]{1,12}):(\d{1,3})\/(\d{1,3}):([\s\S]*)$/.exec(String(text));
  if (!m || +m[2] < 1 || +m[2] > +m[3]) {
    if (fromPhoto || Date.now() - scan.lastMsg > 2500) { scan.lastMsg = Date.now(); scanStatus("That code isn't from Sushi Train Track.", 'warn'); }
    return;
  }
  const [, set, i, n, chunk] = m;
  if (scan.set !== set) { scan.set = set; scan.parts = {}; scan.n = +n; }   // a different share: start again
  if (scan.parts[i] === undefined && navigator.vibrate) navigator.vibrate(12);
  scan.parts[i] = chunk;
  const got = Object.keys(scan.parts).length;
  if (got < scan.n) {
    scanStatus(`Got ${got} of ${scan.n} codes.` + (fromPhoto ? ' Scan a photo of the next one, or use the camera.' : ' Keep pointing at their screen.'), 'ok');
    return;
  }
  let json = '';
  for (let k = 1; k <= scan.n; k++) json += scan.parts[k];
  const res = parseShare(json);
  if (res.error) { scan.set = null; scan.parts = {}; scanStatus(res.error, 'warn'); return; }
  scan.done = true; scanStop();
  if (navigator.vibrate) navigator.vibrate([20, 60, 20]);
  beginImport(res.list);
}

/* ---- adding what was received ---- */
const imp = { queue: [], all: null, report: [] };
const sameName = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase();
const clashOf = inc => S.restaurants.find(r => sameName(r.name, inc.name));
function beginImport(list){
  imp.queue = list.slice(); imp.all = null; imp.report = [];
  nextImport();
}
function nextImport(){
  while (imp.queue.length) {
    const inc = imp.queue[0], mine = clashOf(inc);
    if (mine && !imp.all) { askClash(inc, mine); return; }
    imp.queue.shift();
    applyImport(mine ? imp.all : 'new', inc, mine);
  }
  finishImport();
}
const counted = (n, one) => n + ' ' + one + (n === 1 ? '' : 's');
const summaryOf = r => counted(r.plates.length, 'plate') + ' · ' + counted((r.items || []).length, 'menu item') + ' · ' + curOf(r);
function askClash(inc, mine){
  const canMerge = curOf(mine) === inc.currency;
  const more = imp.queue.slice(1).filter(x => clashOf(x)).length;
  const last = imp.queue.length === 1;
  showModal(`<h2>You already have “${esc(mine.name)}”</h2>
    <div class="clash-cmp"><div><small>Yours</small>${esc(summaryOf(mine))}</div><div><small>Your friend's</small>${esc(summaryOf(inc))}</div></div>
    <div class="share-opts">
      <button class="share-opt" data-act="imp-choice" data-c="replace"><b>Replace mine</b><small>Use your friend's plates, prices and menu items instead of yours</small></button>
      ${canMerge ? `<button class="share-opt" data-act="imp-choice" data-c="merge"><b>Merge</b><small>Keep yours and add any plates and menu items you don't have</small></button>`
        : `<p class="muted clash-note">Merging isn't offered because yours is in ${esc(curOf(mine))} and theirs is in ${esc(inc.currency)}.</p>`}
      <button class="share-opt" data-act="imp-choice" data-c="new"><b>Keep both</b><small>Add theirs as “${esc(freeName(inc.name))}”</small></button>
    </div>
    ${more ? `<label class="clash-all"><input type="checkbox" id="imp-all"> Do the same for the other ${counted(more, 'restaurant')} you already have</label>` : ''}
    <div class="m-row"><button class="btn" data-act="imp-choice" data-c="skip">${last ? 'Cancel' : 'Skip this one'}</button></div>`);
}
function chooseImport(choice){
  const box = document.getElementById('imp-all');
  if (box && box.checked) imp.all = choice === 'merge' ? 'merge-or-new' : choice;
  const inc = imp.queue.shift();
  applyImport(choice, inc, clashOf(inc));
  nextImport();
}
/* "Kura" is taken, so "Kura (2)", "Kura (3)" ... */
function freeName(name){
  if (!S.restaurants.some(r => sameName(r.name, name))) return name;
  for (let k = 2; ; k++) { const n = `${name} (${k})`; if (!S.restaurants.some(r => sameName(r.name, n))) return n; }
}
function applyImport(choice, inc, mine){
  if (choice === 'merge-or-new') choice = mine && curOf(mine) === inc.currency ? 'merge' : 'new';
  if (choice === 'skip' || (choice !== 'new' && !mine)) { if (choice === 'skip') imp.report.push([inc.name, 'skipped']); return; }
  if (choice === 'new') {
    const name = freeName(inc.name);
    S.restaurants.push(Object.assign({}, inc, { name }));
    imp.report.push([name, 'added', inc.id]);
  } else if (choice === 'replace') {
    // plates of the same colour keep their place, so a bill in progress keeps its counts for them
    mine.currency = inc.currency;
    const taken = new Set();   // a two-colour plate of mine can match only one of theirs
    mine.plates = inc.plates.map(p => { const old = mine.plates.find(x => !taken.has(x.id) && sharesColour(x, p)); if (old) { taken.add(old.id); p.id = old.id; } return p; });
    mine.items = inc.items;
    const b = S.bills[mine.id];
    if (b) for (const k of Object.keys(b.counts)) if (!mine.plates.some(p => p.id === k)) delete b.counts[k];
    imp.report.push([mine.name, 'replaced with your friend\'s', mine.id]);
  } else if (choice === 'merge') {
    const np = inc.plates.filter(p => !mine.plates.some(x => sharesColour(x, p)));
    mine.items ||= [];
    const ni = inc.items.filter(it => !mine.items.some(x => sameName(x.desc, it.desc)));
    mine.plates.push(...np); mine.items.push(...ni);
    imp.report.push([mine.name, np.length || ni.length
      ? 'merged: ' + [np.length && counted(np.length, 'plate'), ni.length && counted(ni.length, 'menu item')].filter(Boolean).join(' and ') + ' added'
      : 'merged: you already had everything', mine.id]);
  }
}
function finishImport(){
  persist();
  const changed = imp.report.filter(([, what]) => what !== 'skipped');
  if (!changed.length) { hideModal(); render(); toast('Nothing was changed'); return; }
  // received on the landing page and it was just one restaurant: go straight to its bill
  if (ui.view === 'pick' && imp.report.length === 1) {
    const [name, what, id] = imp.report[0];
    S.current = id; persist(); go('bill');
    toast(what === 'added' ? name + ' added' : name + ' ' + what.replace(/^merged: .*/, 'merged').replace(/ with your friend's$/, ''));
    return;
  }
  const lines = imp.report.map(([name, what]) => `<li><b>${esc(name)}</b> ${esc(what)}</li>`).join('');
  render();
  showModal(`<h2>${changed.length === 1 && imp.report.length === 1 ? 'Got it' : 'All done'}</h2>
    <ul class="imp-report">${lines}</ul>
    <div class="m-row"><button class="btn primary" data-act="m-close">OK</button></div>`);
}

document.addEventListener('change', e => { if (e.target.id === 'scan-file') { scanFile(e.target.files && e.target.files[0]); e.target.value = ''; } });
