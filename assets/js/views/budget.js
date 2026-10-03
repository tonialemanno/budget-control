import { dataTable, formShell, metricCard, pageHeader, deleteButton } from '../app/components.js';
import { cadenceMonthlyFactor, escapeHtml, localMonthKey, money, monthInputValue, monthLabel, progress } from '../app/format.js';
import { convertAmount } from '../app/fx.js';
import { icon } from '../app/icons.js';
import { buildDebtPaymentTransactionMap, consumptionExpenseBase } from '../app/financial-effects.js';
import { buildFinanceSnapshot, budgetCoversTransaction, isFixedBudget, matchesRecurringExpense } from '../app/finance-model.js';
import { effectiveBudgetSet } from '../app/finance-insights.js';
import { financeCycleLabel, inFinanceCycle, resolveFinanceCycle } from '../app/finance-cycle.js';

function roundBudget(value) { return Math.max(10, Math.ceil(Number(value||0)/10)*10); }

function normalized(value) {
  return String(value||'').toLowerCase().replace(/[^a-z0-9äöüà-ÿ]+/gi,' ').trim().replace(/\s+/g,' ');
}

function matchingFixedRule(merchant, recurringRules) {
  const merchantName=normalized(merchant?.name);
  if(!merchantName) return null;
  return recurringRules.find((rule)=>{
    if(rule.active===false || rule.direction!=='expense') return false;
    if(rule.merchant_id && merchant?.id && rule.merchant_id===merchant.id) return true;
    const description=normalized(rule.description);
    const counterparty=normalized(rule.counterparty);
    if(counterparty && (merchantName.includes(counterparty) || counterparty.includes(merchantName))) return true;
    if(description && description.length>=5 && (merchantName.includes(description) || description.includes(merchantName))) return true;
    return false;
  }) || null;
}

function previousFullMonths(count=3, now=new Date()) {
  const result=[];
  for(let back=1;back<=count;back+=1){
    const date=new Date(now.getFullYear(),now.getMonth()-back,1,12);
    result.push(`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`);
  }
  return result;
}

