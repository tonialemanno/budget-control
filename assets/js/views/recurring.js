import { dataTable, formShell, pageHeader, deleteButton, statusPill } from '../app/components.js';
import { dateLabel, escapeHtml, money } from '../app/format.js';
import { icon } from '../app/icons.js';

export function renderRecurring({ recurringRules = [], accounts = [], categories = [], household, profile } = {}) {
  const currency = household?.base_currency || 'CHF';
  const locale = profile?.locale || 'de-CH';
  const accountOptions = accounts.map((a)=>`<option value="${a.account_id}">${escapeHtml(a.name)} · ${escapeHtml(a.currency)}</option>`).join('');
  const categoryOptions = categories.map((c)=>`<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
  const accountName = (id) => accounts.find((a)=>a.account_id===id)?.name || '—';
  const fields = `
    <label class="field"><span>Typ</span><select class="text-control" name="direction" id="recurringDirection"><option value="expense">Ausgabe</option><option value="income">Einnahme</option><option value="transfer">Umbuchung / Topf</option></select></label>
    <label class="field"><span>Betrag</span><input class="text-control" name="amount" type="number" min="0.01" step="0.01" required></label>
    <label class="field"><span>Von / auf Konto</span><select class="text-control" name="accountId" required>${accountOptions}</select></label>
    <label class="field" id="recurringTargetField" hidden><span>Zielkonto / Topf</span><select class="text-control" name="destinationAccountId"><option value="">Bitte wählen</option>${accountOptions}</select></label>
    <label class="field" id="recurringCategoryField"><span>Kategorie</span><select class="text-control" name="categoryId"><option value="">Ohne Kategorie</option>${categoryOptions}</select></label>
    <label class="field form-grid-span"><span>Beschreibung</span><input class="text-control" name="description" required></label>
    <label class="field"><span>Rhythmus</span><select class="text-control" name="cadence"><option value="weekly">Wöchentlich</option><option value="monthly" selected>Monatlich</option><option value="quarterly">Quartalsweise</option><option value="semiannual">Halbjährlich</option><option value="annual">Jährlich</option></select></label>
    <label class="field"><span>Nächster Termin</span><input class="text-control" name="nextDate" type="date" required></label>
    <label class="field"><span>Läuft bis</span><input class="text-control" name="endDate" type="date"><small>Leer = unbefristet.</small></label>`;
  const rows = recurringRules.map((r)=>{
    const type = r.direction==='income' ? 'Einnahme' : r.direction==='transfer' ? 'Umbuchung' : 'Ausgabe';
    const accountDetail = r.direction==='transfer'
      ? `${accountName(r.account_id)} → ${accountName(r.destination_account_id)}`
      : accountName(r.account_id);
    return `<tr><td><strong>${escapeHtml(r.description)}</strong><div class="table-meta">${escapeHtml(accountDetail)}</div></td><td>${type}</td><td>${money(r.amount,{currency:r.currency||currency,locale})}</td><td>${dateLabel(r.next_date,locale)}</td><td>${r.end_date?dateLabel(r.end_date,locale):'Unbefristet'}</td><td>${statusPill(r.active?'active':'paused',r.active?'Aktiv':'Pausiert')}</td><td>${deleteButton('recurring_rules',r.id)}</td></tr>`;
  });
  return `
    ${pageHeader({title:'Wiederkehrende Zahlungen',subtitle:'Einnahmen, Fixkosten und feste Umbuchungen als Planungselemente.',actions:`<button class="action-button action-button--primary" type="button" data-action="show-form" data-target="recurring-create" ${accounts.length?'':'disabled'}>${icon('plus')} Regel</button>`})}
    ${formShell('recurring-create','Wiederkehrende Zahlung','Einnahme, Ausgabe oder Umbuchung planen',fields,{hidden:true,submitLabel:'Regel speichern'})}
    <article class="card card-padding">${dataTable({headers:['Beschreibung','Typ','Betrag','Nächster Termin','Läuft bis','Status',''],rows,emptyText:'Noch keine wiederkehrenden Zahlungen.'})}</article>`;
}
