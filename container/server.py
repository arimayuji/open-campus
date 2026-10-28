"""yt-dlp as a small internal service. Reached only through the Worker, never public.
GET /info?id=<11 chars>&lang=en  ->  {title, channel, license, duration, embeddable, vtt}
Metadata and captions only: no video is downloaded here."""
import glob, json, os, re, shutil, subprocess, tempfile, threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

ID = re.compile(r"^[A-Za-z0-9_-]{11}$")
LANGS = {"en", "pt", "es"}
HOST_LOCK = threading.Semaphore(1)  # compressing is heavy: one at a time
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


def ffmpeg():
    import imageio_ffmpeg
    return imageio_ffmpeg.get_ffmpeg_exe()


def host(vid, d):
    """Download at most 720p, compress, return the mp4 path. Refuses anything that is not Creative Commons."""
    url = f"https://www.youtube.com/watch?v={vid}"
    m = subprocess.run(["yt-dlp", "--no-playlist", "--skip-download", "--dump-single-json", url], capture_output=True, text=True, timeout=120)
    if m.returncode != 0:
        return None, "yt-dlp failed: " + (m.stderr.strip().splitlines() or ["?"])[-1][:200]
    meta = json.loads(m.stdout)
    if "creative commons" not in (meta.get("license") or "").lower():
        return None, "licence is not Creative Commons: not hosted"
    raw = f"{d}/raw.%(ext)s"
    r = subprocess.run(["yt-dlp", "--no-playlist", "--ffmpeg-location", ffmpeg(), "-f", "bv*[height<=720]+ba/b[height<=720]/b",
                        "--merge-output-format", "mkv", "-o", raw, url], capture_output=True, text=True, timeout=1500)
    src = glob.glob(f"{d}/raw.*")
    if r.returncode != 0 or not src:
        return None, "download failed: " + (r.stderr.strip().splitlines() or ["?"])[-1][:200]
    out = f"{d}/out.mp4"
    c = subprocess.run([ffmpeg(), "-y", "-i", src[0], "-vf", "scale=-2:'min(720,ih)'", "-c:v", "libx264", "-preset", "veryfast", "-crf", "28",
                        "-c:a", "aac", "-b:a", "96k", "-movflags", "+faststart", out], capture_output=True, text=True, timeout=3000)
    if c.returncode != 0:
        return None, "compress failed: " + c.stderr.strip()[-200:]
    return out, None


class H(BaseHTTPRequestHandler):
    def do_GET(self):
        u = urlparse(self.path)
        q = parse_qs(u.query)
        vid, lang = (q.get("id") or [""])[0], (q.get("lang") or ["en"])[0]
        if u.path == "/host" and ID.match(vid):
            with HOST_LOCK:
                d = tempfile.mkdtemp()
                try:
                    path, err = host(vid, d)
                    if err:
                        b = json.dumps({"error": err}).encode(); self.send_response(422 if "licence" in err else 502)
                        self.send_header("Content-Type", "application/json"); self.send_header("Content-Length", str(len(b))); self.end_headers(); self.wfile.write(b)
                        return
                    self.send_response(200); self.send_header("Content-Type", "video/mp4"); self.send_header("Content-Length", str(os.path.getsize(path))); self.end_headers()
                    with open(path, "rb") as f:
                        shutil.copyfileobj(f, self.wfile, 1 << 20)
                except subprocess.TimeoutExpired:
                    b = b'{"error":"timeout"}'; self.send_response(504); self.send_header("Content-Length", str(len(b))); self.end_headers(); self.wfile.write(b)
                finally:
                    shutil.rmtree(d, ignore_errors=True)
            return
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
