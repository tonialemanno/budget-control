import { dataTable, formShell, metricCard, pageHeader, deleteButton, statusPill } from '../app/components.js';
import { cadenceMonthlyFactor, dateLabel, escapeHtml, money } from '../app/format.js';
import { icon } from '../app/icons.js';

export function renderInsurance({ insurance = [], household, profile } = {}) {
  const currency = household?.base_currency || 'CHF';
  const locale = profile?.locale || 'de-CH';
  const monthly = insurance.filter((p)=>p.status==='active').reduce((s,p)=>s+Number(p.premium_amount)*cadenceMonthlyFactor(p.billing_cadence),0);
  const fields = `
    <label class="field"><span>Versicherung</span><input class="text-control" name="name" required placeholder="z. B. Hausrat"></label>
    <label class="field"><span>Anbieter</span><input class="text-control" name="provider"></label>
    <label class="field"><span>Art</span><input class="text-control" name="policyType" placeholder="z. B. Krankenkasse"></label>
    <label class="field"><span>Prämie</span><input class="text-control" name="premiumAmount" type="number" min="0" step="0.01" required></label>
    <label class="field"><span>Rhythmus</span><select class="text-control" name="cadence"><option value="monthly">Monatlich</option><option value="quarterly">Quartalsweise</option><option value="semiannual">Halbjährlich</option><option value="annual">Jährlich</option></select></label>
    <label class="field"><span>Nächste Zahlung</span><input class="text-control" name="nextPaymentDate" type="date"></label>
    <label class="field"><span>Kündigungsfrist Tage</span><input class="text-control" name="noticeDays" type="number" min="0"></label>
    <label class="field"><span>Enddatum</span><input class="text-control" name="endDate" type="date"></label>`;
  const rows = insurance.map((p)=>`<tr><td><strong>${escapeHtml(p.name)}</strong><div class="table-meta">${escapeHtml(p.provider||p.policy_type||'')}</div></td><td>${money(p.premium_amount,{currency:p.currency||currency,locale})}</td><td>${escapeHtml(p.billing_cadence)}</td><td>${dateLabel(p.next_payment_date,locale)}</td><td>${statusPill(p.status)}</td><td>${deleteButton('insurance_policies',p.id)}</td></tr>`);
  return `
    ${pageHeader({title:'Versicherungen',subtitle:'Policen, Prämien, Zahlungsrhythmus, Laufzeit und Kündigungsfrist.',actions:`<button class="action-button action-button--primary" type="button" data-action="show-form" data-target="insurance-create">${icon('plus')} Versicherung</button>`})}
    ${formShell('insurance-create','Neue Versicherung','Police und Zahlungsdaten',fields,{hidden:true,submitLabel:'Versicherung speichern'})}
    <div class="metric-grid" style="margin-bottom:16px">${metricCard('Prämien / Monat',money(monthly,{currency,locale}),'normalisierte laufende Kosten')}${metricCard('Aktive Policen',String(insurance.filter((p)=>p.status==='active').length),'Versicherungen')}${metricCard('Gesamt',String(insurance.length),'inkl. beendet')}</div>
    <article class="card card-padding">${dataTable({headers:['Police','Prämie','Rhythmus','Nächste Zahlung','Status',''],rows,emptyText:'Noch keine Versicherungen.'})}</article>`;
}
