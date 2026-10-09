import { dataTable, formShell, metricCard, pageHeader, deleteButton } from '../app/components.js';
import { dateLabel, escapeHtml, money } from '../app/format.js';
import { convertAmount } from '../app/fx.js';
import { icon } from '../app/icons.js';

function fields({ edit=false }={}) {
  const p=edit?'vehicleEdit':'';
  return `${edit?'<input type="hidden" name="vehicleId" id="vehicleEditId">':''}
    <label class="field"><span>Name</span><input class="text-control" name="name" ${edit?`id="${p}Name"`:''} required placeholder="z. B. VW Golf"></label>
    <label class="field"><span>Art</span><select class="text-control" name="vehicleType" ${edit?`id="${p}Type"`:''}><option value="car">Auto</option><option value="motorcycle">Motorrad</option><option value="bike">Fahrrad</option><option value="other">Sonstiges</option></select></label>
    <label class="field"><span>Aktueller Wert</span><input class="text-control" name="currentValue" ${edit?`id="${p}Value"`:''} type="number" min="0" step="0.01" required></label>
    <label class="field"><span>Kaufpreis</span><input class="text-control" name="purchasePrice" ${edit?`id="${p}PurchasePrice"`:''} type="number" min="0" step="0.01"></label>
    <label class="field"><span>Kaufdatum</span><input class="text-control" name="purchaseDate" ${edit?`id="${p}PurchaseDate"`:''} type="date"></label>
    <label class="field"><span>Kosten / Monat</span><input class="text-control" name="monthlyCost" ${edit?`id="${p}MonthlyCost"`:''} type="number" min="0" step="0.01" value="0"></label>
    <label class="field"><span>Kilometerstand</span><input class="text-control" name="odometerKm" ${edit?`id="${p}Odometer"`:''} type="number" min="0" step="1" placeholder="optional"></label>
    <label class="field"><span>Kennzeichen</span><input class="text-control" name="licensePlate" ${edit?`id="${p}Plate"`:''} placeholder="optional"></label>`;
}

export function renderVehicles({ vehicles = [], debts = [], transactions = [], household, profile, fxRates, canWrite=false } = {}) {
  const currency = household?.base_currency || 'CHF';
  const locale = profile?.locale || 'de-CH';
  const total = vehicles.reduce((s,v)=>s+(convertAmount(v.current_value,v.currency||currency,currency,fxRates)??0),0);
  const monthly = vehicles.reduce((s,v)=>s+(convertAmount(v.monthly_cost,v.currency||currency,currency,fxRates)??0),0);
  const demoFinanceCards=vehicles.filter(v=>String(v.notes||'').includes('Fiktiv:')).map(v=>{
    const debt=debts.find(d=>String(d.name||'').includes('Kodiaq') && String(v.name||'').includes('Kodiaq'));
    if(!debt) return '';
    const payments=transactions.filter(t=>t.vehicle_id===v.id && t.cashflow_type==='debt_payment' && t.status==='booked' && Number(t.amount)<0).sort((a,b)=>String(a.occurred_at).localeCompare(String(b.occurred_at)));
    const paid=payments.reduce((sum,t)=>sum+Math.abs(Number(t.amount||0)),0);
    const downPayment=Math.max(0,Number(v.purchase_price||0)-Number(debt.original_amount||0));
    const values=payments.map(p=>Math.abs(Number(p.amount||0)));
    const max=Math.max(1,...values);
    const bars=payments.map((p,i)=>`<div title="${escapeHtml(dateLabel(p.occurred_at,locale))} · ${escapeHtml(money(values[i],{currency,locale}))}" style="flex:1;min-width:5px;height:70px;display:flex;align-items:end"><span style="width:100%;height:${Math.max(4,values[i]/max*100)}%;background:var(--color-primary,#4774a5);border-radius:3px 3px 0 0"></span></div>`).join('');
    return `<article class="card card-padding" style="margin-bottom:16px"><h3 class="card-title">${escapeHtml(v.name)} · Anschaffung und Zahlungen</h3><div class="mini-detail-list"><span>Kaufpreis <strong>${money(v.purchase_price,{currency,locale})}</strong></span><span>Anzahlung <strong>${money(downPayment,{currency,locale})}</strong></span><span>Finanziert <strong>${money(debt.original_amount,{currency,locale})}</strong></span><span>Leasingbeginn <strong>${dateLabel(debt.start_date,locale)}</strong></span><span>Rate pro Monat <strong>${money(debt.installment_amount,{currency,locale})}</strong></span><span>Bereits bezahlt (${payments.length} Raten) <strong>${money(paid,{currency,locale})}</strong></span><span>Gesamt bezahlt inkl. Anzahlung <strong>${money(paid+downPayment,{currency,locale})}</strong></span></div><p class="card-subtitle">Monatliche Leasingzahlungen</p><div style="display:flex;align-items:end;gap:5px;border-bottom:1px solid var(--border-color,#ddd);padding:12px 0">${bars}</div></article>`;
  }).join('');
  const rows = vehicles.map((v)=>`<tr><td><strong>${escapeHtml(v.name)}</strong><div class="table-meta">${escapeHtml(v.vehicle_type)}${v.license_plate?` · ${escapeHtml(v.license_plate)}`:''}</div></td><td>${money(v.current_value,{currency:v.currency||currency,locale})}</td><td>${money(v.monthly_cost,{currency:v.currency||currency,locale})}</td><td>${v.odometer_km==null?'—':`${Number(v.odometer_km).toLocaleString(locale)} km`}</td><td>${dateLabel(v.purchase_date,locale)}</td><td><div class="table-actions">${canWrite?`<button class="table-action" type="button" data-action="vehicle-edit" data-id="${v.id}">Bearbeiten</button>${deleteButton('vehicles',v.id)}`:''}</div></td></tr>`);
  return `
    ${pageHeader({title:'Fahrzeuge / Mobilität',subtitle:'Fahrzeugwert, laufende Kosten und optional Kilometerstand. Leasing kann zusätzlich als Schuld erfasst werden.',actions:canWrite?`<button class="action-button action-button--primary" type="button" data-action="show-form" data-target="vehicle-create">${icon('plus')} Fahrzeug</button>`:''})}
    ${canWrite?formShell('vehicle-create','Neues Fahrzeug','Wert und laufende Kosten',fields(),{hidden:true,submitLabel:'Fahrzeug speichern'}):''}
    ${canWrite?formShell('vehicle-edit','Fahrzeug bearbeiten','Wert, Kosten und Kilometerstand aktualisieren',fields({edit:true}),{hidden:true,submitLabel:'Änderungen speichern'}):''}
    <div class="metric-grid" style="margin-bottom:16px">${metricCard('Fahrzeugwert',money(total,{currency,locale}),`${vehicles.length} Fahrzeuge`)}${metricCard('Kosten / Monat',money(monthly,{currency,locale}),'laufende Kosten')}${metricCard('Positionen',String(vehicles.length),'Mobilitätsobjekte')}</div>
    ${demoFinanceCards}
    <article class="card card-padding">${dataTable({headers:['Fahrzeug','Wert','Kosten/Monat','KM','Kaufdatum',''],rows,emptyText:'Noch keine Fahrzeuge.'})}</article>`;
}
