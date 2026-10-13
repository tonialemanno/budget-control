import { pageHeader } from '../app/components.js';
import { escapeHtml, money } from '../app/format.js';
import { t } from '../app/i18n.js';
import { renderCashflowChart, renderExpenseDonut, renderIncomePlan } from '../app/charts.js';
import { buildStatisticsModel } from '../app/statistics-model.js';
import { buildFinanceSnapshot } from '../app/finance-model.js';
import { financeCycleLabel } from '../app/finance-cycle.js';
import { financeMonthMode } from '../app/user-preferences.js';
import { convertAmount } from '../app/fx.js';

const PANELS=Object.freeze([
  {key:'cockpit',title:'Cockpit'},
  {key:'cashflow',title:'Geldfluss'},
  {key:'expenses',title:'Ausgaben'},
  {key:'budget',title:'Budget'},
  {key:'wealth',title:'Vermögen'},
  {key:'goals',title:'Ziele & Planung'},
]);

function safeMoney(value,{currency,locale,privacyEnabled}){
  if(value===null||value===undefined||!Number.isFinite(Number(value))) return escapeHtml(t('Nicht berechenbar',locale));
  return privacyEnabled?'•••':money(value,{currency,locale});
}
function shortKey(value){
  const d=value instanceof Date?value:new Date(value);
  if(Number.isNaN(d.getTime()))return '';
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function bounds(cycle){
  const end=new Date(cycle.endExclusive);
  end.setDate(end.getDate()-1);
  return {from:shortKey(cycle.start),to:shortKey(end)};
}
function txButton(label,value,range,direction,opts){
  const {locale,currency,privacyEnabled}=opts;
  return `<button class="dash-kpi" type="button" data-drilldown="transactions-range" data-from="${range.from}" data-to="${range.to}" data-direction="${direction}">
    <span>${escapeHtml(t(label,locale))}</span>
    <strong>${safeMoney(value,{locale,currency,privacyEnabled})}</strong>
    <small>${escapeHtml(t('Buchungen öffnen',locale))} →</small>
  </button>`;
}
function card(title,body,footer='',locale='de-CH'){
  return `<article class="card card-padding dash-panel">
    <header class="dash-panel-head"><h3>${escapeHtml(t(title,locale))}</h3>${footer}</header>
    ${body}
  </article>`;
}
function tabnav(active,locale){
  return `<nav class="dash-tabs" aria-label="${escapeHtml(t('Dashboards',locale))}">
    ${PANELS.map((panel)=>`<a href="/dashboards?view=${panel.key}" class="dash-tab ${panel.key===active?'is-active':''}" ${panel.key===active?'aria-current="page"':''}>${escapeHtml(t(panel.title,locale))}</a>`).join('')}
  </nav>`;
}
function rangeRows(rows,opts){
  const {currency,locale,privacyEnabled}=opts;
  const available=rows.filter((row)=>row.coverage==='full');
  if(!available.length)return `<p class="dash-empty">${escapeHtml(t('Keine vollständigen Finanzmonate vorhanden.',locale))}</p>`;
  return `<div class="dash-history">
    ${available.slice().reverse().map((row)=>{
      const range=bounds({start:row.start,endExclusive:row.endExclusive});
      return `<div class="dash-history-row">
        <span>${escapeHtml(financeCycleLabel({start:row.start,endExclusive:row.endExclusive},locale))}</span>
        <button type="button" data-drilldown="transactions-range" data-from="${range.from}" data-to="${range.to}" data-direction="income">${safeMoney(row.income,opts)}</button>
        <button type="button" data-drilldown="transactions-range" data-from="${range.from}" data-to="${range.to}" data-direction="expense">${safeMoney(row.expenses,opts)}</button>
        <button type="button" data-drilldown="transactions-range" data-from="${range.from}" data-to="${range.to}" data-direction="all" class="${row.net<0?'negative':'positive'}">${safeMoney(row.net,opts)}</button>
      </div>`;
    }).join('')}
  </div>`;
}
function categoriesRows(model,range,opts){
  const {locale,currency,privacyEnabled}=opts;
  if(!model.categories?.length)return `<p class="dash-empty">${escapeHtml(t('Keine Ausgaben in diesem Finanzmonat.',locale))}</p>`;
  return `<div class="dash-ranking">
    ${model.categories.map((row,i)=>`<button type="button" class="dash-rank" data-action="overview-drilldown-expense"
      data-key="${escapeHtml(row.key)}" data-category-ids="${escapeHtml((row.categoryIds||[]).join(','))}"
      data-transaction-ids="${escapeHtml((row.transactionIds||[]).join(','))}"
      data-from="${range.from}" data-to="${range.to}">
      <span class="dash-rank-index">${String(i+1).padStart(2,'0')}</span>
      <span class="dash-rank-name"><strong>${escapeHtml(row.label)}</strong><span class="dash-track"><span style="width:${Math.min(100,Math.max(0,Number(row.share||0)))}%"></span></span></span>
      <span class="dash-rank-amount">${safeMoney(row.value,opts)}<small>${Math.round(row.share||0)} %</small></span>
    </button>`).join('')}
  </div>`;
}
function budgetRows(model,range,opts){
  const {locale}=opts;
  if(!model.budgetRows.length)return `<p class="dash-empty">${escapeHtml(t('Noch keine variablen Budgetrahmen vorhanden.',locale))} <a href="/planning/budget">${escapeHtml(t('Budget öffnen',locale))} →</a></p>`;
  return `<div class="dash-ranking">
    ${model.budgetRows.map((row)=>`<button type="button" class="dash-budget" data-action="statistics-drilldown-budget"
       data-merchant-id="${escapeHtml(row.merchantId||'')}"
       data-category-ids="${escapeHtml((row.categoryIds||[]).join(','))}"
       data-transaction-ids="${escapeHtml((row.transactionIds||[]).join(','))}"
       data-from="${range.from}" data-to="${range.to}">
      <span class="dash-budget-top"><strong>${escapeHtml(row.label)}</strong><span>${safeMoney(row.spent,opts)} / ${safeMoney(row.amount,opts)}</span></span>
      <span class="dash-track"><span class="${row.overBy>0?'is-over':''}" style="width:${row.amount===null?0:Math.min(100,Math.max(0,row.percent))}%"></span></span>
      <span class="dash-budget-foot"><small>${row.amount===null?escapeHtml(t('FX-Kurs fehlt',locale)):row.overBy>0?escapeHtml(t('Über Budget',locale)):escapeHtml(t('Noch verfügbar',locale))}</small><strong>${safeMoney(row.amount===null?null:row.overBy>0?row.overBy:row.remaining,opts)}</strong></span>
    </button>`).join('')}
  </div>`;
}
function incomeRows(model,opts){
  const {locale}=opts;
  if(!model.annualIncome.sources?.length)return `<p class="dash-empty">${escapeHtml(t('Noch keine klassifizierten Einnahmen.',locale))}</p>`;
  const rows=model.annualIncome.sources;
  const max=Math.max(1,...rows.map(r=>r.value||0));
  return `<div class="dash-ranking">
    ${rows.map((row)=>`<button type="button" class="dash-rank" data-action="overview-drilldown-income"
      data-source="${escapeHtml(row.label)}" data-sources="${escapeHtml((row.sourceNames||[row.label]).join('||'))}"
      data-transaction-ids="${escapeHtml((row.transactionIds||[]).join(','))}">
      <span class="dash-rank-name"><strong>${escapeHtml(row.label)}</strong><span class="dash-track"><span style="width:${Math.round(Math.max(0,row.value||0)/max*100)}%"></span></span></span>
      <span class="dash-rank-amount">${safeMoney(row.value,opts)}</span>
    </button>`).join('')}
  </div>`;
}
function accountRows(model,opts){
  const {locale,privacyEnabled}=opts;
  if(!model.accounts.length)return `<p class="dash-empty">${escapeHtml(t('Noch keine liquiden Konten vorhanden.',locale))}</p>`;
  return `<div class="dash-ranking">${model.accounts.map((row)=>`<button type="button" class="dash-account" data-drilldown="account-edit" data-id="${escapeHtml(row.account.account_id||row.account.id)}">
    <span><strong>${escapeHtml(row.account.name)}</strong><small>${escapeHtml(row.account.currency)} · ${row.share===null?escapeHtml(t('Anteil nicht berechenbar',locale)) : `${Math.round(row.share)} %`}</small></span>
    <strong>${privacyEnabled?'•••':money(row.account.current_balance,{currency:row.account.currency,locale})}</strong>
  </button>`).join('')}</div>`;
}
function goalsRows(goals,opts){
  const {locale,privacyEnabled}=opts;
  const rows=(goals||[]).filter(g=>g.status==='active');
  if(!rows.length)return `<p class="dash-empty">${escapeHtml(t('Noch keine Sparziele vorhanden.',locale))} <a href="/planning/goals">${escapeHtml(t('Sparziele öffnen',locale))} →</a></p>`;
  return `<div class="dash-goals">${rows.map(goal=>{
    const target=Math.max(0,Number(goal.target_amount)||0);
    const balance=Math.max(0,Number(goal.current_amount)||0);
    const monthly=Math.max(0,Number(goal.monthly_amount)||0);
    const progress=target>0?Math.min(100,balance/target*100):0;
    const cash=(amount)=>safeMoney(amount,{currency:goal.currency||opts.currency,locale,privacyEnabled});
    return `<a class="dash-goal" href="/planning/goals">
      <span class="dash-goal-top"><strong>${escapeHtml(goal.name)}</strong><b>${Math.round(progress)} %</b></span>
      <span class="dash-track"><span style="width:${progress}%"></span></span>
      <span class="dash-goal-stats"><span>${escapeHtml(t('Bisher gespart',locale))}<strong>${cash(balance)}</strong></span><span>${escapeHtml(t('Zielbetrag',locale))}<strong>${cash(target)}</strong></span><span>${escapeHtml(t('Monatlicher Plan',locale))}<strong>${cash(monthly)}</strong></span></span>
    </a>`;
  }).join('')}</div>`;
}
function fxComplete(rows,currency,fxRates,field){
  return rows.every(row=>convertAmount(row[field],row.currency||currency,currency,fxRates)!==null);
}

export function renderDashboards({
  dashboardView,accounts=[],transactions=[],debtPayments=[],recurringRules=[],budgets=[],categories=[],merchants=[],
  goals=[],bills=[],debts=[],receivables=[],assets=[],properties=[],vehicles=[],investments=[],pensions=[],
  household,profile,fxRates,privacyEnabled=false,
}={}){
  const locale=profile?.locale||'de-CH';
  const currency=household?.base_currency||'CHF';
  const requested=dashboardView||new URLSearchParams(globalThis.location?.search||'').get('view')||'cockpit';
  const panel=PANELS.find(row=>row.key===requested)?.key||'cockpit';
  const now=new Date();
  const model=buildStatisticsModel({accounts,transactions,debtPayments,recurringRules,budgets,categories,merchants,
    household,profile,fxRates,now,cycles:12,categoryLimit:8});
  const snap=buildFinanceSnapshot({accounts,transactions,debtPayments,recurringRules,budgets,categories,merchants,bills,
    debts,receivables,assets,properties,vehicles,investments,pensions,household,fxRates,now,financeMonthMode:financeMonthMode(profile)});
  const opts={currency,locale,privacyEnabled};
  const current=model.current;
  const range=bounds(current.cycle);
  const period=financeCycleLabel(current.cycle,locale);
  const liquidComplete=model.accounts.every(row=>row.value!==null);
  const holdingsComplete=liquidComplete&&fxComplete(assets,currency,fxRates,'current_value')&&fxComplete(properties,currency,fxRates,'current_value')&&fxComplete(vehicles,currency,fxRates,'current_value')&&fxComplete(investments,currency,fxRates,'current_value')&&fxComplete(pensions,currency,fxRates,'current_value')&&fxComplete(debts,currency,fxRates,'outstanding_amount')&&fxComplete(receivables,currency,fxRates,'outstanding_amount');
  const liquid=liquidComplete?model.accounts.reduce((sum,row)=>sum+row.value,0):null;
  const hasMissingTransactionFx=transactions.some(tx=>{
    const date=new Date(tx.occurred_at);
    return tx.status==='booked'&&!tx.transfer_group_id&&!Number.isNaN(date.getTime())
      &&date<=now&&date>=current.cycle.start&&date<current.cycle.endExclusive
      &&convertAmount(tx.amount,tx.currency||currency,currency,fxRates)===null;
  });
  const budgetFxIncomplete=model.budgetRows.some(row=>row.amount===null)||hasMissingTransactionFx;
  const emptyHistory=model.series.every(row=>row.coverage==='none');

  const tiles=`<section class="dash-kpis" aria-label="${escapeHtml(t('Finanzkennzahlen',locale))}">
    ${txButton('Einnahmen',current.income,range,'income',opts)}
    ${txButton('Ausgaben',current.expenses,range,'expense',opts)}
    ${txButton(current.savings<0?'Defizit':'Überschuss',Math.abs(current.savings),range,'all',opts)}
    <a class="dash-kpi dash-kpi--link" href="/finance">
      <span>${escapeHtml(t('Liquide Kontostände',locale))}</span><strong>${safeMoney(liquid,opts)}</strong><small>${escapeHtml(t('Konten öffnen',locale))} →</small>
    </a>
  </section>`;

  const chart=card('Einnahmen & Ausgaben',renderCashflowChart({series:model.series,currency,locale,privacy:privacyEnabled,interactive:true}),
    `<span class="dash-period">${escapeHtml(t('Zwölf Finanzmonate',locale))}</span>`,locale);
  const donut=card('Ausgaben nach Kategorien',
    renderExpenseDonut({rows:model.categories,total:model.categoryTotal,currency,locale,privacy:privacyEnabled,
      rangeStart:current.cycle.start,rangeEnd:current.cycle.endExclusive}), '',locale);
  const notices=[
    hasMissingTransactionFx?`<p class="dash-notice">${escapeHtml(t('Ein Wechselkurs fehlt. Geldflusswerte können unvollständig sein.',locale))}</p>`:'',
    !liquidComplete?`<p class="dash-notice">${escapeHtml(t('Ein Wechselkurs fehlt. Kontosummen sind nicht berechenbar.',locale))}</p>`:'',
    emptyHistory?`<p class="dash-notice">${escapeHtml(t('Noch keine gebuchten Transaktionen vorhanden.',locale))}</p>`:'',
  ].filter(Boolean).join('');

  let body='';
  if(panel==='cockpit'){
    body=`${tiles}<div class="dash-layout dash-layout--split">${chart}${donut}</div>
      <div class="dash-layout dash-layout--split">
        ${card('Grösste Ausgabenkategorien',categoriesRows(model,range,opts),`<a href="/dashboards?view=expenses">${escapeHtml(t('Alle ansehen',locale))} →</a>`,locale)}
        ${card('Budgetfortschritt',budgetRows(model,range,opts),`<a href="/planning/budget">${escapeHtml(t('Budget öffnen',locale))} →</a>`,locale)}
      </div>`;
  }else if(panel==='cashflow'){
    body=`${tiles}${chart}
      ${card('Finanzmonate im Vergleich',rangeRows(model.series,opts),`<a href="/finance/transactions">${escapeHtml(t('Alle Buchungen',locale))} →</a>`,locale)}`;
  }else if(panel==='expenses'){
    body=`<section class="dash-kpis">${txButton('Ausgaben',current.expenses,range,'expense',opts)}
      <a class="dash-kpi dash-kpi--link" href="/selfservice/categories"><span>${escapeHtml(t('Kategorien',locale))}</span>
        <strong>${model.categories.length}</strong><small>${escapeHtml(t('Kategorien öffnen',locale))} →</small></a></section>
      <div class="dash-layout dash-layout--split">${donut}
        ${card('Grösste Ausgabenkategorien',categoriesRows(model,range,opts),'',locale)}</div>`;
  }else if(panel==='budget'){
    const b=model.budget||{};
    const budgetTotal=(b.count>0&&!budgetFxIncomplete)?b.total:null;
    const budgetRemaining=(b.count>0&&!budgetFxIncomplete)?b.remaining:null;
    const budgetDisplay=(amount)=>b.count>0?safeMoney(amount,opts):escapeHtml(t('Noch nicht eingerichtet',locale));
    body=`<section class="dash-kpis"><a class="dash-kpi dash-kpi--link" href="/planning/budget">
      <span>${escapeHtml(t('Variables Budget',locale))}</span><strong>${budgetDisplay(budgetTotal)}</strong>
      <small>${escapeHtml(t('Budget bearbeiten',locale))} →</small></a>
      <a class="dash-kpi dash-kpi--link" href="/planning/budget"><span>${escapeHtml(t('Noch verfügbar',locale))}</span>
      <strong>${budgetDisplay(budgetRemaining)}</strong><small>${escapeHtml(t('Budget öffnen',locale))} →</small></a></section>
      ${budgetFxIncomplete?`<p class="dash-notice">${escapeHtml(t('Ein Wechselkurs fehlt. Budgetwerte können unvollständig sein.',locale))}</p>`:''}
      ${card('Budgetfortschritt',budgetRows(model,range,opts),`<a href="/planning/budget">${escapeHtml(t('Budget bearbeiten',locale))} →</a>`,locale)}`;
  }else if(panel==='wealth'){
    body=`<section class="dash-kpis">
      <a class="dash-kpi dash-kpi--link" href="/finance"><span>${escapeHtml(t('Liquide Kontostände',locale))}</span><strong>${safeMoney(liquid,opts)}</strong><small>${escapeHtml(t('Konten öffnen',locale))} →</small></a>
      <a class="dash-kpi dash-kpi--link" href="/planning/wealth"><span>${escapeHtml(t('Nettovermögen',locale))}</span><strong>${safeMoney(holdingsComplete?snap.netWorth:null,opts)}</strong><small>${escapeHtml(t('Vermögen öffnen',locale))} →</small></a>
      <a class="dash-kpi dash-kpi--link" href="/finance/debts"><span>${escapeHtml(t('Restschuld gesamt',locale))}</span><strong>${safeMoney(holdingsComplete?snap.debtValue:null,opts)}</strong><small>${escapeHtml(t('Schulden öffnen',locale))} →</small></a>
    </section>
    ${!holdingsComplete?`<p class="dash-notice">${escapeHtml(t('Ein Wechselkurs fehlt. Vermögenswerte sind nicht berechenbar.',locale))}</p>`:''}
    ${card('Kontostände',accountRows(model,opts),`<a href="/finance/accounts">${escapeHtml(t('Konten öffnen',locale))} →</a>`,locale)}`;
  }else{
    body=`<section class="dash-kpis"><a class="dash-kpi dash-kpi--link" href="/planning/goals"><span>${escapeHtml(t('Sparziele',locale))}</span>
      <strong>${goals.filter(g=>g.status==='active').length}</strong><small>${escapeHtml(t('Sparziele öffnen',locale))} →</small></a>
      <a class="dash-kpi dash-kpi--link" href="/planning/fixed-costs"><span>${escapeHtml(t('Fixkosten',locale))}</span>
      <strong>${safeMoney(snap.fixedExpensesMonthly,opts)}</strong><small>${escapeHtml(t('Feste Zahlungen öffnen',locale))} →</small></a></section>
      <div class="dash-layout dash-layout--split">
      ${card('Sparziele',goalsRows(goals,opts),`<a href="/planning/goals">${escapeHtml(t('Sparziele öffnen',locale))} →</a>`,locale)}
      ${card('Monatsplan',renderIncomePlan({flow:{income:snap.incomePlanMonthly,fixed:snap.fixedExpensesMonthly,reserves:snap.fixedTransfersMonthly,variable:snap.plannedVariableMonthly},currency,locale,privacy:privacyEnabled}),
        `<a href="/planning">${escapeHtml(t('Planung öffnen',locale))} →</a>`,locale)}
      </div>`;
  }
  return `<div class="dashboard-workspace">
    ${pageHeader({kicker:'Auswertung',title:'Dashboards',subtitle:'Finanzen verstehen – von der Übersicht bis zur einzelnen Buchung.',
       actions:'<a class="action-button action-button--secondary" href="/statistics">Statistik öffnen</a>'})}
    ${tabnav(panel,locale)}
    <div class="dash-period-band"><span>${escapeHtml(t('Aktueller Finanzmonat',locale))}</span><strong>${escapeHtml(period)}</strong></div>
    ${notices}
    ${body}
  </div>`;
}

export { PANELS as DASHBOARD_PANELS };
