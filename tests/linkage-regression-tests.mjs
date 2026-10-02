import assert from 'node:assert/strict';
import fs from 'node:fs';
import { financeEventTimestamp } from '../assets/js/app/format.js';
import { renderGoals } from '../assets/js/views/goals.js';

const fixedNow=new Date('2026-10-02T11:30:00.000Z');
assert.equal(financeEventTimestamp('2026-10-02',fixedNow),fixedNow.toISOString(),'today must be booked immediately');
assert.equal(financeEventTimestamp('',fixedNow),fixedNow.toISOString(),'empty date falls back to now');
assert.equal(financeEventTimestamp('2026-10-03',fixedNow).slice(0,10),'2026-10-03','future day must remain future');
assert.equal(financeEventTimestamp('2026-10-01',fixedNow).slice(0,10),'2026-10-01','past day must remain historical');
assert.equal(financeEventTimestamp('2026-10-02T11:29',fixedNow),fixedNow.toISOString(),'current-minute datetime must use the actual instant');
assert.equal(financeEventTimestamp('2026-10-02T08:15',fixedNow),new Date('2026-10-02T08:15').toISOString(),'explicit same-day time must be preserved');
assert.equal(financeEventTimestamp('2026-10-03T09:45',fixedNow),new Date('2026-10-03T09:45').toISOString(),'future datetime must preserve its time');

const household={base_currency:'CHF'};
const profile={locale:'de-CH'};
const accounts=[
  {account_id:'a1',name:'Lohnkonto',currency:'CHF',current_balance:1000,account_type:'checking'},
  {account_id:'a2',name:'Notgroschen',currency:'CHF',current_balance:5000,account_type:'savings'},
  {account_id:'a3',name:'Ferien',currency:'CHF',current_balance:700,account_type:'savings'},
];
const recurringRules=[
  {id:'expense',active:true,direction:'expense',description:'Miete',amount:1800,currency:'CHF',cadence:'monthly',account_id:'a1'},
  {id:'incoming',active:true,direction:'transfer',description:'Notgroschen sparen',amount:500,currency:'CHF',cadence:'monthly',account_id:'a1',destination_account_id:'a2'},
  {id:'outgoing',active:true,direction:'transfer',description:'Notgroschen leeren',amount:200,currency:'CHF',cadence:'monthly',account_id:'a2',destination_account_id:'a3'},
];

const formOnly=renderGoals({goals:[],goalSources:[],recurringRules,transactions:[],accounts,household,profile,fxRates:{},canWrite:true});
assert.match(formOnly,/Notgroschen sparen/);
assert.match(formOnly,/Notgroschen leeren/);
assert.doesNotMatch(formOnly,/>Miete ·/,'expense rules must not be offered as goal funding');

const html=renderGoals({
  goals:[{id:'g1',name:'Notgroschen',goal_type:'emergency',target_amount:10000,current_amount:0,monthly_amount:0,currency:'CHF',account_id:'a2',status:'active'}],
  goalSources:[
    {id:'s1',goal_id:'g1',source_type:'recurring_rule',recurring_rule_id:'incoming',label:'INCOMING-SOURCE',active:true},
    {id:'s2',goal_id:'g1',source_type:'recurring_rule',recurring_rule_id:'outgoing',label:'OUTGOING-SOURCE',active:true},
  ],
  recurringRules,transactions:[],accounts,household,profile,fxRates:{},canWrite:true,
});
assert.match(html,/INCOMING-SOURCE/,'incoming transfer should fund linked savings account');
assert.doesNotMatch(html,/OUTGOING-SOURCE/,'outgoing transfer must not be counted as goal funding');

const main=fs.readFileSync(new URL('../assets/js/main.js',import.meta.url),'utf8');
const receipt=fs.readFileSync(new URL('../assets/js/app/receipt-controller.js',import.meta.url),'utf8');
const master=fs.readFileSync(new URL('../supabase/migrations/20261002_finance_masterdata_copy_recursive_fix.sql',import.meta.url),'utf8');
const sameDay=fs.readFileSync(new URL('../supabase/migrations/20261002_finance_same_day_bill_debt_balance_fix.sql',import.meta.url),'utf8');
const sourceDelete=fs.readFileSync(new URL('../supabase/migrations/20261002_finance_source_recurring_delete_cleanup.sql',import.meta.url),'utf8');

assert.doesNotMatch(main,/new Date\(formValue\(data,'occurredAt'\)\)\.toISOString\(\)/);
assert.equal((main.match(/financeEventTimestamp\(formValue\(data,'occurredAt'\)\)/g)||[]).length>=3,true);
assert.match(receipt,/occurred_at:\s*financeEventTimestamp\(receiptDate\)/);
assert.match(main,/Die Kontowährung kann nicht geändert werden/);
assert.match(main,/deleteLinkedDocuments\('transaction'/);
assert.match(main,/documentObjectTypeByTable/);
assert.match(main,/rule\.direction!=='transfer'/);
assert.match(master,/select c\.\*,t\.depth\+1/);
assert.match(sameDay,/v_paid_at=current_date then now\(\)/);
assert.match(sameDay,/new\.paid_at=current_date then now\(\)/);
assert.match(sourceDelete,/contracts_cleanup_recurring_rule/);
assert.match(sourceDelete,/insurance_cleanup_recurring_rule/);
assert.match(sourceDelete,/debts_cleanup_recurring_rule/);
assert.match(sourceDelete,/delete from public\.recurring_rules/);
assert.ok(
  main.indexOf("await financeApi.deleteTransaction(tx.id);") < main.indexOf("await deleteLinkedDocuments('transaction',tx.id);"),
  'transaction data must be deleted before linked document cleanup'
);

console.log('linkage regression assertions OK');
