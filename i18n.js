/**
 * @typedef {Object} LangPack
 * @property {string} title
 * @property {string} themeToggle
 * @property {string} regexPlaceholder
 * @property {string} testText
 * @property {string} testTextPlaceholder
 * @property {string} matchHighlight
 * @property {string} matchResults
 * @property {string} noMatch
 * @property {string} matchCount
 * @property {string} historyTitle
 * @property {string} clearAll
 * @property {string} emptyHistory
 * @property {string} langZh
 * @property {string} langEn
 */

var cache = {};

/**
 * @param {string} lang
 * @returns {Promise<LangPack>}
 */
export async function loadLang(lang) {
  if (cache[lang]) return cache[lang];
  var resp = await fetch(lang + '.json');
  if (!resp.ok) throw new Error('Failed to load lang: ' + lang);
  var data = await resp.json();
  cache[lang] = data;
  return data;
}

/**
 * @param {LangPack} pack
 * @param {string} key
 * @param {Object.<string, string|number>} [params]
 * @returns {string}
 */
export function t(pack, key, params) {
  var val = pack[key] || key;
  if (params) {
    Object.keys(params).forEach(function (k) {
      val = val.replace('{' + k + '}', String(params[k]));
    });
  }
  return val;
}

/**
 * @param {LangPack} pack
 */
export function applyLang(pack) {
  document.querySelectorAll('[data-i18n]').forEach(function (el) {
    var key = el.getAttribute('data-i18n');
    el.textContent = t(pack, key);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(function (el) {
    var key = el.getAttribute('data-i18n-placeholder');
    el.placeholder = t(pack, key);
  });
  document.querySelectorAll('[data-i18n-title]').forEach(function (el) {
    var key = el.getAttribute('data-i18n-title');
    el.title = t(pack, key);
  });
  document.documentElement.lang = pack === cache['zh-CN'] ? 'zh-CN' : 'en';
}

/**
 * @returns {string}
 */
export function detectLang() {
  try {
    var saved = localStorage.getItem('regex-lab-lang');
    if (saved) return saved;
  } catch (e) {}
  var nav = navigator.language || '';
  return nav.startsWith('zh') ? 'zh-CN' : 'en';
}

/**
 * @param {string} lang
 */
export function saveLang(lang) {
  try {
    localStorage.setItem('regex-lab-lang', lang);
  } catch (e) {}
}
