import { dataTable, formShell, pageHeader, statusPill } from '../app/components.js';
import { dateLabel, escapeHtml } from '../app/format.js';
import { icon } from '../app/icons.js';

function demoFamilyPanel(profile) {
  const family=profile?.preferences?.demo_family;
  if (!family?.fictional) return '';
  const age=(born)=>{
    const d=new Date(String(born||'')+'T12:00:00'),today=new Date();
    if(Number.isNaN(d.getTime())) return '';
    return today.getFullYear()-d.getFullYear()-(today.getMonth()<d.getMonth()||(today.getMonth()===d.getMonth()&&today.getDate()<d.getDate())?1:0);
  };
  const members=[
    ...(Array.isArray(family.adults)?family.adults:[]).map(p=>({name:p.name,kind:p.relationship,info:'Arbeitgeber: '+(p.employer||'—')})),
    ...(Array.isArray(family.children)?family.children:[]).map(p=>({name:p.name,kind:'Kind',info:age(p.born)+' Jahre · '+(p.stage||'Schule')})),
    ...(Array.isArray(family.pets)?family.pets:[]).map(p=>({name:p.name,kind:p.type||'Haustier',info:'Familienhaustier'}))
  ];
  const cards=members.map(p=>'<div style="padding:14px;border:1px solid var(--border-color,#ddd);border-radius:12px"><small class="table-meta">'+escapeHtml(p.kind||'')+'</small><h4 style="margin:6px 0">'+escapeHtml(p.name||'')+'</h4><p class="card-subtitle">'+escapeHtml(p.info||'')+'</p></div>').join('');
  return '<article class="card card-padding" style="margin-bottom:16px"><div class="card-heading"><div><h3 class="card-title">Die Demo-Familie</h3><p class="card-subtitle">'+escapeHtml(family.location||'Schweiz')+' · Vier Personen, Hund und Katze · Alle Angaben fiktiv</p></div></div><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(185px,1fr));gap:12px">'+cards+'</div></article>';
}

export function renderFamily({ household, profile, householdMembers = [], canAdminHousehold = false } = {}) {
  const full = householdMembers.length >= 5;
  const fields = `
    <label class="field"><span>E-Mail des Benutzers</span><input class="text-control" name="email" type="email" required placeholder="z. B. ana@example.com" ${full?'disabled':''}></label>
    <label class="field"><span>Rolle</span><select class="text-control" name="role" ${full?'disabled':''}><option value="viewer">Nur lesen</option><option value="editor">Bearbeiten</option><option value="admin">Haushalt verwalten</option></select></label>
    <div class="field form-grid-span"><small>Maximal 5 Personen pro Haushalt inklusive Owner. Der Benutzer muss zuerst im Admin-Bereich angelegt sein.</small></div>`;
  const rows = householdMembers.map((m)=>`<tr><td><strong>${escapeHtml(m.display_name||'Ohne Name')}</strong><div class="table-meta">${escapeHtml(m.email||'')}</div></td><td>${statusPill(m.role,m.role)}</td><td>${dateLabel(m.created_at)}</td><td>${m.role==='owner'||!canAdminHousehold?'':`<button class="table-action table-action--danger" type="button" data-action="family-remove" data-user-id="${m.user_id}">Entfernen</button>`}</td></tr>`);
  return `
    ${pageHeader({title:'Familie & Haushalt',subtitle:`Gemeinsamer Haushalt · ${householdMembers.length}/5 App-Zugänge. Konten können privat oder gemeinsam sein.`,actions:canAdminHousehold&&!full?`<button class="action-button action-button--primary" type="button" data-action="show-form" data-target="family-add">${icon('plus')} Mitglied</button>`:''})}
    ${full?`<div class="inline-alert"><strong>Haushaltslimit erreicht.</strong><span>Dieser Haushalt enthält bereits 5 Personen inklusive Owner.</span></div>`:''}
    ${canAdminHousehold&&!full?formShell('family-add','Mitglied hinzufügen',escapeHtml(household?.name||'Haushalt'),fields,{hidden:true,submitLabel:'Mitglied hinzufügen'}):''}
    ${demoFamilyPanel(profile)}
    <div class="grid-main-aside">
      <article class="card card-padding"><div class="card-heading"><div><h3 class="card-title">App-Zugänge</h3><p class="card-subtitle">Owner, Admin, Editor oder Viewer</p></div><span>${statusPill(full?'pending':'active',`${householdMembers.length}/5`)}</span></div>${dataTable({headers:['Person','Rolle','Seit',''],rows,emptyText:'Noch keine Mitglieder.'})}</article>
      <article class="card card-padding"><div class="card-heading"><div><h3 class="card-title">Privat vs. gemeinsam</h3><p class="card-subtitle">Konten steuern die Sichtbarkeit</p></div></div><div class="stack compact-copy"><p><strong>Privates Konto:</strong> nur der Kontoinhaber sieht Konto und Transaktionen.</p><p><strong>Haushaltskonto:</strong> Mitglieder sehen es entsprechend ihrer Rolle.</p><p>Budgets, Rechnungen und Ziele sind haushaltsbezogen; Schreibrechte folgen der Haushaltsrolle.</p></div></article>
    </div>`;
}
