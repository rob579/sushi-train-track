/* ---- acknowledging purchases ----
   Google refunds a purchase that is never acknowledged (after about 3 days, and after about 3 minutes for test
   purchases). The browser Billing API cannot do this for one-time purchases, so a small server function
   (/api/acknowledge) does it, and anything that fails is remembered and retried the next time the app opens or
   comes back to the front. */
const ACKED_KEY = 'plateTally.acked.v1', PENDING_KEY = 'plateTally.pending.v1';
const readList = k => { try { const v = JSON.parse(localStorage.getItem(k)); return Array.isArray(v) ? v : []; } catch { return []; } };
const writeList = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v.slice(-10))); } catch {} };
const isAcked = t => readList(ACKED_KEY).includes(t);
function markAcked(t){ if (!isAcked(t)) writeList(ACKED_KEY, [...readList(ACKED_KEY), t]); writeList(PENDING_KEY, readList(PENDING_KEY).filter(x => x !== t)); }
function addPending(t){ if (!readList(PENDING_KEY).includes(t)) writeList(PENDING_KEY, [...readList(PENDING_KEY), t]); }
function dropPending(t){ writeList(PENDING_KEY, readList(PENDING_KEY).filter(x => x !== t)); }
async function ackOnServer(token){
  if (isAcked(token)) return true;
  let timer;
  try {
    const ctl = new AbortController(); timer = setTimeout(() => ctl.abort(), 12000);
    const res = await fetch('/api/acknowledge', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sku: PREMIUM_SKU, purchaseToken: token }), signal: ctl.signal });
    const out = await res.json().catch(() => ({}));
    if (res.ok && out.ok) { markAcked(token); return true; }
    if (out.reason === 'invalid-token' || out.reason === 'not-purchased') { dropPending(token); return false; }   // nothing to retry
  } catch {} finally { clearTimeout(timer); }
  addPending(token);   // try again later
  return false;
}
async function acknowledgePurchase(svc, token){
  if (svc && typeof svc.acknowledge === 'function') {   // some older browsers still have this; current ones do not
    try { await svc.acknowledge(token, 'onetime'); markAcked(token); return true; } catch {}
  }
  return ackOnServer(token);
}
async function retryPendingAcks(){ for (const t of readList(PENDING_KEY).slice(0, 5)) await ackOnServer(t); }

/* ask Google Play what this person owns (also restores a purchase on a new phone or after reinstalling) */
async function refreshEntitlement(){
  const svc = await getBilling(); if (!svc) return false;
  try {
    const owned = (await svc.listPurchases()).find(p => p.itemId === PREMIUM_SKU);
    if (owned && !isAcked(owned.purchaseToken)) acknowledgePurchase(svc, owned.purchaseToken);   // not waited for
    retryPendingAcks();                                                                      // and any earlier attempt that failed
    if (setPurchased(!!owned)) { hideUpgrade(); render(); }
    return !!owned;
  } catch { return ENT.purchased; }   // offline or Play unavailable: keep what we had
}
async function buyPremium(){
  if (!IN_PLAY_APP) {   // website preview: pretend the purchase worked
    PREVIEW = 'premium'; try { sessionStorage.setItem('stt-edition', 'premium'); } catch {}
    hideUpgrade(); render(); toast('Preview: Premium unlocked (no real purchase)');
    return;
  }
  const svc = await getBilling();
  if (!svc) { upgradeMsg('Purchases are not available right now. Please try again later.'); return; }
  upgradeBusy(true); upgradeMsg('');
  let response = null, bought = false;
  try {
    let price = null;
    try { const details = await svc.getDetails([PREMIUM_SKU]); price = details && details[0] && details[0].price; } catch {}
    const request = new PaymentRequest(
      [{ supportedMethods: 'https://play.google.com/billing', data: { sku: PREMIUM_SKU } }],
      { total: { label: 'Premium', amount: { currency: price ? price.currency : 'USD', value: price ? price.value : '0' } } });   // amount is ignored by Play Billing
    response = await request.show();
    const token = response.details && response.details.purchaseToken;
    if (token) {
      bought = true;
      setPurchased(true);                    // they have paid, so unlock now
      await acknowledgePurchase(svc, token); // never throws; a failure is retried later
    } else {
      upgradeBusy(false); upgradeMsg('The purchase did not complete. If you were charged, tap "Restore purchase".');
    }
  } catch (err) {
    upgradeBusy(false);
    if (!(err && err.name === 'AbortError')) upgradeMsg('The purchase did not complete. If you were charged, tap "Restore purchase".');   // an abort is just the person closing Google's dialog
  } finally {
    // always close Google's payment screen, otherwise the app stays dimmed until it is reopened
    if (response) { try { await response.complete(bought ? 'success' : 'fail'); } catch {} }
  }
  if (bought) { hideUpgrade(); render(); toast('Premium unlocked. Thank you!'); }
}

