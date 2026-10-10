import { APP_CONFIG, MODULES } from '../app/config.js';
import { buildSetupStatus } from '../app/setup-model.js';
import { pageHeader, statusPill } from '../app/components.js';
import { escapeHtml } from '../app/format.js';
import { icon } from '../app/icons.js';
import { financeMonthMode, primaryAccountPreferenceId } from '../app/user-preferences.js';

function householdRoleLabel(role) {
  return ({ owner:'Owner · verwalten & bearbeiten', admin:'Admin · verwalten & bearbeiten', editor:'Editor · bearbeiten', viewer:'Viewer · nur lesen' })[role] || 'Keine Haushaltsrolle';
}

function settingsLink({href,iconName,title,text,badge=''}) {
  return `<a class="card settings-nav-card" href="${href}">
    <span class="hub-link-icon">${icon(iconName)}</span>
    <span class="hub-link-copy"><strong>${title}</strong><span>${text}</span></span>
    ${badge?`<span class="status-pill status-pill--neutral">${badge}</span>`:''}
    <span class="hub-link-chevron">${icon('chevron-right')}</span>
  </a>`;
}

export function renderSettings({
  theme='auto', depth='standard', moduleAccess={}, productModules=[], profile, household, user, adminRole, householdRole,
  hiddenModules=[], privacyEnabled=false, canWrite=false, canAdminHousehold=false,
  masterDataHouseholds=[], countryMasterCategories=[], countryMasterMerchants=[],
  accounts=[], categories=[], merchants=[], categorizationRules=[], recurringRules=[],
  budgets=[], goals=[], debts=[], receivables=[], taxCases=[], runtimeState=null,
} = {}) {
  const hidden = new Set(hiddenModules || []);
  const countryCode=household?.country_code||'CH';
  const catalog = (productModules || []).filter((module)=>module.key !== 'admin' && !(module.key==='tax'&&countryCode!=='CH'));
  const entitled = catalog.filter((module)=>module.is_core || moduleAccess[module.key] === true);
  const optionalEntitled = entitled.filter((module)=>!module.is_core && !MODULES[module.key]?.locked);
  const available = catalog.filter((module)=>!module.is_core && moduleAccess[module.key] !== true);
  const visibleCount = entitled.filter((module)=>!hidden.has(module.key)).length;
  const eligibleHouseholds=(masterDataHouseholds||[]);
  const sourceHouseholds=eligibleHouseholds.filter((row)=>row.id!==household?.id || Boolean(adminRole));
  const sourceOptions=sourceHouseholds.map((row)=>`<option value="${row.id}" ${adminRole && row.id===household?.id?'selected':''}>${escapeHtml(row.name)} · ${escapeHtml(row.country_code)}</option>`).join('');
  const targetOptions=eligibleHouseholds.map((row)=>`<option value="${row.id}" ${row.id===household?.id?'selected':''}>${escapeHtml(row.name)} · ${escapeHtml(row.country_code)}</option>`).join('');
  const standardLabel=`${countryCode}-Standard`;
  const setupState=buildSetupStatus({
    accounts,categories,merchants,categorizationRules,recurringRules,budgets,goals,debts,receivables,taxCases,household,profile,
  });
  const setupReady=setupState.completed||setupState.ready;
  const preferences=profile?.preferences&&typeof profile.preferences==='object'&&!Array.isArray(profile.preferences)?profile.preferences:{};
  const sessionTimeout=[15,30,60,120].includes(Number(preferences.session_timeout_minutes))
    ? Number(preferences.session_timeout_minutes)
    : 30;
  const primaryAccountId=primaryAccountPreferenceId(profile,household?.id,accounts);
  const selectedFinanceMonthMode=financeMonthMode(profile);
  const primaryAccountOptions=accounts.map((account)=>`<option value="${escapeHtml(account.account_id)}" ${account.account_id===primaryAccountId?'selected':''}>${escapeHtml(account.name)} · ${escapeHtml(account.currency)}</option>`).join('');

  return `
    ${pageHeader({title:'Einstellungen',subtitle:'Sprache, Währung, Darstellung, Kategorien, Sicherheit, Module und Administration an einem Ort.'})}

    <div class="settings-section-label">Einrichtung</div>
    <div class="settings-nav-grid">
      ${settingsLink({href:'#/profile',iconName:'user',title:'Mein Profil',text:'Login, Rolle und persönlicher Zugriff'})}
      ${settingsLink({href:'#/setup',iconName:'sparkles',title:'ALEMANNO BUCHHALTUNG einrichten',text:'Konten, Kategorien und Händler Schritt für Schritt',badge:setupReady?'bereit':`${setupState.preparationDone}/8`})}
      ${settingsLink({href:'#/accounts',iconName:'wallet',title:'Konten & Währungen',text:`Basis ${household?.base_currency||'CHF'} · Konten dürfen eigene Währungen führen`,badge:`${accounts.length} Konten`})}
      ${settingsLink({href:'#/categories',iconName:'layout-grid',title:'Kategorien & Unterkategorien',text:'Deine persönliche Finanzstruktur',badge:`${categories.length} Kategorien`})}
      ${settingsLink({href:'#/merchants',iconName:'basket',title:'Händler',text:countryCode==='DE'?'REWE, EDEKA und weitere Händler automatisch zuordnen':'Coop, Migros und weitere Händler automatisch zuordnen',badge:`${merchants.length} Händler`})}
      ${settingsLink({href:'#/sales-documents',iconName:'receipt',title:'Rechnungen & Dokumente',text:'Logo, Absender, Zahlungsdaten und Textbausteine'})}
      ${adminRole?settingsLink({href:'#/admin',iconName:'shield',title:'Administration',text:'Benutzer, Module und Systemstatus'}):''}
    </div>

    <div class="settings-section-label">App-Einstellungen</div>
    <form id="personal-settings" data-form="personal-settings" data-deferred-settings>
      <article class="card"><div class="settings-group">
        <div class="settings-row"><div class="settings-row-copy"><strong>Darstellung</strong><span>Hell, Dunkel oder System. Die Auswahl wird erst mit „Speichern“ übernommen.</span></div><select class="select-control" id="themeSelect" name="theme"><option value="auto" ${theme==='auto'?'selected':''}>System</option><option value="light" ${theme==='light'?'selected':''}>Hell</option><option value="dark" ${theme==='dark'?'selected':''}>Dunkel</option></select></div>
        <div class="settings-row"><div class="settings-row-copy"><strong>Sprache & Region</strong><span>Sprache der Oberfläche sowie Datums-, Zahlen- und Regionsformat.</span></div><select class="select-control" id="localeSelect" name="locale"><option value="de-CH" ${profile?.locale==='de-CH'?'selected':''}>Deutsch · Schweiz</option><option value="de-DE" ${profile?.locale==='de-DE'?'selected':''}>Deutsch · Deutschland</option><option value="it-CH" ${profile?.locale==='it-CH'?'selected':''}>Italiano · Svizzera</option><option value="it-IT" ${profile?.locale==='it-IT'?'selected':''}>Italiano · Italia</option><option value="en-CH" ${profile?.locale==='en-CH'?'selected':''}>English · Switzerland</option><option value="en-GB" ${profile?.locale==='en-GB'?'selected':''}>English · United Kingdom</option></select></div>
        <div class="settings-row"><div class="settings-row-copy"><strong>Hauptkonto / Standardkonto</strong><span>Dieses Konto wird im Dashboard angezeigt und bei neuen Ein- und Auszahlungen vorausgewählt.</span></div><select class="select-control" id="primaryAccountSelect" name="accountId" ${accounts.length?'':'disabled'}><option value="">Bitte wählen</option>${primaryAccountOptions}</select></div>
        <div class="settings-row"><div class="settings-row-copy"><strong>Finanzmonat</strong><span>Legt fest, welcher Zeitraum in Monatsübersichten, Budgets, Planung und Transaktionen als Monat gilt.</span></div><select class="select-control" id="financeMonthModeSelect" name="financeMonthMode"><option value="day_25" ${selectedFinanceMonthMode==='day_25'?'selected':''}>25. bis 24. des Folgemonats</option><option value="calendar" ${selectedFinanceMonthMode==='calendar'?'selected':''}>1. bis letzter Tag des Monats</option></select></div>
        <div class="settings-row"><div class="settings-row-copy"><strong>Informationstiefe</strong><span>Einfach zeigt nur Alltagsfelder. Standard ergänzt Zuordnungen. Experte zeigt Semantik und technische Details.</span></div><select class="select-control" id="depthSelect" name="depth"><option value="simple" ${depth==='simple'?'selected':''}>Einfach</option><option value="standard" ${depth==='standard'?'selected':''}>Standard</option><option value="expert" ${depth==='expert'?'selected':''}>Experte</option></select></div>
        <div class="settings-row"><div class="settings-row-copy"><strong>Automatischer Logout</strong><span>Nach dieser Zeit ohne Bedienung wird die Sitzung beendet. 5 Minuten vorher erscheint eine Warnung.</span></div><select class="select-control" id="sessionTimeoutSelect" name="sessionTimeout"><option value="15" ${sessionTimeout===15?'selected':''}>15 Minuten</option><option value="30" ${sessionTimeout===30?'selected':''}>30 Minuten · empfohlen</option><option value="60" ${sessionTimeout===60?'selected':''}>60 Minuten</option><option value="120" ${sessionTimeout===120?'selected':''}>2 Stunden</option></select></div>
        <label class="settings-row module-visibility-row"><div class="settings-row-copy"><strong>Privatsphäre-Modus</strong><span>Finanzwerte werden nach dem Speichern durch neutrale Punkte ersetzt.</span></div><input type="checkbox" name="privacyEnabled" ${privacyEnabled?'checked':''}></label>
      </div></article>

      <div class="settings-section-label">Navigation & Module</div>
      <article class="card card-padding">
        <div class="card-heading"><div><h3 class="card-title">Meine Bereiche</h3><p class="card-subtitle">Mehrere Module auswählen oder abwählen und anschliessend einmal speichern.</p></div><span>${statusPill('active',`${visibleCount} sichtbar`)}</span></div>
        ${optionalEntitled.length ? `<div class="module-visibility-list">${optionalEntitled.map((module)=>`<label class="module-visibility-row"><div><strong>${escapeHtml(module.label || MODULES[module.key]?.label || module.key)}</strong><span>${escapeHtml(module.group_name || '')}</span></div><input type="checkbox" name="visibleModules" value="${escapeHtml(module.key)}" data-module-key="${escapeHtml(module.key)}" ${hidden.has(module.key)?'':'checked'}></label>`).join('')}</div>` : '<div class="table-empty">Keine optionalen freigeschalteten Module vorhanden.</div>'}
        <div class="inline-alert settings-core-note"><strong>ALEMANNO BUCHHALTUNG Core bleibt sichtbar.</strong><span>Übersicht, Geld, Planung und die technischen Grundfunktionen können nicht deaktiviert werden.</span></div>
        <div class="form-actions settings-save-actions"><span class="settings-save-state" data-deferred-status>Keine offenen Änderungen</span><button class="action-button action-button--primary" type="submit" data-deferred-save disabled>Änderungen speichern</button></div>
      </article>
    </form>

    <div class="settings-section-label">Haushalt</div>
    <form class="card" id="household-preferences" data-form="household-preferences" data-deferred-settings><div class="settings-group">
      <div class="settings-row"><div class="settings-row-copy"><strong>Basiswährung</strong><span>Gilt für den ganzen Haushalt. Originalwährungen der Konten und Buchungen bleiben unverändert.</span></div><div class="settings-inline-control"><select class="select-control" name="baseCurrency" ${canAdminHousehold?'':'disabled'}><option value="CHF" ${household?.base_currency==='CHF'?'selected':''}>CHF</option><option value="EUR" ${household?.base_currency==='EUR'?'selected':''}>EUR</option></select>${canAdminHousehold?'<button class="action-button action-button--secondary" type="submit" data-deferred-save disabled>Speichern</button>':''}</div></div>
    </div></form>

    <div class="settings-section-label">Stammdaten</div>
    <article class="card card-padding">
      <div class="card-heading"><div><h3 class="card-title">Automatische Zuordnung</h3><p class="card-subtitle">Diese Daten steuern Import, Fixkosten und Händlererkennung.</p></div></div>
      <div class="stack">
        <div class="settings-link-card"><div><span class="list-row-leading">${icon('sparkles')}</span><div><h3 class="card-title">${escapeHtml(standardLabel)} installieren / aktualisieren</h3><p class="card-subtitle">${categories.length} Kategorien aktuell im Haushalt. Länderstandard und geprüfte Händler werden ergänzt; eigene Zuordnungen werden nicht überschrieben.</p></div></div>${canWrite?`<button class="action-button action-button--secondary" type="button" data-action="masterdata-install-country">${escapeHtml(standardLabel)} anwenden</button>`:`<span>${statusPill('paused','Nur lesen')}</span>`}</div>
        ${sourceHouseholds.length && canWrite ? `<form class="settings-link-card" id="masterdata-copy" data-form="masterdata-copy"><div><span class="list-row-leading">${icon('arrow-down-left')}</span><div><h3 class="card-title">Stammdaten aus anderem Haushalt übernehmen</h3><p class="card-subtitle">Kopiert nur Kategorien, Händler-Zuordnungen und Kategorisierungsregeln. Keine Buchungen, Konten, Salden, Fixkosten oder Beträge.</p><label class="field"><span>Quelle</span><select class="select-control" name="sourceHouseholdId" required><option value="">Quellhaushalt wählen</option>${sourceOptions}</select></label>${adminRole?`<label class="field"><span>Ziel</span><select class="select-control" name="targetHouseholdId" required>${targetOptions}</select></label>`:`<input type="hidden" name="targetHouseholdId" value="${household?.id||''}">`}</div></div><button class="action-button action-button--secondary" type="submit">Stammdaten übernehmen</button></form>` : ''}
      </div>
    </article>

    <div class="settings-section-label">Konto & Sicherheit</div>
    <div class="grid-main-aside">
      <div class="stack">
        <article class="card card-padding">
          <div class="card-heading"><div><h3 class="card-title">Mein Login & Zugriff</h3><p class="card-subtitle">Identität und Berechtigungen auf einen Blick</p></div></div>
          <div class="mini-detail-list"><span>Name <strong>${escapeHtml(profile?.display_name||'—')}</strong></span><span>E-Mail <strong>${escapeHtml(user?.email||'—')}</strong></span><span>Haushalt <strong>${escapeHtml(household?.name||'—')}</strong></span><span>Haushaltsrolle <strong>${escapeHtml(householdRoleLabel(householdRole))}</strong></span><span>Systemrolle <strong>${escapeHtml(adminRole ? `App-${adminRole}` : 'Benutzer')}</strong></span><span>Land <strong>${escapeHtml(household?.country_code||'—')}</strong></span><span>Basiswährung <strong>${escapeHtml(household?.base_currency||'—')}</strong></span></div>
        </article>
        <article class="card card-padding">
          <div class="card-heading"><div><h3 class="card-title">Sitzung & Sicherheit</h3><p class="card-subtitle">Die Inaktivitätszeit wird oben zusammen mit den persönlichen App-Einstellungen gespeichert.</p></div><span class="list-row-leading">${icon('shield')}</span></div>
          <div class="mini-detail-list"><span>Automatischer Logout <strong>${sessionTimeout} Minuten</strong></span><span>Maximale Sitzung <strong>12 Stunden</strong></span><span>Release <strong>${escapeHtml(APP_CONFIG.releaseId)}</strong></span><span>App <strong>V${escapeHtml(APP_CONFIG.version)}</strong></span><span>Schema <strong>${Number(runtimeState?.schema_version||APP_CONFIG.schemaVersion)}</strong></span></div>
        </article>
        <form class="card card-padding" id="password-change" data-form="password-change"><div class="card-heading"><div><h3 class="card-title">Passwort ändern</h3><p class="card-subtitle">Mindestens 8 Zeichen</p></div><span class="list-row-leading">${icon('shield')}</span></div><div class="form-grid"><label class="field"><span>Neues Passwort</span><input class="text-control" name="password" type="password" minlength="8" required autocomplete="new-password"></label><label class="field"><span>Wiederholen</span><input class="text-control" name="passwordConfirm" type="password" minlength="8" required autocomplete="new-password"></label></div><div class="form-actions"><button class="action-button action-button--primary" type="submit">Passwort speichern</button></div></form>
      </div>
      <div class="stack">
        <article class="card card-padding"><div class="card-heading"><div><h3 class="card-title">Freigeschaltete Module</h3><p class="card-subtitle">Diese Module gehören aktuell zu deinem Zugriff</p></div><span>${statusPill('active',`${entitled.length} aktiv`)}</span></div><div class="chip-row">${entitled.map((module)=>`<span class="chip ${hidden.has(module.key)?'':'chip--active'}">${escapeHtml(module.label || MODULES[module.key]?.label || module.key)}${hidden.has(module.key)?' · ausgeblendet':''}</span>`).join('')}</div></article>
        <article class="card card-padding"><div class="card-heading"><div><h3 class="card-title">Weitere Module</h3><p class="card-subtitle">Nicht freigeschaltet; im Beta-Betrieb durch den Admin aktivierbar</p></div></div>${available.length ? `<div class="module-catalog">${available.map((module)=>`<div class="module-catalog-row"><div><strong>${escapeHtml(module.label || MODULES[module.key]?.label || module.key)}</strong><span>${escapeHtml(module.group_name || '')}</span></div>${statusPill('pending','Verfügbar')}</div>`).join('')}</div>` : `<div class="inline-alert inline-alert--success"><strong>Alle verfügbaren Module sind freigeschaltet.</strong><span>Nicht benötigte Module kannst du oben in „Meine Bereiche“ ausblenden.</span></div>`}</article>
      </div>
    </div>
    <div class="settings-debug-note" hidden>${categorizationRules.length}</div>`;
}
