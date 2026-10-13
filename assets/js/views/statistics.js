import { pageHeader } from '../app/components.js';
import { dateLabel, escapeHtml, money } from '../app/format.js';
import { renderCashflowChart, renderExpenseDonut } from '../app/charts.js';
import { financeCycleLabel } from '../app/finance-cycle.js';
import { buildStatisticsModel } from '../app/statistics-model.js';

function localDateKey(value){
  const date=value instanceof Date?value:new Date(value);
  if(Number.isNaN(date.getTime())) return '';
  const pad=(n)=>String(n).padStart(2,'0');
  return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`;
}

function inclusivePeriodEnd(value){
  const end=new Date(value);
  if(Number.isNaN(end.getTime())) return end;
  end.setDate(end.getDate()-1);
  return end;
}

function periodRange(row){
  const start=new Date(row.start);
  const end=inclusivePeriodEnd(row.endExclusive);
  return {from:localDateKey(start),to:localDateKey(end)};
}

function privacyMoney(value,{currency,locale,privacyEnabled=false}={}){
  return privacyEnabled?'•••':money(value,{currency,locale});
}

function metric(label,value,note='',tone='',drilldown=null){
  const classes=`statistics-metric ${tone?`statistics-metric--${tone}`:''}`;
  const attrs=drilldown
    ? ` type="button" data-drilldown="transactions-range" data-from="${escapeHtml(drilldown.from)}" data-to="${escapeHtml(drilldown.to)}" data-direction="${escapeHtml(drilldown.direction)}" aria-label="${escapeHtml(label)}: zugehörige Transaktionen öffnen"`
    : '';
  const tag=drilldown?'button':'article';
  return `<${tag} class="${classes}"${attrs}>
    <span>${escapeHtml(label)}</span>
    <strong>${value}</strong>
    ${note?`<small>${escapeHtml(note)}</small>`:''}
  </${tag}>`;
}

function periodRow(row,{currency,locale,privacyEnabled}){
  const {from,to}=periodRange(row);
  const label=financeCycleLabel({start:new Date(row.start),endExclusive:new Date(row.endExclusive)},locale);
  const coverage=row.coverage||'full';
  if(coverage!=='full'){
    return `<div class="statistics-period-row statistics-period-row--incomplete">
      <div><strong>${escapeHtml(label)}</strong><small>${coverage==='partial'?'Teilweise Daten':'Keine Daten'}</small></div>
      <span>–</span><span>–</span><span>–</span>
    </div>`;
  }
  const net=Number(row.net||0);
  return `<div class="statistics-period-row">
    <button type="button" class="statistics-period-name" data-drilldown="transactions-range" data-from="${from}" data-to="${to}" data-direction="all">
      <strong>${escapeHtml(label)}</strong><small>${escapeHtml(dateLabel(row.start,locale))} – ${escapeHtml(dateLabel(inclusivePeriodEnd(row.endExclusive),locale))}</small>
    </button>
    <button type="button" class="statistics-period-value statistics-period-value--income" data-drilldown="transactions-range" data-from="${from}" data-to="${to}" data-direction="income">
      <span>Einnahmen</span><strong>${privacyMoney(row.income,{currency,locale,privacyEnabled})}</strong>
    </button>
    <button type="button" class="statistics-period-value statistics-period-value--expense" data-drilldown="transactions-range" data-from="${from}" data-to="${to}" data-direction="expense">
      <span>Ausgaben</span><strong>${privacyMoney(row.expenses,{currency,locale,privacyEnabled})}</strong>
    </button>
    <button type="button" class="statistics-period-value ${net<0?'statistics-period-value--negative':'statistics-period-value--positive'}" data-drilldown="transactions-range" data-from="${from}" data-to="${to}" data-direction="all">
      <span>Saldo</span><strong>${privacyMoney(net,{currency,locale,privacyEnabled})}</strong>
    </button>
  </div>`;
}

function categoryDetailsHtml(rows,{currency,locale,privacyEnabled,range}){
  if(!rows.length) return '';
  return `<div class="statistics-category-details">
    ${rows.map((row)=>`<details class="statistics-category-group">
      <summary><strong>${escapeHtml(row.label)}</strong><span>${privacyMoney(row.value,{currency,locale,privacyEnabled})} · ${Math.round(row.share||0)} %</span></summary>
      <div class="statistics-category-leaves">
        ${(row.subcategories||[]).map((leaf)=>`<button type="button" data-action="overview-drilldown-expense"
          data-key="${escapeHtml(leaf.key)}" data-transaction-ids="${escapeHtml((leaf.transactionIds||[]).join(','))}"
          data-from="${range.from}" data-to="${range.to}"><span>${escapeHtml(leaf.label)}</span><strong>${privacyMoney(leaf.value,{currency,locale,privacyEnabled})}</strong><small>${leaf.transactionIds?.length||0} Buchungen</small></button>`).join('')}
      </div>
    </details>`).join('')}
  </div>`;
}

function budgetRowsHtml(rows,{currency,locale,privacyEnabled,range}){
  if(!rows.length) return '<div class="table-empty">Noch keine variablen Budgetrahmen vorhanden.</div>';
  return rows.map((row)=>{
    const tone=row.rawPercent>100?'negative':row.rawPercent>=80?'warning':'positive';
    return `<button class="statistics-budget-row" type="button" data-action="statistics-drilldown-budget" data-merchant-id="${escapeHtml(row.merchantId||'')}" data-category-ids="${escapeHtml(row.categoryIds.join(','))}" data-transaction-ids="${escapeHtml((row.transactionIds||[]).join(','))}" data-from="${range.from}" data-to="${range.to}">
      <div class="statistics-budget-head">
        <div><strong>${escapeHtml(row.label)}</strong><small>${row.transactionCount} Buchung${row.transactionCount===1?'':'en'}</small></div>
        <div><strong>${privacyMoney(row.spent,{currency,locale,privacyEnabled})} / ${row.amount===null?'FX-Kurs fehlt':privacyMoney(row.amount,{currency,locale,privacyEnabled})}</strong><small>${row.amount===null?'Nicht berechenbar':`${Math.round(row.rawPercent)}%`}</small></div>
      </div>
      <div class="statistics-progress statistics-progress--${tone}"><span style="--statistics-progress:${Math.min(100,Math.max(0,row.percent))}%"></span></div>
      <div class="statistics-budget-foot"><span>${row.overBy>0?'Über Budget':'Noch verfügbar'}</span><strong>${row.amount===null?'–':privacyMoney(row.overBy>0?row.overBy:row.remaining,{currency,locale,privacyEnabled})}</strong></div>
    </button>`;
  }).join('');
}

function accountRowsHtml(rows,{locale,privacyEnabled}){
  if(!rows.length) return '<div class="table-empty">Noch keine liquiden Konten vorhanden.</div>';
  return rows.map((row)=>`<button class="statistics-account-row" type="button" data-drilldown="account-edit" data-id="${escapeHtml(row.account.account_id)}">
    <div><strong>${escapeHtml(row.account.name)}</strong><small>${escapeHtml(row.account.currency)} · ${row.share===null?'Anteil nicht berechenbar':`${Math.round(row.share)}% der liquiden Mittel`}</small></div>
    <strong>${privacyEnabled?'•••':money(row.account.current_balance,{currency:row.account.currency,locale})}</strong>
  </button>`).join('');
}

export function renderStatistics({
  accounts=[],transactions=[],debtPayments=[],recurringRules=[],budgets=[],categories=[],merchants=[],
  household,profile,fxRates,privacyEnabled=false,
}={}){
  const locale=profile?.locale||'de-CH';
  const now=new Date();
  const model=buildStatisticsModel({
    accounts,transactions,debtPayments,recurringRules,budgets,categories,merchants,
    household,profile,fxRates,now,cycles:12,categoryLimit:8,
  });
  const {currency,current,series,annualIncome,budgetRows}=model;
  const currentLabel=financeCycleLabel(current.cycle,locale);
  const net=Number(current.savings||0);
  const currentRange=periodRange({start:current.cycle.start,endExclusive:current.cycle.endExclusive});
  const year=annualIncome.year;
  const accountFxIncomplete=(model.accounts||[]).some((row)=>row.value===null);
  const liquidBalance=accountFxIncomplete?null:(model.accounts||[]).reduce((sum,row)=>sum+Number(row.value||0),0);
  const budgetRemaining=Math.max(0,Number(model.budget?.remaining||0));
  const budgetOver=Math.max(0,Number(model.budget?.overBy||0));
  const budgetAvailableLabel=model.budget?.count
    ? budgetOver>0?'Budget überschritten':'Variables Budget offen'
    : 'Variables Budget';

  return `
    ${pageHeader({
      kicker:'Auswertung',
      title:'Statistik',
      subtitle:'Trends, Kategorien und Budgets aus denselben Buchungen wie deine Übersicht – jede Zahl führt zurück zu den zugrunde liegenden Transaktionen.',
      actions:'<a class="action-button action-button--secondary" href="/finance/transactions">Alle Buchungen</a><a class="action-button action-button--primary" href="/planning/budget">Budget öffnen</a>'
    })}

    <section class="statistics-metric-grid">
      ${metric('Einnahmen · aktueller Finanzmonat',privacyMoney(current.income,{currency,locale,privacyEnabled}),currentLabel,'income',{...currentRange,direction:'income'})}
      ${metric('Ausgaben · aktueller Finanzmonat',privacyMoney(current.expenses,{currency,locale,privacyEnabled}),currentLabel,'expense',{...currentRange,direction:'expense'})}
      ${metric(net>=0?'Überschuss':'Defizit',privacyMoney(Math.abs(net),{currency,locale,privacyEnabled}),currentLabel,net>=0?'positive':'negative',{...currentRange,direction:'all'})}
      ${metric('Sparquote',`${Math.round(current.savingsRate||0)}%`,`${current.transactionCount} gebuchte Bewegungen`,current.savingsRate>=0?'positive':'negative',{...currentRange,direction:'all'})}
    </section>

    <article class="card card-padding statistics-balance-card">
      <div class="card-heading">
        <div><h3 class="card-title">Monatsbilanz auf einen Blick</h3><p class="card-subtitle">Ein Finanzbild für den aktuellen Finanzmonat. Jede Position führt direkt zur passenden Detailansicht.</p></div>
        <button class="card-link card-link--button" type="button" data-drilldown="transactions-range" data-from="${currentRange.from}" data-to="${currentRange.to}" data-direction="all">Alle Bewegungen</button>
      </div>
      <div class="statistics-balance-layout">
        <button type="button" class="statistics-balance-total ${net<0?'statistics-balance-total--negative':'statistics-balance-total--positive'}" data-drilldown="transactions-range" data-from="${currentRange.from}" data-to="${currentRange.to}" data-direction="all">
          <span>${net<0?'Defizit':'Überschuss'}</span>
          <strong>${privacyMoney(Math.abs(net),{currency,locale,privacyEnabled})}</strong>
          <small>${escapeHtml(currentLabel)}</small>
        </button>
        <div class="statistics-balance-rows">
          <button type="button" data-drilldown="transactions-range" data-from="${currentRange.from}" data-to="${currentRange.to}" data-direction="income">
            <span>Einnahmen</span><strong class="positive">${privacyMoney(current.income,{currency,locale,privacyEnabled})}</strong>
          </button>
          <button type="button" data-drilldown="transactions-range" data-from="${currentRange.from}" data-to="${currentRange.to}" data-direction="expense">
            <span>Ausgaben</span><strong class="negative">${privacyMoney(current.expenses,{currency,locale,privacyEnabled})}</strong>
          </button>
          <a href="/planning/budget">
            <span>${escapeHtml(budgetAvailableLabel)}</span>
            <strong>${model.budget?.count
              ? privacyMoney(budgetOver>0?budgetOver:budgetRemaining,{currency,locale,privacyEnabled})
              : 'Noch nicht eingerichtet'}</strong>
          </a>
          <a href="/finance">
            <span>Liquide Kontostände</span><strong>${liquidBalance===null?'Nicht berechenbar':privacyMoney(liquidBalance,{currency,locale,privacyEnabled})}</strong>
          </a>
        </div>
      </div>
    </article>

    <article class="card card-padding statistics-chart-card">
      <div class="card-heading">
        <div><h3 class="card-title">Einnahmen & Ausgaben</h3><p class="card-subtitle">Zwölf Finanzmonate. Tippe direkt auf einen Balken, um genau diese Buchungen zu öffnen.</p></div>
        <button class="card-link card-link--button" type="button" data-drilldown="transactions-range" data-from="${currentRange.from}" data-to="${currentRange.to}" data-direction="all">Aktuellen Monat öffnen</button>
      </div>
      ${renderCashflowChart({series,currency,locale,privacy:privacyEnabled,interactive:true})}
      <div class="statistics-period-list">
        ${series.slice().reverse().map((row)=>periodRow(row,{currency,locale,privacyEnabled})).join('')}
      </div>
    </article>

    <section class="statistics-two-column">
      <article class="card card-padding statistics-donut-card">
        <div class="card-heading">
          <div><h3 class="card-title">Ausgaben nach Kategorien</h3><p class="card-subtitle">Echte Konsumausgaben im aktuellen Finanzmonat. Jeder Bereich ist anklickbar.</p></div>
        </div>
        ${renderExpenseDonut({rows:model.categories,total:model.categoryTotal,currency,locale,privacy:privacyEnabled,rangeStart:current.cycle.start,rangeEnd:current.cycle.endExclusive})}
        <details class="statistics-expand-categories"><summary>Unterkategorien und Buchungen anzeigen</summary>
          ${categoryDetailsHtml(model.categories,{currency,locale,privacyEnabled,range:currentRange})}
        </details>
      </article>

      <article class="card card-padding">
        <div class="card-heading">
          <div><h3 class="card-title">Budgetfortschritt</h3><p class="card-subtitle">Wie viel deines variablen Rahmens bereits verbraucht ist.</p></div>
          <a class="card-link" href="/planning/budget">Bearbeiten</a>
        </div>
        <div class="statistics-budget-list">${budgetRowsHtml(budgetRows,{currency,locale,privacyEnabled,range:currentRange})}</div>
      </article>
    </section>

    <section class="statistics-two-column">
      <article class="card card-padding">
        <div class="card-heading">
          <div><h3 class="card-title">Einnahmen ${year}</h3><p class="card-subtitle">Verdienst und andere positive Geldbewegungen bleiben wirtschaftlich getrennt.</p></div>
        </div>
        <div class="statistics-income-total">
          <span>Verdient</span><strong>${privacyMoney(annualIncome.earnedTotal,{currency,locale,privacyEnabled})}</strong>
        </div>
        <div class="income-source-list">
          ${annualIncome.sources.length?annualIncome.sources.map((row)=>`<button class="income-source-row" type="button" data-action="overview-drilldown-income" data-source="${escapeHtml(row.label)}" data-sources="${escapeHtml((row.sourceNames||[row.label]).join('||'))}" data-transaction-ids="${escapeHtml((row.transactionIds||[]).join(','))}"><span>${escapeHtml(row.label)}</span><strong>${privacyMoney(row.value,{currency,locale,privacyEnabled})}</strong></button>`).join(''):'<div class="table-empty">Noch keine klassifizierten Einnahmen.</div>'}
        </div>
        <div class="income-classification-strip">
          <button type="button" data-action="overview-drilldown-income" data-kind="refund"><span>Rückerstattungen</span><strong>${privacyMoney(annualIncome.refunds,{currency,locale,privacyEnabled})}</strong></button>
          <button type="button" data-action="overview-drilldown-income" data-kind="repayment"><span>Rückzahlungen</span><strong>${privacyMoney(annualIncome.repayments,{currency,locale,privacyEnabled})}</strong></button>
          <button type="button" data-action="overview-drilldown-income" data-kind="unclassified" class="${annualIncome.unclassified>0?'needs-review':''}"><span>Ungeklärt</span><strong>${privacyMoney(annualIncome.unclassified,{currency,locale,privacyEnabled})}</strong></button>
        </div>
      </article>

      <article class="card card-padding">
        <div class="card-heading">
          <div><h3 class="card-title">Kontostände</h3><p class="card-subtitle">${accountFxIncomplete?'Für mindestens ein Konto fehlt ein Wechselkurs. Die Gesamtsumme und Kontoanteile können nicht korrekt berechnet werden.':'Liquide Mittel nach Konto. Tippen öffnet das jeweilige Konto.'}</p></div>
          <a class="card-link" href="/finance">Geld öffnen</a>
        </div>
        <div class="statistics-account-list">${accountRowsHtml(model.accounts,{locale,privacyEnabled})}</div>
      </article>
    </section>
  `;
}
