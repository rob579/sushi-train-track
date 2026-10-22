/* ============ keep screen awake ============ */
/* A toggle in the top-right menu. Uses the browser's Screen Wake Lock. The browser drops the lock by
   itself whenever the app is not on screen (switched away, phone locked), so it never keeps the phone
   awake in the background. When the app comes back on screen, the lock is asked for again.
   The choice is remembered on this phone (S.keepAwake). Browsers without wake lock don't show the option. */
const wakeSupported = () => 'wakeLock' in navigator;
const wake = { lock: null };

async function wakeOn(){
  if (!S.keepAwake || !wakeSupported() || wake.lock || document.visibilityState !== 'visible') return true;
  try {
    wake.lock = await navigator.wakeLock.request('screen');
    wake.lock.addEventListener('release', () => { wake.lock = null; });
    return true;
  } catch { wake.lock = null; return false; }   // e.g. battery saver is on
}
function wakeOff(){
  if (wake.lock) { const l = wake.lock; wake.lock = null; l.release().catch(() => {}); }
}
async function toggleKeepAwake(){
  S.keepAwake = !S.keepAwake; persist();
  ui.menu = false; render();
  if (S.keepAwake) toast(await wakeOn() ? 'Screen will stay on' : "Couldn't keep the screen on");
  else { wakeOff(); toast('Screen can sleep again'); }
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') wakeOn(); });
wakeOn();
