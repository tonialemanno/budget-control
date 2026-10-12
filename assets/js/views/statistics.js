import { pageHeader } from '../app/components.js';
import { dateLabel, escapeHtml, money } from '../app/format.js';
import { icon } from '../app/icons.js';
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

function metric(label,value,note='',tone=''){
  return `<article class="statistics-metric ${tone?`statistics-metric--${tone}`:''}">
    <span>${escapeHtml(label)}</span>
    <strong>${value}</strong>
    ${note?`<small>${escapeHtml(note)}</small>`:''}
  </article>`;
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

function budgetRowsHtml(rows,{currency,locale,privacyEnabled}){
  if(!rows.length) return '<div class="table-empty">Noch keine variablen Budgetrahmen vorhanden.</div>';
  return rows.map((row)=>{
    const tone=row.rawPercent>100?'negative':row.rawPercent>=80?'warning':'positive';
    return `<button class="statistics-budget-row" type="button" data-action="statistics-drilldown-budget" data-merchant-id="${escapeHtml(row.merchantId||'')}" data-category-ids="${escapeHtml(row.categoryIds.join(','))}" data-transaction-ids="${escapeHtml((row.transactionIds||[]).join(','))}">
      <div class="statistics-budget-head">
        <div><strong>${escapeHtml(row.label)}</strong><small>${row.transactionCount} Buchung${row.transactionCount===1?'':'en'}</small></div>
        <div><strong>${privacyMoney(row.spent,{currency,locale,privacyEnabled})} / ${privacyMoney(row.amount,{currency,locale,privacyEnabled})}</strong><small>${Math.round(row.rawPercent)}%</small></div>
      </div>
      <div class="statistics-progress statistics-progress--${tone}"><span style="--statistics-progress:${Math.min(100,Math.max(0,row.percent))}%"></span></div>
      <div class="statistics-budget-foot"><span>${row.overBy>0?'Über Budget':'Noch verfügbar'}</span><strong>${privacyMoney(row.overBy>0?row.overBy:row.remaining,{currency,locale,privacyEnabled})}</strong></div>
    </button>`;
  }).join('');
}

function accountRowsHtml(rows,{locale,privacyEnabled}){
  if(!rows.length) return '<div class="table-empty">Noch keine liquiden Konten vorhanden.</div>';
  return rows.map((row)=>`<button class="statistics-account-row" type="button" data-drilldown="account-edit" data-id="${escapeHtml(row.account.account_id)}">
    <div><strong>${escapeHtml(row.account.name)}</strong><small>${escapeHtml(row.account.currency)} · ${Math.round(row.share)}% der liquiden Mittel</small></div>
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

  return `
    ${pageHeader({
      kicker:'Auswertung',
      title:'Statistik',
      subtitle:'Trends, Kategorien und Budgets aus denselben Buchungen wie deine Übersicht – jede Zahl führt zurück zu den zugrunde liegenden Transaktionen.',
      actions:'<a class="action-button action-button--secondary" href="/finance/transactions">Alle Buchungen</a><a class="action-button action-button--primary" href="/planning/budget">Budget öffnen</a>'
    })}

    <section class="statistics-metric-grid">
      ${metric('Einnahmen · aktueller Finanzmonat',privacyMoney(current.income,{currency,locale,privacyEnabled}),currentLabel,'income')}
      ${metric('Ausgaben · aktueller Finanzmonat',privacyMoney(current.expenses,{currency,locale,privacyEnabled}),currentLabel,'expense')}
      ${metric(net>=0?'Überschuss':'Defizit',privacyMoney(Math.abs(net),{currency,locale,privacyEnabled}),currentLabel,net>=0?'positive':'negative')}
      ${metric('Sparquote',`${Math.round(current.savingsRate||0)}%`,`${current.transactionCount} gebuchte Bewegungen`,current.savingsRate>=0?'positive':'negative')}
    </section>

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
        ${renderExpenseDonut({rows:model.categories,total:model.categoryTotal,currency,locale,privacy:privacyEnabled})}
      </article>

      <article class="card card-padding">
        <div class="card-heading">
          <div><h3 class="card-title">Budgetfortschritt</h3><p class="card-subtitle">Wie viel deines variablen Rahmens bereits verbraucht ist.</p></div>
          <a class="card-link" href="/planning/budget">Bearbeiten</a>
        </div>
        <div class="statistics-budget-list">${budgetRowsHtml(budgetRows,{currency,locale,privacyEnabled})}</div>
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
          <div><h3 class="card-title">Kontostände</h3><p class="card-subtitle">Liquide Mittel nach Konto. Tippen öffnet das jeweilige Konto.</p></div>
          <a class="card-link" href="/finance">Geld öffnen</a>
        </div>
        <div class="statistics-account-list">${accountRowsHtml(model.accounts,{locale,privacyEnabled})}</div>
      </article>
    </section>
  `;
}
