// The interface on top of the 3D view: where you are, the list of places, the map, the
// language switch and a short help panel. Nothing is recorded: the memories live in your head.
import { tr, other, t, getLang, setLang } from "./i18n.js";
import { icon } from "./icons.js";
import { MapView } from "./map.js";

const $ = (id) => document.getElementById(id);

function el(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
    else if (k === "html") e.innerHTML = v;
    else e.setAttribute(k, v === true ? "" : v);
  }
  for (const kid of kids.flat()) if (kid !== null && kid !== undefined && kid !== false) e.append(kid);
  return e;
}

export class UI {
  constructor(world, hooks) {
    this.world = world;
    this.h = hooks;
    this.map = new MapView($("map-canvas"), world, {
      goPoint: (x, z) => { this.closeOverlays(); this.h.goPoint(x, z); },
      goRoom: (room) => { this.closeOverlays(); this.h.goRoom(room); },
      goLocus: (id) => { this.closeOverlays(); this.h.goLocus(id); },
      player: () => this.h.player(),
    });
    this.bind();
    this.applyStatic();
  }

  applyStatic() {
    for (const node of document.querySelectorAll("[data-t]")) node.textContent = t(node.dataset.t);
    for (const node of document.querySelectorAll("[data-t-ph]")) node.placeholder = t(node.dataset.tPh);
    for (const node of document.querySelectorAll("[data-t-label]")) {
      node.setAttribute("aria-label", t(node.dataset.tLabel));
      node.title = t(node.dataset.tLabel);
    }
    $("btn-lang").querySelector(".tool-label").textContent = t("language");
    $("btn-lang").setAttribute("aria-label", t("languageLabel"));
    document.title = t("title");
  }

  bind() {
    for (const [id, name] of [["btn-places", "list"], ["btn-map", "map"], ["btn-lang", "globe"], ["btn-help", "help"]]) {
      $(id).insertAdjacentHTML("afterbegin", icon(name));
    }
    for (const id of ["places-close", "map-close"]) $(id).innerHTML = icon("close");
    $("btn-places").addEventListener("click", () => this.togglePlaces());
    $("btn-map").addEventListener("click", () => this.toggleMap());
    $("btn-lang").addEventListener("click", () => setLang(getLang() === "en" ? "zh" : "en"));
    $("btn-help").addEventListener("click", () => this.showHelp());
    $("where").addEventListener("click", () => this.togglePlaces(true));
    $("places-close").addEventListener("click", () => this.togglePlaces(false));
    $("map-close").addEventListener("click", () => this.toggleMap(false));
    $("help-close").addEventListener("click", () => this.hideHelp());
    $("search").addEventListener("input", () => this.renderPlaces());
    addEventListener("keydown", (e) => {
      if (e.target.tagName === "INPUT") {
        if (e.key === "Escape") e.target.blur();
        return;
      }
      if (e.key === "Escape") {
        if (!$("help").hidden) this.hideHelp();
        else this.closeOverlays();
      } else if (e.key === "m" || e.key === "M") this.toggleMap();
      else if (e.key === "p" || e.key === "P" || e.key === "/") { e.preventDefault(); this.togglePlaces(true); $("search").focus(); }
    });
  }

  onLang() {
    this.applyStatic();
    if (!$("places").hidden) this.renderPlaces();
    if (!$("map").hidden) this.map.draw();
    this.h.relocate();
  }

  anyOverlay() {
    return !$("places").hidden || !$("map").hidden || !$("help").hidden;
  }

  closeOverlays() {
    const open = !$("places").hidden || !$("map").hidden;
    $("places").hidden = true;
    $("map").hidden = true;
    for (const id of ["btn-places", "btn-map"]) $(id).setAttribute("aria-pressed", "false");
    return open;
  }

  setWhere(title, sub, color) {
    $("where-sys").textContent = title;
    $("where-room").textContent = sub;
    $("where").style.setProperty("--c", color || "var(--accent)");
  }

  /** The locus in view: its number on the route and its name. */
  caption(l) {
    const n = $("caption");
    if (!l) {
      n.classList.add("out");
      clearTimeout(this._cap);
      this._cap = setTimeout(() => { n.hidden = true; }, 350);
      return;
    }
    clearTimeout(this._cap);
    n.innerHTML = `<span class="cap-n">${l.n}</span><span class="cap-text"><span class="cap-name">${tr(l.name)}</span>` +
      `<span class="cap-other">${other(l.name)}</span></span>`;
    n.hidden = false;
    n.classList.remove("out");
  }

