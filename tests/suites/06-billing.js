const { open, sample, stateWith, wait } = require('../lib/harness');

// A pretend Google Play: svc is the billing service, resp the payment dialog result.
function fakePlay({ owned = [], acknowledge = false, show = 'ok', token = 'tok-1', serverReply = { ok: true }, serverDown = false } = {}) {
  const log = { fetches: [], completed: [], acked: [] };
  const svc = { getDetails: async () => [{ itemId: 'premium_unlock', price: { currency: 'AUD', value: '1.99' } }], listPurchases: async () => owned };
  if (acknowledge) svc.acknowledge = async (tok, kind) => { log.acked.push([tok, kind]); };
  const resp = { details: show === 'notoken' ? {} : { purchaseToken: token }, complete: async r => { log.completed.push(r); } };
  return {
    log,
    before(w) {
      w.getDigitalGoodsService = async () => svc;
      w.PaymentRequest = class { constructor(m, d) { log.method = m; log.details = d; } async show() { if (show === 'abort') { const e = new Error('closed'); e.name = 'AbortError'; throw e; } if (show === 'fail') throw new Error('boom'); return resp; } };
      w.fetch = async (url, init) => { log.fetches.push({ url, body: JSON.parse(init.body) }); if (serverDown) throw new Error('offline'); return { ok: serverReply.ok === true, json: async () => serverReply }; };
    },
  };
}
const play = (p, extra = {}) => open(Object.assign({ search: '?app=play', state: stateWith([sample()]), before: p.before }, extra));

exports.run = async t => {
  // normal purchase: unlock, close Google's dialog with success, acknowledge through our server
  let p = fakePlay(), a = await play(p);
  a.ev("showUpgrade('generic')"); await wait(10);
  t.check('shows the local price', a.text('#up-buy-label').includes('1.99'), a.text('#up-buy-label'));
  a.act('up-buy'); await wait(60);
  t.eq('premium after purchase', a.ev('isPremium()'), true);
  t.eq('payment dialog closed with success', p.log.completed, ['success']);
  t.eq('asked Play for the right product', p.log.method[0].data.sku, 'premium_unlock');
  t.eq('server acknowledgement sent', p.log.fetches.map(f => [f.url, f.body]), [['/api/acknowledge', { sku: 'premium_unlock', purchaseToken: 'tok-1' }]]);
  t.eq('token remembered as acknowledged', JSON.parse(a.window.localStorage.getItem('plateTally.acked.v1')), ['tok-1']);
  t.check('upgrade sheet closed', !a.$('#upgrade'));
  t.eq('saved so it survives a restart', JSON.parse(a.window.localStorage.getItem('plateTally.entitlement.v1')).purchased, true);
  a.close();

  // an older browser that can acknowledge itself does so, without our server
  p = fakePlay({ acknowledge: true }); a = await play(p);
  a.ev("showUpgrade('generic')"); a.act('up-buy'); await wait(60);
  t.eq('self-acknowledged', p.log.acked, [['tok-1', 'onetime']]);
  t.eq('no server call needed', p.log.fetches.length, 0);
  a.close();

  // server is down: still unlocked, retried later
  p = fakePlay({ serverDown: true }); a = await play(p);
  a.ev("showUpgrade('generic')"); a.act('up-buy'); await wait(60);
  t.eq('still unlocked', a.ev('isPremium()'), true);
  t.eq('queued for retry', JSON.parse(a.window.localStorage.getItem('plateTally.pending.v1')), ['tok-1']);
  t.eq('dialog still closed', p.log.completed, ['success']);
  const storage = a.storage(); a.close();
  p = fakePlay({ owned: [{ itemId: 'premium_unlock', purchaseToken: 'tok-1' }] });   // next launch, server back
  a = await play(p, { storage }); await wait(80);
  t.check('retry sent on next launch', p.log.fetches.some(f => f.body.purchaseToken === 'tok-1'), p.log.fetches);
  t.eq('retry cleared the queue', JSON.parse(a.window.localStorage.getItem('plateTally.pending.v1')), []);
  a.close();

  // person closes Google's dialog: nothing happens, no scary message
  p = fakePlay({ show: 'abort' }); a = await play(p);
  a.ev("showUpgrade('generic')"); a.act('up-buy'); await wait(60);
  t.eq('not premium', a.ev('isPremium()'), false);
  t.eq('no error message', a.text('#up-msg'), '');
  t.eq('button usable again', a.$('#up-buy').disabled, false);
  a.close();

  // a real failure tells them what to do
  p = fakePlay({ show: 'fail' }); a = await play(p);
  a.ev("showUpgrade('generic')"); a.act('up-buy'); await wait(60);
  t.check('error mentions Restore purchase', a.text('#up-msg').includes('Restore purchase'), a.text('#up-msg'));
  t.eq('still free', a.ev('isPremium()'), false);
  a.close();

  // dialog result without a token: closed as failed
  p = fakePlay({ show: 'notoken' }); a = await play(p);
  a.ev("showUpgrade('generic')"); a.act('up-buy'); await wait(60);
  t.eq('closed as failed', p.log.completed, ['fail']);
  t.eq('still free (no token)', a.ev('isPremium()'), false);
  a.close();

  // already owned on a new phone: Restore purchase
  p = fakePlay({ owned: [{ itemId: 'premium_unlock', purchaseToken: 'old-tok' }] }); a = await play(p);
  await wait(60);
  t.eq('owned purchase unlocks at launch', a.ev('isPremium()'), true);
  a.close();
  p = fakePlay({ owned: [] }); a = await play(p);
  a.ev("showUpgrade('generic')"); a.act('up-restore'); await wait(60);
  t.eq('nothing to restore message', a.text('#up-msg'), 'No purchase found for this Google account.');
  a.close();

  // refund: saved as bought, but Google no longer lists it
  p = fakePlay({ owned: [] });
  a = await play(p, { storage: { 'plateTally.entitlement.v1': JSON.stringify({ purchased: true }) } });
  await wait(60);
  t.eq('refund removes premium', a.ev('isPremium()'), false);
  a.close();

  // Play unavailable (offline): keep what we had
  a = await play({ before: w => { w.getDigitalGoodsService = async () => ({ getDetails: async () => [], listPurchases: async () => { throw new Error('offline'); } }); } },
    { storage: { 'plateTally.entitlement.v1': JSON.stringify({ purchased: true }) } });
  await wait(60);
  t.eq('offline keeps premium', a.ev('isPremium()'), true);
  a.close();

  // no billing service at all
  a = await play({ before: () => {} });
  a.ev("showUpgrade('generic')"); a.act('up-buy'); await wait(30);
  t.check('clear message', a.text('#up-msg').includes('not available'), a.text('#up-msg'));
  a.close();

  // website: the buy button only previews
  a = await open({ search: '?edition=free', state: stateWith([sample()]) });
  a.ev("showUpgrade('generic')"); a.act('up-buy'); await wait(20);
  t.eq('website preview unlocks', a.ev('isPremium()'), true);
  a.close();
};
