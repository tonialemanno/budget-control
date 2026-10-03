import { MODULES } from '../app/config.js';
import { pageHeader, statusPill } from '../app/components.js';
import { escapeHtml } from '../app/format.js';
import { icon } from '../app/icons.js';

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
  hiddenModules=[], privacyEnabled=false, accounts=[], categories=[], categorizationRules=[],
} = {}) {
  const hidden = new Set(hiddenModules || []);
  const catalog = (productModules || []).filter((module)=>module.key !== 'admin');
  const entitled = catalog.filter((module)=>module.is_core || moduleAccess[module.key] === true);
  const optionalEntitled = entitled.filter((module)=>!module.is_core && !MODULES[module.key]?.locked);
  const available = catalog.filter((module)=>!module.is_core && moduleAccess[module.key] !== true);
  const visibleCount = entitled.filter((module)=>!hidden.has(module.key)).length;
  const setupReady = accounts.length>0 && categories.length>=5;

  return `
    ${pageHeader({title:'Mehr',subtitle:'Einrichtung, Kategorien, Darstellung, Zugriff und weitere Funktionen.'})}

    <div class="settings-section-label">Einrichtung</div>
    <div class="settings-nav-grid">
      ${settingsLink({href:'#/setup',iconName:'sparkles',title:'Finance einrichten',text:'Konten, Kategorien und Automatik Schritt für Schritt',badge:setupReady?'bereit':'offen'})}
      ${settingsLink({href:'#/categories',iconName:'layout-grid',title:'Kategorien & Händler',text:'Unterkategorien und automatische Händlerregeln',badge:`${categorizationRules.length} Regeln`})}
      ${settingsLink({href:'#/imports',iconName:'arrow-down-left',title:'Import & Daten',text:'Bankdaten importieren und Verlauf prüfen'})}
      ${settingsLink({href:'#/documents',iconName:'receipt',title:'Dokumente',text:'Belege und Finanzdokumente verwalten'})}
      ${adminRole?settingsLink({href:'#/admin',iconName:'shield',title:'Administration',text:'Benutzer, Module und Systemstatus'}):''}
    </div>

    <div class="settings-section-label">App-Einstellungen</div>
    <article class="card"><div class="settings-group">
      <div class="settings-row"><div class="settings-row-copy"><strong>Darstellung</strong><span>Hell, Dunkel oder System</span></div><select class="select-control" id="themeSelect"><option value="auto" ${theme==='auto'?'selected':''}>System</option><option value="light" ${theme==='light'?'selected':''}>Hell</option><option value="dark" ${theme==='dark'?'selected':''}>Dunkel</option></select></div>
      <div class="settings-row"><div class="settings-row-copy"><strong>Informationstiefe</strong><span>Einfach, Standard oder Experte</span></div><select class="select-control" id="depthSelect"><option value="simple" ${depth==='simple'?'selected':''}>Einfach</option><option value="standard" ${depth==='standard'?'selected':''}>Standard</option><option value="expert" ${depth==='expert'?'selected':''}>Experte</option></select></div>
      <div class="settings-row"><div class="settings-row-copy"><strong>Privatsphäre-Modus</strong><span>Finanzwerte sofort durch neutrale Punkte ersetzen.</span></div><button class="action-button action-button--secondary" type="button" data-action="privacy-toggle">${privacyEnabled ? 'Zahlen anzeigen' : 'Zahlen verbergen'}</button></div>
    </div></article>

    <div class="settings-section-label">Konto & Sicherheit</div>
    <div class="grid-main-aside">
      <div class="stack">
        <article class="card card-padding">
          <div class="card-heading"><div><h3 class="card-title">Mein Profil</h3><p class="card-subtitle">Identität und Berechtigungen</p></div></div>
          <div class="mini-detail-list"><span>Name <strong>${escapeHtml(profile?.display_name||'—')}</strong></span><span>E-Mail <strong>${escapeHtml(user?.email||'—')}</strong></span><span>Haushalt <strong>${escapeHtml(household?.name||'—')}</strong></span><span>Rolle <strong>${escapeHtml(householdRoleLabel(householdRole))}</strong></span><span>Land <strong>${escapeHtml(household?.country_code||'—')}</strong></span><span>Basiswährung <strong>${escapeHtml(household?.base_currency||'—')}</strong></span></div>
        </article>
        <form class="card card-padding" id="password-change" data-form="password-change"><div class="card-heading"><div><h3 class="card-title">Passwort ändern</h3><p class="card-subtitle">Mindestens 8 Zeichen</p></div><span class="list-row-leading">${icon('shield')}</span></div><div class="form-grid"><label class="field"><span>Neues Passwort</span><input class="text-control" name="password" type="password" minlength="8" required autocomplete="new-password"></label><label class="field"><span>Wiederholen</span><input class="text-control" name="passwordConfirm" type="password" minlength="8" required></label></div><div class="form-actions"><button class="action-button action-button--primary" type="submit">Passwort speichern</button></div></form>
      </div>
      <div class="stack">
        <article class="card card-padding"><div class="card-heading"><div><h3 class="card-title">Meine Bereiche</h3><p class="card-subtitle">Freigeschaltete Module ein- oder ausblenden</p></div><span>${statusPill('active',`${visibleCount} sichtbar`)}</span></div>
          ${optionalEntitled.length ? `<div class="module-visibility-list">${optionalEntitled.map((module)=>`<label class="module-visibility-row"><div><strong>${escapeHtml(module.label || MODULES[module.key]?.label || module.key)}</strong><span>${escapeHtml(module.group_name || '')}</span></div><input type="checkbox" data-action="user-toggle-module-visibility" data-module-key="${escapeHtml(module.key)}" ${hidden.has(module.key)?'':'checked'}></label>`).join('')}</div>` : '<div class="table-empty">Keine optionalen freigeschalteten Module vorhanden.</div>'}
          <div class="inline-alert settings-core-note"><strong>Finance Core bleibt sichtbar.</strong><span>Übersicht, Geld und die technische Basis können nicht deaktiviert werden.</span></div>
        </article>
        <article class="card card-padding"><div class="card-heading"><div><h3 class="card-title">Weitere Module</h3><p class="card-subtitle">Aktuell nicht freigeschaltet</p></div></div>${available.length ? `<div class="module-catalog">${available.map((module)=>`<div class="module-catalog-row"><div><strong>${escapeHtml(module.label || MODULES[module.key]?.label || module.key)}</strong><span>${escapeHtml(module.group_name || '')}</span></div>${statusPill('pending','Verfügbar')}</div>`).join('')}</div>` : '<div class="inline-alert inline-alert--success"><strong>Alle verfügbaren Module sind freigeschaltet.</strong><span>Nicht benötigte Bereiche kannst du oben ausblenden.</span></div>'}</article>
      </div>
    </div>`;
}
