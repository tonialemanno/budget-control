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

export function renderSetupGuide({
  accounts=[], categories=[], merchants=[], recurringRules=[], household, profile, canWrite=false,
}={}) {
  const parents=categories.filter((c)=>!c.parent_id);
  const children=categories.filter((c)=>c.parent_id);
  const baseDone=Boolean(household?.country_code && household?.base_currency && profile?.locale);
  const accountsDone=accounts.length>0;
  const structureDone=parents.length>=5 && merchants.length>=3;
  const requiredDone=[baseDone,accountsDone,structureDone].filter(Boolean).length;
  const pct=Math.round(requiredDone/3*100);
  const completed=Boolean(profile?.onboarding_completed_at);

  return `
    ${pageHeader({
      title:'Finance einrichten',
      subtitle:'Einmal sauber konfigurieren. Danach kennt Finance deine Konten, Kategorien und Händler und kann im Alltag deutlich mehr automatisch erledigen.'
    })}

    <article class="card card-padding setup-progress-card">
      <div class="setup-progress-head">
        <div><span class="page-kicker">Einrichtungsstatus</span><h3>${requiredDone} von 3 Grundschritten</h3></div>
        <strong>${pct}%</strong>
      </div>
      <div class="progress-track"><div class="progress-fill progress-fill--green" style="--progress:${pct}%"></div></div>
      <p>Kontostände und bestehende Buchungen werden nicht verändert. Die Einrichtung legt nur den Kontext fest, den Finance für automatische Zuordnung und Auswertungen benötigt.</p>
    </article>

    <div class="setup-steps">
      ${step({
        number:1,
        title:'Sprache, Land & Basiswährung',
        text:`${localeLabel(profile?.locale)} · ${household?.country_code||'Land'} · ${household?.base_currency||'Währung'}`,
        done:baseDone,
        action:'<a class="action-button action-button--secondary" href="#/settings">Prüfen</a>'
      })}
      ${step({
        number:2,
        title:'Konten & Geldbörsen',
        text:accountsDone
          ? `${accounts.length} Konto${accounts.length===1?'':'en'} eingerichtet`
          : 'UBS, Revolut, Bargeld oder weitere Konten mit dem heutigen Kontostand erfassen.',
        done:accountsDone,
        action:'<a class="action-button action-button--primary" href="#/accounts?create=account">Erstes Konto</a>'
      })}
      ${step({
        number:3,
        title:'Kategorien, Unterkategorien & Händler',
        text:structureDone
          ? `${parents.length} Hauptkategorien · ${children.length} Unterkategorien · ${merchants.length} Händler`
          : 'Empfohlene Kategorien und bekannte Händler einmal einrichten. Danach kann Finance neue Buchungen automatisch besser zuordnen.',
        done:structureDone,
        action:canWrite
          ? '<button class="action-button action-button--primary" type="button" data-action="starter-categories">Empfohlene Struktur einrichten</button>'
          : '<a class="action-button action-button--secondary" href="#/categories">Ansehen</a>'
      })}
    </div>

    <article class="card card-padding setup-optional">
      <div class="card-heading"><div><h3 class="card-title">Für mehr Automatik</h3><p class="card-subtitle">Diese Angaben sind nicht zwingend, reduzieren später aber manuelle Arbeit.</p></div></div>
      <div class="hub-grid">
        <a class="card hub-link-card" href="#/fixed-costs">
          <span class="hub-link-icon">${icon('receipt')}</span>
          <span class="hub-link-copy"><strong>Fixkosten & Einnahmen</strong><span>Lohn, Miete, Krankenkasse, Abos und andere wiederkehrende Bewegungen</span><small>${recurringRules.filter((r)=>r.active!==false).length} wiederkehrend</small></span>
          <span class="hub-link-chevron">${icon('chevron-right')}</span>
        </a>
        <a class="card hub-link-card" href="#/merchants">
          <span class="hub-link-icon">${icon('basket')}</span>
          <span class="hub-link-copy"><strong>Händler prüfen</strong><span>Coop, Migros, Denner und weitere Händler einer Standardkategorie zuordnen</span></span>
          <span class="hub-link-chevron">${icon('chevron-right')}</span>
        </a>
      </div>
    </article>

    <article class="card card-padding setup-finish">
      <div>
        <h3 class="card-title">${completed?'Einrichtung abgeschlossen.':requiredDone===3?'Finance ist bereit.':'Noch nicht ganz bereit.'}</h3>
        <p class="card-subtitle">${completed
          ? 'Du kannst die Einrichtung jederzeit wieder öffnen und anpassen.'
          : requiredDone===3
            ? 'Ab jetzt geht es im Alltag hauptsächlich um Erfassen, Prüfen und Verstehen.'
            : 'Schliesse die drei Grundschritte ab. Danach wird die normale Übersicht freigeschaltet.'}</p>
      </div>
      ${completed
        ? '<a class="action-button action-button--primary" href="#/overview">Zur Übersicht</a>'
        : `<form id="setup-complete" data-form="setup-complete"><button class="action-button action-button--primary" type="submit" ${requiredDone===3&&canWrite?'':'disabled'}>Einrichtung abschliessen</button></form>`}
    </article>
  `;
}