export function renderBudget({ budgets = [], categories = [], merchants = [], transactions = [], debtPayments = [], bills = [], accounts = [], recurringRules = [], household, profile, fxRates, canWrite=false, budgetExpandedMerchantId=null } = {}) {
  const currency = household?.base_currency || 'CHF';
  const locale = profile?.locale || 'de-CH';
  const now=new Date();
  const today=now.toISOString().slice(0,10);
  const financeCycle=resolveFinanceCycle({transactions,recurringRules,now,fallbackDay:25});
  const financePeriodLabel=financeCycleLabel(financeCycle,locale);
  const currentMonth=financeCycle.budgetMonth;
  const monthStart=currentMonth+'-01';
  const expenseCategories = categories.filter((c)=>c.kind==='expense');
  const effectiveBudgets=effectiveBudgetSet(budgets,currentMonth);
  const monthBudgets=effectiveBudgets.rows;
  const activeRecurring=recurringRules.filter((rule)=>rule.active!==false && (!rule.end_date || String(rule.end_date).slice(0,10)>=today));
  const variableBudgets=monthBudgets.filter((budget)=>!isFixedBudget(budget,activeRecurring));
  const paymentMap=buildDebtPaymentTransactionMap(debtPayments);

  const monthTx = transactions.filter((tx)=>{
    const date=new Date(tx.occurred_at);
    return inFinanceCycle(tx,financeCycle)
      && Number(tx.amount)<0
      && !tx.transfer_group_id
      && tx.status==='booked'
      && !Number.isNaN(date.getTime())
      && date<=now
      && consumptionExpenseBase(tx,paymentMap,currency,fxRates)>0;
  });
  const variableMonthTx=monthTx.filter((tx)=>!matchesRecurringExpense(tx,activeRecurring));
  const variableSpent=variableMonthTx.reduce((sum,tx)=>sum+consumptionExpenseBase(tx,paymentMap,currency,fxRates),0);
  const budgetedTx=variableMonthTx.filter((tx)=>budgetCoversTransaction(tx,variableBudgets));
  const budgetedSpent=budgetedTx.reduce((sum,tx)=>sum+consumptionExpenseBase(tx,paymentMap,currency,fxRates),0);
  const outsideBudget=Math.max(0,variableSpent-budgetedSpent);
  const totalBudget = variableBudgets.reduce((s,b)=>s+Number(b.amount),0);
  const left = totalBudget-budgetedSpent;

  const recurringMonthly=activeRecurring
    .filter((r)=>r.direction==='expense')
    .reduce((s,r)=>s+(convertAmount(Number(r.amount)*cadenceMonthlyFactor(r.cadence),r.currency||currency,currency,fxRates)??0),0);

  const snapshot=buildFinanceSnapshot({
    accounts, transactions, debtPayments, recurringRules, budgets, household, fxRates, now,
  });

  const fields = `
    <label class="field"><span>Monat</span><input class="text-control" name="month" type="month" value="${currentMonth}" required></label>
    <label class="field"><span>Budget für</span><select class="text-control" name="scopeType" id="budgetScopeType"><option value="category">Kategorie</option><option value="merchant">Händler</option></select></label>
    <label class="field" id="budgetCategoryField"><span>Kategorie</span><select class="text-control" name="categoryId">${expenseCategories.map((c)=>`<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('')}</select></label>
    <label class="field" id="budgetMerchantField" hidden><span>Händler</span><select class="text-control" name="merchantId"><option value="">Bitte wählen</option>${merchants.map((m)=>`<option value="${m.id}">${escapeHtml(m.name)}</option>`).join('')}</select></label>
    <label class="field"><span>Budgetbetrag</span><input class="text-control" name="amount" type="number" min="0" step="0.01" required></label>`;

  const rows = monthBudgets.map((b)=>{
    const fixed=isFixedBudget(b,activeRecurring);
    const targetTx=b.merchant_id?monthTx.filter((t)=>t.merchant_id===b.merchant_id):monthTx.filter((t)=>t.category_id===b.category_id);
    const spent=targetTx.reduce((s,t)=>s+consumptionExpenseBase(t,paymentMap,currency,fxRates),0);
    const pct=progress(spent,b.amount);
    const label=b.merchants?.name||b.categories?.name||'Budget';
    const baseType=fixed?'Fixkosten · nicht im variablen Budget':b.merchant_id?'Händler':'Kategorie';
    const type=b._inherited ? baseType+' · Vorlage aus '+monthLabel(effectiveBudgets.sourceMonth+'-01',locale) : baseType;
    return `<tr><td><strong>${escapeHtml(label)}</strong><div class="table-meta">${escapeHtml(type)}</div></td><td>${money(b.amount,{currency,locale})}</td><td>${money(spent,{currency,locale})}</td><td><div class="progress-track table-progress"><div class="progress-fill ${pct>=100?'progress-fill--red':pct>=80?'progress-fill--orange':''}" style="--progress:${pct}%"></div></div><div class="table-meta">${pct.toFixed(0)} %</div></td><td>${canWrite&&!b._inherited?deleteButton('budgets',b.id):''}</td></tr>`;
  });

  const historyMonths=previousFullMonths(3,now);
  const historySet=new Set(historyMonths);
  const recent=transactions.filter((tx)=>{
    const date=new Date(tx.occurred_at);
    return historySet.has(localMonthKey(tx.occurred_at))
      && tx.status==='booked'
      && Number(tx.amount)<0
      && !tx.transfer_group_id
      && tx.merchant_id
      && !Number.isNaN(date.getTime())
      && date<=now
      && consumptionExpenseBase(tx,paymentMap,currency,fxRates)>0;
  });

  const byMerchant=new Map();
  for(const tx of recent){
    const merchant=merchants.find((m)=>m.id===tx.merchant_id);
    const row=byMerchant.get(tx.merchant_id)||{count:0,total:0,merchant,months:new Set(),rows:[]};
    row.count+=1;
    row.total+=consumptionExpenseBase(tx,paymentMap,currency,fxRates);
    row.months.add(localMonthKey(tx.occurred_at));
    row.rows.push(tx);
    byMerchant.set(tx.merchant_id,row);
  }

  const existingMerchantBudgets=new Set(monthBudgets.filter((b)=>b.merchant_id).map((b)=>b.merchant_id));
  const suggestions=[...byMerchant.entries()]
    .filter(([id,value])=>value.count>=2 && value.total>=50 && !existingMerchantBudgets.has(id))
    .map(([id,value])=>{
      const monthly=value.total/historyMonths.length;
      const fixedRule=matchingFixedRule(value.merchant,activeRecurring);
      return {
        id,
        name:value.merchant?.name||'Händler',
        count:value.count,
        activeMonths:value.months.size,
        total:value.total,
        monthly,
        suggested:roundBudget(monthly),
        fixedRule,
        rows:value.rows.slice().sort((a,b)=>String(b.occurred_at).localeCompare(String(a.occurred_at))),
      };
    })
    .sort((a,b)=>b.monthly-a.monthly)
    .slice(0,6);

  return `
    ${pageHeader({title:'Budget',subtitle:`Finanzmonat ${financePeriodLabel}. Der Zyklus startet mit der letzten relevanten Einnahme rund um den 25.; ohne passende Einnahme gilt der 25. als Start. Fixkosten bleiben separat.`,actions:canWrite?`<button class="action-button action-button--primary" type="button" data-action="show-form" data-target="budget-create" ${(expenseCategories.length||merchants.length)?'':'disabled'}>${icon('plus')} Budget</button>`:''})}
    ${formShell('budget-create','Budget festlegen','Kategorie oder einzelnen Händler budgetieren',fields,{hidden:true,submitLabel:'Budget speichern'})}
    <div class="metric-grid" style="margin-bottom:16px">
      ${metricCard('Variables Budget',money(totalBudget,{currency,locale}),financePeriodLabel)}
      ${metricCard('Davon verbraucht',money(budgetedSpent,{currency,locale}),'nur Ausgaben innerhalb deiner Budgets')}
      ${metricCard('Noch verfügbar',money(left,{currency,locale}),left>=0?'im variablen Budget':'variables Budget überschritten',left>=0?'positive':'warning')}
      ${metricCard('Ausserhalb Budget',money(outsideBudget,{currency,locale}),'variable Ausgaben ohne passendes Budget',outsideBudget>0?'warning':'positive')}
      ${metricCard('Fixkosten / Monat',money(recurringMonthly,{currency,locale}),'separat aus Fixkosten / Wiederkehrend')}
      ${metricCard('Fixe Umbuchungen / Monat',money(snapshot.fixedTransfersMonthly,{currency,locale}),'Sparen, Sondertopf, Überschuss usw.')}
    </div>
    ${suggestions.length?`<article class="card card-padding" style="margin-bottom:16px"><div class="card-heading"><div><h3 class="card-title">Ausgabenmuster & Budgetvorschläge</h3><p class="card-subtitle">Letzte 3 vollständige Monate. Jeder Wert ist aufklappbar und zeigt die zugrunde liegenden Buchungen.</p></div></div><div class="suggestion-grid">${suggestions.map((s)=>{
      const fixedMonthly=s.fixedRule ? (convertAmount(Number(s.fixedRule.amount)*cadenceMonthlyFactor(s.fixedRule.cadence),s.fixedRule.currency||currency,currency,fxRates)??0) : null;
      const expanded=budgetExpandedMerchantId===s.id;
      const details=expanded?`<div class="budget-pattern-details">
        <div class="inline-alert"><strong>Berechnung</strong><span>${money(s.total,{currency,locale})} in 3 vollständigen Monaten ÷ 3 = ${money(s.monthly,{currency,locale})} pro Monat.${s.fixedRule?` Bekannte Fixkosten: ${money(fixedMonthly,{currency,locale})} / Monat.`:''}</span></div>
        <div class="table-scroll budget-pattern-scroll"><table class="data-table"><thead><tr><th>Datum</th><th>Buchung</th><th>Kategorie</th><th>Konto</th><th>Betrag</th><th></th></tr></thead><tbody>${s.rows.map((tx)=>{const linkedBill=bills.find((bill)=>bill.status==='paid'&&bill.paid_transaction_id===tx.id);return `<tr><td>${escapeHtml(new Intl.DateTimeFormat(locale,{day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(tx.occurred_at)))}</td><td><strong>${escapeHtml(tx.description||s.name)}</strong><div class="table-meta">${escapeHtml(tx.counterparty||'')}</div></td><td>${escapeHtml(tx.categories?.name||'Ohne Kategorie')}</td><td>${escapeHtml(tx.accounts?.name||'—')}</td><td>${money(Math.abs(Number(tx.amount)),{currency:tx.currency||currency,locale})}</td><td>${canWrite?(linkedBill?`<a class="table-action" href="#/bills">Rechnung anzeigen</a>`:`<button class="table-action" type="button" data-action="budget-transaction-edit" data-id="${tx.id}">Bearbeiten</button>`):''}</td></tr>`;}).join('')}</tbody></table></div>
      </div>`:'';
      return `<div class="suggestion-card budget-pattern-card"><div class="budget-pattern-head"><div><strong>${escapeHtml(s.name)}</strong><span>${s.count} Buchungen · ${money(s.total,{currency,locale})} gesamt · Ø ${money(s.monthly,{currency,locale})}/Monat</span><small>${s.fixedRule?`Als Fixkosten erkannt: ${escapeHtml(s.fixedRule.description)} · ${money(fixedMonthly,{currency,locale})}/Monat`:`Budgetvorschlag: ${money(s.suggested,{currency,locale})}`}</small></div><div class="row-actions"><button class="table-action" type="button" data-action="budget-suggestion-toggle" data-merchant-id="${s.id}">${expanded?'Buchungen schliessen':'Buchungen anzeigen'}</button>${canWrite&&!s.fixedRule?`<button class="table-action" type="button" data-action="budget-suggestion" data-merchant-id="${s.id}" data-amount="${s.suggested}">Budget übernehmen</button>`:''}${s.fixedRule?`<a class="table-action" href="#/fixed-costs">Fixkosten öffnen</a>`:''}</div></div>${details}</div>`;
    }).join('')}</div></article>`:''}
    <article class="card card-padding">${dataTable({headers:['Budget','Soll','Ist','Nutzung',''],rows,emptyText:'Für diesen Finanzmonat ist noch kein variables Budget angelegt.'})}</article>`;
}
