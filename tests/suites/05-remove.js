const { open, sample, stateWith, wait } = require('../lib/harness');
exports.run = async t => {
  const bills = { r1: { counts: { p1: 2, p2: 1 }, extras: [] } };
  let a = await open({ state: stateWith([sample()], bills) });
  a.ev("go('bill')");

  // remove mode: stays on until Done, one plate per tap
  a.act('menu'); a.act('start-remove');
  t.eq('remove mode on', a.ev('ui.removing'), true);
  a.act('plate', 'p1');
  t.eq('one removed', a.S().bills.r1.counts.p1, 1);
  t.eq('still in remove mode', a.ev('ui.removing'), true);
  a.act('plate', 'p3');
  t.eq('plate with none taken is unchanged', a.S().bills.r1.counts.p3 || 0, 0);
  a.act('cancel-remove');
  t.eq('Done leaves remove mode', a.ev('ui.removing'), false);
  a.act('menu'); a.act('start-remove');
  a.act('plate', 'p1'); a.act('plate', 'p2');
  t.eq('all gone: mode ends by itself', a.ev('ui.removing'), false);
  t.eq('message', a.text('#toast'), 'All plates removed');
  t.eq('total is zero', a.text('#total').replace(/[^\d.]/g, ''), '0.00');
  a.close();

  // long press (550 ms) asks first
  a = await open({ state: stateWith([sample()], { r1: { counts: { p1: 2 }, extras: [] } }) });
  a.ev("go('bill')");
  const btn = a.$('.plate-btn[data-id="p1"]');
  const Ev = a.window.PointerEvent || a.window.MouseEvent;
  btn.dispatchEvent(new Ev('pointerdown', { bubbles: true, clientX: 5, clientY: 5 }));
  await wait(650);
  t.check('long press opens the confirm', !!a.$('#modal') && a.text('#modal h2').includes('Remove one plate'), a.bodyText().slice(0, 100));
  t.eq('nothing removed yet', a.S().bills.r1.counts.p1, 2);
  btn.dispatchEvent(new Ev('pointerup', { bubbles: true }));
  btn.click();
  t.eq('the click that ends a long press is ignored', a.S().bills.r1.counts.p1, 2);
  a.act('m-close');
  t.check('Cancel closes it', !a.$('#modal'));
  btn.dispatchEvent(new Ev('pointerdown', { bubbles: true, clientX: 5, clientY: 5 }));
  await wait(650);
  a.act('m-remove', 'p1');
  t.eq('Remove one takes one off', a.S().bills.r1.counts.p1, 1);
  t.check('confirm closes', !a.$('#modal'));
  // a quick tap adds, and moving the finger cancels the press
  await wait(750);
  btn.dispatchEvent(new Ev('pointerdown', { bubbles: true, clientX: 5, clientY: 5 }));
  btn.dispatchEvent(new Ev('pointermove', { bubbles: true, clientX: 60, clientY: 5 }));
  await wait(650);
  t.check('moving the finger cancels', !a.$('#modal'));
  a.close();

  // adding a plate from the main screen (dotted +)
  a = await open({ state: stateWith([sample()]) });
  a.ev("go('bill')");
  a.act('add-plate-modal');
  t.check('add-plate dialog opens', !!a.$('#modal'));
  a.close();
};
