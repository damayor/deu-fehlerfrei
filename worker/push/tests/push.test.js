import test from 'node:test';
import assert from 'node:assert/strict';
import { localParts, isDue, isValidTz } from '../src/due.js';
import { vapidHeaders, publicKeyOf, b64urlDecode } from '../src/vapid.js';

const at = (iso) => new Date(iso).getTime();
const sub = (o = {}) => ({ hour: 20, tz: 'Europe/Berlin', metDay: null, lastSentDay: null, ...o });

test('localParts uses the device time zone, across midnight and DST', () => {
  assert.deepEqual(localParts(at('2026-11-05T22:30:00Z'), 'Europe/Berlin'), { day: '2026-11-05', hour: 23 });
  assert.deepEqual(localParts(at('2026-11-05T23:30:00Z'), 'Europe/Berlin'), { day: '2026-11-06', hour: 0 });
  assert.equal(localParts(at('2026-07-01T18:00:00Z'), 'Europe/Berlin').hour, 20); // summer: UTC+2
  assert.equal(localParts(at('2026-12-01T18:00:00Z'), 'Europe/Berlin').hour, 19); // winter: UTC+1
});

test('isDue: only after the hour, goal not met, not yet sent today', () => {
  assert.equal(isDue(sub(), at('2026-11-05T18:00:00Z')), false);           // 19:00 local
  assert.equal(isDue(sub(), at('2026-11-05T19:00:00Z')), true);            // 20:00 local
  assert.equal(isDue(sub({ metDay: '2026-11-05' }), at('2026-11-05T19:00:00Z')), false);
  assert.equal(isDue(sub({ metDay: '2026-11-04' }), at('2026-11-05T19:00:00Z')), true); // yesterday's goal does not count
  assert.equal(isDue(sub({ lastSentDay: '2026-11-05' }), at('2026-11-05T21:00:00Z')), false);
  assert.equal(isDue(sub({ lastSentDay: '2026-11-04' }), at('2026-11-05T19:00:00Z')), true);
});

test('isValidTz', () => {
  assert.equal(isValidTz('Europe/Berlin'), true);
  assert.equal(isValidTz('Mars/Base'), false);
  assert.equal(isValidTz(''), false);
});

test('VAPID header: JWT verifies with the advertised public key', async () => {
  const { privateKey } = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const jwk = await crypto.subtle.exportKey('jwk', privateKey);
  const h = await vapidHeaders('https://fcm.googleapis.com/fcm/send/abc', jwk, 'mailto:x@example.com', 1_700_000_000_000);
  const [, jwt, k] = h.Authorization.match(/^vapid t=(\S+), k=(\S+)$/);
  assert.equal(k, publicKeyOf(jwk));
  assert.equal(b64urlDecode(k).length, 65);
  const [head, claims, sig] = jwt.split('.');
  assert.equal(JSON.parse(Buffer.from(claims, 'base64url')).aud, 'https://fcm.googleapis.com');
  const pub = await crypto.subtle.importKey('raw', b64urlDecode(k), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
  assert.equal(await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pub, b64urlDecode(sig), new TextEncoder().encode(`${head}.${claims}`)), true);
  assert.equal(h.TTL, '14400');
});
