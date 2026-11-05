import test from 'node:test';
import assert from 'node:assert/strict';
import { b64urlToBytes, buildPayload, isConfigured, REMINDER_SCHEMA } from '../push.js';
import { defaultsOf, validate } from '../settings.js';

const at = (iso) => new Date(iso).getTime();
const act = (iso) => ({ module: 'prepositions', type: 'activity', kind: 'round', ts: at(iso) });
const S = { hour: 20 };

test('b64urlToBytes decodes url-safe base64', () => {
  assert.deepEqual([...b64urlToBytes('_-8')], [255, 239]);
});

test('payload: metDay only when today goal is met', () => {
  const now = at('2026-11-05T12:00:00');
  const none = buildPayload({ endpoint: 'e' }, S, [act('2026-11-04T10:00:00'), act('2026-11-04T11:00:00')], 2, now, 'Europe/Berlin');
  assert.equal(none.metDay, null);
  const one = buildPayload({ endpoint: 'e' }, S, [act('2026-11-05T09:00:00')], 2, now, 'Europe/Berlin');
  assert.equal(one.metDay, null);
  const met = buildPayload({ endpoint: 'e' }, S, [act('2026-11-05T09:00:00'), act('2026-11-05T10:00:00')], 2, now, 'Europe/Berlin');
  assert.deepEqual([met.metDay, met.hour, met.tz], ['2026-11-05', 20, 'Europe/Berlin']);
});

test('reminder settings: defaults are valid and need URL and token', () => {
  const d = defaultsOf(REMINDER_SCHEMA);
  assert.deepEqual(validate(REMINDER_SCHEMA, d), {});
  assert.equal(isConfigured(d), false);
  assert.equal(isConfigured({ ...d, url: 'https://w.example', token: 't' }), true);
  assert.ok(validate(REMINDER_SCHEMA, { ...d, url: 'http://x' }).url);
});

test('streakInfo: endDay is today when met, yesterday otherwise, null without a streak', async () => {
  const { streakInfo } = await import('../push.js');
  const now = at('2026-11-05T12:00:00');
  const day = (d, n) => Array.from({ length: n }, () => act(`${d}T10:00:00`));
  const evs = [...day('2026-11-03', 2), ...day('2026-11-04', 2)];
  assert.deepEqual(streakInfo(evs, 2, now), { current: 2, endDay: '2026-11-04' });
  assert.deepEqual(streakInfo([...evs, ...day('2026-11-05', 2)], 2, now), { current: 3, endDay: '2026-11-05' });
  assert.deepEqual(streakInfo([], 2, now), { current: 0, endDay: null });
});
