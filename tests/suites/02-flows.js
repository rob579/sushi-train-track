const { open, sample, stateWith } = require('../lib/harness');
exports.run = async t => {
  // first run: landing page, make a restaurant, tap plates, total, itemised, saved, reload
  let a = await open();
  t.check('landing shows Get started', a.bodyText().includes('Get started'));
  a.act('new');
  t.eq('editor opens', a.S && a.ev('ui.view'), 'edit');
  a.type('[data-field="name"]', 'Kura');
  a.type('[data-field="price"]', '3.50');
  a.act('add-plate');
  const prices = a.$$('[data-field="price"]');
  t.eq('second plate row added', prices.length, 2);
  a.type(prices[1], '4,50');
  a.act('save-rest');
  t.eq('goes to the bill screen', a.ev('ui.view'), 'bill');
  t.eq('restaurant saved', a.S().restaurants.map(r => [r.name, r.plates.map(p => p.price)]), [['Kura', [350, 450]]]);
  const ids = a.S().restaurants[0].plates.map(p => p.id);
  a.act('plate', ids[0]); a.act('plate', ids[0]); a.act('plate', ids[1]);
  t.eq('total after 3 taps', a.text('#total').replace(/[^\d.]/g, ''), '11.50');
  t.eq('count shown on plate', a.text(`[data-plate="${ids[0]}"] .n`), '2');
  const storage = a.storage();
  a.act('menu'); a.act('itemised');
  t.check('itemised bill lists the total', a.bodyText().includes('11.50'));
  a.close();

  a = await open({ storage });
  t.eq('bill survives a reload', a.S().bills[a.S().current].counts[ids[0]], 2);
  a.close();

  // validation
  a = await open();
  a.act('new'); a.act('save-rest');
  t.check('nameless restaurant is refused', a.window.alerts.length === 1 && a.window.alerts[0].includes('name'), a.window.alerts);
  a.type('[data-field="name"]', 'X'); a.act('save-rest');
  t.check('no priced plate is refused', a.window.alerts.length === 2, a.window.alerts);
  a.type('[data-field="price"]', 'abc'); a.act('save-rest');
  t.check('bad price is refused', a.window.alerts[2] && a.window.alerts[2].includes('valid'), a.window.alerts);
  a.close();

  // the pick list and switching restaurants (website = everything unlocked)
  const two = stateWith([sample(), sample({ id: 'r2', name: 'Sushiro' })], {}, null);
  a = await open({ state: two });
  t.check('pick list names both', a.bodyText().includes('Kura') && a.bodyText().includes('Sushiro'));
  a.change('#rest-select', 'r2');
  t.eq('choosing opens that bill', [a.ev('ui.view'), a.S().current], ['bill', 'r2']);
  a.close();

  // editing an existing restaurant keeps its bill and tidies counts of deleted plates
  a = await open({ state: stateWith([sample()], { r1: { counts: { p1: 2, p3: 1 }, extras: [] } }) });
  a.ev("go('bill')"); a.act('menu'); a.act('edit', 'r1');
  t.eq('editor shows 3 plates', a.$$('[data-field="price"]').length, 3);
  a.act('del-plate'); // removes plate 0 (p1)
  a.act('save-rest');
  t.eq('removed plate dropped from counts', Object.keys(a.S().bills.r1.counts), ['p3']);
  a.close();
};
