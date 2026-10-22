/* ============ config ============ */
const BUILD = '22 Oct 2026 · two-colour plates';   // shown on the landing page so you can tell which copy is running
const BUILD_ID = 'dev';   // stamped with the git commit by update.sh
const KEY = 'plateTally.v1';
const SWATCHES = ['#e5484d','#f5a524','#f2d74a','#4cb782','#3e8ef7','#8b5cf6','#e8e2d4','#2b2b2b'];

/* ============ state ============ */
const fresh = () => ({ restaurants: [], bills: {}, current: null });
function load(){ try { return Object.assign(fresh(), JSON.parse(localStorage.getItem(KEY))); } catch { return fresh(); } }
function persist(){ try { localStorage.setItem(KEY, JSON.stringify(S)); } catch {} }
let S = load();
const ui = { view: 'pick', menu: false, removing: false, dock: false, draft: null };

const uid = () => Math.random().toString(36).slice(2, 9);
const esc = s => String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const rest = () => S.restaurants.find(r => r.id === S.current);

