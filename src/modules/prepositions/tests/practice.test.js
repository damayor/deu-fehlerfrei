import test from 'node:test';
import assert from 'node:assert/strict';
import { splitAtPrep, withBlank } from '../views/practice.js';
import { readFileSync } from 'node:fs';

test('splitAtPrep blanks the last whole-word occurrence', () => {
  const r = splitAtPrep('Ich warte auf eine Antwort auf meine Frage.', 'auf');
  assert.equal(r.before, 'Ich warte auf eine Antwort ');
  assert.equal(r.after, ' meine Frage.');
});

test('splitAtPrep handles separable verbs, contractions and misses', () => {
  assert.equal(splitAtPrep('Ich schließe mich an die Gruppe an.', 'an').after, '.');
  assert.equal(splitAtPrep('Ich stehe dir zur Verfügung.', 'zu').found, 'zur');
  assert.equal(splitAtPrep('Das ist schön.', 'auf'), null);
  assert.equal(splitAtPrep('Er ist daran gewöhnt.', 'an'), null); // no partial words
});

test('every shipped example can be blanked', () => {
  const { items } = JSON.parse(readFileSync(new URL('../data.json', import.meta.url)));
  const bad = items.filter((it) => !splitAtPrep(it.example_de, it.prep)).map((it) => it.id);
  assert.deepEqual(bad, []);
  assert.match(withBlank('arbeiten an', 'an'), /＿/);
});
