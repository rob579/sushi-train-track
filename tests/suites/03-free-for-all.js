// Everything is free for everyone: the website, the Play app, and phones that had the old Premium unlock.
const { open, sample, stateWith, plate } = require('../lib/harness');
const many = (id, n) => sample({ id, name: 'R' + id, plates: Array.from({ length: n }, (_, i) => plate(id + 'q' + i, '#e5484d', 100 + i)) });
const PLACES = [['website', {}], ['play app', { search: '?app=play' }], ['android referrer', { referrer: 'android-app://com.robsofficetips.sushitraintrack/' }]];

exports.run = async t => {
  for (const [where, how] of PLACES) {
    // several restaurants: the pick list, with bills in progress
    let a = await open({ ...how, state: stateWith([many('r1', 3), many('r2', 3)], { r2: { counts: { r2q0: 2 }, extras: [] } }, null) });
    const opts = a.$$('#rest-select option').map(o => o.textContent);
    t.check(`${where}: pick list shows both restaurants`, opts.some(o => o.startsWith('Rr1')) && opts.some(o => o.startsWith('Rr2')), opts);
    t.check(`${where}: pick list shows a bill in progress`, opts.some(o => o.includes('so far')), opts);
    t.check(`${where}: no Premium wording anywhere`, !/premium|unlock/i.test(a.text('#app')), a.text('#app'));
    t.check(`${where}: version label has no edition`, !/Website|Free/.test(a.text('.ver')), a.text('.ver'));
    a.close();

    // more than 5 plates all work, and more can be added
    a = await open({ ...how, state: stateWith([many('r1', 7)]) });
    a.ev("go('bill')");
    t.eq(`${where}: all 7 plates tappable`, a.$$('.plate-btn[data-act="plate"]').length, 7);
    t.eq(`${where}: nothing locked`, a.$$('.plate-btn.locked').length, 0);
    a.click(a.$$('.plate-btn[data-act="plate"]')[6]);
    t.eq(`${where}: 7th plate counts`, a.S().bills.r1.counts.r1q6, 1);
    a.act('menu');
    t.check(`${where}: menu has Switch restaurant`, !!a.$('[data-act="pick"]'));
    t.check(`${where}: menu has no upgrade entry`, !/premium|unlock/i.test(a.text('.menu')), a.text('.menu'));
    a.act('edit', 'r1'); a.act('add-plate');
    t.eq(`${where}: editor adds an 8th plate`, a.ev('ui.draft.plates.length'), 8);
    t.check(`${where}: currency is a real choice`, !!a.$('#cur-select'));
    t.check(`${where}: menu items can be added`, !!a.$('[data-act="add-item"]'));
    a.close();

    // a second restaurant can be created
    a = await open({ ...how, state: stateWith([sample()]) });
    a.ev("go('bill')"); a.act('menu'); a.act('new');
    t.eq(`${where}: new restaurant screen opens`, a.ev('ui.view'), 'edit');
    a.type('#rname', 'Second'); a.ev("ui.draft.name = 'Second'; ui.draft.plates[0].price = '3'");
    a.act('save-rest');
    t.eq(`${where}: second restaurant saved`, a.S().restaurants.length, 2);
    a.close();

    // a drink typed into the drawer is remembered as a menu item
    a = await open({ ...how, state: stateWith([sample()]) });
    a.ev("go('bill')"); a.act('dock-toggle');
    a.type('#xdesc', 'Green tea'); a.type('#xprice', '3'); a.submit('#extra-form');
    t.eq(`${where}: menu item saved`, (a.S().restaurants[0].items || []).length, 1);
    t.eq(`${where}: no page errors`, a.errors, []);
    a.close();
  }

  // a phone that had the old Premium unlock: its leftovers are tidied away, its data is untouched
  const a = await open({ search: '?app=play', state: stateWith([many('r1', 7)]), storage: {
    'plateTally.entitlement.v1': JSON.stringify({ purchased: true }), 'plateTally.acked.v1': '["tok"]', 'plateTally.pending.v1': '[]' } });
  const keys = Object.keys(a.storage());
  t.check('old purchase records removed', !keys.some(k => /entitlement|acked|pending/.test(k)), keys);
  t.eq('restaurants and plates kept', a.saved().restaurants[0].plates.length, 7);
  t.eq('no leftover purchase code', a.ev("typeof getDigitalGoodsService === 'undefined' && typeof isPremium === 'undefined' && typeof showUpgrade === 'undefined'"), true);
  a.close();
};
