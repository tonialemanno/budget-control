import { pageHeader, statusPill } from '../app/components.js';
import { dateLabel, escapeHtml } from '../app/format.js';
import { icon } from '../app/icons.js';

const PAGE_SIZE = 20;
const ONLINE_WINDOW_MS = 2 * 60 * 1000;

function presenceMeta(user) {
  if (!user.last_seen_at) return { online:false, label:'Nicht online', detail:'keine Aktivität erfasst' };
  const seen = new Date(user.last_seen_at).getTime();
  if (!Number.isFinite(seen)) return { online:false, label:'Nicht online', detail:'unbekannt' };
  const diff = Math.max(0, Date.now() - seen);
  if (diff <= ONLINE_WINDOW_MS) return { online:true, label:'Online', detail:'gerade aktiv' };
  if (diff < 60 * 60 * 1000) return { online:false, label:'Offline', detail:`vor ${Math.max(1,Math.round(diff/60000))} Min.` };
  return { online:false, label:'Offline', detail:dateLabel(user.last_seen_at) };
}

function matchesUser(user, query) {
  const needle = String(query || '').trim().toLowerCase();
  if (!needle) return true;
  return [user.display_name, user.email]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(needle));
}

export function renderAdmin({
  adminUsers = [], productModules = [], adminQuery = '', adminPage = 1, adminExpandedUserId = null,
} = {}) {
  const moduleList = productModules.filter((m)=>!m.is_core && !['admin'].includes(m.key));
  const filtered = adminUsers.filter((user)=>matchesUser(user, adminQuery));
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(Number(adminPage) || 1, 1), pageCount);
  const start = (safePage - 1) * PAGE_SIZE;
  const visibleUsers = filtered.slice(start, start + PAGE_SIZE);

  const rows = visibleUsers.map((user)=>{
    const expanded = adminExpandedUserId === user.id;
    const presence = presenceMeta(user);
    return `<article class="card admin-user-row ${expanded ? 'admin-user-row--expanded' : ''}">
      <div class="admin-user-summary">
        <div class="admin-user-identity">
          <span class="profile-avatar">${escapeHtml((user.display_name || user.email || 'B').charAt(0).toUpperCase())}</span>
          <div><strong>${escapeHtml(user.display_name || 'Ohne Anzeigename')}</strong><span>${escapeHtml(user.email || '')}</span></div>
        </div>
        <div class="admin-user-meta"><span>Letzter Login <strong>${user.last_sign_in_at ? dateLabel(user.last_sign_in_at) : 'noch nie'}</strong></span><span>Aktivität <strong>${escapeHtml(presence.detail)}</strong></span>${statusPill(presence.online?'active':'pending',presence.label)}${statusPill(user.confirmed_at?'active':'pending',user.confirmed_at?'Aktiv':'Unbestätigt')}</div>
        <button class="table-action" type="button" data-action="admin-user-toggle-details" data-user-id="${user.id}">${expanded ? 'Schliessen' : 'Details'}</button>
      </div>
      ${expanded ? `<div class="admin-user-details">
        <div class="card-heading"><div><h3 class="card-title">Module & Zugriff</h3><p class="card-subtitle">Freigabe durch den Administrator. Die persönliche Navigation verwaltet der Benutzer selbst.</p></div></div>
        <div class="admin-module-grid">${moduleList.map((m)=>`<label class="module-toggle"><input type="checkbox" data-action="admin-toggle-module" data-user-id="${user.id}" data-module-key="${m.key}" ${user.modules?.[m.key]===true?'checked':''}><span><strong>${escapeHtml(m.label)}</strong><small>${escapeHtml(m.group_name || '')}</small></span></label>`).join('')}</div>
        <div class="card-footer-actions"><button class="table-action" type="button" data-action="admin-password" data-user-id="${user.id}">Passwort setzen</button></div>
      </div>` : ''}
    </article>`;
  }).join('');

  const pager = pageCount > 1 ? `<div class="admin-pager">
    <button class="table-action" type="button" data-action="admin-page" data-page="${safePage-1}" ${safePage<=1?'disabled':''}>Zurück</button>
    <span>Seite ${safePage} von ${pageCount}</span>
    <button class="table-action" type="button" data-action="admin-page" data-page="${safePage+1}" ${safePage>=pageCount?'disabled':''}>Weiter</button>
  </div>` : '';

  return `
    ${pageHeader({title:'Administration',subtitle:'Benutzer kompakt verwalten. Details und Module werden erst bei Bedarf geöffnet.'})}
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
      <article class="card card-padding"><div class="card-heading"><div><h3 class="card-title">Benutzerübersicht</h3><p class="card-subtitle">${adminUsers.length} Benutzer · ${filtered.length} Treffer</p></div></div>
        <label class="field"><span>Suche</span><input class="text-control" id="adminUserSearch" type="search" value="${escapeHtml(adminQuery)}" placeholder="Name, Vorname oder E-Mail" autocomplete="off"></label>
        <p class="admin-search-hint">Ein Suchbegriff reicht. Es wird gleichzeitig in Anzeigename und E-Mail gesucht.</p>
      </article>
    </div>
    <div class="admin-user-list" style="margin-top:16px">
      ${rows || '<div class="card empty-state empty-state--compact"><h3>Keine Benutzer gefunden</h3><p>Passe den Suchbegriff an.</p></div>'}
      ${pager}
    </div>`;
}
