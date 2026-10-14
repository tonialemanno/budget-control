import { convertAmount } from './fx.js';
import { semanticType } from './finance-semantics.js';

const roundMoney=(value)=>Math.round((Number(value)||0)*100)/100;
const validMoney=(value)=>typeof value==='number'&&Number.isFinite(value);
const active=(row)=>row?.active!==false;

export function buildSavingsCompass({
  snapshot,coach,primaryAccount,accounts=[],transactions=[],recurringRules=[],
  budgets=[],bills=[],vehicles=[],categories=[],fxRates=null,now=new Date(),
}={}) {
  const currency=snapshot?.currency||'CHF';
  const daysRemaining=Math.max(1,Number(coach?.daysRemaining)||1);
  const cycle=snapshot?.financeCycle||coach?.cycle;
  const start=cycle?.start?new Date(cycle.start):null;
  const end=cycle?.endExclusive?new Date(cycle.endExclusive):null;
  const relevantTransactions=transactions.filter(row=>{
    const date=new Date(row.occurred_at);
    return row.status==='booked'&&Number.isFinite(date.getTime())
      && (!start||date>=start)&&(!end||date<end);
  });
  const relevantRules=recurringRules.filter(row=>active(row)
    &&(!row.end_date||new Date(String(row.end_date).slice(0,10)+'T23:59:59')>=now));
  const dueBills=bills.filter(row=>['open','overdue'].includes(row.status)&&Number(row.amount)>0
    &&(!end||new Date(String(row.due_date).slice(0,10)+'T12:00:00')<end));
  const sources=[
    ...accounts.filter(row=>!row.is_archived).map(row=>row.currency),
    ...relevantTransactions.map(row=>row.currency),
    ...relevantRules.map(row=>row.currency),
    ...budgets.map(row=>row.currency),
    ...dueBills.map(row=>row.currency),
  ].filter(Boolean);
  const fxComplete=sources.every(from=>convertAmount(1,from,currency,fxRates)!==null);
  const balance=primaryAccount&&validMoney(Number(primaryAccount.current_balance))
    ?convertAmount(Number(primaryAccount.current_balance),primaryAccount.currency||currency,currency,fxRates):null;
  const expensePlan=relevantRules.some(row=>(row.direction==='expense'||row.direction==='transfer')&&Number(row.amount)>0)||dueBills.length>0;
  const incomeEvidence=relevantRules.some(row=>row.direction==='income'&&Number(row.amount)>0)
    || relevantTransactions.some(row=>Number(row.amount)>0&&!row.transfer_group_id
      && ['earned_income','other_income'].includes(semanticType(row,{categories,recurringRules})));
  const inappropriateAccount=Boolean(primaryAccount&&['savings','investment','pension'].includes(primaryAccount.account_type));
  const hasBudget=Boolean(coach?.budget?.count>0 && Number(coach?.budget?.total)>0);
  let reason=null;
  if(!primaryAccount||!validMoney(Number(primaryAccount.current_balance))||inappropriateAccount) reason='account';
  else if(!fxComplete||balance===null)reason='fx';
  else if(!expensePlan)reason='fixed';
  else if(!incomeEvidence)reason='income';
  else if(!hasBudget)reason='budget';

  const commitments=Math.max(0,Number(coach?.protectedUntilCycleEnd)||0);
  const uncommitted=roundMoney(Number(balance||0)-commitments);
  const cushion=roundMoney(Math.max(0,uncommitted)*0.10);
  const budgetRemaining=Math.max(0,Number(coach?.budget?.remaining)||0);
  const spendable=roundMoney(Math.max(0,Math.min(budgetRemaining,uncommitted-cushion)));
  const recommendedSpend=roundMoney(spendable*0.80);
  const extraByReducing=roundMoney(spendable-recommendedSpend);
  const remainingAfterPlan=roundMoney(Math.max(0,uncommitted-cushion-recommendedSpend));
  const daily=roundMoney(spendable/daysRemaining);
  const overdue=dueBills.some(row=>row.status==='overdue');
  const hasUnbudgeted=Number(snapshot?.unbudgetedActualVariableExpensesMonth||0)>0;

  const tips=[];
  const risk=coach?.insights?.find(row=>row.type==='budget_risk');
  if(risk)tips.push({type:'budget_risk',label:risk.label,href:'/planning/budget'});
  const spike=coach?.insights?.find(row=>row.type==='spending_spike');
  if(spike)tips.push({type:'spending_spike',label:spike.label,href:'/finance/transactions'});
  if(coach?.subscriptions?.count>=2 && validMoney(Number(coach.subscriptions.monthly)))
    tips.push({type:'subscriptions',count:coach.subscriptions.count,
      amount:Number(coach.subscriptions.monthly),href:'/planning/fixed-costs'});
  if(vehicles.length)tips.push({type:'vehicle',href:'/planning/vehicles'});
  if(hasUnbudgeted)tips.push({type:'unbudgeted',href:'/planning/budget'});
  if(!tips.length)tips.push({type:'everyday',href:'/planning/budget'});
  return {
    ready:!reason,reason,currency,balance,cycle,daysRemaining,
    commitments,uncommitted,cushion,budgetRemaining,
    spendable,recommendedSpend,extraByReducing,remainingAfterPlan,daily,
    overdue,hasUnbudgeted,tips:tips.slice(0,3),
    assumption:'10% safety cushion, 20% below the remaining flexible allowance; no future income credited.',
  };
}
