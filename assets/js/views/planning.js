import { pageHeader, sectionHeading } from '../app/components.js';
import { escapeHtml, money } from '../app/format.js';
import { icon } from '../app/icons.js';
import { budgetSummary, goalSummaries } from '../app/finance-insights.js';
import { buildFreedCommitmentSuggestion } from '../app/finance-coach.js';

function enabled(key, moduleAccess, hiddenModules) {
  return moduleAccess?.[key] === true && !hiddenModules.includes(key);
}

function planCard({href,iconName,title,text,meta='',progress=null}) {
  return `<a class="card plan-feature-card" href="${href}">
    <span class="hub-link-icon">${icon(iconName)}</span>
    <div class="plan-feature-copy"><strong>${title}</strong><span>${text}</span>${meta?`<small>${meta}</small>`:''}
      ${progress===null?'':`<div class="insight-track"><span style="--insight-progress:${Math.max(0,Math.min(100,progress))}%"></span></div>`}
    </div>
    <span class="hub-link-chevron">${icon('chevron-right')}</span>
  </a>`;
}

export function renderPlanning({
  budgets=[], goals=[], bills=[], recurringRules=[], contracts=[], investments=[], pensions=[], assets=[], debts=[], accounts=[],
  transactions=[], debtPayments=[], categories=[], merchants=[], household, profile, fxRates, moduleAccess={}, hiddenModules=[],
}={}) {
  const currency=household?.base_currency||'CHF';
  const locale=profile?.locale||'de-CH';
  const budget=budgetSummary({budgets,transactions,debtPayments,categories,merchants,recurringRules,baseCurrency:currency,fxRates,fallbackDay:25});
  const goalRows=goalSummaries(goals).slice(0,4);
  const openBills=bills.filter((b)=>!['paid','cancelled'].includes(b.status));
  const activeRecurring=recurringRules.filter((r)=>r.active!==false);
  const fixedExpenses=activeRecurring.filter((r)=>r.direction==='expense');
  const fixedIncome=activeRecurring.filter((r)=>r.direction==='income');
  const installmentDebts=debts.filter((d)=>d.status!=='paid' && Number(d.installment_amount||0)>0);
  const freedCommitment=buildFreedCommitmentSuggestion({recurringRules,accounts,baseCurrency:currency,fxRates,now:new Date()});
  const cards=[];

  cards.push(planCard({
    href:'#/fixed-costs',iconName:'receipt',title:'Fixkosten',
    text:'Miete, Krankenkasse, Abos und feste Umbuchungen',
    meta:`${fixedExpenses.length} Ausgaben · ${fixedIncome.length} Einnahmen`
  }));
  cards.push(planCard({
    href:'#/recurring',iconName:'repeat',title:'Daueraufträge & Automatik',
    text:'Rhythmus, nächste Termine und wiederkehrende Bewegungen',
    meta:`${activeRecurring.length} aktiv`
  }));
  if(enabled('bills',moduleAccess,hiddenModules)) cards.push(planCard({
    href:'#/bills',iconName:'receipt',title:'Rechnungen & Verträge',
    text:'Fälligkeiten, Zahlungen und Verträge',
    meta:`${openBills.length} offen · ${contracts.filter((c)=>c.status==='active').length} Verträge`
  }));
  if(enabled('debts',moduleAccess,hiddenModules)) cards.push(planCard({
    href:'#/debts',iconName:'credit-card',title:'Raten',
    text:'Geplante Tilgungen und offene Kredite',
    meta:`${installmentDebts.length} mit Rate`
  }));
  if(enabled('tax',moduleAccess,hiddenModules)) cards.push(planCard({
    href:'#/tax-advisor',iconName:'receipt',title:'Steuern',
    text:'Steuerrelevante Buchungen, Zahlungen und Dossier',
  }));
  if(enabled('investments',moduleAccess,hiddenModules)) cards.push(planCard({
    href:'#/investments',iconName:'chart',title:'Anlagen',
    text:'Investments und Transaktionen',
    meta:`${investments.length} Position${investments.length===1?'':'en'}`
  }));
  if(enabled('pension',moduleAccess,hiddenModules)) cards.push(planCard({
    href:'#/pension',iconName:'piggy-bank',title:'Vorsorge',
    text:'Vorsorgekonten und langfristige Planung',
    meta:`${pensions.length} Konto${pensions.length===1?'':'en'}`
  }));

  const more=[];
  if(enabled('wealth',moduleAccess,hiddenModules)) more.push(planCard({href:'#/wealth',iconName:'sparkles',title:'Vermögen',text:'Vermögenswerte und Gesamtbild',meta:`${assets.length} weitere Werte`}));
  if(enabled('property',moduleAccess,hiddenModules)) more.push(planCard({href:'#/property',iconName:'home',title:'Immobilien',text:'Liegenschaften und Werte'}));
  if(enabled('vehicles',moduleAccess,hiddenModules)) more.push(planCard({href:'#/vehicles',iconName:'train',title:'Fahrzeuge',text:'Fahrzeuge und Mobilität'}));
  if(enabled('insurance',moduleAccess,hiddenModules)) more.push(planCard({href:'#/insurance',iconName:'shield',title:'Versicherungen',text:'Policen, Prämien und Termine'}));
  if(enabled('family',moduleAccess,hiddenModules)) more.push(planCard({href:'#/family',iconName:'heart-pulse',title:'Familie & Haushalt',text:'Gemeinsame Finanzen und Zugriffe'}));
  if(enabled('intelligence',moduleAccess,hiddenModules)) more.push(planCard({href:'#/intelligence',iconName:'sparkles',title:'Finance Intelligence',text:'Hinweise und Analysen'}));

  return `
    ${pageHeader({
      title:'Planung',
      subtitle:'Was mit deinem Geld als Nächstes passiert: Budget, Rücklagen, Fixkosten, Rechnungen, Raten und langfristige Ziele.'
    })}

    ${freedCommitment?`<article class="card card-padding planning-freed-card">
      <span class="planning-freed-icon">${icon('piggy-bank')}</span>
      <div>
        <span class="eyebrow">Demnächst frei</span>
        <h3>${escapeHtml(freedCommitment.sourceLabel)} endet</h3>
        <p>Ab <strong>${escapeHtml(new Intl.DateTimeFormat(locale,{month:'long',year:'numeric'}).format(freedCommitment.availableFrom))}</strong> werden ${money(freedCommitment.freedMonthly,{currency,locale,decimals:0})} pro Monat frei.</p>
        <small>${freedCommitment.currentSavings>0
          ? `Vorschlag: ${escapeHtml(freedCommitment.savingLabel)} von ${money(freedCommitment.currentSavings,{currency,locale,decimals:0})} auf ${money(freedCommitment.suggestedSavings,{currency,locale,decimals:0})} erhöhen.`
          : `Vorschlag: ${money(freedCommitment.freedMonthly,{currency,locale,decimals:0})} monatlich direkt sparen.`}</small>
      </div>
      <a class="action-button action-button--secondary" href="#/fixed-costs">Planung prüfen</a>
    </article>`:''}

        <div class="planning-focus-grid">
      <article class="card card-padding planning-budget-card">
        <div class="card-heading"><div><h3 class="card-title">Variables Budget dieses Finanzmonats</h3><p class="card-subtitle">${budget.count?`${budget.count} variable Budgetposition${budget.count===1?'':'en'} · ${budget.allStoredCount-budget.count} getrennt behandelt`:'Noch nicht eingerichtet'}</p></div><a class="card-link" href="#/budget">So wird gerechnet</a></div>
        <div class="budget-ring-wrap">
          <div class="budget-ring budget-ring--large" style="--ring-progress:${budget.percent}"><div><strong>${Math.round(budget.rawPercent)}%</strong><span>verbraucht</span></div></div>
          <div class="budget-ring-copy">
            <span>Variables Budget <strong>${money(budget.total,{currency,locale,decimals:0})}</strong></span>
            <span>Variabel ausgegeben <strong>${money(budget.spent,{currency,locale,decimals:0})}</strong></span>
            <span>${budget.overBy>0?'Darüber':'Noch verfügbar'} <strong>${money(budget.overBy>0?budget.overBy:budget.remaining,{currency,locale,decimals:0})}</strong></span>
            <span>Fixkosten separat <strong>${money(budget.fixedPlanned,{currency,locale,decimals:0})}</strong></span>
          </div>
        </div>
        ${!budget.count?'<a class="action-button action-button--primary action-button--block" href="#/budget">Budget einrichten</a>':''}
      </article>

      <article class="card card-padding planning-goals-card">
        <div class="card-heading"><div><h3 class="card-title">Rücklagen & Sparziele</h3><p class="card-subtitle">${goalRows.length?`${goalRows.length} aktive Ziele`:'Noch kein aktives Ziel'}</p></div>${enabled('goals',moduleAccess,hiddenModules)?'<a class="card-link" href="#/goals">Öffnen</a>':''}</div>
        <div class="goal-preview-list">
          ${goalRows.length ? goalRows.map((goal)=>`<a class="goal-preview" href="#/goals">
            <div class="goal-preview-head"><strong>${escapeHtml(goal.name)}</strong><span>${Math.round(goal.progressPercent)}%</span></div>
            <div class="insight-track"><span style="--insight-progress:${goal.progressPercent}%"></span></div>
            <small>${money(goal.current_amount,{currency:goal.currency||currency,locale,decimals:0})} von ${money(goal.target_amount,{currency:goal.currency||currency,locale,decimals:0})}</small>
          </a>`).join('') : enabled('goals',moduleAccess,hiddenModules)
            ? '<div class="plan-empty"><p>Lege einen Notgroschen, Ferien- oder Sparplan an.</p><a class="action-button action-button--secondary" href="#/goals">Ziel anlegen</a></div>'
            : '<div class="table-empty">Sparziele sind nicht freigeschaltet.</div>'}
        </div>
      </article>
    </div>

    ${sectionHeading('Meine Pläne','Die Funktionen bleiben getrennt sichtbar, lesen aber dieselben Konten und Geldbewegungen.')}
    <div class="plan-feature-grid">${cards.join('')}</div>

    ${more.length ? `${sectionHeading('Langfristig','Vermögen, Haushalt und weitere Bereiche')}<div class="plan-feature-grid">${more.join('')}</div>` : ''}
  `;
}
