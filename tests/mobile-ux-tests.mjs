import assert from 'node:assert/strict';
import fs from 'node:fs';
import { dataTable } from '../assets/js/app/components.js';
import { NAV_ITEMS } from '../assets/js/app/config.js';

const table = dataTable({
  headers: ['Name', 'Betrag', ''],
  rows: ['<tr><td>Strom</td><td>CHF 100.00</td><td><button>Öffnen</button></td></tr>'],
});
assert.match(table, /<td data-label="Name">Strom<\/td>/);
assert.match(table, /<td data-label="Betrag">CHF 100\.00<\/td>/);
assert.match(table, /<td data-label=""><button>Öffnen<\/button><\/td>/);

const primaryItems = NAV_ITEMS.filter((item) => item.primary);
assert.deepEqual(primaryItems.map((item) => item.mobileLabel || item.label), ['Übersicht', 'Prüfen', 'Geld', 'Planung']);
assert.deepEqual(primaryItems.map((item) => item.section), ['overview', 'review', 'money', 'planning']);

const css = fs.readFileSync(new URL('../assets/css/responsive.css', import.meta.url), 'utf8');
const main = fs.readFileSync(new URL('../assets/js/main.js', import.meta.url), 'utf8');
const index = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
assert.match(css, /@media \(max-width: 660px\)/);
assert.match(css, /env\(safe-area-inset-top\)/);
assert.match(css, /env\(safe-area-inset-bottom\)/);
assert.match(css, /font-size:\s*16px/);
assert.match(css, /\.data-table thead \{ display: none; \}/);
assert.match(css, /\.mobile-tabbar/);
assert.match(css, /\.mobile-quick-add/);
assert.match(main, /mobileQuickAddButton/);
assert.match(main, /routeSection/);
assert.match(index, /quickAddSheet/);

console.log('mobile UX assertions OK');

const componentsCss = fs.readFileSync(new URL('../assets/css/components.css', import.meta.url), 'utf8');
const txView = fs.readFileSync(new URL('../assets/js/views/transactions.js', import.meta.url), 'utf8');
assert.match(componentsCss, /@media \(max-width: 660px\)[\s\S]*\.categorization-select-row\s*\{[\s\S]*grid-template-columns:\s*32px minmax\(0,1fr\)/);
assert.match(componentsCss, /\.categorization-select-context\s*\{[\s\S]*font-size:\s*12px/);
assert.match(componentsCss, /\.categorization-select-amount\s*\{[\s\S]*font-size:\s*14px/);
assert.match(txView, /categorization-select-heading/);
assert.match(txView, /redundantMerchant/);
