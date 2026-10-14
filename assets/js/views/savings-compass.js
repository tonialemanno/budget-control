import { escapeHtml, money, dateLabel } from '../app/format.js';
import { icon } from '../app/icons.js';

export function renderSavingsCompass({plan,locale='de-CH',privacyEnabled=false}={}) {
  if(!plan) return '';
  const m=value=>privacyEnabled?'•••':money(value,{currency:plan.currency,locale});
  const end=plan.cycle?.endExclusive
    ?new Date(new Date(plan.cycle.endExclusive).getTime()-86400000):null;
  const endText=end&&!Number.isNaN(end.getTime())?dateLabel(end,locale):'–';
  const help={
    account:['Erst ein Konto mit aktuellem Kontostand einrichten.','/finance/accounts'],
    fx:['Für eine Währung fehlt ein Wechselkurs. Deshalb wird kein vermeintlich verfügbares Geld angezeigt.','/finance/accounts'],
    fixed:['Wiederkehrende Ausgaben oder offene Rechnungen fehlen noch. Zuerst die Verpflichtungen erfassen.','/planning/fixed-costs'],
    income:['Eine Einnahme oder ein regelmässiger Zahlungseingang ist noch nicht erfasst.','/planning/fixed-costs'],
    budget:['Ein variables Budget fehlt. Lege einen einfachen Rahmen für Einkauf, Freizeit oder Mobilität fest.','/planning/budget'],
  };
  const tip=row=>{
    if(row.type==='budget_risk')return {
      title:'Budget im Blick behalten',
      text:'Die Ausgaben für '+escapeHtml(row.label||'eine Kategorie')+' steigen schneller als die verfügbare Zeit im Finanzmonat.'
    };
    if(row.type==='spending_spike')return {
      title:'Ungewöhnliche Ausgaben prüfen',
      text:'Bei '+escapeHtml(row.label||'einer Kategorie')+' liegen die letzten Ausgaben über dem bisherigen Wochenwert. Ein Vergleich kann helfen.'
    };
    if(row.type==='subscriptions')return {
      title:'Abos überprüfen',
      text:row.count+' aktive Abos kosten zusammen '+m(row.amount)+' pro Monat. Prüfe, welche davon tatsächlich genutzt werden.'
    };
    if(row.type==='vehicle')return {
      title:'Autokosten sichtbar machen',
      text:'Tank-, Park- und Werkstattbuchungen einem Fahrzeug zuordnen. So wird erkennbar, was Mobilität tatsächlich kostet.'
    };
    if(row.type==='unbudgeted')return {
      title:'Ungeplante Ausgaben beachten',
      text:'Einige variable Ausgaben liegen ausserhalb der Budgetrahmen. Diese zuerst prüfen, bevor zusätzliches Geld zurückgelegt wird.'
    };
    return {title:'Mit einem Wochenrahmen einkaufen',
      text:'Einkaufsliste und verfügbare Wochensumme vor dem Kauf prüfen. Nicht ausgegebenes Budget ist nur dann Sparpotenzial, wenn keine weiteren Verpflichtungen fehlen.'};
  };
  const tips=plan.tips.map(row=>{
    const copy=tip(row);
    return '<a class="coach-insight" href="'+escapeHtml(row.href)+'"><span class="coach-insight-icon">'+icon('lightbulb')+'</span>'
      +'<div><strong>'+copy.title+'</strong><p>'+copy.text+'</p><small>Details öffnen</small></div></a>';
  }).join('');

  if(!plan.ready){
    const [hint,href]=help[plan.reason]||help.budget;
    return '<section class="card card-padding" aria-label="Sparhilfe">'
      +'<div class="card-heading"><div><h3 class="card-title">Mein Sparplan</h3>'
      +'<p class="card-subtitle">Wie viel kann ich noch ausgeben und am Ende zurücklegen?</p></div></div>'
      +'<div class="inline-alert"><strong>Noch nicht verlässlich berechenbar</strong><span>'+hint+'</span></div>'
      +'<p class="card-subtitle">Der Sparplan verwendet nur erfasste Geldbeträge, offene Verpflichtungen und Budgets. Ohne diese Angaben werden keine Sparbeträge erfunden.</p>'
      +'<div class="card-footer-actions"><a class="action-button action-button--primary" href="'+href+'">Fehlende Angaben ergänzen</a>'
      +'<a class="action-button action-button--secondary" href="/planning/budget">Budget ansehen</a></div>'
      +(tips?'<div class="coach-insight-grid" style="margin-top:14px">'+tips+'</div>':'')+'</section>';
  }

  const shortage=plan.uncommitted<=0;
  return '<section class="card card-padding" aria-label="Sparhilfe">'
    +'<div class="card-heading"><div><h3 class="card-title">Mein Sparplan</h3>'
    +'<p class="card-subtitle">Finanzmonat bis '+endText+' · Ein Vorschlag, kein garantiertes Guthaben.</p></div>'
    +'<a class="card-link" href="/planning/budget">Budget anpassen</a></div>'
    +(shortage
      ? '<div class="inline-alert"><strong>Aktuell kein frei verfügbares Budget</strong>'
        +'<span>Die vorgemerkten Zahlungen decken den Kontostand bereits ab oder übersteigen ihn. Erst Fälligkeiten und Kontostand prüfen.</span></div>'
      : '<div class="coach-mini-grid" style="margin-top:12px">'
        +'<div class="card coach-mini-card"><span class="coach-mini-label">Noch flexibel ausgeben</span>'
        +'<strong>'+m(plan.spendable)+'</strong><small>Für '+plan.daysRemaining+' Tage · höchstens '+m(plan.daily)+' pro Tag</small></div>'
        +'<div class="card coach-mini-card"><span class="coach-mini-label">Sparmodus: 20 % weniger ausgeben</span>'
        +'<strong>'+m(plan.recommendedSpend)+'</strong><small>Vorgeschlagener Rest-Ausgabenrahmen</small></div>'
        +'<div class="card coach-mini-card"><span class="coach-mini-label">Dadurch zusätzlich möglich</span>'
        +'<strong>'+m(plan.extraByReducing)+'</strong><small>Verglichen mit dem vollen Rest-Ausgabenrahmen</small></div>'
        +'<div class="card coach-mini-card"><span class="coach-mini-label">Möglicherweise frei am Monatsende</span>'
        +'<strong>'+m(plan.remainingAfterPlan)+'</strong><small>Auf dem Hauptkonto, nach angenommener Reserve</small></div>'
        +'</div>')
    +'<details class="receipt-ocr-details" style="margin-top:14px"><summary>So wird gerechnet</summary>'
    +'<div class="mini-detail-list" style="margin-top:8px">'
    +'<span>Kontostand Hauptkonto <strong>'+m(plan.balance)+'</strong></span>'
    +'<span>Offene feste Zahlungen, Rücklagen und Einzelzahlungen <strong>'+m(plan.commitments)+'</strong></span>'
    +'<span>Sicherheitspuffer (10 % des danach freien Betrags) <strong>'+m(plan.cushion)+'</strong></span>'
    +'<span>Offenes variables Budget <strong>'+m(plan.budgetRemaining)+'</strong></span>'
    +'<span>Vorgeschlagene weitere variable Ausgaben (80 %) <strong>'+m(plan.recommendedSpend)+'</strong></span>'
    +'</div><p class="card-subtitle">Zukünftige Einnahmen werden nicht vorweg eingerechnet. Zusätzliche ungeplante Kosten reduzieren das Ergebnis. Der geschätzte Restbetrag ist nicht gleich dem in diesem Monat neu angesparten Geld.</p></details>'
    +(plan.overdue?'<div class="inline-alert"><strong>Offene überfällige Rechnung vorhanden</strong><span>Fälligkeit zuerst prüfen, bevor Geld zur Seite gelegt wird.</span></div>':'')
    +'<div class="card-footer-actions" style="margin-top:12px"><a class="action-button action-button--primary" href="/planning/budget">Ausgabenrahmen bearbeiten</a>'
    +'<a class="action-button action-button--secondary" href="/planning/goals">Sparziel anlegen / ansehen</a></div>'
    +'<h4 class="card-title" style="margin-top:16px">Spartipps aus den eigenen Daten</h4>'
    +'<div class="coach-insight-grid" style="margin-top:8px">'+tips+'</div>'
    +'</section>';
}
