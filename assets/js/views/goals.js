import { demoData } from '../app/demo-data.js';
import { demoBanner, goalCard, pageHeader } from '../app/components.js';

export function renderGoals() {
  return `
    ${pageHeader({ title: 'Sparziele', subtitle: 'Ziele bleiben bewusst einfach: Zielbetrag, vorhandener Betrag, Fortschritt und Termin.' })}
    ${demoBanner()}
    <div class="grid-3">${demoData.goals.map(goalCard).join('')}</div>`;
}
