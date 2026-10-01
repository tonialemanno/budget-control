import { accountCard, metricCard, pageHeader, sectionHeading, transactionRow } from '../app/components.js';
import { cadenceMonthlyFactor, localMonthKey, money, percent, shortDate } from '../app/format.js';
import { icon } from '../app/icons.js';
import { convertAmount, fxLabel } from '../app/fx.js';
import { buildDebtPaymentTransactionMap, consumptionExpenseBase, debtPrincipalBase } from '../app/financial-effects.js';

export function renderOverview({ accounts = [], transactions = [], debtPayments = [], budgets = [], bills = [], contracts = [], goals = [], debts = [], receivables = [], assets = [], properties = [], vehicles = [], investments = [], pensions = [], insurance = [], household, profile, depth='standard', fxRates } = {}) {
  const currency = household?.base_currency || 'CHF';
  const locale = profile?.locale || 'de-CH';
  const now = new Date();
  const monthKey = localMonthKey(now);
  const monthTx = transactions.filter((t)=>localMonthKey(t.occurred_at)===monthKey && t.status==='booked' && !t.transfer_group_id);
  const paymentMap=buildDebtPaymentTransactionMap(debtPayments);
  const income = monthTx.filter((t)=>Number(t.amount)>0&&t.cashflow_type!=='receivable_principal').reduce((s,t)=>s+(convertAmount(t.amount,t.currency,currency,fxRates)??0),0);
  const expenses = monthTx.reduce((s,t)=>s+consumptionExpenseBase(t,paymentMap,currency,fxRates),0);
  const debtPrincipalMonth = monthTx.reduce((s,t)=>s+debtPrincipalBase(t,paymentMap,currency,fxRates),0);
  const cash = accounts.filter((a)=>['checking','savings','cash','wallet'].includes(a.account_type)).reduce((s,a)=>s+(convertAmount(a.current_balance,a.currency,currency,fxRates)??0),0);
  const hasForeign = accounts.some((a)=>a.currency!==currency) || transactions.some((t)=>t.currency!==currency);
  const openBills = bills.filter((b)=>['open','overdue'].includes(b.status)).reduce((s,b)=>s+(convertAmount(b.amount,b.currency||currency,currency,fxRates)??0),0);
  const fixedMonthly = contracts.filter((c)=>c.status==='active').reduce((s,c)=>s+(convertAmount(Number(c.amount)*cadenceMonthlyFactor(c.billing_cadence),c.currency||currency,currency,fxRates)??0),0)
    + insurance.filter((p)=>p.status==='active').reduce((s,p)=>s+(convertAmount(Number(p.premium_amount)*cadenceMonthlyFactor(p.billing_cadence),p.currency||currency,currency,fxRates)??0),0)
    + debts.filter((d)=>d.status==='active'&&d.payment_cadence==='monthly').reduce((s,d)=>s+(convertAmount(d.installment_amount,d.currency||currency,currency,fxRates)??0),0);
  const currentBudgets = budgets.filter((b)=>String(b.month_start).slice(0,7)===monthKey).reduce((s,b)=>s+Number(b.amount),0);
  const available = cash - openBills;
  const value=(rows,field)=>rows.reduce((s,a)=>s+(convertAmount(a[field],a.currency||currency,currency,fxRates)??0),0);
  const receivableValue=receivables.filter((r)=>!['paid','written_off'].includes(r.status)).reduce((s,r)=>s+(convertAmount(r.outstanding_amount,r.currency||currency,currency,fxRates)??0),0);
  const totalAssets = cash+value(assets,'current_value')+value(properties,'current_value')+value(vehicles,'current_value')+value(investments,'current_value')+value(pensions,'current_value')+receivableValue;
  const debtValue = debts.filter((d)=>d.status!=='paid').reduce((s,d)=>s+(convertAmount(d.outstanding_amount,d.currency||currency,currency,fxRates)??0),0);
  const netWorth = totalAssets-debtValue;
  const savingsRate = income>0?(income-expenses)/income*100:0;
  const savingsAccountIds=new Set(accounts.filter((a)=>a.account_type==='savings').map((a)=>a.account_id));
  const savedThisMonth=transactions.filter((t)=>localMonthKey(t.occurred_at)===monthKey&&t.transfer_group_id&&Number(t.amount)>0&&savingsAccountIds.has(t.account_id)).reduce((s,t)=>s+(convertAmount(t.amount,t.currency,currency,fxRates)??0),0);
  return `
    ${pageHeader({kicker:shortDate(new Date(),locale),title:`Hallo ${profile?.display_name?.split(' ')[0]||''}`.trim(),subtitle:'Das ist dein aktueller Finance-Core-Stand. Fremdwährungen werden über die verlässliche FX-Schicht in die Basiswährung umgerechnet.'})}
    ${hasForeign?`<div class="inline-alert inline-alert--success"><strong>FX aktiv.</strong><span>${fxLabel(fxRates,currency)}. Originalbeträge bleiben gespeichert.</span></div>`:''}
    <div class="grid-hero">
      <article class="card card--accent hero-card"><div><div class="hero-label">Verfügbar nach offenen Rechnungen</div><div class="hero-value">${money(available,{currency,locale,decimals:0})}</div><div class="hero-caption">Liquidität ${money(cash,{currency,locale})} · offene Rechnungen ${money(openBills,{currency,locale})}</div></div><div class="hero-actions"><a class="action-button action-button--primary" href="#/transactions">${icon('plus')} Buchung erfassen</a><a class="action-button action-button--secondary" href="#/accounts">${icon('wallet')} Konten</a></div></article>
      <div class="metric-grid">
        ${metricCard('Einnahmen Monat',money(income,{currency,locale}),'gebuchte Einnahmen')}
        ${metricCard('Ausgaben Monat',money(expenses,{currency,locale}),'Konsum, Zins & Gebühren')}
        ${depth==='expert'&&debtPrincipalMonth>0?metricCard('Schuldentilgung',money(debtPrincipalMonth,{currency,locale}),'reduziert Verbindlichkeiten, nicht Konsum'):''}
        ${depth==='simple'?'':metricCard('Sparquote',percent(savingsRate,1,locale),'aktueller Monat')}
        ${depth==='expert'?metricCard('Fixe Verpflichtungen',money(fixedMonthly,{currency,locale}),'pro Monat normalisiert'):''}${depth==='simple'?'':metricCard('Sparen',money(savedThisMonth,{currency,locale}),'Umbuchungen auf Sparkonten','positive')}
      </div>
    </div>
    ${sectionHeading('Mein Geld','Konten und Bargeld','<a class="card-link" href="#/accounts">Konten verwalten</a>')}
    ${accounts.length?`<div class="grid-3">${accounts.slice(0,6).map((a)=>accountCard(a,{locale,canWrite:false})).join('')}</div>`:`<div class="inline-alert"><strong>Noch kein Konto.</strong><span>Lege dein erstes Konto an, um mit echten Daten zu arbeiten.</span></div>`}
    <div class="grid-main-aside" style="margin-top:16px">
      <article class="card card-padding"><div class="card-heading"><div><h3 class="card-title">Letzte Bewegungen</h3><p class="card-subtitle">Die letzten echten Transaktionen</p></div><a class="card-link" href="#/transactions">Alle</a></div>${transactions.length?`<div class="list">${transactions.slice(0,6).map((t)=>transactionRow(t,{locale})).join('')}</div>`:'<div class="table-empty">Noch keine Transaktionen.</div>'}</article>
      <div class="stack">
        ${metricCard('Nettovermögen',money(netWorth,{currency,locale}),'Vermögen minus Schulden')}
        ${metricCard('Monatsbudget',money(currentBudgets,{currency,locale}),'Summe der Monatsbudgets')}
        ${metricCard('Sparziele',String(goals.filter((g)=>g.status==='active').length),'aktive Ziele')}
      </div>
    </div>`;
}
