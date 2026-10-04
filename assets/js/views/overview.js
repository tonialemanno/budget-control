import { metricCard, pageHeader, sectionHeading, transactionRow } from '../app/components.js';
import { escapeHtml, money, monthLabel, shortDate } from '../app/format.js';
import { icon } from '../app/icons.js';
import { fxLabel } from '../app/fx.js';
import { buildFinanceSnapshot } from '../app/finance-model.js';
import { accountShare, annualIncomeSummary, budgetSummary, categorySpending, currentFinanceCycleTotals, financeCycleSeries } from '../app/finance-insights.js';
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
function localDay(value) {
  const date=value instanceof Date?value:new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}

function drilldownHref({from='',to='',category='',categories=[],query='',incomeKind='',period='custom'}={}) {
  const params=new URLSearchParams();
  if(period) params.set('period',period);
  params.set('view','details');
  if(from) params.set('from',from);
  if(to) params.set('to',to);
  if(category) params.set('category',category);
  if(categories.length) params.set('categories',categories.join(','));
  if(query) params.set('query',query);
  if(incomeKind) params.set('incomeKind',incomeKind);
  return `#/transactions?${params.toString()}`;
}


export function renderOverview({
  accounts = [], transactions = [], debtPayments = [], recurringRules = [], budgets = [], bills = [],
  debts = [], receivables = [], assets = [], properties = [], vehicles = [], investments = [], pensions = [],
  categories = [], merchants = [], household, profile, fxRates, privacyEnabled=false,
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
  const cycleTotals=currentFinanceCycleTotals({
    transactions,debtPayments,recurringRules,baseCurrency:currency,fxRates,now,fallbackDay:25,
  });
  const financeCycle=cycleTotals.cycle;
  const cycleLabel=financeCycleLabel(financeCycle,locale);
  const budget=budgetSummary({
    budgets,transactions,debtPayments,categories,merchants,recurringRules,baseCurrency:currency,fxRates,now,fallbackDay:25,
  });
  const months=financeCycleSeries({
    transactions,debtPayments,recurringRules,baseCurrency:currency,fxRates,now,cycles:6,fallbackDay:25,
  }).map((row)=>({
    ...row,
    href:drilldownHref({
      from:localDay(row.start),
      to:localDay(new Date(Math.min(now.getTime(),row.endExclusive.getTime()-1))),
    }),
  }));
  const categoryRows=categorySpending({
    transactions,debtPayments,categories,baseCurrency:currency,fxRates,now,limit:5,
    rangeStart:financeCycle.start,rangeEnd:financeCycle.endExclusive,
  });
  const cycleFrom=localDay(financeCycle.start);
  const cycleTo=localDay(new Date(Math.min(now.getTime(),financeCycle.endExclusive.getTime()-1)));
  const categoriesSpent=categoryRows.map((row)=>({
    ...row,
    href:row.key==='uncategorized'
      ? drilldownHref({from:cycleFrom,to:cycleTo,category:'uncategorized'})
      : row.key==='other'
        ? drilldownHref({from:cycleFrom,to:cycleTo,categories:row.categoryIds||[]})
        : drilldownHref({from:cycleFrom,to:cycleTo,category:row.key}),
  }));
  const annualIncome=annualIncomeSummary({transactions,baseCurrency:currency,fxRates,year:now.getFullYear()});
  const accountRows=accountShare(accounts,currency,fxRates).slice(0,4);
  const categoryTotal=categoriesSpent[0]?.total||0;

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
        <div class="card-heading"><div><h3 class="card-title">Variables Budget · Finanzmonat</h3><p class="card-subtitle">${budget.count ? `${budget.count} variable Position${budget.count===1?'':'en'} · ${budget.excludedFixedCount} Fixkosten separat · ${cycleLabel}` : 'Noch kein variables Budget eingerichtet'}</p></div><a class="card-link" href="#/budget">Berechnung</a></div>
        <div class="budget-ring-wrap">
          <a class="budget-ring" href="#/budget" style="--ring-progress:${budget.percent}" aria-label="Budgetberechnung öffnen"><div><strong>${Math.round(budget.rawPercent||0)}%</strong><span>${budget.overrun>0?'überschritten':'genutzt'}</span></div></a>
          <div class="budget-ring-copy">
            <span>Variables Budget <strong>${money(budget.total,{currency,locale,decimals:0})}</strong></span>
            <span>Variable Ausgaben <strong>${money(budget.spent,{currency,locale,decimals:0})}</strong></span>
            <span>${budget.overrun>0?'Überschritten':'Verfügbar'} <strong>${money(budget.overrun>0?budget.overrun:budget.remaining,{currency,locale,decimals:0})}</strong></span>
          </div>
        </div>
        ${!budget.count?'<a class="action-button action-button--secondary action-button--block" href="#/budget">Variables Budget einrichten</a>':''}
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

    <div class="overview-metric-strip">
      ${metricCard('Einnahmen · Finanzmonat',money(cycleTotals.income,{currency,locale,decimals:0}),cycleLabel,'positive')}
      ${metricCard('Ausgaben · Finanzmonat',money(cycleTotals.expenses,{currency,locale,decimals:0}),cycleLabel)}
      ${metricCard('Sparquote',`${Math.round(cycleTotals.savingsRate)}%`,'im aktuellen Finanzmonat',cycleTotals.savingsRate>=0?'positive':'warning')}
      ${metricCard('Noch geplant · Monat',money(snapshot.remainingPlannedExpensesMonth,{currency,locale,decimals:0}),'offene geplante Ausgaben')}
      ${metricCard('Runway',snapshot.runwayMonths>0?`${snapshot.runwayMonths.toFixed(1)} Monate`:'—','bei aktuellem Ausgabenniveau')}
    </div>

    <article class="card card-padding annual-income-card">
      <div class="card-heading">
        <div><h3 class="card-title">Einnahmen ${annualIncome.year}</h3><p class="card-subtitle">Verdienst wird getrennt von Rückerstattungen, Rückzahlungen und ungeklärten Eingängen gezeigt.</p></div>
        <a class="card-link" href="#/transactions?period=year&view=details">Alle Eingänge</a>
      </div>
      <div class="income-summary-grid">
        <a href="#/transactions?period=year&view=details&incomeKind=earned"><span>Verdient</span><strong>${money(annualIncome.earned,{currency,locale,decimals:0})}</strong></a>
        <a href="#/transactions?period=year&view=details&incomeKind=refund"><span>Rückerstattungen</span><strong>${money(annualIncome.refunds,{currency,locale,decimals:0})}</strong></a>
        <a href="#/transactions?period=year&view=details&incomeKind=repayment"><span>Rückzahlungen</span><strong>${money(annualIncome.repayments,{currency,locale,decimals:0})}</strong></a>
        <a href="#/transactions?period=year&view=details&incomeKind=unknown" class="${annualIncome.reviewCount?'income-summary-review':''}"><span>Ungeklärt</span><strong>${money(annualIncome.unknown,{currency,locale,decimals:0})}</strong><small>${annualIncome.reviewCount} Buchung${annualIncome.reviewCount===1?'':'en'} prüfen</small></a>
      </div>
      <div class="income-source-list">
        ${annualIncome.bySource.slice(0,6).map((row)=>`<a href="${escapeHtml(drilldownHref({period:'year',query:row.source,incomeKind:row.kind}))}"><div><strong>${escapeHtml(row.source)}</strong><small>${escapeHtml(row.label)} · ${row.count} Buchung${row.count===1?'':'en'}</small></div><span>${money(row.value,{currency,locale,decimals:0})}</span></a>`).join('')}
      </div>
    </article>

    <article class="card card-padding overview-account-card">
      <div class="card-heading"><div><h3 class="card-title">Wo dein Geld liegt</h3><p class="card-subtitle">Anteil deiner liquiden Konten</p></div><a class="card-link" href="#/money">Geld öffnen</a></div>
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