const UP_WHY = {
  restaurants: 'Premium lets you save as many restaurants as you like.',
  plates: 'Premium lets you add more than ' + FREE_PLATES + ' plates to a restaurant.',
  items: 'Premium saves your drinks and extras so you can pick them in one tap.',
  currency: 'Premium lets you choose a currency for each restaurant.',
  generic: 'Unlock everything in Sushi Train Track with one purchase.'
};
function upgradeMsg(t, ok){ const m = document.getElementById('up-msg'); if (m) { m.textContent = t; m.classList.toggle('ok', !!ok); } }
function upgradeBusy(b){ const x = document.getElementById('up-buy'); if (x) x.disabled = b; }
function hideUpgrade(){ const u = document.getElementById('upgrade'); if (u) u.remove(); }
function showUpgrade(why){
  hideUpgrade();
  const u = document.createElement('div');
  u.id = 'upgrade'; u.setAttribute('role', 'dialog'); u.setAttribute('aria-modal', 'true'); u.setAttribute('aria-labelledby', 'up-title');
  u.innerHTML = `<div class="up-scrim" data-act="up-close"></div>
    <div class="up-card">
      <h2 id="up-title">Unlock Premium</h2>
      <p class="up-why">${esc(UP_WHY[why] || UP_WHY.generic)}</p>
      <ul>
        <li>As many restaurants as you like, each with its own bill</li>
        <li>More than ${FREE_PLATES} plates per restaurant</li>
        <li>Saved menu items, with suggestions from your other restaurants</li>
        <li>A currency for each restaurant</li>
        <li>A quick restaurant picker that shows bills in progress</li>
      </ul>
      <p class="muted small">One-time purchase. No ads and no subscription.</p>
      <div id="up-msg" class="up-msg" role="status"></div>
      <button class="btn primary big" id="up-buy" data-act="up-buy"><span id="up-buy-label">Unlock Premium</span></button>
      <div class="up-row"><button class="btn" data-act="up-restore">Restore purchase</button><button class="btn" data-act="up-close">Not now</button></div>
      ${IN_PLAY_APP ? '' : '<p class="muted small">Preview: on the website everything is unlocked. The real purchase happens in the Android app.</p>'}
    </div>`;
  document.body.appendChild(u);
  document.getElementById('up-buy').focus({ preventScroll: true });
  getBilling().then(svc => svc && svc.getDetails([PREMIUM_SKU])).then(d => {   // show the real local price
    const pr = d && d[0] && d[0].price, lbl = document.getElementById('up-buy-label');
    if (pr && lbl) { try { lbl.textContent = 'Unlock Premium · ' + new Intl.NumberFormat(LOCALE, { style: 'currency', currency: pr.currency }).format(pr.value); } catch {} }
  }).catch(() => {});
}
async function restorePurchase(){
  if (!IN_PLAY_APP) { upgradeMsg('Nothing to restore in preview mode.'); return; }
  upgradeMsg('Checking with Google Play…', true);
  const owned = await refreshEntitlement();
  if (document.getElementById('upgrade')) upgradeMsg(owned ? 'Premium restored.' : 'No purchase found for this Google account.', owned);
}

