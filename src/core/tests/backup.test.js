import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBackup, parseBackup, exportAll, restoreAll, resetAll, lastExport } from '../backup.js';

const ev = { id: 'a', ts: 1, module: 'prepositions', type: 'answer', itemId: 'x', correct: true, ms: 5 };

function fakeStore(init = {}) {
  const db = { events: [], settings: [], cache: [], ...init };
  const keyOf = (st) => (st === 'events' ? 'id' : 'key');
  return {
    db,
    getAll: async (st) => structuredClone(db[st]),
    get: async (st, k) => db[st].find((r) => r[keyOf(st)] === k),
    put: async (st, v) => { db[st] = db[st].filter((r) => r[keyOf(st)] !== v[keyOf(st)]).concat(v); },
    replaceAll: async (st, vs) => { db[st] = [...vs]; },
  };
}

test('export then parse round trip', () => {
  const b = buildBackup({ events: [ev], settings: [{ key: 'global', values: { dailyGoal: 3 } }], state: [{ key: 'state:prepositions', value: { queue: ['x'] } }] }, 0, '1');
  const r = parseBackup(JSON.stringify(b));
  assert.equal(r.ok, true);
  assert.deepEqual(r.data.events, [ev]);
});

test('parse rejects bad input with a message', () => {
  assert.equal(parseBackup('nope').ok, false);
  assert.match(parseBackup('{"app":"other"}').error, /Fehlerfrei/);
  const bad = JSON.stringify({ app: 'fehlerfrei', format: 1, events: [{ id: 'a' }], settings: [], state: [] });
  assert.match(parseBackup(bad).error, /Ereignis 1/);
  const evil = JSON.stringify({ app: 'fehlerfrei', format: 1, events: [], settings: [], state: [{ key: 'other' }] });
  assert.equal(parseBackup(evil).ok, false);
});

test('export, reset, import brings progress back identical', async () => {
  const store = fakeStore({
    events: [ev],
    settings: [{ key: 'global', values: { dailyGoal: 3 } }, { key: 'phase1-test', opens: 4 }],
    cache: [{ key: 'state:prepositions', value: { queue: ['x'] } }, { key: 'mistakes:rows', value: [1] }],
  });
  const backup = await exportAll(store, 1000, '1');
  assert.equal(await lastExport(store), 1000);
  await resetAll(store);
  assert.deepEqual(store.db.events, []);
  assert.equal(await lastExport(store), 1000, 'reset keeps the last export date');
  assert.deepEqual(store.db.cache, [{ key: 'mistakes:rows', value: [1] }], 'reset keeps unrelated cache');
  await restoreAll(store, parseBackup(JSON.stringify(backup)).data);
  assert.deepEqual(store.db.events, [ev]);
  assert.deepEqual(store.db.settings.find((r) => r.key === 'global').values, { dailyGoal: 3 });
  assert.deepEqual(store.db.cache.find((r) => r.key === 'state:prepositions').value, { queue: ['x'] });
});
