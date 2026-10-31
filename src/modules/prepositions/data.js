// Data loading and validation for the Prepositions items.

const CATS = ['V', 'N', 'A'];
const TIERS = ['top', 'normal', 'none'];
const CASES = ['Akk', 'Dat'];

/** @returns {string[]} human-readable problems; empty when the data is valid */
export function validateItems(items) {
  if (!Array.isArray(items) || !items.length) return ['Keine Einträge gefunden.'];
  const problems = [];
  const ids = new Set();
  items.forEach((it, i) => {
    const where = `Eintrag ${i + 1} (${it?.id ?? '?'})`;
    if (!it || typeof it.id !== 'string' || !it.id) return problems.push(`${where}: id fehlt.`);
    if (ids.has(it.id)) problems.push(`${where}: doppelte id.`);
    ids.add(it.id);
    if (!CATS.includes(it.cat)) problems.push(`${where}: ungültige Kategorie.`);
    if (typeof it.word !== 'string' || !it.word) problems.push(`${where}: word fehlt.`);
    if (typeof it.prep !== 'string' || !it.prep) problems.push(`${where}: prep fehlt.`);
    if (!TIERS.includes(it.priorityTier)) problems.push(`${where}: ungültige Priorität.`);
    if (it.case != null && !CASES.includes(it.case)) problems.push(`${where}: ungültiger Fall.`);
  });
  return problems;
}

/** Fetch data.json (relative URL, served from the service worker cache when offline). */
export async function loadItems() {
  const res = await fetch(new URL('./data.json', import.meta.url));
  if (!res.ok) throw new Error(`data.json konnte nicht geladen werden (${res.status}).`);
  const { items } = await res.json();
  const problems = validateItems(items);
  if (problems.length) throw new Error('Ungültige Daten: ' + problems.slice(0, 3).join(' '));
  return items;
}
