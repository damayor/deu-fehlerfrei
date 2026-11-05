// Pure scheduling logic for the streak reminder. No network, no storage, no clock (now is an argument).

/** Local calendar day ('YYYY-MM-DD') and hour (0-23) of a timestamp in an IANA time zone. */
export function localParts(now, tz) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(now));
  const get = (t) => parts.find((p) => p.type === t).value;
  return { day: `${get('year')}-${get('month')}-${get('day')}`, hour: Number(get('hour')) };
}

export const isValidTz = (tz) => {
  try { new Intl.DateTimeFormat('en', { timeZone: tz }); return typeof tz === 'string' && tz.length > 0; } catch { return false; }
};

/**
 * Should this subscription get a reminder now?
 * Yes when it is past the reminder hour, the daily goal is not met today and none was sent today.
 * @param {{hour:number, tz:string, metDay:string|null, lastSentDay:string|null}} sub
 */
export function isDue(sub, now) {
  const { day, hour } = localParts(now, sub.tz);
  return hour >= sub.hour && sub.metDay !== day && sub.lastSentDay !== day;
}
