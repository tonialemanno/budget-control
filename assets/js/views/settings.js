import { MODULES } from '../app/config.js';
import { pageHeader, statusPill } from '../app/components.js';
import { escapeHtml } from '../app/format.js';
import { icon } from '../app/icons.js';

function householdRoleLabel(role) {
  return ({ owner:'Owner · verwalten & bearbeiten', admin:'Admin · verwalten & bearbeiten', editor:'Editor · bearbeiten', viewer:'Viewer · nur lesen' })[role] || 'Keine Haushaltsrolle';
}

export function renderSettings({
  theme='auto', depth='standard', moduleAccess={}, productModules=[], profile, household, user, adminRole, householdRole,
  hiddenModules=[], privacyEnabled=false,
} = {}) {
  const hidden = new Set(hiddenModules || []);
  const catalog = (productModules || []).filter((module)=>module.key !== 'admin');
  const entitled = catalog.filter((module)=>module.is_core || moduleAccess[module.key] === true);
  const optionalEntitled = entitled.filter((module)=>!module.is_core && !MODULES[module.key]?.locked);
  const available = catalog.filter((module)=>!module.is_core && moduleAccess[module.key] !== true);
  const visibleCount = entitled.filter((module)=>!hidden.has(module.key)).length;

  return `
    ${pageHeader({title:'Einstellungen',subtitle:'Darstellung, Privatsphäre, persönliche Navigation, Kategorien und Zugriff.'})}
    <div class="grid-main-aside">
      <div class="stack">
        <article class="card"><div class="settings-group">
          <div class="settings-row"><div class="settings-row-copy"><strong>Darstellung</strong><span>Hell, Dunkel oder System</span></div><select class="select-control" id="themeSelect"><option value="auto" ${theme==='auto'?'selected':''}>System</option><option value="light" ${theme==='light'?'selected':''}>Hell</option><option value="dark" ${theme==='dark'?'selected':''}>Dunkel</option></select></div>
          <div class="settings-row"><div class="settings-row-copy"><strong>Region & Format</strong><span>Datums-, Zahlen- und Regionsformat. Die Oberfläche ist in dieser Stable-Version Deutsch.</span></div><select class="select-control" id="localeSelect"><option value="de-CH" ${profile?.locale==='de-CH'?'selected':''}>Deutsch · Schweiz</option><option value="de-DE" ${profile?.locale==='de-DE'?'selected':''}>Deutsch · Deutschland</option><option value="it-CH" ${profile?.locale==='it-CH'?'selected':''}>Italiano · Svizzera</option><option value="it-IT" ${profile?.locale==='it-IT'?'selected':''}>Italiano · Italia</option></select></div>
          <div class="settings-row"><div class="settings-row-copy"><strong>Informationstiefe</strong><span>Einfach, Standard oder Experte</span></div><select class="select-control" id="depthSelect"><option value="simple" ${depth==='simple'?'selected':''}>Einfach</option><option value="standard" ${depth==='standard'?'selected':''}>Standard</option><option value="expert" ${depth==='expert'?'selected':''}>Experte</option></select></div>
          <div class="settings-row"><div class="settings-row-copy"><strong>Privatsphäre-Modus</strong><span>Finanzwerte werden sofort durch neutrale Punkte ersetzt.</span></div><button class="action-button action-button--secondary" type="button" data-action="privacy-toggle">${privacyEnabled ? 'Zahlen anzeigen' : 'Zahlen verbergen'}</button></div>
        </div></article>

        <article class="card card-padding"><div class="card-heading"><div><h3 class="card-title">Meine Navigation</h3><p class="card-subtitle">Du blendest Module nur für dich aus. Die Berechtigung bleibt bestehen.</p></div><span>${statusPill('active',`${visibleCount} sichtbar`)}</span></div>
          ${optionalEntitled.length ? `<div class="module-visibility-list">${optionalEntitled.map((module)=>`<label class="module-visibility-row"><div><strong>${escapeHtml(module.label || MODULES[module.key]?.label || module.key)}</strong><span>${escapeHtml(module.group_name || '')}</span></div><input type="checkbox" data-action="user-toggle-module-visibility" data-module-key="${escapeHtml(module.key)}" ${hidden.has(module.key)?'':'checked'}></label>`).join('')}</div>` : '<div class="table-empty">Keine optionalen freigeschalteten Module vorhanden.</div>'}
          <div class="inline-alert settings-core-note"><strong>Finance Core bleibt sichtbar.</strong><span>Konten, Transaktionen und die technischen Grundfunktionen können nicht deaktiviert werden.</span></div>
        </article>

        <article class="card card-padding"><div class="card-heading"><div><h3 class="card-title">Stammdaten</h3><p class="card-subtitle">Zentrale Daten, die Import, Fixkosten und automatische Zuordnung steuern.</p></div></div>
          <div class="stack">
            <div class="settings-link-card"><div><span class="list-row-leading">${icon('list')}</span><div><h3 class="card-title">Händler</h3><p class="card-subtitle">Händler, Standardkategorien und Verwendung verwalten.</p></div></div><a class="action-button action-button--secondary" href="#/merchants">Öffnen</a></div>
            <div class="settings-link-card"><div><span class="list-row-leading">${icon('layout-grid')}</span><div><h3 class="card-title">Kategorien & Regeln</h3><p class="card-subtitle">Kategorien, Unterkategorien und automatische Kategorisierungsregeln verwalten.</p></div></div><a class="action-button action-button--secondary" href="#/categories">Öffnen</a></div>
          </div>
        </article>

        <form class="card card-padding" id="password-change" data-form="password-change"><div class="card-heading"><div><h3 class="card-title">Passwort ändern</h3><p class="card-subtitle">Mindestens 8 Zeichen</p></div><span class="list-row-leading">${icon('shield')}</span></div><div class="form-grid"><label class="field"><span>Neues Passwort</span><input class="text-control" name="password" type="password" minlength="8" required autocomplete="new-password"></label><label class="field"><span>Wiederholen</span><input class="text-control" name="passwordConfirm" type="password" minlength="8" required autocomplete="new-password"></label></div><div class="form-actions"><button class="action-button action-button--primary" type="submit">Passwort speichern</button></div></form>
      </div>
      <div class="stack">
        <article class="card card-padding"><div class="card-heading"><div><h3 class="card-title">Mein Login & Zugriff</h3><p class="card-subtitle">Identität und Berechtigungen auf einen Blick</p></div></div><div class="mini-detail-list"><span>Name <strong>${escapeHtml(profile?.display_name||'—')}</strong></span><span>E-Mail <strong>${escapeHtml(user?.email||'—')}</strong></span><span>Haushalt <strong>${escapeHtml(household?.name||'—')}</strong></span><span>Haushaltsrolle <strong>${escapeHtml(householdRoleLabel(householdRole))}</strong></span><span>Systemrolle <strong>${escapeHtml(adminRole ? `App-${adminRole}` : 'Benutzer')}</strong></span><span>Land <strong>${escapeHtml(household?.country_code||'—')}</strong></span><span>Basiswährung <strong>${escapeHtml(household?.base_currency||'—')}</strong></span></div></article>
        <article class="card card-padding"><div class="card-heading"><div><h3 class="card-title">Freigeschaltete Module</h3><p class="card-subtitle">Diese Module gehören aktuell zu deinem Zugriff</p></div><span>${statusPill('active',`${entitled.length} aktiv`)}</span></div><div class="chip-row">${entitled.map((module)=>`<span class="chip ${hidden.has(module.key)?'':'chip--active'}">${escapeHtml(module.label || MODULES[module.key]?.label || module.key)}${hidden.has(module.key)?' · ausgeblendet':''}</span>`).join('')}</div></article>
        <article class="card card-padding"><div class="card-heading"><div><h3 class="card-title">Weitere Module</h3><p class="card-subtitle">Nicht freigeschaltet; im Beta-Betrieb durch den Admin aktivierbar</p></div></div>${available.length ? `<div class="module-catalog">${available.map((module)=>`<div class="module-catalog-row"><div><strong>${escapeHtml(module.label || MODULES[module.key]?.label || module.key)}</strong><span>${escapeHtml(module.group_name || '')}</span></div>${statusPill('pending','Verfügbar')}</div>`).join('')}</div>` : `<div class="inline-alert inline-alert--success"><strong>Alle verfügbaren Module sind freigeschaltet.</strong><span>Du kannst nicht benötigte Module links in „Meine Navigation“ ausblenden.</span></div>`}</article>
      </div>
    </div>`;
}
