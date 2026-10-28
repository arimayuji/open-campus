"""yt-dlp as a small internal service. Reached only through the Worker, never public.
GET /info?id=<11 chars>&lang=en  ->  {title, channel, license, duration, embeddable, vtt}
Metadata and captions only: no video is downloaded here."""
import glob, json, os, re, subprocess, tempfile, threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

ID = re.compile(r"^[A-Za-z0-9_-]{11}$")
LANGS = {"en", "pt", "es"}
LOCK = threading.Semaphore(2)  # two at a time keeps a small instance healthy


def info(vid, lang):
    with tempfile.TemporaryDirectory() as d:
        cmd = ["yt-dlp", "--no-playlist", "--skip-download", "--write-auto-subs", "--write-subs", "--sub-langs", f"{lang},{lang}.*",
               "--sub-format", "vtt", "--dump-single-json", "--no-simulate", "--no-quiet", "-o", f"{d}/%(id)s", f"https://www.youtube.com/watch?v={vid}"]
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=150)
        # stdout holds the JSON (last line); --no-quiet only adds progress text before it
        if r.returncode != 0:
            return {"error": (r.stderr or "yt-dlp failed").strip().splitlines()[-1][:300]}, 502
        m = json.loads(r.stdout.strip().splitlines()[-1])
        # prefer the plain language track over variants such as en-orig
        files = sorted(glob.glob(f"{d}/*.vtt"), key=lambda f: (not f.endswith(f".{lang}.vtt"), f))
        return {
            "title": m.get("title"), "channel": m.get("channel") or m.get("uploader"), "license": m.get("license"),
            "duration": m.get("duration"), "embeddable": m.get("playable_in_embed"),
            "vtt": open(files[0], encoding="utf-8").read() if files else None,
            "note": None if files else json.dumps({"subs": list((m.get("subtitles") or {}))[:8], "auto": list((m.get("automatic_captions") or {}))[:8],
                                                   "err": (r.stderr or "")[-300:]}),
        }, 200


class H(BaseHTTPRequestHandler):
    def do_GET(self):
        u = urlparse(self.path)
        q = parse_qs(u.query)
        vid, lang = (q.get("id") or [""])[0], (q.get("lang") or ["en"])[0]
        if u.path != "/info" or not ID.match(vid) or lang not in LANGS:
            body, code = {"error": "bad request"}, 400
        else:
            with LOCK:
                try:
                    body, code = info(vid, lang)
                except subprocess.TimeoutExpired:
                    body, code = {"error": "timeout"}, 504
        b = json.dumps(body).encode()
        self.send_response(code); self.send_header("Content-Type", "application/json"); self.send_header("Content-Length", str(len(b)))
        self.end_headers(); self.wfile.write(b)

    def log_message(self, *a):
        pass


ThreadingHTTPServer(("0.0.0.0", 8080), H).serve_forever()
