/* ============ editing helpers ============ */
function startDraft(id){
  const r = S.restaurants.find(x => x.id === id);
  ui.draft = r
    ? { id: r.id, isNew: false, name: r.name, currency: curOf(r),
      plates: r.plates.map(p => ({ id: p.id, colour: p.colour, colour2: p.colour2 || null, price: plain(p.price, curOf(r)) })),
      items: (r.items || []).map(it => ({ id: it.id, desc: it.desc, price: plain(it.price, curOf(r)) })) }
    : { id: uid(), isNew: true, name: '', currency: S.lastCurrency || defaultCurrency(),
      plates: [{ id: uid(), colour: SWATCHES[0], price: '' }], items: [] };
  ui.prevView = ui.view;
  go('edit');
}
/* Sort by price (setup screen). Sorts the plates being edited, cheapest first; Save keeps it, Cancel throws it away.
   Plates with the same price keep their order. Blank or unreadable prices go to the end. */
function sortDraftPlates(){
  const d = ui.draft; if (!d) return;
  const before = d.plates.map(p => p.id);
  const key = p => { const c = p.price.trim() === '' ? null : toCents(p.price, d.currency); return c === null ? Infinity : c; };
  const sorted = d.plates.map((p, i) => ({ p, i, k: key(p) }))
    .sort((a, b) => (a.k - b.k) || (a.i - b.i))   // Infinity - Infinity is NaN, so ties fall through to the old order
    .map(x => x.p);
  if (sorted.every((p, i) => p.id === before[i])) { ui.sortUndo = null; toast('Plates are already in price order'); return; }
  d.plates = sorted;
  ui.sortUndo = { id: d.id, order: before };
  render();
  toast('Plates sorted by price', { label: 'Undo', act: 'unsort-plates' });
}
function undoSortPlates(){
  const d = ui.draft, u = ui.sortUndo;
  hideToast(); ui.sortUndo = null;
  if (!d || !u || u.id !== d.id) return;
  // put the plates back in their old order; anything added since stays at the end
  const pos = id => { const i = u.order.indexOf(id); return i < 0 ? Infinity : i; };
  d.plates = d.plates.map((p, i) => ({ p, i, k: pos(p.id) })).sort((a, b) => (a.k - b.k) || (a.i - b.i)).map(x => x.p);
  render();
}
// leaving the setup screen: an Undo still on screen would have nothing to undo
function dropSortUndo(){ if (ui.sortUndo) { ui.sortUndo = null; hideToast(); } }
function saveDraft(){
  const d = ui.draft;
  if (!d.name.trim()) { alert('Give the restaurant a name.'); return; }
  const plates = [];
  for (const p of d.plates) {
    if (p.price.trim() === '') continue;               // ignore blank rows
    const c = toCents(p.price, d.currency);
    if (c === null) { alert('One of the plate prices is not a valid number.'); return; }
    plates.push(Object.assign({ id: p.id, colour: p.colour, price: c }, p.colour2 ? { colour2: p.colour2 } : {}));
  }
  if (!plates.length) { alert('Add at least one plate with a price.'); return; }
  const seen = new Set();   // each colour belongs to one plate only
  for (const p of plates) for (const c of [p.colour, p.colour2].filter(Boolean).map(c => c.toLowerCase())) {
    if (seen.has(c)) { alert('Two plates have the same colour. Tap a circle to give one of them a different colour.'); return; }
    seen.add(c);
  }
  const items = [];
  for (const it of d.items) {
    const desc = it.desc.trim(), pr = it.price.trim();
    if (!desc && !pr) continue;
    if (!desc) { alert('Each menu item needs a description.'); return; }
    const c = toCents(pr, d.currency);
    if (c === null) { alert(`"${desc}" needs a valid price.`); return; }
    items.push({ id: it.id, desc, price: c });
  }
  const rec = { id: d.id, name: d.name.trim(), currency: d.currency, plates, items };
  S.lastCurrency = d.currency;   // the next new restaurant starts with the same currency
  const i = S.restaurants.findIndex(r => r.id === d.id);
  if (i >= 0) S.restaurants[i] = rec; else S.restaurants.push(rec);
  // tidy counts for plates that no longer exist
  const b = S.bills[d.id];
  if (b) for (const k of Object.keys(b.counts)) if (!plates.some(p => p.id === k)) delete b.counts[k];
  persist();
  ui.draft = null;
  if (d.isNew) { S.current = d.id; persist(); go('bill'); }
  else go(S.current === d.id ? 'bill' : 'pick');
}

