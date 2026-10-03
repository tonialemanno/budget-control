function preferences(profile) {
  const value=profile?.preferences;
  return value && typeof value==='object' && !Array.isArray(value) ? value : {};
}

export function setupReviewed(profile) {
  const value=preferences(profile).setup_reviewed;
  return Array.isArray(value) ? value.filter((key)=>typeof key==='string') : [];
}

function finite(value) {
  return Number.isFinite(Number(value));
}

export function buildSetupStatus({
  accounts=[],
  categories=[],
  merchants=[],
  categorizationRules=[],
  recurringRules=[],
  budgets=[],
  goals=[],
  debts=[],
  receivables=[],
  taxCases=[],
  household=null,
  profile=null,
}={}) {
  const reviewed=new Set(setupReviewed(profile));
  const parents=categories.filter((row)=>!row.parent_id);
  const children=categories.filter((row)=>row.parent_id);
  const linkedMerchants=merchants.filter((row)=>row.default_category_id);
  const recurringIncome=recurringRules.filter((row)=>row.active!==false&&row.direction==='income');
  const recurringExpenses=recurringRules.filter((row)=>row.active!==false&&row.direction==='expense');

  const states={
    basis:Boolean(household?.country_code&&household?.base_currency&&profile?.locale),
    accounts:accounts.length>0,
    balances:accounts.length>0&&accounts.every((row)=>row.balance_anchor_at&&finite(row.balance_anchor_amount)),
    categories:parents.length>=5,
    subcategories:children.length>=3,
    automation:linkedMerchants.length>=3||categorizationRules.length>0,
    recurring:(recurringIncome.length>0&&recurringExpenses.length>0)||reviewed.has('recurring'),
    modules:(budgets.length+goals.length+debts.length+receivables.length+taxCases.length)>0||reviewed.has('modules'),
  };

  const requiredKeys=['basis','accounts','balances','categories','subcategories','automation'];
  const allKeys=[...requiredKeys,'recurring','modules'];
  const requiredDone=requiredKeys.filter((key)=>states[key]).length;
  const preparationDone=allKeys.filter((key)=>states[key]).length;
  const ready=requiredDone===requiredKeys.length&&states.recurring&&states.modules;
  const completed=Boolean(profile?.onboarding_completed_at);

  return {
    states,
    reviewed:[...reviewed],
    requiredKeys,
    allKeys,
    requiredDone,
    preparationDone,
    ready,
    completed,
    parents:parents.length,
    children:children.length,
    linkedMerchants:linkedMerchants.length,
    recurringIncome:recurringIncome.length,
    recurringExpenses:recurringExpenses.length,
    firstOpen:allKeys.find((key)=>!states[key])||'finish',
  };
}
