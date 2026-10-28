// Serves the static site and streams hosted videos from a private R2 bucket.
// Only GET and HEAD, only /media/<11-char id>.mp4, byte ranges supported for seeking.
const KEY = /^\/media\/([A-Za-z0-9_-]{11})\.mp4$/;

const SECURITY = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "X-Frame-Options": "SAMEORIGIN",
};

function withSecurity(res) {
  const out = new Response(res.body, res);
  for (const [k, v] of Object.entries(SECURITY)) out.headers.set(k, v);
  return out;
}

// "bytes=a-b", "bytes=a-" or "bytes=-n" against a known size. Returns null when not satisfiable.
function parseRange(header, size) {
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m || (m[1] === "" && m[2] === "")) return null;
  let start, end;
  if (m[1] === "") { const n = Number(m[2]); if (n === 0) return null; start = Math.max(0, size - n); end = size - 1; }
  else { start = Number(m[1]); end = m[2] === "" ? size - 1 : Math.min(Number(m[2]), size - 1); }
  if (!(start <= end) || start >= size) return null;
  return { start, end };
}

async function media(req, env, url) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    return new Response("Method not allowed", { status: 405, headers: { Allow: "GET, HEAD" } });
  }
  const m = KEY.exec(url.pathname);
  if (!m) return new Response("Not found", { status: 404 });
  const key = `media/${m[1]}.mp4`;

  const head = await env.MEDIA.head(key);
  if (!head) return new Response("Not found", { status: 404 });

  const h = new Headers({
    "Content-Type": "video/mp4",
    "Accept-Ranges": "bytes",
    "Cache-Control": "public, max-age=86400",
    ETag: head.httpEtag,
  });

  const wanted = req.headers.get("Range");
  let status = 200, start = 0, end = head.size - 1, opts;
  if (wanted) {
    const r = parseRange(wanted, head.size);
    if (!r) return new Response("Range not satisfiable", { status: 416, headers: { "Content-Range": `bytes */${head.size}` } });
    ({ start, end } = r);
    status = 206;
    opts = { range: { offset: start, length: end - start + 1 } };
    h.set("Content-Range", `bytes ${start}-${end}/${head.size}`);
  }
  h.set("Content-Length", String(end - start + 1));
  if (req.method === "HEAD") return new Response(null, { status, headers: h });
  const obj = await env.MEDIA.get(key, opts);
  if (!obj) return new Response("Not found", { status: 404 });
  return new Response(obj.body, { status, headers: h });
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname.startsWith("/media/")) return withSecurity(await media(req, env, url));
    return withSecurity(await env.ASSETS.fetch(req));
  },
};
