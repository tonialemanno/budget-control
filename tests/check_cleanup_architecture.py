from pathlib import Path
import re, sys
ROOT=Path(__file__).resolve().parents[1]
app=(ROOT/'src/js/app.js').read_text(encoding='utf-8')
ux=(ROOT/'src/components/beta69-ux.js').read_text(encoding='utf-8')
html=(ROOT/'index.html').read_text(encoding='utf-8')
errors=[]
def check(v,msg):
    if not v: errors.append(msg)

# Source files must not return to patch-on-patch replacement, version wrapper aliases or duplicate declarations.
source_files=sorted((ROOT/'src').rglob('*.js'))
assignments=[]; legacy_aliases=[]; duplicates=[]; clone_files=[]; names=[]
for source_file in source_files:
    source=source_file.read_text(encoding='utf-8')
    rel=str(source_file.relative_to(ROOT))
    file_assignments=re.findall(r'(?m)(?:^|;)\s*([A-Za-z_$][\w$]*)\s*=\s*(?:async\s+)?function\s*\(',source)
    assignments.extend(f'{rel}:{name}' for name in file_assignments)
    file_aliases=re.findall(r'const\s+(_(?:aione|v\d+|beta\d+)[A-Za-z0-9_$]*)\s*=',source)
    legacy_aliases.extend(f'{rel}:{name}' for name in file_aliases)
    file_names=re.findall(r'(?m)(?:^|[;{}])\s*(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(',source)
    if source_file.name=='app.js': names=file_names
    seen=set(); dup=[]
    for name in file_names:
        if name in seen and name not in dup: dup.append(name)
        seen.add(name)
    duplicates.extend(f'{rel}:{name}' for name in dup)
    if 'cloneNode(' in source: clone_files.append(rel)
check(not assignments,'function reassignment remains: '+', '.join(assignments[:8]))
check(not legacy_aliases,'legacy wrapper aliases remain: '+', '.join(legacy_aliases[:8]))
check(not duplicates,'duplicate named function declarations remain: '+', '.join(duplicates[:8]))
check(not clone_files,'DOM clone/rebind hack remains: '+', '.join(clone_files[:8]))
check('function rawApi(' in app and 'async function api(' in app,'raw/guarded API boundary is not explicit')
check('const _api=api' not in app and '_api(' not in app,'legacy _api patch boundary remains')

# Admin module editing must have exactly one explicit batch-save path.
check('pendingFeatureChanges=new Map()' in app,'admin pending-change map missing')
check('async function saveAdminFeatureChanges()' in app,'admin batch save function missing')
check("pendingFeatureChanges.set(key,sel.value)" in app,'admin change collection missing')
check("admin_set_feature_override" in app and "admin_clear_feature_override" in app,'admin persistence RPCs missing')
check(app.count('admin_set_feature_override')==1 and app.count('admin_clear_feature_override')==1,'admin persistence RPCs must exist only in the single batch-save path')
check('function adminFeatureDraft(' in app,'admin draft-state helper missing')
check('id="adminFeatureSaveBar"' in html and 'id="adminFeatureSave"' in html and 'id="adminFeatureDiscard"' in html,'admin save controls missing')
check('pendingFeatures' not in ux and 'ensureFeatureSavebar' not in ux and 'bindFeatureBatching' not in ux,'old beta69 admin interception still present')

# Effective critical functions are single and explicit.
check(len(re.findall(r'\bfunction\s+accountBalanceAsOf\s*\(',app))==1,'accountBalanceAsOf is not single-definition')
check(len(re.findall(r'\bfunction\s+taxCalc\s*\(',app))==1,'taxCalc is not single-definition')
check('function taxCalcBase(' in app,'protected regional tax base missing')

if errors:
    print('FAIL')
    for e in errors: print(' -',e)
    sys.exit(1)
print('PASS: cleanup architecture guards active')
print(f'Source files: {len(source_files)}; app.js named functions: {len(names)}; duplicate declarations: 0; patch reassignments: 0')
