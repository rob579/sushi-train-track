/* ============ currency and number formatting ============
   Every restaurant has its own currency. Prices are stored as hundredths of the main unit
   (so 4.80 is 480, and 450 yen is 45000) and shown through Intl, so the symbol, its position and the
   decimal/thousands marks follow the phone's language and region. */
const LOCALE = (() => {   // the phone's language tag, ignoring anything the browser cannot use
  for (const l of [...(navigator.languages || []), navigator.language]) {
    try { if (l) return Intl.getCanonicalLocales(l)[0]; } catch {}
  }
  return 'en-US';
})();
const REGION_CURRENCY = {
  AU:'AUD', NZ:'NZD', US:'USD', CA:'CAD', GB:'GBP', IE:'EUR', DE:'EUR', FR:'EUR', ES:'EUR', IT:'EUR', NL:'EUR', BE:'EUR',
  AT:'EUR', PT:'EUR', FI:'EUR', GR:'EUR', LU:'EUR', SK:'EUR', SI:'EUR', EE:'EUR', LV:'EUR', LT:'EUR', MT:'EUR', CY:'EUR', HR:'EUR',
  JP:'JPY', CN:'CNY', HK:'HKD', TW:'TWD', KR:'KRW', SG:'SGD', MY:'MYR', TH:'THB', ID:'IDR', PH:'PHP', VN:'VND', IN:'INR',
  CH:'CHF', SE:'SEK', NO:'NOK', DK:'DKK', PL:'PLN', CZ:'CZK', HU:'HUF', AE:'AED', SA:'SAR', IL:'ILS', TR:'TRY', ZA:'ZAR',
  BR:'BRL', MX:'MXN', AR:'ARS', CL:'CLP', CO:'COP', PE:'PEN'
};
const CURRENCIES = ['AED','ARS','AUD','BRL','CAD','CHF','CLP','CNY','COP','CZK','DKK','EUR','GBP','HKD','HUF','IDR','ILS','INR',
  'JPY','KRW','MXN','MYR','NOK','NZD','PEN','PHP','PLN','SAR','SEK','SGD','THB','TRY','TWD','USD','VND','ZAR'];
function defaultCurrency(){
  let region = '';
  try { region = new Intl.Locale(LOCALE).maximize().region || ''; } catch {}
  return REGION_CURRENCY[region] || 'USD';
}
/* Short symbols (€, ¥, £) are used wherever there is one. Some locales, such as Australian English, would
   otherwise spell foreign currencies as codes ("EUR 3.00"). Dollar currencies other than the phone's own,
   and the yuan, keep a longer form ("US$", "CN¥") because a bare "$" or "¥" would be ambiguous. */
