import { bankCounterpartyIban } from './csv-import.js';

const normalized=(value)=>String(value||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
const asAmount=(value)=>Math.round(Number(value||0)*100);
const words=(value)=>String(value||'').normalize('NFKD').replace(/[\u0300-\u036F]/g,'')
  .toLowerCase().replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');

function hasKnownTransferPrecedent(rule,transactions){
  const posted=(transactions||[]).filter(row=>row.status==='booked'&&row.transfer_group_id
    &&row.account_id===rule.account_id&&row.currency===rule.currency
    &&asAmount(row.amount)===-asAmount(rule.amount));
  return posted.some(source=>(transactions||[]).some(target=>
    target.id!==source.id
    &&target.status==='booked'
    &&target.transfer_group_id===source.transfer_group_id
    &&target.account_id===rule.destination_account_id
    &&target.currency===rule.currency
    &&asAmount(target.amount)===asAmount(rule.amount)
  ));
}

/**
 * Identify the account on the receiving end of a bank-imported payment.
 * Direct IBAN matching is trusted if the account belongs to this household.
 * An account without an IBAN may be recognized ONLY when an active transfer
 * rule and a previously verified linked transfer agree with the bank purpose,
 * amount, source account, destination account and currency.
 *
 * Unknown or conflicting matches are NOT automatically booked as transfers.
 * A recurring-rule match is only a SUGGESTION until the user confirms that
 * the recipient IBAN actually belongs to the proposed own account.
 */
export function detectOwnBankTransfer({transaction,accounts=[],recurringRules=[],transactions=[]}={}){
  if(!transaction||!transaction.account_id||!transaction.currency||!(Number(transaction.amount)<0))
    return null;
  const recipientRef=normalized(transaction.counterparty_account_ref
    ||bankCounterpartyIban(transaction.import_raw_data?.row));
  if(!/^CH\d{2}[A-Z0-9]{17}$/.test(recipientRef)) return null;
  const eligible=accounts.filter(account=>account.account_id!==transaction.account_id
    &&account.is_archived!==true&&account.currency===transaction.currency);
  const direct=eligible.filter(account=>normalized(account.external_account_ref)===recipientRef);
  if(direct.length===1)return {account:direct[0],reason:'iban',requiresConfirmation:false};
  if(direct.length>1)return null;

  const raw=transaction.import_raw_data?.row||{};
  const purpose=words([raw.Beschreibung2,raw.Beschreibung3,raw.Verwendungszweck].filter(Boolean).join(' '));
  if(!purpose)return null;
  const rules=(recurringRules||[]).filter(rule=>
    rule.active!==false&&rule.direction==='transfer'
    &&rule.account_id===transaction.account_id
    &&rule.currency===transaction.currency
    &&asAmount(rule.amount)===-asAmount(transaction.amount)
    &&eligible.some(account=>account.account_id===rule.destination_account_id)
    &&words(rule.description).length>=5&&purpose.includes(words(rule.description))
    &&hasKnownTransferPrecedent(rule,transactions)
  );
  const unique=[...new Set(rules.map(rule=>rule.destination_account_id))];
  if(unique.length!==1)return null;
  return {account:eligible.find(account=>account.account_id===unique[0]),reason:'verified-recurring-precedent',requiresConfirmation:true};
}
