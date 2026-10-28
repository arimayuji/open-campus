(() => {
  const root = document.documentElement;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));

  /* Concept records. Timestamps stay empty until a transcript is indexed. */
  const TERMS = {
    linear: { title: "Linear regression", state: "mastered", def: "Predicts a number as a weighted sum of the inputs plus a bias: z = w·x + b.", ts: null, rel: ["sigmoid", "logreg"] },
    probability: { title: "Probability basics", state: "mastered", def: "A number between 0 and 1 that says how likely an outcome is. Probabilities of all outcomes add up to 1.", ts: null, rel: ["sigmoid"] },
    sigmoid: { title: "Sigmoid function", state: "review", def: "A smooth S-shaped function, σ(z) = 1 / (1 + e^−z), that maps any real number to a value between 0 and 1.", ts: null, rel: ["probability", "logreg", "boundary"] },
    logreg: { title: "Logistic regression", state: "review", def: "A classifier that passes a linear score through the sigmoid and reads the result as the probability of the positive class.", ts: null, rel: ["linear", "sigmoid", "logloss", "boundary"] },
    logloss: { title: "Log loss", state: "unseen", def: "Also called binary cross-entropy. It punishes a confident wrong prediction far more than an unsure one: L = −[y·log p + (1−y)·log(1−p)].", ts: null, rel: ["logreg", "gd", "reg"] },
    boundary: { title: "Decision boundary", state: "unseen", def: "The set of inputs where the model is exactly undecided, p = 0.5. For logistic regression that is where w·x + b = 0, a straight line or plane.", ts: null, rel: ["logreg", "sigmoid"] },
    gd: { title: "Gradient descent", state: "unseen", def: "An iterative method that moves the weights a small step against the gradient of the loss, repeating until the loss stops falling.", ts: null, rel: ["logloss"] },
    reg: { title: "Regularization", state: "unseen", def: "A penalty on large weights added to the loss, which reduces overfitting.", ts: null, rel: ["logloss"] }
  };
  const STATE_LABEL = { mastered: "Mastered", review: "Needs review", unseen: "Not started" };
  const STATE_CLASS = { mastered: "l-m", review: "l-r", unseen: "l-u" };

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
    $("#r-source").textContent = t.ts ? "Lecture video at " + t.ts + "." : "Lecture video. The timestamp appears once the transcript is indexed.";
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
  if (slot.dataset.video) {
    const f = document.createElement("iframe");
    f.src = "https://www.youtube-nocookie.com/embed/" + encodeURIComponent(slot.dataset.video);
    f.title = "Lecture video"; f.allow = "accelerometer; encrypted-media; picture-in-picture"; f.allowFullscreen = true; f.loading = "lazy";
    slot.appendChild(f);
  }

  /* Small screens start with the outline closed */
  if (matchMedia("(max-width: 48rem)").matches) $(".outline").removeAttribute("open");
})();
