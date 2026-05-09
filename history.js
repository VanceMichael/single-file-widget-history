/**
 * @typedef {Object} HistoryEntry
 * @property {number} id
 * @property {string} pattern
 * @property {string} flags
 * @property {string} testText
 * @property {number} createdAt
 */

var DB_NAME = 'regex-lab-history';
var STORE = 'entries';
var MAX_ENTRIES = 50;
var SAVE_DELAY = 3000;

var db = null;
var saveTimer = null;

/**
 * @returns {Promise<IDBDatabase>}
 */
function openDB() {
  if (db) return Promise.resolve(db);
  return new Promise(function (resolve, reject) {
    var req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = function () {
      var s = req.result.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
      s.createIndex('createdAt', 'createdAt');
    };
    req.onsuccess = function () {
      db = req.result;
      resolve(db);
    };
    req.onerror = function () { reject(req.error); };
  });
}

/**
 * @param {string} pattern
 * @param {string} flags
 * @param {string} testText
 * @returns {Promise<void>}
 */
export async function saveEntry(pattern, flags, testText) {
  var database = await openDB();
  return new Promise(function (resolve, reject) {
    var tx = database.transaction(STORE, 'readwrite');
    var store = tx.objectStore(STORE);
    store.add({ pattern: pattern, flags: flags, testText: testText, createdAt: Date.now() });
    tx.oncomplete = function () { prune(database).then(resolve, resolve); };
    tx.onerror = function () { reject(tx.error); };
  });
}

/**
 * @param {IDBDatabase} database
 * @returns {Promise<void>}
 */
function prune(database) {
  return new Promise(function (resolve) {
    var tx = database.transaction(STORE, 'readwrite');
    var store = tx.objectStore(STORE);
    var countReq = store.count();
    countReq.onsuccess = function () {
      var excess = countReq.result - MAX_ENTRIES;
      if (excess <= 0) { resolve(); return; }
      var idx = store.index('createdAt');
      var cursorReq = idx.openCursor();
      var deleted = 0;
      cursorReq.onsuccess = function (e) {
        var cursor = e.target.result;
        if (cursor && deleted < excess) {
          cursor.delete();
          deleted++;
          cursor.continue();
        } else {
          resolve();
        }
      };
      cursorReq.onerror = function () { resolve(); };
    };
    countReq.onerror = function () { resolve(); };
  });
}

/**
 * @returns {Promise<HistoryEntry[]>}
 */
export async function getAllEntries() {
  var database = await openDB();
  return new Promise(function (resolve, reject) {
    var tx = database.transaction(STORE, 'readonly');
    var store = tx.objectStore(STORE);
    var idx = store.index('createdAt');
    var req = idx.getAll();
    req.onsuccess = function () { resolve(req.result.reverse()); };
    req.onerror = function () { reject(req.error); };
  });
}

/**
 * @param {number} id
 * @returns {Promise<void>}
 */
export async function deleteEntry(id) {
  var database = await openDB();
  return new Promise(function (resolve, reject) {
    var tx = database.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = function () { resolve(); };
    tx.onerror = function () { reject(tx.error); };
  });
}

/**
 * @returns {Promise<void>}
 */
export async function clearAll() {
  var database = await openDB();
  return new Promise(function (resolve, reject) {
    var tx = database.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).clear();
    tx.oncomplete = function () { resolve(); };
    tx.onerror = function () { reject(tx.error); };
  });
}

/**
 * @param {() => {pattern:string, flags:string, testText:string}} getState
 * @param {() => void} [onSaved]
 */
export function startAutoSave(getState, onSaved) {
  stopAutoSave();
  saveTimer = setInterval(function () {
    var s = getState();
    if (!s.pattern && !s.testText) return;
    saveEntry(s.pattern, s.flags, s.testText).then(function () {
      if (onSaved) onSaved();
    });
  }, SAVE_DELAY);
}

/**
 */
export function stopAutoSave() {
  if (saveTimer) { clearInterval(saveTimer); saveTimer = null; }
}

/**
 * @param {() => {pattern:string, flags:string, testText:string}} getState
 * @param {() => void} [onSaved]
 */
export function debounceSave(getState, onSaved) {
  stopAutoSave();
  saveTimer = setTimeout(function () {
    var s = getState();
    if (!s.pattern && !s.testText) { startAutoSave(getState, onSaved); return; }
    saveEntry(s.pattern, s.flags, s.testText).then(function () {
      if (onSaved) onSaved();
      startAutoSave(getState, onSaved);
    });
  }, SAVE_DELAY);
}
