import { MODULES } from '../app/config.js';
import { icon } from '../app/icons.js';
import { pageHeader } from '../app/components.js';

export function renderSettings({ theme = 'auto', depth = 'standard' } = {}) {
  const enabledModules = Object.entries(MODULES).filter(([, module]) => module.enabled);
  return `
    ${pageHeader({ title: 'Einstellungen', subtitle: 'Darstellung und Informationstiefe sind getrennt von den Finanzdaten. Änderungen hier beeinflussen nur die Oberfläche.' })}
    <div class="grid-main-aside">
      <div class="stack">
        <article class="card">
          <div class="settings-group">
            <div class="settings-row"><div class="settings-row-copy"><strong>Darstellung</strong><span>Hell, Dunkel oder System</span></div><select class="select-control" id="themeSelect"><option value="auto" ${theme === 'auto' ? 'selected' : ''}>System</option><option value="light" ${theme === 'light' ? 'selected' : ''}>Hell</option><option value="dark" ${theme === 'dark' ? 'selected' : ''}>Dunkel</option></select></div>
            <div class="settings-row"><div class="settings-row-copy"><strong>Informationstiefe</strong><span>Einfach, Standard oder Experte</span></div><select class="select-control" id="depthSelect"><option value="simple" ${depth === 'simple' ? 'selected' : ''}>Einfach</option><option value="standard" ${depth === 'standard' ? 'selected' : ''}>Standard</option><option value="expert" ${depth === 'expert' ? 'selected' : ''}>Experte</option></select></div>
          </div>
        </article>
        <article class="card card-padding"><div class="card-heading"><div><h3 class="card-title">Designsystem</h3><p class="card-subtitle">V1 Grundregeln</p></div><span class="list-row-leading">${icon('layout-grid')}</span></div><div class="chip-row"><span class="chip chip--active">Systemfont</span><span class="chip">24 px Cards</span><span class="chip">Glass Navigation</span><span class="chip">Semantische Farben</span><span class="chip">Responsive</span></div></article>
      </div>
      <article class="card card-padding"><div class="card-heading"><div><h3 class="card-title">Aktive Module</h3><p class="card-subtitle">Navigation wird daraus erzeugt</p></div></div><div class="module-grid">${enabledModules.map(([key, module]) => `<div class="module-card card"><div class="module-label"><span class="module-icon">${icon(key === 'core' ? 'shield' : 'sparkles')}</span><strong>${module.label}</strong></div><p>${module.locked ? 'Verpflichtender Finance Core' : 'Für diese V1 aktiviert'}</p></div>`).join('')}</div></article>
    </div>`;
}
