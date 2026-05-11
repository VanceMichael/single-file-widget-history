const DB_NAME = 'RegexLabDB';
const DB_VERSION = 1;
const STORE_NAME = 'history';
const MAX_RECORDS = 50;

let db = null;
let saveDebounceTimer = null;

/**
 * 打开 IndexedDB 数据库
 * @returns {Promise<IDBDatabase>} 数据库实例
 */
function openDB() {
  return new Promise((resolve, reject) => {
    if (db) {
      resolve(db);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = event.target.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
  });
}

/**
 * 保存一条历史记录
 * @param {Object} data - 记录数据
 * @param {string} data.pattern - 正则表达式
 * @param {string} data.flags - 正则标志
 * @param {string} data.text - 测试文本
 * @returns {Promise<number>} 记录 ID
 */
async function saveRecord(data) {
  const database = await openDB();
  const transaction = database.transaction(STORE_NAME, 'readwrite');
  const store = transaction.objectStore(STORE_NAME);

  const record = {
    pattern: data.pattern || '',
    flags: data.flags || '',
    text: data.text || '',
    timestamp: Date.now()
  };

  return new Promise((resolve, reject) => {
    const request = store.add(record);
    request.onsuccess = () => {
      resolve(request.result);
      trimRecords();
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * 防抖保存记录
 * @param {Object} data - 记录数据
 * @param {number} [delay=1500] - 防抖延迟（毫秒）
 */
function debouncedSave(data, delay = 1500) {
  clearTimeout(saveDebounceTimer);
  saveDebounceTimer = setTimeout(() => {
    if (data.pattern || data.text) {
      saveRecord(data);
    }
  }, delay);
}

/**
 * 裁剪历史记录到最大数量
 * @returns {Promise<void>}
 */
async function trimRecords() {
  const all = await getAllRecords();
  if (all.length > MAX_RECORDS) {
    const toDelete = all.slice(MAX_RECORDS);
    for (const record of toDelete) {
      await deleteRecord(record.id);
    }
  }
}

/**
 * 获取所有历史记录（按时间倒序）
 * @returns {Promise<Array<Object>>} 历史记录数组
 */
async function getAllRecords() {
  const database = await openDB();
  const transaction = database.transaction(STORE_NAME, 'readonly');
  const store = transaction.objectStore(STORE_NAME);

  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => {
      const records = request.result.sort((a, b) => b.timestamp - a.timestamp);
      resolve(records);
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * 删除一条历史记录
 * @param {number} id - 记录 ID
 * @returns {Promise<void>}
 */
async function deleteRecord(id) {
  const database = await openDB();
  const transaction = database.transaction(STORE_NAME, 'readwrite');
  const store = transaction.objectStore(STORE_NAME);

  return new Promise((resolve, reject) => {
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * 清空所有历史记录
 * @returns {Promise<void>}
 */
async function clearAllRecords() {
  const database = await openDB();
  const transaction = database.transaction(STORE_NAME, 'readwrite');
  const store = transaction.objectStore(STORE_NAME);

  return new Promise((resolve, reject) => {
    const request = store.clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * 初始化历史模块
 * @returns {Promise<void>}
 */
async function initHistory() {
  await openDB();
}

export {
  initHistory,
  saveRecord,
  debouncedSave,
  getAllRecords,
  deleteRecord,
  clearAllRecords
};
