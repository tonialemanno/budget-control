(function(){
  'use strict';
  const DESKTOP='(min-width: 1051px)';let currentView='dashboard',currentGroup='overview',root=null;
  const viewGroup={dashboard:'overview',accounts:'money',transactions:'money',planned:'money',reconcile:'money',categoryDashboard:'money',wealth:'money',tax:'obligations',receivables:'obligations',documents:'documents',analysis:'insights',financeOS:'insights',support:'settings',help:'settings',settings:'settings',admin:'admin'};
  function tr(key){return window.AioneI18n?window.AioneI18n.t(key):key}
  function bridge(){return window.AioneLegacyBridge||null}
  function allowedGroup(g){if(g.special==='planner')return true;if(g.feature)return window.AioneModules?['enabled','read_only'].includes(window.AioneModules.featureState(g.feature)):false;return window.AioneModules?window.AioneModules.groupModules(g.key).length>0:true}
  function statusText(ctx){
    const parts=[ctx.country];if(ctx.region)parts.push(ctx.region);if(ctx.municipality)parts.push(ctx.municipality);parts.push(ctx.baseCurrency);parts.push(String(ctx.language||'de-CH').toUpperCase());return parts.filter(Boolean).join(' · ')
  }
  function navigateModule(m){const b=bridge();if(!b)return;if(m&&m.view)b.navigate(m.view)}
  function navigateGroup(g){
    if(g.special==='planner'){const b=bridge();if(b)b.openPlanner();return}
    const rows=window.AioneModules?window.AioneModules.groupModules(g.key):[];const target=rows.find(x=>x.key===g.defaultModule)||rows[0];if(target)navigateModule(target)
  }
  function renderSubnav(){
    const sub=root&&root.querySelector('.aione69-subnav');if(!sub)return;const rows=window.AioneModules?window.AioneModules.groupModules(currentGroup):[];
    sub.innerHTML=rows.length>1?rows.map(m=>'<button type="button" data-a69-view="'+m.view+'" class="'+(m.view===currentView?'active':'')+'">'+tr(m.label)+'</button>').join(''):'';
    sub.classList.toggle('hidden',rows.length<=1)
  }
  function syncActive(){
    if(!root)return;root.querySelectorAll('[data-a69-group]').forEach(b=>b.classList.toggle('active',b.dataset.a69Group===currentGroup));renderSubnav();
    const title=root.querySelector('.aione69-location');const legacy=document.querySelector('#pageTitle');if(title)title.textContent=legacy&&legacy.textContent?legacy.textContent:tr('nav.home');
  }
  function renderContext(ctx){if(!root)return;const el=root.querySelector('.aione69-context');if(el)el.textContent=statusText(ctx)}
  function renderPrimary(){if(!root)return;const primary=root.querySelector('.aione69-primary');const groups=(window.AioneModules&&window.AioneModules.groups||[]).filter(allowedGroup);primary.innerHTML=groups.map(g=>'<button type="button" data-a69-group="'+g.key+'" class="'+(g.key===currentGroup?'active':'')+'">'+tr(g.label)+'</button>').join('')}
  function build(){
    const shell=document.querySelector('#appShell');if(!shell||root)return;
    root=document.createElement('div');root.id='aione69DesktopShell';root.className='aione69-desktop-shell';root.innerHTML='<div class="aione69-topline"><button type="button" class="aione69-brand" data-a69-group="overview" aria-label="aione Übersicht"><span class="aione69-brand-main">aione</span><span class="aione69-brand-by">by agazone</span></button><nav class="aione69-primary" aria-label="Hauptnavigation"></nav><div class="aione69-meta"><span class="aione69-beta">BETA 69.0</span><span class="aione69-context"></span></div></div><div class="aione69-bottomline"><div class="aione69-location">Übersicht</div><nav class="aione69-subnav" aria-label="Bereichsnavigation"></nav></div>';
    shell.insertBefore(root,shell.firstChild);document.body.classList.add('beta69-shell-ready');
    renderPrimary();
    root.addEventListener('click',e=>{const gb=e.target.closest('[data-a69-group]'),vb=e.target.closest('[data-a69-view]');if(vb){const m=(window.AioneModules.modules||[]).find(x=>x.view===vb.dataset.a69View);if(m)navigateModule(m);return}if(gb){const g=(window.AioneModules.groups||[]).find(x=>x.key===gb.dataset.a69Group);if(g)navigateGroup(g)}});
    if(window.AioneContext)window.AioneContext.onChange(ctx=>{renderContext(ctx);renderPrimary();syncActive()});syncActive();
  }
  function onView(name){currentView=name||currentView;currentGroup=viewGroup[currentView]||currentGroup;syncActive()}
  window.addEventListener('aione:viewchange',e=>onView(e.detail&&e.detail.name));
  window.addEventListener('aione69:locale',()=>{renderPrimary();syncActive()});
  const mq=matchMedia(DESKTOP);function ensure(){if(mq.matches)build()}
  if(mq.addEventListener)mq.addEventListener('change',ensure);else mq.addListener(ensure);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ensure);else ensure();
})();
