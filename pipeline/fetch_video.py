#!/usr/bin/env python3
"""Download, compress and publish one video, but ONLY if its owner licensed it for reuse.

  python pipeline/fetch_video.py <youtube url> --check            # show title, channel and licence, change nothing
  python pipeline/fetch_video.py <youtube url> --upload           # download, compress, upload, write the credit
  python pipeline/fetch_video.py --remove <video id>              # take a video down (object and credit)

The gate is not optional: a video whose licence is not Creative Commons is refused, with no flag to override it.
Needs: yt-dlp, ffmpeg, and for --upload/--remove a Cloudflare token in CLOUDFLARE_API_TOKEN with R2 write access.
"""
import argparse, json, re, subprocess, sys, tempfile
from datetime import date
from pathlib import Path
from urllib.parse import urlparse

BUCKET = "open-campus-media"
ID = re.compile(r"^[A-Za-z0-9_-]{11}$")
ROOT = Path(__file__).resolve().parent.parent


def run(cmd, **kw):
    return subprocess.run(cmd, check=True, text=True, **kw)


def is_open(license_text):
    """True only for Creative Commons licences as reported by YouTube."""
    return bool(license_text) and "creative commons" in license_text.lower()


def check_url(url):
    host = (urlparse(url).hostname or "").lower()
    if host not in ("www.youtube.com", "youtube.com", "youtu.be", "m.youtube.com"):
        sys.exit("Only YouTube links are supported.")


def metadata(url):
    try:
        out = run(["yt-dlp", "--skip-download", "--no-playlist", "--dump-json", url], capture_output=True).stdout
    except subprocess.CalledProcessError as e:
        sys.exit("Could not read that video. Check that the link is a real video link (not a placeholder). "
                 + ((e.stderr or "").strip().splitlines() or [""])[-1])
    m = json.loads(out)
    if not ID.match(m.get("id", "")):
        sys.exit("Unexpected video id.")
    return m


def compress(src, dst, max_height=720, crf=28):
    """Small, fast-starting H.264/AAC. Roughly 10 to 20 MB per 10 minutes at 720p."""
    run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(src),
         "-vf", f"scale=-2:'min({max_height},ih)'",
         "-c:v", "libx264", "-preset", "veryfast", "-crf", str(crf), "-pix_fmt", "yuv420p",
         "-c:a", "aac", "-b:a", "96k", "-movflags", "+faststart", str(dst)])


def r2(*args):
    run(["npx", "--yes", "wrangler@4", "r2", "object", *args, "--remote"])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("url", nargs="?")
    ap.add_argument("--check", action="store_true")
    ap.add_argument("--upload", action="store_true")
    ap.add_argument("--remove", metavar="VIDEO_ID")
    ap.add_argument("--height", type=int, default=720)
    a = ap.parse_args()

    if a.remove:
        if not ID.match(a.remove):
            sys.exit("Not a valid video id.")
        r2("delete", f"{BUCKET}/media/{a.remove}.mp4")
        (ROOT / "content" / "credits" / f"{a.remove}.json").unlink(missing_ok=True)
        print("Removed", a.remove, "(commit the deleted credit and take it out of any lesson).")
        return
    if not a.url:
        ap.error("a video url is required")
    check_url(a.url)
    m = metadata(a.url)
    lic = m.get("license")
    print(f"{m['id']}  {m.get('title')}  by {m.get('channel')}  licence: {lic}")
    if not is_open(lic):
        sys.exit("Refused: this video is not under an open (Creative Commons) licence, so it is not copied or hosted. "
                 "Embed it or link to it instead.")
    if a.check or not a.upload:
        print("Allowed. Run again with --upload to publish it.")
        return

    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp)
        run(["yt-dlp", "--no-playlist", "-f", f"bv*[height<={a.height}]+ba/b[height<={a.height}]",
             "--merge-output-format", "mp4", "-o", str(tmp / "raw.%(ext)s"), a.url])
        raw = next(tmp.glob("raw.*"))
        out = tmp / "out.mp4"
        compress(raw, out, a.height)
        print(f"{raw.stat().st_size / 1e6:.1f} MB -> {out.stat().st_size / 1e6:.1f} MB")
        r2("put", f"{BUCKET}/media/{m['id']}.mp4", "--file", str(out), "--content-type", "video/mp4")

    credit = {"id": m["id"], "title": m.get("title"), "creator": m.get("channel"), "license": lic,
              "source": f"https://www.youtube.com/watch?v={m['id']}", "hosted_on": str(date.today()),
              "note": "Hosted under the licence above. Remove on request."}
    (ROOT / "content" / "credits" / f"{m['id']}.json").write_text(json.dumps(credit, indent=1, ensure_ascii=False), encoding="utf-8")
    print(f'Done. In the lesson set data-media="/media/{m["id"]}.mp4" and show the credit from content/credits/{m["id"]}.json')


if __name__ == "__main__":
    main()
