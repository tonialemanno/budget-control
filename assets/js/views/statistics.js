import { pageHeader } from '../app/components.js';
import { escapeHtml, money } from '../app/format.js';
import { renderCashflowChart, renderExpenseDonut } from '../app/charts.js';
import { annualIncomeBreakdown, categorySpending, currentFinanceCycleTotals, financeCycleSeries, budgetSummary } from '../app/finance-insights.js';
import { financeMonthMode } from '../app/user-preferences.js';
import { financeCycleLabel } from '../app/finance-cycle.js';
import { renderFinanceMonthSummary, renderCategoryDetails, renderBudgetProgress, financePeriodDates } from './statistics-panels.js';

export function renderStatistics({
  accounts=[],transactions=[],debtPayments=[],recurringRules=[],budgets=[],
  categories=[],merchants=[],household,profile,fxRates,privacyEnabled=false,
}={}){
  const now=new Date();
  const currency=household?.base_currency||'CHF';
  const locale=profile?.locale||(household?.country_code==='DE'?'de-DE':'de-CH');
  const monthMode=financeMonthMode(profile);
  const query={transactions,debtPayments,recurringRules,categories,baseCurrency:currency,fxRates,now,financeMonthMode:monthMode};
  const totals=currentFinanceCycleTotals(query);
  const cycle=totals.cycle;
  const {from,to}=financePeriodDates(cycle);
  const months=financeCycleSeries({...query,cycles:12});
  const expenseRows=categorySpending({
    transactions,debtPayments,categories,recurringRules,baseCurrency:currency,fxRates,
    now,limit:7,rangeStart:cycle.start,rangeEnd:cycle.endExclusive,
  });
  const sum=expenseRows[0]?.total||0;
  const budget=budgetSummary({...query,budgets,merchants,accounts});
  const annual=annualIncomeBreakdown({transactions,categories,recurringRules,baseCurrency:currency,fxRates,year:now.getFullYear(),limit:8});
  const val=(amount)=>privacyEnabled?'•••':money(amount,{currency,locale});
  return `
    ${pageHeader({title:'Statistik',subtitle:'Dein Geld nachvollziehbar: Buchungen, Kategorien, Budgets und Einnahmequellen – ohne interne Umbuchungen als Konsumausgaben.'})}
    <div class="stat-section-header"><div><h3>Monatsbilanz</h3><p>${escapeHtml(financeCycleLabel(cycle,locale))} · tatsächliche gebuchte Geldbewegungen</p></div><a href="/finance/transactions">Transaktionen</a></div>
    ${renderFinanceMonthSummary({totals,currency,locale,privacy:privacyEnabled})}
    <section class="card card-padding stat-section">
      <div class="stat-section-header"><div><h3>Verlauf über 12 Finanzmonate</h3><p>Grün = Einnahmen, Rot = Ausgaben. Jeden Balken antippen für die passenden Buchungen.</p></div></div>
      ${renderCashflowChart({series:months,currency,locale,privacy:privacyEnabled})}
      <div class="stat-month-list">
        ${months.filter((row)=>row.coverage==='full').slice().reverse().map((row)=>{
          const range=financePeriodDates(row);
          return `<button type="button" class="stat-month-line" data-action="overview-drilldown-period" data-from="${range.from}" data-to="${range.to}" data-direction="all">
            <span>${escapeHtml(financeCycleLabel({start:row.start,endExclusive:row.endExclusive},locale))}</span>
            <strong class="${row.net>=0?'stat-positive':'stat-negative'}">${val(row.net)}</strong>
            <small>Bilanz →</small>
          </button>`;
        }).join('')||'<p class="stat-empty">Für abgeschlossene Finanzmonate fehlen noch vollständige Buchungsdaten.</p>'}
      </div>
    </section>
    <div class="dashboard-chart-grid">
      <section class="card card-padding dashboard-donut-card stat-section">
        <div class="stat-section-header"><div><h3>Ausgaben nach Kategorien</h3><p>${escapeHtml(financeCycleLabel(cycle,locale))} · nur wirtschaftliche Ausgaben</p></div></div>
        ${renderExpenseDonut({rows:expenseRows,total:sum,currency,locale,privacy:privacyEnabled})}
      </section>
      <section class="card card-padding stat-section">
        <div class="stat-section-header"><div><h3>Kategorien im Detail</h3><p>Aufklappen, Unterkategorie wählen, Buchungen bearbeiten.</p></div></div>
        ${renderCategoryDetails({rows:expenseRows,currency,locale,privacy:privacyEnabled,cycle})}
      </section>
    </div>
    <section class="card card-padding stat-section">
      <div class="stat-section-header"><div><h3>Budgetfortschritt</h3><p>Variabler Rahmen dieses Finanzmonats. Fixkosten und Umbuchungen bleiben getrennt.</p></div><a href="/planning/budget">Budget bearbeiten</a></div>
      ${renderBudgetProgress({budget,currency,locale,privacy:privacyEnabled,fxRates,cycle})}
    </section>
    <section class="card card-padding stat-section">
      <div class="stat-section-header"><div><h3>Einnahmequellen ${annual.year}</h3><p>Verdienst und sonstige Einnahmen getrennt von Rückerstattungen und Rückzahlungen.</p></div></div>
      <div class="stat-income-header"><span>Verdient & weitere echte Einnahmen</span><strong>${val(annual.earnedTotal)}</strong></div>
      <div class="stat-income-list">
        ${annual.sources.length?annual.sources.map((source)=>`<button type="button" class="stat-income-source"
          data-action="overview-drilldown-income" data-kind="earned" data-transaction-ids="${escapeHtml((source.transactionIds||[]).join(','))}"
          data-source="${escapeHtml(source.label)}"><span>${escapeHtml(source.label)}</span><strong>${val(source.value)}</strong><small>Buchungen →</small></button>`).join('')
        :'<p class="stat-empty">Noch keine als Einnahmen klassifizierten Buchungen.</p>'}
        ${[['refund','Rückerstattungen',annual.refunds],['repayment','Rückzahlungen',annual.repayments],['unclassified','Ungeklärte Eingänge',annual.unclassified]].map(([kind,label,value])=>`<button type="button" class="stat-income-source" data-action="overview-drilldown-income" data-kind="${kind}"><span>${label}</span><strong>${val(value)}</strong><small>Prüfen →</small></button>`).join('')}
      </div>
      <p class="stat-data-note">Zeitraum: ${from} bis ${to} für Monatswerte. Die Einnahmequellen zeigen das laufende Kalenderjahr. Unvollständige Historie wird als solche gekennzeichnet.</p>
    </section>
  `;
}
