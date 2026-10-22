const { open, sample, stateWith } = require('../lib/harness');
exports.run = async t => {
  const bills = { r1: { counts: { p1: 2, p3: 1 }, extras: [{ id: 'x1', desc: 'Green tea', price: 300 }, { id: 'x2', desc: '', price: 150 }] } };
  const a = await open({ state: stateWith([sample()], bills) });
  a.ev("go('bill')");

  // tapping the total opens the itemised bill as a modal over the bill screen
  t.check('total is a button', a.$('.bill-head .total').tagName === 'BUTTON');
  a.click('.bill-head .total');
  t.check('modal opens', !!a.$('#modal.itemised-modal'));
  t.eq('bill screen stays underneath', a.ev('ui.view'), 'bill');
  t.eq('title is Your meal at the restaurant', a.text('#modal h2'), 'Your meal at Kura');
  t.check('no goodbye or End meal button from the total', !a.$('#modal .enjoyed') && !a.$('#modal [data-act="end-meal-confirm"]'));
  t.eq('one line per plate colour and extra', a.$$('#modal .line').length, 4);
  t.check('plate line', a.text('#modal').includes('2 × plate'));
  t.check('unnamed extra shows Other item', a.text('#modal').includes('Other item'));
  t.eq('grand total', a.text('#modal .grand b'), a.text('#total'));
  t.eq('grand total amount', a.text('#modal .grand b').replace(/[^\d.]/g, ''), '17.50');

  // removing an extra inside the modal updates the modal and the bill behind it
  a.act('del-extra', 'x1');
  t.check('modal still open', !!a.$('#modal.itemised-modal'));
  t.eq('line gone', a.$$('#modal .line').length, 3);
  t.eq('modal total updated', a.text('#modal .grand b').replace(/[^\d.]/g, ''), '14.50');
  t.eq('bill total updated', a.text('#total').replace(/[^\d.]/g, ''), '14.50');
  t.eq('saved', a.S().bills.r1.extras.map(e => e.id), ['x2']);

  // Close and the scrim both close it
  a.click('#modal .m-row [data-act="m-close"]');
  t.check('Close closes it', !a.$('#modal'));
  a.click('.bill-head .total'); a.click('#modal .m-scrim');
  t.check('tapping outside closes it', !a.$('#modal'));

  // from the menu: same modal, menu closes
  a.act('menu');
  a.click('.menu [data-act="itemised"]');
  t.check('menu opens the same modal', !!a.$('#modal.itemised-modal'));
  t.eq('menu closed behind it', a.ev('ui.menu'), false);
  t.eq('still on the bill screen', a.ev('ui.view'), 'bill');
  a.act('m-close');

  // End meal from the menu: the same bill, with a goodbye and an End meal button
  a.act('menu');
  t.check('menu says End meal', a.$$('.menu button').some(b => b.textContent.trim() === 'End meal'));
  t.check('no Start a new bill', !a.text('.menu').includes('Start a new bill'));
  a.click('.menu [data-act="end-meal"]');
  t.check('itemised bill opens', !!a.$('#modal.itemised-modal.end-meal'));
  t.eq('menu closed behind it', a.ev('ui.menu'), false);
  t.eq('same title', a.text('#modal h2'), 'Your meal at Kura');
  t.eq('goodbye message under the title', a.text('#modal h2 + .enjoyed'), 'Hope you enjoyed your meal!');
  t.eq('End meal button at the bottom', a.text('#modal .m-row [data-act="end-meal-confirm"]'), 'End meal');
  // removing an extra keeps the goodbye and the button
  a.act('del-extra', 'x2');
  t.check('still the End meal version after a change', !!a.$('#modal .enjoyed') && !!a.$('#modal [data-act="end-meal-confirm"]'));
  // Close leaves the bill alone
  a.act('m-close');
  t.check('Close closes it', !a.$('#modal'));
  t.eq('bill kept after Close', a.S().bills.r1.counts.p1, 2);
  t.eq('still on the bill screen after Close', a.ev('ui.view'), 'bill');
  // the next plain itemised bill has no goodbye
  a.click('.bill-head .total');
  t.check('plain itemised bill afterwards', !a.$('#modal .enjoyed'));
  a.act('m-close');
  // End meal clears the bill and goes to the landing page
  a.act('menu'); a.click('.menu [data-act="end-meal"]');
  a.click('#modal [data-act="end-meal-confirm"]');
  t.check('modal gone', !a.$('#modal'));
  t.eq('landing page', a.ev('ui.view'), 'pick');
  t.eq('bill cleared', a.S().bills.r1, { counts: {}, extras: [] });
  t.check('restaurant kept', a.S().restaurants.some(r => r.id === 'r1'));
  t.check('no "so far" on the pick list', !a.text('#rest-select').includes('so far'));
  a.ev("go('bill')");

  // empty bill
  a.ev("S.bills.r1 = { counts: {}, extras: [] }; render()");
  a.click('.bill-head .total');
  t.check('empty bill message', a.text('#modal').includes('Nothing on the bill yet.'));
  t.eq('no page errors', a.errors, []);
  a.close();
};
