import { dataTable, formShell, metricCard, pageHeader, deleteButton } from '../app/components.js';
import { escapeHtml, money, monthLabel, progress } from '../app/format.js';
import { icon } from '../app/icons.js';
import { buildBudgetPatterns, calculateBudgetSummary } from '../app/budget-engine.js';
import { financeCycleLabel } from '../app/finance-cycle.js';

function sourceLabel(pattern){
  if(pattern.source==='known_recurring') return 'Bekannte Verpflichtung';
  if(pattern.source==='detected_cadence') return `Erkannter Rhythmus: ${pattern.cadence?.label||'regelmässig'}`;
  return `Gesamte Historie: ${pattern.observedMonths} Monate`;
}

function budgetRow(row,{currency,locale,canWrite}){
  const pct=progress(row.spent,row.amount);
  const label=row.merchants?.name||row.categories?.name||'Budget';
  const scope=row.merchant_id?'Händler':'Kategorie';
  const meta=`${scope}${row._inherited?' · aus vorherigem Finanzmonat übernommen':''}`;
  return `<tr>
    <td><strong>${escapeHtml(label)}</strong><div class="table-meta">${escapeHtml(meta)}</div></td>
    <td>${money(row.amount,{currency:row.currency||currency,locale})}</td>
    <td>${money(row.spent,{currency,locale})}</td>
    <td><div class="progress-track table-progress"><div class="progress-fill ${pct>=100?'progress-fill--red':pct>=80?'progress-fill--orange':''}" style="--progress:${Math.min(100,pct)}%"></div></div><div class="table-meta">${pct.toFixed(0)} %</div></td>
    <td>${canWrite&&!row._inherited?deleteButton('budgets',row.id):''}</td>
  </tr>`;
}

function legacyRow(row,{currency,locale,type}){
  const label=row.merchants?.name||row.categories?.name||'Position';
  return `<tr>
    <td><strong>${escapeHtml(label)}</strong><div class="table-meta">${escapeHtml(type)}</div></td>
    <td>${money(row.amount,{currency:row.currency||currency,locale})}</td>
    <td colspan="3"><span class="status-pill status-pill--neutral">Nicht im variablen Budget</span></td>
  </tr>`;
}

