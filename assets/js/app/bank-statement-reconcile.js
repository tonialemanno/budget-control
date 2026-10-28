import { parseAmount, rowToTransaction } from './csv-import.js';

function amountCents(value){const n=Number(value);return Number.isFinite(n)?Math.round(n*100):null;}
function dateKey(value){
  const d=value instanceof Date?value:new Date(value);
  return Number.isNaN(d.getTime())?'':d.toISOString().slice(0,10);
}
function statementBalance(row){
  if(!row || typeof row!=='object')return null;
  const entry=Object.entries(row).find(([k])=>/^(?:saldo|kontostand|running\s*balance|closing\s*balance)$/i.test(k.trim()));
  if(!entry)return null;
  const value=parseAmount(entry[1]);
  return value===null?null:amountCents(value);
}

/**
 * Bank-generated running balance is evidence of the ledger closing balance,
 * NOT another transaction. If multiple postings share the latest booking date,
 * find the unique terminal posting by following post-/pre-balance transitions.
 */
export function bankStatementCheckpoint(rows,mapping){
  const parsed=(rows||[]).map(row=>{
    const tx=rowToTransaction(row,mapping);
    if(!tx)return null;
    const value=statementBalance(row);
    if(value===null)return null;
    const currency=String(row['Währung']||row['Waehrung']||row.Currency||'').trim().toUpperCase();
    return {date:dateKey(tx.occurred_at),after:value,before:value-amountCents(tx.amount),currency};
  }).filter(Boolean);
  if(!parsed.length)return null;
  const latest=parsed.reduce((acc,row)=>row.date>acc?row.date:acc,'');
  const lastDay=parsed.filter(row=>row.date===latest);
  const endCandidates=lastDay.filter((item,i)=>
    !lastDay.some((other,j)=>j!==i&&other.before===item.after));
  if(endCandidates.length!==1)
    return {date:latest,ambiguous:true,reason:'Mehrere mögliche Endsalden am letzten Buchungstag.'};
  const terminal=endCandidates[0];
  const currencies=[...new Set(parsed.map(row=>row.currency).filter(Boolean))];
  if(currencies.length>1)
    return {date:latest,ambiguous:true,reason:'Unterschiedliche Währungen im Kontoauszug.'};
  return {date:latest,balance:terminal.after/100,currency:currencies[0]||null,ambiguous:false};
}

/**
 * Compares the bank's proven date-end balance with ledger balance as of that
 * date, undoing newer local postings. Does not mutate any account balance.
 */
export function reconcileBankStatement({checkpoint,account,transactions=[]}={}){
  if(!checkpoint||checkpoint.ambiguous||!account)
    return {status:'unverifiable',reason:checkpoint?.reason||'Kein verlässlicher Saldo im CSV gefunden.'};
  if(checkpoint.currency&&checkpoint.currency!==account.currency)
    return {status:'unverifiable',reason:'Kontowährung und Währung im Bankauszug unterscheiden sich.'};
  const anchorDate=dateKey(account.balance_anchor_at);
  if(anchorDate&&checkpoint.date<=anchorDate)
    return {status:'unverifiable',reason:'Bankauszug liegt vor oder am Tag des Kontostand-Ankers.'};
  const current=amountCents(account.current_balance);
  if(current===null)return {status:'unverifiable',reason:'Kontostand in AIONE ist ungültig.'};
  const newer=(transactions||[]).filter(tx=>tx.account_id===account.account_id&&tx.status==='booked'
    &&dateKey(tx.occurred_at)>checkpoint.date)
    .reduce((sum,tx)=>sum+(amountCents(tx.amount)||0),0);
  const ledger=current-newer;
  const bank=amountCents(checkpoint.balance);
  const difference=ledger-bank;
  return {
    status:Math.abs(difference)<=1?'matched':'difference',
    date:checkpoint.date,currency:account.currency,
    bankBalance:bank/100,ledgerBalance:ledger/100,
    difference:difference/100,
  };
}
