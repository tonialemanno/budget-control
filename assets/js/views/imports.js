import { dataTable, pageHeader, statusPill } from '../app/components.js';
import { dateLabel, escapeHtml, money } from '../app/format.js';
import { icon } from '../app/icons.js';

function txMerchant(tx) {
  return tx.merchants?.name || tx.counterparty || tx.description || 'Unbekannt';
}

function categoryTiles(transactions, categories, currency, locale) {
  const expenses = transactions.filter((tx)=>Number(tx.amount) < 0 && tx.category_id);
  const totals = new Map();
  for (const tx of expenses) totals.set(tx.category_id, (totals.get(tx.category_id) || 0) + Math.abs(Number(tx.amount)));
  return [...totals.entries()]
    .sort((a,b)=>b[1]-a[1])
    .map(([id,total])=>{
      const category = categories.find((c)=>c.id===id);
      return `<article class="import-category-tile"><span>${escapeHtml(category?.name || 'Kategorie')}</span><strong>${money(total,{currency:transactions[0]?.currency||currency,locale})}</strong></article>`;
    }).join('');
}

function openMerchantGroups(transactions, categories, query, categoryFilter) {
  const needle = String(query || '').trim().toLowerCase();
  const groups = new Map();
  for (const tx of transactions) {
    const merchant = txMerchant(tx);
    if (needle && !`${merchant} ${tx.description || ''}`.toLowerCase().includes(needle)) continue;
    if (categoryFilter === 'uncategorized' && tx.category_id) continue;
    if (categoryFilter && categoryFilter !== 'all' && categoryFilter !== 'uncategorized' && tx.category_id !== categoryFilter) continue;
    const key = tx.merchant_id || merchant.toLowerCase();
    const group = groups.get(key) || { key, merchant, merchantId:tx.merchant_id || '', rows:[], total:0 };
    group.rows.push(tx);
    group.total += Number(tx.amount);
    groups.set(key,group);
  }
  return [...groups.values()].sort((a,b)=>Math.abs(b.total)-Math.abs(a.total));
}

