(function () {
  'use strict';

  const FALLBACK_BUILD='2026.10.04.1252';
  const MANIFEST_URL='./release.json';

  function cacheBust(url, buildId) {
    const next=new URL(url,location.href);
    next.searchParams.set('build',buildId);
    return next.href;
  }

  async function readManifest() {
    try {
      const response=await fetch(`${MANIFEST_URL}?t=${Date.now()}`,{cache:'no-store',credentials:'same-origin'});
      if(!response.ok) throw new Error(`release manifest ${response.status}`);
      const manifest=await response.json();
      if(!manifest?.buildId) throw new Error('release manifest without build id');
      return manifest;
    } catch {
      return {app:'Finance',version:'2.4.0',buildId:FALLBACK_BUILD,schemaVersion:1,releasedAt:null};
    }
  }

  async function clearFinanceCaches() {
    if(!('caches' in window)) return;
    const keys=await caches.keys();
    await Promise.all(keys.filter((key)=>/^finance[-:]/i.test(key)||/budget-control/i.test(key)).map((key)=>caches.delete(key)));
  }

  async function ensureNetworkWorker(buildId) {
    if(!('serviceWorker' in navigator)) return false;
    try {
      const registration=await navigator.serviceWorker.register(`./sw.js?build=${encodeURIComponent(buildId)}`,{scope:'./',updateViaCache:'none'});
      await registration.update().catch(()=>null);
      if(navigator.serviceWorker.controller) return true;

      await Promise.race([
        new Promise((resolve)=>{
          const done=()=>{navigator.serviceWorker.removeEventListener('controllerchange',done);resolve();};
          navigator.serviceWorker.addEventListener('controllerchange',done,{once:true});
        }),
        new Promise((resolve)=>setTimeout(resolve,2200)),
      ]);
      return Boolean(navigator.serviceWorker.controller);
    } catch {
      return false;
    }
  }

  function refreshStyles(buildId) {
    for(const link of document.querySelectorAll('link[rel="stylesheet"][href]')){
      const raw=link.getAttribute('href');
      if(!raw||/^https?:/i.test(raw)) continue;
      link.href=cacheBust(raw,buildId);
    }
  }

  function loadModule(src,buildId) {
    return new Promise((resolve,reject)=>{
      const script=document.createElement('script');
      script.type='module';
      script.src=cacheBust(src,buildId);
      script.onload=resolve;
      script.onerror=()=>reject(new Error(`Modul konnte nicht geladen werden: ${src}`));
      document.body.appendChild(script);
    });
  }

  async function boot() {
    const manifest=await readManifest();
    window.__FINANCE_RELEASE__=Object.freeze({...manifest});

    await clearFinanceCaches().catch(()=>null);
    await ensureNetworkWorker(manifest.buildId);
    refreshStyles(manifest.buildId);

    try {
      await loadModule('./assets/js/main.js',manifest.buildId);
      await Promise.all([
        loadModule('./assets/js/app/receipt-controller.js',manifest.buildId),
        loadModule('./assets/js/app/document-preview.js',manifest.buildId),
      ]);
    } catch (error) {
      const gate=document.querySelector('#authGate');
      if(gate){
        gate.hidden=false;
        gate.innerHTML='<div style="max-width:520px;width:100%;padding:24px;border-radius:20px;background:#fff;color:#111;box-shadow:0 12px 40px rgba(0,0,0,.12);font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif"><strong style="display:block;font-size:22px;margin-bottom:8px">Finance</strong><span style="display:block;font-size:15px;line-height:1.5">Die aktuelle Finance-Version konnte nicht vollständig geladen werden. Bitte die Seite neu laden.</span></div>';
      }
      console.error(error);
    }
  }

  void boot();
})();