import assert from 'node:assert/strict';
import { bankStatementCheckpoint,reconcileBankStatement } from '../assets/js/app/bank-statement-reconcile.js';
import { guessMapping,parseCsv,rowToTransaction } from '../assets/js/app/csv-import.js';

const text='Buchungsdatum;Beschreibung1;Transaktions-Nr.;Belastung;Gutschrift;Saldo;Währung\n'
 +'2026-10-23;Lohn;UBS-SALARY;;6412.05;4429.02;CHF\n'
 +'2026-10-23;Scheidung;UBS-DIVORCE;-150.00;;4279.02;CHF\n'
 +'2026-10-28;Migros;UBS-MIGROS;-22.35;;-878.67;CHF';
const csv=parseCsv(text),mapping=guessMapping(csv.headers);
const checkpoint=bankStatementCheckpoint(csv.rows,mapping);
assert.deepEqual(checkpoint,{date:'2026-10-28',balance:-878.67,currency:'CHF',ambiguous:false});
const account={
 account_id:'salary',currency:'CHF',current_balance:-878.67,
 balance_anchor_at:'2026-10-04T12:00:00Z'
};
assert.deepEqual(reconcileBankStatement({checkpoint,account,transactions:[]}),{
 status:'matched',date:'2026-10-28',currency:'CHF',
 bankBalance:-878.67,ledgerBalance:-878.67,difference:0,
});
const broken=reconcileBankStatement({checkpoint,account:{...account,current_balance:-3746.74},transactions:[]});
assert.equal(broken.status,'difference');
assert.equal(broken.difference,-2868.07);
const newerTx={account_id:'salary',amount:-50,currency:'CHF',status:'booked',occurred_at:'2026-10-29T12:00:00Z'};
const future=reconcileBankStatement({checkpoint,account:{...account,current_balance:-928.67},transactions:[newerTx]});
assert.equal(future.status,'matched','Future bank posting must not contaminate older balance check');
assert.equal(reconcileBankStatement({checkpoint,account:{...account,currency:'EUR'}}).status,'unverifiable');
assert.equal(reconcileBankStatement({checkpoint,account:{...account,balance_anchor_at:'2026-10-29T00:00:00Z'}}).status,'unverifiable');

const multi=parseCsv('Buchungsdatum;Beschreibung1;Transaktions-Nr.;Belastung;Gutschrift;Saldo\n'
+'2026-10-23;A;A;-150;;4273.62\n'
+'2026-10-23;B;B;-280;;3993.62\n'
+'2026-10-23;C;C;-350;;3643.62');
const end=bankStatementCheckpoint(multi.rows,guessMapping(multi.headers));
assert.equal(end.balance,3643.62,'Unique last posting of same date should be identified');
assert.equal(bankStatementCheckpoint([{Buchungsdatum:'2026-10-23',Beschreibung1:'A','Belastung':'-150',Saldo:'',}],guessMapping(['Buchungsdatum','Beschreibung1','Belastung','Saldo'])),null);
const diffCurrency=bankStatementCheckpoint([{Buchungsdatum:'2026-10-23',Beschreibung1:'A',Belastung:'-10',Saldo:'20',Währung:'EUR'},{Buchungsdatum:'2026-10-24',Beschreibung1:'B',Belastung:'-10',Saldo:'10',Währung:'CHF'}],guessMapping(['Buchungsdatum','Beschreibung1','Belastung']));
assert.equal(diffCurrency?.ambiguous,true);
console.log('UBS statement Saldo checkpoint: verified, difference detected, newer tx excluded');
