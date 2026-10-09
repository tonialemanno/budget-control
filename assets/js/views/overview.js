import { pageHeader, sectionHeading, transactionRow } from '../app/components.js';
import { dateLabel, escapeHtml, money, shortDate } from '../app/format.js?v=20261008-r60';
import { icon } from '../app/icons.js';
import { fxLabel } from '../app/fx.js';
import { buildFinanceSnapshot } from '../app/finance-model.js';
import { buildFinanceCoach } from '../app/finance-coach.js?v=20261008-r60';
import {
  accountShare, annualIncomeBreakdown, categorySpending, currentFinanceCycleTotals,
  financeCycleSeries, historicalFinanceSurplusRecord, primaryOperatingAccount,
} from '../app/finance-insights.js?v=20261008-r60';
import { financeMonthMode, primaryAccountPreferenceId } from '../app/user-preferences.js';
import { financeCycleLabel } from '../app/finance-cycle.js';
import { renderCashflowChart, renderExpenseDonut, renderIncomePlan } from '../app/charts.js?v=20261008-r60';

function privacyMoney(value,{currency,locale,privacyEnabled=false,decimals=2}={}){
  return privacyEnabled?'•••':money(value,{currency,locale,decimals});
}

function insightCard(insight,{currency,locale,privacyEnabled=false}={}){
  const amount=(value)=>privacyMoney(value,{currency,locale,privacyEnabled});
  if(insight.type==='cash_shortfall'){
    return `<a class="coach-insight coach-insight--negative" href="${insight.href}">
      <span class="coach-insight-icon">${icon('info')}</span>
      <div><strong>Engpass vor dem nächsten Lohn</strong><p>Deine geplanten Verpflichtungen übersteigen das verfügbare Hauptkonto um <b>${amount(insight.amount)}</b>.</p><small>Planung öffnen und zuerst Fixkosten, Rücklagen und variable Rahmen prüfen.</small></div>
    </a>`;
  }
  if(insight.type==='budget_risk'){
    return `<a class="coach-insight coach-insight--warning" href="${insight.href}">
      <span class="coach-insight-icon">${icon('chart')}</span>
      <div><strong>Budget läuft schneller als der Finanzmonat</strong><p><b>${escapeHtml(insight.label)}</b>: ${amount(insight.spent)} von ${amount(insight.amount)} bereits verbraucht.</p><small>ALEMANNO BUCHHALTUNG vergleicht Verbrauch und vergangenen Anteil des Finanzmonats.</small></div>
    </a>`;
  }
  if(insight.type==='spending_spike'){
    return `<a class="coach-insight coach-insight--warning" href="${insight.href}">
      <span class="coach-insight-icon">${icon('chart')}</span>
      <div><strong>Ungewöhnlicher Anstieg erkannt</strong><p><b>${escapeHtml(insight.label)}</b>: letzte 7 Tage ${amount(insight.recent)}, üblicher Wochenwert etwa ${amount(insight.baseline)}.</p><small>Kein Urteil: ALEMANNO BUCHHALTUNG zeigt nur eine deutliche Abweichung von deinem bisherigen Muster.</small></div>
    </a>`;
  }
  if(insight.type==='uncategorized'){
    return `<a class="coach-insight" href="${insight.href}">
      <span class="coach-insight-icon">${icon('sparkles')}</span>
      <div><strong>ALEMANNO BUCHHALTUNG kann noch besser lernen</strong><p><b>${insight.count}</b> Ausgaben sind noch ohne Kategorie.</p><small>Einmal sauber zuordnen; bekannte Händler und Zahler werden danach wiederverwendet.</small></div>
    </a>`;
  }
  if(insight.type==='reserve_gap'){
    return `<a class="coach-insight" href="${insight.href}">
      <span class="coach-insight-icon">${icon('piggy-bank')}</span>
      <div><strong>Rücklage weiter auffüllen</strong><p><b>${escapeHtml(insight.label)}</b>: aktuell ${Math.round(insight.fundedPercent)} % finanziert. Geplanter Monatsbetrag ${amount(insight.monthly)}.</p><small>Jahreskosten werden als Rücklage geplant und erst bei Zahlung zur echten Ausgabe.</small></div>
    </a>`;
  }
  if(insight.type==='unbudgeted'){
    return `<a class="coach-insight" href="${insight.href}">
      <span class="coach-insight-icon">${icon('wallet')}</span>
      <div><strong>Ausgaben ausserhalb deiner Budgetrahmen</strong><p>${amount(insight.amount)} variable Ausgaben sind aktuell keinem Budgetrahmen zugeordnet.</p><small>Ein Budget ist ein Entscheidungsrahmen, keine zusätzliche Ausgabe.</small></div>
    </a>`;
  }
  if(insight.type==='no_budget'){
    return `<a class="coach-insight" href="${insight.href}">
      <span class="coach-insight-icon">${icon('target')}</span>
      <div><strong>Ausgaben sichtbar, aber noch ohne Rahmen</strong><p>Du hast variable Ausgaben, aber noch kein aktives variables Budget.</p><small>Mit wenigen Kategorien kann ALEMANNO BUCHHALTUNG dir vor dem Ausgeben sagen, was noch verfügbar ist.</small></div>
    </a>`;
  }
  if(insight.type==='subscriptions'){
    return `<a class="coach-insight" href="${insight.href}">
      <span class="coach-insight-icon">${icon('repeat')}</span>
      <div><strong>Abos im Blick behalten</strong><p><b>${insight.count}</b> erkannte Abos kosten zusammen ${amount(insight.monthly)} pro Monat und ${amount(insight.annual)} pro Jahr.</p><small>ALEMANNO BUCHHALTUNG zeigt die Belastung. Ob du ein Abo behalten willst, entscheidest du selbst.</small></div>
    </a>`;
  }
  return `<a class="coach-insight coach-insight--positive" href="${insight.href}">
    <span class="coach-insight-icon">${icon('shield')}</span>
    <div><strong>Dein Plan ist aktuell im Rahmen</strong><p>ALEMANNO BUCHHALTUNG sieht im Moment keinen akuten Budget- oder Ausgabenalarm.</p><small>Die Einschätzung wird mit jeder neuen Buchung neu berechnet.</small></div>
  </a>`;
}

