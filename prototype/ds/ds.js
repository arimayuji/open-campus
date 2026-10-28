/* Grove: the few behaviours the components need. No framework, no dependencies. */
(() => {
  const NS = "http://www.w3.org/2000/svg";
  const calm = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  const svg = (tag, attrs = {}) => { const n = document.createElementNS(NS, tag); Object.entries(attrs).forEach(([k, v]) => n.setAttribute(k, v)); return n; };
  const el = (tag, props = {}, ...kids) => {
    const { dataset, ...rest } = props;
    const n = Object.assign(document.createElement(tag), rest);
    if (dataset) Object.assign(n.dataset, dataset);
    kids.forEach((k) => n.append(k));
    return n;
  };

  /** A light that follows the pointer across a .tile. Sets --mx and --my; the CSS paints it. */
  const spotlight = (tile) => tile.addEventListener("pointermove", (e) => {
    const r = tile.getBoundingClientRect();
    tile.style.setProperty("--mx", e.clientX - r.left + "px");
    tile.style.setProperty("--my", e.clientY - r.top + "px");
  });

  /** Swap content with a cross-fade where the browser supports it, instantly when motion is reduced. */
  const morph = (fn, kind = "ep", extra = {}) => {
    if (!document.startViewTransition || calm()) return fn();
    const r = document.documentElement;
    r.dataset.vt = kind; Object.entries(extra).forEach(([k, v]) => r.style.setProperty(k, v));
    const t = document.startViewTransition(fn);
    t.finished.finally(() => { delete r.dataset.vt; delete r.dataset.dir; });
    return t;
  };

  /** Mark the children of a list so they arrive one after another (see .stagger in motion.css). */
  const stagger = (list) => { list.classList.add("stagger"); [...list.children].forEach((c, i) => c.style.setProperty("--i", Math.min(i, 12))); };

  /** One leaf of the branch: a bud, the vine to the next leaf, a title and a time. state: todo | done. */
  const leaf = ({ title, time, state = "todo", current = false, mastered = false, strength = 0, last = false, onClick }) => {
    const v = svg("svg", { class: "vine", viewBox: "0 0 36 64", "aria-hidden": "true" });
    if (!last) {
      const d = "M18 32C32 46 4 82 18 96";
      v.append(svg("path", { class: "base", d, "stroke-width": 2 }), svg("path", { class: "grown" + (state === "done" ? " on" : ""), d, pathLength: 1, style: "stroke-width:" + (2 + Math.min(strength, 4) * 1.1) }));
    }
    v.append(svg("circle", { class: "halo", cx: 18, cy: 32, r: 7 }), svg("circle", { class: "bud", cx: 18, cy: 32, r: 7 }));
    const b = el("button", { type: "button" }, v, el("span", { className: "t", textContent: title }), el("span", { className: "m", textContent: time }));
    if (onClick) b.addEventListener("click", onClick);
    const li = el("li", { className: "leaf", dataset: { state, mastered: String(mastered) } }, b);
    if (current) li.setAttribute("aria-current", "step");
    return li;
  };

  window.Grove = { spotlight, morph, stagger, leaf, el, svg, calm };
})();
