(() => {
  const $ = (s) => document.querySelector(s);
  let doc = null, index = null;
  const STOP = new Set("a an and are as at be but by for from has have how i if in into is it its of on or so that the their then there these they this to was we what when where which who why will with you your do does did can about over under not no yes um uh like just gonna kind sort really".split(" "));
  const FILLER = /\b(um+|uh+|ah+|er+)\b,?\s*/gi;
  const tok = (t) => t.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w && !STOP.has(w)).map(stem);
  const stem = (w) => w.replace(/(ing|ed|es|s)$/, (m, x, off) => (off >= 3 ? "" : m));
  const clean = (t) => t.replace(FILLER, "").replace(/\s{2,}/g, " ").trim();
  const mmss = (t) => Math.floor(t / 60) + ":" + String(t % 60).padStart(2, "0");

  function build(chunks) {
    const docs = chunks.map((c) => tok(c.text)), df = new Map();
    docs.forEach((d) => new Set(d).forEach((w) => df.set(w, (df.get(w) || 0) + 1)));
    const avg = docs.reduce((s, d) => s + d.length, 0) / docs.length;
    return { docs, df, avg, n: docs.length };
  }
  function search(q, k = 3) {
    const qs = tok(q); if (!qs.length) return [];
    const { docs, df, avg, n } = index, k1 = 1.4, b = 0.75;
    const scored = docs.map((d, i) => {
      const tf = new Map(); d.forEach((w) => tf.set(w, (tf.get(w) || 0) + 1));
      let s = 0;
      qs.forEach((w) => { const f = tf.get(w); if (!f) return; const idf = Math.log(1 + (n - df.get(w) + 0.5) / (df.get(w) + 0.5)); s += idf * (f * (k1 + 1)) / (f + k1 * (1 - b + b * d.length / avg)); });
      return { i, s };
    }).filter((x) => x.s > 0).sort((a, b) => b.s - a.s);
    const picked = [];
    for (const x of scored) { // skip neighbours that overlap a better passage already chosen
      const t = doc.chunks[x.i].start;
      if (picked.every((p) => Math.abs(doc.chunks[p.i].start - t) > 90)) picked.push(x);
      if (picked.length === k) break;
    }
    return picked;
  }
  const esc = (s) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
  function mark(text, terms) {
    let out = esc(text);
    new Set(terms).forEach((t) => { if (t.length > 2) out = out.replace(new RegExp("\\b(" + t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\w*)", "gi"), "<mark>$1</mark>"); });
    return out;
  }

  $("#file").addEventListener("change", async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try {
      doc = JSON.parse(await f.text());
      if (!Array.isArray(doc.chunks) || !doc.chunks.length) throw new Error("no chunks");
      index = build(doc.chunks);
      $("#q").disabled = false; $("#go").disabled = false; $("#q").focus();
      $("#status").textContent = "Loaded: " + (doc.source.title || "transcript") + ", " + doc.chunks.length + " passages. Ask a question.";
    } catch (err) { $("#status").textContent = "That file does not look like a transcript made by the ingestion script."; }
  });

  $("#ask").addEventListener("submit", (e) => {
    e.preventDefault();
    const q = $("#q").value.trim(), out = $("#out"); out.textContent = "";
    if (!q || !index) return;
    const hits = search(q), terms = q.toLowerCase().split(/\W+/).filter((w) => w.length > 2 && !STOP.has(w));
    if (!hits.length) { $("#status").textContent = "No passage in this lecture matches. Try different words, or this topic may not be covered here."; return; }
    $("#status").textContent = hits.length + " passages from the lecture, best match first.";
    hits.forEach((h) => {
      const c = doc.chunks[h.i], li = document.createElement("li"); li.className = "passage";
      const p = document.createElement("p"); p.innerHTML = mark(clean(c.text), terms);
      const foot = document.createElement("footer"), a = document.createElement("a");
      a.href = doc.source.url + "&t=" + c.start + "s"; a.target = "_blank"; a.rel = "noopener";
      a.textContent = "Lecture video at " + mmss(c.start) + " (opens YouTube)";
      foot.append(a); li.append(p, foot); out.append(li);
    });
  });
})();
