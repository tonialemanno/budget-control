from pathlib import Path
import urllib.request,sys,threading,http.server,functools,time
ROOT=Path(__file__).resolve().parents[1]
PORT=0
Handler=functools.partial(http.server.SimpleHTTPRequestHandler,directory=str(ROOT))
server=http.server.ThreadingHTTPServer(('127.0.0.1',PORT),Handler)
thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start();time.sleep(.08)
PORT=server.server_address[1]
BASE=f'http://127.0.0.1:{PORT}/'
paths=['','index.html','manifest.webmanifest','sw.js','icon-192.png','icon-512.png',
'src/styles/legacy-core.css','src/styles/luxury-layer.css','src/styles/v681-final-overrides.css','src/styles/beta69-shell.css','src/styles/onboarding-wizard.css','src/styles/debt-enforcement.css','src/styles/beta69-ux.css',
'src/js/bootstrap-errors.js','src/core/region-registry.js','src/js/app.js','src/core/app-context.js','src/core/money.js','src/core/i18n.js','src/core/module-registry.js','src/components/desktop-shell.js','src/components/onboarding-wizard.js','src/components/beta69-ux.js','src/features/debt-enforcement-ch.js',
'src/i18n/de-CH.json','src/i18n/fr-CH.json','src/i18n/it-CH.json','src/i18n/en.json','src/i18n/de-DE.json']
failed=[]
try:
    for p in paths:
        try:
            with urllib.request.urlopen(BASE+p,timeout=5) as r:
                if r.status!=200: failed.append((p,r.status))
        except Exception as e: failed.append((p,str(e)))
finally:
    server.shutdown();server.server_close()
if failed:
    print('FAIL',failed);sys.exit(1)
print('PASS: all local startup assets return HTTP 200')
