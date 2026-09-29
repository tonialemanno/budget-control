import { dataTable, formShell, metricCard, pageHeader, deleteButton } from '../app/components.js';
import { cadenceMonthlyFactor, escapeHtml, localMonthKey, money, monthInputValue, monthLabel, progress } from '../app/format.js';
import { convertAmount, fxLabel } from '../app/fx.js';
import { icon } from '../app/icons.js';
import { buildDebtPaymentTransactionMap, consumptionExpenseBase } from '../app/financial-effects.js';

function roundBudget(value) { return Math.max(10, Math.ceil(Number(value||0)/10)*10); }

export function renderBudget({ budgets = [], categories = [], merchants = [], transactions = [], debtPayments = [], accounts = [], recurringRules = [], household, profile, fxRates, canWrite=false } = {}) {
  const currency = household?.base_currency || 'CHF';
  const locale = profile?.locale || 'de-CH';
  const currentMonth = monthInputValue();
  const monthStart = `${currentMonth}-01`;
  const expenseCategories = categories.filter((c)=>c.kind==='expense');
  const monthBudgets = budgets.filter((b)=>String(b.month_start).slice(0,7)===currentMonth);
  const paymentMap=buildDebtPaymentTransactionMap(debtPayments);
  const monthTx = transactions.filter((tx)=>localMonthKey(tx.occurred_at)===currentMonth && Number(tx.amount)<0 && !tx.transfer_group_id);
  const spentBase = monthTx.reduce((s,t)=>s+consumptionExpenseBase(t,paymentMap,currency,fxRates),0);
  const totalBudget = monthBudgets.reduce((s,b)=>s+Number(b.amount),0);
  const left = totalBudget-spentBase;
  const savingsAccountIds=new Set(accounts.filter((a)=>a.account_type==='savings').map((a)=>a.account_id));
  const savedThisMonth=transactions.filter((tx)=>localMonthKey(tx.occurred_at)===currentMonth && tx.transfer_group_id && Number(tx.amount)>0 && savingsAccountIds.has(tx.account_id)).reduce((s,t)=>s+(convertAmount(t.amount,t.currency,currency,fxRates)??0),0);
  const recurringMonthly=recurringRules.filter((r)=>r.active&&r.direction==='expense').reduce((s,r)=>s+(convertAmount(Number(r.amount)*cadenceMonthlyFactor(r.cadence),r.currency||currency,currency,fxRates)??0),0);

  const fields = `
    <label class="field"><span>Monat</span><input class="text-control" name="month" type="month" value="${currentMonth}" required></label>
    <label class="field"><span>Budget für</span><select class="text-control" name="scopeType" id="budgetScopeType"><option value="category">Kategorie</option><option value="merchant">Händler</option></select></label>
    <label class="field" id="budgetCategoryField"><span>Kategorie</span><select class="text-control" name="categoryId">${expenseCategories.map((c)=>`<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('')}</select></label>
    <label class="field" id="budgetMerchantField" hidden><span>Händler</span><select class="text-control" name="merchantId"><option value="">Bitte wählen</option>${merchants.map((m)=>`<option value="${m.id}">${escapeHtml(m.name)}</option>`).join('')}</select></label>
    <label class="field"><span>Budgetbetrag</span><input class="text-control" name="amount" type="number" min="0" step="0.01" required></label>`;

  const rows = monthBudgets.map((b)=>{
    const targetTx=b.merchant_id?monthTx.filter((t)=>t.merchant_id===b.merchant_id):monthTx.filter((t)=>t.category_id===b.category_id);
    const spent=targetTx.reduce((s,t)=>s+consumptionExpenseBase(t,paymentMap,currency,fxRates),0);
    const pct=progress(spent,b.amount);
    const label=b.merchants?.name||b.categories?.name||'Budget';
    const type=b.merchant_id?'Händler':'Kategorie';
    return `<tr><td><strong>${escapeHtml(label)}</strong><div class="table-meta">${type}</div></td><td>${money(b.amount,{currency,locale})}</td><td>${money(spent,{currency,locale})}</td><td><div class="progress-track table-progress"><div class="progress-fill ${pct>=100?'progress-fill--red':pct>=80?'progress-fill--orange':''}" style="--progress:${pct}%"></div></div><div class="table-meta">${pct.toFixed(0)} %</div></td><td>${canWrite?deleteButton('budgets',b.id):''}</td></tr>`;
  });

  const ninety=new Date(); ninety.setDate(ninety.getDate()-90);
  const recent=transactions.filter((t)=>new Date(t.occurred_at)>=ninety && Number(t.amount)<0 && !t.transfer_group_id && t.merchant_id && consumptionExpenseBase(t,paymentMap,currency,fxRates)>0);
  const byMerchant=new Map();
  for(const tx of recent){ const row=byMerchant.get(tx.merchant_id)||{count:0,total:0,merchant:merchants.find((m)=>m.id===tx.merchant_id)}; row.count++; row.total+=consumptionExpenseBase(tx,paymentMap,currency,fxRates); byMerchant.set(tx.merchant_id,row); }
  const existingMerchantBudgets=new Set(monthBudgets.filter((b)=>b.merchant_id).map((b)=>b.merchant_id));
  const suggestions=[...byMerchant.entries()].filter(([id,v])=>v.count>=2 && v.total>=50 && !existingMerchantBudgets.has(id)).map(([id,v])=>({id,name:v.merchant?.name||'Händler',count:v.count,monthly:v.total/3,suggested:roundBudget(v.total/3*1.1)})).sort((a,b)=>b.monthly-a.monthly).slice(0,6);

  return `
    ${pageHeader({title:'Budget',subtitle:`Kategorie- und Händler-Budgets für ${monthLabel(monthStart,locale)}. Interne Umbuchungen zählen nicht als Konsumausgabe; Überweisungen auf Sparkonten werden separat als Sparen ausgewiesen.`,actions:canWrite?`<button class="action-button action-button--primary" type="button" data-action="show-form" data-target="budget-create" ${(expenseCategories.length||merchants.length)?'':'disabled'}>${icon('plus')} Budget</button>`:''})}
    ${formShell('budget-create','Budget festlegen','Kategorie oder einzelnen Händler budgetieren',fields,{hidden:true,submitLabel:'Budget speichern'})}
    <div class="metric-grid" style="margin-bottom:16px">
      ${metricCard('Budget gesamt',money(totalBudget,{currency,locale}),monthLabel(monthStart,locale))}
      ${metricCard('Ausgegeben',money(spentBase,{currency,locale}),fxLabel(fxRates,currency))}
      ${metricCard('Frei im Budget',money(left,{currency,locale}),left>=0?'innerhalb Budget':'Budget überschritten',left>=0?'positive':'warning')}
      ${metricCard('Sparen',money(savedThisMonth,{currency,locale}),'Umbuchungen auf Sparkonten','positive')}
      ${metricCard('Geplante Fixkosten',money(recurringMonthly,{currency,locale}),'aus Wiederkehrend · inkl. übernommener Versicherungen/Verträge')}
    </div>
    ${suggestions.length?`<article class="card card-padding" style="margin-bottom:16px"><div class="card-heading"><div><h3 class="card-title">Intelligente Budgetvorschläge</h3><p class="card-subtitle">Wiederkehrende Händlerausgaben der letzten 90 Tage</p></div></div><div class="suggestion-grid">${suggestions.map((s)=>`<div class="suggestion-card"><div><strong>${escapeHtml(s.name)}</strong><span>${s.count} Buchungen · Ø ca. ${money(s.monthly,{currency,locale})}/Monat</span></div>${canWrite?`<button class="table-action" type="button" data-action="budget-suggestion" data-merchant-id="${s.id}" data-amount="${s.suggested}">Budget ${money(s.suggested,{currency,locale})}</button>`:''}</div>`).join('')}</div></article>`:''}
    <article class="card card-padding">${dataTable({headers:['Budget','Soll','Ist','Nutzung',''],rows,emptyText:'Für diesen Monat ist noch kein Budget angelegt.'})}</article>`;
}
