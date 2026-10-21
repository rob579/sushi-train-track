/* ============ editions: free and premium ============
   - On the website (a normal browser, or the installed website app) everything is unlocked.
   - Inside the Google Play app (it opens the site with ?app=play) the app starts on the free tier, and
     Premium is unlocked by a one-time purchase through Google Play Billing.
   - To test in a browser, add ?edition=free or ?edition=premium to the address (ignored in the Play app;
     ?edition=reset goes back to normal). */
const FREE_RESTAURANTS = 1, FREE_PLATES = 5, PREMIUM_SKU = 'premium_unlock';
const IN_PLAY_APP = (() => {
  try {
    const q = new URLSearchParams(location.search);
    if (q.get('app') === 'play' || document.referrer.startsWith('android-app://')) sessionStorage.setItem('stt-app', 'play');
    return sessionStorage.getItem('stt-app') === 'play';
  } catch { return false; }
})();
let PREVIEW = (() => {
  try {
    if (IN_PLAY_APP) return null;
    const e = new URLSearchParams(location.search).get('edition');
    if (e === 'free' || e === 'premium') sessionStorage.setItem('stt-edition', e);
    if (e === 'reset') sessionStorage.removeItem('stt-edition');
    return sessionStorage.getItem('stt-edition');
  } catch { return null; }
})();
const ENT_KEY = 'plateTally.entitlement.v1';
const ENT = { purchased: (() => { try { return JSON.parse(localStorage.getItem(ENT_KEY)).purchased === true; } catch { return false; } })() };
const isPremium = () => IN_PLAY_APP ? ENT.purchased : PREVIEW !== 'free';
const editionLabel = () => IN_PLAY_APP ? (ENT.purchased ? 'Premium' : 'Free') : PREVIEW === 'free' ? 'Free (preview)' : PREVIEW === 'premium' ? 'Premium (preview)' : 'Website';

let _billing = null;
async function getBilling(){
  if (_billing) return _billing;
  if (!IN_PLAY_APP || !('getDigitalGoodsService' in window)) return null;
  try { _billing = await window.getDigitalGoodsService('https://play.google.com/billing'); } catch { _billing = null; }
  return _billing;
}
function setPurchased(v){
  const changed = ENT.purchased !== v;
  ENT.purchased = v;
  try { localStorage.setItem(ENT_KEY, JSON.stringify({ purchased: v, at: Date.now() })); } catch {}
  return changed;
}
