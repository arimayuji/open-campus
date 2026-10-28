#!/usr/bin/env python3
"""Find Creative Commons videos on a topic. Run on your own machine.

  python pipeline/find_cc.py "logistic regression lecture" [--max 10]

Uses YouTube's own Creative Commons search filter, then re-checks each result with the same gate
that fetch_video.py enforces, and lists only videos that pass.
"""
import argparse, json, subprocess, sys
from urllib.parse import quote_plus
sys.path.insert(0, __file__.rsplit("/", 1)[0])
from fetch_video import is_open, metadata

CC_FILTER = "EgIwAQ%3D%3D"  # YouTube search filter: Creative Commons


def search(query, n):
    url = f"https://www.youtube.com/results?search_query={quote_plus(query)}&sp={CC_FILTER}"
    out = subprocess.run(["yt-dlp", "--flat-playlist", "--playlist-end", str(n), "--dump-json", url],
                         capture_output=True, text=True).stdout
    return [json.loads(l) for l in out.splitlines() if l.strip()]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("query")
    ap.add_argument("--max", type=int, default=10)
    a = ap.parse_args()
    found = 0
    for e in search(a.query, a.max):
        url = f"https://www.youtube.com/watch?v={e['id']}"
        try:
            m = metadata(url)
        except Exception:
            continue
        if is_open(m.get("license")):
            found += 1
            mins = round((m.get("duration") or 0) / 60)
            print(f"{m['id']}  {mins:>3} min  {m.get('channel')}  |  {m.get('title')}")
    print(f"{found} video(s) passed the licence check." if found else "No Creative Commons video passed. Try other words.")


if __name__ == "__main__":
    main()
