import { pageHeader, statusPill } from '../app/components.js';
import { dateLabel, escapeHtml, money } from '../app/format.js';
import { icon } from '../app/icons.js';
import { buildReviewQueue } from '../app/review-queue.js';

function txLine(tx,{accounts=[],categories=[],locale='de-CH'}={}){
  const account=accounts.find((row)=>(row.account_id||row.id)===tx.account_id);
  const category=categories.find((row)=>row.id===tx.category_id);
  return `<div class="review-row-copy"><strong>${escapeHtml(tx.description||tx.counterparty||'Buchung')}</strong><span>${dateLabel(tx.occurred_at,locale)} · ${escapeHtml(account?.name||'Konto')}${category?` · ${escapeHtml(category.name)}`:''}</span><small>${escapeHtml(tx.counterparties?.name||tx.counterparty||tx.note||'')}</small></div>`;
}
function empty(text){ return `<div class="table-empty">${escapeHtml(text)}</div>`; }

export function renderReview({
  transactions=[],accounts=[],categories=[],bills=[],merchants=[],household,profile,
  previousVisitAt=null,changeHistory=[],canWrite=false,
}={}){
  const locale=profile?.locale||'de-CH';
  const currency=household?.base_currency||'CHF';
  const queue=buildReviewQueue({transactions,accounts,categories,bills,merchants,previousVisitAt});
  const lastVisitLabel=previousVisitAt?dateLabel(previousVisitAt,locale):'erster Besuch';

  const expenseRows=queue.uncategorizedExpenses.slice(0,25).map((tx)=>`
    <div class="review-work-row">
      ${txLine(tx,{accounts,categories,locale})}
      <strong class="review-amount">${money(tx.amount,{currency:tx.currency||currency,locale})}</strong>
      ${canWrite?`<button class="table-action" type="button" data-action="review-edit-transaction" data-id="${tx.id}">Zuordnen</button>`:''}
    </div>`).join('');

  const incomeRows=queue.unknownIncoming.slice(0,25).map((tx)=>`
    <div class="review-work-row">
      ${txLine(tx,{accounts,categories,locale})}
      <strong class="review-amount">${money(tx.amount,{currency:tx.currency||currency,locale,sign:true})}</strong>
      ${canWrite?`<button class="table-action" type="button" data-action="review-edit-transaction" data-id="${tx.id}">Klären</button>`:''}
    </div>`).join('');

  const transferRows=queue.possibleTransfers.slice(0,25).map((item)=>`
    <div class="review-work-row review-work-row--transfer">
      <div class="review-row-copy">
        <strong>${escapeHtml(item.fromAccount?.name||'Konto')} → ${escapeHtml(item.toAccount?.name||'Konto')}</strong>
        <span>${dateLabel(item.tx.occurred_at,locale)} · ${money(Math.abs(Number(item.tx.amount)),{currency:item.tx.currency||currency,locale})}</span>
        <small>${escapeHtml(item.tx.description||'')} ↔ ${escapeHtml(item.counterpart.description||'')}</small>
      </div>
      <span>${statusPill('active','Eindeutiger Gegenposten')}</span>
      ${canWrite?`<button class="table-action" type="button" data-action="review-link-transfer" data-id="${item.tx.id}" data-other-id="${item.counterpart.id}">Als Umbuchung verbinden</button>`:''}
    </div>`).join('');

  const ambiguousRows=queue.ambiguousTransfers.slice(0,12).map((item)=>`
    <div class="review-work-row">
      ${txLine(item.tx,{accounts,categories,locale})}
      <span>${statusPill('pending',`${item.candidates.length} mögliche Gegenposten`)}</span>
      ${canWrite?`<button class="table-action" type="button" data-action="review-edit-transaction" data-id="${item.tx.id}">Prüfen</button>`:''}
    </div>`).join('');

  const billRows=queue.dueBills.slice(0,12).map((bill)=>`
    <a class="review-work-row review-work-row--link" href="#/bills">
      <div class="review-row-copy"><strong>${escapeHtml(bill.name)}</strong><span>Fällig ${dateLabel(bill.due_date,locale)}</span><small>${escapeHtml(bill.provider||bill.reference||'')}</small></div>
      <strong class="review-amount">${money(bill.amount,{currency:bill.currency||currency,locale})}</strong>
      <span>${statusPill(bill.status==='overdue'?'warning':'pending',bill.status==='overdue'?'Überfällig':'Bald fällig')}</span>
    </a>`).join('');

  const history=(changeHistory||[]).slice(0,8).map((row)=>`
    <div class="review-history-row"><div><strong>${escapeHtml(row.label||row.type||'Änderung')}</strong><span>${dateLabel(row.at,locale)}</span></div>${!row.undone&&row.undoable&&canWrite?`<button class="table-action" type="button" data-action="review-undo-change" data-change-id="${escapeHtml(row.id)}">Rückgängig</button>`:row.undone?statusPill('neutral','Rückgängig gemacht'):''}</div>`).join('');

  return `
    ${pageHeader({title:'Zu prüfen',subtitle:'Eine Arbeitsliste statt Modulsuche. Was gespeichert oder eindeutig verbunden ist, verschwindet hier.',actions:'<a class="action-button action-button--secondary" href="#/search">'+icon('search')+' Suchen</a>'})}

    <article class="card card--accent review-summary-card">
      <div><span class="hero-label">Seit deinem letzten Besuch · ${escapeHtml(lastVisitLabel)}</span><div class="hero-value">${queue.openCount}</div><span class="hero-caption">offene Entscheidungen · ${queue.sinceLastVisit.length} neue Buchungen erkannt</span></div>
      <div class="review-summary-grid">
        <div><span>Ausgaben ohne Kategorie</span><strong>${queue.uncategorizedExpenses.length}</strong></div>
        <div><span>Ungeklärte Eingänge</span><strong>${queue.unknownIncoming.length}</strong></div>
        <div><span>Mögliche Umbuchungen</span><strong>${queue.possibleTransfers.length+queue.ambiguousTransfers.length}</strong></div>
        <div><span>Rechnungen bald fällig</span><strong>${queue.dueBills.length}</strong></div>
      </div>
    </article>

    ${queue.openCount===0?`<article class="card onboarding-empty review-done-card"><span class="onboarding-empty-icon">${icon('shield')}</span><div><h3>Alles geprüft.</h3><p>Spendy sieht aktuell keine offenen Buchungen, Umbuchungen oder bald fälligen Rechnungen, die deine Entscheidung brauchen.</p></div></article>`:''}

    <div class="review-section-grid">
      <article class="card card-padding"><div class="card-heading"><div><h3 class="card-title">Ausgaben zuordnen</h3><p class="card-subtitle">Speichern = erledigt. Die Buchung verschwindet danach aus dieser Liste.</p></div><span>${statusPill(queue.uncategorizedExpenses.length?'pending':'active',String(queue.uncategorizedExpenses.length))}</span></div><div class="review-work-list">${expenseRows||empty('Keine offenen Ausgaben.')}</div></article>
      <article class="card card-padding"><div class="card-heading"><div><h3 class="card-title">Eingänge klären</h3><p class="card-subtitle">Verdienst, Rückerstattung, Forderungsrückzahlung oder eigene Umbuchung unterscheiden.</p></div><span>${statusPill(queue.unknownIncoming.length?'pending':'active',String(queue.unknownIncoming.length))}</span></div><div class="review-work-list">${incomeRows||empty('Keine ungeklärten Eingänge.')}</div></article>
    </div>

    <article class="card card-padding review-transfer-card"><div class="card-heading"><div><h3 class="card-title">Eigene Umbuchungen erkennen</h3><p class="card-subtitle">Gleicher Betrag, Gegenrichtung, andere eigene Konten und maximal sieben Tage Abstand. Spendy verbindet nur auf deinen Klick.</p></div><span>${statusPill(queue.possibleTransfers.length?'active':'neutral',`${queue.possibleTransfers.length} eindeutig`)}</span></div><div class="review-work-list">${transferRows||empty('Keine eindeutigen Gegenbuchungen gefunden.')}${ambiguousRows}</div></article>

    <div class="review-section-grid">
      <article class="card card-padding"><div class="card-heading"><div><h3 class="card-title">Fälligkeiten</h3><p class="card-subtitle">Offene und überfällige Rechnungen der nächsten 14 Tage.</p></div></div><div class="review-work-list">${billRows||empty('Keine bald fälligen Rechnungen.')}</div></article>
      <article class="card card-padding"><div class="card-heading"><div><h3 class="card-title">Änderungsverlauf</h3><p class="card-subtitle">Sammel-Kategorisierungen können hier rückgängig gemacht werden.</p></div></div><div class="review-history-list">${history||empty('In dieser Sitzung noch keine Änderungen.')}</div></article>
    </div>

    ${queue.merchantDuplicates.length?`<article class="inline-alert"><strong>${queue.merchantDuplicates.length} mögliche Händler-Dubletten.</strong><span>Das ist Stammdatenpflege und blockiert deine Buchungen nicht. <a href="#/merchants">Händler prüfen</a></span></article>`:''}
  `;
}
