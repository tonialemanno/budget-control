import { dataTable, metricCard, pageHeader, statusPill } from '../app/components.js';
import { dateInputValue, dateLabel, escapeHtml, money } from '../app/format.js';
import { convertAmount, fxLabel } from '../app/fx.js';
import { icon } from '../app/icons.js';
import { t } from '../app/i18n.js';
import { buildDebtPaymentTransactionMap, consumptionExpenseBase } from '../app/financial-effects.js';

const TAX_YEARS=[2025,2026,2027];

const TAX_SECTIONS=[
  {key:'persons_household',group:'Personen & Haushalt',label:'Personen & Haushalt',hint:'Personalien, Steuerdomizil, Zivilstand, Konfession, Partner und Grunddaten.'},
  {key:'income',group:'Arbeit',label:'Erwerb & Einkommen',hint:'Lohn, Nebenlohn, Bonus, Taggelder, Renten und weitere Einkünfte.'},
  {key:'work_expenses',group:'Arbeit',label:'Berufskosten',hint:'Arbeitsweg, Homeoffice, Verpflegung, Weiterbildung und Arbeitsmittel.'},
  {key:'pension_insurance',group:'Versicherung, Vorsorge & Rente',label:'Vorsorge & Versicherungen',hint:'Säule 3a, BVG-Einkäufe, Prämien, Renten und Bescheinigungen.'},
  {key:'banks_securities',group:'Finanzen',label:'Banken & Wertschriften',hint:'Konten, 31.12.-Salden, Zinsen, Depots, Dividenden und Verrechnungssteuer.'},
  {key:'crypto',group:'Finanzen',label:'Kryptowährungen',hint:'Bestand 31.12., Wallet/Exchange, Steuerwert sowie Erträge/Staking.'},
  {key:'debts',group:'Finanzen',label:'Schulden',hint:'Saldo 31.12., Gläubiger, Schuldzinsen und Jahresnachweise.'},
  {key:'medical',group:'Sonstiges',label:'Krankheits-, Unfall- & Behinderungskosten',hint:'Brutto, Erstattungen und selbst getragene Kosten.'},
  {key:'children',group:'Personen & Haushalt',label:'Kinder',hint:'Geburt, Schule/Ausbildung, Obhut, Sorgerecht und Nachweise.'},
  {key:'support',group:'Sonstiges',label:'Unterhaltszahlungen',hint:'Erhaltene und bezahlte Alimente mit Zahlungsnachweisen.'},
  {key:'donations',group:'Sonstiges',label:'Spenden & Parteispenden',hint:'Organisation, Betrag, Art und Beleg.'},
  {key:'property',group:'Eigentum',label:'Liegenschaften',hint:'Steuerwert, Eigenmietwert, Ertrag, Hypothek und Unterhalt.'},
  {key:'assets',group:'Eigentum',label:'Fahrzeuge & übriges Vermögen',hint:'31.12.-Werte für Fahrzeuge und andere steuerrelevante Vermögenswerte.'},
  {key:'inheritance_gifts',group:'Sonstiges',label:'Erbschaften & Schenkungen',hint:'Art, Datum, Wert, Herkunft, Beziehung und Dokumente.'},
  {key:'foreign',group:'Finanzen',label:'Ausland',hint:'Ausländische Konten, Depots, Immobilien, Renten und Einkünfte.'},
  {key:'tax_account',group:'Sonstiges',label:'Steuerkonto',hint:'Provisorische Rechnungen, Zahlungen, definitive Veranlagung und Rückerstattungen.'},
];

const CASE_STATUS={
  open:'Offen', collecting:'In Bearbeitung', complete:'Vollständig', exported:'Exportiert',
  filed:'Eingereicht', assessed:'Veranlagt', final:'Definitiv',
};
const SECTION_STATUS={
  open:'Offen', in_progress:'In Bearbeitung', complete:'Vollständig',
  review:'Prüfen', not_applicable:'Nicht relevant',
};

function num(value){ const n=Number(value); return Number.isFinite(n)?n:0; }
function effectiveTaxYear(tx){
  const explicit=Number(tx?.tax_year);
  if(Number.isInteger(explicit)&&explicit>=2000&&explicit<=2100) return explicit;
  const d=new Date(tx?.occurred_at);
  return Number.isNaN(d.getTime())?null:d.getFullYear();
}
function effectiveTaxTreatment(tx){
  if(tx?.tax_treatment) return tx.tax_treatment;
  const text=`${tx?.tax_category||''} ${tx?.description||''} ${tx?.counterparty||''}`.toLowerCase();
  if(/steuerrück|steuererstatt|tax refund/.test(text)) return 'tax_refund';
  if(/steuerzahlung|steueramt|steuerverwaltung|kanton.*steuer|gemeinde.*steuer|tax payment/.test(text)) return num(tx?.amount)>=0?'tax_refund':'tax_payment';
  return num(tx?.amount)>=0?'income':'deduction';
}
function effectiveTaxSection(tx){
  if(tx?.tax_section_key) return tx.tax_section_key;
  const treatment=effectiveTaxTreatment(tx);
  if(['tax_payment','tax_refund'].includes(treatment)) return 'tax_account';
  if(treatment==='income') return 'income';
  if(treatment==='deduction') return 'work_expenses';
  return null;
}
function taxSectionLabel(key){
  return TAX_SECTIONS.find((section)=>section.key===key)?.label||key||'Nicht spezifiziert';
}
function taxTreatmentLabel(value){
  return {
    income:'Einkommen',
    deduction:'Abzug / Ausgabe',
    tax_payment:'Steuerzahlung',
    tax_refund:'Steuerrückerstattung',
    information:'Information',
  }[value]||value||'—';
}
function taxMovementBase(tx,targetCurrency,fxRates){
  const converted=convertAmount(Math.abs(num(tx?.amount)),tx?.currency||targetCurrency,targetCurrency,fxRates);
  return converted===null?0:Math.abs(converted);
}
function caseForYear(cases,year){ return (cases||[]).find((row)=>Number(row.tax_year)===Number(year)&&row.country_code==='CH'&&row.canton_code==='SG')||null; }
function ruleForYear(rules,year){ return (rules||[]).find((row)=>row.country_code==='CH'&&row.canton_code==='SG'&&Number(row.tax_year)===Number(year))||null; }

function taxLedgerSummary(taxCase,obligations,payments,transactions,fxRates){
  if(!taxCase) return {paid:0,refunds:0,due:0,open:0,known:false,transactionPaid:0,transactionRefunds:0};
  const caseObligations=(obligations||[]).filter((row)=>row.tax_case_id===taxCase.id&&row.status!=='cancelled');
  const casePayments=(payments||[]).filter((row)=>row.tax_case_id===taxCase.id);
  const linkedTransactionIds=new Set(casePayments.map((row)=>row.transaction_id).filter(Boolean));
  const accountTransactions=(transactions||[]).filter((tx)=>
    tx.tax_relevant && tx.status==='booked' && !tx.transfer_group_id &&
    effectiveTaxYear(tx)===Number(taxCase.tax_year) &&
    !linkedTransactionIds.has(tx.id) &&
    ['tax_payment','tax_refund'].includes(effectiveTaxTreatment(tx))
  );
  const obligationsTotal=caseObligations.reduce((sum,row)=>sum+num(row.amount),0);
  const explicitPaid=casePayments.filter((row)=>['payment','interest_payment'].includes(row.payment_type)).reduce((sum,row)=>sum+num(row.amount),0);
  const explicitRefunds=casePayments.filter((row)=>['refund','interest_credit'].includes(row.payment_type)).reduce((sum,row)=>sum+num(row.amount),0);
  const transactionPaid=accountTransactions.filter((tx)=>effectiveTaxTreatment(tx)==='tax_payment').reduce((sum,tx)=>sum+taxMovementBase(tx,taxCase.currency||'CHF',fxRates),0);
  const transactionRefunds=accountTransactions.filter((tx)=>effectiveTaxTreatment(tx)==='tax_refund').reduce((sum,tx)=>sum+taxMovementBase(tx,taxCase.currency||'CHF',fxRates),0);
  const paid=explicitPaid+transactionPaid;
  const refunds=explicitRefunds+transactionRefunds;
  const fallback=num(taxCase.assessed_tax_amount)||num(taxCase.expected_tax_amount);
  const due=obligationsTotal>0?obligationsTotal:fallback;
  const known=obligationsTotal>0||taxCase.assessed_tax_amount!==null&&taxCase.assessed_tax_amount!==undefined||taxCase.expected_tax_amount!==null&&taxCase.expected_tax_amount!==undefined;
  return {paid,refunds,due,open:Math.max(0,due-paid+refunds),known,transactionPaid,transactionRefunds};
}