export function renderImports({
  accounts = [], importBatches = [], transactions = [], categories = [], household, profile,
  importQuery = '', importCategory = 'all', canWrite = false,
} = {}) {
  const currency = household?.base_currency || 'CHF';
  const locale = profile?.locale || 'de-CH';
  const accountOptions = accounts.map((a)=>`<option value="${a.account_id}">${escapeHtml(a.name)} · ${escapeHtml(a.currency)}</option>`).join('');
  const recentRows = importBatches.slice(0,10).map((b)=>`<tr><td><strong>${escapeHtml(b.file_name)}</strong><div class="table-meta">${escapeHtml(b.accounts?.name||'')}</div></td><td>${dateLabel(b.created_at,locale)}</td><td>${b.imported_count}</td><td>${b.skipped_count}</td><td>${statusPill(b.status==='completed'?'active':b.status==='failed'?'warning':'pending',b.status==='completed'?'Fertig':b.status==='failed'?'Fehler':'Läuft')}</td></tr>`);
  const latest = importBatches[0] || null;
  const latestTransactions = latest ? transactions.filter((tx)=>tx.import_batch_id===latest.id) : [];
  const uncategorized = latestTransactions.filter((tx)=>!tx.category_id && !tx.transfer_group_id);
  const allCategorized = latestTransactions.length > 0 && uncategorized.length === 0;
  const tiles = allCategorized ? categoryTiles(latestTransactions,categories,currency,locale) : '';
  const groups = openMerchantGroups(latestTransactions,categories,importQuery,importCategory);
  const categoryOptions = categories.filter((c)=>c.kind==='expense').map((c)=>`<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');

  const groupRows = groups.map((g)=>{
    const ids = g.rows.map((row)=>row.id).join(',');
    const currentCategoryIds = [...new Set(g.rows.map((row)=>row.category_id).filter(Boolean))];
    const currentCategory = currentCategoryIds.length===1 ? currentCategoryIds[0] : '';
    return `<div class="import-group-row" data-tx-ids="${escapeHtml(ids)}" data-merchant-id="${escapeHtml(g.merchantId)}">
      <div class="import-group-copy"><strong>${escapeHtml(g.merchant)}</strong><span>${g.rows.length} Buchung${g.rows.length===1?'':'en'} · ${money(Math.abs(g.total),{currency:g.rows[0]?.currency||currency,locale})}</span></div>
      <select class="text-control import-category-select" data-import-group-category><option value="">Ohne Kategorie</option>${categories.filter((c)=>c.kind===(g.total<0?'expense':'income')).map((c)=>`<option value="${c.id}" ${c.id===currentCategory?'selected':''}>${escapeHtml(c.name)}</option>`).join('')}</select>
      ${canWrite?`<button class="table-action" type="button" data-action="import-group-assign">Zuordnen & merken</button>`:''}
    </div>`;
  }).join('');

  return `
    ${pageHeader({title:'Datenimport',subtitle:'CSV einlesen, Händler erkennen, direkt kategorisieren und Dubletten sicher überspringen.'})}
    <div class="grid-main-aside">
      <form class="card card-padding" id="csv-import" data-form="csv-import">
        <div class="card-heading"><div><h3 class="card-title">CSV importieren</h3><p class="card-subtitle">Bankexport oder eigene CSV-Datei</p></div><span class="list-row-leading">${icon('arrow-down-left')}</span></div>
        ${accounts.length ? '' : `<div class="inline-alert"><strong>Kein Konto vorhanden.</strong><span>Lege zuerst ein Konto an.</span></div>`}
        <div class="form-grid">
          <label class="field"><span>Zielkonto</span><select class="text-control" name="accountId" required ${accounts.length?'':'disabled'}>${accountOptions}</select></label>
          <label class="field"><span>CSV-Datei</span><input class="text-control" id="csvFile" name="file" type="file" accept=".csv,text/csv" required ${accounts.length?'':'disabled'}></label>
        </div>
        <div id="csvMapping" hidden style="margin-top:18px">
          <div class="card-heading"><div><h3 class="card-title">Spalten zuordnen</h3><p class="card-subtitle" id="csvPreviewMeta"></p></div></div>
          <div class="form-grid form-grid--2">
            <label class="field"><span>Datum</span><select class="text-control" name="mapDate" id="mapDate"></select></label>
            <label class="field"><span>Beschreibung</span><select class="text-control" name="mapDescription" id="mapDescription"></select></label>
            <label class="field"><span>Gegenpartei</span><select class="text-control" name="mapCounterparty" id="mapCounterparty"></select></label>
            <label class="field"><span>Betrag (eine Spalte)</span><select class="text-control" name="mapAmount" id="mapAmount"></select></label>
            <label class="field"><span>Belastung</span><select class="text-control" name="mapDebit" id="mapDebit"></select></label>
            <label class="field"><span>Gutschrift</span><select class="text-control" name="mapCredit" id="mapCredit"></select></label>
          </div>
          <div id="csvReview" class="csv-review"></div>
          <label class="module-toggle import-remember-toggle"><input type="checkbox" name="rememberMerchants" checked><span><strong>Händler-Zuordnung merken</strong><small>Die gewählte Kategorie wird für denselben erkannten Händler beim nächsten Import vorgeschlagen.</small></span></label>
          <div class="form-actions"><button class="action-button action-button--primary" type="submit">Import starten</button></div>
        </div>
      </form>
      <article class="card card-padding"><div class="card-heading"><div><h3 class="card-title">Importlogik</h3><p class="card-subtitle">Was beim Einlesen passiert</p></div></div><div class="stack compact-copy"><p>• Händler werden aus Gegenpartei bzw. Buchungstext normalisiert und gruppiert.</p><p>• Bekannte Händler erhalten ihre gemerkte Kategorie automatisch.</p><p>• Bestehende Kategorisierungsregeln bleiben zusätzlich aktiv.</p><p>• Dubletten werden über den stabilen Fingerprint des Kontos erkannt.</p><p>• Der Kontostand-jetzt-Anker wird durch historische Importe nicht verändert.</p></div></article>
    </div>

    ${latest ? `<article class="card card-padding import-latest" style="margin-top:16px">
      <div class="card-heading"><div><h3 class="card-title">Letzter Import</h3><p class="card-subtitle">${escapeHtml(latest.file_name)} · ${latest.imported_count} importiert · ${latest.skipped_count} übersprungen</p></div>${uncategorized.length?statusPill('warning',`${uncategorized.length} offen`):statusPill('active','Kategorisiert')}</div>
      ${allCategorized ? `<div class="import-category-grid">${tiles || '<div class="table-empty">Keine Ausgaben in diesem Import.</div>'}</div>` : latestTransactions.length ? `
        <div class="import-filter-bar">
          <input class="text-control" id="importMerchantSearch" type="search" value="${escapeHtml(importQuery)}" placeholder="Händler oder Buchung suchen">
          <select class="text-control" id="importCategoryFilter"><option value="all">Alle Kategorien</option><option value="uncategorized" ${importCategory==='uncategorized'?'selected':''}>Nur unkategorisiert</option>${categories.map((c)=>`<option value="${c.id}" ${importCategory===c.id?'selected':''}>${escapeHtml(c.name)}</option>`).join('')}</select>
        </div>
        <div class="import-group-list">${groupRows || '<div class="table-empty">Keine Treffer.</div>'}</div>` : `<div class="table-empty">Dieser ältere Import enthält noch keine verknüpften Einzelbuchungen. Neue Importe ab V2.2 Beta 2 werden vollständig zugeordnet.</div>`}
    </article>` : ''}

    <article class="card card-padding" style="margin-top:16px"><div class="card-heading"><div><h3 class="card-title">Importverlauf</h3><p class="card-subtitle">Die letzten 10 Läufe</p></div><a class="table-action" href="#/import-history">Alle Imports</a></div>${dataTable({headers:['Datei','Datum','Importiert','Übersprungen','Status'],rows:recentRows,emptyText:'Noch keine CSV-Dateien importiert.'})}</article>`;
}
