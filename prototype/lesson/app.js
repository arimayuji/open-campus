(() => {
  const root = document.documentElement;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));

  /* Concept records. Timestamps stay empty until a transcript is indexed. */
  const VIDEO = "abB3fwfPy14";
  const TERMS = {
    linear: { title: "Linear classifier", state: "mastered", def: "Predicts one label on one side of the line θᵀx + θ₀ = 0 and the other label on the other side. The perceptron is one.", ts: 2, rel: ["sigmoid", "logreg", "boundary"] },
    probability: { title: "Probability", state: "mastered", def: "A number between 0 and 1 for how likely something is. Logistic regression outputs one instead of a hard yes or no, so it can show where it is unsure.", ts: 321, rel: ["sigmoid", "logreg"] },
    sigmoid: { title: "Sigmoid function", state: "review", def: "Also called the logistic function: σ(z) = 1 / (1 + e^−z). It is shaped like an S and goes smoothly from close to 0 for very low z to close to 1 for very high z.", ts: 536, rel: ["probability", "logreg", "boundary"] },
    logreg: { title: "Logistic regression", state: "review", def: "A classification algorithm: the model g(x) = σ(θᵀx + θ₀) gives the probability of a label, and the weights are chosen to give high probability to what really happened.", ts: 55, rel: ["linear", "sigmoid", "loglik", "boundary"] },
    loglik: { title: "Negative log likelihood loss", state: "unseen", def: "Take the probability the model gave to what really happened, take its log (the best weights stay the same because log keeps the order), then the negative so that a lower loss is better.", ts: 2229, rel: ["logreg", "gd", "reg"] },
    boundary: { title: "Boundary", state: "unseen", def: "Where θᵀx + θ₀ = 0 the model gives exactly 1/2. That line separates the two predictions: one label on the positive side, the other on the line and below.", ts: 967, rel: ["logreg", "sigmoid"] },
    gd: { title: "Gradient descent", state: "unseen", def: "A general way to minimize a function by repeatedly stepping against its gradient. You can stop when the loss barely changes or the gradient is very small. The logistic loss is convex, which gives guarantees.", ts: 2663, rel: ["loglik", "reg"] },
    reg: { title: "Regularization", state: "unseen", def: "A penalty that discourages huge weights. Huge weights push every probability to an extreme, claiming more confidence than the data can justify.", ts: 4044, rel: ["loglik", "gd"] }
  };
  const STATE_LABEL = { mastered: "Mastered", review: "Needs review", unseen: "Not started" };
  const STATE_CLASS = { mastered: "l-m", review: "l-r", unseen: "l-u" };

  /* Mastery from the exam (same browser storage the exam writes) */
  const FROM_EXAM = { uncertainty: "probability", sigmoid: "sigmoid", boundary: "boundary", nll: "loglik", reg: "reg" };
  try {
    const m = JSON.parse(localStorage.getItem("campus-mastery") || "{}");
    Object.entries(FROM_EXAM).forEach(([c, term]) => {
      const r = m["mit6036-l4:" + c]; if (!r || !TERMS[term]) return;
      TERMS[term].state = r.state;
      const n = $('.g-node[data-term="' + term + '"]');
      if (n) { n.dataset.state = r.state; n.setAttribute("aria-label", TERMS[term].title + ", " + STATE_LABEL[r.state].toLowerCase()); }
    });
  } catch (e) { /* storage can be blocked */ }

  /* Theme */
  const modeBtn = $("#mode");
  const applyMode = (m) => {
    if (m === "dark") root.dataset.mode = "dark"; else delete root.dataset.mode;
    modeBtn.setAttribute("aria-pressed", String(m === "dark"));
    $(".mode-label", modeBtn).textContent = m === "dark" ? "Dark" : "Light";
    try { localStorage.setItem("campus-mode", m); } catch (e) { /* storage can be blocked */ }
  };
  applyMode(root.dataset.mode === "dark" ? "dark" : "light");
  modeBtn.addEventListener("click", () => applyMode(root.dataset.mode === "dark" ? "light" : "dark"));

  /* Views */
  const tabs = $$('[role="tab"]');
  const views = { lesson: $("#view-lesson"), graph: $("#view-graph") };
  const show = (name) => {
    tabs.forEach((t) => t.setAttribute("aria-selected", String(t.dataset.view === name)));
    Object.entries(views).forEach(([k, el]) => { el.hidden = k !== name; });
  };
  tabs.forEach((t) => t.addEventListener("click", () => show(t.dataset.view)));

  /* Panel */
  const panel = $("#panel");
  const empty = $("#panel-empty");
  const record = $("#record");
  let current = null;

  const sync = (id) => {
    $$(".term").forEach((b) => b.setAttribute("aria-expanded", String(b.dataset.term === id)));
    $$(".g-node").forEach((n) => n.classList.toggle("is-selected", n.dataset.term === id));
  };
  const clearPanel = () => {
    current = null; sync(null);
    record.hidden = true; empty.hidden = false;
    panel.dataset.open = "false";
  };
  const open = (id) => {
    const t = TERMS[id]; if (!t) return;
    current = id; sync(id);
    $("#r-title").textContent = t.title;
    $("#r-def").textContent = t.def;
    $("#r-status-text").textContent = STATE_LABEL[t.state];
    $("#r-status-dot").setAttribute("class", STATE_CLASS[t.state]);
    const src = $("#r-source"); src.textContent = "";
    if (t.ts) {
      const mm = Math.floor(t.ts / 60), ss = String(t.ts % 60).padStart(2, "0");
      const a = document.createElement("a");
      a.href = "https://www.youtube.com/watch?v=" + VIDEO + "&t=" + t.ts + "s"; a.target = "_blank"; a.rel = "noopener";
      a.textContent = "Lecture video at " + mm + ":" + ss;
      src.append(a, " (opens YouTube)");
    } else src.textContent = "Not covered in this lecture's transcript yet.";
    const rel = $("#r-rel"); rel.textContent = "";
    t.rel.forEach((r) => {
      const li = document.createElement("li");
      const b = document.createElement("button");
      b.type = "button"; b.textContent = TERMS[r].title; b.addEventListener("click", () => open(r));
      li.appendChild(b); rel.appendChild(li);
    });
    empty.hidden = true; record.hidden = false;
    panel.dataset.open = "true";
  };

  $$(".term").forEach((b) => b.addEventListener("click", () => (current === b.dataset.term ? clearPanel() : open(b.dataset.term))));
  $$(".g-node").forEach((n) => {
    n.addEventListener("click", () => open(n.dataset.term));
    n.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(n.dataset.term); } });
  });
  $("#panel-close").addEventListener("click", clearPanel);
  $("#see-graph").addEventListener("click", () => { const id = current; show("graph"); if (id) { sync(id); const n = $('.g-node[data-term="' + id + '"]'); if (n) n.focus({ preventScroll: false }); } });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && current) clearPanel(); });

  /* Sigmoid widget */
  const z = $("#z"), out = $("#z-out"), dot = $("#w-dot");
  const drawZ = () => {
    const v = parseFloat(z.value), p = 1 / (1 + Math.exp(-v));
    out.textContent = "z = " + v.toFixed(1) + ", p = " + p.toFixed(3);
    dot.setAttribute("cx", (16 + ((v + 6) / 12) * 288).toFixed(1));
    dot.setAttribute("cy", (124 - p * 108).toFixed(1));
  };
  z.addEventListener("input", drawZ); drawZ();

  /* Progress */
  const done = $("#complete");
  const bar = $("#bar-progress"), barText = $("#bar-text"), cur = $(".item[aria-current]");
  const total = $$(".item").length;
  const count = () => $$('.item[data-state="done"]').length;
  const paint = () => { bar.value = count(); barText.textContent = count() + " of " + total + " complete"; };
  done.addEventListener("click", () => {
    const on = done.getAttribute("aria-pressed") !== "true";
    done.setAttribute("aria-pressed", String(on));
    $(".c-label", done).textContent = on ? "Completed" : "Mark lesson complete";
    cur.dataset.state = on ? "done" : "current";
    $(".mark", cur).innerHTML = on ? $("#i-done").innerHTML : $("#i-current").innerHTML;
    paint();
  });
  paint();

  /* Video slot: embed only when an ID is set */
  const slot = $("#video-slot");
  if (slot.dataset.video && slot.dataset.embeddable !== "false") {
    const f = document.createElement("iframe");
    f.src = "https://www.youtube-nocookie.com/embed/" + encodeURIComponent(slot.dataset.video);
    f.title = "Lecture video"; f.allow = "accelerometer; encrypted-media; picture-in-picture"; f.allowFullscreen = true; f.loading = "lazy";
    slot.appendChild(f);
  }

  /* Small screens start with the outline closed */
  if (matchMedia("(max-width: 48rem)").matches) $(".outline").removeAttribute("open");
})();
