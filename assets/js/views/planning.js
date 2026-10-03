import { pageHeader, sectionHeading, metricCard } from '../app/components.js';
import { money, monthInputValue } from '../app/format.js';
import { icon } from '../app/icons.js';

function enabled(key, moduleAccess, hiddenModules) {
  return moduleAccess?.[key] === true && !hiddenModules.includes(key);
}

function planCard({href,iconName,title,text,meta=''}) {
  return `<a class="card hub-link-card" href="${href}">
    <span class="hub-link-icon">${icon(iconName)}</span>
    <span class="hub-link-copy"><strong>${title}</strong><span>${text}</span>${meta?`<small>${meta}</small>`:''}</span>
    <span class="hub-link-chevron">${icon('chevron-right')}</span>
  </a>`;
}

export function renderPlanning({
  budgets=[], goals=[], bills=[], contracts=[], recurringRules=[], investments=[], pensions=[], assets=[],
  household, profile, moduleAccess={}, hiddenModules=[],
}={}) {
  const currency=household?.base_currency||'CHF';
  const locale=profile?.locale||'de-CH';
  const month=monthInputValue();
  const monthBudget=budgets.filter((b)=>String(b.month_start||'').slice(0,7)===month).reduce((s,b)=>s+Number(b.amount||0),0);
  const openBills=bills.filter((b)=>!['paid','cancelled'].includes(b.status)).length;
  const activeGoals=goals.filter((g)=>g.status==='active').length;
  const cards=[];

  if(enabled('budget',moduleAccess,hiddenModules)) cards.push(planCard({href:'#/budget',iconName:'chart',title:'Budget',text:'Ausgabenlimits und Monatsplanung',meta:monthBudget?money(monthBudget,{currency,locale}):'Noch kein Monatsbudget'}));
  if(enabled('goals',moduleAccess,hiddenModules)) cards.push(planCard({href:'#/goals',iconName:'target',title:'Rücklagen & Sparziele',text:'Notgroschen, Ferien und persönliche Ziele',meta:`${activeGoals} aktiv`}));
  if(enabled('bills',moduleAccess,hiddenModules)) cards.push(planCard({href:'#/bills',iconName:'receipt',title:'Rechnungen & Verträge',text:'Fälligkeiten, Zahlungen und Verträge',meta:`${openBills} offen`}));
  cards.push(planCard({href:'#/recurring',iconName:'repeat',title:'Daueraufträge',text:'Wiederkehrende Einnahmen und Ausgaben',meta:`${recurringRules.filter((r)=>r.active!==false).length} aktiv`}));
  if(enabled('tax',moduleAccess,hiddenModules)) cards.push(planCard({href:'#/tax-advisor',iconName:'receipt',title:'Steuern',text:'Steuerrelevante Buchungen und Export'}));
  if(enabled('investments',moduleAccess,hiddenModules)) cards.push(planCard({href:'#/investments',iconName:'chart',title:'Anlagen',text:'Investments und Transaktionen',meta:`${investments.length} Position${investments.length===1?'':'en'}`}));
  if(enabled('pension',moduleAccess,hiddenModules)) cards.push(planCard({href:'#/pension',iconName:'piggy-bank',title:'Vorsorge',text:'Vorsorgekonten und langfristige Planung',meta:`${pensions.length} Konto${pensions.length===1?'':'en'}`}));

  const more=[];
  if(enabled('wealth',moduleAccess,hiddenModules)) more.push(planCard({href:'#/wealth',iconName:'sparkles',title:'Vermögen',text:'Gesamtvermögen und Vermögenswerte',meta:`${assets.length} Wert${assets.length===1?'':'e'}`}));
  if(enabled('property',moduleAccess,hiddenModules)) more.push(planCard({href:'#/property',iconName:'home',title:'Immobilien',text:'Liegenschaften und Werte'}));
  if(enabled('vehicles',moduleAccess,hiddenModules)) more.push(planCard({href:'#/vehicles',iconName:'train',title:'Fahrzeuge',text:'Fahrzeuge und Mobilität'}));
  if(enabled('insurance',moduleAccess,hiddenModules)) more.push(planCard({href:'#/insurance',iconName:'shield',title:'Versicherungen',text:'Policen, Prämien und Termine'}));
  if(enabled('family',moduleAccess,hiddenModules)) more.push(planCard({href:'#/family',iconName:'heart-pulse',title:'Familie & Haushalt',text:'Gemeinsame Finanzen und Zugriffe'}));
  if(enabled('intelligence',moduleAccess,hiddenModules)) more.push(planCard({href:'#/intelligence',iconName:'sparkles',title:'Finance Intelligence',text:'Hinweise und Analysen'}));

  return `
    ${pageHeader({title:'Planung',subtitle:'Budget, Rücklagen, Rechnungen und langfristige Themen – getrennt vom täglichen Geldfluss.'})}
    <article class="card hero-card planning-hero">
      <div>
        <div class="hero-label">Dieser Monat · Budget</div>
        <div class="hero-value">${money(monthBudget,{currency,locale})}</div>
        <div class="hero-caption">${monthBudget ? 'Für den aktuellen Monat geplant.' : 'Noch kein Budget eingerichtet.'}</div>
      </div>
      <div class="hero-actions">
        ${enabled('budget',moduleAccess,hiddenModules)?'<a class="action-button action-button--primary" href="#/budget">Budget öffnen</a>':''}
        ${enabled('goals',moduleAccess,hiddenModules)?'<a class="action-button action-button--secondary" href="#/goals">Ziel anlegen</a>':''}
      </div>
    </article>
    ${sectionHeading('Meine Pläne','Nur Bereiche, die für deinen Zugriff freigeschaltet sind.')}
    <div class="hub-grid">${cards.join('') || '<div class="inline-alert"><strong>Noch keine Planungsmodule.</strong><span>Weitere Module können vom Administrator freigeschaltet werden.</span></div>'}</div>
    ${more.length ? `${sectionHeading('Weitere Bereiche','Langfristige Themen und Haushalt')}<div class="hub-grid">${more.join('')}</div>` : ''}
  `;
}
