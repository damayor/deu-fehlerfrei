// Keep CACHE_VERSION in step with VERSION in src/config.js.
const CACHE_VERSION = '0.4.0';
const CACHE = `german-trainer-${CACHE_VERSION}`;
const ASSETS = [
  './', 'index.html', 'manifest.webmanifest', 'src/styles.css',
  'src/app.js', 'src/config.js',
  'src/core/store.js', 'src/core/ui.js', 'src/core/events.js', 'src/core/ctx.js',
  'src/core/activity.js', 'src/core/settings.js', 'src/core/settings-ui.js', 'src/core/backup.js',
  'src/views/shell.js', 'src/views/heute.js', 'src/views/settings.js',
  'src/modules/prepositions/index.js', 'src/modules/prepositions/engine.js',
  'src/modules/prepositions/data.js', 'src/modules/prepositions/data.json',
  'src/modules/prepositions/settings.js', 'src/modules/prepositions/views/practice.js',
  'src/modules/vocab_GAS/index.js', 'src/modules/vocab_GAS/engine.js', 'src/modules/vocab_GAS/settings.js',
  'src/modules/vocab_GAS/sync.js', 'src/modules/vocab_GAS/views/list.js',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png',
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
