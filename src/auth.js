// Sign in with GitHub, sessions, and saved progress. No GitHub token is kept: we read the profile once and forget it.
import { mergeProgress, cleanProgress } from "./core.js";

const SESSION = "oc_session", STATE = "oc_state", BACK = "oc_back";
const SESSION_DAYS = 30;
const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers } });

const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
const sha = async (s) => hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)));
const token = () => hex(crypto.getRandomValues(new Uint8Array(32)));
const cookie = (name, value, { age, path = "/" } = {}) => `${name}=${value}; Path=${path}; HttpOnly; Secure; SameSite=Lax${age === undefined ? "" : `; Max-Age=${age}`}`;
const readCookies = (req) => Object.fromEntries((req.headers.get("Cookie") || "").split(/;\s*/).filter(Boolean).map((c) => { const i = c.indexOf("="); return [c.slice(0, i), c.slice(i + 1)]; }));

export async function currentUser(req, env) {
  const t = readCookies(req)[SESSION];
  if (!t || !/^[0-9a-f]{64}$/.test(t)) return null;
  return env.DB.prepare("SELECT u.id, u.login, u.name, u.avatar FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ? AND s.expires_at > ?").bind(await sha(t), Math.floor(Date.now() / 1000)).first();
}

const sameOrigin = (req, url) => req.headers.get("Origin") === url.origin;
const safeBack = (v) => (typeof v === "string" && /^\/learn\/[A-Za-z0-9?=&._#%-]*$/.test(v) ? v : "/learn/");

export async function auth(req, env, url) {
  const p = url.pathname, m = req.method;
  const configured = !!(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET);

  if (p === "/api/me" && m === "GET") {
    const user = await currentUser(req, env);
    return json({ auth: configured, user: user ? { login: user.login, name: user.name, avatar: user.avatar } : null });
  }

  if (p === "/api/auth/github" && m === "GET") {
    if (!configured) return json({ error: "Sign in is not set up yet." }, 503);
    const state = token();
    const to = new URL("https://github.com/login/oauth/authorize");
    to.search = new URLSearchParams({ client_id: env.GITHUB_CLIENT_ID, redirect_uri: url.origin + "/api/auth/callback", state, allow_signup: "true" });
    const h = new Headers({ Location: to.toString(), "Cache-Control": "no-store" });
    h.append("Set-Cookie", cookie(STATE, state, { age: 600, path: "/api/auth" }));
    h.append("Set-Cookie", cookie(BACK, encodeURIComponent(safeBack(url.searchParams.get("back"))), { age: 600, path: "/api/auth" }));
    return new Response(null, { status: 302, headers: h });
  }

  if (p === "/api/auth/callback" && m === "GET") {
    if (!configured) return json({ error: "Sign in is not set up yet." }, 503);
    const c = readCookies(req), code = url.searchParams.get("code"), state = url.searchParams.get("state");
    const clear = (h) => { h.append("Set-Cookie", cookie(STATE, "", { age: 0, path: "/api/auth" })); h.append("Set-Cookie", cookie(BACK, "", { age: 0, path: "/api/auth" })); };
    const fail = () => { const h = new Headers({ Location: "/learn/?signin=failed" }); clear(h); return new Response(null, { status: 302, headers: h }); };
    if (!code || !state || state !== c[STATE]) return fail();
    let gh;
    try {
      const t = await (await fetch("https://github.com/login/oauth/access_token", { method: "POST", headers: { Accept: "application/json", "Content-Type": "application/json" }, body: JSON.stringify({ client_id: env.GITHUB_CLIENT_ID, client_secret: env.GITHUB_CLIENT_SECRET, code, redirect_uri: url.origin + "/api/auth/callback" }) })).json();
      if (!t.access_token) return fail();
      const r = await fetch("https://api.github.com/user", { headers: { Authorization: "Bearer " + t.access_token, "User-Agent": "open-campus", Accept: "application/vnd.github+json" } });
      if (!r.ok) return fail();
      gh = await r.json();
    } catch { return fail(); }
    if (!gh.id || !gh.login) return fail();
    await env.DB.prepare("INSERT INTO users (github_id, login, name, avatar) VALUES (?, ?, ?, ?) ON CONFLICT(github_id) DO UPDATE SET login = excluded.login, name = excluded.name, avatar = excluded.avatar")
      .bind(String(gh.id), String(gh.login).slice(0, 60), String(gh.name || "").slice(0, 100), String(gh.avatar_url || "").slice(0, 300)).run();
    const u = await env.DB.prepare("SELECT id FROM users WHERE github_id = ?").bind(String(gh.id)).first();
    const now = Math.floor(Date.now() / 1000), t = token();
    await env.DB.batch([
      env.DB.prepare("DELETE FROM sessions WHERE user_id = ? AND expires_at < ?").bind(u.id, now),
      env.DB.prepare("INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)").bind(await sha(t), u.id, now + SESSION_DAYS * 86400),
    ]);
    let back = "/learn/"; try { back = safeBack(decodeURIComponent(c[BACK] || "")); } catch { /* keep the default */ }
    const h = new Headers({ Location: back, "Cache-Control": "no-store" });
    h.append("Set-Cookie", cookie(SESSION, t, { age: SESSION_DAYS * 86400 }));
    clear(h);
    return new Response(null, { status: 302, headers: h });
  }

  if (p === "/api/auth/logout" && m === "POST") {
    if (!sameOrigin(req, url)) return json({ error: "forbidden" }, 403);
    const t = readCookies(req)[SESSION];
    if (t && /^[0-9a-f]{64}$/.test(t)) await env.DB.prepare("DELETE FROM sessions WHERE id = ?").bind(await sha(t)).run();
    return json({ ok: true }, 200, { "Set-Cookie": cookie(SESSION, "", { age: 0 }) });
  }

  const pr = /^\/api\/progress\/([A-Za-z0-9._-]{3,100})$/.exec(p);
  if (pr && (m === "GET" || m === "PUT")) {
    const user = await currentUser(req, env);
    if (!user) return json({ error: "sign in first" }, 401);
    const row = await env.DB.prepare("SELECT seen, plays, quiz FROM progress WHERE user_id = ? AND lesson_id = ?").bind(user.id, pr[1]).first();
    const saved = row ? cleanProgress({ seen: JSON.parse(row.seen), plays: JSON.parse(row.plays), quiz: JSON.parse(row.quiz) }) : cleanProgress(null);
    if (m === "GET") return json(saved);
    if (!sameOrigin(req, url)) return json({ error: "forbidden" }, 403);
    if (Number(req.headers.get("Content-Length") || 0) > 20000) return json({ error: "too large" }, 413);
    const exists = await env.DB.prepare("SELECT 1 AS ok FROM lessons WHERE id = ? AND status = 'published'").bind(pr[1]).first();
    if (!exists) return json({ error: "unknown lesson" }, 404);
    let b; try { b = await req.json(); } catch { return json({ error: "send JSON" }, 400); }
    const merged = mergeProgress(saved, b);
    await env.DB.prepare("INSERT INTO progress (user_id, lesson_id, seen, plays, quiz) VALUES (?, ?, ?, ?, ?) ON CONFLICT(user_id, lesson_id) DO UPDATE SET seen = excluded.seen, plays = excluded.plays, quiz = excluded.quiz, updated_at = datetime('now')")
      .bind(user.id, pr[1], JSON.stringify(merged.seen), JSON.stringify(merged.plays), JSON.stringify(merged.quiz)).run();
    return json(merged);
  }
  return null;
}
