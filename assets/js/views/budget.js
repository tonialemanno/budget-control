import { demoData } from '../app/demo-data.js';
import { money } from '../app/format.js';
import { budgetItem, demoBanner, pageHeader } from '../app/components.js';

export function renderBudget() {
  const variableBudget = demoData.budgets.reduce((sum, item) => sum + item.limit, 0);
  const variableSpent = demoData.budgets.reduce((sum, item) => sum + item.spent, 0);
  return `
    ${pageHeader({ title: 'Budget', subtitle: 'Soll und Ist ohne Buchhaltungsbegriffe. Der Fokus liegt darauf, was noch frei verfügbar ist.' })}
    ${demoBanner()}
    <div class="grid-hero">
      <article class="card hero-card"><div><div class="hero-label">Variabel noch verfügbar</div><div class="hero-value">${money(variableBudget - variableSpent, { decimals: 0 })}</div><div class="hero-caption">von ${money(variableBudget, { decimals: 0 })} Monatsbudget</div></div><div class="chip-row"><span class="chip chip--active">September</span><span class="chip">Oktober</span><span class="chip">Jahresplanung</span></div></article>
      <article class="card card-padding"><div class="card-heading"><div><h3 class="card-title">Planung</h3><p class="card-subtitle">Bekannte Bestandteile</p></div></div>${demoData.budgets.map(budgetItem).join('')}</article>
    </div>`;
}
