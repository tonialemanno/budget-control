import { formShell, goalProgress, pageHeader, deleteButton } from '../app/components.js';
import { dateLabel, escapeHtml, money, moneyText } from '../app/format.js';
import { convertAmount } from '../app/fx.js';
import { icon } from '../app/icons.js';
import { goalPlanningMonths, goalStartsInFuture, projectedGoalAmount, projectedGoalGap } from '../app/goal-planning.js?v=20261008-r53';

function cadenceMonthly(amount,cadence){
  const n=Number(amount||0);
  if(cadence==='weekly') return n*52/12;
  if(cadence==='quarterly') return n/3;
  if(cadence==='semiannual') return n/6;
  if(cadence==='annual') return n/12;
  return n;
}

function averageMonthlySurplus(transactions,targetCurrency,fxRates){
  const now=new Date();
  const values=[];
  for(let back=1;back<=3;back+=1){
    const start=new Date(now.getFullYear(),now.getMonth()-back,1);
    const end=new Date(now.getFullYear(),now.getMonth()-back+1,1);
    let income=0; let expense=0;
    for(const tx of transactions){
      const d=new Date(tx.occurred_at);
      if(d<start||d>=end||tx.status!=='booked'||tx.transfer_group_id) continue;
      const converted=convertAmount(tx.amount,tx.currency,targetCurrency,fxRates);
      if(converted==null) continue;
      if(converted>=0) income+=converted; else expense+=Math.abs(converted);
    }
    values.push(Math.max(0,income-expense));
  }
  return values.length?values.reduce((a,b)=>a+b,0)/values.length:0;
}

function goalAccount(goal,accounts){
  return goal.account_id ? accounts.find((a)=>a.account_id===goal.account_id) || null : null;
}

function goalPlan(goal,{goalSources,recurringRules,transactions,accounts,baseCurrency,fxRates}){
  const account=goalAccount(goal,accounts);
  const targetCurrency=account?.currency||goal.currency||baseCurrency;
  const sources=goalSources.filter((s)=>s.goal_id===goal.id&&s.active!==false);
  const components=[];
  const explicitRuleIds=new Set(sources.filter((s)=>s.source_type==='recurring_rule'&&s.recurring_rule_id).map((s)=>s.recurring_rule_id));

  const base=Number(goal.monthly_amount||0);
  if(base>0) components.push({label:'Eigener zusätzlicher Monatsbetrag',amount:base,type:'base'});

  for(const source of sources){
    if(source.source_type==='fixed') {
      components.push({label:source.label||'Fixer Zusatzbetrag',amount:Number(source.amount||0),type:'fixed',id:source.id});
    }
    if(source.source_type==='recurring_rule'){
      const rule=recurringRules.find((r)=>r.id===source.recurring_rule_id);
      const today=new Date().toISOString().slice(0,10);
      const targetsGoal=!account || rule?.destination_account_id===account.account_id;
      if(rule && rule.direction==='transfer' && targetsGoal && rule.active!==false && (!rule.end_date || String(rule.end_date).slice(0,10)>=today)){
        const normalized=cadenceMonthly(rule.amount,rule.cadence);
        const converted=convertAmount(normalized,rule.currency||baseCurrency,targetCurrency,fxRates)??0;
        components.push({label:source.label||rule.description,amount:converted,type:'recurring_rule',id:source.id});
      }
    }
    if(source.source_type==='surplus') {
      components.push({label:'Ø Monatsüberschuss (letzte 3 volle Monate)',amount:averageMonthlySurplus(transactions,targetCurrency,fxRates),type:'surplus',id:source.id});
    }
  }

  if(account){
    const today=new Date().toISOString().slice(0,10);
    const linkedTransfers=recurringRules.filter((r)=>
      r.active!==false
      && r.direction==='transfer'
      && !explicitRuleIds.has(r.id)
      && (!r.end_date || String(r.end_date).slice(0,10)>=today)
      && (r.account_id===account.account_id || r.destination_account_id===account.account_id)
    );
    for(const rule of linkedTransfers){
      const incoming=rule.destination_account_id===account.account_id;
      const normalized=cadenceMonthly(rule.amount,rule.cadence);
      const converted=convertAmount(normalized,rule.currency||targetCurrency,targetCurrency,fxRates)??0;
      components.push({
        label:`${incoming?'Automatisch auf':'Automatisch aus'} ${account.name}: ${rule.description}`,
        amount:incoming?converted:-converted,
        type:'linked_account_transfer',
      });
    }
  }

  return {sources,components,total:components.reduce((s,c)=>s+c.amount,0),account,targetCurrency};
}

