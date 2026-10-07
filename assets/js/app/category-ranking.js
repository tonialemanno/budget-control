export function categoryUsageStats(transactions=[]){
  const stats=new Map();
  for(const tx of transactions){
    if(!tx?.category_id||tx.status!=='booked'||tx.transfer_group_id) continue;
    if(['debt_payment','receivable_principal'].includes(tx.cashflow_type)) continue;
    if(['debt_repayment','internal_transfer'].includes(tx.semantic_type)) continue;
    const current=stats.get(tx.category_id)||{count:0,lastUsed:0};
    current.count+=1;
    const usedAt=new Date(tx.occurred_at||0).getTime();
    if(Number.isFinite(usedAt)) current.lastUsed=Math.max(current.lastUsed,usedAt);
    stats.set(tx.category_id,current);
  }
  return stats;
}

export function rankCategoriesByUsage(categories=[],transactions=[],{kind=null,excludeNames=[]}={}){
  const blocked=new Set(excludeNames.map((name)=>String(name||'').trim().toLowerCase()));
  const stats=categoryUsageStats(transactions);
  return categories
    .filter((category)=>(!kind||category.kind===kind)&&!blocked.has(String(category.name||'').trim().toLowerCase()))
    .slice()
    .sort((a,b)=>{
      const aStats=stats.get(a.id)||{count:0,lastUsed:0};
      const bStats=stats.get(b.id)||{count:0,lastUsed:0};
      if(bStats.count!==aStats.count) return bStats.count-aStats.count;
      if(bStats.lastUsed!==aStats.lastUsed) return bStats.lastUsed-aStats.lastUsed;
      const aSort=Number.isFinite(Number(a.sort_order))?Number(a.sort_order):999999;
      const bSort=Number.isFinite(Number(b.sort_order))?Number(b.sort_order):999999;
      if(aSort!==bSort) return aSort-bSort;
      return String(a.name||'').localeCompare(String(b.name||''),'de');
    });
}

export function categoryUsageLabel(categoryId,transactions=[],label='verwendet'){
  const stats=categoryUsageStats(transactions).get(categoryId);
  if(!stats?.count) return '';
  return `${stats.count}× ${label}`;
}
