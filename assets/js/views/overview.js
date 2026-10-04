import { metricCard, pageHeader, sectionHeading, transactionRow } from '../app/components.js';
import { escapeHtml, money, monthLabel, shortDate } from '../app/format.js';
import { icon } from '../app/icons.js';
import { fxLabel } from '../app/fx.js';
import { buildFinanceSnapshot } from '../app/finance-model.js';
import { accountShare, annualIncomeBreakdown, budgetSummary, categorySpending, currentFinanceCycleTotals, financeCycleSeries, primaryOperatingAccount } from '../app/finance-insights.js';
import { primaryAccountPreferenceId } from '../app/user-preferences.js';
import { financeCycleLabel } from '../app/finance-cycle.js';
import { renderCashflowChart, renderExpenseDonut } from '../app/charts.js';

function pct(value) {
  return Math.max(0, Math.min(100, Number(value)||0));
}

function progressRow(label, value, percent, meta='') {
  return `<div class="insight-row">
    <div class="insight-row-head"><strong>${escapeHtml(label)}</strong><span>${value}</span></div>
    <div class="insight-track"><span style="--insight-progress:${pct(percent)}%"></span></div>
    ${meta?`<small>${meta}</small>`:''}
  </div>`;
}

export function renderOverview({
  accounts = [], transactions = [], debtPayments = [], recurringRules = [], budgets = [], bills = [],
  debts = [], receivables = [], assets = [], properties = [], vehicles = [], investments = [], pensions = [],
  categories = [], merchants = [], household, profile, fxRates, privacyEnabled=false,
} = {}) {
  const locale = profile?.locale || 'de-CH';
  const now = new Date();
  const snapshot = buildFinanceSnapshot({
    accounts, transactions, debtPayments, recurringRules, budgets, categories, merchants, bills, debts,
    receivables, assets, properties, vehicles, investments, pensions,
    household, fxRates, now,
  });
  const currency = snapshot.currency;
  const hasForeign = accounts.some((a)=>a.currency!==currency) || transactions.some((t)=>t.currency!==currency);
  const actualTransactions=transactions.filter((tx)=>tx.status==='booked' && new Date(tx.occurred_at)<=now);
  const cycleTotals=currentFinanceCycleTotals({
    transactions,debtPayments,recurringRules,categories,baseCurrency:currency,fxRates,now,fallbackDay:25,
  });
  const financeCycle=cycleTotals.cycle;
  const cycleLabel=financeCycleLabel(financeCycle,locale);
  const budget=budgetSummary({
    budgets,transactions,debtPayments,categories,merchants,recurringRules,baseCurrency:currency,fxRates,now,fallbackDay:25,
  });
  const months=financeCycleSeries({
    transactions,debtPayments,recurringRules,categories,baseCurrency:currency,fxRates,now,cycles:6,fallbackDay:25,
  });
  const categoriesSpent=categorySpending({
    transactions,debtPayments,categories,recurringRules,baseCurrency:currency,fxRates,now,limit:5,
    rangeStart:financeCycle.start,rangeEnd:financeCycle.endExclusive,
  });
  const accountRows=accountShare(accounts,currency,fxRates);
  const preferredPrimaryAccountId=primaryAccountPreferenceId(profile,household?.id,accounts);
  const primaryAccount=primaryOperatingAccount(accounts,recurringRules,currency,preferredPrimaryAccountId);
  const primaryAccountRow=accountRows.find((row)=>row.account.account_id===primaryAccount?.account_id) || null;
  const primaryBaseValue=primaryAccountRow?.value||0;
  const otherLiquid=snapshot.cash-primaryBaseValue;
  const categoryTotal=categoriesSpent[0]?.total||0;
  const annualIncome=annualIncomeBreakdown({
    transactions,categories,recurringRules,baseCurrency:currency,fxRates,year:now.getFullYear(),limit:5,
  });

  if (!accounts.length) {
    return `
      ${pageHeader({kicker:shortDate(now,locale),title:`Hallo ${profile?.display_name?.split(' ')[0]||''}`.trim(),subtitle:'Finance ist bereit für deine Einrichtung.'})}
      <article class="card onboarding-empty">
        <span class="onboarding-empty-icon">${icon('wallet')}</span>
        <div><h3>Dein erstes Konto fehlt noch.</h3><p>Erfasse den heutigen Kontostand. Historische Importe werden danach um diesen Stand herum eingeordnet und verändern den heutigen Anker nicht.</p></div>
        <a class="action-button action-button--primary" href="#/accounts?create=account">Konto einrichten</a>
      </article>`;
  }

  return `
    ${pageHeader({
      kicker:shortDate(now,locale),
      title:`Hallo ${profile?.display_name?.split(' ')[0]||''}`.trim(),
      subtitle:`Deine Finanzen auf einen Blick. Aktueller Finanzmonat: ${cycleLabel}. Der Zyklus folgt deiner letzten relevanten Einnahme, sonst dem 25.`
    })}

    ${hasForeign?`<div class="inline-alert inline-alert--success"><strong>Mehrere Währungen aktiv.</strong><span>${fxLabel(fxRates,currency)}. Originalbeträge bleiben auf den Konten erhalten.</span></div>`:''}

    <div class="overview-hero-grid">
      <article class="card card--accent finance-balance-card">
        <div class="finance-balance-top">
          <div>
            <span class="hero-label">Hauptkonto</span>
            <div class="hero-value">${money(primaryAccount?.current_balance||0,{currency:primaryAccount?.currency||currency,locale,decimals:2})}</div>
            <span class="hero-caption"><strong>${escapeHtml(primaryAccount?.name||'Operatives Konto')}</strong> · <span>Aktueller Stand</span></span>
          </div>
          <span class="finance-hero-icon">${icon('wallet')}</span>
        </div>
        <div class="finance-balance-actions">
          <a class="action-button action-button--primary" href="#/transactions?create=expense">${icon('plus')} Ausgabe</a>
          <a class="action-button action-button--secondary" href="#/transactions?create=income">Einnahme</a>
          <a class="action-button action-button--secondary" href="#/transactions?create=transfer">Umbuchung</a>
        </div>
        <div class="finance-balance-foot">
          <span>Andere Konten <strong>${money(otherLiquid,{currency,locale,decimals:0})}</strong></span>
          <span>Gesamt liquide <strong>${money(snapshot.cash,{currency,locale,decimals:0})}</strong></span>
          <span>Nettovermögen <strong>${money(snapshot.netWorth,{currency,locale,decimals:0})}</strong></span>
        </div>
      </article>

      <article class="card card-padding budget-ring-card">
        <div class="card-heading"><div><h3 class="card-title">Variables Budget · Finanzmonat</h3><p class="card-subtitle">${budget.count ? `${budget.count} variable Budgetposition${budget.count===1?'':'en'} · Fixkosten separat` : 'Noch kein variables Budget eingerichtet'}</p></div><a class="card-link" href="#/budget">Warum?</a></div>
        <div class="budget-ring-wrap">
          <div class="budget-ring" style="--ring-progress:${budget.percent}"><div><strong>${Math.round(budget.rawPercent)}%</strong><span>verbraucht</span></div></div>
          <div class="budget-ring-copy">
            <span>Variables Budget <strong>${money(budget.total,{currency,locale,decimals:0})}</strong></span>
            <span>Variabel ausgegeben <strong>${money(budget.spent,{currency,locale,decimals:0})}</strong></span>
            <span>${budget.overBy>0?'Darüber':'Noch verfügbar'} <strong>${money(budget.overBy>0?budget.overBy:budget.remaining,{currency,locale,decimals:0})}</strong></span>
          </div>
        </div>
        ${!budget.count?'<a class="action-button action-button--secondary action-button--block" href="#/budget">Budget einrichten</a>':''}
      </article>
    </div>

    <div class="dashboard-chart-grid">
      <article class="card card-padding dashboard-donut-card">
        <div class="card-heading">
          <div><h3 class="card-title">Ausgaben nach Kategorien</h3><p class="card-subtitle">Finanzmonat ${cycleLabel} · echte Konsumausgaben</p></div>
          <a class="card-link" href="#/transactions">Details</a>
        </div>
        ${renderExpenseDonut({rows:categoriesSpent,total:categoryTotal,currency,locale,privacy:privacyEnabled})}
      </article>

      <article class="card card-padding finance-chart-card">
        <div class="card-heading">
          <div><h3 class="card-title">Entwicklung</h3><p class="card-subtitle">Einnahmen und Ausgaben der letzten sechs Finanzmonate</p></div>
          <a class="card-link" href="#/transactions">Buchungen</a>
        </div>
        ${renderCashflowChart({series:months,currency,locale,privacy:privacyEnabled})}
      </article>
    </div>

    <article class="card card-padding overview-income-card">
      <div class="card-heading">
        <div><h3 class="card-title">Einnahmen ${annualIncome.year}</h3><p class="card-subtitle">Verdienst getrennt von Rückerstattungen, Rückzahlungen und ungeklärten Eingängen.</p></div>
        <button class="card-link card-link--button" type="button" data-action="overview-drilldown-income" data-kind="earned">Alle Verdienste</button>
      </div>
      <div class="income-summary-grid">
        <div class="income-summary-total"><span>Verdient</span><strong>${privacyEnabled?'•••':money(annualIncome.earnedTotal,{currency,locale,decimals:0})}</strong></div>
        <div class="income-source-list">
          ${annualIncome.sources.length?annualIncome.sources.map((row)=>`<button class="income-source-row" type="button" data-action="overview-drilldown-income" data-source="${escapeHtml(row.label)}" data-sources="${escapeHtml((row.sourceNames||[row.label]).join('||'))}"><span>${escapeHtml(row.label)}</span><strong>${privacyEnabled?'•••':money(row.value,{currency,locale,decimals:0})}</strong></button>`).join(''):'<div class="table-empty">Noch keine als Verdienst klassifizierten Einnahmen.</div>'}
        </div>
      </div>
      <div class="income-classification-strip">
        <button type="button" data-action="overview-drilldown-income" data-kind="refund"><span>Rückerstattungen</span><strong>${privacyEnabled?'•••':money(annualIncome.refunds,{currency,locale,decimals:0})}</strong></button>
        <button type="button" data-action="overview-drilldown-income" data-kind="repayment"><span>Rückzahlungen</span><strong>${privacyEnabled?'•••':money(annualIncome.repayments,{currency,locale,decimals:0})}</strong></button>
        <button type="button" data-action="overview-drilldown-income" data-kind="unclassified" class="${annualIncome.unclassified>0?'needs-review':''}"><span>Ungeklärt</span><strong>${privacyEnabled?'•••':money(annualIncome.unclassified,{currency,locale,decimals:0})}</strong></button>
      </div>
    </article>

    <div class="overview-metric-strip">
      ${metricCard('Einnahmen · Finanzmonat',money(cycleTotals.income,{currency,locale,decimals:0}),cycleLabel,'positive')}
      ${metricCard('Ausgaben · Finanzmonat',money(cycleTotals.expenses,{currency,locale,decimals:0}),cycleLabel)}
      ${metricCard('Sparquote',`${Math.round(cycleTotals.savingsRate)}%`,'im aktuellen Finanzmonat',cycleTotals.savingsRate>=0?'positive':'warning')}
      ${metricCard('Noch geplant · Monat',money(snapshot.remainingPlannedExpensesMonth,{currency,locale,decimals:0}),'offene geplante Ausgaben')}
      ${metricCard('Runway',snapshot.runwayMonths>0?`${snapshot.runwayMonths.toFixed(1)} Monate`:'—','bei aktuellem Ausgabenniveau')}
    </div>

    <article class="card card-padding overview-account-card">
      <div class="card-heading"><div><h3 class="card-title">Konten im Überblick</h3><p class="card-subtitle">Jedes Konto separat. Sparkonten und Töpfe verändern den Stand deines Hauptkontos nicht.</p></div><a class="card-link" href="#/money">Geld öffnen</a></div>
      <div class="insight-list insight-list--accounts">
        ${accountRows.length
          ? accountRows.map((row)=>progressRow(row.account.name,money(row.account.current_balance,{currency:row.account.currency,locale,decimals:0}),row.share,escapeHtml(row.account.currency))).join('')
          : '<div class="table-empty">Noch keine liquiden Konten.</div>'}
      </div>
    </article>

    ${sectionHeading('Letzte Bewegungen','Die letzten echten Transaktionen','<a class="card-link" href="#/transactions">Alle ansehen</a>')}
    <article class="card card-padding">
      ${actualTransactions.length
        ? `<div class="list">${actualTransactions.slice(0,6).map((tx)=>transactionRow(tx,{locale})).join('')}</div>`
        : '<div class="table-empty">Noch keine gebuchten Transaktionen.</div>'}
    </article>
  `;
}
