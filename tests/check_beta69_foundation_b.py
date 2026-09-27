from pathlib import Path
import json,re
ROOT=Path(__file__).resolve().parents[1]
required=[
 'src/core/app-context.js','src/core/i18n.js','src/core/module-registry.js',
 'src/components/desktop-shell.js','src/styles/beta69-shell.css',
 'src/i18n/de-CH.json','src/i18n/fr-CH.json','src/i18n/it-CH.json','src/i18n/en.json','src/i18n/de-DE.json'
]
for rel in required:
    assert (ROOT/rel).is_file(), rel
for rel in ['de-CH.json','fr-CH.json','it-CH.json','en.json','de-DE.json']:
    data=json.loads((ROOT/'src/i18n'/rel).read_text())
    for key in ['nav.home','nav.money','nav.obligations','nav.settings','nav.accounts','nav.transactions']:
        assert key in data,(rel,key)
html=(ROOT/'index.html').read_text()
for rel in ['./src/styles/beta69-shell.css','./src/core/app-context.js','./src/core/i18n.js','./src/core/module-registry.js','./src/components/desktop-shell.js']:
    assert rel in html,rel
ids=re.findall(r'\bid="([^"]+)"',html)
assert len(ids)==len(set(ids)), 'duplicate ids introduced'
app=(ROOT/'src/js/app.js').read_text()
assert re.search(r"const APP_VERSION='69\.0\.0-beta\.\d+';",app)
assert 'window.AioneLegacyBridge' in app
sw=(ROOT/'sw.js').read_text()
assert re.search(r"aione-v69-0-0-beta-\d+",sw)
for rel in required:
    if rel.endswith(('.js','.css','.json')): assert './'+rel in sw or rel.startswith('src/i18n/') and './'+rel in sw
print('Beta 69 Foundation B checks: OK')
