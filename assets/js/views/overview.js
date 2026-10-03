import { metricCard, pageHeader, sectionHeading, transactionRow } from '../app/components.js';
import { escapeHtml, money, shortDate } from '../app/format.js';
import { icon } from '../app/icons.js';
import { fxLabel } from '../app/fx.js';
import { buildFinanceSnapshot } from '../app/finance-model.js';
import { accountShare, budgetSummary, categorySpending, monthSeries } from '../app/finance-insights.js';

function pct(value) {
  return Math.max(0, Math.min(100, Number(value)||0));
}

function monthName(date, locale) {
  try { return new Intl.DateTimeFormat(locale,{month:'short'}).format(date).replace('.',''); }
  catch { return String(date.getMonth()+1); }
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
  categories = [], household, profile, fxRates,
} = {}) {
  const locale = profile?.locale || 'de-CH';
  const now = new Date();
  const snapshot = buildFinanceSnapshot({
    accounts, transactions, debtPayments, recurringRules, budgets, bills, debts,
    receivables, assets, properties, vehicles, investments, pensions,
    household, fxRates, now,
  });
  const currency = snapshot.currency;
  const hasForeign = accounts.some((a)=>a.currency!==currency) || transactions.some((t)=>t.currency!==currency);
  const actualTransactions=transactions.filter((tx)=>tx.status==='booked' && new Date(tx.occurred_at)<=now);
  const budget=budgetSummary({budgets,transactions,debtPayments,categories,baseCurrency:currency,fxRates,now});
  const months=monthSeries({transactions,debtPayments,baseCurrency:currency,fxRates,now,months:6});
  const categoriesSpent=categorySpending({transactions,debtPayments,categories,baseCurrency:currency,fxRates,now,limit:5});
  const accountRows=accountShare(accounts,currency,fxRates).slice(0,4);
  const maxMonth=Math.max(1,...months.flatMap((row)=>[row.income,row.expenses]));

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
      subtitle:'Deine Finanzen auf einen Blick. Alle Werte stammen aus denselben Konten und Transaktionen.'
    })}

    ${hasForeign?`<div class="inline-alert inline-alert--success"><strong>Mehrere Währungen aktiv.</strong><span>${fxLabel(fxRates,currency)}. Originalbeträge bleiben auf den Konten erhalten.</span></div>`:''}

    <div class="overview-hero-grid">
      <article class="card card--accent finance-balance-card">
        <div class="finance-balance-top">
          <div><span class="hero-label">Verfügbares Geld</span><div class="hero-value">${money(snapshot.cash,{currency,locale,decimals:0})}</div><span class="hero-caption">${accounts.length} ${accounts.length===1?'Konto':'Konten'} · aktueller Stand</span></div>
          <span class="finance-hero-icon">${icon('wallet')}</span>
        </div>
        <div class="finance-balance-actions">
          <a class="action-button action-button--primary" href="#/transactions?create=expense">${icon('plus')} Ausgabe</a>
          <a class="action-button action-button--secondary" href="#/transactions?create=income">Einnahme</a>
          <a class="action-button action-button--secondary" href="#/transactions?create=transfer">Umbuchung</a>
        </div>
        <div class="finance-balance-foot">
          <span>Nettovermögen <strong>${money(snapshot.netWorth,{currency,locale,decimals:0})}</strong></span>
          <span>Monatlich frei <strong>${money(snapshot.plannedFreeMonthly,{currency,locale,decimals:0})}</strong></span>
        </div>
      </article>

      <article class="card card-padding budget-ring-card">
        <div class="card-heading"><div><h3 class="card-title">Monatsbudget</h3><p class="card-subtitle">${budget.count?'Aus deinen Budgetregeln':'Noch kein Budget eingerichtet'}</p></div><a class="card-link" href="#/budget">Öffnen</a></div>
        <div class="budget-ring-wrap">
          <div class="budget-ring" style="--ring-progress:${budget.percent}"><div><strong>${Math.round(budget.percent)}%</strong><span>genutzt</span></div></div>
          <div class="budget-ring-copy">
            <span>Geplant <strong>${money(budget.total,{currency,locale,decimals:0})}</strong></span>
            <span>Verbraucht <strong>${money(budget.spent,{currency,locale,decimals:0})}</strong></span>
            <span>Verfügbar <strong>${money(budget.remaining,{currency,locale,decimals:0})}</strong></span>
          </div>
        </div>
        ${!budget.count?'<a class="action-button action-button--secondary action-button--block" href="#/budget">Budget einrichten</a>':''}
      </article>
    </div>

    <div class="overview-metric-strip">
      ${metricCard('Einnahmen · Monat',money(snapshot.actualIncomeMonth,{currency,locale,decimals:0}),'gebuchte Einnahmen','positive')}
      ${metricCard('Ausgaben · Monat',money(snapshot.actualExpensesMonth,{currency,locale,decimals:0}),'echter Konsum')}
      ${metricCard('Sparquote',`${Math.round(snapshot.savingsRate)}%`,'aus gebuchten Bewegungen',snapshot.savingsRate>=0?'positive':'warning')}
      ${metricCard('Runway',snapshot.runwayMonths>0?`${snapshot.runwayMonths.toFixed(1)} Monate`:'—','bei aktuellem Ausgabenniveau')}
    </div>

    ${sectionHeading('Entwicklung','Einnahmen und Ausgaben der letzten sechs Monate')}
    <article class="card card-padding finance-chart-card">
      <div class="chart-legend"><span><i class="legend-dot legend-dot--income"></i>Einnahmen</span><span><i class="legend-dot legend-dot--expense"></i>Ausgaben</span></div>
      <div class="month-bars">
        ${months.map((row)=>`<div class="month-bar-group">
          <div class="month-bar-values"><span title="${money(row.income,{currency,locale})}" style="--bar-height:${Math.max(2,row.income/maxMonth*100)}%" class="month-bar month-bar--income"></span><span title="${money(row.expenses,{currency,locale})}" style="--bar-height:${Math.max(2,row.expenses/maxMonth*100)}%" class="month-bar month-bar--expense"></span></div>
          <small>${escapeHtml(monthName(row.date,locale))}</small>
        </div>`).join('')}
      </div>
    </article>

    <div class="grid-main-aside overview-insights-grid">
      <article class="card card-padding">
        <div class="card-heading"><div><h3 class="card-title">Wofür dein Geld geht</h3><p class="card-subtitle">Top-Kategorien im aktuellen Monat</p></div><a class="card-link" href="#/transactions">Details</a></div>
        <div class="insight-list">
          ${categoriesSpent.length
            ? categoriesSpent.map((row)=>progressRow(row.label,money(row.value,{currency,locale,decimals:0}),row.share,`${Math.round(row.share)}% der Top-Kategorien`)).join('')
            : '<div class="table-empty">Noch keine Ausgaben in diesem Monat.</div>'}
        </div>
      </article>

      <article class="card card-padding">
        <div class="card-heading"><div><h3 class="card-title">Wo dein Geld liegt</h3><p class="card-subtitle">Anteil deiner liquiden Konten</p></div><a class="card-link" href="#/money">Geld öffnen</a></div>
        <div class="insight-list">
          ${accountRows.length
            ? accountRows.map((row)=>progressRow(row.account.name,money(row.account.current_balance,{currency:row.account.currency,locale,decimals:0}),row.share,escapeHtml(row.account.currency))).join('')
            : '<div class="table-empty">Noch keine liquiden Konten.</div>'}
        </div>
      </article>
    </div>

    ${sectionHeading('Letzte Bewegungen','Die letzten echten Transaktionen','<a class="card-link" href="#/transactions">Alle ansehen</a>')}
    <article class="card card-padding">
      ${actualTransactions.length
        ? `<div class="list">${actualTransactions.slice(0,6).map((tx)=>transactionRow(tx,{locale})).join('')}</div>`
        : '<div class="table-empty">Noch keine gebuchten Transaktionen.</div>'}
    </article>
  `;
}
