import { dataTable, formShell, metricCard, pageHeader, deleteButton, statusPill } from '../app/components.js';
import { cadenceMonthlyFactor, dateInputValue, dateLabel, escapeHtml, money } from '../app/format.js';
import { convertAmount, fxLabel } from '../app/fx.js';
import { icon } from '../app/icons.js';
import { DEBT_TERM_OPTIONS, debtScheduleSummary } from '../app/debt-planning.js';

const DEBT_TYPES = Object.freeze([
  ['personal_loan','Privatkredit'], ['mortgage','Hypothek'], ['leasing','Leasing'], ['credit_card','Kreditkarte'],
  ['installment','Ratenkauf'], ['overdraft','Kontoüberziehung'], ['private','Private Schuld'], ['tax','Steuerschuld'],
  ['health_insurance','Krankenkassenschuld'], ['other','Sonstige'],
]);
const CADENCES = Object.freeze([
  ['weekly','Wöchentlich'], ['monthly','Monatlich'], ['quarterly','Quartalsweise'], ['annual','Jährlich'], ['manual','Flexibel / manuell'],
]);
const STATUSES = Object.freeze([
  ['active','Aktiv'], ['paused','Pausiert'], ['paid','Bezahlt'], ['defaulted','Problem / Verzug'],
]);

function optionList(rows, selected = '') {
  return rows.map(([value,label])=>`<option value="${value}" ${value===selected?'selected':''}>${escapeHtml(label)}</option>`).join('');
}
function cadenceLabel(value) { return CADENCES.find(([key])=>key===value)?.[1] || value || '—'; }
function statusLabel(value) { return STATUSES.find(([key])=>key===value)?.[1] || value || '—'; }
function sourceLabel(value) {
  return ({ created_transaction:'Kontobuchung erstellt', linked_transaction:'Bankbuchung vollständig verknüpft', linked_transaction_component:'Schuldanteil in Rechnung verknüpft', history_only:'Nur Verlauf' })[value] || value || '—';
}
function paymentAccounts(accounts) {
  return accounts.filter((account)=>!['investment','pension'].includes(account.account_type));
}
function accountOptions(accounts, selected = '') {
  return `<option value="">Kein Standardkonto</option>${paymentAccounts(accounts).map((a)=>`<option value="${a.account_id}" ${a.account_id===selected?'selected':''}>${escapeHtml(a.name)} · ${escapeHtml(a.currency)}</option>`).join('')}`;
}
function currencyOptions(selected) {
  return ['CHF','EUR','USD','GBP'].map((currency)=>`<option value="${currency}" ${currency===selected?'selected':''}>${currency}</option>`).join('');
}

