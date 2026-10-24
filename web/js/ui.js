// Everything on top of the 3D view: location, exhibit card, directory, map,
// route bar (tour and recall), chooser, welcome and hints. Bilingual.
import { tr, other, t, getLang, setLang } from "./i18n.js";
import { icon } from "./icons.js";
import { MapView } from "./map.js";

const $ = (id) => document.getElementById(id);

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

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
    this.order = {};
    this.where = {};
    this.sys = Object.fromEntries(world.systems.map((s) => [s.id, s]));
    for (const s of world.systems) {
      const list = [];
      for (const w of s.wings) for (const r of w.rooms) for (const ref of r.exhibits) {
        this.where[ref] = { s, w, r, i: list.length };
        list.push(ref);
      }
      this.order[s.id] = list;
    }
    this.card = null;          // { ref, mode, touring, paused, recall }
    this.map = new MapView($("map-canvas"), world, {
      go: (ref) => { this.closeOverlays(); this.h.goExhibit(ref, true); },
      goPoint: (x, z) => { this.closeOverlays(); this.h.goPoint(x, z); },
      player: () => this.h.player(),
      visited: () => this.h.visited(),
    });
    this.bind();
    this.applyStatic();
  }

  // ── static text and wiring ─────────────────────────────────────────────────
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
    for (const [id, name] of [["btn-dir", "list"], ["btn-map", "map"], ["btn-tour", "walk"], ["btn-recall", "brain"],
      ["btn-lang", "globe"], ["btn-help", "help"]]) {
      $(id).insertAdjacentHTML("afterbegin", icon(name));
    }
    for (const id of ["card-close", "dir-close", "map-close", "chooser-close"]) $(id).innerHTML = icon("close");
    $("btn-dir").addEventListener("click", () => this.toggleDirectory());
    $("btn-map").addEventListener("click", () => this.toggleMap());
    $("btn-tour").addEventListener("click", () => this.openChooser("tour"));
    $("btn-recall").addEventListener("click", () => this.openChooser("recall"));
    $("btn-lang").addEventListener("click", () => setLang(getLang() === "en" ? "zh" : "en"));
    $("btn-help").addEventListener("click", () => this.showWelcome());
    $("where").addEventListener("click", () => this.toggleDirectory(true));
    $("card-close").addEventListener("click", () => this.h.closeCard());
    document.querySelector(".card-grip").addEventListener("click", () => $("card").classList.toggle("expanded"));
    $("dir-close").addEventListener("click", () => this.toggleDirectory(false));
    $("map-close").addEventListener("click", () => this.toggleMap(false));
    $("chooser-close").addEventListener("click", () => this.closeOverlays());
    $("search").addEventListener("input", () => this.renderDirectory());
    $("welcome-go").addEventListener("click", () => { this.hideWelcome(); this.openChooser("tour"); });
    $("welcome-walk").addEventListener("click", () => this.hideWelcome());
    addEventListener("keydown", (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") {
        if (e.key === "Escape") e.target.blur();
        return;
      }
      if (e.key === "Escape") {
        if (!$("welcome").hidden) this.hideWelcome();
        else if (!this.closeOverlays()) this.h.closeCard();
      } else if (e.key === "m" || e.key === "M") this.toggleMap();
      else if (e.key === "/") { e.preventDefault(); this.toggleDirectory(true); $("search").focus(); }
      else if (e.key === "]" || e.key === "PageDown") this.h.step(1);
      else if (e.key === "[" || e.key === "PageUp") this.h.step(-1);
    });
    this.bindBuild();
  }

  bindBuild() {
    // the local server can build new systems; the static site cannot
    if (!["localhost", "127.0.0.1", "::1"].includes(location.hostname) || new URLSearchParams(location.search).has("nowelcome")) return;
    fetch("api/systems", { method: "GET" }).then((r) => {
      if (!r.ok) return;
      const form = $("gen");
      form.hidden = false;
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const out = $("gen-log"), go = $("gen-go");
        go.disabled = true;
        out.hidden = false;
        out.textContent = "…";
        try {
          const res = await fetch("api/systems", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ topic: $("gen-topic").value, notes: $("gen-notes").value }),
          });
          if (!res.ok) throw new Error((await res.json()).detail || res.status);
          const { job } = await res.json();
          for (;;) {
            await new Promise((r) => setTimeout(r, 2000));
            const j = await (await fetch(`api/jobs/${job}`)).json();
            out.textContent = j.log.join("\n");
            if (j.status === "done") { setTimeout(() => location.reload(), 1200); break; }
            if (j.status === "failed") throw new Error(j.error);
          }
        } catch (err) {
          out.textContent += `\n${err.message}`;
          go.disabled = false;
        }
      });
    }).catch(() => {});
  }

  onLang() {
    this.applyStatic();
    if (this.card) this.renderCard();
    if (!$("dir").hidden) this.renderDirectory();
    if (!$("map").hidden) this.map.draw();
    if (!$("chooser").hidden) this.renderChooser();
    if (this.route) this.renderRoute();
    this.h.relocate();
  }

  anyOverlay() {
    return !$("dir").hidden || !$("map").hidden || !$("chooser").hidden || !$("welcome").hidden;
  }

  closeOverlays() {
    const open = this.anyOverlay();
    $("dir").hidden = true;
    $("map").hidden = true;
    $("chooser").hidden = true;
    for (const id of ["btn-dir", "btn-map", "btn-tour", "btn-recall"]) $(id).setAttribute("aria-pressed", "false");
    return open;
  }

  // ── location ───────────────────────────────────────────────────────────────
  setWhere(title, sub, color) {
    $("where-sys").textContent = title;
    $("where-room").textContent = sub;
    $("where").style.setProperty("--c", color || "var(--accent)");
  }

  toast(html, ms = 2600) {
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

  // ── exhibit card ───────────────────────────────────────────────────────────
  /** mode: "view" (full card), "ask" (recall: hidden), "shown" (recall: revealed, awaiting a grade) */
  showCard(ref, opts = {}) {
    this.card = { ref, mode: "view", ...opts };
    this.renderCard();
    $("card").hidden = false;
    $("card").querySelector(".card-scroll").scrollTop = 0;
  }

  hideCard() {
    $("card").hidden = true;
    this.card = null;
  }

  get current() {
    return this.card?.ref || null;
  }

  linkRow(l, here) {
    const ex = this.world.exhibits[l.to];
    if (!ex) return null;
    const loc = this.where[l.to];
    const cross = loc.s.id !== here.s.id;
    const where = cross ? `${tr(loc.s.title)} · ${tr(loc.r.title)}` : `${tr(loc.w.title)} · ${tr(loc.r.title)}`;
    return el("li", {},
      el("button", { type: "button", class: "link" + (cross ? " cross" : ""), style: `--c:${loc.s.color}`,
        onclick: () => this.h.goExhibit(l.to, true) },
        el("span", { class: "link-rel" }, (l.dir === "in" ? "← " : "") + tr(l.rel) + (l.dir === "out" ? " →" : "")),
        el("span", { class: "link-target" },
          el("span", { class: "link-locus" }, String(ex.locus)),
          el("span", { class: "link-title" }, `${ex.emoji} ${tr(ex.title)}`)),
        el("span", { class: "link-where" }, where)));
  }

  renderCard() {
    const { ref, mode, touring, paused } = this.card;
    const ex = this.world.exhibits[ref];
    const here = this.where[ref];
    const { s, w, r } = here;
    const list = this.order[s.id];
    const i = list.indexOf(ref);
    const gold = ex.locus % 5 === 0;
    const card = $("card");
    card.style.setProperty("--c", s.color);
    card.classList.toggle("recall", mode !== "view");
    const body = card.querySelector(".card-scroll");
    const head = el("div", { class: "card-head" },
      el("span", { class: "locus" + (gold ? " gold" : ""), title: t("locus", { n: ex.locus }) }, String(ex.locus)),
      el("p", { class: "crumb" }, el("span", { class: "dot" }), `${tr(s.title)} › ${tr(w.title)} › ${tr(r.title)}`));
    const parts = [head];
    if (mode === "ask") {
      parts.push(
        el("h2", { class: "ask" }, t("recallAsk")),
        el("p", { class: "ask-sub" }, t("recallThink")),
        el("button", { type: "button", class: "btn btn-primary btn-wide", onclick: () => this.h.reveal() },
          el("span", { html: icon("eye") }), t("reveal")));
    } else {
      const sub = other(ex.title);
      parts.push(el("h2", { class: "card-title" }, el("span", { class: "card-emoji" }, ex.emoji), tr(ex.title)));
      if (sub) parts.push(el("p", { class: "card-alt" }, sub));
      parts.push(el("p", { class: "card-summary" }, tr(ex.summary)));
      parts.push(el("section", { class: "scene-box" },
        el("h3", { class: "label" }, el("span", { html: icon("eye") }), t("scene")),
        el("p", { class: "scene-text" }, tr(ex.image)),
        el("ul", { class: "cues" }, ex.cues.map((c) => el("li", {},
          el("span", { class: "cue-thing" }, tr(c.thing)),
          el("span", { class: "cue-arrow", html: icon("arrow") }),
          el("span", { class: "cue-means" }, tr(c.means)))))));
      if (mode === "shown") {
        parts.push(el("div", { class: "grade" },
          el("button", { type: "button", class: "btn btn-good", onclick: () => this.h.grade(true) },
            el("span", { html: icon("check") }), t("gotIt")),
          el("button", { type: "button", class: "btn btn-bad", onclick: () => this.h.grade(false) },
            el("span", { html: icon("x") }), t("missed"))));
      }
      parts.push(el("section", { class: "block" }, el("h3", { class: "label" }, t("explain")),
        el("p", { class: "prose" }, tr(ex.explain))));
      parts.push(el("section", { class: "block example" }, el("h3", { class: "label" }, t("example")),
        el("p", { class: "prose" }, tr(ex.example))));
      parts.push(el("ul", { class: "chips" }, ex.keywords.map((k) => el("li", {}, tr(k)))));
      const links = ex.links.map((l) => this.linkRow(l, here)).filter(Boolean);
      if (links.length) {
        parts.push(el("section", { class: "block" }, el("h3", { class: "label" }, t("links")), el("ul", { class: "links" }, links)));
      }
    }
    body.replaceChildren(...parts);
    // footer
    const foot = card.querySelector(".card-foot");
    const prev = el("button", { type: "button", class: "btn btn-ghost", disabled: i <= 0 || mode !== "view",
      onclick: () => this.h.step(-1) }, el("span", { html: icon("prev") }), t("prev"));
    const pos = el("span", { class: "card-pos" }, `${ex.locus} / ${list.length}`);
    const next = el("button", { type: "button", class: "btn btn-primary", disabled: (!touring && i >= list.length - 1) || mode !== "view",
      onclick: () => this.h.step(1) }, t("next"), el("span", { html: icon("next") }));
    const kids = [prev, pos];
    if (touring) {
      kids.push(el("button", { type: "button", class: "btn btn-ghost", onclick: () => this.h.togglePause() },
        el("span", { html: icon(paused ? "play" : "pause") }), t(paused ? "resume" : "pause")));
    }
    kids.push(next);
    foot.replaceChildren(...kids);
    foot.hidden = mode !== "view";
  }

  // ── route bar (tour / recall progress) ─────────────────────────────────────
  setRoute(route) {
    this.route = route;
    this.renderRoute();
  }

  renderRoute() {
    const bar = $("routebar");
    const r = this.route;
    if (!r) { bar.hidden = true; return; }
    const s = this.sys[r.system];
    const kind = r.kind === "recall" ? t("recallTitle") : t("tour");
    const progress = r.total ? (r.index + (r.done ? 1 : 0)) / r.total : 0;
    bar.style.setProperty("--c", s.color);
    bar.replaceChildren(
      el("div", { class: "route-info" },
        el("span", { class: "route-kind" }, kind),
        el("span", { class: "route-name" }, tr(s.title) + (r.scopeTitle ? ` · ${tr(r.scopeTitle)}` : "")),
        el("span", { class: "route-count" }, r.kind === "recall"
          ? t("recallScore", { ok: r.ok, n: r.graded })
          : `${Math.min(r.index + 1, r.total)} / ${r.total}`)),
      el("div", { class: "route-track" }, el("span", { style: `width:${(progress * 100).toFixed(1)}%` })),
      el("div", { class: "route-ctl" },
        r.kind === "tour" ? el("button", { type: "button", class: "icon-btn", "aria-label": t(r.paused ? "resume" : "pause"),
          html: icon(r.paused ? "play" : "pause"), onclick: () => this.h.togglePause() }) : null,
        el("button", { type: "button", class: "icon-btn", "aria-label": t("endTour"), html: icon("stop"),
          onclick: () => this.h.endRoute() })));
    bar.hidden = false;
  }

  // ── directory ──────────────────────────────────────────────────────────────
  toggleDirectory(force) {
    const d = $("dir");
    const show = force ?? d.hidden;
    this.closeOverlays();
    d.hidden = !show;
    $("btn-dir").setAttribute("aria-pressed", String(show));
    if (show) this.renderDirectory();
  }

  renderDirectory() {
    const q = $("search").value.trim().toLowerCase();
    const body = $("dir-body");
    const visited = this.h.visited();
    const hereRoom = this.h.hereRoom();
    if (q) {
      const hits = [];
      for (const [ref, ex] of Object.entries(this.world.exhibits)) {
        const hay = [ex.title.en, ex.title.zh, ex.summary.en, ex.summary.zh, ...ex.keywords.flatMap((k) => [k.en, k.zh])]
          .join(" ").toLowerCase();
        const score = (ex.title.en.toLowerCase().includes(q) || ex.title.zh.includes(q)) ? 0 : 1;
        if (hay.includes(q)) hits.push([score, ref]);
      }
      hits.sort((a, b) => a[0] - b[0]);
      body.replaceChildren(...(hits.length ? hits.slice(0, 80).map(([, ref]) => {
        const ex = this.world.exhibits[ref];
        const { s, r } = this.where[ref];
        return el("button", { class: "row result", type: "button", style: `--c:${s.color}`, onclick: () => this.h.goExhibit(ref, true) },
          el("span", { class: "row-locus" + (visited.has(ref) ? " seen" : "") }, String(ex.locus)),
          el("span", { class: "row-main" }, `${ex.emoji} ${tr(ex.title)}`,
            el("span", { class: "row-where" }, `${tr(s.title)} · ${tr(r.title)}`)));
      }) : [el("p", { class: "empty" }, t("noResults", { q }))]));
      return;
    }
    const nodes = [];
    for (const s of this.world.systems) {
      const refs = this.order[s.id];
      const seen = refs.filter((r) => visited.has(r)).length;
      const open = this.openSys?.has(s.id) ?? (this.h.hereSystem() === s.id);
      const det = el("details", { class: "sys", style: `--c:${s.color}`, open: open || undefined });
      det.addEventListener("toggle", () => {
        this.openSys = this.openSys || new Set();
        if (det.open) this.openSys.add(s.id); else this.openSys.delete(s.id);
      });
      det.append(el("summary", { class: "sys-head" },
        el("span", { class: "sys-mark" }),
        el("span", { class: "sys-text" },
          el("span", { class: "sys-title" }, tr(s.title)),
          el("span", { class: "sys-sub" }, tr(s.subtitle))),
        el("span", { class: "sys-meta" },
          el("span", { class: "meter" }, el("span", { style: `width:${(100 * seen / refs.length).toFixed(0)}%` })),
          t("visitedOf", { v: seen, n: refs.length }))));
      const inner = el("div", { class: "sys-body" },
        el("p", { class: "sys-metaphor" }, tr(s.metaphor)),
        el("div", { class: "sys-actions" },
          el("button", { type: "button", class: "btn btn-small", onclick: () => this.h.startTour(s.id) },
            el("span", { html: icon("walk") }), t("startTour")),
          el("button", { type: "button", class: "btn btn-small btn-ghost", onclick: () => this.h.startRecall(s.id) },
            el("span", { html: icon("brain") }), t("recall"))));
      for (const w of s.wings) {
        inner.append(el("p", { class: "wing-title" }, tr(w.title)));
        for (const r of w.rooms) {
          const n = r.exhibits.filter((x) => visited.has(x)).length;
          const style = this.world.styles[r.style];
          const room = el("div", { class: "room" + (hereRoom === r ? " here" : "") },
            el("button", { type: "button", class: "room-head", onclick: () => this.h.goExhibit(r.exhibits[0], true) },
              el("span", { class: "room-title" }, tr(r.title)),
              el("span", { class: "room-style" }, style ? tr(style) : ""),
              el("span", { class: "row-count" }, `${n}/${r.exhibits.length}`)));
          for (const ref of r.exhibits) {
            const ex = this.world.exhibits[ref];
            room.append(el("button", { type: "button", class: "row", onclick: () => this.h.goExhibit(ref, true) },
              el("span", { class: "row-locus" + (visited.has(ref) ? " seen" : "") + (ex.locus % 5 === 0 ? " gold" : "") }, String(ex.locus)),
              el("span", { class: "row-main" }, tr(ex.title))));
          }
          inner.append(room);
        }
      }
      det.append(inner);
      nodes.push(det);
    }
    body.replaceChildren(...nodes);
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

  // ── chooser (tour / recall) ────────────────────────────────────────────────
  openChooser(kind) {
    const c = $("chooser");
    const same = !c.hidden && this.chooserKind === kind;
    this.closeOverlays();
    if (same) return;
    this.chooserKind = kind;
    c.hidden = false;
    $(kind === "tour" ? "btn-tour" : "btn-recall").setAttribute("aria-pressed", "true");
    this.renderChooser();
  }

  renderChooser() {
    const kind = this.chooserKind;
    $("chooser-title").textContent = kind === "tour" ? t("chooseTour") : t("recallTitle");
    $("chooser-intro").textContent = kind === "tour" ? "" : t("recallIntro");
    $("chooser-intro").hidden = kind === "tour";
    const visited = this.h.visited();
    const list = $("chooser-list");
    list.replaceChildren(...this.world.systems.map((s) => {
      const refs = this.order[s.id];
      const seen = refs.filter((r) => visited.has(r)).length;
      const row = el("li", { class: "choice", style: `--c:${s.color}` },
        el("button", { type: "button", class: "choice-main", onclick: () => {
          this.closeOverlays();
          if (kind === "tour") this.h.startTour(s.id); else this.h.startRecall(s.id);
        } },
          el("span", { class: "sys-mark" }),
          el("span", { class: "choice-text" },
            el("span", { class: "choice-title" }, tr(s.title)),
            el("span", { class: "choice-sub" }, `${t("exhibits", { n: refs.length })} · ${t("visitedOf", { v: seen, n: refs.length })}`))));
      if (kind === "recall") {
        const missed = this.h.missed(s.id);
        row.append(el("div", { class: "scopes" },
          missed ? el("button", { type: "button", class: "scope scope-missed",
            onclick: () => { this.closeOverlays(); this.h.startRecall(s.id, "missed"); } }, `${t("recallAgain")} · ${missed}`) : null,
          s.wings.map((w) => el("button", { type: "button", class: "scope",
            onclick: () => { this.closeOverlays(); this.h.startRecall(s.id, w.id); } }, tr(w.title)))));
      }
      return row;
    }));
  }

  // ── welcome ────────────────────────────────────────────────────────────────
  showWelcome() {
    this.closeOverlays();
    $("welcome").hidden = false;
  }

  hideWelcome() {
    $("welcome").hidden = true;
    try { localStorage.setItem("palace.welcomed", "1"); } catch { /* storage unavailable */ }
  }

  shouldWelcome() {
    try { return !localStorage.getItem("palace.welcomed"); } catch { return true; }
  }
}

export { esc };
