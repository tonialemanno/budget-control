export const DE = Object.freeze({
  code: 'DE',
  label: 'Deutschland',
  currency: 'EUR',
  locale: 'de-DE',
  legalCaseTypes: [
    ['reminder','Mahnung'],
    ['collection','Inkasso'],
    ['court_dunning','Mahnbescheid'],
    ['enforcement','Zwangsvollstreckung'],
    ['other','Sonstiges'],
  ],
  legalStatuses: ['offen','Mahnung','Inkasso','Mahnbescheid','Widerspruch','Vollstreckungsbescheid','Zwangsvollstreckung','abgeschlossen'],
  starterCategories: [['Gehalt','income'],['Sonstige Einnahmen','income'],['Wohnen','expense'],['Lebensmittel','expense'],['Krankenversicherung','expense'],['Versicherungen','expense'],['Mobilität','expense'],['Steuern','expense'],['Freizeit','expense'],['Abos & Verträge','expense'],['Gesundheit','expense'],['Shopping','expense'],['Sparen','expense'],['Sonstiges','expense']],
  pensionTypes: ['Gesetzliche Rente','Betriebliche Altersvorsorge','Riester','Rürup','Private Vorsorge','Andere'],
});
