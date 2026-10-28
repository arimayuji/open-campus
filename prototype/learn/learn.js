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
  const NS = "http://www.w3.org/2000/svg";
  const svg = (tag, attrs = {}) => { const n = document.createElementNS(NS, tag); Object.entries(attrs).forEach(([k, v]) => n.setAttribute(k, v)); return n; };
  const fmt = (s) => Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
  const get = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const set = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* storage can be blocked */ } };
  const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const morph = (fn) => (document.startViewTransition && !calm ? document.startViewTransition(fn) : fn());

  $("#brand-mark").append($("#logo").content.cloneNode(true));
  $("#kbd").textContent = /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘ K" : "Ctrl K";

  /* Theme */
  const modeBtn = $("#mode");
  const applyMode = (m) => {
    if (m === "dark") root.dataset.mode = "dark"; else delete root.dataset.mode;
    modeBtn.setAttribute("aria-pressed", String(m === "dark"));
    $(".mode-label", modeBtn).textContent = m === "dark" ? "Dark" : "Light";
    set("campus-mode", m);
  };
  const toggleMode = () => applyMode(root.dataset.mode === "dark" ? "light" : "dark");
  applyMode(root.dataset.mode === "dark" ? "dark" : "light");
  modeBtn.addEventListener("click", toggleMode);

  const say = (text) => { const n = $("#notice"); n.textContent = text; n.hidden = !text; };
  const api = async (path) => {
    const admin = get("campus-admin"); // lets the curator preview drafts; never shown to visitors
    const r = await fetch(path, admin ? { headers: { Authorization: "Bearer " + admin } } : undefined);
    if (!r.ok) throw new Error(String(r.status));
    return r.json();
  };

  /* A light that follows the pointer across a tile */
  const spotlight = (tile) => tile.addEventListener("pointermove", (e) => {
    const r = tile.getBoundingClientRect();
    tile.style.setProperty("--mx", e.clientX - r.left + "px");
    tile.style.setProperty("--my", e.clientY - r.top + "px");
  });

  /* Palette: actions the current screen offers, plus every episode */
  let actions = [];
  const dlg = $("#palette"), q = $("#q"), results = $("#results");
  let shown = [], sel = 0;
  const renderResults = () => {
    const term = q.value.trim().toLowerCase();
    shown = actions.filter((a) => !term || a.label.toLowerCase().includes(term) || (a.hint || "").toLowerCase().includes(term));
    sel = Math.min(sel, Math.max(0, shown.length - 1));
    results.textContent = "";
    if (!shown.length) results.append(el("li", { textContent: "Nothing matches." }));
    shown.forEach((a, i) => {
      const li = el("li", { role: "option", id: "r-" + i }, el("span", { textContent: a.label }), el("small", { textContent: a.hint || "" }));
      li.setAttribute("aria-selected", String(i === sel));
      li.addEventListener("click", () => run(a));
      results.append(li);
    });
    q.setAttribute("aria-activedescendant", shown.length ? "r-" + sel : "");
  };
  const run = (a) => { dlg.close(); a.run(); };
  const openPalette = () => { if (!actions.length) return; q.value = ""; sel = 0; renderResults(); dlg.showModal(); q.focus(); };
  $("#open-palette").addEventListener("click", openPalette);
  q.addEventListener("input", () => { sel = 0; renderResults(); });
  q.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); sel = (sel + (e.key === "ArrowDown" ? 1 : -1) + shown.length) % Math.max(1, shown.length); renderResults(); $("#r-" + sel)?.scrollIntoView({ block: "nearest" }); }
    else if (e.key === "Enter") { e.preventDefault(); if (shown[sel]) run(shown[sel]); }
  });
  dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });
  document.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); dlg.open ? dlg.close() : openPalette(); }
  });

  const id = new URLSearchParams(location.search).get("id");
  if (!id) return catalog();
  api("/api/lessons/" + encodeURIComponent(id)).then(lesson, () => {
    $("#rail-body").hidden = false; $("#o-title").textContent = "Not found";
    say("This lesson does not exist, or it has not been published yet.");
  });

  async function catalog() {
    $("#rail-body").hidden = true; $("#rail-home").hidden = false;
    $("#catalog").hidden = false;
    actions = [{ label: "Switch light and dark", hint: "theme", run: toggleMode }];
    try {
      const list = await api("/api/lessons");
      const ul = $("#cards");
      list.forEach((l, i) => {
        const a = el("a", { className: "tile" + (i === 0 ? " tile--hero" : ""), href: "?id=" + encodeURIComponent(l.id) },
          el("span", {}, el("span", { className: "n", textContent: l.episodes.length + " episodes" }), el("strong", { textContent: l.title }), el("span", { className: "d", textContent: l.creator ? "from " + l.creator : "" })));
        if (i === 0) a.append(archArt());
        spotlight(a);
        ul.append(el("li", {}, a));
        actions.push({ label: l.title, hint: "open", run: () => { location.href = "?id=" + encodeURIComponent(l.id); } });
      });
      const ask = el("a", { className: "tile", href: "https://github.com/arimayuji/open-campus/issues/new", target: "_blank", rel: "noopener" }, el("span", {}, el("strong", { textContent: "Suggest a lecture" }), el("span", { className: "d", textContent: "Open or Creative Commons material only. A person reads every suggestion." })));
      spotlight(ask); ul.append(el("li", {}, ask));
      if (!list.length) say("No lessons are published yet.");
    } catch (e) { say("Could not load the lessons."); }
  }

  function archArt() {
    const s = svg("svg", { class: "arch-art", viewBox: "0 0 96 96", "aria-hidden": "true" });
    s.append(svg("path", { d: "M18 96V46C18 24 34 12 50 12C68 12 80 26 80 44", fill: "none", stroke: "currentColor", "stroke-width": 6, "stroke-linecap": "round" }),
      svg("path", { d: "M50 96C50 66 44 58 36 52C30 47 30 40 36 36C42 32 52 36 52 44C52 52 62 54 70 62", fill: "none", stroke: "currentColor", "stroke-width": 2.5, "stroke-linecap": "round" }),
      svg("circle", { cx: 80, cy: 60, r: 6, class: "node", stroke: "currentColor", "stroke-width": 2 }));
    return s;
  }

  function lesson(L) {
    document.title = L.title + " in Open Campus";
    $("#rail-body").hidden = false; $("#lesson").hidden = false;
    $("#o-title").textContent = L.title;
    if (L.status !== "published") say("Draft. Only you can see this until it is published.");
    else if (L.needs_review) say("These episodes were cut automatically and are waiting for a human check.");

    const credit = $("#credit");
    credit.append("“" + L.title + "”" + (L.creator ? " by " + L.creator : "") + ". ", el("a", { href: L.source_url, target: "_blank", rel: "noopener", textContent: "Original source" }));
    if (L.license) credit.append(", licence ", /^https:\/\/creativecommons\.org\//.test(L.license) ? el("a", { href: L.license, target: "_blank", rel: "noopener", textContent: L.license.replace(/^https:\/\/creativecommons\.org\/(licenses|publicdomain)\//, "CC ").replace(/\/$/, "") }) : L.license);

    const E = L.episodes, N = E.length;
    const kSeen = "campus-ep:" + L.id, kPlays = "campus-plays:" + L.id;
    const seen = new Set(JSON.parse(get(kSeen) || "[]"));
    const plays = JSON.parse(get(kPlays) || "{}");
    let cur = 0;

    /* Rail: one leaf per episode, each with its piece of the branch */
    const branch = $("#branch"), bento = $("#bento");
    const leaves = E.map((e, i) => {
      const v = svg("svg", { class: "vine", viewBox: "0 0 36 64", "aria-hidden": "true" });
      if (i < N - 1) {
        const d = "M18 32C32 46 4 82 18 96";
        v.append(svg("path", { class: "base", d, "stroke-width": 2 }), svg("path", { class: "grown", d, pathLength: 1 }));
      }
      v.append(svg("circle", { class: "halo", cx: 18, cy: 32, r: 7 }), svg("circle", { class: "bud", cx: 18, cy: 32, r: 7 }));
      const b = el("button", { type: "button" }, v, el("span", { className: "t", textContent: e.title }), el("span", { className: "m", textContent: fmt(e.start) }));
      b.addEventListener("click", () => go(i));
      const li = el("li", { className: "leaf" }, b);
      branch.append(li);
      return li;
    });
    const tiles = E.map((e, i) => {
      const meter = el("div", { className: "meter" }, el("i"));
      const t = el("button", { type: "button", className: "tile" }, el("span", {}, el("span", { className: "n", textContent: "Episode " + (i + 1) + ", " + Math.max(1, Math.round((e.end - e.start) / 60)) + " min" }), el("strong", { textContent: e.title }), el("span", { className: "d", textContent: e.lead })), meter);
      t.addEventListener("click", () => { go(i); $("#stage").scrollIntoView({ behavior: calm ? "auto" : "smooth" }); });
      spotlight(t);
      bento.append(el("li", {}, t));
      return t;
    });

    const paint = () => {
      E.forEach((_, i) => {
        const done = seen.has(i), strength = Math.min(plays[i] || 0, 4);
        leaves[i].dataset.state = done ? "done" : "todo";
        leaves[i].dataset.mastered = String(quiz[i] === "right");
        tiles[i].dataset.state = done ? "done" : "todo";
        tiles[i].style.setProperty("--w", done ? 1 : Math.min(strength / 4, 0.75));
        const g = $(".grown", leaves[i]);
        if (g) { g.classList.toggle("on", done); g.style.strokeWidth = 2 + strength * 1.1; }
        leaves[i].toggleAttribute("aria-current", false);
        tiles[i].toggleAttribute("aria-current", false);
        if (i === cur) { leaves[i].setAttribute("aria-current", "step"); tiles[i].setAttribute("aria-current", "step"); }
      });
      $("#bar-text").textContent = seen.size + " of " + N + " watched";
      const sb = $("#seen"); sb.setAttribute("aria-pressed", String(seen.has(cur))); sb.textContent = seen.has(cur) ? "Watched" : "Mark as watched";
      $("#next").hidden = cur >= N - 1;
    };

    const arch = $("#arch"), poster = $("#poster");
    const showPoster = () => {
      const e = E[cur];
      arch.querySelectorAll("video, iframe").forEach((n) => n.remove());
      poster.hidden = false;
      arch.style.backgroundImage = L.kind === "youtube" ? "url(https://i.ytimg.com/vi/" + encodeURIComponent(L.id) + "/hqdefault.jpg)" : "";
      const direct = !L.media && !(L.kind === "youtube" && L.embeddable);
      $("#play").hidden = direct;
      poster.querySelectorAll(".btn").forEach((n) => n.remove());
      if (direct) poster.append(el("a", { className: "btn", target: "_blank", rel: "noopener", textContent: "Watch at " + fmt(e.start), href: L.kind === "youtube" ? "https://www.youtube.com/watch?v=" + encodeURIComponent(L.id) + "&t=" + e.start + "s" : L.source_url }));
      $("#poster-hint").textContent = direct ? "The owner keeps this video on its own site." : "Plays " + fmt(e.start) + " to " + fmt(e.end);
    };

    const play = (from) => {
      const e = E[cur];
      const a = Number.isFinite(from) ? from : e.start;
      const z = Number.isFinite(from) ? from + 120 : e.end;
      poster.hidden = true;
      arch.querySelectorAll("video, iframe").forEach((n) => n.remove());
      if (L.media) {
        const v = el("video", { controls: true, preload: "metadata", src: L.media + "#t=" + a });
        v.addEventListener("loadedmetadata", () => { v.currentTime = a; v.play().catch(() => {}); });
        v.addEventListener("timeupdate", () => { if (v.currentTime >= z) { v.pause(); v.currentTime = z; } });
        arch.append(v);
      } else {
        arch.append(el("iframe", { src: "https://www.youtube-nocookie.com/embed/" + encodeURIComponent(L.id) + "?start=" + a + "&end=" + z + "&autoplay=1&rel=0", title: e.title, allow: "encrypted-media; picture-in-picture; autoplay", allowFullscreen: true }));
      }
      plays[cur] = (plays[cur] || 0) + 1; set(kPlays, JSON.stringify(plays)); paint();
    };
    $("#play").addEventListener("click", () => play());

    /* Check yourself: one grounded question per episode */
    const Q = new Map((L.questions || []).map((q) => [q.episode, q]));
    const kQuiz = "campus-quiz:" + L.id;
    const quiz = JSON.parse(get(kQuiz) || "{}");
    const renderQuiz = () => {
      const q = Q.get(cur), box = $("#quiz");
      box.hidden = !q;
      if (!q) return;
      $("#q-text").textContent = q.question;
      const opts = $("#q-options"), fb = $("#q-feedback");
      opts.textContent = ""; fb.textContent = "";
      const lock = () => opts.querySelectorAll("button").forEach((b) => { b.disabled = true; });
      q.options.forEach((o, i) => {
        const b = el("button", { type: "button", className: "q-opt" }, el("i", { textContent: "ABCD"[i] }), el("span", { textContent: o }));
        b.addEventListener("click", () => {
          lock();
          const ok = i === q.answer;
          b.dataset.result = ok ? "right" : "wrong";
          if (!ok) opts.children[q.answer].dataset.result = "right";
          quiz[cur] = ok ? "right" : (quiz[cur] === "right" ? "right" : "wrong"); set(kQuiz, JSON.stringify(quiz));
          fb.textContent = "";
          fb.append(el("p", {}, el("strong", { textContent: ok ? "Right. " : "Not quite. " }), q.why[i]));
          if (!ok) {
            fb.append(el("p", { textContent: "The right answer: " + q.why[q.answer] }));
            const again = el("button", { type: "button", className: "btn", textContent: "Hear it at " + fmt(q.ts) });
            again.addEventListener("click", () => { play(q.ts); $("#arch").scrollIntoView({ block: "center", behavior: calm ? "auto" : "smooth" }); });
            const retry = el("button", { type: "button", className: "btn", textContent: "Try again" });
            retry.addEventListener("click", renderQuiz);
            fb.append(el("span", { className: "ep-actions" }, again, retry));
          } else { seen.add(cur); set(kSeen, JSON.stringify([...seen])); }
          paint();
        });
        opts.append(b);
      });
    };

    const render = () => {
      const e = E[cur];
      $("#e-when").textContent = "Episode " + (cur + 1) + " of " + N + ", " + fmt(e.start) + " to " + fmt(e.end);
      $("#e-title").textContent = e.title;
      $("#e-lead").textContent = e.lead;
      $("#e-plain").textContent = e.plain || "";
      $("#e-plain-wrap").hidden = !e.plain;
      showPoster(); renderQuiz(); paint();
    };
    function go(i) {
      cur = Math.max(0, Math.min(N - 1, i));
      history.replaceState(null, "", "#ep-" + (cur + 1));
      morph(render);
    }

    $("#seen").addEventListener("click", () => { seen.has(cur) ? seen.delete(cur) : seen.add(cur); set(kSeen, JSON.stringify([...seen])); paint(); });
    $("#next").addEventListener("click", () => go(cur + 1));
    document.addEventListener("keydown", (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey || dlg.open || /INPUT|TEXTAREA/.test(document.activeElement?.tagName)) return;
      if (e.key === "j") go(cur + 1); else if (e.key === "k") go(cur - 1);
    });

    actions = [
      ...E.map((e, i) => ({ label: e.title, hint: "episode " + (i + 1) + ", " + fmt(e.start), run: () => go(i) })),
      { label: "Play this episode", hint: "enter", run: () => play() },
      { label: "Mark this episode as watched", hint: "progress", run: () => $("#seen").click() },
      { label: "Open the original source", hint: "new tab", run: () => window.open(L.source_url, "_blank", "noopener") },
      { label: "Switch light and dark", hint: "theme", run: toggleMode },
      { label: "All lectures", hint: "catalogue", run: () => { location.href = "./"; } },
    ];

    const prof = $("#prof"), pa = $("#prof-answer"), pf = $("#prof-form"), pq = $("#prof-q");
    $("#open-prof").hidden = false;
    const openProf = () => { prof.showModal(); pq.focus(); };
    $("#open-prof").addEventListener("click", openProf);
    $("#prof-close").addEventListener("click", () => prof.close());
    prof.addEventListener("click", (e) => { if (e.target === prof) prof.close(); });
    const playAt = (t) => { const k = E.findIndex((e) => t >= e.start && t < e.end); if (k >= 0 && k !== cur) { cur = k; history.replaceState(null, "", "#ep-" + (cur + 1)); render(); } prof.close(); play(t); $("#arch").scrollIntoView({ block: "center", behavior: calm ? "auto" : "smooth" }); };
    pf.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const text = pq.value.trim(); if (text.length < 4) return;
      $("#prof-send").disabled = true; pa.textContent = "Looking through the lecture";
      try {
        const r = await fetch("/api/ask", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lesson: L.id, question: text }) });
        const j = await r.json();
        pa.textContent = "";
        if (!r.ok) { pa.append(el("p", { textContent: j.error || "Something went wrong." })); return; }
        const body = el("p", { className: "a" });
        // turn [123] labels into buttons that play the lecture at that second
        j.answer.split(/(\[\d+\])/).forEach((part) => {
          const m = /^\[(\d+)\]$/.exec(part);
          if (m && j.grounded) { const b = el("button", { type: "button", className: "cite", textContent: fmt(Number(m[1])) }); b.addEventListener("click", () => playAt(Number(m[1]))); body.append(b); }
          else body.append(part);
        });
        pa.append(body);
        if (!j.grounded && j.passages?.length) j.passages.slice(0, 2).forEach((p) => { const b = el("button", { type: "button", className: "cite", textContent: "Play from " + fmt(p.start) }); b.addEventListener("click", () => playAt(p.start)); pa.append(el("blockquote", { textContent: p.text.slice(0, 220) }), b); });
      } catch (e) { pa.textContent = "Could not reach the professor. Try again."; }
      finally { $("#prof-send").disabled = false; }
    });
    actions.push({ label: "Ask the professor", hint: "question", run: openProf });

    const start = /^#ep-(\d+)$/.exec(location.hash);
    cur = start ? Math.max(0, Math.min(N - 1, Number(start[1]) - 1)) : Math.max(0, E.findIndex((_, i) => !seen.has(i)));
    render();
  }
})();
