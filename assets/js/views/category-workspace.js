import { escapeHtml } from '../app/format.js';

const TABS=[
  ['main','Hauptkategorien','/selfservice/categories?view=main'],
  ['children','Unterkategorien','/selfservice/categories?view=children'],
  ['rules','Regeln','/selfservice/categories?view=rules'],
  ['merchants','Händler','/selfservice/merchants'],
  ['structure','Empfohlene Struktur','/selfservice/categories?view=structure'],
];

export function renderCategoryWorkspaceNav(active='main'){
  return '<nav class="category-workspace-nav" aria-label="Kategorien & Regeln">'
    +TABS.map(([key,label,href])=>'<a class="category-workspace-tab" href="'+href+'"'
      +(key===active?' aria-current="page"':'')+'>'+escapeHtml(label)+'</a>').join('')
    +'</nav>';
}

export const categoryWorkspaceViews=Object.freeze(['main','children','rules','merchants','structure','settings']);
