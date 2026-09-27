from pathlib import Path
import functools
import http.server
import sys
import threading
import time
import urllib.request

ROOT = Path(__file__).resolve().parents[1]

class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        pass

    def copyfile(self, source, outputfile):
        try:
            super().copyfile(source, outputfile)
        except (BrokenPipeError, ConnectionResetError):
            # A local probe may close as soon as the response is verified.
            pass

Handler = functools.partial(QuietHandler, directory=str(ROOT))
server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), Handler)
thread = threading.Thread(target=server.serve_forever, daemon=True)
thread.start()
time.sleep(.08)
BASE = f'http://127.0.0.1:{server.server_address[1]}/'
paths = [
    '', 'index.html', 'manifest.webmanifest', 'sw.js', 'icon-192.png', 'icon-512.png',
    'src/styles/legacy-core.css', 'src/styles/luxury-layer.css', 'src/styles/legacy-overrides.css',
    'src/styles/beta69-shell.css', 'src/styles/onboarding-wizard.css', 'src/styles/debt-enforcement.css', 'src/styles/beta69-ux.css',
    'src/js/bootstrap-errors.js', 'src/core/region-registry.js', 'src/js/app.js', 'src/core/app-context.js',
    'src/core/money.js', 'src/core/i18n.js', 'src/core/module-registry.js', 'src/components/desktop-shell.js',
    'src/components/onboarding-wizard.js', 'src/components/beta69-ux.js', 'src/features/debt-enforcement-ch.js',
    'src/i18n/de-CH.json', 'src/i18n/fr-CH.json', 'src/i18n/it-CH.json', 'src/i18n/en.json', 'src/i18n/de-DE.json'
]
failed = []
try:
    for path in paths:
        try:
            with urllib.request.urlopen(BASE + path, timeout=5) as response:
                if response.status != 200:
                    failed.append((path, response.status))
        except Exception as exc:
            failed.append((path, str(exc)))
finally:
    server.shutdown()
    server.server_close()

if failed:
    print('FAIL', failed)
    sys.exit(1)
print('PASS: all local startup assets return HTTP 200')
