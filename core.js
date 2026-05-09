import { t } from './i18n.js';

const GROUP_COLORS = ['g0', 'g1', 'g2', 'g3', 'g4', 'g5'];

/**
 * DOM 元素引用
 */
const elements = {
  regexInput: null,
  textInput: null,
  highlightLayer: null,
  matchCount: null,
  matchList: null,
  errMsg: null,
  flagsCheckboxes: null
};

let runDebounceTimer = null;

/**
 * HTML 转义
 * @param {string} s - 待转义字符串
 * @returns {string} 转义后的字符串
 */
export function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * 获取当前选中的标志位
 * @returns {string} 标志位字符串
 */
export function getFlags() {
  if (!elements.flagsCheckboxes) return '';
  let f = '';
  elements.flagsCheckboxes.forEach(function (cb) { if (cb.checked) f += cb.value; });
  return f;
}

/**
 * 构建匹配范围数组
 * @param {string} text - 测试文本
 * @param {RegExp} re - 正则表达式对象
 * @returns {Array<{start: number, end: number, groups: string[]}>} 匹配范围数组
 */
export function buildRanges(text, re) {
  var ranges = [];
  if (re.global) {
    var m;
    var guard = 0;
    while ((m = re.exec(text)) !== null) {
      if (++guard > 50000) break;
      if (m[0].length === 0) { re.lastIndex++; continue; }
      ranges.push({ start: m.index, end: m.index + m[0].length, groups: m.slice(1) });
      re.lastIndex = m.index + m[0].length;
    }
  } else {
    var m = re.exec(text);
    if (m) ranges.push({ start: m.index, end: m.index + m[0].length, groups: m.slice(1) });
  }
  return ranges;
}

/**
 * 渲染高亮层
 * @param {string} text - 测试文本
 * @param {Array<{start: number, end: number, groups: string[]}>} ranges - 匹配范围数组
 */
export function renderHighlight(text, ranges) {
  if (!elements.highlightLayer) return;
  if (!ranges.length) {
    elements.highlightLayer.innerHTML = escapeHtml(text);
    return;
  }
  var parts = [];
  var last = 0;
  for (var i = 0; i < ranges.length; i++) {
    var r = ranges[i];
    if (r.start > last) parts.push({ type: 'text', text: text.slice(last, r.start) });
    var colorIdx = i % GROUP_COLORS.length;
    parts.push({ type: 'hl', text: text.slice(r.start, r.end), cls: GROUP_COLORS[colorIdx] });
    last = r.end;
  }
  if (last < text.length) parts.push({ type: 'text', text: text.slice(last) });

  var html = '';
  for (var j = 0; j < parts.length; j++) {
    var p = parts[j];
    var safe = escapeHtml(p.text);
    if (p.type === 'hl') {
      html += '<span class="hl ' + p.cls + '">' + safe + '</span>';
    } else {
      html += safe;
    }
  }
  elements.highlightLayer.innerHTML = html;
}

/**
 * 渲染匹配结果列表
 * @param {Array<{start: number, end: number, groups: string[]}>} ranges - 匹配范围数组
 * @param {string} text - 测试文本
 */
export function renderResults(ranges, text) {
  if (!elements.matchCount || !elements.matchList) return;
  if (!ranges.length) {
    elements.matchCount.textContent = t('noMatch');
    elements.matchList.innerHTML = '';
    return;
  }
  elements.matchCount.textContent = t('matchCount', { count: ranges.length });
  var html = '';
  for (var i = 0; i < ranges.length; i++) {
    var r = ranges[i];
    var colorCls = GROUP_COLORS[i % GROUP_COLORS.length];
    html += '<div class="match-item">';
    html += '<span class="idx">#' + (i + 1) + '</span> ';
    html += '<span class="range">[' + r.start + ', ' + r.end + ')</span>';
    html += ' <code>' + escapeHtml(text.slice(r.start, r.end)) + '</code>';
    if (r.groups && r.groups.length) {
      for (var g = 0; g < r.groups.length; g++) {
        var gVal = r.groups[g];
        html += '<div class="group-row">';
        html += '<span class="group-label">$' + (g + 1) + ':</span> ';
        html += gVal !== undefined ? escapeHtml(gVal) : '<span class="group-label">undefined</span>';
        html += '</div>';
      }
    }
    html += '</div>';
  }
  elements.matchList.innerHTML = html;
}

