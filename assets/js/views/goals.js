import { formShell, goalProgress, pageHeader, deleteButton } from '../app/components.js';
import { dateLabel, escapeHtml, money } from '../app/format.js';
import { convertAmount } from '../app/fx.js';
import { icon } from '../app/icons.js';

function monthsUntil(dateValue) {
  if (!dateValue) return null;
  const now=new Date(); const target=new Date(`${dateValue}T12:00:00`);
  if (Number.isNaN(target.getTime())) return null;
  const months=(target.getFullYear()-now.getFullYear())*12+(target.getMonth()-now.getMonth());
  return Math.max(1, months + (target.getDate()>=now.getDate()?1:0));
}
function cadenceMonthly(amount,cadence){
  const n=Number(amount||0);
  if(cadence==='weekly') return n*52/12;
  if(cadence==='quarterly') return n/3;
  if(cadence==='semiannual') return n/6;
  if(cadence==='annual') return n/12;
  return n;
}
function averageMonthlySurplus(transactions,baseCurrency,fxRates){
  const now=new Date();
  const values=[];
  for(let back=1;back<=3;back+=1){
    const start=new Date(now.getFullYear(),now.getMonth()-back,1);
    const end=new Date(now.getFullYear(),now.getMonth()-back+1,1);
    let income=0; let expense=0;
    for(const tx of transactions){
      const d=new Date(tx.occurred_at);
      if(d<start||d>=end||tx.status!=='booked'||tx.transfer_group_id) continue;
      const converted=convertAmount(tx.amount,tx.currency,baseCurrency,fxRates);
      if(converted==null) continue;
      if(converted>=0) income+=converted; else expense+=Math.abs(converted);
    }
    values.push(Math.max(0,income-expense));
  }
  return values.length?values.reduce((a,b)=>a+b,0)/values.length:0;
}
function goalPlan(goal,{goalSources,recurringRules,transactions,baseCurrency,fxRates}){
  const sources=goalSources.filter((s)=>s.goal_id===goal.id&&s.active!==false);
  const components=[];
  const base=Number(goal.monthly_amount||0);
  if(base>0) components.push({label:'Eigener Monatsbetrag',amount:base,type:'base'});
  for(const source of sources){
    if(source.source_type==='fixed') components.push({label:source.label||'Fixer Zusatzbetrag',amount:Number(source.amount||0),type:'fixed',id:source.id});
    if(source.source_type==='recurring_rule'){
      const rule=recurringRules.find((r)=>r.id===source.recurring_rule_id);
      if(rule) components.push({label:source.label||rule.description,amount:cadenceMonthly(rule.amount,rule.cadence),type:'recurring_rule',id:source.id});
    }
    if(source.source_type==='surplus') components.push({label:'Ø Monatsüberschuss (letzte 3 volle Monate)',amount:averageMonthlySurplus(transactions,baseCurrency,fxRates),type:'surplus',id:source.id});
  }
  return {sources,components,total:components.reduce((s,c)=>s+c.amount,0)};
}
function feasibility(goal,plannedMonthly) {
  const remaining=Math.max(0,Number(goal.target_amount||0)-Number(goal.current_amount||0));
  const months=monthsUntil(goal.target_date);
  if (!months) return { tone:'neutral', label:'Kein Termin', required:0, forecast:null, note:'Ohne Zieltermin keine Machbarkeitsrechnung.' };
  const required=remaining/months;
  const monthly=Number(plannedMonthly||0);
  const ratio=required>0?monthly/required:1;
  const tone=ratio>=1?'green':ratio>=0.8?'yellow':'red';
  const label=tone==='green'?'Auf Kurs':tone==='yellow'?'Knapp':'Nicht auf Kurs';
  const forecast=monthly>0?Math.ceil(remaining/monthly):null;
  return { tone,label,required,forecast,note:monthly>=required?'Der geplante Monatsbetrag reicht voraussichtlich.':`Es fehlen rund ${Math.max(0,required-monthly).toFixed(2)} pro Monat.` };
}

