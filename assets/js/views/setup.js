import { pageHeader } from '../app/components.js';
import { escapeHtml } from '../app/format.js';
import { icon } from '../app/icons.js';

function step({number,title,text,done,action}) {
  return `<article class="card setup-step ${done?'setup-step--done':''}">
    <span class="setup-step-number">${done?icon('shield'):`<strong>${number}</strong>`}</span>
    <div class="setup-step-copy"><strong>${escapeHtml(title)}</strong><span>${escapeHtml(text)}</span></div>
    <div class="setup-step-action">${done?'<span class="status-pill status-pill--positive">Erledigt</span>':action}</div>
  </article>`;
}

export function renderSetupGuide({
  accounts=[], categories=[], categorizationRules=[], recurringRules=[], household, canWrite=false,
}={}) {
  const parents=categories.filter((c)=>!c.parent_id);
  const children=categories.filter((c)=>c.parent_id);
  const baseDone=Boolean(household?.country_code && household?.base_currency);
  const accountsDone=accounts.length>0;
  const categoriesDone=parents.length>=5;
  const automationDone=categorizationRules.length>0 || recurringRules.length>0;
  const done=[baseDone,accountsDone,categoriesDone,automationDone].filter(Boolean).length;
  const pct=Math.round(done/4*100);

  return `
    ${pageHeader({title:'Finance einrichten',subtitle:'Einmal sauber konfigurieren. Danach kann Finance Konten, Händler und Buchungen konsistent verarbeiten.'})}
    <article class="card card-padding setup-progress-card">
      <div class="setup-progress-head"><div><span class="page-kicker">Einrichtungsstatus</span><h3>${done} von 4 Schritten</h3></div><strong>${pct}%</strong></div>
      <div class="progress-track"><div class="progress-fill progress-fill--green" style="--progress:${pct}%"></div></div>
      <p>Deine bestehenden Daten bleiben unverändert. Die Einrichtung ergänzt nur Stammdaten und Regeln.</p>
    </article>
    <div class="setup-steps">
      ${step({number:1,title:'Basis festlegen',text:`${household?.country_code||'Land'} · ${household?.base_currency||'Währung'} · Haushalt`,done:baseDone,action:'<a class="action-button action-button--secondary" href="#/settings">Prüfen</a>'})}
      ${step({number:2,title:'Konten & Geldbörsen',text:accountsDone?`${accounts.length} Konto${accounts.length===1?'':'en'} eingerichtet`:'UBS, Revolut, Bargeld oder weitere Konten mit aktuellem Stand erfassen.',done:accountsDone,action:'<a class="action-button action-button--primary" href="#/accounts?create=account">Erstes Konto</a>'})}
      ${step({number:3,title:'Kategorien, Unterkategorien & Händler',text:categoriesDone?`${parents.length} Hauptkategorien · ${children.length} Unterkategorien`:'Empfohlene Kategorien, Unterkategorien und Händlerregeln anlegen oder selbst konfigurieren.',done:categoriesDone,action:canWrite?'<button class="action-button action-button--primary" type="button" data-action="starter-categories">Empfohlene Struktur</button>':'<a class="action-button action-button--secondary" href="#/categories">Ansehen</a>'})}
      ${step({number:4,title:'Automatik vorbereiten',text:automationDone?`${categorizationRules.length} Händlerregel${categorizationRules.length===1?'':'n'} · ${recurringRules.length} wiederkehrend`:'Händlerregeln und wiederkehrende Zahlungen sorgen dafür, dass Finance später weniger fragen muss.',done:automationDone,action:'<a class="action-button action-button--secondary" href="#/categories">Regeln einrichten</a>'})}
    </div>
    <article class="card card-padding setup-finish">
      <div><h3 class="card-title">${done===4?'Finance ist eingerichtet.':'Du kannst jederzeit weiterarbeiten.'}</h3><p class="card-subtitle">${done===4?'Ab jetzt geht es im Alltag hauptsächlich um Erfassen, Prüfen und Verstehen.':'Die Einrichtung muss nicht in einem Durchgang fertig werden.'}</p></div>
      <a class="action-button action-button--primary" href="#/overview">Zur Übersicht</a>
    </article>
  `;
}
