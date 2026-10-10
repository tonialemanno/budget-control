import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=(path)=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const index=read('index.html');
const main=read('assets/js/main.js');
const financeApi=read('assets/js/app/finance-api.js');
const config=read('assets/js/app/config.js');
const version=JSON.parse(read('version.json'));
const headers=read('_headers');

const configRelease=config.match(/releaseId:\s*'([^']+)'/)?.[1]||'';
assert.equal(configRelease,version.releaseId,'client config and version manifest must use the same release id');
const expectedBootstrapRelease=version.releaseId.replaceAll('.','');
assert.ok(index.includes(`assets/js/main.js?v=${expectedBootstrapRelease}`),'index must load the current bootstrap URL');
assert.match(main,/from '\.\/app\/backend\.js';/,'main and finance-api must share exactly one backend module instance');
assert.match(financeApi,/from '\.\/backend\.js';/,'finance-api must use the shared backend module instance');
assert.doesNotMatch(main,/from ['"][^'"]+\.js\?v=/,'main module imports must not fork stateful ES modules through cache query strings');
assert.match(headers,/\/assets\/js\/main\.js[\s\S]*?Cache-Control: no-store/);
assert.match(headers,/\/assets\/js\/app\/config\.js[\s\S]*?Cache-Control: no-store/);

console.log('release cache and auth singleton assertions OK');
