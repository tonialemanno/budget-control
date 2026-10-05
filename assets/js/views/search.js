import { pageHeader } from '../app/components.js';
import { dateLabel, escapeHtml, money } from '../app/format.js';
import { icon } from '../app/icons.js';

function includes(value,needle){ return String(value??'').toLowerCase().includes(needle); }
function amountSearch(value,needle){
  const raw=String(Math.abs(Number(value)||0));
  return raw.includes(needle.replace(/['\s]/g,'').replace(',','.'));
}
function dateSearch(value,needle){
  const iso=String(value||'').slice(0,10);
  const match=iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if(!match) return false;
  const forms=[iso,`${match[3]}.${match[2]}.${match[1]}`,`${match[3]}/${match[2]}/${match[1]}`];
  return forms.some((form)=>form.toLowerCase().includes(needle));
}

export function renderSearch({
  searchQuery='',transactions=[],accounts=[],categories=[],bills=[],contracts=[],documents=[],debts=[],receivables=[],transactionContexts=[],household,profile,
}={}){
  const locale=profile?.locale||'de-CH';
  const currency=household?.base_currency||'CHF';
  const needle=String(searchQuery||'').trim().toLowerCase();
  const accountById=new Map(accounts.map((a)=>[a.account_id||a.id,a]));
  const categoryById=new Map(categories.map((c)=>[c.id,c]));

  const txResults=!needle?[]:transactions.filter((tx)=>{
    const account=accountById.get(tx.account_id);
    const category=categoryById.get(tx.category_id);
    return [
      tx.description,tx.counterparty,tx.note,tx.merchants?.name,tx.counterparties?.name,
      tx.transaction_contexts?.name,account?.name,category?.name,tx.bank_reference,tx.counterparty_account_ref,
      tx.import_raw_data?JSON.stringify(tx.import_raw_data):'',
    ].some((value)=>includes(value,needle)) || dateSearch(tx.occurred_at,needle) || amountSearch(tx.amount,needle);
  }).slice(0,60);

  const contexts=!needle?[]:transactionContexts.filter((row)=>includes(row.name,needle)).slice(0,20);
  const accountResults=!needle?[]:accounts.filter((row)=>includes(row.name,needle)||includes(row.institution_name,needle)||includes(row.external_account_ref,needle)).slice(0,20);
  const billResults=!needle?[]:bills.filter((row)=>[row.name,row.provider,row.reference].some((v)=>includes(v,needle))||dateSearch(row.due_date,needle)||amountSearch(row.amount,needle)).slice(0,20);
  const contractResults=!needle?[]:contracts.filter((row)=>[row.name,row.provider].some((v)=>includes(v,needle))||amountSearch(row.amount,needle)).slice(0,20);
  const debtResults=!needle?[]:debts.filter((row)=>[row.name,row.creditor,row.notes].some((v)=>includes(v,needle))||amountSearch(row.remaining_amount||row.original_amount,needle)).slice(0,20);
  const recResults=!needle?[]:receivables.filter((row)=>[row.debtor,row.reason,row.notes].some((v)=>includes(v,needle))||amountSearch(row.remaining_amount||row.original_amount,needle)).slice(0,20);
  const docResults=!needle?[]:documents.filter((row)=>[row.name,row.notes,row.document_type,row.tax_category].some((v)=>includes(v,needle))).slice(0,20);
  const total=txResults.length+contexts.length+accountResults.length+billResults.length+contractResults.length+debtResults.length+recResults.length+docResults.length;

  const txHtml=txResults.map((tx)=>`<button class="search-result-row" type="button" data-action="search-open-transaction" data-id="${tx.id}"><span class="search-result-icon">${icon('list')}</span><span><strong>${escapeHtml(tx.description||tx.counterparty||'Buchung')}</strong><small>${dateLabel(tx.occurred_at,locale)} · ${escapeHtml(accountById.get(tx.account_id)?.name||'Konto')} · ${escapeHtml(categoryById.get(tx.category_id)?.name||'Ohne Kategorie')}</small></span><b>${money(tx.amount,{currency:tx.currency||currency,locale,sign:Number(tx.amount)>0})}</b></button>`).join('');
  const simpleRows=(rows,{href,label,meta})=>rows.map((row)=>`<a class="search-result-row" href="${href}"><span class="search-result-icon">${icon('chevron-right')}</span><span><strong>${escapeHtml(label(row))}</strong><small>${escapeHtml(meta(row)||'')}</small></span></a>`).join('');

  return `
    ${pageHeader({title:'Suchen',subtitle:'Betrag, Datum, Person, Händler, Konto, Projekt, Rechnung oder Dokument – eine Suche über Finance.'})}
    <article class="card card-padding global-search-card">
      <label class="field"><span>Finance durchsuchen</span><div class="global-search-input-wrap">${icon('search')}<input class="text-control" id="globalSearchInput" type="search" autocomplete="off" value="${escapeHtml(searchQuery)}" placeholder="z. B. 180, Mamma, 20.05.2026, Italien, Scheidung"></div></label>
      <small>${needle?`${total} Treffer in den geladenen Finance-Daten`:'Tippe einen Begriff, Betrag oder ein Datum ein.'}</small>
    </article>
    ${needle?`
      <article class="card card-padding search-section"><div class="card-heading"><div><h3 class="card-title">Buchungen</h3><p class="card-subtitle">${txResults.length} Treffer</p></div></div><div class="search-result-list">${txHtml||'<div class="table-empty">Keine Buchungen.</div>'}</div></article>
      <div class="review-section-grid">
        <article class="card card-padding search-section"><h3 class="card-title">Konten & Projekte</h3><div class="search-result-list">${simpleRows(accountResults,{href:'#/accounts',label:r=>r.name,meta:r=>r.institution_name||r.currency})}${simpleRows(contexts,{href:'#/projects',label:r=>r.name,meta:r=>r.context_type||'Projekt'})||'<div class="table-empty">Keine Treffer.</div>'}</div></article>
        <article class="card card-padding search-section"><h3 class="card-title">Rechnungen & Verträge</h3><div class="search-result-list">${simpleRows(billResults,{href:'#/bills',label:r=>r.name,meta:r=>r.provider||r.reference||''})}${simpleRows(contractResults,{href:'#/bills',label:r=>r.name,meta:r=>r.provider||''})||'<div class="table-empty">Keine Treffer.</div>'}</div></article>
      </div>
      <div class="review-section-grid">
        <article class="card card-padding search-section"><h3 class="card-title">Schulden & Forderungen</h3><div class="search-result-list">${simpleRows(debtResults,{href:'#/debts',label:r=>r.name,meta:r=>r.creditor||''})}${simpleRows(recResults,{href:'#/receivables',label:r=>r.debtor,meta:r=>r.reason||''})||'<div class="table-empty">Keine Treffer.</div>'}</div></article>
        <article class="card card-padding search-section"><h3 class="card-title">Dokumente</h3><div class="search-result-list">${simpleRows(docResults,{href:'#/documents',label:r=>r.name,meta:r=>r.notes||r.document_type||''})||'<div class="table-empty">Keine Treffer.</div>'}</div></article>
      </div>`
    :''}
  `;
}
