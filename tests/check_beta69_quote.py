from pathlib import Path
import sys
ROOT=Path(__file__).resolve().parents[1]
html=(ROOT/'index.html').read_text(encoding='utf-8')
app=(ROOT/'src/js/app.js').read_text(encoding='utf-8')
mig=(ROOT/'supabase/migrations/20260927_aione_v690_invoice_offer_kind.sql').read_text(encoding='utf-8')
checks={
 'quote button':'id="newQuoteBtn"' in html,
 'kind field':'id="invoiceDocumentKind"' in html,
 'quote counter':'id="quoteOpenCount"' in html,
 'quote statuses':all(x in html for x in ['value="accepted"','value="rejected"']),
 'app quote kind':"document_kind||'invoice'" in app and "kind==='quote'" in app,
 'quote numbering':"'OFF-'+y+'-'" in app,
 'quote convert':'data-convert-quote' in app and "document_kind:'invoice'" in app,
 'quote no budget':"if(invoiceBody.document_kind==='quote')" in app,
 'migration':"document_kind in ('invoice','quote')" in mig and "'accepted','rejected'" in mig,
}
fail=[k for k,v in checks.items() if not v]
for k,v in checks.items(): print(('PASS' if v else 'FAIL'),k)
if fail: sys.exit(1)
print('PASS: invoice/quote workflow markers')
