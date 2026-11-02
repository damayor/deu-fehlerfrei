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
  assert.deepEqual(r.data.slots[0].words, [{ orig: 'ertragen', frase: 'Ich ertrage es.', trad: 'soportar', state: 'new', badPhrase: false }]);
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

import { colorKind, wordState, countStates, originDate, highlightParts } from '../engine.js';

test('colorKind classifies the reaction colors and manual shades', () => {
  assert.equal(colorKind('#d9ead3'), 'green');
  assert.equal(colorKind('#fff2cc'), 'yellow');
  assert.equal(colorKind('#ea9999'), 'red');
  assert.equal(colorKind('#f9cb9c'), 'yellow'); // orange counts as yellow
  assert.equal(colorKind('#ffffff'), 'none');
  assert.equal(colorKind('#d9d9d9'), 'none');
  assert.equal(colorKind(''), 'none');
  assert.equal(colorKind(undefined), 'none');
});

test('wordState follows the Telegram reaction rules', () => {
  assert.deepEqual(wordState('#d9ead3', '#d9ead3'), { state: 'known', badPhrase: false });      // ❤️
  assert.deepEqual(wordState('#fff2cc', '#d9ead3'), { state: 'recalled', badPhrase: false });   // 👍
  assert.deepEqual(wordState('#fff2cc', '#fff2cc'), { state: 'open', badPhrase: false });       // 👎
  assert.deepEqual(wordState('#ffffff', '#ea9999'), { state: 'new', badPhrase: true });         // 😡
  assert.deepEqual(wordState('', ''), { state: 'new', badPhrase: false });                      // old endpoint, no colors
});

test('parsePayload derives the state from the cell colors', () => {
  const r = parsePayload({ date: '2026-11-02', slots: [{ kind: 'dias', value: 5, words: [
    { orig: 'a', wordBg: '#d9ead3', fraseBg: '#d9ead3' }, { orig: 'b', wordBg: '#fff2cc', fraseBg: '#fff2cc' }, { orig: 'c' }] }] });
  assert.deepEqual(r.data.slots[0].words.map((w) => w.state), ['known', 'open', 'new']);
  assert.deepEqual(countStates(r.data), { known: 1, recalled: 0, open: 1, new: 1 });
});

test('originDate: days, months and month-end clamping', () => {
  const ymd = (d) => [d.getFullYear(), d.getMonth() + 1, d.getDate()].join('-');
  assert.equal(ymd(originDate('2026-11-02', { kind: 'dias', value: 20 })), '2026-10-13');
  assert.equal(ymd(originDate('2026-11-02', { kind: 'meses', value: 8 })), '2026-3-2');
  assert.equal(ymd(originDate('2026-03-31', { kind: 'meses', value: 1 })), '2026-2-28');
  assert.equal(ymd(originDate('2026-01-15', { kind: 'meses', value: 1 })), '2025-12-15');
});

test('highlightParts finds the word case-insensitively or gives up', () => {
  assert.deepEqual(highlightParts('Achtsam zu sein ist gut.', 'Achtsam'), { before: '', match: 'Achtsam', after: ' zu sein ist gut.' });
  assert.equal(highlightParts('Verzeihen Sie, bitte.', 'verzeihen sie!').match, 'Verzeihen Sie');
  assert.equal(highlightParts('Ganz anderer Satz.', 'ausruhen'), null);
  assert.equal(highlightParts('Text', '!'), null);
});
