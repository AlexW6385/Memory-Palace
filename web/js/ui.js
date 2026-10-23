// DOM side of the palace: location pill, exhibit card, directory, map, tour menu.

const $ = (id) => document.getElementById(id);

function el(tag, attrs = {}, ...children) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") n.className = v;
    else if (k === "style") n.style.cssText = v;
    else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v);
  }
  for (const c of children) if (c != null) n.append(c);
  return n;
}

export class UI {
  constructor(world, h) {
    this.world = world;
    this.h = h; // handlers from main.js
    this.sys = Object.fromEntries(world.systems.map((s) => [s.id, s]));
    this.order = {}; // system id -> [refs in tour order]
    this.roomOf = {}; // ref -> {system, wing, room}
    for (const s of world.systems) {
      this.order[s.id] = [];
      for (const w of s.wings) for (const r of w.rooms) for (const ref of r.exhibits) {
        this.order[s.id].push(ref);
        this.roomOf[ref] = { s, w, r };
      }
    }
    this.current = null;

    $("card-close").onclick = () => h.closeCard();
    $("card-prev").onclick = () => h.step(-1);
    $("card-next").onclick = () => h.step(1);
    $("tour-pause").onclick = () => h.togglePause();
    $("btn-dir").onclick = () => this.toggleDirectory();
    $("where").onclick = () => this.toggleDirectory(true);
    $("dir-close").onclick = () => this.toggleDirectory(false);
    $("btn-map").onclick = () => this.toggleMap();
    $("map-close").onclick = () => this.toggleMap(false);
    $("btn-tour").onclick = () => this.toggleTourMenu();
    $("search").addEventListener("input", () => this.renderDirectory());
    $("map-canvas").addEventListener("click", (e) => this.#mapClick(e));
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") this.closeOverlays() || h.closeCard();
    });
    this.#initGenerator();
  }

  // ── "build a new area" (only when served by `python -m palace serve`) ──
  async #initGenerator() {
    try {
      const r = await fetch("api/systems");
      if (!r.ok || !Array.isArray(await r.json())) return;
    } catch { return; }
    const form = $("gen"), out = $("gen-log"), go = $("gen-go");
    form.hidden = false;
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      go.disabled = true;
      out.hidden = false;
      out.textContent = "正在请 AI 设计…";
      try {
        const res = await fetch("api/systems", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ topic: $("gen-topic").value, notes: $("gen-notes").value }),
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body.detail || res.statusText);
        for (;;) {
          await new Promise((r) => setTimeout(r, 2000));
          const job = await (await fetch(`api/jobs/${body.job}`)).json();
          out.textContent = job.log.join("\n");
          out.scrollTop = out.scrollHeight;
          if (job.status === "done") { go.textContent = "进入新区域"; go.disabled = false; go.onclick = () => location.reload(); return; }
          if (job.status === "failed") throw new Error(job.error);
        }
      } catch (err) {
        out.textContent += `\n建造失败：${err.message}`;
        go.disabled = false;
      }
    });
  }

  anyOverlay() {
    return !$("dir").hidden || !$("map").hidden || !$("tourmenu").hidden;
  }

  closeOverlays() {
    const open = this.anyOverlay();
    $("dir").hidden = true;
    $("map").hidden = true;
    $("tourmenu").hidden = true;
    $("btn-map").setAttribute("aria-pressed", "false");
    return open;
  }

  // ── location pill ───────────────────────────────────────────────────────
  setWhere(sys, sub) {
    $("where-sys").textContent = sys;
    $("where-room").textContent = sub;
  }

  // ── card ────────────────────────────────────────────────────────────────
  showCard(ref, { touring = false, paused = false } = {}) {
    const ex = this.world.exhibits[ref];
    const { s, w, r } = this.roomOf[ref];
    const list = this.order[s.id];
    const i = list.indexOf(ref);
    this.current = ref;
    const card = $("card");
    card.style.setProperty("--ex", ex.color);
    $("card-crumb").textContent = `${s.title} · ${w.title} · ${r.title}`;
    $("card-emoji").textContent = ex.emoji;
    $("card-name").textContent = ex.title;
    $("card-summary").textContent = ex.summary;
    $("card-detail").textContent = ex.detail;
    $("card-image").textContent = ex.image;
    $("card-kw").replaceChildren(...ex.keywords.map((k) => el("li", {}, k)));
    const links = ex.links.filter((l) => this.world.exhibits[l.to]);
    $("card-links-wrap").hidden = links.length === 0;
    $("card-links").replaceChildren(...links.map((l) => {
      const t = this.world.exhibits[l.to];
      const loc = this.roomOf[l.to];
      const where = loc.s.id === s.id ? `${loc.w.title} · ${loc.r.title}` : `${loc.s.title} · ${loc.w.title}`;
      const rel = l.dir === "out" ? l.rel : `${l.rel} ←`;
      return el("li", {}, el("button", { type: "button", onclick: () => this.h.goExhibit(l.to, true) },
        el("span", { class: "rel" }, rel),
        el("span", { class: "rel-target" }, `${t.emoji} ${t.title}`, el("span", { class: "rel-where" }, where))));
    }));
    $("card-pos").textContent = `${i + 1} / ${list.length}`;
    $("card-prev").disabled = i <= 0;
    $("card-next").textContent = touring ? "下一件" : i >= list.length - 1 ? "完" : "下一件";
    $("card-next").disabled = !touring && i >= list.length - 1;
    $("tour-pause").hidden = !touring;
    $("tour-pause").textContent = paused ? "继续" : "暂停";
    card.hidden = false;
    card.querySelector(".card-scroll").scrollTop = 0;
  }

  hideCard() {
    $("card").hidden = true;
    this.current = null;
  }

  // ── directory ───────────────────────────────────────────────────────────
  toggleDirectory(force) {
    const d = $("dir");
    const show = force ?? d.hidden;
    this.closeOverlays();
    d.hidden = !show;
    if (show) this.renderDirectory();
  }

  renderDirectory() {
    const q = $("search").value.trim().toLowerCase();
    const body = $("dir-body");
    const visited = this.h.visited();
    const here = this.h.hereRoom();
    if (q) {
      const hits = [];
      for (const [ref, ex] of Object.entries(this.world.exhibits)) {
        const hay = [ex.title, ex.summary, ...ex.keywords].join(" ").toLowerCase();
        if (hay.includes(q)) hits.push(ref);
      }
      body.replaceChildren(...(hits.length ? hits.slice(0, 60).map((ref) => {
        const ex = this.world.exhibits[ref];
        const { s, r } = this.roomOf[ref];
        return el("button", { class: "row", type: "button", onclick: () => this.h.goExhibit(ref, true) },
          el("span", {}, `${ex.emoji} ${ex.title}`, el("span", { class: "result-where" }, `${s.title} · ${r.title}`)));
      }) : [el("p", { class: "empty" }, "没有找到匹配的展品")]));
      return;
    }
    const nodes = [];
    for (const s of this.world.systems) {
      const total = this.order[s.id].length;
      const seen = this.order[s.id].filter((r) => visited.has(r)).length;
      const sec = el("section", { class: "sys" },
        el("div", { class: "sys-head" },
          el("span", { class: "dot", style: `--c:${s.color}` }),
          el("h3", { class: "sys-title" }, s.title),
          el("span", { class: "sys-meta" }, `${seen}/${total}`)),
        el("p", { class: "sys-sub" }, s.metaphor));
      for (const w of s.wings) {
        sec.append(el("p", { class: "wing-title" }, w.title));
        for (const r of w.rooms) {
          const n = r.exhibits.filter((x) => visited.has(x)).length;
          sec.append(el("button", {
            class: "row" + (here === r ? " here" : ""), type: "button",
            onclick: () => this.h.goExhibit(r.exhibits[0], true),
          }, el("span", {}, r.title), el("span", { class: "row-count" }, `${n}/${r.exhibits.length}`)));
        }
      }
      nodes.push(sec);
    }
    body.replaceChildren(...nodes);
  }

  // ── tour menu ───────────────────────────────────────────────────────────
  toggleTourMenu() {
    const m = $("tourmenu");
    const show = m.hidden;
    this.closeOverlays();
    if (!show) return;
    const visited = this.h.visited();
    const first = this.h.hereSystem();
    const systems = [...this.world.systems].sort((a, b) => (b.id === first) - (a.id === first));
    $("tour-list").replaceChildren(...systems.map((s) => {
      const total = this.order[s.id].length;
      const seen = this.order[s.id].filter((r) => visited.has(r)).length;
      return el("li", {}, el("button", { type: "button", onclick: () => { m.hidden = true; this.h.startTour(s.id); } },
        el("span", { class: "dot", style: `--c:${s.color}` }),
        el("span", { class: "tour-name" }, s.title),
        el("span", { class: "tour-meta" }, `${seen}/${total}`)));
    }));
    m.hidden = false;
  }

  // ── map ─────────────────────────────────────────────────────────────────
  toggleMap(force) {
    const m = $("map");
    const show = force ?? m.hidden;
    this.closeOverlays();
    m.hidden = !show;
    $("btn-map").setAttribute("aria-pressed", String(show));
    if (show) this.drawMap();
  }

  #mapTransform() {
    const c = $("map-canvas");
    const w = c.clientWidth, hgt = c.clientHeight;
    const half = this.world.half;
    const scale = (Math.min(w, hgt) - 48) / (half * 2);
    return { w, h: hgt, scale, ox: w / 2, oy: hgt / 2 + 12 };
  }

  drawMap() {
    const c = $("map-canvas");
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    c.width = c.clientWidth * dpr;
    c.height = c.clientHeight * dpr;
    const ctx = c.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const css = getComputedStyle(document.documentElement);
    const ink = css.getPropertyValue("--ink").trim(), muted = css.getPropertyValue("--muted").trim();
    const line = css.getPropertyValue("--line").trim(), accent = css.getPropertyValue("--accent").trim();
    const { scale, ox, oy } = this.#mapTransform();
    const X = (x) => ox + x * scale, Y = (z) => oy + z * scale;
    ctx.clearRect(0, 0, c.clientWidth, c.clientHeight);
    // plaza
    ctx.fillStyle = line;
    ctx.beginPath(); ctx.arc(X(0), Y(0), 26 * scale, 0, Math.PI * 2); ctx.fill();
    for (const p of this.world.plots) {
      const s = p.system && this.sys[p.system];
      const hh = p.half * scale;
      const x = X(p.center[0]) - hh, y = Y(p.center[1]) - hh;
      ctx.lineWidth = 1.5;
      if (s) {
        ctx.fillStyle = s.color + "33";
        ctx.strokeStyle = s.color;
        ctx.setLineDash([]);
        ctx.fillRect(x, y, hh * 2, hh * 2);
        ctx.strokeRect(x, y, hh * 2, hh * 2);
      } else {
        ctx.strokeStyle = line;
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(x, y, hh * 2, hh * 2);
        ctx.setLineDash([]);
      }
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = s ? ink : muted;
      const fs = Math.max(11, Math.min(17, hh * 0.16));
      ctx.font = `700 ${fs}px "Noto Serif SC", serif`;
      ctx.fillText(s ? s.title : "空地", X(p.center[0]), Y(p.center[1]));
    }
    // exhibits
    for (const ex of Object.values(this.world.exhibits)) {
      ctx.fillStyle = ex.color;
      ctx.fillRect(X(ex.pos[0]) - 1, Y(ex.pos[2]) - 1, 2, 2);
    }
    // visitor
    const pl = this.h.player();
    ctx.save();
    ctx.translate(X(pl.x), Y(pl.z));
    ctx.rotate(-pl.yaw);
    ctx.fillStyle = accent;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, -11); ctx.lineTo(7, 8); ctx.lineTo(0, 4); ctx.lineTo(-7, 8); ctx.closePath();
    ctx.stroke(); ctx.fill();
    ctx.restore();
  }

  #mapClick(e) {
    const r = e.currentTarget.getBoundingClientRect();
    const { scale, ox, oy } = this.#mapTransform();
    const x = (e.clientX - r.left - ox) / scale, z = (e.clientY - r.top - oy) / scale;
    for (const p of this.world.plots) {
      if (Math.abs(x - p.center[0]) <= p.half && Math.abs(z - p.center[1]) <= p.half) {
        this.toggleMap(false);
        if (p.system) this.h.goSystem(p.system);
        else this.h.goPoint(p.center[0], p.center[1] + (p.center[1] > 0 ? -p.half - 8 : p.half + 8));
        return;
      }
    }
    if (Math.hypot(x, z) < 60) { this.toggleMap(false); this.h.goPoint(0, 34); }
  }

  // ── hint ────────────────────────────────────────────────────────────────
  hint(text, ms = 6000) {
    const n = $("hint");
    n.textContent = text;
    n.hidden = false;
    n.classList.remove("fade-out");
    clearTimeout(this._hintT);
    this._hintT = setTimeout(() => {
      n.classList.add("fade-out");
      setTimeout(() => { n.hidden = true; }, 600);
    }, ms);
  }
}
