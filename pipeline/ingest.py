#!/usr/bin/env python3
"""Local ingestion for one YouTube playlist. Run on your own machine (YouTube blocks cloud IPs).

  pip install yt-dlp
  python pipeline/ingest.py "<playlist url>" --out data/cs229 [--whisper]

Per video it writes data/<out>/<video_id>.json with metadata and time-based chunks
following the RAG schema: source, type, level, topic, date, locator.
Only metadata and transcript chunks are produced; no video is downloaded unless --whisper
needs audio for a video that has no captions. `data/` is git-ignored: never commit media or transcripts.
"""
import argparse, json, re, subprocess, sys
from pathlib import Path

CHUNK_SECONDS = 60
OVERLAP_SECONDS = 10


def run(cmd):
    return subprocess.run(cmd, check=True, capture_output=True, text=True).stdout


def list_playlist(url):
    out = run(["yt-dlp", "--flat-playlist", "--dump-json", url])
    return [json.loads(l) for l in out.splitlines() if l.strip()]


def ts_to_s(ts):
    h, m, s = ts.replace(",", ".").split(":")
    return int(h) * 3600 + int(m) * 60 + float(s)


def parse_vtt(text):
    """Return [(start_s, end_s, text)], dropping the rolling duplicates of auto captions."""
    cues, last = [], ""
    for block in re.split(r"\n\s*\n", text):
        lines = [l for l in block.strip().splitlines() if l.strip()]
        for i, l in enumerate(lines):
            if "-->" in l:
                a, b = [x.strip().split(" ")[0] for x in l.split("-->")]
                body = " ".join(re.sub(r"<[^>]+>", "", x).strip() for x in lines[i + 1:])
                body = re.sub(r"\s+", " ", body).strip()
                if body and body != last:
                    cues.append((ts_to_s(a), ts_to_s(b), body))
                    last = body
                break
    return cues


def chunk(cues, size=CHUNK_SECONDS, overlap=OVERLAP_SECONDS):
    chunks, i = [], 0
    while i < len(cues):
        start = cues[i][0]
        j, parts = i, []
        while j < len(cues) and cues[j][0] < start + size:
            parts.append(cues[j][2]); j += 1
        chunks.append({"start": int(start), "end": int(cues[j - 1][1]), "text": " ".join(parts)})
        nxt = next((k for k in range(i + 1, j + 1) if k >= len(cues) or cues[k][0] >= start + size - overlap), j)
        i = max(nxt, i + 1)
    return chunks


def fetch_captions(video_id, tmp, lang="en"):
    url = f"https://www.youtube.com/watch?v={video_id}"
    subprocess.run(["yt-dlp", "--skip-download", "--write-subs", "--write-auto-subs", "--sub-langs", lang,
                    "--sub-format", "vtt", "-o", str(tmp / "%(id)s.%(ext)s"), url],
                   check=False, capture_output=True, text=True)
    found = sorted(tmp.glob(f"{video_id}*.vtt"))
    return found[0].read_text(encoding="utf-8") if found else None


def whisper_cues(video_id, tmp):
    import whisper  # pip install openai-whisper
    audio = tmp / f"{video_id}.m4a"
    run(["yt-dlp", "-f", "bestaudio[ext=m4a]/bestaudio", "-o", str(audio), f"https://www.youtube.com/watch?v={video_id}"])
    result = whisper.load_model("base").transcribe(str(audio))
    return [(s["start"], s["end"], s["text"].strip()) for s in result["segments"]]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("playlist")
    ap.add_argument("--out", default="data/playlist")
    ap.add_argument("--topic", default="")
    ap.add_argument("--level", default="")
    ap.add_argument("--whisper", action="store_true", help="transcribe locally when a video has no captions")
    ap.add_argument("--limit", type=int, default=0, help="only the first N videos, for a trial run")
    a = ap.parse_args()

    out = Path(a.out); tmp = out / "_tmp"
    out.mkdir(parents=True, exist_ok=True); tmp.mkdir(exist_ok=True)
    entries = list_playlist(a.playlist)
    if a.limit:
        entries = entries[: a.limit]
    for n, e in enumerate(entries, 1):
        vid = e["id"]
        meta = json.loads(run(["yt-dlp", "--skip-download", "--dump-json", f"https://www.youtube.com/watch?v={vid}"]))
        vtt = fetch_captions(vid, tmp)
        cues = parse_vtt(vtt) if vtt else (whisper_cues(vid, tmp) if a.whisper else [])
        record = {
            "source": {"video_id": vid, "url": f"https://www.youtube.com/watch?v={vid}", "title": meta.get("title"),
                       "channel": meta.get("channel"), "license": meta.get("license"), "playlist": a.playlist},
            "type": "video", "level": a.level, "topic": a.topic, "date": meta.get("upload_date"),
            "chunks": [dict(c, locator=f"t={c['start']}") for c in chunk(cues)],
            "has_transcript": bool(cues),
        }
        (out / f"{vid}.json").write_text(json.dumps(record, ensure_ascii=False, indent=1), encoding="utf-8")
        print(f"[{n}/{len(entries)}] {vid} {meta.get('title')}: {len(record['chunks'])} chunks", file=sys.stderr)


if __name__ == "__main__":
    main()
