import { dataTable, formShell, pageHeader, deleteButton, statusPill } from '../app/components.js';
import { dateLabel, escapeHtml, money } from '../app/format.js';
import { icon } from '../app/icons.js';

export function renderRecurring({ recurringRules = [], accounts = [], categories = [], household, profile } = {}) {
  const currency = household?.base_currency || 'CHF';
  const locale = profile?.locale || 'de-CH';
  const accountOptions = accounts.map((a)=>`<option value="${a.account_id}">${escapeHtml(a.name)}</option>`).join('');
  const categoryOptions = categories.map((c)=>`<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
  const fields = `
    <label class="field"><span>Typ</span><select class="text-control" name="direction"><option value="expense">Ausgabe</option><option value="income">Einnahme</option></select></label>
    <label class="field"><span>Betrag</span><input class="text-control" name="amount" type="number" min="0.01" step="0.01" required></label>
    <label class="field"><span>Konto</span><select class="text-control" name="accountId" required>${accountOptions}</select></label>
    <label class="field"><span>Kategorie</span><select class="text-control" name="categoryId"><option value="">Ohne Kategorie</option>${categoryOptions}</select></label>
    <label class="field form-grid-span"><span>Beschreibung</span><input class="text-control" name="description" required></label>
    <label class="field"><span>Rhythmus</span><select class="text-control" name="cadence"><option value="weekly">Wöchentlich</option><option value="monthly" selected>Monatlich</option><option value="quarterly">Quartalsweise</option><option value="semiannual">Halbjährlich</option><option value="annual">Jährlich</option></select></label>
    <label class="field"><span>Nächster Termin</span><input class="text-control" name="nextDate" type="date" required></label>`;
  const rows = recurringRules.map((r)=>`<tr><td><strong>${escapeHtml(r.description)}</strong><div class="table-meta">${escapeHtml(r.accounts?.name||'')}</div></td><td>${r.direction==='income'?'Einnahme':'Ausgabe'}</td><td>${money(r.amount,{currency:r.currency||currency,locale})}</td><td>${dateLabel(r.next_date,locale)}</td><td>${statusPill(r.active?'active':'paused',r.active?'Aktiv':'Pausiert')}</td><td>${deleteButton('recurring_rules',r.id)}</td></tr>`);
  return `
    ${pageHeader({title:'Wiederkehrende Zahlungen',subtitle:'Fixkosten, Lohn und andere regelmässige Bewegungen als Planungselemente.',actions:`<button class="action-button action-button--primary" type="button" data-action="show-form" data-target="recurring-create" ${accounts.length?'':'disabled'}>${icon('plus')} Regel</button>`})}
    ${formShell('recurring-create','Wiederkehrende Zahlung','Planungsregel, noch keine automatische Bankzahlung',fields,{hidden:true,submitLabel:'Regel speichern'})}
    <article class="card card-padding">${dataTable({headers:['Beschreibung','Typ','Betrag','Nächster Termin','Status',''],rows,emptyText:'Noch keine wiederkehrenden Zahlungen.'})}</article>`;
}
