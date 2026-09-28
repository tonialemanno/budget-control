import { dataTable, formShell, metricCard, pageHeader, deleteButton, statusPill } from '../app/components.js';
import { cadenceMonthlyFactor, dateLabel, escapeHtml, money } from '../app/format.js';
import { icon } from '../app/icons.js';

export function renderBills({ bills = [], contracts = [], accounts = [], categories = [], household, profile } = {}) {
  const currency = household?.base_currency || 'CHF';
  const locale = profile?.locale || 'de-CH';
  const accountOptions = accounts.map((a)=>`<option value="${a.account_id}">${escapeHtml(a.name)}</option>`).join('');
  const categoryOptions = categories.filter((c)=>c.kind==='expense').map((c)=>`<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');

  const billFields = `
    <label class="field"><span>Bezeichnung</span><input class="text-control" name="name" required placeholder="z. B. Stromrechnung"></label>
    <label class="field"><span>Anbieter</span><input class="text-control" name="provider" placeholder="optional"></label>
    <label class="field"><span>Betrag</span><input class="text-control" name="amount" type="number" min="0" step="0.01" required></label>
    <label class="field"><span>Fällig am</span><input class="text-control" name="dueDate" type="date" required></label>
    <label class="field"><span>Konto</span><select class="text-control" name="accountId"><option value="">Noch offen</option>${accountOptions}</select></label>
    <label class="field"><span>Kategorie</span><select class="text-control" name="categoryId"><option value="">Ohne Kategorie</option>${categoryOptions}</select></label>
    <label class="field form-grid-span"><span>Referenz / Notiz</span><input class="text-control" name="reference" placeholder="optional"></label>`;

  const contractFields = `
    <label class="field"><span>Vertrag</span><input class="text-control" name="name" required placeholder="z. B. Handyabo"></label>
    <label class="field"><span>Anbieter</span><input class="text-control" name="provider"></label>
    <label class="field"><span>Art</span><select class="text-control" name="contractType"><option value="contract">Vertrag</option><option value="subscription">Abo</option><option value="membership">Mitgliedschaft</option></select></label>
    <label class="field"><span>Betrag pro Zahlung</span><input class="text-control" name="amount" type="number" min="0" step="0.01" value="0"></label>
    <label class="field"><span>Rhythmus</span><select class="text-control" name="cadence"><option value="monthly">Monatlich</option><option value="quarterly">Quartalsweise</option><option value="semiannual">Halbjährlich</option><option value="annual">Jährlich</option><option value="oneoff">Einmalig</option></select></label>
    <label class="field"><span>Nächste Zahlung</span><input class="text-control" name="nextPaymentDate" type="date"></label>
    <label class="field"><span>Kündigungsfrist Tage</span><input class="text-control" name="noticeDays" type="number" min="0"></label>
    <label class="field"><span>Enddatum</span><input class="text-control" name="endDate" type="date"></label>`;

  const openBills = bills.filter((b)=>['open','overdue'].includes(b.status));
  const openTotal = openBills.reduce((s,b)=>s+Number(b.amount),0);
  const monthlyContracts = contracts.filter((c)=>c.status==='active').reduce((s,c)=>s+Number(c.amount)*cadenceMonthlyFactor(c.billing_cadence),0);

  const billRows = bills.map((b)=>`<tr><td><strong>${escapeHtml(b.name)}</strong><div class="table-meta">${escapeHtml(b.provider||b.reference||'')}</div></td><td>${money(b.amount,{currency:b.currency||currency,locale})}</td><td>${dateLabel(b.due_date,locale)}</td><td>${statusPill(b.status,{open:'Offen',paid:'Bezahlt',overdue:'Überfällig',cancelled:'Storniert'}[b.status]||b.status)}</td><td><div class="table-actions">${b.status!=='paid'?`<button class="table-action" type="button" data-action="bill-paid" data-id="${b.id}">Bezahlt</button>`:''}${deleteButton('bills',b.id)}</div></td></tr>`);
  const contractRows = contracts.map((c)=>`<tr><td><strong>${escapeHtml(c.name)}</strong><div class="table-meta">${escapeHtml(c.provider||'')}</div></td><td>${money(c.amount,{currency:c.currency||currency,locale})}</td><td>${escapeHtml(c.billing_cadence)}</td><td>${dateLabel(c.next_payment_date,locale)}</td><td>${statusPill(c.status)}</td><td>${deleteButton('contracts',c.id)}</td></tr>`);

  return `
    ${pageHeader({title:'Rechnungen & Verträge',subtitle:'Offene Rechnungen, Abos, Verträge, Laufzeiten und nächste Zahlungen in einer gemeinsamen Sicht.',actions:`<button class="action-button action-button--primary" type="button" data-action="show-form" data-target="bill-create">${icon('plus')} Rechnung</button><button class="action-button action-button--secondary" type="button" data-action="show-form" data-target="contract-create">${icon('plus')} Vertrag / Abo</button>`})}
    ${formShell('bill-create','Neue Rechnung','Fälligkeit und Betrag erfassen',billFields,{hidden:true,submitLabel:'Rechnung speichern'})}
    ${formShell('contract-create','Neuer Vertrag / Abo','Wiederkehrende Verpflichtung',contractFields,{hidden:true,submitLabel:'Vertrag speichern'})}
    <div class="metric-grid" style="margin-bottom:16px">
      ${metricCard('Offene Rechnungen',money(openTotal,{currency,locale}),`${openBills.length} offen`)}
      ${metricCard('Vertragskosten / Monat',money(monthlyContracts,{currency,locale}),'normalisiert aus Rhythmen')}
      ${metricCard('Aktive Verträge',String(contracts.filter((c)=>c.status==='active').length),'Verträge und Abos')}
    </div>
    <div class="grid-2">
      <article class="card card-padding"><div class="card-heading"><div><h3 class="card-title">Rechnungen</h3><p class="card-subtitle">Fällig und bezahlt</p></div></div>${dataTable({headers:['Rechnung','Betrag','Fällig','Status',''],rows:billRows,emptyText:'Noch keine Rechnungen.'})}</article>
      <article class="card card-padding"><div class="card-heading"><div><h3 class="card-title">Verträge & Abos</h3><p class="card-subtitle">Laufende Verpflichtungen</p></div></div>${dataTable({headers:['Vertrag','Betrag','Rhythmus','Nächste Zahlung','Status',''],rows:contractRows,emptyText:'Noch keine Verträge.'})}</article>
    </div>`;
}
