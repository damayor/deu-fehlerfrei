import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULTS, BASE_PREPS, deriveProgress, applyAnswer, fillQueue, rotateQueue, pickCard, buildOptions,
  answersInCurrentRound, isRoundComplete, summarize,
} from '../engine.js';

function seeded(seed = 1) { // mulberry32
  return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const mk = (id, cat, prep, tier) => ({ id, cat, word: id, prep, case: 'Akk', priorityTier: tier, family: null });
const ITEMS = [
  ...['t1', 't2', 't3'].map((id, i) => mk(id, 'V', BASE_PREPS[i], 'top')),
  ...['n1', 'n2', 'n3', 'n4'].map((id, i) => mk(id, 'N', BASE_PREPS[i + 3], 'normal')),
  ...['r1', 'r2', 'r3', 'r4', 'r5'].map((id, i) => mk(id, 'A', BASE_PREPS[i + 5], 'none')),
];
const S = { ...DEFAULTS };
const ans = (itemId, correct, ts) => ({ module: 'prepositions', type: 'answer', itemId, correct, ts });

test('correct +1, wrong -1 never below 0', () => {
  let r = { streak: 0, correct: 0, wrong: 0, graduated: false };
  r = applyAnswer(r, false, S); assert.equal(r.streak, 0);
  r = applyAnswer(r, true, S); r = applyAnswer(r, true, S); assert.equal(r.streak, 2);
  r = applyAnswer(r, false, S); assert.equal(r.streak, 1);
  assert.deepEqual([r.correct, r.wrong], [2, 2]);
});

test('graduates at threshold and stays graduated', () => {
  const p = deriveProgress([1, 2, 3, 4].map((i) => ans('t1', true, i)), S);
  assert.equal(p.t1.graduated, true);
  const after = deriveProgress([1, 2, 3, 4, 5].map((i) => ans('t1', i < 5, i)), S);
  assert.equal(after.t1.graduated, true);
});

test('deriveProgress replays in time order and ignores other modules', () => {
  const ev = [ans('t1', true, 3), ans('t1', false, 1), { module: 'mistakes', type: 'answer', itemId: 't1', correct: true, ts: 2 }];
  assert.equal(deriveProgress(ev, S).t1.streak, 1); // wrong(1) then correct(3)
});

test('queue fills top tier first and expands only when exhausted', () => {
  const q = fillQueue(ITEMS, {}, [], { ...S, queueSize: 5 }, seeded());
  assert.equal(q.length, 5);
  assert.deepEqual(q.slice(0, 3).sort(), ['t1', 't2', 't3']);
  assert.ok(q.slice(3).every((id) => id.startsWith('n')));
});

test('priorityFirst off draws from the whole pool', () => {
  const tiers = new Set();
  for (let s = 1; s < 30; s++) {
    fillQueue(ITEMS, {}, [], { ...S, queueSize: 4, priorityFirst: false }, seeded(s))
      .forEach((id) => tiers.add(ITEMS.find((i) => i.id === id).priorityTier));
  }
  assert.equal(tiers.size, 3);
});

test('graduated items are replaced by pending items', () => {
  const progress = { t1: { streak: 4, correct: 4, wrong: 0, graduated: true } };
  const q = fillQueue(ITEMS, progress, ['t1', 't2'], { ...S, queueSize: 3 }, seeded());
  assert.ok(!q.includes('t1')); assert.equal(q.length, 3);
});

test('category filter limits the pool and the queue', () => {
  const q = fillQueue(ITEMS, {}, ['t1'], { ...S, categories: ['N'], queueSize: 4 }, seeded());
  assert.ok(q.every((id) => id.startsWith('n'))); assert.equal(q.length, 4);
});

test('queue never exceeds available items and does not loop forever', () => {
  const q = fillQueue(ITEMS.slice(0, 2), {}, [], { ...S, queueSize: 12 }, seeded());
  assert.equal(q.length, 2);
});

test('new round swaps streak 0 items, keeps started streaks', () => {
  const progress = { t1: { streak: 2, correct: 2, wrong: 0, graduated: false } };
  const q = rotateQueue(ITEMS, progress, ['t1', 't2', 't3'], { ...S, queueSize: 3 }, seeded());
  assert.ok(q.includes('t1'));
  assert.ok(!q.includes('t2') && !q.includes('t3')); // replaced by other items
  assert.equal(q.length, 3);
});

test('rotation falls back to dropped items when nothing else exists', () => {
  const q = rotateQueue(ITEMS.slice(0, 2), {}, ['t1', 't2'], { ...S, queueSize: 2 }, seeded());
  assert.equal(q.length, 2);
});

test('pickCard avoids the previous card and respects the category', () => {
  for (let s = 1; s < 40; s++) assert.notEqual(pickCard(['t1', 't2', 't3'], ITEMS, 't1', S, seeded(s)).id, 't1');
  assert.equal(pickCard(['t1'], ITEMS, 't1', S, seeded()).id, 't1');
  assert.equal(pickCard(['t1', 'n1'], ITEMS, null, S, seeded(), 'N').id, 'n1');
  assert.equal(pickCard(['t1'], ITEMS, null, S, seeded(), 'N'), null);
});

test('options: correct always included, no duplicates, right count (500 draws)', () => {
  const rng = seeded(7);
  for (let i = 0; i < 500; i++) {
    const item = ITEMS[i % ITEMS.length];
    const n = 3 + (i % 4);
    const opts = buildOptions(item, { ...S, optionCount: n }, rng);
    assert.equal(opts.length, n);
    assert.ok(opts.includes(item.prep));
    assert.equal(new Set(opts).size, n);
  }
});

test('options: small pool is padded, custom pool respected', () => {
  const item = mk('x', 'V', 'an', 'none');
  const small = buildOptions(item, { ...S, optionCount: 4, prepPool: ['an', 'auf'] }, seeded());
  assert.equal(new Set(small).size, 4); assert.ok(small.includes('an'));
  const custom = buildOptions(item, { ...S, optionCount: 3, prepPool: ['an', 'auf', 'in', 'zwischen'] }, seeded(3));
  assert.ok(custom.every((p) => ['an', 'auf', 'in', 'zwischen'].includes(p)));
});

test('round completes after roundSize answers and resets on an activity event', () => {
  const evs = Array.from({ length: 10 }, (_, i) => ans('t1', true, i));
  assert.equal(isRoundComplete(evs, S), true);
  const done = [...evs, { module: 'prepositions', type: 'activity', kind: 'round', ts: 100 }, ans('t1', true, 101)];
  assert.equal(answersInCurrentRound(done), 1);
  assert.equal(isRoundComplete(done, S), false);
});

test('simulation: 200 random answers never break invariants', () => {
  const rng = seeded(42); const settings = { ...S, queueSize: 4 };
  let progress = {}; let queue = fillQueue(ITEMS, progress, [], settings, rng); let last = null;
  for (let i = 0; i < 200; i++) {
    queue = fillQueue(ITEMS, progress, queue, settings, rng);
    const card = pickCard(queue, ITEMS, last, settings, rng);
    if (!card) { assert.equal(queue.length, 0); break; } // everything graduated
    const opts = buildOptions(card, settings, rng);
    assert.ok(opts.includes(card.prep)); assert.equal(new Set(opts).size, opts.length);
    progress[card.id] = applyAnswer(progress[card.id] ?? { streak: 0, correct: 0, wrong: 0, graduated: false }, rng() < 0.7, settings);
    last = card.id;
    queue = fillQueue(ITEMS, progress, queue, settings, rng); // the app refills right after each answer
    if (i % 10 === 9) queue = rotateQueue(ITEMS, progress, queue, settings, rng);
    assert.equal(new Set(queue).size, queue.length);
    assert.ok(queue.every((id) => !progress[id]?.graduated));
  }
});

test('summarize: counts, accuracy, hardest', () => {
  const p = { t1: { streak: 4, correct: 4, wrong: 1, graduated: true }, t2: { streak: 0, correct: 0, wrong: 3, graduated: false } };
  const s = summarize(ITEMS, p);
  assert.equal(s.graduated, 1); assert.equal(s.hardest[0].id, 't2'); assert.equal(s.accuracy, 4 / 8);
  assert.equal(summarize(ITEMS, {}).accuracy, null);
});
