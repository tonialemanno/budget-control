(function(){
  'use strict';
  const cache=new Map();let active='de-CH';let dict={};
  const fallback='de-CH';
  function localeFile(locale){return './src/i18n/'+locale+'.json'}
  async function load(locale){
    locale=locale||fallback;if(cache.has(locale))return cache.get(locale);
    try{const r=await fetch(localeFile(locale),{cache:'no-store'});if(!r.ok)throw new Error('HTTP '+r.status);const d=await r.json();cache.set(locale,d);return d}catch(e){console.warn('aione i18n',locale,e);return{}}
  }
  async function setLocale(locale){
    const supported=['de-CH','fr-CH','it-CH','en','de-DE'];
    active=supported.includes(locale)?locale:fallback;
    dict=await load(active);
    document.documentElement.lang=active;
    window.dispatchEvent(new CustomEvent('aione69:locale',{detail:{locale:active}}));
    return active;
  }
  function t(key,vars){
    let value=dict[key]||key;vars=vars||{};
    Object.keys(vars).forEach(k=>{value=String(value).replaceAll('{'+k+'}',String(vars[k]))});return value;
  }
  function getLocale(){return active}
  window.AioneI18n={load,setLocale,t,getLocale};
  const initial=window.AioneContext?window.AioneContext.get().language:fallback;setLocale(initial);
  if(window.AioneContext)window.AioneContext.onChange(ctx=>{if(ctx.language!==active)setLocale(ctx.language)});
})();
