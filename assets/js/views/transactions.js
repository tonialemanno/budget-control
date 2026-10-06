import { emptyState, formShell, metricCard, pageHeader, statusPill } from '../app/components.js';
import { dateInputValue, dateLabel, dateTimeLocalValue, escapeHtml, money } from '../app/format.js';
import { convertAmount, fxLabel } from '../app/fx.js';
import { icon } from '../app/icons.js';
import { buildCategorizationGroups, categorizationSourceLabel } from '../app/categorization.js';
import { buildDebtPaymentTransactionMap, cashOutflowBase } from '../app/financial-effects.js';
import { semanticDebtPrincipalBase, semanticExpenseBase, semanticIncomeBase, semanticType } from '../app/finance-semantics.js';
import { primaryOperatingAccount } from '../app/finance-insights.js';
import { financeMonthMode, primaryAccountPreferenceId } from '../app/user-preferences.js';
import { rankCategoriesByUsage } from '../app/category-ranking.js';
import { likelyTransactionDuplicates } from '../app/duplicate-intelligence.js?v=20261006-r35';
import { financeCycleLabel, previousFinanceCycle, resolveFinanceCycle } from '../app/finance-cycle.js';

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

function periodBounds(period,{mode='day_25',now=new Date()}={}) {
  if(period==='month'){
    const cycle=resolveFinanceCycle({now,fallbackDay:25,mode});
    return {start:cycle.start,endExclusive:cycle.endExclusive};
  }
  if(period==='previous_month'){
    const cycle=resolveFinanceCycle({now,fallbackDay:25,mode});
    const previous=previousFinanceCycle(cycle,{fallbackDay:25});
    return {start:previous.start,endExclusive:previous.endExclusive};
  }
  if(period==='year') return {start:new Date(now.getFullYear(),0,1),endExclusive:null};
  if(period==='quarter') return {start:new Date(now.getFullYear(),Math.floor(now.getMonth()/3)*3,1),endExclusive:null};
  return {start:null,endExclusive:null};
}
function periodLabel(period,{currentCycle,previousCycle,locale='de-CH',mode='day_25'}={}){
  if(period==='year') return 'Dieses Jahr';
  if(period==='quarter') return 'Dieses Quartal';
  if(period==='month') return `${mode==='calendar'?'Aktueller Monat':'Aktueller Finanzmonat'} · ${financeCycleLabel(currentCycle,locale)}`;
  if(period==='previous_month') return `${mode==='calendar'?'Letzter Monat':'Letzter Finanzmonat'} · ${financeCycleLabel(previousCycle,locale)}`;
  if(period==='custom') return 'Benutzerdefiniert';
  return 'Gesamter Zeitraum';
}
function monthKey(value){ const d=new Date(value); return Number.isNaN(d.getTime())?'':`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; }
function monthLabel(key,locale){ const [y,m]=key.split('-').map(Number); return new Intl.DateTimeFormat(locale,{month:'short',year:'numeric'}).format(new Date(y,m-1,1)); }
function normalizedSearch(tx){
  const amount=Number(tx?.amount||0);
  const abs=Math.abs(amount);
  const amountTokens=[
    amount.toString(),abs.toString(),
    amount.toFixed(2),abs.toFixed(2),
    amount.toFixed(2).replace('.',','),abs.toFixed(2).replace('.',','),
    tx?.currency||'',
    `${tx?.currency||''} ${abs.toFixed(2)}`,
  ];
  return `${tx.description||''} ${tx.counterparty||''} ${tx.counterparties?.name||''} ${tx.note||''} ${tx.merchants?.name||''} ${tx.categories?.name||''} ${tx.accounts?.name||''} ${tx.transaction_contexts?.name||''} ${tx.vehicles?.name||''} ${amountTokens.join(' ')}`.toLowerCase();
}
function duplicatePairKey(leftId,rightId){
  return [String(leftId||''),String(rightId||'')].sort().join(':');
}
function receiptTransactionIdSet(documents=[]){
  return new Set((documents||[])
    .filter((doc)=>doc?.object_type==='transaction'&&doc?.object_id&&(/fotoerfassung|kassenbeleg|receipt/i.test(String(doc.notes||''))||String(doc.mime_type||'').startsWith('image/')))
    .map((doc)=>doc.object_id));
}
function duplicateSourceLabel(tx,receiptIds){
  const labels=[];
  const bank=tx?.source==='import'||tx?.external_reference||tx?.bank_reference||tx?.import_batch_id;
  if(bank) labels.push('Bankimport');
  if(receiptIds.has(tx?.id)) labels.push('Belegfoto');
  if(!labels.length) labels.push(tx?.source==='manual'?'Manuell erfasst':'Buchung');
  return labels.join(' + ');
}
function duplicateComparePanel(tx,{locale,receiptIds}){
  const title=tx?.merchants?.name||tx?.counterparty||tx?.description||'Buchung';
  const category=tx?.categories?.name||'Ohne Kategorie';
  const account=tx?.accounts?.name||'Konto';
  const note=String(tx?.note||'').trim();
  return `<div class="duplicate-compare-panel">
    <div class="duplicate-compare-source">${escapeHtml(duplicateSourceLabel(tx,receiptIds))}</div>
    <div class="duplicate-compare-title"><strong>${escapeHtml(title)}</strong><strong>${money(tx.amount,{currency:tx.currency,locale})}</strong></div>
    <div class="table-meta" style="margin-top:8px"><strong>Datum:</strong> ${escapeHtml(dateLabel(tx.occurred_at,locale))}</div>
    <div class="table-meta"><strong>Konto:</strong> ${escapeHtml(account)}</div>
    <div class="table-meta"><strong>Kategorie:</strong> ${escapeHtml(category)}</div>
    <div class="table-meta"><strong>Beschreibung:</strong> ${escapeHtml(tx?.description||'—')}</div>
    ${tx?.counterparty?`<div class="table-meta"><strong>Gegenpartei:</strong> ${escapeHtml(tx.counterparty)}</div>`:''}
    ${note?`<div class="table-meta"><strong>Notiz:</strong> ${escapeHtml(note)}</div>`:''}
    <div class="table-meta"><strong>Beleg:</strong> ${receiptIds.has(tx?.id)?'vorhanden':'kein Beleg verknüpft'}</div>
    <div class="duplicate-compare-edit"><button class="table-action" type="button" data-action="transaction-edit" data-id="${tx.id}">Buchung bearbeiten</button></div>
  </div>`;
}
function filterTransactions(transactions,{period,from,to,query,category,categoryIds=[],sourceSet=[],account,context='all',vehicle='all',direction='all',semantic='all',categories=[],recurringRules=[],financeMode='day_25'}){
  const {start,endExclusive}=period==='custom'||period==='all'?{start:null,endExclusive:null}:periodBounds(period,{mode:financeMode});
  const needle=String(query||'').trim().toLowerCase();
  return transactions.filter((tx)=>{
    if(tx.status!=='booked') return false;
    const d=new Date(tx.occurred_at);
    if(start&&d<start) return false;
    if(endExclusive&&d>=endExclusive) return false;
    const iso=dateInputValue(new Date(tx.occurred_at));
    if(from&&iso<from) return false;
    if(to&&iso>to) return false;
    if(direction==='income'&&Number(tx.amount)<=0) return false;
    if(direction==='expense'&&Number(tx.amount)>=0) return false;
    if(['debt_payment','receivable_principal'].includes(tx.cashflow_type) && category && category!=='all') return false;
    if(category==='uncategorized'&&tx.category_id) return false;
    if(categoryIds.length && !categoryIds.includes(tx.category_id) && !categoryIds.includes(tx.categories?.parent_id)) return false;
    if(category&&category!=='all'&&category!=='uncategorized'&&tx.category_id!==category&&tx.categories?.parent_id!==category) return false;
    if(account&&account!=='all'&&tx.account_id!==account) return false;
    if(context&&context!=='all'&&tx.context_id!==context) return false;
    if(vehicle&&vehicle!=='all'&&tx.vehicle_id!==vehicle) return false;
    if(semantic&&semantic!=='all'){
      const type=semanticType(tx,{categories,recurringRules});
      const matches=semantic==='earned'?['earned_income','other_income'].includes(type)
        : semantic==='refund'?['refund','tax_refund'].includes(type)
        : semantic==='repayment'?type==='receivable_repayment'
        : semantic==='unclassified'?type==='unclassified_inflow'
        : semantic==='variable'?type==='variable_expense'
        : semantic==='fixed'?type==='fixed_expense'
        : semantic==='saving'?['saving','internal_transfer'].includes(type)
        : semantic==='tax'?['tax_payment','tax_refund'].includes(type)
        : type===semantic;
      if(!matches) return false;
    }
    if(sourceSet.length){
      const source=String(tx.merchants?.name||tx.counterparty||tx.description||'').trim();
      if(!sourceSet.includes(source)) return false;
    }
    if(needle&&!normalizedSearch(tx).includes(needle)) return false;
    return true;
  });
}
function cashSuggestion(tx,accounts){
  if(Number(tx.amount)>=0||tx.transfer_group_id||['debt_payment','receivable_principal'].includes(tx.cashflow_type)||tx.semantic_type==='debt_repayment') return null;
  const text=`${tx.description||''} ${tx.counterparty||''}`.toLowerCase();
  const cash=accounts.find((a)=>a.account_id!==tx.account_id&&a.currency===tx.currency&&a.account_type==='cash');
  const savings=accounts.find((a)=>a.account_id!==tx.account_id&&a.currency===tx.currency&&a.account_type==='savings');
  if(/(bancomat|atm|bargeld|cash|barbezug|withdraw|geldautomat)/i.test(text)) return {kind:'cash',account:cash||null,label:cash?`Bargeldbezug nach ${cash.name}?`:'Bargeldbezug erkannt – Bargeld-Wallet anlegen?'};
  if(savings && /(spar|übertrag|uebertrag|transfer|umbuch|eigenes konto)/i.test(text)) return {kind:'transfer',account:savings,label:`War das Sparen auf ${savings.name}?`};
  return null;
}
function txRow(tx,{locale,canWrite,accounts,canTax,paymentMap,billMap}){
  const positive=Number(tx.amount)>=0;
  const transfer=Boolean(tx.transfer_group_id);
  const debtPayment=tx.cashflow_type==='debt_payment' ? paymentMap?.get(tx.id) : null;
  const debtRepayment=tx.semantic_type==='debt_repayment';
  const receivableManaged=tx.cashflow_type==='receivable_principal';
  const billPayment=billMap?.get(tx.id)||null;
  const managed=Boolean(debtPayment||receivableManaged||billPayment);
  const suggestion=managed?null:cashSuggestion(tx,accounts);
  const isTwint=!managed&&!debtRepayment&&/twint/i.test(`${tx.description||''} ${tx.counterparty||''}`);
  const future=new Date(tx.occurred_at)>new Date();
  const categoryLabel=debtPayment?'Schuldentilgung':debtRepayment?'Darlehensrückzahlung':receivableManaged?(positive?'Rückzahlung Forderung':'Forderung ausgezahlt'):billPayment?'Rechnungszahlung':tx.categories?.name||(transfer?'Umbuchung':'Ohne Kategorie');
  const split=debtPayment?` · Tilgung ${money(debtPayment.principal_amount,{currency:debtPayment.currency||tx.currency,locale})}${Number(debtPayment.interest_amount||0)>0?` · Zins ${money(debtPayment.interest_amount,{currency:debtPayment.currency||tx.currency,locale})}`:''}${Number(debtPayment.fee_amount||0)>0?` · Gebühren ${money(debtPayment.fee_amount,{currency:debtPayment.currency||tx.currency,locale})}`:''}`:'';
  const taxAction=canTax&&!receivableManaged?`<button class="table-action" type="button" data-action="transaction-tax-toggle" data-id="${tx.id}" data-value="${tx.tax_relevant?'false':'true'}">${tx.tax_relevant?'Steuer ✓':'Steuer'}</button>`:'';
  const managedAction=debtPayment?`<a class="table-action" href="#/debts">Schuld anzeigen</a>${taxAction}`:receivableManaged?`<a class="table-action" href="#/receivables">Forderung anzeigen</a>`:billPayment?`<a class="table-action" href="#/bills">Rechnung anzeigen</a>${taxAction}`:'';
  const recurringLabel=tx.recurring_rule_id?'Wiederkehrend ✓':'Wiederkehrend';
  const actions=canWrite?`<div class="row-actions">${managed?managedAction:transfer?'':`<button class="table-action" type="button" data-action="transaction-edit" data-id="${tx.id}">Bearbeiten</button><button class="table-action" type="button" data-action="transaction-merge-open" data-id="${tx.id}">Zusammenführen</button><button class="table-action" type="button" data-action="transaction-make-recurring" data-id="${tx.id}">${recurringLabel}</button>${taxAction}`}${managed?'':`<button class="table-action table-action--danger" type="button" data-action="transaction-delete" data-id="${tx.id}">${transfer?'Umbuchung löschen':'Löschen'}</button>`}</div>`:'';
  const entityMeta=[
    tx.merchants?.name||'',
    tx.counterparties?.name?`${tx.counterparties.name} (${({person:'Person',authority:'Behörde',employer:'Arbeitgeber',organization:'Organisation',other:'Gegenpartei'})[tx.counterparties.kind]||'Gegenpartei'})`:(tx.merchants?.name?'':tx.counterparty||''),
    tx.transaction_contexts?.name?`Kontext: ${tx.transaction_contexts.name}`:'',
    tx.vehicles?.name?`Fahrzeug: ${tx.vehicles.name}`:'',
  ].filter(Boolean).join(' · ');
  const suggestionAction=suggestion?.kind==='cash'
    ? `<button class="table-action" type="button" data-action="transaction-cash-withdrawal" data-id="${tx.id}">Als Bargeldbezug</button>`
    : suggestion?.account
      ? `<button class="table-action" type="button" data-action="transaction-to-transfer" data-id="${tx.id}" data-to-account="${suggestion.account.account_id}">Ja, als Umbuchung</button>`
      : '';
  return `<div class="list-row transaction-row"><div class="list-row-main"><span class="list-row-leading ${positive?'list-row-leading--green':''}">${icon(transfer?'repeat':(debtPayment||debtRepayment)?'credit-card':positive?'arrow-down-left':'arrow-up-right')}</span><div><div class="list-row-title">${escapeHtml(tx.description)}${future?' · Geplant':''}</div><div class="list-row-meta">${escapeHtml(categoryLabel)}${entityMeta?` · ${escapeHtml(entityMeta)}`:''} · ${escapeHtml(tx.accounts?.name||'')} · ${dateLabel(tx.occurred_at,locale)}${tx.note?` · ${escapeHtml(tx.note)}`:''}${split}</div>${suggestion&&canWrite&&suggestionAction?`<div class="transaction-suggestion"><span>${escapeHtml(suggestion.label)}</span>${suggestionAction}</div>`:''}${isTwint&&!tx.note&&canWrite?`<div class="transaction-suggestion"><span>TWINT-Zahlung: Wofür war sie?</span><button class="table-action" type="button" data-action="transaction-note" data-id="${tx.id}">Zweck ergänzen</button></div>`:''}</div></div><div class="list-row-trailing"><div class="amount ${positive?'amount--positive':'amount--negative'}">${money(tx.amount,{sign:positive,currency:tx.currency,locale})}</div>${actions}</div></div>`;
}

function usableBookingCategory(category) {
  return !(category?.kind==='expense'&&String(category?.name||'').trim().toLowerCase()==='sparen');
}

function categorizationTransferHints(tx,{transactions=[],accounts=[],locale='de-CH'}={}) {
  const amount=Math.abs(Number(tx?.amount)||0);
  const direction=Math.sign(Number(tx?.amount)||0);
  if(!tx||!amount||!direction||tx.transfer_group_id) return [];
  const txTime=new Date(tx.occurred_at).getTime();
  if(!Number.isFinite(txTime)) return [];
  return transactions
    .filter((row)=>{
      if(!row||row.id===tx.id||row.status!=='booked'||row.transfer_group_id) return false;
      if(row.account_id===tx.account_id||row.currency!==tx.currency) return false;
      if(Math.sign(Number(row.amount)||0)!==-direction) return false;
      if(Math.abs(Math.abs(Number(row.amount)||0)-amount)>=0.005) return false;
      const rowTime=new Date(row.occurred_at).getTime();
      return Number.isFinite(rowTime)&&Math.abs(rowTime-txTime)<=7*86400000;
    })
    .sort((a,b)=>Math.abs(new Date(a.occurred_at)-new Date(tx.occurred_at))-Math.abs(new Date(b.occurred_at)-new Date(tx.occurred_at)))
    .slice(0,4)
    .map((row)=>({
      row,
      account:accounts.find((account)=>account.account_id===row.account_id)||null,
      label:`${accounts.find((account)=>account.account_id===row.account_id)?.name||row.accounts?.name||'anderes Konto'} · ${dateLabel(row.occurred_at,locale)} · ${money(row.amount,{sign:true,currency:row.currency,locale})}`,
    }));
}

function renderCategorizationSelectionDetail(group,{categories=[],accounts=[],transactions=[],locale='de-CH',canWrite=false}={}) {
  if(!group) return '';
  const categoryOptions=rankCategoriesByUsage(categories,transactions,{kind:group.kind,excludeNames:['Sparen']})
    .filter(usableBookingCategory)
    .map((category)=>`<option value="${category.id}">${escapeHtml(category.name)}</option>`)
    .join('');
  const accountType=(type)=>({
    checking:'Zahlungskonto',savings:'Sparkonto',cash:'Bargeld',wallet:'Wallet',
    credit_card:'Kreditkarte',investment:'Investment',pension:'Vorsorge',other:'Konto',
  })[type]||'Konto';
  const accountOptions=accounts
    .filter((account)=>!account.is_archived)
    .map((account)=>`<option value="${account.account_id}">${escapeHtml(account.name)} · ${escapeHtml(account.currency)} · ${escapeHtml(accountType(account.account_type))}</option>`)
    .join('');
  const rows=(group.unassignedRows?.length ? group.unassignedRows : group.rows)
    .slice()
    .sort((a,b)=>String(b.occurred_at).localeCompare(String(a.occurred_at)))
    .map((tx)=>{
      const category=categories.find((row)=>row.id===tx.category_id)?.name||'Ohne Kategorie';
      const counterparty=tx.counterparties?.name||tx.counterparty||'';
      const merchant=tx.merchants?.name||'';
      const note=tx.note||'';
      const sourceAccount=accounts.find((account)=>account.account_id===tx.account_id)?.name||tx.accounts?.name||'Konto';
      const hints=categorizationTransferHints(tx,{transactions,accounts,locale});
      const transferHint=hints.length===1
        ? `<span class="categorization-transfer-hint"><b>Mögliche Umbuchung:</b> ${escapeHtml(hints[0].label)}</span>`
        : hints.length>1
          ? `<span class="categorization-transfer-hint categorization-transfer-hint--ambiguous"><b>Mehrere mögliche Gegenbuchungen:</b> ${escapeHtml(hints.map((hint)=>hint.account?.name||hint.row.accounts?.name||'Konto').filter((name,index,list)=>list.indexOf(name)===index).join(' · '))}</span>`
          : '';
      const normalizedDescription=String(tx.description||'').trim().toLowerCase();
      const normalizedMerchant=String(merchant||'').trim().toLowerCase();
      const normalizedCounterparty=String(counterparty||'').trim().toLowerCase();
      const redundantMerchant=merchant && (
        normalizedDescription===normalizedMerchant
        || normalizedDescription.startsWith(`${normalizedMerchant} `)
        || normalizedCounterparty===normalizedMerchant
      );
      const context=[
        `<span><b>Von Konto:</b> ${escapeHtml(sourceAccount)}</span>`,
        tx.description?`<span><b>Banktext:</b> ${escapeHtml(tx.description)}</span>`:'',
        note?`<span><b>Notiz / Zweck:</b> ${escapeHtml(note)}</span>`:'',
        counterparty && normalizedCounterparty!==normalizedDescription?`<span><b>Gegenpartei:</b> ${escapeHtml(counterparty)}</span>`:'',
        merchant && !redundantMerchant?`<span><b>Händler:</b> ${escapeHtml(merchant)}</span>`:'',
      ].filter(Boolean).join('');
      return `<label class="categorization-select-row"><input class="categorization-select-check" type="checkbox" data-categorization-select value="${tx.id}" ${canWrite?'':'disabled'}><span class="categorization-select-copy"><span class="categorization-select-heading"><span class="categorization-select-title"><strong>${dateLabel(tx.occurred_at,locale)}</strong><small>${escapeHtml(category)}</small></span><span class="categorization-select-amount">${money(tx.amount,{sign:Number(tx.amount)>=0,currency:tx.currency,locale})}</span></span><span class="categorization-select-context">${context}</span>${transferHint}</span></label>`;
    }).join('');
  return `<section class="categorization-selection" data-categorization-detail="${escapeHtml(group.key)}">
    <div class="categorization-selection-head">
      <div><strong>Teilmenge bearbeiten</strong><span>Markiere nur die Buchungen, die zusammengehören. Bereits gespeicherte Buchungen verschwinden aus dieser Arbeitsliste.</span></div>
      <button class="table-action" type="button" data-action="categorization-close-group">Schliessen</button>
    </div>
    <div class="categorization-selection-tools">
      <button class="table-action" type="button" data-action="categorization-select-all">Alle markieren</button>
      <button class="table-action" type="button" data-action="categorization-select-none">Auswahl löschen</button>
      <span data-categorization-selected-count>0 ausgewählt</span>
    </div>
    <div class="categorization-select-list">${rows}</div>
    ${canWrite?`<div class="categorization-bulk-actions">
      <div class="categorization-bulk-box"><label class="field"><span>Echte Einnahme / Ausgabe kategorisieren</span><select class="text-control" data-categorization-selected-category><option value="">Kategorie wählen</option>${categoryOptions}</select></label><button class="action-button action-button--primary" type="button" data-action="categorization-apply-selected-category">Auswahl speichern</button><small>Speichert nur die markierten Buchungen. Es wird keine feste Regel für ${escapeHtml(group.name)} angelegt. Machine Learning verwendet die Entscheidung als Trainingsbeispiel.</small></div>
      <div class="categorization-bulk-box"><label class="field"><span>Auswahl als interne Umbuchung / Sparen</span><select class="text-control" data-categorization-transfer-account><option value="">Gegenkonto wählen</option>${accountOptions}</select></label><div data-categorization-transfer-fx hidden><label class="field"><span data-categorization-transfer-fx-label>Zielbetrag</span><input class="text-control" type="number" min="0.01" step="0.01" inputmode="decimal" placeholder="0.00" data-categorization-transfer-amount disabled></label><small data-categorization-transfer-rate></small></div><button class="action-button action-button--secondary" type="button" data-action="categorization-apply-selected-transfer">Auswahl als Umbuchung verbuchen</button><small>Für Sparen wählst du dein Sparkonto als Gegenkonto. Das zählt dann nicht als Konsumausgabe. Mehrere Buchungen können nur bei gleicher Währung gesammelt umgebucht werden. Bei genau einer Fremdwährungsbuchung gibst du den tatsächlich erhaltenen Zielbetrag ein.</small></div>
      <div class="categorization-bulk-box"><label class="field"><span>Auswahl als Darlehensrückzahlung / Schuldentilgung</span></label><button class="action-button action-button--secondary" type="button" data-action="categorization-apply-selected-debt-repayment">Auswahl als Tilgung verbuchen</button><small>Der Geldabfluss bleibt auf dem Konto und im Cashflow vollständig erhalten, zählt aber nicht als Konsumausgabe. Für historische Rückzahlungen, bei denen keine offene Schuld in Finance geführt wird.</small></div>
    </div>`:''}
  </section>`;
}


function renderCategorizationReview({
  transactions, categories, merchants, merchantAliases, categorizationRules, accounts, household, profile, fxRates,
  canWrite, categorizationFilter='action', categorizationPage=1, categorizationGroupKey='',
}) {
  const groups = buildCategorizationGroups({ transactions, categories, merchants, aliases:merchantAliases, rules:categorizationRules });
  const uncategorizedCount = transactions.filter((tx)=>tx.status==='booked'&&!tx.transfer_group_id&&!['debt_payment','receivable_principal'].includes(tx.cashflow_type)&&tx.semantic_type!=='debt_repayment'&&!tx.category_id).length;
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
  const activeGroup=groups.find((group)=>group.key===categorizationGroupKey)||null;
  const activeOnPage=activeGroup && pageRows.some((group)=>group.key===activeGroup.key);
  const currency = household?.base_currency || 'CHF'; const locale = profile?.locale || 'de-CH';
  const rows = pageRows.map((group)=>{
    const total = group.rows.reduce((sum,row)=>sum+Math.abs(convertAmount(row.amount,row.currency,currency,fxRates)??0),0);
    const current = group.mixed ? 'Gemischt' : group.currentCategory?.name || (group.unassignedCount===group.rows.length ? 'Ohne Kategorie' : 'Teilweise kategorisiert');
    const suggestion = group.suggestion ? categorizationSourceLabel(group.suggestion.source,group.suggestion.confidence) : 'Kein sicherer Vorschlag';
    const options = rankCategoriesByUsage(categories,transactions,{kind:group.kind,excludeNames:['Sparen']}).filter(usableBookingCategory).map((category)=>`<option value="${category.id}" ${category.id===group.selectedCategoryId?'selected':''}>${escapeHtml(category.name)}</option>`).join('');
    const pill = group.suggestion?.safe ? statusPill('active','Sicherer Vorschlag') : group.suggestion ? statusPill('pending','Prüfen') : group.mixed ? statusPill('pending','Gemischt') : statusPill('open','Offen');
    const detail=group.key===categorizationGroupKey?renderCategorizationSelectionDetail(group,{categories,accounts,transactions,locale,canWrite}):'';
    return `<div class="categorization-group-block"><div class="categorization-group-row" data-categorization-group="${escapeHtml(group.key)}"><div class="categorization-group-copy"><div class="categorization-group-title"><strong>${escapeHtml(group.name)}</strong>${pill}</div><span>${group.rows.length} Buchung${group.rows.length===1?'':'en'} · ${money(total,{currency,locale})} · aktuell: ${escapeHtml(current)}</span><small>${escapeHtml(suggestion)}${group.unassignedCount?` · ${group.unassignedCount} noch ohne Kategorie`:''}</small></div><select class="text-control" data-categorization-category><option value="">Kategorie · nur echte Ein-/Ausgabe</option>${options}</select><div class="categorization-group-actions">${canWrite?`<button class="table-action" type="button" data-action="categorization-apply-group" data-group-key="${escapeHtml(group.key)}">Kategorie für alle setzen</button>`:''}<button class="table-action" type="button" data-action="categorization-view-group" data-group-key="${escapeHtml(group.key)}">${group.key===categorizationGroupKey?'Buchungsarten offen':'Umbuchung / Tilgung / Teilmenge'}</button></div></div>${detail}</div>`;
  }).join('');
  const detachedDetail=activeGroup&&!activeOnPage&&(activeGroup.needsAttention||categorizationFilter==='all')?renderCategorizationSelectionDetail(activeGroup,{categories,accounts,transactions,locale,canWrite}):'';
  return `<article class="card card-padding categorization-review"><div class="card-heading"><div><h3 class="card-title">Kategorien analysieren</h3><p class="card-subtitle">Bestehende Buchungen werden nach Händler gruppiert. Du kannst entweder eine ganze Gruppe gleich behandeln oder innerhalb der Gruppe Teilmengen markieren.</p></div><div class="card-footer-actions">${canWrite?`<button class="action-button action-button--primary" type="button" data-action="categorization-apply-safe" ${safeGroups.length?'':'disabled'}>Sichere Vorschläge übernehmen</button>`:''}<button class="action-button action-button--secondary" type="button" data-action="categorization-close">Schliessen</button></div></div><div class="categorization-stats"><div><span>Ohne Kategorie</span><strong>${uncategorizedCount}</strong></div><div><span>Sichere Gruppen</span><strong>${safeGroups.length}</strong></div><div><span>Noch offen</span><strong>${unresolvedGroups.length}</strong></div><div><span>Mehrere Kategorien · erledigt</span><strong>${mixedGroups.filter((group)=>!group.unassignedCount).length}</strong></div></div><div class="categorization-toolbar"><label class="field"><span>Anzeige</span><select class="text-control" id="categorizationFilter"><option value="action" ${categorizationFilter==='action'?'selected':''}>Nur noch zu bearbeiten</option><option value="unresolved" ${categorizationFilter==='unresolved'?'selected':''}>Nur ohne Vorschlag</option><option value="all" ${categorizationFilter==='all'?'selected':''}>Alle Händlergruppen</option></select></label><div class="toolbar-note">Eine Kategorie wählst du nur für echte Einnahmen oder Ausgaben. Für Umbuchung, Sparen, Darlehensrückzahlung / Schuldentilgung oder gemischte Teilmengen öffnest du „Umbuchung / Tilgung / Teilmenge“.</div></div><div class="categorization-group-list">${rows || '<div class="table-empty">Für diese Ansicht gibt es nichts zu prüfen.</div>'}</div>${detachedDetail}${visible.length>pageSize?`<div class="admin-pager categorization-pager"><button class="table-action" type="button" data-action="categorization-page" data-page="${page-1}" ${page<=1?'disabled':''}>Zurück</button><span>Seite ${page} / ${totalPages} · ${visible.length} Gruppen</span><button class="table-action" type="button" data-action="categorization-page" data-page="${page+1}" ${page>=totalPages?'disabled':''}>Weiter</button></div>`:''}</article>`;
}

export function renderTransactions({ accounts = [], categories = [], transactions = [], debtPayments = [], bills = [], household, profile, canWrite = false, fxRates, transactionView='summary', transactionPeriod='month', transactionQuery='', transactionCategory='all', transactionCategoryIds=[], transactionSourceSet=[], transactionAccount='all', transactionContext='all', transactionVehicle='all', transactionDirection='all', transactionSemantic='all', transactionFrom='', transactionTo='', transactionPage=1, moduleAccess = {}, hiddenModules = [], merchants = [], merchantAliases = [], counterparties = [], transactionContexts = [], vehicles = [], categorizationRules = [], recurringRules = [], documents = [], transactionDuplicateIgnores = [], categorizationOpen = false, categorizationFilter = 'action', categorizationPage = 1, categorizationGroupKey = '' } = {}) {
  const baseCurrency = household?.base_currency || 'CHF'; const canTax = moduleAccess?.tax === true && !hiddenModules.includes('tax'); const locale = profile?.locale || 'de-CH';
  const selectedFinanceMonthMode=financeMonthMode(profile);
  const currentFinanceCycle=resolveFinanceCycle({now:new Date(),fallbackDay:25,mode:selectedFinanceMonthMode});
  const previousCycle=previousFinanceCycle(currentFinanceCycle,{fallbackDay:25});
  const rows=filterTransactions(transactions,{period:transactionPeriod,from:transactionFrom,to:transactionTo,query:transactionQuery,category:transactionCategory,categoryIds:transactionCategoryIds,sourceSet:transactionSourceSet,account:transactionAccount,context:transactionContext,vehicle:transactionVehicle,direction:transactionDirection,semantic:transactionSemantic,categories,recurringRules,financeMode:selectedFinanceMonthMode});
  const now=new Date();
  const actualRows=rows.filter((tx)=>{ const date=new Date(tx.occurred_at); return !Number.isNaN(date.getTime())&&date<=now; });
  const paymentMap=buildDebtPaymentTransactionMap(debtPayments);
  const billMap=new Map(bills.filter((bill)=>bill.status==='paid'&&bill.paid_transaction_id).map((bill)=>[bill.paid_transaction_id,bill]));
  const ignoredDuplicateKeys=new Set((transactionDuplicateIgnores||[]).map((row)=>duplicatePairKey(row.transaction_a_id,row.transaction_b_id)));
  const duplicatePairs=likelyTransactionDuplicates(transactions,{documents,limit:12})
    .filter(({left,right})=>!ignoredDuplicateKeys.has(duplicatePairKey(left.id,right.id)))
    .slice(0,6);
  const receiptIds=receiptTransactionIdSet(documents);
  const spendRows=actualRows.filter((tx)=>semanticExpenseBase(tx,{categories,recurringRules,debtPayments:paymentMap,baseCurrency,fxRates})>0);
  const income=actualRows.reduce((s,tx)=>s+semanticIncomeBase(tx,{categories,recurringRules,baseCurrency,fxRates}),0);
  const receivableInflow=actualRows.filter((tx)=>Number(tx.amount)>0&&!tx.transfer_group_id&&tx.cashflow_type==='receivable_principal').reduce((s,tx)=>s+(convertAmount(tx.amount,tx.currency,baseCurrency,fxRates)??0),0);
  const expenses=actualRows.reduce((s,tx)=>s+semanticExpenseBase(tx,{categories,recurringRules,debtPayments:paymentMap,baseCurrency,fxRates}),0);
  const cashOutflow=actualRows.reduce((s,tx)=>s+cashOutflowBase(tx,baseCurrency,fxRates),0);
  const debtPrincipal=actualRows.reduce((s,tx)=>s+semanticDebtPrincipalBase(tx,{categories,recurringRules,debtPayments:paymentMap,baseCurrency,fxRates}),0);
  const savingsIds=new Set(accounts.filter((a)=>a.account_type==='savings').map((a)=>a.account_id));
  const savings=actualRows.filter((tx)=>tx.transfer_group_id&&Number(tx.amount)>0&&savingsIds.has(tx.account_id)).reduce((s,tx)=>s+(convertAmount(tx.amount,tx.currency,baseCurrency,fxRates)??0),0);
  const categoryOptions = rankCategoriesByUsage(categories,transactions,{excludeNames:['Sparen']}).filter(usableBookingCategory).map((c)=>`<option value="${c.id}">${escapeHtml(c.name)} · ${c.kind==='income'?'Einnahme':'Ausgabe'}</option>`).join('');
  const preferredPrimaryAccountId=primaryAccountPreferenceId(profile,household?.id,accounts);
  const defaultAccount=primaryOperatingAccount(accounts,recurringRules,baseCurrency,preferredPrimaryAccountId);
  const defaultAccountId=defaultAccount?.account_id||'';
  const accountOptions = accounts.map((a)=>`<option value="${a.account_id}" data-currency="${escapeHtml(a.currency)}" ${a.account_id===defaultAccountId?'selected':''}>${escapeHtml(a.name)} · ${escapeHtml(a.currency)}</option>`).join('');
  const accountOptionsPlain = accounts.map((a)=>`<option value="${a.account_id}" data-currency="${escapeHtml(a.currency)}">${escapeHtml(a.name)} · ${escapeHtml(a.currency)}</option>`).join('');
  const merchantOptions = merchants.map((m)=>`<option value="${m.id}">${escapeHtml(m.name)}</option>`).join('');
  const counterpartyOptions = counterparties.map((row)=>`<option value="${row.id}" data-kind="${escapeHtml(row.kind)}">${escapeHtml(row.name)} · ${escapeHtml(({person:'Person',authority:'Behörde',employer:'Arbeitgeber',organization:'Organisation',payment_processor:'Zahlungsanbieter',other:'Sonstiges'})[row.kind]||row.kind)}</option>`).join('');
  const contextOptions = transactionContexts.filter((row)=>!row.is_archived).map((row)=>`<option value="${row.id}">${escapeHtml(row.name)}</option>`).join('');
  const vehicleOptions = vehicles.map((row)=>`<option value="${row.id}">${escapeHtml(row.name)}</option>`).join('');
  const receiptCategoryOptions = rankCategoriesByUsage(categories,transactions,{kind:'expense',excludeNames:['Sparen']}).filter(usableBookingCategory).map((c)=>`<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
  const mergeFields=`<input type="hidden" name="transactionId" id="transactionMergeId"><div class="inline-alert form-grid-span" id="transactionMergeSource"></div><label class="field form-grid-span"><span>Doppelte Buchung</span><select class="text-control" name="duplicateTransactionId" id="transactionMergeCandidate" required><option value="">Bitte wählen</option></select><small>Finance prüft Betrag, Währung und Datum. Bei unterschiedlichen Konten ist die Zusammenführung nur erlaubt, wenn eindeutig ein Beleg einer Bankbuchung gegenübersteht.</small></label>`;

  const txFields = `<label class="field"><span>Typ</span><select class="text-control" name="direction"><option value="expense">Ausgabe</option><option value="income">Einnahme</option></select></label><label class="field"><span>Betrag</span><input class="text-control" name="amount" type="number" step="0.01" min="0.01" required></label><label class="field"><span>Konto</span><select class="text-control" name="accountId" required>${accountOptions}</select></label><label class="field"><span>Datum / Zeit</span><input class="text-control" name="occurredAt" type="datetime-local" required value="${dateTimeLocalValue()}"></label><label class="field form-grid-span"><span>Beschreibung</span><input class="text-control" name="description" required placeholder="z. B. Migros"></label><label class="field"><span>Kategorie</span><select class="text-control" name="categoryId" id="transactionCreateCategory"><option value="">Ohne Kategorie</option>${categoryOptions}</select><small id="transactionCreateCategoryHint">Häufig verwendete Kategorien stehen oben. Finance versucht Händler und Beschreibung direkt zu erkennen.</small></label><label class="field"><span>Händler</span><select class="text-control" name="merchantId"><option value="">Ohne Händler</option>${merchantOptions}</select><small>Nur echte Geschäfte/Anbieter. Personen gehören zur Gegenpartei.</small></label><div class="budget-decision-hint form-grid-span" id="transactionCreateBudgetCoach" hidden></div><label class="field"><span>Gegenpartei</span><input class="text-control" name="counterparty" list="counterpartyDatalist" placeholder="z. B. Mamma, Mirco, Stadt St. Gallen"></label><label class="field"><span>Gegenpartei-Typ</span><select class="text-control" name="counterpartyKind"><option value="">Nur Text / nicht speichern</option><option value="person">Person</option><option value="authority">Behörde</option><option value="employer">Arbeitgeber</option><option value="organization">Organisation</option><option value="other">Sonstiges</option></select></label><details class="receipt-ocr-details form-grid-span" id="transactionCreateOptionalDetails"><summary>Zusätzliche Zuordnung · Kontext oder Fahrzeug</summary><div class="form-grid form-grid--2" style="margin-top:12px"><label class="field"><span>Kontext / Projekt</span><select class="text-control" name="contextId"><option value="">Kein Kontext</option>${contextOptions}</select></label><label class="field"><span>Neuer Kontext</span><input class="text-control" name="contextName" placeholder="z. B. Ferien Italien 2026"></label><label class="field"><span>Fahrzeug zuordnen</span><select class="text-control" name="vehicleId"><option value="">Kein Fahrzeug</option>${vehicleOptions}</select></label><label class="field"><span>Neues Fahrzeug anlegen</span><input class="text-control" name="vehicleName" id="transactionCreateVehicleName" placeholder="z. B. Roller Italien"></label><label class="field" id="transactionCreateVehicleTypeField" hidden><span>Fahrzeugart</span><select class="text-control" name="vehicleType"><option value="motorcycle">Roller / Motorrad</option><option value="car">Auto</option><option value="bike">Fahrrad</option><option value="other">Sonstiges</option></select></label></div></details><label class="field form-grid-span"><span>Notiz / Zweck</span><textarea class="text-control" name="note" rows="3" placeholder="z. B. TWINT: Mittagessen"></textarea></label><label class="field form-grid-span"><span>Was ist diese Buchung?</span><select class="text-control" name="semanticType" id="transactionCreateSemantic"><option value="">Finance automatisch erkennen lassen</option><option value="earned_income">Verdienst / Lohn</option><option value="other_income">Sonstige echte Einnahme</option><option value="refund">Rückerstattung / Gutschrift</option><option value="receivable_repayment">Rückzahlung einer Forderung</option><option value="debt_repayment">Darlehensrückzahlung / Schuldentilgung</option><option value="internal_transfer">Eigene Umbuchung</option><option value="fixed_expense">Fixkosten</option><option value="variable_expense">Variable Ausgabe</option><option value="tax_payment">Steuerzahlung</option><option value="saving">Sparen / Rücklage</option><option value="asset_acquisition">Vermögenskauf / Fahrzeugkauf</option><option value="ignored">Nicht auswerten</option></select><small>Bei Eingängen trennt Finance damit Verdienst, Rückerstattungen, Rückzahlungen und eigene Umbuchungen.</small></label><label class="field form-grid-span checkbox-field"><input type="checkbox" name="excludeFromReports"><span>In Dashboards und Berichten ausblenden</span></label>${canTax?`<label class="field"><span>Steuerrelevant</span><select class="text-control" name="taxRelevant"><option value="false">Nein</option><option value="true">Ja</option></select></label><label class="field"><span>Steuerjahr</span><select class="text-control" name="taxYear">${taxYearOptions(new Date().getFullYear())}</select></label><label class="field"><span>Steuerart</span><select class="text-control" name="taxTreatment">${taxTreatmentOptions('')}</select></label><label class="field"><span>Steuerbereich</span><select class="text-control" name="taxSectionKey">${taxSectionOptions('')}</select></label><label class="field form-grid-span"><span>Steuerkategorie / Detail</span><input class="text-control" name="taxCategory" placeholder="z. B. Weiterbildung, Krankheitskosten, Staatssteuer"></label>`:''}`;
  const editFields = `<input type="hidden" name="transactionId" id="transactionEditId"><label class="field"><span>Typ</span><select class="text-control" name="direction" id="transactionEditDirection"><option value="expense">Ausgabe</option><option value="income">Einnahme</option><option value="transfer">Umbuchung zwischen eigenen Konten</option><option value="cash_withdrawal">Bargeldbezug</option></select></label><label class="field"><span>Betrag</span><input class="text-control" name="amount" id="transactionEditAmount" type="number" step="0.01" min="0.01" required></label><label class="field" id="transactionEditAccountField"><span>Konto</span><select class="text-control" name="accountId" id="transactionEditAccount" required>${accountOptionsPlain}</select><small id="transactionEditAccountHint"></small></label><label class="field"><span>Datum / Zeit</span><input class="text-control" name="occurredAt" id="transactionEditDate" type="datetime-local" required></label><div class="form-grid form-grid--2 form-grid-span" id="transactionEditTransferFields" hidden><label class="field"><span>Gegenkonto</span><select class="text-control" name="otherAccountId" id="transactionEditOtherAccount"><option value="">Bitte wählen</option><option value="__auto_cash__">Bargeld-Wallet automatisch anlegen</option>${accountOptionsPlain}</select><small id="transactionEditTransferHint">Finance erkennt anhand des Vorzeichens, welches Konto Quelle und welches Ziel ist.</small></label><label class="field" id="transactionEditOtherAmountField" hidden><span>Betrag auf Gegenkonto</span><input class="text-control" name="otherAmount" id="transactionEditOtherAmount" type="number" step="0.01" min="0.01" placeholder="Betrag in Zielwährung"></label><label class="field form-grid-span"><span>Passender Gegenposten</span><select class="text-control" name="otherTransactionId" id="transactionEditOtherTransaction"><option value="">Finance erstellt nur die fehlende Gegenbuchung</option></select><small id="transactionEditOtherTransactionHint">Wenn der Eingang bzw. Abgang auf dem Gegenkonto bereits importiert wurde, wird er hier verknüpft statt doppelt angelegt.</small></label></div><label class="field form-grid-span"><span>Beschreibung</span><input class="text-control" name="description" id="transactionEditDescription" required></label><label class="field"><span>Kategorie</span><select class="text-control" name="categoryId" id="transactionEditCategory"><option value="">Ohne Kategorie</option>${categoryOptions}</select><small id="transactionEditCategoryHint">Häufig verwendete Kategorien stehen oben. Händler und Beschreibung können einen Vorschlag liefern.</small></label><label class="field"><span>Händler</span><select class="text-control" name="merchantId" id="transactionEditMerchant"><option value="">Ohne Händler</option>${merchantOptions}</select><small>Personen bitte nicht als Händler anlegen.</small></label><label class="field"><span>Gegenpartei</span><input class="text-control" name="counterparty" id="transactionEditCounterparty" list="counterpartyDatalist"></label><label class="field"><span>Gegenpartei-Typ</span><select class="text-control" name="counterpartyKind" id="transactionEditCounterpartyKind"><option value="">Nur Text / nicht speichern</option><option value="person">Person</option><option value="authority">Behörde</option><option value="employer">Arbeitgeber</option><option value="organization">Organisation</option><option value="other">Sonstiges</option></select></label><details class="receipt-ocr-details form-grid-span" id="transactionEditOptionalDetails"><summary>Zusätzliche Zuordnung · Kontext oder Fahrzeug</summary><div class="form-grid form-grid--2" style="margin-top:12px"><label class="field"><span>Kontext / Projekt</span><select class="text-control" name="contextId" id="transactionEditContext"><option value="">Kein Kontext</option>${contextOptions}</select></label><label class="field"><span>Neuer Kontext</span><input class="text-control" name="contextName" id="transactionEditContextName" placeholder="z. B. Ferien Italien 2026"></label><label class="field"><span>Fahrzeug zuordnen</span><select class="text-control" name="vehicleId" id="transactionEditVehicle"><option value="">Kein Fahrzeug</option>${vehicleOptions}</select></label><label class="field"><span>Neues Fahrzeug anlegen</span><input class="text-control" name="vehicleName" id="transactionEditVehicleName" placeholder="z. B. Roller Italien"></label><label class="field" id="transactionEditVehicleTypeField" hidden><span>Fahrzeugart</span><select class="text-control" name="vehicleType" id="transactionEditVehicleType"><option value="motorcycle">Roller / Motorrad</option><option value="car">Auto</option><option value="bike">Fahrrad</option><option value="other">Sonstiges</option></select></label></div></details><label class="field form-grid-span"><span>Notiz / Zweck</span><textarea class="text-control" name="note" id="transactionEditNote" rows="3"></textarea></label><details class="receipt-ocr-details form-grid-span" id="transactionEditImportContext" hidden><summary>Originale Bankdaten anzeigen</summary><div class="transaction-import-context" id="transactionEditImportContextBody"></div></details>${canTax?`<label class="field"><span>Steuerrelevant</span><select class="text-control" name="taxRelevant" id="transactionEditTaxRelevant"><option value="false">Nein</option><option value="true">Ja</option></select></label><label class="field"><span>Steuerjahr</span><select class="text-control" name="taxYear" id="transactionEditTaxYear">${taxYearOptions(new Date().getFullYear())}</select></label><label class="field"><span>Steuerart</span><select class="text-control" name="taxTreatment" id="transactionEditTaxTreatment">${taxTreatmentOptions('')}</select></label><label class="field"><span>Steuerbereich</span><select class="text-control" name="taxSectionKey" id="transactionEditTaxSectionKey">${taxSectionOptions('')}</select></label><label class="field form-grid-span"><span>Steuerkategorie / Detail</span><input class="text-control" name="taxCategory" id="transactionEditTaxCategory" placeholder="z. B. Weiterbildung, Krankheitskosten, Staatssteuer"></label>`:''}<label class="field"><span>Bedeutung für Auswertungen</span><select class="text-control" name="semanticType" id="transactionEditSemantic"><option value="">Automatisch erkennen</option><option value="earned_income">Verdienst / Lohn</option><option value="other_income">Sonstige echte Einnahme</option><option value="refund">Rückerstattung / Gutschrift</option><option value="receivable_repayment">Rückzahlung einer Forderung</option><option value="debt_repayment">Darlehensrückzahlung / Schuldentilgung</option><option value="internal_transfer">Eigene Umbuchung</option><option value="fixed_expense">Fixkosten</option><option value="variable_expense">Variable Ausgabe</option><option value="tax_payment">Steuerzahlung</option><option value="saving">Sparen / Rücklage</option><option value="asset_acquisition">Vermögenskauf / Fahrzeugkauf</option><option value="ignored">Nicht auswerten</option></select></label><label class="field checkbox-field"><input type="checkbox" name="excludeFromReports" id="transactionEditExclude"><span>In Dashboards und Berichten ausblenden</span></label><label class="field form-grid-span checkbox-field"><input type="checkbox" name="makeRecurring" id="transactionMakeRecurring"><span>Mit wiederkehrender Zahlung verknüpfen</span><small id="transactionRecurringMatchHint">Finance prüft zuerst, ob diese Zahlung bereits unter Wiederkehrend existiert.</small></label><div class="form-grid form-grid--2 form-grid-span" id="transactionRecurringFields" hidden><label class="field"><span>Rhythmus</span><select class="text-control" name="recurringCadence" id="transactionRecurringCadence"><option value="monthly">Monatlich / alle X Monate</option><option value="weekly">Wöchentlich</option><option value="quarterly">Quartalsweise</option><option value="semiannual">Halbjährlich</option><option value="annual">Jährlich</option></select></label><label class="field" id="transactionRecurringIntervalField"><span>Monatsintervall</span><input class="text-control" name="recurringIntervalMonths" id="transactionRecurringIntervalMonths" type="number" min="1" max="120" step="1" value="1"><small>2 = alle 2 Monate.</small></label><label class="field"><span>Betragsart</span><select class="text-control" name="recurringAmountMode" id="transactionRecurringAmountMode"><option value="fixed">Fixer Betrag</option><option value="variable">Variabel · Richtwert</option></select></label><label class="field"><span>Nächster Termin</span><input class="text-control" name="recurringNextDate" id="transactionRecurringNextDate" type="date"></label></div>`;
  const transferFields = `<label class="field"><span>Von Konto</span><select class="text-control" name="fromAccountId" required>${accountOptions}</select></label><label class="field"><span>Auf Konto</span><select class="text-control" name="toAccountId" required>${accountOptionsPlain}</select></label><label class="field"><span>Abgang vom Quellkonto</span><input class="text-control" name="amount" type="number" step="0.01" min="0.01" required></label><label class="field"><span>Eingang auf Zielkonto</span><input class="text-control" name="toAmount" type="number" step="0.01" min="0.01" placeholder="nur bei anderer Währung"></label><label class="field"><span>Datum / Zeit</span><input class="text-control" name="occurredAt" type="datetime-local" required value="${dateTimeLocalValue()}"></label><label class="field"><span>Beschreibung</span><input class="text-control" name="description" value="Umbuchung" required></label>`;

  const groups=new Map();
  for(const tx of spendRows){ const isDebtCost=tx.cashflow_type==='debt_payment'; const key=isDebtCost?'debt-costs':tx.category_id||'uncategorized'; const g=groups.get(key)||{id:key,name:isDebtCost?'Zinsen & Gebühren':tx.categories?.name||'Ohne Kategorie',total:0,count:0,merchants:new Map(),synthetic:isDebtCost}; const value=semanticExpenseBase(tx,{categories,recurringRules,debtPayments:paymentMap,baseCurrency,fxRates}); g.total+=value; g.count++; const merchant=tx.merchants?.name||tx.counterparty||tx.description; g.merchants.set(merchant,(g.merchants.get(merchant)||0)+value); groups.set(key,g); }
  const summary=[...groups.values()].sort((a,b)=>b.total-a.total).map((g)=>{ const top=[...g.merchants.entries()].sort((a,b)=>b[1]-a[1]).slice(0,2).map(([n])=>n).join(' · '); const action=g.synthetic?'<a class="table-action" href="#/debts">Schulden ansehen</a>':`<button class="table-action" type="button" data-action="transaction-filter-category" data-category="${escapeHtml(g.id)}">Buchungen ansehen</button>`; return `<article class="card transaction-summary-card"><div class="metric-label">${escapeHtml(g.name)}</div><div class="transaction-summary-value">${money(g.total,{currency:baseCurrency,locale})}</div><div class="metric-note">${g.count} Buchung${g.count===1?'':'en'}${top?` · ${escapeHtml(top)}`:''}</div><div class="card-footer-actions">${action}</div></article>`; }).join('');
  const monthly=new Map(); for(const tx of spendRows){ const key=monthKey(tx.occurred_at); if(!key) continue; const value=semanticExpenseBase(tx,{categories,recurringRules,debtPayments:paymentMap,baseCurrency,fxRates}); const m=monthly.get(key)||{total:0,count:0}; m.total+=value; m.count++; monthly.set(key,m); }
  const monthlyRows=[...monthly.entries()].sort((a,b)=>b[0].localeCompare(a[0]));
  const monthlyAverage=monthlyRows.length ? monthlyRows.reduce((sum,[,month])=>sum+month.total,0)/monthlyRows.length : 0;
  const monthlyAverageNote=monthlyRows.length ? `über ${monthlyRows.length} angezeigte${monthlyRows.length===1?'n':''} Monat${monthlyRows.length===1?'':'e'} des aktuellen Filters` : 'für den aktuellen Filter';
  const monthlyHistory=monthlyRows.length>1?`<article class="card card-padding transaction-history-card"><div class="card-heading"><div><h3 class="card-title">Monatsverlauf</h3><p class="card-subtitle">Rückwirkende Ausgaben für den aktuellen Filter.</p></div></div><div class="transaction-month-grid">${monthlyRows.map(([key,m])=>`<div class="transaction-month-item"><span>${escapeHtml(monthLabel(key,locale))}</span><strong>${money(m.total,{currency:baseCurrency,locale})}</strong><small>${m.count} Buchung${m.count===1?'':'en'}</small></div>`).join('')}</div></article>`:'';
  const pageSize=50; const totalPages=Math.max(1,Math.ceil(rows.length/pageSize)); const page=Math.min(Math.max(1,Number(transactionPage)||1),totalPages); const offset=(page-1)*pageSize; const pageRows=rows.slice(offset,offset+pageSize); const rangeText=rows.length?`${offset+1}–${Math.min(offset+pageSize,rows.length)} von ${rows.length}`:'0 Treffer';
  const earliest=transactions.length?transactions.reduce((min,tx)=>String(tx.occurred_at)<String(min.occurred_at)?tx:min,transactions[0]):null; const latest=transactions[0]||null;
  const categoryFilterOptions=categories.map((c)=>`<option value="${c.id}" ${transactionCategory===c.id?'selected':''}>${escapeHtml(c.name)}</option>`).join('');
  const accountFilterOptions=accounts.map((a)=>`<option value="${a.account_id}" ${transactionAccount===a.account_id?'selected':''}>${escapeHtml(a.name)}</option>`).join('');
  const contextFilterOptions=transactionContexts.filter((row)=>!row.is_archived).map((row)=>`<option value="${row.id}" ${transactionContext===row.id?'selected':''}>${escapeHtml(row.name)}</option>`).join('');
  const vehicleFilterOptions=vehicles.map((row)=>`<option value="${row.id}" ${transactionVehicle===row.id?'selected':''}>${escapeHtml(row.name)}</option>`).join('');
  const hasFilters=Boolean(transactionQuery||transactionFrom||transactionTo||transactionCategoryIds.length||transactionSourceSet.length||(transactionCategory&&transactionCategory!=='all')||(transactionAccount&&transactionAccount!=='all')||(transactionContext&&transactionContext!=='all')||(transactionVehicle&&transactionVehicle!=='all')||(transactionDirection&&transactionDirection!=='all')||(transactionSemantic&&transactionSemantic!=='all')||transactionPeriod!=='month');
  const categorizationReview = categorizationOpen ? renderCategorizationReview({ transactions, categories, merchants, merchantAliases, categorizationRules, accounts, household, profile, fxRates, canWrite, categorizationFilter, categorizationPage, categorizationGroupKey }) : '';

  const entityDatalists=`<datalist id="counterpartyDatalist">${counterparties.map((row)=>`<option value="${escapeHtml(row.name)}"></option>`).join('')}</datalist>`;
  const duplicateHtml=duplicatePairs.length?`<article class="card card-padding duplicate-review">
    <div class="card-heading duplicate-review-heading">
      <div><h3 class="card-title">Mögliche Doppelbuchungen</h3><p class="card-subtitle">Finance macht nur Vorschläge. Öffne „Vergleichen“, prüfe beide Buchungen in Ruhe und entscheide erst danach.</p></div>
      <span class="status-pill status-pill--warning">${duplicatePairs.length} prüfen</span>
    </div>
    <div class="duplicate-review-list">
      ${duplicatePairs.map(({left,right,score,days,merchantSimilarity})=>{
        const reasons=[
          'gleicher Betrag',
          left.currency===right.currency?'gleiche Währung':'',
          days<=1?'gleiches / nahes Datum':'',
          merchantSimilarity>=0.85?'ähnlicher Händler':'',
          (receiptIds.has(left.id)!==receiptIds.has(right.id))?'Beleg + Bankbuchung':'',
        ].filter(Boolean);
        const leftTitle=left.merchants?.name||left.counterparty||left.description||'Buchung';
        const rightTitle=right.merchants?.name||right.counterparty||right.description||'Buchung';
        return `<details class="duplicate-review-item">
          <summary class="duplicate-review-summary">
            <div class="duplicate-review-amount">${money(Math.abs(Number(left.amount)),{currency:left.currency,locale})}</div>
            <div class="duplicate-review-summary-copy">
              <strong>${escapeHtml(leftTitle)} <span aria-hidden="true">↔</span> ${escapeHtml(rightTitle)}</strong>
              <span>${escapeHtml(dateLabel(left.occurred_at,locale))} · ${escapeHtml(left.accounts?.name||'Konto')} &nbsp;↔&nbsp; ${escapeHtml(dateLabel(right.occurred_at,locale))} · ${escapeHtml(right.accounts?.name||'Konto')}</span>
              <small>${escapeHtml(reasons.join(' · '))} · Treffer ${Math.round(score)}%</small>
            </div>
            <span class="duplicate-review-open">Vergleichen</span>
          </summary>
          <div class="duplicate-review-body">
            <div class="duplicate-compare-grid">
              ${duplicateComparePanel(left,{locale,receiptIds})}
              ${duplicateComparePanel(right,{locale,receiptIds})}
            </div>
            ${canWrite?`<div class="duplicate-review-actions">
              <button class="action-button action-button--secondary" type="button" data-action="transaction-duplicate-ignore" data-left-id="${left.id}" data-right-id="${right.id}">Sind verschieden</button>
              <button class="action-button action-button--primary" type="button" data-action="transaction-merge-suggested" data-left-id="${left.id}" data-right-id="${right.id}">Zusammenführen</button>
            </div>`:''}
          </div>
        </details>`;
      }).join('')}
    </div>
  </article>`:'';

  return `
    ${entityDatalists}
    ${pageHeader({title:'Transaktionen',subtitle:'Kacheln zeigen die Auswertung; die Buchungsliste bleibt als vollständiges Journal erhalten, ist aber filterbar und paginiert.',actions:canWrite?`<button class="action-button action-button--primary" type="button" data-action="receipt-camera">${icon('receipt')} Beleg fotografieren</button><button class="action-button action-button--secondary" type="button" data-action="categorization-open">${icon('sparkles')} Kategorien analysieren</button><button class="action-button action-button--secondary" type="button" data-action="show-form" data-target="transaction-create">${icon('plus')} Transaktion</button><button class="action-button action-button--secondary" type="button" data-action="show-form" data-target="transfer-create" ${accounts.length>1?'':'disabled'}>${icon('repeat')} Umbuchung</button>`:''})}
    ${canWrite?formShell('transaction-create','Neue Transaktion','Manuelle Buchung',txFields,{hidden:true,submitLabel:'Transaktion speichern'}):''}
    ${canWrite?formShell('transaction-edit','Transaktion bearbeiten','Ausgabe, Einnahme oder interne Umbuchung korrekt zuordnen',editFields,{hidden:true,submitLabel:'Änderungen speichern'}):''}
    ${canWrite?formShell('transfer-create','Umbuchung','Geld zwischen eigenen Konten verschieben',transferFields,{hidden:true,submitLabel:'Umbuchung speichern'}):''}
    ${canWrite?formShell('transaction-merge','Doppelte Buchungen zusammenführen','Finance behält bevorzugt die echte Bankbuchung und übernimmt Beleg, Kategorie und weitere Zuordnungen.',mergeFields,{hidden:true,submitLabel:'Zusammenführen'}):''}
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
    ${duplicateHtml}

    <article class="card card-padding transaction-filter-card"><div class="transaction-filter-grid"><label class="field"><span>Suchen</span><input class="text-control" id="transactionSearch" type="search" value="${escapeHtml(transactionQuery)}" placeholder="z. B. Migros, TWINT, 8.60 oder CHF 8.60"></label><label class="field"><span>Zeitraum</span><select class="text-control" id="transactionPeriodSelect"><option value="month" ${transactionPeriod==='month'?'selected':''}>${selectedFinanceMonthMode==='calendar'?'Aktueller Monat':'Aktueller Finanzmonat'} · ${escapeHtml(financeCycleLabel(currentFinanceCycle,locale))}</option><option value="previous_month" ${transactionPeriod==='previous_month'?'selected':''}>${selectedFinanceMonthMode==='calendar'?'Letzter Monat':'Letzter Finanzmonat'} · ${escapeHtml(financeCycleLabel(previousCycle,locale))}</option><option value="quarter" ${transactionPeriod==='quarter'?'selected':''}>Aktuelles Quartal</option><option value="year" ${transactionPeriod==='year'?'selected':''}>Aktuelles Jahr</option><option value="all" ${transactionPeriod==='all'?'selected':''}>Alle Buchungen</option><option value="custom" ${transactionPeriod==='custom'?'selected':''}>Von / Bis</option></select></label><label class="field"><span>Kategorie</span><select class="text-control" id="transactionCategoryFilter"><option value="all">Alle Kategorien</option><option value="uncategorized" ${transactionCategory==='uncategorized'?'selected':''}>Ohne Kategorie</option>${categoryFilterOptions}</select></label><label class="field"><span>Konto</span><select class="text-control" id="transactionAccountFilter"><option value="all">Alle Konten</option>${accountFilterOptions}</select></label><label class="field"><span>Kontext / Projekt</span><select class="text-control" id="transactionContextFilter"><option value="all">Alle Kontexte</option>${contextFilterOptions}</select></label><label class="field"><span>Fahrzeug</span><select class="text-control" id="transactionVehicleFilter"><option value="all">Alle Fahrzeuge</option>${vehicleFilterOptions}</select></label><label class="field"><span>Richtung</span><select class="text-control" id="transactionDirectionFilter"><option value="all" ${transactionDirection==='all'?'selected':''}>Alle</option><option value="income" ${transactionDirection==='income'?'selected':''}>Nur Eingänge</option><option value="expense" ${transactionDirection==='expense'?'selected':''}>Nur Ausgänge</option></select></label><label class="field"><span>Bedeutung</span><select class="text-control" id="transactionSemanticFilter"><option value="all" ${transactionSemantic==='all'?'selected':''}>Alles</option><option value="earned" ${transactionSemantic==='earned'?'selected':''}>Verdienst</option><option value="refund" ${transactionSemantic==='refund'?'selected':''}>Rückerstattungen</option><option value="repayment" ${transactionSemantic==='repayment'?'selected':''}>Rückzahlungen an mich</option><option value="debt_repayment" ${transactionSemantic==='debt_repayment'?'selected':''}>Darlehen / Schuldentilgung</option><option value="unclassified" ${transactionSemantic==='unclassified'?'selected':''}>Ungeklärte Eingänge</option><option value="fixed" ${transactionSemantic==='fixed'?'selected':''}>Fixkosten</option><option value="variable" ${transactionSemantic==='variable'?'selected':''}>Variable Ausgaben</option><option value="saving" ${transactionSemantic==='saving'?'selected':''}>Sparen / Umbuchungen</option><option value="tax" ${transactionSemantic==='tax'?'selected':''}>Steuern</option></select></label><label class="field"><span>Von</span><input class="text-control" id="transactionFrom" type="date" value="${escapeHtml(transactionFrom)}"></label><label class="field"><span>Bis</span><input class="text-control" id="transactionTo" type="date" value="${escapeHtml(transactionTo)}"></label><label class="field"><span>Ansicht</span><select class="text-control" id="transactionViewSelect"><option value="summary" ${transactionView==='summary'?'selected':''}>Kacheln</option><option value="details" ${transactionView==='details'?'selected':''}>Einzelbuchungen</option></select></label><div class="transaction-filter-actions"><button class="table-action" type="button" data-action="transaction-filter-reset" ${hasFilters?'':'disabled'}>Filter zurücksetzen</button></div></div><div class="toolbar-note">${transactions.length} Buchungen geladen${earliest&&latest?` · Daten von ${dateLabel(earliest.occurred_at,locale)} bis ${dateLabel(latest.occurred_at,locale)}`:''} · ${escapeHtml(fxLabel(fxRates,baseCurrency))}</div></article>
    <div class="metric-grid" style="margin-bottom:16px">${metricCard('Einnahmen',money(income,{currency:baseCurrency,locale}),`${periodLabel(transactionPeriod,{currentCycle:currentFinanceCycle,previousCycle,locale,mode:selectedFinanceMonthMode})} · aktueller Filter`,'positive')}${metricCard('Ausgaben',money(expenses,{currency:baseCurrency,locale}),'Konsum, Zins & Gebühren')}${monthlyRows.length?metricCard('Ø Ausgaben / Monat',money(monthlyAverage,{currency:baseCurrency,locale}),monthlyAverageNote):''}${debtPrincipal>0?metricCard('Schuldentilgung',money(debtPrincipal,{currency:baseCurrency,locale}),'reduziert Verbindlichkeiten'):''}${metricCard('Cashflow',money(income+receivableInflow-cashOutflow,{currency:baseCurrency,locale}),'alle externen Geldbewegungen',income+receivableInflow-cashOutflow>=0?'positive':'warning')}${metricCard('Sparen',money(savings,{currency:baseCurrency,locale}),'Umbuchungen auf Sparkonten','positive')}</div>
    ${transactionView==='summary'?`<div class="transaction-summary-grid">${summary||emptyState('list','Noch keine Ausgaben','Für den gewählten Filter liegen keine Ausgaben vor.')}</div>${monthlyHistory}`:`<article class="card card-padding"><div class="card-heading"><div><h3 class="card-title">Buchungen</h3><p class="card-subtitle">${escapeHtml(rangeText)} · keine Endlosliste</p></div><div class="admin-pager"><button class="table-action" type="button" data-action="transaction-page" data-page="${page-1}" ${page<=1?'disabled':''}>Zurück</button><span>Seite ${page} / ${totalPages}</span><button class="table-action" type="button" data-action="transaction-page" data-page="${page+1}" ${page>=totalPages?'disabled':''}>Weiter</button></div></div>${pageRows.length?`<div class="list">${pageRows.map((tx)=>txRow(tx,{locale,canWrite,accounts,canTax,paymentMap,billMap})).join('')}</div>`:emptyState('list','Keine Treffer','Passe Suche oder Filter an.')}</article>`}`;
}
