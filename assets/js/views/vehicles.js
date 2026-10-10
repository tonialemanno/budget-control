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

  const paymentCards = vehicles.map(v=>{
    const name=String(v.name||'').toLowerCase();
    const token=name.split(/\s+/)[0];
    const debt=debts.find(d=>token.length>=3 && String(d.name||'').toLowerCase().includes(token));
    const payments=transactions.filter(tx=>tx.vehicle_id===v.id && tx.status==='booked' &&
      tx.cashflow_type==='debt_payment' && Number(tx.amount)<0).sort((a,b)=>String(a.occurred_at).localeCompare(String(b.occurred_at)));
    if (!v.purchase_price && !payments.length && !debt) return '';
    const purchase=Number(v.purchase_price||0);
    const paid=payments.reduce((n,tx)=>n+Math.abs(Number(tx.amount||0)),0);
    const monthly=Number(debt?.installment_amount||v.monthly_cost||0);
    const bars=payments.slice(-24).map(tx=>{
      const value=Math.abs(Number(tx.amount||0));
      const ratio=Math.max(5,Math.min(100,Math.round(value/Math.max(monthly,1)*100)));
      const label=dateLabel(tx.occurred_at,locale)+' · '+money(value,{currency:tx.currency||currency,locale});
      return '<span title="'+escapeHtml(label)+'" style="height:75px;min-width:6px;flex:1;display:flex;align-items:flex-end"><span style="width:100%;height:'+ratio+'%;background:var(--color-primary,#4774a5);border-radius:3px 3px 0 0"></span></span>';
    }).join('');
    return '<article class="card card-padding" style="margin-bottom:16px"><h3 class="card-title">'+escapeHtml(v.name||'Fahrzeug')+' · Kosten und Zahlungen</h3>'
      +'<div class="mini-detail-list">'
      +(purchase>0?'<span>Kaufpreis <strong>'+money(purchase,{currency:v.currency||currency,locale})+'</strong></span>':'')
      +(v.purchase_date?'<span>Kaufdatum <strong>'+dateLabel(v.purchase_date,locale)+'</strong></span>':'')
      +(debt?.start_date?'<span>Leasingbeginn <strong>'+dateLabel(debt.start_date,locale)+'</strong></span>':'')
      +(monthly>0?'<span>Monatliche Rate <strong>'+money(monthly,{currency:debt?.currency||currency,locale})+'</strong></span>':'')
      +(payments.length?'<span>Bereits bezahlt ('+payments.length+' Raten) <strong>'+money(paid,{currency:debt?.currency||currency,locale})+'</strong></span>':'')
      +'</div>'
      +(payments.length?'<p class="card-subtitle">Monatliche Zahlungen</p><div style="display:flex;gap:5px;align-items:flex-end;border-bottom:1px solid var(--border-color,#ddd);padding:12px 0">'+bars+'</div>':'')
      +'</article>';
  }).join('');
  const rows = vehicles.map((v)=>`<tr><td><strong>${escapeHtml(v.name)}</strong><div class="table-meta">${escapeHtml(v.vehicle_type)}${v.license_plate?` · ${escapeHtml(v.license_plate)}`:''}</div></td><td>${money(v.current_value,{currency:v.currency||currency,locale})}</td><td>${money(v.monthly_cost,{currency:v.currency||currency,locale})}</td><td>${v.odometer_km==null?'—':`${Number(v.odometer_km).toLocaleString(locale)} km`}</td><td>${dateLabel(v.purchase_date,locale)}</td><td><div class="table-actions">${canWrite?`<button class="table-action" type="button" data-action="vehicle-edit" data-id="${v.id}">Bearbeiten</button>${deleteButton('vehicles',v.id)}`:''}</div></td></tr>`);
  return `
    ${pageHeader({title:'Fahrzeuge / Mobilität',subtitle:'Fahrzeugwert, laufende Kosten und optional Kilometerstand. Leasing kann zusätzlich als Schuld erfasst werden.',actions:canWrite?`<button class="action-button action-button--primary" type="button" data-action="show-form" data-target="vehicle-create">${icon('plus')} Fahrzeug</button>`:''})}
    ${canWrite?formShell('vehicle-create','Neues Fahrzeug','Wert und laufende Kosten',fields(),{hidden:true,submitLabel:'Fahrzeug speichern'}):''}
    ${canWrite?formShell('vehicle-edit','Fahrzeug bearbeiten','Wert, Kosten und Kilometerstand aktualisieren',fields({edit:true}),{hidden:true,submitLabel:'Änderungen speichern'}):''}
    <div class="metric-grid" style="margin-bottom:16px">${metricCard('Fahrzeugwert',money(total,{currency,locale}),`${vehicles.length} Fahrzeuge`)}${metricCard('Kosten / Monat',money(monthly,{currency,locale}),'laufende Kosten')}${metricCard('Positionen',String(vehicles.length),'Mobilitätsobjekte')}</div>
    ${paymentCards}
    <article class="card card-padding">${dataTable({headers:['Fahrzeug','Wert','Kosten/Monat','KM','Kaufdatum',''],rows,emptyText:'Noch keine Fahrzeuge.'})}</article>`;
}
