import { dataTable, formShell, pageHeader } from '../app/components.js';
import { escapeHtml } from '../app/format.js';
import { icon } from '../app/icons.js';
import { merchantFamilyKey, merchantSimilarity } from '../app/duplicate-intelligence.js';

function usageLabel(merchant, transactions, recurringRules, budgets) {
  const txCount=transactions.filter((tx)=>tx.merchant_id===merchant.id).length;
  const fixedCount=recurringRules.filter((rule)=>rule.merchant_id===merchant.id && rule.direction==='expense').length;
  const budgetCount=budgets.filter((budget)=>budget.merchant_id===merchant.id).length;
  return {txCount,fixedCount,budgetCount};
}

function norm(value){
  return String(value||'')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g,'')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g,' ')
    .trim()
    .replace(/\s+/g,' ');
}

function duplicateFamily(merchant){
  return merchantFamilyKey(merchant);
}

function merchantUsageScore(merchant,transactions,recurringRules,budgets){
  const usage=usageLabel(merchant,transactions,recurringRules,budgets);
  return usage.txCount*10+usage.fixedCount*5+usage.budgetCount*3+(merchant.default_category_id?2:0);
}

function duplicatePairKey(leftId,rightId){
  return [String(leftId||''),String(rightId||'')].sort().join(':');
}

function duplicateSuggestions(merchants,transactions,recurringRules,budgets,ignoredPairs=[]){
  const ignored=new Set((ignoredPairs||[]).map(String));
  const pairs=[];
  for(let i=0;i<merchants.length;i++){
    const left=merchants[i];
    for(let j=i+1;j<merchants.length;j++){
      const right=merchants[j];
      const pairKey=duplicatePairKey(left.id,right.id);
      if(ignored.has(pairKey)) continue;
      const sameFamily=Boolean(duplicateFamily(left)&&duplicateFamily(left)===duplicateFamily(right));
      const similarity=merchantSimilarity(left,right);
      if(!sameFamily && similarity<0.58) continue;
      const leftScore=merchantUsageScore(left,transactions,recurringRules,budgets);
      const rightScore=merchantUsageScore(right,transactions,recurringRules,budgets);
      const canonical=rightScore>leftScore?right:left;
      const duplicate=canonical.id===left.id?right:left;
      pairs.push({
        pairKey,
        canonical,
        duplicate,
        similarity:sameFamily?Math.max(similarity,0.96):similarity,
        sameFamily,
      });
    }
  }
  return pairs
    .sort((a,b)=>b.similarity-a.similarity || merchantUsageScore(b.canonical,transactions,recurringRules,budgets)-merchantUsageScore(a.canonical,transactions,recurringRules,budgets))
    .slice(0,200);
}

function duplicateClusters(pairs=[]){
  const clusters=new Map();
  for(const pair of pairs){
    const key=pair.canonical.id;
    const current=clusters.get(key)||{
      canonical:pair.canonical,
      duplicates:new Map(),
      similarity:pair.similarity,
      pairKeys:[],
    };
    current.similarity=Math.max(current.similarity,pair.similarity);
    current.duplicates.set(pair.duplicate.id,{
      merchant:pair.duplicate,
      similarity:pair.similarity,
      pairKey:pair.pairKey,
    });
    current.pairKeys.push(pair.pairKey);
    clusters.set(key,current);
  }
  return [...clusters.values()]
    .map((cluster)=>({
      ...cluster,
      duplicates:[...cluster.duplicates.values()].sort((a,b)=>b.similarity-a.similarity),
    }))
    .sort((a,b)=>b.similarity-a.similarity||b.duplicates.length-a.duplicates.length);
}