function debtFields(accounts, currency, { edit = false, recurringRules = [] } = {}) {
  const prefix = edit ? 'debtEdit' : 'debtCreate';
  const providerRules=recurringRules
    .filter((rule)=>rule.active!==false&&rule.direction==='expense')
    .map((rule)=>`<option value="${rule.id}">${escapeHtml(rule.description)} · ${escapeHtml(moneyText(rule.amount,{currency:rule.currency||currency,decimals:2}))}</option>`)
    .join('');
  const termOptions=DEBT_TERM_OPTIONS.map((months)=>`<option value="${months}" ${months===24?'selected':''}>${months} Monate</option>`).join('');
  return `${edit?`<input type="hidden" name="debtId" id="${prefix}Id">`:''}
    <label class="field"><span>Name</span><input class="text-control" name="name" id="${prefix}Name" required placeholder="z. B. iPhone oder Privatdarlehen"></label>
    <label class="field"><span>Gläubiger</span><input class="text-control" name="creditor" id="${prefix}Creditor" required placeholder="z. B. Yallo oder Andy"></label>
    <label class="field"><span>Typ</span><select class="text-control" name="debtType" id="${prefix}Type">${optionList(DEBT_TYPES,'private')}</select></label>
    <label class="field"><span>Währung</span><select class="text-control" name="currency" id="${prefix}Currency">${currencyOptions(currency)}</select>${edit?'<small>Nach der ersten erfassten Zahlung bleibt die Währung aus Gründen der Verlaufskonsistenz fix.</small>':''}</label>
    <label class="field"><span>Ursprünglicher Betrag</span><input class="text-control" name="originalAmount" id="${prefix}Original" type="number" min="0" step="0.01" required></label>
    <label class="field"><span>Restschuld</span><input class="text-control" name="outstandingAmount" id="${prefix}Outstanding" type="number" min="0" step="0.01" required><small>Nur für Korrekturen. Tatsächliche Zahlungen über „Zahlung erfassen“ buchen.</small></label>
    <label class="field"><span>Zinssatz %</span><input class="text-control" name="interestRate" id="${prefix}Interest" type="number" min="0" step="0.01" value="0"></label>
    <label class="field"><span>Geplante Rate</span><input class="text-control" name="installmentAmount" id="${prefix}Installment" type="number" min="0" step="0.01" value="0"></label>
    <label class="field"><span>Zahlungsrhythmus</span><select class="text-control" name="paymentCadence" id="${prefix}Cadence">${optionList(CADENCES,'monthly')}</select></label>
    <label class="field"><span>Standard-Zahlungskonto</span><select class="text-control" name="paymentAccountId" id="${prefix}Account">${accountOptions(accounts)}</select></label>

    <label class="field"><span>Beginn / erste Rate</span><input class="text-control" name="startDate" id="${prefix}Start" type="date"><small>Bei einer festen Laufzeit ist dies gleichzeitig der erste geplante Zahlungstermin.</small></label>
    <label class="field"><span>Laufzeit</span><select class="text-control" name="termMonths" id="${prefix}Term"><option value="">Ohne feste Laufzeit</option>${termOptions}</select><small>Finance berechnet die letzte Rate automatisch.</small></label>
    <input type="hidden" name="nextPaymentDate" id="${prefix}Next">
    <input type="hidden" name="endDate" id="${prefix}End">
    <div class="debt-term-preview form-grid-span" id="${prefix}TermPreview"><strong>Ende automatisch</strong><span>Beginn und Laufzeit wählen.</span></div>

    <label class="field form-grid-span"><span>Wie wird die Rate bezahlt?</span><select class="text-control" name="paymentMode" id="${prefix}PaymentMode"><option value="standalone">Separate Rate / eigene Belastung</option><option value="included_in_bill">In einer Anbieterrechnung enthalten</option></select><small>Bei „enthalten“ plant Finance die Rate nicht nochmals als eigene Ausgabe.</small></label>
    <label class="field form-grid-span" id="${prefix}BillingRuleField" hidden><span>Enthalten in Fixkostenposition</span><select class="text-control" name="billingRecurringRuleId" id="${prefix}BillingRule"><option value="">Noch keine passende Fixkostenposition</option>${providerRules}</select><small>Beispiel: Die iPhone-Rate steckt in der gesamten Yallo-Rechnung. Die Bankbelastung wird nur einmal gezählt.</small></label>

    <label class="field"><span>Status</span><select class="text-control" name="status" id="${prefix}Status">${optionList(STATUSES,'active')}</select></label>
    <label class="field form-grid-span"><span>Notiz</span><textarea class="text-control" name="notes" id="${prefix}Notes" rows="3" placeholder="optional"></textarea></label>`;
}

