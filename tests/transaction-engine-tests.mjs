import assert from 'node:assert/strict';
import {
  merchantDefaultCategory,
  signedAmount,
  createEconomicTransaction,
  createEconomicTransfer,
  recordDebtMovement,
  recordReceivableMovement,
  recordTaxMovement,
} from '../assets/js/app/transaction-engine.js';

assert.equal(merchantDefaultCategory('m1',null,[{id:'m1',default_category_id:'c2'}]),'c2');
assert.equal(merchantDefaultCategory('m1','c9',[{id:'m1',default_category_id:'c2'}]),'c9');
assert.equal(signedAmount('expense',12.5),-12.5);
assert.equal(signedAmount('income',12.5),12.5);
assert.throws(()=>signedAmount('expense',0),/grösser als 0/);

let captured=null;
const api={
  async createTransaction(payload){captured=payload;return {id:'tx1',...payload};},
  async createTransfer(payload){captured=payload;return {id:'g1'};},
  async createDebtPayment(payload){captured=payload;return {id:'dp1'};},
  async recordReceivablePayment(payload){captured=payload;return {id:'rp1'};},
  async recordTaxPayment(payload){captured=payload;return {id:'tp1'};},
};
const account={account_id:'a1',currency:'CHF'};
await createEconomicTransaction({
  api,householdId:'h1',account,direction:'expense',amount:40,
  merchantId:'m1',merchants:[{id:'m1',default_category_id:'c2'}],
  occurredAt:'2026-10-03T12:00:00Z',description:'Coop',
  tax:{enabled:true,year:2026,treatment:'deduction',sectionKey:'work_expenses',category:'Berufskosten'},
});
assert.equal(captured.amount,-40);
assert.equal(captured.category_id,'c2');
assert.equal(captured.tax_relevant,true);
assert.equal(captured.tax_year,2026);
assert.equal(captured.tax_section_key,'work_expenses');

await createEconomicTransfer({
  api,householdId:'h1',
  fromAccount:{account_id:'a1',currency:'CHF'},
  toAccount:{account_id:'a2',currency:'CHF'},
  fromAmount:150,occurredAt:'2026-10-03T12:00:00Z',
});
assert.equal(captured.p_from_amount,150);
assert.equal(captured.p_to_amount,150);
await assert.rejects(
  ()=>createEconomicTransfer({
    api,householdId:'h1',
    fromAccount:{account_id:'a1',currency:'CHF'},
    toAccount:{account_id:'a2',currency:'EUR'},
    fromAmount:150,toAmount:null,occurredAt:'2026-10-03T12:00:00Z',
  }),
  /Zielbetrag/
);

await recordDebtMovement({
  api,householdId:'h1',
  debt:{id:'d1',currency:'CHF',outstanding_amount:1000},
  amount:120,principalAmount:100,interestAmount:15,feeAmount:5,
  paidAt:'2026-10-03',source:'created_transaction',paymentAccountId:'a1',
});
assert.equal(captured.debt_id,'d1');
assert.equal(captured.payment_account_id,'a1');
assert.equal(captured.principal_amount,100);
await assert.rejects(
  ()=>recordDebtMovement({
    api,householdId:'h1',debt:{id:'d1',currency:'CHF',outstanding_amount:50},
    amount:100,principalAmount:100,paidAt:'2026-10-03',source:'history_only'
  }),
  /Restschuld/
);

await recordReceivableMovement({
  api,householdId:'h1',receivable:{id:'r1',outstanding_amount:500},
  amount:200,paidAt:'2026-10-03',source:'linked_transaction',transactionId:'tx-in',
});
assert.equal(captured.source,'linked_transaction');
assert.equal(captured.transactionId,'tx-in');
assert.equal(captured.paymentAccountId,null);

await recordTaxMovement({
  api,householdId:'h1',taxCase:{id:'tc1',currency:'CHF',tax_year:2026},
  paymentType:'payment',amount:300,paidAt:'2026-10-03',
  source:'created_transaction',account:{account_id:'a1',currency:'CHF'},
});
assert.equal(captured.taxCaseId,'tc1');
assert.equal(captured.source,'created_transaction');
assert.equal(captured.accountId,'a1');

console.log('transaction engine assertions OK');
