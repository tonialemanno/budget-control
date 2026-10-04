import { pageHeader } from '../app/components.js';
import { dateInputValue, escapeHtml } from '../app/format.js';
import { icon } from '../app/icons.js';
import { buildSetupStatus } from '../app/setup-model.js';

function localeLabel(locale) {
  return ({
    'de-CH':'Deutsch · Schweiz',
    'de-DE':'Deutsch · Deutschland',
    'it-CH':'Italiano · Svizzera',
    'it-IT':'Italiano · Italia',
    'en-CH':'English · Switzerland',
    'en-GB':'English · United Kingdom',
  })[locale] || locale || 'Deutsch · Schweiz';
}

function moduleEnabled(key,moduleAccess={},hiddenModules=[]) {
  return moduleAccess?.[key]===true&&!hiddenModules.includes(key);
}

function actionLink(href,label,primary=false) {
  return `<a class="action-button ${primary?'action-button--primary':'action-button--secondary'}" href="${href}">${escapeHtml(label)}</a>`;
}

function reviewButton(key,label='Später') {
  return `<button class="action-button action-button--secondary" type="button" data-action="setup-review" data-key="${escapeHtml(key)}">${escapeHtml(label)}</button>`;
}


function setupMonthlyPlanForms({accounts=[],categories=[],recurringRules=[],canWrite=false}={}) {
  if(!canWrite) return '';
  const accountOptions=accounts.map((a)=>`<option value="${a.account_id}">${escapeHtml(a.name)} · ${escapeHtml(a.currency)}</option>`).join('');
  const expenseCategories=categories.filter((c)=>c.kind==='expense').map((c)=>`<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
  const fixedCostPresets=[
    ['Miete','Miete'],
    ['Krankenkasse','Krankenkasse'],
    ['Kinderunterhalt / Alimente','Kinderunterhalt / Alimente'],
    ['Telefon & Internet','Telefon & Internet'],
    ['Versicherungen','Versicherungen'],
    ['Steuern','Steuern'],
    ['Haushaltsabgaben','Haushaltsabgaben'],
  ].map(([label,categoryName])=>{
    const category=categories.find((c)=>c.kind==='expense'&&c.name===categoryName);
    return category?`<option value="${category.id}" data-description="${escapeHtml(label)}">${escapeHtml(label)}</option>`:'';
  }).join('');
  const incomeRules=recurringRules.filter((r)=>r.active!==false&&r.direction==='income');
  const expenseRules=recurringRules.filter((r)=>r.active!==false&&r.direction==='expense');
  const next=dateInputValue();
  return `
    <div class="setup-monthly-plan">
      <div class="setup-monthly-plan-summary">
        <span><strong>${incomeRules.length}</strong> feste Einnahmen</span>
        <span><strong>${expenseRules.length}</strong> Fixkosten</span>
      </div>
      <details class="setup-inline-panel" ${incomeRules.length?'':'open'}>
        <summary>Monatseinnahme hinzufügen</summary>
        <form class="form-grid form-grid--2 setup-inline-form" id="setup-income-create" data-form="setup-income-create">
          <label class="field"><span>Bezeichnung</span><input class="text-control" name="description" value="Lohn" required></label>
          <label class="field"><span>Arbeitgeber / Zahler</span><input class="text-control" name="counterparty" placeholder="z. B. Abacus Umantis"></label>
          <label class="field"><span>Nettobetrag pro Monat</span><input class="text-control" name="amount" type="number" min="0.01" step="0.01" required></label>
          <label class="field"><span>Auf Konto</span><select class="text-control" name="accountId" required><option value="">Bitte wählen</option>${accountOptions}</select></label>
          <label class="field"><span>Zahlungstag / nächster Eingang</span><input class="text-control" name="nextDate" type="date" value="${next}" required></label>
          <div class="field"><span>&nbsp;</span><button class="action-button action-button--primary" type="submit">Monatseinnahme speichern</button></div>
        </form>
      </details>
      <details class="setup-inline-panel">
        <summary>Fixkosten hinzufügen</summary>
        <form class="form-grid form-grid--2 setup-inline-form" id="setup-expense-create" data-form="setup-expense-create">
          <label class="field"><span>Typische Position</span><select class="text-control" id="setupExpensePreset"><option value="">Frei erfassen</option>${fixedCostPresets}</select><small>Finance füllt Bezeichnung und Kategorie vor. Du kannst beides danach ändern.</small></label>
          <label class="field"><span>Bezeichnung / Zweck</span><input class="text-control" id="setupExpenseDescription" name="description" required placeholder="z. B. Miete"></label>
          <label class="field"><span>Empfänger</span><input class="text-control" name="counterparty" placeholder="z. B. UZON"><small>Optional. Neue Empfänger werden bei Bedarf automatisch als Händler angelegt.</small></label>
          <label class="field"><span>Betrag pro Zahlung</span><input class="text-control" name="amount" type="number" min="0.01" step="0.01" required></label>
          <label class="field"><span>Von Konto</span><select class="text-control" name="accountId" required><option value="">Bitte wählen</option>${accountOptions}</select></label>
          <label class="field"><span>Kategorie</span><select class="text-control" id="setupExpenseCategory" name="categoryId" required><option value="">Bitte wählen</option>${expenseCategories}</select></label>
          <label class="field"><span>Nächster Zahlungstermin</span><input class="text-control" name="nextDate" type="date" value="${next}" required></label>
          <div class="field form-grid-span"><button class="action-button action-button--primary" type="submit">Fixkosten speichern</button></div>
        </form>
      </details>
    </div>`;
}
function stepCard({
  number,key,title,text,done,current=false,optional=false,meta='',actions='',iconName='settings'
}) {
  const state=done?'done':current?'current':'open';
  return `<article class="card setup-wizard-step setup-wizard-step--${state}" data-setup-step="${escapeHtml(key)}">
    <div class="setup-wizard-marker">
      <span class="setup-step-number">${done?icon('shield'):`<strong>${number}</strong>`}</span>
      ${number<9?'<span class="setup-wizard-line" aria-hidden="true"></span>':''}
    </div>
    <div class="setup-wizard-body">
      <div class="setup-wizard-title-row">
        <span class="hub-link-icon setup-wizard-icon">${icon(iconName)}</span>
        <div>
          <div class="setup-wizard-labels"><strong>${escapeHtml(title)}</strong>${optional?'<span class="status-pill status-pill--neutral">Optional</span>':''}${done?'<span class="status-pill status-pill--positive">Erledigt</span>':''}</div>
          <p>${escapeHtml(text)}</p>
          ${meta?`<small>${escapeHtml(meta)}</small>`:''}
        </div>
      </div>
      ${actions?`<div class="setup-wizard-actions">${actions}</div>`:''}
    </div>
  </article>`;
}

export function renderSetupGuide({
  accounts=[],categories=[],merchants=[],categorizationRules=[],recurringRules=[],
  budgets=[],goals=[],debts=[],receivables=[],taxCases=[],
  household,profile,canWrite=false,moduleAccess={},hiddenModules=[],
}={}) {
  const status=buildSetupStatus({
    accounts,categories,merchants,categorizationRules,recurringRules,budgets,goals,debts,receivables,taxCases,household,profile,
  });
  const s=status.states;
  const firstOpen=status.firstOpen;
  const completedCount=status.completed?9:status.preparationDone;
  const pct=Math.round(completedCount/9*100);
  const financeReady=status.ready;
  const visibleModules=[
    moduleEnabled('budget',moduleAccess,hiddenModules)?['#/budget','Budget','chart']:null,
    moduleEnabled('goals',moduleAccess,hiddenModules)?['#/goals','Sparziele','target']:null,
    moduleEnabled('debts',moduleAccess,hiddenModules)?['#/debts','Schulden','credit-card']:null,
    moduleEnabled('debts',moduleAccess,hiddenModules)?['#/receivables','Forderungen','banknote']:null,
    moduleEnabled('tax',moduleAccess,hiddenModules)?['#/tax-advisor','Steuern','receipt']:null,
  ].filter(Boolean);

  const steps=[
    stepCard({
      number:1,key:'basis',title:'Sprache, Land & Basiswährung',
      text:'Lege fest, wie Finance Zahlen, Währungen und regionale Regeln interpretiert.',
      done:s.basis,current:firstOpen==='basis',iconName:'settings',
      meta:`${localeLabel(profile?.locale)} · ${household?.country_code||'Land'} · ${household?.base_currency||'Währung'}`,
      actions:actionLink('#/settings','Basis prüfen',!s.basis),
    }),
    stepCard({
      number:2,key:'accounts',title:'Konten & Geldbörsen',
      text:'Lege UBS, Revolut, Bargeld, Kreditkarten oder weitere Konten an. Jede Währung bleibt am Konto erhalten.',
      done:s.accounts,current:firstOpen==='accounts',iconName:'wallet',
      meta:s.accounts?`${accounts.length} Konto${accounts.length===1?'':'en'} eingerichtet`:'Noch kein Konto eingerichtet',
      actions:actionLink('#/accounts?create=account',s.accounts?'Konten verwalten':'Erstes Konto anlegen',!s.accounts),
    }),
    stepCard({
      number:3,key:'balances',title:'Aktuelle Kontostände',
      text:'Der heutige Kontostand wird als verbindlicher Anker gespeichert. Historische Importe verändern diesen Stand nicht rückwirkend.',
      done:s.balances,current:firstOpen==='balances',iconName:'banknote',
      meta:s.balances?'Alle aktiven Konten besitzen einen Stand-jetzt-Anker.':'Prüfe den aktuellen Stand jedes Kontos.',
      actions:actionLink('#/accounts','Kontostände prüfen',!s.balances),
    }),
    stepCard({
      number:4,key:'categories',title:'Hauptkategorien',
      text:'Definiere die grobe Struktur: Wohnen, Lebensmittel, Mobilität, Gesundheit, Freizeit und weitere Bereiche.',
      done:s.categories,current:firstOpen==='categories',iconName:'layout-grid',
      meta:`${status.parents} Hauptkategorien vorhanden`,
      actions:canWrite&&!s.categories
        ? '<button class="action-button action-button--primary" type="button" data-action="starter-categories">Empfohlene Struktur einrichten</button>'
        : actionLink('#/categories','Kategorien öffnen',false),
    }),
    stepCard({
      number:5,key:'subcategories',title:'Unterkategorien',
      text:'Verfeinere deine Struktur, zum Beispiel Lebensmittel › Supermarkt oder Mobilität › Tanken.',
      done:s.subcategories,current:firstOpen==='subcategories',iconName:'layout-grid',
      meta:`${status.children} Unterkategorien vorhanden`,
      actions:actionLink('#/categories',s.subcategories?'Unterkategorien prüfen':'Unterkategorien einrichten',!s.subcategories),
    }),
    stepCard({
      number:6,key:'automation',title:'Händler & automatische Zuordnung',
      text:'Händler bleiben Händler. Finance merkt sich ihre Standardkategorie und kann Importe und Belege automatisch einordnen.',
      done:s.automation,current:firstOpen==='automation',iconName:'basket',
      meta:`${status.linkedMerchants} Händler mit Standardkategorie · ${categorizationRules.length} zusätzliche Regeln`,
      actions:actionLink('#/merchants',s.automation?'Händler prüfen':'Händler zuordnen',!s.automation),
    }),
    stepCard({
      number:7,key:'recurring',title:'Monatseinnahmen & Fixkosten',
      text:'Lege schon beim Start fest, was monatlich hereinkommt und welche festen Verpflichtungen du hast. So kennt Finance deinen echten Monatsrahmen vor dem ersten Import.',
      done:s.recurring,current:firstOpen==='recurring',optional:true,iconName:'repeat',
      meta:`${status.recurringIncome} / ${status.recurringExpenses}`,
      actions:`${setupMonthlyPlanForms({accounts,categories,recurringRules,canWrite})}<div class="setup-wizard-actions-row">${actionLink('#/fixed-costs','Alle festen Positionen öffnen',false)}${!s.recurring&&canWrite?reviewButton('recurring','Später einrichten'):''}</div>`,
    }),
    stepCard({
      number:8,key:'modules',title:'Budget, Ziele, Schulden, Forderungen & Steuern',
      text:'Aktiviere und richte nur die Bereiche ein, die du tatsächlich brauchst. Diese Module lesen denselben Finance-Kern.',
      done:s.modules,current:firstOpen==='modules',optional:true,iconName:'sparkles',
      meta:visibleModules.length?`${visibleModules.length} optionale Bereiche für deinen Zugriff verfügbar`:'Optionale Module können später durch den Admin freigeschaltet werden.',
      actions:`<div class="setup-module-links">${visibleModules.map(([href,label,iconName])=>`<a href="${href}">${icon(iconName)}<span>${escapeHtml(label)}</span></a>`).join('')}${actionLink('#/settings','Module verwalten',false)}</div>${!s.modules&&canWrite?reviewButton('modules','Später entscheiden'):''}`,
    }),
    stepCard({
      number:9,key:'finish',title:status.completed?'Finance ist eingerichtet':'Bereit für deine Übersicht',
      text:status.completed
        ? 'Deine Einrichtung bleibt jederzeit anpassbar. Änderungen an Konten, Kategorien oder Modulen wirken auf denselben Finanzkern.'
        : financeReady
          ? 'Die Grundlage steht. Ab jetzt besteht der Alltag aus Erfassen oder Importieren, automatischer Zuordnung, Prüfen und Verstehen.'
          : 'Schliesse die Pflichtschritte ab und entscheide bei den optionalen Schritten, ob du sie jetzt oder später einrichten möchtest.',
      done:status.completed,current:firstOpen==='finish',iconName:'shield',
      meta:status.completed?'Einrichtung abgeschlossen':financeReady?'Alle Einrichtungsentscheidungen getroffen':`${status.requiredDone} von 6 Pflichtschritten abgeschlossen`,
      actions:status.completed
        ? actionLink('#/overview','Zur Übersicht',true)
        : `<form id="setup-complete" data-form="setup-complete"><button class="action-button action-button--primary" type="submit" ${financeReady&&canWrite?'':'disabled'}>Einrichtung abschliessen</button></form>`,
    }),
  ];

  return `
    ${pageHeader({
      title:'Finance einrichten',
      subtitle:'Richte Finance einmal auf dein tatsächliches Finanzleben ein. Danach arbeiten Konten, Transaktionen, Kategorien, Planung und Module auf derselben Datenbasis.'
    })}

    <article class="card card-padding setup-progress-card setup-progress-card--wizard">
      <div class="setup-progress-head">
        <div><span class="page-kicker">Einrichtungsstatus</span><h3>${status.completed?'9 von 9 Schritten':`${status.preparationDone} von 8 Vorbereitungen`}</h3></div>
        <strong>${pct}%</strong>
      </div>
      <div class="progress-track"><div class="progress-fill progress-fill--green" style="--progress:${pct}%"></div></div>
      <div class="setup-progress-meta">
        <span><strong>${status.requiredDone}/6</strong> Pflichtschritte</span>
        <span><strong>${status.recurring?'✓':'–'}</strong> Wiederkehrend</span>
        <span><strong>${status.modules?'✓':'–'}</strong> Module geprüft</span>
      </div>
      <p>Bestehende Kontostände, Buchungen und historische Daten werden nicht zurückgesetzt. Der Wizard prüft und ergänzt nur die Struktur, die Finance für Automatik und Auswertungen benötigt.</p>
    </article>

    <div class="setup-wizard">${steps.join('')}</div>
  `;
}