  toast(html, ms = 2400) {
    const n = $("toast");
    n.innerHTML = html;
    n.hidden = false;
    n.classList.remove("out");
    clearTimeout(this._toast);
    this._toast = setTimeout(() => {
      n.classList.add("out");
      setTimeout(() => { n.hidden = true; }, 500);
    }, ms);
  }

  hint(text, ms = 5000) {
    const n = $("hint");
    n.textContent = text;
    n.hidden = false;
    n.classList.remove("fade-out");
    clearTimeout(this._hint);
    this._hint = setTimeout(() => n.classList.add("fade-out"), ms);
  }

  // ── places ─────────────────────────────────────────────────────────────────
  togglePlaces(force) {
    const d = $("places");
    const show = force ?? d.hidden;
    this.closeOverlays();
    d.hidden = !show;
    $("btn-places").setAttribute("aria-pressed", String(show));
    if (show) this.renderPlaces();
  }

  renderPlaces() {
    const q = $("search").value.trim().toLowerCase();
    const body = $("places-body");
    const here = this.h.here();
    const match = (x) => !q || x.title.en.toLowerCase().includes(q) || x.title.zh.includes(q);
    const lmatch = (id) => { const l = this.world.loci[id]; return !q || l.name.en.toLowerCase().includes(q) || l.name.zh.includes(q); };
    const nodes = [];
    for (const b of this.world.buildings) {
      const rooms = b.wings.flatMap((w) => w.rooms.map((r) => ({ w, r })));
      const hits = rooms.filter(({ w, r }) => match(r) || match(w) || match(b) || r.loci.some(lmatch));
      if (!hits.length) continue;
      const open = !!q || this.openB?.has(b.id) || here.building === b.id;
      const det = el("details", { class: "sys", style: `--c:${b.color}`, open: open || undefined });
      det.addEventListener("toggle", () => {
        this.openB = this.openB || new Set();
        if (det.open) this.openB.add(b.id); else this.openB.delete(b.id);
      });
      det.append(el("summary", { class: "sys-head" },
        el("span", { class: "sys-mark" }),
        el("span", { class: "sys-text" },
          el("span", { class: "sys-title" }, tr(b.title)),
          el("span", { class: "sys-sub" }, tr(b.subtitle))),
        el("span", { class: "sys-meta" }, t("lociCount", { n: rooms.reduce((a, x) => a + x.r.loci.length, 0) }))));
      const inner = el("div", { class: "sys-body" },
        el("button", { type: "button", class: "btn btn-small", onclick: () => this.h.goBuilding(b) },
          el("span", { html: icon("walk") }), t("toEntrance")));
      for (const w of b.wings) {
        const rs = w.rooms.filter((r) => hits.some((h) => h.r === r));
        if (!rs.length) continue;
        inner.append(el("p", { class: "wing-title" }, tr(w.title)));
        for (const r of rs) {
          inner.append(el("button", { type: "button", class: "row" + (here.room === r.id ? " here" : ""),
            onclick: () => { this.closeOverlays(); this.h.goRoom(r); } },
            el("span", { class: "row-main" }, tr(r.title), el("span", { class: "row-where" }, other(r.title))),
            el("span", { class: "row-count" }, t("lociCount", { n: r.loci.length }))));
          const list = el("ol", { class: "loci-list" });
          for (const id of r.loci) {
            const l = this.world.loci[id];
            if (q && !lmatch(id) && !match(r) && !match(w)) continue;
            list.append(el("li", {}, el("button", { type: "button", class: "locus-row",
              onclick: () => { this.closeOverlays(); this.h.goLocus(id); } },
              el("span", { class: "locus-n" }, String(l.n)), el("span", { class: "locus-name" }, tr(l.name)))));
          }
          inner.append(list);
        }
      }
      det.append(inner);
      nodes.push(det);
    }
    body.replaceChildren(...(nodes.length ? nodes : [el("p", { class: "empty" }, t("noResults", { q }))]));
  }

  // ── map ────────────────────────────────────────────────────────────────────
  toggleMap(force) {
    const m = $("map");
    const show = force ?? m.hidden;
    this.closeOverlays();
    m.hidden = !show;
    $("btn-map").setAttribute("aria-pressed", String(show));
    if (show) this.map.open();
  }

  // ── help ───────────────────────────────────────────────────────────────────
  showHelp() {
    this.closeOverlays();
    $("help").hidden = false;
  }

  hideHelp() {
    $("help").hidden = true;
    try { localStorage.setItem("palace.welcomed", "1"); } catch { /* storage unavailable */ }
  }

  shouldWelcome() {
    try { return !localStorage.getItem("palace.welcomed"); } catch { return true; }
  }
}
