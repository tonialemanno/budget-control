import { dateLabel, escapeHtml } from '../app/format.js';
import { icon } from '../app/icons.js';
import { pageHeader } from '../app/components.js';

function userRow(user) {
  const name = user.display_name || 'Ohne Anzeigename';
  const signedIn = user.last_sign_in_at ? dateLabel(user.last_sign_in_at) : 'Noch nie';
  return `
    <div class="list-row">
      <div class="list-row-main">
        <span class="list-row-leading">${icon('shield')}</span>
        <div>
          <div class="list-row-title">${escapeHtml(name)}</div>
          <div class="list-row-meta">${escapeHtml(user.email || '')} · Letzter Login: ${escapeHtml(signedIn)}</div>
        </div>
      </div>
      <div class="list-row-trailing">
        <span class="status-pill status-pill--positive">Aktiv</span>
      </div>
    </div>`;
}

export function renderAdmin({ adminUsers = [], adminRole = null } = {}) {
  return `
    ${pageHeader({
      title: 'Benutzerverwaltung',
      subtitle: 'Neue Benutzer werden ausschließlich durch einen Administrator angelegt. Eine E-Mail-Bestätigung ist für diese manuell angelegten Konten nicht erforderlich.',
    })}

    <div class="inline-alert inline-alert--success">
      <strong>Admin-Modus · ${escapeHtml(adminRole || 'admin')}</strong>
      <span>Öffentliche Registrierung ist in der Finance-Oberfläche deaktiviert.</span>
    </div>

    <div class="grid-main-aside">
      <article class="card card-padding">
        <div class="card-heading">
          <div>
            <h3 class="card-title">Benutzer</h3>
            <p class="card-subtitle">${adminUsers.length} Konto${adminUsers.length === 1 ? '' : 'en'} im neuen Finance-System</p>
          </div>
        </div>
        <div class="list">
          ${adminUsers.length ? adminUsers.map(userRow).join('') : '<p class="card-subtitle">Noch keine Benutzer gefunden.</p>'}
        </div>
      </article>

      <form class="card card-padding form-card" id="adminUserForm">
        <div class="card-heading">
          <div>
            <h3 class="card-title">Benutzer anlegen</h3>
            <p class="card-subtitle">Zugang direkt erstellen</p>
          </div>
        </div>

        <div class="form-grid">
          <label class="field">
            <span>Name</span>
            <input class="text-control" name="displayName" autocomplete="off" required placeholder="z. B. Ana">
          </label>
          <label class="field">
            <span>E-Mail</span>
            <input class="text-control" name="email" type="email" autocomplete="off" required>
          </label>
          <label class="field">
            <span>Temporäres Passwort</span>
            <input class="text-control" name="password" type="password" minlength="8" autocomplete="new-password" required>
            <small>Mindestens 8 Zeichen. Das Passwort wird nicht in Finance gespeichert.</small>
          </label>
        </div>

        <div class="form-actions">
          <button class="action-button action-button--primary" type="submit">${icon('plus')} Benutzer erstellen</button>
        </div>
      </form>
    </div>`;
}
