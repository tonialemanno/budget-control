import { dataTable, formShell, pageHeader } from '../app/components.js';
import { escapeHtml } from '../app/format.js';
import { icon } from '../app/icons.js';
import { merchantFamilyKey } from '../app/duplicate-intelligence.js';

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

function duplicateSuggestions(merchants,transactions,recurringRules,budgets){
  const groups=new Map();
  for(const merchant of merchants){
    const family=duplicateFamily(merchant);
    if(!family) continue;
    const rows=groups.get(family)||[];
    rows.push(merchant);
    groups.set(family,rows);
  }
  return [...groups.entries()]
    .filter(([,rows])=>rows.length>1)
    .map(([family,rows])=>{
      const ranked=rows.slice().sort((a,b)=>{
        const ua=usageLabel(a,transactions,recurringRules,budgets);
        const ub=usageLabel(b,transactions,recurringRules,budgets);
        const scoreA=ua.txCount*10+ua.fixedCount*5+ua.budgetCount*3+(a.default_category_id?2:0);
        const scoreB=ub.txCount*10+ub.fixedCount*5+ub.budgetCount*3+(b.default_category_id?2:0);
        return scoreB-scoreA||String(a.name).length-String(b.name).length;
      });
      return {family,canonical:ranked[0],duplicates:ranked.slice(1)};
    });
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
  adminRole = null,
  household = null,
  countryMasterMerchants = [],
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
  const duplicateGroups=duplicateSuggestions(merchants,transactions,recurringRules,budgets);

  const createFields=`
    <label class="field"><span>Name</span><input class="text-control" name="name" required placeholder="z. B. Uzon Immobilien AG"></label>
    <label class="field"><span>Standardkategorie</span><select class="text-control" name="categoryId"><option value="">Keine Standardkategorie</option>${categoryOptions}</select><small>Wird bei künftigen Imports für diesen Händler vorgeschlagen.</small></label>`;

  const mergeFields=`<input type="hidden" name="duplicateMerchantId" id="merchantMergeDuplicateId"><div class="inline-alert form-grid-span" id="merchantMergeSource"></div><label class="field form-grid-span"><span>Als Händler behalten</span><select class="text-control" name="canonicalMerchantId" id="merchantMergeCanonical" required><option value="">Bitte wählen</option>${merchants.map((row)=>`<option value="${row.id}">${escapeHtml(row.name)}</option>`).join('')}</select><small>Der andere Name wird als Alias gespeichert und bei künftigen Imports, OCR-Belegen und Buchungen wieder erkannt.</small></label>`;

  const editFields=`
    <input type="hidden" name="merchantId" id="merchantEditId">
    <label class="field"><span>Name</span><input class="text-control" name="name" id="merchantEditName" required></label>
    <label class="field"><span>Standardkategorie</span><select class="text-control" name="categoryId" id="merchantEditCategory"><option value="">Keine Standardkategorie</option>${categoryOptions}</select><small>Bestehende Buchungen bleiben unverändert; neue Imports verwenden diese Zuordnung.</small></label>`;

  const filtered=merchants
    .filter((merchant)=>{
      if(!query) return true;
      const category=categories.find((c)=>c.id===merchant.default_category_id)?.name||'';
      const aliases=(aliasesByMerchant.get(merchant.id)||[]).map((row)=>row.alias_name).join(' ');
      return `${merchant.name} ${category} ${aliases}`.toLowerCase().includes(query);
    })
    .slice()
    .sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'de'));

  const rows=filtered.map((merchant)=>{
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

  const duplicateHtml=duplicateGroups.length?`
    <article class="card card-padding" style="margin-bottom:16px">
      <div class="card-heading">
        <div><h3 class="card-title">Mögliche Händler-Dubletten</h3><p class="card-subtitle">Nur sehr sichere Namensfamilien werden vorgeschlagen. Originale Bankbeschreibungen bleiben unverändert.</p></div>
      </div>
      <div class="suggestion-grid">
        ${duplicateGroups.map((group)=>`
          <div class="suggestion-card">
            <div><strong>${escapeHtml(group.canonical.name)}</strong><span>als kanonischer Händler behalten</span></div>
            ${group.duplicates.map((duplicate)=>`<div class="row-actions" style="margin-top:8px"><span class="table-meta">${escapeHtml(duplicate.name)}</span>${canWrite?`<button class="table-action" type="button" data-action="merchant-merge" data-canonical-id="${group.canonical.id}" data-duplicate-id="${duplicate.id}">Zusammenführen</button>`:''}</div>`).join('')}
          </div>`).join('')}
      </div>
    </article>`:'';

  return `
    ${pageHeader({
      title:'Händler',
      subtitle:'Ein echter Händler pro Geschäft. Abweichende Banktexte und Zahlungsanbieter werden als Aliase geführt.',
      actions:canWrite?`<button class="action-button action-button--primary" type="button" data-action="show-form" data-target="merchant-create">${icon('plus')} Händler</button>`:''
    })}
    ${canWrite?formShell('merchant-create','Neuer Händler','Händler einmal zentral anlegen und künftig wiederverwenden',createFields,{hidden:true,submitLabel:'Händler speichern'}):''}
    ${canWrite?formShell('merchant-edit','Händler bearbeiten','Name und Standardkategorie zentral pflegen',editFields,{hidden:true,submitLabel:'Änderungen speichern'}):''}
    ${canWrite?formShell('merchant-merge-manual','Händler zusammenführen','Wähle, unter welchem Namen Finance beide Varianten künftig führen soll.',mergeFields,{hidden:true,submitLabel:'Zusammenführen'}):''}

    ${duplicateHtml}

    <article class="card card-padding" style="margin-bottom:16px">
      <div class="card-heading">
        <div><h3 class="card-title">Händlersuche</h3><p class="card-subtitle">${merchants.length} kanonische Händler · ${merchantAliases.length} erkannte Aliase</p></div>
      </div>
      <label class="field"><span>Händler, Alias oder Kategorie suchen</span><input class="text-control" id="merchantSearch" value="${escapeHtml(merchantQuery)}" placeholder="z. B. Uzon, Avenir, Wohnen"></label>
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
    </article>`;
}
