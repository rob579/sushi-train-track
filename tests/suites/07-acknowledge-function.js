// Checks the server function that tells Google "this purchase was received" (functions/api/acknowledge.js).
// It is loaded directly and given a pretend Google, so nothing real is contacted.
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { ROOT } = require('../lib/harness');

const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const PEM = privateKey.export({ type: 'pkcs8', format: 'pem' });
const TOKEN = 'abcdefghijklmnopqrstuvwxyz0123456789';
let n = 0;

async function load() {   // a fresh copy each time, because the function remembers its Google login
  const f = path.join(os.tmpdir(), `ack-${process.pid}-${++n}.mjs`);
  fs.copyFileSync(path.join(ROOT, 'functions', 'api', 'acknowledge.js'), f);
  const m = await import(f); fs.unlinkSync(f); return m;
}
const env = (o = {}) => Object.assign({ GOOGLE_SERVICE_ACCOUNT_JSON: JSON.stringify({ client_email: 'svc@x.iam.gserviceaccount.com', private_key: PEM }) }, o);
const req = (body, headers = {}, raw) => new Request('https://sushi.test/api/acknowledge', { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: raw !== undefined ? raw : JSON.stringify(body) });

// pretend Google: purchase = what the "get purchase" call returns; options choose failures
function google(purchase, o = {}) {
  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), method: init.method || 'GET', auth: (init.headers || {}).Authorization, body: init.body });
    const res = (s, b) => new Response(b === undefined ? null : JSON.stringify(b), { status: s });
    if (String(url).startsWith('https://oauth2.googleapis.com/token')) return o.authFails ? res(401, {}) : res(200, { access_token: 'AT', expires_in: 3600 });
    if (String(url).endsWith(':acknowledge')) return res(o.ackStatus || 204);
    return o.getStatus ? res(o.getStatus, {}) : res(200, purchase);
  };
  return calls;
}
const run = async (e, body, headers, raw) => { const m = await load(); const r = await m.onRequestPost({ request: req(body, headers, raw), env: e }); return [r.status, await r.json(), m]; };

exports.run = async t => {
  const realFetch = globalThis.fetch;
  try {
    // happy path
    let calls = google({ purchaseState: 0, acknowledgementState: 0, purchaseType: 0 });
    let [s, b] = await run(env(), { sku: 'premium_unlock', purchaseToken: TOKEN });
    t.eq('purchase acknowledged', [s, b.ok, b.acknowledged, b.test], [200, true, true, true]);
    const login = calls[0];
    t.check('logs in with a signed request', login.url.includes('oauth2.googleapis.com') && String(login.body).includes('jwt-bearer'));
    const jwt = new URLSearchParams(login.body).get('assertion').split('.');
    t.eq('signed login header', JSON.parse(Buffer.from(jwt[0], 'base64url')), { alg: 'RS256', typ: 'JWT' });
    t.check('login signature is valid', crypto.verify('RSA-SHA256', Buffer.from(jwt[0] + '.' + jwt[1]), crypto.createPublicKey(privateKey), Buffer.from(jwt[2], 'base64url')));
    const claim = JSON.parse(Buffer.from(jwt[1], 'base64url'));
    t.eq('claims', [claim.iss, claim.scope], ['svc@x.iam.gserviceaccount.com', 'https://www.googleapis.com/auth/androidpublisher']);
    const ack = calls.find(c => c.url.endsWith(':acknowledge'));
    t.check('acknowledge call is for the right app, product and token', ack && ack.url.includes('/com.robsofficetips.sushitraintrack/purchases/products/premium_unlock/tokens/' + TOKEN), ack && ack.url);
    t.eq('acknowledge uses the access token', ack.auth, 'Bearer AT');

    // already acknowledged: no second call
    calls = google({ purchaseState: 0, acknowledgementState: 1, purchaseType: 0 });
    [s, b] = await run(env(), { sku: 'premium_unlock', purchaseToken: TOKEN });
    t.eq('already acknowledged is fine', [s, b.ok, b.already], [200, true, true]);
    t.eq('and not acknowledged twice', calls.filter(c => c.url.endsWith(':acknowledge')).length, 0);

    // not a completed purchase
    google({ purchaseState: 1 });
    [s, b] = await run(env(), { sku: 'premium_unlock', purchaseToken: TOKEN });
    t.eq('cancelled/refunded purchase', [b.ok, b.reason], [false, 'not-purchased']);
    google({ purchaseState: 2 });
    [s, b] = await run(env(), { sku: 'premium_unlock', purchaseToken: TOKEN });
    t.eq('pending purchase', [b.ok, b.reason], [false, 'pending']);
    for (const code of [400, 404, 410]) {
      google({}, { getStatus: code });
      [s, b] = await run(env(), { sku: 'premium_unlock', purchaseToken: TOKEN });
      t.eq(`Google says ${code}: invalid token`, [b.ok, b.reason], [false, 'invalid-token']);
    }

    // Google-side trouble
    google({}, { getStatus: 403 });
    [s, b] = await run(env(), { sku: 'premium_unlock', purchaseToken: TOKEN });
    t.eq('permission denied', [s, b.reason], [502, 'google-denied']);
    google({}, { getStatus: 500 });
    [s, b] = await run(env(), { sku: 'premium_unlock', purchaseToken: TOKEN });
    t.eq('Google error', [s, b.reason], [502, 'google-error']);
    google({}, { authFails: true });
    [s, b] = await run(env(), { sku: 'premium_unlock', purchaseToken: TOKEN });
    t.eq('login refused', [s, b.reason], [502, 'google-auth-failed']);
    google({ purchaseState: 0, acknowledgementState: 0 }, { ackStatus: 500 });
    [s, b] = await run(env(), { sku: 'premium_unlock', purchaseToken: TOKEN });
    t.eq('acknowledge call fails', [s, b.reason], [502, 'google-error']);

    // bad requests never reach Google
    calls = google({});
    for (const [label, body, raw] of [['unknown product', { sku: 'other', purchaseToken: TOKEN }], ['short token', { sku: 'premium_unlock', purchaseToken: 'short' }],
      ['token with odd characters', { sku: 'premium_unlock', purchaseToken: 'a/b?c=d&e'.repeat(4) }], ['missing token', { sku: 'premium_unlock' }], ['not JSON', null, '{nope']]) {
      [s, b] = await run(env(), body, {}, raw);
      t.eq(label, [s, b.reason], [400, 'bad-request']);
    }
    [s, b] = await run(env(), { sku: 'premium_unlock', purchaseToken: TOKEN }, { Origin: 'https://evil.example' });
    t.eq('other websites are refused', [s, b.reason], [403, 'forbidden']);
    [s, b] = await run(env(), { sku: 'premium_unlock', purchaseToken: TOKEN }, { Origin: 'https://sushi.test' });
    t.check('our own site is allowed', s !== 403);
    t.eq('Google never contacted for bad requests', calls.filter(c => c.url.includes('purchases/products')).length <= 1, true);
    [s, b] = await run({}, { sku: 'premium_unlock', purchaseToken: TOKEN });
    t.eq('missing secret is reported', [s, b.reason], [500, 'not-configured']);

    // package name can be overridden; other methods are refused
    calls = google({ purchaseState: 0, acknowledgementState: 0 });
    await run(env({ PLAY_PACKAGE_NAME: 'com.example.other' }), { sku: 'premium_unlock', purchaseToken: TOKEN });
    t.check('package name override', calls.some(c => c.url.includes('/com.example.other/')));
    const m = await load(); const r = await m.onRequest();
    t.eq('GET etc. get 405', r.status, 405);
  } finally { globalThis.fetch = realFetch; }
};
