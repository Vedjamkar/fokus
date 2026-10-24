// Network first for FOKUS's own files: always try the newest version, and keep a copy for offline.
// GitHub Pages lets browsers reuse files for 10 minutes, which left friends on different versions;
// fetching with cache: 'no-cache' makes the browser check with GitHub every time.
const CACHE = 'fokus-v1';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return; // CDNs, YouTube, relays: untouched
  e.respondWith((async () => {
    try {
      const res = await fetch(req, { cache: 'no-cache' });
      if (res.ok) { const c = await caches.open(CACHE); c.put(req, res.clone()); }
      return res;
    } catch {
      return (await caches.match(req)) || Response.error();
    }
  })());
});
