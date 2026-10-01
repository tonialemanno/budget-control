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

const germanUi=/\b(?:Suchen|Zeitraum|Konto|Konten|Beschreibung|Betrag|Einnahme|Einnahmen|Ausgabe|Ausgaben|Umbuchung|Nächster|Plantermin|Unbefristet|Liquidität|Kreditkarten|Fremdwährungen|Währung|Bearbeiten|Löschen|Speichern|Abbrechen|Zurück|Weiter|Kategorie|Kategorien|Händler|Fällig|Schuld|Schulden|Forderung|Forderungen|Versicherung|Versicherungen|Vorsorge|Immobilie|Fahrzeug|Fahrzeuge|Haushalt|Privat|Planung|Zahlung|Zahlungen|Rechnung|Rechnungen|Vertrag|Verträge|Dokument|Dokumente|Steuer|Steuerjahr|Monat|Monate|Jahr|Stand|Offen|Aktuell|Keine|Noch|Bitte|Wöchentlich|Halbjährlich|Jährlich|Quartalsweise|Rhythmus|Restschuld|Bisher|getilgt|Positionen|Überfällig|Personen|erledigte|Restlaufzeit|Fixkosten|Aktive|Dokumentdatum|Bezug|Allgemein|Dokumentenablage|Variables|verbraucht|Ausserhalb|Sondertopf|Zielbetrag|Zieltermin|Mitglied|Mitglieder|Rolle|Anbieter|Policennummer|Kaufpreis|Kaufdatum|Kilometerstand|Kennzeichen|Jahresbeitrag|Einstandswert|Marktdaten|unbekannt|Von|Bis)\b/i;

const fixtureData = new Set([
  'Privat','Lohnkonto','Sparkonto','Euro Kasse','Lebensmittel','Abacus Umantis AG;9000 St. Gallen',
  'Migros Einkauf','Schuldenzahlung: Andy','Privatschuld','Hausrat','Uhr','Strom','Stadtwerk',
]);

const emptyArrays=[
  'accounts','categories','merchants','transactions','debtPayments','budgets','bills','contracts','recurringRules',
  'goals','goalSources','debts','receivables','legalCases','legalEvents','assets','properties','vehicles','insurance',
  'investments','investmentTransactions','pensions','documents','importBatches','categorizationRules','householdMembers',
];

for (const locale of ['it-CH','en-CH']) {
  setLocale(locale);
  const localizedBase={...base,profile:{...base.profile,locale}};
  const emptyBase={...localizedBase};
  for (const key of emptyArrays) emptyBase[key]=[];
  const misses=[];
  for (const variant of [
    ['rich',localizedBase],
    ['empty',emptyBase],
  ]) {
    for (const [name,render] of Object.entries(tests)) {
      let html;
      try { html=render(variant[1]); }
      catch { continue; }
      for (const value of visibleStrings(html)) {
        if (fixtureData.has(value)) continue;
        const translated=t(value,locale);
        if (germanUi.test(translated)) misses.push(\`\${variant[0]}/\${name}: \${translated}\`);
      }
    }
  }
  assert.deepEqual([...new Set(misses)],[],\`Untranslated \${locale} UI:\\n\${[...new Set(misses)].join('\\n')}\`);
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

assert.equal(t('Restschuld gesamt'),'Debito residuo totale');
assert.equal(t('Bisher getilgt'),'Rimborsato finora');
assert.equal(t('Überfällig'),'Scaduti');
assert.equal(t('Positionen'),'Posizioni');
assert.equal(t('Nicht auf Kurs'),'Fuori rotta');
assert.equal(t('Restlaufzeit bei Plan'),'Tempo residuo con il piano');
assert.equal(t('Fixkosten hinzufügen'),'Aggiungi costo fisso');
assert.equal(t('Dokumentenablage'),'Archivio documenti');
assert.equal(t('Variable Budget'),'Budget variabile');
assert.equal(t('Keine Datei ausgewählt'),'Nessun file selezionato');
setLocale('en-CH');
assert.equal(t('Suchen'),'Search');
assert.equal(t('Beschreibung'),'Description');
assert.equal(t('Unbefristet'),'No end date');
assert.equal(t('Liquidität CHF'),'Liquidity CHF');
assert.equal(t('Kreditkarten CHF'),'Credit cards CHF');

const fs=await import('node:fs');
const documentsSource=fs.readFileSync(new URL('../assets/js/views/documents.js',import.meta.url),'utf8');
const insuranceSource=fs.readFileSync(new URL('../assets/js/views/insurance.js',import.meta.url),'utf8');
const importsSource=fs.readFileSync(new URL('../assets/js/views/imports.js',import.meta.url),'utf8');
assert.match(documentsSource,/filePicker\(/);
assert.match(insuranceSource,/filePicker\(/);
assert.match(importsSource,/filePicker\(/);

console.log('i18n render coverage tests passed');