function ledgerStatus(summary){
  if(summary.known&&summary.due>0&&summary.open<=0.005) return statusPill('active','Bezahlt');
  return statusPill('pending','Offen');
}

function ruleStatus(rule){
  if(!rule) return statusPill('pending','Regelwerk fehlt');
  if(rule.status==='official') return statusPill('active',rule.version);
  if(rule.status==='partial') return statusPill('warning',`${rule.version} · teilweise`);
  return statusPill('pending',`${rule.version} · ausstehend`);
}

function sectionStatusPill(status){
  if(status==='complete'||status==='not_applicable') return statusPill('active',SECTION_STATUS[status]);
  if(status==='review') return statusPill('warning',SECTION_STATUS[status]);
  return statusPill('pending',SECTION_STATUS[status]||'Offen');
}

function taxChecks({year,taxCase,rule,accounts,transactions,documents,pensions,debts,receivables,investments,properties,vehicles,taxItems,taxPeople,taxChildren,taxEmployments}){
  const checks=[];
  const docs=(documents||[]).filter((d)=>d.tax_relevant&&Number(d.tax_year||new Date(d.document_date||d.created_at).getFullYear())===year);
  const items=(taxItems||[]).filter((i)=>i.tax_case_id===taxCase?.id);
  const sourceKeys=new Set(items.filter((i)=>i.source_type&&i.source_id).map((i)=>`${i.source_type}:${i.source_id}`));
  const docText=docs.map((d)=>`${d.name||''} ${d.tax_category||''}`.toLowerCase()).join(' | ');
  const taxTransactions=(transactions||[]).filter((tx)=>tx.tax_relevant&&effectiveTaxYear(tx)===year);

  if(!taxCase) checks.push({level:'warning',text:`Steuerfall ${year} ist noch nicht angelegt.`});
  if(taxCase && !(taxPeople||[]).some((p)=>p.tax_case_id===taxCase.id&&Number(p.person_no)===1)) checks.push({level:'warning',text:'Hauptperson im Steuerfall ist noch nicht erfasst.'});
  if(taxCase && (taxChildren||[]).some((child)=>child.tax_case_id===taxCase.id&&child.assignment_status==='unresolved')) checks.push({level:'warning',text:'Mindestens ein Kind hat die steuerliche Zuordnung ungeklärt.'});
  if(taxCase && (taxEmployments||[]).some((job)=>job.tax_case_id===taxCase.id) && !items.some((i)=>i.item_type==='salary_certificate') && !/lohnausweis/.test(docText)) checks.push({level:'warning',text:'Arbeitsstelle erfasst, aber Lohnausweis/Bescheinigung noch nicht bestätigt.'});
  if(rule?.status==='partial') checks.push({level:'warning',text:`Regelversion ${rule.version} ist als teilweise veröffentlicht markiert. Betragslimiten nicht automatisch als definitiv behandeln.`});
  if(rule?.status==='pending') checks.push({level:'warning',text:`Regelversion ${rule.version} ist noch ausstehend. Keine automatischen Abzüge versprechen.`});

  const accountSnapshots=items.filter((i)=>i.item_type==='account_snapshot');
  if((accounts||[]).length&&accountSnapshots.length<(accounts||[]).length) checks.push({level:'warning',text:`31.12.-Salden: ${accountSnapshots.length} von ${accounts.length} Konten im Steuerdossier dokumentiert.`});

  const salaryTx=(transactions||[]).filter((tx)=>effectiveTaxYear(tx)===year&&num(tx.amount)>0&&(/lohn|salary|gehalt/i.test(`${tx.description||''} ${tx.counterparty||''}`)||tx.categories?.name==='Lohn'));
  if(salaryTx.length&&!/lohnausweis/.test(docText)&&!items.some((i)=>i.item_type==='salary_certificate')) checks.push({level:'warning',text:'Erwerbseinkommen erkannt, aber kein Lohnausweis im Steuerdossier bestätigt.'});

  const pillar3a=(pensions||[]).filter((p)=>String(p.pension_type||'').includes('3a')&&num(p.annual_contribution)>0);
  if(pillar3a.length&&!/3a|säule/.test(docText)&&!pillar3a.some((p)=>sourceKeys.has(`pension:${p.id}`))) checks.push({level:'warning',text:'Säule-3a-Position vorhanden, aber keine Bescheinigung/Steuerposition bestätigt.'});

  if((debts||[]).some((d)=>num(d.outstanding_amount)>0)&&!items.some((i)=>i.item_type==='debt_snapshot')&&!docs.some((d)=>d.object_type==='debt')) checks.push({level:'warning',text:'Schulden vorhanden, aber noch kein 31.12.-Schuldsaldo/Jahreszinsnachweis im Dossier.'});
  if((investments||[]).length&&!items.some((i)=>i.section_key==='banks_securities'&&i.source_type==='investment')&&!/wertschrift|depot|steuerbescheinigung/.test(docText)) checks.push({level:'warning',text:'Investmentpositionen vorhanden, aber Depot-/Steuerbescheinigung noch nicht bestätigt.'});
  if((properties||[]).length&&!items.some((i)=>i.section_key==='property')) checks.push({level:'warning',text:'Liegenschaften vorhanden, aber der Steuerbereich Liegenschaften ist noch ohne Position.'});
  if((vehicles||[]).length&&!items.some((i)=>i.section_key==='assets'&&i.source_type==='vehicle')) checks.push({level:'warning',text:'Fahrzeuge vorhanden, aber kein 31.12.-Steuerwert im Dossier erfasst.'});
  if((receivables||[]).some((r)=>num(r.outstanding_amount)>0)&&!items.some((i)=>i.section_key==='banks_securities'&&i.source_type==='receivable')) checks.push({level:'warning',text:'Offene Forderungen vorhanden. Prüfen, ob sie per 31.12. im Guthaben-/Vermögensbereich erfasst sind.'});

  const receiptTxIds=new Set((documents||[]).filter((d)=>d.object_type==='transaction'&&d.object_id).map((d)=>d.object_id));
  const missingReceipts=taxTransactions.filter((tx)=>!receiptTxIds.has(tx.id));
  if(missingReceipts.length) checks.push({level:'warning',text:`${missingReceipts.length} steuerrelevante Buchung${missingReceipts.length===1?'':'en'} ohne verknüpften Beleg.`});
  if(!checks.length) checks.push({level:'ok',text:'Für die aktuell erfassten Daten sind keine offenen Steuer-Checks erkennbar.'});
  return checks;
}

