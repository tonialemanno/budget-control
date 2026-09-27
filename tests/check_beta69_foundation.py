from pathlib import Path
import json, sys
ROOT=Path(__file__).resolve().parents[1]
errors=[]

def check(ok,msg):
    if not ok: errors.append(msg)

check((ROOT/'docs/BETA69_FOUNDATION.md').exists(),'missing Beta 69 foundation document')
for locale in ['de-CH','fr-CH','it-CH','en']:
    p=ROOT/'src/i18n'/f'{locale}.json'
    check(p.exists(),f'missing locale {locale}')
    if p.exists():
        try:
            data=json.loads(p.read_text(encoding='utf-8'))
            check(data.get('_meta',{}).get('locale')==locale,f'locale metadata mismatch: {locale}')
            for k in ['app.name','nav.home','action.save','estimate.warning']:
                check(bool(data.get(k)),f'{locale}: missing {k}')
        except Exception as e:
            errors.append(f'{locale}: invalid JSON: {e}')
for d in ['src/regions/ch/common','src/regions/ch/sg','src/regions/ch/tg','src/regions/de/common']:
    check((ROOT/d/'README.md').exists(),f'missing region boundary {d}')
check((ROOT/'VERSION').read_text().strip().startswith('69.0.0-beta.'),'VERSION is not a Beta 69 prerelease')
if errors:
    print('FAIL')
    for e in errors: print(' -',e)
    sys.exit(1)
print('PASS: Beta 69 foundation structure')