function paymentFields(accounts, transactions, debtPayments, bills, currency, locale) {
  const linkedIds = new Set(debtPayments.filter((p)=>!p.reversed_at&&p.transaction_id).map((p)=>p.transaction_id));
  const paidBillIds = new Set(bills.filter((bill)=>bill.status==='paid'&&bill.paid_transaction_id).map((bill)=>bill.paid_transaction_id));
  const candidates = transactions
    .filter((tx)=>tx.status==='booked' && Number(tx.amount)<0 && !tx.transfer_group_id && tx.cashflow_type==='standard' && !linkedIds.has(tx.id))
    .slice(0,300);
  return `<input type="hidden" name="debtId" id="debtPaymentDebtId">
    <label class="field"><span>Datum</span><input class="text-control" name="paidAt" id="debtPaymentDate" type="date" value="${dateInputValue()}" required></label>
    <label class="field"><span>Rate / Schuldanteil</span><input class="text-control" name="amount" id="debtPaymentAmount" type="number" min="0.01" step="0.01" required></label>
    <label class="field"><span>Davon Tilgung</span><input class="text-control" name="principalAmount" id="debtPaymentPrincipal" type="number" min="0" step="0.01" required></label>
    <label class="field"><span>Davon Zins</span><input class="text-control" name="interestAmount" id="debtPaymentInterest" type="number" min="0" step="0.01" value="0" required></label>
    <label class="field"><span>Davon Gebühren</span><input class="text-control" name="feeAmount" id="debtPaymentFee" type="number" min="0" step="0.01" value="0" required></label>
    <label class="field"><span>Abbildung in Finance</span><select class="text-control" name="source" id="debtPaymentSource"><option value="created_transaction">Separate Kontobuchung erstellen</option><option value="linked_transaction">Bestehende Buchung ist vollständig die Rate</option><option value="linked_transaction_component">Rate steckt in bestehender Rechnung / Buchung</option><option value="history_only">Nur Verlauf</option></select></label>
    <label class="field" id="debtPaymentAccountField"><span>Zahlungskonto</span><select class="text-control" name="paymentAccountId" id="debtPaymentAccount">${accountOptions(accounts)}</select></label>
    <label class="field" id="debtPaymentTransactionField" hidden><span>Bestehende Buchung / Rechnung</span><select class="text-control" name="transactionId" id="debtPaymentTransaction"><option value="">Bitte wählen</option>${candidates.map((tx)=>`<option value="${tx.id}" data-amount="${Math.abs(Number(tx.amount))}" data-currency="${escapeHtml(tx.currency)}" data-date="${escapeHtml(dateInputValue(new Date(tx.occurred_at)))}" data-bill-linked="${paidBillIds.has(tx.id)?'true':'false'}">${dateLabel(tx.occurred_at,locale)} · ${escapeHtml(tx.description)} · ${Math.abs(Number(tx.amount)).toFixed(2)} ${escapeHtml(tx.currency||currency)}${paidBillIds.has(tx.id)?' · Rechnung':''}</option>`).join('')}</select></label>
    <label class="field form-grid-span checkbox-field"><input type="checkbox" name="advanceNextDate" id="debtPaymentAdvance" checked><span>Nächsten Zahlungstermin automatisch weiterstellen</span></label>
    <div class="inline-alert form-grid-span" id="debtPaymentComponentInfo" hidden><strong>Teil einer Rechnung</strong><span>Nur der Schuldanteil reduziert die Restschuld. Der übrige Rechnungsbetrag bleibt normale Ausgabe. Es entsteht keine zweite Bankbuchung.</span></div>
    <div class="inline-alert form-grid-span" id="debtPaymentHistoryInfo" hidden><strong>Nur Verlauf</strong><span>Diese Variante verändert kein Konto. Verwende sie nur, wenn die Zahlung bereits im aktuellen Kontostand enthalten ist oder ausserhalb der erfassten Konten stattgefunden hat.</span></div>
    <label class="field form-grid-span"><span>Notiz</span><textarea class="text-control" name="note" id="debtPaymentNote" rows="3" placeholder="optional"></textarea></label>`;
}