function yearCard({year,taxCase,rule,summary,selected,locale}){
  const openValue=summary.known?money(summary.open,{currency:taxCase?.currency||'CHF',locale}):'Betrag offen';
  const paidValue=money(summary.paid,{currency:taxCase?.currency||'CHF',locale});
  return `<article class="card card-padding" style="${selected?'outline:2px solid var(--accent);':''}">
    <div class="card-heading"><div><h3 class="card-title">Steuerjahr ${year}</h3><p class="card-subtitle">${taxCase?escapeHtml(CASE_STATUS[taxCase.status]||taxCase.status):'Noch nicht eingerichtet'}</p></div>${ledgerStatus(summary)}</div>
    <div class="mini-detail-list">
      <span>Bezahlt <strong>${paidValue}</strong></span>
      <span>Noch offen <strong>${openValue}</strong></span>
      <span>Regelversion <strong>${rule?escapeHtml(rule.version):'—'}</strong></span>
    </div>
    <div class="form-actions"><button class="action-button action-button--secondary" type="button" data-action="tax-case-select" data-year="${year}">${selected?'Ausgewählt':'Öffnen'}</button></div>
  </article>`;
}

export function renderTaxAdvisor({
  transactions = [], debtPayments = [], documents = [], accounts = [], pensions = [], debts = [], receivables = [],
  insurance = [], investments = [], properties = [], vehicles = [], bills = [], household, profile, fxRates, taxYear, canWrite=false,
  taxRuleVersions = [], taxCases = [], taxPeople = [], taxChildren = [], taxEmployments = [], taxCaseSections = [], taxItems = [], taxObligations = [], taxPayments = [],
} = {}) {
  const baseCurrency=household?.base_currency||'CHF';
  const locale=profile?.locale||'de-CH';
  const year=Number(taxYear)||2026;
  const taxCase=caseForYear(taxCases,year);
  const rule=taxCase?.tax_rule_versions||ruleForYear(taxRuleVersions,year);
  const yearRules=new Map(TAX_YEARS.map((y)=>[y,ruleForYear(taxRuleVersions,y)]));
  const yearCards=TAX_YEARS.map((y)=>{
    const c=caseForYear(taxCases,y);
    return yearCard({year:y,taxCase:c,rule:c?.tax_rule_versions||yearRules.get(y),summary:taxLedgerSummary(c,taxObligations,taxPayments,transactions,fxRates),selected:y===year,locale});
  }).join('');

  const taxTransactions=transactions.filter((tx)=>tx.tax_relevant&&effectiveTaxYear(tx)===year);
  const taxDocuments=documents.filter((doc)=>doc.tax_relevant&&Number(doc.tax_year||new Date(doc.document_date||doc.created_at).getFullYear())===year);
  const receiptByTx=new Map();
  for(const doc of documents.filter((d)=>d.object_type==='transaction'&&d.object_id)){
    const list=receiptByTx.get(doc.object_id)||[]; list.push(doc); receiptByTx.set(doc.object_id,list);
  }
  const paymentMap=buildDebtPaymentTransactionMap(debtPayments);
  const taxIncome=taxTransactions
    .filter((tx)=>effectiveTaxTreatment(tx)==='income'&&num(tx.amount)>0)
    .reduce((sum,tx)=>sum+taxMovementBase(tx,baseCurrency,fxRates),0);
  const taxExpense=taxTransactions
    .filter((tx)=>effectiveTaxTreatment(tx)==='deduction')
    .reduce((sum,tx)=>sum+consumptionExpenseBase(tx,paymentMap,baseCurrency,fxRates),0);
  const taxAccountMovementCount=taxTransactions.filter((tx)=>['tax_payment','tax_refund'].includes(effectiveTaxTreatment(tx))).length;
  const missingReceipts=taxTransactions.filter((tx)=>!receiptByTx.has(tx.id));

  const sectionRows=new Map((taxCaseSections||[]).filter((row)=>row.tax_case_id===taxCase?.id).map((row)=>[row.section_key,row]));
  const caseItems=(taxItems||[]).filter((row)=>row.tax_case_id===taxCase?.id);
  const itemDocuments=new Map();
  for(const doc of documents.filter((d)=>d.object_type==='tax_item'&&d.object_id)){
    const list=itemDocuments.get(doc.object_id)||[]; list.push(doc); itemDocuments.set(doc.object_id,list);
  }
  const linkedTaxTransactionIds=new Set((taxPayments||[]).map((row)=>row.transaction_id).filter(Boolean));
  const paidBillTransactionIds=new Set((bills||[]).filter((row)=>row.status==='paid'&&row.paid_transaction_id).map((row)=>row.paid_transaction_id));
  const taxPaymentCandidates=(transactions||[]).filter((tx)=>
    tx.status==='booked' && !tx.transfer_group_id && tx.cashflow_type==='standard' &&
    !linkedTaxTransactionIds.has(tx.id) && !paidBillTransactionIds.has(tx.id) &&
    (effectiveTaxYear(tx)===year || (!tx.tax_relevant && new Date(tx.occurred_at).getFullYear()===year))
  );
  const sourceOptions=[
    ...accounts.map((row)=>({value:`account:${row.account_id}`,label:`Konto · ${row.name}`})),
    ...debts.map((row)=>({value:`debt:${row.id}`,label:`Schuld · ${row.name||row.creditor}`})),
    ...receivables.map((row)=>({value:`receivable:${row.id}`,label:`Forderung · ${row.debtor} · ${row.reason}`})),
    ...pensions.map((row)=>({value:`pension:${row.id}`,label:`Vorsorge · ${row.name}`})),
    ...insurance.map((row)=>({value:`insurance:${row.id}`,label:`Versicherung · ${row.name}`})),
    ...investments.map((row)=>({value:`investment:${row.id}`,label:`Investment · ${row.name}`})),
    ...properties.map((row)=>({value:`property:${row.id}`,label:`Liegenschaft · ${row.name}`})),
    ...vehicles.map((row)=>({value:`vehicle:${row.id}`,label:`Fahrzeug · ${row.name}`})),
  ];
  const completeSections=TAX_SECTIONS.filter((section)=>['complete','not_applicable'].includes(sectionRows.get(section.key)?.status)).length;
  const completeness=Math.round((completeSections/TAX_SECTIONS.length)*100);
  const selectedLedger=taxLedgerSummary(taxCase,taxObligations,taxPayments,transactions,fxRates);
  const selectedObligations=(taxObligations||[]).filter((row)=>row.tax_case_id===taxCase?.id);
  const selectedPayments=(taxPayments||[]).filter((row)=>row.tax_case_id===taxCase?.id);
  const selectedPeople=(taxPeople||[]).filter((row)=>row.tax_case_id===taxCase?.id).sort((a,b)=>num(a.person_no)-num(b.person_no));
  const selectedChildren=(taxChildren||[]).filter((row)=>row.tax_case_id===taxCase?.id);
  const selectedEmployments=(taxEmployments||[]).filter((row)=>row.tax_case_id===taxCase?.id);
  const checks=taxChecks({year,taxCase,rule,accounts,transactions,documents,pensions,debts,receivables,investments,properties,vehicles,taxItems,taxPeople,taxChildren,taxEmployments});

  const transactionRows=taxTransactions.map((tx)=>{
    const receipts=receiptByTx.get(tx.id)||[];
    const payment=paymentMap.get(tx.id);
    const displayedAmount=payment?-(num(payment.interest_amount)+num(payment.fee_amount)):num(tx.amount);
    const amountNote=payment?'<div class="table-meta">nur Zins & Gebühren</div>':'';
    const treatment=effectiveTaxTreatment(tx);
    const section=effectiveTaxSection(tx);
    return `<tr><td>${dateLabel(tx.occurred_at,locale)}<div class="table-meta">${escapeHtml(t('Steuerjahr'))} ${effectiveTaxYear(tx)}</div></td><td><strong>${escapeHtml(tx.description)}</strong><div class="table-meta">${escapeHtml(t(taxSectionLabel(section)))} · ${escapeHtml(t(taxTreatmentLabel(treatment)))}${tx.tax_category?` · ${escapeHtml(t(tx.tax_category))}`:''}</div></td><td>${money(displayedAmount,{currency:tx.currency,locale})}${amountNote}</td><td>${receipts.length?statusPill('active',`${receipts.length} Beleg${receipts.length===1?'':'e'}`):statusPill('pending','Beleg fehlt')}</td><td><div class="table-actions">${canWrite?`<button class="table-action" type="button" data-action="tax-receipt" data-id="${tx.id}">${icon('plus')} Beleg</button><button class="table-action" type="button" data-action="transaction-edit" data-id="${tx.id}">Steuerdaten bearbeiten</button><button class="table-action" type="button" data-action="transaction-tax-toggle" data-id="${tx.id}" data-value="false">Entfernen</button>`:''}</div></td></tr>`;
  });

  const itemRows=caseItems.map((item)=>{
    const itemDocs=itemDocuments.get(item.id)||[];
    const sourceLabel=item.source_type?sourceOptions.find((option)=>option.value===`${item.source_type}:${item.source_id}`)?.label:null;
    return `<tr>
    <td>${item.occurred_on?dateLabel(item.occurred_on,locale):'—'}</td>
    <td><strong>${escapeHtml(item.title)}</strong><div class="table-meta">${escapeHtml(TAX_SECTIONS.find((s)=>s.key===item.section_key)?.label||item.section_key)}${item.person_label?` · ${escapeHtml(item.person_label)}`:''}${sourceLabel?` · ${escapeHtml(sourceLabel)}`:''}</div></td>
    <td>${item.gross_amount!==null&&item.gross_amount!==undefined?money(item.gross_amount,{currency:item.currency,locale}):item.amount!==null&&item.amount!==undefined?money(item.amount,{currency:item.currency,locale}):'—'}</td>
    <td>${item.deductible_amount!==null&&item.deductible_amount!==undefined?money(item.deductible_amount,{currency:item.currency,locale}):'—'}</td>
    <td>${statusPill(item.verification_status==='verified'?'active':item.verification_status==='review'||item.verification_status==='advisor_review'?'warning':'pending',item.verification_status)}<div class="table-meta">${itemDocs.length} Beleg${itemDocs.length===1?'':'e'}</div></td>
    <td><div class="table-actions">${canWrite?`<button class="table-action" type="button" data-action="tax-item-document" data-id="${item.id}">${icon('plus')} Beleg</button><button class="table-action table-action--danger" type="button" data-action="tax-item-delete" data-id="${item.id}">Löschen</button>`:''}</div></td>
  </tr>`;
  });

  const obligationRows=selectedObligations.map((row)=>`<tr>
    <td>${row.due_date?dateLabel(row.due_date,locale):'—'}</td><td><strong>${escapeHtml(row.label)}</strong><div class="table-meta">${escapeHtml(row.obligation_type)}</div></td>
    <td>${money(row.amount,{currency:row.currency,locale})}</td><td>${statusPill(row.status==='paid'?'active':row.status==='partial'?'warning':'pending',row.status)}</td>
    <td>${canWrite?`<button class="table-action table-action--danger" type="button" data-action="tax-obligation-delete" data-id="${row.id}">Löschen</button>`:''}</td>
  </tr>`);
  const paymentRows=selectedPayments.map((row)=>`<tr>
    <td>${dateLabel(row.paid_at,locale)}</td><td><strong>${escapeHtml(row.payment_type)}</strong><div class="table-meta">${escapeHtml(row.reference||'')}</div></td>
    <td>${money(row.amount,{currency:row.currency,locale})}</td><td>${canWrite?`<button class="table-action table-action--danger" type="button" data-action="tax-payment-delete" data-id="${row.id}">Löschen</button>`:''}</td>
  </tr>`);

  const personRows=selectedPeople.map((person)=>`<tr>
    <td>Person ${person.person_no}</td>
    <td><strong>${escapeHtml(`${person.first_name} ${person.last_name}`)}</strong><div class="table-meta">${escapeHtml(person.role||'')}</div></td>
    <td>${person.birth_date?dateLabel(person.birth_date,locale):'—'}</td>
    <td>${escapeHtml([person.occupation,person.employer_name].filter(Boolean).join(' · ')||'—')}</td>
    <td>${canWrite?`<button class="table-action table-action--danger" type="button" data-action="tax-person-delete" data-id="${person.id}">Löschen</button>`:''}</td>
  </tr>`);

  const childRows=selectedChildren.map((child)=>`<tr>
    <td><strong>${escapeHtml(`${child.first_name} ${child.last_name}`)}</strong><div class="table-meta">${escapeHtml(child.assignment_status||'review')}</div></td>
    <td>${dateLabel(child.birth_date,locale)}</td>
    <td>${escapeHtml(child.school_or_training||child.education_status||'—')}${child.training_end?`<div class="table-meta">bis ${dateLabel(child.training_end,locale)}</div>`:''}</td>
    <td>${money(num(child.childcare_costs),{currency:child.currency||'CHF',locale})}</td>
    <td>${canWrite?`<button class="table-action table-action--danger" type="button" data-action="tax-child-delete" data-id="${child.id}">Löschen</button>`:''}</td>
  </tr>`);

  const employmentRows=selectedEmployments.map((job)=>{
    const commuteDays=Math.max(0,num(job.work_days)-num(job.homeoffice_days)-num(job.vacation_days)-num(job.sick_days)-num(job.field_service_days));
    const person=selectedPeople.find((row)=>row.id===job.tax_person_id);
    return `<tr>
      <td><strong>${escapeHtml(job.employer_name)}</strong><div class="table-meta">${escapeHtml(job.work_location||'')}${person?` · ${escapeHtml(person.first_name)}`:''}</div></td>
      <td>${job.period_from?dateLabel(job.period_from,locale):'—'} – ${job.period_to?dateLabel(job.period_to,locale):'—'}</td>
      <td>${money(num(job.gross_income),{currency:job.currency||'CHF',locale})}</td>
      <td><strong>${commuteDays}</strong><div class="table-meta">${num(job.homeoffice_days)} Homeoffice · ${num(job.field_service_days)} Aussendienst</div></td>
      <td>${num(job.commuting_distance_km)} km<div class="table-meta">${escapeHtml(job.transport_mode||'—')}</div></td>
      <td>${canWrite?`<button class="table-action table-action--danger" type="button" data-action="tax-employment-delete" data-id="${job.id}">Löschen</button>`:''}</td>
    </tr>`;
  });

  const personForm=(personNo)=>{
    const person=selectedPeople.find((row)=>Number(row.person_no)===personNo)||{};
    return `<form class="card card-padding" data-form="tax-person-create">
      <input type="hidden" name="taxCaseId" value="${taxCase.id}"><input type="hidden" name="personNo" value="${personNo}">
      <div class="card-heading"><div><h3 class="card-title">Person ${personNo}</h3><p class="card-subtitle">${personNo===1?'Hauptperson':'Partner/in · falls relevant'}</p></div></div>
      <div class="form-grid form-grid--2">
        <label class="field"><span>Rolle</span><select class="text-control" name="role"><option value="taxpayer" ${person.role!=='partner'?'selected':''}>Steuerpflichtige Person</option><option value="partner" ${person.role==='partner'?'selected':''}>Partner/in</option></select></label>
        <label class="field"><span>Geburtsdatum</span><input class="text-control" type="date" name="birthDate" value="${escapeHtml(person.birth_date||'')}"></label>
        <label class="field"><span>Vorname</span><input class="text-control" name="firstName" value="${escapeHtml(person.first_name||'')}" required></label>
        <label class="field"><span>Nachname</span><input class="text-control" name="lastName" value="${escapeHtml(person.last_name||'')}" required></label>
        <label class="field form-grid-span"><span>Adresse</span><input class="text-control" name="addressLine" value="${escapeHtml(person.address_line||'')}"></label>
        <label class="field"><span>PLZ</span><input class="text-control" name="postalCode" value="${escapeHtml(person.postal_code||'')}"></label>
        <label class="field"><span>Ort</span><input class="text-control" name="city" value="${escapeHtml(person.city||'')}"></label>
        <label class="field"><span>Land</span><input class="text-control" name="countryCode" value="${escapeHtml(person.country_code||'CH')}" maxlength="2"></label>
        <label class="field"><span>Zuzug</span><input class="text-control" type="date" name="moveInDate" value="${escapeHtml(person.move_in_date||'')}"></label>
        <label class="field"><span>Wegzug</span><input class="text-control" type="date" name="moveOutDate" value="${escapeHtml(person.move_out_date||'')}"></label>
        <label class="field"><span>Zivilstand</span><input class="text-control" name="maritalStatus" value="${escapeHtml(person.marital_status||taxCase.marital_status||'')}"></label>
        <label class="field"><span>Konfession</span><input class="text-control" name="denomination" value="${escapeHtml(person.denomination||taxCase.denomination||'')}"></label>
        <label class="field"><span>Beruf</span><input class="text-control" name="occupation" value="${escapeHtml(person.occupation||'')}"></label>
        <label class="field"><span>Erwerbsart</span><select class="text-control" name="employmentType"><option value="">—</option><option value="employee" ${person.employment_type==='employee'?'selected':''}>unselbständig</option><option value="self_employed" ${person.employment_type==='self_employed'?'selected':''}>selbständig</option><option value="not_employed" ${person.employment_type==='not_employed'?'selected':''}>nicht erwerbstätig</option><option value="retired" ${person.employment_type==='retired'?'selected':''}>Rente</option><option value="other" ${person.employment_type==='other'?'selected':''}>andere</option></select></label>
        <label class="field"><span>Arbeitgeber</span><input class="text-control" name="employerName" value="${escapeHtml(person.employer_name||'')}"></label>
        <label class="field"><span>Gemeinsame Besteuerung</span><select class="text-control" name="jointTaxation"><option value="false" ${!person.joint_taxation?'selected':''}>Nein</option><option value="true" ${person.joint_taxation?'selected':''}>Ja</option></select></label>
        <label class="field form-grid-span"><span>Notizen</span><textarea class="text-control" name="notes" rows="2">${escapeHtml(person.notes||'')}</textarea></label>
      </div>
      ${canWrite?'<div class="form-actions"><button class="action-button action-button--primary" type="submit">Person speichern</button></div>':''}
    </form>`;
  };

  const sectionCards=TAX_SECTIONS.map((section)=>{
    const row=sectionRows.get(section.key);
    const status=row?.status||'open';
    const count=caseItems.filter((item)=>item.section_key===section.key).length;
    return `<article class="settings-link-card"><div><span class="list-row-leading">${icon(status==='complete'?'check':'list')}</span><div><h3 class="card-title">${escapeHtml(t(section.label))}</h3><p class="card-subtitle">${escapeHtml(t(section.group))} · ${count} ${escapeHtml(t(count===1?'Position':'Positionen'))} · ${escapeHtml(t(section.hint))}</p></div></div>
      <div class="stack" style="min-width:min(100%,220px)">${sectionStatusPill(status)}
      ${taxCase&&canWrite?`<form data-form="tax-section-status"><input type="hidden" name="taxCaseId" value="${taxCase.id}"><input type="hidden" name="sectionKey" value="${section.key}"><select class="select-control" name="status">${Object.entries(SECTION_STATUS).map(([key,label])=>`<option value="${key}" ${key===status?'selected':''}>${label}</option>`).join('')}</select><button class="action-button action-button--secondary" type="submit">Status speichern</button></form>`:''}</div>
    </article>`;
  }).join('');

  const checkHtml=checks.map((check)=>`<div class="inline-alert ${check.level==='ok'?'inline-alert--success':''}"><strong>${check.level==='ok'?'OK':escapeHtml(t('Offener Punkt'))}</strong><span>${escapeHtml(t(check.text))}</span></div>`).join('');

  const ruleAlert=rule
    ? `<div class="inline-alert ${rule.status==='official'?'inline-alert--success':''}"><strong>Regelversion ${escapeHtml(rule.version)}</strong><span>${escapeHtml(rule.notes||'')}${rule.source_url?` · <a href="${escapeHtml(rule.source_url)}" target="_blank" rel="noreferrer">Offizielle SG-Unterlagen</a>`:''}</span></div>`
    : '<div class="inline-alert"><strong>Kein Regelwerk hinterlegt.</strong><span>Für dieses Jahr dürfen keine automatischen steuerlichen Aussagen getroffen werden.</span></div>';

  const caseForm=taxCase?`<form class="card card-padding" id="tax-case-settings" data-form="tax-case-settings">
    <div class="card-heading"><div><h3 class="card-title">Steuerfall ${year}</h3><p class="card-subtitle">CH · St.Gallen · versioniert pro Steuerjahr</p></div>${ruleStatus(rule)}</div>
    <input type="hidden" name="taxYear" value="${year}">
    <div class="form-grid form-grid--2">
      <label class="field"><span>Land</span><input class="text-control" value="Schweiz" disabled></label>
      <label class="field"><span>Kanton</span><input class="text-control" value="SG · St.Gallen" disabled></label>
      <label class="field"><span>Gemeinde per 31.12.</span><input class="text-control" name="municipality" value="${escapeHtml(taxCase.municipality||'')}" placeholder="z. B. St. Gallen"></label>
      <label class="field"><span>Status</span><select class="text-control" name="status">${Object.entries(CASE_STATUS).map(([key,label])=>`<option value="${key}" ${taxCase.status===key?'selected':''}>${label}</option>`).join('')}</select></label>
      <label class="field"><span>Steuerpflicht von</span><input class="text-control" type="date" name="taxPeriodFrom" value="${escapeHtml(taxCase.tax_period_from||`${year}-01-01`)}"></label>
      <label class="field"><span>Steuerpflicht bis</span><input class="text-control" type="date" name="taxPeriodTo" value="${escapeHtml(taxCase.tax_period_to||`${year}-12-31`)}"></label>
      <label class="field"><span>Zivilstand</span><input class="text-control" name="maritalStatus" value="${escapeHtml(taxCase.marital_status||'')}"></label>
      <label class="field"><span>Konfession</span><input class="text-control" name="denomination" value="${escapeHtml(taxCase.denomination||'')}"></label>
      <label class="field"><span>Register-Nr.</span><input class="text-control" name="registryNumber" value="${escapeHtml(taxCase.registry_number||'')}"></label>
      <label class="field"><span>Steuerberater</span><input class="text-control" name="taxAdvisor" value="${escapeHtml(taxCase.tax_advisor||'')}"></label>
      <label class="field"><span>Erwartete Steuer</span><input class="text-control" type="number" step="0.01" min="0" name="expectedTaxAmount" value="${taxCase.expected_tax_amount??''}"></label>
      <label class="field"><span>Definitiv veranlagt</span><input class="text-control" type="number" step="0.01" min="0" name="assessedTaxAmount" value="${taxCase.assessed_tax_amount??''}"></label>
      <label class="field form-grid-span"><span>Notizen</span><textarea class="text-control" name="notes" rows="2">${escapeHtml(taxCase.notes||'')}</textarea></label>
    </div>
    ${canWrite?'<div class="form-actions"><button class="action-button action-button--primary" type="submit">Steuerfall speichern</button></div>':''}
  </form>`:`<article class="card card-padding"><div class="card-heading"><div><h3 class="card-title">Steuerfall ${year}</h3><p class="card-subtitle">Noch nicht angelegt. Der Jahresstatus bleibt trotzdem in der Übersicht sichtbar.</p></div>${ruleStatus(rule)}</div>${canWrite?`<button class="action-button action-button--primary" type="button" data-action="tax-case-create" data-year="${year}">${icon('plus')} Steuerfall ${year} anlegen</button>`:''}</article>`;

  return `
    ${pageHeader({title:'Tax Center · St.Gallen',subtitle:'Steuerdossier statt einfacher Abzugsliste: Jahre, Personen, Einkommen, Vermögen, Schulden, Belege und Steuerkonto in einer Ansicht.',actions:`<button class="action-button action-button--primary" type="button" data-action="tax-export-csv" data-year="${year}">${icon('arrow-down-left')} Steuerdossier ${year} exportieren (CSV)</button>`})}
    <input id="taxReceiptInput" type="file" accept="image/*,application/pdf" capture="environment" hidden>
    <input id="taxItemDocumentInput" type="file" accept="image/*,application/pdf,.csv,.xlsx,.xls" capture="environment" hidden>

    <article class="card card-padding"><div class="card-heading"><div><h3 class="card-title">Steuerkonto 2025–2027</h3><p class="card-subtitle">Was ist offen, was wurde bezahlt und welcher Regelstand gilt?</p></div></div><div class="metric-grid">${yearCards}</div></article>

    <div style="margin-top:16px">${ruleAlert}</div>
    <div style="margin-top:16px">${caseForm}</div>

    <div class="metric-grid" style="margin-top:16px">
      ${metricCard('Vollständigkeit',`${completeness}%`,`${completeSections} von ${TAX_SECTIONS.length} Bereichen abgeschlossen`,completeness===100?'positive':completeness>=60?'warning':'')}
      ${metricCard('Steuerrelevante Einnahmen',money(taxIncome,{currency:baseCurrency,locale}),`${taxTransactions.filter((tx)=>effectiveTaxTreatment(tx)==='income').length} ${t('Buchungen')} · ${t(fxLabel(fxRates,baseCurrency))}`,'positive')}
      ${metricCard('Steuerrelevante Ausgaben',money(taxExpense,{currency:baseCurrency,locale}),`${taxTransactions.filter((tx)=>effectiveTaxTreatment(tx)==='deduction').length} ${t('Buchungen')} · ${t('ohne Schuldentilgung')}`,'warning')}
      ${metricCard('Steuerkonto',money(selectedLedger.paid,{currency:taxCase?.currency||'CHF',locale}),selectedLedger.known?`${t('noch offen')} ${money(selectedLedger.open,{currency:taxCase?.currency||'CHF',locale})} · ${taxAccountMovementCount} ${t('Bankbewegungen')}`:'offener Betrag noch nicht hinterlegt',selectedLedger.known&&selectedLedger.open<=0.005?'positive':'warning')}
      ${metricCard('Belege',String(taxDocuments.length),missingReceipts.length?`${missingReceipts.length} fehlen`:'aktuell vollständig',missingReceipts.length?'warning':'positive')}
    </div>

    <article class="card card-padding" style="margin-top:16px"><div class="card-heading"><div><h3 class="card-title">Steuer-Check ${year}</h3><p class="card-subtitle">Automatische Vollständigkeitsprüfung. Hinweise sind keine verbindliche steuerliche Beurteilung.</p></div></div><div class="stack">${checkHtml}</div></article>

    <article class="card card-padding" style="margin-top:16px"><div class="card-heading"><div><h3 class="card-title">Steuerdossier ${year}</h3><p class="card-subtitle">Aufbau entlang der SG-Deklaration und der eTax-Logik.</p></div></div><div class="stack">${sectionCards}</div></article>

    ${taxCase?`
    <article class="card card-padding" style="margin-top:16px"><div class="card-heading"><div><h3 class="card-title">Personen & Haushalt</h3><p class="card-subtitle">Steuerdomizil, Personalien, Partner und Kinder getrennt vom allgemeinen Haushaltsprofil.</p></div></div>
      <div class="grid-main-aside">${personForm(1)}${personForm(2)}</div>
      <div style="margin-top:14px">${dataTable({headers:['Rolle','Person','Geburtsdatum','Beruf / Arbeitgeber',''],rows:personRows,emptyText:'Noch keine Steuerpersonen erfasst.'})}</div>
      <div class="grid-main-aside" style="margin-top:14px">
        <form class="card card-padding" id="tax-child-create" data-form="tax-child-create"><input type="hidden" name="taxCaseId" value="${taxCase.id}">
          <div class="card-heading"><div><h3 class="card-title">Kind erfassen</h3><p class="card-subtitle">Kinder- und Ausbildungsdaten mit steuerlicher Zuordnung.</p></div></div>
          <div class="form-grid form-grid--2">
            <label class="field"><span>Vorname</span><input class="text-control" name="firstName" required></label>
            <label class="field"><span>Nachname</span><input class="text-control" name="lastName" required></label>
            <label class="field"><span>Geburtsdatum</span><input class="text-control" type="date" name="birthDate" required></label>
            <label class="field"><span>Wohnort</span><input class="text-control" name="residenceCity"></label>
            <label class="field"><span>Land</span><input class="text-control" name="residenceCountry" value="CH"></label>
            <label class="field"><span>Ausbildung</span><select class="text-control" name="educationStatus"><option value="none">Keine</option><option value="preschool">Vorschule</option><option value="school">Schule</option><option value="vocational">Berufslehre</option><option value="higher">Höhere Ausbildung</option><option value="other">Andere</option></select></label>
            <label class="field"><span>Schule / Lehrfirma</span><input class="text-control" name="schoolOrTraining"></label>
            <label class="field"><span>Ausbildung bis</span><input class="text-control" type="date" name="trainingEnd"></label>
            <label class="field"><span>Obhut</span><input class="text-control" name="custody"></label>
            <label class="field"><span>Sorgerecht</span><input class="text-control" name="parentalAuthority"></label>
            <label class="field"><span>Unterhalt bezahlt</span><input class="text-control" type="number" step="0.01" min="0" name="maintenancePaid" value="0"></label>
            <label class="field"><span>Unterhalt erhalten</span><input class="text-control" type="number" step="0.01" min="0" name="maintenanceReceived" value="0"></label>
            <label class="field"><span>Drittbetreuung</span><input class="text-control" type="number" step="0.01" min="0" name="childcareCosts" value="0"></label>
            <label class="field"><span>Vermögen Kind</span><input class="text-control" type="number" step="0.01" min="0" name="assetsValue" value="0"></label>
            <label class="field"><span>Zuordnung</span><select class="text-control" name="assignmentStatus"><option value="review">Prüfen</option><option value="confirmed">Bestätigt</option><option value="unresolved">Steuerliche Zuordnung ungeklärt</option></select></label>
            <input type="hidden" name="currency" value="CHF">
            <label class="field form-grid-span"><span>Notizen</span><textarea class="text-control" name="notes" rows="2"></textarea></label>
          </div>
          ${canWrite?'<div class="form-actions"><button class="action-button action-button--primary" type="submit">Kind speichern</button></div>':''}
        </form>
        <article class="card card-padding"><div class="card-heading"><div><h3 class="card-title">Kinder im Steuerfall</h3></div></div>${dataTable({headers:['Kind','Geburt','Ausbildung','Drittbetreuung',''],rows:childRows,emptyText:'Noch keine Kinder erfasst.'})}</article>
      </div>
    </article>

    <article class="card card-padding" style="margin-top:16px"><div class="card-heading"><div><h3 class="card-title">Arbeit & Berufskosten</h3><p class="card-subtitle">Arbeitstage werden von Homeoffice, Ferien, Krankheit und Aussendienst getrennt, damit Pendeltage nicht blind geschätzt werden.</p></div></div>
      <div class="grid-main-aside">
        <form class="card card-padding" id="tax-employment-create" data-form="tax-employment-create"><input type="hidden" name="taxCaseId" value="${taxCase.id}">
          <div class="form-grid form-grid--2">
            <label class="field"><span>Person</span><select class="text-control" name="taxPersonId"><option value="">—</option>${selectedPeople.map((p)=>`<option value="${p.id}">Person ${p.person_no} · ${escapeHtml(p.first_name)} ${escapeHtml(p.last_name)}</option>`).join('')}</select></label>
            <label class="field"><span>Arbeitgeber</span><input class="text-control" name="employerName" required></label>
            <label class="field"><span>Arbeitsort</span><input class="text-control" name="workLocation"></label>
            <label class="field"><span>Verkehrsmittel</span><input class="text-control" name="transportMode" placeholder="ÖV / Auto / Fahrrad"></label>
            <label class="field"><span>Von</span><input class="text-control" type="date" name="periodFrom" value="${year}-01-01"></label>
            <label class="field"><span>Bis</span><input class="text-control" type="date" name="periodTo" value="${year}-12-31"></label>
            <label class="field"><span>Bruttolohn</span><input class="text-control" type="number" step="0.01" name="grossIncome"></label>
            <label class="field"><span>Nettolohn</span><input class="text-control" type="number" step="0.01" name="netIncome"></label>
            <label class="field"><span>Quellensteuer</span><input class="text-control" type="number" step="0.01" min="0" name="withholdingTax" value="0"></label>
            <label class="field"><span>Bonus</span><input class="text-control" type="number" step="0.01" min="0" name="bonus" value="0"></label>
            <label class="field"><span>Provisionen</span><input class="text-control" type="number" step="0.01" min="0" name="commission" value="0"></label>
            <label class="field"><span>VR-/Sitzungsgelder</span><input class="text-control" type="number" step="0.01" min="0" name="boardFees" value="0"></label>
            <label class="field"><span>Arbeitstage</span><input class="text-control" type="number" min="0" name="workDays" value="220"></label>
            <label class="field"><span>Homeoffice-Tage</span><input class="text-control" type="number" min="0" name="homeofficeDays" value="0"></label>
            <label class="field"><span>Ferientage</span><input class="text-control" type="number" min="0" name="vacationDays" value="0"></label>
            <label class="field"><span>Krankheitstage</span><input class="text-control" type="number" min="0" name="sickDays" value="0"></label>
            <label class="field"><span>Aussendiensttage</span><input class="text-control" type="number" min="0" name="fieldServiceDays" value="0"></label>
            <label class="field"><span>Distanz einfach (km)</span><input class="text-control" type="number" step="0.1" min="0" name="commutingDistanceKm" value="0"></label>
            <label class="field"><span>Verbilligte Verpflegung</span><select class="text-control" name="subsidizedMeals"><option value="">Unbekannt</option><option value="false">Nein</option><option value="true">Ja</option></select></label>
            <label class="field"><span>Wochenaufenthalter</span><select class="text-control" name="weeklyResident"><option value="false">Nein</option><option value="true">Ja</option></select></label>
            <label class="field"><span>Unterkunft</span><input class="text-control" type="number" step="0.01" min="0" name="lodgingCost" value="0"></label>
            <label class="field"><span>Heimfahrten</span><input class="text-control" type="number" step="0.01" min="0" name="homeTripCost" value="0"></label>
            <label class="field"><span>Weiterbildung</span><input class="text-control" type="number" step="0.01" min="0" name="continuingEducationCost" value="0"></label>
            <label class="field"><span>Arbeitgeberanteil</span><input class="text-control" type="number" step="0.01" min="0" name="employerContribution" value="0"></label>
            <label class="field"><span>Arbeitsmittel</span><input class="text-control" type="number" step="0.01" min="0" name="workEquipmentCost" value="0"></label>
            <input type="hidden" name="currency" value="CHF">
            <label class="field form-grid-span"><span>Notizen</span><textarea class="text-control" name="notes" rows="2"></textarea></label>
          </div>
          ${canWrite?'<div class="form-actions"><button class="action-button action-button--primary" type="submit">Arbeitsstelle speichern</button></div>':''}
        </form>
        <article class="card card-padding"><div class="card-heading"><div><h3 class="card-title">Arbeitsstellen ${year}</h3><p class="card-subtitle">Pendeltage = Arbeitstage minus Homeoffice, Ferien, Krankheit und Aussendienst.</p></div></div>${dataTable({headers:['Arbeitgeber','Zeitraum','Brutto','Pendeltage','Distanz',''],rows:employmentRows,emptyText:'Noch keine Arbeitsstelle erfasst.'})}</article>
      </div>
    </article>

    <div class="grid-main-aside" style="margin-top:16px">
      <form class="card card-padding" id="tax-item-create" data-form="tax-item-create">
        <div class="card-heading"><div><h3 class="card-title">Steuerposition erfassen</h3><p class="card-subtitle">Tax-spezifische Ergänzung; bestehende Finance-Daten werden referenziert statt dupliziert.</p></div></div>
        <input type="hidden" name="taxCaseId" value="${taxCase.id}">
        <div class="form-grid form-grid--2">
          <label class="field"><span>Bereich</span><select class="text-control" name="sectionKey" required>${TAX_SECTIONS.map((s)=>`<option value="${s.key}">${escapeHtml(s.label)}</option>`).join('')}</select></label>
          <label class="field"><span>Typ</span><select class="text-control" name="itemType"><option value="manual">Allgemein</option><option value="salary_certificate">Lohnausweis</option><option value="account_snapshot">Kontostand 31.12.</option><option value="security_snapshot">Wertschrift 31.12.</option><option value="crypto_snapshot">Krypto 31.12.</option><option value="debt_snapshot">Schuld 31.12.</option><option value="medical_cost">Krankheitskosten</option><option value="child">Kind / Ausbildung</option><option value="donation">Spende</option><option value="property">Liegenschaft</option><option value="vehicle_snapshot">Fahrzeug 31.12.</option><option value="inheritance_gift">Erbschaft / Schenkung</option><option value="foreign_item">Ausland</option></select></label>
          <label class="field form-grid-span"><span>Finance-Quelle</span><select class="text-control" name="sourceRef"><option value="">— keine / manuell —</option>${sourceOptions.map((option)=>`<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`).join('')}</select><small>Verknüpft die Steuerposition mit dem bestehenden Finance-Objekt statt es zu duplizieren.</small></label>
          <label class="field form-grid-span"><span>Bezeichnung</span><input class="text-control" name="title" required placeholder="z. B. UBS Saldo 31.12."></label>
          <label class="field"><span>Person</span><input class="text-control" name="personLabel" placeholder="optional"></label>
          <label class="field"><span>Land</span><input class="text-control" name="countryCode" value="CH" maxlength="2"></label>
          <label class="field"><span>Kanton</span><input class="text-control" name="cantonCode" value="SG" maxlength="2"></label>
          <label class="field"><span>Datum / Stichtag</span><input class="text-control" type="date" name="occurredOn" value="${year}-12-31"></label>
          <label class="field"><span>Betrag</span><input class="text-control" type="number" step="0.01" name="amount"></label>
          <label class="field"><span>Brutto</span><input class="text-control" type="number" step="0.01" name="grossAmount"></label>
          <label class="field"><span>Erstattung</span><input class="text-control" type="number" step="0.01" min="0" name="reimbursementAmount" value="0"></label>
          <label class="field"><span>Abziehbarer Betrag</span><input class="text-control" type="number" step="0.01" min="0" name="deductibleAmount"></label>
          <label class="field"><span>Abziehbar %</span><input class="text-control" type="number" step="0.01" min="0" max="100" name="deductiblePercentage"></label>
          <label class="field"><span>Währung</span><input class="text-control" name="currency" value="CHF"></label>
          <label class="field"><span>Prüfstatus</span><select class="text-control" name="verificationStatus"><option value="unverified">Ungeprüft</option><option value="needs_document">Beleg fehlt</option><option value="review">Prüfen</option><option value="verified">Bestätigt</option><option value="advisor_review">Steuerberater prüfen</option></select></label>
          <label class="field form-grid-span"><span>Steuerberater-Notiz</span><textarea class="text-control" name="advisorNote" rows="2"></textarea></label>
          <label class="field form-grid-span"><span>Interne Notiz</span><textarea class="text-control" name="notes" rows="2"></textarea></label>
        </div>
        ${canWrite?'<div class="form-actions"><button class="action-button action-button--primary" type="submit">Steuerposition speichern</button></div>':''}
      </form>

      <article class="card card-padding"><div class="card-heading"><div><h3 class="card-title">Positionen im Dossier</h3><p class="card-subtitle">Manuelle Ergänzungen und steuerliche Stichtagswerte.</p></div></div>
        ${dataTable({headers:['Datum','Position','Brutto/Wert','Abziehbar','Status',''],rows:itemRows,emptyText:'Noch keine zusätzlichen Steuerpositionen erfasst.'})}
      </article>
    </div>

    <article class="card card-padding" style="margin-top:16px"><div class="card-heading"><div><h3 class="card-title">Steuerkonto ${year}</h3><p class="card-subtitle">Provisorische Rechnungen, Raten, definitive Veranlagung, Zahlungen und Rückerstattungen.</p></div></div>
      <div class="metric-grid">
        ${metricCard('Soll / Rechnungen',selectedLedger.known?money(selectedLedger.due,{currency:taxCase.currency,locale}):'—','provisorisch oder definitiv')}
        ${metricCard('Bezahlt',money(selectedLedger.paid,{currency:taxCase.currency,locale}),selectedLedger.refunds? `Rückerstattungen ${money(selectedLedger.refunds,{currency:taxCase.currency,locale})}`:'keine Rückerstattung')}
        ${metricCard('Noch offen',selectedLedger.known?money(selectedLedger.open,{currency:taxCase.currency,locale}):'—',selectedLedger.known?'aus Soll minus Zahlungen':'Betrag noch nicht hinterlegt',selectedLedger.known&&selectedLedger.open<=0.005?'positive':'warning')}
      </div>
      <div class="grid-main-aside" style="margin-top:14px">
        <form class="card card-padding" id="tax-obligation-create" data-form="tax-obligation-create"><input type="hidden" name="taxCaseId" value="${taxCase.id}">
          <div class="card-heading"><div><h3 class="card-title">Steuerforderung / Rechnung</h3></div></div>
          <div class="form-grid"><label class="field"><span>Art</span><select class="text-control" name="obligationType"><option value="provisional">Provisorische Rechnung</option><option value="installment">Rate</option><option value="final_assessment">Definitive Veranlagung</option><option value="final_invoice">Schlussrechnung</option><option value="interest">Zins</option><option value="other">Sonstiges</option></select></label><label class="field"><span>Bezeichnung</span><input class="text-control" name="label" required></label><label class="field"><span>Betrag</span><input class="text-control" type="number" step="0.01" min="0" name="amount" required></label><label class="field"><span>Fällig</span><input class="text-control" type="date" name="dueDate"></label><label class="field"><span>Status</span><select class="text-control" name="status"><option value="open">Offen</option><option value="partial">Teilbezahlt</option><option value="paid">Bezahlt</option><option value="cancelled">Storniert</option></select></label><label class="field"><span>Referenz</span><input class="text-control" name="reference"></label><input type="hidden" name="currency" value="${escapeHtml(taxCase.currency||'CHF')}"></div>
          ${canWrite?'<div class="form-actions"><button class="action-button action-button--primary" type="submit">Forderung speichern</button></div>':''}
        </form>
        <form class="card card-padding" id="tax-payment-create" data-form="tax-payment-create"><input type="hidden" name="taxCaseId" value="${taxCase.id}">
          <div class="card-heading"><div><h3 class="card-title">Zahlung / Rückerstattung</h3></div></div>
          <div class="form-grid"><label class="field"><span>Art</span><select class="text-control" id="taxPaymentType" name="paymentType"><option value="payment">Zahlung</option><option value="refund">Rückerstattung</option><option value="interest_payment">Zinszahlung</option><option value="interest_credit">Zinsgutschrift</option></select></label><label class="field"><span>Zugehörige Rechnung</span><select class="text-control" name="obligationId"><option value="">— optional —</option>${selectedObligations.map((o)=>`<option value="${o.id}">${escapeHtml(o.label)} · ${money(o.amount,{currency:o.currency,locale})}</option>`).join('')}</select></label><label class="field"><span>Kontobuchung</span><select class="text-control" id="taxPaymentTransaction" name="transactionId"><option value="">— keine / manuell —</option>${taxPaymentCandidates.map((tx)=>`<option value="${tx.id}" data-amount="${Math.abs(num(tx.amount))}" data-type="${num(tx.amount)<0?'payment':'refund'}" data-date="${dateInputValue(new Date(tx.occurred_at))}">${escapeHtml(dateLabel(tx.occurred_at,locale))} · ${escapeHtml(tx.description)} · ${money(tx.amount,{currency:tx.currency,locale})}</option>`).join('')}</select><small>Optional mit einer bestehenden Bankbuchung verknüpfen.</small></label><label class="field"><span>Betrag</span><input class="text-control" id="taxPaymentAmount" type="number" step="0.01" min="0" name="amount" required></label><label class="field"><span>Bezahlt am</span><input class="text-control" id="taxPaymentDate" type="date" name="paidAt" value="${dateInputValue()}" required></label><label class="field"><span>Referenz</span><input class="text-control" name="reference"></label><input type="hidden" name="currency" value="${escapeHtml(taxCase.currency||'CHF')}"></div>
          ${canWrite?'<div class="form-actions"><button class="action-button action-button--primary" type="submit">Zahlung speichern</button></div>':''}
        </form>
      </div>
      <div class="grid-main-aside" style="margin-top:14px">
        <article><h3 class="card-title">Forderungen / Rechnungen</h3>${dataTable({headers:['Fällig','Position','Betrag','Status',''],rows:obligationRows,emptyText:'Noch keine Steuerforderungen erfasst.'})}</article>
        <article><h3 class="card-title">Zahlungen</h3>${dataTable({headers:['Datum','Art','Betrag',''],rows:paymentRows,emptyText:'Noch keine Steuerzahlungen erfasst.'})}</article>
      </div>
    </article>`:''}

    <article class="card card-padding" style="margin-top:16px"><div class="card-heading"><div><h3 class="card-title">Steuerrelevante Buchungen ${year}</h3><p class="card-subtitle">Bestehende Finance-Buchungen werden referenziert. Belege können direkt per Foto oder PDF verknüpft werden.</p></div></div>${dataTable({headers:['Datum / Steuerjahr','Buchung / Steuerzuordnung','Betrag','Beleg',''],rows:transactionRows,emptyText:'Noch keine steuerrelevanten Buchungen markiert.'})}</article>

    <article class="card card-padding" style="margin-top:16px"><div class="card-heading"><div><h3 class="card-title">Offizielle Referenzen</h3><p class="card-subtitle">Kanton St.Gallen · Regeln werden pro Steuerjahr versioniert.</p></div></div><div class="stack compact-copy">
      <p><a class="card-link" href="https://www.sg.ch/steuern-finanzen/steuern/formulare-wegleitungen/einkommens-vermoegenssteuer-privatpersonen.html" target="_blank" rel="noreferrer">SG Formulare & Wegleitungen</a> · offizielle Unterlagen je Steuerperiode.</p>
      <p><a class="card-link" href="https://www.sg.ch/steuern-finanzen/steuern/kryptowaehrungen.html" target="_blank" rel="noreferrer">SG Kryptowährungen</a> · kantonale Hinweise zur Deklaration.</p>
      <p><a class="card-link" href="https://www.sg.ch/steuern-finanzen/steuern/steuerkalkulator/privatperson.html" target="_blank" rel="noreferrer">SG Steuerkalkulator</a> · Einkommens- und Vermögenssteuer.</p>
    </div></article>
  `;
}
