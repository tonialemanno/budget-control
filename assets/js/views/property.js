import { dataTable, formShell, metricCard, pageHeader, deleteButton } from '../app/components.js';
import { dateLabel, escapeHtml, money } from '../app/format.js';
import { convertAmount, fxLabel } from '../app/fx.js';
import { icon } from '../app/icons.js';

export function renderProperty({ properties = [], household, profile, fxRates } = {}) {
  const currency = household?.base_currency || 'CHF';
  const locale = profile?.locale || 'de-CH';
  const total = properties.reduce((s,p)=>s+(convertAmount(p.current_value,p.currency||currency,currency,fxRates)??0),0);
  const monthly = properties.reduce((s,p)=>s+(convertAmount(p.monthly_running_cost,p.currency||currency,currency,fxRates)??0),0);
  const reserve = properties.reduce((s,p)=>s+(convertAmount(p.renovation_reserve,p.currency||currency,currency,fxRates)??0),0);
  const fields = `
    <label class="field"><span>Name</span><input class="text-control" name="name" required placeholder="z. B. Eigentumswohnung"></label>
    <label class="field"><span>Art</span><select class="text-control" name="propertyType"><option value="home">Eigenheim</option><option value="apartment">Wohnung</option><option value="land">Grundstück</option><option value="investment">Renditeobjekt</option><option value="other">Sonstiges</option></select></label>
    <label class="field"><span>Aktueller Wert</span><input class="text-control" name="currentValue" type="number" min="0" step="0.01" required></label>
    <label class="field"><span>Kaufpreis</span><input class="text-control" name="purchasePrice" type="number" min="0" step="0.01"></label>
    <label class="field"><span>Kaufdatum</span><input class="text-control" name="purchaseDate" type="date"></label>
    <label class="field"><span>Laufende Kosten / Monat</span><input class="text-control" name="monthlyCost" type="number" min="0" step="0.01" value="0"></label>
    <label class="field"><span>Renovationsrücklage</span><input class="text-control" name="renovationReserve" type="number" min="0" step="0.01" value="0"></label>`;
  const rows = properties.map((p)=>`<tr><td><strong>${escapeHtml(p.name)}</strong><div class="table-meta">${escapeHtml(p.property_type)}</div></td><td>${money(p.current_value,{currency:p.currency||currency,locale})}</td><td>${money(p.monthly_running_cost,{currency:p.currency||currency,locale})}</td><td>${money(p.renovation_reserve,{currency:p.currency||currency,locale})}</td><td>${dateLabel(p.purchase_date,locale)}</td><td>${deleteButton('properties',p.id)}</td></tr>`);
  return `
    ${pageHeader({title:'Immobilien',subtitle:'Immobilienwerte, laufende Kosten und Renovationsrücklagen. Hypotheken bleiben im Kreditmodul.',actions:`<button class="action-button action-button--primary" type="button" data-action="show-form" data-target="property-create">${icon('plus')} Immobilie</button>`})}
    ${formShell('property-create','Neue Immobilie','Wert und laufende Kosten',fields,{hidden:true,submitLabel:'Immobilie speichern'})}
    <div class="metric-grid" style="margin-bottom:16px">${metricCard('Immobilienwert',money(total,{currency,locale}),`${properties.length} Objekte · ${fxLabel(fxRates,currency)}`)}${metricCard('Laufende Kosten',money(monthly,{currency,locale}),'pro Monat')}${metricCard('Rücklagen',money(reserve,{currency,locale}),'Renovation')}</div>
    <article class="card card-padding">${dataTable({headers:['Objekt','Wert','Kosten/Monat','Rücklage','Kaufdatum',''],rows,emptyText:'Noch keine Immobilien.'})}</article>`;
}
