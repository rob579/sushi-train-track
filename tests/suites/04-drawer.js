const { open, sample, stateWith } = require('../lib/harness');
exports.run = async t => {
  const a = await open({ state: stateWith([sample()]) });
  a.ev("go('bill')");
  t.eq('handle says Menu items', a.text('.dock-tab .lbl').trim(), 'Menu items');
  t.eq('restaurant name stays in the bar', a.text('.venue').trim(), 'Kura');
  t.eq('drawer starts closed', a.ev('ui.dock'), false);
  a.act('dock-toggle');
  t.eq('opens', a.ev('ui.dock'), true);
  t.eq('handle says Close when open', a.text('.dock-tab .lbl').trim(), 'Close');
  a.act('dock-close');
  t.eq('scrim closes it', a.ev('ui.dock'), false);
  a.click('.venue');
  t.eq('tapping the bar opens it too', a.ev('ui.dock'), true);

  // adding closes the drawer, raises the total, shows a message
  a.type('#xdesc', 'Green tea'); a.type('#xprice', '3.00'); a.submit('#extra-form');
  t.eq('drawer closes after adding', a.ev('ui.dock'), false);
  t.eq('total went up', a.text('#total').replace(/[^\d.]/g, ''), '3.00');
  t.eq('message', a.text('#toast'), 'Green tea added');
  t.eq('handle shows the count', a.text('.dock-tab .lbl').trim(), 'Menu items (1)');
  t.eq('fields cleared', [a.$('#xdesc').value, a.$('#xprice').value], ['', '']);

  // same item again groups as 2 x
  a.act('dock-toggle');
  a.type('#xdesc', 'Green tea'); a.type('#xprice', '3'); a.submit('#extra-form');
  a.act('dock-toggle');
  t.check('grouped as 2 x', /2\s*[x×]\s*Green tea/i.test(a.text('#dock-items').replace(/\s+/g, ' ')), a.text('#dock-items'));
  t.eq('handle count is 2', a.text('.dock-tab .lbl').trim().replace('Close', 'Menu items (2)'), 'Menu items (2)');

  // + adds a copy quietly and keeps the drawer open
  a.window.document.getElementById('toast').textContent = '';
  const last = () => { const x = a.S().bills.r1.extras; return x[x.length - 1].id; };   // the buttons use the newest item of each group
  const id = last();
  a.act('item-plus', id);
  t.eq('plus adds one', a.S().bills.r1.extras.length, 3);
  t.eq('plus: no message', a.text('#toast'), '');
  t.eq('plus: drawer stays open', a.ev('ui.dock'), true);
  t.eq('total 9.00', a.text('#total').replace(/[^\d.]/g, ''), '9.00');

  // - removes one at a time; a message only for the last
  a.act('item-minus', last());
  a.act('item-minus', last());
  t.eq('two removed', a.S().bills.r1.extras.length, 1);
  t.check('no message until the last one', a.text('#toast') === '', a.text('#toast'));
  a.act('item-minus', last());
  t.eq('last removed', a.S().bills.r1.extras.length, 0);
  t.eq('message for the last', a.text('#toast'), 'Green tea removed');
  t.eq('minus: drawer stays open', a.ev('ui.dock'), true);
  t.eq('total back to 0', a.text('#total').replace(/[^\d.]/g, ''), '0.00');

  // blank description is allowed and shown as "Other item"; zero or missing price is refused
  a.type('#xprice', '2.50'); a.submit('#extra-form');
  t.eq('message for no description', a.text('#toast'), 'Other item added');
  a.act('dock-toggle');
  a.type('#xdesc', 'Nothing'); a.type('#xprice', '0'); a.submit('#extra-form');
  t.eq('zero price refused', a.S().bills.r1.extras.length, 1);
  t.eq('state saved', a.saved().bills.r1.extras.length, 1);
  t.eq('page had no errors', a.errors.length, 0);
  a.close();
};
