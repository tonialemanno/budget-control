import { pageHeader } from '../app/components.js';
import { escapeHtml, money } from '../app/format.js';
import { t } from '../app/i18n.js';

export function yearCloseBlockers(overview){
  if(!overview)return ['Die Datenbank für den Jahresabschluss ist noch nicht verfügbar.'];
  const reasons=[];
  if(Number(overview.hidden_accounts)>0)reasons.push('Private Konten anderer Haushaltsmitglieder erfordern eine gesonderte Abklärung.');
  if(Number(overview.unconfirmed_accounts)>0)reasons.push('Nicht alle Kontoauszüge sind bis 31.12. bestätigt.');
  if(Number(overview.mismatched_accounts)>0)reasons.push('Mindestens ein bestätigter Banksaldo stimmt nicht mehr mit den Buchungen überein.');
  if(Number(overview.pending_transactions)>0)reasons.push('Es gibt noch nicht gebuchte Transaktionen im Abschlussjahr.');
  if(Number(overview.unclassified_transactions)>0)reasons.push('Es gibt noch nicht klassifizierte Buchungen im Abschlussjahr.');
  if(!(overview.accounts||[]).length)reasons.push('Es sind keine abschliessbaren Konten vorhanden.');
  if(!reasons.length&&overview.can_close!==true&&overview.status!=='closed')reasons.push('Die verbindliche Datenbankprüfung hat den Abschluss noch nicht freigegeben.');
  return reasons;
}
export function renderYearClosing({yearCloseOverview=null,yearClosures=[],yearCloseYear,yearCloseError='',household,canAdminHousehold=false,profile}={}){
  const locale=profile?.locale||'de-CH';
  const year=Number(yearCloseYear)||new Date().getFullYear()-1;
  const status=yearCloseOverview?.status||'open';
  const locked=status==='closed';
  const blockers=yearCloseBlockers(yearCloseOverview);
  const taxAvailable=locked;
  const knownYears=new Set([year,new Date().getFullYear()-1,...(yearClosures||[]).map(row=>Number(row.tax_year))]);
  const years=[...knownYears].filter(n=>n>=2000&&n<new Date().getFullYear()).sort((a,b)=>b-a);
  const accounts=yearCloseOverview?.accounts||[];
  const summary=(yearClosures||[]).slice().sort((a,b)=>b.tax_year-a.tax_year).map(row=>
    `<a class="table-action" href="/planning/year-closing?year=${Number(row.tax_year)}">${Number(row.tax_year)} · ${row.status==='closed'?'Abgeschlossen':'In Prüfung'} · Version ${Number(row.revision||0)}</a>`
  ).join(' · ');
  if(!canAdminHousehold)return `${pageHeader({title:t('Jahrescenter',locale),subtitle:t('Jahresabschlüsse sind nur für Haushaltsadministratoren zugänglich.',locale)})}<div class="inline-alert">${escapeHtml(t('Keine Berechtigung für diesen Jahresabschluss.',locale))}</div>`;
  return `
  ${pageHeader({title:'Jahrescenter',subtitle:'Bankauszüge abstimmen, vergangenes Kalenderjahr abschliessen und unveränderlich für die Steuerdokumentation sichern.'})}
  <section class="card card-padding" aria-label="Jahresabschluss wählen">
    <div class="card-heading"><div><h3 class="card-title">Kalenderjahr ${year}</h3><p class="card-subtitle">1. Januar – 31. Dezember · unabhängig vom Finanzmonat (z. B. 25.–24.)</p></div>
    <span class="status-pill status-pill--${locked?'success':'neutral'}">${locked?'Abgeschlossen · Schreibschutz':'Offen · Prüfung'}</span></div>
    <label class="field"><span>Jahr auswählen</span><select id="yearCloseYear" class="text-control" data-year-close-select>${years.map(n=>`<option value="${n}" ${n===year?'selected':''}>${n}</option>`).join('')}</select></label>
    <div class="inline-alert"><strong>Kein finanzieller Reset.</strong><span>Kontoguthaben, Schulden und Sparziele laufen unverändert weiter. Nur die Jahresauswertung beginnt am 1. Januar wieder bei null.</span></div>
    ${summary?`<p class="table-meta">Jahreshistorie: ${summary}</p>`:''}
    ${Number(yearCloseOverview?.revision||0)>0?`<button type="button" class="table-action" data-action="year-close-export" data-year="${year}">Archivierte Abschlussversion (JSON) exportieren</button>`:''}
  </section>
  ${yearCloseError?`<div class="inline-alert"><strong>Datenbankfehler:</strong> ${escapeHtml(yearCloseError)}</div>`:''}
  ${!yearCloseOverview?'<div class="inline-alert">Abschlussdaten werden geladen bzw. sind noch nicht migriert. Kein Abschluss möglich.</div>':''}
  <section class="card card-padding" style="margin-top:16px">
    <div class="card-heading"><div><h3 class="card-title">Bankkonten abstimmen</h3><p class="card-subtitle">Jedes Konto benötigt einen bestätigten Schlussstand per 31.12.${year}. Auch Konten ohne Jahresend-Buchung werden bestätigt.</p></div></div>
    ${accounts.length?`<div class="stack">${accounts.map(account=>{
      const balance=account.calculated_balance===null?null:Number(account.calculated_balance);
      const confirmed=Boolean(account.matches);
      return `<div class="card card-padding" style="margin-top:8px">
        <strong>${escapeHtml(account.name)}</strong> · ${escapeHtml(account.currency||'')}
        ${account.archived?'<span class="status-pill">Archiviertes Konto</span>':''}
        <p>Berechneter Schlussstand: <strong>${balance===null?'Nicht rekonstruierbar':money(balance,{currency:account.currency||household?.base_currency||'CHF',locale})}</strong></p>
        <p class="table-meta">${confirmed?'Abgeglichen · 31.12. bestätigt':'Noch nicht bestätigt oder nach Import verändert'}</p>
        ${!locked && balance!==null?`<form data-form="year-close-account" class="form-grid">
          <input type="hidden" name="accountId" value="${escapeHtml(account.id)}"/>
          <input type="hidden" name="year" value="${year}"/>
          <label class="field"><span>Bank-Schlusssaldo am 31.12.${year} (${escapeHtml(account.currency)})</span><input class="text-control" name="statementBalance" type="number" step="0.01" required value="${account.statement_balance??''}" placeholder="Saldo laut Kontoauszug"/></label>
          <label class="field"><span>Erklärung</span><span class="table-meta">Ich habe den vollständigen Bankauszug bis einschliesslich 31.12.${year} geprüft.</span></label>
          <label class="field"><input type="checkbox" name="confirmed" required/> Kontoauszug und Schlusssaldo sind abgeglichen.</label>
          <div class="form-actions"><button class="action-button action-button--secondary" type="submit">${confirmed?'Erneut bestätigen':'Konto bestätigen'}</button></div>
        </form>`:''}
      </div>`;
    }).join('')}</div>`:'<p>Keine zu prüfenden Konten verfügbar.</p>'}
  </section>
  <section class="card card-padding" style="margin-top:16px">
    <div class="card-heading"><div><h3 class="card-title">Abschlussprüfung</h3><p class="card-subtitle">Sperren gelten auch für manuelle Buchungen, Import und API. Spätere Korrekturen benötigen eine Wiedereröffnung.</p></div></div>
    ${locked?`<div class="inline-alert inline-alert--success"><strong>Abschluss gesichert – Version ${Number(yearCloseOverview?.revision||0)}</strong><span>Historische Buchungen und Kontoanker sind gegen Änderungen gesperrt. Der archivierte Datenstand bleibt auch nach einer Wiedereröffnung erhalten.</span></div>
      <p><a class="table-action" href="/planning/taxes">Steuerdossier für ${year} öffnen →</a></p>
      <form data-form="year-close-reopen" class="form-grid">
       <input type="hidden" name="year" value="${year}"/>
       <label class="field"><span>Begründung für eine Wiedereröffnung</span><textarea class="text-control" name="reason" required minlength="12" rows="2" placeholder="Welche Buchung muss korrigiert werden?"></textarea></label>
       <div class="form-actions"><button type="submit" class="action-button action-button--secondary">Jahr kontrolliert wiedereröffnen</button></div>
      </form>`:`
      ${blockers.length?`<div class="inline-alert"><strong>Abschluss noch nicht möglich:</strong><ul>${blockers.map(note=>`<li>${escapeHtml(note)}</li>`).join('')}</ul></div>`:
        '<div class="inline-alert inline-alert--success">Alle verbindlichen Prüfungen sind erfüllt. Du kannst das Jahr abschliessen.</div>'}
      <form data-form="year-close-finalize">
        <input type="hidden" name="year" value="${year}"/>
        <label class="field"><input type="checkbox" name="accept" required ${blockers.length?'disabled':''}/> Ich bestätige, dass alle Kontoauszüge bis 31.12. vollständig sind und das Jahr endgültig gesperrt werden soll.</label>
        <div class="form-actions"><button type="submit" class="action-button action-button--primary" ${blockers.length?'disabled':''}>Jahr ${year} verbindlich abschliessen</button></div>
      </form>`}
    <p class="table-meta">Steuerfreigabe: ${taxAvailable?'Archivierter Buchungsstand verfügbar':'Erst nach erfolgreichem Abschluss'}. Steuerliche Prüfung und Steuererklärung erfolgen separat.</p>
  </section>`;
}