function demoSavingsTimeline(goal,locale,currency){
  if (!String(goal.notes||'').includes('Demo-Verlauf:') || !goal.start_date) return '';
  const start=new Date(goal.start_date+'T12:00:00');
  const current=Number(goal.current_amount||0);
  const monthly=Number(goal.monthly_amount||0);
  if (!Number.isFinite(start.getTime())||monthly<=0) return '';
  const count=Math.max(1,Math.round(current/monthly));
  const bars=Array.from({length:Math.min(count,36)},(_,i)=>{
    const d=new Date(start.getFullYear(),start.getMonth()+i,1);
    const val=Math.min(current,(i+1)*monthly);
    const pct=Math.max(2,Math.round(val/Math.max(current,1)*100));
    const title=`${d.toLocaleDateString(locale,{month:'short',year:'numeric'})}: ${money(val,{currency,locale})}`;
    return `<div title="${escapeHtml(title)}" style="flex:1;min-width:4px;height:88px;display:flex;align-items:end"><div style="width:100%;height:${pct}%;background:var(--color-primary,#4774a5);border-radius:3px 3px 0 0;opacity:.84"></div></div>`;
  }).join('');
  return `<section style="margin:14px 0" aria-label="Sparverlauf"><div class="mini-detail-list"><span>Beginn <strong>${dateLabel(goal.start_date,locale)}</strong></span><span>Bisher angespart <strong>${money(current,{currency,locale})}</strong></span><span>Monatlich <strong>${money(monthly,{currency,locale})}</strong></span></div><p class="card-subtitle">Sparentwicklung (Demo-Modell, monatlich)</p><div style="display:flex;align-items:end;gap:4px;padding:8px 0;border-bottom:1px solid var(--border-color,#ddd)">${bars}</div></section>`;
}

