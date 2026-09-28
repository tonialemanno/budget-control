const CACHE = 'aione-v69-0-0-beta-11';
const APP_SHELL = ['./','./index.html','./manifest.webmanifest','./icon-192.png','./icon-512.png','./src/styles/legacy-core.css','./src/styles/luxury-layer.css','./src/styles/legacy-overrides.css','./src/styles/beta69-shell.css','./src/styles/onboarding-wizard.css','./src/styles/debt-enforcement.css','./src/styles/beta69-ux.css','./src/js/bootstrap-errors.js','./src/core/region-registry.js','./src/js/app.js','./src/core/app-context.js','./src/core/money.js','./src/core/i18n.js','./src/core/module-registry.js','./src/components/desktop-shell.js','./src/components/onboarding-wizard.js','./src/components/beta69-ux.js','./src/features/debt-enforcement-ch.js','./src/i18n/de-CH.json','./src/i18n/fr-CH.json','./src/i18n/it-CH.json','./src/i18n/en.json','./src/i18n/de-DE.json'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
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
    event.respondWith(fetch(req,{cache:'no-store'}).then(res => { const copy=res.clone(); caches.open(CACHE).then(c=>c.put('./index.html',copy)); return res; }).catch(()=>caches.match('./index.html')));
    return;
  }
  event.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => { if(res.ok) caches.open(CACHE).then(c=>c.put(req,res.clone())); return res; })));
});
