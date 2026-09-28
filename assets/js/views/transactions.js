import { emptyState, formShell, metricCard, pageHeader } from '../app/components.js';
import { dateLabel, dateTimeLocalValue, escapeHtml, money } from '../app/format.js';
import { convertAmount, fxLabel } from '../app/fx.js';
import { icon } from '../app/icons.js';

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
    const iso=String(tx.occurred_at||'').slice(0,10);
    if(from&&iso<from) return false;
    if(to&&iso>to) return false;
    if(category==='uncategorized'&&tx.category_id) return false;
    if(category&&category!=='all'&&category!=='uncategorized'&&tx.category_id!==category) return false;
    if(account&&account!=='all'&&tx.account_id!==account) return false;
    if(needle&&!normalizedSearch(tx).includes(needle)) return false;
    return true;
  });
}
function cashSuggestion(tx,accounts){
  if(Number(tx.amount)>=0||tx.transfer_group_id) return null;
  const text=`${tx.description||''} ${tx.counterparty||''}`.toLowerCase();
  const cash=accounts.find((a)=>a.account_id!==tx.account_id&&a.currency===tx.currency&&a.account_type==='cash');
  const savings=accounts.find((a)=>a.account_id!==tx.account_id&&a.currency===tx.currency&&a.account_type==='savings');
  if(cash && /(bancomat|atm|bargeld|cash|barbezug|withdraw|geldautomat)/i.test(text)) return {account:cash,label:`War das für ${cash.name}?`};
  if(savings && /(spar|übertrag|uebertrag|transfer|umbuch|eigenes konto)/i.test(text)) return {account:savings,label:`War das Sparen auf ${savings.name}?`};
  return null;
}
function txRow(tx,{locale,canWrite,accounts,canTax}){
  const positive=Number(tx.amount)>=0; const transfer=Boolean(tx.transfer_group_id); const suggestion=cashSuggestion(tx,accounts);
  const isTwint=/twint/i.test(`${tx.description||''} ${tx.counterparty||''}`);
  return `<div class="list-row transaction-row"><div class="list-row-main"><span class="list-row-leading ${positive?'list-row-leading--green':''}">${icon(transfer?'repeat':positive?'arrow-down-left':'arrow-up-right')}</span><div><div class="list-row-title">${escapeHtml(tx.description)}</div><div class="list-row-meta">${escapeHtml(tx.categories?.name||(transfer?'Umbuchung':'Ohne Kategorie'))} · ${escapeHtml(tx.merchants?.name||tx.counterparty||'')} ${tx.merchants?.name||tx.counterparty?'· ':''}${escapeHtml(tx.accounts?.name||'')} · ${dateLabel(tx.occurred_at,locale)}${tx.note?` · ${escapeHtml(tx.note)}`:''}</div>${suggestion&&canWrite?`<div class="transaction-suggestion"><span>${escapeHtml(suggestion.label)}</span><button class="table-action" type="button" data-action="transaction-to-transfer" data-id="${tx.id}" data-to-account="${suggestion.account.account_id}">Ja, als Umbuchung</button></div>`:''}${isTwint&&!tx.note&&canWrite?`<div class="transaction-suggestion"><span>TWINT-Zahlung: Wofür war sie?</span><button class="table-action" type="button" data-action="transaction-note" data-id="${tx.id}">Zweck ergänzen</button></div>`:''}</div></div><div class="list-row-trailing"><div class="amount ${positive?'amount--positive':'amount--negative'}">${money(tx.amount,{sign:positive,currency:tx.currency,locale})}</div>${canWrite?`<div class="row-actions">${transfer?'':`<button class="table-action" type="button" data-action="transaction-edit" data-id="${tx.id}">Bearbeiten</button><button class="table-action" type="button" data-action="transaction-make-recurring" data-id="${tx.id}">Wiederkehrend</button>${canTax?`<button class="table-action" type="button" data-action="transaction-tax-toggle" data-id="${tx.id}" data-value="${tx.tax_relevant?'false':'true'}">${tx.tax_relevant?'Steuer ✓':'Steuer'}</button>`:''}`}<button class="table-action table-action--danger" type="button" data-action="transaction-delete" data-id="${tx.id}">${transfer?'Umbuchung löschen':'Löschen'}</button></div>`:''}</div></div>`;
}

