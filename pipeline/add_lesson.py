#!/usr/bin/env python3
"""One command from a video link to a lesson draft. Run on your own machine.

  python pipeline/add_lesson.py <youtube url> --topic "machine learning" --level intro [--upload]

Steps, all automatic:
  1. read the licence; Creative Commons videos can be hosted, all others are embedded or linked
  2. get the transcript (captions, or Whisper with --whisper)
  3. if hosted and --upload: download, compress and upload to R2 with the credit
  4. cut the lecture into short episodes with Claude (your subscription, `claude -p`), then validate every cut
  5. write content/lessons/<id>.json

Needs: yt-dlp, ffmpeg (for hosting), and the `claude` CLI. The episodes are a draft: a human reads them before publishing.
"""
import argparse, json, re, subprocess, sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import fetch_video as fv  # noqa: E402

ROOT = HERE.parent
MIN_S, MAX_S = 180, 720  # an episode is 3 to 12 minutes
FILLER = re.compile(r"\b(um+|uh+|ah+|er+)\b,?\s*", re.I)

PROMPT = """You cut a lecture transcript into short episodes for learners who may be complete beginners, including older adults.
Return ONLY a JSON object, no other text: {{"episodes":[{{"title":"","lead":"","plain":"","start":0,"end":0}}]}}
Rules:
- Each episode is {lo} to {hi} minutes long. Cut at real topic changes. Skip greetings, course admin and long question-and-answer sessions.
- start and end are whole seconds taken from the timestamps below. Episodes are in order and do not overlap.
- title: at most 6 words, sentence case. lead: one sentence of at most 15 words.
- plain: two or three short sentences using an everyday example and no jargon. It must stay faithful to what the lecture says and invent no facts.
- Return between 4 and 16 episodes. The lecture is {dur} seconds long.

Transcript, one line per passage as [seconds] text:
{text}
"""


def condense(chunks):
    return "\n".join(f"[{c['start']}] {FILLER.sub('', c['text']).strip()}" for c in chunks)


def validate(eps, duration):
    """Return a list of problems; empty means the cuts are usable."""
    bad = []
    if not isinstance(eps, list) or not 4 <= len(eps) <= 16:
        return ["need between 4 and 16 episodes"]
    prev_end = 0
    for i, e in enumerate(eps, 1):
        try:
            s, t = int(e["start"]), int(e["end"])
            for k, n in (("title", 60), ("lead", 140), ("plain", 500)):
                if not isinstance(e[k], str) or not e[k].strip() or len(e[k]) > n:
                    bad.append(f"episode {i}: {k} missing or longer than {n} characters")
        except (KeyError, TypeError, ValueError):
            bad.append(f"episode {i}: missing fields"); continue
        if not 0 <= s < t <= duration:
            bad.append(f"episode {i}: times outside the video")
        elif not MIN_S <= t - s <= MAX_S:
            bad.append(f"episode {i}: length {t - s}s, must be {MIN_S} to {MAX_S}")
        if s < prev_end - 5:
            bad.append(f"episode {i}: overlaps the previous one")
        prev_end = t
    return bad


def ask_claude(prompt, model):
    r = subprocess.run(["claude", "-p", "--model", model, "--tools", ""], input=prompt, text=True, capture_output=True, timeout=600)
    if r.returncode != 0:
        raise RuntimeError((r.stderr or "claude failed").strip()[-300:])
    out = r.stdout
    a, b = out.find("{"), out.rfind("}")
    return json.loads(out[a:b + 1])["episodes"]


def uniform(duration, size=420):
    n = max(1, round(duration / size))
    step = duration // n
    return [{"title": f"Part {i + 1}", "lead": "", "plain": "", "start": i * step, "end": duration if i == n - 1 else (i + 1) * step}
            for i in range(n)]


def propose(chunks, duration, model):
    prompt = PROMPT.format(lo=MIN_S // 60, hi=MAX_S // 60, dur=duration, text=condense(chunks))
    problems = []
    for attempt in range(2):
        p = prompt if not problems else prompt + "\nYour previous answer had these problems, fix them:\n- " + "\n- ".join(problems)
        try:
            eps = ask_claude(p, model)
        except Exception as e:  # noqa: BLE001
            problems = [f"could not read your answer as JSON ({e})"]; continue
        problems = validate(eps, duration)
        if not problems:
            return eps, False
    print("Could not get valid cuts from Claude; falling back to equal parts. Problems:", *problems, sep="\n- ", file=sys.stderr)
    return uniform(duration), True


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("url")
    ap.add_argument("--topic", default="")
    ap.add_argument("--level", default="")
    ap.add_argument("--upload", action="store_true", help="host the video if its licence allows it")
    ap.add_argument("--whisper", action="store_true")
    ap.add_argument("--model", default="haiku", help="claude model alias for the episode cuts")
    ap.add_argument("--from-json", help="reuse an existing transcript JSON instead of downloading")
    a = ap.parse_args()

    fv.check_url(a.url)
    m = fv.metadata(a.url)
    hosted = fv.is_open(m.get("license"))
    print(f"{m['id']}  {m.get('title')}  licence: {m.get('license')}  ->  {'can be hosted' if hosted else 'embed only'}")

    if a.from_json:
        doc = json.loads(Path(a.from_json).read_text(encoding="utf-8"))
    else:
        out = ROOT / "data" / m["id"]
        cmd = [sys.executable, str(HERE / "ingest.py"), a.url, "--out", str(out), "--topic", a.topic, "--level", a.level]
        if a.whisper:
            cmd.append("--whisper")
        subprocess.run(cmd, check=True)
        doc = json.loads((out / f"{m['id']}.json").read_text(encoding="utf-8"))
    if not doc.get("chunks"):
        sys.exit("No transcript found. Run again with --whisper.")

    if hosted and a.upload:
        fv.publish(a.url, m)

    eps, review = propose(doc["chunks"], int(m.get("duration") or doc["chunks"][-1]["end"]), a.model)
    lesson = {
        "video": {"id": m["id"], "title": m.get("title"), "channel": m.get("channel"), "license": m.get("license"),
                  "url": f"https://www.youtube.com/watch?v={m['id']}", "duration": m.get("duration"),
                  "hosted": bool(hosted and a.upload), "media": f"/media/{m['id']}.mp4" if hosted and a.upload else None,
                  "embeddable": m.get("playable_in_embed")},
        "topic": a.topic, "level": a.level, "episodes": eps,
        "status": "draft: a human must read the episodes before this is published",
        "needs_review": review,
    }
    dest = ROOT / "content" / "lessons"
    dest.mkdir(parents=True, exist_ok=True)
    (dest / f"{m['id']}.json").write_text(json.dumps(lesson, indent=1, ensure_ascii=False), encoding="utf-8")
    for i, e in enumerate(eps, 1):
        print(f"{i:>2}. {e['start'] // 60:>3}:{e['start'] % 60:02d}  {round((e['end'] - e['start']) / 60):>2} min  {e['title']}")
    print(f"Saved content/lessons/{m['id']}.json")


if __name__ == "__main__":
    main()
