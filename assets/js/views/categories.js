import { dataTable, formShell, pageHeader, deleteButton } from '../app/components.js';
import { escapeHtml } from '../app/format.js';
import { icon } from '../app/icons.js';

function categoryEditButton(id) {
  return `<button class="table-action" type="button" data-action="category-edit" data-id="${escapeHtml(id)}">Bearbeiten</button>`;
}

function categoryAddChildButton(id) {
  return `<button class="table-action category-add-child" type="button" data-action="category-add-child" data-id="${escapeHtml(id)}">${icon('plus')} Unterkategorie hinzufügen</button>`;
}

function categoryHideButton(id) {
  return `<button class="table-action" type="button" data-action="category-archive" data-id="${escapeHtml(id)}">Ausblenden</button>`;
}

function hierarchyCard(category,categories,canWrite,adminRole,household,countryMasterCategories) {
  const standard=(row)=>countryMasterCategories.some((master)=>master.kind===row.kind
    &&String(master.name||'').trim().toLowerCase()===String(row.name||'').trim().toLowerCase());
  const adminTools=(row)=>adminRole&&!standard(row)
    ?`<button class="table-action" type="button" data-action="category-promote-master" data-id="${escapeHtml(row.id)}">Für ${escapeHtml(household?.country_code||'CH')} freigeben</button>`:'';
  const standardLabel=(row)=>standard(row)
    ?` · ${escapeHtml(household?.country_code||'CH')}-Standard`:'';

  const children=categories.filter((row)=>row.parent_id===category.id)
    .sort((a,b)=>String(a.name).localeCompare(String(b.name),'de',{sensitivity:'base'}));
  const count=children.length;
  return `<article class="card category-tree-card" data-category-tree>
    <div class="category-tree-head">
      <span class="hub-link-icon">${icon(category.kind==='income'?'arrow-down-left':'basket')}</span>
      <div><strong>${escapeHtml(category.name)}</strong><span>${category.kind==='income'?'Einnahme':'Ausgabe'}${standardLabel(category)}${count?` · ${count} Unterkategorie${count===1?'':'n'}`:''}</span></div>
      ${canWrite?`<div class="table-actions category-tile-actions">${categoryAddChildButton(category.id)}${categoryEditButton(category.id)}${categoryHideButton(category.id)}</div>`:''}
    </div>
    ${count?`<details class="category-children-toggle" data-category-children>
      <summary>Unterkategorien anzeigen (${count})</summary>
      <div class="category-child-list">${children.map((child)=>`<div class="category-child-row">
        <div><strong>${escapeHtml(child.name)}</strong><span>Unterkategorie${standardLabel(child)}</span></div>
        ${canWrite?`<div class="table-actions">${categoryEditButton(child.id)}${categoryHideButton(child.id)}</div>`:''}
      </div>`).join('')}</div>
    </details>`:''}
  </article>`;
}

