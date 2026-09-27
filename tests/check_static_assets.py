import urllib.request, sys
BASE='http://127.0.0.1:8765/'
paths=['','index.html','manifest.webmanifest','sw.js','icon-192.png','icon-512.png','src/styles/legacy-core.css','src/styles/luxury-layer.css','src/styles/v681-final-overrides.css','src/js/bootstrap-errors.js','src/js/app.js']
failed=[]
for p in paths:
    try:
        with urllib.request.urlopen(BASE+p,timeout=5) as r:
            if r.status!=200: failed.append((p,r.status))
    except Exception as e: failed.append((p,str(e)))
if failed:
    print('FAIL',failed);sys.exit(1)
print('PASS: all local startup assets return HTTP 200')
