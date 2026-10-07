import { dataTable, formShell, pageHeader, deleteButton } from '../app/components.js';
import { escapeHtml } from '../app/format.js';
import { icon } from '../app/icons.js';

function hierarchyCard(category, categories, rules, merchants, canWrite, adminRole, household, countryMasterCategories) {
  const children = categories.filter((row)=>row.parent_id===category.id);
  const targetIds = new Set([category.id, ...children.map((row)=>row.id)]);
  const merchantRows = merchants.filter((merchant)=>targetIds.has(merchant.default_category_id));
  const ruleRows = rules.filter((rule)=>targetIds.has(rule.category_id));
  const isCountryStandard=countryMasterCategories.some((row)=>row.kind===category.kind && String(row.name||'').toLowerCase()===String(category.name||'').toLowerCase());
  const promoteAction=adminRole && !isCountryStandard
    ? `<button class="table-action" type="button" data-action="category-promote-master" data-id="${category.id}">Für ${escapeHtml(household?.country_code||'CH')} freigeben</button>`
    : '';

  const childHtml = children.length
    ? `<div class="category-child-list">${children.map((child)=>{
        const childMerchants=merchants.filter((merchant)=>merchant.default_category_id===child.id);
        const childRules=rules.filter((rule)=>rule.category_id===child.id);
        const names=childMerchants.slice(0,4).map((merchant)=>merchant.name).join(' · ');
        return `<div class="category-child-row"><div><strong>${escapeHtml(child.name)}</strong><span>${childMerchants.length} Händler${names?` · ${escapeHtml(names)}`:''}${childRules.length?` · ${childRules.length} Regel${childRules.length===1?'':'n'}`:''}</span></div>${canWrite?deleteButton('categories',child.id):''}</div>`;
      }).join('')}</div>`
    : '<div class="category-empty-child">Noch keine Unterkategorie</div>';

  return `<article class="card category-tree-card">
    <div class="category-tree-head">
      <span class="hub-link-icon">${icon(category.kind==='income'?'arrow-down-left':'basket')}</span>
      <div><strong>${escapeHtml(category.name)}</strong><span>${category.kind==='income'?'Einnahme':'Ausgabe'} · ${children.length} Unterkategorie${children.length===1?'':'n'} · ${merchantRows.length} Händler · ${ruleRows.length} Regeln</span></div>
      ${canWrite?`<div class="table-actions">${promoteAction}${deleteButton('categories',category.id)}</div>`:''}
    </div>
    ${childHtml}
  </article>`;
}

