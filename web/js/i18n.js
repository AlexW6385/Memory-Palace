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
  tagline: { en: "Real buildings of many ages, to keep your memories in.", zh: "古今各地的真实建筑，用来安放你的记忆。" },
  loading: { en: "Clearing the sand…", zh: "正在清理沙土…" },
  loadingBuild: { en: "Raising the temple…", zh: "正在建造神庙…" },
  loadingLight: { en: "Lighting the lamps…", zh: "正在点亮油灯…" },
  loadFailed: { en: "Could not load the palace: {msg}", zh: "加载失败：{msg}" },
  street: { en: "The desert", zh: "沙漠" },
  streetSub: { en: "Open Places to find your way", zh: "打开「地点」找路" },
  grounds: { en: "In the grounds", zh: "在神庙周围" },
  places: { en: "Places", zh: "地点" },
  map: { en: "Map", zh: "地图" },
  help: { en: "Help", zh: "帮助" },
  language: { en: "中文", zh: "EN" },
  languageLabel: { en: "Switch to Chinese", zh: "切换到英文" },
  close: { en: "Close", zh: "关闭" },
  search: { en: "Search rooms and loci…", zh: "搜索房间和位置…" },
  noResults: { en: "Nothing matches “{q}”.", zh: "没有找到“{q}”。" },
  rooms: { en: "{n} rooms", zh: "{n} 个房间" },
  lociCount: { en: "{n} loci", zh: "{n} 个位置" },
  toEntrance: { en: "Go to the entrance", zh: "到入口" },
  inRoom: { en: "{wing} · {room}", zh: "{wing} · {room}" },
  hintDesktop: { en: "W A S D to walk · drag to look · N / B next or previous locus · M map", zh: "W A S D 走动 · 拖动转头 · N / B 下一个 / 上一个位置 · M 地图" },
  hintTouch: { en: "Joystick to walk · drag to look", zh: "左下摇杆走动 · 拖动屏幕转头" },
  mapTip: { en: "Click a room or a path to go there · scroll to zoom", zh: "点房间或道路即可前往 · 滚轮缩放" },
  welcomeTitle: { en: "A palace for your memories", zh: "安放记忆的宫殿" },
  welcomeBody: {
    en: "The method of loci is the oldest memory technique: you remember things by placing them, as vivid images, at places along a route you know well. A real building gives the best route, because everything in it is where it belongs and for a reason. This one is a temple of Horus, after Edfu in Egypt.",
    zh: "位置记忆法是最古老的记忆术：把要记的东西变成鲜明的画面，放在一条熟悉路线上的一个个位置里。真实的建筑是最好的路线，因为里面每样东西都有它该在的地方和道理。这一座是仿埃及埃德富的荷鲁斯神庙。",
  },
  welcomeHow1: { en: "Follow the priests' route: from the river through the pylon, the court and ever darker halls to the sanctuary.", zh: "沿着祭司的路线走：从河边穿过塔门、庭院和越来越幽暗的大厅，一直走到圣殿。" },
  welcomeHow2: { en: "Each locus is a real thing in its place: a statue, an altar, a shrine. Its number shows when you look at it.", zh: "每个位置都是放在原处的真实物件：一尊雕像、一座祭坛、一个神龛。看着它时会显示编号。" },
  welcomeHow3: { en: "Make each image strange and lively, and tie it to the thing: it matters more than the thing itself.", zh: "画面要夸张、生动，并和物件发生关系，这比物件本身更重要。" },
  welcomeHow4: { en: "To recall, walk the same route again, here or in your mind. N and B step through the loci in order.", zh: "回忆时，在这里或在脑中按同一路线再走一遍。按 N 和 B 可以按顺序逐个走过位置。" },
  welcomeGo: { en: "Start walking", zh: "开始走" },
};
