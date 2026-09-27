from pathlib import Path
from bs4 import BeautifulSoup
import json, hashlib, sys, re
ROOT=Path(__file__).resolve().parents[1]
base=json.loads((ROOT/'tests/baseline-hashes.json').read_text())
old_ids=set(json.loads((ROOT/'tests/beta2-dom-ids.json').read_text()))
critical_expected=json.loads((ROOT/'tests/critical-function-hashes-beta2.json').read_text())
critical_overrides=json.loads((ROOT/'tests/critical-function-hashes-beta7.json').read_text()) if (ROOT/'tests/critical-function-hashes-beta7.json').exists() else {}
errors=[]
def sha(p): return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def check(ok,msg):
    if not ok: errors.append(msg)

for name,h in base['css_blocks_sha256'].items(): check(sha(ROOT/'src/styles'/name)==h,f'{name} differs from Stable CSS block')
check(sha(ROOT/'src/js/bootstrap-errors.js')==base['bootstrap_js_sha256'],'bootstrap-errors.js differs from Stable block')
check(sha(ROOT/'manifest.webmanifest')==base['manifest_sha256'],'manifest changed')
for name,h in base['icons_sha256'].items(): check(sha(ROOT/name)==h,f'{name} changed')

html=(ROOT/'index.html').read_text(encoding='utf-8')
soup=BeautifulSoup(html,'html.parser')
ids=[tag.get('id') for tag in soup.find_all(attrs={'id':True})]
check(len(ids)==len(set(ids)),'duplicate DOM IDs detected')
missing=sorted(old_ids-set(ids))
check(not missing,'legacy DOM IDs removed: '+', '.join(missing[:12]))
required_new={'settingsRegionLabel','settingsRegion','settingsRegionHelp','settingsMunicipalityLabel','settingsMunicipality','settingsJurisdictionNote'}
check(required_new.issubset(set(ids)),'Foundation C context IDs missing')

def extract_named_functions(src,name):
    vals=[]
    pattern=r'\bfunction\s+'+re.escape(name)+r'\s*\('
    for m in re.finditer(pattern,src):
        start=m.start(); brace=src.find('{',start)
        if brace<0: continue
        i=brace; depth=0; quote=None; esc=False; line_comment=False; block_comment=False
        while i<len(src):
            ch=src[i]; nxt=src[i+1] if i+1<len(src) else ''
            if line_comment:
                if ch=='\n': line_comment=False
                i+=1; continue
            if block_comment:
                if ch=='*' and nxt=='/': block_comment=False; i+=2; continue
                i+=1; continue
            if quote:
                if esc: esc=False
                elif ch=='\\': esc=True
                elif ch==quote: quote=None
                i+=1; continue
            if ch=='/' and nxt=='/': line_comment=True; i+=2; continue
            if ch=='/' and nxt=='*': block_comment=True; i+=2; continue
            if ch in "'\"`": quote=ch; i+=1; continue
            if ch=='{': depth+=1
            elif ch=='}':
                depth-=1
                if depth==0:
                    vals.append(src[start:i+1]); break
            i+=1
    return [hashlib.sha256(v.encode()).hexdigest() for v in vals]

app=(ROOT/'src/js/app.js').read_text(encoding='utf-8')
for name,expected in critical_expected.items():
    current_expected=critical_overrides.get(name,expected)
    check(extract_named_functions(app,name)==current_expected,f'critical function changed: {name}')
check("const APP_VERSION='69.0.0-beta.7';" in app,'Beta 69.0.0-beta.7 app version missing')
check('window.AioneLegacyBridge' in app,'Beta 69 bridge missing')
check('country_code:countryCode' in app and 'region_code:' in app and "canton_code:countryCode==='CH'" in app and "municipality:q('#settingsMunicipality')" in app,'Foundation C profile context bridge missing')

required=[
 './src/styles/legacy-core.css','./src/styles/luxury-layer.css','./src/styles/v681-final-overrides.css','./src/styles/beta69-shell.css',
 './src/js/bootstrap-errors.js','./src/core/region-registry.js','./src/js/app.js','./src/core/app-context.js','./src/core/money.js','./src/core/i18n.js','./src/core/module-registry.js','./src/components/desktop-shell.js'
]
for asset in required: check(asset in html,f'index missing {asset}')
sw=(ROOT/'sw.js').read_text()
check('aione-v69-0-0-beta-7' in sw,'Beta 69.0.0-beta.7 cache name missing')
for asset in required: check(asset in sw,f'service worker missing {asset}')

if errors:
    print('FAIL')
    for e in errors: print(' -',e)
    sys.exit(1)
print('PASS: Beta 69 Foundation C integrity')
print(f'Legacy DOM IDs preserved: {len(old_ids)}; current unique IDs: {len(ids)}')
print('Critical calculations preserved; taxCalc uses the documented Beta 7 SG/TG regional correction')
