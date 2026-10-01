import assert from 'node:assert/strict';
import { base, tests } from './render-rich.mjs';
import { setLocale, t } from '../assets/js/app/i18n.js';

function decode(text='') {
  return String(text)
    .replace(/&nbsp;/g,' ')
    .replace(/&amp;/g,'&')
    .replace(/&quot;/g,'"')
    .replace(/&#039;/g,"'")
    .replace(/&lt;/g,'<')
    .replace(/&gt;/g,'>')
    .replace(/\s+/g,' ')
    .trim();
}

function visibleStrings(html='') {
  const values=[];
  const withoutScripts=String(html).replace(/<script[\s\S]*?<\/script>/gi,'').replace(/<style[\s\S]*?<\/style>/gi,'');
  for (const match of withoutScripts.matchAll(/>([^<>]+)</g)) {
    const value=decode(match[1]);
    if(value) values.push(value);
  }
  for (const match of withoutScripts.matchAll(/\b(?:placeholder|title|aria-label|data-label)="([^"]+)"/g)) {
    const value=decode(match[1]);
    if(value) values.push(value);
  }
  return values;
}

const germanUi=/\b(?:Suchen|Zeitraum|Konto|Konten|Beschreibung|Betrag|Einnahme|Ausgabe|Umbuchung|Nächster|Plantermin|Unbefristet|Liquidität|Kreditkarten|Fremdwährungen|Währung|Bearbeiten|Löschen|Speichern|Abbrechen|Zurück|Weiter|Kategorie|Händler|Fällig|Schuld|Forderung|Versicherung|Vorsorge|Immobilie|Fahrzeug|Haushalt|Privat|Planung|Zahlung|Rechnung|Vertrag|Dokument|Steuer|Monat|Jahr|Stand|Offen|Aktuell|Keine|Noch|Bitte|Wöchentlich|Halbjährlich|Jährlich|Quartalsweise|Rhythmus|Von|Bis)\b/i;

const fixtureData = new Set([
  'Privat','Lohnkonto','Sparkonto','Euro Kasse','Lebensmittel','Abacus Umantis AG;9000 St. Gallen',
]);

for (const locale of ['it-CH','en-CH']) {
  setLocale(locale);
  const localizedBase={...base,profile:{...base.profile,locale}};
  const misses=[];
  for (const [name,render] of Object.entries(tests)) {
    const html=render(localizedBase);
    for (const value of visibleStrings(html)) {
      if(!germanUi.test(value) || fixtureData.has(value)) continue;
      if(t(value,locale)===value) misses.push(`${name}: ${value}`);
    }
  }
  assert.deepEqual(misses,[],`Untranslated ${locale} UI:\n${misses.join('\n')}`);
}

setLocale('it-CH');
assert.equal(t('Suchen'),'Cerca');
assert.equal(t('Zeitraum'),'Periodo');
assert.equal(t('Beschreibung'),'Descrizione');
assert.equal(t('Einnahme'),'Entrata');
assert.equal(t('Unbefristet'),'Senza scadenza');
assert.equal(t('Liquidität CHF'),'Liquidità CHF');
assert.equal(t('Kreditkarten CHF'),'Carte di credito CHF');
assert.equal(t('Fremdwährungen'),'Valute estere');
assert.equal(t('8 Konten gesamt · SNB Monatsmittel · Stand 2026-09'),'8 conti totali · Media mensile BNS · aggiornamento 2026-09');
assert.equal(t('SNB Monatsmittel · Stand 2026-09. Originalwährungen bleiben auf den Konten sichtbar.'),'Media mensile BNS · aggiornamento 2026-09. Le valute originali restano visibili sui conti.');
assert.equal(t('z. B. Migros, MediaMarkt, TWINT'),'es. Migros, MediaMarkt, TWINT');

setLocale('en-CH');
assert.equal(t('Suchen'),'Search');
assert.equal(t('Beschreibung'),'Description');
assert.equal(t('Unbefristet'),'No end date');
assert.equal(t('Liquidität CHF'),'Liquidity CHF');
assert.equal(t('Kreditkarten CHF'),'Credit cards CHF');

console.log('i18n render coverage tests passed');
