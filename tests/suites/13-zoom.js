// Zoom: choosing how many plates across (2 to 6) by pinching the plates or from the menu.
const { open, sample, stateWith, wait } = require('../lib/harness');

// a pretend touch event with fingers at the given points, aimed at an element
function touch(a, type, target, points) {
  const w = a.window, e = new w.Event(type, { bubbles: true, cancelable: true });
  const touches = points.map(([x, y], i) => ({ identifier: i, clientX: x, clientY: y, target }));
  Object.defineProperty(e, 'touches', { value: touches });
  target.dispatchEvent(e);
  return e;
}
// two fingers start `from` px apart and end `to` px apart, on the given element
function pinch(a, target, from, to, lift = true) {
  touch(a, 'touchstart', target, [[100, 300]]);
  touch(a, 'touchstart', target, [[100, 300], [100 + from, 300]]);
  const steps = 6;
  let moved;
  for (let i = 1; i <= steps; i++) moved = touch(a, 'touchmove', target, [[100, 300], [100 + from + (to - from) * i / steps, 300]]);
  if (lift) { touch(a, 'touchend', target, [[100, 300]]); touch(a, 'touchend', target, []); }
  return moved;
}
const across = a => a.$('.plates').style.getPropertyValue('--cols');

exports.run = async t => {
  let a = await open({ state: stateWith([sample()]) });
  a.ev("go('bill')");
  t.check('not set at first: the screen picks for itself', !a.$('.plates').classList.contains('cols'));
  t.eq('nothing saved at first', a.saved().cols, undefined);

  // pinching in (fingers closer) gives more, smaller plates
  const grid = () => a.$('.scroll.fit');
  let mv = pinch(a, a.$('.plate-btn[data-id="p1"]'), 200, 100);
  t.eq('pinch in: 4 across', across(a), '4');
  t.check('the grid uses the chosen number', a.$('.plates').classList.contains('cols'));
  t.check('the browser is told not to zoom the page', mv.defaultPrevented);
  t.eq('saved when the fingers lift', a.saved().cols, 4);

  // a pinch never changes the bill, and the tap that may follow lifting the fingers is ignored
  a.act('plate', 'p1');
  t.eq('no plate added by the pinch', a.ev('billOf("r1").counts.p1 || 0'), 0);
  await wait(550);
  a.act('plate', 'p1');
  t.eq('a normal tap afterwards still adds one', a.ev('billOf("r1").counts.p1'), 1);

  // pinching out (fingers apart) gives fewer, bigger plates
  pinch(a, grid(), 100, 200);
  t.eq('pinch out: back to 2', across(a), '2');
  pinch(a, grid(), 100, 300);
  t.eq('never fewer than 2', across(a), '2');
  pinch(a, grid(), 300, 20);
  t.eq('never more than 6', across(a), '6');
  t.eq('6 saved', a.saved().cols, 6);

  // small finger wobbles don't flip back and forth
  pinch(a, grid(), 200, 190);
  t.eq('a tiny movement changes nothing', across(a), '6');

  // a long press is cancelled by a second finger
  a.ev('ui.removing = false');
  touch(a, 'touchstart', a.$('.plate-btn[data-id="p2"]'), [[100, 300], [200, 300]]);
  t.eq('no long-press timer during a pinch', a.ev('lp.timer'), null);
  touch(a, 'touchend', a.$('.plate-btn[data-id="p2"]'), []);
  await wait(700);
  t.check('no "Remove one plate?" after a pinch', !a.$('#modal') || !/Remove one plate/.test(a.text('#modal')));

  // remembered: opening the app again, and in a different restaurant
  a.close();
  const two = stateWith([sample(), sample({ id: 'r2', name: 'Sushi Hub' })]);
  a = await open({ state: Object.assign(two, { cols: 3 }) });
  a.ev("go('bill')");
  t.eq('remembered after reopening', across(a), '3');
  a.ev("S.current = 'r2'; go('bill')");
  t.eq('same setting in another restaurant', across(a), '3');
  t.eq('rows sized for 3 across (4 slots = 2 rows)', a.$('.plates').style.getPropertyValue('--rows'), '2');

  // the Zoom option in the menu
  a.act('menu');
  t.check('Zoom is in the menu', /Zoom/.test(a.text('.menu')));
  t.check('shows how many across', /3 plates across/.test(a.text('.menu')));
  a.act('zoom-in');
  t.eq('+ gives bigger plates (fewer across)', a.saved().cols, 2);
  t.check('menu stays open to keep adjusting', !!a.$('.menu'));
  t.check('+ is greyed out at 2', a.$('[data-act="zoom-in"]').disabled);
  a.act('zoom-out'); a.act('zoom-out'); a.act('zoom-out'); a.act('zoom-out');
  t.eq('− gives smaller plates, up to 6', a.saved().cols, 6);
  t.check('− is greyed out at 6', a.$('[data-act="zoom-out"]').disabled);
  t.eq('the grid follows the menu', across(a), '6');
  a.act('menu-close');

  // pinching elsewhere is left to the browser
  const outside = pinch(a, a.$('.total'), 200, 100);
  t.check('a pinch on the total is not taken over', !outside.defaultPrevented);
  t.eq('and does not change the plates', across(a), '6');
  const onDrawer = pinch(a, a.$('#dock'), 200, 100);
  t.check('nor a pinch on the drawer', !onDrawer.defaultPrevented);
  t.eq('no errors', a.errors, []);
  a.close();

  // the one-off tip, the first time a bill is opened from the pick list
  a = await open({ state: stateWith([sample()]) });
  a.change('#rest-select', 'r1');
  t.eq('tip shown the first time', a.text('#toast'), 'Tip: pinch the plates to make them bigger or smaller');
  t.eq('and remembered', a.saved().zoomTip, true);
  a.ev("go('pick')"); a.ev("document.getElementById('toast').textContent = ''");
  a.change('#rest-select', 'r1');
  t.eq('not shown again', a.text('#toast'), '');

  t.eq('no errors', a.errors, []);
  a.close();
};
