const CACHE = 'budget-control-v65-1-admin-bootstrap-1';
const APP_SHELL = ['./','./index.html','./manifest.webmanifest','./icon-192.png','./icon-512.png'];
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(async cache => {
        for (const url of APP_SHELL) {
          const res = await fetch(url, { cache: 'reload' });
          if (res.ok) await cache.put(url, res.clone());
        }
      })
      .then(() => self.skipWaiting())
  );
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req, { cache: 'no-store' })
        .then(res => { const copy=res.clone(); caches.open(CACHE).then(c=>c.put('./index.html',copy)); return res; })
        .catch(()=>caches.match('./index.html'))
    );
    return;
  }
  if (url.pathname.endsWith('/sw.js')) return;
  event.respondWith(caches.match(req).then(hit => hit || fetch(req, { cache: 'no-cache' }).then(res => { if (res.ok) caches.open(CACHE).then(c=>c.put(req,res.clone())); return res; })));
});
