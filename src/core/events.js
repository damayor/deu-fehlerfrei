// Event creation and validation. Events are append-only; all state is derived from them.

/**
 * @param {string} module module id
 * @param {{type:'answer'|'activity'} & Record<string, any>} fields
 * @param {{id:string, now:number}} meta
 */
export function createEvent(module, fields, { id, now }) {
  const ev = { id, ts: now, module, ...fields };
  const problem = validateEvent(ev);
  if (problem) throw new Error(`Ungültiges Ereignis: ${problem}`);
  return ev;
}

/** @returns {string|null} problem description, or null when valid */
export function validateEvent(ev) {
  if (!ev || typeof ev !== 'object') return 'kein Objekt';
  if (typeof ev.id !== 'string' || !ev.id) return 'id fehlt';
  if (!Number.isFinite(ev.ts)) return 'ts fehlt';
  if (typeof ev.module !== 'string' || !ev.module) return 'module fehlt';
  if (ev.type === 'answer') {
    if (typeof ev.itemId !== 'string' || !ev.itemId) return 'itemId fehlt';
    if (typeof ev.correct !== 'boolean') return 'correct muss boolean sein';
    if (!Number.isFinite(ev.ms) || ev.ms < 0) return 'ms ungültig';
    return null;
  }
  if (ev.type === 'activity') return typeof ev.kind === 'string' && ev.kind ? null : 'kind fehlt';
  return 'unbekannter Typ';
}

/** Filter by any of { module, type, since (ms, inclusive) }. */
export function filterEvents(events, filter = {}) {
  return events.filter((e) => (!filter.module || e.module === filter.module)
    && (!filter.type || e.type === filter.type)
    && (filter.since == null || e.ts >= filter.since));
}
