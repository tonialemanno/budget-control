import { convertAmount } from './fx.js';
import { semanticType } from './finance-semantics.js';
import { buildDebtPaymentTransactionMap } from './financial-effects.js';

const NO_EXPENSE=new Set(['ignored','internal_transfer','saving','debt_repayment','receivable_principal','asset_acquisition','neutral']);
const INCOME=new Set(['earned_income','other_income']);

/** Same semantic inclusion as the finance insights, but retain IDs when an FX rate is unavailable. */
export function dashboardPeriodEvidence({
  transactions=[],debtPayments=[],categories=[],recurringRules=[],baseCurrency='CHF',fxRates=null,
  start,endExclusive,now=new Date(),
}={}){
  const paymentMap=buildDebtPaymentTransactionMap(debtPayments);
  const incomeIds=[],expenseIds=[];
  let incomeComplete=true,expenseComplete=true;
  for(const tx of transactions){
    const date=new Date(tx.occurred_at);
    if(tx.status!=='booked'||tx.transfer_group_id||Number.isNaN(date.getTime())||date>now) continue;
    if(start&&date<start)continue;
    if(endExclusive&&date>=endExclusive)continue;
    const type=semanticType(tx,{categories,recurringRules});
    const amount=Number(tx.amount||0);
    if(amount>0&&INCOME.has(type)){
      incomeIds.push(tx.id);
      if(convertAmount(amount,tx.currency||baseCurrency,baseCurrency,fxRates)===null)incomeComplete=false;
    }else if(amount<0&&!NO_EXPENSE.has(type)){
      const payment=type==='debt_payment'?paymentMap.get(tx.id):null;
      const cost=type==='debt_payment'?Number(payment?.interest_amount||0)+Number(payment?.fee_amount||0):Math.abs(amount);
      if(cost<=0)continue;
      expenseIds.push(tx.id);
      if(convertAmount(cost,payment?.currency||tx.currency||baseCurrency,baseCurrency,fxRates)===null)expenseComplete=false;
    }
  }
  return {
    incomeIds,expenseIds,allIds:[...new Set([...incomeIds,...expenseIds])],
    incomeComplete,expenseComplete,complete:incomeComplete&&expenseComplete,
  };
}

/** FX checks for future monthly commitments must not silently treat missing rates as zero. */
export function recurringPlanComplete({recurringRules=[],baseCurrency='CHF',fxRates=null,now=new Date()}={}){
  const today=now.toISOString().slice(0,10);
  return recurringRules
    .filter(row=>row.active!==false&&(!row.end_date||String(row.end_date).slice(0,10)>=today))
    .every(row=>convertAmount(Number(row.amount||0),row.currency||baseCurrency,baseCurrency,fxRates)!==null);
}
