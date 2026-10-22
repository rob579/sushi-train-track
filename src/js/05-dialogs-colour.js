/* ============ modal dialogs ============ */
let modalCleanup = null;   // set by a modal that has something running (a camera, a timer), called when it closes
function hideModal(){
  const m = document.getElementById('modal'); if (m) m.remove();
  if (modalCleanup) { const f = modalCleanup; modalCleanup = null; f(); }
}
function showModal(html){
  hideModal();
  const m = document.createElement('div');
  m.id = 'modal'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true');
  m.innerHTML = `<div class="m-scrim" data-act="m-close"></div><div class="m-card">${html}</div>`;
  document.body.appendChild(m);
  return m;
}

/* ============ colour chooser (predefined colours plus a custom mixer that starts from the chosen colour) ============ */
const PALETTE = ['#e5484d','#f5a524','#f2d74a','#4cb782','#2bb5b0','#3e8ef7','#8b5cf6','#ec6fb0','#ffffff','#9aa3a8','#2b2b2b','#a2673a'];
/* CC.value is the colour being edited right now. A plate can have a second colour (same price, either colour on the belt):
   CC.slots holds both ([first, second or null]) and CC.active says which one the swatches are changing. */
const CC = { value: '#e5484d', custom: false, slots: ['#e5484d', null], active: 0, used: [], target: null };
function hexToHsl(hex){
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16 & 255) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn, l = (mx + mn) / 2;
  let h = 0, s = 0;
  if (d) {
    s = d / (1 - Math.abs(2 * l - 1));
    h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h = (h * 60 + 360) % 360;
  }
  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
}
function hslToHex(h, s, l){
  s /= 100; l /= 100;
  const k = n => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const x = v => Math.round(v * 255).toString(16).padStart(2, '0');
  return '#' + x(f(0)) + x(f(8)) + x(f(4));
}
function ccInit(hex, hex2, target, used){
  CC.slots = [String(hex).toLowerCase(), hex2 ? String(hex2).toLowerCase() : null];
  CC.active = 0; CC.target = target || null; CC.used = (used || []).map(c => c.toLowerCase());
  ccSelect(0);
}
function ccSelect(i){ CC.active = i; CC.value = CC.slots[i]; CC.custom = !PALETTE.includes(CC.value); }
/* the colours chosen, with a repeated second colour dropped */
function ccColours(){ const [a, b] = CC.slots; return [a, b && b !== a ? b : null]; }
/* how a plate looks: one colour, or two colours half and half with white outlined writing (readable on any pair) */
function plateLook(c1, c2){
  return { cls: c2 ? ' two' : '', style: `--c:${c1};${c2 ? `--c2:${c2};` : ''}--ink:${c2 ? '#ffffff' : inkFor(c1)}` };
}
const plateFill = (c1, c2) => c2 ? `linear-gradient(90deg,${c1} 50%,${c2} 50%)` : c1;   // for the small round chips and dots
const plateName = p => p.colour2 ? p.colour + ' and ' + p.colour2 : p.colour;
/* the part under the colour chooser: "Add second colour", or which colour you're changing, Remove and Split */
function ccDualHtml(){
  const [a, b] = CC.slots;
  if (!b) return `<button type="button" class="link-btn" data-act="cc-add2">+ Add second colour</button>`;
  const tab = (c, i) => `<button type="button" class="cc-slot${CC.active === i ? ' sel' : ''}" data-act="cc-slot" data-i="${i}" aria-pressed="${CC.active === i}"><span style="--c:${c}"></span>${i ? 'Second' : 'First'} colour</button>`;
  return `<div class="cc-slots" role="group" aria-label="Which colour you are changing">${tab(a, 0)}${tab(b, 1)}</div>
    <div class="cc-dual-acts"><button type="button" class="link-btn" data-act="cc-remove">Remove ${CC.active ? 'second' : 'first'} colour</button><button type="button" class="link-btn" data-act="cc-split">Split into two plates</button></div>`;
}
/* a colour another plate already uses: says so in the card and returns true (the card stays open) */
function ccClash(){
  const clash = ccColours().some(c => c && CC.used.includes(c));
  const err = document.getElementById('cc-err') || document.getElementById('np-err');
  if (err) err.textContent = clash ? 'You already have a plate in this colour. Pick a different one.' : '';
  return clash;
}
/* "Add second colour": starts on a colour this restaurant isn't using yet */
function ccAddSecond(){
  const taken = new Set([...CC.used, CC.slots[0]]);
  CC.slots[1] = PALETTE.find(c => !taken.has(c)) || PALETTE.find(c => c !== CC.slots[0]);
  ccSelect(1); ccRefresh();
}
function ccRemoveColour(){
  CC.slots = CC.active ? [CC.slots[0], null] : [CC.slots[1], null];
  ccSelect(0); ccRefresh();
}
function ccHtml(){
  const sw = PALETTE.map(c => `<button type="button" class="cc-sw" data-act="cc-pick" data-c="${c}" style="--c:${c}" aria-label="Colour ${c}"></button>`).join('');
  return `<div class="cc" id="cc">
    <div class="cc-grid">${sw}<button type="button" class="cc-sw cc-custom" data-act="cc-custom" aria-label="Custom colour"></button></div>
    <div class="cc-panel" id="cc-panel" hidden>
      <div class="cc-row"><span>Hue</span><input type="range" id="cc-h" min="0" max="360" aria-label="Hue"></div>
      <div class="cc-row"><span>Saturation</span><input type="range" id="cc-s" min="0" max="100" aria-label="Saturation"></div>
      <div class="cc-row"><span>Lightness</span><input type="range" id="cc-l" min="0" max="100" aria-label="Lightness"></div>
      <div class="cc-hex"><span>Hex code</span><input type="text" id="cc-hex" maxlength="7" autocapitalize="off" autocomplete="off" spellcheck="false" aria-label="Hex colour code"></div>
    </div>
  </div>`;
}
/* from: 'hsl' when the sliders were just moved, 'hex' when the code was just typed, nothing otherwise */
function ccRefresh(from){
  const root = document.getElementById('cc'); if (!root) return;
  CC.slots[CC.active] = CC.value;
  const err = document.getElementById('cc-err'); if (err) err.textContent = '';   // a new pick clears "already have a plate in this colour"
  const h = document.getElementById('cc-h'), sa = document.getElementById('cc-s'), li = document.getElementById('cc-l'), hx = document.getElementById('cc-hex');
  const hsl = hexToHsl(CC.value);
  if (from !== 'hsl') { h.value = hsl.h; sa.value = hsl.s; li.value = hsl.l; }   // the mixer always starts from the colour already chosen
  if (from !== 'hex') hx.value = CC.value;
  root.querySelectorAll('.cc-sw[data-c]').forEach(b => b.classList.toggle('sel', !CC.custom && b.dataset.c === CC.value));
  const cu = root.querySelector('.cc-custom');
  cu.classList.toggle('sel', CC.custom); cu.classList.toggle('has-colour', CC.custom); cu.style.setProperty('--c', CC.value);
  document.getElementById('cc-panel').hidden = !CC.custom;
  const hh = +h.value, ss = +sa.value, ll = +li.value;
  h.style.setProperty('--track', 'linear-gradient(90deg,hsl(0 ' + ss + '% ' + ll + '%),hsl(60 ' + ss + '% ' + ll + '%),hsl(120 ' + ss + '% ' + ll + '%),hsl(180 ' + ss + '% ' + ll + '%),hsl(240 ' + ss + '% ' + ll + '%),hsl(300 ' + ss + '% ' + ll + '%),hsl(360 ' + ss + '% ' + ll + '%))');
  sa.style.setProperty('--track', 'linear-gradient(90deg,hsl(' + hh + ' 0% ' + ll + '%),hsl(' + hh + ' 100% ' + ll + '%))');
  li.style.setProperty('--track', 'linear-gradient(90deg,#000,hsl(' + hh + ' ' + ss + '% 50%),#fff)');
  const [c1, c2] = ccColours();
  document.querySelectorAll('[data-cc-preview]').forEach(el => { el.setAttribute('style', plateLook(c1, c2).style); el.classList.toggle('two', !!c2); });
  const dual = document.getElementById('cc-dual'); if (dual) dual.innerHTML = ccDualHtml();
  const apply = document.getElementById('cc-apply-btn'); if (apply) apply.textContent = c2 ? 'Use colours' : 'Use colour';
}

