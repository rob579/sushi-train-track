/* ============ events ============ */
document.addEventListener('click', e => {
  // anywhere on the collapsed drawer opens it (the name and the tab also toggle it, via data-act)
  const dock = e.target.closest('#dock');
  if (dock && !ui.dock && !e.target.closest('[data-act="dock-toggle"]')) { setDock(true); return; }
  const t = e.target.closest('[data-act]'); if (!t) return;
  const act = t.dataset.act, id = t.dataset.id;
  switch (act) {
    case 'open': {
      const r = S.restaurants.find(x => x.id === id);
      if (!r) break;
      S.current = id; persist(); go('bill'); break;
    }
    case 'pick': go('pick'); break;
    case 'bill': go('bill'); break;
    case 'new': startDraft(null); break;
    case 'edit': startDraft(id); break;
    case 'edit-back': ui.draft = null; go(ui.prevView === 'bill' && rest() ? 'bill' : 'pick'); break;
    case 'dock-toggle': setDock(!ui.dock); break;
    case 'dock-close': setDock(false); break;
    case 'menu': ui.menu = true; render(); break;
    case 'menu-close': ui.menu = false; render(); break;
    case 'itemised': if (ui.menu) { ui.menu = false; render(); } openItemised(); break;
    case 'keep-awake': toggleKeepAwake(); break;
    case 'share': ui.menu = false; render(); openShareMenu(); break;
    case 'share-one': if (rest()) openShareCode([rest()]); break;
    case 'share-all': if (S.restaurants.length) openShareCode(S.restaurants); break;
    case 'share-receive': if (ui.menu) { ui.menu = false; render(); } openScanner(); break;
    case 'imp-choice': chooseImport(t.dataset.c); break;
    case 'start-remove': ui.menu = false; ui.removing = true; render(); break;
    case 'cancel-remove': ui.removing = false; render(); break;
    case 'reset':
      if (confirm('Clear all plates and items and start a new bill?')) { S.bills[S.current] = { counts: {}, extras: [] }; persist(); go('bill'); }
      else { ui.menu = false; render(); }
      break;
    case 'plate': {
      if (Date.now() < lp.suppressUntil) break;   // this click is just the end of a long press
      const r = rest(), b = billOf(r.id);
      if (ui.removing) {   // stays in remove mode until Done, so several plates can be removed one by one
        if (!(b.counts[id] > 0)) return;
        b.counts[id]--; persist(); refreshPlate(id); refreshTotal();
        if (navigator.vibrate) navigator.vibrate(8);
        if (!r.plates.some(p => (b.counts[p.id] || 0) > 0)) { ui.removing = false; render(); refreshTotal(); toast('All plates removed'); }
      } else {
        b.counts[id] = (b.counts[id] || 0) + 1; persist();
        refreshPlate(id); refreshTotal();
        if (navigator.vibrate) navigator.vibrate(8);
      }
      break;
    }
    case 'add-plate-modal': openAddPlate(); break;
    case 'np-save': saveNewPlate(); break;
    case 'm-close': hideModal(); break;
    case 'm-remove': {
      const r = rest(), b = billOf(r.id);
      hideModal();
      if (b.counts[id] > 0) { b.counts[id]--; persist(); refreshPlate(id); refreshTotal(); toast('Removed one plate'); }
      break;
    }
    case 'edit-colour': {
      const i = +t.dataset.i; ccInit(ui.draft.plates[i].colour);
      showModal(`<h2>Plate colour</h2>
        <p class="m-sub">Pick a colour, or tap the rainbow circle to mix your own starting from it.</p>
        <div class="m-preview"><div class="plate" data-cc-preview style="--c:${CC.value};--ink:${inkFor(CC.value)}"><span class="n zero">0</span></div></div>
        ${ccHtml()}
        <div class="m-row"><button class="btn" data-act="m-close">Cancel</button><button class="btn primary" data-act="cc-apply" data-i="${i}">Use colour</button></div>`);
      ccRefresh(); break;
    }
    case 'cc-pick': CC.value = t.dataset.c; CC.custom = false; ccRefresh(); break;
    case 'cc-custom': CC.custom = true; ccRefresh(); break;
    case 'cc-apply': {
      const i = +t.dataset.i; ui.draft.plates[i].colour = CC.value; hideModal();
      const dot = document.querySelector(`.cdot[data-i="${i}"]`); if (dot) dot.style.setProperty('--c', CC.value);
      break;
    }
    case 'item-plus': {   // one more of this item (the drawer stays open, no message)
      const b = billOf(S.current), src = b.extras.find(x => x.id === id); if (!src) break;
      b.extras.push({ id: uid(), price: src.price, desc: src.desc });
      persist(); refreshDockItems(); refreshTotal(); break;
    }
    case 'item-minus': {  // one fewer; removing the last one says so
      const b = billOf(S.current), i = b.extras.findIndex(x => x.id === id); if (i < 0) break;
      const gone = b.extras[i], left = b.extras.filter(x => itemKey(x) === itemKey(gone)).length;
      b.extras.splice(i, 1);
      persist(); refreshDockItems(); refreshTotal();
      if (left === 1) toast(itemName(gone) + ' removed');
      break;
    }
    case 'del-extra': {
      const b = billOf(S.current); b.extras = b.extras.filter(x => x.id !== id); persist(); render(); refreshItemised(); break;
    }
    case 'add-plate':
      ui.draft.plates.push({ id: uid(), colour: SWATCHES[ui.draft.plates.length % SWATCHES.length], price: '' });
      render();
      { const inputs = document.querySelectorAll('[data-field="price"]'); inputs[inputs.length - 1]?.focus(); }
      break;
    case 'add-item':
      ui.draft.items.push({ id: uid(), desc: '', price: '' });
      render();
      { const f = document.querySelectorAll('[data-field="idesc"]'); f[f.length - 1]?.focus(); }
      break;
    case 'del-item': ui.draft.items.splice(+t.dataset.i, 1); render(); break;
    case 'pick-other': {
      if (ui.view === 'edit') {
        const i = +t.dataset.i;
        ui.draft.items[i].desc = t.dataset.desc;
        document.querySelector(`[data-field="idesc"][data-i="${i}"]`).value = t.dataset.desc;
        hideEditSuggest();
        document.querySelector(`[data-field="iprice"][data-i="${i}"]`).focus();
      } else {
        document.getElementById('xdesc').value = t.dataset.desc;
        hideSuggest();
        document.getElementById('xprice').focus();   // no price is filled in: it differs between restaurants
      }
      break;
    }
    case 'pick-item': {
      const it = (rest().items || []).find(x => x.id === id); if (!it) break;
      document.getElementById('xdesc').value = it.desc;
      document.getElementById('xprice').value = plain(it.price, curOf(rest()));
      hideSuggest(); document.getElementById('xdesc').blur();
      break;
    }
    case 'del-plate': ui.draft.plates.splice(+t.dataset.i, 1); render(); break;
    case 'save-rest': saveDraft(); break;
    case 'del-rest':
      if (confirm(`Delete ${ui.draft.name || 'this restaurant'} and its current bill?`)) {
        S.restaurants = S.restaurants.filter(r => r.id !== ui.draft.id);
        delete S.bills[ui.draft.id];
        if (S.current === ui.draft.id) S.current = null;
        persist(); ui.draft = null; go('pick');
      }
      break;
  }
});

