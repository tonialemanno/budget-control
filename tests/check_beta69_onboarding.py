from pathlib import Path
from bs4 import BeautifulSoup
import json,re,sys,hashlib
ROOT=Path(__file__).resolve().parents[1]
errors=[]
def ok(v,msg):
    if not v: errors.append(msg)
html=(ROOT/'index.html').read_text(encoding='utf-8')
app=(ROOT/'src/js/app.js').read_text(encoding='utf-8')
sw=(ROOT/'sw.js').read_text(encoding='utf-8')
ok("const APP_VERSION='69.0.0-beta.8';" in app,'version marker')
ok('saveOnboardingProfile:beta69SaveOnboardingProfile' in app,'profile bridge')
ok('createInitialAccount:beta69CreateInitialAccount' in app,'account bridge')
ok('completeOnboarding:beta69CompleteOnboarding' in app,'completion bridge')
ok("onboarding_version:2" in app,'onboarding v2 completion')
ok('./src/components/onboarding-wizard.js' in html,'wizard script missing')
ok('./src/styles/onboarding-wizard.css' in html,'wizard css missing')
ok('aione-v69-0-0-beta-8' in sw,'service worker cache')
ok('./src/components/onboarding-wizard.js' in sw and './src/styles/onboarding-wizard.css' in sw,'wizard assets not precached')
for loc in ['de-CH','fr-CH','it-CH','en','de-DE']:
    d=json.loads((ROOT/f'src/i18n/{loc}.json').read_text(encoding='utf-8'))
    for key in ['onboarding.step1.title','onboarding.step4.title','onboarding.verify.warning','onboarding.finish']:
        ok(key in d,f'{loc} missing {key}')
# Preserve all Beta 2 legacy ids
old=set(json.loads((ROOT/'tests/beta2-dom-ids.json').read_text()))
soup=BeautifulSoup(html,'html.parser'); ids=[x.get('id') for x in soup.find_all(attrs={'id':True})]
ok(len(ids)==len(set(ids)),'duplicate IDs')
ok(old.issubset(set(ids)),'legacy ID removed')
if errors:
    print('FAIL'); [print(' -',e) for e in errors]; sys.exit(1)
print('PASS: Beta 69 onboarding foundation')
print('Legacy IDs preserved:',len(old),'current IDs:',len(ids))
