import assert from 'node:assert/strict';
import fs from 'node:fs';

const i18n = await import('../assets/js/app/i18n.js');

assert.equal(i18n.normaliseLocale('it-IT'), 'it-IT');
assert.equal(i18n.normaliseLocale('en-CH'), 'en-CH');
assert.equal(i18n.normaliseLocale('fr-CH'), 'de-CH');

i18n.setLocale('it-CH');
assert.equal(i18n.getLanguage(), 'it');
assert.equal(i18n.t('Übersicht'), 'Panoramica');
assert.equal(i18n.t('Konten'), 'Conti');
assert.equal(i18n.t('3 Buchungen'), '3 movimenti');

i18n.setLocale('en-CH');
assert.equal(i18n.getLanguage(), 'en');
assert.equal(i18n.t('Übersicht'), 'Overview');
assert.equal(i18n.t('Forderungen'), 'Receivables');
assert.equal(i18n.t('4 sichtbar'), '4 visible');

i18n.setLocale('de-CH');
assert.equal(i18n.t('Übersicht'), 'Übersicht');

const settings=fs.readFileSync(new URL('../assets/js/views/settings.js', import.meta.url),'utf8');
assert.match(settings,/value="en-CH"/);
assert.match(settings,/value="en-GB"/);
assert.match(settings,/Sprache & Region/);
assert.doesNotMatch(settings,/Oberfläche ist in dieser Stable-Version Deutsch/);

const admin=fs.readFileSync(new URL('../assets/js/views/admin.js', import.meta.url),'utf8');
assert.match(admin,/value="en-CH"/);
assert.match(admin,/value="en-GB"/);

const main=fs.readFileSync(new URL('../assets/js/main.js', import.meta.url),'utf8');
assert.match(main,/setLocale\(profile\?\.locale \|\| APP_CONFIG\.defaultLocale\)/);
assert.match(main,/translateElement\(pageContent\)/);
assert.match(main,/showToast\('Sprache & Region gespeichert\.'\)/);

console.log('i18n tests passed');
