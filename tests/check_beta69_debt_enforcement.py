from pathlib import Path
from bs4 import BeautifulSoup
import json,re,sys
ROOT=Path(__file__).resolve().parents[1]
errors=[]
def ok(v,msg):
    if not v: errors.append(msg)
html=(ROOT/'index.html').read_text(encoding='utf-8')
app=(ROOT/'src/js/app.js').read_text(encoding='utf-8')
reg=(ROOT/'src/core/module-registry.js').read_text(encoding='utf-8')
shell=(ROOT/'src/components/desktop-shell.js').read_text(encoding='utf-8')
sw=(ROOT/'sw.js').read_text(encoding='utf-8')
feature=(ROOT/'src/features/debt-enforcement-ch.js').read_text(encoding='utf-8')
ok((ROOT/'VERSION').read_text().strip()=='69.0.0-beta.6','VERSION')
ok("const APP_VERSION='69.0.0-beta.6';" in app,'app version')
ok('id="debtEnforcementView"' in html and 'id="debtEnforcementHost"' in html,'view host')
ok('./src/features/debt-enforcement-ch.js' in html and './src/styles/debt-enforcement.css' in html,'feature assets')
ok("view:'debtEnforcement'" in reg and "country:'CH'" in reg,'CH-only module registry')
ok("debtEnforcement:'obligations'" in shell,'desktop group')
ok('request:(path,options)=>api(path,options)' in app,'modular authenticated API bridge')
for x in ['payroll_garnishment','bank_transaction','monthly_payment_amount','debt_enforcement_cases','debt_enforcement_payments']:
    ok(x in feature,f'feature missing {x}')
ok('aione-v69-0-0-beta-6' in sw and 'debt-enforcement-ch.js' in sw and 'debt-enforcement.css' in sw,'service worker assets')
for f in ['20260927_aione_v690_ch_debt_enforcement.sql','20260927_aione_v690_ch_debt_enforcement_currency.sql']:
    ok((ROOT/'supabase/migrations'/f).exists(),f'migration missing {f}')
for loc in ['de-CH','fr-CH','it-CH','en']:
    d=json.loads((ROOT/f'src/i18n/{loc}.json').read_text(encoding='utf-8'))
    for key in ['nav.debtEnforcement','debt.warning.text','debt.source.payroll_garnishment','debt.projection.warning']:
        ok(key in d,f'{loc} missing {key}')
old=set(json.loads((ROOT/'tests/beta4-dom-ids.json').read_text()))
soup=BeautifulSoup(html,'html.parser'); ids=[x.get('id') for x in soup.find_all(attrs={'id':True})]
ok(len(ids)==len(set(ids)),'duplicate HTML IDs')
ok(old.issubset(set(ids)),'Beta 4 HTML ID removed')
if errors:
    print('FAIL')
    for e in errors: print(' -',e)
    sys.exit(1)
print('PASS: Beta 69.0.0-beta.6 Swiss debt enforcement')
print('Beta 4 IDs preserved:',len(old),'current:',len(ids))
