const { open, sample, stateWith, plate, wait } = require('../lib/harness');

// A pretend camera and QR reader. w.showCode(text) puts a code "in front of the camera";
// the app's reader sees it on its next look. w.camLog records the camera being turned on and off.
const fakeCamera = (o = {}) => w => {
  w.camLog = []; w.inView = [];
  w.showCode = t => { w.inView = [].concat(t); };
  Object.defineProperty(w.HTMLMediaElement.prototype, 'readyState', { configurable: true, get: () => 4 });
  w.HTMLMediaElement.prototype.play = async () => {};
  if (!o.noReader) w.BarcodeDetector = class {
    static async getSupportedFormats(){ return ['qr_code', 'ean_13']; }
    async detect(){ return w.inView.map(rawValue => ({ rawValue })); }
  };
  if (o.noCamera) return;
  Object.defineProperty(w.navigator, 'mediaDevices', { configurable: true, value: {
    getUserMedia: async c => {
      if (o.deny) { const e = new Error('denied'); e.name = 'NotAllowedError'; throw e; }
      w.camLog.push('on:' + c.video.facingMode);
      return { getTracks: () => [{ stop: () => w.camLog.push('off') }] };
    },
  } });
};
const tick = () => wait(260);
// open the scanner: the landing-page link when there are no restaurants, else the pick list option
const receive = async a => {
  if (a.$('.picker [data-act="share-receive"]')) a.act('share-receive'); else if (a.$('#rest-select')) a.change('#rest-select', '__receive'); else a.ev('openScanner()');
  await wait(10);
};   // the scanner looks five times a second

const kura = () => sample({ items: [{ id: 'i1', desc: 'Green tea', price: 300 }, { id: 'i2', desc: 'Miso soup', price: 450 }] });
const hub = () => ({ id: 'r2', name: 'Sushi Hub', currency: 'AUD', items: [], plates: [plate('h1', '#f5a524', 520)] });

// what one phone would show (made inside a sender app, so it is the real code path)
async function sharedCodes(restaurants, which = 'all') {
  const a = await open({ state: stateWith(restaurants) });
  const parts = a.ev(which === 'all' ? 'shareParts(S.restaurants)' : `shareParts([S.restaurants[${which}]])`);
  a.close();
  return parts;
}

