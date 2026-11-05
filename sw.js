// Keep CACHE_VERSION in step with VERSION in src/config.js.
const CACHE_VERSION = '0.7.2';
const CACHE = `german-trainer-${CACHE_VERSION}`;
const ASSETS = [
  './', 'index.html', 'manifest.webmanifest', 'src/styles.css',
  'src/app.js', 'src/config.js',
  'src/core/store.js', 'src/core/ui.js', 'src/core/events.js', 'src/core/ctx.js',
  'src/core/activity.js', 'src/core/push.js', 'src/core/settings.js', 'src/core/settings-ui.js', 'src/core/backup.js',
  'src/views/shell.js', 'src/views/heute.js', 'src/views/fortschritt.js', 'src/views/settings.js',
  'src/modules/prepositions/index.js', 'src/modules/prepositions/engine.js',
  'src/modules/prepositions/data.js', 'src/modules/prepositions/data.json',
  'src/modules/prepositions/settings.js', 'src/modules/prepositions/views/practice.js', 'src/modules/prepositions/views/mastered.js',
  'src/modules/vocab_GAS/index.js', 'src/modules/vocab_GAS/engine.js', 'src/modules/vocab_GAS/settings.js',
  'src/modules/vocab_GAS/sync.js', 'src/modules/vocab_GAS/views/list.js',
  'icons/badge-96.png', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  // The new worker waits until the user taps "Jetzt aktualisieren" (SKIP_WAITING).
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('message', (e) => { if (e.data === 'SKIP_WAITING') self.skipWaiting(); });

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith((async () => {
    const cached = await caches.match(req, { ignoreSearch: true });
    if (cached) return cached;
    try { return await fetch(req); }
    catch { return req.mode === 'navigate' ? (await caches.match('index.html')) : Response.error(); }
  })());
});

// Streak reminder: the Worker sends an empty push, the text is built here from the streak snapshot the app
// keeps in IndexedDB (cache store, key 'streak-info'). Nothing runs unless a push arrives.
const dayKeyOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** @param {{current:number,endDay:string|null}|null} info @param {number} now ms */
function streakBody(info, now) {
  const today = new Date(now);
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  // The snapshot only counts if the streak still reaches today or yesterday; otherwise it already broke.
  const alive = info?.current > 0 && [dayKeyOf(today), dayKeyOf(yesterday)].includes(info.endDay);
  if (!alive) return 'Heute fehlt noch eine Übung. Starte eine neue Serie!';
  return `🔥 ${info.current} ${info.current === 1 ? 'Tag' : 'Tage'} in Folge. Heute fehlt noch eine Übung, sonst reißt die Serie.`;
}

function readStreakInfo() {
  return new Promise((resolve) => {
    const open = indexedDB.open('german-trainer');
    open.onerror = () => resolve(null);
    open.onsuccess = () => {
      try {
        const get = open.result.transaction('cache').objectStore('cache').get('streak-info');
        get.onsuccess = () => resolve(get.result?.value ?? null);
        get.onerror = () => resolve(null);
      } catch { resolve(null); }
    };
  });
}

self.addEventListener('push', (e) => {
  e.waitUntil((async () => self.registration.showNotification('Fehlerfrei', {
    body: streakBody(await readStreakInfo(), Date.now()),
    icon: 'icons/icon-192.png', badge: 'icons/badge-96.png', tag: 'streak',
  }))());
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil((async () => {
    const open = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (open.length) return open[0].focus();
    return self.clients.openWindow('./index.html#/ueben');
  })());
});
