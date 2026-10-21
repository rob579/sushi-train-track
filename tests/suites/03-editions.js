const { open, sample, stateWith, plate } = require('../lib/harness');
const many = n => sample({ plates: Array.from({ length: n }, (_, i) => plate('q' + i, '#e5484d', 100 + i)) });
exports.run = async t => {
  // the website is fully unlocked by default
  let a = await open({ state: stateWith([sample()]) });
  t.eq('website: premium', a.ev('isPremium()'), true);
  a.close();

  // ?edition=free pretends to be the free tier; ?edition=reset undoes it
  a = await open({ search: '?edition=free', state: stateWith([sample()]) });
  t.eq('preview free: not premium', a.ev('isPremium()'), false);
  a.close();
  a = await open({ search: '?edition=reset', session: { 'stt-edition': 'free' } });
  t.eq('reset goes back to normal', a.ev('isPremium()'), true);
  a.close();

  // free tier: second restaurant is blocked and shows the upgrade sheet
  a = await open({ search: '?edition=free', state: stateWith([sample()]) });
  a.ev("go('bill')"); a.act('menu'); a.act('new');
  t.check('upgrade sheet appears for a 2nd restaurant', !!a.$('#upgrade'));
  t.check('sheet explains why', a.text('.up-why').includes('restaurants'), a.text('.up-why'));
  a.act('up-close');
  t.check('"Not now" closes the sheet', !a.$('#upgrade'));
  a.close();

  // free tier: plates after the 5th are locked, not deleted
  a = await open({ search: '?edition=free', state: stateWith([many(7)]) });
  a.ev("go('bill')");
  t.eq('5 usable plates', a.$$('.plate-btn[data-act="plate"]').length, 5);
  t.eq('2 locked plates', a.$$('.plate-btn.locked').length, 2);
  t.eq('nothing deleted from the saved data', a.S().restaurants[0].plates.length, 7);
  a.click('.plate-btn.locked');
  t.check('tapping a locked plate offers Premium', !!a.$('#upgrade'));
  a.close();

  // free tier: cannot add a 6th plate in the editor
  a = await open({ search: '?edition=free', state: stateWith([many(5)]) });
  a.ev("go('bill')"); a.act('menu'); a.act('edit', 'r1'); a.act('add-plate');
  t.check('6th plate asks for Premium', !!a.$('#upgrade'));
  t.eq('editor still has 5', a.ev('ui.draft.plates.length'), 5);
  a.close();

  // free tier does not remember menu items; premium does
  for (const [search, want] of [['?edition=free', 0], ['?edition=premium', 1]]) {
    a = await open({ search, state: stateWith([sample()]) });
    a.ev("go('bill')"); a.act('dock-toggle');
    a.type('#xdesc', 'Green tea'); a.type('#xprice', '3'); a.submit('#extra-form');
    t.eq(`${search}: saved menu items`, a.S().restaurants[0].items.length, want);
    a.close();
  }

  // inside the Play app: free until bought; the purchase flag decides
  a = await open({ search: '?app=play', state: stateWith([sample()]) });
  t.eq('play app starts free', a.ev('isPremium()'), false);
  t.eq('play app label', a.ev('editionLabel()'), 'Free');
  a.close();
  a = await open({ search: '?app=play', state: stateWith([sample()]), storage: { 'plateTally.entitlement.v1': JSON.stringify({ purchased: true }) } });
  t.eq('play app with saved purchase is premium', a.ev('isPremium()'), true);
  a.close();
  a = await open({ search: '?app=play&edition=premium', state: stateWith([sample()]) });
  t.eq('?edition is ignored inside the play app', a.ev('isPremium()'), false);
  a.close();
  a = await open({ referrer: 'android-app://com.robsofficetips.sushitraintrack/', state: stateWith([sample()]) });
  t.eq('android-app referrer counts as the play app', a.ev('IN_PLAY_APP'), true);
  a.close();
};
