import { dataTable, pageHeader, statusPill } from '../app/components.js';
import { dateLabel, escapeHtml } from '../app/format.js';

export function renderImportHistory({ importBatches = [], profile } = {}) {
  const locale = profile?.locale || 'de-CH';
  const rows = importBatches.map((b)=>`<tr><td><strong>${escapeHtml(b.file_name)}</strong><div class="table-meta">${escapeHtml(b.accounts?.name||'')}</div></td><td>${dateLabel(b.created_at,locale)}</td><td>${b.row_count}</td><td>${b.imported_count}</td><td>${b.skipped_count}</td><td>${statusPill(b.status==='completed'?'active':b.status==='failed'?'warning':'pending',b.status==='completed'?'Fertig':b.status==='failed'?'Fehler':'Läuft')}</td></tr>`);
  return `
    ${pageHeader({title:'Import-Historie',subtitle:'Alle gespeicherten Importläufe des Haushalts. Die kompakte Datenimport-Seite zeigt nur die letzten 10.',actions:'<a class="action-button action-button--secondary" href="#/imports">Zurück zum Import</a>'})}
    <article class="card card-padding">${dataTable({headers:['Datei','Datum','Zeilen','Importiert','Übersprungen','Status'],rows,emptyText:'Noch keine CSV-Importe.'})}</article>`;
}
