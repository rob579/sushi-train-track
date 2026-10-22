/* ============ add a plate from the main screen ============ */
function openAddPlate(){
  const r = rest(), cur = curOf(r), used = r.plates.flatMap(p => [p.colour, p.colour2].filter(Boolean).map(c => c.toLowerCase()));
  ccInit(PALETTE.find(c => !used.includes(c)) || PALETTE[0], null, { kind: 'new' }, used);
  showModal(`<h2>Add a plate</h2>
    <p class="m-sub">Enter its price and choose its colour.</p>
    <div class="m-preview"><div class="plate" data-cc-preview><span class="n zero">0</span></div></div>
    <div class="field-label" style="margin-top:6px">Price</div>
    <div class="money"><span>${esc(symOf(cur))}</span><input id="np-price" type="text" inputmode="decimal" enterkeyhint="done" autocomplete="off" placeholder="${plain(0, cur)}" style="padding-left:${symPad(cur)}px" aria-label="Price per plate"></div>
    <div class="field-label" style="margin-top:18px">Colour</div>
    ${ccHtml()}
    <div class="cc-dual" id="cc-dual"></div>
    <div class="m-err" id="np-err" role="alert"></div>
    <div class="m-row"><button class="btn" data-act="m-close">Cancel</button><button class="btn primary" data-act="np-save">Add plate</button></div>`);
  ccRefresh();
}
/* split: the two colours become two separate plates at the same price */
function saveNewPlate(split){
  const r = rest(), err = document.getElementById('np-err'), input = document.getElementById('np-price');
  const c = toCents(input.value, curOf(r));
  if (c === null) { err.textContent = 'Enter the price, for example ' + plain(450, curOf(r)) + '.'; input.focus(); return; }
  const [c1, c2] = ccColours();
  if ([c1, c2].some(x => x && CC.used.includes(x))) { err.textContent = 'You already have a plate in this colour. Pick a different one.'; return; }
  if (split && c2) r.plates.push({ id: uid(), colour: c1, price: c }, { id: uid(), colour: c2, price: c });
  else r.plates.push(Object.assign({ id: uid(), colour: c1, price: c }, c2 ? { colour2: c2 } : {}));
  persist(); hideModal(); render(); toast(split && c2 ? 'Two plates added' : 'Plate added');
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
    <div class="m-preview"><div class="plate${plateLook(p.colour, p.colour2).cls}" style="${plateLook(p.colour, p.colour2).style};--pf:${pf}"><span class="n">${n}</span><span class="price">${esc(lbl)}</span></div></div>
    <div class="m-row"><button class="btn" data-act="m-close">Cancel</button><button class="btn danger-fill" data-act="m-remove" data-id="${p.id}">Remove one</button></div>`);
}
document.addEventListener('pointerdown', e => {
  const b = e.target.closest && e.target.closest('.plate-btn[data-act="plate"]');
  if (e.isPrimary === false) { lpCancel(); return; }   // a second finger: a pinch, not a long press
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

