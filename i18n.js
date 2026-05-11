const STORAGE_KEY = 'regex-lab-lang';
const DEFAULT_LANG = 'zh-CN';

let currentLang = DEFAULT_LANG;
let translations = {};
let changeListeners = [];

/**
 * 加载语言包
 * @param {string} lang - 语言代码（如 'zh-CN', 'en'）
 * @returns {Promise<Object>} 翻译对象
 */
async function loadTranslations(lang) {
  try {
    const response = await fetch(`${lang}.json?v=${Date.now()}`);
    if (!response.ok) throw new Error(`Failed to load ${lang}.json`);
    return await response.json();
  } catch (e) {
    console.error('Failed to load translations:', e);
    return {};
  }
}

/**
 * 初始化 i18n
 * @returns {Promise<void>}
 */
async function initI18n() {
  const savedLang = localStorage.getItem(STORAGE_KEY);
  if (savedLang) {
    currentLang = savedLang;
  } else {
    const browserLang = navigator.language || navigator.userLanguage;
    currentLang = browserLang.startsWith('zh') ? 'zh-CN' : 'en';
  }
  translations = await loadTranslations(currentLang);
}

/**
 * 获取翻译文本
 * @param {string} key - 翻译键
 * @param {Object} [params] - 插值参数
 * @returns {string} 翻译后的文本
 */
function t(key, params) {
  let text = translations[key] || key;
  if (params) {
    Object.keys(params).forEach(param => {
      text = text.replace(`{${param}}`, params[param]);
    });
  }
  return text;
}

/**
 * 获取当前语言
 * @returns {string} 当前语言代码
 */
function getLang() {
  return currentLang;
}

/**
 * 切换语言
 * @param {string} lang - 目标语言代码
 * @returns {Promise<void>}
 */
async function setLang(lang) {
  if (lang === currentLang) return;
  currentLang = lang;
  translations = await loadTranslations(lang);
  localStorage.setItem(STORAGE_KEY, lang);
  document.documentElement.setAttribute('lang', lang);
  changeListeners.forEach(fn => fn(lang));
}

/**
 * 监听语言变化
 * @param {Function} callback - 语言变化时的回调函数
 * @returns {Function} 取消监听的函数
 */
function onLangChange(callback) {
  changeListeners.push(callback);
  return () => {
    changeListeners = changeListeners.filter(fn => fn !== callback);
  };
}

export {
  initI18n,
  t,
  getLang,
  setLang,
  onLangChange
};
