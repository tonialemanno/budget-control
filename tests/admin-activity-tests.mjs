import assert from 'node:assert/strict';
import fs from 'node:fs';
import { renderAdmin } from '../assets/js/views/admin.js';

const html=renderAdmin({
  productModules:[],
  adminExpandedUserId:'u1',
  adminUsers:[{
    id:'u1',
    email:'ana@example.com',
    display_name:'Ana',
    locale:'de-CH',
    confirmed_at:'2026-01-01T10:00:00Z',
    last_sign_in_at:'2026-10-01T18:00:00Z',
    modules:{},
    presence:{
      last_seen_at:'2026-10-02T20:00:00Z',
      route:'transactions',
      device_label:'iPhone',
      app_version:'2.3-beta',
    },
    activity:{
      last_at:'2026-10-02T19:59:00Z',
      last_module:'transactions',
      last_action:'create',
      last_30_days:3,
      modules:[
        {module_key:'transactions',count:2,last_at:'2026-10-02T19:59:00Z'},
        {module_key:'fixed-costs',count:1,last_at:'2026-09-28T10:00:00Z'},
      ],
      recent:[
        {module_key:'transactions',action_kind:'create',occurred_at:'2026-10-02T19:59:00Z'},
        {module_key:'fixed-costs',action_kind:'update',occurred_at:'2026-09-28T10:00:00Z'},
      ],
    },
  }],
});

assert.match(html,/Nutzung & Aktivität/);
assert.match(html,/Keine Beträge, Beschreibungen, Händler oder Inhalte/);
assert.match(html,/Letzte Eintragung/);
assert.match(html,/Transaktionen/);
assert.match(html,/Fixkosten/);
assert.match(html,/Aktivitäten · 30 Tage/);
assert.match(html,/>3</);
assert.match(html,/erstellt/);
assert.match(html,/geändert/);
assert.doesNotMatch(html,/123\.45/);

const migration=fs.readFileSync(new URL('../supabase/migrations/20261002_finance_privacy_preserving_activity_log.sql',import.meta.url),'utf8');
assert.match(migration,/create table if not exists public\.user_activity_events/);
assert.match(migration,/create table if not exists public\.user_activity_summary/);
assert.match(migration,/private\.capture_user_activity/);
assert.match(migration,/revoke all on public\.user_activity_events from public, anon, authenticated/);
assert.doesNotMatch(migration,/description\s+text/i);
assert.doesNotMatch(migration,/amount\s+numeric/i);
assert.doesNotMatch(migration,/object_id\s+/i);

const edge=fs.readFileSync(new URL('../supabase/functions/admin-users/index.ts',import.meta.url),'utf8');
assert.match(edge,/user_activity_summary/);
assert.match(edge,/user_activity_events/);
assert.match(edge,/last_30_days/);
assert.match(edge,/recent:/);

console.log('Privacy-preserving admin activity assertions OK');
