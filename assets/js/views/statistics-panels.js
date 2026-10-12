import { escapeHtml, money } from '../app/format.js';
import { convertAmount } from '../app/fx.js';

function dateKey(value){
  const date=value instanceof Date?value:new Date(value);
  if(Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}

export function financePeriodDates(cycle){
  return {
    from:dateKey(cycle?.start),
    to:cycle?.endExclusive?dateKey(new Date(new Date(cycle.endExclusive).getTime()-86400000)):'',
  };
}

export function renderFinanceMonthSummary({totals,currency='CHF',locale='de-CH',privacy=false}={}){
  if(!totals?.cycle) return '';
  const {from,to}=financePeriodDates(totals.cycle);
  const number=(value)=>privacy?'•••':money(value,{currency,locale});
  const items=[
    {name:'Einnahmen',amount:totals.income,direction:'income',tone:'positive'},
    {name:'Ausgaben',amount:totals.expenses,direction:'expense',tone:'negative'},
    {name:'Monatsbilanz',amount:totals.savings,direction:'all',tone:totals.savings>=0?'positive':'negative'},
  ];
  return `<section class="stat-month-balance" aria-label="Monatsbilanz">
    ${items.map((item)=>`<button type="button" class="stat-month-tile stat-month-tile--${item.tone}"
      data-action="overview-drilldown-period" data-from="${from}" data-to="${to}" data-direction="${item.direction}">
      <span>${item.name}</span><strong>${number(item.amount)}</strong><small>Buchungen ansehen →</small>
    </button>`).join('')}
  </section>`;
}

export function renderCategoryDetails({rows=[],currency='CHF',locale='de-CH',privacy=false,cycle}={}){
  if(!rows.length) return '<p class="stat-empty">Noch keine Ausgaben für diesen Finanzmonat.</p>';
  const {from,to}=financePeriodDates(cycle);
  const val=(amount)=>privacy?'•••':money(amount,{currency,locale});
  return `<div class="stat-category-list">
    ${rows.map((row)=>{
      const parentIds=(row.transactionIds||[]).join(',');
      return `<details class="stat-category">
        <summary><span class="stat-category-main"><strong>${escapeHtml(row.label)}</strong><small>${Math.round(row.share||0)} % der Ausgaben</small></span><span class="stat-category-value">${val(row.value)} <span aria-hidden="true">⌄</span></span></summary>
        <div class="stat-subcategories">
          ${(row.subcategories||[]).map((sub)=>`<button type="button" class="stat-subcategory"
            data-action="overview-drilldown-expense" data-key="${escapeHtml(sub.key)}"
            data-transaction-ids="${escapeHtml((sub.transactionIds||[]).join(','))}"
            data-from="${from}" data-to="${to}">
              <span>${escapeHtml(sub.label)}</span><strong>${val(sub.value)}</strong><small>${sub.transactionIds?.length||0} Buchungen</small>
            </button>`).join('')}
          <button type="button" class="stat-all-link" data-action="overview-drilldown-expense"
            data-key="${escapeHtml(row.key)}" data-transaction-ids="${escapeHtml(parentIds)}"
            data-from="${from}" data-to="${to}">Alle ${parentIds?row.transactionIds.length:''} Buchungen öffnen →</button>
        </div>
      </details>`;
    }).join('')}
  </div>`;
}

export function renderBudgetProgress({budget,currency='CHF',locale='de-CH',privacy=false,fxRates=null,cycle}={}){
  const rows=budget?.variableRows||[];
  if(!rows.length) return `<div class="stat-empty">Noch keine variablen Budgetrahmen eingerichtet. <a href="/planning/budget">Budget einrichten</a></div>`;
  const {from,to}=financePeriodDates(cycle||budget.cycle);
  const val=(amount)=>privacy?'•••':money(amount,{currency,locale});
  return `<div class="stat-budget-list">
    ${rows.map((row)=>{
      const original=Math.max(0,Number(row.amount||0));
      const limit=convertAmount(original,row.currency||currency,currency,fxRates);
      const amount=Number.isFinite(limit)?limit:null;
      const spent=Math.max(0,Number(row.spent||0));
      const pct=amount>0?spent/amount*100:0;
      const tone=amount===null?'unknown':amount<=0?'neutral':pct>100?'negative':pct>=80?'warning':'positive';
      const ids=Array.isArray(row.transactionIds)?row.transactionIds:[];
      const name=row.merchants?.name||row.categories?.name||row.name||'Budgetposition';
      return `<div class="stat-budget-line stat-budget-line--${tone}">
        <div class="stat-budget-head"><strong>${escapeHtml(name)}</strong><span>${val(spent)} / ${amount===null?'Kurs fehlt':val(amount)}</span></div>
        <div class="stat-budget-track" role="progressbar" aria-label="${escapeHtml(name)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(Math.min(100,Math.max(0,pct)))}"><span style="width:${Math.max(0,Math.min(100,pct))}%"></span></div>
        <div class="stat-budget-foot"><small>${amount===null?'Keine Umrechnung möglich':amount<=0?'Kein Rahmen':pct>100?'Budget überschritten':`${Math.round(pct)} % verbraucht`}</small>
          ${ids.length?`<button type="button" data-action="overview-drilldown-expense" data-key="${escapeHtml(row.category_id||'')}"
          data-transaction-ids="${escapeHtml(ids.join(','))}" data-from="${from}" data-to="${to}">${ids.length} Buchungen →</button>`:'<a href="/planning/budget">Budget öffnen →</a>'}
        </div>
      </div>`;
    }).join('')}
    ${Number(budget.uncoveredVariable||0)>0?`<p class="stat-budget-uncovered">Nicht im variablen Budget enthalten: ${val(budget.uncoveredVariable)}. <a href="/planning/budget">Zuordnung prüfen</a></p>`:''}
  </div>`;
}
