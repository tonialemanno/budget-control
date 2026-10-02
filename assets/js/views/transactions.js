import { emptyState, formShell, metricCard, pageHeader, statusPill } from '../app/components.js';
import { dateInputValue, dateLabel, dateTimeLocalValue, escapeHtml, money } from '../app/format.js';
import { convertAmount, fxLabel } from '../app/fx.js';
import { icon } from '../app/icons.js';
import { buildCategorizationGroups, categorizationSourceLabel } from '../app/categorization.js';
import { buildDebtPaymentTransactionMap, cashOutflowBase, consumptionExpenseBase, debtPrincipalBase } from '../app/financial-effects.js';

const TAX_YEAR_OPTIONS=[2025,2026,2027];
const TAX_SECTION_OPTIONS=[
  ['income','Erwerb & Einkommen'],
  ['work_expenses','Berufskosten'],
  ['pension_insurance','Vorsorge & Versicherungen'],
  ['banks_securities','Banken & Wertschriften'],
  ['crypto','Kryptowährungen'],
  ['debts','Schulden'],
  ['medical','Krankheits-/Unfallkosten'],
  ['children','Kinder'],
  ['support','Unterhaltszahlungen'],
  ['donations','Spenden'],
  ['property','Liegenschaften'],
  ['assets','Fahrzeuge & übriges Vermögen'],
  ['inheritance_gifts','Erbschaften & Schenkungen'],
  ['foreign','Ausland'],
  ['tax_account','Steuerkonto'],
  ['persons_household','Personen & Haushalt'],
];
const TAX_TREATMENT_OPTIONS=[
  ['','Automatisch nach Richtung'],
  ['income','Steuerbares Einkommen'],
  ['deduction','Abzug / steuerrelevante Ausgabe'],
  ['tax_payment','Steuerzahlung'],
  ['tax_refund','Steuerrückerstattung'],
  ['information','Nur Information'],
];
function taxYearOptions(selected){
  return TAX_YEAR_OPTIONS.map((year)=>`<option value="${year}" ${Number(selected)===year?'selected':''}>${year}</option>`).join('');
}
function taxSectionOptions(selected){
  return `<option value="">Automatisch</option>`+TAX_SECTION_OPTIONS.map(([key,label])=>`<option value="${key}" ${selected===key?'selected':''}>${label}</option>`).join('');
}
function taxTreatmentOptions(selected){
  return TAX_TREATMENT_OPTIONS.map(([key,label])=>`<option value="${key}" ${selected===key?'selected':''}>${label}</option>`).join('');
}

