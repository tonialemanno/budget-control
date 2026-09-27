from pathlib import Path
from bs4 import BeautifulSoup
import json,sys,re
ROOT=Path(__file__).resolve().parents[1]
errors=[]
def ok(v,msg):
    if not v: errors.append(msg)
html=(ROOT/'index.html').read_text(encoding='utf-8')
app=(ROOT/'src/js/app.js').read_text(encoding='utf-8')
ux=(ROOT/'src/components/beta69-ux.js').read_text(encoding='utf-8')
css=(ROOT/'src/styles/beta69-ux.css').read_text(encoding='utf-8')
sw=(ROOT/'sw.js').read_text(encoding='utf-8')
reg=(ROOT/'src/core/module-registry.js').read_text(encoding='utf-8')
debt=(ROOT/'src/features/debt-enforcement-ch.js').read_text(encoding='utf-8')
ok((ROOT/'VERSION').read_text().strip()=='69.0.0-beta.10','version')
ok("const APP_VERSION='69.0.0-beta.10';" in app,'app version')
ok('./src/styles/beta69-ux.css' in html and './src/components/beta69-ux.js' in html,'UX assets in index')
ok('aione-v69-0-0-beta-10' in sw and './src/styles/beta69-ux.css' in sw and './src/components/beta69-ux.js' in sw,'UX assets in service worker')
ok(re.search(r'id="reconcilePdf"[^>]*multiple[^>]*accept="[^"]*\.csv[^"]*"',html) is not None,'multi PDF/CSV reconcile input')
ok("analyzeBankPdfs(files" in app and "csvFiles=files.filter" in app and "view('csv')" in app,'multi PDF/CSV reconcile handler')
ok("view:'csv'" in reg and "label:'nav.bankImport'" in reg,'bank import nav')
ok('id="adminFeatureSaveBar"' in html and 'pendingFeatureChanges' in app and 'saveAdminFeatureChanges' in app and 'pendingFeatures' not in ux,'explicit admin feature batch save')
ok('data-a69-user-logout' in ux and 'Familienchat' in ux and 'getNotificationData' in app,'desktop command bar')
ok('a69-advanced-filters' in ux and 'transactionDefaultApplied' in ux,'transaction filter simplification')
ok('aione-category-setting-grid' in css and 'aione-category-setting-card' in css,'luxury category cards')
ok('Bis auf Widerruf' in ux and 'data-a69-standing-order' in ux,'standing order shortcut')
ok('buildDialogs(true)' in debt and 'FALLBACK' in debt,'debt labels refresh/fallback')
ok('smartReviewIds=new Set(g.rows.map' in app and "q('#txSearch').value=''" in app,'exact AI review rows')
ok('setInterval(refreshAioneChats,5000)' not in app,'old 5s chat polling removed')
ok('beta69LoadDeferredData' in app and 'renderSupport().catch' not in app[app.index('async function reloadAll()'):app.index('function typeLabel')], 'noncritical login data deferred')
# preserve beta6 ids exactly as a subset if reference id list is available
soup=BeautifulSoup(html,'html.parser'); ids=[x.get('id') for x in soup.find_all(attrs={'id':True})]
ok(len(ids)==len(set(ids)),'duplicate IDs')
if errors:
    print('FAIL'); [print(' -',e) for e in errors]; sys.exit(1)
print('PASS: Beta 69.0.0-beta.10 UX consolidation')
print('Unique DOM IDs:',len(ids))