export function renderTransactions({
  accounts = [], categories = [], transactions = [], household, profile, canWrite = false, fxRates,
  transactionView='summary', transactionPeriod='month', transactionQuery='', transactionCategory='all', transactionAccount='all',
  transactionFrom='', transactionTo='', transactionPage=1, moduleAccess = {}, hiddenModules = [],
} = {}) {
  const baseCurrency = household?.base_currency || 'CHF';
  const canTax = moduleAccess?.tax === true && !hiddenModules.includes('tax');
  const locale = profile?.locale || 'de-CH';
  const rows=filterTransactions(transactions,{period:transactionPeriod,from:transactionFrom,to:transactionTo,query:transactionQuery,category:transactionCategory,account:transactionAccount});
  const spendRows=rows.filter((tx)=>Number(tx.amount)<0&&!tx.transfer_group_id);
  const income=rows.filter((tx)=>Number(tx.amount)>0&&!tx.transfer_group_id).reduce((s,tx)=>s+(convertAmount(tx.amount,tx.currency,baseCurrency,fxRates)??0),0);
  const expenses=spendRows.reduce((s,tx)=>s+Math.abs(convertAmount(tx.amount,tx.currency,baseCurrency,fxRates)??0),0);
  const savingsIds=new Set(accounts.filter((a)=>a.account_type==='savings').map((a)=>a.account_id));
  const savings=rows.filter((tx)=>tx.transfer_group_id&&Number(tx.amount)>0&&savingsIds.has(tx.account_id)).reduce((s,tx)=>s+(convertAmount(tx.amount,tx.currency,baseCurrency,fxRates)??0),0);
  const categoryOptions = categories.map((c)=>`<option value="${c.id}">${escapeHtml(c.name)} · ${c.kind==='income'?'Einnahme':'Ausgabe'}</option>`).join('');
  const accountOptions = accounts.map((a)=>`<option value="${a.account_id}">${escapeHtml(a.name)} · ${escapeHtml(a.currency)}</option>`).join('');

  const txFields = `<label class="field"><span>Typ</span><select class="text-control" name="direction"><option value="expense">Ausgabe</option><option value="income">Einnahme</option></select></label><label class="field"><span>Betrag</span><input class="text-control" name="amount" type="number" step="0.01" min="0.01" required></label><label class="field"><span>Konto</span><select class="text-control" name="accountId" required>${accountOptions}</select></label><label class="field"><span>Datum / Zeit</span><input class="text-control" name="occurredAt" type="datetime-local" required value="${dateTimeLocalValue()}"></label><label class="field form-grid-span"><span>Beschreibung</span><input class="text-control" name="description" required placeholder="z. B. Migros"></label><label class="field"><span>Kategorie</span><select class="text-control" name="categoryId"><option value="">Ohne Kategorie</option>${categoryOptions}</select></label><label class="field"><span>Gegenpartei</span><input class="text-control" name="counterparty" placeholder="optional"></label><label class="field form-grid-span"><span>Notiz / Zweck</span><textarea class="text-control" name="note" rows="3" placeholder="z. B. TWINT: Mittagessen"></textarea></label>${canTax?`<label class="field"><span>Steuerrelevant</span><select class="text-control" name="taxRelevant"><option value="false">Nein</option><option value="true">Ja</option></select></label><label class="field"><span>Steuerkategorie</span><input class="text-control" name="taxCategory" placeholder="z. B. Berufskosten"></label>`:''}`;
  const editFields = `<input type="hidden" name="transactionId" id="transactionEditId"><label class="field"><span>Typ</span><select class="text-control" name="direction" id="transactionEditDirection"><option value="expense">Ausgabe</option><option value="income">Einnahme</option></select></label><label class="field"><span>Betrag</span><input class="text-control" name="amount" id="transactionEditAmount" type="number" step="0.01" min="0.01" required></label><label class="field"><span>Konto</span><select class="text-control" name="accountId" id="transactionEditAccount" required>${accountOptions}</select></label><label class="field"><span>Datum / Zeit</span><input class="text-control" name="occurredAt" id="transactionEditDate" type="datetime-local" required></label><label class="field form-grid-span"><span>Beschreibung</span><input class="text-control" name="description" id="transactionEditDescription" required></label><label class="field"><span>Kategorie</span><select class="text-control" name="categoryId" id="transactionEditCategory"><option value="">Ohne Kategorie</option>${categoryOptions}</select></label><label class="field"><span>Gegenpartei</span><input class="text-control" name="counterparty" id="transactionEditCounterparty"></label><label class="field form-grid-span"><span>Notiz / Zweck</span><textarea class="text-control" name="note" id="transactionEditNote" rows="3"></textarea></label>${canTax?`<label class="field"><span>Steuerrelevant</span><select class="text-control" name="taxRelevant" id="transactionEditTaxRelevant"><option value="false">Nein</option><option value="true">Ja</option></select></label><label class="field"><span>Steuerkategorie</span><input class="text-control" name="taxCategory" id="transactionEditTaxCategory" placeholder="z. B. Berufskosten"></label>`:''}<label class="field form-grid-span checkbox-field"><input type="checkbox" name="makeRecurring" id="transactionMakeRecurring"><span>Als wiederkehrende Zahlung übernehmen</span></label><div class="form-grid form-grid--2 form-grid-span" id="transactionRecurringFields" hidden><label class="field"><span>Rhythmus</span><select class="text-control" name="recurringCadence"><option value="monthly">Monatlich</option><option value="weekly">Wöchentlich</option><option value="quarterly">Quartalsweise</option><option value="semiannual">Halbjährlich</option><option value="annual">Jährlich</option></select></label><label class="field"><span>Nächster Termin</span><input class="text-control" name="recurringNextDate" id="transactionRecurringNextDate" type="date"></label></div>`;
  const transferFields = `<label class="field"><span>Von Konto</span><select class="text-control" name="fromAccountId" required>${accountOptions}</select></label><label class="field"><span>Auf Konto</span><select class="text-control" name="toAccountId" required>${accountOptions}</select></label><label class="field"><span>Abgang vom Quellkonto</span><input class="text-control" name="amount" type="number" step="0.01" min="0.01" required></label><label class="field"><span>Eingang auf Zielkonto</span><input class="text-control" name="toAmount" type="number" step="0.01" min="0.01" placeholder="nur bei anderer Währung"></label><label class="field"><span>Datum / Zeit</span><input class="text-control" name="occurredAt" type="datetime-local" required value="${dateTimeLocalValue()}"></label><label class="field"><span>Beschreibung</span><input class="text-control" name="description" value="Umbuchung" required></label>`;

  const groups=new Map();
  for(const tx of spendRows){
    const key=tx.category_id||'uncategorized';
    const g=groups.get(key)||{id:key,name:tx.categories?.name||'Ohne Kategorie',total:0,count:0,merchants:new Map()};
    const value=Math.abs(convertAmount(tx.amount,tx.currency,baseCurrency,fxRates)??0); g.total+=value; g.count++;
    const merchant=tx.merchants?.name||tx.counterparty||tx.description; g.merchants.set(merchant,(g.merchants.get(merchant)||0)+value); groups.set(key,g);
  }
  const summary=[...groups.values()].sort((a,b)=>b.total-a.total).map((g)=>{
    const top=[...g.merchants.entries()].sort((a,b)=>b[1]-a[1]).slice(0,2).map(([n])=>n).join(' · ');
    return `<article class="card transaction-summary-card"><div class="metric-label">${escapeHtml(g.name)}</div><div class="transaction-summary-value">${money(g.total,{currency:baseCurrency,locale})}</div><div class="metric-note">${g.count} Buchung${g.count===1?'':'en'}${top?` · ${escapeHtml(top)}`:''}</div><div class="card-footer-actions"><button class="table-action" type="button" data-action="transaction-filter-category" data-category="${escapeHtml(g.id)}">Buchungen ansehen</button></div></article>`;
  }).join('');

  const monthly=new Map();
  for(const tx of spendRows){ const key=monthKey(tx.occurred_at); if(!key) continue; const value=Math.abs(convertAmount(tx.amount,tx.currency,baseCurrency,fxRates)??0); const m=monthly.get(key)||{total:0,count:0}; m.total+=value; m.count++; monthly.set(key,m); }
  const monthlyRows=[...monthly.entries()].sort((a,b)=>b[0].localeCompare(a[0]));
  const monthlyHistory=monthlyRows.length>1?`<article class="card card-padding transaction-history-card"><div class="card-heading"><div><h3 class="card-title">Monatsverlauf</h3><p class="card-subtitle">Rückwirkende Ausgaben für den aktuellen Filter.</p></div></div><div class="transaction-month-grid">${monthlyRows.map(([key,m])=>`<div class="transaction-month-item"><span>${escapeHtml(monthLabel(key,locale))}</span><strong>${money(m.total,{currency:baseCurrency,locale})}</strong><small>${m.count} Buchung${m.count===1?'':'en'}</small></div>`).join('')}</div></article>`:'';

  const pageSize=50;
  const totalPages=Math.max(1,Math.ceil(rows.length/pageSize));
  const page=Math.min(Math.max(1,Number(transactionPage)||1),totalPages);
  const offset=(page-1)*pageSize;
  const pageRows=rows.slice(offset,offset+pageSize);
  const rangeText=rows.length?`${offset+1}–${Math.min(offset+pageSize,rows.length)} von ${rows.length}`:'0 Treffer';
  const earliest=transactions.length?transactions.reduce((min,tx)=>String(tx.occurred_at)<String(min.occurred_at)?tx:min,transactions[0]):null;
  const latest=transactions[0]||null;

  const categoryFilterOptions=categories.map((c)=>`<option value="${c.id}" ${transactionCategory===c.id?'selected':''}>${escapeHtml(c.name)}</option>`).join('');
  const accountFilterOptions=accounts.map((a)=>`<option value="${a.account_id}" ${transactionAccount===a.account_id?'selected':''}>${escapeHtml(a.name)}</option>`).join('');
  const hasFilters=Boolean(transactionQuery||transactionFrom||transactionTo||(transactionCategory&&transactionCategory!=='all')||(transactionAccount&&transactionAccount!=='all')||transactionPeriod==='all'||transactionPeriod==='custom');

  return `
    ${pageHeader({title:'Transaktionen',subtitle:'Kacheln zeigen die Auswertung; die Buchungsliste bleibt als vollständiges Journal erhalten, ist aber filterbar und paginiert.',actions:canWrite?`<button class="action-button action-button--primary" type="button" data-action="show-form" data-target="transaction-create">${icon('plus')} Transaktion</button><button class="action-button action-button--secondary" type="button" data-action="show-form" data-target="transfer-create" ${accounts.length>1?'':'disabled'}>${icon('repeat')} Umbuchung</button>`:''})}
    ${canWrite?formShell('transaction-create','Neue Transaktion','Manuelle Buchung',txFields,{hidden:true,submitLabel:'Transaktion speichern'}):''}
    ${canWrite?formShell('transaction-edit','Transaktion bearbeiten','Buchung, Zweck, Steuerstatus oder Wiederkehrend korrigieren',editFields,{hidden:true,submitLabel:'Änderungen speichern'}):''}
    ${canWrite?formShell('transfer-create','Umbuchung','Geld zwischen eigenen Konten verschieben',transferFields,{hidden:true,submitLabel:'Umbuchung speichern'}):''}

    <article class="card card-padding transaction-filter-card">
      <div class="transaction-filter-grid">
        <label class="field"><span>Suchen</span><input class="text-control" id="transactionSearch" type="search" value="${escapeHtml(transactionQuery)}" placeholder="z. B. Migros, MediaMarkt, TWINT"></label>
        <label class="field"><span>Zeitraum</span><select class="text-control" id="transactionPeriodSelect"><option value="month" ${transactionPeriod==='month'?'selected':''}>Aktueller Monat</option><option value="quarter" ${transactionPeriod==='quarter'?'selected':''}>Aktuelles Quartal</option><option value="year" ${transactionPeriod==='year'?'selected':''}>Aktuelles Jahr</option><option value="all" ${transactionPeriod==='all'?'selected':''}>Alle Buchungen</option><option value="custom" ${transactionPeriod==='custom'?'selected':''}>Von / Bis</option></select></label>
        <label class="field"><span>Kategorie</span><select class="text-control" id="transactionCategoryFilter"><option value="all">Alle Kategorien</option><option value="uncategorized" ${transactionCategory==='uncategorized'?'selected':''}>Ohne Kategorie</option>${categoryFilterOptions}</select></label>
        <label class="field"><span>Konto</span><select class="text-control" id="transactionAccountFilter"><option value="all">Alle Konten</option>${accountFilterOptions}</select></label>
        <label class="field"><span>Von</span><input class="text-control" id="transactionFrom" type="date" value="${escapeHtml(transactionFrom)}"></label>
        <label class="field"><span>Bis</span><input class="text-control" id="transactionTo" type="date" value="${escapeHtml(transactionTo)}"></label>
        <label class="field"><span>Ansicht</span><select class="text-control" id="transactionViewSelect"><option value="summary" ${transactionView==='summary'?'selected':''}>Kacheln</option><option value="details" ${transactionView==='details'?'selected':''}>Einzelbuchungen</option></select></label>
        <div class="transaction-filter-actions"><button class="table-action" type="button" data-action="transaction-filter-reset" ${hasFilters?'':'disabled'}>Filter zurücksetzen</button></div>
      </div>
      <div class="toolbar-note">${transactions.length} Buchungen geladen${earliest&&latest?` · Daten von ${dateLabel(earliest.occurred_at,locale)} bis ${dateLabel(latest.occurred_at,locale)}`:''} · ${escapeHtml(fxLabel(fxRates,baseCurrency))}</div>
    </article>

    <div class="metric-grid" style="margin-bottom:16px">${metricCard('Einnahmen',money(income,{currency:baseCurrency,locale}),`${periodLabel(transactionPeriod)} · aktueller Filter`,'positive')}${metricCard('Ausgaben',money(expenses,{currency:baseCurrency,locale}),`${periodLabel(transactionPeriod)} · aktueller Filter`)}${metricCard('Cashflow',money(income-expenses,{currency:baseCurrency,locale}),'ohne interne Umbuchungen',income-expenses>=0?'positive':'warning')}${metricCard('Sparen',money(savings,{currency:baseCurrency,locale}),'Umbuchungen auf Sparkonten','positive')}</div>

    ${transactionView==='summary'?`<div class="transaction-summary-grid">${summary||emptyState('list','Noch keine Ausgaben','Für den gewählten Filter liegen keine Ausgaben vor.')}</div>${monthlyHistory}`:`<article class="card card-padding"><div class="card-heading"><div><h3 class="card-title">Buchungen</h3><p class="card-subtitle">${escapeHtml(rangeText)} · keine Endlosliste</p></div><div class="admin-pager"><button class="table-action" type="button" data-action="transaction-page" data-page="${page-1}" ${page<=1?'disabled':''}>Zurück</button><span>Seite ${page} / ${totalPages}</span><button class="table-action" type="button" data-action="transaction-page" data-page="${page+1}" ${page>=totalPages?'disabled':''}>Weiter</button></div></div>${pageRows.length?`<div class="list">${pageRows.map((tx)=>txRow(tx,{locale,canWrite,accounts,canTax})).join('')}</div>`:emptyState('list','Keine Treffer','Passe Suche oder Filter an.')}</article>`}`;
}
