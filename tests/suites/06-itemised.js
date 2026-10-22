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
  t.eq('title is the restaurant name', a.text('#modal h2'), 'Kura');
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

  // empty bill
  a.ev("S.bills.r1 = { counts: {}, extras: [] }; render()");
  a.click('.bill-head .total');
  t.check('empty bill message', a.text('#modal').includes('Nothing on the bill yet.'));
  t.eq('no page errors', a.errors, []);
  a.close();
};
