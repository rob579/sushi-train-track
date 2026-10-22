// Two-colour plates: two plate colours that cost the same, shown half and half on one plate button
const { open, sample, stateWith, plate } = require('../lib/harness');

const two = (id, c1, c2, price) => Object.assign(plate(id, c1, price), { colour2: c2 });

exports.run = async t => {
  // ---- add a plate (bill screen): price comes before the colours ----
  let a = await open({ state: stateWith([sample()]) });
  a.ev("go('bill')");
  a.act('add-plate-modal');
  const order = a.$$('#modal #np-price, #modal #cc, #modal #cc-dual, #modal .m-row').map(e => e.id || e.className);
  t.eq('price, colours, second colour, buttons', order, ['np-price', 'cc', 'cc-dual', 'm-row']);
  t.eq('offers a second colour', a.text('#cc-dual [data-act="cc-add2"]'), '+ Add second colour');
  t.check('no Remove or Split with one colour', !a.$('[data-act="cc-remove"]') && !a.$('[data-act="cc-split"]'));

  a.act('cc-add2');
  const [s1, s2] = a.ev('CC.slots');
  t.check('second colour starts on one not used yet', s2 && s2 !== s1 && !['#e5484d', '#4cb782', '#3e8ef7'].includes(s2), s2);
  t.check('preview shows both colours', a.$('[data-cc-preview]').classList.contains('two'));
  t.eq('swatches now change the second colour', a.ev('CC.active'), 1);
  t.check('Remove and Split shown', !!a.$('[data-act="cc-remove"]') && !!a.$('[data-act="cc-split"]'));

  // change each colour separately
  a.click('.cc-sw[data-c="#ec6fb0"]');
  a.click('[data-act="cc-slot"][data-i="0"]');
  t.eq('first colour selected again', a.ev('CC.active'), 0);
  a.click('.cc-sw[data-c="#f2d74a"]');
  t.eq('both colours set', a.ev('CC.slots'), ['#f2d74a', '#ec6fb0']);
  a.type('#np-price', '6');
  a.act('np-save');
  let p = a.saved().restaurants[0].plates[3];
  t.eq('saved as one plate with two colours', [p.colour, p.colour2, p.price], ['#f2d74a', '#ec6fb0', 600]);
  const btn = a.$(`.plate[data-plate="${p.id}"]`);
  t.check('plate button is half and half', btn.classList.contains('two') && btn.getAttribute('style').includes('--c2:#ec6fb0'), btn.getAttribute('style'));
  t.check('says both colours to screen readers', a.$(`.plate-btn[data-id="${p.id}"]`).getAttribute('aria-label').includes('#f2d74a and #ec6fb0'));

  // tapping counts it, and the itemised bill chip shows both colours
  a.act('plate', p.id); a.act('plate', p.id);
  t.eq('two taken', a.S().bills.r1.counts[p.id], 2);
  t.eq('total', a.text('#total').replace(/[^\d.]/g, ''), '12.00');
  a.act('itemised');
  t.check('chip has both colours', a.$$('#modal .line .chip')[0].getAttribute('style').includes('linear-gradient'));
  a.act('m-close');

  // a colour already used by another plate (first or second) is refused
  a.act('add-plate-modal');
  a.click('.cc-sw[data-c="#e5484d"]');
  a.act('cc-add2');
  a.click('.cc-sw[data-c="#ec6fb0"]');
  a.type('#np-price', '5');
  a.act('np-save');
  t.check('second colour clash refused', a.text('#np-err').includes('already have a plate in this colour'), a.text('#np-err'));

  // Remove the first colour: the second becomes the only colour
  a.click('[data-act="cc-slot"][data-i="0"]');
  a.act('cc-remove');
  t.eq('one colour left', a.ev('CC.slots'), ['#ec6fb0', null]);
  t.check('back to "Add second colour"', !!a.$('[data-act="cc-add2"]'));
  a.act('m-close');

  // Split while adding: two separate plates at the same price
  a.act('add-plate-modal');
  a.click('.cc-sw[data-c="#2bb5b0"]');
  a.act('cc-add2');
  a.click('.cc-sw[data-c="#a2673a"]');
  a.type('#np-price', '7');
  a.act('cc-split');
  let pl = a.saved().restaurants[0].plates;
  t.eq('two plates added', pl.slice(4).map(x => [x.colour, x.colour2 || null, x.price]), [['#2bb5b0', null, 700], ['#a2673a', null, 700]]);
  t.eq('message', a.text('#toast'), 'Two plates added');
  t.eq('no errors', a.errors, []);
  a.close();

  // ---- setup screen: the plate colour modal ----
  const rest = sample({ plates: [plate('p1', '#e5484d', 350), two('p2', '#4cb782', '#ffffff', 450)] });
  a = await open({ state: stateWith([rest], { r1: { counts: { p1: 1, p2: 3 }, extras: [] } }) });
  a.ev("startDraft('r1')");
  t.check('setup dot shows both colours', a.$('.cdot[data-i="1"]').getAttribute('style').includes('linear-gradient'));
  a.click('[data-act="edit-colour"][data-i="0"]');
  t.check('second colour offered here too', !!a.$('#modal [data-act="cc-add2"]'));
  a.act('cc-add2');
  t.eq('button says colours', a.text('#cc-apply-btn'), 'Use colours');
  a.click('.cc-sw[data-c="#8b5cf6"]');
  a.click('[data-act="cc-apply"]');
  t.eq('draft has two colours', a.ev('[ui.draft.plates[0].colour, ui.draft.plates[0].colour2]'), ['#e5484d', '#8b5cf6']);
  t.eq('not saved yet', a.saved().restaurants[0].plates[0].colour2, undefined);

  // split p2 into two plates
  a.click('[data-act="edit-colour"][data-i="1"]');
  t.check('opens showing both', a.$('[data-cc-preview]').classList.contains('two'));
  a.act('cc-split');
  t.eq('two rows now', a.ev('ui.draft.plates.map(p => [p.colour, p.colour2, p.price])'),
    [['#e5484d', '#8b5cf6', '3.50'], ['#4cb782', null, '4.50'], ['#ffffff', null, '4.50']]);
  a.act('save-rest');
  pl = a.saved().restaurants[0].plates;
  t.eq('saved', pl.map(x => [x.colour, x.colour2 || null, x.price]), [['#e5484d', '#8b5cf6', 350], ['#4cb782', null, 450], ['#ffffff', null, 450]]);
  t.check('no colour2 kept on one-colour plates', !('colour2' in pl[1]));
  t.eq('counts stay with the first colour', a.saved().bills.r1.counts, { p1: 1, p2: 3 });
  t.eq('no errors', a.errors, []);
  a.close();

  // the same colour twice counts as one colour
  a = await open({ state: stateWith([sample()]) });
  a.ev("startDraft('r1')");
  a.click('[data-act="edit-colour"][data-i="0"]');
  a.act('cc-add2'); a.click('.cc-sw[data-c="#e5484d"]');
  a.click('[data-act="cc-apply"]');
  t.eq('repeated colour dropped', a.ev('ui.draft.plates[0].colour2'), null);
  a.close();

  // ---- sharing ----
  a = await open({ state: stateWith([sample({ plates: [two('p1', '#e5484d', '#ffffff', 350), plate('p2', '#4cb782', 450)] })]) });
  const json = a.ev("shareJson([rest()])");
  t.check('second colour goes in the code', json.includes('["e5484d",350,"ffffff"]'), json);
  const back = a.ev(`parseShare(${JSON.stringify(json)})`);
  t.eq('reads back', back.list[0].plates.map(x => [x.colour, x.colour2 || null]), [['#e5484d', '#ffffff'], ['#4cb782', null]]);
  t.check('bad second colour refused', !!a.ev(`parseShare('{"v":1,"r":[{"n":"X","c":"USD","p":[["e5484d",350,"zz"]]}]}')`).error);
  a.close();

  // receiving: replace keeps a bill's count when a colour matches; merge skips plates that share a colour
  const mine = sample({ plates: [plate('p1', '#e5484d', 350), plate('p2', '#4cb782', 450)] });
  const theirs = '{"v":1,"r":[{"n":"Kura","c":"USD","p":[["ffffff",400,"e5484d"],["4cb782",500],["3e8ef7",600,"f2d74a"]]}]}';
  a = await open({ state: stateWith([mine], { r1: { counts: { p1: 2, p2: 1 }, extras: [] } }) });
  a.ev(`beginImport(parseShare('${theirs}').list)`);
  a.click('[data-act="imp-choice"][data-c="replace"]');
  pl = a.S().restaurants[0].plates;
  t.eq('replace takes theirs', pl.map(x => [x.colour, x.colour2 || null, x.price]), [['#ffffff', '#e5484d', 400], ['#4cb782', null, 500], ['#3e8ef7', '#f2d74a', 600]]);
  t.eq('matching plates keep their place on the bill', pl.slice(0, 2).map(x => x.id), ['p1', 'p2']);
  t.eq('counts kept', a.S().bills.r1.counts, { p1: 2, p2: 1 });
  a.close();
  a = await open({ state: stateWith([mine]) });
  a.ev(`beginImport(parseShare('${theirs}').list)`);
  a.click('[data-act="imp-choice"][data-c="merge"]');
  pl = a.S().restaurants[0].plates;
  t.eq('merge adds only the plate with new colours', pl.map(x => [x.colour, x.colour2 || null]), [['#e5484d', null], ['#4cb782', null], ['#3e8ef7', '#f2d74a']]);
  t.eq('no errors', a.errors, []);
  a.close();
};
