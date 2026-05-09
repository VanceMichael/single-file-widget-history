const STORAGE_KEY = 'regex-lab-lang';
const DEFAULT_LANG = 'zh-CN';
const SUPPORTED_LANGS = ['zh-CN', 'en-US'];

let currentLang = DEFAULT_LANG;
let currentMessages = {};
let langChangeListeners = [];

/**
 * 获取当前语言
 * @returns {string} 当前语言代码
 */
export function getCurrentLang() {
  return currentLang;
}

/**
 * 获取支持的语言列表
 * @returns {string[]} 语言代码数组
 */
export function getSupportedLangs() {
  return [...SUPPORTED_LANGS];
}

/**
 * 加载语言包
 * @param {string} lang - 语言代码
 * @returns {Promise<Object>} 语言包消息对象
 */
async function loadLangFile(lang) {
  try {
    const response = await fetch(`./lang/${lang}.json`);
    if (!response.ok) {
      throw new Error(`Failed to load language file: ${lang}`);
    }
    return await response.json();
  } catch (error) {
    console.error('[i18n] Error loading language file:', error);
    return {};
  }
}

/**
 * 获取翻译文本
 * @param {string} key - 翻译键
 * @param {Object} [params] - 插值参数
 * @returns {string} 翻译后的文本
 */
export function t(key, params) {
  let value = currentMessages[key] || key;
  if (params) {
    return value.replace(/\{(\w+)\}/g, (_, k) => params[k] || `{${k}}`);
  }
  return value;
}

/**
 * 更新页面上所有带 data-i18n 属性的元素
 */
function updatePageText() {
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    el.textContent = t(key);
  });

  document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    const key = el.getAttribute('data-i18n-placeholder');
    el.placeholder = t(key);
  });

  document.querySelectorAll('[data-i18n-title]').forEach((el) => {
    const key = el.getAttribute('data-i18n-title');
    el.title = t(key);
  });
}

/**
 * 通知所有语言变更监听器
 */
function notifyListeners() {
  langChangeListeners.forEach((fn) => {
    try {
      fn(currentLang, currentMessages);
    } catch (e) {
      console.error('[i18n] Listener error:', e);
    }
  });
}

/**
 * 添加语言变更监听器
 * @param {(lang: string, messages: Object) => void} fn - 回调函数
 */
export function onLangChange(fn) {
  if (typeof fn === 'function') {
    langChangeListeners.push(fn);
  }
}

/**
 * 切换语言
 * @param {string} lang - 目标语言代码
 * @returns {Promise<string>} 切换后的语言代码
 */
export async function setLang(lang) {
  if (!SUPPORTED_LANGS.includes(lang)) {
    lang = DEFAULT_LANG;
  }

  if (lang === currentLang && Object.keys(currentMessages).length > 0) {
    return currentLang;
  }

  const messages = await loadLangFile(lang);
  if (Object.keys(messages).length === 0) {
    console.warn('[i18n] Empty language file, fallback to default');
    return currentLang;
  }

  currentLang = lang;
  currentMessages = messages;

  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch (e) {
    console.warn('[i18n] Failed to save language to localStorage:', e);
  }

  updatePageText();
  notifyListeners();

  return currentLang;
}

/**
 * 初始化 i18n 模块
 * @returns {Promise<string>} 初始化后的语言代码
 */
export async function initI18n() {
  let savedLang = null;
  try {
    savedLang = localStorage.getItem(STORAGE_KEY);
  } catch (e) {
    console.warn('[i18n] Failed to read language from localStorage:', e);
  }

  const initialLang = savedLang && SUPPORTED_LANGS.includes(savedLang)
    ? savedLang
    : DEFAULT_LANG;

  return await setLang(initialLang);
}
