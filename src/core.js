// Pure helpers for the cloud ingest: no Cloudflare APIs here, so they run in Node tests too.
export const MIN_S = 180, MAX_S = 720; // an episode is 3 to 12 minutes
export const MAX_GAP = 600;           // skipped material between episodes: at most 10 minutes
const COVER = 0.85;                   // the cuts must reach this share of the span

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

export function prompt(from, to, text) {
  return `You cut part of a lecture transcript into short episodes for learners who may be complete beginners, including older adults.
Return ONLY a JSON object, no other text: {"episodes":[{"title":"","lead":"","plain":"","start":0,"end":0}]}
Rules:
- Each episode is ${MIN_S / 60} to ${MAX_S / 60} minutes long. Cut at real topic changes. Skip greetings, course admin and long question-and-answer sessions.
- start and end are whole seconds taken from the timestamps below. Episodes are in order and do not overlap.
- Cover the whole excerpt, from second ${from} to second ${to}, leaving no gap longer than ${MAX_GAP / 60} minutes.
- title: at most 6 words, sentence case. lead: one sentence of at most 15 words.
- plain: two or three short sentences using an everyday example and no jargon. It must stay faithful to what the lecture says and invent no facts.

Transcript, one line per passage as [seconds] text:
${text}`;
}

/** Split a lecture into windows of about `size` seconds; a short tail joins the last window. */
export function windows(duration, size = 1500) {
  const n = Math.max(1, Math.floor(duration / size));
  const step = Math.ceil(duration / n);
  return Array.from({ length: n }, (_, i) => ({ from: i * step, to: Math.min(duration, (i + 1) * step) }));
}

/** Problems with cuts for the span from..to (whole lecture by default); an empty list means they are usable. */
export function validate(eps, to, { from = 0, min = 4, max = 16 } = {}) {
  if (!Array.isArray(eps) || eps.length < min || eps.length > max) return [`need between ${min} and ${max} episodes`];
  const bad = [];
  let prev = from;
  eps.forEach((e, k) => {
    const i = k + 1;
    const s = Number(e?.start), t = Number(e?.end);
    if (!Number.isInteger(s) || !Number.isInteger(t)) { bad.push(`episode ${i}: start and end must be whole seconds`); return; }
    for (const [key, n] of [["title", 60], ["lead", 140], ["plain", 500]]) {
      if (typeof e[key] !== "string" || !e[key].trim() || e[key].length > n) bad.push(`episode ${i}: ${key} missing or longer than ${n} characters`);
    }
    if (!(s >= from && s < t && t <= to)) bad.push(`episode ${i}: times outside ${from} to ${to}`);
    else if (t - s < MIN_S || t - s > MAX_S) bad.push(`episode ${i}: length ${t - s}s, must be ${MIN_S} to ${MAX_S}`);
    if (s < prev - 5 && k > 0) bad.push(`episode ${i}: overlaps the previous one`);
    if (s - prev > MAX_GAP) bad.push(`episode ${i}: leaves a gap of ${s - prev}s, more than ${MAX_GAP}s`);
    prev = Math.max(prev, t);
  });
  if (!bad.length && prev < from + COVER * (to - from)) bad.push(`the episodes stop at ${prev}s but the excerpt runs to ${to}s: cover all of it`);
  return bad;
}

