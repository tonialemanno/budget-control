import { accountCard, metricCard, pageHeader, sectionHeading, transactionRow } from '../app/components.js';
import { cadenceMonthlyFactor, localMonthKey, money, shortDate } from '../app/format.js';
import { icon } from '../app/icons.js';
import { convertAmount, fxLabel } from '../app/fx.js';

export function renderOverview({ accounts = [], transactions = [], recurringRules = [], budgets = [], household, profile, fxRates } = {}) {
  const currency = household?.base_currency || 'CHF';
  const locale = profile?.locale || 'de-CH';
  const now = new Date();
  const today = now.toISOString().slice(0,10);
  const monthKey = localMonthKey(now);

  const cash = accounts
    .filter((a)=>['checking','savings','cash','wallet'].includes(a.account_type))
    .reduce((s,a)=>s+(convertAmount(a.current_balance,a.currency,currency,fxRates)??0),0);

  const hasForeign = accounts.some((a)=>a.currency!==currency) || transactions.some((t)=>t.currency!==currency);
  const activeRecurring = recurringRules.filter((r)=>r.active && (!r.end_date || String(r.end_date).slice(0,10)>=today));
  const monthlyValue = (rules) => rules.reduce((sum,r)=>{
    const normalized = Number(r.amount||0) * cadenceMonthlyFactor(r.cadence);
    return sum + (convertAmount(normalized,r.currency||currency,currency,fxRates) ?? 0);
  },0);

  const plannedIncome = monthlyValue(activeRecurring.filter((r)=>r.direction==='income'));
  const fixedExpenses = monthlyValue(activeRecurring.filter((r)=>r.direction==='expense'));
  const fixedTransfers = monthlyValue(activeRecurring.filter((r)=>r.direction==='transfer'));
  const fixedCategoryIds = new Set(activeRecurring.filter((r)=>r.direction==='expense' && r.category_id).map((r)=>r.category_id));

  const plannedVariable = budgets
    .filter((b)=>String(b.month_start).slice(0,7)===monthKey)
    .filter((b)=>!b.category_id || !fixedCategoryIds.has(b.category_id))
    .reduce((s,b)=>s+Number(b.amount||0),0);

  const bookedIncome = transactions
    .filter((t)=>localMonthKey(t.occurred_at)===monthKey && t.status==='booked' && !t.transfer_group_id && Number(t.amount)>0 && t.cashflow_type!=='receivable_principal')
    .reduce((s,t)=>s+(convertAmount(t.amount,t.currency,currency,fxRates)??0),0);

  const incomeValue = plannedIncome > 0 ? plannedIncome : bookedIncome;
  const incomeCaption = plannedIncome > 0 ? 'geplant aus Wiederkehrend' : 'bisher gebucht';

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
        <div class="hero-value">${money(cash,{currency,locale,decimals:0})}</div>
        <div class="hero-caption">${accounts.length} Konto${accounts.length===1?'':'en'} · aktueller Stand</div>
      </div>
      <div class="hero-actions">
        <a class="action-button action-button--primary" href="#/transactions">${icon('plus')} Buchung erfassen</a>
        <a class="action-button action-button--secondary" href="#/fixed-costs">${icon('receipt')} Fixkosten</a>
      </div>
    </article>

    ${sectionHeading('Monatsplanung','Was kommt rein und was ist verplant?','<a class="card-link" href="#/fixed-costs">Fixkosten bearbeiten</a>')}
    <div class="metric-grid" style="margin-bottom:16px">
      ${metricCard('Einnahmen / Monat',money(incomeValue,{currency,locale}),incomeCaption,'positive')}
      ${metricCard('Fixe Ausgaben / Monat',money(fixedExpenses,{currency,locale}),'aktive Fixkosten')}
      ${metricCard('Weitere geplante Ausgaben',money(plannedVariable,{currency,locale}),'Monatsbudgets ohne Fixkosten')}
      ${metricCard('Fixe Umbuchungen / Monat',money(fixedTransfers,{currency,locale}),'Sparen, Überschuss und andere Töpfe')}
    </div>

    ${sectionHeading('Mein Geld','UBS, ZAK, Revolut und weitere Konten','<a class="card-link" href="#/accounts">Konten verwalten</a>')}
    ${accounts.length?`<div class="grid-3">${accounts.slice(0,6).map((a)=>accountCard(a,{locale,canWrite:false})).join('')}</div>`:`<div class="inline-alert"><strong>Noch kein Konto.</strong><span>Lege dein erstes Konto an.</span></div>`}

    <article class="card card-padding" style="margin-top:16px">
      <div class="card-heading">
        <div><h3 class="card-title">Letzte Bewegungen</h3><p class="card-subtitle">Die letzten echten Transaktionen</p></div>
        <a class="card-link" href="#/transactions">Alle</a>
      </div>
      ${transactions.length?`<div class="list">${transactions.slice(0,6).map((t)=>transactionRow(t,{locale})).join('')}</div>`:'<div class="table-empty">Noch keine Transaktionen.</div>'}
    </article>
  `;
}