function feasibility(goal,plannedMonthly,currentAmount,currency='CHF',locale='de-CH') {
  const remaining=Math.max(0,Number(goal.target_amount||0)-Number(currentAmount||0));
  const months=goalPlanningMonths(goal);
  if (!months) return { tone:'neutral', label:'Kein Termin', required:0, forecast:null, note:'Ohne Laufzeit oder Zieltermin keine Machbarkeitsrechnung.' };
  const required=remaining/months;
  const monthly=Number(plannedMonthly||0);
  const ratio=required>0?monthly/required:1;
  const futureStart=goalStartsInFuture(goal);
  const tone=futureStart?'neutral':ratio>=1?'green':ratio>=0.8?'yellow':'red';
  const label=futureStart?'Geplant':tone==='green'?'Auf Kurs':tone==='yellow'?'Knapp':'Nicht auf Kurs';
  const forecast=monthly>0?Math.ceil(remaining/monthly):null;
  const projected=projectedGoalAmount({currentAmount,plannedMonthly:monthly,months});
  const projectedGap=projectedGoalGap({targetAmount:goal.target_amount,currentAmount,plannedMonthly:monthly,months});
  const note=futureStart
    ? `Die Sparphase startet später. Ab Start sind rund ${moneyText(required,{currency,locale})} pro Monat nötig.`
    : monthly>=required
      ? 'Der geplante Monatsbetrag reicht voraussichtlich.'
      : `Es fehlen rund ${moneyText(Math.max(0,required-monthly),{currency,locale})} pro Monat.`;
  return { tone,label,required,forecast,note,months,projected,projectedGap };
}

