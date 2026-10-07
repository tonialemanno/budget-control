function absAmount(value){ return Math.abs(Number(value)||0); }
function sameDayDistance(a,b){
  const left=new Date(a).getTime(), right=new Date(b).getTime();
  if(!Number.isFinite(left)||!Number.isFinite(right)) return Number.POSITIVE_INFINITY;
  return Math.abs(left-right)/86400000;
}
function eligibleTransferLeg(tx){
  return Boolean(tx)
    && tx.status==='booked'
    && !tx.transfer_group_id
    && !tx.category_id
    && tx.cashflow_type==='standard'
    && !['debt_payment','receivable_principal'].includes(tx.cashflow_type)
    && Number(tx.amount)!==0;
}
export function transferCandidatesFor(tx,{transactions=[]}={}){
  if(!eligibleTransferLeg(tx)) return [];
  const sign=Math.sign(Number(tx.amount));
  const amount=absAmount(tx.amount);
  return transactions
    .filter((row)=>eligibleTransferLeg(row)
      && row.id!==tx.id
      && row.account_id!==tx.account_id
      && row.currency===tx.currency
      && Math.sign(Number(row.amount))===-sign
      && Math.abs(absAmount(row.amount)-amount)<0.005
      && sameDayDistance(row.occurred_at,tx.occurred_at)<=7)
    .sort((a,b)=>sameDayDistance(a.occurred_at,tx.occurred_at)-sameDayDistance(b.occurred_at,tx.occurred_at));
}

function duplicateMerchantGroups(merchants=[]){
  const normalize=(value)=>String(value||'').toLowerCase()
    .normalize('NFKD').replace(/[\u0300-\u036f]/g,'')
    .replace(/\b(?:ag|gmbh|sa|srl|ltd|inc)\b/g,' ')
    .replace(/\b\d{4,}\b/g,' ')
    .replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();
  const groups=new Map();
  for(const merchant of merchants){
    const key=normalize(merchant.name||merchant.normalized_key);
    if(!key||key.length<5) continue;
    const rows=groups.get(key)||[];
    rows.push(merchant);
    groups.set(key,rows);
  }
  return [...groups.values()].filter((rows)=>rows.length>1);
}

export function buildReviewQueue({
  transactions=[],accounts=[],categories=[],bills=[],merchants=[],previousVisitAt=null,now=new Date(),
}={}){
  const accountById=new Map(accounts.map((row)=>[row.account_id||row.id,row]));
  const categoryById=new Map(categories.map((row)=>[row.id,row]));
  const openTransactions=transactions.filter((tx)=>
    tx.status==='booked'
    && !tx.transfer_group_id
    && !['debt_payment','receivable_principal'].includes(tx.cashflow_type)
    && !tx.category_id
  );

  const pairSeen=new Set();
  const possibleTransfers=[];
  const ambiguousTransfers=[];
  for(const tx of transactions){
    if(!eligibleTransferLeg(tx)) continue;
    const candidates=transferCandidatesFor(tx,{transactions});
    if(!candidates.length) continue;
    if(candidates.length===1){
      const other=candidates[0];
      const pairKey=[tx.id,other.id].sort().join(':');
      if(pairSeen.has(pairKey)) continue;
      pairSeen.add(pairKey);
      const primary=Number(tx.amount)<0?tx:other;
      const counterpart=primary.id===tx.id?other:tx;
      possibleTransfers.push({
        tx:primary,
        counterpart,
        fromAccount:accountById.get(primary.account_id)||null,
        toAccount:accountById.get(counterpart.account_id)||null,
        dayDistance:sameDayDistance(primary.occurred_at,counterpart.occurred_at),
      });
    } else if(Number(tx.amount)<0){
      ambiguousTransfers.push({
        tx,
        candidates,
        fromAccount:accountById.get(tx.account_id)||null,
      });
    }
  }

  const transferTxIds=new Set([
    ...possibleTransfers.flatMap((item)=>[item.tx.id,item.counterpart.id]),
    ...ambiguousTransfers.map((item)=>item.tx.id),
  ]);
  const unknownIncoming=openTransactions.filter((tx)=>Number(tx.amount)>0&&!transferTxIds.has(tx.id));
  const uncategorizedExpenses=openTransactions.filter((tx)=>Number(tx.amount)<0&&!transferTxIds.has(tx.id));
  const deadline=now.getTime()+14*86400000;
  const dueBills=bills.filter((bill)=>{
    if(!['open','overdue'].includes(bill.status)) return false;
    const due=new Date(String(bill.due_date||'').slice(0,10)+'T23:59:59').getTime();
    return Number.isFinite(due)&&due<=deadline;
  }).sort((a,b)=>String(a.due_date).localeCompare(String(b.due_date)));

  const previousTs=previousVisitAt?new Date(previousVisitAt).getTime():null;
  const sinceLastVisit=previousTs&&Number.isFinite(previousTs)
    ? transactions.filter((tx)=>{
        const created=new Date(tx.created_at||tx.occurred_at).getTime();
        return Number.isFinite(created)&&created>previousTs;
      })
    : [];

  const merchantDuplicates=duplicateMerchantGroups(merchants);
  const openCount=uncategorizedExpenses.length+unknownIncoming.length+possibleTransfers.length+ambiguousTransfers.length+dueBills.length;

  return {
    openCount,
    openTransactions,
    uncategorizedExpenses,
    unknownIncoming,
    possibleTransfers,
    ambiguousTransfers,
    dueBills,
    merchantDuplicates,
    sinceLastVisit,
    accountById,
    categoryById,
  };
}
