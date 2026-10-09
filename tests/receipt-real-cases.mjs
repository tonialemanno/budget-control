import assert from 'node:assert/strict';
import { parseReceiptText } from '../assets/js/app/receipt-ocr.js';

const cases=[
  {text:'LIDL ARBON\n02.06.2026 18:41\nDein Lidl Preis 92.30\nTotal-EFT CHF: 92.30',merchant:'Lidl',amount:92.30,currency:'CHF',date:'2026-06-02',category:'Lebensmittel'},
  {text:'Coop\nSt. Gallen Bahnhof\n06.09.2026 12:14\nSumme CHF 7.80\nVisaDebit 7.80',merchant:'Coop',amount:7.80,currency:'CHF',date:'2026-09-06',category:'Lebensmittel'},
  {text:'GENOSSENSCHAFT MIGROS OSTSCHWEIZ\nM Neudorf\n25.08.2026 10:31\nTotal CHF 10.15\nTWINT QR 10.15',merchant:'Migros',amount:10.15,currency:'CHF',date:'2026-08-25',category:'Lebensmittel'},
  {text:'GENOSSENSCHAFT MIGROS OSTSCHWEIZ\nMR Neumarkt\nBuffet warm\nBUCHUNG\n30.09.2026 12:20\nTotal CHF 26.00\nPunktestand per 23.09.2026 26.03\nTWINT QR 26.00',merchant:'Migros Restaurant',amount:26.00,currency:'CHF',date:'2026-09-30',category:'Restaurant'},
  {text:'EDEKA MÜLLER\nFRIEDRICHSTRASSE 12, DEUTSCHLAND\n09.10.2026 12:45\nZU ZAHLEN 18,90\nEC-KARTE 18,90',merchant:'EDEKA',amount:18.90,currency:'EUR',date:'2026-10-09',category:'Lebensmittel'},
  {text:'REWE CENTER\n09.10.2026 11:00\nSumme EUR 24,35\nVisa Debit',merchant:'REWE',amount:24.35,currency:'EUR',date:'2026-10-09',category:'Lebensmittel'},
  {text:'ROSSMANN\n09.10.2026 10:15\nGesamt 9,49\nEC-KARTE',merchant:'Rossmann',amount:9.49,currency:'EUR',date:'2026-10-09',category:'Shopping'},
];
for(const c of cases){
  const r=parseReceiptText(c.text,{fallbackCurrency:'CHF'});
  assert.equal(r.merchant,c.merchant);
  assert.equal(r.amount,c.amount);
  assert.equal(r.currency,c.currency);
  assert.equal(r.date,c.date);
  assert.equal(r.suggestedCategoryName,c.category);
}
console.log('receipt parser real cases: OK');
