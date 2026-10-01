import { dataTable, formShell, metricCard, pageHeader, deleteButton } from '../app/components.js';
import { cadenceMonthlyFactor, escapeHtml, localMonthKey, money, monthInputValue, monthLabel, progress } from '../app/format.js';
import { convertAmount, fxLabel } from '../app/fx.js';
import { icon } from '../app/icons.js';
import { buildDebtPaymentTransactionMap, consumptionExpenseBase } from '../app/financial-effects.js';

function roundBudget(value) { return Math.max(10, Math.ceil(Number(value||0)/10)*10); }

function normalized(value) {
  return String(value||'').toLowerCase().replace(/[^a-z0-9äöüà-ÿ]+/gi,' ').trim().replace(/\s+/g,' ');
}

function merchantIsFixed(merchant, recurringRules) {
  const merchantName=normalized(merchant?.name);
  if(!merchantName) return false;
  return recurringRules.some((rule)=>{
    if(rule.active===false || rule.direction!=='expense') return false;
    const description=normalized(rule.description);
    const counterparty=normalized(rule.counterparty);
    if(counterparty && (merchantName.includes(counterparty) || counterparty.includes(merchantName))) return true;
    if(description && description.length>=5 && (merchantName.includes(description) || description.includes(merchantName))) return true;
    return false;
  });
}

function previousFullMonths(count=3, now=new Date()) {
  const result=[];
  for(let back=1;back<=count;back+=1){
    const date=new Date(now.getFullYear(),now.getMonth()-back,1,12);
    result.push(`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`);
  }
  return result;
}

export function renderBudget({ budgets = [], categories = [], merchants = [], transactions = [], debtPayments = [], accounts = [], recurringRules = [], household, profile, fxRates, canWrite=false } = {}) {
  const currency = household?.base_currency || 'CHF';
  const locale = profile?.locale || 'de-CH';
  const now=new Date();
  const currentMonth = monthInputValue(now);
  const monthStart = `${currentMonth}-01`;
  const expenseCategories = categories.filter((c)=>c.kind==='expense');
  const monthBudgets = budgets.filter((b)=>String(b.month_start).slice(0,7)===currentMonth);
  const paymentMap=buildDebtPaymentTransactionMap(debtPayments);

  const monthTx = transactions.filter((tx)=>{
    const date=new Date(tx.occurred_at);
    return localMonthKey(tx.occurred_at)===currentMonth
      && Number(tx.amount)<0
      && !tx.transfer_group_id
      && tx.status==='booked'
      && !Number.isNaN(date.getTime())
      && date<=now;
  });
  const spentBase = monthTx.reduce((s,t)=>s+consumptionExpenseBase(t,paymentMap,currency,fxRates),0);
  const totalBudget = monthBudgets.reduce((s,b)=>s+Number(b.amount),0);
  const left = totalBudget-spentBase;

  const savingsAccountIds=new Set(accounts.filter((a)=>a.account_type==='savings').map((a)=>a.account_id));
  const savedThisMonth=transactions.filter((tx)=>{
    const date=new Date(tx.occurred_at);
    return localMonthKey(tx.occurred_at)===currentMonth
      && tx.status==='booked'
      && tx.transfer_group_id
      && Number(tx.amount)>0
      && savingsAccountIds.has(tx.account_id)
      && !Number.isNaN(date.getTime())
      && date<=now;
  }).reduce((s,t)=>s+(convertAmount(t.amount,t.currency,currency,fxRates)??0),0);

  const recurringMonthly=recurringRules
    .filter((r)=>r.active!==false && r.direction==='expense' && (!r.end_date || String(r.end_date).slice(0,10)>=now.toISOString().slice(0,10)))
    .reduce((s,r)=>s+(convertAmount(Number(r.amount)*cadenceMonthlyFactor(r.cadence),r.currency||currency,currency,fxRates)??0),0);

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
    if(merchantIsFixed(merchant,recurringRules)) continue;
    const row=byMerchant.get(tx.merchant_id)||{count:0,total:0,merchant,months:new Set()};
    row.count+=1;
    row.total+=consumptionExpenseBase(tx,paymentMap,currency,fxRates);
    row.months.add(localMonthKey(tx.occurred_at));
    byMerchant.set(tx.merchant_id,row);
  }

  const existingMerchantBudgets=new Set(monthBudgets.filter((b)=>b.merchant_id).map((b)=>b.merchant_id));
  const suggestions=[...byMerchant.entries()]
    .filter(([id,value])=>value.count>=2 && value.total>=50 && !existingMerchantBudgets.has(id))
    .map(([id,value])=>{
      const monthly=value.total/historyMonths.length;
      return {
        id,
        name:value.merchant?.name||'Händler',
        count:value.count,
        activeMonths:value.months.size,
        monthly,
        suggested:roundBudget(monthly),
      };
    })
    .sort((a,b)=>b.monthly-a.monthly)
    .slice(0,6);

  return `
    ${pageHeader({title:'Budget',subtitle:`Variable Ausgaben für ${monthLabel(monthStart,locale)} planen. Bekannte Fixkosten werden separat geführt und nicht als Budgetvorschlag geschätzt.`,actions:canWrite?`<button class="action-button action-button--primary" type="button" data-action="show-form" data-target="budget-create" ${(expenseCategories.length||merchants.length)?'':'disabled'}>${icon('plus')} Budget</button>`:''})}
    ${formShell('budget-create','Budget festlegen','Kategorie oder einzelnen Händler budgetieren',fields,{hidden:true,submitLabel:'Budget speichern'})}
    <div class="metric-grid" style="margin-bottom:16px">
      ${metricCard('Budget gesamt',money(totalBudget,{currency,locale}),monthLabel(monthStart,locale))}
      ${metricCard('Ausgegeben',money(spentBase,{currency,locale}),'nur bis heute gebuchte variable Ausgaben')}
      ${metricCard('Frei im Budget',money(left,{currency,locale}),left>=0?'innerhalb Budget':'Budget überschritten',left>=0?'positive':'warning')}
      ${metricCard('Sparen',money(savedThisMonth,{currency,locale}),'bereits gebuchte Umbuchungen auf Sparkonten','positive')}
      ${metricCard('Fixkosten / Monat',money(recurringMonthly,{currency,locale}),'separat aus Fixkosten / Wiederkehrend')}
    </div>
    ${suggestions.length?`<article class="card card-padding" style="margin-bottom:16px"><div class="card-heading"><div><h3 class="card-title">Variable Budgetvorschläge</h3><p class="card-subtitle">Durchschnitt der letzten 3 vollständigen Monate · bekannte Fixkosten ausgeschlossen · Vorschlag auf nächste CHF 10 gerundet</p></div></div><div class="suggestion-grid">${suggestions.map((s)=>`<div class="suggestion-card"><div><strong>${escapeHtml(s.name)}</strong><span>${s.count} Buchungen in ${s.activeMonths} Monat${s.activeMonths===1?'':'en'} · Ø ${money(s.monthly,{currency,locale})}/Monat</span></div>${canWrite?`<button class="table-action" type="button" data-action="budget-suggestion" data-merchant-id="${s.id}" data-amount="${s.suggested}">Budget ${money(s.suggested,{currency,locale})}</button>`:''}</div>`).join('')}</div></article>`:''}
    <article class="card card-padding">${dataTable({headers:['Budget','Soll','Ist','Nutzung',''],rows,emptyText:'Für diesen Monat ist noch kein variables Budget angelegt.'})}</article>`;
}
