import { parseCsv } from './csv-import.js';
import { parseBankPdf } from './pdf-import.js';

export async function parseImportFile(file) {
  if (!file) throw new Error('Keine Importdatei ausgewählt.');
  const name = String(file.name || '').toLowerCase();
  const type = String(file.type || '').toLowerCase();
  if (type === 'application/pdf' || name.endsWith('.pdf')) return parseBankPdf(file);
  if (type.includes('csv') || name.endsWith('.csv') || type === 'text/plain') {
    const parsed = parseCsv(await file.text());
    return { ...parsed, format:'csv', meta:{ rows:parsed.rows.length } };
  }
  throw new Error('Unterstützt werden CSV- und PDF-Dateien.');
}
