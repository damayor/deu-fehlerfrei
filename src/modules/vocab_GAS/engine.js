// Pure logic for "Wörter des Tages": validate the endpoint payload and describe slots. No DOM, no storage, no clock.

/** @typedef {'known'|'recalled'|'open'|'new'} State */
/** @typedef {{orig:string,frase:string,trad:string,state:State,badPhrase:boolean}} Word */
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
    const words = s.words.map((w) => ({
      orig: str(w?.orig), frase: str(w?.frase), trad: str(w?.trad), ...wordState(str(w?.wordBg), str(w?.fraseBg)),
    })).filter((w) => w.orig);
    slots.push({
      pos: Number.isInteger(s.pos) ? s.pos : i + 1,
      hour: Number.isInteger(s.hour) ? s.hour : null,
      kind: s.kind, value: s.value, words,
      englishCount: Number.isInteger(s.englishCount) && s.englishCount > 0 ? s.englishCount : 0,
    });
  }
  return { ok: true, data: { date: payload.date, slots } };
}

/**
 * Hue-based so manual shades work too (orange counts as yellow). White, grey and unknown colors count as "none".
 * @returns {'none'|'red'|'yellow'|'green'|'other'}
 */
export function colorKind(hex) {
  const m = /^#([0-9a-f]{6})$/i.exec(hex ?? '');
  if (!m) return 'none';
  const n = parseInt(m[1], 16);
  const [r, g, b] = [n >> 16, (n >> 8) & 255, n & 255];
  const max = Math.max(r, g, b); const d = max - Math.min(r, g, b);
  if (d < 12) return 'none';
  const hue = max === r ? (((g - b) / d + 6) % 6) * 60 : max === g ? ((b - r) / d + 2) * 60 : ((r - g) / d + 4) * 60;
  if (hue < 20 || hue >= 340) return 'red';
  if (hue < 75) return 'yellow';
  return hue < 170 ? 'green' : 'other';
}

/**
 * Learning state from the cell colors the Telegram reactions write (see Telegram.js in the GAS repo):
 * word green = known by heart, word yellow + phrase green = recalled with the phrase,
 * word yellow + phrase yellow = still open, phrase red = the example sentence does not fit.
 * @returns {{state:State, badPhrase:boolean}}
 */
export function wordState(wordBg, fraseBg) {
  const w = colorKind(wordBg); const f = colorKind(fraseBg);
  const badPhrase = f === 'red';
  if (w === 'green') return { state: 'known', badPhrase };
  if (w === 'yellow' || w === 'red') return { state: f === 'green' ? 'recalled' : 'open', badPhrase };
  return { state: 'new', badPhrase };
}

export const STATE_LABEL = { known: 'Sicher', recalled: 'Mit Satz erkannt', open: 'Noch offen', new: 'Neu' };

/** @returns {Record<State, number>} */
export function countStates(data) {
  const c = { known: 0, recalled: 0, open: 0, new: 0 };
  for (const s of data.slots) for (const w of s.words) c[w.state ?? 'new'] += 1;
  return c;
}

/** Date the words were noted: N days or N calendar months before `date` (clamped like restarMeses in the GAS code). */
export function originDate(date, { kind, value }) {
  const [y, m, d] = date.split('-').map(Number);
  if (kind === 'dias') return new Date(y, m - 1, d - value);
  const t = new Date(y, m - 1 - value, d);
  return t.getDate() === d ? t : new Date(y, m - value, 0);
}

/** Split a sentence around the word so the UI can mark it; null when the word does not occur literally. */
export function highlightParts(frase, orig) {
  const i = frase.toLowerCase().indexOf(orig.toLowerCase().replace(/[!?.,;:]+$/, ''));
  if (i === -1 || !orig.replace(/[!?.,;:]+$/, '')) return null;
  const len = orig.replace(/[!?.,;:]+$/, '').length;
  return { before: frase.slice(0, i), match: frase.slice(i, i + len), after: frase.slice(i + len) };
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
