// Bilingual interface: English by default, Chinese available.

const STRINGS = {
  en: {
    title: 'Memory Palace',
    lede: 'A world of architecture, from every age and civilization.',
    loading: 'Preparing the world…',
    compiling: 'Lighting the halls…',
    'st-start': 'Starting the renderer', 'st-land': 'Shaping the land', 'st-build': 'Raising the buildings', 'st-plants': 'Planting', 'st-shaders': 'Preparing the light',
    'left-s': 'about {n} s left', 'left-done': 'almost there',
    'click-to-look': 'Click to look around', 'travelling': 'Travelling…', 'map-hint': 'Click anywhere on the map to go there; click a name to go to its entrance.',
    ready: 'Ready.',
    enter: 'Enter',
    resume: 'Continue',
    'controls-desktop': 'W A S D to walk · mouse to look · Shift to run · M for the map · Esc to pause',
    'controls-touch': 'Left thumb to walk · drag to look',
    map: 'Map',
    settings: 'Settings',
    language: 'Language',
    quality: 'Picture quality',
    time: 'Time of day', 't-cycle': 'Days pass', 't-morning': 'Morning', 't-noon': 'Noon', 't-evening': 'Evening', 't-night': 'Night', 't-baked': "Each place's own hour",
    'q-high': 'High', 'q-medium': 'Medium', 'q-low': 'Low',
    music: 'Music',
    sensitivity: 'Look sensitivity',
    'no-webgpu': 'WebGPU is not available in this browser, so the world runs on WebGL 2 and may be slower. Chrome, Edge and Safari 26 support WebGPU.',
    'error': 'The world could not be started: ',
    you: 'You',
    districts: { nile: 'The Nile', greece: 'Greece', rome: 'Rome', byzantium: 'Byzantium', levant: 'The Levant', francia: 'Francia', tang: 'Tang China', heian: 'Heian Japan', india: 'India' },
  },
  zh: {
    title: '记忆宫殿',
    lede: '一座由各个时代、各个文明的建筑组成的世界。',
    loading: '正在准备世界……',
    compiling: '正在点亮殿堂……',
    'st-start': '正在启动渲染器', 'st-land': '正在塑造地形', 'st-build': '正在建造建筑', 'st-plants': '正在种植植物', 'st-shaders': '正在准备光照',
    'left-s': '大约还需 {n} 秒', 'left-done': '马上就好',
    'click-to-look': '点击画面开始环顾', 'travelling': '正在前往……', 'map-hint': '点击地图上任意位置即可前往；点击名称可到达建筑入口。',
    ready: '准备好了。',
    enter: '进入',
    resume: '继续',
    'controls-desktop': 'W A S D 行走 · 鼠标环顾 · Shift 奔跑 · M 打开地图 · Esc 暂停',
    'controls-touch': '左手拇指行走 · 拖动环顾',
    map: '地图',
    settings: '设置',
    language: '语言',
    quality: '画质',
    time: '时间', 't-cycle': '昼夜流转', 't-morning': '清晨', 't-noon': '正午', 't-evening': '黄昏', 't-night': '夜晚', 't-baked': '各地固定时刻',
    'q-high': '高', 'q-medium': '中', 'q-low': '低',
    music: '音乐',
    sensitivity: '视角灵敏度',
    'no-webgpu': '此浏览器不支持 WebGPU，世界将以 WebGL 2 运行，可能较慢。Chrome、Edge 和 Safari 26 均支持 WebGPU。',
    'error': '世界无法启动：',
    you: '你',
    districts: { nile: '尼罗河', greece: '希腊', rome: '罗马', byzantium: '拜占庭', levant: '黎凡特', francia: '法兰西', tang: '唐', heian: '平安日本', india: '印度' },
  },
};

let lang = 'en';
const listeners = [];

export function initLang() {
  let saved = null;
  try { saved = localStorage.getItem('mp.lang'); } catch { /* storage unavailable */ }
  const q = new URLSearchParams(location.search).get('lang');
  lang = q || saved || 'en';
  if (!STRINGS[lang]) lang = 'en';
  apply();
}

export function setLang(l) {
  if (!STRINGS[l]) return;
  lang = l;
  try { localStorage.setItem('mp.lang', l); } catch { /* ignore */ }
  apply();
  for (const f of listeners) f(lang);
}

export const getLang = () => lang;
export const onLang = (f) => listeners.push(f);
export const t = (k) => STRINGS[lang][k] ?? STRINGS.en[k] ?? k;
/** Pick the current language from a {en, zh} object. */
export const tr = (o) => (o && (o[lang] ?? o.en)) || '';

function apply() {
  document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
  document.title = t('title');
  for (const el of document.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
  for (const el of document.querySelectorAll('[data-i18n-label]')) el.setAttribute('aria-label', t(el.dataset.i18nLabel));
  for (const b of document.querySelectorAll('.lang-switch button')) b.classList.toggle('on', b.dataset.lang === lang);
  const sel = document.getElementById('set-lang');
  if (sel) sel.value = lang;
}
