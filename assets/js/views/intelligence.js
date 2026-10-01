import { metricCard, pageHeader, sectionHeading } from '../app/components.js';
import { money, moneyText, percent } from '../app/format.js';
import { fxLabel } from '../app/fx.js';
import { buildFinanceSnapshot } from '../app/finance-model.js';

export function renderIntelligence({
  transactions = [],
  debtPayments = [],
  accounts = [],
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
  const snapshot = buildFinanceSnapshot({
    accounts, transactions, debtPayments, recurringRules, budgets, bills, debts,
    receivables, assets, properties, vehicles, investments, pensions,
    household, fxRates,
  });
  const currency = snapshot.currency;
  const planTone = snapshot.plannedFreeMonthly >= 0 ? 'positive' : 'warning';

  return `
    ${pageHeader({
      title:'Finance Intelligence',
      subtitle:`Eine gemeinsame Sicht aus Konten, Buchungen, Fixkosten, Budgets, Rechnungen, Forderungen, Vermögen und Schulden · ${fxLabel(fxRates,currency)}.`
    })}

    <div class="grid-hero">
      <article class="card card--accent hero-card">
        <div>
          <div class="hero-label">Monatsplan nach allem Geplanten</div>
          <div class="hero-value">${money(snapshot.plannedFreeMonthly,{currency,locale})}</div>
          <div class="hero-caption">
            Einnahmen ${money(snapshot.incomePlanMonthly,{currency,locale})}
            · Fixkosten ${money(snapshot.fixedExpensesMonthly,{currency,locale})}
            · weitere Planung ${money(snapshot.plannedVariableMonthly,{currency,locale})}
            · Umbuchungen ${money(snapshot.fixedTransfersMonthly,{currency,locale})}
          </div>
        </div>
      </article>
      <div class="metric-grid">
        ${metricCard('Einnahmen / Monat',money(snapshot.incomePlanMonthly,{currency,locale}),snapshot.incomePlanSource==='recurring'?'aus Wiederkehrend':'bisher gebucht','positive')}
        ${metricCard('Fixe Ausgaben / Monat',money(snapshot.fixedExpensesMonthly,{currency,locale}),'aus Fixkosten / Wiederkehrend')}
        ${metricCard('Variabler Monatsplan',money(snapshot.plannedVariableMonthly,{currency,locale}),`Budgetplan ${moneyText(snapshot.budgetTrackedPlanMonth,{currency,locale})} · bereits ausserhalb Budget ${moneyText(snapshot.unbudgetedActualVariableExpensesMonth,{currency,locale})} · künftig ausserhalb Budget ${moneyText(snapshot.unbudgetedFutureExpensesMonth,{currency,locale})} · offene Rechnungen ${moneyText(snapshot.unbudgetedOpenBillsMonth,{currency,locale})}`)}
        ${metricCard('Davon noch ausstehend',money(snapshot.remainingPlannedExpensesMonth,{currency,locale}),`Restbudget ${moneyText(snapshot.remainingVariableBudgetMonth,{currency,locale})} · zukünftige Einzelbuchungen und fällige Rechnungen`)}
        ${metricCard('Fixe Umbuchungen / Monat',money(snapshot.fixedTransfersMonthly,{currency,locale}),'Töpfe und Sparen')}
      </div>
    </div>

    ${sectionHeading('Liquidität','Was ist heute tatsächlich vorhanden?')}
    <div class="metric-grid">
      ${metricCard('Liquidität',money(snapshot.cash,{currency,locale}),'Kontostände heute')}
      ${metricCard('Offene Rechnungen',money(snapshot.openBills,{currency,locale}),'offen oder überfällig')}
      ${metricCard('Nach offenen Rechnungen',money(snapshot.cashAfterOpenBills,{currency,locale}),'Liquidität minus offene Rechnungen',snapshot.cashAfterOpenBills>=0?'positive':'warning')}
      ${metricCard('Runway',`${snapshot.runwayMonths.toFixed(1)} Monate`,'Liquidität / Ø Konsumausgaben der letzten 90 Tage')}
    </div>

    ${sectionHeading('Tatsächlicher Monat','Was wurde bereits wirklich gebucht?')}
    <div class="metric-grid">
      ${metricCard('Gebuchte Einnahmen',money(snapshot.actualIncomeMonth,{currency,locale}),'aktueller Monat','positive')}
      ${metricCard('Gebuchte Ausgaben',money(snapshot.actualExpensesMonth,{currency,locale}),'Konsum, Zins und Gebühren')}
      ${metricCard('Cashflow Monat',money(snapshot.actualCashflowMonth,{currency,locale}),'gebuchte Einnahmen minus Ausgaben',snapshot.actualCashflowMonth>=0?'positive':'warning')}
      ${metricCard('Sparquote',percent(snapshot.savingsRate,1,locale),'aus tatsächlichen Buchungen')}
    </div>

    ${sectionHeading('Vermögen & Verpflichtungen','Konten und Module zusammengeführt')}
    <div class="metric-grid">
      ${metricCard('Nettovermögen',money(snapshot.netWorth,{currency,locale}),'Vermögen inklusive Forderungen minus Schulden',snapshot.netWorth>=0?'positive':'warning')}
      ${metricCard('Offene Forderungen',money(snapshot.receivablesOutstanding,{currency,locale}),'noch zu erhalten')}
      ${metricCard('Restschulden',money(snapshot.debtValue,{currency,locale}),'offene Verbindlichkeiten')}
      ${metricCard('Schuldenquote',percent(snapshot.debtRatio,1,locale),'Restschuld / gesamtes Vermögen')}
      ${metricCard('Fixkostenquote',percent(snapshot.fixedCostRatio,1,locale),'Fixkosten / geplante Einnahmen')}
    </div>

    <article class="card card-padding" style="margin-top:16px">
      <div class="card-heading">
        <div>
          <h3 class="card-title">Was Finance Intelligence jetzt verbindet</h3>
          <p class="card-subtitle">Eine Eingabe wird dort berücksichtigt, wo sie finanziell hingehört.</p>
        </div>
      </div>
      <div class="stack compact-copy">
        <p><strong>Konten & Umbuchungen:</strong> bestimmen echte Liquidität; interne Umbuchungen verändern nicht deine Ausgaben oder dein Vermögen.</p>
        <p><strong>Wiederkehrend / Fixkosten:</strong> liefert geplante Einnahmen, feste Ausgaben und feste Umbuchungen auf Töpfe.</p>
        <p><strong>Budget:</strong> ist der variable Monatsrahmen. Bereits verbrauchte Beträge reduzieren nur den noch verfügbaren Rest; Überschreitungen bleiben im vollständigen Monatsplan sichtbar.</p>
        <p><strong>Rechnungen:</strong> reduzieren die Liquidität solange sie offen sind. Fällige oder überfällige Rechnungen fliessen zusätzlich in „noch ausstehend“ ein, sofern sie nicht bereits durch Fixkosten, Budget oder eine zukünftige Buchung abgedeckt sind.</p>
        <p><strong>Forderungen:</strong> zählen zum Vermögen, bis sie bezahlt oder abgeschrieben sind.</p>
        <p><strong>Schulden:</strong> reduzieren das Nettovermögen; gebuchte Tilgung zählt nicht als Konsumausgabe.</p>
        <p><strong>Runway & Sparquote:</strong> basieren weiterhin auf tatsächlich gebuchten Transaktionen, nicht auf Planung.</p>
      </div>
    </article>
  `;
}
