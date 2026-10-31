import test from 'node:test';
import assert from 'node:assert/strict';
import { GLOBAL_SCHEMA, defaultsOf, validate, sanitize, applyChange, saveSettings, loadSettings } from '../settings.js';
import { SETTINGS_SCHEMA, crossCheck } from '../../modules/prepositions/settings.js';

const P = defaultsOf(SETTINGS_SCHEMA);

test('defaults are valid and match the spec', () => {
  assert.deepEqual(validate(GLOBAL_SCHEMA, defaultsOf(GLOBAL_SCHEMA)), {});
  assert.deepEqual(validate(SETTINGS_SCHEMA, P, crossCheck), {});
  assert.deepEqual([P.gradThreshold, P.queueSize, P.optionCount, P.roundSize, P.autoAdvance], [4, 6, 4, 10, 0]);
  assert.equal(defaultsOf(GLOBAL_SCHEMA).dailyGoal, 2);
});

test('stepper ranges (goal 1-10, threshold 3-5, queue 4-12, options 3-6)', () => {
  const g = (v) => validate(GLOBAL_SCHEMA, { dailyGoal: v, theme: 'auto' }).dailyGoal;
  assert.equal(g(1), undefined); assert.equal(g(10), undefined); assert.ok(g(0)); assert.ok(g(11)); assert.ok(g(2.5)); assert.ok(g('3'));
  const p = (patch) => applyChange(SETTINGS_SCHEMA, P, patch, crossCheck).ok;
  assert.equal(p({ gradThreshold: 2 }), false); assert.equal(p({ gradThreshold: 5 }), true);
  assert.equal(p({ queueSize: 13 }), false); assert.equal(p({ queueSize: 12 }), true);
  assert.equal(p({ optionCount: 7 }), false); assert.equal(p({ optionCount: 3 }), true);
});

test('categories need at least one', () => {
  const r = applyChange(SETTINGS_SCHEMA, P, { categories: [] }, crossCheck);
  assert.equal(r.ok, false); assert.ok(r.errors.categories);
  assert.equal(applyChange(SETTINGS_SCHEMA, P, { categories: ['N'] }, crossCheck).ok, true);
});

test('pool must be big enough for the option count, with a clear message', () => {
  const small = applyChange(SETTINGS_SCHEMA, P, { prepPool: ['an', 'auf', 'in'] }, crossCheck);
  assert.equal(small.ok, false); assert.match(small.errors._, /mindestens 4/);
  assert.equal(applyChange(SETTINGS_SCHEMA, P, { prepPool: ['an', 'auf', 'in'], optionCount: 3 }, crossCheck).ok, true);
  const raise = applyChange(SETTINGS_SCHEMA, { ...P, prepPool: ['an', 'auf', 'in', 'zu'] }, { optionCount: 5 }, crossCheck);
  assert.equal(raise.ok, false);
});

test('custom prepositions allowed, duplicates and empties rejected', () => {
  assert.equal(applyChange(SETTINGS_SCHEMA, P, { prepPool: [...P.prepPool, 'zwischen'] }, crossCheck).ok, true);
  assert.equal(applyChange(SETTINGS_SCHEMA, P, { prepPool: [...P.prepPool, 'an'] }, crossCheck).ok, false);
  assert.equal(applyChange(SETTINGS_SCHEMA, P, { prepPool: [...P.prepPool, ' '] }, crossCheck).ok, false);
});

test('a rejected change leaves the old values untouched', () => {
  const r = applyChange(SETTINGS_SCHEMA, P, { queueSize: 99 }, crossCheck);
  assert.equal(r.values, P);
});

test('choice and toggle validation', () => {
  assert.equal(applyChange(SETTINGS_SCHEMA, P, { autoAdvance: 2 }, crossCheck).ok, true);
  assert.equal(applyChange(SETTINGS_SCHEMA, P, { autoAdvance: 3 }, crossCheck).ok, false);
  assert.equal(applyChange(SETTINGS_SCHEMA, P, { showExample: 'yes' }, crossCheck).ok, false);
});

test('sanitize: garbage from storage falls back to defaults, unknown keys dropped', () => {
  const s = sanitize(SETTINGS_SCHEMA, { queueSize: 99, roundSize: 15, foo: 1, categories: 'V' });
  assert.equal(s.queueSize, 6); assert.equal(s.roundSize, 15); assert.deepEqual(s.categories, ['V', 'N', 'A']); assert.ok(!('foo' in s));
  assert.deepEqual(sanitize(SETTINGS_SCHEMA, undefined), P);
});

test('save and load round trip with separate namespaces', async () => {
  const db = new Map();
  const store = { put: async (_s, rec) => db.set(rec.key, rec), get: async (_s, k) => db.get(k) };
  await saveSettings(store, 'prepositions', { ...P, queueSize: 8 });
  await saveSettings(store, 'global', { dailyGoal: 3, theme: 'dark' });
  assert.equal((await loadSettings(store, 'prepositions', SETTINGS_SCHEMA)).queueSize, 8);
  assert.equal((await loadSettings(store, 'global', GLOBAL_SCHEMA)).dailyGoal, 3);
  assert.ok(db.has('module:prepositions') && db.has('global'));
});
