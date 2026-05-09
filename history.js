const DB_NAME = 'RegexLabDB';
const DB_VERSION = 1;
const STORE_NAME = 'history';
const MAX_RECORDS = 50;
const DEBOUNCE_MS = 1500;

let db = null;
let dbInitPromise = null;
let saveTimer = null;
let changeListeners = [];

/**
 * 打开 IndexedDB 数据库
 * @returns {Promise<IDBDatabase>} 数据库实例
 */
function openDB() {
  if (db) {
    return Promise.resolve(db);
  }
  if (dbInitPromise) {
    return dbInitPromise;
  }

  dbInitPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(request.error);
    };

    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = event.target.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
  });

  return dbInitPromise;
}

/**
 * 生成唯一 ID
 * @returns {string} 唯一标识
 */
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/**
 * 通知所有变更监听器
 */
function notifyListeners() {
  changeListeners.forEach((fn) => {
    try {
      fn();
    } catch (e) {
      console.error('[history] Listener error:', e);
    }
  });
}

/**
 * 添加历史记录变更监听器
 * @param {() => void} fn - 回调函数
 */
export function onHistoryChange(fn) {
  if (typeof fn === 'function') {
    changeListeners.push(fn);
  }
}

/**
 * 检查两条记录是否内容相同
 * @param {Object} a - 记录 A
 * @param {Object} b - 记录 B
 * @returns {boolean} 是否相同
 */
function isSameRecord(a, b) {
  return a.pattern === b.pattern &&
    a.flags === b.flags &&
    a.text === b.text;
}

/**
 * 保存一条历史记录
 * @param {Object} data - 记录数据
 * @param {string} data.pattern - 正则表达式
 * @param {string} data.flags - 标志位
 * @param {string} data.text - 测试文本
 * @returns {Promise<void>}
 */
export async function saveHistory(data) {
  if (!data.pattern && !data.text) {
    return;
  }

  const database = await openDB();

  const existingRecords = await getAllHistory();
  if (existingRecords.length > 0) {
    const latest = existingRecords[0];
    if (isSameRecord(latest, data)) {
      return;
    }
  }

  const record = {
    id: generateId(),
    pattern: data.pattern || '',
    flags: data.flags || '',
    text: data.text || '',
    timestamp: Date.now()
  };

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    store.add(record);

    transaction.oncomplete = () => {
      enforceMaxRecords(database).then(() => {
        notifyListeners();
        resolve();
      }).catch(reject);
    };

    transaction.onerror = () => {
      reject(transaction.error);
    };
  });
}

/**
 * 强制保持最大记录数限制
 * @param {IDBDatabase} database - 数据库实例
 * @returns {Promise<void>}
 */
function enforceMaxRecords(database) {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index('timestamp');
    const countRequest = store.count();

    countRequest.onsuccess = () => {
      const count = countRequest.result;
      if (count <= MAX_RECORDS) {
        resolve();
        return;
      }

      const deleteCount = count - MAX_RECORDS;
      const cursorRequest = index.openCursor(null, 'next');
      let deleted = 0;

      cursorRequest.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor && deleted < deleteCount) {
          cursor.delete();
          deleted++;
          cursor.continue();
        } else {
          resolve();
        }
      };

      cursorRequest.onerror = () => reject(cursorRequest.error);
    };

    countRequest.onerror = () => reject(countRequest.error);
  });
}

/**
 * 防抖保存历史记录
 * @param {Object} data - 记录数据
 * @param {string} data.pattern - 正则表达式
 * @param {string} data.flags - 标志位
 * @param {string} data.text - 测试文本
 */
export function debouncedSaveHistory(data) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveHistory(data).catch((e) => {
      console.error('[history] Failed to save history:', e);
    });
  }, DEBOUNCE_MS);
}

/**
 * 获取所有历史记录（按时间倒序）
 * @returns {Promise<Object[]>} 历史记录数组
 */
export async function getAllHistory() {
  const database = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index('timestamp');
    const request = index.openCursor(null, 'prev');
    const results = [];

    request.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        results.push(cursor.value);
        cursor.continue();
      } else {
        resolve(results);
      }
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

/**
 * 删除单条历史记录
 * @param {string} id - 记录 ID
 * @returns {Promise<void>}
 */
export async function deleteHistory(id) {
  const database = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => {
      notifyListeners();
      resolve();
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

/**
 * 清空所有历史记录
 * @returns {Promise<void>}
 */
export async function clearAllHistory() {
  const database = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.clear();

    request.onsuccess = () => {
      notifyListeners();
      resolve();
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

/**
 * 初始化历史记录模块
 * @returns {Promise<void>}
 */
export async function initHistory() {
  await openDB();
}
