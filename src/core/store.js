// IndexedDB wrapper. Database `german-trainer`; stores: events, settings, cache, errors.

const DB_NAME = 'german-trainer';
const DB_VERSION = 1;
const STORES = { events: 'id', settings: 'key', cache: 'key', errors: 'id' };

/** @type {Promise<IDBDatabase>|null} */
let dbPromise = null;

function openDb() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      if (!('indexedDB' in globalThis)) {
        reject(new Error('IndexedDB ist auf diesem Gerät nicht verfügbar.'));
        return;
      }
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        for (const [name, keyPath] of Object.entries(STORES)) {
          if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(new Error('Datenbank konnte nicht geöffnet werden: ' + req.error?.message));
      req.onblocked = () => reject(new Error('Datenbank ist blockiert. Bitte andere Tabs der App schließen.'));
    });
    dbPromise.catch(() => { dbPromise = null; });
  }
  return dbPromise;
}

/** Run one request inside a transaction and resolve when the transaction commits. */
async function run(store, mode, makeRequest) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const req = makeRequest(tx.objectStore(store));
    tx.oncomplete = () => resolve(req.result);
    tx.onerror = () => reject(new Error(`Speichern fehlgeschlagen (${store}): ${tx.error?.message}`));
    tx.onabort = () => reject(new Error(`Speichern abgebrochen (${store}): ${tx.error?.message}`));
  });
}

export const put = (store, value) => run(store, 'readwrite', (s) => s.put(value));
export const get = (store, key) => run(store, 'readonly', (s) => s.get(key));
export const getAll = (store) => run(store, 'readonly', (s) => s.getAll());
export const clear = (store) => run(store, 'readwrite', (s) => s.clear());
export const del = (store, key) => run(store, 'readwrite', (s) => s.delete(key));

/** Atomically replace the whole content of a store: either all of it is written or none. */
export async function replaceAll(store, values) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    const s = tx.objectStore(store);
    s.clear();
    for (const v of values) s.put(v);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(new Error(`Speichern fehlgeschlagen (${store}): ${tx.error?.message}`));
    tx.onabort = () => reject(new Error(`Speichern abgebrochen (${store}): ${tx.error?.message}`));
  });
}

export function newId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Record an error. Never throws: logging must not cause a second failure. */
export async function logError(source, err) {
  try {
    await put('errors', {
      id: newId(), ts: Date.now(), source,
      message: String(err?.message ?? err), stack: String(err?.stack ?? ''),
    });
  } catch { /* ignore */ }
}

/** Ask the browser not to evict our data. Returns true if granted. */
export async function requestPersistence() {
  const timeout = new Promise((resolve) => setTimeout(() => resolve(false), 1500));
  try { return (await Promise.race([navigator.storage?.persist?.() ?? false, timeout])) ?? false; } catch { return false; }
}

/** Write, read back and delete a probe record. Throws a German message when storage does not really work. */
export async function probe() {
  const key = '__probe';
  const value = String(Date.now());
  await put('cache', { key, value });
  const back = await get('cache', key);
  await del('cache', key);
  if (back?.value !== value) throw new Error('Gespeicherte Daten konnten nicht gelesen werden.');
}
