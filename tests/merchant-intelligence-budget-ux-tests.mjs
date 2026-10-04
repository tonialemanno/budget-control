import assert from 'node:assert/strict';
import fs from 'node:fs';
import { merchantFromTransaction } from '../assets/js/app/csv-import.js';

const sbbVariants=[
  'SBB MOBILE; Zahlung UBS TWINT 03.10.2026',
  'SBB CFF FFS; Zahlung UBS TWINT 18.09.2026',
  'SBB PRAIL; Zahlung UBS TWINT 06.06.2026',
  'SBB Bahnhof St. Gallen 02.05.2026',
];
for(const description of sbbVariants){
  const detected=merchantFromTransaction({description,amount:-10});
  assert.equal(detected.name,'SBB');
  assert.equal(detected.key,'sbb');
}

const edekaVariants=[
  'EDEKA Hieber Markt 4711; Zahlung UBS TWINT 04.10.2026',
  'EDEKA CENTER KONSTANZ 03.10.2026',
];
for(const description of edekaVariants){
  const detected=merchantFromTransaction({description,amount:-42});
  assert.equal(detected.name,'EDEKA');
  assert.equal(detected.key,'edeka');
}

const outgoing=merchantFromTransaction({description:'Mario Rossi; Belastung UBS TWINT 25.09.2026',amount:-50});
assert.equal(outgoing.name,'Mario Rossi');
assert.equal(outgoing.key,'mario rossi');
assert.equal(outgoing.paymentProcessor,'TWINT');

const incoming=merchantFromTransaction({description:'Gutschrift UBS TWINT; Mario Rossi 25.09.2026',amount:50});
assert.equal(incoming.name,'Mario Rossi');
assert.equal(incoming.key,'mario rossi');
assert.equal(incoming.paymentProcessor,'TWINT');

const suffix=merchantFromTransaction({description:'ParkingPay-TWINT; Zahlung UBS 01.04.2026',amount:-1.5});
assert.equal(suffix.name,'ParkingPay');
assert.equal(suffix.key,'parkingpay');

const budget=fs.readFileSync(new URL('../assets/js/views/budget.js',import.meta.url),'utf8');
assert.match(budget,/Aktueller Finanzmonat/);
assert.match(budget,/name="month" type="hidden"/);
assert.match(budget,/Weitere gespeicherte Budgetperioden/);
assert.doesNotMatch(budget,/name="month" type="month"/);

const main=fs.readFileSync(new URL('../assets/js/main.js',import.meta.url),'utf8');
assert.match(main,/activeCycle=resolveFinanceCycle/);
assert.match(main,/Budget für den aktuellen Finanzmonat gespeichert/);
assert.match(main,/const month=\`\$\{cycle\.budgetMonth\}-01\`/);

console.log('merchant-intelligence-budget-ux-tests: ok');
