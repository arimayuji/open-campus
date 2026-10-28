(() => {
  const { el, leaf, spotlight, morph } = window.Grove;
  const $ = (s) => document.querySelector(s);
  $("#mark").append($("#logo").content.cloneNode(true));

  const root = document.documentElement, modeBtn = $("#mode");
  const applyMode = (m) => {
    if (m === "dark") root.dataset.mode = "dark"; else delete root.dataset.mode;
    modeBtn.setAttribute("aria-pressed", String(m === "dark")); $(".mode-label", modeBtn).textContent = m === "dark" ? "Dark" : "Light";
    try { localStorage.setItem("campus-mode", m); } catch (e) { /* storage can be blocked */ }
    swatches();
  };
  modeBtn.addEventListener("click", () => applyMode(root.dataset.mode === "dark" ? "light" : "dark"));

  /* Colour: read every swatch from the live token */
  const NAMES = [["paper", "Page"], ["paper-2", "Raised"], ["paper-3", "Pressed"], ["ink", "Ink"], ["ink-2", "Ink, soft"], ["muted", "Muted"], ["rule", "Rule"], ["accent", "Coral"], ["accent-ink", "Coral for text"], ["deep", "Rail"], ["deep-2", "Rail, raised"], ["stage", "Theatre"]];
  function swatches() {
    const box = $("#swatches"); box.textContent = "";
    const cs = getComputedStyle(root);
    NAMES.forEach(([k, label]) => {
      const v = cs.getPropertyValue("--color-" + k).trim();
      const s = el("div", { className: "sw" }, el("i"), el("b", { textContent: label }), el("code", { textContent: "--color-" + k }), el("code", { textContent: v }));
      s.firstChild.style.setProperty("--c", "var(--color-" + k + ")");
      box.append(s);
    });
  }
  applyMode(root.dataset.mode === "dark" ? "dark" : "light");

  /* Motion: the branch */
  const T = ["Introduction", "Linear Separability", "Sigmoid Function", "Loss"];
  let done = 0, plays = 0;
  const demo = $("#demo-branch");
  const paintBranch = () => {
    demo.textContent = "";
    T.forEach((t, i) => demo.append(leaf({ title: t, time: (i * 3 + 2) + ":10", state: i < done ? "done" : "todo", current: i === done, strength: i < done ? plays : 0, last: i === T.length - 1 })));
  };
  paintBranch();
  $("#grow").addEventListener("click", () => { done = Math.min(done + 1, T.length - 1); paintBranch(); requestAnimationFrame(() => demo.querySelectorAll(".grown.on").forEach((g) => { g.style.strokeDashoffset = ""; })); });
  $("#thicken").addEventListener("click", () => { plays = Math.min(plays + 1, 4); paintBranch(); });
  $("#reset").addEventListener("click", () => { done = 0; plays = 0; paintBranch(); });

  /* Leaf states */
  const st = $("#leaf-states");
  [["Waiting", "todo", false, false], ["Current", "todo", true, false], ["Watched", "done", false, false], ["Answered right", "done", false, true]].forEach(([t, s, c, m], i) => st.append(leaf({ title: t, time: "", state: s, current: c, mastered: m, strength: s === "done" ? 2 : 0, last: i === 3 })));

  document.querySelectorAll(".tile").forEach(spotlight);
  const titles = [["Sigmoid Function", "Understanding the sigmoid curve"], ["Logistic Regression Loss", "How wrong the model is"], ["Gradient Descent", "Small steps downhill"]];
  let k = 0;
  $("#morph-btn").addEventListener("click", () => { k = (k + 1) % titles.length; morph(() => { $("#morph-title").textContent = titles[k][0]; $("#morph-text").textContent = titles[k][1]; }); });

  /* Rail follows the section in view */
  const links = [...document.querySelectorAll(".docs-rail nav a")];
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) links.forEach((a) => a.setAttribute("aria-current", String(a.getAttribute("href") === "#" + e.target.id))); }), { rootMargin: "-20% 0px -70% 0px" });
  document.querySelectorAll("section.doc").forEach((s) => io.observe(s));
})();
