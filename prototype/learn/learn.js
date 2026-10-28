(() => {
  const root = document.documentElement;
  const $ = (s, c = document) => c.querySelector(s);
  const el = (tag, props = {}, ...kids) => {
    const { dataset, ...rest } = props;
    const n = Object.assign(document.createElement(tag), rest);
    if (dataset) Object.assign(n.dataset, dataset);
    kids.forEach((k) => n.append(k));
    return n;
  };
  const fmt = (s) => Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
  const get = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const set = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* storage can be blocked */ } };

  /* Theme */
  const modeBtn = $("#mode");
  const applyMode = (m) => {
    if (m === "dark") root.dataset.mode = "dark"; else delete root.dataset.mode;
    modeBtn.setAttribute("aria-pressed", String(m === "dark"));
    $(".mode-label", modeBtn).textContent = m === "dark" ? "Dark" : "Light";
    set("campus-mode", m);
  };
  applyMode(root.dataset.mode === "dark" ? "dark" : "light");
  modeBtn.addEventListener("click", () => applyMode(root.dataset.mode === "dark" ? "light" : "dark"));

  const say = (text) => { const n = $("#notice"); n.textContent = text; n.hidden = !text; };
  const api = async (path) => {
    const admin = get("campus-admin"); // lets the curator preview drafts; never shown to visitors
    const r = await fetch(path, admin ? { headers: { Authorization: "Bearer " + admin } } : undefined);
    if (!r.ok) throw new Error(String(r.status));
    return r.json();
  };

  const id = new URLSearchParams(location.search).get("id");
  if (!id) return catalog();
  api("/api/lessons/" + encodeURIComponent(id)).then(lesson, () => { $("#o-title").textContent = "Not found"; say("This lesson does not exist, or it has not been published yet."); });

  async function catalog() {
    $(".outline").hidden = true;
    $(".app").style.gridTemplateColumns = "minmax(0, 1fr)";
    $("#catalog").hidden = false;
    try {
      const list = await api("/api/lessons");
      const ul = $("#cards");
      if (!list.length) ul.append(el("li", { textContent: "No lessons are published yet." }));
      list.forEach((l) => ul.append(el("li", {}, el("a", { href: "?id=" + encodeURIComponent(l.id) }, el("strong", { textContent: l.title }), el("span", { textContent: l.episodes.length + " episodes" + (l.creator ? " from " + l.creator : "") })))));
    } catch (e) { say("Could not load the lessons."); }
  }

  function lesson(L) {
    document.title = L.title + " in Open Campus";
    $("#o-title").textContent = L.title;
    $("#lesson").hidden = false;
    if (L.status !== "published") say("Draft. Only you can see this until it is published.");
    else if (L.needs_review) say("These episodes were cut automatically and are waiting for a human check.");

    const credit = $("#credit");
    credit.append("Clips from “" + L.title + "”" + (L.creator ? " by " + L.creator : "") + ". ");
    const src = el("a", { href: L.source_url, target: "_blank", rel: "noopener", textContent: "Original source" });
    credit.append(src);
    if (L.license) credit.append(" – licence: ", /^https:\/\/creativecommons\.org\//.test(L.license) ? el("a", { href: L.license, target: "_blank", rel: "noopener", textContent: L.license.replace(/^https:\/\/creativecommons\.org\/(licenses|publicdomain)\//, "CC ").replace(/\/$/, "") }) : L.license);

    const key = "campus-ep:" + L.id;
    let seen = new Set(JSON.parse(get(key) || "[]"));
    const list = $("#o-list"), eps = $("#episodes");
    const paint = () => {
      $("#bar-progress").max = L.episodes.length; $("#bar-progress").value = seen.size;
      $("#bar-text").textContent = seen.size + " of " + L.episodes.length + " watched";
      L.episodes.forEach((e, i) => {
        const a = $("#item-" + i); if (a) a.dataset.state = seen.has(i) ? "done" : "todo";
        const b = $("#seen-" + i); if (b) { b.setAttribute("aria-pressed", String(seen.has(i))); b.textContent = seen.has(i) ? "Watched" : "Mark as watched"; }
      });
    };

    const slot = $("#video-slot");
    const play = (i) => {
      const e = L.episodes[i];
      slot.textContent = "";
      if (L.media) {
        const v = el("video", { controls: true, preload: "metadata", src: L.media + "#t=" + e.start });
        v.addEventListener("loadedmetadata", () => { v.currentTime = e.start; v.play().catch(() => {}); });
        v.addEventListener("timeupdate", () => { if (v.currentTime >= e.end) { v.pause(); v.currentTime = e.end; } });
        slot.append(v);
      } else if (L.kind === "youtube" && L.embeddable) {
        slot.append(el("iframe", { src: "https://www.youtube-nocookie.com/embed/" + encodeURIComponent(L.id) + "?start=" + e.start + "&end=" + e.end + "&autoplay=1&rel=0", title: e.title, allow: "encrypted-media; picture-in-picture; autoplay", allowFullscreen: true }));
      } else {
        const href = L.kind === "youtube" ? "https://www.youtube.com/watch?v=" + encodeURIComponent(L.id) + "&t=" + e.start + "s" : L.source_url;
        slot.append(el("div", { className: "slot-note" }, el("p", { textContent: "The owner keeps this video on its own site." }), el("a", { className: "btn", href, target: "_blank", rel: "noopener", textContent: "Watch at " + fmt(e.start) })));
      }
      slot.scrollIntoView({ block: "nearest", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    };

    L.episodes.forEach((e, i) => {
      list.append(el("li", {}, el("a", { className: "item", id: "item-" + i, href: "#ep-" + (i + 1), dataset: { state: "todo" } }, el("span", { textContent: e.title }), el("span", { className: "when", textContent: fmt(e.start) }))));
      const art = el("article", { className: "episode", id: "ep-" + (i + 1) });
      art.append(el("header", {}, el("h1", { textContent: e.title }), el("p", { className: "lead", textContent: e.lead }), el("p", { className: "when", textContent: fmt(e.start) + " to " + fmt(e.end) + ", " + Math.max(1, Math.round((e.end - e.start) / 60)) + " min" })));
      if (e.plain) art.append(el("aside", { className: "callout" }, el("div", {}, el("h3", { textContent: "In plain words" }), el("p", { textContent: e.plain }))));
      const seenBtn = el("button", { type: "button", className: "btn", id: "seen-" + i, textContent: "Mark as watched" });
      seenBtn.addEventListener("click", () => { seen.has(i) ? seen.delete(i) : seen.add(i); set(key, JSON.stringify([...seen])); paint(); });
      const playBtn = el("button", { type: "button", className: "btn btn--primary", textContent: "Play this episode" });
      playBtn.addEventListener("click", () => play(i));
      art.append(el("div", { className: "ep-actions" }, playBtn, seenBtn));
      eps.append(art);
    });
    paint();
    if (matchMedia("(max-width: 48rem)").matches) $(".outline").removeAttribute("open");
  }
})();
