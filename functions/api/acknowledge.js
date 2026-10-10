// Cloudflare Pages Function: POST /api/acknowledge
//
// Google Play refunds a purchase that the developer never acknowledges (after about 3 days, and after
// about 3 minutes for test purchases). The browser version of the Play Billing API cannot acknowledge a
// one-time purchase, so the app sends the purchase token here and this function does it through Google's
// Play Developer API. It also checks that the purchase is real (state "purchased"), nothing is stored.
//
// Needs one secret on the Cloudflare Pages project:
//   GOOGLE_SERVICE_ACCOUNT_JSON   the whole JSON key file of a Google service account that has been
//                                 invited to your Play Console with permission to manage orders.
// Optional:
//   PLAY_PACKAGE_NAME             defaults to com.robsofficetips.sushitraintrack

const ALLOWED_SKUS = new Set(['premium_unlock']);
const SCOPE = 'https://www.googleapis.com/auth/androidpublisher';
const API = 'https://androidpublisher.googleapis.com/androidpublisher/v3/applications';
const DEFAULT_PACKAGE = 'com.robsofficetips.sushitraintrack';

let cachedToken = { value: null, expires: 0 };

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
});

const toB64Url = bytes => {
  let s = '';
  for (const b of new Uint8Array(bytes)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const textB64Url = text => toB64Url(new TextEncoder().encode(text));

function pemToDer(pem) {
  const body = pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const bin = atob(body);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

// Signs a short-lived login request with the service account's private key and swaps it for an access token.
async function getAccessToken(env) {
  if (cachedToken.value && Date.now() < cachedToken.expires) return cachedToken.value;
  const account = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_JSON);
  const now = Math.floor(Date.now() / 1000);
  const unsigned = textB64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' })) + '.' + textB64Url(JSON.stringify({
    iss: account.client_email, scope: SCOPE, aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3300
  }));
  const key = await crypto.subtle.importKey('pkcs8', pemToDer(account.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned));
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: unsigned + '.' + toB64Url(signature) })
  });
  if (!res.ok) throw new Error('google-auth-' + res.status);
  const data = await res.json();
  cachedToken = { value: data.access_token, expires: Date.now() + Math.max(60, (data.expires_in || 3600) - 300) * 1000 };
  return cachedToken.value;
}

export async function onRequestPost({ request, env }) {
  const origin = request.headers.get('Origin');
  if (origin && origin !== new URL(request.url).origin) return json({ ok: false, reason: 'forbidden' }, 403);

  let body;
  try { body = await request.json(); } catch { return json({ ok: false, reason: 'bad-request' }, 400); }
  const sku = body && body.sku, token = body && body.purchaseToken;
  if (!ALLOWED_SKUS.has(sku) || typeof token !== 'string' || !/^[A-Za-z0-9._-]{20,600}$/.test(token)) {
    return json({ ok: false, reason: 'bad-request' }, 400);
  }
  if (!env || !env.GOOGLE_SERVICE_ACCOUNT_JSON) return json({ ok: false, reason: 'not-configured' }, 500);

  let accessToken;
  try { accessToken = await getAccessToken(env); } catch { return json({ ok: false, reason: 'google-auth-failed' }, 502); }

  const pkg = env.PLAY_PACKAGE_NAME || DEFAULT_PACKAGE;
  const url = `${API}/${pkg}/purchases/products/${sku}/tokens/${encodeURIComponent(token)}`;
  const auth = { Authorization: 'Bearer ' + accessToken };

  const check = await fetch(url, { headers: auth });
  if (check.status === 400 || check.status === 404 || check.status === 410) return json({ ok: false, reason: 'invalid-token' });
  if (check.status === 401 || check.status === 403) return json({ ok: false, reason: 'google-denied' }, 502);
  if (!check.ok) return json({ ok: false, reason: 'google-error' }, 502);

  const purchase = await check.json();
  if (purchase.purchaseState === 2) return json({ ok: false, reason: 'pending' });
  if (purchase.purchaseState !== 0) return json({ ok: false, reason: 'not-purchased' });
  const test = purchase.purchaseType === 0;
  if (purchase.acknowledgementState === 1) return json({ ok: true, acknowledged: true, already: true, test });

  const ack = await fetch(url + ':acknowledge', {
    method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' }, body: '{}'
  });
  if (ack.status === 401 || ack.status === 403) return json({ ok: false, reason: 'google-denied' }, 502);
  if (!ack.ok) return json({ ok: false, reason: 'google-error' }, 502);
  return json({ ok: true, acknowledged: true, test });
}

// anything other than POST
export const onRequest = () => json({ ok: false, reason: 'method-not-allowed' }, 405);
