#!/bin/zsh
cd -- "$(dirname -- "$0")"
python3 - <<'PYTHON'
import subprocess,sys,time,urllib.request,webbrowser
url="http://localhost:4173/#shop"
process=subprocess.Popen([sys.executable,"server.py"])
try:
    for _ in range(40):
        try:
            urllib.request.urlopen("http://localhost:4173/api/v1/health",timeout=.5)
            webbrowser.open(url)
            break
        except Exception:
            if process.poll() is not None:
                raise SystemExit("The website could not start. Check whether port 4173 is in use.")
            time.sleep(.15)
    process.wait()
except KeyboardInterrupt:
    process.terminate()
PYTHON
