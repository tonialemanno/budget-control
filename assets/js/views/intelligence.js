import { metricCard, pageHeader, sectionHeading } from '../app/components.js';
import { cadenceMonthlyFactor, money, percent } from '../app/format.js';
import { convertAmount, fxLabel } from '../app/fx.js';

export function renderIntelligence({ transactions = [], accounts = [], bills = [], contracts = [], debts = [], insurance = [], assets = [], properties = [], vehicles = [], investments = [], pensions = [], household, profile, fxRates } = {}) {
  const currency = household?.base_currency || 'CHF';
  const locale = profile?.locale || 'de-CH';
  const now = new Date(); const monthStart = new Date(now.getFullYear(), now.getMonth(), 1); const ninety = new Date(now); ninety.setDate(ninety.getDate()-90);
  const booked = transactions.filter((t)=>t.status==='booked'&&!t.transfer_group_id);
  const inBase=(value,curr)=>convertAmount(value,curr||currency,currency,fxRates)??0;
  const monthRows = booked.filter((t)=>new Date(t.occurred_at)>=monthStart);
  const income = monthRows.filter((t)=>Number(t.amount)>0).reduce((s,t)=>s+inBase(t.amount,t.currency),0);
  const expenses = monthRows.filter((t)=>Number(t.amount)<0).reduce((s,t)=>s+Math.abs(inBase(t.amount,t.currency)),0);
  const savingsRate = income>0 ? ((income-expenses)/income)*100 : 0;
  const cash = accounts.filter((a)=>['checking','savings','cash','wallet'].includes(a.account_type)).reduce((s,a)=>s+inBase(a.current_balance,a.currency),0);
  const trailingExpenses = booked.filter((t)=>new Date(t.occurred_at)>=ninety && Number(t.amount)<0).reduce((s,t)=>s+Math.abs(inBase(t.amount,t.currency)),0);
  const avgMonthlyExpenses = trailingExpenses/3; const runway = avgMonthlyExpenses>0 ? cash/avgMonthlyExpenses : 0;
  const monthlyContracts = contracts.filter((c)=>c.status==='active').reduce((s,c)=>s+inBase(Number(c.amount)*cadenceMonthlyFactor(c.billing_cadence),c.currency),0);
  const monthlyInsurance = insurance.filter((p)=>p.status==='active').reduce((s,p)=>s+inBase(Number(p.premium_amount)*cadenceMonthlyFactor(p.billing_cadence),p.currency),0);
  const monthlyDebt = debts.filter((d)=>d.status==='active'&&d.payment_cadence==='monthly').reduce((s,d)=>s+inBase(d.installment_amount,d.currency),0);
  const fixed = monthlyContracts+monthlyInsurance+monthlyDebt; const fixedRatio = income>0 ? fixed/income*100 : 0;
  const value=(rows,field)=>rows.reduce((s,a)=>s+inBase(a[field],a.currency),0);
  const totalAssets = cash+value(assets,'current_value')+value(properties,'current_value')+value(vehicles,'current_value')+value(investments,'current_value')+value(pensions,'current_value');
  const debtValue = debts.filter((d)=>d.status!=='paid').reduce((s,d)=>s+inBase(d.outstanding_amount,d.currency),0); const debtRatio = totalAssets>0 ? debtValue/totalAssets*100 : 0;
  const openBills = bills.filter((b)=>['open','overdue'].includes(b.status)).reduce((s,b)=>s+inBase(b.amount,b.currency),0); const forecast = cash + income - expenses - openBills;
  return `
    ${pageHeader({title:'Finance Intelligence',subtitle:`Analyse aus deinen eigenen Finance-Core-Daten · ${fxLabel(fxRates,currency)}.`})}
    <div class="grid-hero"><article class="card card--accent hero-card"><div><div class="hero-label">Runway</div><div class="hero-value">${runway.toFixed(1)} Monate</div><div class="hero-caption">Liquidität geteilt durch den Durchschnitt der letzten 90 Tage</div></div></article><div class="metric-grid">${metricCard('Cashflow Monat',money(income-expenses,{currency,locale}),'Einnahmen minus Ausgaben',income-expenses>=0?'positive':'warning')}${metricCard('Sparquote',percent(savingsRate,1,locale),'aktueller Monat')}${metricCard('Fixkostenquote',percent(fixedRatio,1,locale),'Verträge + Versicherungen + Raten')}${metricCard('Schuldenquote',percent(debtRatio,1,locale),'Restschuld / Vermögen')}</div></div>
    ${sectionHeading('Forecast','Vereinfachte operative Sicht')}
    <div class="metric-grid">${metricCard('Liquidität',money(cash,{currency,locale}),'heute')}${metricCard('Offene Rechnungen',money(openBills,{currency,locale}),'noch nicht bezahlt')}${metricCard('Projektion nach offenen Rechnungen',money(forecast,{currency,locale}),'vereinfachter Forecast')}</div>
    <article class="card card-padding" style="margin-top:16px"><div class="card-heading"><div><h3 class="card-title">Berechnungsbasis</h3><p class="card-subtitle">Transparente Formeln</p></div></div><div class="stack compact-copy"><p><strong>Runway:</strong> Liquidität / durchschnittliche Monatsausgaben der letzten 90 Tage.</p><p><strong>Sparquote:</strong> (Einnahmen − Ausgaben) / Einnahmen.</p><p><strong>Fixkostenquote:</strong> normalisierte Vertrags-, Versicherungs- und Kreditraten / Einnahmen.</p><p><strong>FX:</strong> Fremdwährungen werden mit dem geladenen Referenzkurs in die Haushalts-Basiswährung umgerechnet; Originalbeträge bleiben erhalten.</p></div></article>`;
}
