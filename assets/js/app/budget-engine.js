import { convertAmount } from './fx.js';
import { categoryLineage, matchingRecurringRule, monthlyRuleAmount, semanticExpenseBase, semanticType } from './finance-semantics.js';
import { inFinanceCycle, resolveFinanceCycle } from './finance-cycle.js';

function base(value,currency,target,fxRates){
  return convertAmount(value,currency||target,target,fxRates)??0;
}

function norm(value){
  return String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
}

function monthKey(value){
  const date=value instanceof Date?value:new Date(value);
  if(Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`;
}

function monthDistance(start,end){
  return Math.max(1,(end.getFullYear()-start.getFullYear())*12+(end.getMonth()-start.getMonth())+1);
}

function median(values=[]){
  const rows=values.filter(Number.isFinite).slice().sort((a,b)=>a-b);
  if(!rows.length) return 0;
  const middle=Math.floor(rows.length/2);
  return rows.length%2?rows[middle]:(rows[middle-1]+rows[middle])/2;
}

function cadenceFromDates(rows=[]){
  if(rows.length<3) return null;
  const dates=rows.map((row)=>new Date(row.occurred_at)).filter((date)=>!Number.isNaN(date.getTime())).sort((a,b)=>a-b);
  if(dates.length<3) return null;
  const gaps=[];
  for(let i=1;i<dates.length;i+=1) gaps.push((dates[i]-dates[i-1])/86400000);
  const gap=median(gaps);
  if(gap>=24&&gap<=38) return {key:'monthly',months:1,label:'monatlich'};
  if(gap>=70&&gap<=110) return {key:'quarterly',months:3,label:'quartalsweise'};
  if(gap>=150&&gap<=220) return {key:'semiannual',months:6,label:'halbjährlich'};
  if(gap>=300&&gap<=430) return {key:'yearly',months:12,label:'jährlich'};
  return null;
}

function merchantForTransaction(tx,merchants=[]){
  if(tx.merchant_id){
    const direct=merchants.find((row)=>row.id===tx.merchant_id);
    if(direct) return direct;
  }
  const text=norm([tx.merchants?.name,tx.counterparty,tx.description].filter(Boolean).join(' '));
  if(!text) return null;
  return merchants
    .map((merchant)=>({merchant,key:norm(merchant.normalized_key||merchant.name)}))
    .filter((row)=>row.key.length>=4&&(text.includes(row.key)||row.key.includes(text)))
    .sort((a,b)=>b.key.length-a.key.length)[0]?.merchant||null;
}

function categoryScope(tx,categories=[]){
  const lineage=categoryLineage(tx,categories);
  const leaf=lineage[0]||tx.categories||null;
  return {
    id:leaf?.id||tx.category_id||null,
    name:leaf?.name||tx.categories?.name||'Ohne Kategorie',
    parentId:leaf?.parent_id||null,
  };
}

export function effectiveBudgetSet(budgets=[],month){
  const target=String(month||'').slice(0,7);
  const current=budgets
    .filter((row)=>String(row.month_start||'').slice(0,7)===target)
    .map((row)=>({...row,_inherited:false}));

  const previousMonths=[...new Set(
    budgets.map((row)=>String(row.month_start||'').slice(0,7)).filter((value)=>/^\d{4}-\d{2}$/.test(value)&&value<target)
  )].sort().reverse();
  const sourceMonth=previousMonths[0]||null;
  if(!sourceMonth) return {rows:current,sourceMonth:target,inherited:false,inheritedCount:0};

  const scopeKey=(row)=>row.merchant_id?`merchant:${row.merchant_id}`:`category:${row.category_id||''}`;
  const currentScopes=new Set(current.map(scopeKey));
  const inheritedRows=budgets
    .filter((row)=>String(row.month_start||'').slice(0,7)===sourceMonth&&!currentScopes.has(scopeKey(row)))
    .map((row)=>({...row,_inherited:true}));
  return {
    rows:[...current,...inheritedRows],
    sourceMonth,
    inherited:inheritedRows.length>0,
    inheritedCount:inheritedRows.length,
  };
}

function budgetKind(budget,{categories=[],merchants=[],recurringRules=[]}={}){
  const category=categories.find((row)=>row.id===budget.category_id)||budget.categories||null;
  const categoryText=norm(category?.name);
  if(/(^| )(sparen|sparziel|ruecklage|ruecklagen)( |$)/.test(categoryText)) return 'saving';
  if(/(^| )(steuer|steuern|tax)( |$)/.test(categoryText)) return 'tax';

  const merchant=merchants.find((row)=>row.id===budget.merchant_id)||budget.merchants||null;
  const fixed=budget.merchant_id ? recurringRules.find((rule)=>{
    if(rule.active===false||rule.direction!=='expense') return false;
    if(rule.merchant_id&&rule.merchant_id===budget.merchant_id) return true;
    const merchantName=norm(merchant?.name);
    const ruleText=norm([rule.description,rule.counterparty,rule.merchants?.name].filter(Boolean).join(' '));
    if(merchantName.length>=4&&ruleText.length>=4&&(merchantName.includes(ruleText)||ruleText.includes(merchantName))) return true;
    const merchantTokens=new Set(merchantName.split(' ').filter((token)=>token.length>=4));
    const ruleTokens=ruleText.split(' ').filter((token)=>token.length>=4);
    return ruleTokens.some((token)=>merchantTokens.has(token));
  }) : null;
  if(fixed) return 'fixed';
  return 'variable';
}

function budgetMatchesTx(budget,tx,categories=[]){
  if(budget.merchant_id&&budget.merchant_id===tx.merchant_id) return true;
  if(budget.category_id){
    const ids=new Set(categoryLineage(tx,categories).map((row)=>row.id).filter(Boolean));
    if(ids.has(budget.category_id)) return true;
  }
  return false;
}

export function calculateBudgetSummary({
  budgets=[],transactions=[],debtPayments=[],categories=[],merchants=[],recurringRules=[],
  baseCurrency='CHF',fxRates=null,now=new Date(),fallbackDay=25,
}={}){
  const cycle=resolveFinanceCycle({transactions,recurringRules,now,fallbackDay});
  const effective=effectiveBudgetSet(budgets,cycle.budgetMonth);
  const classified=effective.rows.map((row)=>({...row,_budgetKind:budgetKind(row,{categories,merchants,recurringRules})}));
  const variableRows=classified.filter((row)=>row._budgetKind==='variable');
  const fixedLegacyRows=classified.filter((row)=>row._budgetKind==='fixed');
  const savingRows=classified.filter((row)=>row._budgetKind==='saving');
  const taxRows=classified.filter((row)=>row._budgetKind==='tax');

  const total=variableRows.reduce((sum,row)=>sum+base(Number(row.amount||0),row.currency||baseCurrency,baseCurrency,fxRates),0);
  const fixedPlanned=recurringRules
    .filter((rule)=>rule.active!==false&&rule.direction==='expense')
    .reduce((sum,rule)=>sum+monthlyRuleAmount(rule,baseCurrency,fxRates),0);
  const savingPlanned=recurringRules
    .filter((rule)=>rule.active!==false&&rule.direction==='transfer')
    .reduce((sum,rule)=>sum+monthlyRuleAmount(rule,baseCurrency,fxRates),0);

  const actualRows=transactions.filter((tx)=>{
    const date=new Date(tx.occurred_at);
    return tx.status==='booked'&&!Number.isNaN(date.getTime())&&date<=now&&inFinanceCycle(tx,cycle);
  });

  let spent=0;
  let fixedSpent=0;
  let taxSpent=0;
  let savingMoved=0;
  const matchedIds=new Set();
  const detailRows=variableRows.map((budget)=>{
    const matching=actualRows.filter((tx)=>budgetMatchesTx(budget,tx,categories)&&semanticType(tx,{categories,recurringRules})==='variable_expense');
    const value=matching.reduce((sum,tx)=>sum+semanticExpenseBase(tx,{categories,recurringRules,debtPayments,baseCurrency,fxRates}),0);
    matching.forEach((tx)=>matchedIds.add(tx.id));
    spent+=value;
    return {...budget,spent:value,transactionCount:matching.length};
  });

  for(const tx of actualRows){
    const type=semanticType(tx,{categories,recurringRules});
    const value=Math.abs(base(Number(tx.amount||0),tx.currency,baseCurrency,fxRates));
    if(type==='fixed_expense') fixedSpent+=semanticExpenseBase(tx,{categories,recurringRules,debtPayments,baseCurrency,fxRates});
    if(type==='tax_payment') taxSpent+=value;
    if(type==='saving'||type==='internal_transfer') savingMoved+=value;
  }

  const uncoveredVariable=actualRows
    .filter((tx)=>semanticType(tx,{categories,recurringRules})==='variable_expense'&&!matchedIds.has(tx.id))
    .reduce((sum,tx)=>sum+semanticExpenseBase(tx,{categories,recurringRules,debtPayments,baseCurrency,fxRates}),0);

  const rawPercent=total>0?spent/total*100:0;
  return {
    total,
    spent,
    remaining:Math.max(0,total-spent),
    overBy:Math.max(0,spent-total),
    percent:Math.max(0,Math.min(100,rawPercent)),
    rawPercent,
    count:variableRows.length,
    variableRows:detailRows,
    fixedRows:fixedLegacyRows,
    savingRows,
    taxRows,
    fixedPlanned,
    fixedSpent,
    savingPlanned,
    savingMoved,
    taxSpent,
    uncoveredVariable,
    allStoredCount:classified.length,
    sourceMonth:effective.sourceMonth,
    inherited:effective.inherited,
    inheritedCount:effective.inheritedCount||0,
    cycle,
  };
}

export function buildBudgetPatterns({
  transactions=[],categories=[],merchants=[],recurringRules=[],debtPayments=[],
  baseCurrency='CHF',fxRates=null,now=new Date(),minTransactions=2,
}={}){
  const rows=transactions.filter((tx)=>{
    const date=new Date(tx.occurred_at);
    return tx.status==='booked'&&!tx.transfer_group_id&&Number(tx.amount)<0&&!Number.isNaN(date.getTime())&&date<=now;
  });

  const groups=new Map();
  for(const tx of rows){
    const semantic=semanticType(tx,{categories,recurringRules});
    if(!['variable_expense','fixed_expense'].includes(semantic)) continue;
    const category=categoryScope(tx,categories);
    const merchant=merchantForTransaction(tx,merchants);
    const descriptionKey=norm(tx.counterparty||tx.description).slice(0,80);
    const partyKey=merchant?.id?`merchant:${merchant.id}`:`text:${descriptionKey}`;
    const key=`${partyKey}|category:${category.id||category.name}`;
    const item=groups.get(key)||{
      key,merchant,category,rows:[],total:0,months:new Set(),semantic,
    };
    const value=semanticExpenseBase(tx,{categories,recurringRules,debtPayments,baseCurrency,fxRates});
    if(!(value>0)) continue;
    item.rows.push(tx);
    item.total+=value;
    item.months.add(monthKey(tx.occurred_at));
    if(semantic==='fixed_expense') item.semantic='fixed_expense';
    groups.set(key,item);
  }

  return [...groups.values()]
    .filter((group)=>group.rows.length>=minTransactions)
    .map((group)=>{
      const ordered=group.rows.slice().sort((a,b)=>new Date(a.occurred_at)-new Date(b.occurred_at));
      const first=new Date(ordered[0].occurred_at);
      const last=new Date(ordered.at(-1).occurred_at);
      const cadence=cadenceFromDates(ordered);
      const rule=ordered
        .map((tx)=>matchingRecurringRule(tx,recurringRules,categories,'expense'))
        .find(Boolean)||null;
      const monthlyTotals=new Map();
      for(const tx of ordered){
        const key=monthKey(tx.occurred_at);
        const value=semanticExpenseBase(tx,{categories,recurringRules,debtPayments,baseCurrency,fxRates});
        monthlyTotals.set(key,(monthlyTotals.get(key)||0)+value);
      }
      const observedMonths=monthDistance(first,last);
      const averageAcrossSpan=group.total/observedMonths;
      const cadenceMonthly=cadence
        ? median([...monthlyTotals.values()])/cadence.months
        : null;
      const knownMonthly=rule?monthlyRuleAmount(rule,baseCurrency,fxRates):null;
      const monthly=knownMonthly||cadenceMonthly||averageAcrossSpan;
      return {
        ...group,
        firstDate:first,
        lastDate:last,
        observedMonths,
        activeMonths:group.months.size,
        cadence,
        recurringRule:rule,
        monthly,
        suggested:Math.ceil(monthly/10)*10,
        source:knownMonthly?'known_recurring':cadenceMonthly?'detected_cadence':'full_history',
      };
    })
    .sort((a,b)=>b.monthly-a.monthly);
}
