import { pageHeader, statusPill } from '../app/components.js';
import { dateLabel, escapeHtml, money } from '../app/format.js';
import { icon } from '../app/icons.js';

export function renderProjects({transactionContexts=[],transactions=[],household,profile,canWrite=false}={}){
  const locale=profile?.locale||'de-CH';
  const currency=household?.base_currency||'CHF';
  const rows=transactionContexts.slice().sort((a,b)=>Number(a.is_archived)-Number(b.is_archived)||String(b.starts_on||'').localeCompare(String(a.starts_on||'')));
  const cards=rows.map((context)=>{
    const txs=transactions.filter((tx)=>tx.context_id===context.id);
    const expenses=txs.filter((tx)=>Number(tx.amount)<0&&!tx.transfer_group_id).reduce((sum,tx)=>sum+Math.abs(Number(tx.amount)||0),0);
    const income=txs.filter((tx)=>Number(tx.amount)>0&&!tx.transfer_group_id).reduce((sum,tx)=>sum+Number(tx.amount)||0,0);
    const range=[context.starts_on?dateLabel(context.starts_on,locale):'',context.ends_on?dateLabel(context.ends_on,locale):''].filter(Boolean).join(' – ');
    return `<article class="card project-card ${context.is_archived?'project-card--archived':''}">
      <div class="project-card-head"><div><strong>${escapeHtml(context.name)}</strong><span>${escapeHtml(context.context_type||'Projekt')}${range?` · ${escapeHtml(range)}`:''}</span></div>${statusPill(context.is_archived?'neutral':'active',context.is_archived?'Archiviert':'Aktiv')}</div>
      <div class="project-card-metrics"><span>Buchungen <strong>${txs.length}</strong></span><span>Ausgaben <strong>${money(expenses,{currency,locale})}</strong></span><span>Eingänge <strong>${money(income,{currency,locale})}</strong></span></div>
      <div class="project-card-actions"><a class="table-action" href="#/transactions?context=${context.id}">Buchungen ansehen</a>${canWrite?`<button class="table-action" type="button" data-action="project-toggle-archive" data-id="${context.id}">${context.is_archived?'Reaktivieren':'Archivieren'}</button>`:''}</div>
    </article>`;
  }).join('');

  const form=canWrite?`<form class="card card-padding form-card" id="project-create" data-form="project-create" hidden>
    <div class="card-heading"><div><h3 class="card-title">Neuer Anlass / Projekt</h3><p class="card-subtitle">Für zeitlich begrenzte Themen wie Scheidung, Italien 2026, Umzug oder Renovation.</p></div></div>
    <div class="form-grid form-grid--2">
      <label class="field"><span>Name</span><input class="text-control" name="name" required placeholder="z. B. Scheidung"></label>
      <label class="field"><span>Art</span><select class="text-control" name="contextType"><option value="project">Projekt / Anlass</option><option value="trip">Reise / Ferien</option><option value="legal">Recht / Verfahren</option><option value="life_event">Lebensereignis</option><option value="other">Sonstiges</option></select></label>
      <label class="field"><span>Beginn</span><input class="text-control" name="startsOn" type="date"></label>
      <label class="field"><span>Ende</span><input class="text-control" name="endsOn" type="date"></label>
    </div>
    <div class="form-actions"><button class="action-button action-button--primary" type="submit">Projekt speichern</button></div>
  </form>`:'';

  return `
    ${pageHeader({title:'Anlässe & Projekte',subtitle:'Kategorien sagen wofür Geld war. Projekte sagen warum es zusammengehört – z. B. Scheidung, Italien 2026 oder Scooter.',actions:canWrite?`<button class="action-button action-button--primary" type="button" data-action="show-form" data-target="project-create">${icon('plus')} Projekt</button>`:''})}
    <div class="inline-alert inline-alert--success"><strong>Kategorie und Projekt sind zwei verschiedene Dinge.</strong><span>Beispiel: „Rechts- & Gerichtskosten“ bleibt die dauerhafte Kategorie; „Scheidung“ ist der zeitlich begrenzte Anlass.</span></div>
    ${form}
    <div class="project-grid">${cards||'<article class="card onboarding-empty"><div><h3>Noch keine Projekte.</h3><p>Lege nur Themen an, die du später als Ganzes wiederfinden möchtest.</p></div></article>'}</div>
  `;
}
