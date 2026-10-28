// Pure helpers for the cloud ingest: no Cloudflare APIs here, so they run in Node tests too.
export const MIN_S = 180, MAX_S = 720; // an episode is 3 to 12 minutes

const YT = /^[A-Za-z0-9_-]{11}$/;
const FILLER = /\b(um+|uh+|ah+|er+)\b,?\s*/gi;

/** Which source is this link? Only hosts we know how to read are accepted. */
export function parseSource(raw) {
  let u;
  try { u = new URL(raw); } catch { return null; }
  if (u.protocol !== "https:") return null;
  const h = u.hostname.toLowerCase().replace(/^www\./, "");
  if (h === "youtu.be") { const id = u.pathname.slice(1); return YT.test(id) ? { kind: "youtube", id } : null; }
  if (h === "youtube.com" || h === "m.youtube.com") {
    const id = u.searchParams.get("v");
    return id && YT.test(id) ? { kind: "youtube", id } : null;
  }
  if (h === "archive.org") {
    const m = /^\/details\/([A-Za-z0-9._-]{3,100})\/?$/.exec(u.pathname);
    return m ? { kind: "archive", id: m[1] } : null;
  }
  return null;
}

/** Hosting is allowed only for licences that let the work be shown again with credit and no changes to the file. */
export function openLicense(url) {
  if (!url) return false;
  const s = String(url).toLowerCase();
  if (/creativecommons\.org\/publicdomain\/(zero|mark)/.test(s)) return true;
  const m = /creativecommons\.org\/licenses\/([a-z-]+)\//.exec(s);
  return !!m && !m[1].includes("nd");
}

const stamp = (t) => {
  const p = t.replace(",", ".").split(":").map(Number);
  return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p[0] * 60 + p[1];
};

/** WebVTT or SRT text -> [{start, text}] in whole seconds. Tags and duplicate rolling lines are removed. */
export function parseCaptions(text) {
  const out = [];
  let last = "";
  for (const block of text.replace(/\r/g, "").split(/\n\n+/)) {
    const lines = block.split("\n");
    const i = lines.findIndex((l) => l.includes("-->"));
    if (i < 0) continue;
    const start = stamp(lines[i].split("-->")[0].trim().split(" ")[0]);
    const body = lines.slice(i + 1).join(" ").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    if (!body || body === last || !Number.isFinite(start)) continue;
    last = body;
    out.push({ start: Math.floor(start), text: body });
  }
  return out;
}

/** Merge short captions into roughly 30 second lines for the model. */
export function condense(chunks, span = 30, cap = 220) {
  const lines = [];
  let cur = null;
  for (const c of chunks) {
    if (!cur || c.start - cur.start >= span) { cur = { start: c.start, text: "" }; lines.push(cur); }
    cur.text += " " + c.text.replace(FILLER, "");
  }
  return lines.map((l) => `[${l.start}] ${l.text.trim().slice(0, cap)}`).join("\n");
}

export function prompt(duration, text) {
  return `You cut a lecture transcript into short episodes for learners who may be complete beginners, including older adults.
Return ONLY a JSON object, no other text: {"episodes":[{"title":"","lead":"","plain":"","start":0,"end":0}]}
Rules:
- Each episode is ${MIN_S / 60} to ${MAX_S / 60} minutes long. Cut at real topic changes. Skip greetings, course admin and long question-and-answer sessions.
- start and end are whole seconds taken from the timestamps below. Episodes are in order and do not overlap.
- title: at most 6 words, sentence case. lead: one sentence of at most 15 words.
- plain: two or three short sentences using an everyday example and no jargon. It must stay faithful to what the lecture says and invent no facts.
- Return between 4 and 16 episodes. The lecture is ${duration} seconds long.

Transcript, one line per passage as [seconds] text:
${text}`;
}

/** Problems with a set of cuts; an empty list means they are usable. */
export function validate(eps, duration) {
  if (!Array.isArray(eps) || eps.length < 4 || eps.length > 16) return ["need between 4 and 16 episodes"];
  const bad = [];
  let prev = 0;
  eps.forEach((e, k) => {
    const i = k + 1;
    const s = Number(e?.start), t = Number(e?.end);
    if (!Number.isInteger(s) || !Number.isInteger(t)) { bad.push(`episode ${i}: start and end must be whole seconds`); return; }
    for (const [key, n] of [["title", 60], ["lead", 140], ["plain", 500]]) {
      if (typeof e[key] !== "string" || !e[key].trim() || e[key].length > n) bad.push(`episode ${i}: ${key} missing or longer than ${n} characters`);
    }
    if (!(s >= 0 && s < t && t <= duration)) bad.push(`episode ${i}: times outside the video`);
    else if (t - s < MIN_S || t - s > MAX_S) bad.push(`episode ${i}: length ${t - s}s, must be ${MIN_S} to ${MAX_S}`);
    if (s < prev - 5) bad.push(`episode ${i}: overlaps the previous one`);
    prev = t;
  });
  return bad;
}

/** Last resort: equal parts, flagged for a human. */
export function uniform(duration, size = 420) {
  const n = Math.max(1, Math.round(duration / size)), step = Math.floor(duration / n);
  return Array.from({ length: n }, (_, i) => ({
    title: `Part ${i + 1}`, lead: "", plain: "", start: i * step, end: i === n - 1 ? duration : (i + 1) * step,
  }));
}

/** Pull {"episodes":[...]} out of whatever the model said. */
export function readEpisodes(out) {
  const obj = typeof out === "object" && out ? out : null;
  if (obj?.episodes) return obj.episodes;
  const s = String(out ?? "");
  const a = s.indexOf("{"), b = s.lastIndexOf("}");
  if (a < 0 || b < a) throw new Error("no JSON in the answer");
  return JSON.parse(s.slice(a, b + 1)).episodes;
}
