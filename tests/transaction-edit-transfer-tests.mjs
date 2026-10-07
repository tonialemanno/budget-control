import assert from 'node:assert/strict';
import fs from 'node:fs';
import { renderTransactions } from '../assets/js/views/transactions.js';

const html=renderTransactions({
  canWrite:true,
  household:{base_currency:'CHF'},
  profile:{locale:'de-CH'},
  accounts:[
    {account_id:'ubs',name:'UBS',currency:'CHF',account_type:'checking'},
    {account_id:'zak',name:'ZAK',currency:'CHF',account_type:'checking'},
  ],
  categories:[],
  transactions:[],
  debtPayments:[],
  bills:[],
  merchants:[],
  categorizationRules:[],
  recurringRules:[],
});

assert.match(html,/transactionEditDirection/);
assert.match(html,/value="transfer">Umbuchung zwischen eigenen Konten/);
assert.match(html,/transactionEditOtherAccount/);
assert.match(html,/transactionEditOtherTransaction/);
assert.match(html,/fehlende Gegenbuchung/);

const main=fs.readFileSync(new URL('../assets/js/main.js',import.meta.url),'utf8');
assert.match(main,/syncTransactionTransferEditor/);
assert.match(main,/function openTransactionEditor\(tx, \{ recurring = false \} = \{\}\) \{\s*const locale=runtime\.profile\?\.locale\|\|APP_CONFIG\.defaultLocale;/);
assert.match(main,/convertTransactionToTransferV2/);
assert.match(main,/direction:'transfer'/);
assert.match(main,/destination_account_id:destinationAccount\.account_id/);
assert.match(main,/otherTransactionId:nullValue\(data,'otherTransactionId'\)/);

const api=fs.readFileSync(new URL('../assets/js/app/finance-api.js',import.meta.url),'utf8');
assert.match(api,/convertTransactionToTransferV2/);
assert.match(api,/convert_transaction_to_transfer_v2/);
assert.match(api,/p_other_transaction_id/);

const migration=fs.readFileSync(new URL('../supabase/migrations/20261004_transaction_edit_transfer_v2.sql',import.meta.url),'utf8');
assert.match(migration,/security invoker/i);
assert.match(migration,/p_other_transaction_id/);
assert.match(migration,/if p_other_transaction_id is not null then/);
assert.match(migration,/insert into public\.transactions/);
assert.match(migration,/semantic_type='internal_transfer'/);
assert.doesNotMatch(migration,/delete from public\.transactions/i);

console.log('transaction edit transfer assertions OK');
