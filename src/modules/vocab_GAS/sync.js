// Network pull for the day list. The only place in the module that touches the network.
import { parsePayload } from './engine.js';

const TIMEOUT_MS = 40000; // Apps Script cold starts plus 7 sheet scans can take 15 s or more

/**
 * @param {{url:string, token:string}} settings
 * @param {typeof fetch} [fetchFn]
 * @returns {Promise<import('./engine.js').DayList>} rejects with a German message
 */
export async function fetchToday({ url, token }, fetchFn = fetch) {
  let target;
  try { target = new URL(url); } catch { throw new Error('Die Web-App-URL ist ungültig.'); }
  target.searchParams.set('t', token);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  let res;
  try {
    res = await fetchFn(target, { signal: ctrl.signal, redirect: 'follow', credentials: 'omit' });
  } catch (err) {
    throw new Error(err?.name === 'AbortError' ? 'Zeitüberschreitung: der Server antwortet nicht (nach 40 s).' : 'Keine Verbindung zum Server.');
  } finally { clearTimeout(timer); }
  if (!res.ok) throw new Error(`Serverfehler (${res.status}).`);
  let json;
  try { json = await res.json(); } catch { throw new Error('Antwort ist kein gültiges JSON (URL und Freigabe prüfen).'); }
  const parsed = parsePayload(json);
  if (!parsed.ok) throw new Error(parsed.error);
  return parsed.data;
}
