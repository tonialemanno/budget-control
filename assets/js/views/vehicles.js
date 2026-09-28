import { dataTable, formShell, metricCard, pageHeader, deleteButton } from '../app/components.js';
import { dateLabel, escapeHtml, money } from '../app/format.js';
import { icon } from '../app/icons.js';

export function renderVehicles({ vehicles = [], household, profile } = {}) {
  const currency = household?.base_currency || 'CHF';
  const locale = profile?.locale || 'de-CH';
  const total = vehicles.reduce((s,v)=>s+Number(v.current_value||0),0);
  const monthly = vehicles.reduce((s,v)=>s+Number(v.monthly_cost||0),0);
  const fields = `
    <label class="field"><span>Name</span><input class="text-control" name="name" required placeholder="z. B. VW Golf"></label>
    <label class="field"><span>Art</span><select class="text-control" name="vehicleType"><option value="car">Auto</option><option value="motorcycle">Motorrad</option><option value="bike">Fahrrad</option><option value="other">Sonstiges</option></select></label>
    <label class="field"><span>Aktueller Wert</span><input class="text-control" name="currentValue" type="number" min="0" step="0.01" required></label>
    <label class="field"><span>Kaufpreis</span><input class="text-control" name="purchasePrice" type="number" min="0" step="0.01"></label>
    <label class="field"><span>Kaufdatum</span><input class="text-control" name="purchaseDate" type="date"></label>
    <label class="field"><span>Kosten / Monat</span><input class="text-control" name="monthlyCost" type="number" min="0" step="0.01" value="0"></label>`;
  const rows = vehicles.map((v)=>`<tr><td><strong>${escapeHtml(v.name)}</strong><div class="table-meta">${escapeHtml(v.vehicle_type)}</div></td><td>${money(v.current_value,{currency:v.currency||currency,locale})}</td><td>${money(v.monthly_cost,{currency:v.currency||currency,locale})}</td><td>${dateLabel(v.purchase_date,locale)}</td><td>${deleteButton('vehicles',v.id)}</td></tr>`);
  return `
    ${pageHeader({title:'Fahrzeuge / Mobilität',subtitle:'Fahrzeugwert und laufende Mobilitätskosten. Leasing kann zusätzlich als Schuld erfasst werden.',actions:`<button class="action-button action-button--primary" type="button" data-action="show-form" data-target="vehicle-create">${icon('plus')} Fahrzeug</button>`})}
    ${formShell('vehicle-create','Neues Fahrzeug','Wert und laufende Kosten',fields,{hidden:true,submitLabel:'Fahrzeug speichern'})}
    <div class="metric-grid" style="margin-bottom:16px">${metricCard('Fahrzeugwert',money(total,{currency,locale}),`${vehicles.length} Fahrzeuge`)}${metricCard('Kosten / Monat',money(monthly,{currency,locale}),'manuell erfasste laufende Kosten')}${metricCard('Positionen',String(vehicles.length),'Mobilitätsobjekte')}</div>
    <article class="card card-padding">${dataTable({headers:['Fahrzeug','Wert','Kosten/Monat','Kaufdatum',''],rows,emptyText:'Noch keine Fahrzeuge.'})}</article>`;
}
