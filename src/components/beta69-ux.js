(function(){
  'use strict';
  const $=(s,b)=>(b||document).querySelector(s), $$=(s,b)=>Array.from((b||document).querySelectorAll(s));
  const bridge=()=>window.AioneLegacyBridge||null;
  let transactionDefaultApplied=false,lastAccountId=null,chatOpen=false,chatTimer=null;

  function toast(t){const b=bridge();if(b&&b.toast)b.toast(t)}
  function navigate(v){const b=bridge();if(b&&b.navigate)b.navigate(v)}
  function click(id){const el=$(id);if(el)el.click()}

  function enhanceDashboard(){
    if($('.a69-dashboard-actions'))return;
    const host=$('#dashboardAccountOverview');if(!host)return;
    const actions=document.createElement('div');actions.className='a69-dashboard-actions';
    actions.innerHTML='<button type="button" class="btn" data-a69-new-account>+ Konto</button><button type="button" class="btn secondary" data-a69-new-cash>+ Bargeld</button><button type="button" class="btn ghost" data-a69-manage-accounts>Konten verwalten</button>';
    host.parentElement.insertBefore(actions,host);
    actions.addEventListener('click',e=>{
      if(e.target.closest('[data-a69-new-account]'))return click('#newAccountTop');
      if(e.target.closest('[data-a69-new-cash]')){click('#newAccountTop');setTimeout(()=>{const t=$('#accType');if(t){t.value='cash';t.dispatchEvent(new Event('change',{bubbles:true}))}},25);return}
      if(e.target.closest('[data-a69-manage-accounts]'))navigate('accounts');
    });
  }

  function captureAccountId(){
    ['#dashboardAccountOverview','#dashAccounts','#accountsTable'].forEach(sel=>{
      const host=$(sel);if(!host||host.dataset.a69Capture)return;host.dataset.a69Capture='1';
      host.addEventListener('click',e=>{const row=e.target.closest('[data-dash-account],[data-account-detail]');if(row)lastAccountId=row.dataset.dashAccount||row.dataset.accountDetail||null},true)
    });
  }

  function enhanceAccountDialog(){
    const d=$('#accountDetailDialog');if(!d||d.querySelector('.a69-account-actions'))return;
    const grid=d.querySelector('.grid2');if(!grid)return;
    const bar=document.createElement('div');bar.className='a69-account-actions';
    bar.innerHTML='<button type="button" class="btn" data-a69-account-tx>+ Buchung</button><button type="button" class="btn secondary" data-a69-account-plan>Zahlung planen</button><button type="button" class="btn secondary" data-a69-account-reconcile>Bankdatei prüfen</button><button type="button" class="btn ghost" data-a69-account-edit>Konto bearbeiten</button>';
    grid.parentElement.insertBefore(bar,grid);
    bar.addEventListener('click',e=>{
      const id=lastAccountId;d.close();
      if(e.target.closest('[data-a69-account-tx]')){click('#newTxTop');setTimeout(()=>{const x=$('#txFrom');if(x&&id){x.value=id;x.dispatchEvent(new Event('change',{bubbles:true}))}},25);return}
      if(e.target.closest('[data-a69-account-plan]')){click('#newPlanTop');setTimeout(()=>{const x=$('#planAccount');if(x&&id){x.value=id;x.dispatchEvent(new Event('change',{bubbles:true}))}},25);return}
      if(e.target.closest('[data-a69-account-reconcile]')){navigate('reconcile');setTimeout(()=>{const x=$('#reconcileAccount');if(x&&id)x.value=id},25);return}
      if(e.target.closest('[data-a69-account-edit]')){navigate('accounts');setTimeout(()=>{const b=$('[data-edit-account="'+CSS.escape(id||'')+'"]');if(b)b.click()},40)}
    });
  }

  function enhanceTransactions(){
    const view=$('#transactionsView');if(!view)return;
    const filters=view.querySelector('.filters');if(filters&&!filters.closest('.a69-advanced-filters')){
      const details=document.createElement('details');details.className='a69-advanced-filters';details.innerHTML='<summary>Weitere Filter <span class="small">Konto · Kategorie · Art · freie Datumswahl</span></summary>';
      filters.parentElement.insertBefore(details,filters);details.appendChild(filters);
    }
    if(transactionDefaultApplied)return;transactionDefaultApplied=true;
    const y=$('#txPeriodYear'),k=$('#txPeriodKind'),v=$('#txPeriodValue');if(!y||!k||!v)return;
    y.value=String(new Date().getFullYear());k.value='month';k.dispatchEvent(new Event('change',{bubbles:true}));
    setTimeout(()=>{v.value=String(new Date().getMonth()+1).padStart(2,'0');v.dispatchEvent(new Event('change',{bubbles:true}));const adv=view.querySelector('.a69-advanced-filters');if(adv)adv.open=false},0);
  }

  function enhancePlanning(){
    const view=$('#plannedView');if(!view)return;
    if(!view.querySelector('.a69-rule-shortcut')){
      const panel=view.querySelector('.panel');const box=document.createElement('div');box.className='a69-rule-shortcut';
      box.innerHTML='<button type="button" class="btn" data-a69-standing-order>+ Neuer Dauerauftrag</button><button type="button" class="btn secondary" data-a69-one-payment>+ Einmalige Zahlung</button>';
      panel&&panel.appendChild(box);
      box.addEventListener('click',e=>{
        if(e.target.closest('[data-a69-standing-order]')){click('#newRuleBtn');setTimeout(()=>{const pm=$('#rulePaymentMode'),ac=$('#ruleActive');if(pm)pm.value='standing_order';if(ac)ac.value='true';const title=$('#ruleDialogTitle');if(title)title.textContent='Neuen Dauerauftrag erfassen'},20)}
        if(e.target.closest('[data-a69-one-payment]'))click('#newPlanBtn');
      })
    }
    const end=$('#ruleEnd');if(end&&!$('#a69RuleUntilRevoked')){
      const wrap=end.closest('.field');if(wrap){const label=document.createElement('label');label.className='a69-until-revoked';label.innerHTML='<input id="a69RuleUntilRevoked" type="checkbox" checked><span><strong>Bis auf Widerruf</strong><small style="display:block;color:var(--muted)">Kein Enddatum setzen.</small></span>';wrap.appendChild(label);const cb=$('#a69RuleUntilRevoked');const sync=()=>{end.disabled=cb.checked;if(cb.checked)end.value=''};cb.addEventListener('change',sync);end.addEventListener('input',()=>{if(end.value){cb.checked=false;end.disabled=false}});sync()}
    }
  }

  function enhanceReconcile(){
    const view=$('#reconcileView');if(!view)return;
    const file=$('#reconcilePdf');if(file){file.multiple=true;file.setAttribute('multiple','');file.setAttribute('accept','.pdf,application/pdf,.csv,text/csv');const lab=file.closest('.field')?.querySelector('label');if(lab)lab.textContent='Bankdateien (PDF oder CSV)';}
    if(!view.querySelector('.a69-import-handoff')){
      const p=view.querySelector('.panel');if(!p)return;const box=document.createElement('div');box.className='a69-import-handoff';
      box.innerHTML='<div><strong>Mehrere Bankdateien oder CSV?</strong><div class="small">Mehrere PDF werden direkt abgeglichen. CSV-Dateien wechseln automatisch in den strukturierten Import; dort bleiben Vorschau und Dublettenprüfung erhalten.</div></div><button type="button" class="btn secondary" data-a69-open-import>CSV / PDF Import</button>';
      p.appendChild(box);box.querySelector('button').addEventListener('click',()=>navigate('csv'));
    }
  }

  function enhanceCategories(){
    const v=$('#categoriesView');if(!v||v.querySelector('.a69-category-luxury-note'))return;
    const panel=v.querySelector('.panel');if(!panel)return;const n=document.createElement('div');n.className='a69-category-luxury-note';n.innerHTML='<strong>Kategorien sollen erklären – nicht verwalten.</strong><div class="small" style="color:#f1eadc;margin-top:4px">Weniger Tabellen, mehr Überblick. Regeln und technische Details bleiben darunter verfügbar.</div>';panel.insertBefore(n,panel.children[1]||null)
  }

  function enhanceTax(){
    const v=$('#taxView');if(!v||v.querySelector('.a69-tax-start'))return;
    const first=v.querySelector('.panel');if(!first)return;const box=document.createElement('div');box.className='a69-tax-start';box.innerHTML='<div><strong>Steuerdaten ergänzen</strong><div class="small">Du kannst Steuerrechnungen auch ohne Bankimport direkt erfassen. Buchungen verbessern später nur die automatische Zuordnung.</div></div><button type="button" class="btn secondary">Angaben öffnen</button>';first.insertAdjacentElement('afterend',box);box.querySelector('button').addEventListener('click',()=>{const d=$$('#taxView details').find(x=>String(x.querySelector('summary')?.textContent||'').includes('Weitere Steuerangaben'));if(d){d.open=true;d.scrollIntoView({behavior:'smooth',block:'start'})}})
  }

  function enhanceDocuments(){
    const v=$('#documentsView');if(!v||v.querySelector('.a69-doc-type-tiles'))return;
    const first=v.querySelector('.panel');if(!first)return;const tiles=document.createElement('div');tiles.className='a69-doc-type-tiles';
    tiles.innerHTML='<button class="a69-doc-type-tile" data-doc-type="receipt"><strong>Beleg</strong><span>Kauf, Zahlung, Quittung</span></button><button class="a69-doc-type-tile" data-doc-type="invoice_received"><strong>Rechnung erhalten</strong><span>Eingangsdokument</span></button><button class="a69-doc-type-tile" data-doc-type="contract"><strong>Vertrag</strong><span>Laufzeit & Unterlagen</span></button><button class="a69-doc-type-tile" data-doc-type="warranty"><strong>Garantie</strong><span>Kauf & Frist</span></button><button class="a69-doc-type-tile" data-doc-type="tax"><strong>Steuerdokument</strong><span>Bescheid & Nachweis</span></button><button class="a69-doc-type-tile" data-doc-type="other"><strong>Anderes Dokument</strong><span>Privat ablegen</span></button>';
    first.appendChild(tiles);tiles.addEventListener('click',e=>{const b=e.target.closest('[data-doc-type]');if(!b)return;click('#newDocumentBtn');setTimeout(()=>{const s=$('#documentType');if(s){if(!Array.from(s.options).some(o=>o.value===b.dataset.docType)){const o=document.createElement('option');o.value=b.dataset.docType;o.textContent=b.querySelector('strong').textContent;s.appendChild(o)}s.value=b.dataset.docType}},20)})
  }

  function enhanceSettings(){
    const v=$('#settingsView');if(!v)return;
    if(!v.querySelector('.a69-settings-actions')){
      const intro=v.querySelector('.lux-page-intro');if(intro){const grid=document.createElement('div');grid.className='a69-settings-actions';grid.innerHTML='<button class="a69-settings-card" data-a69-settings="accounts"><strong>Konten & Bankdaten</strong><span>Konto anlegen, Standardkonto wählen, Bankdaten verwalten.</span></button><button class="a69-settings-card" data-a69-settings="profile"><strong>Persönliche Angaben</strong><span>Land, Kanton, Gemeinde, Sprache und Hauptwährung.</span></button><button class="a69-settings-card" data-a69-settings="appearance"><strong>Darstellung</strong><span>Design auswählen, Logo und Lesbarkeit einstellen.</span></button>';intro.insertAdjacentElement('afterend',grid);grid.addEventListener('click',e=>{const b=e.target.closest('[data-a69-settings]');if(!b)return;const kind=b.dataset.a69Settings;if(kind==='accounts'){click('#newAccountTop');return}const target=kind==='profile'?'Persönliche Daten':'Darstellung & Logo';const sec=$$('#settingsView .settings-section').find(x=>x.querySelector(':scope > h2')?.textContent.trim()===target);if(sec){sec.classList.remove('aione-section-collapsed');sec.scrollIntoView({behavior:'smooth',block:'start'})}})}
    }
    const appearance=$$('#settingsView .settings-section').find(x=>x.querySelector(':scope > h2')?.textContent.trim()==='Darstellung & Logo');
    if(appearance&&!appearance.querySelector('.a69-appearance-advanced')){
      const theme=$('#settingsTheme')?.closest('.field'),colors=appearance.querySelector('.theme-custom-grid'),compact=$('#settingsCompact')?.closest('.field');
      if(theme||colors||compact){const d=document.createElement('details');d.className='a69-appearance-advanced';d.innerHTML='<summary>Erweiterte Design-Einstellungen <span class="small">optional</span></summary><div class="a69-appearance-advanced-body"></div>';const body=d.querySelector('.a69-appearance-advanced-body');[theme,colors,compact].filter(Boolean).forEach(x=>body.appendChild(x));const msg=$('#appearanceSettingsMsg');if(msg)appearance.insertBefore(d,msg);else appearance.appendChild(d)}
    }
    const family=$$('#settingsView .settings-section').find(x=>x.querySelector(':scope > h2')?.textContent.trim()==='Familie & Haushalt');
    if(family){const card=family.querySelector('.aione-chat-card');if(card&&!card.dataset.a69Moved){card.dataset.a69Moved='1';card.classList.add('a69-settings-chat-legacy');const n=document.createElement('div');n.className='a69-chat-settings-note';n.innerHTML='<strong>Familienchat</strong><span>Der Chat ist jetzt oben in der aione-Leiste über das Nachrichten-Symbol erreichbar.</span>';card.insertAdjacentElement('beforebegin',n)}}
  }


  function ensureUtilityBar(){
    const meta=$('.aione69-meta');if(!meta||meta.querySelector('.a69-utility'))return;
    const u=document.createElement('div');u.className='a69-utility';u.innerHTML='<button class="a69-icon-btn" data-a69-util="todo" title="Aufgabe / Planer">✓</button><button class="a69-icon-btn" data-a69-util="chat" title="Familienchat">✉<span class="a69-badge" data-a69-chat-badge></span></button><button class="a69-icon-btn" data-a69-util="notice" title="Fällige Hinweise">●<span class="a69-badge" data-a69-notice-badge></span></button><button class="a69-icon-btn a69-user-btn" data-a69-util="user" title="Benutzermenü">Konto</button>';
    meta.appendChild(u);
    document.body.insertAdjacentHTML('beforeend','<div id="a69UserMenu" class="a69-popover a69-user-menu hidden"><div class="a69-popover-head"><h3>Mein aione</h3><button class="a69-popover-close" type="button">×</button></div><button data-a69-user-settings>Einstellungen</button><button data-a69-user-accounts>Konten verwalten</button><button class="danger" data-a69-user-logout>Abmelden</button></div><div id="a69Chat" class="a69-popover hidden"><div class="a69-popover-head"><div><h3>Familienchat</h3><div class="small">Direkt in aione</div></div><button class="a69-popover-close" type="button">×</button></div><div class="a69-chat-list" data-a69-chat-list><div class="small">Nachrichten werden geladen …</div></div><div class="a69-chat-compose"><input data-a69-chat-input placeholder="Nachricht schreiben …"><button type="button" class="btn" data-a69-chat-send>Senden</button></div></div><div id="a69Notifications" class="a69-popover hidden"><div class="a69-popover-head"><div><h3>Fällig & als Nächstes</h3><div class="small">Zahlungen und Aufgaben der nächsten 7 Tage</div></div><button class="a69-popover-close" type="button">×</button></div><div class="a69-notice-list" data-a69-notice-list></div><div class="a69-notice-actions"><button type="button" class="btn secondary" data-a69-open-payments>Zahlungsplanung</button><button type="button" class="btn secondary" data-a69-open-planner>Planer</button></div></div>');
    u.addEventListener('click',e=>{const b=e.target.closest('[data-a69-util]');if(!b)return;const k=b.dataset.a69Util;if(k==='todo'){const br=bridge();if(br&&br.openPlanner)br.openPlanner();return}if(k==='user')togglePopover('#a69UserMenu');if(k==='chat'){togglePopover('#a69Chat');chatOpen=!$('#a69Chat').classList.contains('hidden');if(chatOpen)refreshChat()}if(k==='notice'){togglePopover('#a69Notifications');refreshNotifications()}});
    $$('#a69UserMenu .a69-popover-close,#a69Chat .a69-popover-close,#a69Notifications .a69-popover-close').forEach(b=>b.addEventListener('click',()=>b.closest('.a69-popover').classList.add('hidden')));
    $('[data-a69-user-settings]').addEventListener('click',()=>{closePopovers();navigate('settings')});$('[data-a69-user-accounts]').addEventListener('click',()=>{closePopovers();navigate('accounts')});$('[data-a69-user-logout]').addEventListener('click',()=>{const b=bridge();if(b&&b.logout)b.logout()});
    $('[data-a69-chat-send]').addEventListener('click',sendChat);$('[data-a69-chat-input]').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();sendChat()}});
    $('[data-a69-open-payments]').addEventListener('click',()=>{closePopovers();navigate('planned')});$('[data-a69-open-planner]').addEventListener('click',()=>{closePopovers();const b=bridge();if(b&&b.openPlanner)b.openPlanner()});
    refreshNotifications();chatTimer=setInterval(()=>{if(document.hidden)return;if(chatOpen)refreshChat();refreshNotifications()},30000);
  }
  function togglePopover(sel){const el=$(sel);if(!el)return;const hidden=el.classList.contains('hidden');closePopovers();if(hidden)el.classList.remove('hidden')}
  function closePopovers(){$$('.a69-popover').forEach(x=>x.classList.add('hidden'));chatOpen=false}
  async function refreshChat(){const b=bridge();const list=$('[data-a69-chat-list]');if(!b||!b.loadFamilyChatData||!list)return;try{const d=await b.loadFamilyChatData();const rows=d.messages||[];list.innerHTML=rows.length?rows.map(m=>'<div class="a69-chat-msg '+(m.me?'me':'')+'"><div>'+escapeHtml(m.message)+'</div><div class="a69-chat-meta">'+escapeHtml(m.sender)+' · '+escapeHtml(m.when)+'</div></div>').join(''):'<div class="small">Noch keine Nachrichten.</div>';list.scrollTop=list.scrollHeight;const badge=$('[data-a69-chat-badge]');if(badge){badge.classList.remove('show');badge.textContent=''}}catch(e){list.innerHTML='<div class="small">Chat konnte nicht geladen werden.</div>'}}
  async function sendChat(){const input=$('[data-a69-chat-input]'),v=String(input&&input.value||'').trim(),b=bridge();if(!v||!b||!b.sendFamilyChatData)return;input.disabled=true;try{await b.sendFamilyChatData(v);input.value='';await refreshChat()}catch(e){toast(e.message||String(e))}finally{input.disabled=false;input.focus()}}
  function refreshNotifications(){const b=bridge(),list=$('[data-a69-notice-list]'),badge=$('[data-a69-notice-badge]');if(!b||!b.getNotificationData)return;const d=b.getNotificationData()||{},rows=[...(d.payments||[]),...(d.tasks||[])].sort((a,z)=>String(a.date||'').localeCompare(String(z.date||'')));if(badge){const n=Number(d.count||rows.length||0);badge.textContent=n>9?'9+':String(n||'');badge.classList.toggle('show',n>0)}if(!list)return;list.innerHTML=rows.length?rows.map(x=>'<button type="button" class="a69-notice-row" data-a69-notice-kind="'+escapeHtml(x.kind)+'"><span class="a69-notice-dot '+(x.overdue?'overdue':'')+'"></span><span><strong>'+escapeHtml(x.title)+'</strong><small>'+escapeHtml(x.date)+(x.kind==='payment'&&x.amount!=null?' · '+escapeHtml(String(x.currency||''))+' '+Number(x.amount||0).toFixed(2):'')+'</small></span></button>').join(''):'<div class="small a69-notice-empty">Für die nächsten 7 Tage ist nichts fällig.</div>'}
  function escapeHtml(v){return String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}

  function onView(name){setTimeout(()=>{enhanceDashboard();captureAccountId();enhanceAccountDialog();if(name==='transactions')enhanceTransactions();if(name==='planned')enhancePlanning();if(name==='reconcile')enhanceReconcile();if(name==='categories'||name==='categoryDashboard')enhanceCategories();if(name==='tax')enhanceTax();if(name==='documents')enhanceDocuments();if(name==='settings')enhanceSettings();ensureUtilityBar()},0)}
  window.addEventListener('aione:viewchange',e=>onView(e.detail&&e.detail.name));
  window.addEventListener('aione69:context',()=>setTimeout(ensureUtilityBar,0));
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>onView('dashboard'));else onView('dashboard');
})();