function accountProgress(label,value,percent,meta='',accountId=''){
  const pct=Math.max(0,Math.min(100,Number(percent)||0));
  const open=accountId
    ? `<button class="insight-row insight-row--interactive" type="button" data-action="overview-account-edit" data-id="${escapeHtml(accountId)}" aria-label="${escapeHtml(label)} bearbeiten">`
    : '<div class="insight-row">';
  const close=accountId?'</button>':'</div>';
  return `${open}
    <div class="insight-row-head"><strong>${escapeHtml(label)}</strong><span>${value}</span></div>
    <div class="insight-track"><span style="--insight-progress:${pct}%"></span></div>
    ${meta?`<small>${escapeHtml(meta)}</small>`:''}
  ${close}`;
}

export function renderOverview({
  accounts = [], transactions = [], debtPayments = [], recurringRules = [], budgets = [], bills = [],
  debts = [], receivables = [], assets = [], properties = [], vehicles = [], investments = [], pensions = [],
  categories = [], merchants = [], household, profile, fxRates, privacyEnabled=false,
} = {}) {
  const locale=profile?.locale||'de-CH';
  const now=new Date();
  const selectedFinanceMonthMode=financeMonthMode(profile);
  const snapshot=buildFinanceSnapshot({
    accounts,transactions,debtPayments,recurringRules,budgets,categories,merchants,bills,debts,
    receivables,assets,properties,vehicles,investments,pensions,household,fxRates,now,financeMonthMode:selectedFinanceMonthMode,
  });
  const currency=snapshot.currency;
  const preferredPrimaryAccountId=primaryAccountPreferenceId(profile,household?.id,accounts);
  const primaryAccount=primaryOperatingAccount(accounts,recurringRules,currency,preferredPrimaryAccountId);
  const coach=buildFinanceCoach({
    snapshot,primaryAccount,accounts,transactions,debtPayments,recurringRules,budgets,categories,merchants,bills,
    household,fxRates,now,
  });
  const cycleTotals=currentFinanceCycleTotals({
    transactions,debtPayments,recurringRules,categories,baseCurrency:currency,fxRates,now,fallbackDay:25,financeMonthMode:selectedFinanceMonthMode,
  });
  const financeCycle=cycleTotals.cycle;
  const cycleLabel=financeCycleLabel(financeCycle,locale);
  const months=financeCycleSeries({
    transactions,debtPayments,recurringRules,categories,baseCurrency:currency,fxRates,now,cycles:6,fallbackDay:25,financeMonthMode:selectedFinanceMonthMode,
  });
  const categoriesSpent=categorySpending({
    transactions,debtPayments,categories,recurringRules,baseCurrency:currency,fxRates,now,limit:5,
    rangeStart:financeCycle.start,rangeEnd:financeCycle.endExclusive,
  });
  const categoryTotal=categoriesSpent[0]?.total||0;
  const annualIncome=annualIncomeBreakdown({
    transactions,categories,recurringRules,baseCurrency:currency,fxRates,year:now.getFullYear(),limit:5,
  });
  const accountRows=accountShare(accounts,currency,fxRates);
  const primaryRow=accountRows.find((row)=>row.account.account_id===primaryAccount?.account_id)||null;
  const otherLiquid=snapshot.cash-(primaryRow?.value||0);
  const actualTransactions=transactions.filter((tx)=>tx.status==='booked'&&new Date(tx.occurred_at)<=now);
  const hasForeign=accounts.some((row)=>row.currency!==currency)||transactions.some((row)=>row.currency!==currency);
  const budget=coach.budget;
  const daysLabel=coach.daysRemaining===1?'1 Tag':`${coach.daysRemaining} Tage`;
  const coachTone=coach.status==='negative'?'negative':coach.status==='warning'?'warning':'positive';
  const cycleLastDay=new Date(financeCycle.endExclusive.getTime()-24*60*60*1000);
  const savingsPotentialTone=coach.additionalSavingsPotential>0?'positive':'warning';
  const surplusRecord=historicalFinanceSurplusRecord({
    transactions,debtPayments,recurringRules,categories,baseCurrency:currency,fxRates,now,fallbackDay:25,financeMonthMode:selectedFinanceMonthMode,
  });
  const bestCompletedSurplus=surplusRecord?.net??null;
  const currentRecordCandidate=Math.max(0,Number(coach.additionalSavingsPotential||0));
  const recordGap=bestCompletedSurplus!==null&&bestCompletedSurplus>0
    ? Math.max(0,bestCompletedSurplus-currentRecordCandidate)
    : null;
  const recordDate=surplusRecord?.start?shortDate(new Date(surplusRecord.start),locale):null;
  const halfBudgetSpend=Math.max(0,Number(coach.variableRemaining||0))/2;
  const halfBudgetPotential=Math.max(0,Number(coach.zeroSpendEndBalance||0)-halfBudgetSpend);
  const dateKey=(value)=>value instanceof Date&&!Number.isNaN(value.getTime())?value.toISOString().slice(0,10):'';
  const cycleFrom=dateKey(financeCycle.start);
  const cycleTo=dateKey(new Date(financeCycle.endExclusive.getTime()-86400000));
  const recordFrom=surplusRecord?.start?dateKey(new Date(surplusRecord.start)):'';
  const recordTo=surplusRecord?.endExclusive?dateKey(new Date(new Date(surplusRecord.endExclusive).getTime()-86400000)):'';
  const seriesFrom=months.length?dateKey(new Date(Math.min(...months.map((row)=>new Date(row.start).getTime())))):'';


  if(!accounts.length){
    return `
      ${pageHeader({kicker:shortDate(now,locale),title:`Hallo ${profile?.display_name?.split(' ')[0]||''}`.trim(),subtitle:'ALEMANNO BUCHHALTUNG ist bereit für deine Einrichtung.'})}
      <article class="card onboarding-empty">
        <span class="onboarding-empty-icon">${icon('wallet')}</span>
        <div><h3>Dein erstes Konto fehlt noch.</h3><p>Erfasse den heutigen Kontostand. Historische Importe werden danach um diesen Stand herum eingeordnet und verändern den heutigen Anker nicht.</p></div>
        <a class="action-button action-button--primary" href="#/accounts?create=account">Konto einrichten</a>
      </article>`;
  }

  return `
    ${pageHeader({
      kicker:shortDate(now,locale),
      title:`Hallo ${profile?.display_name?.split(' ')[0]||''}`.trim(),
      subtitle:'ALEMANNO BUCHHALTUNG zeigt zuerst, was bis zum nächsten Lohn wirklich frei verfügbar ist.'
    })}

    ${hasForeign?`<div class="inline-alert inline-alert--success"><strong>Mehrere Währungen aktiv.</strong><span>${fxLabel(fxRates,currency)}. Originalbeträge bleiben auf den Konten erhalten.</span></div>`:''}

    <section class="coach-cockpit">
      <article class="card coach-hero coach-hero--${coachTone} dashboard-drilldown" data-drilldown="route" data-route="planning" role="link" tabindex="0" aria-label="Planung für frei verfügbares Geld öffnen">
        <div class="coach-hero-head">
          <div>
            <span class="coach-eyebrow">Bis zum nächsten Lohn frei</span>
            <div class="coach-free-value">${privacyMoney(coach.freeUntilIncome,{currency,locale,privacyEnabled})}</div>
            <p class="coach-status-copy">
              <span>Hauptkonto</span> <strong>${escapeHtml(primaryAccount?.name||'Operatives Konto')}</strong>
              <span>· Finanzmonat</span> <strong>${escapeHtml(cycleLabel)}</strong>
            </p>
          </div>
          <span class="coach-hero-icon">${icon('sparkles')}</span>
        </div>
        <div class="coach-commitment-row">
          <div><span>Aktueller Kontostand</span><strong>${privacyEnabled?'•••':money(primaryAccount?.current_balance||0,{currency:primaryAccount?.currency||currency,locale})}</strong></div>
          <div><span>Noch verplant</span><strong>${privacyMoney(coach.commitmentsRemaining,{currency,locale,privacyEnabled})}</strong></div>
        </div>
        <div class="coach-primary-actions">
          <a class="action-button action-button--primary" href="#/transactions?create=expense">${icon('plus')} Ausgabe</a>
          <a class="action-button action-button--secondary" href="#/transactions?create=income">Einnahme</a>
          <a class="action-button action-button--secondary" href="#/budget">Budget prüfen</a>
        </div>
      </article>

      <div class="coach-mini-grid">
        <article class="card coach-mini-card dashboard-drilldown" data-drilldown="settings-finance-month" role="link" tabindex="0" aria-label="Finanzmonat in den Einstellungen bearbeiten">
          <span class="coach-mini-icon">${icon('receipt')}</span>
          <span class="coach-mini-label">Bis zum nächsten Finanzmonat</span>
          <strong>${daysLabel}</strong>
          <small><span>Nächster Start</span> <b>${dateLabel(financeCycle.endExclusive,locale)}</b></small>
        </article>
        <article class="card coach-mini-card dashboard-drilldown" data-drilldown="route" data-route="planning" role="link" tabindex="0" aria-label="Planung für frei verfügbares Tagesbudget öffnen">
          <span class="coach-mini-icon">${icon('wallet')}</span>
          <span class="coach-mini-label">Frei pro Tag</span>
          <strong>${privacyMoney(coach.dailyAllowance,{currency,locale,privacyEnabled})}</strong>
          <small>Wochenrahmen ${privacyMoney(coach.weeklyAllowance,{currency,locale,privacyEnabled})}</small>
        </article>
        <article class="card coach-mini-card dashboard-drilldown" data-drilldown="route" data-route="planning" role="link" tabindex="0" aria-label="Fixkosten, Reserven und geplante Umbuchungen öffnen">
          <span class="coach-mini-icon">${icon('shield')}</span>
          <span class="coach-mini-label">Fix & reserviert</span>
          <strong>${privacyMoney(coach.fixedRemaining+coach.reserveRemaining+coach.transferRemaining,{currency,locale,privacyEnabled})}</strong>
          <small>bis zum nächsten Finanzmonat</small>
        </article>
        <article class="card coach-mini-card dashboard-drilldown" data-drilldown="route" data-route="budget" role="link" tabindex="0" aria-label="Variables Budget öffnen">
          <span class="coach-mini-icon">${icon('target')}</span>
          <span class="coach-mini-label">Variables Budget offen</span>
          <strong>${privacyMoney(coach.variableRemaining,{currency,locale,privacyEnabled})}</strong>
          <small><b>${budget.count}</b> <span>aktive Budgetrahmen</span></small>
        </article>
      </div>
    </section>

    <article class="card card-padding coach-hero coach-hero--${savingsPotentialTone} dashboard-drilldown" data-drilldown="route" data-route="goals" role="link" tabindex="0" aria-label="Sparziele und Sparpotenzial öffnen">
      <div class="coach-hero-head">
        <div>
          <span class="coach-eyebrow">${coach.additionalSavingsPotential>0?'Zusätzliches Sparpotenzial':'Auf dem Weg zum Monatsüberschuss'}</span>
          <h3 class="card-title">${coach.additionalSavingsPotential>0?'Wenn du ab jetzt nichts mehr zusätzlich ausgibst':'Erst zurück auf null, dann wird jeder freie Franken Sparpotenzial'}</h3>
          <div class="coach-free-value">${privacyMoney(coach.additionalSavingsPotential>0?coach.additionalSavingsPotential:coach.recoveryToZero,{currency,locale,privacyEnabled})}</div>
          <p class="coach-status-copy"><span>${coach.additionalSavingsPotential>0?'Zusätzlich zurücklegbar am':'Noch bis zum Nullpunkt am'}</span> <strong>${dateLabel(cycleLastDay,locale)}</strong></p>
        </div>
        <span class="coach-hero-icon">${icon(coach.additionalSavingsPotential>0?'piggy-bank':'target')}</span>
      </div>
      <div class="coach-commitment-row">
        <div><span>Hauptkonto heute</span><strong>${privacyMoney(coach.primaryBalance,{currency,locale,privacyEnabled})}</strong></div>
        <div><span>Noch geschützt / verplant</span><strong>${privacyMoney(coach.protectedUntilCycleEnd,{currency,locale,privacyEnabled})}</strong></div>
      </div>
      <p class="card-subtitle">${coach.additionalSavingsPotential>0
        ? 'Jede weitere variable Ausgabe reduziert diesen Betrag direkt. Wenn du nichts mehr ausgibst, bleibt genau dieses Potenzial für dein Sparen.'
        : 'Sobald dieser Wert bei null ist, wird jeder weitere freie Franken zu zusätzlichem Sparpotenzial.'}</p>
      <div class="card-footer-actions">
        <a class="table-action" href="/planning/goals">Sparziele öffnen</a>
        <a class="table-action" href="/planning">Planung prüfen</a>
      </div>
    </article>

    <section class="coach-notice-section">
      <div class="coach-section-head">
        <div><span class="coach-eyebrow">Deine Motivation</span><h3>Kleine Fortschritte, die man sonst leicht übersieht</h3></div>
      </div>
      <div class="coach-mini-grid">
        <article class="card coach-mini-card dashboard-drilldown" data-drilldown="transactions-range" data-from="${cycleFrom}" data-to="${cycleTo}" data-direction="all" role="link" tabindex="0" aria-label="Buchungen dieses Finanzmonats öffnen">
          <span class="coach-mini-icon">${icon('check-circle')}</span>
          <span class="coach-mini-label">No-Spend-Tage</span>
          <strong>${coach.noSpendDays}</strong>
          <small>Aktuelle Serie <b>${coach.noSpendStreak} Tage</b></small>
        </article>
        <article class="card coach-mini-card dashboard-drilldown" data-drilldown="${primaryAccount?.account_id?'account-edit':'route'}" ${primaryAccount?.account_id?`data-id="${escapeHtml(primaryAccount.account_id)}"`:'data-route="money"'} role="link" tabindex="0" aria-label="Hauptkonto öffnen und bearbeiten">
          <span class="coach-mini-icon">${icon('target')}</span>
          <span class="coach-mini-label">${coach.primaryStartBalance<0?'Minus abgebaut':'Hauptkonto seit Finanzmonat'}</span>
          <strong>${privacyMoney(coach.primaryStartBalance<0?coach.recoveredFromMinus:Math.abs(coach.primaryBalanceChange),{currency,locale,privacyEnabled})}</strong>
          <small>${coach.primaryStartBalance<0
            ? `${Math.round(coach.recoveryPercent||0)} % des Startminus aufgeholt`
            : `${coach.primaryBalanceChange>=0?'Plus':'Minus'} seit Start`}</small>
        </article>
        <article class="card coach-mini-card dashboard-drilldown" data-drilldown="${recordFrom?'transactions-range':'route'}" ${recordFrom?`data-from="${recordFrom}" data-to="${recordTo}" data-direction="all"`:'data-route="transactions"'} role="link" tabindex="0" aria-label="Finanzmonat des Überschuss-Rekords öffnen">
          <span class="coach-mini-icon">${icon('sparkles')}</span>
          <span class="coach-mini-label">Persönlicher Überschuss-Rekord</span>
          <strong>${bestCompletedSurplus!==null&&bestCompletedSurplus>0?privacyMoney(bestCompletedSurplus,{currency,locale,privacyEnabled}):'–'}</strong>
          <small>${recordGap===null
            ? '<span>Noch kein vollständig abgedeckter Finanzmonat mit Überschuss</span>'
            : `<span>Abgeschlossener Finanzmonat</span> · ${recordDate||''}${recordGap<=0
              ? ' · <span>Rekord wäre aktuell wieder drin</span>'
              : ` · <span>Noch</span> ${privacyMoney(recordGap,{currency,locale,privacyEnabled})} <span>bis zum Rekord</span>`}`}</small>
        </article>
        <article class="card coach-mini-card dashboard-drilldown" data-drilldown="route" data-route="budget" role="link" tabindex="0" aria-label="Budget für Was-wäre-wenn-Szenario öffnen">
          <span class="coach-mini-icon">${icon('piggy-bank')}</span>
          <span class="coach-mini-label">Was wäre wenn?</span>
          <strong>${privacyMoney(halfBudgetPotential,{currency,locale,privacyEnabled})}</strong>
          <small>${coach.variableRemaining>0?'wenn du nur die Hälfte des offenen variablen Budgets noch nutzt':'ohne weiteres variables Budget bleibt dein aktuelles Sparpotenzial'}</small>
        </article>
      </div>
    </section>

    <section class="coach-notice-section">
      <div class="coach-section-head">
        <div><span class="coach-eyebrow">ALEMANNO BUCHHALTUNG hat bemerkt …</span><h3>Was jetzt relevant ist</h3></div>
        <a class="card-link" href="#/planning">Planung öffnen</a>
      </div>
      <div class="coach-insight-grid">
        ${coach.insights.map((row)=>insightCard(row,{currency,locale,privacyEnabled})).join('')}
      </div>
    </section>

    <div class="coach-analysis-grid">
      <article class="card card-padding income-plan-card dashboard-drilldown" data-drilldown="route" data-route="planning" role="link" tabindex="0" aria-label="Planung öffnen">
        <div class="card-heading">
          <div><h3 class="card-title">Was von deinem Einkommen bleibt</h3><p class="card-subtitle">Eine klare Rechnung aus deinem aktuellen Monatsplan – ohne Flussdiagramm.</p></div>
          <a class="card-link" href="#/planning">Planung</a>
        </div>
        ${renderIncomePlan({flow:coach.flow,currency,locale,privacy:privacyEnabled})}
      </article>

      <article class="card card-padding budget-coach-card dashboard-drilldown" data-drilldown="route" data-route="budget" role="link" tabindex="0" aria-label="Budget öffnen und bearbeiten">
        <div class="card-heading">
          <div><h3 class="card-title">Variable Ausgaben</h3><p class="card-subtitle">Der Rahmen für Entscheidungen, die du im Alltag noch beeinflussen kannst.</p></div>
          <a class="card-link" href="#/budget">Budget öffnen</a>
        </div>
        <div class="budget-coach-progress">
          <div class="budget-coach-value"><strong>${Math.round(budget.rawPercent||0)}%</strong><span>verbraucht</span></div>
          <div class="budget-coach-track"><span style="--budget-coach-progress:${Math.min(100,Math.max(0,budget.rawPercent||0))}%"></span></div>
          <div class="budget-coach-stats">
            <div><span>Rahmen</span><strong>${privacyMoney(budget.total,{currency,locale,privacyEnabled})}</strong></div>
            <div><span>Ausgegeben</span><strong>${privacyMoney(budget.spent,{currency,locale,privacyEnabled})}</strong></div>
            <div><span>Noch verfügbar</span><strong>${privacyMoney(budget.remaining,{currency,locale,privacyEnabled})}</strong></div>
          </div>
        </div>
        ${!budget.count?'<a class="action-button action-button--primary action-button--block" href="#/budget">Budgetrahmen festlegen</a>':''}
      </article>
    </div>

    <div class="dashboard-chart-grid">
      <article class="card card-padding dashboard-donut-card dashboard-drilldown" data-drilldown="transactions-range" data-from="${cycleFrom}" data-to="${cycleTo}" data-direction="expense" role="link" tabindex="0" aria-label="Ausgaben dieses Finanzmonats öffnen">
        <div class="card-heading">
          <div><h3 class="card-title">Wofür du Geld ausgibst</h3><p class="card-subtitle">Echte Konsumausgaben im aktuellen Finanzmonat.</p></div>
          <a class="card-link" href="#/transactions">Details</a>
        </div>
        ${renderExpenseDonut({rows:categoriesSpent,total:categoryTotal,currency,locale,privacy:privacyEnabled})}
      </article>

      <article class="card card-padding finance-chart-card dashboard-drilldown" data-drilldown="transactions-range" data-from="${seriesFrom}" data-to="${cycleTo}" data-direction="all" role="link" tabindex="0" aria-label="Buchungen der letzten sechs Finanzmonate öffnen">
        <div class="card-heading">
          <div><h3 class="card-title">Deine Entwicklung</h3><p class="card-subtitle">Einnahmen und Ausgaben der letzten sechs Finanzmonate.</p></div>
          <a class="card-link" href="#/transactions">Buchungen</a>
        </div>
        ${renderCashflowChart({series:months,currency,locale,privacy:privacyEnabled})}
      </article>
    </div>

    <article class="card card-padding overview-income-card dashboard-drilldown" data-drilldown="income-year" data-kind="earned" role="link" tabindex="0" aria-label="Verdienste dieses Jahres öffnen">
      <div class="card-heading">
        <div><h3 class="card-title">Einnahmen ${annualIncome.year}</h3><p class="card-subtitle">Verdienst getrennt von Rückerstattungen, Rückzahlungen und ungeklärten Eingängen.</p></div>
        <button class="card-link card-link--button" type="button" data-action="overview-drilldown-income" data-kind="earned">Alle Verdienste</button>
      </div>
      <div class="income-summary-grid">
        <div class="income-summary-total"><span>Verdient</span><strong>${privacyMoney(annualIncome.earnedTotal,{currency,locale,privacyEnabled})}</strong></div>
        <div class="income-source-list">
          ${annualIncome.sources.length?annualIncome.sources.map((row)=>`<button class="income-source-row" type="button" data-action="overview-drilldown-income" data-source="${escapeHtml(row.label)}" data-sources="${escapeHtml((row.sourceNames||[row.label]).join('||'))}" data-transaction-ids="${escapeHtml((row.transactionIds||[]).join(','))}"><span>${escapeHtml(row.label)}</span><strong>${privacyMoney(row.value,{currency,locale,privacyEnabled})}</strong></button>`).join(''):'<div class="table-empty">Noch keine als Verdienst klassifizierten Einnahmen.</div>'}
        </div>
      </div>
      <div class="income-classification-strip">
        <button type="button" data-action="overview-drilldown-income" data-kind="refund"><span>Rückerstattungen</span><strong>${privacyMoney(annualIncome.refunds,{currency,locale,privacyEnabled})}</strong></button>
        <button type="button" data-action="overview-drilldown-income" data-kind="repayment"><span>Rückzahlungen</span><strong>${privacyMoney(annualIncome.repayments,{currency,locale,privacyEnabled})}</strong></button>
        <button type="button" data-action="overview-drilldown-income" data-kind="unclassified" class="${annualIncome.unclassified>0?'needs-review':''}"><span>Ungeklärt</span><strong>${privacyMoney(annualIncome.unclassified,{currency,locale,privacyEnabled})}</strong></button>
      </div>
    </article>

    <article class="card card-padding overview-account-card dashboard-drilldown" data-drilldown="route" data-route="money" role="link" tabindex="0" aria-label="Geldtöpfe öffnen">
      <div class="card-heading"><div><h3 class="card-title">Deine Geldtöpfe</h3><p class="card-subtitle">Hauptkonto, Sparkonten und Bargeld bleiben getrennt. Nur das Hauptkonto bestimmt den täglichen freien Rahmen.</p></div><a class="card-link" href="#/money">Geld öffnen</a></div>
      <div class="insight-list insight-list--accounts">
        ${accountRows.length
          ? accountRows.map((row)=>accountProgress(row.account.name,privacyEnabled?'•••':money(row.account.current_balance,{currency:row.account.currency,locale}),row.share,row.account.currency,row.account.account_id)).join('')
          : '<div class="table-empty">Noch keine liquiden Konten.</div>'}
      </div>
      <div class="coach-account-summary">
        <span>Andere liquide Konten <strong>${privacyMoney(otherLiquid,{currency,locale,privacyEnabled})}</strong></span>
        <span>Nettovermögen <strong>${privacyMoney(snapshot.netWorth,{currency,locale,privacyEnabled})}</strong></span>
        <span>Sparquote Finanzmonat <strong>${Math.round(cycleTotals.savingsRate)}%</strong></span>
      </div>
    </article>

    ${sectionHeading('Letzte Bewegungen','Die letzten echten Transaktionen','<a class="card-link" href="#/transactions">Alle ansehen</a>')}
    <article class="card card-padding dashboard-drilldown" data-drilldown="route" data-route="transactions" role="link" tabindex="0" aria-label="Alle Buchungen öffnen">
      ${actualTransactions.length
        ? `<div class="list">${actualTransactions.slice(0,6).map((tx)=>transactionRow(tx,{locale,interactive:true})).join('')}</div>`
        : '<div class="table-empty">Noch keine gebuchten Transaktionen.</div>'}
    </article>
  `;
}
