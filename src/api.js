// JSON API. Reads are public (published lessons only); writes need the admin token.
import { parseSource } from "./core.js";

const json = (body, status = 200, extra = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...extra } });

async function isAdmin(req, env) {
  const got = (req.headers.get("Authorization") || "").replace(/^Bearer /, "");
  if (!got || !env.ADMIN_TOKEN) return false;
  const enc = new TextEncoder();
  const [a, b] = await Promise.all([crypto.subtle.digest("SHA-256", enc.encode(got)), crypto.subtle.digest("SHA-256", enc.encode(env.ADMIN_TOKEN))]);
  return crypto.subtle.timingSafeEqual(a, b);
}

const present = (r) => ({ ...r, episodes: JSON.parse(r.episodes), hosted: !!r.hosted, embeddable: !!r.embeddable, needs_review: !!r.needs_review });
const MAX_BODY = 3_000_000; // a long lecture transcript is well under this
const LEVELS = new Set(["", "intro", "intermediate", "advanced"]);

export async function api(req, env, url) {
  const p = url.pathname, m = req.method;
  const admin = await isAdmin(req, env);

  if (p === "/api/submit" && m === "POST") {
    if (!admin) return json({ error: "unauthorized" }, 401);
    if (Number(req.headers.get("Content-Length") || 0) > MAX_BODY) return json({ error: "too large" }, 413);
    let b; try { b = await req.json(); } catch { return json({ error: "send JSON" }, 400); }
    const src = parseSource(b.url);
    if (!src) return json({ error: "Use a YouTube link or an archive.org /details/ link." }, 400);
    const level = b.level || "";
    if (!LEVELS.has(level)) return json({ error: "level must be intro, intermediate or advanced" }, 400);
    if (b.transcript != null && (typeof b.transcript !== "string" || b.transcript.length > MAX_BODY)) return json({ error: "bad transcript" }, 400);
    const jobId = crypto.randomUUID();
    await env.DB.prepare("INSERT INTO jobs (id, url, state, step) VALUES (?, ?, 'queued', 'queued')").bind(jobId, b.url).run();
    await env.INGEST.create({ id: jobId, params: { jobId, url: b.url, topic: String(b.topic || "").slice(0, 80), level, transcript: b.transcript || null } });
    return json({ job: jobId, status: `/api/jobs/${jobId}` }, 202);
  }

  const job = /^\/api\/jobs\/([0-9a-f-]{36})$/.exec(p);
  if (job && m === "GET") {
    const r = await env.DB.prepare("SELECT id, state, step, error, lesson_id, updated_at FROM jobs WHERE id = ?").bind(job[1]).first();
    return r ? json(r) : json({ error: "not found" }, 404);
  }

  if (p === "/api/lessons" && m === "GET") {
    const q = admin ? "SELECT * FROM lessons ORDER BY created_at DESC LIMIT 100" : "SELECT * FROM lessons WHERE status = 'published' ORDER BY published_at DESC LIMIT 100";
    const { results } = await env.DB.prepare(q).all();
    return json(results.map(present));
  }

  const les = /^\/api\/lessons\/([A-Za-z0-9._-]{3,100})(\/publish)?$/.exec(p);
  if (les && m === "GET" && !les[2]) {
    const r = await env.DB.prepare("SELECT * FROM lessons WHERE id = ?").bind(les[1]).first();
    if (!r || (r.status !== "published" && !admin)) return json({ error: "not found" }, 404);
    return json(present(r));
  }
  if (les && les[2] && m === "POST") {
    if (!admin) return json({ error: "unauthorized" }, 401);
    const r = await env.DB.prepare("UPDATE lessons SET status = 'published', published_at = datetime('now') WHERE id = ?").bind(les[1]).run();
    return r.meta.changes ? json({ published: les[1] }) : json({ error: "not found" }, 404);
  }
  return json({ error: "not found" }, 404);
}