export function renderGoals({ goals = [], goalSources = [], recurringRules = [], transactions = [], accounts = [], household, profile, fxRates, canWrite=false } = {}) {
  const currency = household?.base_currency || 'CHF';
  const locale = profile?.locale || 'de-CH';
  const recurringOptions=recurringRules.filter((r)=>r.active!==false&&r.direction==='transfer').map((r)=>`<option value="${r.id}">${escapeHtml(r.description)} · ${money(r.amount,{currency:r.currency||currency,locale})} · ${escapeHtml(r.cadence)}</option>`).join('');
  const accountOptions=accounts
    .filter((a)=>!['credit_card','investment','pension'].includes(a.account_type))
    .map((a)=>`<option value="${a.account_id}">${escapeHtml(a.name)} · ${money(a.current_balance,{currency:a.currency,locale})}</option>`)
    .join('');

  const fields = `
    <label class="field"><span>Name</span><input class="text-control" name="name" required placeholder="z. B. Notgroschen"></label>
    <label class="field"><span>Art</span><select class="text-control" name="goalType"><option value="emergency">Notgroschen</option><option value="tax">Steuern</option><option value="holiday">Ferien</option><option value="vehicle">Auto</option><option value="home">Wohnen</option><option value="wedding">Hochzeit</option><option value="custom">Individuell</option></select></label>
    <label class="field"><span>Topf / Konto</span><select class="text-control" name="accountId" id="goalCreateAccount"><option value="">Kein Konto · Stand manuell führen</option>${accountOptions}</select><small>Bei einem verknüpften Topf kommt der aktuelle Stand automatisch vom Konto.</small></label>
    <label class="field"><span>Zielbetrag</span><input class="text-control" name="targetAmount" type="number" min="0.01" step="0.01" required></label>
    <label class="field"><span>Bereits vorhanden</span><input class="text-control" name="currentAmount" id="goalCreateCurrent" type="number" min="0" step="0.01" value="0"><small id="goalCreateCurrentHelp">Nur für Ziele ohne verknüpftes Konto.</small></label>
    <label class="field"><span>Eigener zusätzlicher Monatsbetrag</span><input class="text-control" name="monthlyAmount" type="number" min="0" step="0.01" value="0"><small>Geplante Umbuchungen auf den verknüpften Topf werden automatisch zusätzlich erkannt.</small></label>
    <label class="field"><span>Start der Sparphase</span><input class="text-control" id="goalCreateStart" name="startDate" type="date"><small>Zum Beispiel 01.01.2027. Vor diesem Datum wird das Ziel nicht als verspätet bewertet.</small></label>
    <label class="field"><span>Laufzeit in Monaten</span><input class="text-control" id="goalCreateDuration" name="durationMonths" type="number" min="1" max="600" step="1" placeholder="z. B. 12"><small>Die Monatsrate wird über genau diese Laufzeit berechnet.</small></label>
    <label class="field"><span>Zieltermin</span><input class="text-control" id="goalCreateDate" name="targetDate" type="date"><small>Wird bei Startdatum + Laufzeit automatisch berechnet. Alternativ kann der Termin direkt gesetzt werden.</small></label>`;

  const editFields = `<input type="hidden" name="goalId" id="goalEditId">
    <label class="field"><span>Name</span><input class="text-control" name="name" id="goalEditName" required></label>
    <label class="field"><span>Art</span><select class="text-control" name="goalType" id="goalEditType"><option value="emergency">Notgroschen</option><option value="tax">Steuern</option><option value="holiday">Ferien</option><option value="vehicle">Auto</option><option value="home">Wohnen</option><option value="wedding">Hochzeit</option><option value="custom">Individuell</option></select></label>
    <label class="field"><span>Topf / Konto</span><select class="text-control" name="accountId" id="goalEditAccount"><option value="">Kein Konto · Stand manuell führen</option>${accountOptions}</select><small>Mit Konto wird der aktuelle Stand automatisch übernommen.</small></label>
    <label class="field"><span>Zielbetrag</span><input class="text-control" name="targetAmount" id="goalEditTarget" type="number" min="0.01" step="0.01" required></label>
    <label class="field"><span>Aktueller Stand</span><input class="text-control" name="currentAmount" id="goalEditCurrent" type="number" min="0" step="0.01"><small id="goalEditCurrentHelp">Nur für Ziele ohne verknüpftes Konto.</small></label>
    <label class="field"><span>Eigener zusätzlicher Monatsbetrag</span><input class="text-control" name="monthlyAmount" id="goalEditMonthly" type="number" min="0" step="0.01"></label>
    <label class="field"><span>Start der Sparphase</span><input class="text-control" name="startDate" id="goalEditStart" type="date"></label>
    <label class="field"><span>Laufzeit in Monaten</span><input class="text-control" name="durationMonths" id="goalEditDuration" type="number" min="1" max="600" step="1"></label>
    <label class="field"><span>Zieltermin</span><input class="text-control" name="targetDate" id="goalEditDate" type="date"><small>Wird bei Startdatum + Laufzeit automatisch berechnet.</small></label>`;

  const sourceFields = `<input type="hidden" name="goalId" id="goalSourceGoalId">
    <label class="field"><span>Quelle</span><select class="text-control" name="sourceType" id="goalSourceType"><option value="fixed">Zusätzlicher fixer Betrag</option><option value="recurring_rule">Wiederkehrende Zahlung verknüpfen</option><option value="surplus">Monatsüberschuss mitrechnen</option></select></label>
    <label class="field" id="goalSourceLabelField"><span>Bezeichnung</span><input class="text-control" name="label" id="goalSourceLabel" placeholder="z. B. zweiter Sparauftrag"></label>
    <label class="field" id="goalSourceAmountField"><span>Betrag / Monat</span><input class="text-control" name="amount" id="goalSourceAmount" type="number" min="0" step="0.01"></label>
    <label class="field" id="goalSourceRecurringField" hidden><span>Wiederkehrend</span><select class="text-control" name="recurringRuleId" id="goalSourceRecurring"><option value="">Bitte wählen</option>${recurringOptions}</select></label>
    <div class="inline-alert form-grid-span" id="goalSourceSurplusInfo" hidden><strong>Dynamischer Überschuss</strong><span>Für die Planung wird der durchschnittliche positive Cashflow der letzten 3 vollständigen Monate verwendet. Interne Umbuchungen werden nicht als Ausgabe gezählt.</span></div>`;

  return `
    ${pageHeader({title:'Sparziele',subtitle:'Sparziele mit echten Töpfen verbinden. Kontostand und geplante Umbuchungen fliessen automatisch in die Prognose ein.',actions:canWrite?`<button class="action-button action-button--primary" type="button" data-action="show-form" data-target="goal-create">${icon('plus')} Sparziel</button>`:''})}
    ${canWrite?formShell('goal-create','Neues Sparziel','Optional direkt mit einem Konto oder Topf verbinden',fields,{hidden:true,submitLabel:'Sparziel speichern'}):''}
    ${canWrite?formShell('goal-edit','Sparziel bearbeiten','Topf, Ziel und zusätzliche Planung ändern',editFields,{hidden:true,submitLabel:'Änderungen speichern'}):''}
    ${canWrite?formShell('goal-source-create','Finanzierung ergänzen','Zusätzliche Beträge oder dynamischen Überschuss koppeln',sourceFields,{hidden:true,submitLabel:'Quelle hinzufügen'}):''}
    ${goals.length ? `<div class="grid-3">${goals.map((g)=>{
      const plan=goalPlan(g,{goalSources,recurringRules,transactions,accounts,baseCurrency:currency,fxRates});
      const linkedAccount=plan.account;
      const effectiveCurrent=linkedAccount?Number(linkedAccount.current_balance||0):Number(g.current_amount||0);
      const goalCurrency=plan.targetCurrency;
      const displayGoal={...g,current_amount:effectiveCurrent,currency:goalCurrency};
      const f=feasibility(g,plan.total,effectiveCurrent,goalCurrency,locale);
      const externalNet=plan.total-Number(g.monthly_amount||0);
      const suggestedBase=Math.max(0,f.required-externalNet);
      const accountMeta=linkedAccount
        ? `<span>Topf / Konto <strong>${escapeHtml(linkedAccount.name)}</strong></span><span>Aktueller Stand <strong>${money(effectiveCurrent,{currency:goalCurrency,locale})}</strong> <small>direkt vom Konto</small></span>`
        : `<span>Aktueller Stand <strong>${money(effectiveCurrent,{currency:goalCurrency,locale})}</strong> <small>manuell</small></span>`;
      const scheduleMeta=[
        g.start_date?`Start ${dateLabel(g.start_date,locale)}`:'',
        g.duration_months?`${Number(g.duration_months)} Monate`:'',
        g.target_date?`Ziel ${dateLabel(g.target_date,locale)}`:'',
      ].filter(Boolean).join(' · ')||'Ohne Zeitplan';
      return `<article class="card card-padding"><div class="card-heading"><div><h3 class="card-title">${escapeHtml(g.name)}</h3><p class="card-subtitle">${scheduleMeta}${linkedAccount?` · ${escapeHtml(linkedAccount.name)}`:''}</p></div><span class="goal-bubble goal-bubble--${f.tone}">${escapeHtml(f.label)}</span></div>${goalProgress(displayGoal,locale)}
        <div class="mini-detail-list">${accountMeta}${g.start_date?`<span>Start <strong>${dateLabel(g.start_date,locale)}</strong></span>`:''}${g.duration_months?`<span>Laufzeit <strong>${Number(g.duration_months)} Monate</strong></span>`:''}<span>Eigener Zusatz / Monat <strong>${money(g.monthly_amount,{currency:goalCurrency,locale})}</strong></span><span>Gesamt geplant / Monat <strong>${money(plan.total,{currency:goalCurrency,locale})}</strong></span>${g.target_date?`<span>Erforderlich / Monat <strong>${money(f.required,{currency:goalCurrency,locale})}</strong></span>`:''}${f.projected!==null?`<span>Bei unverändertem Plan am Zieltermin <strong>${money(f.projected,{currency:goalCurrency,locale})}</strong></span>`:''}${f.projectedGap!==null&&Math.abs(f.projectedGap)>=0.01?`<span>${f.projectedGap>0?'Fehlen zum Ziel':'Über Ziel'} <strong>${money(Math.abs(f.projectedGap),{currency:goalCurrency,locale})}</strong></span>`:''}${f.forecast!==null?`<span>Restlaufzeit bei Plan <strong>ca. ${f.forecast} Monate</strong></span>`:''}</div>
        ${plan.components.length?`<div class="goal-source-list">${plan.components.map((component)=>`<div class="goal-source-row"><div><strong>${escapeHtml(component.label)}</strong><span>${component.amount<0?'−':''}${money(Math.abs(component.amount),{currency:goalCurrency,locale})} / Monat</span></div>${component.id&&canWrite?`<button class="table-action table-action--danger" type="button" data-action="goal-source-delete" data-id="${component.id}">Entfernen</button>`:''}</div>`).join('')}</div>`:''}
        <p class="goal-feasibility-note">${escapeHtml(f.note)}</p>
        <div class="card-footer-actions">${canWrite?`${g.target_date&&f.required>0?`<button class="table-action" type="button" data-action="goal-apply-suggestion" data-id="${g.id}" data-amount="${suggestedBase.toFixed(2)}">Vorschlag übernehmen</button>`:''}<button class="table-action" type="button" data-action="goal-edit" data-id="${g.id}">Bearbeiten</button><button class="table-action" type="button" data-action="goal-source-open" data-id="${g.id}">Finanzierung koppeln</button>${linkedAccount?'':`<button class="table-action" type="button" data-action="goal-progress" data-id="${g.id}" data-current="${effectiveCurrent}">Stand ändern</button>`}${deleteButton('savings_goals',g.id)}`:''}</div></article>`;
    }).join('')}</div>` : `<div class="card empty-state"><span class="empty-state-icon">${icon('target')}</span><h3>Noch kein Sparziel</h3><p>Lege dein erstes Ziel an und verbinde es bei Bedarf direkt mit einem Spar- oder Sondertopf.</p></div>`}
  `;
}
