import assert from 'node:assert/strict';
import fs from 'node:fs';
import { routeDefinition, routeFromPath } from '../assets/js/app/router.js';
import { icon } from '../assets/js/app/icons.js';
import { renderOverview } from '../assets/js/views/overview.js';
import { renderImports } from '../assets/js/views/imports.js';
import { base } from './render-rich.mjs';

const read=(path)=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
const index=read('index.html');
assert.match(index, /<a class="topbar-import-shortcut" href="\/finance\/imports" aria-label="CSV hochladen"/);
assert.match(index, /data-icon="upload"/);
assert.match(index, /topbar-import-label">CSV hochladen<\/span>/);

assert.equal(routeDefinition('imports')?.path,'/finance/imports');
assert.equal(routeFromPath('/finance/imports')?.route,'imports');

const overview=renderOverview(base);
assert.match(overview, /href="\/finance\/imports">[\s\S]*?CSV hochladen<\/a>/);
assert.match(overview, /<svg[^>]*>/);

const uploadIcon=icon('upload');
assert.match(uploadIcon, /<svg/);
assert.match(uploadIcon, /M12 16V3/);

const uploader=renderImports(base);
assert.match(uploader, /data-form="bank-import"/);
assert.match(uploader, /name="files"/);
assert.match(uploader, /\.csv,text\/csv,application\/pdf,\.pdf/);
assert.match(uploader, /Dateien auswählen/);

const responsive=read('assets/css/responsive.css');
assert.match(responsive, /\.topbar-import-label \{ display: none; \}/);
assert.match(read('assets/css/components.css'), /body\.onboarding-mode \.topbar-import-shortcut \{ display: none; \}/);
console.log('CSV upload shortcuts: overview, global topbar, mobile and form route OK');
