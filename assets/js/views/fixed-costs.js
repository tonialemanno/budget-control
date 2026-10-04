import { dataTable, formShell, metricCard, pageHeader, statusPill } from '../app/components.js';
import { dateInputValue, dateLabel, escapeHtml, money } from '../app/format.js';
import { convertAmount } from '../app/fx.js';
import { effectiveNextDate } from '../app/recurrence.js';
import { icon } from '../app/icons.js';
import { primaryOperatingAccount } from '../app/finance-insights.js';
import { primaryAccountPreferenceId } from '../app/user-preferences.js';
import { cadenceLabel, plannedMonthlyAmount, reserveMonthlyAmount } from '../app/recurring-planning.js';

function endLabel(value, locale='de-CH') {
  if (!value) return 'Unbefristet';
  const date = new Date(String(value).slice(0,10) + 'T12:00:00');
  if (Number.isNaN(date.getTime())) return dateLabel(value, locale);
  return `bis ${new Intl.DateTimeFormat(locale,{month:'long',year:'numeric'}).format(date)}`;
}

function fixedCostFields({ accounts = [], categories = [], merchants = [], edit = false, defaultAccountId = '' } = {}) {
  const suffix = edit ? 'Edit' : '';
  const accountOptions = accounts.map((a)=>`<option value="${a.account_id}" ${!edit&&a.account_id===defaultAccountId?'selected':''}>${escapeHtml(a.name)} · ${escapeHtml(a.currency)}</option>`).join('');
  const destinationAccountOptions = accounts.map((a)=>`<option value="${a.account_id}">${escapeHtml(a.name)} · ${escapeHtml(a.currency)}</option>`).join('');
  const expenseCategoryOptions = categories.filter((c)=>c.kind==='expense').map((c)=>`<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
  const incomeCategoryOptions = categories.filter((c)=>c.kind==='income').map((c)=>`<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
  const categoryOptions = `<optgroup label="Einnahmen">${incomeCategoryOptions}</optgroup><optgroup label="Ausgaben">${expenseCategoryOptions}</optgroup>`;
  const merchantDatalist = merchants.map((m)=>`<option value="${escapeHtml(m.name)}"></option>`).join('');
  return `
    ${edit?'<input type="hidden" name="ruleId" id="fixedCostEditId">':''}
    <label class="field"><span>Art</span><select class="text-control" name="direction" id="fixedCost${suffix}Direction"><option value="expense">Fixe Ausgabe</option><option value="income">Feste Einnahme / Lohn</option><option value="transfer">Umbuchung / Topf</option></select></label>
    <label class="field"><span>Bezeichnung</span><input class="text-control" name="description" id="fixedCost${suffix}Description" required placeholder="z. B. Krankenkasse oder Sparen"></label>
    <label class="field"><span>Betrag pro Zahlung</span><input class="text-control" name="amount" id="fixedCost${suffix}Amount" type="number" min="0.01" step="0.01" required><small>Bei variablen Kosten ist das dein Richtwert für die Planung.</small></label>
    <label class="field" id="fixedCost${suffix}AmountModeField"><span>Betragsart</span><select class="text-control" name="amountMode" id="fixedCost${suffix}AmountMode"><option value="fixed">Fixer Betrag</option><option value="variable">Variabel · Richtwert</option></select></label>
    <label class="field"><span>Von Konto</span><select class="text-control" name="accountId" id="fixedCost${suffix}Account" required><option value="">Bitte wählen</option>${accountOptions}</select></label>
    <label class="field" id="fixedCost${suffix}TargetField" hidden><span>Auf Topf / Zielkonto</span><select class="text-control" name="destinationAccountId" id="fixedCost${suffix}Target"><option value="">Bitte wählen</option>${destinationAccountOptions}</select><small>Umbuchungen zählen nicht als Ausgabe, reduzieren aber dein frei verfügbares Geld.</small></label>
    <label class="field" id="fixedCost${suffix}MerchantField"><span>Händler / Empfänger / Arbeitgeber</span><input class="text-control" name="counterparty" id="fixedCost${suffix}Merchant" list="fixedCost${suffix}MerchantList" placeholder="z. B. UZON oder Abacus Umantis"><datalist id="fixedCost${suffix}MerchantList">${merchantDatalist}</datalist><small>Du kannst einen bestehenden Namen wählen oder direkt einen neuen eingeben. Bei Ausgaben wird daraus bei Bedarf automatisch ein Händler.</small></label>
    <label class="field" id="fixedCost${suffix}CategoryField"><span>Kategorie</span><select class="text-control" name="categoryId" id="fixedCost${suffix}Category"><option value="">Ohne Kategorie</option>${categoryOptions}</select></label>
    <label class="field"><span>Rhythmus</span><select class="text-control" name="cadence" id="fixedCost${suffix}Cadence"><option value="weekly">Wöchentlich</option><option value="monthly" selected>Monatlich / alle X Monate</option><option value="quarterly">Quartalsweise</option><option value="semiannual">Halbjährlich</option><option value="annual">Jährlich</option></select></label>
    <label class="field" id="fixedCost${suffix}IntervalField"><span>Monatsintervall</span><input class="text-control" name="intervalMonths" id="fixedCost${suffix}Interval" type="number" min="1" max="120" step="1" value="1"><small>1 = monatlich, 2 = alle 2 Monate usw.</small></label>
    <label class="field form-grid-span checkbox-field" id="fixedCost${suffix}ReserveToggleField"><input type="checkbox" name="reserveEnabled" id="fixedCost${suffix}ReserveEnabled"><span>Monatlich Rücklage bilden</span><small>Für jährliche oder periodische Kosten. Die Rücklage ist eine Umbuchung, keine zusätzliche Ausgabe.</small></label>
    <label class="field form-grid-span" id="fixedCost${suffix}ReserveAccountField" hidden><span>Rücklagetopf / Zielkonto</span><select class="text-control" name="reserveAccountId" id="fixedCost${suffix}ReserveAccount"><option value="">Bitte wählen</option>${destinationAccountOptions}</select><small>Finance berechnet den nötigen Monatsbetrag bis zum nächsten Termin. Vorhandenes Guthaben im Topf wird berücksichtigt.</small></label>
    <label class="field"><span>Erster / nächster Termin</span><input class="text-control" name="nextDate" id="fixedCost${suffix}NextDate" type="date" value="${dateInputValue()}" required><small>Vergangene Termine werden anhand des Rhythmus automatisch als nächster Plantermin fortgeschrieben.</small></label>
    <label class="field"><span>Läuft bis</span><input class="text-control" name="endDate" id="fixedCost${suffix}EndDate" type="date"><small>Leer lassen = unbefristet.</small></label>
    ${edit?`<label class="field"><span>Status</span><select class="text-control" name="active" id="fixedCostEditActive"><option value="true">Aktiv</option><option value="false">Pausiert</option></select></label>`:''}
  `;
}

export function renderFixedCosts({ recurringRules = [], accounts = [], categories = [], merchants = [], household, profile, fxRates, canWrite = false } = {}) {
  const currency = household?.base_currency || 'CHF';
  const locale = profile?.locale || 'de-CH';
  const preferredPrimaryAccountId=primaryAccountPreferenceId(profile,household?.id,accounts);
  const defaultAccountId=primaryOperatingAccount(accounts,recurringRules,currency,preferredPrimaryAccountId)?.account_id||'';
  const today = dateInputValue();
  const relevant = recurringRules.filter((r)=>['income','expense','transfer'].includes(r.direction));
  const running = relevant.filter((r)=>r.active && (!r.end_date || String(r.end_date).slice(0,10) >= today));
  const monthlyValue = (rules) => rules.reduce((sum,r)=>{
    return sum + (convertAmount(plannedMonthlyAmount(r),r.currency||currency,currency,fxRates) ?? 0);
  },0);
  const monthlyIncome = monthlyValue(running.filter((r)=>r.direction==='income'));
  const monthlyExpenses = monthlyValue(running.filter((r)=>r.direction==='expense'&&!r.reserve_enabled));
  const monthlyReserve = running.filter((r)=>r.direction==='expense'&&r.reserve_enabled).reduce((sum,r)=>
    sum + (convertAmount(reserveMonthlyAmount(r,accounts,new Date()),r.currency||currency,currency,fxRates) ?? 0),0);
  const monthlyTransfers = monthlyValue(running.filter((r)=>r.direction==='transfer')) + monthlyReserve;
  const accountName = (id) => accounts.find((a)=>a.account_id===id)?.name || '—';

  const rows = relevant
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
      const monthlyAmount = r.reserve_enabled ? reserveMonthlyAmount(r,accounts,new Date()) : plannedMonthlyAmount(r);
      const next=effectiveNextDate(r,new Date());
      const status = isExpired ? statusPill('cancelled','Beendet') : statusPill(isRunning?'active':'paused',isRunning?'Aktiv':'Pausiert');
      const type = r.direction==='income' ? 'Einnahme' : r.direction==='transfer' ? 'Umbuchung' : 'Ausgabe';
      const detail = r.direction==='transfer'
        ? `${escapeHtml(accountName(r.account_id))} → ${escapeHtml(accountName(r.destination_account_id))}`
        : [
            escapeHtml(r.merchants?.name||r.counterparty||(r.direction==='income'?'Ohne Arbeitgeber / Zahler':'Ohne Händler')),
            escapeHtml(r.categories?.name||'Ohne Kategorie'),
            r.amount_mode==='variable'?'Variabler Richtwert':'',
            r.reserve_enabled?`Rücklage → ${escapeHtml(accountName(r.reserve_account_id))}`:'',
          ].filter(Boolean).join(' · ');
      return `<tr>
        <td><strong>${escapeHtml(r.description)}</strong><div class="table-meta">${detail}</div></td>
        <td>${type}</td>
        <td>${money(r.amount,{currency:r.currency||currency,locale})}</td>
        <td>${escapeHtml(cadenceLabel(r))}</td>
        <td><strong>${money(monthlyAmount,{currency:r.currency||currency,locale})}</strong></td>
        <td>${next?dateLabel(next,locale):'—'}</td>
        <td><strong>${escapeHtml(endLabel(r.end_date,locale))}</strong></td>
        <td>${status}</td>
        <td>${canWrite?`<button class="table-action" type="button" data-action="fixed-cost-edit" data-id="${r.id}">Bearbeiten</button>`:''}</td>
      </tr>`;
    });

  return `
    ${pageHeader({
      title:'Fixkosten & feste Einnahmen',
      subtitle:'Lohn, regelmässige Ausgaben und feste Umbuchungen auf deine Töpfe – alles an einem Ort.',
      actions:canWrite?`<button class="action-button action-button--primary" type="button" data-action="show-form" data-target="fixed-cost-create">${icon('plus')} Position hinzufügen</button>`:''
    })}
    ${canWrite?formShell('fixed-cost-create','Neue feste Position','Lohn, Ausgabe oder feste Umbuchung mit optionalem Enddatum',fixedCostFields({accounts,categories,merchants,defaultAccountId}),{hidden:true,submitLabel:'Speichern'}):''}
    ${canWrite?formShell('fixed-cost-edit','Feste Position bearbeiten','Betrag, Gegenpartei, Rhythmus, Laufzeit oder Status ändern',fixedCostFields({accounts,categories,merchants,edit:true}),{hidden:true,submitLabel:'Änderungen speichern'}):''}

    <div class="metric-grid" style="margin-bottom:16px">
      ${metricCard('Feste Einnahmen / Monat',money(monthlyIncome,{currency,locale}),'Lohn und andere planbare Einnahmen','positive')}
      ${metricCard('Fixe Ausgaben / Monat',money(monthlyExpenses,{currency,locale}),'echte regelmässige Kosten')}
      ${metricCard('Rücklagen & Umbuchungen / Monat',money(monthlyTransfers,{currency,locale}),monthlyReserve>0?`davon Rücklagen ${money(monthlyReserve,{currency,locale})}`:'Sparen, Überschuss und andere Töpfe')}
      ${metricCard('Aktive Positionen',String(running.length),'Einnahmen, Ausgaben und Umbuchungen')}
    </div>

    <article class="card card-padding">
      <div class="card-heading">
        <div><h3 class="card-title">Monatliche Verpflichtungen</h3><p class="card-subtitle">Umbuchungen bleiben Vermögensverschiebungen und werden nicht als Ausgabe gerechnet.</p></div>
      </div>
      ${dataTable({
        headers:['Position','Art','Betrag','Rhythmus','Ø pro Monat','Nächster Plantermin','Läuft bis','Status',''],
        rows,
        emptyText:'Noch keine festen Einnahmen, Fixkosten oder Umbuchungen erfasst.'
      })}
    </article>
  `;
}
