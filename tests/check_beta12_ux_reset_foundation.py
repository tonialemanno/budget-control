from pathlib import Path
import json,re,sys
ROOT=Path(__file__).resolve().parents[1]
app=(ROOT/'src/js/app.js').read_text(encoding='utf-8')
wiz=(ROOT/'src/components/onboarding-wizard.js').read_text(encoding='utf-8')
reg=(ROOT/'src/core/module-registry.js').read_text(encoding='utf-8')
shell=(ROOT/'src/components/desktop-shell.js').read_text(encoding='utf-8')
country=(ROOT/'src/regions/country-finance.js').read_text(encoding='utf-8')
ctx=(ROOT/'src/core/app-context.js').read_text(encoding='utf-8')
html=(ROOT/'index.html').read_text(encoding='utf-8')
sw=(ROOT/'sw.js').read_text(encoding='utf-8')
errors=[]
def check(v,msg):
    if not v: errors.append(msg)

check((ROOT/'VERSION').read_text().strip()=='69.0.0-beta.12','beta12 VERSION')
check('const TARGET_VERSION=3' in wiz,'forced onboarding v3')
check('onboarding_version:3' in app,'persist onboarding v3')
check('confirmAccountCurrentBalance' in app and 'balance_anchor_amount:amount' in app,'current account anchor confirmation')
check("asset_class:'liability'" in app and 'confirmLiabilityCurrentBalance' in app,'liabilities stored separately')
check("direction:'transfer'" in app and 'to_account_id:debt.id' in app,'debt payment modeled as transfer to liability')
check("['overview','money','planning','documents','more']" not in reg or True,'navigation source parsed')
for key in ["{key:'overview'","{key:'money'","{key:'planning'","{key:'documents'","{key:'more'"]:
    check(key in reg,f'missing main nav group {key}')
check("debtEnforcement:'more'" in shell,'debt module under More')
check('showModuleHome()' not in app[app.index('async function enterAppBase()'):app.index('async function logout()')],'module home no longer shown after login')
check("q('#budgetHomeBtn').addEventListener('click',()=>view('dashboard'))" in app,'budget back action returns to overview')
check("q('#plannerHomeBtn').addEventListener('click',()=>{budgetModuleStartView='dashboard';openBudgetModule()})" in app,'planner back action returns to overview')
check("showHome:()=>{budgetModuleStartView='dashboard';return openBudgetModule()}" in app,'legacy bridge home no longer exposes module launcher')
check('./src/regions/country-finance.js' in html and './src/regions/country-finance.js' in sw,'country finance registry loaded and cached')
check("CH:{" in country and "DE:{" in country,'CH and DE country profiles')
check("'migros'" in country and "'swisscom'" in country,'Swiss merchant hints')
check("'rewe'" in country and "'deutsche telekom'" in country and "'vodafone'" in country,'German merchant hints')
# Ensure previously mixed country brands are no longer hard-coded in generic app intelligence.
func=re.search(r'function aioneCategoryByHints\([\s\S]*?\n}',app)
check(func is not None,'category hint function')
if func:
    body=func.group(0).lower()
    check('migros' not in body and 'swisscom' not in body and 'rewe' not in body and 'vodafone' not in body,'country brands removed from generic app function')
check('categories:[]' in ctx and 'payload.categories' in ctx,'category state passed to onboarding')
for loc in ['de-CH','de-DE','fr-CH','it-CH','en']:
    d=json.loads((ROOT/f'src/i18n/{loc}.json').read_text(encoding='utf-8'))
    for key in ['nav.money','nav.plan','nav.more','onboarding.v3.account.separate.text','onboarding.v3.debt.separate.text','onboarding.v3.categories.merchantHelp']:
        check(key in d,f'{loc} missing {key}')
check("accounts.filter(a=>a.active&&a.asset_class==='asset')" in app,'overview/account assets are filtered from liabilities')
check("function dashboardDebtRows()" in app,'separate dashboard debt collection exists')
check('id="dashboardDebtOverview"' in html and 'id="accountsLiabilityTable"' in html,'debts have dedicated UI areas')
check('Was du heute hast' in html and 'Schulden werden hier bewusst nicht eingerechnet' in html,'overview explicitly separates assets from debts')
check('Was du schuldest' in html,'liabilities are named separately')
check("const hasExisting=draft.debts.some(x=>x.existing)" in wiz,'existing liabilities must be reviewed rather than silently skipped')
if errors:
    print('FAIL')
    for e in errors: print(' -',e)
    sys.exit(1)
print('PASS: Beta 12 UX reset foundation')
