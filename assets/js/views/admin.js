import { pageHeader, statusPill } from '../app/components.js';
import { dateLabel, escapeHtml } from '../app/format.js';
import { icon } from '../app/icons.js';

export function renderAdmin({ adminUsers = [], productModules = [] } = {}) {
  const moduleList = productModules.filter((m)=>!m.is_core && !['admin'].includes(m.key));
  return `
    ${pageHeader({title:'Administration',subtitle:'Benutzer werden hier angelegt. Module können pro Benutzer freigeschaltet oder ausgeblendet werden.'})}
    <div class="grid-main-aside">
      <form class="card card-padding" id="admin-user-create" data-form="admin-user-create">
        <div class="card-heading"><div><h3 class="card-title">Benutzer anlegen</h3><p class="card-subtitle">Direkt bestätigt, keine E-Mail-Bestätigung nötig</p></div><span class="list-row-leading">${icon('shield')}</span></div>
        <div class="form-grid">
          <label class="field"><span>Name</span><input class="text-control" name="displayName" required placeholder="z. B. Ana"></label>
          <label class="field"><span>E-Mail</span><input class="text-control" name="email" type="email" required></label>
          <label class="field"><span>Temporäres Passwort</span><input class="text-control" name="password" type="password" minlength="8" required autocomplete="new-password"></label>
        </div>
        <div class="form-actions"><button class="action-button action-button--primary" type="submit">${icon('plus')} Benutzer erstellen</button></div>
      </form>
      <article class="card card-padding"><div class="card-heading"><div><h3 class="card-title">Admin-Prinzip</h3><p class="card-subtitle">Beta-Betrieb</p></div></div><div class="stack compact-copy"><p>Neue Benutzer erhalten derzeit alle Testmodule. Du kannst Module danach pro Person deaktivieren.</p><p>Finance Core bleibt immer aktiv.</p><p>Passwörter werden von Supabase Auth verwaltet und nicht in Finance gespeichert.</p></div></article>
    </div>
    <div class="stack" style="margin-top:16px">
      ${adminUsers.map((user)=>`<article class="card card-padding admin-user-card"><div class="card-heading"><div><h3 class="card-title">${escapeHtml(user.display_name||'Ohne Anzeigename')}</h3><p class="card-subtitle">${escapeHtml(user.email||'')} · Letzter Login ${user.last_sign_in_at?dateLabel(user.last_sign_in_at):'noch nie'}</p></div>${statusPill(user.confirmed_at?'active':'pending',user.confirmed_at?'Aktiv':'Unbestätigt')}</div><div class="admin-module-grid">${moduleList.map((m)=>`<label class="module-toggle"><input type="checkbox" data-action="admin-toggle-module" data-user-id="${user.id}" data-module-key="${m.key}" ${user.modules?.[m.key]!==false?'checked':''}><span><strong>${escapeHtml(m.label)}</strong><small>${escapeHtml(m.group_name)}</small></span></label>`).join('')}</div><div class="card-footer-actions"><button class="table-action" type="button" data-action="admin-password" data-user-id="${user.id}">Passwort setzen</button></div></article>`).join('') || '<div class="card empty-state"><h3>Noch keine Benutzer</h3><p>Lege den ersten zusätzlichen Benutzer an.</p></div>'}
    </div>`;
}
