import { dataTable, formShell, metricCard, pageHeader, statusPill } from '../app/components.js';
import { cadenceMonthlyFactor, dateInputValue, dateLabel, escapeHtml, money } from '../app/format.js';
import { convertAmount } from '../app/fx.js';
import { icon } from '../app/icons.js';

const cadenceLabel = (value) => ({
  weekly:'Wöchentlich',
  monthly:'Monatlich',
  quarterly:'Quartalsweise',
  semiannual:'Halbjährlich',
  annual:'Jährlich',
})[value] || value || '—';

function endLabel(value, locale='de-CH') {
  if (!value) return 'Unbefristet';
  const date = new Date(String(value).slice(0,10) + 'T12:00:00');
  if (Number.isNaN(date.getTime())) return dateLabel(value, locale);
  return `bis ${new Intl.DateTimeFormat(locale,{month:'long',year:'numeric'}).format(date)}`;
}

function fixedCostFields({ accounts = [], categories = [], edit = false } = {}) {
  const accountOptions = accounts.map((a)=>`<option value="${a.account_id}">${escapeHtml(a.name)} · ${escapeHtml(a.currency)}</option>`).join('');
  const categoryOptions = categories.filter((c)=>c.kind==='expense').map((c)=>`<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
  return `
    ${edit?'<input type="hidden" name="ruleId" id="fixedCostEditId">':''}
    <label class="field"><span>Bezeichnung</span><input class="text-control" name="description" ${edit?'id="fixedCostEditDescription"':''} required placeholder="z. B. Krankenkasse"></label>
    <label class="field"><span>Betrag pro Zahlung</span><input class="text-control" name="amount" ${edit?'id="fixedCostEditAmount"':''} type="number" min="0.01" step="0.01" required></label>
    <label class="field"><span>Konto</span><select class="text-control" name="accountId" ${edit?'id="fixedCostEditAccount"':''} required><option value="">Bitte wählen</option>${accountOptions}</select></label>
    <label class="field"><span>Kategorie</span><select class="text-control" name="categoryId" ${edit?'id="fixedCostEditCategory"':''}><option value="">Ohne Kategorie</option>${categoryOptions}</select></label>
    <label class="field"><span>Rhythmus</span><select class="text-control" name="cadence" ${edit?'id="fixedCostEditCadence"':''}><option value="weekly">Wöchentlich</option><option value="monthly" selected>Monatlich</option><option value="quarterly">Quartalsweise</option><option value="semiannual">Halbjährlich</option><option value="annual">Jährlich</option></select></label>
    <label class="field"><span>Nächster Termin</span><input class="text-control" name="nextDate" ${edit?'id="fixedCostEditNextDate"':''} type="date" value="${dateInputValue()}" required></label>
    <label class="field"><span>Läuft bis</span><input class="text-control" name="endDate" ${edit?'id="fixedCostEditEndDate"':''} type="date"><small>Leer lassen = unbefristet.</small></label>
    ${edit?`<label class="field"><span>Status</span><select class="text-control" name="active" id="fixedCostEditActive"><option value="true">Aktiv</option><option value="false">Pausiert</option></select></label>`:''}
  `;
}

export function renderFixedCosts({ recurringRules = [], accounts = [], categories = [], household, profile, fxRates, canWrite = false } = {}) {
  const currency = household?.base_currency || 'CHF';
  const locale = profile?.locale || 'de-CH';
  const today = dateInputValue();
  const fixedCosts = recurringRules.filter((r)=>r.direction==='expense');
  const running = fixedCosts.filter((r)=>r.active && (!r.end_date || String(r.end_date).slice(0,10) >= today));
  const monthly = running.reduce((sum,r)=>{
    const normalized = Number(r.amount || 0) * cadenceMonthlyFactor(r.cadence);
    return sum + (convertAmount(normalized,r.currency||currency,currency,fxRates) ?? 0);
  },0);
  const limited = running.filter((r)=>r.end_date).length;

  const rows = fixedCosts
    .slice()
    .sort((a,b)=>{
      const activeA = a.active && (!a.end_date || String(a.end_date).slice(0,10)>=today);
      const activeB = b.active && (!b.end_date || String(b.end_date).slice(0,10)>=today);
      if (activeA !== activeB) return activeA ? -1 : 1;
      return String(a.next_date||'').localeCompare(String(b.next_date||''));
    })
    .map((r)=>{
      const isExpired = Boolean(r.end_date && String(r.end_date).slice(0,10) < today);
      const isRunning = Boolean(r.active && !isExpired);
      const monthlyAmount = Number(r.amount || 0) * cadenceMonthlyFactor(r.cadence);
      const status = isExpired ? statusPill('cancelled','Beendet') : statusPill(isRunning?'active':'paused',isRunning?'Aktiv':'Pausiert');
      return `<tr>
        <td><strong>${escapeHtml(r.description)}</strong><div class="table-meta">${escapeHtml(r.categories?.name||'Ohne Kategorie')}</div></td>
        <td>${money(r.amount,{currency:r.currency||currency,locale})}</td>
        <td>${escapeHtml(cadenceLabel(r.cadence))}</td>
        <td><strong>${money(monthlyAmount,{currency:r.currency||currency,locale})}</strong></td>
        <td>${r.next_date?dateLabel(r.next_date,locale):'—'}</td>
        <td><strong>${escapeHtml(endLabel(r.end_date,locale))}</strong></td>
        <td>${escapeHtml(r.accounts?.name||'—')}</td>
        <td>${status}</td>
        <td>${canWrite?`<button class="table-action" type="button" data-action="fixed-cost-edit" data-id="${r.id}">Bearbeiten</button>`:''}</td>
      </tr>`;
    });

  return `
    ${pageHeader({
      title:'Fixkosten',
      subtitle:'Alle regelmässigen Ausgaben an einem Ort – inklusive Laufzeit und monatlicher Belastung.',
      actions:canWrite?`<button class="action-button action-button--primary" type="button" data-action="show-form" data-target="fixed-cost-create">${icon('plus')} Fixkosten hinzufügen</button>`:''
    })}
    ${canWrite?formShell('fixed-cost-create','Neue Fixkosten','Regelmässige Ausgabe mit optionalem Enddatum',fixedCostFields({accounts,categories}),{hidden:true,submitLabel:'Fixkosten speichern'}):''}
    ${canWrite?formShell('fixed-cost-edit','Fixkosten bearbeiten','Betrag, Rhythmus, Termin, Laufzeit oder Status ändern',fixedCostFields({accounts,categories,edit:true}),{hidden:true,submitLabel:'Änderungen speichern'}):''}

    <div class="metric-grid" style="margin-bottom:16px">
      ${metricCard('Fixkosten / Monat',money(monthly,{currency,locale}),'aktive Fixkosten, auf Monat normalisiert')}
      ${metricCard('Aktive Fixkosten',String(running.length),'regelmässige Ausgaben')}
      ${metricCard('Mit Enddatum',String(limited),'laufen zu einem bestimmten Termin aus')}
    </div>

    <article class="card card-padding">
      <div class="card-heading">
        <div><h3 class="card-title">Monatliche Verpflichtungen</h3><p class="card-subtitle">„Läuft bis“ zeigt sofort, wann eine Belastung endet. Ohne Enddatum ist sie unbefristet.</p></div>
      </div>
      ${dataTable({
        headers:['Fixkosten','Betrag','Rhythmus','Ø pro Monat','Nächster Termin','Läuft bis','Konto','Status',''],
        rows,
        emptyText:'Noch keine Fixkosten erfasst.'
      })}
    </article>
  `;
}
