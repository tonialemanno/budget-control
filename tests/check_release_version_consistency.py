from pathlib import Path
import re, sys
ROOT=Path(__file__).resolve().parents[1]
version=(ROOT/'VERSION').read_text(encoding='utf-8').strip()
app=(ROOT/'src/js/app.js').read_text(encoding='utf-8')
ctx=(ROOT/'src/core/app-context.js').read_text(encoding='utf-8')
sw=(ROOT/'sw.js').read_text(encoding='utf-8')
errors=[]
def check(ok,msg):
    if not ok: errors.append(msg)
check(version=='69.0.0-beta.11','VERSION mismatch')
check(f"const APP_VERSION='{version}';" in app,'app.js version mismatch')
check(f"version:'{version}'" in ctx,'app-context version mismatch')
cache='aione-v'+version.replace('.','-')
check(cache in sw,'service worker cache version mismatch')
# No previous current-version marker should remain in active runtime/tests.
for rel in ['src/js/app.js','src/core/app-context.js','sw.js']:
    text=(ROOT/rel).read_text(encoding='utf-8')
    check('69.0.0-beta.10' not in text and 'aione-v69-0-0-beta-10' not in text,f'stale beta.10 marker in {rel}')
if errors:
    print('FAIL')
    for e in errors: print(' -',e)
    sys.exit(1)
print('PASS: release version markers are consistent')
