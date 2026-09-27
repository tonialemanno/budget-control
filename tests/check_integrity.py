from pathlib import Path
from bs4 import BeautifulSoup
import json, hashlib, sys
ROOT=Path(__file__).resolve().parents[1]
base=json.loads((ROOT/'tests/baseline-hashes.json').read_text())
errors=[]
def sha(p): return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def check(ok,msg):
    if not ok: errors.append(msg)
for name,h in base['css_blocks_sha256'].items(): check(sha(ROOT/'src/styles'/name)==h,f'{name} differs from Stable CSS block')
check(sha(ROOT/'src/js/bootstrap-errors.js')==base['bootstrap_js_sha256'],'bootstrap-errors.js differs from Stable block')
check(sha(ROOT/'src/js/app.js')==base['app_js_sha256'],'app.js differs from Stable application block')
check(sha(ROOT/'manifest.webmanifest')==base['manifest_sha256'],'manifest changed')
for name,h in base['icons_sha256'].items(): check(sha(ROOT/name)==h,f'{name} changed')
html=(ROOT/'index.html').read_text(encoding='utf-8')
soup=BeautifulSoup(html,'html.parser')
ids=[tag.get('id') for tag in soup.find_all(attrs={'id':True})]
check(len(ids)==len(set(ids)),'duplicate DOM IDs detected')
check(len(ids)==base['dom_id_count'],f'DOM ID count changed: {len(ids)} != {base["dom_id_count"]}')
check(hashlib.sha256('\n'.join(sorted(ids)).encode()).hexdigest()==base['dom_id_set_sha256'],'DOM ID set changed')
required=[
 './src/styles/legacy-core.css','./src/styles/luxury-layer.css','./src/styles/v681-final-overrides.css',
 './src/js/bootstrap-errors.js','./src/js/app.js'
]
for asset in required: check(asset in html,f'index missing {asset}')
sw=(ROOT/'sw.js').read_text()
check("aione-v68-1-1-beta-1" in sw,'Beta cache name missing')
for asset in required: check(asset in sw,f'service worker missing {asset}')
if errors:
    print('FAIL')
    for e in errors: print(' -',e)
    sys.exit(1)
print('PASS: Phase-1 structural integrity')
print(f'DOM IDs preserved: {len(ids)} unique')
print('CSS and application JavaScript payloads are byte-identical to Stable baseline')
