// Pure logic for "Wörter des Tages": validate the endpoint payload and describe slots. No DOM, no storage, no clock.

/** @typedef {{orig:string,frase:string,trad:string}} Word */
/** @typedef {{pos:number,hour:number|null,kind:'meses'|'dias',value:number,words:Word[],englishCount:number}} Slot */
/** @typedef {{date:string,slots:Slot[]}} DayList */

const str = (v) => (typeof v === 'string' ? v.trim() : '');

/** @returns {{ok:true,data:DayList}|{ok:false,error:string}} */
export function parsePayload(payload) {
  if (payload?.error === 'unauthorized') return { ok: false, error: 'Zugriff verweigert. Bitte das Token in den Einstellungen prüfen.' };
  if (!payload || !/^\d{4}-\d{2}-\d{2}$/.test(payload.date ?? '') || !Array.isArray(payload.slots)) {
    return { ok: false, error: 'Unerwartete Antwort vom Server.' };
  }
  const slots = [];
  for (const [i, s] of payload.slots.entries()) {
    if (!['meses', 'dias'].includes(s?.kind) || !Number.isInteger(s.value) || !Array.isArray(s.words)) {
      return { ok: false, error: `Ungültiger Eintrag ${i + 1} in der Antwort.` };
    }
    const words = s.words.map((w) => ({ orig: str(w?.orig), frase: str(w?.frase), trad: str(w?.trad) })).filter((w) => w.orig);
    slots.push({
      pos: Number.isInteger(s.pos) ? s.pos : i + 1,
      hour: Number.isInteger(s.hour) ? s.hour : null,
      kind: s.kind, value: s.value, words,
      englishCount: Number.isInteger(s.englishCount) && s.englishCount > 0 ? s.englishCount : 0,
    });
  }
  return { ok: true, data: { date: payload.date, slots } };
}

/** "vor 8 Monaten", "vor 1 Tag" */
export function slotLabel({ kind, value }) {
  const unit = kind === 'meses' ? (value === 1 ? 'Monat' : 'Monaten') : (value === 1 ? 'Tag' : 'Tagen');
  return `vor ${value} ${unit}`;
}

/** The Telegram alerts fire around minute 23 of the slot hour. */
export function slotStatus(slot, now) {
  if (slot.hour == null) return 'unknown';
  return now.getHours() * 60 + now.getMinutes() >= slot.hour * 60 + 23 ? 'sent' : 'upcoming';
}

export const totalWords = (data) => data.slots.reduce((n, s) => n + s.words.length, 0);
