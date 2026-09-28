import { dataTable, formShell, metricCard, pageHeader, deleteButton } from '../app/components.js';
import { escapeHtml, money, monthInputValue, monthLabel, progress } from '../app/format.js';
import { icon } from '../app/icons.js';

export function renderBudget({ budgets = [], categories = [], transactions = [], household, profile } = {}) {
  const currency = household?.base_currency || 'CHF';
  const locale = profile?.locale || 'de-CH';
  const currentMonth = monthInputValue();
  const monthStart = `${currentMonth}-01`;
  const expenseCategories = categories.filter((c)=>c.kind==='expense');
  const fields = `
    <label class="field"><span>Monat</span><input class="text-control" name="month" type="month" value="${currentMonth}" required></label>
    <label class="field"><span>Kategorie</span><select class="text-control" name="categoryId" required>${expenseCategories.map((c)=>`<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('')}</select></label>
    <label class="field form-grid-span"><span>Budgetbetrag</span><input class="text-control" name="amount" type="number" min="0" step="0.01" required></label>`;

  const monthBudgets = budgets.filter((b)=>String(b.month_start).slice(0,7)===currentMonth);
  const monthTx = transactions.filter((tx)=>String(tx.occurred_at).slice(0,7)===currentMonth && Number(tx.amount)<0 && !tx.transfer_group_id);
  const totalBudget = monthBudgets.reduce((s,b)=>s+Number(b.amount),0);
  const totalSpent = Math.abs(monthTx.reduce((s,t)=>s+Number(t.amount),0));
  const left = totalBudget-totalSpent;
  const rows = monthBudgets.map((b)=>{
    const spent = Math.abs(monthTx.filter((t)=>t.category_id===b.category_id).reduce((s,t)=>s+Number(t.amount),0));
    const pct = progress(spent,b.amount);
    return `<tr><td><strong>${escapeHtml(b.categories?.name||'')}</strong></td><td>${money(b.amount,{currency,locale})}</td><td>${money(spent,{currency,locale})}</td><td><div class="progress-track table-progress"><div class="progress-fill ${pct>=100?'progress-fill--red':pct>=80?'progress-fill--orange':''}" style="--progress:${pct}%"></div></div><div class="table-meta">${pct.toFixed(0)} %</div></td><td>${deleteButton('budgets',b.id)}</td></tr>`;
  });

  return `
    ${pageHeader({title:'Budget',subtitle:`Kategorie-Budgets für ${monthLabel(monthStart,locale)}. Soll und Ist werden aus echten Transaktionen berechnet.`,actions:`<button class="action-button action-button--primary" type="button" data-action="show-form" data-target="budget-create" ${expenseCategories.length?'':'disabled'}>${icon('plus')} Budget</button>`})}
    ${expenseCategories.length?'':`<div class="inline-alert"><strong>Ausgabenkategorie fehlt.</strong><span>Lege zuerst mindestens eine Ausgabenkategorie an.</span></div>`}
    ${formShell('budget-create','Budget festlegen','Gleiche Kategorie + Monat wird sauber aktualisiert',fields,{hidden:true,submitLabel:'Budget speichern'})}
    <div class="metric-grid" style="margin-bottom:16px">
      ${metricCard('Budget gesamt',money(totalBudget,{currency,locale}),monthLabel(monthStart,locale))}
      ${metricCard('Ausgegeben',money(totalSpent,{currency,locale}),'alle Ausgaben im Monat')}
      ${metricCard('Frei im Budget',money(left,{currency,locale}),left>=0?'innerhalb Budget':'Budget überschritten',left>=0?'positive':'warning')}
    </div>
    <article class="card card-padding">${dataTable({headers:['Kategorie','Budget','Ist','Nutzung',''],rows,emptyText:'Für diesen Monat ist noch kein Kategorie-Budget angelegt.'})}</article>`;
}
