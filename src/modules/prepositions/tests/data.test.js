import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateItems } from '../data.js';

const { items } = JSON.parse(readFileSync(new URL('../data.json', import.meta.url), 'utf8'));

test('shipped data.json is valid', () => {
  assert.deepEqual(validateItems(items), []);
  assert.equal(items.length, 101);
});

test('every item has an example, a case, and a preposition contained in its word', () => {
  for (const it of items) {
    assert.ok(it.example_de && it.example_es, `${it.id} needs example`);
    assert.ok(it.case, `${it.id} needs case`);
  }
});

test('validation catches broken data', () => {
  assert.ok(validateItems([]).length);
  const bad = [{ id: 'a', cat: 'X', word: 'w', prep: 'an', priorityTier: 'top' }, { id: 'a', cat: 'V', word: '', prep: 'an', priorityTier: 'x' }];
  assert.ok(validateItems(bad).length >= 4);
});
