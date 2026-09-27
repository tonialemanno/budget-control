from pathlib import Path
import re, sys

ROOT=Path(__file__).resolve().parents[1]
app=(ROOT/'src/js/app.js').read_text(encoding='utf-8')
errors=[]
def check(ok,msg):
    if not ok: errors.append(msg)

def declarations(name):
    return len(re.findall(r'\bfunction\s+'+re.escape(name)+r'\s*\(',app))

def assignments(name):
    return len(re.findall(r'(?<![.\w$])'+re.escape(name)+r'\s*=\s*(?:async\s*)?function\s*\(',app))

check(declarations('renderAll')==1, f'renderAll declarations: {declarations("renderAll")}')
check(declarations('view')==1, f'view declarations: {declarations("view")}')
check(assignments('renderAll')==0, f'renderAll function reassignments: {assignments("renderAll")}')
check(assignments('view')==0, f'view function reassignments: {assignments("view")}')

for forbidden in ['_aioneRenderAll','_v681RenderAll','_beta69RenderAll','_aioneView','_v681View','_beta69View']:
    check(forbidden not in app, f'legacy lifecycle wrapper remains: {forbidden}')

# Preserve the responsibilities formerly added by the three wrapper layers.
render_start=app.index('function renderAll(')
render_end=app.index('\n\n/* ===== Finance OS logic ===== */',render_start)
render_block=app[render_start:render_end]
for marker in ['renderAioneAiSettings();','renderHelpCenter();','renderAioneFinancialRadar();','renderWealthStructure();','enhanceCollapsiblePanels();','enhanceSettingsSections();','setTimeout(beta69EmitContext,0)']:
    check(marker in render_block, f'renderAll lifecycle marker missing: {marker}')

view_start=app.index('function view(')
view_end=app.index("\nqa('.nav button')",view_start)
view_block=app[view_start:view_end]
for marker in ["requestedName==='help'","requestedName==='support'","requestedName==='settings'","requestedName==='analysis'","aione:viewchange","beta69EmitContext()"]:
    check(marker in view_block, f'view lifecycle marker missing: {marker}')

if errors:
    print('FAIL')
    for e in errors: print(' -',e)
    sys.exit(1)
print('PASS: lifecycle consolidated; renderAll/view wrapper regression guard active')
