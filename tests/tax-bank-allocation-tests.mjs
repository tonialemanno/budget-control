import assert from 'node:assert/strict';
import { recordTaxMovement } from '../assets/js/app/transaction-engine.js';

const calls=[];
const api={
  recordTaxInstallmentPayment:async (args)=>{calls.push(args);return {id:'payment-1',...args};},
  recordTaxPayment:()=>{throw new Error('Installment path must use atomic RPC');},
};
const taxCase={id:'case-2026',currency:'CHF',tax_year:2026};
const bankTransaction={id:'imported-bank-entry',currency:'CHF',amount:-605,status:'booked'};
const result=await recordTaxMovement({
  api,householdId:'household-1',taxCase,obligationId:'claim-1',
  installmentDueDate:'2026-11-25',paymentType:'payment',
  amount:605,paidAt:'2026-11-25',source:'linked_transaction',
  transaction:bankTransaction
});
assert.equal(result.transactionId,'imported-bank-entry');
assert.equal(result.installmentDueDate,'2026-11-25');
assert.equal(result.taxCaseId,'case-2026');
assert.equal(calls.length,1);
assert.equal(calls[0].accountId,null,'No new account movement when linking a booked bank entry');
await assert.rejects(()=>recordTaxMovement({
  api,householdId:'household-1',taxCase,obligationId:'claim-1',
  installmentDueDate:'2026-11-25',paymentType:'payment',
  amount:604,paidAt:'2026-11-25',source:'linked_transaction',
  transaction:bankTransaction
}),/Betrag der Buchung/);
assert.equal(calls.length,1,'Invalid amounts must not create a tax movement');
console.log('tax bank entry to installment allocation: ok');
