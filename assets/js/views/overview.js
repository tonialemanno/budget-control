import { accountCard, metricCard, pageHeader, sectionHeading, transactionRow } from '../app/components.js';
import { money, moneyText, shortDate } from '../app/format.js';
import { icon } from '../app/icons.js';
import { fxLabel } from '../app/fx.js';
import { buildAccountProjection } from '../app/projections.js';
import { buildFinanceSnapshot } from '../app/finance-model.js';

export function renderOverview({
  accounts = [],
  transactions = [],
  debtPayments = [],
  recurringRules = [],
  budgets = [],
  bills = [],
  debts = [],
  receivables = [],
  assets = [],
  properties = [],
  vehicles = [],
  investments = [],
  pensions = [],
  household,
  profile,
  fxRates,
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
  const incomeCaption = snapshot.incomePlanSource==='recurring' ? 'geplant aus Wiederkehrend' : 'bisher gebucht';
  const actualTransactions=transactions.filter((tx)=>tx.status==='booked' && new Date(tx.occurred_at)<=now);

  return `
    ${pageHeader({
      kicker:shortDate(now,locale),
      title:`Hallo ${profile?.display_name?.split(' ')[0]||''}`.trim(),
      subtitle:'Dein Monat auf einen Blick: Geld, Einnahmen, Fixkosten, Planung und feste Umbuchungen.'
    })}

    ${hasForeign?`<div class="inline-alert inline-alert--success"><strong>FX aktiv.</strong><span>${fxLabel(fxRates,currency)}. Originalbeträge bleiben gespeichert.</span></div>`:''}

    <article class="card card--accent hero-card">
      <div>
        <div class="hero-label">Liquidität auf deinen Konten</div>
        <div class="hero-value">${money(snapshot.cash,{currency,locale,decimals:0})}</div>
        <div class="hero-caption">${accounts.length} Konto${accounts.length===1?'':'en'} · aktueller Stand</div>
      </div>
      <div class="hero-actions">
        <a class="action-button action-button--primary" href="#/transactions">${icon('plus')} Buchung erfassen</a>
        <a class="action-button action-button--secondary" href="#/fixed-costs">${icon('receipt')} Fixkosten</a>
      </div>
    </article>

    ${sectionHeading('Monatsplanung','Was kommt rein und was ist verplant?','<a class="card-link" href="#/intelligence">Finance Intelligence</a>')}
    <div class="metric-grid" style="margin-bottom:16px">
      ${metricCard('Einnahmen / Monat',money(snapshot.incomePlanMonthly,{currency,locale}),incomeCaption,'positive')}
      ${metricCard('Fixe Ausgaben / Monat',money(snapshot.fixedExpensesMonthly,{currency,locale}),'aktive Fixkosten')}
      ${metricCard('Weitere geplante Ausgaben',money(snapshot.plannedVariableMonthly,{currency,locale}),`Budgets ${moneyText(snapshot.variableBudgetMonthly,{currency,locale})} · bereits ausserhalb Budget ${moneyText(snapshot.unbudgetedActualVariableExpensesMonth,{currency,locale})} · zukünftig ausserhalb Budget ${moneyText(snapshot.unbudgetedFutureExpensesMonth,{currency,locale})}`)}
      ${metricCard('Fixe Umbuchungen / Monat',money(snapshot.fixedTransfersMonthly,{currency,locale}),'Sparen, Überschuss und andere Töpfe')}
    </div>

    ${sectionHeading('Mein Geld','UBS, ZAK, Revolut und weitere Konten','<a class="card-link" href="#/accounts">Konten verwalten</a>')}
    ${accounts.length?`<div class="grid-3">${accounts.slice(0,6).map((a)=>accountCard(a,{locale,canWrite:false,projection:buildAccountProjection(a,recurringRules)})).join('')}</div>`:`<div class="inline-alert"><strong>Noch kein Konto.</strong><span>Lege dein erstes Konto an.</span></div>`}

    <article class="card card-padding" style="margin-top:16px">
      <div class="card-heading">
        <div><h3 class="card-title">Letzte Bewegungen</h3><p class="card-subtitle">Die letzten echten Transaktionen</p></div>
        <a class="card-link" href="#/transactions">Alle</a>
      </div>
      ${actualTransactions.length?`<div class="list">${actualTransactions.slice(0,6).map((t)=>transactionRow(t,{locale})).join('')}</div>`:'<div class="table-empty">Noch keine gebuchten Transaktionen.</div>'}
    </article>
  `;
}
