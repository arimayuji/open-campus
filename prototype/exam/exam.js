(() => {
  const E = window.EXAM, root = document.getElementById("exam");
  const KEY = "campus-mastery";
  const results = {};
  let i = 0, phase = "orig", chosen = null, checked = false, goVariant = false;

  const el = (tag, attrs = {}, ...kids) => {
    const n = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => { if (k === "class") n.className = v; else if (k === "html") n.innerHTML = v; else n.setAttribute(k, v); });
    kids.flat().forEach((k) => n.append(k));
    return n;
  };
  const mmss = (t) => Math.floor(t / 60) + ":" + String(t % 60).padStart(2, "0");
  const link = (ts) => el("a", { href: "https://www.youtube.com/watch?v=" + E.video + "&t=" + ts + "s", target: "_blank", rel: "noopener" }, "Rewatch this part at " + mmss(ts) + " (opens YouTube)");
  const current = () => { const q = E.questions[i]; return phase === "orig" ? q : Object.assign({ concept: q.concept, ts: q.ts }, q.variant); };

  function render() {
    root.textContent = "";
    if (i >= E.questions.length) return summary();
    const q = current(), base = E.questions[i];
    root.append(
      el("p", { class: "count" }, "Question " + (i + 1) + " of " + E.questions.length + (phase === "variant" ? ", same idea another way" : "")),
      el("h1", {}, E.title),
      el("span", { class: "tag" }, E.concepts[q.concept]),
      el("p", { class: "q-text" }, q.text)
    );
    const fs = el("fieldset", {}, el("legend", { class: "visually-hidden" }, "Answers"));
    q.options.forEach((o) => {
      const input = el("input", { type: "radio", name: "a", value: o.id });
      input.addEventListener("change", () => { chosen = o.id; btn.disabled = false; });
      fs.append(el("label", { class: "opt", "data-id": o.id }, input, el("span", {}, o.text)));
    });
    root.append(fs, el("div", { class: "feedback", id: "fb" }));
    const btn = el("button", { type: "button", class: "btn btn--primary", disabled: "" }, "Check answer");
    btn.addEventListener("click", () => { if (!checked) check(q, base, btn); else if (goVariant) { phase = "variant"; render(); } else next(); });
    root.append(el("div", { class: "actions", id: "actions" }, btn));
    chosen = null; checked = false; goVariant = false;
  }

  function mark(q, ok) {
    const c = q.concept;
    if (phase === "orig") results[c] = ok ? { state: "mastered" } : { state: "review", pending: true };
    else results[c] = { state: "review", rewatch: !ok };
  }

  function check(q, base, btn) {
    const opt = q.options.find((o) => o.id === chosen), ok = !!opt.correct;
    checked = true; mark(q, ok);
    root.querySelectorAll(".opt").forEach((l) => {
      l.classList.add("locked"); l.querySelector("input").disabled = true;
      const o = q.options.find((x) => x.id === l.dataset.id);
      if (o.correct) { l.classList.add("is-right"); l.append(el("span", { class: "flag" }, "Correct answer")); }
      else if (o.id === chosen) { l.classList.add("is-wrong"); l.append(el("span", { class: "flag" }, "Your answer")); }
    });
    const fb = document.getElementById("fb");
    fb.append(el("div", { class: "fb" }, el("h2", {}, ok ? "Correct." : "Not quite."), ok ? null : el("p", {}, opt.why), el("p", {}, q.explain)));
    if (!ok && phase === "orig") {
      fb.append(el("div", { class: "fb" }, el("h2", {}, "A closer look"), el("p", {}, base.mini), el("p", {}, link(base.ts))));
      btn.textContent = "Try it another way"; goVariant = true;
      return;
    }
    if (!ok && phase === "variant") fb.append(el("div", { class: "fb" }, el("h2", {}, "Worth another look"), el("p", {}, "We will bring this idea back later."), el("p", {}, link(base.ts))));
    btn.textContent = i === E.questions.length - 1 ? "See results" : "Next question";
  }

  function next() { i += 1; phase = "orig"; render(); }

  function summary() {
    const due = new Date(Date.now() + 2 * 86400000).toLocaleDateString("en", { month: "long", day: "numeric" });
    const list = el("ul", { class: "summary" });
    Object.keys(E.concepts).forEach((c) => {
      const r = results[c] || { state: "review" };
      const svg = el("span", { html: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle class="' + (r.state === "mastered" ? "l-m" : "l-r") + '" cx="8" cy="8" r="6"/></svg>' });
      list.append(el("li", {}, svg, el("span", {}, E.concepts[c]), el("small", {}, r.state === "mastered" ? "Mastered" : "Needs review, retest " + due)));
    });
    const n = Object.values(results).filter((r) => r.state === "mastered").length;
    root.append(el("p", { class: "count" }, "Results"), el("h1", {}, n + " of " + E.questions.length + " ideas mastered"), el("p", { class: "q-text" }, "Anything marked for review comes back as a retest, worded differently."), list,
      el("div", { class: "actions" }, el("a", { class: "btn btn--primary", href: "../lesson/index.html" }, "Back to lesson"), el("button", { type: "button", class: "btn", id: "again" }, "Start again")));
    document.getElementById("again").addEventListener("click", () => { i = 0; phase = "orig"; Object.keys(results).forEach((k) => delete results[k]); render(); });
    try { const m = JSON.parse(localStorage.getItem(KEY) || "{}"); Object.entries(results).forEach(([c, r]) => { m["mit6036-l4:" + c] = Object.assign({}, r, { due: r.state === "mastered" ? null : Date.now() + 2 * 86400000 }); }); localStorage.setItem(KEY, JSON.stringify(m)); } catch (e) { /* storage can be blocked */ }
  }
  render();
})();
