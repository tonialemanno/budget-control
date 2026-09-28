import { dataTable, formShell, pageHeader, statusPill } from '../app/components.js';
import { dateLabel, escapeHtml } from '../app/format.js';
import { icon } from '../app/icons.js';

export function renderFamily({ household, householdMembers = [], canAdminHousehold = false } = {}) {
  const fields = `
    <label class="field"><span>E-Mail des Benutzers</span><input class="text-control" name="email" type="email" required placeholder="z. B. ana@example.com"></label>
    <label class="field"><span>Rolle</span><select class="text-control" name="role"><option value="viewer">Nur lesen</option><option value="editor">Bearbeiten</option><option value="admin">Haushalt verwalten</option></select></label>
    <div class="field form-grid-span"><small>Der Benutzer muss zuerst im Admin-Bereich angelegt sein.</small></div>`;
  const rows = householdMembers.map((m)=>`<tr><td><strong>${escapeHtml(m.display_name||'Ohne Name')}</strong><div class="table-meta">${escapeHtml(m.email||'')}</div></td><td>${statusPill(m.role,m.role)}</td><td>${dateLabel(m.created_at)}</td><td>${m.role==='owner'||!canAdminHousehold?'':`<button class="table-action table-action--danger" type="button" data-action="family-remove" data-user-id="${m.user_id}">Entfernen</button>`}</td></tr>`);
  return `
    ${pageHeader({title:'Familie & Haushalt',subtitle:'Gemeinsamer Haushalt mit Rollen. Konten können privat bleiben oder für den Haushalt freigegeben werden.',actions:canAdminHousehold?`<button class="action-button action-button--primary" type="button" data-action="show-form" data-target="family-add">${icon('plus')} Mitglied</button>`:''})}
    ${canAdminHousehold?formShell('family-add','Mitglied hinzufügen',escapeHtml(household?.name||'Haushalt'),fields,{hidden:true,submitLabel:'Mitglied hinzufügen'}):''}
    <div class="grid-main-aside">
      <article class="card card-padding"><div class="card-heading"><div><h3 class="card-title">Mitglieder</h3><p class="card-subtitle">Owner, Admin, Editor oder Viewer</p></div></div>${dataTable({headers:['Person','Rolle','Seit',''],rows,emptyText:'Noch keine Mitglieder.'})}</article>
      <article class="card card-padding"><div class="card-heading"><div><h3 class="card-title">Privat vs. gemeinsam</h3><p class="card-subtitle">Konten steuern die Sichtbarkeit</p></div></div><div class="stack compact-copy"><p><strong>Privates Konto:</strong> nur der Kontoinhaber sieht Konto und Transaktionen.</p><p><strong>Haushaltskonto:</strong> Mitglieder sehen es entsprechend ihrer Rolle.</p><p>Budgets, Rechnungen und Ziele sind aktuell haushaltsbezogen.</p></div></article>
    </div>`;
}
