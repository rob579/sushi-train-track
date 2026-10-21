/* ---- suggestions for the description field ---- */
/* descriptions of items on OTHER restaurants' menus (not already on this one), matching what has been typed */
function otherItems(excludeRestId, takenDescs, q){
  const seen = new Set(takenDescs.map(d => d.toLowerCase()));
  const out = [];
  for (const r of S.restaurants) {
    if (r.id === excludeRestId) continue;
    for (const it of (r.items || [])) {
      const k = it.desc.toLowerCase();
      if (seen.has(k) || (q && !k.includes(q))) continue;
      seen.add(k); out.push(it.desc);
    }
  }
  return out.sort((a, b) => a.localeCompare(b));
}
function showSuggest(){
  const box = document.getElementById('suggest'), input = document.getElementById('xdesc');
  if (!box || !input) return;
  if (!isPremium()) {   // free: no saved items, just a nudge while the box is empty
    const typed = input.value.trim();
    box.innerHTML = typed ? '' : '<button type="button" data-act="upsell" data-why="items"><span>Save items for next time</span><small class="pro-note">Premium</small></button>';
    box.hidden = !!typed;
    return;
  }
  const items = rest().items || [], raw = input.value.trim(), q = raw.toLowerCase();
  const mine = items.filter(i => i.desc.toLowerCase().includes(q));
  // items from other restaurants are offered too (on focus, and narrowed as you type); they never bring a price with them
  const others = otherItems(S.current, items.map(i => i.desc), q).slice(0, q ? 8 : 6);
  const exact = items.some(i => i.desc.toLowerCase() === q);
  let html = mine.map(i => `<button type="button" data-act="pick-item" data-id="${i.id}"><span>${esc(i.desc)}</span><b>${money(i.price)}</b></button>`).join('');
  html += others.map(d => `<button type="button" data-act="pick-other" data-desc="${esc(d)}"><span>${esc(d)}</span><small>other menu</small></button>`).join('');
  if (raw && !exact && !mine.length && !others.length) html += `<div class="hint">"${esc(raw)}" isn't on this menu yet. It will be saved here when you add it.</div>`;
  box.innerHTML = html;
  box.hidden = !html;
}
function hideEditSuggest(){ document.querySelectorAll('.edit-suggest').forEach(b => b.hidden = true); }
function showEditSuggest(input){
  const d = ui.draft; if (!d) return;
  const box = input.parentElement.querySelector('.edit-suggest'); if (!box) return;
  const i = +input.dataset.i, q = input.value.trim().toLowerCase();
  const taken = d.items.filter((_, j) => j !== i).map(x => x.desc.trim()).filter(Boolean);
  const list = otherItems(d.isNew ? null : d.id, taken, q).slice(0, 6);
  if (!list.length) { box.hidden = true; return; }
  box.innerHTML = list.map(t => `<button type="button" data-act="pick-other" data-i="${i}" data-desc="${esc(t)}"><span>${esc(t)}</span><small>other menu</small></button>`).join('');
  // open upwards when there is little room below the field (e.g. the keyboard is up)
  const r = input.getBoundingClientRect(), vvh = window.visualViewport ? window.visualViewport.height : innerHeight;
  const below = vvh - r.bottom, above = r.top;
  box.classList.toggle('up', below < list.length * 46 + 16 && above > below);
  box.hidden = false;
}
function hideSuggest(){ const b = document.getElementById('suggest'); if (b) b.hidden = true; }
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (document.getElementById('modal')) hideModal();
    else if (document.getElementById('upgrade')) hideUpgrade();
    else if (ui.dock) setDock(false);
    return;
  }
  if (e.key !== 'Enter' || e.isComposing) return;
  const el = e.target;
  if (!el.matches || !el.matches('input[type="text"]')) return;
  if (el.id === 'np-price') { e.preventDefault(); const b = document.querySelector('[data-act="np-save"]'); if (b) b.click(); return; }
  if (el.id === 'cc-hex') { e.preventDefault(); el.blur(); return; }
  if (el.id === 'xdesc') { e.preventDefault(); document.getElementById('xprice').focus(); return; }   // Next: description, then price
  if (ui.view === 'edit') {                                                                           // Next: on to the next box
    e.preventDefault();
    const all = [...document.querySelectorAll('.screen input[type="text"]')].filter(x => !x.disabled && !x.closest('[hidden]'));
    const next = all[all.indexOf(el) + 1];
    if (next) { next.focus(); if (next.scrollIntoView) next.scrollIntoView({ block: 'center', behavior: 'smooth' }); } else el.blur();
  }
});
document.addEventListener('focusin', e => {
  if (e.target.id === 'xdesc') showSuggest();
  else if (e.target.dataset && e.target.dataset.field === 'idesc') showEditSuggest(e.target);
});
document.addEventListener('focusout', e => {
  const el = e.target;
  if (el.matches && el.matches('[data-field="price"],[data-field="iprice"],#xprice,#np-price') && el.value.trim()) {   // 4.8 becomes 4.80
    const inEditor = !!(ui.draft && el.dataset.field), cur = inEditor ? ui.draft.currency : curOf(rest());
    const c = toCents(el.value, cur);
    if (c !== null) {
      el.value = plain(c, cur);
      if (inEditor && el.dataset.field === 'price') ui.draft.plates[+el.dataset.i].price = el.value;
      else if (inEditor && el.dataset.field === 'iprice') ui.draft.items[+el.dataset.i].price = el.value;
    }
  }
  if (el.id === 'xdesc') setTimeout(() => { if (document.activeElement !== el) hideSuggest(); }, 250);
  else if (el.dataset && el.dataset.field === 'idesc') {
    const box = el.parentElement && el.parentElement.querySelector('.edit-suggest');
    setTimeout(() => { if (box && document.activeElement !== el) box.hidden = true; }, 250);
  }
});
document.addEventListener('mousedown', e => { if (e.target.closest('.suggest')) e.preventDefault(); });

function toast(msg){
  let t = document.getElementById('toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
  const dock = document.getElementById('dock');
  t.style.bottom = (ui.dock && dock) ? Math.round(window.innerHeight - dock.getBoundingClientRect().top + 46) + 'px' : '';   // clear of the open drawer
  t.textContent = msg; t.className = 'show';
  clearTimeout(toast._t); toast._t = setTimeout(() => t.className = '', 2400);
}

render();
refreshEntitlement();   // inside the Play app: ask Google Play whether Premium is owned
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') refreshEntitlement(); });

