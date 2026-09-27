from pathlib import Path
import re, json, sys
root=Path(__file__).resolve().parents[1]
checks=[]
def ok(name,cond):
    checks.append((name,bool(cond)))

ok('version', (root/'VERSION').read_text().strip()=='69.0.0-beta.8')
idx=(root/'index.html').read_text()
app=(root/'src/js/app.js').read_text()
sw=(root/'sw.js').read_text()
ctx=(root/'src/core/app-context.js').read_text()
reg=(root/'src/core/region-registry.js').read_text()
money=(root/'src/core/money.js').read_text()
ok('country-select', 'id="settingsCountry"' in idx and '<option value="CH">Schweiz</option>' in idx and '<option value="DE">Deutschland</option>' in idx)
ok('region-select', 'id="settingsRegion"' in idx)
ok('municipality', 'id="settingsMunicipality"' in idx)
ok('romanian-hidden', 'option value="ro"' not in idx)
ok('region-core-loaded', './src/core/region-registry.js' in idx)
ok('money-core-loaded', './src/core/money.js' in idx)
ok('sg-tg-ready', "['SG','TG'].includes(code)" in reg)
ok('all-ch-cantons', len(re.findall(r"\['[A-Z]{2}','[^']+'\]", reg.split('DE:[')[0]))>=26)
ok('context-version', "69.0.0-beta.8" in ctx)
ok('app-version', "const APP_VERSION='69.0.0-beta.8'" in app)
ok('profile-context-save', all(x in app for x in ['country_code:countryCode','region_code:',"canton_code:countryCode==='CH'","municipality:q('#settingsMunicipality')"]))
ok('money-format-base', 'formatBase' in money and 'baseCurrency' in money)
ok('sw-cache', 'aione-v69-0-0-beta-8' in sw and 'region-registry.js' in sw and 'money.js' in sw)
ok('migration-file', (root/'supabase/migrations/20260927_aione_v690_profile_country_region_context.sql').exists() and (root/'supabase/migrations/20260927_aione_v690_generic_region_code.sql').exists())
failed=[n for n,v in checks if not v]
for n,v in checks: print(('PASS' if v else 'FAIL'), n)
if failed:
    print('FAILED:', ', '.join(failed)); sys.exit(1)
