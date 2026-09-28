import { dataTable, pageHeader, deleteButton } from '../app/components.js';
import { dateLabel, escapeHtml } from '../app/format.js';
import { icon } from '../app/icons.js';

export function renderDocuments({ documents = [] } = {}) {
  const rows = documents.map((d)=>`<tr><td><strong>${escapeHtml(d.name)}</strong><div class="table-meta">${escapeHtml(d.mime_type||'Datei')}</div></td><td>${dateLabel(d.document_date||d.created_at)}</td><td>${escapeHtml(d.notes||'')}</td><td><div class="table-actions">${d.storage_path?`<button class="table-action" type="button" data-action="document-download" data-id="${d.id}" data-path="${escapeHtml(d.storage_path)}" data-name="${escapeHtml(d.name)}">Öffnen</button>`:''}${deleteButton('documents',d.id)}</div></td></tr>`);
  return `
    ${pageHeader({title:'Dokumente',subtitle:'Grundlegende Dokumentverwaltung im Finance Core. Dateien werden privat im Supabase-Storage des Haushalts gespeichert.'})}
    <form class="card card-padding form-card" id="document-create" data-form="document-create">
      <div class="card-heading"><div><h3 class="card-title">Dokument hochladen</h3><p class="card-subtitle">Maximal 10 MB pro Datei</p></div><span class="list-row-leading">${icon('receipt')}</span></div>
      <div class="form-grid form-grid--2">
        <label class="field form-grid-span"><span>Datei</span><input class="text-control" name="file" type="file" required></label>
        <label class="field"><span>Dokumentdatum</span><input class="text-control" name="documentDate" type="date"></label>
        <label class="field"><span>Bezug</span><select class="text-control" name="objectType"><option value="general">Allgemein</option><option value="bill">Rechnung</option><option value="contract">Vertrag</option><option value="debt">Kredit / Schuld</option><option value="insurance">Versicherung</option><option value="property">Immobilie</option><option value="vehicle">Fahrzeug</option><option value="investment">Investment</option><option value="pension">Vorsorge</option><option value="legal">Mahn-/Betreibungsfall</option></select></label>
        <label class="field form-grid-span"><span>Notiz</span><textarea class="text-control" name="notes" rows="3"></textarea></label>
      </div>
      <div class="form-actions"><button class="action-button action-button--primary" type="submit">Dokument speichern</button></div>
    </form>
    <article class="card card-padding"><div class="card-heading"><div><h3 class="card-title">Dokumentenablage</h3><p class="card-subtitle">Nur Mitglieder des Haushalts mit Berechtigung können zugreifen</p></div></div>${dataTable({headers:['Dokument','Datum','Notiz',''],rows,emptyText:'Noch keine Dokumente hochgeladen.'})}</article>`;
}
