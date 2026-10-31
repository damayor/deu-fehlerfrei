import test from 'node:test';
import assert from 'node:assert/strict';

process.env.TZ = 'Europe/Berlin'; // before any Date use: DST days below are Berlin's
const { dayKey, shiftDay, summarizeActivity } = await import('../activity.js');

const at = (iso) => new Date(iso).getTime();
const act = (iso, module = 'prepositions') => ({ module, type: 'activity', kind: 'round', ts: at(iso) });
const twice = (iso) => [act(iso), act(iso, 'mistakes')];

test('empty history', () => {
  const s = summarizeActivity([], 2, at('2026-05-10T12:00:00'));
  assert.deepEqual(s, { today: { count: 0, goal: 2, met: false }, current: 0, best: 0 });
});

test('today pending does not break the streak', () => {
  const ev = [...twice('2026-05-08T10:00:00'), ...twice('2026-05-09T10:00:00'), act('2026-05-10T09:00:00')];
  const s = summarizeActivity(ev, 2, at('2026-05-10T12:00:00'));
  assert.equal(s.today.met, false); assert.equal(s.current, 2);
});

test('meeting the goal today adds today; any module counts', () => {
  const ev = [...twice('2026-05-09T10:00:00'), act('2026-05-10T09:00:00'), act('2026-05-10T11:00:00', 'mistakes')];
  const s = summarizeActivity(ev, 2, at('2026-05-10T12:00:00'));
  assert.equal(s.today.met, true); assert.equal(s.current, 2);
});

test('a missed full day breaks the streak', () => {
  const ev = [...twice('2026-05-07T10:00:00'), ...twice('2026-05-09T10:00:00')];
  const s = summarizeActivity(ev, 2, at('2026-05-10T12:00:00'));
  assert.equal(s.current, 1); assert.equal(s.best, 1);
  assert.equal(summarizeActivity(ev, 2, at('2026-05-11T12:00:00')).current, 0);
});

test('streak across midnight uses local dates', () => {
  const ev = [act('2026-05-09T23:59:00'), act('2026-05-10T00:01:00'), act('2026-05-10T00:02:00'), act('2026-05-11T00:03:00')];
  assert.equal(dayKey(at('2026-05-09T23:59:00')), '2026-05-09');
  assert.equal(dayKey(at('2026-05-10T00:01:00')), '2026-05-10');
  const s = summarizeActivity(ev, 1, at('2026-05-11T08:00:00'));
  assert.equal(s.current, 3);
});

test('DST: spring forward (2026-03-29) and fall back (2026-10-25) keep days consecutive', () => {
  const spring = [...twice('2026-03-28T22:00:00'), ...twice('2026-03-29T03:30:00'), ...twice('2026-03-30T08:00:00')];
  assert.equal(summarizeActivity(spring, 2, at('2026-03-30T20:00:00')).current, 3);
  const fall = [...twice('2026-10-24T22:00:00'), ...twice('2026-10-25T01:30:00'), ...twice('2026-10-26T00:30:00')];
  assert.equal(summarizeActivity(fall, 2, at('2026-10-26T20:00:00')).current, 3);
  assert.equal(shiftDay('2026-03-28', 1), '2026-03-29'); assert.equal(shiftDay('2026-03-29', 1), '2026-03-30');
  assert.equal(shiftDay('2026-10-25', 1), '2026-10-26'); assert.equal(shiftDay('2026-03-01', -1), '2026-02-28');
  assert.equal(shiftDay('2026-12-31', 1), '2027-01-01');
});

test('goal is applied to history; answers do not count; best streak tracked', () => {
  const ev = [act('2026-05-01T10:00:00'), act('2026-05-02T10:00:00'), act('2026-05-03T10:00:00'), act('2026-05-06T10:00:00'),
    { module: 'prepositions', type: 'answer', itemId: 'x', correct: true, ts: at('2026-05-07T10:00:00') }];
  const s = summarizeActivity(ev, 1, at('2026-05-07T12:00:00'));
  assert.equal(s.best, 3); assert.equal(s.current, 1);
  assert.equal(summarizeActivity(ev, 2, at('2026-05-07T12:00:00')).best, 0);
});
