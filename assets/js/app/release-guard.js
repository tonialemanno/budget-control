export const RELEASE_CHECK_INTERVAL_MS = 5*60_000;

export async function fetchReleaseManifest(url='/version.json',fetchImpl=globalThis.fetch) {
  if(typeof fetchImpl!=='function') throw new Error('Versionsprüfung ist nicht verfügbar.');
  const response=await fetchImpl(url,{cache:'no-store',headers:{'Cache-Control':'no-cache'}});
  if(!response.ok) throw new Error(`Versionsprüfung fehlgeschlagen (${response.status}).`);
  const manifest=await response.json();
  return {
    releaseId:String(manifest?.releaseId||'').trim(),
    version:String(manifest?.version||'').trim(),
    schemaVersion:Number(manifest?.schemaVersion||0),
    releasedAt:String(manifest?.releasedAt||'').trim(),
  };
}

export function releaseMismatch(localReleaseId,manifest) {
  const remote=String(manifest?.releaseId||'').trim();
  const local=String(localReleaseId||'').trim();
  return Boolean(remote&&local&&remote!==local);
}

export function schemaCompatibility(clientSchemaVersion,runtimeState) {
  const client=Number(clientSchemaVersion||0);
  const server=Number(runtimeState?.schema_version||runtimeState?.schemaVersion||0);
  const minClient=Number(runtimeState?.min_client_schema||runtimeState?.minClientSchema||0);
  if(minClient>0&&client<minClient) return {ok:false,reason:'client_too_old',client,server,minClient};
  if(server>0&&client>server) return {ok:false,reason:'server_too_old',client,server,minClient};
  return {ok:true,reason:null,client,server,minClient};
}

export async function clearFinanceCaches() {
  if(typeof caches!=='undefined'&&caches?.keys){
    const keys=await caches.keys();
    await Promise.all(keys.map((key)=>caches.delete(key)));
  }
  if(typeof navigator!=='undefined'&&navigator.serviceWorker?.getRegistrations){
    const registrations=await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration)=>registration.unregister()));
  }
}

export function releaseReloadUrl(locationLike,releaseId) {
  const href=String(locationLike?.href||'');
  const url=new URL(href);
  url.searchParams.set('finance_release',String(releaseId||Date.now()));
  return url.toString();
}
