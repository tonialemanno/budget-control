import { dataTable, formShell, metricCard, pageHeader, deleteButton } from '../app/components.js';
import { cadenceMonthlyFactor, escapeHtml, money, monthLabel, progress } from '../app/format.js';
import { convertAmount } from '../app/fx.js';
import { icon } from '../app/icons.js';
import { buildDebtPaymentTransactionMap, consumptionExpenseBase } from '../app/financial-effects.js';
import { buildFinanceSnapshot, budgetCoversTransaction, matchesRecurringExpense } from '../app/finance-model.js';
import { budgetSummary, effectiveBudgetSet } from '../app/finance-insights.js';
import { financeCycleLabel, inFinanceCycle, resolveFinanceCycle } from '../app/finance-cycle.js';
import {
  budgetIsFixed,
  budgetIsSavings,
  resolveHistoricalMerchant,
  variableBudgetSuggestions,
} from '../app/budget-intelligence.js';

function shortDate(value,locale){
  try{return new Intl.DateTimeFormat(locale,{day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(value));}
  catch{return String(value||'').slice(0,10);}
}

export function renderBudget({
  budgets = [], categories = [], merchants = [], transactions = [], debtPayments = [], bills = [],
  accounts = [], recurringRules = [], household, profile, fxRates, canWrite=false,
  budgetExpandedMerchantId=null,
} = {}) {
  const currency=household?.base_currency||'CHF';
  const locale=profile?.locale||'de-CH';
  const now=new Date();
  const today=now.toISOString().slice(0,10);
  const financeCycle=resolveFinanceCycle({transactions,recurringRules,now,fallbackDay:25});
  const financePeriodLabel=financeCycleLabel(financeCycle,locale);
  const currentMonth=financeCycle.budgetMonth;
  const monthStart=currentMonth+'-01';
  const expenseCategories=categories.filter((c)=>c.kind==='expense');
  const effectiveBudgets=effectiveBudgetSet(budgets,currentMonth);
  const monthBudgets=effectiveBudgets.rows;
  const activeRecurring=recurringRules.filter((rule)=>rule.active!==false&&(!rule.end_date||String(rule.end_date).slice(0,10)>=today));
  const variableBudgets=monthBudgets.filter((budget)=>!budgetIsFixed(budget,activeRecurring,merchants)&&!budgetIsSavings(budget));
  const paymentMap=buildDebtPaymentTransactionMap(debtPayments);

  const monthTx=transactions.filter((tx)=>{
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

  const summary=budgetSummary({
    budgets,transactions,debtPayments,categories,merchants,recurringRules,
    baseCurrency:currency,fxRates,now,fallbackDay:25,
  });
  const totalBudget=summary.total;
  const left=totalBudget-summary.spent;

  const recurringMonthly=activeRecurring
    .filter((r)=>r.direction==='expense')
    .reduce((sum,r)=>sum+(convertAmount(Number(r.amount)*cadenceMonthlyFactor(r.cadence),r.currency||currency,currency,fxRates)??0),0);

  const snapshot=buildFinanceSnapshot({
    accounts,transactions,debtPayments,recurringRules,budgets,household,fxRates,now,
  });

  const fields=`
    <label class="field"><span>Monat</span><input class="text-control" name="month" type="month" value="${currentMonth}" required></label>
    <label class="field"><span>Budget für</span><select class="text-control" name="scopeType" id="budgetScopeType"><option value="category">Kategorie</option><option value="merchant">Händler</option></select></label>
    <label class="field" id="budgetCategoryField"><span>Kategorie</span><select class="text-control" name="categoryId">${expenseCategories.map((c)=>`<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('')}</select></label>
    <label class="field" id="budgetMerchantField" hidden><span>Händler</span><select class="text-control" name="merchantId"><option value="">Bitte wählen</option>${merchants.map((m)=>`<option value="${m.id}">${escapeHtml(m.name)}</option>`).join('')}</select></label>
    <label class="field"><span>Budgetbetrag</span><input class="text-control" name="amount" type="number" min="0" step="0.01" required></label>`;

  const rows=monthBudgets.map((budget)=>{
    const fixed=budgetIsFixed(budget,activeRecurring,merchants);
    const savings=budgetIsSavings(budget);
    const targetTx=monthTx.filter((tx)=>{
      if(budget.merchant_id) return resolveHistoricalMerchant(tx,merchants)?.id===budget.merchant_id;
      return budgetCoversTransaction(tx,[budget]);
    });
    const spent=targetTx.reduce((sum,tx)=>sum+consumptionExpenseBase(tx,paymentMap,currency,fxRates),0);
    const pct=progress(spent,budget.amount);
    const label=budget.merchants?.name||budget.categories?.name||'Budget';
    const baseType=fixed
      ? 'Fixkosten · separat geplant'
      : savings
        ? 'Sparen · keine Konsumausgabe'
        : budget.merchant_id?'Variables Händlerbudget':'Variables Kategoriebudget';
    const type=budget._inherited
      ? `${baseType} · Vorlage aus ${monthLabel(effectiveBudgets.sourceMonth+'-01',locale)}`
      : baseType;
    return `<tr>
      <td><strong>${escapeHtml(label)}</strong><div class="table-meta">${escapeHtml(type)}</div></td>
      <td>${money(budget.amount,{currency,locale})}</td>
      <td>${money(spent,{currency,locale})}</td>
      <td><div class="progress-track table-progress"><div class="progress-fill ${pct>=100?'progress-fill--red':pct>=80?'progress-fill--orange':''}" style="--progress:${pct}%"></div></div><div class="table-meta">${pct.toFixed(0)} %</div></td>
      <td>${canWrite&&!budget._inherited?deleteButton('budgets',budget.id):''}</td>
    </tr>`;
  });

  const allSuggestions=variableBudgetSuggestions({
    transactions,categories,merchants,recurringRules:activeRecurring,debtPayments,
    baseCurrency:currency,fxRates,now,fallbackDay:25,
  });
  const suggestions=allSuggestions.filter((series)=>{
    if(series.merchantId&&monthBudgets.some((budget)=>budget.merchant_id===series.merchantId)) return false;
    if(!series.merchantId&&series.categoryId&&monthBudgets.some((budget)=>budget.category_id===series.categoryId)) return false;
    return true;
  }).slice(0,12);

  return `
    ${pageHeader({
      title:'Budget',
      subtitle:`Finanzmonat ${financePeriodLabel}. Fixkosten, Raten und Sparen werden separat behandelt. Variable Budgets basieren auf der vollständigen verfügbaren Historie statt nur auf drei Monaten.`,
      actions:canWrite?`<button class="action-button action-button--primary" type="button" data-action="show-form" data-target="budget-create" ${(expenseCategories.length||merchants.length)?'':'disabled'}>${icon('plus')} Budget</button>`:''
    })}
    ${formShell('budget-create','Budget festlegen','Kategorie oder einzelnen Händler budgetieren',fields,{hidden:true,submitLabel:'Budget speichern'})}

    <div class="metric-grid" style="margin-bottom:16px">
      ${metricCard('Variables Budget',money(totalBudget,{currency,locale}),`${summary.count} variable Position${summary.count===1?'':'en'} · ${financePeriodLabel}`)}
      ${metricCard('Davon verbraucht',money(summary.spent,{currency,locale}),'nur variable Ausgaben innerhalb dieser Budgets')}
      ${metricCard('Noch verfügbar',money(Math.max(0,left),{currency,locale}),summary.overrun>0?`Überschritten um ${money(summary.overrun,{currency,locale})}`:'im variablen Budget',summary.overrun>0?'warning':'positive')}
      ${metricCard('Ausserhalb Budget',money(outsideBudget,{currency,locale}),'variable Ausgaben ohne passendes Budget',outsideBudget>0?'warning':'positive')}
      ${metricCard('Fixkosten / Monat',money(recurringMonthly,{currency,locale}),'separat aus bekannten wiederkehrenden Verpflichtungen')}
      ${metricCard('Sparen / Monat',money(snapshot.fixedTransfersMonthly,{currency,locale}),'Umbuchungen auf Sparkonten und Töpfe')}
    </div>

    <article class="card card-padding" style="margin-bottom:16px">
      <div class="card-heading">
        <div>
          <h3 class="card-title">Wie Finance das Budget ableitet</h3>
          <p class="card-subtitle">Bekannte Verpflichtungen haben Vorrang. Für variable Ausgaben nutzt Finance die vollständige vorhandene Historie ab dem ersten Auftreten einer Kostenserie.</p>
        </div>
      </div>
      <div class="inline-alert">
        <strong>Reihenfolge</strong>
        <span>Fixkosten / Raten → tatsächlicher Sollbetrag. Sparen → keine Ausgabe. Variable Kosten → gesamte Historie ÷ berücksichtigte Monate. Manuell gesetztes Budget → bleibt deine Entscheidung.</span>
      </div>
    </article>

    ${suggestions.length?`<article class="card card-padding" style="margin-bottom:16px">
      <div class="card-heading">
        <div><h3 class="card-title">Variable Ausgabenmuster</h3><p class="card-subtitle">Vorschläge aus der vollständigen verfügbaren Historie. Jede Berechnung lässt sich bis zu den Buchungen öffnen.</p></div>
      </div>
      <div class="suggestion-grid">
        ${suggestions.map((series)=>{
          const expanded=budgetExpandedMerchantId===series.key;
          const suggested=Number(series.monthlyValue.toFixed(2));
          const details=expanded?`<div class="budget-pattern-details">
            <div class="inline-alert"><strong>Berechnung</strong><span>${money(series.total,{currency,locale})} aus ${series.bookingCount} Buchungen ÷ ${series.monthsCovered} berücksichtigte Monate = ${money(series.historicalMonthly,{currency,locale})} pro Monat. Zeitraum: ${shortDate(series.firstDate,locale)} bis ${shortDate(series.historyEnd,locale)}.</span></div>
            <div class="table-scroll budget-pattern-scroll"><table class="data-table"><thead><tr><th>Datum</th><th>Buchung</th><th>Kategorie</th><th>Konto</th><th>Betrag</th><th></th></tr></thead><tbody>
              ${series.rows.map((tx)=>{const linkedBill=bills.find((bill)=>bill.status==='paid'&&bill.paid_transaction_id===tx.id);return `<tr><td>${escapeHtml(shortDate(tx.occurred_at,locale))}</td><td><strong>${escapeHtml(tx.description||series.name)}</strong><div class="table-meta">${escapeHtml(tx.counterparty||'')}</div></td><td>${escapeHtml(tx.categories?.name||'Ohne Kategorie')}</td><td>${escapeHtml(tx.accounts?.name||'—')}</td><td>${money(Math.abs(Number(tx.amount)),{currency:tx.currency||currency,locale})}</td><td>${canWrite?(linkedBill?`<a class="table-action" href="#/bills">Rechnung anzeigen</a>`:`<button class="table-action" type="button" data-action="budget-transaction-edit" data-id="${tx.id}">Bearbeiten</button>`):''}</td></tr>`;}).join('')}
            </tbody></table></div>
          </div>`:''; 
          return `<div class="suggestion-card budget-pattern-card">
            <div class="budget-pattern-head">
              <div><strong>${escapeHtml(series.name)} · ${escapeHtml(series.categoryName)}</strong><span>${series.bookingCount} Buchungen · ${series.monthsCovered} Monate · ${money(series.total,{currency,locale})} gesamt</span><small>Budgetvorschlag: ${money(suggested,{currency,locale})}/Monat</small></div>
              <div class="row-actions">
                <button class="table-action" type="button" data-action="budget-suggestion-toggle" data-merchant-id="${escapeHtml(series.key)}">${expanded?'Buchungen schliessen':'Buchungen anzeigen'}</button>
                ${canWrite?`<button class="table-action" type="button" data-action="budget-suggestion" data-merchant-id="${escapeHtml(series.merchantId||'')}" data-category-id="${escapeHtml(series.categoryId||'')}" data-amount="${suggested}">Budget übernehmen</button>`:''}
              </div>
            </div>
            ${details}
          </div>`;
        }).join('')}
      </div>
    </article>`:''}

    <article class="card card-padding">
      <div class="card-heading"><div><h3 class="card-title">Gespeicherte Budgetpositionen</h3><p class="card-subtitle">Fixkosten und Sparen bleiben sichtbar, zählen aber nicht mehr in das variable Budget hinein.</p></div></div>
      ${dataTable({headers:['Position','Soll','Ist','Nutzung',''],rows,emptyText:'Für diesen Finanzmonat ist noch kein variables Budget angelegt.'})}
    </article>
  `;
}
