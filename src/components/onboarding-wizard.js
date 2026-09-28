(function(){
  'use strict';

  const TARGET_VERSION=3;
  const steps=['welcome','jurisdiction','account','debts','categories','review'];
  let root=null,step=0,draft=null,busy=false,lastCtx=null;

  const $=(s,b)=> (b||document).querySelector(s);
  const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const tr=(k,v)=>window.AioneI18n?window.AioneI18n.t(k,v):k;
  const finance=()=>window.AioneCountryFinance||null;
  const num=v=>{const n=Number(v);return Number.isFinite(n)?n:0};
  const money=(v,currency)=>new Intl.NumberFormat(document.documentElement.lang||'de-CH',{style:'currency',currency:currency||'CHF'}).format(num(v));
  const existingAssetAccounts=ctx=>(ctx&&ctx.accounts||[]).filter(a=>a.active!==false&&a.asset_class==='asset'&&['bank','savings'].includes(a.account_type));
  const existingLiabilities=ctx=>(ctx&&ctx.accounts||[]).filter(a=>a.active!==false&&a.asset_class==='liability');

  function currentLocale(){return draft&&draft.locale||window.AioneContext&&window.AioneContext.get().language||'de-CH'}
  function legacyLang(locale){return String(locale||'de-CH').startsWith('it')?'it':String(locale||'').startsWith('en')?'en':'de'}
  function accountById(id){return (lastCtx&&lastCtx.accounts||[]).find(a=>a.id===id)||null}
  function defaultDebtType(country){return country==='CH'?'loan':'loan'}
  function debtTypeLabel(value){const rows=finance()?finance().debtTypes(draft.country):[];const r=rows.find(x=>x.value===value);return r?r.label:value}
  function selectedAccount(){return draft.accountMode==='existing'?accountById(draft.primaryAccountId):null}

  function defaultDraft(ctx){
    const p=(ctx&&ctx.profile)||{};
    const country=ctx.country||'CH';
    const meta=window.AioneRegions.country(country);
    const assetAccounts=existingAssetAccounts(ctx);
    const primary=assetAccounts.find(a=>a.id===(ctx.primaryAccountId||p.primary_account_id))||assetAccounts[0]||null;
    const liabilities=existingLiabilities(ctx).map(a=>({
      id:a.id,
      existing:true,
      type:a.account_type||'other_liability',
      name:a.name||'',
      institution:a.institution||'',
      outstanding:String(Math.abs(num(a.balance))),
      monthlyPayment:'',
      dueDay:'1'
    }));
    const existingCategories=Array.isArray(ctx.categories)?ctx.categories:[];
    return {
      country,
      region:ctx.region||'',
      municipality:ctx.municipality||'',
      currency:ctx.baseCurrency||meta.defaultCurrency,
      locale:ctx.language||'de-CH',
      accountMode:primary?'existing':'new',
      primaryAccountId:primary?primary.id:'',
      accountName:primary?primary.name:'',
      institution:primary?primary.institution||'':'',
      currentBalance:primary?String(num(primary.balance)):'0',
      debtMode:liabilities.length?'yes':'none',
      debts:liabilities,
      categoryMode:existingCategories.length?'keep':'recommended'
    };
  }

  function shouldShow(ctx){return !!(ctx&&ctx.email)&&ctx.profileReady===true&&Number(ctx.onboardingVersion||0)<TARGET_VERSION}
  function countryName(code){return window.AioneRegions.country(code).name}
  function regionName(country,code){const r=window.AioneRegions.get(country,code);return r?r.name:code||'—'}
  function progress(){return '<div class="a69-wizard-progress">'+steps.map((x,i)=>'<span class="'+(i===step?'active':i<step?'done':'')+'">'+(i+1)+'</span>').join('')+'</div>'}

  function welcome(){
    return '<div class="a69-wizard-copy a12-welcome"><span class="a69-wizard-kicker">'+tr('onboarding.v3.welcome.kicker')+'</span><h1 id="a69WizardTitle">'+tr('onboarding.v3.welcome.title')+'</h1><p>'+tr('onboarding.v3.welcome.text')+'</p></div><div class="a12-principles"><div><strong>'+tr('onboarding.v3.welcome.p1.title')+'</strong><span>'+tr('onboarding.v3.welcome.p1.text')+'</span></div><div><strong>'+tr('onboarding.v3.welcome.p2.title')+'</strong><span>'+tr('onboarding.v3.welcome.p2.text')+'</span></div><div><strong>'+tr('onboarding.v3.welcome.p3.title')+'</strong><span>'+tr('onboarding.v3.welcome.p3.text')+'</span></div></div>';
  }

  function jurisdiction(){
    const meta=window.AioneRegions.country(draft.country),regions=window.AioneRegions.list(draft.country);
    return '<div class="a69-wizard-copy"><span class="a69-wizard-kicker">'+tr('onboarding.v3.country.kicker')+'</span><h1 id="a69WizardTitle">'+tr('onboarding.v3.country.title')+'</h1><p>'+tr('onboarding.v3.country.text')+'</p></div><div class="a69-wizard-form"><label>'+tr('onboarding.country')+'<select data-w="country"><option value="CH"'+(draft.country==='CH'?' selected':'')+'>Schweiz</option><option value="DE"'+(draft.country==='DE'?' selected':'')+'>Deutschland</option></select></label><label>'+esc(meta.regionLabel)+'<select data-w="region"><option value="">— '+tr('onboarding.choose')+' —</option>'+regions.map(r=>'<option value="'+r.code+'"'+(r.code===draft.region?' selected':'')+'>'+esc(r.name)+'</option>').join('')+'</select></label><label>'+esc(meta.municipalityLabel)+'<input data-w="municipality" value="'+esc(draft.municipality)+'" placeholder="'+esc(draft.country==='CH'?'z. B. Wittenbach':'z. B. Konstanz')+'"></label><label>'+tr('onboarding.language')+'<select data-w="locale">'+languageOptions().map(x=>'<option value="'+x[0]+'"'+(x[0]===draft.locale?' selected':'')+'>'+esc(x[1])+'</option>').join('')+'</select></label><label>'+tr('onboarding.currency')+'<select data-w="currency"><option value="CHF"'+(draft.currency==='CHF'?' selected':'')+'>CHF</option><option value="EUR"'+(draft.currency==='EUR'?' selected':'')+'>EUR</option></select></label><div class="a69-wizard-note">'+tr('onboarding.v3.country.help')+'</div></div>';
  }

  function languageOptions(){
    const german=draft.country==='DE'?['de-DE','Deutsch (Deutschland)']:['de-CH','Deutsch (Schweiz)'];
    return [german,['fr-CH','Français (Suisse)'],['it-CH','Italiano (Svizzera)'],['en','English']];
  }

  function account(){
    const assetAccounts=existingAssetAccounts(lastCtx),has=assetAccounts.length>0;
    const chosen=selectedAccount();
    const mode=has?'<div class="a69-wizard-choice"><button type="button" data-account-mode="existing" class="'+(draft.accountMode==='existing'?'active':'')+'">'+tr('onboarding.v3.account.useExisting')+'</button><button type="button" data-account-mode="new" class="'+(draft.accountMode==='new'?'active':'')+'">'+tr('onboarding.v3.account.createNew')+'</button></div>':'';
    const existing=draft.accountMode==='existing'&&has?'<label>'+tr('onboarding.mainAccount')+'<select data-w="primaryAccountId">'+assetAccounts.map(a=>'<option value="'+a.id+'"'+(a.id===draft.primaryAccountId?' selected':'')+'>'+esc(a.name)+(a.institution?' · '+esc(a.institution):'')+' · '+esc(a.currency)+'</option>').join('')+'</select></label>':'';
    const accountFields=draft.accountMode==='new'?'<label>'+tr('onboarding.accountName')+'<input data-w="accountName" value="'+esc(draft.accountName)+'" placeholder="'+tr('onboarding.accountName.placeholder')+'"></label><label>'+tr('onboarding.bank')+'<input data-w="institution" value="'+esc(draft.institution)+'" placeholder="'+esc(draft.country==='CH'?'UBS, Raiffeisen, PostFinance …':'Sparkasse, Volksbank, ING …')+'"></label>':'';
    const balanceCurrency=(chosen&&chosen.currency)||draft.currency;
    return '<div class="a69-wizard-copy"><span class="a69-wizard-kicker">'+tr('onboarding.v3.account.kicker')+'</span><h1 id="a69WizardTitle">'+tr('onboarding.v3.account.title')+'</h1><p>'+tr('onboarding.v3.account.text')+'</p></div><div class="a69-wizard-form">'+mode+existing+accountFields+'<label class="span2">'+tr('onboarding.v3.account.balanceLabel')+'<div class="a69-balance-input"><span>'+esc(balanceCurrency)+'</span><input data-w="currentBalance" inputmode="decimal" type="number" step="0.01" value="'+esc(draft.currentBalance)+'"></div></label><div class="a12-separation-note"><strong>'+tr('onboarding.v3.account.separate.title')+'</strong><span>'+tr('onboarding.v3.account.separate.text')+'</span></div></div>';
  }

  function debtRow(row,index){
    const types=finance()?finance().debtTypes(draft.country):[];
    return '<div class="a12-debt-row" data-debt-row="'+index+'"><div class="a12-debt-row-head"><strong>'+(row.existing?tr('onboarding.v3.debt.existing'):tr('onboarding.v3.debt.new'))+'</strong>'+(!row.existing?'<button type="button" class="a12-link danger" data-remove-debt="'+index+'">'+tr('onboarding.v3.debt.remove')+'</button>':'')+'</div><div class="a12-debt-grid"><label>'+tr('onboarding.v3.debt.type')+'<select data-debt-field="type" data-debt-index="'+index+'">'+types.map(t=>'<option value="'+t.value+'"'+(t.value===row.type?' selected':'')+'>'+esc(t.label)+'</option>').join('')+'</select></label><label>'+tr('onboarding.v3.debt.name')+'<input data-debt-field="name" data-debt-index="'+index+'" value="'+esc(row.name)+'" placeholder="'+tr('onboarding.v3.debt.name.placeholder')+'"></label><label>'+tr('onboarding.v3.debt.outstanding')+'<div class="a69-balance-input"><span>'+esc(draft.currency)+'</span><input type="number" min="0" step="0.01" data-debt-field="outstanding" data-debt-index="'+index+'" value="'+esc(row.outstanding)+'"></div></label><label>'+tr('onboarding.v3.debt.monthly')+'<div class="a69-balance-input"><span>'+esc(draft.currency)+'</span><input type="number" min="0" step="0.01" data-debt-field="monthlyPayment" data-debt-index="'+index+'" value="'+esc(row.monthlyPayment)+'" placeholder="0"></div></label><label>'+tr('onboarding.v3.debt.day')+'<input type="number" min="1" max="31" data-debt-field="dueDay" data-debt-index="'+index+'" value="'+esc(row.dueDay||'1')+'"></label></div></div>';
  }

  function debts(){
    const hasExisting=draft.debts.some(x=>x.existing),showRows=hasExisting||draft.debtMode==='yes',rows=showRows?draft.debts:[];
    const choice=hasExisting?'<div class="a69-wizard-note strong">'+tr('onboarding.v3.debt.reviewExisting',{count:draft.debts.filter(x=>x.existing).length})+'</div>':'<div class="a69-wizard-choice"><button type="button" data-debt-mode="none" class="'+(draft.debtMode==='none'?'active':'')+'">'+tr('onboarding.v3.debt.none')+'</button><button type="button" data-debt-mode="yes" class="'+(draft.debtMode==='yes'?'active':'')+'">'+tr('onboarding.v3.debt.yes')+'</button></div>';
    return '<div class="a69-wizard-copy"><span class="a69-wizard-kicker">'+tr('onboarding.v3.debt.kicker')+'</span><h1 id="a69WizardTitle">'+tr('onboarding.v3.debt.title')+'</h1><p>'+tr('onboarding.v3.debt.text')+'</p></div><div class="a69-wizard-form">'+choice+(showRows?'<div class="a12-debt-list">'+(rows.length?rows.map(debtRow).join(''):'<div class="a69-wizard-note">'+tr('onboarding.v3.debt.empty')+'</div>')+'<button type="button" class="a12-add-row" data-add-debt>+ '+tr('onboarding.v3.debt.add')+'</button></div>':'<div class="a69-wizard-note">'+tr('onboarding.v3.debt.noneHelp')+'</div>')+'<div class="a12-separation-note"><strong>'+tr('onboarding.v3.debt.separate.title')+'</strong><span>'+tr('onboarding.v3.debt.separate.text')+'</span></div></div>';
  }

  function categories(){
    const existing=Array.isArray(lastCtx&&lastCtx.categories)?lastCtx.categories:[];
    const starter=finance()?finance().starterCategories(draft.country):[];
    const preview=starter.slice(0,7).map(x=>'<span>'+esc(x.name)+'</span>').join('');
    let choices='';
    if(existing.length){
      choices='<label class="a12-radio-card"><input type="radio" name="categoryMode" value="keep" '+(draft.categoryMode==='keep'?'checked':'')+'><span><strong>'+tr('onboarding.v3.categories.keep.title')+'</strong><small>'+tr('onboarding.v3.categories.keep.text',{count:existing.length})+'</small></span></label><label class="a12-radio-card"><input type="radio" name="categoryMode" value="recommended" '+(draft.categoryMode==='recommended'?'checked':'')+'><span><strong>'+tr('onboarding.v3.categories.add.title')+'</strong><small>'+tr('onboarding.v3.categories.add.text')+'</small></span></label>';
    }else{
      choices='<label class="a12-radio-card"><input type="radio" name="categoryMode" value="recommended" '+(draft.categoryMode==='recommended'?'checked':'')+'><span><strong>'+tr('onboarding.v3.categories.recommended.title')+'</strong><small>'+tr('onboarding.v3.categories.recommended.text')+'</small></span></label><label class="a12-radio-card"><input type="radio" name="categoryMode" value="empty" '+(draft.categoryMode==='empty'?'checked':'')+'><span><strong>'+tr('onboarding.v3.categories.empty.title')+'</strong><small>'+tr('onboarding.v3.categories.empty.text')+'</small></span></label>';
    }
    return '<div class="a69-wizard-copy"><span class="a69-wizard-kicker">'+tr('onboarding.v3.categories.kicker')+'</span><h1 id="a69WizardTitle">'+tr('onboarding.v3.categories.title')+'</h1><p>'+tr('onboarding.v3.categories.text')+'</p></div><div class="a12-category-choice">'+choices+'</div><div class="a12-category-preview"><strong>'+tr('onboarding.v3.categories.preview',{country:countryName(draft.country)})+'</strong><div>'+preview+'</div></div><div class="a69-wizard-note">'+tr('onboarding.v3.categories.merchantHelp')+'</div>';
  }

  function review(){
    const chosen=selectedAccount();
    const accountName=draft.accountMode==='new'?(draft.accountName||tr('onboarding.newAccount')):(chosen?chosen.name:'—');
    const storedLiab=existingLiabilities(lastCtx).reduce((s,a)=>s+Math.abs(num(a.balance)),0);
    const reviewedLiab=draft.debts.reduce((s,x)=>s+Math.abs(num(x.outstanding)),0);
    const totalDebt=draft.debtMode==='yes'?reviewedLiab:storedLiab;
    return '<div class="a69-wizard-copy"><span class="a69-wizard-kicker">'+tr('onboarding.v3.review.kicker')+'</span><h1 id="a69WizardTitle">'+tr('onboarding.v3.review.title')+'</h1><p>'+tr('onboarding.v3.review.text')+'</p></div><div class="a12-review-grid"><div class="a12-review-card primary"><span>'+tr('onboarding.v3.review.account')+'</span><strong>'+money(draft.currentBalance,(chosen&&chosen.currency)||draft.currency)+'</strong><small>'+esc(accountName)+'</small></div><div class="a12-review-card debt"><span>'+tr('onboarding.v3.review.debt')+'</span><strong>'+money(totalDebt,draft.currency)+'</strong><small>'+tr('onboarding.v3.review.debtHelp')+'</small></div></div><div class="a69-review"><div><span>'+tr('onboarding.country')+'</span><strong>'+esc(countryName(draft.country))+'</strong></div><div><span>'+esc(window.AioneRegions.country(draft.country).regionLabel)+'</span><strong>'+esc(regionName(draft.country,draft.region))+'</strong></div><div><span>'+tr('onboarding.municipality')+'</span><strong>'+esc(draft.municipality||'—')+'</strong></div><div><span>'+tr('onboarding.currency')+'</span><strong>'+esc(draft.currency)+'</strong></div><div><span>'+tr('onboarding.v3.review.categories')+'</span><strong>'+esc(categoryModeLabel())+'</strong></div></div><div class="a12-separation-note strong"><strong>'+tr('onboarding.v3.review.separate.title')+'</strong><span>'+tr('onboarding.v3.review.separate.text')+'</span></div>';
  }

  function categoryModeLabel(){
    if(draft.categoryMode==='empty')return tr('onboarding.v3.categories.empty.title');
    if(draft.categoryMode==='keep')return tr('onboarding.v3.categories.keep.title');
    return tr('onboarding.v3.categories.recommended.title');
  }

  function body(){return [welcome,jurisdiction,account,debts,categories,review][step]()}

  function read(){
    if(!root)return;
    root.querySelectorAll('[data-w]').forEach(el=>{draft[el.dataset.w]=el.value});
    root.querySelectorAll('[data-debt-field]').forEach(el=>{const i=Number(el.dataset.debtIndex),row=draft.debts[i];if(row)row[el.dataset.debtField]=el.value});
    const categoryMode=root.querySelector('input[name="categoryMode"]:checked');if(categoryMode)draft.categoryMode=categoryMode.value;
  }

  function validate(){
    if(step===1){
      if(!draft.country)throw new Error(tr('onboarding.error.country'));
      if(!draft.region)throw new Error(tr('onboarding.error.region'));
      if(!String(draft.municipality||'').trim())throw new Error(tr('onboarding.error.municipality'));
    }
    if(step===2){
      const assets=existingAssetAccounts(lastCtx);
      if(draft.accountMode==='existing'&&assets.length&&!draft.primaryAccountId)throw new Error(tr('onboarding.error.account'));
      if(draft.accountMode==='new'&&!String(draft.accountName||'').trim())throw new Error(tr('onboarding.error.accountName'));
      if(!Number.isFinite(Number(draft.currentBalance)))throw new Error(tr('onboarding.error.balance'));
    }
    if(step===3&&draft.debtMode==='yes'){
      draft.debts.forEach((d,i)=>{
        if(!String(d.name||'').trim())throw new Error(tr('onboarding.v3.debt.errorName',{number:i+1}));
        if(!Number.isFinite(Number(d.outstanding))||Number(d.outstanding)<0)throw new Error(tr('onboarding.v3.debt.errorAmount',{number:i+1}));
        if(String(d.monthlyPayment||'').trim()!==''&&(!Number.isFinite(Number(d.monthlyPayment))||Number(d.monthlyPayment)<0))throw new Error(tr('onboarding.v3.debt.errorMonthly',{number:i+1}));
        const day=Number(d.dueDay||1);if(day<1||day>31)throw new Error(tr('onboarding.v3.debt.errorDay',{number:i+1}));
      });
    }
  }

  function showError(msg){const el=root&&$('.a69-wizard-error',root);if(el){el.textContent=msg;el.classList.toggle('hidden',!msg)}}
  function back(){if(busy||step<=0)return;read();step--;render()}
  async function next(){
    if(busy)return;read();
    try{validate()}catch(e){showError(e.message);return}
    if(step<steps.length-1){step++;render();return}
    await finish();
  }

  async function finish(){
    const b=window.AioneLegacyBridge;if(!b)return;
    busy=true;render();
    try{
      const profile={country_code:draft.country,region_code:draft.region,municipality:draft.municipality,base_currency:draft.currency,language_code:legacyLang(draft.locale),primary_account_id:draft.accountMode==='existing'?draft.primaryAccountId:null};
      await b.saveOnboardingProfile(profile);
      let primary=profile.primary_account_id;
      if(draft.accountMode==='new'){
        const created=await b.createInitialAccount({name:draft.accountName,institution:draft.institution,current_balance:Number(draft.currentBalance||0),currency:draft.currency});
        primary=created.id;
      }else{
        await b.confirmAccountCurrentBalance(draft.primaryAccountId,Number(draft.currentBalance||0));
      }
      if(draft.debtMode==='yes'){
        for(const debt of draft.debts){
          if(debt.existing){
            await b.confirmLiabilityCurrentBalance(debt.id,Number(debt.outstanding||0));
            if(Number(debt.monthlyPayment||0)>0)await b.saveLiabilityPayment({account_id:debt.id,name:debt.name,monthly_payment:Number(debt.monthlyPayment||0),due_day:Number(debt.dueDay||1),currency:draft.currency,primary_account_id:primary});
          }else await b.createOnboardingLiability({type:debt.type,name:debt.name,institution:debt.institution,outstanding:Number(debt.outstanding||0),monthly_payment:Number(debt.monthlyPayment||0),due_day:Number(debt.dueDay||1),currency:draft.currency,primary_account_id:primary});
        }
      }
      await b.applyCountryCategories(draft.country,draft.categoryMode);
      await b.completeOnboarding(primary);
      root.classList.add('is-done');
      setTimeout(()=>{if(root){root.remove();root=null}document.body.classList.remove('a69-onboarding-open')},180);
      window.dispatchEvent(new CustomEvent('aione69:onboarding-complete'));
      window.dispatchEvent(new CustomEvent('aione12:onboarding-complete'));
    }catch(e){busy=false;render();showError(e.message||String(e))}
  }

  function addDebt(){
    read();draft.debtMode='yes';draft.debts.push({existing:false,type:defaultDebtType(draft.country),name:'',institution:'',outstanding:'0',monthlyPayment:'',dueDay:'1'});render();
  }
  function removeDebt(index){read();const row=draft.debts[index];if(row&&row.existing)return;draft.debts.splice(index,1);render()}

  function bind(){
    root.addEventListener('change',async e=>{
      const w=e.target.closest('[data-w]');
      if(w){
        const prevCountry=draft.country;read();
        if(w.dataset.w==='country'){
          const oldDefault=window.AioneRegions.country(prevCountry||'CH').defaultCurrency,newDefault=window.AioneRegions.country(draft.country).defaultCurrency;
          if(draft.currency===oldDefault)draft.currency=newDefault;
          draft.region='';draft.locale=draft.country==='DE'&&draft.locale==='de-CH'?'de-DE':draft.country==='CH'&&draft.locale==='de-DE'?'de-CH':draft.locale;
          draft.debts.filter(x=>!x.existing).forEach(x=>x.type=defaultDebtType(draft.country));
          render();return;
        }
        if(w.dataset.w==='primaryAccountId'){
          const a=accountById(draft.primaryAccountId);if(a){draft.currentBalance=String(num(a.balance));draft.accountName=a.name||'';draft.institution=a.institution||''}render();return;
        }
        if(w.dataset.w==='locale'){await window.AioneI18n.setLocale(draft.locale);render();return}
        render();return;
      }
      if(e.target.matches('input[name="categoryMode"]')){draft.categoryMode=e.target.value;return}
      const d=e.target.closest('[data-debt-field]');if(d){read();return}
    });
    root.addEventListener('input',e=>{
      const w=e.target.closest('[data-w]');if(w)draft[w.dataset.w]=w.value;
      const d=e.target.closest('[data-debt-field]');if(d){const row=draft.debts[Number(d.dataset.debtIndex)];if(row)row[d.dataset.debtField]=d.value}
    });
    root.addEventListener('click',e=>{
      const am=e.target.closest('[data-account-mode]');if(am){read();draft.accountMode=am.dataset.accountMode;if(draft.accountMode==='existing'){const a=accountById(draft.primaryAccountId)||existingAssetAccounts(lastCtx)[0];if(a){draft.primaryAccountId=a.id;draft.currentBalance=String(num(a.balance));draft.accountName=a.name||'';draft.institution=a.institution||''}}render();return}
      const dm=e.target.closest('[data-debt-mode]');if(dm){read();draft.debtMode=dm.dataset.debtMode;if(draft.debtMode==='yes'&&!draft.debts.length)addDebt();else render();return}
      const add=e.target.closest('[data-add-debt]');if(add){addDebt();return}
      const rem=e.target.closest('[data-remove-debt]');if(rem){removeDebt(Number(rem.dataset.removeDebt));return}
      if(e.target.closest('[data-w-next]'))next();
      if(e.target.closest('[data-w-back]'))back();
    });
  }

  function render(){
    if(!root)return;
    root.innerHTML='<div class="a69-wizard-card a12-wizard-card" role="dialog" aria-modal="true" aria-labelledby="a69WizardTitle">'+progress()+'<div class="a69-wizard-body">'+body()+'<div class="a69-wizard-error hidden"></div></div><div class="a69-wizard-actions">'+(step?'<button type="button" class="a69-wizard-secondary" data-w-back '+(busy?'disabled':'')+'>'+tr('onboarding.back')+'</button>':'<span></span>')+'<button type="button" class="a69-wizard-primary" data-w-next '+(busy?'disabled':'')+'>'+(busy?tr('onboarding.saving'):(step===steps.length-1?tr('onboarding.v3.finish'):tr('onboarding.next')))+'</button></div></div>';
  }

  function open(ctx,force){
    lastCtx=ctx||window.AioneContext&&window.AioneContext.get();
    if(!lastCtx||(!force&&!shouldShow(lastCtx)))return;
    if(root)return;
    draft=defaultDraft(lastCtx);step=0;
    root=document.createElement('div');root.id='aione69Onboarding';root.className='a69-wizard-overlay';document.body.appendChild(root);document.body.classList.add('a69-onboarding-open');bind();render();
  }
  function closeIfCompleted(ctx){if(!root||!ctx||ctx.profileReady!==true||shouldShow(ctx))return false;root.remove();root=null;document.body.classList.remove('a69-onboarding-open');return true}
  function sync(ctx){lastCtx=ctx;if(closeIfCompleted(ctx))return;if(!root&&shouldShow(ctx))setTimeout(()=>{if(!root&&shouldShow(lastCtx))open(lastCtx,false)},80)}

  window.AioneOnboarding={open:()=>open(window.AioneContext&&window.AioneContext.get(),true),version:TARGET_VERSION};
  if(window.AioneContext)window.AioneContext.onChange(sync);
  window.addEventListener('aione69:locale',()=>{if(root)render()});
})();
