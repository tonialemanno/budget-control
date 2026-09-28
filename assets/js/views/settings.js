import { MODULES } from '../app/config.js';
import { pageHeader } from '../app/components.js';
import { escapeHtml } from '../app/format.js';
import { icon } from '../app/icons.js';

export function renderSettings({ theme='auto', depth='standard', moduleAccess={}, profile, household } = {}) {
  const enabled = Object.entries(moduleAccess).filter(([,v])=>v).map(([k])=>MODULES[k]?.label||k);
  return `
    ${pageHeader({title:'Einstellungen',subtitle:'Darstellung, Passwort und persönliche Finance-Core-Einstellungen.'})}
    <div class="grid-main-aside">
      <div class="stack">
        <article class="card"><div class="settings-group">
          <div class="settings-row"><div class="settings-row-copy"><strong>Darstellung</strong><span>Hell, Dunkel oder System</span></div><select class="select-control" id="themeSelect"><option value="auto" ${theme==='auto'?'selected':''}>System</option><option value="light" ${theme==='light'?'selected':''}>Hell</option><option value="dark" ${theme==='dark'?'selected':''}>Dunkel</option></select></div>
          <div class="settings-row"><div class="settings-row-copy"><strong>Informationstiefe</strong><span>Einfach, Standard oder Experte</span></div><select class="select-control" id="depthSelect"><option value="simple" ${depth==='simple'?'selected':''}>Einfach</option><option value="standard" ${depth==='standard'?'selected':''}>Standard</option><option value="expert" ${depth==='expert'?'selected':''}>Experte</option></select></div>
        </div></article>
        <form class="card card-padding" id="password-change" data-form="password-change"><div class="card-heading"><div><h3 class="card-title">Passwort ändern</h3><p class="card-subtitle">Mindestens 8 Zeichen</p></div><span class="list-row-leading">${icon('shield')}</span></div><div class="form-grid"><label class="field"><span>Neues Passwort</span><input class="text-control" name="password" type="password" minlength="8" required autocomplete="new-password"></label><label class="field"><span>Wiederholen</span><input class="text-control" name="passwordConfirm" type="password" minlength="8" required autocomplete="new-password"></label></div><div class="form-actions"><button class="action-button action-button--primary" type="submit">Passwort speichern</button></div></form>
      </div>
      <div class="stack">
        <article class="card card-padding"><div class="card-heading"><div><h3 class="card-title">Profil</h3><p class="card-subtitle">Finance Core</p></div></div><div class="mini-detail-list"><span>Name <strong>${escapeHtml(profile?.display_name||'—')}</strong></span><span>Land <strong>${escapeHtml(household?.country_code||'—')}</strong></span><span>Basiswährung <strong>${escapeHtml(household?.base_currency||'—')}</strong></span><span>Haushalt <strong>${escapeHtml(household?.name||'—')}</strong></span></div></article>
        <article class="card card-padding"><div class="card-heading"><div><h3 class="card-title">Aktive Module</h3><p class="card-subtitle">Durch Admin steuerbar</p></div></div><div class="chip-row">${enabled.map((label)=>`<span class="chip chip--active">${escapeHtml(label)}</span>`).join('')}</div></article>
      </div>
    </div>`;
}