function periodStart(period) {
  const now=new Date();
  if(period==='year') return new Date(now.getFullYear(),0,1);
  if(period==='quarter') return new Date(now.getFullYear(),Math.floor(now.getMonth()/3)*3,1);
  if(period==='month') return new Date(now.getFullYear(),now.getMonth(),1);
  return null;
}
function periodLabel(period){
  if(period==='year') return 'Dieses Jahr';
  if(period==='quarter') return 'Dieses Quartal';
  if(period==='month') return 'Dieser Monat';
  if(period==='custom') return 'Benutzerdefiniert';
  return 'Gesamter Zeitraum';
}
function monthKey(value){ const d=new Date(value); return Number.isNaN(d.getTime())?'':`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; }
function monthLabel(key,locale){ const [y,m]=key.split('-').map(Number); return new Intl.DateTimeFormat(locale,{month:'short',year:'numeric'}).format(new Date(y,m-1,1)); }
function normalizedSearch(tx){ return `${tx.description||''} ${tx.counterparty||''} ${tx.note||''} ${tx.merchants?.name||''} ${tx.categories?.name||''} ${tx.accounts?.name||''}`.toLowerCase(); }
function filterTransactions(transactions,{period,from,to,query,category,account}){
  const start=period==='custom'||period==='all'?null:periodStart(period);
  const needle=String(query||'').trim().toLowerCase();
  return transactions.filter((tx)=>{
    if(tx.status!=='booked') return false;
    const d=new Date(tx.occurred_at);
    if(start&&d<start) return false;
    const iso=dateInputValue(new Date(tx.occurred_at));
    if(from&&iso<from) return false;
    if(to&&iso>to) return false;
    if(['debt_payment','receivable_principal'].includes(tx.cashflow_type) && category && category!=='all') return false;
    if(category==='uncategorized'&&tx.category_id) return false;
    if(category&&category!=='all'&&category!=='uncategorized'&&tx.category_id!==category) return false;
    if(account&&account!=='all'&&tx.account_id!==account) return false;
    if(needle&&!normalizedSearch(tx).includes(needle)) return false;
    return true;
  });
}
function cashSuggestion(tx,accounts){
  if(Number(tx.amount)>=0||tx.transfer_group_id||['debt_payment','receivable_principal'].includes(tx.cashflow_type)) return null;
  const text=`${tx.description||''} ${tx.counterparty||''}`.toLowerCase();
  const cash=accounts.find((a)=>a.account_id!==tx.account_id&&a.currency===tx.currency&&a.account_type==='cash');
  const savings=accounts.find((a)=>a.account_id!==tx.account_id&&a.currency===tx.currency&&a.account_type==='savings');
  if(cash && /(bancomat|atm|bargeld|cash|barbezug|withdraw|geldautomat)/i.test(text)) return {account:cash,label:`War das für ${cash.name}?`};
  if(savings && /(spar|übertrag|uebertrag|transfer|umbuch|eigenes konto)/i.test(text)) return {account:savings,label:`War das Sparen auf ${savings.name}?`};
  return null;
}
function txRow(tx,{locale,canWrite,accounts,canTax,paymentMap,billMap}){
  const positive=Number(tx.amount)>=0;
  const transfer=Boolean(tx.transfer_group_id);
  const debtPayment=tx.cashflow_type==='debt_payment' ? paymentMap?.get(tx.id) : null;
  const receivableManaged=tx.cashflow_type==='receivable_principal';
  const billPayment=billMap?.get(tx.id)||null;
  const managed=Boolean(debtPayment||receivableManaged||billPayment);
  const suggestion=managed?null:cashSuggestion(tx,accounts);
  const isTwint=!managed&&/twint/i.test(`${tx.description||''} ${tx.counterparty||''}`);
  const future=new Date(tx.occurred_at)>new Date();
  const categoryLabel=debtPayment?'Schuldentilgung':receivableManaged?(positive?'Rückzahlung Forderung':'Forderung ausgezahlt'):billPayment?'Rechnungszahlung':tx.categories?.name||(transfer?'Umbuchung':'Ohne Kategorie');
  const split=debtPayment?` · Tilgung ${money(debtPayment.principal_amount,{currency:debtPayment.currency||tx.currency,locale})}${Number(debtPayment.interest_amount||0)>0?` · Zins ${money(debtPayment.interest_amount,{currency:debtPayment.currency||tx.currency,locale})}`:''}${Number(debtPayment.fee_amount||0)>0?` · Gebühren ${money(debtPayment.fee_amount,{currency:debtPayment.currency||tx.currency,locale})}`:''}`:'';
  const taxAction=canTax&&!receivableManaged?`<button class="table-action" type="button" data-action="transaction-tax-toggle" data-id="${tx.id}" data-value="${tx.tax_relevant?'false':'true'}">${tx.tax_relevant?'Steuer ✓':'Steuer'}</button>`:'';
  const managedAction=debtPayment?`<a class="table-action" href="#/debts">Schuld anzeigen</a>${taxAction}`:receivableManaged?`<a class="table-action" href="#/receivables">Forderung anzeigen</a>`:billPayment?`<a class="table-action" href="#/bills">Rechnung anzeigen</a>${taxAction}`:'';
  const actions=canWrite?`<div class="row-actions">${managed?managedAction:transfer?'':`<button class="table-action" type="button" data-action="transaction-edit" data-id="${tx.id}">Bearbeiten</button><button class="table-action" type="button" data-action="transaction-make-recurring" data-id="${tx.id}">Wiederkehrend</button>${taxAction}`}${managed?'':`<button class="table-action table-action--danger" type="button" data-action="transaction-delete" data-id="${tx.id}">${transfer?'Umbuchung löschen':'Löschen'}</button>`}</div>`:'';
  return `<div class="list-row transaction-row"><div class="list-row-main"><span class="list-row-leading ${positive?'list-row-leading--green':''}">${icon(transfer?'repeat':debtPayment?'credit-card':positive?'arrow-down-left':'arrow-up-right')}</span><div><div class="list-row-title">${escapeHtml(tx.description)}${future?' · Geplant':''}</div><div class="list-row-meta">${escapeHtml(categoryLabel)} · ${escapeHtml(tx.merchants?.name||tx.counterparty||'')} ${tx.merchants?.name||tx.counterparty?'· ':''}${escapeHtml(tx.accounts?.name||'')} · ${dateLabel(tx.occurred_at,locale)}${tx.note?` · ${escapeHtml(tx.note)}`:''}${split}</div>${suggestion&&canWrite?`<div class="transaction-suggestion"><span>${escapeHtml(suggestion.label)}</span><button class="table-action" type="button" data-action="transaction-to-transfer" data-id="${tx.id}" data-to-account="${suggestion.account.account_id}">Ja, als Umbuchung</button></div>`:''}${isTwint&&!tx.note&&canWrite?`<div class="transaction-suggestion"><span>TWINT-Zahlung: Wofür war sie?</span><button class="table-action" type="button" data-action="transaction-note" data-id="${tx.id}">Zweck ergänzen</button></div>`:''}</div></div><div class="list-row-trailing"><div class="amount ${positive?'amount--positive':'amount--negative'}">${money(tx.amount,{sign:positive,currency:tx.currency,locale})}</div>${actions}</div></div>`;
}

function renderCategorizationReview({
  transactions, categories, merchants, categorizationRules, household, profile, fxRates,
  canWrite, categorizationFilter='action', categorizationPage=1,
}) {
  const groups = buildCategorizationGroups({ transactions, categories, merchants, rules:categorizationRules });
  const uncategorizedCount = transactions.filter((tx)=>tx.status==='booked'&&!tx.transfer_group_id&&!['debt_payment','receivable_principal'].includes(tx.cashflow_type)&&!tx.category_id).length;
  const safeGroups = groups.filter((group)=>group.unassignedCount>0&&group.suggestion?.safe);
  const unresolvedGroups = groups.filter((group)=>group.unassignedCount>0&&!group.suggestion);
  const mixedGroups = groups.filter((group)=>group.mixed);
  let visible = groups;
  if (categorizationFilter === 'action') visible = groups.filter((group)=>group.needsAttention);
  if (categorizationFilter === 'unresolved') visible = unresolvedGroups;
  const pageSize = 15;
  const totalPages = Math.max(1, Math.ceil(visible.length / pageSize));
  const page = Math.min(Math.max(1, Number(categorizationPage)||1), totalPages);
  const pageRows = visible.slice((page-1)*pageSize, page*pageSize);
  const currency = household?.base_currency || 'CHF'; const locale = profile?.locale || 'de-CH';
  const rows = pageRows.map((group)=>{
    const total = group.rows.reduce((sum,row)=>sum+Math.abs(convertAmount(row.amount,row.currency,currency,fxRates)??0),0);
    const current = group.mixed ? 'Gemischt' : group.currentCategory?.name || (group.unassignedCount===group.rows.length ? 'Ohne Kategorie' : 'Teilweise kategorisiert');
    const suggestion = group.suggestion ? categorizationSourceLabel(group.suggestion.source) : 'Kein sicherer Vorschlag';
    const options = categories.filter((category)=>category.kind===group.kind).map((category)=>`<option value="${category.id}" ${category.id===group.selectedCategoryId?'selected':''}>${escapeHtml(category.name)}</option>`).join('');
    const pill = group.suggestion?.safe ? statusPill('active','Sicherer Vorschlag') : group.suggestion ? statusPill('pending','Prüfen') : group.mixed ? statusPill('pending','Gemischt') : statusPill('open','Offen');
    return `<div class="categorization-group-row" data-categorization-group="${escapeHtml(group.key)}"><div class="categorization-group-copy"><div class="categorization-group-title"><strong>${escapeHtml(group.name)}</strong>${pill}</div><span>${group.rows.length} Buchung${group.rows.length===1?'':'en'} · ${money(total,{currency,locale})} · aktuell: ${escapeHtml(current)}</span><small>${escapeHtml(suggestion)}${group.unassignedCount?` · ${group.unassignedCount} noch ohne Kategorie`:''}</small></div><select class="text-control" data-categorization-category><option value="">Kategorie wählen</option>${options}</select><div class="categorization-group-actions">${canWrite?`<button class="table-action" type="button" data-action="categorization-apply-group" data-group-key="${escapeHtml(group.key)}">Gruppe setzen & merken</button>`:''}<button class="table-action" type="button" data-action="categorization-view-group" data-group-key="${escapeHtml(group.key)}">Buchungen ansehen</button></div></div>`;
  }).join('');
  return `<article class="card card-padding categorization-review"><div class="card-heading"><div><h3 class="card-title">Kategorien analysieren</h3><p class="card-subtitle">Bestehende Buchungen werden nach Händler gruppiert. Sichere Automatik füllt nur bisher unkategorisierte Buchungen; bestehende Kategorien werden nicht still überschrieben.</p></div><div class="card-footer-actions">${canWrite?`<button class="action-button action-button--primary" type="button" data-action="categorization-apply-safe" ${safeGroups.length?'':'disabled'}>Sichere Vorschläge übernehmen</button>`:''}<button class="action-button action-button--secondary" type="button" data-action="categorization-close">Schliessen</button></div></div><div class="categorization-stats"><div><span>Ohne Kategorie</span><strong>${uncategorizedCount}</strong></div><div><span>Sichere Gruppen</span><strong>${safeGroups.length}</strong></div><div><span>Noch offen</span><strong>${unresolvedGroups.length}</strong></div><div><span>Gemischte Gruppen</span><strong>${mixedGroups.length}</strong></div></div><div class="categorization-toolbar"><label class="field"><span>Anzeige</span><select class="text-control" id="categorizationFilter"><option value="action" ${categorizationFilter==='action'?'selected':''}>Vorschläge & offene Gruppen</option><option value="unresolved" ${categorizationFilter==='unresolved'?'selected':''}>Nur ohne Vorschlag</option><option value="all" ${categorizationFilter==='all'?'selected':''}>Alle Händlergruppen</option></select></label><div class="toolbar-note">„Gruppe setzen & merken“ ist die bewusste Korrektur für alle Buchungen dieser Händlergruppe. Danach wird die Zuordnung bei künftigen Imports vorgeschlagen.</div></div><div class="categorization-group-list">${rows || '<div class="table-empty">Für diese Ansicht gibt es nichts zu prüfen.</div>'}</div>${visible.length>pageSize?`<div class="admin-pager categorization-pager"><button class="table-action" type="button" data-action="categorization-page" data-page="${page-1}" ${page<=1?'disabled':''}>Zurück</button><span>Seite ${page} / ${totalPages} · ${visible.length} Gruppen</span><button class="table-action" type="button" data-action="categorization-page" data-page="${page+1}" ${page>=totalPages?'disabled':''}>Weiter</button></div>`:''}</article>`;
}

export function renderTransactions({ accounts = [], categories = [], transactions = [], debtPayments = [], bills = [], household, profile, canWrite = false, fxRates, transactionView='summary', transactionPeriod='month', transactionQuery='', transactionCategory='all', transactionAccount='all', transactionFrom='', transactionTo='', transactionPage=1, moduleAccess = {}, hiddenModules = [], merchants = [], categorizationRules = [], categorizationOpen = false, categorizationFilter = 'action', categorizationPage = 1 } = {}) {
  const baseCurrency = household?.base_currency || 'CHF'; const canTax = moduleAccess?.tax === true && !hiddenModules.includes('tax'); const locale = profile?.locale || 'de-CH';
  const rows=filterTransactions(transactions,{period:transactionPeriod,from:transactionFrom,to:transactionTo,query:transactionQuery,category:transactionCategory,account:transactionAccount});
  const now=new Date();
  const actualRows=rows.filter((tx)=>{ const date=new Date(tx.occurred_at); return !Number.isNaN(date.getTime())&&date<=now; });
  const paymentMap=buildDebtPaymentTransactionMap(debtPayments);
  const billMap=new Map(bills.filter((bill)=>bill.status==='paid'&&bill.paid_transaction_id).map((bill)=>[bill.paid_transaction_id,bill]));
  const spendRows=actualRows.filter((tx)=>Number(tx.amount)<0&&!tx.transfer_group_id&&consumptionExpenseBase(tx,paymentMap,baseCurrency,fxRates)>0);
  const income=actualRows.filter((tx)=>Number(tx.amount)>0&&!tx.transfer_group_id&&tx.cashflow_type!=='receivable_principal').reduce((s,tx)=>s+(convertAmount(tx.amount,tx.currency,baseCurrency,fxRates)??0),0);
  const receivableInflow=actualRows.filter((tx)=>Number(tx.amount)>0&&!tx.transfer_group_id&&tx.cashflow_type==='receivable_principal').reduce((s,tx)=>s+(convertAmount(tx.amount,tx.currency,baseCurrency,fxRates)??0),0);
  const expenses=actualRows.reduce((s,tx)=>s+consumptionExpenseBase(tx,paymentMap,baseCurrency,fxRates),0);
  const cashOutflow=actualRows.reduce((s,tx)=>s+cashOutflowBase(tx,baseCurrency,fxRates),0);
  const debtPrincipal=actualRows.reduce((s,tx)=>s+debtPrincipalBase(tx,paymentMap,baseCurrency,fxRates),0);
  const savingsIds=new Set(accounts.filter((a)=>a.account_type==='savings').map((a)=>a.account_id));
  const savings=actualRows.filter((tx)=>tx.transfer_group_id&&Number(tx.amount)>0&&savingsIds.has(tx.account_id)).reduce((s,tx)=>s+(convertAmount(tx.amount,tx.currency,baseCurrency,fxRates)??0),0);
  const categoryOptions = categories.map((c)=>`<option value="${c.id}">${escapeHtml(c.name)} · ${c.kind==='income'?'Einnahme':'Ausgabe'}</option>`).join('');
  const accountOptions = accounts.map((a)=>`<option value="${a.account_id}" data-currency="${escapeHtml(a.currency)}">${escapeHtml(a.name)} · ${escapeHtml(a.currency)}</option>`).join('');
  const merchantOptions = merchants.map((m)=>`<option value="${m.id}">${escapeHtml(m.name)}</option>`).join('');
  const receiptCategoryOptions = categories.filter((c)=>c.kind==='expense').map((c)=>`<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');

  const txFields = `<label class="field"><span>Typ</span><select class="text-control" name="direction"><option value="expense">Ausgabe</option><option value="income">Einnahme</option></select></label><label class="field"><span>Betrag</span><input class="text-control" name="amount" type="number" step="0.01" min="0.01" required></label><label class="field"><span>Konto</span><select class="text-control" name="accountId" required>${accountOptions}</select></label><label class="field"><span>Datum / Zeit</span><input class="text-control" name="occurredAt" type="datetime-local" required value="${dateTimeLocalValue()}"></label><label class="field form-grid-span"><span>Beschreibung</span><input class="text-control" name="description" required placeholder="z. B. Migros"></label><label class="field"><span>Kategorie</span><select class="text-control" name="categoryId"><option value="">Ohne Kategorie</option>${categoryOptions}</select></label><label class="field"><span>Händler</span><select class="text-control" name="merchantId"><option value="">Ohne Händler</option>${merchantOptions}</select></label><label class="field"><span>Gegenpartei</span><input class="text-control" name="counterparty" placeholder="optional"></label><label class="field form-grid-span"><span>Notiz / Zweck</span><textarea class="text-control" name="note" rows="3" placeholder="z. B. TWINT: Mittagessen"></textarea></label>${canTax?`<label class="field"><span>Steuerrelevant</span><select class="text-control" name="taxRelevant"><option value="false">Nein</option><option value="true">Ja</option></select></label><label class="field"><span>Steuerjahr</span><select class="text-control" name="taxYear">${taxYearOptions(new Date().getFullYear())}</select></label><label class="field"><span>Steuerart</span><select class="text-control" name="taxTreatment">${taxTreatmentOptions('')}</select></label><label class="field"><span>Steuerbereich</span><select class="text-control" name="taxSectionKey">${taxSectionOptions('')}</select></label><label class="field form-grid-span"><span>Steuerkategorie / Detail</span><input class="text-control" name="taxCategory" placeholder="z. B. Weiterbildung, Krankheitskosten, Staatssteuer"></label>`:''}`;
  const editFields = `<input type="hidden" name="transactionId" id="transactionEditId"><label class="field"><span>Typ</span><select class="text-control" name="direction" id="transactionEditDirection"><option value="expense">Ausgabe</option><option value="income">Einnahme</option></select></label><label class="field"><span>Betrag</span><input class="text-control" name="amount" id="transactionEditAmount" type="number" step="0.01" min="0.01" required></label><label class="field"><span>Konto</span><select class="text-control" name="accountId" id="transactionEditAccount" required>${accountOptions}</select></label><label class="field"><span>Datum / Zeit</span><input class="text-control" name="occurredAt" id="transactionEditDate" type="datetime-local" required></label><label class="field form-grid-span"><span>Beschreibung</span><input class="text-control" name="description" id="transactionEditDescription" required></label><label class="field"><span>Kategorie</span><select class="text-control" name="categoryId" id="transactionEditCategory"><option value="">Ohne Kategorie</option>${categoryOptions}</select></label><label class="field"><span>Händler</span><select class="text-control" name="merchantId" id="transactionEditMerchant"><option value="">Ohne Händler</option>${merchantOptions}</select></label><label class="field"><span>Gegenpartei</span><input class="text-control" name="counterparty" id="transactionEditCounterparty"></label><label class="field form-grid-span"><span>Notiz / Zweck</span><textarea class="text-control" name="note" id="transactionEditNote" rows="3"></textarea></label>${canTax?`<label class="field"><span>Steuerrelevant</span><select class="text-control" name="taxRelevant" id="transactionEditTaxRelevant"><option value="false">Nein</option><option value="true">Ja</option></select></label><label class="field"><span>Steuerjahr</span><select class="text-control" name="taxYear" id="transactionEditTaxYear">${taxYearOptions(new Date().getFullYear())}</select></label><label class="field"><span>Steuerart</span><select class="text-control" name="taxTreatment" id="transactionEditTaxTreatment">${taxTreatmentOptions('')}</select></label><label class="field"><span>Steuerbereich</span><select class="text-control" name="taxSectionKey" id="transactionEditTaxSectionKey">${taxSectionOptions('')}</select></label><label class="field form-grid-span"><span>Steuerkategorie / Detail</span><input class="text-control" name="taxCategory" id="transactionEditTaxCategory" placeholder="z. B. Weiterbildung, Krankheitskosten, Staatssteuer"></label>`:''}<label class="field form-grid-span checkbox-field"><input type="checkbox" name="makeRecurring" id="transactionMakeRecurring"><span>Als wiederkehrende Zahlung übernehmen</span></label><div class="form-grid form-grid--2 form-grid-span" id="transactionRecurringFields" hidden><label class="field"><span>Rhythmus</span><select class="text-control" name="recurringCadence"><option value="monthly">Monatlich</option><option value="weekly">Wöchentlich</option><option value="quarterly">Quartalsweise</option><option value="semiannual">Halbjährlich</option><option value="annual">Jährlich</option></select></label><label class="field"><span>Nächster Termin</span><input class="text-control" name="recurringNextDate" id="transactionRecurringNextDate" type="date"></label></div>`;
  const transferFields = `<label class="field"><span>Von Konto</span><select class="text-control" name="fromAccountId" required>${accountOptions}</select></label><label class="field"><span>Auf Konto</span><select class="text-control" name="toAccountId" required>${accountOptions}</select></label><label class="field"><span>Abgang vom Quellkonto</span><input class="text-control" name="amount" type="number" step="0.01" min="0.01" required></label><label class="field"><span>Eingang auf Zielkonto</span><input class="text-control" name="toAmount" type="number" step="0.01" min="0.01" placeholder="nur bei anderer Währung"></label><label class="field"><span>Datum / Zeit</span><input class="text-control" name="occurredAt" type="datetime-local" required value="${dateTimeLocalValue()}"></label><label class="field"><span>Beschreibung</span><input class="text-control" name="description" value="Umbuchung" required></label>`;

  const groups=new Map();
  for(const tx of spendRows){ const isDebtCost=tx.cashflow_type==='debt_payment'; const key=isDebtCost?'debt-costs':tx.category_id||'uncategorized'; const g=groups.get(key)||{id:key,name:isDebtCost?'Zinsen & Gebühren':tx.categories?.name||'Ohne Kategorie',total:0,count:0,merchants:new Map(),synthetic:isDebtCost}; const value=consumptionExpenseBase(tx,paymentMap,baseCurrency,fxRates); g.total+=value; g.count++; const merchant=tx.merchants?.name||tx.counterparty||tx.description; g.merchants.set(merchant,(g.merchants.get(merchant)||0)+value); groups.set(key,g); }
  const summary=[...groups.values()].sort((a,b)=>b.total-a.total).map((g)=>{ const top=[...g.merchants.entries()].sort((a,b)=>b[1]-a[1]).slice(0,2).map(([n])=>n).join(' · '); const action=g.synthetic?'<a class="table-action" href="#/debts">Schulden ansehen</a>':`<button class="table-action" type="button" data-action="transaction-filter-category" data-category="${escapeHtml(g.id)}">Buchungen ansehen</button>`; return `<article class="card transaction-summary-card"><div class="metric-label">${escapeHtml(g.name)}</div><div class="transaction-summary-value">${money(g.total,{currency:baseCurrency,locale})}</div><div class="metric-note">${g.count} Buchung${g.count===1?'':'en'}${top?` · ${escapeHtml(top)}`:''}</div><div class="card-footer-actions">${action}</div></article>`; }).join('');
  const monthly=new Map(); for(const tx of spendRows){ const key=monthKey(tx.occurred_at); if(!key) continue; const value=consumptionExpenseBase(tx,paymentMap,baseCurrency,fxRates); const m=monthly.get(key)||{total:0,count:0}; m.total+=value; m.count++; monthly.set(key,m); }
  const monthlyRows=[...monthly.entries()].sort((a,b)=>b[0].localeCompare(a[0]));
  const monthlyAverage=monthlyRows.length ? monthlyRows.reduce((sum,[,month])=>sum+month.total,0)/monthlyRows.length : 0;
  const monthlyAverageNote=monthlyRows.length ? `über ${monthlyRows.length} angezeigte${monthlyRows.length===1?'n':''} Monat${monthlyRows.length===1?'':'e'} des aktuellen Filters` : 'für den aktuellen Filter';
  const monthlyHistory=monthlyRows.length>1?`<article class="card card-padding transaction-history-card"><div class="card-heading"><div><h3 class="card-title">Monatsverlauf</h3><p class="card-subtitle">Rückwirkende Ausgaben für den aktuellen Filter.</p></div></div><div class="transaction-month-grid">${monthlyRows.map(([key,m])=>`<div class="transaction-month-item"><span>${escapeHtml(monthLabel(key,locale))}</span><strong>${money(m.total,{currency:baseCurrency,locale})}</strong><small>${m.count} Buchung${m.count===1?'':'en'}</small></div>`).join('')}</div></article>`:'';
  const pageSize=50; const totalPages=Math.max(1,Math.ceil(rows.length/pageSize)); const page=Math.min(Math.max(1,Number(transactionPage)||1),totalPages); const offset=(page-1)*pageSize; const pageRows=rows.slice(offset,offset+pageSize); const rangeText=rows.length?`${offset+1}–${Math.min(offset+pageSize,rows.length)} von ${rows.length}`:'0 Treffer';
  const earliest=transactions.length?transactions.reduce((min,tx)=>String(tx.occurred_at)<String(min.occurred_at)?tx:min,transactions[0]):null; const latest=transactions[0]||null;
  const categoryFilterOptions=categories.map((c)=>`<option value="${c.id}" ${transactionCategory===c.id?'selected':''}>${escapeHtml(c.name)}</option>`).join('');
  const accountFilterOptions=accounts.map((a)=>`<option value="${a.account_id}" ${transactionAccount===a.account_id?'selected':''}>${escapeHtml(a.name)}</option>`).join('');
  const hasFilters=Boolean(transactionQuery||transactionFrom||transactionTo||(transactionCategory&&transactionCategory!=='all')||(transactionAccount&&transactionAccount!=='all')||transactionPeriod==='all'||transactionPeriod==='custom');
  const categorizationReview = categorizationOpen ? renderCategorizationReview({ transactions, categories, merchants, categorizationRules, household, profile, fxRates, canWrite, categorizationFilter, categorizationPage }) : '';

  return `
    ${pageHeader({title:'Transaktionen',subtitle:'Kacheln zeigen die Auswertung; die Buchungsliste bleibt als vollständiges Journal erhalten, ist aber filterbar und paginiert.',actions:canWrite?`<button class="action-button action-button--primary" type="button" data-action="receipt-camera">${icon('receipt')} Beleg fotografieren</button><button class="action-button action-button--secondary" type="button" data-action="categorization-open">${icon('sparkles')} Kategorien analysieren</button><button class="action-button action-button--secondary" type="button" data-action="show-form" data-target="transaction-create">${icon('plus')} Transaktion</button><button class="action-button action-button--secondary" type="button" data-action="show-form" data-target="transfer-create" ${accounts.length>1?'':'disabled'}>${icon('repeat')} Umbuchung</button>`:''})}
    ${canWrite?formShell('transaction-create','Neue Transaktion','Manuelle Buchung',txFields,{hidden:true,submitLabel:'Transaktion speichern'}):''}
    ${canWrite?formShell('transaction-edit','Transaktion bearbeiten','Buchung, Zweck, Steuerstatus oder Wiederkehrend korrigieren',editFields,{hidden:true,submitLabel:'Änderungen speichern'}):''}
    ${canWrite?formShell('transfer-create','Umbuchung','Geld zwischen eigenen Konten verschieben',transferFields,{hidden:true,submitLabel:'Umbuchung speichern'}):''}
    ${canWrite?`<input id="receiptCameraInput" type="file" accept="image/*" capture="environment" hidden>
    <form class="card card-padding form-card receipt-review" id="receipt-create" data-form="receipt-create" hidden>
      <div class="card-heading"><div><h3 class="card-title">Beleg prüfen</h3><p class="card-subtitle">Finance liest Händler, Datum und Betrag lokal auf diesem Gerät. Vor dem Buchen kannst du alles korrigieren.</p></div><span class="list-row-leading">${icon('receipt')}</span></div>
      <div class="receipt-review-grid">
        <div class="receipt-preview-card"><img id="receiptPreview" class="receipt-preview" alt="Belegvorschau"><div class="receipt-ocr-status"><strong id="receiptOcrStatus">Bereit</strong><span id="receiptOcrProgressText">Foto auswählen</span><div class="receipt-progress"><span id="receiptOcrProgressBar"></span></div></div></div>
        <div class="form-grid form-grid--2 receipt-fields">
          <label class="field form-grid-span"><span>Händler</span><input class="text-control" id="receiptMerchant" name="merchant" required placeholder="z. B. McDonald's"></label>
          <label class="field"><span>Betrag</span><input class="text-control" id="receiptAmount" name="amount" type="number" step="0.01" min="0.01" required></label>
          <label class="field"><span>Währung</span><select class="text-control" id="receiptCurrency" name="currency"><option value="CHF">CHF</option><option value="EUR">EUR</option><option value="USD">USD</option><option value="GBP">GBP</option></select></label>
          <label class="field"><span>Belegdatum</span><input class="text-control" id="receiptDate" name="receiptDate" type="date" required></label>
          <label class="field"><span>Kategorie</span><select class="text-control" id="receiptCategory" name="categoryId"><option value="">Ohne Kategorie</option>${receiptCategoryOptions}</select></label>
          <label class="field form-grid-span"><span>Was soll Finance tun?</span><select class="text-control" id="receiptMode" name="mode"><option value="new">Neue Ausgabe buchen</option><option value="link">Mit vorhandener Bankbuchung verknüpfen</option></select></label>
          <label class="field form-grid-span" id="receiptAccountField"><span>Zahlungskonto</span><select class="text-control" id="receiptAccount" name="accountId"><option value="">Bitte wählen</option>${accountOptions}</select><small id="receiptAccountHint">Für neue Ausgaben muss die Kontowährung zum Beleg passen.</small></label>
          <label class="field form-grid-span" id="receiptMatchField" hidden><span>Passende Bankbuchung</span><select class="text-control" id="receiptMatch" name="transactionId"><option value="">Bitte wählen</option></select><small id="receiptMatchHint">Finance sucht nach Betrag, Währung, Datum und Händler.</small></label>
          <div class="inline-alert receipt-match-alert form-grid-span" id="receiptMatchAlert" hidden></div>
          <label class="field form-grid-span"><span>Notiz</span><textarea class="text-control" id="receiptNote" name="note" rows="2" placeholder="optional"></textarea></label>
          <label class="field form-grid-span checkbox-field"><input type="checkbox" id="receiptRememberMerchant" name="rememberMerchant" checked><span>Händler und Kategorie für künftige Buchungen merken</span></label>
          <details class="receipt-ocr-details form-grid-span"><summary>Erkannten OCR-Text anzeigen</summary><pre id="receiptOcrText" class="receipt-ocr-text"></pre></details>
        </div>
      </div>
      <div class="form-actions"><button class="action-button action-button--secondary" type="button" data-action="receipt-cancel">Abbrechen</button><button class="action-button action-button--primary" type="submit">Beleg übernehmen</button></div>
    </form>`:''}
    ${categorizationReview}

    <article class="card card-padding transaction-filter-card"><div class="transaction-filter-grid"><label class="field"><span>Suchen</span><input class="text-control" id="transactionSearch" type="search" value="${escapeHtml(transactionQuery)}" placeholder="z. B. Migros, MediaMarkt, TWINT"></label><label class="field"><span>Zeitraum</span><select class="text-control" id="transactionPeriodSelect"><option value="month" ${transactionPeriod==='month'?'selected':''}>Aktueller Monat</option><option value="quarter" ${transactionPeriod==='quarter'?'selected':''}>Aktuelles Quartal</option><option value="year" ${transactionPeriod==='year'?'selected':''}>Aktuelles Jahr</option><option value="all" ${transactionPeriod==='all'?'selected':''}>Alle Buchungen</option><option value="custom" ${transactionPeriod==='custom'?'selected':''}>Von / Bis</option></select></label><label class="field"><span>Kategorie</span><select class="text-control" id="transactionCategoryFilter"><option value="all">Alle Kategorien</option><option value="uncategorized" ${transactionCategory==='uncategorized'?'selected':''}>Ohne Kategorie</option>${categoryFilterOptions}</select></label><label class="field"><span>Konto</span><select class="text-control" id="transactionAccountFilter"><option value="all">Alle Konten</option>${accountFilterOptions}</select></label><label class="field"><span>Von</span><input class="text-control" id="transactionFrom" type="date" value="${escapeHtml(transactionFrom)}"></label><label class="field"><span>Bis</span><input class="text-control" id="transactionTo" type="date" value="${escapeHtml(transactionTo)}"></label><label class="field"><span>Ansicht</span><select class="text-control" id="transactionViewSelect"><option value="summary" ${transactionView==='summary'?'selected':''}>Kacheln</option><option value="details" ${transactionView==='details'?'selected':''}>Einzelbuchungen</option></select></label><div class="transaction-filter-actions"><button class="table-action" type="button" data-action="transaction-filter-reset" ${hasFilters?'':'disabled'}>Filter zurücksetzen</button></div></div><div class="toolbar-note">${transactions.length} Buchungen geladen${earliest&&latest?` · Daten von ${dateLabel(earliest.occurred_at,locale)} bis ${dateLabel(latest.occurred_at,locale)}`:''} · ${escapeHtml(fxLabel(fxRates,baseCurrency))}</div></article>
    <div class="metric-grid" style="margin-bottom:16px">${metricCard('Einnahmen',money(income,{currency:baseCurrency,locale}),`${periodLabel(transactionPeriod)} · aktueller Filter`,'positive')}${metricCard('Ausgaben',money(expenses,{currency:baseCurrency,locale}),'Konsum, Zins & Gebühren')}${monthlyRows.length?metricCard('Ø Ausgaben / Monat',money(monthlyAverage,{currency:baseCurrency,locale}),monthlyAverageNote):''}${debtPrincipal>0?metricCard('Schuldentilgung',money(debtPrincipal,{currency:baseCurrency,locale}),'reduziert Verbindlichkeiten'):''}${metricCard('Cashflow',money(income+receivableInflow-cashOutflow,{currency:baseCurrency,locale}),'alle externen Geldbewegungen',income+receivableInflow-cashOutflow>=0?'positive':'warning')}${metricCard('Sparen',money(savings,{currency:baseCurrency,locale}),'Umbuchungen auf Sparkonten','positive')}</div>
    ${transactionView==='summary'?`<div class="transaction-summary-grid">${summary||emptyState('list','Noch keine Ausgaben','Für den gewählten Filter liegen keine Ausgaben vor.')}</div>${monthlyHistory}`:`<article class="card card-padding"><div class="card-heading"><div><h3 class="card-title">Buchungen</h3><p class="card-subtitle">${escapeHtml(rangeText)} · keine Endlosliste</p></div><div class="admin-pager"><button class="table-action" type="button" data-action="transaction-page" data-page="${page-1}" ${page<=1?'disabled':''}>Zurück</button><span>Seite ${page} / ${totalPages}</span><button class="table-action" type="button" data-action="transaction-page" data-page="${page+1}" ${page>=totalPages?'disabled':''}>Weiter</button></div></div>${pageRows.length?`<div class="list">${pageRows.map((tx)=>txRow(tx,{locale,canWrite,accounts,canTax,paymentMap,billMap})).join('')}</div>`:emptyState('list','Keine Treffer','Passe Suche oder Filter an.')}</article>`}`;
}
