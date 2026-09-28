import { formShell, goalProgress, pageHeader, statusPill, deleteButton } from '../app/components.js';
import { dateLabel, escapeHtml, money } from '../app/format.js';
import { icon } from '../app/icons.js';

export function renderGoals({ goals = [], household, profile } = {}) {
  const currency = household?.base_currency || 'CHF';
  const locale = profile?.locale || 'de-CH';
  const fields = `
    <label class="field"><span>Name</span><input class="text-control" name="name" required placeholder="z. B. Notgroschen"></label>
    <label class="field"><span>Art</span><select class="text-control" name="goalType"><option value="emergency">Notgroschen</option><option value="tax">Steuern</option><option value="holiday">Ferien</option><option value="vehicle">Auto</option><option value="home">Wohnen</option><option value="wedding">Hochzeit</option><option value="custom">Individuell</option></select></label>
    <label class="field"><span>Zielbetrag</span><input class="text-control" name="targetAmount" type="number" min="0.01" step="0.01" required></label>
    <label class="field"><span>Bereits vorhanden</span><input class="text-control" name="currentAmount" type="number" min="0" step="0.01" value="0"></label>
    <label class="field"><span>Monatlicher Sparbetrag</span><input class="text-control" name="monthlyAmount" type="number" min="0" step="0.01" value="0"></label>
    <label class="field"><span>Zieltermin</span><input class="text-control" name="targetDate" type="date"></label>`;

  return `
    ${pageHeader({title:'Sparziele',subtitle:'Notgroschen, Ferien, Steuern und individuelle Ziele. Fortschritt und monatlicher Sparbetrag bleiben getrennte Werte.',actions:`<button class="action-button action-button--primary" type="button" data-action="show-form" data-target="goal-create">${icon('plus')} Sparziel</button>`})}
    ${formShell('goal-create','Neues Sparziel','Ziel und vorhandenen Betrag festlegen',fields,{hidden:true,submitLabel:'Sparziel speichern'})}
    ${goals.length ? `<div class="grid-3">${goals.map((g)=>`<article class="card card-padding"><div class="card-heading"><div><h3 class="card-title">${escapeHtml(g.name)}</h3><p class="card-subtitle">${g.target_date?`Ziel ${dateLabel(g.target_date,locale)}`:'Ohne Zieltermin'}</p></div>${statusPill(g.status)}</div>${goalProgress(g,locale)}<div class="mini-detail-list"><span>Monatlich <strong>${money(g.monthly_amount,{currency:g.currency||currency,locale})}</strong></span></div><div class="card-footer-actions"><button class="table-action" type="button" data-action="goal-progress" data-id="${g.id}" data-current="${g.current_amount}">Stand ändern</button>${deleteButton('savings_goals',g.id)}</div></article>`).join('')}</div>` : `<div class="card empty-state"><span class="empty-state-icon">${icon('target')}</span><h3>Noch kein Sparziel</h3><p>Lege dein erstes Ziel an, zum Beispiel Notgroschen oder Steuern.</p></div>`}
  `;
}