/* landing page pick list */
document.addEventListener('change', e => {
  if (e.target.id === 'cur-select' && ui.draft) {
    const from = ui.draft.currency, to = e.target.value;
    const conv = x => { const c = x.price.trim() ? toCents(x.price, from) : null; if (c !== null) x.price = plain(c, to); };
    ui.draft.plates.forEach(conv); ui.draft.items.forEach(conv);
    ui.draft.currency = to; render(); return;
  }
  if (e.target.id !== 'rest-select') return;
  const v = e.target.value;
  if (v === '__new') startDraft(null);
  else if (v === '__receive') { e.target.value = ''; openScanner(); }
  else if (S.restaurants.some(r => r.id === v)) { S.current = v; persist(); go('bill'); }
});

/* editor inputs: update draft without re-rendering (keeps keyboard open) */
document.addEventListener('input', e => {
  if (e.target.id === 'xdesc') { showSuggest(); return; }
  if (e.target.id === 'cc-h' || e.target.id === 'cc-s' || e.target.id === 'cc-l') {
    CC.value = hslToHex(+document.getElementById('cc-h').value, +document.getElementById('cc-s').value, +document.getElementById('cc-l').value);
    CC.custom = true; ccRefresh('hsl'); return;
  }
  if (e.target.id === 'cc-hex') {
    let v = e.target.value.trim(); if (v && v[0] !== '#') v = '#' + v;
    if (/^#[0-9a-f]{6}$/i.test(v)) { CC.value = v.toLowerCase(); CC.custom = true; ccRefresh('hex'); }
    return;
  }
  const f = e.target.dataset.field; if (!f || !ui.draft) return;
  const i = +e.target.dataset.i, v = e.target.value;
  if (f === 'name') ui.draft.name = v;
  else if (f === 'idesc') { ui.draft.items[i].desc = v; showEditSuggest(e.target); }
  else if (f === 'iprice') ui.draft.items[i].price = v;
  else ui.draft.plates[i][f] = v;
});

/* add non-plate item */
document.addEventListener('submit', e => {
  if (e.target.id !== 'extra-form') return;
  e.preventDefault();
  const priceEl = document.getElementById('xprice'), descEl = document.getElementById('xdesc');
  const c = toCents(priceEl.value, curOf(rest()));
  if (c === null || c === 0) { priceEl.focus(); priceEl.style.borderColor = 'var(--danger)'; return; }
  const desc = descEl.value.trim(), r = rest();
  billOf(r.id).extras.push({ id: uid(), price: c, desc });
  // a new description is remembered on this restaurant's menu, or its saved price updated (quietly)
  if (desc) {
    r.items ||= [];
    const existing = r.items.find(i => i.desc.toLowerCase() === desc.toLowerCase());
    if (!existing) r.items.push({ id: uid(), desc, price: c });
    else if (existing.price !== c) existing.price = c;
  }
  persist();
  priceEl.value = ''; descEl.value = ''; priceEl.style.borderColor = '';
  setDock(false);
  refreshDockItems();
  refreshTotal();
  toast((desc || 'Other item') + ' added');
});

