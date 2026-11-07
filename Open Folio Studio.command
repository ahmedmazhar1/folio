#!/bin/zsh
cd -- "${0:A:h}" || exit 1
python3 - <<'PY'
from pathlib import Path
import json
import subprocess
import sys
import tempfile
import time
import urllib.request
import webbrowser

root = Path.cwd()
url = 'http://localhost:4173'

def running():
    try:
        with urllib.request.urlopen(url + '/api/v1/health', timeout=1) as response:
            return json.load(response).get('service') == 'Folio Packaging API'
    except Exception:
        return False

if not running():
    log_path = Path(tempfile.gettempdir()) / 'folio-studio-server.log'
    with log_path.open('a') as log:
        process = subprocess.Popen(
            [sys.executable, str(root / 'server.py')],
            cwd=root,
            stdin=subprocess.DEVNULL,
            stdout=log,
            stderr=subprocess.STDOUT,
            start_new_session=True,
        )
    for attempt in range(30):
        if running():
            break
        if process.poll() is not None:
            break
        time.sleep(0.1)

if running():
    webbrowser.open(url + '/#home')
    print('Folio Studio is open in your browser. You can close this window.')
else:
    print('Folio could not start. Please share this message so we can fix it.')
    print('Details are in the Folio server log in your temporary folder.')
    input('Press Return to close.')
    sys.exit(1)
PY