export function renderBudget({
  budgets=[],categories=[],merchants=[],transactions=[],debtPayments=[],bills=[],accounts=[],recurringRules=[],
  household,profile,fxRates,canWrite=false,budgetExpandedMerchantId=null,
}={}) {
  const currency=household?.base_currency||'CHF';
  const locale=profile?.locale||'de-CH';
  const now=new Date();
  const summary=calculateBudgetSummary({
    budgets,transactions,debtPayments,categories,merchants,recurringRules,accounts,
    baseCurrency:currency,fxRates,now,fallbackDay:25,
  });
  const financePeriodLabel=financeCycleLabel(summary.cycle,locale);
  const currentMonth=summary.cycle.budgetMonth;
  const expenseCategories=categories.filter((row)=>row.kind==='expense');

  const fields=`
    <input name="month" type="hidden" value="${currentMonth}">
    <div class="inline-alert form-grid-span"><strong>Aktueller Finanzmonat · ${escapeHtml(financePeriodLabel)}</strong><span>Das Budget gilt für diese laufende Periode und wird automatisch in den nächsten Finanzmonat übernommen, bis du es änderst.</span></div>
    <label class="field"><span>Budget für</span><select class="text-control" name="scopeType" id="budgetScopeType"><option value="category">Kategorie</option><option value="merchant">Händler</option></select></label>
    <label class="field" id="budgetCategoryField"><span>Kategorie</span><select class="text-control" name="categoryId">${expenseCategories.map((row)=>`<option value="${row.id}">${escapeHtml(row.name)}</option>`).join('')}</select></label>
    <label class="field" id="budgetMerchantField" hidden><span>Händler</span><select class="text-control" name="merchantId"><option value="">Bitte wählen</option>${merchants.map((row)=>`<option value="${row.id}">${escapeHtml(row.name)}</option>`).join('')}</select></label>
    <label class="field"><span>Budgetbetrag</span><input class="text-control" name="amount" type="number" min="0" step="0.01" required placeholder="z. B. 350"></label>`;

  const variableRows=summary.variableRows.map((row)=>budgetRow(row,{currency,locale,canWrite}));

  const excludedRows=[
    ...summary.fixedRows.map((row)=>legacyRow(row,{currency,locale,type:'Fixkosten – werden aus Wiederkehrend berechnet'})),
    ...summary.savingRows.map((row)=>legacyRow(row,{currency,locale,type:'Sparen / Rücklage – keine Ausgabe'})),
    ...summary.taxRows.map((row)=>legacyRow(row,{currency,locale,type:'Steuern – eigener Planungsbereich'})),
  ];

  const effectiveIds=new Set([...summary.variableRows,...summary.fixedRows,...summary.savingRows,...summary.taxRows].map((row)=>row.id).filter(Boolean));
  const otherStoredBudgets=budgets
    .filter((row)=>!effectiveIds.has(row.id))
    .slice()
    .sort((a,b)=>String(b.month_start).localeCompare(String(a.month_start)));
  const otherStoredRows=otherStoredBudgets.map((row)=>{
    const label=row.merchants?.name||row.categories?.name||'Budget';
    const period=monthLabel(row.month_start,locale);
    return `<tr><td><strong>${escapeHtml(label)}</strong><div class="table-meta">Gespeichert für ${escapeHtml(period)}</div></td><td>${money(row.amount,{currency:row.currency||currency,locale})}</td><td colspan="2"><span class="status-pill status-pill--neutral">Nicht aktuelle Periode</span></td><td>${canWrite?deleteButton('budgets',row.id):''}</td></tr>`;
  });

  const existingScopes=new Set(summary.variableRows.map((row)=>row.merchant_id?`merchant:${row.merchant_id}`:`category:${row.category_id}`));
  const patterns=buildBudgetPatterns({
    transactions,categories,merchants,recurringRules,debtPayments,baseCurrency:currency,fxRates,now,minTransactions:2,
  }).slice(0,18);

  const patternCards=patterns.map((pattern)=>{
    const expanded=budgetExpandedMerchantId===pattern.key;
    const fixed=pattern.source==='known_recurring'||pattern.semantic==='fixed_expense';
    const scopeKey=pattern.merchant?.id?`merchant:${pattern.merchant.id}`:`category:${pattern.category.id}`;
    const alreadyBudgeted=existingScopes.has(scopeKey);
    const detail=expanded?`
      <div class="budget-pattern-details">
        <div class="inline-alert"><strong>So rechnet Finance</strong><span>
          ${fixed
            ? `Bekannte Verpflichtung: ${money(pattern.monthly,{currency,locale})} pro Monat. Historische Durchschnittswerte überschreiben diesen Betrag nicht.`
            : pattern.source==='detected_cadence'
              ? `${pattern.rows.length} Buchungen seit ${new Intl.DateTimeFormat(locale).format(pattern.firstDate)}. ${sourceLabel(pattern)} → ${money(pattern.monthly,{currency,locale})} pro Monat.`
              : `${money(pattern.total,{currency,locale})} über den vollständigen beobachteten Zeitraum von ${pattern.observedMonths} Monaten → ${money(pattern.monthly,{currency,locale})} pro Monat.`}
        </span></div>
        <div class="table-scroll budget-pattern-scroll"><table class="data-table"><thead><tr><th>Datum</th><th>Buchung</th><th>Kategorie</th><th>Betrag</th><th></th></tr></thead><tbody>
          ${pattern.rows.slice().sort((a,b)=>String(b.occurred_at).localeCompare(String(a.occurred_at))).map((tx)=>`<tr>
            <td>${escapeHtml(new Intl.DateTimeFormat(locale).format(new Date(tx.occurred_at)))}</td>
            <td><strong>${escapeHtml(tx.merchants?.name||tx.description||'Buchung')}</strong><div class="table-meta">${escapeHtml(tx.counterparty||'')}</div></td>
            <td>${escapeHtml(tx.categories?.name||pattern.category.name||'Ohne Kategorie')}</td>
            <td>${money(Math.abs(Number(tx.amount)),{currency:tx.currency||currency,locale})}</td>
            <td>${canWrite?`<button class="table-action" type="button" data-action="budget-transaction-edit" data-id="${tx.id}">Bearbeiten</button>`:''}</td>
          </tr>`).join('')}
        </tbody></table></div>
      </div>`:'';

    const canAdopt=canWrite&&!fixed&&!alreadyBudgeted&&(pattern.merchant?.id||pattern.category.id);
    return `<div class="suggestion-card budget-pattern-card">
      <div class="budget-pattern-head">
        <div>
          <strong>${escapeHtml(pattern.merchant?.name||pattern.rows[0]?.counterparty||pattern.rows[0]?.description||pattern.category.name)}</strong>
          <span>${escapeHtml(pattern.category.name)} · ${pattern.rows.length} Buchungen · ${money(pattern.total,{currency,locale})} gesamt</span>
          <small>${escapeHtml(sourceLabel(pattern))} · Monatswert ${money(pattern.monthly,{currency,locale})}${fixed?' · Fixkosten':''}</small>
        </div>
        <div class="row-actions">
          <button class="table-action" type="button" data-action="budget-suggestion-toggle" data-merchant-id="${escapeHtml(pattern.key)}">${expanded?'Buchungen schliessen':'Warum?'}</button>
          ${canAdopt?`<button class="table-action" type="button" data-action="budget-suggestion" data-merchant-id="${pattern.merchant?.id||''}" data-category-id="${pattern.category.id||''}" data-month="${currentMonth}" data-amount="${pattern.suggested}">Als Budget ${money(pattern.suggested,{currency,locale,decimals:0})}</button>`:''}
          ${fixed?'<a class="table-action" href="#/fixed-costs">Fixkosten öffnen</a>':''}
        </div>
      </div>
      ${detail}
    </div>`;
  }).join('');

  return `
    ${pageHeader({
      title:'Budget',
      subtitle:'Variable Budgets, Fixkosten, Rücklagen und Steuern werden getrennt geplant.',
      actions:canWrite?`<button class="action-button action-button--primary" type="button" data-action="show-form" data-target="budget-create" ${(expenseCategories.length||merchants.length)?'':'disabled'}>${icon('plus')} Variables Budget</button>`:''
    })}
    ${formShell('budget-create','Variables Budget festlegen','Einmal festlegen, danach übernimmt Finance den Wert automatisch in den nächsten Finanzmonat.',fields,{hidden:true,submitLabel:'Budget speichern'})}

    <div class="metric-grid" style="margin-bottom:16px">
      ${metricCard('Variables Budget',money(summary.total,{currency,locale}),`${summary.count} echte Budgetposition${summary.count===1?'':'en'}`)}
      ${metricCard('Variabel ausgegeben',money(summary.spent,{currency,locale}),summary.rawPercent>100?`${Math.round(summary.rawPercent)} % · ${money(summary.overBy,{currency,locale})} darüber`:`${Math.round(summary.rawPercent)} % verbraucht`,summary.rawPercent>100?'warning':'')}
      ${metricCard('Noch verfügbar',money(summary.remaining,{currency,locale}),'nur variables Budget',summary.remaining>0?'positive':'')}
      ${metricCard('Fixkosten geplant',money(summary.fixedPlanned,{currency,locale}),'aus Wiederkehrend – nicht im Budget')}
      ${metricCard('Sparen / Umbuchen',money(summary.savingMoved,{currency,locale}),'keine Konsumausgabe')}
      ${metricCard('Steuern bezahlt',money(summary.taxSpent,{currency,locale}),'eigener Planungsbereich')}
    </div>

    <article class="card card-padding" style="margin-bottom:16px">
      <div class="card-heading"><div><h3 class="card-title">Variable Budgets</h3><p class="card-subtitle">Nur diese Positionen bestimmen den Budget-Prozentwert.</p></div></div>
      ${dataTable({headers:['Budget','Soll','Ist','Nutzung',''],rows:variableRows,emptyText:'Noch kein variables Budget eingerichtet.'})}
    </article>

    ${excludedRows.length?`<article class="card card-padding" style="margin-bottom:16px">
      <div class="card-heading"><div><h3 class="card-title">Nicht im variablen Budget</h3><p class="card-subtitle">Alte Budgeteinträge, die fachlich Fixkosten, Sparen oder Steuern sind. Sie verzerren den Prozentwert nicht mehr.</p></div></div>
      ${dataTable({headers:['Position','Gespeicherter Altwert','Behandlung','',''],rows:excludedRows,emptyText:''})}
    </article>`:''}

    ${otherStoredRows.length?`<article class="card card-padding" style="margin-bottom:16px">
      <div class="card-heading"><div><h3 class="card-title">Weitere gespeicherte Budgetperioden</h3><p class="card-subtitle">Nichts verschwindet mehr still: Budgets ausserhalb des aktuell angezeigten Finanzmonats bleiben hier sichtbar.</p></div></div>
      ${dataTable({headers:['Budget','Betrag','Status','',''],rows:otherStoredRows,emptyText:''})}
    </article>`:''}

    ${patterns.length?`<article class="card card-padding">
      <div class="card-heading"><div><h3 class="card-title">Ausgabenmuster</h3><p class="card-subtitle">Finance verwendet die gesamte verfügbare Historie und bekannte Verpflichtungen. Keine starre 3-Monats-Regel.</p></div></div>
      <div class="suggestion-grid">${patternCards}</div>
    </article>`:''}
  `;
}
