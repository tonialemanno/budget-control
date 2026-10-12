import {
  accountShare,
  annualIncomeBreakdown,
  budgetSummary,
  categorySpending,
  currentFinanceCycleTotals,
  financeCycleSeries,
} from './finance-insights.js';
import { financeMonthMode } from './user-preferences.js';

function finite(value){
  const n=Number(value);
  return Number.isFinite(n)?n:0;
}

function budgetLabel(row,categories,merchants){
  const merchant=merchants.find((item)=>item.id===row.merchant_id);
  if(merchant?.name) return merchant.name;
  const category=categories.find((item)=>item.id===row.category_id);
  return category?.name||row.categories?.name||'Budget';
}

function categoryIdsForBudget(row,categories){
  if(!row.category_id) return [];
  const ids=new Set([row.category_id]);
  for(const category of categories){
    if(category.parent_id===row.category_id) ids.add(category.id);
  }
  return [...ids];
}

export function buildStatisticsModel({
  accounts=[],
  transactions=[],
  debtPayments=[],
  recurringRules=[],
  budgets=[],
  categories=[],
  merchants=[],
  household=null,
  profile=null,
  fxRates=null,
  now=new Date(),
  cycles=12,
  categoryLimit=8,
}={}){
  const currency=household?.base_currency||'CHF';
  const monthMode=financeMonthMode(profile);
  const current=currentFinanceCycleTotals({
    transactions,debtPayments,recurringRules,categories,
    baseCurrency:currency,fxRates,now,fallbackDay:25,financeMonthMode:monthMode,
  });
  const series=financeCycleSeries({
    transactions,debtPayments,recurringRules,categories,
    baseCurrency:currency,fxRates,now,cycles,fallbackDay:25,financeMonthMode:monthMode,
  });
  const categoriesSpent=categorySpending({
    transactions,debtPayments,categories,recurringRules,
    baseCurrency:currency,fxRates,now,limit:categoryLimit,includeOther:true,
    rangeStart:current.cycle.start,rangeEnd:current.cycle.endExclusive,
  });
  const categoryTotal=categoriesSpent[0]?.total||0;
  const annualIncome=annualIncomeBreakdown({
    transactions,categories,recurringRules,baseCurrency:currency,fxRates,
    year:now.getFullYear(),limit:8,
  });
  const budget=budgetSummary({
    budgets,transactions,debtPayments,categories,merchants,recurringRules,accounts,
    baseCurrency:currency,fxRates,now,fallbackDay:25,financeMonthMode:monthMode,
  });
  const budgetRows=(budget.variableRows||[])
    .map((row)=>{
      const amount=Math.max(0,finite(row.amount));
      const spent=Math.max(0,finite(row.spent));
      const rawPercent=amount>0?spent/amount*100:0;
      return {
        id:row.id,
        label:budgetLabel(row,categories,merchants),
        amount,
        spent,
        remaining:Math.max(0,amount-spent),
        overBy:Math.max(0,spent-amount),
        rawPercent,
        percent:Math.max(0,Math.min(100,rawPercent)),
        transactionCount:Number(row.transactionCount||0),
        categoryIds:categoryIdsForBudget(row,categories),
        merchantId:row.merchant_id||null,
      };
    })
    .sort((a,b)=>b.rawPercent-a.rawPercent||b.spent-a.spent);

  return {
    currency,
    monthMode,
    current,
    series,
    categories:categoriesSpent,
    categoryTotal,
    annualIncome,
    budget,
    budgetRows,
    accounts:accountShare(accounts,currency,fxRates),
  };
}
