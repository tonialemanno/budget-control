import assert from 'node:assert/strict';
import { base, tests } from './render-rich.mjs';
import { setLocale, t } from '../assets/js/app/i18n.js';
import { renderTaxAdvisor } from '../assets/js/views/tax-advisor.js';

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

const germanUi=/\b(?:Suchen|Zeitraum|Konto|Konten|Beschreibung|Betrag|Einnahme|Einnahmen|Ausgabe|Ausgaben|Umbuchung|Nächster|Plantermin|Unbefristet|Liquidität|Kreditkarten|Fremdwährungen|Währung|Bearbeiten|Löschen|Speichern|Abbrechen|Zurück|Weiter|Kategorie|Kategorien|Händler|Fällig|Schuld|Schulden|Forderung|Forderungen|Versicherung|Versicherungen|Vorsorge|Immobilie|Fahrzeug|Fahrzeuge|Haushalt|Privat|Planung|Zahlung|Zahlungen|Rechnung|Rechnungen|Vertrag|Verträge|Dokument|Dokumente|Steuer|Steuerjahr|Monat|Monate|Jahr|Stand|Offen|Aktuell|Keine|Noch|Bitte|Wöchentlich|Halbjährlich|Jährlich|Quartalsweise|Rhythmus|Restschuld|Bisher|getilgt|Positionen|Überfällig|Personen|erledigte|Restlaufzeit|Fixkosten|Aktive|Dokumentdatum|Bezug|Allgemein|Dokumentenablage|Variables|verbraucht|Ausserhalb|Sondertopf|Zielbetrag|Zieltermin|Mitglied|Mitglieder|Rolle|Anbieter|Policennummer|Kaufpreis|Kaufdatum|Kilometerstand|Kennzeichen|Jahresbeitrag|Einstandswert|Marktdaten|unbekannt|Von|Bis|frei|verplant|reserviert|Mehrere|Wochenrahmen|Hauptkonto|Entwicklung|Geldtöpfe|Rahmen|prüfen|öffnen|Rekord|Überschuss|Startminus|aufgeholt|Wiederkehrend)\b/i;

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
        if (germanUi.test(translated)) misses.push(`${variant[0]}/${name}: ${translated}`);
      }
    }
  }
  assert.deepEqual([...new Set(misses)],[],`Untranslated ${locale} UI:\\n${[...new Set(misses)].join('\\n')}`);
}

const taxRules=[
  {id:'r26',country_code:'CH',canton_code:'SG',tax_year:2026,version:'SG-2026',status:'partial',notes:'Teilweise Regeln'}
];
const taxCases=[{id:'c26',household_id:'h1',tax_year:2026,country_code:'CH',canton_code:'SG',status:'collecting',currency:'CHF',expected_tax_amount:15000,tax_rule_versions:taxRules[0]}];
const structuredTaxData={
  household:{id:'h1',country_code:'CH',tax_region_code:'SG',base_currency:'CHF'},taxYear:2026,canWrite:true,
  taxRuleVersions:taxRules,taxCases,
  taxPeople:[{id:'p1',tax_case_id:'c26',person_no:1,role:'taxpayer',first_name:'Demo',last_name:'Person',birth_date:'1988-05-12',occupation:'Expert',employer_name:'Demo AG'}],
  taxChildren:[{id:'ch1',tax_case_id:'c26',first_name:'Demo-Kind',last_name:'Muster',birth_date:'2015-04-22',education_status:'school',school_or_training:'Schule',childcare_costs:1200,currency:'CHF',assignment_status:'review'}],
  taxEmployments:[{id:'e1',tax_case_id:'c26',tax_person_id:'p1',employer_name:'Demo AG',work_location:'St. Gallen',period_from:'2026-01-01',period_to:'2026-12-31',gross_income:78000,currency:'CHF',work_days:220,homeoffice_days:50,vacation_days:25,sick_days:3,field_service_days:12,commuting_distance_km:8.4,transport_mode:'ÖV'}],
  taxCaseSections:[],taxItems:[],taxObligations:[],taxPayments:[],transactions:[],debtPayments:[],documents:[],accounts:[],pensions:[],debts:[],receivables:[],insurance:[],investments:[],properties:[],vehicles:[],bills:[],fxRates:null,
};
for (const locale of ['it-CH','en-CH']) {
  setLocale(locale);
  const html=renderTaxAdvisor({...structuredTaxData,profile:{locale}});
  const misses=[];
  for(const value of visibleStrings(html)){
    const translated=t(value,locale);
    if(germanUi.test(translated)) misses.push(translated);
  }
  assert.deepEqual([...new Set(misses)],[],`Untranslated structured Tax Center ${locale} UI:\n${[...new Set(misses)].join('\n')}`);
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
assert.equal(t('Mehrere Währungen aktiv.'),'Più valute attive.');
assert.equal(t('Budget prüfen'),'Controlla budget');
assert.equal(t('Frei pro Tag'),'Disponibile al giorno');
assert.equal(t('17 Tage'),'17 giorni');
assert.equal(t('No-Spend-Tage'),'Giorni senza spese');

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
assert.equal(t('Mehrere Währungen aktiv.'),'Multiple currencies active.');
assert.equal(t('Budget prüfen'),'Review budget');
assert.equal(t('Frei pro Tag'),'Available per day');
assert.equal(t('17 Tage'),'17 days');
assert.equal(t('No-Spend-Tage'),'No-spend days');

const fs=await import('node:fs');
const documentsSource=fs.readFileSync(new URL('../assets/js/views/documents.js',import.meta.url),'utf8');
const insuranceSource=fs.readFileSync(new URL('../assets/js/views/insurance.js',import.meta.url),'utf8');
const importsSource=fs.readFileSync(new URL('../assets/js/views/imports.js',import.meta.url),'utf8');
assert.match(documentsSource,/filePicker\(/);
assert.match(insuranceSource,/filePicker\(/);
assert.match(importsSource,/filePicker\(/);

console.log('i18n render coverage tests passed');
