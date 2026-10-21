const { open, sample, stateWith } = require('../lib/harness');
const key = (w, k, target) => target.dispatchEvent(new w.KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
const blur = (a, el) => el.dispatchEvent(new a.window.FocusEvent('focusout', { bubbles: true }));
const focus = (a, el) => el.dispatchEvent(new a.window.FocusEvent('focusin', { bubbles: true }));

const withItems = (id, name, items) => sample({ id, name, items: items.map(([desc, price], i) => ({ id: id + 'i' + i, desc, price })) });

exports.run = async t => {
  // ---- suggestions in the drawer ----
  const state = stateWith([withItems('r1', 'Kura', [['Green tea', 300]]), withItems('r2', 'Sushiro', [['Miso soup', 250], ['Green tea', 280], ['Beer', 700]])]);
  let a = await open({ state });
  a.ev("go('bill')"); a.act('dock-toggle');
  focus(a, a.$('#xdesc'));
  const buttons = () => a.$$('#suggest button').map(b => [b.dataset.act, b.dataset.desc || b.dataset.id, b.textContent.replace(/\s+/g, ' ').trim()]);
  let list = buttons();
  t.check('own menu item offered with its price', list.some(b => b[0] === 'pick-item' && b[2].includes('Green tea') && b[2].includes('3.00')), list);
  t.check('other restaurants\' items offered', list.some(b => b[0] === 'pick-other' && b[1] === 'Miso soup'), list);
  t.check('other-menu items are tagged', list.filter(b => b[0] === 'pick-other').every(b => b[2].includes('other menu')), list);
  t.check('duplicate of own item not repeated from other menu', !list.some(b => b[0] === 'pick-other' && b[1] === 'Green tea'), list);
  t.check('other-menu items show no price', list.filter(b => b[0] === 'pick-other').every(b => !/\d\.\d\d/.test(b[2])), list);
  a.type('#xdesc', 'be');
  list = buttons();
  t.eq('typing narrows the list', list.map(b => b[1]), ['Beer']);
  a.act('pick-other');   // clicking the other-menu item
  t.eq('description filled in', a.$('#xdesc').value, 'Beer');
  t.eq('price left for you to type', a.$('#xprice').value, '');
  a.type('#xprice', '7.00'); a.submit('#extra-form');
  t.check('new item is remembered on this menu', a.S().restaurants[0].items.some(i => i.desc === 'Beer' && i.price === 700));
  // own item at a new price updates the saved price quietly
  a.act('dock-toggle'); a.type('#xdesc', 'Green tea'); a.type('#xprice', '3.50'); a.submit('#extra-form');
  t.eq('saved price updated', a.S().restaurants[0].items.find(i => i.desc === 'Green tea').price, 350);
  // choosing from own menu fills the price
  a.act('dock-toggle'); focus(a, a.$('#xdesc')); a.act('pick-item', a.S().restaurants[0].items[0].id);
  t.eq('own item fills the price', a.$('#xprice').value, '3.50');
  a.close();

  // the Play app saves menu items and offers suggestions just like the website
  a = await open({ search: '?app=play', state: stateWith([withItems('r1', 'Kura', [['Green tea', 300]])]) });
  a.ev("go('bill')"); a.act('dock-toggle'); focus(a, a.$('#xdesc'));
  t.check('play app offers saved items', a.$$('#suggest [data-act="pick-item"]').length === 1, a.text('#suggest'));
  a.close();

  // ---- setup screen ----
  a = await open({ state: stateWith([sample()]) });
  a.ev("go('bill')"); a.act('menu'); a.act('edit', 'r1');
  // prices tidy up when you leave the box
  const price = a.$$('[data-field="price"]')[0];
  a.type(price, '4.8'); blur(a, price);
  t.eq('4.8 becomes 4.80', price.value, '4.80');
  t.eq('draft updated too', a.ev('ui.draft.plates[0].price'), '4.80');
  a.type(price, '4,5'); blur(a, price);
  t.eq('comma style tidied', price.value, '4.50');
  a.type(price, 'abc'); blur(a, price);
  t.eq('nonsense left alone', price.value, 'abc');
  a.type(price, '3.50');
  // Enter / Next moves on through the boxes
  const name = a.$('[data-field="name"]');
  key(a.window, 'Enter', name);
  t.eq('Enter in name goes to the first price', a.document.activeElement, a.$$('.screen input[type="text"]')[1]);
  // currency conversion keeps the amounts
  a.change('#cur-select', 'EUR');
  t.eq('currency switched in the draft', a.ev('ui.draft.currency'), 'EUR');
  a.change('#cur-select', 'JPY');
  t.eq('yen drops the decimals (3.50 rounds to 4)', a.$$('[data-field="price"]')[0].value, '4');
  a.change('#cur-select', 'USD');
  a.type(a.$$('[data-field="price"]')[0], '3.50'); a.change('#cur-select', 'EUR'); a.change('#cur-select', 'USD');
  t.check('two-decimal currencies round-trip', a.$$('[data-field="price"]')[0].value === '3.50', a.$$('[data-field="price"]')[0].value);
  // colour chooser starts from the current colour
  a.act('edit-colour'); // first plate
  t.eq('chooser starts on the plate\'s colour', a.ev('CC.value'), '#e5484d');
  a.act('cc-custom');
  t.eq('custom mixer starts from the same colour', a.$('#cc-hex').value.toLowerCase().replace('#', ''), 'e5484d');
  a.type('#cc-hex', '112233');
  t.eq('hex typed', a.ev('CC.value'), '#112233');
  a.act('cc-apply');
  t.eq('applied to the draft', a.ev('ui.draft.plates[0].colour'), '#112233');
  a.close();

  // ---- adding a plate from the main screen ----
  a = await open({ state: stateWith([sample()]) });
  a.ev("go('bill')"); a.act('add-plate-modal');
  const first = a.ev('CC.value');
  t.check('offers an unused colour first', !['#e5484d', '#4cb782', '#3e8ef7'].includes(first), first);
  a.act('np-save');
  t.check('price required', a.text('#np-err').includes('Enter the price'), a.text('#np-err'));
  a.type('#np-price', '9'); a.act('np-save');
  t.eq('plate added', a.S().restaurants[0].plates.length, 4);
  t.eq('with that price', a.S().restaurants[0].plates[3].price, 900);
  t.eq('message', a.text('#toast'), 'Plate added');
  a.act('add-plate-modal'); a.act('cc-pick'); // pick via data-c below
  a.close();
  a = await open({ state: stateWith([sample()]) });
  a.ev("go('bill')"); a.act('add-plate-modal');
  a.click('[data-act="cc-pick"][data-c="#e5484d"]'); a.type('#np-price', '2'); a.act('np-save');
  t.check('same colour twice refused', a.text('#np-err').includes('already have'), a.text('#np-err'));
  a.close();
};
