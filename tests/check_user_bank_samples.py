from pathlib import Path
import csv,sys
csv_path=Path('/mnt/data/transactions.csv')
pdf_path=Path('/mnt/data/transactions.pdf')
if not csv_path.exists() or not pdf_path.exists():
    print('SKIP: user bank samples not mounted');sys.exit(0)
raw=csv_path.read_text(encoding='utf-8-sig',errors='replace').splitlines()
header_idx=next((i for i,l in enumerate(raw) if 'Abschlussdatum' in l and 'Belastung' in l and 'Gutschrift' in l),None)
assert header_idx is not None
rows=list(csv.DictReader(raw[header_idx:],delimiter=';'))
rows=[r for r in rows if any(str(v or '').strip() for v in r.values())]
assert len(rows)>=60, len(rows)
assert all(k in rows[0] for k in ['Buchungsdatum','Währung','Belastung','Gutschrift','Beschreibung1'])
# PDF is expected to be text-based; pdftotext test is handled in shell report.
assert pdf_path.stat().st_size>1000
print('PASS: UBS sample CSV detected; rows:',len(rows),'PDF bytes:',pdf_path.stat().st_size)
