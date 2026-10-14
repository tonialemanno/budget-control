import { convertAmount } from './fx.js';
import { buildDebtPaymentTransactionMap } from './financial-effects.js';
import { semanticExpenseBase, semanticType } from './finance-semantics.js';

// Vehicle spending is calculated ONLY from explicitly linked, booked transactions.
// Merchant/category matches alone never silently assign somebody's payments to a vehicle.
export function vehicleSpendingSnapshot({
  vehicle, transactions=[], categories=[], debtPayments=[], fxRates=null, now=new Date(),
}={}) {
  const currency=vehicle?.currency||'EUR';
  const categoryById=new Map(categories.map(row=>[row.id,row]));
  const paymentMap=buildDebtPaymentTransactionMap(debtPayments);
  const currentMonth=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  const breakdown=new Map();
  let spent=0, thisMonth=0, cashPaid=0, fuel=0, linkedCount=0, missingFx=0;
  for(const tx of transactions){
    if(!vehicle?.id||tx.vehicle_id!==vehicle.id||tx.status!=='booked'||tx.transfer_group_id) continue;
    if(tx.exclude_from_reports||tx.analytics_excluded||tx.semantic_type==='ignored') continue;
    const date=new Date(tx.occurred_at);
    if(!Number.isFinite(date.getTime())||date>now) continue;
    const type=semanticType(tx,{categories});
    const refund=Number(tx.amount)>0&&type==='refund';
    if(Number(tx.amount)>=0&&!refund) continue;
    if(tx.cashflow_type==='receivable_principal') continue;
    linkedCount+=1;
    const fx=convertAmount(1,tx.currency||currency,currency,fxRates);
    if(fx===null){missingFx+=1;continue;}
    const amount=refund
      ? -Math.max(0,convertAmount(tx.amount,tx.currency||currency,currency,fxRates)||0)
      : semanticExpenseBase(tx,{categories,debtPayments:paymentMap,baseCurrency:currency,fxRates});
    // Cash paid is distinct from running expenses: vehicle purchase and debt principal
    // affect cash but are not treated as operating consumption.
    cashPaid+=-Number(tx.amount)*fx;
    spent+=amount;
    const key=`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`;
    if(key===currentMonth) thisMonth+=amount;
    const category=categoryById.get(tx.category_id)||tx.categories||null;
    const label=tx.cashflow_type==='debt_payment'?'Finanzierungskosten':category?.name||'Sonstige Fahrzeugkosten';
    if(amount!==0) breakdown.set(label,(breakdown.get(label)||0)+amount);
    if(/^(tanken|laden \/ strom)$/i.test(label)) fuel+=amount;
  }
  return {
    currency, spent, thisMonth, cashPaid, fuel, linkedCount, missingFx,
    categories:[...breakdown].filter(([,value])=>Math.abs(value)>0.005)
      .sort((a,b)=>Math.abs(b[1])-Math.abs(a[1])).map(([name,amount])=>({name,amount})),
  };
}
