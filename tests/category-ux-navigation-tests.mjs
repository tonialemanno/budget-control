import assert from 'node:assert/strict';
import fs from 'node:fs';
import { renderCategories } from '../assets/js/views/categories.js';
import { renderMerchants } from '../assets/js/views/merchants.js';

const categories=[
 {id:'legal',name:'Rechts- & Gerichtskosten',kind:'expense',parent_id:null},
 {id:'court',name:'Gerichtskosten',kind:'expense',parent_id:'legal'},
 {id:'lawyer',name:'Anwaltskosten',kind:'expense',parent_id:'legal'},
 {id:'income',name:'Kindergeld',kind:'income',parent_id:null},
];
const html=renderCategories({categories,canWrite:true,household:{country_code:'DE'}});
assert.equal((html.match(/<strong>Gerichtskosten<\/strong>/g)||[]).length,1,
 'each subcategory is rendered once only, no repeated bottom technical table');
assert.equal((html.match(/<strong>Anwaltskosten<\/strong>/g)||[]).length,1);
assert.match(html,/data-action="category-edit" data-id="court"/);
assert.match(html,/data-action="category-edit" data-id="legal"/);
assert.match(html,/id="categoryEditId"/);
assert.match(html,/id="categoryEditName"/);
assert.match(html,/data-action="category-archive" data-id="legal"/);
assert.match(html,/Unterkategorien anzeigen \(2\)/);
assert.match(html,/Kategorie-Einstellungen/);
assert.match(html,/Aktive Kategorien/);
assert.match(html,/Ausgeblendete Kategorien/);
assert.equal((html.match(/data-action="category-add-child"/g)||[]).length,2);
assert.match(html,/data-action="category-add-child" data-id="legal"/);
assert.doesNotMatch(html,/data-action="category-add-child" data-id="court"/);
const withHidden=renderCategories({categories,archivedCategories:[{id:'hidden',name:'Versteckte Kosten',is_archived:true,kind:'expense'}],canWrite:true});
assert.match(withHidden,/data-action="category-restore" data-id="hidden"/);
assert.match(html,/Automatische Textregeln/);
assert.doesNotMatch(html,/Alle Kategorien/);
const readonly=renderCategories({categories,canWrite:false});
assert.doesNotMatch(readonly,/data-action="category-edit"/);
assert.doesNotMatch(readonly,/data-action="category-archive"/);
const merchants=renderMerchants({merchants:[{id:'m1',name:'EDEKA',normalized_key:'edeka'}],canWrite:true});
const listPos=merchants.indexOf('Meine Händler');
const merchantSource=fs.readFileSync(new URL('../assets/js/views/merchants.js',import.meta.url),'utf8');
assert.ok(listPos>0,'merchant inventory appears first');
assert.match(merchantSource,/Mögliche doppelte Händler prüfen/,'duplicate review is optionally shown when groups exist');
assert.ok(merchantSource.lastIndexOf('${duplicateHtml?')>merchantSource.indexOf('Meine Händler'),'optional duplicate review is placed after inventory');
assert.match(merchants,/Expertenbereich: mehrere Händler zusammenführen/);

const main=fs.readFileSync(new URL('../assets/js/main.js',import.meta.url),'utf8');
const api=fs.readFileSync(new URL('../assets/js/app/finance-api.js',import.meta.url),'utf8');
const layout=fs.readFileSync(new URL('../assets/css/layout.css',import.meta.url),'utf8');
const mobile=fs.readFileSync(new URL('../assets/css/responsive.css',import.meta.url),'utf8');
assert.match(main,/if\(id==='category-edit'\)/);
assert.match(main,/await financeApi\.updateCategory\(category\.id,\{name\}\)/);
assert.match(main,/if\(action==='category-archive'\)/);
assert.match(main,/if\(action==='category-add-child'\)/);
assert.match(main,/parent\.value=category\.id/);
assert.match(main,/kind\.value=category\.kind/);
assert.match(main,/if\(action==='category-restore'\)/);
assert.match(main,/runtime\.archivedCategories=/);
assert.match(main,/parent\?\.kind\|\|formValue\(data,'kind'\)/);
assert.match(main,/is_archived:true/);
assert.match(main,/if\(target\.id==='categorySearch'\)/);
assert.match(api,/listCategoriesIncludingArchived/);
assert.match(main,/await financeApi\.listCategoriesIncludingArchived\(householdId\)/);
assert.match(layout,/position: fixed; inset: 0 0 auto var\(--sidebar-width\)/);
assert.match(mobile,/\.topbar \{ left: 0; right: 0; \}/);
console.log('Category editor, single tree, safe hide, non-resurrection and persistent menu tests OK');
