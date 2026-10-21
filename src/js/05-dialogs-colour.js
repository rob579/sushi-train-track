/* ============ modal dialogs ============ */
function hideModal(){ const m = document.getElementById('modal'); if (m) m.remove(); }
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
const CC = { value: '#e5484d', custom: false };
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
function ccInit(hex){ CC.value = String(hex).toLowerCase(); CC.custom = !PALETTE.includes(CC.value); }
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
  document.querySelectorAll('[data-cc-preview]').forEach(el => { el.style.setProperty('--c', CC.value); el.style.setProperty('--ink', inkFor(CC.value)); });
}

