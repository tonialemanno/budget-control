import { dataTable, pageHeader } from '../app/components.js';
import { dateLabel, escapeHtml } from '../app/format.js';
import { icon } from '../app/icons.js';

export function renderImports({ accounts = [], importBatches = [] } = {}) {
  const accountOptions = accounts.map((a)=>`<option value="${a.account_id}">${escapeHtml(a.name)}</option>`).join('');
  const rows = importBatches.map((b)=>`<tr><td>${escapeHtml(b.file_name)}</td><td>${dateLabel(b.created_at)}</td><td>${b.imported_count}</td><td>${b.skipped_count}</td></tr>`);
  return `
    ${pageHeader({title:'Datenimport',subtitle:'CSV-Dateien werden zuerst gelesen und gemappt. Doppelte Zeilen werden über einen stabilen Fingerprint übersprungen.'})}
    <div class="grid-main-aside">
      <form class="card card-padding" id="csv-import" data-form="csv-import">
        <div class="card-heading"><div><h3 class="card-title">CSV importieren</h3><p class="card-subtitle">Bankexport oder eigene CSV-Datei</p></div><span class="list-row-leading">${icon('arrow-down-left')}</span></div>
        ${accounts.length ? '' : `<div class="inline-alert"><strong>Kein Konto vorhanden.</strong><span>Lege zuerst ein Konto an.</span></div>`}
        <div class="form-grid">
          <label class="field"><span>Zielkonto</span><select class="text-control" name="accountId" required ${accounts.length?'':'disabled'}>${accountOptions}</select></label>
          <label class="field"><span>CSV-Datei</span><input class="text-control" id="csvFile" name="file" type="file" accept=".csv,text/csv" required ${accounts.length?'':'disabled'}></label>
        </div>
        <div id="csvMapping" hidden style="margin-top:18px">
          <div class="card-heading"><div><h3 class="card-title">Spalten zuordnen</h3><p class="card-subtitle" id="csvPreviewMeta"></p></div></div>
          <div class="form-grid form-grid--2">
            <label class="field"><span>Datum</span><select class="text-control" name="mapDate" id="mapDate"></select></label>
            <label class="field"><span>Beschreibung</span><select class="text-control" name="mapDescription" id="mapDescription"></select></label>
            <label class="field"><span>Gegenpartei</span><select class="text-control" name="mapCounterparty" id="mapCounterparty"></select></label>
            <label class="field"><span>Betrag (eine Spalte)</span><select class="text-control" name="mapAmount" id="mapAmount"></select></label>
            <label class="field"><span>Belastung</span><select class="text-control" name="mapDebit" id="mapDebit"></select></label>
            <label class="field"><span>Gutschrift</span><select class="text-control" name="mapCredit" id="mapCredit"></select></label>
          </div>
          <div class="form-actions"><button class="action-button action-button--primary" type="submit">Import starten</button></div>
        </div>
      </form>
      <article class="card card-padding"><div class="card-heading"><div><h3 class="card-title">Importregeln</h3><p class="card-subtitle">Was V2 bereits macht</p></div></div><div class="stack compact-copy"><p>• Dubletten werden anhand Konto, Datum, Betrag und Text erkannt.</p><p>• Bestehende Kategorisierungsregeln werden beim Import angewendet.</p><p>• Dein heutiger Kontostand bleibt der Anker und wird durch ältere CSV-Zeilen nicht verändert.</p><p>• Die Originaldatei wird nicht automatisch gespeichert.</p></div></article>
    </div>
    <article class="card card-padding" style="margin-top:16px"><div class="card-heading"><div><h3 class="card-title">Importverlauf</h3><p class="card-subtitle">Letzte CSV-Läufe</p></div></div>${dataTable({headers:['Datei','Datum','Importiert','Übersprungen'],rows,emptyText:'Noch keine CSV-Dateien importiert.'})}</article>`;
}
