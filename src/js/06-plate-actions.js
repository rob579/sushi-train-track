/* ============ add a plate from the main screen ============ */
function openAddPlate(){
  const r = rest(), cur = curOf(r), used = new Set(r.plates.map(p => p.colour.toLowerCase()));
  ccInit(PALETTE.find(c => !used.has(c)) || PALETTE[0]);
  showModal(`<h2>Add a plate</h2>
    <p class="m-sub">Choose its colour and price.</p>
    <div class="m-preview"><div class="plate" data-cc-preview style="--c:${CC.value};--ink:${inkFor(CC.value)}"><span class="n zero">0</span></div></div>
    ${ccHtml()}
    <div class="field-label" style="margin-top:18px">Price</div>
    <div class="money"><span>${esc(symOf(cur))}</span><input id="np-price" type="text" inputmode="decimal" enterkeyhint="done" autocomplete="off" placeholder="${plain(0, cur)}" style="padding-left:${symPad(cur)}px" aria-label="Price per plate"></div>
    <div class="m-err" id="np-err" role="alert"></div>
    <div class="m-row"><button class="btn" data-act="m-close">Cancel</button><button class="btn primary" data-act="np-save">Add plate</button></div>`);
  ccRefresh();
}
function saveNewPlate(){
  const r = rest(), err = document.getElementById('np-err'), input = document.getElementById('np-price');
  const c = toCents(input.value, curOf(r));
  if (c === null) { err.textContent = 'Enter the price, for example ' + plain(450, curOf(r)) + '.'; input.focus(); return; }
  if (r.plates.some(p => p.colour.toLowerCase() === CC.value)) { err.textContent = 'You already have a plate in this colour. Pick a different one.'; return; }
  r.plates.push({ id: uid(), colour: CC.value, price: c });
  persist(); hideModal(); render(); toast('Plate added');
}

/* ============ remove one plate by pressing and holding it ============ */
const lp = { timer: null, x: 0, y: 0, suppressUntil: 0 };
function lpCancel(){ clearTimeout(lp.timer); lp.timer = null; }
function confirmRemovePlate(id){
  const r = rest(), p = r.plates.find(x => x.id === id), n = p ? (billOf(r.id).counts[id] || 0) : 0;
  if (!p || !n) { toast('None of those have been taken'); return; }
  const lbl = money(p.price, r), pf = lbl.length <= 6 ? 10.5 : lbl.length === 7 ? 9.5 : lbl.length <= 9 ? 8 : 6.8;
  showModal(`<h2>Remove one plate?</h2>
    <p class="m-sub">This takes ${esc(lbl)} off your bill.</p>
    <div class="m-preview"><div class="plate" style="--c:${p.colour};--ink:${inkFor(p.colour)};--pf:${pf}"><span class="n">${n}</span><span class="price">${esc(lbl)}</span></div></div>
    <div class="m-row"><button class="btn" data-act="m-close">Cancel</button><button class="btn danger-fill" data-act="m-remove" data-id="${p.id}">Remove one</button></div>`);
}
document.addEventListener('pointerdown', e => {
  const b = e.target.closest && e.target.closest('.plate-btn[data-act="plate"]');
  if (!b || ui.removing || e.button > 0) return;
  lpCancel(); lp.x = e.clientX; lp.y = e.clientY;
  lp.timer = setTimeout(() => {
    lp.timer = null; lp.suppressUntil = Date.now() + 700;   // the click that follows letting go is ignored
    if (navigator.vibrate) navigator.vibrate(15);
    confirmRemovePlate(b.dataset.id);
  }, 550);
});
document.addEventListener('pointermove', e => { if (lp.timer && Math.hypot(e.clientX - lp.x, e.clientY - lp.y) > 10) lpCancel(); });
['pointerup', 'pointercancel', 'dragstart'].forEach(ev => document.addEventListener(ev, lpCancel, true));
document.addEventListener('scroll', lpCancel, true);
document.addEventListener('contextmenu', e => { if (e.target.closest && e.target.closest('.plate-btn')) e.preventDefault(); });

function go(view){ hideModal(); ui.view = view; ui.menu = false; ui.removing = false; ui.dock = false; render(); }

