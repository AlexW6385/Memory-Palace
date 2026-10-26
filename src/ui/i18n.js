// Bilingual interface: English by default, Chinese available.

const STRINGS = {
  en: {
    title: 'Memory Palace',
    lede: 'A world of architecture, from every age and civilization.',
    loading: 'Preparing the world…',
    compiling: 'Lighting the halls…',
    ready: 'Ready.',
    enter: 'Enter',
    resume: 'Continue',
    'controls-desktop': 'W A S D to walk · mouse to look · Shift to run · M for the map · Esc to pause',
    'controls-touch': 'Left thumb to walk · drag to look',
    map: 'Map',
    settings: 'Settings',
    language: 'Language',
    quality: 'Picture quality',
    'q-high': 'High', 'q-medium': 'Medium', 'q-low': 'Low',
    music: 'Music',
    sensitivity: 'Look sensitivity',
    'no-webgpu': 'WebGPU is not available in this browser, so the world runs on WebGL 2 and may be slower. Chrome, Edge and Safari 26 support WebGPU.',
    'error': 'The world could not be started: ',
    you: 'You',
    districts: { nile: 'The Nile' },
  },
  zh: {
    title: '记忆宫殿',
    lede: '一座由各个时代、各个文明的建筑组成的世界。',
    loading: '正在准备世界……',
    compiling: '正在点亮殿堂……',
    ready: '准备好了。',
    enter: '进入',
    resume: '继续',
    'controls-desktop': 'W A S D 行走 · 鼠标环顾 · Shift 奔跑 · M 打开地图 · Esc 暂停',
    'controls-touch': '左手拇指行走 · 拖动环顾',
    map: '地图',
    settings: '设置',
    language: '语言',
    quality: '画质',
    'q-high': '高', 'q-medium': '中', 'q-low': '低',
    music: '音乐',
    sensitivity: '视角灵敏度',
    'no-webgpu': '此浏览器不支持 WebGPU，世界将以 WebGL 2 运行，可能较慢。Chrome、Edge 和 Safari 26 均支持 WebGPU。',
    'error': '世界无法启动：',
    you: '你',
    districts: { nile: '尼罗河' },
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
