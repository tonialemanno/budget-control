import { formShell, goalProgress, pageHeader, statusPill, deleteButton } from '../app/components.js';
import { dateLabel, escapeHtml, money } from '../app/format.js';
import { icon } from '../app/icons.js';

function monthsUntil(dateValue) {
  if (!dateValue) return null;
  const now=new Date(); const target=new Date(`${dateValue}T12:00:00`);
  if (Number.isNaN(target.getTime())) return null;
  const months=(target.getFullYear()-now.getFullYear())*12+(target.getMonth()-now.getMonth());
  return Math.max(1, months + (target.getDate()>=now.getDate()?1:0));
}

function feasibility(goal) {
  const remaining=Math.max(0,Number(goal.target_amount||0)-Number(goal.current_amount||0));
  const months=monthsUntil(goal.target_date);
  if (!months) return { tone:'neutral', label:'Kein Termin', required:0, forecast:null, note:'Ohne Zieltermin keine Machbarkeitsrechnung.' };
  const required=remaining/months;
  const monthly=Number(goal.monthly_amount||0);
  const ratio=required>0?monthly/required:1;
  const tone=ratio>=1?'green':ratio>=0.8?'yellow':'red';
  const label=tone==='green'?'Auf Kurs':tone==='yellow'?'Knapp':'Nicht auf Kurs';
  const forecast=monthly>0?Math.ceil(remaining/monthly):null;
  return { tone,label,required,forecast,note:monthly>=required?'Der aktuelle Monatsbetrag reicht voraussichtlich.':`Es fehlen rund ${Math.max(0,required-monthly).toFixed(2)} pro Monat.` };
}

export function renderGoals({ goals = [], household, profile } = {}) {
  const currency = household?.base_currency || 'CHF';
  const locale = profile?.locale || 'de-CH';
  const fields = `
    <label class="field"><span>Name</span><input class="text-control" name="name" required placeholder="z. B. Notgroschen"></label>
    <label class="field"><span>Art</span><select class="text-control" name="goalType"><option value="emergency">Notgroschen</option><option value="tax">Steuern</option><option value="holiday">Ferien</option><option value="vehicle">Auto</option><option value="home">Wohnen</option><option value="wedding">Hochzeit</option><option value="custom">Individuell</option></select></label>
    <label class="field"><span>Zielbetrag</span><input class="text-control" name="targetAmount" type="number" min="0.01" step="0.01" required></label>
    <label class="field"><span>Bereits vorhanden</span><input class="text-control" name="currentAmount" type="number" min="0" step="0.01" value="0"></label>
    <label class="field"><span>Monatlicher Sparbetrag</span><input class="text-control" name="monthlyAmount" type="number" min="0" step="0.01" value="0"></label>
    <label class="field"><span>Zieltermin</span><input class="text-control" name="targetDate" type="date"></label>`;

  return `
    ${pageHeader({title:'Sparziele',subtitle:'Ziel, Termin und Monatsbetrag werden gegeneinander geprüft. Grün = auf Kurs, Gelb = knapp, Rot = Ziel wird mit dem aktuellen Betrag voraussichtlich verfehlt.',actions:`<button class="action-button action-button--primary" type="button" data-action="show-form" data-target="goal-create">${icon('plus')} Sparziel</button>`})}
    ${formShell('goal-create','Neues Sparziel','Ziel und vorhandenen Betrag festlegen',fields,{hidden:true,submitLabel:'Sparziel speichern'})}
    ${goals.length ? `<div class="grid-3">${goals.map((g)=>{ const f=feasibility(g); return `<article class="card card-padding"><div class="card-heading"><div><h3 class="card-title">${escapeHtml(g.name)}</h3><p class="card-subtitle">${g.target_date?`Ziel ${dateLabel(g.target_date,locale)}`:'Ohne Zieltermin'}</p></div><span class="goal-bubble goal-bubble--${f.tone}">${escapeHtml(f.label)}</span></div>${goalProgress(g,locale)}<div class="mini-detail-list"><span>Monatlich aktuell <strong>${money(g.monthly_amount,{currency:g.currency||currency,locale})}</strong></span>${g.target_date?`<span>Erforderlich / Monat <strong>${money(f.required,{currency:g.currency||currency,locale})}</strong></span>`:''}${f.forecast!==null?`<span>Restlaufzeit bei aktuellem Betrag <strong>ca. ${f.forecast} Monate</strong></span>`:''}</div><p class="goal-feasibility-note">${escapeHtml(f.note)}</p><div class="card-footer-actions">${g.target_date&&f.required>0?`<button class="table-action" type="button" data-action="goal-apply-suggestion" data-id="${g.id}" data-amount="${f.required.toFixed(2)}">Vorschlag übernehmen</button>`:''}<button class="table-action" type="button" data-action="goal-progress" data-id="${g.id}" data-current="${g.current_amount}">Stand ändern</button>${deleteButton('savings_goals',g.id)}</div></article>`; }).join('')}</div>` : `<div class="card empty-state"><span class="empty-state-icon">${icon('target')}</span><h3>Noch kein Sparziel</h3><p>Lege dein erstes Ziel an, zum Beispiel Notgroschen oder Steuern.</p></div>`}
  `;
}
