export const CH = Object.freeze({
  code: 'CH',
  label: 'Schweiz',
  currency: 'CHF',
  locale: 'de-CH',
  legalCaseTypes: [
    ['reminder','Mahnung'],
    ['collection','Inkasso'],
    ['debt_enforcement','Betreibung'],
    ['enforcement','Fortsetzung / Pfändung'],
    ['other','Sonstiges'],
  ],
  legalStatuses: ['offen','Mahnung','Zahlungsbefehl','Rechtsvorschlag','Fortsetzung','Pfändung','Verlustschein','abgeschlossen'],
  starterCategories: [['Lohn','income'],['Sonstige Einnahmen','income'],['Wohnen','expense'],['Lebensmittel','expense'],['Krankenkasse','expense'],['Versicherungen','expense'],['Mobilität','expense'],['Steuern','expense'],['Freizeit','expense'],['Abos & Verträge','expense'],['Gesundheit','expense'],['Shopping','expense'],['Sparen','expense'],['Sonstiges','expense']],
  pensionTypes: ['AHV','Pensionskasse','Säule 3a','Säule 3b','Andere'],
});
