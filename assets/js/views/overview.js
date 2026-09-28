import { accountCard, metricCard, pageHeader, sectionHeading, transactionRow } from '../app/components.js';
import { cadenceMonthlyFactor, money, percent, shortDate } from '../app/format.js';
import { icon } from '../app/icons.js';

export function renderOverview({ accounts = [], transactions = [], budgets = [], bills = [], contracts = [], goals = [], debts = [], assets = [], properties = [], vehicles = [], investments = [], pensions = [], insurance = [], household, profile, depth='standard' } = {}) {
  const currency = household?.base_currency || 'CHF';
  const locale = profile?.locale || 'de-CH';
  const now = new Date();
  const monthKey = now.toISOString().slice(0,7);
  const monthTx = transactions.filter((t)=>String(t.occurred_at).slice(0,7)===monthKey && t.status==='booked' && !t.transfer_group_id && t.currency===currency);
  const income = monthTx.filter((t)=>Number(t.amount)>0).reduce((s,t)=>s+Number(t.amount),0);
  const expenses = Math.abs(monthTx.filter((t)=>Number(t.amount)<0).reduce((s,t)=>s+Number(t.amount),0));
  const cash = accounts.filter((a)=>['checking','savings','cash','wallet'].includes(a.account_type) && a.currency===currency).reduce((s,a)=>s+Number(a.current_balance||0),0);
  const hasForeign = accounts.some((a)=>a.currency!==currency) || transactions.some((t)=>t.currency!==currency);
  const openBills = bills.filter((b)=>['open','overdue'].includes(b.status)).reduce((s,b)=>s+Number(b.amount),0);
  const fixedMonthly = contracts.filter((c)=>c.status==='active').reduce((s,c)=>s+Number(c.amount)*cadenceMonthlyFactor(c.billing_cadence),0)
    + insurance.filter((p)=>p.status==='active').reduce((s,p)=>s+Number(p.premium_amount)*cadenceMonthlyFactor(p.billing_cadence),0)
    + debts.filter((d)=>d.status==='active'&&d.payment_cadence==='monthly').reduce((s,d)=>s+Number(d.installment_amount),0);
  const currentBudgets = budgets.filter((b)=>String(b.month_start).slice(0,7)===monthKey).reduce((s,b)=>s+Number(b.amount),0);
  const available = cash - openBills;
  const totalAssets = cash+assets.reduce((s,a)=>s+Number(a.current_value||0),0)+properties.reduce((s,a)=>s+Number(a.current_value||0),0)+vehicles.reduce((s,a)=>s+Number(a.current_value||0),0)+investments.reduce((s,a)=>s+Number(a.current_value||0),0)+pensions.reduce((s,a)=>s+Number(a.current_value||0),0);
  const debtValue = debts.filter((d)=>d.status!=='paid').reduce((s,d)=>s+Number(d.outstanding_amount||0),0);
  const netWorth = totalAssets-debtValue;
  const savingsRate = income>0?(income-expenses)/income*100:0;

  return `
    ${pageHeader({kicker:shortDate(new Date(),locale),title:`Hallo ${profile?.display_name?.split(' ')[0]||''}`.trim(),subtitle:'Das ist dein aktueller Finance-Core-Stand. Gesamtsummen werden nur in der Basiswährung berechnet.'})}
    ${hasForeign?`<div class="inline-alert"><strong>Fremdwährungen separat.</strong><span>EUR/USD/GBP-Konten und -Buchungen werden ohne verlässlichen FX-Kurs nicht in ${currency}-Gesamtsummen eingerechnet.</span></div>`:''}
    <div class="grid-hero">
      <article class="card card--accent hero-card"><div><div class="hero-label">Verfügbar nach offenen Rechnungen</div><div class="hero-value">${money(available,{currency,locale,decimals:0})}</div><div class="hero-caption">Liquidität ${money(cash,{currency,locale})} · offene Rechnungen ${money(openBills,{currency,locale})}</div></div><div class="hero-actions"><a class="action-button action-button--primary" href="#/transactions">${icon('plus')} Buchung erfassen</a><a class="action-button action-button--secondary" href="#/accounts">${icon('wallet')} Konten</a></div></article>
      <div class="metric-grid">
        ${metricCard('Einnahmen Monat',money(income,{currency,locale}),'gebuchte Einnahmen')}
        ${metricCard('Ausgaben Monat',money(expenses,{currency,locale}),'gebuchte Ausgaben')}
        ${depth==='simple'?'':metricCard('Sparquote',percent(savingsRate,1,locale),'aktueller Monat')}
        ${depth==='expert'?metricCard('Fixe Verpflichtungen',money(fixedMonthly,{currency,locale}),'pro Monat normalisiert'):''}
      </div>
    </div>
    ${sectionHeading('Mein Geld','Konten und Bargeld','<a class="card-link" href="#/accounts">Konten verwalten</a>')}
    ${accounts.length?`<div class="grid-3">${accounts.slice(0,6).map((a)=>accountCard(a,{locale,canWrite:false})).join('')}</div>`:`<div class="inline-alert"><strong>Noch kein Konto.</strong><span>Lege dein erstes Konto an, um mit echten Daten zu arbeiten.</span></div>`}
    <div class="grid-main-aside" style="margin-top:16px">
      <article class="card card-padding"><div class="card-heading"><div><h3 class="card-title">Letzte Bewegungen</h3><p class="card-subtitle">Die letzten echten Transaktionen</p></div><a class="card-link" href="#/transactions">Alle</a></div>${transactions.length?`<div class="list">${transactions.slice(0,6).map((t)=>transactionRow(t,{locale})).join('')}</div>`:'<div class="table-empty">Noch keine Transaktionen.</div>'}</article>
      <div class="stack">
        ${metricCard('Nettovermögen',money(netWorth,{currency,locale}),'Vermögen minus Schulden')}
        ${metricCard('Monatsbudget',money(currentBudgets,{currency,locale}),'Summe der Kategorie-Budgets')}
        ${metricCard('Sparziele',String(goals.filter((g)=>g.status==='active').length),'aktive Ziele')}
      </div>
    </div>`;
}
