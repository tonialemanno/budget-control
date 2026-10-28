import assert from 'node:assert/strict';
import { parseCsv,guessMapping,rowToTransaction,bankCounterpartyIban } from '../assets/js/app/csv-import.js';
import { detectOwnBankTransfer } from '../assets/js/app/own-bank-transfers.js';

const csv=parseCsv('Buchungsdatum;Beschreibung1;Beschreibung2;Beschreibung3;Transaktions-Nr.;Belastung;Saldo\n'
 + '2026-10-23;Antonio Giuseppe Alemanno;SPAREN F R SCHLECHTE TAG;Konto-Nr. IBAN: CH11 0020 3203 8604 15M1 M;9903296LK7678439;-525.00;3098.62\n');
const parsed=rowToTransaction(csv.rows[0],guessMapping(csv.headers));
assert.equal(bankCounterpartyIban(csv.rows[0]),'CH1100203203860415M1M');
assert.equal(parsed.counterparty_account_ref,'CH1100203203860415M1M');
assert.equal(parsed.amount,-525);

const accounts=[
 {account_id:'salary',currency:'CHF',account_type:'checking',external_account_ref:null},
 {account_id:'savings',currency:'CHF',account_type:'savings',external_account_ref:null},
 {account_id:'another',currency:'CHF',account_type:'savings',external_account_ref:null},
];
const rule={id:'save-monthly',active:true,direction:'transfer',account_id:'salary',
 destination_account_id:'savings',currency:'CHF',amount:525,description:'Sparen',
 next_date:'2026-10-25',cadence:'monthly'};
const transfers=[
 {id:'september-debit',account_id:'salary',amount:-525,currency:'CHF',status:'booked',
  transfer_group_id:'pair-01'},
 {id:'september-credit',account_id:'savings',amount:525,currency:'CHF',status:'booked',
  transfer_group_id:'pair-01'},
];
const tx={...parsed,account_id:'salary',currency:'CHF'};
const inferred=detectOwnBankTransfer({transaction:tx,accounts,recurringRules:[rule],transactions:transfers});
assert.equal(inferred?.account.account_id,'savings');
assert.equal(inferred?.reason,'verified-recurring-precedent');
assert.equal(inferred?.requiresConfirmation,true,'Unknown beneficiary IBAN must never be auto-posted');
assert.equal(detectOwnBankTransfer({transaction:tx,accounts,recurringRules:[rule],transactions:[]}),null,'No historical evidence: do not guess');
assert.equal(detectOwnBankTransfer({transaction:tx,accounts,recurringRules:[{...rule,amount:600}],transactions:transfers}),null);
assert.equal(detectOwnBankTransfer({transaction:tx,accounts,recurringRules:[{...rule,description:'Versicherung'}],transactions:transfers}),null);
assert.equal(detectOwnBankTransfer({transaction:{...tx,account_id:'another'},accounts,recurringRules:[rule],transactions:transfers}),null);
assert.equal(detectOwnBankTransfer({transaction:{...tx,counterparty_account_ref:null,import_raw_data:{row:{Beschreibung2:'Sparen'}}},accounts,recurringRules:[rule],transactions:transfers}),null,'Require real IBAN evidence');

// Explicit saved IBAN may link directly but not across currencies or wrong source account.
const savedAccounts=accounts.map(a=>a.account_id==='savings'?{...a,external_account_ref:'CH11 0020 3203 8604 15M1 M'}:a);
assert.equal(detectOwnBankTransfer({transaction:tx,accounts:savedAccounts}).account.account_id,'savings');
assert.equal(detectOwnBankTransfer({transaction:tx,accounts:savedAccounts}).requiresConfirmation,false);
assert.equal(detectOwnBankTransfer({transaction:{...tx,currency:'EUR'},accounts:savedAccounts}),null);
assert.equal(detectOwnBankTransfer({transaction:{...tx,amount:525},accounts:savedAccounts}),null);

const unrelatedCsv=parseCsv('Buchungsdatum;Beschreibung1;Beschreibung2;Beschreibung3;Belastung\n'
 +'2026-10-23;Restaurant;Mittagessen;Zahlungsgrund: Essen; -525.00');
const unrelated=rowToTransaction(unrelatedCsv.rows[0],guessMapping(unrelatedCsv.headers));
assert.equal(bankCounterpartyIban(unrelated.import_raw_data.row),'');
assert.equal(unrelated.counterparty_account_ref,null);

console.log('Savings account beneficiary IBAN and verified recurring transfer matching OK');
