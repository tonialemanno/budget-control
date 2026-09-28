import { MODULES } from '../app/config.js';
import { pageHeader, statusPill } from '../app/components.js';
import { escapeHtml } from '../app/format.js';
import { icon } from '../app/icons.js';

function householdRoleLabel(role) {
  return ({ owner:'Owner · verwalten & bearbeiten', admin:'Admin · verwalten & bearbeiten', editor:'Editor · bearbeiten', viewer:'Viewer · nur lesen' })[role] || 'Keine Haushaltsrolle';
}

export function renderSettings({
  theme='auto', depth='standard', moduleAccess={}, productModules=[], profile, household, user, adminRole, householdRole,
} = {}) {
  const catalog = (productModules || []).filter((module)=>module.key !== 'admin');
  const active = catalog.filter((module)=>module.is_core || moduleAccess[module.key] === true);
  const available = catalog.filter((module)=>!module.is_core && moduleAccess[module.key] !== true);
  return `
    ${pageHeader({title:'Einstellungen',subtitle:'Darstellung, Identität, Berechtigungen, Module und Passwort.'})}
    <div class="grid-main-aside">
      <div class="stack">
        <article class="card"><div class="settings-group">
          <div class="settings-row"><div class="settings-row-copy"><strong>Darstellung</strong><span>Hell, Dunkel oder System</span></div><select class="select-control" id="themeSelect"><option value="auto" ${theme==='auto'?'selected':''}>System</option><option value="light" ${theme==='light'?'selected':''}>Hell</option><option value="dark" ${theme==='dark'?'selected':''}>Dunkel</option></select></div>
          <div class="settings-row"><div class="settings-row-copy"><strong>Informationstiefe</strong><span>Einfach, Standard oder Experte</span></div><select class="select-control" id="depthSelect"><option value="simple" ${depth==='simple'?'selected':''}>Einfach</option><option value="standard" ${depth==='standard'?'selected':''}>Standard</option><option value="expert" ${depth==='expert'?'selected':''}>Experte</option></select></div>
        </div></article>
        <form class="card card-padding" id="password-change" data-form="password-change"><div class="card-heading"><div><h3 class="card-title">Passwort ändern</h3><p class="card-subtitle">Mindestens 8 Zeichen</p></div><span class="list-row-leading">${icon('shield')}</span></div><div class="form-grid"><label class="field"><span>Neues Passwort</span><input class="text-control" name="password" type="password" minlength="8" required autocomplete="new-password"></label><label class="field"><span>Wiederholen</span><input class="text-control" name="passwordConfirm" type="password" minlength="8" required autocomplete="new-password"></label></div><div class="form-actions"><button class="action-button action-button--primary" type="submit">Passwort speichern</button></div></form>
      </div>
      <div class="stack">
        <article class="card card-padding"><div class="card-heading"><div><h3 class="card-title">Mein Login & Zugriff</h3><p class="card-subtitle">Damit jederzeit klar ist, mit wem du angemeldet bist</p></div></div><div class="mini-detail-list"><span>Name <strong>${escapeHtml(profile?.display_name||'—')}</strong></span><span>E-Mail <strong>${escapeHtml(user?.email||'—')}</strong></span><span>Haushalt <strong>${escapeHtml(household?.name||'—')}</strong></span><span>Haushaltsrolle <strong>${escapeHtml(householdRoleLabel(householdRole))}</strong></span><span>Systemrolle <strong>${escapeHtml(adminRole ? `App-${adminRole}` : 'Benutzer')}</strong></span><span>Land <strong>${escapeHtml(household?.country_code||'—')}</strong></span><span>Basiswährung <strong>${escapeHtml(household?.base_currency||'—')}</strong></span></div></article>
        <article class="card card-padding"><div class="card-heading"><div><h3 class="card-title">Meine aktiven Module</h3><p class="card-subtitle">Diese Bereiche darfst du aktuell sehen</p></div><span>${statusPill('active',`${active.length} aktiv`)}</span></div><div class="chip-row">${active.map((module)=>`<span class="chip chip--active">${escapeHtml(module.label || MODULES[module.key]?.label || module.key)}</span>`).join('')}</div></article>
        <article class="card card-padding"><div class="card-heading"><div><h3 class="card-title">Weitere Module</h3><p class="card-subtitle">Später zubuchbar; im Beta-Betrieb durch den Admin freischaltbar</p></div></div>${available.length ? `<div class="module-catalog">${available.map((module)=>`<div class="module-catalog-row"><div><strong>${escapeHtml(module.label || MODULES[module.key]?.label || module.key)}</strong><span>${escapeHtml(module.group_name || '')}</span></div>${statusPill('pending','Verfügbar')}</div>`).join('')}</div>` : `<div class="inline-alert inline-alert--success"><strong>Alle verfügbaren Module sind aktiv.</strong><span>Für deinen Benutzer gibt es momentan kein weiteres Modul zum Freischalten.</span></div>`}</article>
      </div>
    </div>`;
}