const _nf = {};
const mkNf = (cur, display) => {
  try { return new Intl.NumberFormat(LOCALE, { style: 'currency', currency: cur, currencyDisplay: display }); }
  catch { return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', currencyDisplay: display }); }
};
/* if a locale still spells a currency as its bare code, use the conventional symbol instead */
const SYMBOL_FALLBACK = { USD:'US$', CAD:'CA$', NZD:'NZ$', AUD:'A$', HKD:'HK$', SGD:'S$', TWD:'NT$', MXN:'MX$', CNY:'CN¥', EUR:'€', GBP:'£',
  JPY:'¥', KRW:'₩', INR:'₹', ILS:'₪', VND:'₫', PHP:'₱', THB:'฿', BRL:'R$', TRY:'₺', PLN:'zł', CZK:'Kč', SEK:'kr', NOK:'kr', DKK:'kr' };
function withFallback(f, cur){
  const sym = SYMBOL_FALLBACK[cur], part = f.formatToParts(0).find(x => x.type === 'currency');
  if (!sym || !part || part.value !== cur) return f;
  const tight = !/\p{L}$/u.test(sym);   // "US$4.80" and "€4.80" read better without the gap that goes with "USD 4.80"
  const swap = parts => parts.flatMap((p, i) => p.type === 'currency' ? [{ ...p, value: sym }]
    : (tight && p.type === 'literal' && i > 0 && parts[i - 1].type === 'currency' && /^\s+$/.test(p.value)) ? [] : [p]);
  return { format: v => swap(f.formatToParts(v)).map(p => p.value).join(''), formatToParts: v => swap(f.formatToParts(v)), resolvedOptions: () => f.resolvedOptions() };
}
const narrowOf = cur => { const p = mkNf(cur, 'narrowSymbol').formatToParts(0).find(x => x.type === 'currency'); return p ? p.value : cur; };
function nf(cur){
  if (_nf[cur]) return _nf[cur];
  const home = defaultCurrency(), narrow = narrowOf(cur);
  const ambiguous = cur !== home && (narrow === '$' || narrow === narrowOf(home) || cur === 'CNY');
  return (_nf[cur] = withFallback(mkNf(cur, ambiguous ? 'symbol' : 'narrowSymbol'), cur));
}
const curOf = r => (r && r.currency) || defaultCurrency();       // restaurants saved before currencies existed
const digitsOf = cur => nf(cur).resolvedOptions().maximumFractionDigits === 0 ? 0 : 2;
const money = (c, r = rest()) => nf(curOf(r)).format(c / 100);   // "$4.80", "4,80 €", "¥450" ...
const symOf = cur => { const p = nf(cur).formatToParts(0).find(x => x.type === 'currency'); return p ? p.value : cur; };
const symPad = cur => Math.round(20 + symOf(cur).length * 8.5);   // room for the symbol inside a price box
/* a plain number for an input box, in the phone's own style (4.80, 4,80 or 450) */
const plain = (c, cur) => new Intl.NumberFormat(LOCALE, { minimumFractionDigits: digitsOf(cur), maximumFractionDigits: digitsOf(cur),
  useGrouping: false, numberingSystem: 'latn' }).format(c / 100);
/* read what someone typed: accepts 4.50 / 4,50 / 1,234.50 / 1.234,50 / 1,200 (yen) and ignores symbols */
function toCents(v, cur){
  let t = String(v).trim();
  if (!t || /-/.test(t)) return null;
  t = t.replace(/[٠-٩]/g, d => d.charCodeAt(0) - 0x660).replace(/[۰-۹]/g, d => d.charCodeAt(0) - 0x6F0)
       .replace(/٫/g, '.').replace(/٬/g, ',').replace(/[^\d.,]/g, '');
  if (!/\d/.test(t)) return null;
  const digits = digitsOf(cur), lc = t.lastIndexOf(','), ld = t.lastIndexOf('.');
  const groups = sep => t.split(sep).slice(1).every(x => x.length === 3);
  if (lc > -1 && ld > -1) t = lc > ld ? t.replace(/\./g, '').replace(',', '.') : t.replace(/,/g, '');
  else if (lc > -1) t = (t.split(',').length > 2 || (digits === 0 && groups(','))) ? t.replace(/,/g, '') : t.replace(',', '.');
  else if (ld > -1 && (t.split('.').length > 2 || (digits === 0 && groups('.')))) t = t.replace(/\./g, '');
  const n = parseFloat(t);
  if (!isFinite(n) || n < 0) return null;
  return digits === 0 ? Math.round(n) * 100 : Math.round(n * 100);
}
function currencyOptions(sel){
  let names = null;
  try { names = new Intl.DisplayNames([LOCALE], { type: 'currency' }); } catch {}
  return [...new Set([...CURRENCIES, sel])].sort().map(c => {
    let n = ''; try { n = names ? names.of(c) : ''; } catch {}
    return `<option value="${c}"${c === sel ? ' selected' : ''}>${c}${n && n !== c ? ' · ' + esc(n) : ''}</option>`;
  }).join('');
}
const billOf = id => (S.bills[id] ||= { counts: {}, extras: [] });
function totalOf(r){
  const b = S.bills[r.id]; if (!b) return 0;
  return r.plates.reduce((s, p) => s + (b.counts[p.id] || 0) * p.price, 0) + b.extras.reduce((s, e) => s + e.price, 0);
}
function inkFor(hex){
  const n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) > 165 ? '#1b1b1b' : '#ffffff';
}
const ICON = {
  menu:'<svg viewBox="0 0 24 24" style="fill:var(--rice);stroke:none"><circle cx="12" cy="5" r="2.2"/><circle cx="12" cy="12" r="2.2"/><circle cx="12" cy="19" r="2.2"/></svg>',
  cup:'<svg viewBox="0 0 24 24"><path d="M5 10h11v4.5a4.5 4.5 0 0 1-4.5 4.5h-2A4.5 4.5 0 0 1 5 14.5z"/><path d="M16 12h1.4a2.3 2.3 0 0 1 0 4.6H16"/><path d="M8.5 4.5c0 1.4 1.4 1.4 1.4 2.8M12.5 4.5c0 1.4 1.4 1.4 1.4 2.8"/></svg>',
  back:'<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>',
  pencil:'<svg viewBox="0 0 24 24"><path d="M4 20l4-1 11-11-3-3L5 16l-1 4z"/></svg>',
};
