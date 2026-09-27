(function(){
  'use strict';
  const TARGET_VERSION=2;let root=null,step=0,draft=null,busy=false,lastCtx=null;
  const steps=['jurisdiction','preferences','account','review'];
  const $=(s,b)=> (b||document).querySelector(s);
  const esc=s=>String(s==null?'':s).replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  function tr(k){return window.AioneI18n?window.AioneI18n.t(k):k}
  function legacyLang(locale){return String(locale||'de-CH').startsWith('it')?'it':String(locale||'').startsWith('en')?'en':'de'}
  function currentLocale(){return draft&&draft.locale||window.AioneContext&&window.AioneContext.get().language||'de-CH'}
  function defaultDraft(ctx){
    const p=(window.AioneLegacyBridge&&window.AioneLegacyBridge.getContext&&window.AioneLegacyBridge.getContext().profile)||{};
    const country=ctx.country||'CH',meta=window.AioneRegions.country(country),accounts=ctx.accounts||[];
    return {country,region:ctx.region||'',municipality:ctx.municipality||'',currency:ctx.baseCurrency||meta.defaultCurrency,locale:ctx.language||'de-CH',accountMode:accounts.length?'existing':'new',primaryAccountId:ctx.primaryAccountId||(accounts[0]&&accounts[0].id)||'',accountName:'',institution:'',openingBalance:'0'};
  }
  function shouldShow(ctx){return !!(ctx&&ctx.email)&&ctx.profileReady===true&&Number(ctx.onboardingVersion||0)<TARGET_VERSION}
  function countryName(code){return window.AioneRegions.country(code).name}
  function regionName(country,code){const r=window.AioneRegions.get(country,code);return r?r.name:code||'—'}
  function progress(){return '<div class="a69-wizard-progress">'+steps.map((x,i)=>'<span class="'+(i===step?'active':i<step?'done':'')+'">'+(i+1)+'</span>').join('')+'</div>'}
  function jurisdiction(){
    const meta=window.AioneRegions.country(draft.country),regions=window.AioneRegions.list(draft.country);
    return '<div class="a69-wizard-copy"><span class="a69-wizard-kicker">'+tr('onboarding.step1.kicker')+'</span><h1>'+tr('onboarding.step1.title')+'</h1><p>'+tr('onboarding.step1.text')+'</p></div><div class="a69-wizard-form"><label>'+tr('onboarding.country')+'<select data-w="country"><option value="CH"'+(draft.country==='CH'?' selected':'')+'>Schweiz</option><option value="DE"'+(draft.country==='DE'?' selected':'')+'>Deutschland</option></select></label><label>'+esc(meta.regionLabel)+'<select data-w="region"><option value="">— '+tr('onboarding.choose')+' —</option>'+regions.map(r=>'<option value="'+r.code+'"'+(r.code===draft.region?' selected':'')+'>'+esc(r.name)+'</option>').join('')+'</select></label><label>'+esc(meta.municipalityLabel)+'<input data-w="municipality" value="'+esc(draft.municipality)+'" placeholder="'+esc(draft.country==='CH'?'z. B. Wittenbach':'z. B. Konstanz')+'"></label><div class="a69-wizard-note">'+tr('onboarding.jurisdiction.help')+'</div></div>';
  }
  function preferences(){
    const german=draft.country==='DE'?['de-DE','Deutsch (Deutschland)']:['de-CH','Deutsch (Schweiz)'];const langOptions=[german,['it-CH','Italiano (Svizzera)'],['en','English']];
    return '<div class="a69-wizard-copy"><span class="a69-wizard-kicker">'+tr('onboarding.step2.kicker')+'</span><h1>'+tr('onboarding.step2.title')+'</h1><p>'+tr('onboarding.step2.text')+'</p></div><div class="a69-wizard-form"><label>'+tr('onboarding.language')+'<select data-w="locale">'+langOptions.map(x=>'<option value="'+x[0]+'"'+(x[0]===draft.locale?' selected':'')+'>'+x[1]+'</option>').join('')+'</select></label><div class="a69-wizard-note">'+tr('onboarding.french.pending')+'</div><label>'+tr('onboarding.currency')+'<select data-w="currency"><option value="CHF"'+(draft.currency==='CHF'?' selected':'')+'>CHF</option><option value="EUR"'+(draft.currency==='EUR'?' selected':'')+'>EUR</option></select></label><div class="a69-wizard-note">'+tr('onboarding.currency.help')+'</div></div>';
  }
  function account(){
    const accounts=(lastCtx&&lastCtx.accounts)||[],has=accounts.length>0;
    let existing=has?'<label>'+tr('onboarding.mainAccount')+'<select data-w="primaryAccountId">'+accounts.map(a=>'<option value="'+a.id+'"'+(a.id===draft.primaryAccountId?' selected':'')+'>'+esc(a.name)+(a.institution?' · '+esc(a.institution):'')+' · '+esc(a.currency)+'</option>').join('')+'</select></label>':'';
    let mode=has?'<div class="a69-wizard-choice"><button type="button" data-account-mode="existing" class="'+(draft.accountMode==='existing'?'active':'')+'">'+tr('onboarding.useExisting')+'</button><button type="button" data-account-mode="new" class="'+(draft.accountMode==='new'?'active':'')+'">'+tr('onboarding.createNew')+'</button></div>':'';
    const newForm='<div class="a69-wizard-new '+(draft.accountMode==='new'?'':'hidden')+'"><label>'+tr('onboarding.accountName')+'<input data-w="accountName" value="'+esc(draft.accountName)+'" placeholder="'+tr('onboarding.accountName.placeholder')+'"></label><label>'+tr('onboarding.bank')+'<input data-w="institution" value="'+esc(draft.institution)+'" placeholder="UBS, Raiffeisen, Sparkasse …"></label><label>'+tr('onboarding.currentBalance')+'<div class="a69-balance-input"><span>'+esc(draft.currency)+'</span><input data-w="openingBalance" inputmode="decimal" type="number" step="0.01" value="'+esc(draft.openingBalance)+'"></div></label><div class="a69-wizard-note">'+tr('onboarding.balance.help')+'</div></div>';
    return '<div class="a69-wizard-copy"><span class="a69-wizard-kicker">'+tr('onboarding.step3.kicker')+'</span><h1>'+tr('onboarding.step3.title')+'</h1><p>'+tr('onboarding.step3.text')+'</p></div><div class="a69-wizard-form">'+mode+(draft.accountMode==='existing'?existing:'')+newForm+'</div>';
  }
  function review(){
    const accounts=(lastCtx&&lastCtx.accounts)||[],acc=accounts.find(a=>a.id===draft.primaryAccountId),accountText=draft.accountMode==='new'?(draft.accountName||tr('onboarding.newAccount')):(acc?acc.name:'—');
    return '<div class="a69-wizard-copy"><span class="a69-wizard-kicker">'+tr('onboarding.step4.kicker')+'</span><h1>'+tr('onboarding.step4.title')+'</h1><p>'+tr('onboarding.step4.text')+'</p></div><div class="a69-review"><div><span>'+tr('onboarding.country')+'</span><strong>'+esc(countryName(draft.country))+'</strong></div><div><span>'+esc(window.AioneRegions.country(draft.country).regionLabel)+'</span><strong>'+esc(regionName(draft.country,draft.region))+'</strong></div><div><span>'+tr('onboarding.municipality')+'</span><strong>'+esc(draft.municipality||'—')+'</strong></div><div><span>'+tr('onboarding.currency')+'</span><strong>'+esc(draft.currency)+'</strong></div><div><span>'+tr('onboarding.mainAccount')+'</span><strong>'+esc(accountText)+'</strong></div></div><div class="a69-wizard-warning">'+tr('onboarding.verify.warning')+'</div>';
  }
  function body(){return [jurisdiction,preferences,account,review][step]()}
  function validate(){
    if(step===0){if(!draft.country)throw new Error(tr('onboarding.error.country'));if(!draft.region)throw new Error(tr('onboarding.error.region'));if(!String(draft.municipality||'').trim())throw new Error(tr('onboarding.error.municipality'))}
    if(step===2){const accounts=(lastCtx&&lastCtx.accounts)||[];if(draft.accountMode==='existing'&&accounts.length&&!draft.primaryAccountId)throw new Error(tr('onboarding.error.account'));if(draft.accountMode==='new'&&!String(draft.accountName||'').trim())throw new Error(tr('onboarding.error.accountName'));const n=Number(draft.openingBalance);if(draft.accountMode==='new'&&!Number.isFinite(n))throw new Error(tr('onboarding.error.balance'))}
  }
  function read(){if(!root)return;root.querySelectorAll('[data-w]').forEach(el=>{draft[el.dataset.w]=el.value})}
  async function next(){if(busy)return;read();try{validate()}catch(e){showError(e.message);return}if(step<steps.length-1){step++;render();return}await finish()}
  function back(){if(busy||step<=0)return;read();step--;render()}
  function showError(msg){const el=root&&$('.a69-wizard-error',root);if(el){el.textContent=msg;el.classList.toggle('hidden',!msg)}}
  async function finish(){
    const b=window.AioneLegacyBridge;if(!b)return;busy=true;render();try{
      const profile={country_code:draft.country,region_code:draft.region,municipality:draft.municipality,base_currency:draft.currency,language_code:legacyLang(draft.locale),primary_account_id:draft.accountMode==='existing'?draft.primaryAccountId:null};
      await b.saveOnboardingProfile(profile);let primary=profile.primary_account_id;
      if(draft.accountMode==='new'){const created=await b.createInitialAccount({name:draft.accountName,institution:draft.institution,opening_balance:Number(draft.openingBalance||0),currency:draft.currency});primary=created.id}
      await b.completeOnboarding(primary);root.classList.add('is-done');setTimeout(()=>{root.remove();root=null;document.body.classList.remove('a69-onboarding-open')},180);window.dispatchEvent(new CustomEvent('aione69:onboarding-complete'));
    }catch(e){busy=false;render();showError(e.message||String(e))}
  }
  function bind(){
    root.addEventListener('change',async e=>{const el=e.target.closest('[data-w]');if(!el)return;const previousCountry=draft.country;read();if(el.dataset.w==='country'){const oldDefault=window.AioneRegions.country(previousCountry||'CH').defaultCurrency,newDefault=window.AioneRegions.country(draft.country).defaultCurrency;if(draft.currency===oldDefault)draft.currency=newDefault;draft.region='';draft.locale=draft.country==='DE'&&draft.locale==='de-CH'?'de-DE':draft.country==='CH'&&draft.locale==='de-DE'?'de-CH':draft.locale;render();return}if(el.dataset.w==='locale'){await window.AioneI18n.setLocale(draft.locale);render();return}render()});
    root.addEventListener('input',e=>{const el=e.target.closest('[data-w]');if(el)draft[el.dataset.w]=el.value});
    root.addEventListener('click',e=>{const m=e.target.closest('[data-account-mode]');if(m){read();draft.accountMode=m.dataset.accountMode;render();return}if(e.target.closest('[data-w-next]'))next();if(e.target.closest('[data-w-back]'))back()})
  }
  function render(){if(!root)return;root.innerHTML='<div class="a69-wizard-card" role="dialog" aria-modal="true" aria-labelledby="a69WizardTitle">'+progress()+'<div class="a69-wizard-body">'+body()+'<div class="a69-wizard-error hidden"></div></div><div class="a69-wizard-actions">'+(step?'<button type="button" class="a69-wizard-secondary" data-w-back '+(busy?'disabled':'')+'>'+tr('onboarding.back')+'</button>':'<span></span>')+'<button type="button" class="a69-wizard-primary" data-w-next '+(busy?'disabled':'')+'>'+(busy?tr('onboarding.saving'):(step===steps.length-1?tr('onboarding.finish'):tr('onboarding.next')))+'</button></div></div>';}
  function open(ctx,force){lastCtx=ctx||window.AioneContext&&window.AioneContext.get();if(!lastCtx||(!force&&!shouldShow(lastCtx)))return;if(root)return;draft=defaultDraft(lastCtx);step=0;root=document.createElement('div');root.id='aione69Onboarding';root.className='a69-wizard-overlay';document.body.appendChild(root);document.body.classList.add('a69-onboarding-open');bind();render()}
  function closeIfCompleted(ctx){
    if(!root||!ctx||ctx.profileReady!==true||shouldShow(ctx))return false;
    root.remove();root=null;document.body.classList.remove('a69-onboarding-open');return true;
  }
  function sync(ctx){lastCtx=ctx;if(closeIfCompleted(ctx))return;if(!root&&shouldShow(ctx))setTimeout(()=>{if(!root&&shouldShow(lastCtx))open(lastCtx,false)},80)}
  window.AioneOnboarding={open:()=>open(window.AioneContext&&window.AioneContext.get(),true),version:TARGET_VERSION};
  if(window.AioneContext)window.AioneContext.onChange(sync);
  window.addEventListener('aione69:locale',()=>{if(root)render()});
})();
