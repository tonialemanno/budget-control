import { dataTable, formShell, metricCard, pageHeader, deleteButton, statusPill } from '../app/components.js';
import { dateLabel, escapeHtml, money } from '../app/format.js';
import { convertAmount, fxLabel } from '../app/fx.js';
import { icon } from '../app/icons.js';

export function renderDebts({ debts = [], household, profile, fxRates } = {}) {
  const currency = household?.base_currency || 'CHF';
  const locale = profile?.locale || 'de-CH';
  const fields = `
    <label class="field"><span>Name</span><input class="text-control" name="name" required placeholder="z. B. Autokredit"></label>
    <label class="field"><span>Gläubiger</span><input class="text-control" name="creditor" required></label>
    <label class="field"><span>Typ</span><select class="text-control" name="debtType"><option value="personal_loan">Privatkredit</option><option value="mortgage">Hypothek</option><option value="leasing">Leasing</option><option value="credit_card">Kreditkarte</option><option value="installment">Ratenkauf</option><option value="overdraft">Kontoüberziehung</option><option value="private">Private Schuld</option><option value="tax">Steuerschuld</option><option value="health_insurance">Krankenkassenschuld</option><option value="other">Sonstige</option></select></label>
    <label class="field"><span>Ursprünglicher Betrag</span><input class="text-control" name="originalAmount" type="number" min="0" step="0.01" required></label>
    <label class="field"><span>Restschuld</span><input class="text-control" name="outstandingAmount" type="number" min="0" step="0.01" required></label>
    <label class="field"><span>Zinssatz %</span><input class="text-control" name="interestRate" type="number" min="0" step="0.01" value="0"></label>
    <label class="field"><span>Rate</span><input class="text-control" name="installmentAmount" type="number" min="0" step="0.01" value="0"></label>
    <label class="field"><span>Nächste Zahlung</span><input class="text-control" name="nextPaymentDate" type="date"></label>`;
  const outstanding = debts.filter((d)=>d.status!=='paid').reduce((s,d)=>s+(convertAmount(d.outstanding_amount,d.currency||currency,currency,fxRates)??0),0);
  const monthly = debts.filter((d)=>d.status==='active'&&d.payment_cadence==='monthly').reduce((s,d)=>s+(convertAmount(d.installment_amount,d.currency||currency,currency,fxRates)??0),0);
  const rows = debts.map((d)=>`<tr><td><strong>${escapeHtml(d.name)}</strong><div class="table-meta">${escapeHtml(d.creditor)}</div></td><td>${money(d.outstanding_amount,{currency:d.currency||currency,locale})}</td><td>${Number(d.interest_rate||0).toFixed(2)} %</td><td>${money(d.installment_amount,{currency:d.currency||currency,locale})}</td><td>${dateLabel(d.next_payment_date,locale)}</td><td>${statusPill(d.status)}</td><td><div class="table-actions"><button class="table-action" type="button" data-action="debt-balance" data-id="${d.id}" data-current="${d.outstanding_amount}">Restschuld</button>${deleteButton('debts',d.id)}</div></td></tr>`);
  return `
    ${pageHeader({title:'Schulden & Kredite',subtitle:'Verbindlichkeiten bleiben eigene Finanzobjekte und werden nicht als negatives Bankkonto versteckt.',actions:`<button class="action-button action-button--primary" type="button" data-action="show-form" data-target="debt-create">${icon('plus')} Kredit / Schuld</button>`})}
    ${formShell('debt-create','Neue Schuld / Kredit','Restschuld, Zins und Rate erfassen',fields,{hidden:true,submitLabel:'Schuld speichern'})}
    <div class="metric-grid" style="margin-bottom:16px">${metricCard('Restschuld gesamt',money(outstanding,{currency,locale}),`${fxLabel(fxRates,currency)} · aktive und pausierte Schulden`)}${metricCard('Monatliche Raten',money(monthly,{currency,locale}),'monatlicher Zahlungsrhythmus')}${metricCard('Positionen',String(debts.length),'Kredite und Schulden')}</div>
    <article class="card card-padding">${dataTable({headers:['Schuld','Restschuld','Zins','Rate','Nächste Zahlung','Status',''],rows,emptyText:'Noch keine Schulden oder Kredite erfasst.'})}</article>`;
}
