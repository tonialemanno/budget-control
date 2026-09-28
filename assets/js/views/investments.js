import { dataTable, formShell, metricCard, pageHeader, deleteButton } from '../app/components.js';
import { escapeHtml, money } from '../app/format.js';
import { icon } from '../app/icons.js';

export function renderInvestments({ investments = [], household, profile } = {}) {
  const currency = household?.base_currency || 'CHF';
  const locale = profile?.locale || 'de-CH';
  const current = investments.reduce((s,i)=>s+Number(i.current_value||0),0);
  const cost = investments.reduce((s,i)=>s+Number(i.cost_basis||0),0);
  const gain = current-cost;
  const fields = `
    <label class="field"><span>Name</span><input class="text-control" name="name" required placeholder="z. B. Vanguard FTSE All-World"></label>
    <label class="field"><span>Typ</span><select class="text-control" name="investmentType"><option value="stock">Aktie</option><option value="etf">ETF</option><option value="fund">Fonds</option><option value="bond">Obligation</option><option value="crypto">Krypto</option><option value="cash">Cash</option><option value="other">Sonstiges</option></select></label>
    <label class="field"><span>Symbol / ISIN</span><input class="text-control" name="symbol"></label>
    <label class="field"><span>Anzahl</span><input class="text-control" name="quantity" type="number" min="0" step="0.00000001" value="0"></label>
    <label class="field"><span>Einstandswert gesamt</span><input class="text-control" name="costBasis" type="number" min="0" step="0.01" value="0"></label>
    <label class="field"><span>Aktueller Wert</span><input class="text-control" name="currentValue" type="number" min="0" step="0.01" required></label>
    <label class="field"><span>Anbieter / Depot</span><input class="text-control" name="provider"></label>`;
  const rows = investments.map((i)=>{ const pnl=Number(i.current_value)-Number(i.cost_basis); return `<tr><td><strong>${escapeHtml(i.name)}</strong><div class="table-meta">${escapeHtml(i.symbol||i.provider||'')}</div></td><td>${escapeHtml(i.investment_type)}</td><td>${Number(i.quantity||0).toLocaleString(locale)}</td><td>${money(i.cost_basis,{currency:i.currency||currency,locale})}</td><td>${money(i.current_value,{currency:i.currency||currency,locale})}</td><td class="${pnl>=0?'amount--positive':''}">${money(pnl,{currency:i.currency||currency,locale,sign:true})}</td><td>${deleteButton('investments',i.id)}</td></tr>`; });
  return `
    ${pageHeader({title:'Investments',subtitle:'Manuelle Depotpositionen als Fallback. Kursdaten-Provider werden später über Adapter angebunden.',actions:`<button class="action-button action-button--primary" type="button" data-action="show-form" data-target="investment-create">${icon('plus')} Position</button>`})}
    ${formShell('investment-create','Neue Investmentposition','Manuelle Position ohne externen Kursanbieter',fields,{hidden:true,submitLabel:'Position speichern'})}
    <div class="metric-grid" style="margin-bottom:16px">${metricCard('Aktueller Wert',money(current,{currency,locale}),`${investments.length} Positionen`)}${metricCard('Einstandswert',money(cost,{currency,locale}),'manuell erfasst')}${metricCard('Unrealisiert',money(gain,{currency,locale,sign:true}),gain>=0?'Gewinn':'Verlust',gain>=0?'positive':'warning')}</div>
    <article class="card card-padding">${dataTable({headers:['Position','Typ','Anzahl','Einstand','Aktuell','Differenz',''],rows,emptyText:'Noch keine Investmentpositionen.'})}</article>`;
}
