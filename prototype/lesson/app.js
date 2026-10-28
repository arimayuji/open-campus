(() => {
  const root = document.documentElement;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));

  /* Concept records. Timestamps stay empty until a transcript is indexed. */
  const VIDEO = "het9HFqo1TQ";
  const TERMS = {
    linear: { title: "Linear regression", state: "mastered", def: "Predicts a number as a weighted sum of the inputs. Used on yes-or-no data, one extra example can move the fitted line and the threshold with it.", ts: 3, rel: ["sigmoid", "logreg", "boundary"] },
    probability: { title: "Probability basics", state: "mastered", def: "A number between 0 and 1 that says how likely an outcome is. Probabilities of all outcomes add up to 1.", ts: null, rel: ["sigmoid"] },
    sigmoid: { title: "Sigmoid function", state: "review", def: "Also called the logistic function: g(z) = 1 / (1 + e^−z). It crosses 0.5 at z = 0 and keeps every output between 0 and 1.", ts: 2846, rel: ["probability", "logreg", "boundary"] },
    logreg: { title: "Logistic regression", state: "review", def: "A classifier for yes-or-no labels. It passes a linear score through the logistic function and reads the result as the probability that the label is 1.", ts: 2740, rel: ["linear", "sigmoid", "loglik", "boundary"] },
    loglik: { title: "Log-likelihood", state: "unseen", def: "The log of how probable the training labels are under the model. Logistic regression picks the weights that maximize it.", ts: 3372, rel: ["logreg", "gd", "reg"] },
    boundary: { title: "Decision boundary", state: "unseen", def: "The point where the prediction flips from 0 to 1. With a threshold of 0.5, everything on one side is predicted 0 and everything on the other is predicted 1.", ts: 2687, rel: ["logreg", "sigmoid"] },
    gd: { title: "Gradient ascent", state: "unseen", def: "Like gradient descent but climbing: it steps the weights up the log-likelihood, which is why the update has a plus sign. The log-likelihood of logistic regression has a single peak.", ts: 3586, rel: ["loglik"] },
    reg: { title: "Regularization", state: "unseen", def: "A penalty on large weights added to the objective, which reduces overfitting. Not covered in this lecture.", ts: null, rel: ["loglik"] }
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
  if (slot.dataset.video) {
    const f = document.createElement("iframe");
    f.src = "https://www.youtube-nocookie.com/embed/" + encodeURIComponent(slot.dataset.video);
    f.title = "Lecture video"; f.allow = "accelerometer; encrypted-media; picture-in-picture"; f.allowFullscreen = true; f.loading = "lazy";
    slot.appendChild(f);
  }

  /* Small screens start with the outline closed */
  if (matchMedia("(max-width: 48rem)").matches) $(".outline").removeAttribute("open");
})();
