import { dataTable, formShell, metricCard, pageHeader, deleteButton } from '../app/components.js';
import { escapeHtml, money } from '../app/format.js';
import { icon } from '../app/icons.js';

export function renderWealth({ accounts = [], assets = [], properties = [], vehicles = [], investments = [], pensions = [], debts = [], household, profile } = {}) {
  const currency = household?.base_currency || 'CHF';
  const locale = profile?.locale || 'de-CH';
  const cash = accounts.filter((a)=>['checking','savings','cash'].includes(a.account_type)).reduce((s,a)=>s+Number(a.current_balance||0),0);
  const assetValue = assets.reduce((s,a)=>s+Number(a.current_value||0),0);
  const propertyValue = properties.reduce((s,a)=>s+Number(a.current_value||0),0);
  const vehicleValue = vehicles.reduce((s,a)=>s+Number(a.current_value||0),0);
  const investmentValue = investments.reduce((s,a)=>s+Number(a.current_value||0),0);
  const pensionValue = pensions.reduce((s,a)=>s+Number(a.current_value||0),0);
  const debtValue = debts.filter((d)=>d.status!=='paid').reduce((s,d)=>s+Number(d.outstanding_amount||0),0);
  const totalAssets = cash+assetValue+propertyValue+vehicleValue+investmentValue+pensionValue;
  const netWorth = totalAssets-debtValue;
  const fields = `
    <label class="field"><span>Name</span><input class="text-control" name="name" required placeholder="z. B. Uhrensammlung"></label>
    <label class="field"><span>Art</span><select class="text-control" name="assetType"><option value="valuable">Wertgegenstand</option><option value="business_interest">Beteiligung</option><option value="cash_other">Sonstiges Geldvermögen</option><option value="other">Sonstiges</option></select></label>
    <label class="field"><span>Aktueller Wert</span><input class="text-control" name="currentValue" type="number" min="0" step="0.01" required></label>
    <label class="field"><span>Erworben am</span><input class="text-control" name="acquiredDate" type="date"></label>
    <label class="field form-grid-span"><span>Notiz</span><textarea class="text-control" name="notes" rows="3"></textarea></label>`;
  const rows = assets.map((a)=>`<tr><td><strong>${escapeHtml(a.name)}</strong></td><td>${escapeHtml(a.asset_type)}</td><td>${money(a.current_value,{currency:a.currency||currency,locale})}</td><td>${deleteButton('assets',a.id)}</td></tr>`);
  return `
    ${pageHeader({title:'Vermögen',subtitle:'Kontoguthaben, Sachwerte, Immobilien, Fahrzeuge, Investments und Vorsorge minus Verbindlichkeiten.',actions:`<button class="action-button action-button--primary" type="button" data-action="show-form" data-target="asset-create">${icon('plus')} Vermögenswert</button>`})}
    ${formShell('asset-create','Sonstiger Vermögenswert','Für Werte, die keinem spezialisierten Modul angehören',fields,{hidden:true,submitLabel:'Vermögenswert speichern'})}
    <div class="grid-hero">
      <article class="card card--accent hero-card"><div><div class="hero-label">Nettovermögen</div><div class="hero-value">${money(netWorth,{currency,locale,decimals:0})}</div><div class="hero-caption">Vermögen ${money(totalAssets,{currency,locale})} · Schulden ${money(debtValue,{currency,locale})}</div></div></article>
      <div class="metric-grid">${metricCard('Liquidität',money(cash,{currency,locale}),'Konten & Bargeld')}${metricCard('Immobilien',money(propertyValue,{currency,locale}),`${properties.length} Objekte`)}${metricCard('Investments',money(investmentValue,{currency,locale}),`${investments.length} Positionen`)}${metricCard('Vorsorge',money(pensionValue,{currency,locale}),`${pensions.length} Positionen`)}</div>
    </div>
    <article class="card card-padding" style="margin-top:16px"><div class="card-heading"><div><h3 class="card-title">Sonstige Vermögenswerte</h3><p class="card-subtitle">Wertgegenstände, Beteiligungen und weitere Werte</p></div></div>${dataTable({headers:['Name','Art','Wert',''],rows,emptyText:'Noch keine sonstigen Vermögenswerte.'})}</article>`;
}