export function renderDebts({
  debts = [], debtPayments = [], accounts = [], transactions = [], recurringRules = [], bills = [],
  household, profile, fxRates, canWrite = false, debtExpandedId = null,
} = {}) {
  const currency = household?.base_currency || 'CHF';
  const locale = profile?.locale || 'de-CH';
  const cv=(value,from)=>convertAmount(value,from||currency,currency,fxRates)??0;
  const activeDebts = debts.filter((d)=>d.status!=='paid');
  const outstanding = activeDebts.reduce((sum,debt)=>sum+cv(debt.outstanding_amount,debt.currency),0);
  const monthly = debts.filter((d)=>d.status==='active').reduce((sum,debt)=>sum+cv(Number(debt.installment_amount||0)*cadenceMonthlyFactor(debt.payment_cadence),debt.currency),0);
  const activePayments = debtPayments.filter((p)=>!p.reversed_at);
  const totalPrincipal = activePayments.reduce((sum,p)=>sum+cv(p.principal_amount,p.currency),0);

  const rows = debts.map((debt)=>{
    const history = debtPayments.filter((payment)=>payment.debt_id===debt.id);
    const linked = Boolean(debt.recurring_rule_id && recurringRules.some((rule)=>rule.id===debt.recurring_rule_id));
    const billingRule=debt.billing_recurring_rule_id ? recurringRules.find((rule)=>rule.id===debt.billing_recurring_rule_id) : null;
    const schedule=debtScheduleSummary(debt);
    const modeLabel=debt.payment_mode==='included_in_bill'
      ? `In Rechnung enthalten${billingRule?` · ${billingRule.description}`:''}`
      : linked?'Eigene Rate geplant':'Separate Rate';
    const canDelete = history.length===0;
    return `<tr>
      <td><strong>${escapeHtml(debt.name)}</strong><div class="table-meta">${escapeHtml(debt.creditor)} · ${escapeHtml(debt.currency||currency)}${schedule.termMonths?` · ${schedule.termMonths} Monate`:''} · ${escapeHtml(modeLabel)}</div></td>
      <td>${money(debt.outstanding_amount,{currency:debt.currency||currency,locale})}</td>
      <td>${money(debt.installment_amount,{currency:debt.currency||currency,locale})}<div class="table-meta">${escapeHtml(cadenceLabel(debt.payment_cadence))}</div></td>
      <td>${Number(debt.interest_rate||0).toFixed(2)} %</td>
      <td>${dateLabel(debt.next_payment_date,locale)}</td>
      <td>${statusPill(debt.status,statusLabel(debt.status))}${linked?`<div class="table-meta">Wiederkehrend verknüpft</div>`:''}</td>
      <td><div class="table-actions">
        <button class="table-action" type="button" data-action="debt-history" data-id="${debt.id}">${history.length ? `Verlauf (${history.length})` : 'Verlauf'}</button>
        ${canWrite?`<button class="table-action" type="button" data-action="debt-edit" data-id="${debt.id}">Bearbeiten</button><button class="table-action" type="button" data-action="debt-payment-open" data-id="${debt.id}" ${Number(debt.outstanding_amount)<=0?'disabled':''}>Zahlung</button>${debt.payment_mode==='included_in_bill'?'':linked?`<button class="table-action" type="button" data-action="debt-recurring-remove" data-id="${debt.id}">Wiederkehrend lösen</button>`:`<button class="table-action" type="button" data-action="debt-recurring" data-id="${debt.id}">Wiederkehrend</button>`}${canDelete?deleteButton('debts',debt.id):''}`:''}
      </div></td>
    </tr>`;
  });

  const selectedDebt = debts.find((debt)=>debt.id===debtExpandedId) || null;
  let historyCard = '';
  if (selectedDebt) {
    const history = debtPayments.filter((payment)=>payment.debt_id===selectedDebt.id)
      .sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at)));
    const latestActiveId = history.find((payment)=>!payment.reversed_at)?.id || null;
    const historyRows = history.map((payment)=>{
      const tx = payment.transactions;
      const accountName = tx?.accounts?.name || accounts.find((a)=>a.account_id===payment.payment_account_id)?.name || '';
      const details = [sourceLabel(payment.source), accountName, tx?.description].filter(Boolean).join(' · ');
      return `<tr>
        <td>${dateLabel(payment.paid_at,locale)}${payment.reversed_at?`<div class="table-meta">${statusPill('cancelled','Storniert')}</div>`:''}</td>
        <td>${money(payment.amount,{currency:payment.currency,locale})}<div class="table-meta">${escapeHtml(details)}</div></td>
        <td>${money(payment.principal_amount,{currency:payment.currency,locale})}</td>
        <td>${money(payment.interest_amount,{currency:payment.currency,locale})}</td>
        <td>${money(payment.fee_amount,{currency:payment.currency,locale})}</td>
        <td>${money(payment.outstanding_after,{currency:payment.currency,locale})}</td>
        <td>${canWrite&&!payment.reversed_at&&payment.id===latestActiveId?`<button class="table-action table-action--danger" type="button" data-action="debt-payment-reverse" data-id="${payment.id}">Stornieren</button>`:''}</td>
      </tr>`;
    });
    historyCard = `<article class="card card-padding" style="margin-top:16px"><div class="card-heading"><div><h3 class="card-title">Zahlungsverlauf · ${escapeHtml(selectedDebt.name)}</h3><p class="card-subtitle">Tilgung senkt die Restschuld; Zins und Gebühren bleiben echte Kosten. Storniert werden kann nur die zuletzt erfasste aktive Zahlung.</p></div><button class="table-action" type="button" data-action="debt-history-close">Schliessen</button></div>${dataTable({headers:['Datum','Zahlung','Tilgung','Zins','Gebühr','Rest danach',''],rows:historyRows,emptyText:'Für diese Schuld wurden noch keine Zahlungen erfasst.'})}</article>`;
  }

  return `
    ${pageHeader({title:'Schulden & Kredite',subtitle:'Restschuld, Rate und tatsächliche Zahlungen getrennt führen. Tilgung verändert die Schuld, Zins und Gebühren sind Kosten.',actions:canWrite?`<button class="action-button action-button--primary" type="button" data-action="show-form" data-target="debt-create">${icon('plus')} Kredit / Schuld</button>`:''})}
    ${canWrite?formShell('debt-create','Neue Schuld / Kredit','Vertragliche Eckdaten und geplante Rate erfassen',debtFields(accounts,currency,{recurringRules}),{hidden:true,submitLabel:'Schuld speichern'}):''}
    ${canWrite?formShell('debt-edit','Schuld / Kredit bearbeiten','Rate, Restschuld, Rhythmus und Termine sauber korrigieren',debtFields(accounts,currency,{edit:true,recurringRules}),{hidden:true,submitLabel:'Änderungen speichern'}):''}
    ${canWrite?formShell('debt-payment-create','Zahlung erfassen','Zahlung in Tilgung, Zins und Gebühren aufteilen',paymentFields(accounts,transactions,debtPayments,bills,currency,locale),{hidden:true,submitLabel:'Zahlung verbuchen'}):''}
    <div class="metric-grid" style="margin-bottom:16px">
      ${metricCard('Restschuld gesamt',money(outstanding,{currency,locale}),`${fxLabel(fxRates,currency)} · nicht bezahlte Schulden`)}
      ${metricCard('Geplante Raten / Monat',money(monthly,{currency,locale}),'auf Monatswert normalisiert')}
      ${metricCard('Bisher getilgt',money(totalPrincipal,{currency,locale}),'aus erfassten Zahlungen')}
      ${metricCard('Positionen',String(debts.length),'Kredite und Schulden')}
    </div>
    <article class="card card-padding">${dataTable({headers:['Schuld','Restschuld','Rate','Zins','Nächste Zahlung','Status',''],rows,emptyText:'Noch keine Schulden oder Kredite erfasst.'})}</article>
    ${historyCard}`;
}
