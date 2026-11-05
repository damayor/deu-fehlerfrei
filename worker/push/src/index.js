// Streak reminder Worker. Stores push subscriptions in KV and, once an hour, sends an empty Web Push
// to devices whose daily goal is not met yet. It never sees any learning data except "goal met today (date)".
import { isDue, isValidTz } from './due.js';
import { vapidHeaders, publicKeyOf } from './vapid.js';

const MAX_SUBS = 5;

const cors = (env) => ({
  'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN,
  'Access-Control-Allow-Methods': 'GET, PUT, DELETE, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Max-Age': '86400',
  Vary: 'Origin',
});

const reply = (env, status, body = null, type = 'application/json') =>
  new Response(body === null ? null : (type === 'application/json' ? JSON.stringify(body) : body), { status, headers: { ...cors(env), 'Content-Type': type } });

async function sha256Hex(text) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Constant-time token check. */
async function authorized(request, env) {
  const given = (request.headers.get('Authorization') ?? '').replace(/^Bearer /, '');
  if (!env.AUTH_TOKEN || !given) return false;
  const [a, b] = await Promise.all([sha256Hex(given), sha256Hex(env.AUTH_TOKEN)]);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function parseSub(body) {
  const sub = body?.subscription;
  if (typeof sub?.endpoint !== 'string' || !/^https:\/\//.test(sub.endpoint) || sub.endpoint.length > 600) return null;
  if (!Number.isInteger(body.hour) || body.hour < 0 || body.hour > 23) return null;
  if (!isValidTz(body.tz)) return null;
  if (body.metDay != null && !/^\d{4}-\d{2}-\d{2}$/.test(body.metDay)) return null;
  return { endpoint: sub.endpoint, hour: body.hour, tz: body.tz, metDay: body.metDay ?? null };
}

/** Send one empty push. Returns the HTTP status of the push service. */
async function sendPush(endpoint, env, now = Date.now()) {
  const headers = await vapidHeaders(endpoint, JSON.parse(env.VAPID_PRIVATE_JWK), env.VAPID_SUBJECT, now);
  return (await fetch(endpoint, { method: 'POST', headers })).status;
}

async function handle(request, env) {
  const url = new URL(request.url);
  if (request.method === 'OPTIONS') return reply(env, 204);
  if (url.pathname === '/vapid-public-key' && request.method === 'GET') {
    return reply(env, 200, publicKeyOf(JSON.parse(env.VAPID_PRIVATE_JWK)), 'text/plain');
  }
  if (!(await authorized(request, env))) return reply(env, 401, { error: 'unauthorized' });
  if (url.pathname !== '/subscription' && url.pathname !== '/test') return reply(env, 404, { error: 'not found' });

  let body;
  try { body = await request.json(); } catch { return reply(env, 400, { error: 'invalid json' }); }

  if (url.pathname === '/test' && request.method === 'POST') {
    // Only push to endpoints that were registered, never to an arbitrary URL.
    const known = typeof body?.endpoint === 'string' && await env.SUBS.get(`sub:${await sha256Hex(body.endpoint)}`);
    if (!known) return reply(env, 404, { error: 'unknown subscription' });
    const status = await sendPush(body.endpoint, env);
    return reply(env, status >= 200 && status < 300 ? 204 : 502, status >= 300 ? { error: `push service answered ${status}` } : null);
  }
  if (request.method === 'PUT') {
    const s = parseSub(body);
    if (!s) return reply(env, 400, { error: 'invalid subscription' });
    const key = `sub:${await sha256Hex(s.endpoint)}`;
    const old = await env.SUBS.get(key, 'json');
    if (!old && (await env.SUBS.list({ prefix: 'sub:' })).keys.length >= MAX_SUBS) return reply(env, 429, { error: 'too many subscriptions' });
    await env.SUBS.put(key, JSON.stringify({ ...s, subscription: body.subscription, lastSentDay: old?.lastSentDay ?? null }));
    return reply(env, 204);
  }
  if (request.method === 'DELETE') {
    if (typeof body?.endpoint !== 'string') return reply(env, 400, { error: 'endpoint required' });
    await env.SUBS.delete(`sub:${await sha256Hex(body.endpoint)}`);
    return reply(env, 204);
  }
  return reply(env, 405, { error: 'method not allowed' });
}

async function runReminders(env, now = Date.now()) {
  const { keys } = await env.SUBS.list({ prefix: 'sub:' });
  for (const { name } of keys) {
    const sub = await env.SUBS.get(name, 'json');
    if (!sub || !isDue(sub, now)) continue;
    const status = await sendPush(sub.endpoint, env, now);
    if (status === 404 || status === 410) { await env.SUBS.delete(name); continue; } // expired subscription
    if (status >= 200 && status < 300) {
      const day = new Intl.DateTimeFormat('en-CA', { timeZone: sub.tz }).format(now);
      await env.SUBS.put(name, JSON.stringify({ ...sub, lastSentDay: day }));
    } // other errors: retry at the next hourly run
  }
}

export default {
  async fetch(request, env) {
    try { return await handle(request, env); } catch (err) { return reply(env, 500, { error: 'server error' }); }
  },
  scheduled(_event, env, ctx) { ctx.waitUntil(runReminders(env)); },
};
