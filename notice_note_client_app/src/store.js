// 手机端本地数据中枢（经典脚本，全局 NoticeNoteStore）。
// 职责：IndexedDB 读写、快照与附件 URL 缓存、待回传变更（dirty）追踪、
// 同步连接信息与 AI 判定配置（localStorage）。
// 笔记/日历/回顾/记忆四个 Tab 与同步客户端都从这里取数据，不各自开库。
const NoticeNoteStore = (() => {
  'use strict';

  const DB_NAME = 'notice-note-offline';
  const DB_VERSION = 1;
  const SNAPSHOT_STORE = 'snapshot';
  const ASSET_STORE = 'assets';
  const CONNECTION_KEY = 'notice-note-mobile-connection';
  const AI_CONFIG_KEY = 'notice-note-mobile-ai';
  const DIRTY_KEY = 'notice-note-mobile-dirty';

  let databasePromise = null;
  let library = null;
  const assetUrls = new Map();

  function openDatabase() {
    if (databasePromise) {
      return databasePromise;
    }
    databasePromise = new Promise((resolve, reject) => {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(SNAPSHOT_STORE)) {
          database.createObjectStore(SNAPSHOT_STORE);
        }
        if (!database.objectStoreNames.contains(ASSET_STORE)) {
          database.createObjectStore(ASSET_STORE);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('无法打开手机本地数据库'));
    });
    return databasePromise;
  }

  async function readValue(storeName, key) {
    const database = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(storeName, 'readonly');
      const request = transaction.objectStore(storeName).get(key);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error || new Error('读取手机本地文件失败'));
    });
  }

  function releaseAssetUrls() {
    for (const url of assetUrls.values()) {
      URL.revokeObjectURL(url);
    }
    assetUrls.clear();
  }

  async function loadAssetUrls(snapshot) {
    releaseAssetUrls();
    for (const asset of snapshot?.assets || []) {
      const blob = await readValue(ASSET_STORE, asset.source);
      if (blob instanceof Blob) {
        assetUrls.set(asset.source, URL.createObjectURL(blob));
      }
    }
  }

  // 读快照并归一化文件夹语义（离线包/同步内容都是明文，isUnlocked 恒 false）。
  async function loadSnapshot() {
    const snapshot = await readValue(SNAPSHOT_STORE, 'current');
    if (!snapshot) {
      return null;
    }
    snapshot.folders = (snapshot.folders || []).map(window.NoticeNoteMobileUtils.normalizeMobileFolder);
    await loadAssetUrls(snapshot);
    return snapshot;
  }

  // 附件写入 + 快照写入 + 旧附件清理放进同一个跨 store 事务：
  // 任一步失败整体回滚，旧快照引用的附件不会被部分覆盖（与离线包导入同保障）。
  async function runAssetTransaction({ puts = [], removedKeys = [], snapshot }) {
    const database = await openDatabase();
    await new Promise((resolve, reject) => {
      const transaction = database.transaction([ASSET_STORE, SNAPSHOT_STORE], 'readwrite');
      const assetStore = transaction.objectStore(ASSET_STORE);
      const snapshotStore = transaction.objectStore(SNAPSHOT_STORE);
      for (const item of puts) {
        assetStore.put(item.blob, item.key);
      }
      if (snapshot) {
        snapshotStore.put(snapshot, 'current');
      }
      for (const key of removedKeys) {
        assetStore.delete(key);
      }
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error('写入手机本地数据失败'));
      transaction.onabort = () => reject(transaction.error || new Error('写入手机本地数据已中止'));
    });
  }

  function getLibrary() {
    return library;
  }

  function setLibrary(next) {
    library = next;
  }

  function resolveImageUrl(url) {
    const trimmed = String(url || '').trim();
    if (trimmed.startsWith('mobile-image://')) {
      const relPath = trimmed.slice('mobile-image://'.length);
      return assetUrls.get(decodeURIComponent(relPath)) || '';
    }
    return trimmed;
  }

  function notifyLibraryChanged() {
    window.dispatchEvent(new CustomEvent('nn-library-changed'));
  }

  // 复习文件的归档天：同步清单直接带 dayKey；离线包没有，用 reviewDate / createdAt 兜底。
  function getItemDayKey(item) {
    if (!item) {
      return '';
    }
    if (typeof item.dayKey === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(item.dayKey)) {
      return item.dayKey;
    }
    if (!item.isReviewFile) {
      return '';
    }
    if (typeof item.reviewDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(item.reviewDate)) {
      return item.reviewDate;
    }
    const time = Date.parse(item.createdAt);
    return Number.isFinite(time) ? window.NoticeNoteDateUtils.toLocalDateKey(new Date(time)) : '';
  }

  function randomId() {
    if (window.crypto?.randomUUID) {
      return window.crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
      const rand = Math.random() * 16 | 0;
      return (char === 'x' ? rand : (rand & 0x3 | 0x8)).toString(16);
    });
  }

  // ---- 待回传变更（dirty）----
  // 手机是纯客户端：本地只改卡片调度、作答历史、回顾状态三类。
  // 改动先记在这里，同步时先 POST /api/merge 回传，成功后清空，再拉权威清单。
  function emptyDirty() {
    return { cardIds: [], answerIds: [], reviewDays: [], reviewLogIds: [] };
  }

  function getDirty() {
    try {
      const raw = JSON.parse(window.localStorage.getItem(DIRTY_KEY) || 'null');
      if (!raw || typeof raw !== 'object') {
        return emptyDirty();
      }
      return {
        cardIds: Array.isArray(raw.cardIds) ? raw.cardIds : [],
        answerIds: Array.isArray(raw.answerIds) ? raw.answerIds : [],
        reviewDays: Array.isArray(raw.reviewDays) ? raw.reviewDays : [],
        reviewLogIds: Array.isArray(raw.reviewLogIds) ? raw.reviewLogIds : []
      };
    } catch {
      return emptyDirty();
    }
  }

  function saveDirty(dirty) {
    window.localStorage.setItem(DIRTY_KEY, JSON.stringify(dirty));
  }

  function addToDirty(field, id) {
    if (!id) {
      return;
    }
    const dirty = getDirty();
    if (!dirty[field].includes(id)) {
      dirty[field].push(id);
      saveDirty(dirty);
    }
  }

  function clearDirty() {
    saveDirty(emptyDirty());
  }

  function hasDirty() {
    const dirty = getDirty();
    return dirty.cardIds.length + dirty.answerIds.length
      + dirty.reviewDays.length + dirty.reviewLogIds.length > 0;
  }

  // ---- 同步连接信息（localStorage）----
  function getConnection() {
    try {
      const raw = JSON.parse(window.localStorage.getItem(CONNECTION_KEY) || 'null');
      if (!raw || typeof raw !== 'object' || typeof raw.token !== 'string' || !raw.token) {
        return null;
      }
      return raw;
    } catch {
      return null;
    }
  }

  function saveConnection(connection) {
    if (!connection) {
      window.localStorage.removeItem(CONNECTION_KEY);
      return;
    }
    window.localStorage.setItem(CONNECTION_KEY, JSON.stringify(connection));
  }

  // ---- AI 判定配置（localStorage，Key 只存手机本机，不从 PC 同步）----
  function getAiConfig() {
    try {
      const raw = JSON.parse(window.localStorage.getItem(AI_CONFIG_KEY) || 'null');
      return window.NoticeNoteAiJudge.normalizeAiJudgeConfig(raw || {});
    } catch {
      return window.NoticeNoteAiJudge.normalizeAiJudgeConfig({});
    }
  }

  function saveAiConfig(input) {
    const config = window.NoticeNoteAiJudge.normalizeAiJudgeConfig(input);
    window.localStorage.setItem(AI_CONFIG_KEY, JSON.stringify(config));
    return config;
  }

  return {
    DB_NAME,
    SNAPSHOT_STORE,
    ASSET_STORE,
    openDatabase,
    readValue,
    loadSnapshot,
    runAssetTransaction,
    getLibrary,
    setLibrary,
    assetUrls,
    resolveImageUrl,
    notifyLibraryChanged,
    getItemDayKey,
    randomId,
    getDirty,
    addToDirty,
    clearDirty,
    hasDirty,
    getConnection,
    saveConnection,
    getAiConfig,
    saveAiConfig
  };
})();