/** Last resort: equal parts, flagged for a human. */
export function uniform(to, size = 420, from = 0) {
  const span = to - from, n = Math.max(1, Math.round(span / size)), step = Math.floor(span / n);
  return Array.from({ length: n }, (_, i) => ({
    title: `Part ${i + 1}`, lead: "", plain: "", start: from + i * step, end: i === n - 1 ? to : from + (i + 1) * step,
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

// ---- Smart exam: one question per episode, kept only if the transcript backs it -------------

export const norm = (s) => String(s).toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();

export function questionPrompt(title, text) {
  return `You write one multiple-choice question for a learner who just watched a lecture episode called "${title}".
Return ONLY a JSON object, no other text:
{"question":"","options":["","","",""],"answer":0,"why_wrong":["","","",""],"concept":"","evidence":""}
Rules:
- Test understanding of one idea the episode actually explains. No trick questions, no questions about things the episode does not say.
- Exactly 4 options, plain words. "answer" is the index (0 to 3) of the single correct option.
- why_wrong has 4 entries. For each wrong option, one sentence naming the misunderstanding that makes it tempting and what is true instead. For the correct option, one sentence saying why it is right.
- concept: the name of the idea in at most 4 words.
- evidence: ONE sentence copied word for word from the transcript below that supports the correct answer.

Transcript of the episode:
${text}`;
}

/** Problems with a generated question. episodeText is the transcript of that episode. Empty list = keep it. */
export function validateQuestion(q, episodeText) {
  const bad = [];
  if (!q || typeof q.question !== "string" || q.question.trim().length < 10 || q.question.length > 300) bad.push("question missing or too long");
  if (!Array.isArray(q?.options) || q.options.length !== 4 || q.options.some((o) => typeof o !== "string" || !o.trim() || o.length > 200)) bad.push("need exactly 4 options");
  else if (new Set(q.options.map(norm)).size !== 4) bad.push("options must differ");
  if (!Number.isInteger(q?.answer) || q.answer < 0 || q.answer > 3) bad.push("answer must be 0 to 3");
  if (!Array.isArray(q?.why_wrong) || q.why_wrong.length !== 4 || q.why_wrong.some((w) => typeof w !== "string" || !w.trim() || w.length > 260)) bad.push("why_wrong needs 4 short entries");
  if (typeof q?.concept !== "string" || !q.concept.trim() || q.concept.length > 40) bad.push("concept missing");
  const ev = norm(q?.evidence ?? "");
  if (ev.split(" ").length < 4) bad.push("evidence too short");
  else if (!norm(episodeText).includes(ev)) bad.push("evidence is not a verbatim sentence of the transcript");
  return bad;
}

/** Where in the lecture the evidence is said: start of the first chunk holding its opening words. */
export function evidenceTime(evidence, chunks, fallback) {
  const head = norm(evidence).split(" ").slice(0, 6).join(" ");
  const one = chunks.find((c) => norm(c.text).includes(head));
  if (one) return one.start;
  for (let i = 0; i < chunks.length - 1; i++) {
    if (norm(chunks[i].text + " " + chunks[i + 1].text).includes(head)) return chunks[i].start; // sentence starts inside the earlier chunk
  }
  return fallback;
}

// ---- Professor: answers only from retrieved lecture passages, with checked citations -------------

const STOP = new Set("a an the and or of to in on at is are was were be been it this that these those for with as by from but not do does did how what why when which who can could would should i you we they he she my your our their its about into than then so if".split(" "));
const words = (s) => norm(s).split(" ").filter((w) => w.length > 1 && !STOP.has(w));

/** Merge captions into passages of about `span` seconds, each labelled with its start second. */
export function passages(chunks, span = 45) {
  const out = [];
  let cur = null;
  for (const c of chunks) {
    if (!cur || c.start - cur.start >= span) { cur = { start: c.start, text: "" }; out.push(cur); }
    cur.text += (cur.text ? " " : "") + c.text;
  }
  return out;
}

/** Plain BM25 over passages. Returns the top k, best first, only those that match something. */
export function bm25(docs, query, k = 4) {
  const q = [...new Set(words(query))];
  if (!q.length) return [];
  const toks = docs.map((d) => words(d.text));
  const avg = toks.reduce((a, t) => a + t.length, 0) / (docs.length || 1) || 1;
  const df = Object.fromEntries(q.map((w) => [w, toks.filter((t) => t.includes(w)).length]));
  const scored = docs.map((d, i) => {
    const tf = {}; toks[i].forEach((w) => { tf[w] = (tf[w] || 0) + 1; });
    let s = 0;
    for (const w of q) {
      if (!tf[w]) continue;
      const idf = Math.log(1 + (docs.length - df[w] + 0.5) / (df[w] + 0.5));
      s += idf * (tf[w] * 2.5) / (tf[w] + 1.5 * (0.25 + 0.75 * toks[i].length / avg));
    }
    return { ...d, score: s };
  });
  return scored.filter((d) => d.score > 0).sort((a, b) => b.score - a.score).slice(0, k);
}

export function professorPrompt(question, found) {
  return `You are the professor of an open online course. Answer the learner's question using ONLY the lecture passages below.
Rules:
- Explain in plain words, in at most 5 sentences, as to someone new to the subject.
- Every claim ends with the label of the passage it comes from, written like [123]. Use only labels that appear below.
- If the passages do not answer the question, say exactly: NOT COVERED
- Never add facts from outside the passages.

Passages:
${found.map((p) => `[${p.start}] ${p.text}`).join("\n\n")}

Question: ${question}`;
}

/** Keep only answers whose citations all point at retrieved passages. */
export function checkAnswer(answer, found) {
  const text = String(answer ?? "").trim();
  if (!text || /NOT COVERED/i.test(text)) return { ok: false, reason: "not covered" };
  const cited = [...text.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1]));
  const allowed = new Set(found.map((p) => p.start));
  if (!cited.length) return { ok: false, reason: "no citations" };
  if (cited.some((c) => !allowed.has(c))) return { ok: false, reason: "cites a passage that was not retrieved" };
  return { ok: true, citations: [...new Set(cited)] };
}
