// Language: English by default, Chinese on request (?lang=zh, the toggle, or a saved choice).
const KEY = "palace.lang";
const listeners = new Set();

function initial() {
  try {
    const q = new URLSearchParams(location.search).get("lang");
    if (q === "en" || q === "zh") return q;
  } catch { /* no location */ }
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === "en" || saved === "zh") return saved;
  } catch { /* storage unavailable */ }
  return "en";
}

let lang = initial();
applyDocument();

function applyDocument() {
  if (typeof document === "undefined") return;
  document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
  document.documentElement.dataset.lang = lang;
}

export function getLang() {
  return lang;
}

export function setLang(next) {
  if (next !== "en" && next !== "zh" || next === lang) return;
  lang = next;
  try { localStorage.setItem(KEY, lang); } catch { /* storage unavailable */ }
  applyDocument();
  for (const fn of listeners) fn(lang);
}

export function onLang(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Pick the current language from a bilingual text ({en, zh}) or pass a plain string through. */
export function tr(text, which = lang) {
  if (text == null) return "";
  if (typeof text === "string") return text;
  return text[which] ?? text.en ?? "";
}

/** The other language's version, when it differs (shown as a quiet subtitle). */
export function other(text) {
  if (text == null || typeof text === "string") return "";
  const o = text[lang === "en" ? "zh" : "en"];
  return o && o !== text[lang] ? o : "";
}

/** UI string by key with {placeholders}. */
export function t(key, vars) {
  const entry = STR[key];
  let s = entry ? (entry[lang] ?? entry.en) : key;
  if (vars) s = s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ""));
  return s;
}

const STR = {
  title: { en: "Memory Palace", zh: "记忆宫殿" },
  tagline: { en: "A city of rooms to keep your memories in.", zh: "一座用来安放记忆的城。" },
  loading: { en: "Laying the streets…", zh: "正在铺设街道…" },
  loadingBuild: { en: "Raising the buildings…", zh: "正在建造楼宇…" },
  loadingLight: { en: "Lighting the rooms…", zh: "正在点亮房间…" },
  loadFailed: { en: "Could not load the palace: {msg}", zh: "加载失败：{msg}" },
  street: { en: "The streets", zh: "街道" },
  streetSub: { en: "Pick a building, or open Places", zh: "选一栋楼走进去，或者打开「地点」" },
  grounds: { en: "In the grounds", zh: "在庭院里" },
  places: { en: "Places", zh: "地点" },
  map: { en: "Map", zh: "地图" },
  help: { en: "Help", zh: "帮助" },
  language: { en: "中文", zh: "EN" },
  languageLabel: { en: "Switch to Chinese", zh: "切换到英文" },
  close: { en: "Close", zh: "关闭" },
  search: { en: "Search buildings and rooms…", zh: "搜索建筑和房间…" },
  noResults: { en: "Nothing matches “{q}”.", zh: "没有找到“{q}”。" },
  rooms: { en: "{n} rooms", zh: "{n} 个房间" },
  toEntrance: { en: "Go to the entrance", zh: "到入口" },
  inRoom: { en: "{wing} · {room}", zh: "{wing} · {room}" },
  enterRoom: { en: "You enter the {style}", zh: "你走进了{style}" },
  hintDesktop: { en: "W A S D to walk · drag to look · Shift to run · M for the map", zh: "W A S D 走动 · 拖动转头 · Shift 奔跑 · M 打开地图" },
  hintTouch: { en: "Joystick to walk · drag to look", zh: "左下摇杆走动 · 拖动屏幕转头" },
  mapTip: { en: "Click a room or a path to go there · scroll to zoom", zh: "点房间或道路即可前往 · 滚轮缩放" },
  welcomeTitle: { en: "A palace for your memories", zh: "安放记忆的宫殿" },
  welcomeBody: {
    en: "The method of loci is the oldest memory technique: you remember things by placing them, as vivid images, at places along a route you know well. This city gives you the places. What you hang on them stays in your head.",
    zh: "位置记忆法是最古老的记忆术：把要记的东西变成鲜明的画面，放在一条熟悉路线上的一个个位置里。这座城提供位置，挂在上面的东西只存在你的脑子里。",
  },
  welcomeHow1: { en: "Walk a building's route in order: every room has its loci on plinths, alternating left and right.", zh: "按顺序走一栋楼：每个房间沿路两侧左右交替排着位置，每个位置是台座上的一件物品。" },
  welcomeHow2: { en: "No two objects in the city are alike, so no two places get confused.", zh: "全城没有两件一样的物品，位置就不会混淆。" },
  welcomeHow3: { en: "Make each image strange and lively, and tie it to the object: it matters more than the object itself.", zh: "画面要夸张、生动，并和物品发生关系，这比物品本身更重要。" },
  welcomeHow4: { en: "To recall, walk the same route again, here or in your mind.", zh: "回忆时，在这里或在脑中按同一路线再走一遍。" },
  welcomeGo: { en: "Start walking", zh: "开始走" },
};
