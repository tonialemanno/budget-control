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

const mobileItems = NAV_ITEMS.filter((item) => item.mobile).slice(0, 5);
assert.equal(mobileItems.length, 5);
assert.deepEqual(mobileItems.map((item) => item.mobileLabel || item.label), ['Übersicht', 'Konten', 'Buchungen', 'Budget', 'Rechnungen']);

const css = fs.readFileSync(new URL('../assets/css/responsive.css', import.meta.url), 'utf8');
assert.match(css, /@media \(max-width: 660px\)/);
assert.match(css, /env\(safe-area-inset-top\)/);
assert.match(css, /env\(safe-area-inset-bottom\)/);
assert.match(css, /font-size:\s*16px/);
assert.match(css, /\.data-table thead \{ display: none; \}/);
assert.match(css, /\.mobile-tabbar/);

console.log('mobile UX assertions OK');
