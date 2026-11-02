import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePayload, slotLabel, slotStatus, totalWords } from '../engine.js';
import { fetchToday } from '../sync.js';

const good = {
  date: '2026-11-02',
  slots: [
    { pos: 1, hour: 9, kind: 'meses', value: 8, words: [{ orig: ' ertragen ', frase: 'Ich ertrage es.', trad: 'soportar' }, { orig: '', frase: '', trad: '' }], englishCount: 2 },
    { pos: 4, hour: 15, kind: 'dias', value: 1, words: [{ orig: 'hingehen', trad: 'ir' }] },
  ],
};

test('parsePayload normalizes and drops empty words', () => {
  const r = parsePayload(good);
  assert.equal(r.ok, true);
  assert.deepEqual(r.data.slots[0].words, [{ orig: 'ertragen', frase: 'Ich ertrage es.', trad: 'soportar' }]);
  assert.equal(r.data.slots[1].words[0].frase, '');
  assert.equal(r.data.slots[1].englishCount, 0);
  assert.equal(totalWords(r.data), 2);
});

test('parsePayload rejects bad shapes and unauthorized', () => {
  assert.match(parsePayload({ error: 'unauthorized' }).error, /Token/);
  assert.equal(parsePayload(null).ok, false);
  assert.equal(parsePayload({ date: 'x', slots: [] }).ok, false);
  assert.equal(parsePayload({ date: '2026-11-02', slots: [{ kind: 'weeks', value: 1, words: [] }] }).ok, false);
});

test('slotLabel and slotStatus', () => {
  assert.equal(slotLabel({ kind: 'meses', value: 8 }), 'vor 8 Monaten');
  assert.equal(slotLabel({ kind: 'dias', value: 1 }), 'vor 1 Tag');
  assert.equal(slotStatus({ hour: 9 }, new Date(2026, 10, 2, 9, 22)), 'upcoming');
  assert.equal(slotStatus({ hour: 9 }, new Date(2026, 10, 2, 9, 23)), 'sent');
  assert.equal(slotStatus({ hour: null }, new Date()), 'unknown');
});

test('fetchToday sends the token, parses, and maps failures to German messages', async () => {
  let seen;
  const ok = async (u) => { seen = u; return { ok: true, json: async () => good }; };
  const data = await fetchToday({ url: 'https://script.google.com/macros/s/X/exec', token: 'abc' }, ok);
  assert.equal(seen.searchParams.get('t'), 'abc');
  assert.equal(data.date, '2026-11-02');
  await assert.rejects(fetchToday({ url: 'nope', token: 'a' }, ok), /ungültig/);
  await assert.rejects(fetchToday({ url: 'https://x.y/', token: 'a' }, async () => { throw new TypeError('fail'); }), /Verbindung/);
  await assert.rejects(fetchToday({ url: 'https://x.y/', token: 'a' }, async () => ({ ok: false, status: 500 })), /500/);
  await assert.rejects(fetchToday({ url: 'https://x.y/', token: 'a' }, async () => ({ ok: true, json: async () => { throw new Error(); } })), /JSON/);
  await assert.rejects(fetchToday({ url: 'https://x.y/', token: 'a' }, async () => ({ ok: true, json: async () => ({ error: 'unauthorized' }) })), /Token/);
});
