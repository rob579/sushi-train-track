/* ============ editing helpers ============ */
function startDraft(id){
  const r = S.restaurants.find(x => x.id === id);
  ui.draft = r
    ? { id: r.id, isNew: false, name: r.name, currency: curOf(r),
      plates: r.plates.map(p => ({ id: p.id, colour: p.colour, price: plain(p.price, curOf(r)) })),
      items: (r.items || []).map(it => ({ id: it.id, desc: it.desc, price: plain(it.price, curOf(r)) })) }
    : { id: uid(), isNew: true, name: '', currency: (isPremium() && S.lastCurrency) || defaultCurrency(),
      plates: [{ id: uid(), colour: SWATCHES[0], price: '' }], items: [] };
  ui.prevView = ui.view;
  go('edit');
}
function saveDraft(){
  const d = ui.draft;
  if (!d.name.trim()) { alert('Give the restaurant a name.'); return; }
  if (d.isNew && !isPremium() && S.restaurants.length >= FREE_RESTAURANTS) { showUpgrade('restaurants'); return; }
  const plates = [];
  for (const p of d.plates) {
    if (p.price.trim() === '') continue;               // ignore blank rows
    const c = toCents(p.price, d.currency);
    if (c === null) { alert('One of the plate prices is not a valid number.'); return; }
    plates.push({ id: p.id, colour: p.colour, price: c });
  }
  if (!plates.length) { alert('Add at least one plate with a price.'); return; }
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

