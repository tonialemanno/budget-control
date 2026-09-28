import { dataTable, formShell, pageHeader, deleteButton } from '../app/components.js';
import { escapeHtml } from '../app/format.js';
import { icon } from '../app/icons.js';

export function renderCategories({ categories = [], categorizationRules = [] } = {}) {
  const parentOptions = categories.map((c)=>`<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
  const categoryFields = `
    <label class="field"><span>Name</span><input class="text-control" name="name" required placeholder="z. B. Lebensmittel"></label>
    <label class="field"><span>Typ</span><select class="text-control" name="kind"><option value="expense">Ausgabe</option><option value="income">Einnahme</option></select></label>
    <label class="field"><span>Übergeordnete Kategorie</span><select class="text-control" name="parentId"><option value="">Keine</option>${parentOptions}</select></label>
    <label class="field"><span>Symbol / Farbe</span><input class="text-control" name="icon" placeholder="optional"></label>`;
  const ruleFields = `
    <label class="field"><span>Kategorie</span><select class="text-control" name="categoryId" required>${parentOptions}</select></label>
    <label class="field"><span>Prüffeld</span><select class="text-control" name="fieldName"><option value="description">Beschreibung</option><option value="counterparty">Gegenpartei</option></select></label>
    <label class="field"><span>Vergleich</span><select class="text-control" name="matchType"><option value="contains">enthält</option><option value="starts_with">beginnt mit</option><option value="exact">ist genau</option></select></label>
    <label class="field"><span>Suchwert</span><input class="text-control" name="matchValue" required placeholder="z. B. Migros"></label>`;

  const categoryRows = categories.map((c)=>`<tr><td><strong>${escapeHtml(c.name)}</strong></td><td>${c.kind==='income'?'Einnahme':'Ausgabe'}</td><td>${escapeHtml(categories.find((p)=>p.id===c.parent_id)?.name || '—')}</td><td>${deleteButton('categories',c.id)}</td></tr>`);
  const ruleRows = categorizationRules.map((r)=>`<tr><td>${escapeHtml(r.categories?.name || '')}</td><td>${escapeHtml(r.field_name==='counterparty'?'Gegenpartei':'Beschreibung')}</td><td>${escapeHtml(r.match_type)}: <strong>${escapeHtml(r.match_value)}</strong></td><td>${deleteButton('categorization_rules',r.id)}</td></tr>`);

  return `
    ${pageHeader({title:'Kategorien & Regeln',subtitle:'Kategorien können direkt hier angelegt werden. Regeln helfen bei manuellen und CSV-importierten Transaktionen.',actions:`<button class="action-button action-button--primary" type="button" data-action="show-form" data-target="category-create">${icon('plus')} Kategorie</button><button class="action-button action-button--secondary" type="button" data-action="show-form" data-target="rule-create">${icon('plus')} Regel</button><button class="action-button action-button--secondary" type="button" data-action="starter-categories">Starter-Kategorien</button>`})}
    ${formShell('category-create','Neue Kategorie','Für Einnahmen oder Ausgaben',categoryFields,{hidden:true,submitLabel:'Kategorie speichern'})}
    ${formShell('rule-create','Neue Kategorisierungsregel','Automatische Zuordnung nach Text',ruleFields,{hidden:true,submitLabel:'Regel speichern'})}
    <div class="grid-2">
      <article class="card card-padding"><div class="card-heading"><div><h3 class="card-title">Kategorien</h3><p class="card-subtitle">Zentrale Finance-Core-Kategorien</p></div></div>${dataTable({headers:['Name','Typ','Übergeordnet',''],rows:categoryRows,emptyText:'Noch keine Kategorien.'})}</article>
      <article class="card card-padding"><div class="card-heading"><div><h3 class="card-title">Regeln</h3><p class="card-subtitle">Priorisierte Textregeln</p></div></div>${dataTable({headers:['Kategorie','Feld','Regel',''],rows:ruleRows,emptyText:'Noch keine Regeln.'})}</article>
    </div>`;
}
