import test from 'node:test';
import assert from 'node:assert/strict';
import { createEvent, validateEvent, filterEvents } from '../events.js';

const meta = { id: 'x', now: 1000 };

test('creates a valid answer event', () => {
  const e = createEvent('prepositions', { type: 'answer', itemId: 'a', correct: true, ms: 800 }, meta);
  assert.deepEqual(e, { id: 'x', ts: 1000, module: 'prepositions', type: 'answer', itemId: 'a', correct: true, ms: 800 });
});

test('creates an activity event', () => {
  assert.equal(createEvent('prepositions', { type: 'activity', kind: 'round', meta: {} }, meta).kind, 'round');
});

test('rejects invalid events', () => {
  assert.throws(() => createEvent('m', { type: 'answer', itemId: 'a', correct: 'yes', ms: 1 }, meta));
  assert.throws(() => createEvent('m', { type: 'activity' }, meta));
  assert.throws(() => createEvent('m', { type: 'other' }, meta));
  assert.match(validateEvent(null), /Objekt/);
});

test('filterEvents by module, type and since', () => {
  const evs = [
    { module: 'a', type: 'answer', ts: 1 }, { module: 'b', type: 'activity', ts: 5 }, { module: 'a', type: 'activity', ts: 9 },
  ];
  assert.equal(filterEvents(evs, { module: 'a' }).length, 2);
  assert.equal(filterEvents(evs, { type: 'activity', since: 6 }).length, 1);
  assert.equal(filterEvents(evs).length, 3);
});
