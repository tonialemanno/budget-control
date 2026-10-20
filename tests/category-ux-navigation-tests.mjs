import assert from 'node:assert/strict';
import fs from 'node:fs';
import { renderCategories } from '../assets/js/views/categories.js';
import { renderMerchants } from '../assets/js/views/merchants.js';
import { renderCategoryWorkspaceNav } from '../assets/js/views/category-workspace.js';
import { renderSetupGuide } from '../assets/js/views/setup.js';
import { renderFixedCosts } from '../assets/js/views/fixed-costs.js';

const categories=[
 {id:'legal',name:'Rechts- & Gerichtskosten',kind:'expense',parent_id:null},
 {id:'court',name:'Gerichtskosten',kind:'expense',parent_id:'legal'},
 {id:'lawyer',name:'Anwaltskosten',kind:'expense',parent_id:'legal'},
 {id:'income',name:'Kindergeld',kind:'income',parent_id:null},
];
const household={country_code:'DE',base_currency:'EUR'};
const html=renderCategories({categories,canWrite:true,household,categoryView:'main'});
assert.equal((html.match(/data-category-label="court"/g)||[]).length,1,'one inline entry for Gerichtskosten');
assert.equal((html.match(/data-category-label="lawyer"/g)||[]).length,1,'one inline entry for Anwaltskosten');
assert.match(html,/data-action="category-edit" data-id="court"/);
assert.match(html,/data-action="category-edit" data-id="legal"/);
assert.match(html,/data-form="category-rename-inline"/);
assert.doesNotMatch(html,/id="categoryEditName"/,'no distant edit form');
assert.match(html,/data-action="category-archive" data-id="legal"/);
assert.match(html,/Unterkategorien anzeigen \(2\)/);
assert.match(html,/Aktive Kategorien/);
assert.match(html,/category-workspace-nav/);
assert.equal((html.match(/data-action="category-add-child"/g)||[]).length,2);
assert.match(html,/data-action="category-add-child" data-id="legal"/);
assert.doesNotMatch(html,/data-action="category-add-child" data-id="court"/);
assert.doesNotMatch(html,/Alle Kategorien/);
const settings=renderCategories({categories,canWrite:true,household,categoryView:'settings',
  archivedCategories:[{id:'hidden',name:'Ehemalig',kind:'expense',is_archived:true}]});
assert.match(settings,/Kategorie-Einstellungen/);
assert.match(settings,/Hauptkategorie/);
assert.match(settings,/Unterkategorie von Rechts- &amp; Gerichtskosten/);
assert.match(settings,/data-action="category-restore" data-id="hidden"/);
assert.match(settings,/data-target="category-create"/);
assert.ok(html.includes('Aktive Kategorien'),'active view does not open category management by default');
const rules=renderCategories({categories,categoryView:'rules',canWrite:true});
assert.match(rules,/Neue Regel/);
const structure=renderCategories({categories,categoryView:'structure',canWrite:true});
assert.match(structure,/Empfohlene Struktur ergänzen/);
assert.match(renderCategoryWorkspaceNav('merchants'),/Hauptkategorien/);
assert.match(renderCategoryWorkspaceNav('merchants'),/aria-current="page">Händler/);
const readonly=renderCategories({categories,canWrite:false});
assert.doesNotMatch(readonly,/data-action="category-edit"/);
assert.doesNotMatch(readonly,/data-action="category-archive"/);
const merchantHtml=renderMerchants({merchants:[{id:'m1',name:'EDEKA',normalized_key:'edeka'}],canWrite:true});
assert.match(merchantHtml,/category-workspace-nav/);
const listPos=merchantHtml.indexOf('Meine Händler');
assert.ok(listPos>0);
assert.match(merchantHtml,/Expertenbereich: mehrere Händler zusammenführen/);

const fixed=renderFixedCosts({household,canWrite:true});
for(const d of ['income','expense','transfer'])assert.match(fixed,new RegExp('data-action="fixed-cost-open" data-direction="'+d+'"'));
assert.doesNotMatch(fixed,/Position hinzufügen|Einzelne Rechnungen/);
for(const text of ['Feste Einnahmen','Fixe Ausgaben','Rücklagen','Monatliche Verpflichtungen'])assert.ok(fixed.includes(text));
const setup=renderSetupGuide({household,profile:{locale:'de-DE'},canWrite:true});
assert.match(setup,/data-setup-step="recurring"/);
assert.doesNotMatch(setup,/id="setup-income-create"|id="setup-expense-create"/,'setup is a checklist, not a fixed-cost editor');
assert.match(setup,/Alle festen Positionen öffnen|>Öffnen</);
const main=fs.readFileSync(new URL('../assets/js/main.js',import.meta.url),'utf8');
const api=fs.readFileSync(new URL('../assets/js/app/finance-api.js',import.meta.url),'utf8');
const layout=fs.readFileSync(new URL('../assets/css/layout.css',import.meta.url),'utf8');
assert.match(main,/if\(id==='category-rename-inline'\)/);
assert.match(main,/await financeApi\.updateCategory\(id,\{name:nextName\}\)/);
assert.match(main,/if\(action==='category-add-child'\)/);
assert.match(main,/if\(action==='category-restore'\)/);
assert.match(main,/is_archived:true/);
assert.match(api,/listCategoriesIncludingArchived/);
assert.match(main,/await financeApi\.listCategoriesIncludingArchived\(householdId\)/);
assert.match(layout,/body\.onboarding-mode \.sidebar/);
assert.match(main,/if\(action==='fixed-cost-open'\)/);
assert.match(main,/categoryView: route==='categories'/);
console.log('Complete category/navigation/setup/fixed-cost workflow checks OK');
