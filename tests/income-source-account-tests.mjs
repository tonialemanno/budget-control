import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createEconomicTransaction } from '../assets/js/app/transaction-engine.js';
import { renderFixedCosts } from '../assets/js/views/fixed-costs.js';
import { renderRecurring } from '../assets/js/views/recurring.js';
import { renderTransactions } from '../assets/js/views/transactions.js';

let saved=null;
await createEconomicTransaction({
  api:{createTransaction:async(payload)=>{ saved=payload; return payload; }},
  householdId:'household',
  account:{account_id:'ing',currency:'EUR'},
  direction:'income',
  amount:250,
  occurredAt:'2026-10-10T10:00:00Z',
  description:'Landkreis Breisgau',
  counterparty:'Landkreis Breisgau-Hochschwarzwald',
  semanticType:'other_income',
});
assert.equal(saved.account_id,'ing');
assert.equal(saved.amount,250);
assert.equal(saved.counterparty,'Landkreis Breisgau-Hochschwarzwald');

const common={
  accounts:[{account_id:'ing',name:'ING',currency:'EUR',account_type:'checking'}],
  categories:[{id:'income',name:'Sonstige Einnahmen',kind:'income'}],
  recurringRules:[],
  household:{id:'h',base_currency:'EUR'},
  profile:{locale:'de-DE'},
  canWrite:true,
};

const fixed=renderFixedCosts({...common,merchants:[],fxRates:[]});
assert.match(fixed,/fixedCostAccountLabel/);
assert.match(fixed,/fixedCostCounterpartyLabel/);

const recurring=renderRecurring({...common,contracts:[],insurance:[],debts:[],goalSources:[]});
assert.match(recurring,/recurringAccountLabel/);
assert.match(recurring,/recurringCounterparty/);

const tx=renderTransactions({
  ...common,
  transactions:[],debtPayments:[],bills:[],fxRates:[],
  merchants:[],merchantAliases:[],counterparties:[],transactionContexts:[],vehicles:[],
  categorizationRules:[],documents:[],transactionDuplicateIgnores:[],
});
assert.match(tx,/transactionCreateAccountLabel/);
assert.match(tx,/transactionCreateCounterpartyLabel/);

const main=fs.readFileSync(new URL('../assets/js/main.js',import.meta.url),'utf8');
assert.match(main,/Eingang auf Konto/);
assert.match(main,/Zahler \/ Quelle der Einnahme/);
assert.match(main,/Landkreis Breisgau/);
assert.match(main,/counterparty:direction==='transfer'\?null:nullValue\(data,'counterparty'\)/);

console.log('beta income source vs receiving account assertions OK');
