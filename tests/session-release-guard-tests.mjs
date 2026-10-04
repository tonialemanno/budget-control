import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  DEFAULT_IDLE_MINUTES, MAX_SESSION_HOURS, normalizeIdleMinutes,
  presenceActivityState, sessionStatus,
} from '../assets/js/app/session-guard.js';
import {
  releaseMismatch, releaseReloadUrl, schemaCompatibility,
} from '../assets/js/app/release-guard.js';
import { APP_CONFIG } from '../assets/js/app/config.js';

assert.equal(DEFAULT_IDLE_MINUTES,30);
assert.equal(MAX_SESSION_HOURS,12);
assert.equal(normalizeIdleMinutes(15),15);
assert.equal(normalizeIdleMinutes('30'),30);
assert.equal(normalizeIdleMinutes(999),30);

const start=Date.parse('2026-10-04T10:00:00Z');
assert.equal(sessionStatus({
  now:start+10*60_000,lastInteractionAt:start,sessionStartedAt:start,idleMinutes:30,
}).state,'active');
const warning=sessionStatus({
  now:start+26*60_000,lastInteractionAt:start,sessionStartedAt:start,idleMinutes:30,
});
assert.equal(warning.state,'warning');
assert.equal(warning.reason,'idle');
const idleExpired=sessionStatus({
  now:start+30*60_000,lastInteractionAt:start,sessionStartedAt:start,idleMinutes:30,
});
assert.equal(idleExpired.state,'expired');
assert.equal(idleExpired.reason,'idle');
const maxExpired=sessionStatus({
  now:start+12*60*60_000,lastInteractionAt:start+11*60*60_000+59*60_000,sessionStartedAt:start,idleMinutes:120,
});
assert.equal(maxExpired.state,'expired');
assert.equal(maxExpired.reason,'max_session');

assert.equal(presenceActivityState({now:start+4*60_000,lastInteractionAt:start}),'active');
assert.equal(presenceActivityState({now:start+5*60_000,lastInteractionAt:start}),'idle');

assert.equal(releaseMismatch('a',{releaseId:'a'}),false);
assert.equal(releaseMismatch('a',{releaseId:'b'}),true);
assert.deepEqual(schemaCompatibility(10,{schema_version:10,min_client_schema:10}),{ok:true,reason:null,client:10,server:10,minClient:10});
assert.equal(schemaCompatibility(9,{schema_version:10,min_client_schema:10}).reason,'client_too_old');
assert.equal(schemaCompatibility(11,{schema_version:10,min_client_schema:10}).reason,'server_too_old');

const url=releaseReloadUrl({href:'https://finance.example/app?x=1#/overview'},'release-b');
assert.match(url,/finance_release=release-b/);
assert.match(url,/x=1/);

const manifest=JSON.parse(fs.readFileSync(new URL('../version.json',import.meta.url),'utf8'));
assert.equal(manifest.releaseId,APP_CONFIG.releaseId);
assert.equal(Number(manifest.schemaVersion),APP_CONFIG.schemaVersion);
assert.equal(manifest.version,APP_CONFIG.version);

const headers=fs.readFileSync(new URL('../_headers',import.meta.url),'utf8');
assert.match(headers,/\/version\.json[\s\S]*Cache-Control: no-store/);
assert.match(headers,/\/assets\/\*[\s\S]*Cache-Control: no-cache/);
assert.match(headers,/\/runtime-config\.js[\s\S]*Cache-Control: no-store/);

const migration=fs.readFileSync(new URL('../supabase/migrations/20261004_session_release_guard.sql',import.meta.url),'utf8');
assert.match(migration,/touch_user_presence_v2/);
assert.match(migration,/activity_state/);
assert.match(migration,/last_interaction_at/);
assert.match(migration,/app_runtime_state/);
assert.match(migration,/get_finance_runtime_state/);
assert.match(migration,/set search_path = pg_catalog, public/);

const main=fs.readFileSync(new URL('../assets/js/main.js',import.meta.url),'utf8');
assert.match(main,/sessionTimeoutSelect/);
assert.match(main,/enforceSessionGuard/);
assert.match(main,/ensureCurrentRelease/);
assert.match(main,/ensureRuntimeCompatibility/);
assert.match(main,/BACKGROUND_REFRESH_MS/);
assert.match(main,/clearPresence/);
assert.match(main,/activityState/);
assert.match(main,/releaseId/);

console.log('Session, presence and release guard assertions OK');