export function renderCategories({
  categories = [], categorizationRules = [], merchants = [], canWrite = false, adminRole = null,
  household = null, countryMasterCategories = [],
} = {}) {
  const parentOptions = categories.filter((c)=>!c.parent_id).map((c)=>`<option value="${c.id}" data-kind="${c.kind}" ${c.kind==='income'?'hidden disabled':''}>${escapeHtml(c.name)} · ${c.kind==='income'?'Einnahme':'Ausgabe'}</option>`).join('');
  const allCategoryOptions = categories.map((c)=>{
    const parent=categories.find((p)=>p.id===c.parent_id);
    return `<option value="${c.id}">${parent?`${escapeHtml(parent.name)} › `:''}${escapeHtml(c.name)} · ${c.kind==='income'?'Einnahme':'Ausgabe'}</option>`;
  }).join('');

  const categoryFields = `
    <label class="field"><span>Name</span><input class="text-control" name="name" required placeholder="z. B. Supermarkt"></label>
    <label class="field"><span>Typ</span><select class="text-control" name="kind"><option value="expense">Ausgabe</option><option value="income">Einnahme</option></select></label>
    <label class="field"><span>Übergeordnete Kategorie</span><select class="text-control" name="parentId"><option value="">Keine · Hauptkategorie</option>${parentOptions}</select><small>Beispiel: Lebensmittel › Supermarkt.</small></label>
    <label class="field"><span>Symbol / Farbe</span><input class="text-control" name="icon" placeholder="optional"></label>`;

  const ruleFields = `
    <label class="field"><span>Zielkategorie</span><select class="text-control" name="categoryId" required>${allCategoryOptions}</select></label>
    <label class="field"><span>Wo erkennen?</span><select class="text-control" name="fieldName"><option value="description">Buchungsbeschreibung</option><option value="counterparty">Händler / Gegenpartei</option></select></label>
    <label class="field"><span>Vergleich</span><select class="text-control" name="matchType"><option value="contains">enthält</option><option value="starts_with">beginnt mit</option><option value="exact">ist genau</option></select></label>
    <label class="field"><span>Suchwert</span><input class="text-control" name="matchValue" required placeholder="z. B. Sonderfall"></label>`;

  const categoryRows = categories.map((c)=>{
    const parent=categories.find((p)=>p.id===c.parent_id);
    const isCountryStandard=countryMasterCategories.some((row)=>row.kind===c.kind && String(row.name||'').toLowerCase()===String(c.name||'').toLowerCase());
    const promoteAction=adminRole && !isCountryStandard
      ? `<button class="table-action" type="button" data-action="category-promote-master" data-id="${c.id}">Für ${escapeHtml(household?.country_code||'CH')} freigeben</button>`
      : '';
    return `<tr><td><strong>${escapeHtml(c.name)}</strong>${isCountryStandard?`<div class="table-meta">${escapeHtml(household?.country_code||'CH')}-Standard</div>`:''}</td><td>${c.kind==='income'?'Einnahme':'Ausgabe'}</td><td>${escapeHtml(parent?.name || 'Hauptkategorie')}</td><td>${canWrite?`<div class="table-actions">${promoteAction}${deleteButton('categories',c.id)}</div>`:''}</td></tr>`;
  });

  const ruleRows = categorizationRules.map((r)=>`<tr><td>${escapeHtml(r.categories?.name || categories.find((c)=>c.id===r.category_id)?.name || '')}</td><td>${escapeHtml(r.field_name==='counterparty'?'Händler / Gegenpartei':'Beschreibung')}</td><td>${escapeHtml(r.match_type)}: <strong>${escapeHtml(r.match_value)}</strong></td><td>${canWrite?deleteButton('categorization_rules',r.id):''}</td></tr>`);
  const parents=categories.filter((c)=>!c.parent_id);
  const legacySavingCategory=categories.find((c)=>c.kind==='expense'&&String(c.name||'').trim().toLowerCase()==='sparen');

  return `
    ${pageHeader({
      title:'Kategorien & Unterkategorien',
      subtitle:'Baue zuerst die Struktur deiner Finanzen. Händler werden separat gepflegt und erhalten hier ihre Standardkategorie.',
      actions:canWrite?`<button class="action-button action-button--primary" type="button" data-action="show-form" data-target="category-create">${icon('plus')} Kategorie</button><a class="action-button action-button--secondary" href="#/merchants">${icon('basket')} Händler</a><button class="action-button action-button--secondary" type="button" data-action="starter-categories">Empfohlene Struktur</button>`:'<a class="action-button action-button--secondary" href="#/merchants">Händler ansehen</a>'
    })}

    <div class="inline-alert inline-alert--success"><strong>So ist es gedacht: Lebensmittel › Supermarkt › Coop.</strong><span>„Coop“ bleibt ein Händler. Seine Standardkategorie ist „Supermarkt“. Dadurch kann Spendy neue Buchungen automatisch richtig einordnen.</span></div>
    ${legacySavingCategory?'<div class="inline-alert"><strong>„Sparen“ ist keine neue Ausgabenkategorie mehr.</strong><span>Historische Zuordnungen bleiben erhalten. Neue Sparbewegungen bitte als Umbuchung auf ein Sparkonto oder als Rücklage erfassen; dadurch werden deine Ausgaben nicht künstlich erhöht.</span></div>':''}

    ${canWrite?formShell('category-create','Kategorie oder Unterkategorie','Eine Hauptkategorie kann weitere Unterkategorien enthalten.',categoryFields,{hidden:true,submitLabel:'Kategorie speichern'}):''}

    <div class="category-tree-grid">
      ${parents.length?parents.map((category)=>hierarchyCard(category,categories,categorizationRules,merchants,canWrite,adminRole,household,countryMasterCategories)).join(''):'<div class="card card-padding table-empty">Noch keine Kategorien. Nutze „Empfohlene Struktur“, um mit einer sinnvollen Basis zu starten.</div>'}
    </div>

    <details class="card card-padding category-advanced">
      <summary>Erweiterte Regeln & technische Verwaltung</summary>
      ${canWrite?formShell('rule-create','Kategorisierungsregel','Für Sonderfälle, die nicht über einen bekannten Händler gelöst werden können.',ruleFields,{hidden:false,submitLabel:'Regel speichern'}):''}
      <div class="grid-2 category-advanced-grid">
        <div><div class="card-heading"><div><h3 class="card-title">Alle Kategorien</h3><p class="card-subtitle">Listenansicht inklusive Unterkategorien</p></div></div>${dataTable({headers:['Name','Typ','Ebene',''],rows:categoryRows,emptyText:'Noch keine Kategorien.'})}</div>
        <div><div class="card-heading"><div><h3 class="card-title">Textregeln</h3><p class="card-subtitle">Nur für Fälle ohne klare Händlerzuordnung</p></div></div>${dataTable({headers:['Kategorie','Feld','Regel',''],rows:ruleRows,emptyText:'Noch keine Regeln.'})}</div>
      </div>
    </details>`;
}
