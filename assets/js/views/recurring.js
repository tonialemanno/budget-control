import { dataTable, formShell, pageHeader, deleteButton, statusPill } from '../app/components.js';
import { dateLabel, escapeHtml, money } from '../app/format.js';
import { effectiveNextDate } from '../app/recurrence.js';
import { icon } from '../app/icons.js';
import { primaryOperatingAccount } from '../app/finance-insights.js';
import { primaryAccountPreferenceId } from '../app/user-preferences.js';

function recurringFields({ accounts = [], categories = [], edit = false, defaultAccountId = '' } = {}) {
  const suffix=edit?'Edit':'';
  const accountOptions = accounts.map((a)=>`<option value="${a.account_id}" ${!edit&&a.account_id===defaultAccountId?'selected':''}>${escapeHtml(a.name)} · ${escapeHtml(a.currency)}</option>`).join('');
  const destinationAccountOptions = accounts.map((a)=>`<option value="${a.account_id}">${escapeHtml(a.name)} · ${escapeHtml(a.currency)}</option>`).join('');
  const categoryOptions = categories.map((c)=>`<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
  return `${edit?'<input type="hidden" name="ruleId" id="recurringEditId">':''}
    <label class="field"><span>Typ</span><select class="text-control" name="direction" id="recurring${suffix}Direction"><option value="expense">Ausgabe</option><option value="income">Einnahme</option><option value="transfer">Umbuchung / Topf</option></select></label>
    <label class="field"><span>Betrag</span><input class="text-control" name="amount" id="recurring${suffix}Amount" type="number" min="0.01" step="0.01" required></label>
    <label class="field"><span>Von / auf Konto</span><select class="text-control" name="accountId" id="recurring${suffix}Account" required>${accountOptions}</select></label>
    <label class="field" id="recurring${suffix}TargetField" hidden><span>Zielkonto / Topf</span><select class="text-control" name="destinationAccountId" id="recurring${suffix}Target"><option value="">Bitte wählen</option>${destinationAccountOptions}</select></label>
    <label class="field" id="recurring${suffix}CategoryField"><span>Kategorie</span><select class="text-control" name="categoryId" id="recurring${suffix}Category"><option value="">Ohne Kategorie</option>${categoryOptions}</select></label>
    <label class="field form-grid-span"><span>Beschreibung</span><input class="text-control" name="description" id="recurring${suffix}Description" required></label>
    <label class="field"><span>Rhythmus</span><select class="text-control" name="cadence" id="recurring${suffix}Cadence"><option value="weekly">Wöchentlich</option><option value="monthly" selected>Monatlich</option><option value="quarterly">Quartalsweise</option><option value="semiannual">Halbjährlich</option><option value="annual">Jährlich</option></select></label>
    <label class="field"><span>Erster / nächster Termin</span><input class="text-control" name="nextDate" id="recurring${suffix}NextDate" type="date" required><small>Vergangene Termine werden anhand des Rhythmus automatisch auf den nächsten Plantermin fortgeschrieben.</small></label>
    <label class="field"><span>Läuft bis</span><input class="text-control" name="endDate" id="recurring${suffix}EndDate" type="date"><small>Leer = unbefristet.</small></label>
    ${edit?'<label class="field"><span>Status</span><select class="text-control" name="active" id="recurringEditActive"><option value="true">Aktiv</option><option value="false">Pausiert</option></select></label>':''}`;
}

export function renderRecurring({ recurringRules = [], accounts = [], categories = [], contracts = [], insurance = [], debts = [], goalSources = [], household, profile, canWrite = false } = {}) {
  const currency = household?.base_currency || 'CHF';
  const locale = profile?.locale || 'de-CH';
  const preferredPrimaryAccountId=primaryAccountPreferenceId(profile,household?.id,accounts);
  const defaultAccountId=primaryOperatingAccount(accounts,recurringRules,currency,preferredPrimaryAccountId)?.account_id||'';
  const accountName = (id) => accounts.find((a)=>a.account_id===id)?.name || '—';
  const rows = recurringRules.map((r)=>{
    const type = r.direction==='income' ? 'Einnahme' : r.direction==='transfer' ? 'Umbuchung' : 'Ausgabe';
    const accountDetail = r.direction==='transfer'
      ? `${accountName(r.account_id)} → ${accountName(r.destination_account_id)}`
      : accountName(r.account_id);
    const next=effectiveNextDate(r,new Date());
    const ended=Boolean(r.end_date && !next && r.active);
    const status=ended ? statusPill('cancelled','Beendet') : statusPill(r.active?'active':'paused',r.active?'Aktiv':'Pausiert');

    const contract=contracts.find((row)=>row.recurring_rule_id===r.id);
    const policy=insurance.find((row)=>row.recurring_rule_id===r.id);
    const debt=debts.find((row)=>row.recurring_rule_id===r.id);
    const goal=goalSources.find((row)=>row.recurring_rule_id===r.id);
    const source=contract
      ? {label:'Vertrag',href:'#/bills'}
      : policy
        ? {label:'Versicherung',href:'#/insurance'}
        : debt
          ? {label:'Schuld',href:'#/debts'}
          : goal
            ? {label:'Sparziel',href:'#/goals'}
            : null;

    const action=canWrite
      ? source
        ? `<div class="table-actions"><span class="table-meta">Verknüpft: ${escapeHtml(source.label)}</span><a class="table-action" href="${source.href}">Quelle öffnen</a></div>`
        : `<div class="table-actions"><button class="table-action" type="button" data-action="recurring-edit" data-id="${r.id}">Bearbeiten</button>${deleteButton('recurring_rules',r.id)}</div>`
      : source
        ? `<span class="table-meta">Verknüpft: ${escapeHtml(source.label)}</span>`
        : '';

    return `<tr><td><strong>${escapeHtml(r.description)}</strong><div class="table-meta">${escapeHtml(accountDetail)}${r.merchants?.name?` · ${escapeHtml(r.merchants.name)}`:''}</div></td><td>${type}</td><td>${money(r.amount,{currency:r.currency||currency,locale})}</td><td>${next?dateLabel(next,locale):'—'}</td><td>${r.end_date?dateLabel(r.end_date,locale):'Unbefristet'}</td><td>${status}</td><td>${action}</td></tr>`;
  });

  const actions=canWrite
    ? `<button class="action-button action-button--primary" type="button" data-action="show-form" data-target="recurring-create" ${accounts.length?'':'disabled'}>${icon('plus')} Regel</button><a class="action-button action-button--secondary" href="#/fixed-costs">Fixkosten öffnen</a>`
    : '<a class="action-button action-button--secondary" href="#/fixed-costs">Fixkosten öffnen</a>';

  return `
    ${pageHeader({
      title:'Wiederkehrend · Gesamtplanung',
      subtitle:'Alle wiederkehrenden Einnahmen, Ausgaben und Umbuchungen. Fixkosten mit Händler pflegst du am einfachsten unter Fixkosten; verknüpfte Verträge, Versicherungen und Schulden werden an ihrer Quelle bearbeitet.',
      actions,
    })}
    ${canWrite?formShell('recurring-create','Neue wiederkehrende Regel','Für Lohn, allgemeine Zahlungen oder Umbuchungen. Fixe Ausgaben mit Händler können alternativ unter Fixkosten angelegt werden.',recurringFields({accounts,categories,defaultAccountId}),{hidden:true,submitLabel:'Regel speichern'}):''}
    ${canWrite?formShell('recurring-edit','Wiederkehrende Regel bearbeiten','Nur eigenständige Regeln werden hier bearbeitet.',recurringFields({accounts,categories,edit:true}),{hidden:true,submitLabel:'Änderungen speichern'}):''}
    <article class="card card-padding">${dataTable({headers:['Beschreibung','Typ','Betrag','Nächster Plantermin','Läuft bis','Status',''],rows,emptyText:'Noch keine wiederkehrenden Zahlungen.'})}</article>`;
}
