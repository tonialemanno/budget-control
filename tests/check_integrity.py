from pathlib import Path
from bs4 import BeautifulSoup
import json, hashlib, sys, re
ROOT=Path(__file__).resolve().parents[1]
base=json.loads((ROOT/'tests/baseline-hashes.json').read_text())
errors=[]
def sha(p): return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def check(ok,msg):
    if not ok: errors.append(msg)

# Immutable legacy assets still match the Stable baseline.
for name,h in base['css_blocks_sha256'].items(): check(sha(ROOT/'src/styles'/name)==h,f'{name} differs from Stable CSS block')
check(sha(ROOT/'src/js/bootstrap-errors.js')==base['bootstrap_js_sha256'],'bootstrap-errors.js differs from Stable block')
check(sha(ROOT/'manifest.webmanifest')==base['manifest_sha256'],'manifest changed')
for name,h in base['icons_sha256'].items(): check(sha(ROOT/name)==h,f'{name} changed')

# Existing DOM contract is preserved. New Beta shell DOM is injected at runtime.
html=(ROOT/'index.html').read_text(encoding='utf-8')
soup=BeautifulSoup(html,'html.parser')
ids=[tag.get('id') for tag in soup.find_all(attrs={'id':True})]
check(len(ids)==len(set(ids)),'duplicate DOM IDs detected')
check(len(ids)==base['dom_id_count'],f'DOM ID count changed: {len(ids)} != {base["dom_id_count"]}')
check(hashlib.sha256('\n'.join(sorted(ids)).encode()).hexdigest()==base['dom_id_set_sha256'],'DOM ID set changed')

# Existing application JS must equal the Stable payload after removing the explicit Beta 69 bridge
# and normalizing the version marker. This protects finance/business logic from accidental edits.
app=(ROOT/'src/js/app.js').read_text(encoding='utf-8')
normalized=app.replace("const APP_VERSION='69.0.0-beta.2';","const APP_VERSION='68.1.0-luxury-workflow';",1)
normalized=re.sub(r"\n// Beta 69 compatibility bridge\..*?\nsetTimeout\(beta69EmitContext,0\);\n", "", normalized, flags=re.S)
check(hashlib.sha256(normalized.encode()).hexdigest()==base['app_js_sha256'],'legacy app.js changed outside the approved Beta 69 bridge/version marker')

required=[
 './src/styles/legacy-core.css','./src/styles/luxury-layer.css','./src/styles/v681-final-overrides.css','./src/styles/beta69-shell.css',
 './src/js/bootstrap-errors.js','./src/js/app.js','./src/core/app-context.js','./src/core/i18n.js','./src/core/module-registry.js','./src/components/desktop-shell.js'
]
for asset in required: check(asset in html,f'index missing {asset}')
sw=(ROOT/'sw.js').read_text()
check("aione-v69-0-0-beta-2" in sw,'Beta 69 cache name missing')
for asset in required: check(asset in sw,f'service worker missing {asset}')

if errors:
    print('FAIL')
    for e in errors: print(' -',e)
    sys.exit(1)
print('PASS: Beta 69 integrity')
print(f'Legacy DOM IDs preserved: {len(ids)} unique')
print('Legacy CSS/manifest/icons unchanged; legacy app logic unchanged outside approved Beta 69 bridge/version marker')
