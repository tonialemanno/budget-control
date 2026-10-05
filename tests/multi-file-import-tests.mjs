import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=(path)=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');

const components=read('assets/js/app/components.js');
const imports=read('assets/js/views/imports.js');
const main=read('assets/js/main.js');

assert.match(components,/multiple = false/);
assert.match(components,/multiple \? 'multiple'/);
assert.match(imports,/multiple:true/);
assert.match(imports,/alle 5 ZAK-Auszüge gleichzeitig/);
assert.match(main,/const importState = \{ items: \[\] \}/);
assert.match(main,/for\(const file of files\)/);
assert.match(main,/for \(const item of importState\.items\)/);
assert.match(main,/file_name:item\.file\.name/);
assert.match(main,/importMappingForParsed/);
assert.match(main,/Dateien ausgewählt/);
assert.doesNotMatch(main,/importState\.(?:file|parsed)/);

console.log('multi-file-import-tests: ok');
