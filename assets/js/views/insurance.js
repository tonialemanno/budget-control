import { dataTable, formShell, metricCard, pageHeader, deleteButton, statusPill, filePicker } from '../app/components.js';
import { cadenceMonthlyFactor, dateLabel, escapeHtml, money } from '../app/format.js';
import { convertAmount } from '../app/fx.js';
import { effectiveNextDate } from '../app/recurrence.js';
import { icon } from '../app/icons.js';

function formFields(accounts,categories,{edit=false,countryCode='CH',baseCurrency='CHF'}={}) {
  const p=edit?'insuranceEdit':'';
  const accountOptions=accounts.map((a)=>`<option value="${a.account_id}">${escapeHtml(a.name)} · ${escapeHtml(a.currency)}</option>`).join('');
  const categoryOptions=categories.filter((c)=>c.kind==='expense').map((c)=>`<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
  const policyTypeExample=countryCode==='DE'?'z. B. Krankenversicherung, Haftpflicht, Hausrat':'z. B. Krankenkasse, Haftpflicht, Hausrat';
  const currencyOptions=['CHF','EUR','USD','GBP'].map((code)=>`<option value="${code}" ${code===baseCurrency?'selected':''}>${code}</option>`).join('');
  return `${edit?'<input type="hidden" name="insuranceId" id="insuranceEditId">':''}
    <label class="field"><span>Versicherung</span><input class="text-control" name="name" ${edit?`id="${p}Name"`:''} required placeholder="z. B. Hausrat"></label>
    <label class="field"><span>Anbieter</span><input class="text-control" name="provider" ${edit?`id="${p}Provider"`:''}></label>
    <label class="field"><span>Art</span><input class="text-control" name="policyType" ${edit?`id="${p}Type"`:''} placeholder="${policyTypeExample}"></label>
    <label class="field"><span>Policennummer</span><input class="text-control" name="policyNumber" ${edit?`id="${p}Number"`:''} placeholder="optional"></label>
    <label class="field"><span>Prämie</span><input class="text-control" name="premiumAmount" ${edit?`id="${p}Premium"`:''} type="number" min="0" step="0.01" required></label>
    <label class="field"><span>Währung</span><select class="text-control" name="currency" ${edit?`id="${p}Currency"`:''}>${currencyOptions}</select></label>
    <label class="field"><span>Rhythmus</span><select class="text-control" name="cadence" ${edit?`id="${p}Cadence"`:''}><option value="monthly">Monatlich</option><option value="quarterly">Quartalsweise</option><option value="semiannual">Halbjährlich</option><option value="annual">Jährlich</option></select></label>
    <label class="field"><span>Zahlungskonto</span><select class="text-control" name="accountId" ${edit?`id="${p}Account"`:''}><option value="">Noch nicht zugeordnet</option>${accountOptions}</select></label>
    <label class="field"><span>Kategorie</span><select class="text-control" name="categoryId" ${edit?`id="${p}Category"`:''}><option value="">Ohne Kategorie</option>${categoryOptions}</select></label>
    <label class="field"><span>Nächste Zahlung</span><input class="text-control" name="nextPaymentDate" ${edit?`id="${p}Next"`:''} type="date"></label>
    <label class="field"><span>Zuletzt bezahlt</span><input class="text-control" name="lastPaidDate" ${edit?`id="${p}LastPaid"`:''} type="date"></label>
    <label class="field"><span>Kündigungsfrist Tage</span><input class="text-control" name="noticeDays" ${edit?`id="${p}Notice"`:''} type="number" min="0"></label>
    <label class="field"><span>Enddatum</span><input class="text-control" name="endDate" ${edit?`id="${p}End"`:''} type="date"></label>
    ${edit?`<label class="field"><span>Status</span><select class="text-control" name="status" id="${p}Status"><option value="active">Aktiv</option><option value="cancelled">Gekündigt</option><option value="expired">Abgelaufen</option></select></label>`:''}`;
}

export function renderInsurance({ insurance = [], accounts = [], categories = [], documents = [], household, profile, fxRates, canWrite=false } = {}) {
  const currency = household?.base_currency || 'CHF';
  const locale = profile?.locale || 'de-CH';
  const monthly = insurance.filter((p)=>p.status==='active').reduce((s,p)=>s+(convertAmount(Number(p.premium_amount)*cadenceMonthlyFactor(p.billing_cadence),p.currency||currency,currency,fxRates)??0),0);
  const rows = insurance.map((p)=>{
    const docs=documents.filter((d)=>d.object_type==='insurance'&&d.object_id===p.id);
    const next=effectiveNextDate({next_date:p.next_payment_date,end_date:p.end_date,cadence:p.billing_cadence},new Date());
    const planningAction=p.recurring_rule_id
      ? `<button class="table-action" type="button" data-action="insurance-recurring-remove" data-id="${p.id}">Planung lösen</button>`
      : `<button class="table-action" type="button" data-action="insurance-recurring" data-id="${p.id}" ${p.account_id&&p.next_payment_date&&Number(p.premium_amount)>0?'':'disabled'}>Mit Fixkosten verbinden</button>`;
    return `<tr><td><strong>${escapeHtml(p.name)}</strong><div class="table-meta">${escapeHtml(p.provider||p.policy_type||'')}${p.policy_number?` · ${escapeHtml(p.policy_number)}`:''}${p.recurring_rule_id?' · Fixkosten verknüpft':''}</div></td><td>${money(p.premium_amount,{currency:p.currency||currency,locale})}</td><td>${escapeHtml(p.billing_cadence)}</td><td>${dateLabel(p.last_paid_date,locale)}</td><td>${next?dateLabel(next,locale):'—'}</td><td>${docs.length?`${docs.length} Dok.`:'—'}</td><td>${statusPill(p.status)}</td><td><div class="table-actions">${docs[0]?.storage_path?`<button class="table-action" type="button" data-action="document-download" data-path="${escapeHtml(docs[0].storage_path)}" data-name="${escapeHtml(docs[0].name)}">Dokument öffnen</button>`:''}${canWrite?`<button class="table-action" type="button" data-action="insurance-edit" data-id="${p.id}">Bearbeiten</button>${planningAction}<button class="table-action" type="button" data-action="insurance-document" data-id="${p.id}">Foto / Police</button>${p.recurring_rule_id?'':deleteButton('insurance_policies',p.id)}`:''}</div></td></tr>`;
  });
  const docFields=`<input type="hidden" name="insuranceId" id="insuranceDocumentId"><label class="field form-grid-span"><span>Foto oder PDF</span>${filePicker({id:'insuranceDocumentFile',name:'file',accept:'image/*,application/pdf',capture:'environment',required:true})}<small>Auf dem Smartphone kann direkt die Kamera geöffnet werden.</small></label><label class="field"><span>Dokumentdatum</span><input class="text-control" name="documentDate" type="date"></label><label class="field"><span>Notiz</span><input class="text-control" name="notes" placeholder="z. B. Police 2027"></label>`;
  return `
    ${pageHeader({title:'Versicherungen',subtitle:'Policen, Prämien, Zahlungsrhythmus, Zahlungsverlauf und Dokumente. Änderungen der Jahresprämie können jederzeit nachgeführt werden.',actions:canWrite?`<button class="action-button action-button--primary" type="button" data-action="show-form" data-target="insurance-create">${icon('plus')} Versicherung</button>`:''})}
    ${canWrite?formShell('insurance-create','Neue Versicherung','Police und Zahlungsdaten',formFields(accounts,categories),{hidden:true,submitLabel:'Versicherung speichern'}):''}
    ${canWrite?formShell('insurance-edit','Versicherung bearbeiten','Prämie, Zahlung und Policendaten aktualisieren',formFields(accounts,categories,{edit:true,countryCode:household?.country_code||'CH',baseCurrency:currency}),{hidden:true,submitLabel:'Änderungen speichern'}):''}
    ${canWrite?formShell('insurance-document-upload','Police / Beleg speichern','Direkt mit der Versicherung verknüpft',docFields,{hidden:true,submitLabel:'Dokument speichern'}):''}
    <div class="metric-grid" style="margin-bottom:16px">${metricCard('Prämien / Monat',money(monthly,{currency,locale}),'normalisierte laufende Kosten')}${metricCard('Aktive Policen',String(insurance.filter((p)=>p.status==='active').length),'Versicherungen')}${metricCard('Gesamt',String(insurance.length),'inkl. beendet')}</div>
    <div class="inline-alert"><strong>Budget-Verknüpfung.</strong><span>Policen mit Zahlungskonto und Termin werden mit Fixkosten verknüpft. Änderungen bleiben synchron; die Verbindung kann bewusst gelöst werden.</span></div>
    <article class="card card-padding">${dataTable({headers:['Police','Prämie','Rhythmus','Zuletzt','Nächste','Dok.','Status',''],rows,emptyText:'Noch keine Versicherungen.'})}</article>`;
}
