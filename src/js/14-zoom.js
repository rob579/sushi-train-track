/* ============ zoom: how many plates across ============ */
/* Pinch the plates, or use Zoom in the top-right menu, to choose 2 to 6 plates across.
   One setting for the whole phone (S.cols), whichever restaurant is open. Until it is set the screen
   picks for itself (2 on a phone, more on a wide screen), exactly as before.
   Only the plate area takes the pinch (touch-action in the styles). Pinching anywhere else, the
   browser's own zoom and the phone's zoom settings all work as normal. */
const COLS_MIN = 2, COLS_MAX = 6;
const clampCols = n => Math.min(COLS_MAX, Math.max(COLS_MIN, Math.round(n)));

/* how many rows the plate sizing should make room for: up to 3 fit without scrolling */
const rowsFor = (slots, cols) => Math.min(3, Math.max(1, Math.ceil(slots / cols)));

/* plates across right now: the saved choice, or what the screen chose by itself */
function colsNow(){
  if (S.cols) return S.cols;
  const g = document.querySelector('.plates');
  const tracks = g ? getComputedStyle(g).gridTemplateColumns.trim().split(/\s+/) : [];
  return tracks.length && tracks.every(t => /px$/.test(t)) ? clampCols(tracks.length) : 2;
}

/* change it in place (no redraw, so a pinch stays smooth); save = false while the fingers are still down */
function setCols(n, save = true){
  n = clampCols(n);
  const changed = n !== S.cols;
  S.cols = n;
  if (save) persist();
  const g = document.querySelector('.plates'), r = rest();
  if (g && r) {
    g.classList.add('cols');
    g.style.setProperty('--cols', n);
    g.style.setProperty('--rows', rowsFor(r.plates.length + 1, n));
  }
  return changed;
}

/* the Zoom buttons in the menu: in = bigger plates (fewer across), out = smaller plates (more across) */
function zoomStep(dir){
  const now = colsNow(), n = clampCols(now + (dir === 'in' ? -1 : 1));
  if (n === now && S.cols) return;
  setCols(n); render();
}

/* the one-off hint, the first time a restaurant's bill is opened */
function zoomTip(){
  if (S.zoomTip || ui.view !== 'bill') return;
  S.zoomTip = true; persist();
  toast('Tip: pinch the plates to make them bigger or smaller');
}

/* ---- the pinch itself ---- */
const pinch = { on: false, d0: 1, c0: 2 };
const fingerGap = t => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY) || 1;
const onPlates = el => ui.view === 'bill' && !!(el && el.closest && el.closest('.scroll.fit'));

document.addEventListener('touchstart', e => {
  if (e.touches.length < 2) return;
  lpCancel();   // a second finger is never a tap or a long press
  lp.suppressUntil = Date.now() + 500;
  if (pinch.on || e.touches.length !== 2 || ![...e.touches].every(t => onPlates(t.target))) return;
  pinch.on = true; pinch.d0 = fingerGap(e.touches); pinch.c0 = colsNow();
}, { passive: true });

document.addEventListener('touchmove', e => {
  if (!pinch.on) return;
  e.preventDefault();
  if (e.touches.length < 2) return;
  // plates follow the fingers: twice as far apart = half as many across. It steps a whole column at a
  // time, and only once the fingers are clearly past the halfway point, so it doesn't flicker.
  const want = pinch.c0 * pinch.d0 / fingerGap(e.touches), now = colsNow();
  if (Math.abs(want - now) < 0.65) return;
  if (setCols(want, false) && navigator.vibrate) navigator.vibrate(6);
}, { passive: false });

const pinchEnd = e => {
  if (e.touches.length) lp.suppressUntil = Date.now() + 500;   // the finger left behind doesn't count as a tap
  if (!pinch.on || e.touches.length >= 2) return;
  pinch.on = false;
  lp.suppressUntil = Date.now() + 500;
  if (S.cols) persist();
};
document.addEventListener('touchend', pinchEnd, { passive: true });
document.addEventListener('touchcancel', pinchEnd, { passive: true });

/* Safari's own pinch-to-zoom arrives as gesture events: keep it off the plates (it still works elsewhere) */
['gesturestart', 'gesturechange'].forEach(ev => document.addEventListener(ev, e => { if (onPlates(e.target)) e.preventDefault(); }, { passive: false }));