export function renderCategories({
  categories=[],archivedCategories=[],categorizationRules=[],merchants=[],canWrite=false,adminRole=null,
  household=null,countryMasterCategories=[],
}={}) {
  const ordered=categories.slice().sort((a,b)=>String(a.name).localeCompare(String(b.name),'de',{sensitivity:'base'}));
  const parents=ordered.filter((row)=>!row.parent_id);
  const orphans=ordered.filter((row)=>row.parent_id&&!ordered.some((parent)=>parent.id===row.parent_id));
  const roots=[...parents,...orphans];
  const expenseCount=ordered.filter((row)=>row.kind==='expense').length;
  const incomeCount=ordered.filter((row)=>row.kind==='income').length;
  const parentOptions=parents.map((row)=>`<option value="${escapeHtml(row.id)}" data-kind="${escapeHtml(row.kind)}" ${row.kind==='income'?'hidden disabled':''}>${escapeHtml(row.name)} · ${row.kind==='income'?'Einnahme':'Ausgabe'}</option>`).join('');
  const allCategoryOptions=ordered.map((row)=>{
    const parent=ordered.find((c)=>c.id===row.parent_id);
    return `<option value="${escapeHtml(row.id)}">${parent?`${escapeHtml(parent.name)} › `:''}${escapeHtml(row.name)} · ${row.kind==='income'?'Einnahme':'Ausgabe'}</option>`;
  }).join('');

  const createFields=`
    <label class="field"><span>Name</span><input class="text-control" name="name" maxlength="120" required placeholder="z. B. Supermarkt"></label>
    <label class="field"><span>Typ</span><select class="text-control" name="kind"><option value="expense">Ausgabe</option><option value="income">Einnahme</option></select></label>
    <label class="field"><span>Übergeordnete Kategorie</span><select class="text-control" name="parentId"><option value="">Keine · Hauptkategorie</option>${parentOptions}</select><small>Optional: z. B. Lebensmittel › Supermarkt.</small></label>`;
  const editFields=`
    <input name="categoryId" id="categoryEditId" type="hidden">
    <label class="field form-grid-span"><span>Neuer Kategoriename</span><input class="text-control" name="name" id="categoryEditName" maxlength="120" required></label>
    <div class="inline-alert form-grid-span"><strong>Bestehende Zuordnungen bleiben erhalten.</strong><span>Buchungen, Händler und Regeln bleiben mit derselben Kategorie verknüpft. Es wird keine neue Kategorie erzeugt.</span></div>`;
  const ruleFields=`
    <label class="field"><span>Zielkategorie</span><select class="text-control" name="categoryId" required>${allCategoryOptions}</select></label>
    <label class="field"><span>Wo erkennen?</span><select class="text-control" name="fieldName"><option value="description">Buchungsbeschreibung</option><option value="counterparty">Händler / Gegenpartei</option></select></label>
    <label class="field"><span>Vergleich</span><select class="text-control" name="matchType"><option value="contains">enthält</option><option value="starts_with">beginnt mit</option><option value="exact">ist genau</option></select></label>
    <label class="field"><span>Suchwert</span><input class="text-control" name="matchValue" required placeholder="z. B. Sonderfall"></label>`;
  const ruleRows=categorizationRules.map((row)=>`<tr><td>${escapeHtml(row.categories?.name||ordered.find((c)=>c.id===row.category_id)?.name||'')}</td><td>${escapeHtml(row.field_name==='counterparty'?'Händler / Gegenpartei':'Beschreibung')}</td><td>${escapeHtml(row.match_type)}: <strong>${escapeHtml(row.match_value)}</strong></td><td>${canWrite?deleteButton('categorization_rules',row.id):''}</td></tr>`);

  return `
    ${pageHeader({
      title:'Kategorien',
      subtitle:'Kategorien auswählen, umbenennen oder direkt in einer Kachel Unterkategorien hinzufügen.',
      actions:canWrite?`<button class="action-button action-button--primary" type="button" data-action="show-form" data-target="category-create">${icon('plus')} Kategorie hinzufügen</button><a class="action-button action-button--secondary" href="#/merchants">Händler</a>`:'<a class="action-button action-button--secondary" href="#/merchants">Händler ansehen</a>'
    })}
    ${canWrite?formShell('category-create','Kategorie hinzufügen','Nur anlegen, was für die eigene Übersicht gebraucht wird.',createFields,{hidden:true,submitLabel:'Kategorie speichern'}):''}
    ${canWrite?formShell('category-edit','Kategorie umbenennen','Der Name ändert sich überall, die Verknüpfungen bleiben bestehen.',editFields,{hidden:true,submitLabel:'Namen speichern'}):''}
    <div class="card card-padding" style="margin-bottom:14px">
      <div class="card-heading"><div><h3 class="card-title">Aktive Kategorien</h3><p class="card-subtitle">${expenseCount} Ausgaben · ${incomeCount} Einnahmen. Hier stehen nur die aktuell auswählbaren Kategorien und Unterkategorien.</p></div></div>
      <label class="field"><span>Kategorie suchen</span><input class="text-control" type="search" id="categorySearch" placeholder="z. B. Gerichtskosten, Lebensmittel"></label>
      <small>Hauptkategorien sind sichtbar, Unterkategorien werden erst bei Bedarf aufgeklappt. Eine Kategorie erscheint hier nur einmal.</small>
    </div>
    <div class="category-tree-grid">
      ${roots.length?roots.map((row)=>hierarchyCard(row,ordered,canWrite,adminRole,household,countryMasterCategories)).join(''):'<div class="card card-padding table-empty">Noch keine Kategorien. Bei Bedarf eine Kategorie hinzufügen.</div>'}
    </div>
    <p class="card-subtitle">«Ausblenden» entfernt die Kategorie aus deiner Auswahl, aber keine historischen Buchungen. Auch Unterkategorien einer ausgeblendeten Hauptkategorie werden nicht mehr angezeigt.</p>
    <details class="card card-padding category-advanced" id="category-settings">
      <summary>Kategorie-Einstellungen</summary>
      <p class="card-subtitle">Hier stehen ausgeblendete Kategorien, automatische Erkennungsregeln und erweiterte Einstellungen – nicht nochmals die aktiven Kategorien.</p>
      <div class="card-heading" style="margin-top:16px"><div><h3 class="card-title">Ausgeblendete Kategorien</h3>
        <p class="card-subtitle">Diese Kategorien erscheinen nicht mehr bei neuen Zuordnungen. Historische Buchungen bleiben erhalten.</p></div></div>
      ${archivedCategories.length
        ? `<div class="category-hidden-list">${archivedCategories
          .slice().sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'de'))
          .map((row)=>`<div class="category-child-row"><div><strong>${escapeHtml(row.name)}</strong><span>${row.parent_id?'Unterkategorie':'Hauptkategorie'}</span></div>
            ${canWrite?`<button class="table-action" type="button" data-action="category-restore" data-id="${escapeHtml(row.id)}">Wieder einblenden</button>`:''}</div>`).join('')}</div>`
        : '<p class="card-subtitle">Keine Kategorien ausgeblendet.</p>'}
      <details class="category-advanced" style="margin-top:18px">
        <summary>Automatische Textregeln</summary>
        ${canWrite?formShell('rule-create','Kategorisierungsregel','Nur für Sonderfälle ohne Händlerzuordnung.',ruleFields,{hidden:false,submitLabel:'Regel speichern'}):''}
        ${dataTable({headers:['Kategorie','Feld','Regel',''],rows:ruleRows,emptyText:'Noch keine Regeln.'})}
      </details>
      ${adminRole?`<details class="category-advanced" style="margin-top:18px">
        <summary>Länderstandard verwalten</summary>
        <p class="card-subtitle">Nur für Administratoren. Eigene Kategorien für ${escapeHtml(household?.country_code||'CH')} freigeben.</p>
        ${ordered.filter((row)=>!countryMasterCategories.some((master)=>master.kind===row.kind
          &&String(master.name||'').trim().toLowerCase()===String(row.name||'').trim().toLowerCase()))
          .map((row)=>`<div class="category-child-row"><span>${escapeHtml(row.name)}</span>
          <button class="table-action" type="button" data-action="category-promote-master" data-id="${escapeHtml(row.id)}">Für ${escapeHtml(household?.country_code||'CH')} freigeben</button></div>`).join('')||'<p class="card-subtitle">Alle aktiven Kategorien sind im Länderstandard vorhanden.</p>'}
        <small>${escapeHtml(household?.country_code||'CH')}-Standard</small>
      </details>`:''}
    </details>`;
}
