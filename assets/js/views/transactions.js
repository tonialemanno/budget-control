import { emptyState, formShell, metricCard, pageHeader, transactionRow } from '../app/components.js';
import { dateTimeLocalValue, escapeHtml, money } from '../app/format.js';
import { icon } from '../app/icons.js';

export function renderTransactions({ accounts = [], categories = [], transactions = [], household, profile, canWrite = false } = {}) {
  const baseCurrency = household?.base_currency || 'CHF';
  const locale = profile?.locale || 'de-CH';
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthRows = transactions.filter((tx) => new Date(tx.occurred_at) >= monthStart && tx.status === 'booked' && !tx.transfer_group_id && tx.currency === baseCurrency);
  const income = monthRows.filter((tx) => Number(tx.amount) > 0).reduce((s,tx)=>s+Number(tx.amount),0);
  const expenses = Math.abs(monthRows.filter((tx) => Number(tx.amount) < 0).reduce((s,tx)=>s+Number(tx.amount),0));
  const hasForeign = transactions.some((tx)=>tx.currency !== baseCurrency);
  const categoryOptions = categories.map((c)=>`<option value="${c.id}">${escapeHtml(c.name)} · ${c.kind==='income'?'Einnahme':'Ausgabe'}</option>`).join('');
  const accountOptions = accounts.map((a)=>`<option value="${a.account_id}">${escapeHtml(a.name)} · ${escapeHtml(a.currency)}</option>`).join('');

  const txFields = `
    <label class="field"><span>Typ</span><select class="text-control" name="direction"><option value="expense">Ausgabe</option><option value="income">Einnahme</option></select></label>
    <label class="field"><span>Betrag</span><input class="text-control" name="amount" type="number" step="0.01" min="0.01" required></label>
    <label class="field"><span>Konto</span><select class="text-control" name="accountId" required>${accountOptions}</select></label>
    <label class="field"><span>Datum / Zeit</span><input class="text-control" name="occurredAt" type="datetime-local" required value="${dateTimeLocalValue()}"></label>
    <label class="field form-grid-span"><span>Beschreibung</span><input class="text-control" name="description" required placeholder="z. B. Migros"></label>
    <label class="field"><span>Kategorie</span><select class="text-control" name="categoryId"><option value="">Ohne Kategorie</option>${categoryOptions}</select></label>
    <label class="field"><span>Gegenpartei</span><input class="text-control" name="counterparty" placeholder="optional"></label>
    <label class="field form-grid-span"><span>Notiz</span><textarea class="text-control" name="note" rows="3" placeholder="optional"></textarea></label>`;

  const editFields = `
    <input type="hidden" name="transactionId" id="transactionEditId">
    <label class="field"><span>Typ</span><select class="text-control" name="direction" id="transactionEditDirection"><option value="expense">Ausgabe</option><option value="income">Einnahme</option></select></label>
    <label class="field"><span>Betrag</span><input class="text-control" name="amount" id="transactionEditAmount" type="number" step="0.01" min="0.01" required></label>
    <label class="field"><span>Konto</span><select class="text-control" name="accountId" id="transactionEditAccount" required>${accountOptions}</select></label>
    <label class="field"><span>Datum / Zeit</span><input class="text-control" name="occurredAt" id="transactionEditDate" type="datetime-local" required></label>
    <label class="field form-grid-span"><span>Beschreibung</span><input class="text-control" name="description" id="transactionEditDescription" required></label>
    <label class="field"><span>Kategorie</span><select class="text-control" name="categoryId" id="transactionEditCategory"><option value="">Ohne Kategorie</option>${categoryOptions}</select></label>
    <label class="field"><span>Gegenpartei</span><input class="text-control" name="counterparty" id="transactionEditCounterparty"></label>
    <label class="field form-grid-span"><span>Notiz</span><textarea class="text-control" name="note" id="transactionEditNote" rows="3"></textarea></label>
    <label class="module-toggle form-grid-span"><input type="checkbox" name="makeRecurring" id="transactionMakeRecurring"><span><strong>Als wiederkehrende Zahlung übernehmen</strong><small>Erstellt oder aktualisiert eine passende Regel unter „Wiederkehrend“.</small></span></label>
    <div class="form-grid form-grid--2 form-grid-span" id="transactionRecurringFields" hidden>
      <label class="field"><span>Rhythmus</span><select class="text-control" name="recurringCadence"><option value="weekly">Wöchentlich</option><option value="monthly" selected>Monatlich</option><option value="quarterly">Quartalsweise</option><option value="semiannual">Halbjährlich</option><option value="annual">Jährlich</option></select></label>
      <label class="field"><span>Nächster Termin</span><input class="text-control" name="recurringNextDate" id="transactionRecurringNextDate" type="date"></label>
    </div>`;

  const transferFields = `
    <label class="field"><span>Von Konto</span><select class="text-control" name="fromAccountId" required>${accountOptions}</select></label>
    <label class="field"><span>Auf Konto</span><select class="text-control" name="toAccountId" required>${accountOptions}</select></label>
    <label class="field"><span>Abgang vom Quellkonto</span><input class="text-control" name="amount" type="number" step="0.01" min="0.01" required></label>
    <label class="field"><span>Eingang auf Zielkonto</span><input class="text-control" name="toAmount" type="number" step="0.01" min="0.01" placeholder="nur bei anderer Währung"><small>Bei gleicher Währung leer lassen. Bei CHF → EUR den tatsächlich gutgeschriebenen EUR-Betrag eintragen.</small></label>
    <label class="field"><span>Datum / Zeit</span><input class="text-control" name="occurredAt" type="datetime-local" required value="${dateTimeLocalValue()}"></label>
    <label class="field"><span>Beschreibung</span><input class="text-control" name="description" value="Umbuchung" required></label>`;

  return `
    ${pageHeader({
      title:'Transaktionen',
      subtitle:'Einnahmen, Ausgaben und Umbuchungen. Fremdwährungen bleiben getrennt; es gibt keine automatische Fantasie-Umrechnung.',
      actions: canWrite ? `<button class="action-button action-button--primary" type="button" data-action="show-form" data-target="transaction-create" ${accounts.length?'':'disabled'}>${icon('plus')} Transaktion</button><button class="action-button action-button--secondary" type="button" data-action="show-form" data-target="transfer-create" ${accounts.length>1?'':'disabled'}>${icon('repeat')} Umbuchung</button><button class="action-button action-button--secondary" type="button" data-action="show-form" data-target="category-create-inline">${icon('plus')} Kategorie</button>` : '',
    })}
    ${accounts.length?'':`<div class="inline-alert"><strong>Zuerst ein Konto anlegen.</strong><span>Transaktionen benötigen ein Zielkonto.</span></div>`}
    ${hasForeign ? `<div class="inline-alert"><strong>Monatskennzahlen nur in ${escapeHtml(baseCurrency)}.</strong><span>Transaktionen in anderen Währungen werden darunter einzeln korrekt angezeigt, aber ohne FX-Kurs nicht in die ${escapeHtml(baseCurrency)}-Summe gerechnet.</span></div>` : ''}
    ${canWrite ? formShell('category-create-inline','Neue Kategorie','Direkt aus den Transaktionen anlegen',`<label class="field"><span>Name</span><input class="text-control" name="name" required></label><label class="field"><span>Typ</span><select class="text-control" name="kind"><option value="expense">Ausgabe</option><option value="income">Einnahme</option></select></label>`,{hidden:true,submitLabel:'Kategorie speichern'}) : ''}
    ${canWrite ? formShell('transaction-create','Neue Transaktion','Manuelle Buchung',txFields,{hidden:true,submitLabel:'Transaktion speichern'}) : ''}
    ${canWrite ? formShell('transaction-edit','Transaktion bearbeiten','Bestehende Buchung korrigieren',editFields,{hidden:true,submitLabel:'Änderungen speichern'}) : ''}
    ${canWrite ? formShell('transfer-create','Umbuchung','Geld zwischen zwei eigenen Konten verschieben – auch mit Währungswechsel',transferFields,{hidden:true,submitLabel:'Umbuchung speichern'}) : ''}
    <div class="metric-grid" style="margin-bottom:16px">
      ${metricCard(`Einnahmen ${baseCurrency}`,money(income,{currency:baseCurrency,locale}),'aktueller Monat','positive')}
      ${metricCard(`Ausgaben ${baseCurrency}`,money(expenses,{currency:baseCurrency,locale}),'aktueller Monat')}
      ${metricCard(`Cashflow ${baseCurrency}`,money(income-expenses,{currency:baseCurrency,locale}),income-expenses>=0?'positiv':'negativ',income-expenses>=0?'positive':'warning')}
    </div>
    <article class="card card-padding">${transactions.length?`<div class="list">${transactions.slice(0,150).map((tx)=>transactionRow(tx,{locale,canWrite})).join('')}</div>`:emptyState('list','Noch keine Transaktionen','Erfasse eine Buchung oder importiere eine CSV-Datei.')}</article>
  `;
}
