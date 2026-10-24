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
  tagline: { en: "Walk among ideas. Remember them by where they stand.", zh: "在知识之间散步，凭位置记住它们。" },
  loading: { en: "Laying the paths…", zh: "正在铺设道路…" },
  loadingBuild: { en: "Raising the halls…", zh: "正在建造展厅…" },
  loadingLight: { en: "Lighting the exhibits…", zh: "正在点亮展品…" },
  loadFailed: { en: "Could not load the palace: {msg}", zh: "加载失败：{msg}" },
  plaza: { en: "Central Plaza", zh: "中央广场" },
  plazaSub: { en: "Choose a road, or press Tour", zh: "选一条路走过去，或者点「导览」" },
  emptyPlot: { en: "Open ground", zh: "空地" },
  emptyPlotSub: { en: "A new knowledge system will be built here", zh: "新的知识体系会建在这里" },
  directory: { en: "Directory", zh: "目录" },
  map: { en: "Map", zh: "地图" },
  tour: { en: "Tour", zh: "导览" },
  recall: { en: "Recall", zh: "回忆" },
  help: { en: "Help", zh: "帮助" },
  language: { en: "中文", zh: "EN" },
  languageLabel: { en: "Switch to Chinese", zh: "切换到英文" },
  close: { en: "Close", zh: "关闭" },
  search: { en: "Search exhibits, keywords…", zh: "搜索展品、关键词…" },
  noResults: { en: "Nothing matches “{q}”.", zh: "没有找到“{q}”。" },
  exhibits: { en: "{n} exhibits", zh: "{n} 件展品" },
  rooms: { en: "{n} rooms", zh: "{n} 个展厅" },
  visitedOf: { en: "{v} of {n} seen", zh: "已看 {v}/{n}" },
  locus: { en: "Locus {n}", zh: "第 {n} 处" },
  summary: { en: "In one line", zh: "一句话" },
  scene: { en: "The memory scene", zh: "记忆画面" },
  cues: { en: "What stands for what", zh: "物与义" },
  explain: { en: "Explanation", zh: "解释" },
  example: { en: "Example", zh: "例子" },
  keywords: { en: "Keywords", zh: "关键词" },
  links: { en: "Connections", zh: "关联" },
  linkOut: { en: "→", zh: "→" },
  linkIn: { en: "←", zh: "←" },
  prev: { en: "Previous", zh: "上一处" },
  next: { en: "Next", zh: "下一处" },
  pause: { en: "Pause", zh: "暂停" },
  resume: { en: "Resume", zh: "继续" },
  endTour: { en: "End", zh: "结束" },
  goThere: { en: "Go there", zh: "前往" },
  inRoom: { en: "{wing} · {room}", zh: "{wing} · {room}" },
  enterRoom: { en: "You enter the {style}", zh: "你走进了{style}" },
  chooseTour: { en: "Choose a route", zh: "选择一条路线" },
  tourHint: { en: "Touring {name}. Pause any time to look closer.", zh: "导览：{name}。随时暂停细看。" },
  tourEnd: { en: "End of the {name} route.", zh: "「{name}」路线走完了。" },
  tourLeft: { en: "Tour stopped. Walk freely.", zh: "已退出导览，可以自由走动。" },
  startTour: { en: "Start the tour", zh: "开始导览" },
  recallTitle: { en: "Recall walk", zh: "回忆漫步" },
  recallIntro: {
    en: "Walk the route with the labels hidden. At each locus, look at the scene and say what it stands for, then reveal.",
    zh: "沿路线走一遍，标签全部隐藏。每到一处，看着场景说出它代表什么，再揭晓答案。",
  },
  recallScope: { en: "What to recall", zh: "回忆范围" },
  recallAsk: { en: "What does this scene stand for?", zh: "这个场景代表什么？" },
  recallThink: { en: "Look at the scene. Name the idea, then reveal.", zh: "看着场景，先说出概念，再揭晓。" },
  reveal: { en: "Reveal", zh: "揭晓" },
  gotIt: { en: "I knew it", zh: "记得" },
  missed: { en: "I missed it", zh: "没记住" },
  recallDone: { en: "Recall finished: {ok} of {n} remembered.", zh: "回忆结束：{n} 处里记住了 {ok} 处。" },
  recallScore: { en: "{ok} / {n} remembered", zh: "记住 {ok} / {n}" },
  recallAgain: { en: "Practise the missed ones", zh: "再练没记住的" },
  wholeSystem: { en: "Whole route", zh: "整条路线" },
  hintDesktop: { en: "W A S D to walk · drag to look · click an exhibit · Shift to run", zh: "W A S D 走动 · 拖动转头 · 点击展品 · Shift 奔跑" },
  hintTouch: { en: "Joystick to walk · drag to look · tap an exhibit", zh: "左下摇杆走动 · 拖动转头 · 点展品看详情" },
  mapTip: { en: "Click an exhibit or a path to go there · scroll to zoom", zh: "点展品或道路即可前往 · 滚轮缩放" },
  welcomeTitle: { en: "Welcome to the Memory Palace", zh: "欢迎来到记忆宫殿" },
  welcomeBody: {
    en: "The method of loci is the oldest memory technique: put each idea in a fixed place along a route, as a vivid scene. Walk the route again in your mind and the ideas come back in order.",
    zh: "位置记忆法是最古老的记忆术：把每个概念做成一个鲜明的场景，放在路线上固定的位置。在脑海里重走这条路，概念就会按顺序回来。",
  },
  welcomeHow1: { en: "Each knowledge system is a building. Its route is the learning order.", zh: "每个知识体系是一座建筑，路线就是学习顺序。" },
  welcomeHow2: { en: "Each exhibit is a scene. The card says which object stands for what.", zh: "每件展品是一个场景，卡片会告诉你哪个物件代表什么。" },
  welcomeHow3: { en: "Numbered loci: every fifth is gold, so you always know where you are.", zh: "位置都有编号，每第五处是金色的，方便定位。" },
  welcomeHow4: { en: "Later, take a Recall walk with the labels hidden.", zh: "之后可以走一遍「回忆」，标签全部隐藏。" },
  welcomeGo: { en: "Start a guided tour", zh: "开始导览" },
  welcomeWalk: { en: "Explore on my own", zh: "自己逛逛" },
  build: { en: "Build a new wing with AI", zh: "让 AI 建一个新展区" },
  buildTopic: { en: "Topic, e.g. linear algebra or my internship", zh: "主题，例如：线性代数、我的实习经验" },
  buildNotes: { en: "Optional: paste notes, experience or requirements", zh: "可选：贴上你的笔记、经历或要求" },
  buildGo: { en: "Build", zh: "开始建造" },
  seen: { en: "seen", zh: "已看" },
  theme: { en: "Theme", zh: "主题" },
};
