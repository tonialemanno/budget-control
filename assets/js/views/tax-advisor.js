import { dataTable, metricCard, pageHeader, statusPill } from '../app/components.js';
import { dateInputValue, dateLabel, escapeHtml, money } from '../app/format.js';
import { fxLabel } from '../app/fx.js';
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
function caseForYear(cases,year){ return (cases||[]).find((row)=>Number(row.tax_year)===Number(year)&&row.country_code==='CH'&&row.canton_code==='SG')||null; }
function ruleForYear(rules,year){ return (rules||[]).find((row)=>row.country_code==='CH'&&row.canton_code==='SG'&&Number(row.tax_year)===Number(year))||null; }

function taxLedgerSummary(taxCase,obligations,payments){
  if(!taxCase) return {paid:0,refunds:0,due:0,open:0,known:false};
  const caseObligations=(obligations||[]).filter((row)=>row.tax_case_id===taxCase.id&&row.status!=='cancelled');
  const casePayments=(payments||[]).filter((row)=>row.tax_case_id===taxCase.id);
  const obligationsTotal=caseObligations.reduce((sum,row)=>sum+num(row.amount),0);
  const paid=casePayments.filter((row)=>['payment','interest_payment'].includes(row.payment_type)).reduce((sum,row)=>sum+num(row.amount),0);
  const refunds=casePayments.filter((row)=>['refund','interest_credit'].includes(row.payment_type)).reduce((sum,row)=>sum+num(row.amount),0);
  const fallback=num(taxCase.assessed_tax_amount)||num(taxCase.expected_tax_amount);
  const due=obligationsTotal>0?obligationsTotal:fallback;
  const known=obligationsTotal>0||taxCase.assessed_tax_amount!==null&&taxCase.assessed_tax_amount!==undefined||taxCase.expected_tax_amount!==null&&taxCase.expected_tax_amount!==undefined;
  return {paid,refunds,due,open:Math.max(0,due-paid+refunds),known};
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

function taxChecks({year,taxCase,rule,accounts,transactions,documents,pensions,debts,receivables,investments,properties,vehicles,taxItems}){
  const checks=[];
  const docs=(documents||[]).filter((d)=>d.tax_relevant&&Number(d.tax_year||new Date(d.document_date||d.created_at).getFullYear())===year);
  const items=(taxItems||[]).filter((i)=>i.tax_case_id===taxCase?.id);
  const sourceKeys=new Set(items.filter((i)=>i.source_type&&i.source_id).map((i)=>`${i.source_type}:${i.source_id}`));
  const docText=docs.map((d)=>`${d.name||''} ${d.tax_category||''}`.toLowerCase()).join(' | ');
  const taxTransactions=(transactions||[]).filter((tx)=>tx.tax_relevant&&new Date(tx.occurred_at).getFullYear()===year);

  if(!taxCase) checks.push({level:'warning',text:`Steuerfall ${year} ist noch nicht angelegt.`});
  if(rule?.status==='partial') checks.push({level:'warning',text:`Regelversion ${rule.version} ist als teilweise veröffentlicht markiert. Betragslimiten nicht automatisch als definitiv behandeln.`});
  if(rule?.status==='pending') checks.push({level:'warning',text:`Regelversion ${rule.version} ist noch ausstehend. Keine automatischen Abzüge versprechen.`});

  const accountSnapshots=items.filter((i)=>i.item_type==='account_snapshot');
  if((accounts||[]).length&&accountSnapshots.length<(accounts||[]).length) checks.push({level:'warning',text:`31.12.-Salden: ${accountSnapshots.length} von ${accounts.length} Konten im Steuerdossier dokumentiert.`});

  const salaryTx=(transactions||[]).filter((tx)=>new Date(tx.occurred_at).getFullYear()===year&&num(tx.amount)>0&&(/lohn|salary|gehalt/i.test(`${tx.description||''} ${tx.counterparty||''}`)||tx.categories?.name==='Lohn'));
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
  investments = [], properties = [], vehicles = [], household, profile, fxRates, taxYear, canWrite=false,
  taxRuleVersions = [], taxCases = [], taxCaseSections = [], taxItems = [], taxObligations = [], taxPayments = [],
} = {}) {
  const baseCurrency=household?.base_currency||'CHF';
  const locale=profile?.locale||'de-CH';
  const year=Number(taxYear)||2026;
  const taxCase=caseForYear(taxCases,year);
  const rule=taxCase?.tax_rule_versions||ruleForYear(taxRuleVersions,year);
  const yearRules=new Map(TAX_YEARS.map((y)=>[y,ruleForYear(taxRuleVersions,y)]));
  const yearCards=TAX_YEARS.map((y)=>{
    const c=caseForYear(taxCases,y);
    return yearCard({year:y,taxCase:c,rule:c?.tax_rule_versions||yearRules.get(y),summary:taxLedgerSummary(c,taxObligations,taxPayments),selected:y===year,locale});
  }).join('');

  const taxTransactions=transactions.filter((tx)=>tx.tax_relevant&&new Date(tx.occurred_at).getFullYear()===year);
  const taxDocuments=documents.filter((doc)=>doc.tax_relevant&&Number(doc.tax_year||new Date(doc.document_date||doc.created_at).getFullYear())===year);
  const receiptByTx=new Map();
  for(const doc of documents.filter((d)=>d.object_type==='transaction'&&d.object_id)){
    const list=receiptByTx.get(doc.object_id)||[]; list.push(doc); receiptByTx.set(doc.object_id,list);
  }
  const paymentMap=buildDebtPaymentTransactionMap(debtPayments);
  const markedExpense=taxTransactions.reduce((sum,tx)=>sum+consumptionExpenseBase(tx,paymentMap,baseCurrency,fxRates),0);
  const missingReceipts=taxTransactions.filter((tx)=>!receiptByTx.has(tx.id));

  const sectionRows=new Map((taxCaseSections||[]).filter((row)=>row.tax_case_id===taxCase?.id).map((row)=>[row.section_key,row]));
  const caseItems=(taxItems||[]).filter((row)=>row.tax_case_id===taxCase?.id);
  const completeSections=TAX_SECTIONS.filter((section)=>['complete','not_applicable'].includes(sectionRows.get(section.key)?.status)).length;
  const completeness=Math.round((completeSections/TAX_SECTIONS.length)*100);
  const selectedLedger=taxLedgerSummary(taxCase,taxObligations,taxPayments);
  const selectedObligations=(taxObligations||[]).filter((row)=>row.tax_case_id===taxCase?.id);
  const selectedPayments=(taxPayments||[]).filter((row)=>row.tax_case_id===taxCase?.id);
  const checks=taxChecks({year,taxCase,rule,accounts,transactions,documents,pensions,debts,receivables,investments,properties,vehicles,taxItems});

  const transactionRows=taxTransactions.map((tx)=>{
    const receipts=receiptByTx.get(tx.id)||[];
    const payment=paymentMap.get(tx.id);
    const displayedAmount=payment?-(num(payment.interest_amount)+num(payment.fee_amount)):num(tx.amount);
    const amountNote=payment?'<div class="table-meta">nur Zins & Gebühren</div>':'';
    return `<tr><td>${dateLabel(tx.occurred_at,locale)}</td><td><strong>${escapeHtml(tx.description)}</strong><div class="table-meta">${escapeHtml(tx.tax_category||tx.categories?.name||'Nicht spezifiziert')}</div></td><td>${money(displayedAmount,{currency:tx.currency,locale})}${amountNote}</td><td>${receipts.length?statusPill('active',`${receipts.length} Beleg${receipts.length===1?'':'e'}`):statusPill('pending','Beleg fehlt')}</td><td><div class="table-actions">${canWrite?`<button class="table-action" type="button" data-action="tax-receipt" data-id="${tx.id}">${icon('plus')} Beleg</button><button class="table-action" type="button" data-action="transaction-tax-toggle" data-id="${tx.id}" data-value="false">Entfernen</button>`:''}</div></td></tr>`;
  });

  const itemRows=caseItems.map((item)=>`<tr>
    <td>${item.occurred_on?dateLabel(item.occurred_on,locale):'—'}</td>
    <td><strong>${escapeHtml(item.title)}</strong><div class="table-meta">${escapeHtml(TAX_SECTIONS.find((s)=>s.key===item.section_key)?.label||item.section_key)}${item.person_label?` · ${escapeHtml(item.person_label)}`:''}</div></td>
    <td>${item.gross_amount!==null&&item.gross_amount!==undefined?money(item.gross_amount,{currency:item.currency,locale}):item.amount!==null&&item.amount!==undefined?money(item.amount,{currency:item.currency,locale}):'—'}</td>
    <td>${item.deductible_amount!==null&&item.deductible_amount!==undefined?money(item.deductible_amount,{currency:item.currency,locale}):'—'}</td>
    <td>${statusPill(item.verification_status==='verified'?'active':item.verification_status==='review'||item.verification_status==='advisor_review'?'warning':'pending',item.verification_status)}</td>
    <td>${canWrite?`<button class="table-action table-action--danger" type="button" data-action="tax-item-delete" data-id="${item.id}">Löschen</button>`:''}</td>
  </tr>`);

  const obligationRows=selectedObligations.map((row)=>`<tr>
    <td>${row.due_date?dateLabel(row.due_date,locale):'—'}</td><td><strong>${escapeHtml(row.label)}</strong><div class="table-meta">${escapeHtml(row.obligation_type)}</div></td>
    <td>${money(row.amount,{currency:row.currency,locale})}</td><td>${statusPill(row.status==='paid'?'active':row.status==='partial'?'warning':'pending',row.status)}</td>
    <td>${canWrite?`<button class="table-action table-action--danger" type="button" data-action="tax-obligation-delete" data-id="${row.id}">Löschen</button>`:''}</td>
  </tr>`);
  const paymentRows=selectedPayments.map((row)=>`<tr>
    <td>${dateLabel(row.paid_at,locale)}</td><td><strong>${escapeHtml(row.payment_type)}</strong><div class="table-meta">${escapeHtml(row.reference||'')}</div></td>
    <td>${money(row.amount,{currency:row.currency,locale})}</td><td>${canWrite?`<button class="table-action table-action--danger" type="button" data-action="tax-payment-delete" data-id="${row.id}">Löschen</button>`:''}</td>
  </tr>`);

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
    ${pageHeader({title:'Tax Center · St.Gallen',subtitle:'Steuerdossier statt einfacher Abzugsliste: Jahre, Personen, Einkommen, Vermögen, Schulden, Belege und Steuerkonto in einer Ansicht.',actions:`<button class="action-button action-button--primary" type="button" data-action="tax-export-csv" data-year="${year}">${icon('arrow-down-left')} Steuerdaten ${year} exportieren</button>`})}
    <input id="taxReceiptInput" type="file" accept="image/*,application/pdf" capture="environment" hidden>

    <article class="card card-padding"><div class="card-heading"><div><h3 class="card-title">Steuerkonto 2025–2027</h3><p class="card-subtitle">Was ist offen, was wurde bezahlt und welcher Regelstand gilt?</p></div></div><div class="metric-grid">${yearCards}</div></article>

    <div style="margin-top:16px">${ruleAlert}</div>
    <div style="margin-top:16px">${caseForm}</div>

    <div class="metric-grid" style="margin-top:16px">
      ${metricCard('Vollständigkeit',`${completeness}%`,`${completeSections} von ${TAX_SECTIONS.length} Bereichen abgeschlossen`,completeness===100?'positive':completeness>=60?'warning':'')}
      ${metricCard('Steuerrelevante Buchungen',String(taxTransactions.length),`${money(markedExpense,{currency:baseCurrency,locale})} ${t('markierte Kosten')} · ${t(fxLabel(fxRates,baseCurrency))}`)}
      ${metricCard('Belege',String(taxDocuments.length),missingReceipts.length?`${missingReceipts.length} fehlen`:'aktuell vollständig',missingReceipts.length?'warning':'positive')}
      ${metricCard('Steuerkonto',money(selectedLedger.paid,{currency:taxCase?.currency||'CHF',locale}),selectedLedger.known?`noch offen ${money(selectedLedger.open,{currency:taxCase?.currency||'CHF',locale})}`:'offener Betrag noch nicht hinterlegt',selectedLedger.known&&selectedLedger.open<=0.005?'positive':'warning')}
    </div>

    <article class="card card-padding" style="margin-top:16px"><div class="card-heading"><div><h3 class="card-title">Steuer-Check ${year}</h3><p class="card-subtitle">Automatische Vollständigkeitsprüfung. Hinweise sind keine verbindliche steuerliche Beurteilung.</p></div></div><div class="stack">${checkHtml}</div></article>

    <article class="card card-padding" style="margin-top:16px"><div class="card-heading"><div><h3 class="card-title">Steuerdossier ${year}</h3><p class="card-subtitle">Aufbau entlang der SG-Deklaration und der eTax-Logik.</p></div></div><div class="stack">${sectionCards}</div></article>

    ${taxCase?`<div class="grid-main-aside" style="margin-top:16px">
      <form class="card card-padding" id="tax-item-create" data-form="tax-item-create">
        <div class="card-heading"><div><h3 class="card-title">Steuerposition erfassen</h3><p class="card-subtitle">Tax-spezifische Ergänzung; bestehende Finance-Daten werden referenziert statt dupliziert.</p></div></div>
        <input type="hidden" name="taxCaseId" value="${taxCase.id}">
        <div class="form-grid form-grid--2">
          <label class="field"><span>Bereich</span><select class="text-control" name="sectionKey" required>${TAX_SECTIONS.map((s)=>`<option value="${s.key}">${escapeHtml(s.label)}</option>`).join('')}</select></label>
          <label class="field"><span>Typ</span><select class="text-control" name="itemType"><option value="manual">Allgemein</option><option value="salary_certificate">Lohnausweis</option><option value="account_snapshot">Kontostand 31.12.</option><option value="security_snapshot">Wertschrift 31.12.</option><option value="crypto_snapshot">Krypto 31.12.</option><option value="debt_snapshot">Schuld 31.12.</option><option value="medical_cost">Krankheitskosten</option><option value="child">Kind / Ausbildung</option><option value="donation">Spende</option><option value="property">Liegenschaft</option><option value="vehicle_snapshot">Fahrzeug 31.12.</option><option value="inheritance_gift">Erbschaft / Schenkung</option><option value="foreign_item">Ausland</option></select></label>
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
          <div class="form-grid"><label class="field"><span>Art</span><select class="text-control" name="paymentType"><option value="payment">Zahlung</option><option value="refund">Rückerstattung</option><option value="interest_payment">Zinszahlung</option><option value="interest_credit">Zinsgutschrift</option></select></label><label class="field"><span>Zugehörige Rechnung</span><select class="text-control" name="obligationId"><option value="">— optional —</option>${selectedObligations.map((o)=>`<option value="${o.id}">${escapeHtml(o.label)} · ${money(o.amount,{currency:o.currency,locale})}</option>`).join('')}</select></label><label class="field"><span>Betrag</span><input class="text-control" type="number" step="0.01" min="0" name="amount" required></label><label class="field"><span>Bezahlt am</span><input class="text-control" type="date" name="paidAt" value="${dateInputValue()}" required></label><label class="field"><span>Referenz</span><input class="text-control" name="reference"></label><input type="hidden" name="currency" value="${escapeHtml(taxCase.currency||'CHF')}"></div>
          ${canWrite?'<div class="form-actions"><button class="action-button action-button--primary" type="submit">Zahlung speichern</button></div>':''}
        </form>
      </div>
      <div class="grid-main-aside" style="margin-top:14px">
        <article><h3 class="card-title">Forderungen / Rechnungen</h3>${dataTable({headers:['Fällig','Position','Betrag','Status',''],rows:obligationRows,emptyText:'Noch keine Steuerforderungen erfasst.'})}</article>
        <article><h3 class="card-title">Zahlungen</h3>${dataTable({headers:['Datum','Art','Betrag',''],rows:paymentRows,emptyText:'Noch keine Steuerzahlungen erfasst.'})}</article>
      </div>
    </article>`:''}

    <article class="card card-padding" style="margin-top:16px"><div class="card-heading"><div><h3 class="card-title">Steuerrelevante Buchungen ${year}</h3><p class="card-subtitle">Bestehende Finance-Buchungen werden referenziert. Belege können direkt per Foto oder PDF verknüpft werden.</p></div></div>${dataTable({headers:['Datum','Buchung','Betrag','Beleg',''],rows:transactionRows,emptyText:'Noch keine steuerrelevanten Buchungen markiert.'})}</article>

    <article class="card card-padding" style="margin-top:16px"><div class="card-heading"><div><h3 class="card-title">Offizielle Referenzen</h3><p class="card-subtitle">Kanton St.Gallen · Regeln werden pro Steuerjahr versioniert.</p></div></div><div class="stack compact-copy">
      <p><a class="card-link" href="https://www.sg.ch/steuern-finanzen/steuern/formulare-wegleitungen/einkommens-vermoegenssteuer-privatpersonen.html" target="_blank" rel="noreferrer">SG Formulare & Wegleitungen</a> · offizielle Unterlagen je Steuerperiode.</p>
      <p><a class="card-link" href="https://www.sg.ch/steuern-finanzen/steuern/kryptowaehrungen.html" target="_blank" rel="noreferrer">SG Kryptowährungen</a> · kantonale Hinweise zur Deklaration.</p>
      <p><a class="card-link" href="https://www.sg.ch/steuern-finanzen/steuern/steuerkalkulator/privatperson.html" target="_blank" rel="noreferrer">SG Steuerkalkulator</a> · Einkommens- und Vermögenssteuer.</p>
    </div></article>
  `;
}
