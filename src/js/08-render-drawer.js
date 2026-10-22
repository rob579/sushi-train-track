/* ============ render ============ */
let lastView = null;
function render(){
  const v = { pick: viewPick, bill: viewBill, edit: viewEdit }[ui.view];
  const old = document.querySelector('.scroll'), top = old ? old.scrollTop : 0;
  document.getElementById('app').innerHTML = v();
  const now = document.querySelector('.scroll');
  if (now && lastView === ui.view) now.scrollTop = top;
  lastView = ui.view;
  if (ui.view === 'bill') fitTotal();
  if (ui.view === 'edit') {
    const all = [...document.querySelectorAll('.screen input[type="text"]')];
    if (all.length) all[all.length - 1].setAttribute('enterkeyhint', 'done');
  }
}

/* slide the add-item drawer up/down without re-rendering (keeps what's typed, and the animation) */
function setDock(open){
  ui.dock = open;
  const dock = document.getElementById('dock'); if (!dock) return;
  dock.classList.toggle('open', open);
  document.getElementById('dock-scrim').classList.toggle('on', open);
  dock.querySelector('#dock-body').toggleAttribute('inert', !open);
  const tab = dock.querySelector('.dock-tab');
  tab.setAttribute('aria-expanded', open);
  const rr = rest();
  tab.querySelector('.lbl').textContent = open ? 'Close' : (rr ? dockTitle(billOf(rr.id)) : 'Menu items');
  if (!open) { if (document.activeElement) document.activeElement.blur(); hideSuggest(); }
  syncKeyboard();
}

/* Chrome keeps the page at full height when the keyboard opens, which would leave the drawer hidden
   underneath it. Measure the keyboard via the visual viewport and lift the drawer by that much. */
function syncKeyboard(){
  const vv = window.visualViewport; if (!vv) return;
  const a = document.activeElement;
  const typing = ui.dock && a && a.closest && a.closest('#dock') && /^(INPUT|TEXTAREA)$/.test(a.tagName);
  const kb = typing ? Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)) : 0;
  const root = document.documentElement;
  root.style.setProperty('--kb', kb + 'px');
  root.classList.toggle('kb', kb > 0);
}
if (window.visualViewport) {
  visualViewport.addEventListener('resize', syncKeyboard);
  visualViewport.addEventListener('scroll', syncKeyboard);
}
document.addEventListener('focusin', () => setTimeout(syncKeyboard, 0));
document.addEventListener('focusout', () => setTimeout(syncKeyboard, 0));

/* long amounts (e.g. "CHF 1'234.50") get smaller type so the total never pushes the menu button off screen */
function fitTotal(){
  const el = document.getElementById('total'); if (!el) return;
  const box = el.parentElement, lbl = box.querySelector('.lbl');
  const avail = box.clientWidth - (lbl ? lbl.offsetWidth : 0) - 10;
  let size = 50; el.style.fontSize = size + 'px';
  while (el.scrollWidth > avail && size > 22) { size -= 2; el.style.fontSize = size + 'px'; }
}
window.addEventListener('resize', fitTotal);
if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitTotal);

/* ============ the drawer: menu items on this bill, grouped ============ */
const itemKey = e => (e.desc || '').trim().toLowerCase() + '|' + e.price;
const itemName = e => (e.desc || '').trim() || 'Other item';
function itemGroups(b){
  const groups = [], byKey = new Map();
  for (const e of b.extras) {
    const k = itemKey(e);
    let g = byKey.get(k);
    if (!g) { g = { name: itemName(e), price: e.price, qty: 0, lastId: e.id }; byKey.set(k, g); groups.push(g); }
    g.qty++; g.lastId = e.id;
  }
  return groups;
}
const dockTitle = b => 'Menu items' + (b.extras.length ? ' (' + b.extras.length + ')' : '');
function dockItemsHtml(b, r){
  return itemGroups(b).map(g => `<div class="ditem">
      <span class="nm">${g.qty} x ${esc(g.name)}</span>
      <button type="button" class="step" data-act="item-minus" data-id="${g.lastId}" aria-label="Remove one ${esc(g.name)}">\u2212</button>
      <button type="button" class="step" data-act="item-plus" data-id="${g.lastId}" aria-label="Add one more ${esc(g.name)}">+</button>
      <span class="amt">${money(g.price * g.qty, r)}</span>
    </div>`).join('');
}
function refreshDockItems(){
  const r = rest(); if (!r) return;
  const b = billOf(r.id);
  const box = document.getElementById('dock-items'); if (box) box.innerHTML = dockItemsHtml(b, r);
  const lbl = document.querySelector('#dock .dock-tab .lbl'); if (lbl && !ui.dock) lbl.textContent = dockTitle(b);   // the handle shows the count while closed
}

/* in-place update so taps feel instant */
function refreshTotal(){
  const el = document.getElementById('total'); if (!el) return;
  el.textContent = money(totalOf(rest()));
  fitTotal();
  el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
}
function refreshPlate(id){
  const r = rest(), n = billOf(r.id).counts[id] || 0;
  const plate = document.querySelector(`[data-plate="${id}"]`); if (!plate) return;
  const num = plate.querySelector('.n');
  num.textContent = n; num.classList.toggle('zero', !n);
  plate.parentElement.classList.toggle('has', n > 0);
  plate.classList.remove('pop'); void plate.offsetWidth; plate.classList.add('pop');
}

