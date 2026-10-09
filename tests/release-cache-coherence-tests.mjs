import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=(path)=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const index=read('index.html');
const main=read('assets/js/main.js');
const config=read('assets/js/app/config.js');
const version=JSON.parse(read('version.json'));
const headers=read('_headers');

const configRelease=config.match(/releaseId:\s*'([^']+)'/)?.[1]||'';
assert.equal(configRelease,version.releaseId,'client config and version manifest must use the same release id');
assert.match(index,/assets\/js\/main\.js\?v=20261009-r63/,'index must load the hotfixed bootstrap URL');
assert.match(main,/app\/config\.js\?v=20261009-r63/,'main must load config with the current hotfix cache key');
assert.match(headers,/\/assets\/js\/main\.js[\s\S]*?Cache-Control: no-store/);
assert.match(headers,/\/assets\/js\/app\/config\.js[\s\S]*?Cache-Control: no-store/);

console.log('release cache coherence assertions OK');
