import assert from 'node:assert/strict';
import { renderAdmin } from '../assets/js/views/admin.js';
import { renderProfile } from '../assets/js/views/profile.js';

const uuid='77ff3322-aaaa-4444-bbbb-889900110022';
const user={id:uuid,display_name:'Testkonto',email:'test@example.com',confirmed_at:'2026-01-01'};
const admin=renderAdmin({adminUsers:[user],adminQuery:uuid});
assert.match(admin,/Benutzer-ID:/);
assert.ok(admin.includes(uuid));
assert.match(admin,/1 Treffer/);
assert.match(renderAdmin({adminUsers:[user],adminQuery:'Testkonto'}),/1 Treffer/);
assert.match(renderAdmin({adminUsers:[user],adminQuery:'999999'}),/0 Treffer/);
const profile=renderProfile({user,profile:{display_name:'Testkonto',locale:'de-CH'},accounts:[],transactions:[]});
assert.ok(profile.includes(uuid));
console.log('stable user UUID displayed in admin and own profile: ok');
