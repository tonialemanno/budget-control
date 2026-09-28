import { dataTable, formShell, metricCard, pageHeader, deleteButton } from '../app/components.js';
import { escapeHtml, money } from '../app/format.js';
import { countryConfig } from '../country/index.js';
import { icon } from '../app/icons.js';

export function renderPension({ pensions = [], household, profile } = {}) {
  const country = countryConfig(household?.country_code || 'CH');
  const currency = household?.base_currency || country.currency;
  const locale = profile?.locale || country.locale;
  const total = pensions.reduce((s,p)=>s+Number(p.current_value||0),0);
  const annual = pensions.reduce((s,p)=>s+Number(p.annual_contribution||0),0);
  const fields = `
    <label class="field"><span>Name</span><input class="text-control" name="name" required placeholder="z. B. Säule 3a VIAC"></label>
    <label class="field"><span>Vorsorgeart</span><select class="text-control" name="pensionType">${country.pensionTypes.map((t)=>`<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join('')}</select></label>
    <label class="field"><span>Anbieter</span><input class="text-control" name="provider"></label>
    <label class="field"><span>Aktueller Wert</span><input class="text-control" name="currentValue" type="number" min="0" step="0.01" required></label>
    <label class="field"><span>Jahresbeitrag</span><input class="text-control" name="annualContribution" type="number" min="0" step="0.01" value="0"></label>`;
  const rows = pensions.map((p)=>`<tr><td><strong>${escapeHtml(p.name)}</strong><div class="table-meta">${escapeHtml(p.provider||'')}</div></td><td>${escapeHtml(p.pension_type)}</td><td>${money(p.current_value,{currency:p.currency||currency,locale})}</td><td>${money(p.annual_contribution,{currency:p.currency||currency,locale})}</td><td>${deleteButton('pension_accounts',p.id)}</td></tr>`);
  return `
    ${pageHeader({title:'Vorsorge',subtitle:`${country.label}: eigenes fachliches Vorsorgemodell mit manueller Erfassung als Fallback.`,actions:`<button class="action-button action-button--primary" type="button" data-action="show-form" data-target="pension-create">${icon('plus')} Vorsorgeposition</button>`})}
    ${formShell('pension-create','Neue Vorsorgeposition',country.label,fields,{hidden:true,submitLabel:'Vorsorge speichern'})}
    <div class="metric-grid" style="margin-bottom:16px">${metricCard('Vorsorgevermögen',money(total,{currency,locale}),`${pensions.length} Positionen`)}${metricCard('Beiträge / Jahr',money(annual,{currency,locale}),'manuell erfasst')}${metricCard('Land',country.label,'Länderlogik getrennt')}</div>
    <article class="card card-padding">${dataTable({headers:['Position','Art','Wert','Jahresbeitrag',''],rows,emptyText:'Noch keine Vorsorgepositionen.'})}</article>`;
}
