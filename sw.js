const APP_ASSET_RE=/\.(?:js|css|json|html)$/i;

self.addEventListener('install',()=>{ self.skipWaiting(); });

self.addEventListener('activate',(event)=>{
  event.waitUntil(
    caches.keys()
      .then((keys)=>Promise.all(keys.filter((key)=>/^finance[-:]/i.test(key)||/budget-control/i.test(key)).map((key)=>caches.delete(key))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch',(event)=>{
  const request=event.request;
  if(request.method!=='GET') return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin) return;
  const isNavigation=request.mode==='navigate';
  const protectedAsset=APP_ASSET_RE.test(url.pathname)
    || url.pathname.endsWith('/runtime-config.js')
    || url.pathname.endsWith('/release.json');
  if(!isNavigation&&!protectedAsset) return;

  event.respondWith(fetch(request,{cache:'no-store'}));
});