export function renderGoals({ goals = [], goalSources = [], recurringRules = [], transactions = [], household, profile, fxRates, canWrite=false } = {}) {
  const currency = household?.base_currency || 'CHF';
  const locale = profile?.locale || 'de-CH';
  const recurringOptions=recurringRules.filter((r)=>r.active!==false).map((r)=>`<option value="${r.id}">${escapeHtml(r.description)} · ${money(r.amount,{currency:r.currency||currency,locale})} · ${escapeHtml(r.cadence)}</option>`).join('');
  const fields = `
    <label class="field"><span>Name</span><input class="text-control" name="name" required placeholder="z. B. Notgroschen"></label>
    <label class="field"><span>Art</span><select class="text-control" name="goalType"><option value="emergency">Notgroschen</option><option value="tax">Steuern</option><option value="holiday">Ferien</option><option value="vehicle">Auto</option><option value="home">Wohnen</option><option value="wedding">Hochzeit</option><option value="custom">Individuell</option></select></label>
    <label class="field"><span>Zielbetrag</span><input class="text-control" name="targetAmount" type="number" min="0.01" step="0.01" required></label>
    <label class="field"><span>Bereits vorhanden</span><input class="text-control" name="currentAmount" type="number" min="0" step="0.01" value="0"></label>
    <label class="field"><span>Eigener Monatsbetrag</span><input class="text-control" name="monthlyAmount" type="number" min="0" step="0.01" value="0"><small>Diesen Betrag kannst du jederzeit frei ändern. Zusätzliche Quellen werden separat addiert.</small></label>
    <label class="field"><span>Zieltermin</span><input class="text-control" name="targetDate" type="date"></label>`;
  const editFields = `<input type="hidden" name="goalId" id="goalEditId">
    <label class="field"><span>Name</span><input class="text-control" name="name" id="goalEditName" required></label>
    <label class="field"><span>Art</span><select class="text-control" name="goalType" id="goalEditType"><option value="emergency">Notgroschen</option><option value="tax">Steuern</option><option value="holiday">Ferien</option><option value="vehicle">Auto</option><option value="home">Wohnen</option><option value="wedding">Hochzeit</option><option value="custom">Individuell</option></select></label>
    <label class="field"><span>Zielbetrag</span><input class="text-control" name="targetAmount" id="goalEditTarget" type="number" min="0.01" step="0.01" required></label>
    <label class="field"><span>Aktueller Stand</span><input class="text-control" name="currentAmount" id="goalEditCurrent" type="number" min="0" step="0.01"></label>
    <label class="field"><span>Eigener Monatsbetrag</span><input class="text-control" name="monthlyAmount" id="goalEditMonthly" type="number" min="0" step="0.01"></label>
    <label class="field"><span>Zieltermin</span><input class="text-control" name="targetDate" id="goalEditDate" type="date"></label>`;
  const sourceFields = `<input type="hidden" name="goalId" id="goalSourceGoalId">
    <label class="field"><span>Quelle</span><select class="text-control" name="sourceType" id="goalSourceType"><option value="fixed">Zusätzlicher fixer Betrag</option><option value="recurring_rule">Wiederkehrende Zahlung verknüpfen</option><option value="surplus">Monatsüberschuss mitrechnen</option></select></label>
    <label class="field" id="goalSourceLabelField"><span>Bezeichnung</span><input class="text-control" name="label" id="goalSourceLabel" placeholder="z. B. zweiter Sparauftrag"></label>
    <label class="field" id="goalSourceAmountField"><span>Betrag / Monat</span><input class="text-control" name="amount" id="goalSourceAmount" type="number" min="0" step="0.01"></label>
    <label class="field" id="goalSourceRecurringField" hidden><span>Wiederkehrend</span><select class="text-control" name="recurringRuleId" id="goalSourceRecurring"><option value="">Bitte wählen</option>${recurringOptions}</select></label>
    <div class="inline-alert form-grid-span" id="goalSourceSurplusInfo" hidden><strong>Dynamischer Überschuss</strong><span>Für die Planung wird der durchschnittliche positive Cashflow der letzten 3 vollständigen Monate verwendet. Interne Umbuchungen werden nicht als Ausgabe gezählt.</span></div>`;

  return `
    ${pageHeader({title:'Sparziele',subtitle:'Monatsbetrag frei bearbeiten, Vorschlag nur als Hilfe nutzen und mehrere Finanzierungsquellen zu einem Ziel kombinieren.',actions:canWrite?`<button class="action-button action-button--primary" type="button" data-action="show-form" data-target="goal-create">${icon('plus')} Sparziel</button>`:''})}
    ${canWrite?formShell('goal-create','Neues Sparziel','Ziel und eigenen Monatsbetrag festlegen',fields,{hidden:true,submitLabel:'Sparziel speichern'}):''}
    ${canWrite?formShell('goal-edit','Sparziel bearbeiten','Ziel, Stand und eigenen Monatsbetrag jederzeit korrigieren',editFields,{hidden:true,submitLabel:'Änderungen speichern'}):''}
    ${canWrite?formShell('goal-source-create','Finanzierung ergänzen','Mehrere Beträge oder dynamischen Überschuss zu einem Sparziel koppeln',sourceFields,{hidden:true,submitLabel:'Quelle hinzufügen'}):''}
    ${goals.length ? `<div class="grid-3">${goals.map((g)=>{
      const plan=goalPlan(g,{goalSources,recurringRules,transactions,baseCurrency:currency,fxRates});
      const f=feasibility(g,plan.total);
      const extraSources=Math.max(0,plan.total-Number(g.monthly_amount||0));
      const suggestedBase=Math.max(0,f.required-extraSources);
      return `<article class="card card-padding"><div class="card-heading"><div><h3 class="card-title">${escapeHtml(g.name)}</h3><p class="card-subtitle">${g.target_date?`Ziel ${dateLabel(g.target_date,locale)}`:'Ohne Zieltermin'}</p></div><span class="goal-bubble goal-bubble--${f.tone}">${escapeHtml(f.label)}</span></div>${goalProgress(g,locale)}${demoSavingsTimeline(g,locale,g.currency||currency)}
        <div class="mini-detail-list"><span>Eigener Monatsbetrag <strong>${money(g.monthly_amount,{currency:g.currency||currency,locale})}</strong></span><span>Gesamt geplant / Monat <strong>${money(plan.total,{currency:g.currency||currency,locale})}</strong></span>${g.target_date?`<span>Erforderlich / Monat <strong>${money(f.required,{currency:g.currency||currency,locale})}</strong></span>`:''}${f.forecast!==null?`<span>Restlaufzeit bei Plan <strong>ca. ${f.forecast} Monate</strong></span>`:''}</div>
        ${plan.components.length?`<div class="goal-source-list">${plan.components.map((c)=>`<div class="goal-source-row"><div><strong>${escapeHtml(c.label)}</strong><span>${money(c.amount,{currency:g.currency||currency,locale})} / Monat</span></div>${c.id&&canWrite?`<button class="table-action table-action--danger" type="button" data-action="goal-source-delete" data-id="${c.id}">Entfernen</button>`:''}</div>`).join('')}</div>`:''}
        <p class="goal-feasibility-note">${escapeHtml(f.note)}</p>
        <div class="card-footer-actions">${canWrite?`${g.target_date&&f.required>0?`<button class="table-action" type="button" data-action="goal-apply-suggestion" data-id="${g.id}" data-amount="${suggestedBase.toFixed(2)}">Vorschlag übernehmen</button>`:''}<button class="table-action" type="button" data-action="goal-edit" data-id="${g.id}">Bearbeiten</button><button class="table-action" type="button" data-action="goal-source-open" data-id="${g.id}">Finanzierung koppeln</button><button class="table-action" type="button" data-action="goal-progress" data-id="${g.id}" data-current="${g.current_amount}">Stand ändern</button>${deleteButton('savings_goals',g.id)}`:''}</div></article>`;
    }).join('')}</div>` : `<div class="card empty-state"><span class="empty-state-icon">${icon('target')}</span><h3>Noch kein Sparziel</h3><p>Lege dein erstes Ziel an, zum Beispiel Notgroschen oder Steuern.</p></div>`}
  `;
}
