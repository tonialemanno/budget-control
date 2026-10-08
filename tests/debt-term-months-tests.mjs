import assert from 'node:assert/strict';
import fs from 'node:fs';
import { calculateGoalTargetDate } from '../assets/js/app/goal-planning.js';

assert.equal(calculateGoalTargetDate('2027-01-01',12),'2027-12-31');
assert.equal(calculateGoalTargetDate('2027-01-01',24),'2028-12-31');
assert.equal(calculateGoalTargetDate('2027-01-01',36),'2029-12-31');

const debtView=fs.readFileSync(new URL('../assets/js/views/debts.js',import.meta.url),'utf8');
const main=fs.readFileSync(new URL('../assets/js/main.js',import.meta.url),'utf8');
assert.match(debtView,/name="termMonths"/);
assert.match(debtView,/Laufzeit in Monaten/);
assert.match(main,/term_months:termMonths/);
assert.match(main,/debtCreateTerm/);
assert.match(main,/debtEditTerm/);
assert.match(main,/calculateGoalTargetDate\(start\.value,term\.value\)/);

console.log('debt term month assertions OK');