exports.run = async t => {
  // ---- the menu and the share code ----
  let a = await open({ state: stateWith([kura(), hub()]), before: fakeCamera() });
  a.ev("go('bill')");
  a.act('menu');
  t.check('Share is in the menu', !!a.$('.menu [data-act="share"]'));
  a.act('share');
  t.eq('menu closes', a.ev('ui.menu'), false);
  t.eq('three choices', a.$$('#modal .share-opt').map(b => b.dataset.act), ['share-one', 'share-all', 'share-receive']);
  t.check('says nothing goes over the internet', /Nothing is sent over the internet/.test(a.text('#modal')));
  a.act('share-one');
  t.eq('code title is the restaurant', a.text('#modal h2'), 'Kura');
  t.check('a QR code is drawn', !!a.$('#share-qr svg.qr path'));
  t.check('one restaurant fits in one code', !a.$('#qr-count'));
  t.check('says the bill is not shared', /Not your bill/.test(a.text('#modal')));
  a.act('m-close');
  t.check('closes', !a.$('#modal'));
  a.close();

  // only one restaurant: no "share all"
  a = await open({ state: stateWith([kura()]) });
  a.ev("go('bill')"); a.act('menu'); a.act('share');
  t.eq('one restaurant: no Share all', a.$$('#modal .share-opt').map(b => b.dataset.act), ['share-one', 'share-receive']);
  a.close();

  // ---- what is in a code ----
  a = await open({ state: stateWith([kura()], { r1: { counts: { p1: 4 }, extras: [{ id: 'e1', desc: 'Secret note', price: 999 }] } }) });
  const parts = a.ev('shareParts(S.restaurants)');
  t.eq('one part', parts.length, 1);
  t.check('labelled as ours', /^STT1:[0-9a-z]+:1\/1:\{/.test(parts[0]), parts[0]);
  const json = parts[0].replace(/^STT1:[^:]+:1\/1:/, '');
  t.eq('compact content', JSON.parse(json), { v: 1, r: [{ n: 'Kura', c: 'USD', p: [['e5484d', 350], ['4cb782', 450], ['3e8ef7', 600]], i: [['Green tea', 300], ['Miso soup', 450]] }] });
  t.check('the bill is not in it', !/Secret|999/.test(parts[0]));
  a.close();

  // non-English names travel as plain ASCII and come back exactly
  const jp = sample({ id: 'j', name: 'くら寿司 Café', currency: 'JPY', items: [{ id: 'x', desc: '緑茶 🍵', price: 18000 }] });
  const jpParts = await sharedCodes([jp]);
  t.check('code text is plain ASCII', /^[\x20-\x7e]*$/.test(jpParts.join('')));

  // a big share is split, and each code has a sensible size
  const many = Array.from({ length: 12 }, (_, k) => sample({ id: 'm' + k, name: 'Restaurant number ' + k, currency: 'AUD',
    plates: ['#e5484d', '#f5a524', '#f2d74a', '#4cb782', '#3e8ef7', '#8b5cf6', '#ec6fb0', '#2b2b2b'].map((c, i) => plate('p' + i, c, 250 + i * 50)),
    items: ['Green tea', 'Miso soup', 'Edamame', 'Asahi', 'Gyoza'].map((d, i) => ({ id: 'i' + i, desc: d, price: 300 + i * 100 })) }));
  const bigParts = await sharedCodes(many);
  t.check('split over several codes', bigParts.length > 1, bigParts.length);
  t.check('each code is small enough to scan', bigParts.every(p => p.length <= 640), bigParts.map(p => p.length));
  t.check('all parts share one set and number themselves', bigParts.every((p, i) => p.startsWith(bigParts[0].slice(0, 10)) && p.includes(`:${i + 1}/${bigParts.length}:`)));

  // the sender cycles through the codes, and stops when closed
  a = await open({ state: stateWith(many) });
  a.ev("go('bill')"); a.ev('openShareCode(S.restaurants)');
  t.eq('title for all', a.text('#modal h2'), 'All 12 restaurants');
  t.check('counter shows', /^Code 1 of \d+/.test(a.text('#qr-count')), a.text('#qr-count'));
  const first = a.$('#share-qr').innerHTML;
  await wait(1500);
  t.check('moves to the next code by itself', /^Code 2 of/.test(a.text('#qr-count')) && a.$('#share-qr').innerHTML !== first, a.text('#qr-count'));
  a.act('m-close');
  t.eq('timer stopped on close', a.ev('modalCleanup'), null);
  t.eq('no errors (sender)', a.errors, []);
  a.close();

  // ---- receiving: a new restaurant ----
  const kuraCode = await sharedCodes([kura()]);
  a = await open({ state: stateWith([]), before: fakeCamera() });
  t.check('landing page offers scanning when you have none', !!a.$('.picker [data-act="share-receive"]'));
  a.act('share-receive');
  await wait(10);
  t.eq('back camera turned on', a.window.camLog, ['on:environment']);
  t.eq('scanner title', a.text('#modal h2'), 'Receive from a friend');
  a.window.showCode('https://example.com/menu');
  await tick();
  t.eq('someone else\'s QR code is ignored', a.text('#scan-status'), "That code isn't from Sushi Train Track.");
  a.window.showCode(kuraCode);
  await tick();
  t.eq('camera turned off when read', a.window.camLog, ['on:environment', 'off']);
  t.eq('added', a.S().restaurants.map(r => r.name), ['Kura']);
  const got = a.S().restaurants[0];
  t.eq('plates and items came across', [got.currency, got.plates.map(p => [p.colour, p.price]), got.items.map(i => [i.desc, i.price])],
    ['USD', [['#e5484d', 350], ['#4cb782', 450], ['#3e8ef7', 600]], [['Green tea', 300], ['Miso soup', 450]]]);
  t.check('given new ids', got.id !== 'r1' && got.plates.every(p => !/^p\d$/.test(p.id)));
  t.eq('saved', a.saved().restaurants.length, 1);
  t.check('report says added', /Kura\s*added/.test(a.text('#modal .imp-report')), a.text('#modal'));
  a.act('m-close');
  t.check('pick list now shows it', [...a.$$('#rest-select option')].some(o => o.textContent.includes('Kura')));
  t.eq('no errors (receive)', a.errors, []);
  a.close();

  // the pick list also offers receiving
  a = await open({ state: stateWith([hub()]), before: fakeCamera() });
  a.change('#rest-select', '__receive');
  await wait(10);
  t.eq('pick list opens the scanner', a.text('#modal h2'), 'Receive from a friend');
  t.eq('pick list resets', a.$('#rest-select').value, '');
  // closing the scanner turns the camera off
  a.act('m-close');
  t.eq('camera off on cancel', a.window.camLog, ['on:environment', 'off']);
  a.close();

  // unicode round trip through a real scan
  a = await open({ state: stateWith([]), before: fakeCamera() });
  await receive(a);
  a.window.showCode(jpParts); await tick();
  t.eq('Japanese and emoji come back exactly', [a.S().restaurants[0].name, a.S().restaurants[0].items[0].desc, a.S().restaurants[0].currency], ['くら寿司 Café', '緑茶 🍵', 'JPY']);
  a.close();

  // ---- receiving a split share, codes in any order, with a stray old code in between ----
  a = await open({ state: stateWith([]), before: fakeCamera() });
  await receive(a);
  const order = bigParts.map((_, i) => i).reverse();
  a.window.showCode(bigParts[order[0]]); await tick();
  t.eq('counts what it has', a.text('#scan-status'), `Got 1 of ${bigParts.length} codes. Keep pointing at their screen.`);
  t.eq('nothing added until all are in', a.S().restaurants.length, 0);
  for (const i of order.slice(1)) { a.window.showCode(bigParts[i]); await tick(); }
  t.eq('all 12 added', a.S().restaurants.length, 12);
  t.check('report lists them', a.$$('#modal .imp-report li').length === 12);
  a.close();

  // ---- name clashes ----
  // replace: same colours keep their bill counts, others go; menu items become theirs
  const theirs = sample({ id: 'x', name: 'kura ', currency: 'USD', plates: [plate('a', '#e5484d', 380), plate('b', '#8b5cf6', 700)], items: [{ id: 'q', desc: 'Asahi', price: 900 }] });
  const theirCode = await sharedCodes([theirs]);
  const mineState = () => stateWith([kura(), hub()], { r1: { counts: { p1: 2, p2: 5 }, extras: [] } });
  a = await open({ state: mineState(), before: fakeCamera() });
  a.ev("go('bill')"); a.act('menu'); a.act('share'); await receive(a);
  t.eq('receive from the bill screen menu', a.text('#modal h2'), 'Receive from a friend');
  a.window.showCode(theirCode); await tick();
  t.eq('asks when the name is taken (ignoring case and spaces)', a.text('#modal h2'), 'You already have “Kura”');
  t.eq('offers replace, merge, keep both', a.$$('#modal [data-act="imp-choice"]').map(b => b.dataset.c), ['replace', 'merge', 'new', 'skip']);
  t.eq('single: the last button is Cancel', a.text('#modal .m-row .btn').trim(), 'Cancel');
  t.check('compares the two', /3 plates · 2 menu items · USD/.test(a.text('.clash-cmp')) && /2 plates · 1 menu item · USD/.test(a.text('.clash-cmp')), a.text('.clash-cmp'));
  a.click('#modal [data-c="replace"]');
  let k = a.S().restaurants.find(r => r.id === 'r1');
  t.eq('replace: keeps your name and place', [a.S().restaurants.length, k.name], [2, 'Kura']);
  t.eq('replace: their plates', k.plates.map(p => [p.colour, p.price]), [['#e5484d', 380], ['#8b5cf6', 700]]);
  t.eq('replace: same colour keeps its id', k.plates[0].id, 'p1');
  t.eq('replace: bill keeps the count for that colour only', a.S().bills.r1.counts, { p1: 2 });
  t.eq('replace: their menu items', k.items.map(i => i.desc), ['Asahi']);
  t.check('replace: reported', /Kura\s*replaced/.test(a.text('#modal .imp-report')));
  t.eq('replace: on the bill screen the total follows', a.text('#total').replace(/[^\d.]/g, ''), '7.60');
  a.close();

  // merge: yours stay, missing ones are added
  a = await open({ state: mineState(), before: fakeCamera() });
  await receive(a);
  a.window.showCode(theirCode); await tick();
  a.click('#modal [data-c="merge"]');
  k = a.S().restaurants.find(r => r.id === 'r1');
  t.eq('merge: your prices stay, new colour added', k.plates.map(p => [p.colour, p.price]), [['#e5484d', 350], ['#4cb782', 450], ['#3e8ef7', 600], ['#8b5cf6', 700]]);
  t.eq('merge: new menu item added', k.items.map(i => i.desc), ['Green tea', 'Miso soup', 'Asahi']);
  t.eq('merge: bill untouched', a.S().bills.r1.counts, { p1: 2, p2: 5 });
  t.check('merge: reported', /merged: 1 plate and 1 menu item added/.test(a.text('#modal .imp-report')), a.text('#modal .imp-report'));
  a.close();

  // keep both
  a = await open({ state: mineState(), before: fakeCamera() });
  await receive(a);
  a.window.showCode(theirCode); await tick();
  t.check('keep both names the copy', /Add theirs as “kura \(2\)”/.test(a.text('#modal')), a.text('#modal'));
  a.click('#modal [data-c="new"]');
  t.eq('keep both: added as a copy', a.S().restaurants.map(r => r.name), ['Kura', 'Sushi Hub', 'kura (2)']);
  t.eq('keep both: yours untouched', a.S().restaurants[0].plates.length, 3);
  a.close();

  // cancel
  a = await open({ state: mineState(), before: fakeCamera() });
  await receive(a);
  a.window.showCode(theirCode); await tick();
  a.click('#modal [data-c="skip"]');
  t.eq('cancel: nothing changed', a.saved().restaurants.map(r => r.plates.length), [3, 1]);
  t.eq('cancel: says so', a.text('#toast'), 'Nothing was changed');
  t.check('cancel: modal closed', !a.$('#modal'));
  a.close();

  // different currency: no merge
  const yen = sample({ id: 'y', name: 'Kura', currency: 'JPY', plates: [plate('a', '#e5484d', 15000)] });
  a = await open({ state: mineState(), before: fakeCamera() });
  await receive(a);
  a.window.showCode(await sharedCodes([yen])); await tick();
  t.eq('different currency: merge not offered', a.$$('#modal [data-act="imp-choice"]').map(b => b.dataset.c), ['replace', 'new', 'skip']);
  t.check('different currency: explains why', /yours is in USD and theirs is in JPY/.test(a.text('#modal')));
  a.close();

  // several clashes in one share: "do the same for the rest", plus one new restaurant
  const share3 = [sample({ id: 'a', name: 'Kura', currency: 'USD', plates: [plate('a', '#ffffff', 100)] }),
    { id: 'b', name: 'Sushi Hub', currency: 'AUD', items: [], plates: [plate('b', '#ffffff', 200)] },
    { id: 'c', name: 'Sakura', currency: 'AUD', items: [], plates: [plate('c', '#000000', 300)] }];
  const code3 = await sharedCodes(share3);
  a = await open({ state: mineState(), before: fakeCamera() });
  await receive(a);
  a.window.showCode(code3); await tick();
  t.check('asks first about Kura', /Kura/.test(a.text('#modal h2')));
  t.check('offers to do the same for the other one', /Do the same for the other 1 restaurant you already have/.test(a.text('.clash-all')), a.text('#modal'));
  t.eq('more to come: Skip this one', a.text('#modal .m-row .btn').trim(), 'Skip this one');
  a.$('#imp-all').checked = true;
  a.click('#modal [data-c="merge"]');
  t.eq('both merged, the new one added, no second question', a.S().restaurants.map(r => [r.name, r.plates.length]), [['Kura', 4], ['Sushi Hub', 2], ['Sakura', 1]]);
  t.eq('report has all three', a.$$('#modal .imp-report li').length, 3);
  a.close();

  // skip one, answer the other separately
  a = await open({ state: mineState(), before: fakeCamera() });
  await receive(a);
  a.window.showCode(code3); await tick();
  a.click('#modal [data-c="skip"]');
  t.check('then asks about Sushi Hub', /Sushi Hub/.test(a.text('#modal h2')), a.text('#modal h2'));
  t.check('last clash: no "do the same" box', !a.$('#imp-all'));
  a.click('#modal [data-c="replace"]');
  t.eq('skip + replace + new', a.S().restaurants.map(r => [r.name, r.plates.map(p => p.price)]), [['Kura', [350, 450, 600]], ['Sushi Hub', [200]], ['Sakura', [300]]]);
  t.check('report mentions the skip', /Kura\s*skipped/.test(a.text('#modal .imp-report')));
  a.close();

  // ---- bad and unusual codes are refused politely ----
  a = await open({ state: stateWith([]) });
  const parse = j => a.ev(`parseShare(${JSON.stringify(j)})`);
  t.check('rubbish refused', !!parse('{nope').error);
  t.check('wrong shape refused', !!parse('{"v":1,"r":[{"n":"X","c":"AUD","p":[]}]}').error);
  t.check('bad colour refused', !!parse('{"v":1,"r":[{"n":"X","c":"AUD","p":[["red",1]]}]}').error);
  t.check('bad price refused', !!parse('{"v":1,"r":[{"n":"X","c":"AUD","p":[["ffffff",-5]]}]}').error);
  t.check('fractional price refused', !!parse('{"v":1,"r":[{"n":"X","c":"AUD","p":[["ffffff",1.5]]}]}').error);
  t.check('bad currency refused', !!parse('{"v":1,"r":[{"n":"X","c":"dollars","p":[["ffffff",100]]}]}').error);
  t.check('too long a name refused', !!parse(JSON.stringify({ v: 1, r: [{ n: 'x'.repeat(81), c: 'AUD', p: [['ffffff', 1]] }] })).error);
  t.check('newer version asks for an update', /newer version/.test(parse('{"v":2,"r":[]}').error));
  const tidy = parse('{"v":1,"r":[{"n":"  X  ","c":"AUD","p":[["FFFFFF",100],["ffffff",200]],"i":[["Tea",1],["tea",2]]}]}').list[0];
  t.eq('trims, lower-cases colours, drops repeats', [tidy.name, tidy.plates.map(p => [p.colour, p.price]), tidy.items.map(i => i.desc)], ['X', [['#ffffff', 100]], ['Tea']]);
  t.eq('names with markup stay as text', parse('{"v":1,"r":[{"n":"<img src=x onerror=alert(1)>","c":"AUD","p":[["ffffff",1]]}]}').list[0].name, '<img src=x onerror=alert(1)>');
  a.close();
  // markup in a received name is shown as text, never run
  a = await open({ state: stateWith([]), before: fakeCamera() });
  await receive(a);
  a.window.showCode('STT1:abcd:1/1:{"v":1,"r":[{"n":"<b id=pwn>x</b>","c":"AUD","p":[["ffffff",1]]}]}'); await tick();
  t.check('markup shown as text', !a.$('#pwn') && /<b id=pwn>x<\/b>/.test(a.text('#modal .imp-report')));
  a.close();
  // a damaged code is reported and scanning carries on
  a = await open({ state: stateWith([]), before: fakeCamera() });
  await receive(a);
  a.window.showCode('STT1:abcd:1/1:{"v":1,"r":[{"n":'); await tick();
  t.check('damaged code reported', /couldn't be read/.test(a.text('#scan-status')), a.text('#scan-status'));
  t.eq('camera still on', a.window.camLog, ['on:environment']);
  a.window.showCode(kuraCode); await tick();
  t.eq('then a good one still works', a.S().restaurants.length, 1);
  a.close();

  // ---- no camera, camera refused, no built-in reader ----
  a = await open({ state: stateWith([]), before: fakeCamera({ deny: true }) });
  await receive(a);
  t.check('refused camera explained', /isn't allowed/.test(a.text('#scan-status')), a.text('#scan-status'));
  t.check('photo option offered', !!a.$('#scan-file'));
  t.eq('no errors (refused)', a.errors, []);
  a.close();
  a = await open({ state: stateWith([]), before: fakeCamera({ noCamera: true }) });
  await receive(a);
  t.check('no camera explained', /can't use the camera/.test(a.text('#scan-status')), a.text('#scan-status'));
  a.close();
  a = await open({ state: stateWith([]), before: fakeCamera({ noReader: true }) });
  t.eq('without a built-in reader the bundled one is there', a.ev('typeof jsQR'), 'function');
  t.eq('and the code maker', a.ev('typeof qrcode'), 'function');
  a.close();
};
