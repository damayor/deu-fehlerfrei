// Daily goal and streak, derived from `activity` events. Pure: no storage, no clock (now is an argument).
// Days are the device's LOCAL calendar dates, so a streak survives midnight and DST shifts.

/** Local date key 'YYYY-MM-DD' for a timestamp in ms. */
export function dayKey(ts) {
  const d = new Date(ts);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Calendar arithmetic on a date key (UTC math, so 23h/25h DST days cannot skew it). */
export function shiftDay(key, days) {
  const [y, m, d] = key.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return t.toISOString().slice(0, 10);
}

/** @returns {Map<string, number>} activities per local day, counting every module */
export function activitiesPerDay(events) {
  const perDay = new Map();
  for (const e of events) {
    if (e.type !== 'activity') continue;
    const k = dayKey(e.ts);
    perDay.set(k, (perDay.get(k) ?? 0) + 1);
  }
  return perDay;
}

/**
 * @param {{type:string, ts:number}[]} events
 * @param {number} goal activities needed per day
 * @param {number} now ms
 * @returns {{today:{count:number,goal:number,met:boolean}, current:number, best:number}}
 */
export function summarizeActivity(events, goal, now) {
  const perDay = activitiesPerDay(events);
  const today = dayKey(now);
  const met = (k) => (perDay.get(k) ?? 0) >= goal;

  // Today is pending until met: it does not break the streak, and only counts once met.
  let current = 0;
  let k = met(today) ? today : shiftDay(today, -1);
  while (met(k)) { current += 1; k = shiftDay(k, -1); }

  let best = 0; let run = 0; let prev = null;
  for (const day of [...perDay.keys()].filter(met).sort()) {
    run = prev && shiftDay(prev, 1) === day ? run + 1 : 1;
    best = Math.max(best, run);
    prev = day;
  }

  return { today: { count: perDay.get(today) ?? 0, goal, met: met(today) }, current, best: Math.max(best, current) };
}
