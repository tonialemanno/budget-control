import assert from 'node:assert/strict';
import { detectColumns, chooseAmount, buildBankRowsFromLines } from '../assets/js/app/pdf-import.js';

const header={
  y:700,
  items:[
    {str:'Buchungsdatum',x:56},
    {str:'Beschreibung',x:127},
    {str:'Belastung',x:292},
    {str:'Gutschrift',x:355},
    {str:'Valuta',x:434},
    {str:'Saldo',x:518},
  ],
};

const noisyDescriptions=[];
for(let i=0;i<20;i+=1){
  noisyDescriptions.push({y:650-i*10,items:[
    {str:i%2===0?'Belastung UBS TWINT':'Gutschrift UBS TWINT',x:127},
    {str:'10.00',x:497},
  ]});
}

const columns=detectColumns([header,...noisyDescriptions]);
assert.equal(columns.debit,292);
assert.equal(columns.credit,355);
assert.equal(columns.balance,518);

const salaryLine={items:[
  {str:'25.03.2026',x:56},
  {str:'Abacus Umantis AG',x:127},
  {str:"11'565.35",x:356},
  {str:'25.03.2026',x:417},
  {str:"10'538.14",x:497},
]};
const salary=chooseAmount(salaryLine,columns);
assert.ok(salary);
assert.equal(salary.amount,11565.35);

const refundLine={items:[
  {str:'08.05.2026',x:56},
  {str:'Sanitas Grundversicherungen AG',x:127},
  {str:'390.00',x:356},
  {str:'08.05.2026',x:417},
  {str:"1'824.99",x:497},
]};
const refund=chooseAmount(refundLine,columns);
assert.ok(refund);
assert.equal(refund.amount,390);

const signedBalanceCreditLine={items:[
  {str:'16.08.2026',x:56},
  {str:'Antonio Giuseppe Alemanno',x:127},
  {str:"1'000.00",x:356},
  {str:'16.08.2026',x:417},
  {str:'-175.12',x:497},
]};
const signedBalanceCredit=chooseAmount(signedBalanceCreditLine,columns);
assert.ok(signedBalanceCredit);
assert.equal(signedBalanceCredit.amount,1000,'signed balance must never replace the unsigned credit amount');

const rentLine={items:[
  {str:'24.04.2026',x:56},
  {str:'Uzon Immobilien AG',x:127},
  {str:"-1'514.00",x:293},
  {str:'24.04.2026',x:417},
  {str:"1'970.90",x:497},
]};
const rent=chooseAmount(rentLine,columns);
assert.ok(rent);
assert.equal(rent.amount,-1514);

const transferLine={page:1,items:[
  {str:'20.05.2026',x:56},
  {str:'Antonio Giuseppe Alemanno',x:127},
  {str:'180.00',x:356},
  {str:'20.05.2026',x:417},
  {str:"2'004.99",x:497},
]};
const ibanDetail={page:1,items:[{str:'IBAN CH93 0076 2011 6238 5295 7',x:127}]};
const refDetail={page:1,items:[{str:'Referenz: Sparrate Mai',x:127}]};
const nextLine={page:1,items:[
  {str:'21.05.2026',x:56},
  {str:'PostAuto AG',x:127},
  {str:'-5.00',x:293},
  {str:'21.05.2026',x:417},
  {str:"1'999.99",x:497},
]};
const enriched=buildBankRowsFromLines([header,transferLine,ibanDetail,refDetail,nextLine],columns);
assert.equal(enriched.rows[0].Gegenkonto,'CH9300762011623852957');
assert.equal(enriched.rows[0].Referenz,'Sparrate Mai');
assert.equal(enriched.rows[0]['PDF-Seite'],'1');
assert.match(enriched.rows[0].Original,/IBAN CH93/);
assert.match(enriched.rows[0].Original,/Referenz: Sparrate Mai/);

console.log('pdf-import-tests: ok');