/**
 * 执行正则匹配（带防抖）
 */
export function run() {
  clearTimeout(runDebounceTimer);
  runDebounceTimer = setTimeout(doRun, 80);
}

/**
 * 实际执行正则匹配
 * @returns {{pattern: string, flags: string, text: string}|null} 当前状态或 null
 */
export function doRun() {
  if (!elements.regexInput || !elements.textInput || !elements.errMsg) return null;
  var pattern = elements.regexInput.value;
  var flags = getFlags();
  var text = elements.textInput.value;
  elements.errMsg.textContent = '';

  if (!pattern) {
    renderHighlight(text, []);
    if (elements.matchCount) elements.matchCount.textContent = '';
    if (elements.matchList) elements.matchList.innerHTML = '';
    return { pattern, flags, text };
  }

  try {
    var re = new RegExp(pattern, flags);
  } catch (e) {
    if (elements.errMsg) elements.errMsg.textContent = e.message;
    renderHighlight(text, []);
    if (elements.matchCount) elements.matchCount.textContent = '';
    if (elements.matchList) elements.matchList.innerHTML = '';
    return { pattern, flags, text };
  }

  var ranges = buildRanges(text, re);
  renderHighlight(text, ranges);
  renderResults(ranges, text);

  return { pattern, flags, text };
}

/**
 * 恢复历史记录到输入框
 * @param {Object} record - 历史记录
 * @param {string} record.pattern - 正则表达式
 * @param {string} record.flags - 标志位
 * @param {string} record.text - 测试文本
 */
export function restoreRecord(record) {
  if (!elements.regexInput || !elements.textInput || !elements.flagsCheckboxes) return;

  elements.regexInput.value = record.pattern || '';
  elements.textInput.value = record.text || '';

  const flags = record.flags || '';
  elements.flagsCheckboxes.forEach(function (cb) {
    cb.checked = flags.indexOf(cb.value) !== -1;
  });

  doRun();
}

/**
 * 获取当前状态
 * @returns {{pattern: string, flags: string, text: string}} 当前状态
 */
export function getCurrentState() {
  return {
    pattern: elements.regexInput ? elements.regexInput.value : '',
    flags: getFlags(),
    text: elements.textInput ? elements.textInput.value : ''
  };
}

/**
 * 初始化核心模块
 * @param {Object} els - DOM 元素引用
 * @param {HTMLInputElement} els.regexInput - 正则输入框
 * @param {HTMLTextAreaElement} els.textInput - 测试文本输入框
 * @param {HTMLElement} els.highlightLayer - 高亮层
 * @param {HTMLElement} els.matchCount - 匹配计数
 * @param {HTMLElement} els.matchList - 匹配列表
 * @param {HTMLElement} els.errMsg - 错误信息
 * @param {NodeListOf<HTMLInputElement>} els.flagsCheckboxes - 标志位复选框
 * @param {(state: {pattern: string, flags: string, text: string}) => void} [onChange] - 状态变更回调
 */
export function initCore(els, onChange) {
  elements.regexInput = els.regexInput;
  elements.textInput = els.textInput;
  elements.highlightLayer = els.highlightLayer;
  elements.matchCount = els.matchCount;
  elements.matchList = els.matchList;
  elements.errMsg = els.errMsg;
  elements.flagsCheckboxes = els.flagsCheckboxes;

  if (elements.regexInput) {
    elements.regexInput.addEventListener('input', function () {
      run();
      if (onChange) onChange(getCurrentState());
    });
  }

  if (elements.textInput) {
    elements.textInput.addEventListener('input', function () {
      run();
      if (onChange) onChange(getCurrentState());
    });
  }

  if (elements.flagsCheckboxes) {
    elements.flagsCheckboxes.forEach(function (cb) {
      cb.addEventListener('change', function () {
        run();
        if (onChange) onChange(getCurrentState());
      });
    });
  }

  doRun();
}

/**
 * 刷新结果（用于语言切换时重新渲染文案）
 */
export function refreshResults() {
  doRun();
}
