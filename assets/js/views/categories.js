import { dataTable, formShell, pageHeader, deleteButton } from '../app/components.js';
import { escapeHtml } from '../app/format.js';
import { icon } from '../app/icons.js';
import { renderCategoryWorkspaceNav } from './category-workspace.js';

const ordered=(rows)=>[...rows].sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'de',{sensitivity:'base'}));
function categoryInlineName(row){
  return `<div class="category-inline-name" data-category-entry="${escapeHtml(row.id)}">
    <strong data-category-label="${escapeHtml(row.id)}">${escapeHtml(row.name)}</strong>
    <form data-form="category-rename-inline" class="category-inline-form" hidden>
      <input type="hidden" name="categoryId" value="${escapeHtml(row.id)}">
      <label><span class="sr-only">Kategoriename</span><input class="text-control" name="name" value="${escapeHtml(row.name)}" maxlength="120" required aria-label="Kategoriename bearbeiten"></label>
      <button class="table-action" type="submit">Speichern</button>
      <button class="table-action" type="button" data-action="category-inline-cancel">Abbrechen</button>
    </form>
  </div>`;
}
function editActions(row,canWrite,{allowChild=false}={}){
  if(!canWrite)return '';
  return `<div class="table-actions category-tile-actions">
    ${allowChild?`<button class="table-action category-add-child" type="button" data-action="category-add-child" data-id="${escapeHtml(row.id)}">${icon('plus')} Unterkategorie hinzufügen</button>`:''}
    <button class="table-action" type="button" data-action="category-edit" data-id="${escapeHtml(row.id)}">Bearbeiten</button>
    <button class="table-action" type="button" data-action="category-archive" data-id="${escapeHtml(row.id)}">Ausblenden</button>
  </div>`;
}
function hierarchyCard(parent,all,canWrite,countryCode,standards){
  const children=ordered(all.filter(row=>row.parent_id===parent.id));
  const countryStandard=standards.some(row=>row.kind===parent.kind&&String(row.name).toLowerCase()===String(parent.name).toLowerCase());
  return `<article class="card category-tree-card" data-category-tree>
    <div class="category-tree-head">
      <span class="hub-link-icon">${icon(parent.kind==='income'?'arrow-down-left':'basket')}</span>
      <div>${categoryInlineName(parent)}<span>${parent.kind==='income'?'Einnahme':'Ausgabe'}${countryStandard?` · ${escapeHtml(countryCode)}-Standard`:''} · ${children.length} Unterkategorie${children.length===1?'':'n'}</span></div>
      ${editActions(parent,canWrite,{allowChild:true})}
    </div>
    ${children.length?`<details class="category-children-toggle" data-category-children>
      <summary>Unterkategorien anzeigen (${children.length})</summary>
      <div class="category-child-list">${children.map(child=>`<div class="category-child-row">
        <div>${categoryInlineName(child)}<span>Unterkategorie</span></div>
        ${editActions(child,canWrite)}
      </div>`).join('')}</div>
    </details>`:''}
  </article>`;
}

