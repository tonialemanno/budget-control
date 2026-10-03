import { dataTable, formShell, pageHeader } from '../app/components.js';
import { escapeHtml } from '../app/format.js';
import { icon } from '../app/icons.js';

function usageLabel(merchant, transactions, recurringRules, budgets) {
  const txCount=transactions.filter((tx)=>tx.merchant_id===merchant.id).length;
  const fixedCount=recurringRules.filter((rule)=>rule.merchant_id===merchant.id && rule.direction==='expense').length;
  const budgetCount=budgets.filter((budget)=>budget.merchant_id===merchant.id).length;
  return {txCount,fixedCount,budgetCount};
}

export function renderMerchants({
  merchants = [],
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

  const createFields=`
    <label class="field"><span>Name</span><input class="text-control" name="name" required placeholder="z. B. Uzon Immobilien AG"></label>
    <label class="field"><span>Standardkategorie</span><select class="text-control" name="categoryId"><option value="">Keine Standardkategorie</option>${categoryOptions}</select><small>Wird bei künftigen Imports für diesen Händler vorgeschlagen.</small></label>`;

  const editFields=`
    <input type="hidden" name="merchantId" id="merchantEditId">
    <label class="field"><span>Name</span><input class="text-control" name="name" id="merchantEditName" required></label>
    <label class="field"><span>Standardkategorie</span><select class="text-control" name="categoryId" id="merchantEditCategory"><option value="">Keine Standardkategorie</option>${categoryOptions}</select><small>Bestehende Buchungen bleiben unverändert; neue Imports verwenden diese Zuordnung.</small></label>`;

  const filtered=merchants
    .filter((merchant)=>{
      if(!query) return true;
      const category=categories.find((c)=>c.id===merchant.default_category_id)?.name||'';
      return `${merchant.name} ${category}`.toLowerCase().includes(query);
    })
    .slice()
    .sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'de'));

  const rows=filtered.map((merchant)=>{
    const category=categories.find((c)=>c.id===merchant.default_category_id);
    const usage=usageLabel(merchant,transactions,recurringRules,budgets);
    const isCountryStandard=countryMasterMerchants.some((row)=>row.normalized_key===merchant.normalized_key);
    const standardMeta=isCountryStandard
      ? `<div class="table-meta">${escapeHtml(household?.country_code||'CH')}-Standard</div>`
      : `<div class="table-meta">${escapeHtml(merchant.normalized_key||'')}</div>`;
    const promoteAction=adminRole && !isCountryStandard && merchant.default_category_id
      ? `<button class="table-action" type="button" data-action="merchant-promote-master" data-id="${merchant.id}">Für ${escapeHtml(household?.country_code||'CH')} freigeben</button>`
      : '';
    const usageParts=[
      `${usage.txCount} Buchung${usage.txCount===1?'':'en'}`,
      usage.fixedCount?`${usage.fixedCount} Fixkosten`:'',
      usage.budgetCount?`${usage.budgetCount} Budget${usage.budgetCount===1?'':'s'}`:'',
    ].filter(Boolean).join(' · ');
    return `<tr>
      <td><strong>${escapeHtml(merchant.name)}</strong>${standardMeta}</td>
      <td>${escapeHtml(category?.name||'—')}</td>
      <td>${escapeHtml(usageParts)}</td>
      <td>${canWrite?`<div class="table-actions"><button class="table-action" type="button" data-action="merchant-edit" data-id="${merchant.id}">Bearbeiten</button>${promoteAction}</div>`:''}</td>
    </tr>`;
  });

  return `
    ${pageHeader({
      title:'Händler',
      subtitle:'Zentrale Händlerstammdaten für Import, Kategorien, Fixkosten und Budgets.',
      actions:canWrite?`<button class="action-button action-button--primary" type="button" data-action="show-form" data-target="merchant-create">${icon('plus')} Händler</button>`:''
    })}
    ${canWrite?formShell('merchant-create','Neuer Händler','Händler einmal zentral anlegen und künftig wiederverwenden',createFields,{hidden:true,submitLabel:'Händler speichern'}):''}
    ${canWrite?formShell('merchant-edit','Händler bearbeiten','Name und Standardkategorie zentral pflegen',editFields,{hidden:true,submitLabel:'Änderungen speichern'}):''}

    <article class="card card-padding" style="margin-bottom:16px">
      <div class="card-heading">
        <div><h3 class="card-title">Händlersuche</h3><p class="card-subtitle">${merchants.length} Händler im Haushalt</p></div>
      </div>
      <label class="field"><span>Händler oder Kategorie suchen</span><input class="text-control" id="merchantSearch" value="${escapeHtml(merchantQuery)}" placeholder="z. B. Uzon, Avenir, Wohnen"></label>
    </article>

    <article class="card card-padding">
      ${dataTable({
        headers:['Händler','Standardkategorie','Verwendung',''],
        rows,
        emptyText:query?'Keine Händler für diese Suche gefunden.':'Noch keine Händler vorhanden.'
      })}
    </article>`;
}
