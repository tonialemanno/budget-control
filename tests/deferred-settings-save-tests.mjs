import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=(path)=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const main=read('assets/js/main.js');
const settings=read('assets/js/views/settings.js');
const profile=read('assets/js/views/profile.js');
const admin=read('assets/js/views/admin.js');
const helper=read('assets/js/app/deferred-settings.js');

assert.match(settings,/id="personal-settings" data-form="personal-settings" data-deferred-settings/);
assert.match(settings,/data-deferred-save disabled>Änderungen speichern</);
assert.match(settings,/name="visibleModules"/);
assert.doesNotMatch(settings,/data-action="user-toggle-module-visibility"/);

assert.match(profile,/id="profile-settings" data-form="profile-settings" data-deferred-settings/);
assert.match(profile,/data-deferred-save disabled>Speichern</);

assert.match(admin,/data-form="admin-user-access"/);
assert.match(admin,/data-deferred-settings/);
assert.match(admin,/data-deferred-save disabled>Zugriff speichern</);
assert.doesNotMatch(admin,/data-action="admin-toggle-module"/);
assert.doesNotMatch(admin,/data-action="admin-set-locale"/);

assert.match(helper,/markDeferredSettingsDirty/);
assert.match(helper,/hasDeferredSettingsChanges/);
assert.match(main,/if \(id === 'personal-settings'\)/);
assert.match(main,/if \(id === 'admin-user-access'\)/);
assert.match(main,/markDeferredSettingsDirty\(target\)/);
assert.match(main,/hasDeferredSettingsChanges\(pageContent\)/);

const changeStart=main.indexOf("pageContent.addEventListener('change'");
const changeEnd=main.indexOf("pageContent.addEventListener('input'",changeStart);
const changeBlock=main.slice(changeStart,changeEnd);
assert.ok(changeStart>=0&&changeEnd>changeStart,'change handler must exist');
assert.doesNotMatch(changeBlock,/saveCurrentUserLocale\(/);
assert.doesNotMatch(changeBlock,/saveUserPreferences\(/);
assert.doesNotMatch(changeBlock,/adminSetLocale\(/);
assert.doesNotMatch(changeBlock,/adminSetModule\(/);
assert.doesNotMatch(changeBlock,/store\.setState\(\{theme/);
assert.doesNotMatch(changeBlock,/store\.setState\(\{depth/);

console.log('deferred settings save assertions OK');