export function renderMerchants({
  merchants = [],
  merchantAliases = [],
  categories = [],
  transactions = [],
  recurringRules = [],
  budgets = [],
  canWrite = false,
  merchantQuery = '',
  merchantFilter = 'all',
  merchantPage = 1,
  adminRole = null,
  household = null,
  countryMasterMerchants = [],
  merchantDuplicateIgnores = [],
} = {}) {
  const expenseCategories=categories.filter((category)=>category.kind==='expense');
  const categoryOptions=expenseCategories.map((category)=>`<option value="${category.id}">${escapeHtml(category.name)}</option>`).join('');
  const query=String(merchantQuery||'').trim().toLowerCase();
  const aliasesByMerchant=new Map();
  for(const alias of merchantAliases){
    const rows=aliasesByMerchant.get(alias.merchant_id)||[];
    rows.push(alias);
    aliasesByMerchant.set(alias.merchant_id,rows);
  }
  const duplicateGroups=duplicateSuggestions(merchants,transactions,recurringRules,budgets,merchantDuplicateIgnores);
  const duplicateClustersList=duplicateClusters(duplicateGroups);

  const createFields=`
    <label class="field"><span>Name</span><input class="text-control" name="name" required placeholder="z. B. Uzon Immobilien AG"></label>
    <label class="field"><span>Standardkategorie</span><select class="text-control" name="categoryId"><option value="">Keine Standardkategorie</option>${categoryOptions}</select><small>Wird bei künftigen Imports für diesen Händler vorgeschlagen.</small></label>`;

  const mergeFields=`<input type="hidden" name="duplicateMerchantId" id="merchantMergeDuplicateId"><div class="inline-alert form-grid-span" id="merchantMergeSource"></div><label class="field form-grid-span"><span>Als Händler behalten</span><select class="text-control" name="canonicalMerchantId" id="merchantMergeCanonical" required><option value="">Bitte wählen</option>${merchants.map((row)=>`<option value="${row.id}">${escapeHtml(row.name)}</option>`).join('')}</select><small>Der andere Name wird als Alias gespeichert und bei künftigen Imports, OCR-Belegen und Buchungen wieder erkannt.</small></label>`;

  const editFields=`
    <input type="hidden" name="merchantId" id="merchantEditId">
    <label class="field"><span>Name</span><input class="text-control" name="name" id="merchantEditName" required></label>
    <label class="field"><span>Standardkategorie</span><select class="text-control" name="categoryId" id="merchantEditCategory"><option value="">Keine Standardkategorie</option>${categoryOptions}</select><small>Bestehende Buchungen bleiben unverändert; neue Imports verwenden diese Zuordnung.</small></label>`;

  const duplicateMerchantIds=new Set(duplicateGroups.flatMap((group)=>[group.canonical.id,group.duplicate.id]));
  const filtered=merchants
    .filter((merchant)=>{
      if(merchantFilter==='duplicates'&&!duplicateMerchantIds.has(merchant.id)) return false;
      if(merchantFilter==='unused'){
        const usage=usageLabel(merchant,transactions,recurringRules,budgets);
        if(usage.txCount||usage.fixedCount||usage.budgetCount) return false;
      }
      if(!query) return true;
      const category=categories.find((c)=>c.id===merchant.default_category_id)?.name||'';
      const aliases=(aliasesByMerchant.get(merchant.id)||[]).map((row)=>row.alias_name).join(' ');
      return `${merchant.name} ${category} ${aliases}`.toLowerCase().includes(query);
    })
    .slice()
    .sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'de'));

  const pageSize=30;
  const totalPages=Math.max(1,Math.ceil(filtered.length/pageSize));
  const safePage=Math.min(Math.max(1,Number(merchantPage)||1),totalPages);
  const visible=filtered.slice((safePage-1)*pageSize,safePage*pageSize);

  const rows=visible.map((merchant)=>{
    const category=categories.find((c)=>c.id===merchant.default_category_id);
    const usage=usageLabel(merchant,transactions,recurringRules,budgets);
    const aliases=aliasesByMerchant.get(merchant.id)||[];
    const isCountryStandard=countryMasterMerchants.some((row)=>row.normalized_key===merchant.normalized_key);
    const standardMeta=isCountryStandard
      ? `<div class="table-meta">${escapeHtml(household?.country_code||'CH')}-Standard</div>`
      : `<div class="table-meta">${escapeHtml(merchant.normalized_key||'')}</div>`;
    const aliasMeta=aliases.length
      ? `<div class="table-meta">${aliases.length} Alias${aliases.length===1?'':'e'} · ${escapeHtml(aliases.slice(0,3).map((row)=>row.alias_name).join(' · '))}${aliases.length>3?' …':''}</div>`
      : '';
    const promoteAction=adminRole && !isCountryStandard && merchant.default_category_id
      ? `<button class="table-action" type="button" data-action="merchant-promote-master" data-id="${merchant.id}">Für ${escapeHtml(household?.country_code||'CH')} freigeben</button>`
      : '';
    const usageParts=[
      `${usage.txCount} Buchung${usage.txCount===1?'':'en'}`,
      usage.fixedCount?`${usage.fixedCount} Fixkosten`:'',
      usage.budgetCount?`${usage.budgetCount} Budget${usage.budgetCount===1?'':'s'}`:'',
    ].filter(Boolean).join(' · ');
    return `<tr>
      <td>${canWrite?`<input type="checkbox" data-merchant-select value="${merchant.id}" aria-label="${escapeHtml(merchant.name)} auswählen">`:''}</td>
      <td><strong>${escapeHtml(merchant.name)}</strong>${standardMeta}${aliasMeta}</td>
      <td>${escapeHtml(category?.name||'—')}</td>
      <td>${escapeHtml(usageParts)}</td>
      <td>${canWrite?`<div class="table-actions"><button class="table-action" type="button" data-action="merchant-edit" data-id="${merchant.id}">Bearbeiten</button><button class="table-action" type="button" data-action="merchant-merge-open" data-id="${merchant.id}">Zusammenführen</button>${promoteAction}</div>`:''}</td>
    </tr>`;
  });

  const duplicateClusterCard=(cluster)=>`
    <div class="suggestion-card">
      <div><strong>${escapeHtml(cluster.canonical.name)}</strong><span>${cluster.duplicates.length} mögliche Variante${cluster.duplicates.length===1?'':'n'} · höchste Ähnlichkeit ${Math.round(cluster.similarity*100)}%</span></div>
      <div class="merchant-duplicate-variants">${cluster.duplicates.map((row)=>`<span>${escapeHtml(row.merchant.name)} · ${Math.round(row.similarity*100)}%</span>`).join('')}</div>
      ${canWrite?`<div class="row-actions" style="margin-top:10px">
        <button class="table-action" type="button" data-action="merchant-merge-cluster" data-canonical-id="${cluster.canonical.id}" data-duplicate-ids="${escapeHtml(cluster.duplicates.map((row)=>row.merchant.id).join(','))}">${cluster.duplicates.length===1?'Zusammenführen':'Alle Varianten zusammenführen'}</button>
        ${cluster.duplicates.length===1?`<button class="table-action" type="button" data-action="merchant-duplicate-ignore" data-pair-key="${escapeHtml(cluster.duplicates[0].pairKey)}">Nicht identisch</button>`:''}
      </div>`:''}
    </div>`;
  const primaryDuplicateClusters=duplicateClustersList.slice(0,12);
  const moreDuplicateClusters=duplicateClustersList.slice(12);
  const duplicateHtml=duplicateGroups.length?`
    <article class="card card-padding" style="margin-bottom:16px">
      <div class="card-heading">
        <div><h3 class="card-title">Ähnliche Händler prüfen</h3><p class="card-subtitle">Varianten desselben Händlers werden gebündelt. Du entscheidest einmal; danach bleiben frühere Banktexte als Aliase erhalten.</p></div>
        <span class="status-pill">${duplicateGroups.length} Vergleich${duplicateGroups.length===1?'':'e'}</span>
      </div>
      <div class="inline-alert"><strong>${duplicateClustersList.length} Händlergruppen brauchen deine Entscheidung.</strong><span>Die wahrscheinlichsten Gruppen stehen zuerst. Ein Zusammenführen löscht keine Buchungen; frühere Namen werden als Alias gelernt.</span></div>
      <div class="suggestion-grid">
        ${primaryDuplicateClusters.map(duplicateClusterCard).join('')}
      </div>
      ${moreDuplicateClusters.length?`<details class="category-advanced" style="margin-top:12px"><summary>Weitere ${moreDuplicateClusters.length} Händlergruppen prüfen</summary><div class="suggestion-grid" style="margin-top:12px">${moreDuplicateClusters.map(duplicateClusterCard).join('')}</div></details>`:''}
    </article>`:'';


  return `
    ${pageHeader({
      title:'Händler',
      subtitle:'Ein echter Händler pro Geschäft. Abweichende Banktexte und Zahlungsanbieter werden als Aliase geführt.',
      actions:canWrite?`<button class="action-button action-button--primary" type="button" data-action="show-form" data-target="merchant-create">${icon('plus')} Händler</button>`:''
    })}
    ${canWrite?formShell('merchant-create','Neuer Händler','Händler einmal zentral anlegen und künftig wiederverwenden',createFields,{hidden:true,submitLabel:'Händler speichern'}):''}
    ${canWrite?formShell('merchant-edit','Händler bearbeiten','Name und Standardkategorie zentral pflegen',editFields,{hidden:true,submitLabel:'Änderungen speichern'}):''}
    ${canWrite?formShell('merchant-merge-manual','Händler zusammenführen','Wähle, unter welchem Namen ALEMANNO BUCHHALTUNG beide Varianten künftig führen soll.',mergeFields,{hidden:true,submitLabel:'Zusammenführen'}):''}

    ${duplicateHtml}

    <article class="card card-padding" style="margin-bottom:16px">
      <div class="card-heading">
        <div><h3 class="card-title">Händlerbestand</h3><p class="card-subtitle">${merchants.length} Händler · ${merchantAliases.length} Aliase · ${duplicateMerchantIds.size} Händler mit möglicher Dublette</p></div>
      </div>
      <div class="form-grid form-grid--2">
        <label class="field"><span>Händler, Alias oder Kategorie suchen</span><input class="text-control" id="merchantSearch" value="${escapeHtml(merchantQuery)}" placeholder="z. B. EDEKA, Aldi, Restaurant"></label>
        <label class="field"><span>Ansicht</span><select class="text-control" id="merchantFilter">
          <option value="all"${merchantFilter==='all'?' selected':''}>Alle Händler</option>
          <option value="duplicates"${merchantFilter==='duplicates'?' selected':''}>Nur mögliche Dubletten</option>
          <option value="unused"${merchantFilter==='unused'?' selected':''}>Unbenutzte Händler</option>
        </select></label>
      </div>
      <div class="table-meta">${filtered.length} Treffer · Seite ${safePage} von ${totalPages}</div>
    </article>
    ${canWrite?`<article class="card card-padding" style="margin-bottom:16px">
      <div class="card-heading">
        <div><h3 class="card-title">Mehrere Händler zusammenführen</h3><p class="card-subtitle">Markiere beliebig viele Händler unten und wähle einmal, welcher Name bleiben soll.</p></div>
      </div>
      <div class="form-grid form-grid--2">
        <label class="field"><span>Zielhändler behalten</span><select class="text-control" id="merchantBulkCanonical"><option value="">Bitte wählen</option>${merchants.slice().sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'de')).map((row)=>`<option value="${row.id}">${escapeHtml(row.name)}</option>`).join('')}</select></label>
        <div class="field"><span>Auswahl</span><div class="row-actions"><button class="table-action" type="button" data-action="merchant-select-visible">Alle sichtbaren markieren</button><button class="table-action" type="button" data-action="merchant-select-clear">Auswahl aufheben</button></div></div>
      </div>
      <div class="form-actions"><button class="action-button action-button--primary" type="button" data-action="merchant-bulk-merge">Ausgewählte zusammenführen</button></div>
    </article>`:''}

    <article class="card card-padding">
      ${dataTable({
        headers:['','Händler','Standardkategorie','Verwendung',''],
        rows,
        emptyText:query?'Keine Händler für diese Suche gefunden.':'Noch keine Händler vorhanden.'
      })}
      ${totalPages>1?`<div class="form-actions" style="justify-content:space-between">
        <button class="action-button action-button--secondary" type="button" data-action="merchant-page" data-page="${safePage-1}" ${safePage<=1?'disabled':''}>Zurück</button>
        <span class="table-meta">Seite ${safePage} / ${totalPages}</span>
        <button class="action-button action-button--secondary" type="button" data-action="merchant-page" data-page="${safePage+1}" ${safePage>=totalPages?'disabled':''}>Weiter</button>
      </div>`:''}
    </article>`;
}
