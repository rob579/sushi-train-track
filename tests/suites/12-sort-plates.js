// "Sort by price" on the setup screen
const { open, sample, stateWith, plate } = require('../lib/harness');

const prices = a => a.$$('[data-field="price"]').map(i => i.value);
const colours = a => a.ev('ui.draft.plates.map(p => p.colour)');

exports.run = async t => {
  // plates entered out of order, with a tie (two at 3.50) so we can see ties keep their order
  const rest = sample({ plates: [plate('p1', '#e5484d', 600), plate('p2', '#4cb782', 350), plate('p3', '#3e8ef7', 450), plate('p4', '#f5a623', 350)] });
  let a = await open({ state: stateWith([rest], { r1: { counts: { p1: 2, p2: 1 }, extras: [] } }) });
  a.ev("startDraft('r1')");

  t.check('button shown on the setup screen', !!a.$('[data-act="sort-plates"]'));
  t.eq('button says what it does', a.text('[data-act="sort-plates"]'), 'Sort by price');

  a.act('sort-plates');
  t.eq('cheapest first', prices(a), ['3.50', '3.50', '4.50', '6.00']);
  t.eq('same price keeps its order (green before orange)', colours(a), ['#4cb782', '#f5a623', '#3e8ef7', '#e5484d']);
  t.check('toast confirms', a.text('#toast').includes('Plates sorted by price'), a.text('#toast'));
  t.check('toast offers Undo', !!a.$('#toast [data-act="unsort-plates"]'));
  t.check('toast with Undo can be tapped', a.$('#toast').classList.contains('has-act'));
  t.eq('nothing saved yet', a.saved().restaurants[0].plates.map(p => p.id), ['p1', 'p2', 'p3', 'p4']);

  // Undo puts it back
  a.act('unsort-plates');
  t.eq('undo restores the old order', prices(a), ['6.00', '3.50', '4.50', '3.50']);
  t.check('toast goes away after Undo', !a.$('#toast').classList.contains('show'));
  a.act('unsort-plates');   // a second tap does nothing
  t.eq('second undo changes nothing', prices(a), ['6.00', '3.50', '4.50', '3.50']);

  // sort again and Save: the bill screen follows, counts stay with their colours
  a.act('sort-plates');
  a.act('save-rest');
  t.eq('saved in price order', a.saved().restaurants[0].plates.map(p => p.id), ['p2', 'p4', 'p3', 'p1']);
  t.eq('bill in progress keeps its counts', a.saved().bills.r1.counts, { p1: 2, p2: 1 });
  t.check('leaving the screen hides the Undo', !a.$('#toast').classList.contains('show'));
  t.eq('no errors', a.errors, []);
  a.close();

  // Cancel throws the sort away
  a = await open({ state: stateWith([rest]) });
  a.ev("startDraft('r1')"); a.act('sort-plates'); a.act('edit-back');
  t.eq('cancel keeps the old order', a.saved().restaurants[0].plates.map(p => p.id), ['p1', 'p2', 'p3', 'p4']);
  a.close();

  // prices typed but not yet saved are used; blank or bad prices go to the end
  a = await open({ state: stateWith([rest]) });
  a.ev("startDraft('r1')");
  a.type('[data-field="price"][data-i="0"]', '1.00');
  a.act('add-plate');                                    // blank row
  a.type('[data-field="price"][data-i="2"]', 'abc');     // unreadable
  a.act('sort-plates');
  t.eq('freshly typed price counts; blank and bad last', prices(a), ['1.00', '3.50', '3.50', 'abc', '']);
  a.close();

  // already sorted: says so, no Undo
  a = await open({ state: stateWith([sample()]) });   // 3.50, 4.50, 6.00
  a.ev("startDraft('r1')"); a.act('sort-plates');
  t.check('already in order message', a.text('#toast').includes('already in price order'), a.text('#toast'));
  t.check('no Undo when nothing moved', !a.$('#toast').classList.contains('has-act'));
  a.close();

  // one plate: nothing to sort, so no button
  a = await open({ state: stateWith([]) });
  a.ev('startDraft(null)');
  t.check('no button with a single plate', !a.$('[data-act="sort-plates"]'));
  a.act('add-plate');
  t.check('button appears with two plates', !!a.$('[data-act="sort-plates"]'));
  a.close();

  // yen (no decimals) sorts by value too
  const yen = sample({ currency: 'JPY', plates: [plate('a', '#e5484d', 50000), plate('b', '#4cb782', 15000), plate('c', '#3e8ef7', 30000)] });
  a = await open({ state: stateWith([yen]) });
  a.ev("startDraft('r1')"); a.act('sort-plates');
  t.eq('yen sorted', a.ev('ui.draft.plates.map(p => p.id)'), ['b', 'c', 'a']);
  a.close();
};