export function renderCategories({
  categories=[],archivedCategories=[],categorizationRules=[],canWrite=false,adminRole=null,
  household=null,countryMasterCategories=[],categoryView='main',
}={}){
  const active=ordered(categories);
  const parents=active.filter(row=>!row.parent_id);
  const children=active.filter(row=>row.parent_id);
  const view=['main','children','rules','structure','settings'].includes(categoryView)?categoryView:'main';
  const countryCode=household?.country_code||'CH';
  const parentOptions=parents.map(row=>`<option value="${escapeHtml(row.id)}" data-kind="${escapeHtml(row.kind)}">${escapeHtml(row.name)} · ${row.kind==='income'?'Einnahme':'Ausgabe'}</option>`).join('');
  const categoryOptions=active.map(row=>`<option value="${escapeHtml(row.id)}">${row.parent_id?`${escapeHtml(parents.find(p=>p.id===row.parent_id)?.name||'')} › `:''}${escapeHtml(row.name)}</option>`).join('');
  const createFields=`
    <label class="field"><span>Name</span><input class="text-control" name="name" required maxlength="120" placeholder="z. B. Supermarkt"></label>
    <label class="field"><span>Typ</span><select class="text-control" name="kind"><option value="expense">Ausgabe</option><option value="income">Einnahme</option></select></label>
    <label class="field"><span>Übergeordnete Kategorie</span><select class="text-control" name="parentId"><option value="">Keine · Hauptkategorie</option>${parentOptions}</select></label>`;
  const ruleFields=`
    <label class="field"><span>Zielkategorie</span><select class="text-control" name="categoryId" required>${categoryOptions}</select></label>
    <label class="field"><span>Wo erkennen?</span><select class="text-control" name="fieldName"><option value="description">Buchungsbeschreibung</option><option value="counterparty">Händler / Gegenpartei</option></select></label>
    <label class="field"><span>Vergleich</span><select class="text-control" name="matchType"><option value="contains">enthält</option><option value="starts_with">beginnt mit</option><option value="exact">ist genau</option></select></label>
    <label class="field"><span>Suchwert</span><input class="text-control" name="matchValue" required></label>`;
  const ruleRows=categorizationRules.map(row=>`<tr><td>${escapeHtml(active.find(c=>c.id===row.category_id)?.name||row.categories?.name||'')}</td>
     <td>${escapeHtml(row.field_name==='counterparty'?'Händler / Gegenpartei':'Beschreibung')}</td>
     <td>${escapeHtml(row.match_type)}: <strong>${escapeHtml(row.match_value)}</strong></td>
     <td>${canWrite?deleteButton('categorization_rules',row.id):''}</td></tr>`);
  const settingsList=parents.map(row=>`<div class="category-settings-group">
    <div class="category-child-row"><div><small>Hauptkategorie · ${row.kind==='income'?'Einnahme':'Ausgabe'}</small>${categoryInlineName(row)}</div>
      ${editActions(row,canWrite,{allowChild:true})}</div>
    ${ordered(children.filter(child=>child.parent_id===row.id)).map(child=>`<div class="category-child-row category-settings-child"><div><small>Unterkategorie von ${escapeHtml(row.name)}</small>${categoryInlineName(child)}</div>
      ${editActions(child,canWrite)}</div>`).join('')}
  </div>`).join('');
  const hiddenList=archivedCategories.length
    ?`<div class="category-hidden-list">${ordered(archivedCategories).map(row=>`<div class="category-child-row"><div><strong>${escapeHtml(row.name)}</strong><small>${row.parent_id?'Unterkategorie':'Hauptkategorie'}</small></div>
      ${canWrite?`<button class="table-action" type="button" data-action="category-restore" data-id="${escapeHtml(row.id)}">Wieder einblenden</button>`:''}</div>`).join('')}</div>`
    : '<p class="card-subtitle">Keine Kategorien ausgeblendet.</p>';
  const standards=active.filter(row=>!countryMasterCategories.some(master=>master.kind===row.kind&&String(master.name||'').toLowerCase()===String(row.name||'').toLowerCase()));

  return `
    ${pageHeader({title:'Kategorien & Regeln',subtitle:'Hauptkategorien, Unterkategorien, Regeln und Händler an einem Ort.',
      actions:'<a class="action-button action-button--secondary" href="/selfservice/categories?view=rules">Regeln</a>'})}
    ${renderCategoryWorkspaceNav(view)}
    ${canWrite?formShell('category-create','Kategorie hinzufügen','Neue Kategorien nur dort anlegen, wo sie wirklich gebraucht werden.',createFields,{hidden:true,submitLabel:'Kategorie speichern'}):''}
    ${view==='main'?`
    <section class="card card-padding" style="margin-bottom:14px">
      <div class="card-heading"><div><h3 class="card-title">Aktive Kategorien</h3><p class="card-subtitle">${active.filter(row=>row.kind==='expense').length} Ausgaben · ${active.filter(row=>row.kind==='income').length} Einnahmen. Unterkategorien lassen sich in den Kacheln öffnen.</p></div>
        <a class="card-link" href="/selfservice/categories?view=settings">Kategorie-Einstellungen</a></div>
      <label class="field"><span>Kategorie suchen</span><input class="text-control" type="search" id="categorySearch" placeholder="z. B. Lebensmittel oder Gerichtskosten"></label>
    </section>
    <div class="category-tree-grid">${parents.map(row=>hierarchyCard(row,active,canWrite,countryCode,countryMasterCategories)).join('')||'<div class="card card-padding">Noch keine Kategorien.</div>'}</div>
    <a class="action-button action-button--secondary" href="/selfservice/categories?view=settings">Kategorie-Einstellungen öffnen</a>
    `:''}
    ${view==='children'?`
    <article class="card card-padding"><div class="card-heading"><div><h3 class="card-title">Unterkategorien</h3><p class="card-subtitle">Jede Unterkategorie zeigt ihre Hauptkategorie.</p></div></div>
      ${parents.map(parent=>`<div class="category-settings-group"><h4>${escapeHtml(parent.name)}</h4>
        ${canWrite?`<button class="table-action" type="button" data-action="category-add-child" data-id="${escapeHtml(parent.id)}">${icon('plus')} Unterkategorie hinzufügen</button>`:''}
        ${ordered(children.filter(row=>row.parent_id===parent.id)).map(child=>`<div class="category-child-row"><div>${categoryInlineName(child)}<small>Hauptkategorie: ${escapeHtml(parent.name)}</small></div>${editActions(child,canWrite)}</div>`).join('')||'<p class="card-subtitle">Noch keine Unterkategorien.</p>'}
      </div>`).join('')}</article>`:''}
    ${view==='rules'?`<article class="card card-padding"><h3 class="card-title">Regeln</h3>
      <p class="card-subtitle">Automatische Textregeln sind optional. Händler werden normalerweise über ihre Standardkategorie erkannt.</p>
      ${canWrite?formShell('rule-create','Neue Regel','Nur für Fälle ohne eindeutige Händlerzuordnung.',ruleFields,{hidden:false,submitLabel:'Regel speichern'}):''}
      ${dataTable({headers:['Kategorie','Feld','Regel',''],rows:ruleRows,emptyText:'Keine zusätzlichen Regeln eingerichtet.'})}
    </article>`:''}
    ${view==='structure'?`<article class="card card-padding"><h3 class="card-title">Empfohlene Struktur</h3>
      <p>Hier kann der Länderstandard ergänzt werden. Bereits vorhandene oder ausgeblendete Kategorien dürfen dabei nicht neu erscheinen.</p>
      ${canWrite?`<button class="action-button action-button--primary" type="button" data-action="starter-categories">Empfohlene Struktur ergänzen</button>`:''}
      <p class="card-subtitle">Deine eigenen Kategorien und die Verknüpfungen bestehender Buchungen bleiben erhalten.</p>
    </article>`:''}
    ${view==='settings'?`<article class="card card-padding" id="category-settings">
      <div class="card-heading"><div><h3 class="card-title">Kategorie-Einstellungen</h3>
        <p class="card-subtitle">Hier bearbeitest du Namen und legst Haupt- oder Unterkategorien an. Die Hauptkategorie steht bei jeder Unterkategorie.</p></div>
        ${canWrite?`<button class="action-button action-button--primary" type="button" data-action="show-form" data-target="category-create">${icon('plus')} Kategorie hinzufügen</button>`:''}</div>
      <div class="category-settings-list">${settingsList||'<p>Keine Kategorien eingerichtet.</p>'}</div>
      <details class="category-advanced"><summary>Ausgeblendete Kategorien (${archivedCategories.length})</summary>
        <p class="card-subtitle">Ausblenden entfernt keine alten Buchungen. Hier kannst du Kategorien wieder aktivieren.</p>
        ${hiddenList}
      </details>
      ${adminRole?`<details class="category-advanced"><summary>Länderstandard verwalten</summary>
        ${standards.map(row=>`<div class="category-child-row"><span>${escapeHtml(row.name)}</span>
           <button class="table-action" type="button" data-action="category-promote-master" data-id="${escapeHtml(row.id)}">Für ${escapeHtml(countryCode)} freigeben</button></div>`).join('')||'<span>Alle Kategorien sind im Länderstandard.</span>'}
        <small>${escapeHtml(countryCode)}-Standard</small>
      </details>`:''}
    </article>`:''}
  `;
}
