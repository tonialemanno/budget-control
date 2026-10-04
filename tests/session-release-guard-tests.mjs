import assert from 'node:assert/strict';
import fs from 'node:fs';
import { APP_CONFIG } from '../assets/js/app/config.js';
import { classifyPresence, createSessionGuard } from '../assets/js/app/session-guard.js';

const active=classifyPresence('2026-10-04T10:00:00Z',{now:new Date('2026-10-04T10:01:00Z').getTime()});
assert.equal(active.state,'active');

const idle=classifyPresence('2026-10-04T10:00:00Z',{now:new Date('2026-10-04T10:10:00Z').getTime()});
assert.equal(idle.state,'idle');

const offline=classifyPresence('2026-10-04T10:00:00Z',{now:new Date('2026-10-04T10:31:00Z').getTime()});
assert.equal(offline.state,'offline');

const map=new Map();
const storage={
  getItem:(key)=>map.has(key)?map.get(key):null,
  setItem:(key,value)=>map.set(key,String(value)),
  removeItem:(key)=>map.delete(key),
};
let now=1_000_000;
let warning=0;
let timeout=null;
const guard=createSessionGuard({
  userId:'user-1',
  idleTimeoutMs:30*60_000,
  warningLeadMs:5*60_000,
  maxSessionMs:12*60*60_000,
  now:()=>now,
  storage,
  onWarning:(remaining)=>{warning=remaining;},
  onWarningClear:()=>{warning=0;},
  onTimeout:(event)=>{timeout=event;},
});
guard.activity();
now+=26*60_000;
guard.check();
assert.ok(warning>0,'warning must appear during final five minutes');
now+=5*60_000;
guard.check();
assert.equal(timeout?.reason,'idle');
guard.stop({clear:true});

const release=JSON.parse(fs.readFileSync(new URL('../release.json',import.meta.url),'utf8'));
assert.equal(release.buildId,APP_CONFIG.buildId);
assert.equal(release.schemaVersion,APP_CONFIG.schemaVersion);
assert.equal(APP_CONFIG.idleTimeoutMinutes,30);
assert.equal(APP_CONFIG.idleWarningMinutes,5);
assert.equal(APP_CONFIG.maxSessionHours,12);

const index=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
assert.match(index,/release-boot\.js\?boot=20261004-1/);
assert.doesNotMatch(index,/type="module" src="\.\/assets\/js\/main\.js"/);

const boot=fs.readFileSync(new URL('../release-boot.js',import.meta.url),'utf8');
assert.match(boot,/cache:'no-store'/);
assert.match(boot,/serviceWorker\.register/);
assert.match(boot,/loadModule\('\.\/assets\/js\/main\.js'/);

const sw=fs.readFileSync(new URL('../sw.js',import.meta.url),'utf8');
assert.match(sw,/cache:'no-store'/);
assert.match(sw,/self\.clients\.claim/);
assert.doesNotMatch(sw,/registration\.unregister/);

const migration=fs.readFileSync(new URL('../supabase/migrations/20261004_release_guard_state.sql',import.meta.url),'utf8');
assert.match(migration,/app_release_state/);
assert.match(migration,/schema_version/);

const main=fs.readFileSync(new URL('../assets/js/main.js',import.meta.url),'utf8');
assert.match(main,/createSessionGuard/);
assert.match(main,/idleTimeoutMinutes/);
assert.match(main,/checkReleaseCompatibility/);
assert.match(main,/clearPresence/);
assert.match(main,/checkReleaseAndRefreshAfterResume/);

const admin=fs.readFileSync(new URL('../assets/js/views/admin.js',import.meta.url),'utf8');
assert.match(admin,/Inaktiv/);
assert.match(admin,/classifyPresence/);

console.log('session security and release guard assertions OK');
