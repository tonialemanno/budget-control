import { dataTable, formShell, metricCard, pageHeader, deleteButton, statusPill } from '../app/components.js';
import { dateLabel, escapeHtml, money } from '../app/format.js';
import { countryConfig } from '../country/index.js';
import { icon } from '../app/icons.js';

export function renderLegal({ legalCases = [], legalEvents = [], household, profile } = {}) {
  const currency = household?.base_currency || 'CHF';
  const locale = profile?.locale || 'de-CH';
  const country = countryConfig(household?.country_code || 'CH');
  const caseTypes = country.legalCaseTypes.map(([value,label])=>`<option value="${value}">${escapeHtml(label)}</option>`).join('');
  const statuses = country.legalStatuses.map((s)=>`<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('');
  const fields = `
    <label class="field"><span>Gläubiger</span><input class="text-control" name="creditor" required></label>
    <label class="field"><span>Prozessart</span><select class="text-control" name="caseType">${caseTypes}</select></label>
    <label class="field"><span>Ursprünglicher Betrag</span><input class="text-control" name="originalAmount" type="number" min="0" step="0.01" value="0"></label>
    <label class="field"><span>Offener Betrag</span><input class="text-control" name="outstandingAmount" type="number" min="0" step="0.01" value="0"></label>
    <label class="field"><span>Status</span><select class="text-control" name="status">${statuses}</select></label>
    <label class="field"><span>Nächste Aktion</span><input class="text-control" name="nextActionDate" type="date"></label>
    <label class="field form-grid-span"><span>Referenz</span><input class="text-control" name="reference"></label>
    <label class="field form-grid-span"><span>Notizen</span><textarea class="text-control" name="notes" rows="3"></textarea></label>`;

  const open = legalCases.filter((c)=>!String(c.status).toLowerCase().includes('abgeschlossen'));
  const outstanding = open.reduce((s,c)=>s+Number(c.outstanding_amount),0);
  const rows = legalCases.map((c)=>`<tr><td><strong>${escapeHtml(c.creditor)}</strong><div class="table-meta">${escapeHtml(c.reference||'')}</div></td><td>${escapeHtml(c.case_type)}</td><td>${money(c.outstanding_amount,{currency:c.currency||currency,locale})}</td><td>${statusPill(c.status,c.status)}</td><td>${dateLabel(c.next_action_date,locale)}</td><td><div class="table-actions"><button class="table-action" type="button" data-action="legal-event" data-id="${c.id}">Ereignis</button>${deleteButton('legal_cases',c.id)}</div></td></tr>`);

  const eventRows = legalEvents.slice(0,20).map((e)=>{
    const parent = legalCases.find((c)=>c.id===e.case_id);
    return `<tr><td>${dateLabel(e.event_date,locale)}</td><td><strong>${escapeHtml(e.title)}</strong><div class="table-meta">${escapeHtml(parent?.creditor||'')}</div></td><td>${escapeHtml(e.event_type)}</td><td>${escapeHtml(e.notes||'')}</td></tr>`;
  });

  return `
    ${pageHeader({title:'Mahnung / Betreibung / Inkasso',subtitle:`${country.label}: problematische Forderungen werden als Timeline-Prozess geführt, nicht nur als einzelner Status.`,actions:`<button class="action-button action-button--primary" type="button" data-action="show-form" data-target="legal-create">${icon('plus')} Fall</button>`})}
    ${formShell('legal-create','Neuer Fall',`${country.label} · manuelle Verwaltung`,fields,{hidden:true,submitLabel:'Fall speichern'})}
    <div class="metric-grid" style="margin-bottom:16px">${metricCard('Offene Fälle',String(open.length),country.label)}${metricCard('Offener Betrag',money(outstanding,{currency,locale}),'über offene Fälle')}${metricCard('Ereignisse',String(legalEvents.length),'Timeline-Einträge')}</div>
    <article class="card card-padding">${dataTable({headers:['Gläubiger','Art','Offen','Status','Nächste Aktion',''],rows,emptyText:'Noch keine Mahn-/Betreibungs-/Inkassofälle.'})}</article>
    <article class="card card-padding" style="margin-top:16px"><div class="card-heading"><div><h3 class="card-title">Timeline</h3><p class="card-subtitle">Letzte Ereignisse über alle Fälle</p></div></div>${dataTable({headers:['Datum','Ereignis','Typ','Notiz'],rows:eventRows,emptyText:'Noch keine Timeline-Ereignisse.'})}</article>`;
}
