(function(){
  'use strict';
  const listeners=new Set();
  const state={
    country:'CH',countryRaw:'Schweiz',region:null,municipality:null,municipalityId:null,
    baseCurrency:'CHF',language:'de-CH',email:null,role:null,features:{},version:'69.0.0-beta.2'
  };
  function normalizeCountry(raw){
    const v=String(raw||'').trim().toLowerCase();
    if(['de','deutschland','germany'].includes(v))return'DE';
    if(['ch','schweiz','suisse','svizzera','switzerland'].includes(v))return'CH';
    return v?String(raw).trim().toUpperCase().slice(0,2):'CH';
  }
  function normalizeLanguage(raw,country){
    const v=String(raw||'de').trim();
    if(v==='de')return country==='DE'?'de-DE':'de-CH';
    if(v==='it')return country==='CH'?'it-CH':'it';
    if(v==='fr')return country==='CH'?'fr-CH':'fr';
    if(v==='en')return'en';
    return v;
  }
  function snapshot(){return JSON.parse(JSON.stringify(state))}
  function emit(){const snap=snapshot();listeners.forEach(fn=>{try{fn(snap)}catch(e){console.warn('AioneContext listener',e)}});window.dispatchEvent(new CustomEvent('aione69:context',{detail:snap}))}
  function sync(payload){
    payload=payload||{};const p=payload.profile||payload;
    const country=normalizeCountry(p.country_code||p.country||state.countryRaw);
    state.country=country;state.countryRaw=p.country||state.countryRaw;
    state.region=p.canton_code||p.canton||p.region_code||p.region||state.region||null;
    state.municipality=p.municipality||p.city||state.municipality||null;
    state.municipalityId=p.municipality_bfs||p.municipality_id||state.municipalityId||null;
    state.baseCurrency=String(p.base_currency||state.baseCurrency||'CHF').toUpperCase();
    state.language=normalizeLanguage(p.language_code||state.language,country);
    state.email=payload.email||p.email||state.email||null;
    state.role=payload.role||state.role||null;
    state.features=Object.assign({},payload.features||state.features||{});
    emit();return snapshot();
  }
  function onChange(fn){if(typeof fn==='function'){listeners.add(fn);fn(snapshot())}return()=>listeners.delete(fn)}
  window.AioneContext={get:snapshot,sync,onChange,normalizeCountry,normalizeLanguage};
  window.addEventListener('aione:legacy-context',e=>sync(e.detail||{}));
  if(window.AioneLegacyBridge&&window.AioneLegacyBridge.getContext)sync(window.AioneLegacyBridge.getContext());
})();
