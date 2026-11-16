process.noDeprecation = true;
const {
  app,
  BrowserWindow,
  ipcMain,
  Notification,
  dialog,
  Menu,
  Tray,
  clipboard,
  shell
} = require('electron');
const path = require('node:path');
const { createReadStream, createWriteStream, watch, constants: fsConstants } = require('node:fs');
const fs = require('node:fs/promises');
const { finished } = require('node:stream/promises');
const {
  createHash,
  randomBytes,
  randomUUID,
  scryptSync,
  timingSafeEqual
} = require('node:crypto');
const { pathToFileURL, fileURLToPath } = require('node:url');
const matter = require('gray-matter');
const mammoth = require('mammoth');
const WordExtractor = require('word-extractor');
const ExcelJS = require('exceljs');
const {
  pathExists,
  atomicWriteFile,
  atomicWriteJson,
  readJsonWithCorruptFallback
} = require('./lib/fs-utils');
const {
  DAILY_REMINDER_TIMES,
  AUTO_REMINDER_DAY_OFFSETS,
  getLatestDateTime,
  toLocalDateKey,
  addDays,
  isValidReviewDate
} = require('./lib/date-utils');
const {
  createEmptyNote,
  getNoteFileExtension,
  normalizeNote,
  normalizeLoadedNote
} = require('./lib/note-normalize');
const {
  serializeSpreadsheetCell,
  getSpreadsheetMergeMap,
  escapeHtml
} = require('./lib/spreadsheet-utils');
const {
  MAX_REMOTE_IMAGE_BYTES,
  isPathInside,
  downloadRemoteImage,
  getMimeType
} = require('./lib/remote-image');
const {
  sanitizeFileName,
  sanitizeNoteFilename,
  sanitizeFolderName,
  isInternalFolderName,
  shouldSkipScanEntry
} = require('./lib/sanitize');
const {
  RESOURCE_METADATA_FILE_NAME,
  createResourceMetadataEntry,
  applyResourceMetadata,
  moveResourceMetadataTree,
  deleteResourceMetadataTree,
  loadResourceMetadataFile,
  saveResourceMetadataFile
} = require('./lib/resource-metadata');
const {
  sortReviewQueue,
  moveInQueue,
  pruneReviewOrder
} = require('./lib/review-queue');
const {
  mergeSidebarOrder,
  moveSidebarEntry
} = require('./lib/sidebar-order');
const {
  buildDefaultReviewDayOrder,
  normalizeReviewDayOrder
} = require('./lib/review-day-order');
const { ensureReviewFolder } = require('./lib/review-folder');
const {
  buildDayReminderNotice
} = require('./lib/review-reminder-policy');
const registerNotesIpc = require('./ipc/notes');
const registerFoldersIpc = require('./ipc/folders');
const registerFilesIpc = require('./ipc/files');
const registerImagesIpc = require('./ipc/images');
const registerStorageIpc = require('./ipc/storage');
const registerLibraryIpc = require('./ipc/library');

const NOTES_DIR_NAME = 'notes';
const OLD_NOTE_FILE_NAME = 'notes.json';
const CONFIG_FILE_NAME = 'config.json';
const REMINDER_CHECK_INTERVAL = 30 * 1000;
const IMAGE_ASSET_DIR_NAME = 'notice_note_images';
const APP_DATA_DIR_NAME = '.notice-note';
const NOTE_METADATA_FILE_NAME = 'metadata.json';
const FOLDER_METADATA_FILE_NAME = 'folders.json';
const NOTE_BACKUP_DIR_NAME = 'backups';
const OBSOLETE_MOBILE_IMAGE_CACHE_DIR_NAME = 'mobile-image-cache';
// 回顾文件夹：该文件夹（含子文件夹）内的文件只出现在「回顾」Tab，不在「全部」显示
const REVIEW_FOLDER_NAME = '.study_notice';
const LEGACY_REVIEW_FOLDER_NAME = 'study_notice';
const MOBILE_EXPORT_EXTENSION = 'notice-note-mobile';
const MOBILE_PACKAGE_MAGIC = Buffer.from('NNMOBILE', 'ascii');
const MOBILE_PACKAGE_VERSION = 2;
const APP_ICON_PATH = path.join(__dirname, 'assets', 'tray.png');

let mainWindow;
let tray;
let notes = [];
let folders = [];
let pdfFiles = [];
let resourceFiles = [];
let reminderTimer;
let pdfReloadTimer;
let pdfWatcher;
let noteReloadTimer;
let notesPath;
let isQuitting = false;
let noteLoadPromise = null;
let resourceLoadPromise = null;
let noteFileMap = new Map(); // noteId -> filePath
let noteMetadata = {};
// 资源文件的归天日期：key 为相对路径，落盘到 .notice-note/resource-metadata.json
let resourceMetadata = {};
let folderMetadata = {};
let internalNoteWrites = new Map();
let dailyReviewEnabled = true;
let dailyReviewSelection = { date: null, entryKey: null };
let dailyReviewHistory = {};
// 手动调整过的回顾顺序（dayKey 数组）。排在前面的先推；不在数组里的按历史排序。
let dailyReviewOrder = [];
// 侧边栏手动顺序：folder / note / file 三组 id 数组。
// 只决定「同组内部」先后，目录永远在笔记之前、笔记在资源文件之前的分组不变。
// 空数组 = 完全按默认规则（文件夹扫描序 / 笔记创建时间 + 今日回顾置顶 / 资源扫描序）。
let sidebarOrder = { folders: [], notes: [], files: [] };
// 回顾面板「当天文件」的手动顺序：{ '2026-11-16': ['note:id', 'file:id'] }。
// 只决定这一天内部谁先谁后，不影响「推哪一天」（那是 dailyReviewOrder 的事）。
let reviewDayOrder = {};
let dailyReviewHandledDate = null;
let dailyReviewDeferred = { date: null, entryKey: null };
let reviewDatePrefillDone = false;
// 天级提醒：一条记录 = 「某一天的内容」在「某个复习日」提醒一次
// dayKey 是内容归属的那一天，date 是复习日；旧版 note.reminders 仅作历史数据保留，不再参与调度
let dayReminders = [];
let dayRemindersMigrated = false;
// 回顾事件日志：只在用户真的点「完成回顾」时追加，供日历展示。
// 与 dailyReviewHistory 分开——后者是自动选天的排序锚点（每套只存最后一次），不是事件。
let dayReviewLog = [];
const DAY_REVIEW_LOG_LIMIT = 1000;
const unlockedFolderIds = new Set();
// 启动时补发「错过的复习日」汇总通知，按本地日期去重，避免反复打扰
let missedReminderNoticeDate = null;
let pendingMissedReminderNotice = null;
let quitCheckInProgress = false;

if (process.platform === 'win32') {
  app.setAppUserModelId('com.notice-note.app');
}

const gotSingleInstanceLock = app.requestSingleInstanceLock();

if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (app.isReady()) {
      showMainWindow();
      return;
    }
    app.whenReady().then(showMainWindow);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 900,
    minHeight: 620,
    title: 'Notice Note',
    icon: APP_ICON_PATH,
    backgroundColor: '#f7f5f0',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  // 渲染层全部是本地页面：禁止弹新窗口，禁止导航到应用目录之外。
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  const appFileRoot = pathToFileURL(`${__dirname}${path.sep}`).href;
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!String(url || '').startsWith(appFileRoot)) {
      event.preventDefault();
    }
  });
  mainWindow.webContents.on('will-frame-navigate', (event) => {
    if (!String(event.url || '').startsWith(appFileRoot)) {
      event.preventDefault();
    }
  });

  mainWindow.on('close', (event) => {
    if (isQuitting) {
      return;
    }

    event.preventDefault();
    mainWindow.hide();
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));
}

// 退出前统一询问：托盘退出、菜单退出、系统关机都走这里。
// 渲染层提供 noticeNoteGetDirtySummary / noticeNoteSaveAllForQuit / noticeNoteFlushForQuit。
async function readRendererValue(expression, fallback) {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return fallback;
  }
  try {
    const value = await mainWindow.webContents.executeJavaScript(expression);
    return value === undefined || value === null ? fallback : value;
  } catch (error) {
    console.error('读取渲染层状态失败:', expression, error);
    return fallback;
  }
}

async function requestQuit() {
  if (quitCheckInProgress) {
    return;
  }
  quitCheckInProgress = true;
  try {
    const summary = await readRendererValue('window.noticeNoteGetDirtySummary?.()', { count: 0 });
    const dirtyCount = Number(summary?.count) || 0;
    if (dirtyCount > 0) {
      const protectedCount = Number(summary?.protectedCount) || 0;
      const detail = protectedCount > 0
        ? `其中 ${protectedCount} 篇位于密码保护目录，退出后无法从恢复日志找回。`
        : '未保存内容会写入恢复日志，下次启动可继续编辑。';
      const { response } = await dialog.showMessageBox(mainWindow, {
        type: 'warning',
        buttons: ['保存并退出', '不保存直接退出', '取消'],
        defaultId: 0,
        cancelId: 2,
        title: '还有未保存的内容',
        message: `有 ${dirtyCount} 篇笔记尚未保存`,
        detail
      });
      if (response === 2) {
        return;
      }
      if (response === 0) {
        const saved = await readRendererValue('window.noticeNoteSaveAllForQuit?.()', false);
        if (!saved) {
          showMainWindow();
          dialog.showErrorBox('退出前保存失败', '有笔记未能写盘，应用保持运行，请先手动保存或检查磁盘权限。');
          return;
        }
      }
    }
    await readRendererValue('window.noticeNoteFlushForQuit?.()', null);
    isQuitting = true;
    app.quit();
  } catch (error) {
    showMainWindow();
    dialog.showErrorBox('退出前保存失败', `笔记尚未安全保存，应用未退出：${error.message}`);
  } finally {
    quitCheckInProgress = false;
  }
}

function showMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow();
    return;
  }

  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }

  mainWindow.show();
  mainWindow.focus();
}

function createTray() {
  if (tray) {
    return;
  }

  tray = new Tray(APP_ICON_PATH);
  tray.setToolTip('Notice Note');
  tray.setContextMenu(Menu.buildFromTemplate([
    {
      label: '显示 Notice Note',
      click: showMainWindow
    },
    {
      type: 'separator'
    },
    {
      label: '退出',
      click: () => requestQuit()
    }
  ]));
  tray.on('click', showMainWindow);
  tray.on('double-click', showMainWindow);
}

function getNotesPath() {
  return notesPath || getDefaultNotesPath();
}

function getDefaultNotesPath() {
  return path.join(app.getPath('userData'), NOTES_DIR_NAME);
}

function getOldNotesJsonPath() {
  return path.join(app.getPath('userData'), OLD_NOTE_FILE_NAME);
}

function getConfigPath() {
  return path.join(app.getPath('userData'), CONFIG_FILE_NAME);
}

function getImageAssetDir() {
  const now = new Date();
  const dateFolder = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  return path.join(getAppDataPath(), IMAGE_ASSET_DIR_NAME, dateFolder);
}

function getAppDataPath() {
  return path.join(getNotesPath(), APP_DATA_DIR_NAME);
}

function getNoteMetadataPath() {
  return path.join(getAppDataPath(), NOTE_METADATA_FILE_NAME);
}

function getResourceMetadataFilePath() {
  return path.join(getAppDataPath(), RESOURCE_METADATA_FILE_NAME);
}

function getFolderMetadataPath() {
  return path.join(getAppDataPath(), FOLDER_METADATA_FILE_NAME);
}

function getFolderMetadataKey(folderPath) {
  return path.relative(getNotesPath(), folderPath).split(path.sep).join('/');
}

async function loadFolderMetadata() {
  // 元数据损坏时备份原文件并重建，笔记/文件夹本身仍可从磁盘扫描出来。
  const parsed = await readJsonWithCorruptFallback(getFolderMetadataPath(), {});
  folderMetadata = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
}

async function saveFolderMetadata() {
  const nextMetadata = {};
  for (const folder of folders) {
    const folderPath = getFolderPath(folder.id);
    nextMetadata[getFolderMetadataKey(folderPath)] = { ...folder };
  }
  await atomicWriteJson(getFolderMetadataPath(), nextMetadata);
  folderMetadata = nextMetadata;
}

async function removeObsoleteMobileImageCache() {
  await fs.rm(path.join(getAppDataPath(), OBSOLETE_MOBILE_IMAGE_CACHE_DIR_NAME), {
    recursive: true,
    force: true
  });
}

function getNoteMetadataKey(filePath) {
  return path.relative(getNotesPath(), filePath).split(path.sep).join('/');
}

function isReviewFolderName(name) {
  return name === REVIEW_FOLDER_NAME;
}

// 文件夹自身或任意祖先为回顾文件夹时，其内容属于回顾文件
function isReviewFolderId(folderId) {
  let current = folderId
    ? folders.find((folder) => folder.id === folderId)
    : null;
  while (current) {
    if (current.isReviewFolder) {
      return true;
    }
    current = current.parentId
      ? folders.find((folder) => folder.id === current.parentId)
      : null;
  }
  return false;
}

// 回顾日期：YYYY-MM-DD，缺省时按创建时间归天。
// isValidReviewDate 由 lib/date-utils 提供（主进程与渲染层/测试共用同一份规则）。

function getNoteReviewDayKey(note) {
  if (isValidReviewDate(note?.reviewDate)) {
    return note.reviewDate;
  }
  const created = note?.createdAt ? new Date(note.createdAt) : null;
  return created && !Number.isNaN(created.getTime()) ? toLocalDateKey(created) : null;
}

function getResourceReviewDayKey(file) {
  if (isValidReviewDate(file?.reviewDate)) {
    return file.reviewDate;
  }
  const created = file?.createdAt ? new Date(file.createdAt) : null;
  return created && !Number.isNaN(created.getTime()) ? toLocalDateKey(created) : null;
}

function markInternalNoteWrite(filePath, content) {
  if (content === undefined) {
    return;
  }
  const key = getNoteMetadataKey(filePath).toLowerCase();
  const expiresAt = Date.now() + 5000;
  const hash = createHash('sha256').update(content).digest('hex');
  internalNoteWrites.set(key, { expiresAt, hash });
  setTimeout(() => {
    if (internalNoteWrites.get(key)?.expiresAt === expiresAt) {
      internalNoteWrites.delete(key);
    }
  }, 5100);
}

async function isExpectedInternalNoteWrite(filePath, key) {
  const expected = internalNoteWrites.get(key);
  if (!expected || expected.expiresAt <= Date.now()) {
    internalNoteWrites.delete(key);
    return false;
  }
  try {
    const content = await fs.readFile(filePath);
    const hash = createHash('sha256').update(content).digest('hex');
    if (hash === expected.hash) {
      // 一次原子写入可能触发多次监听事件，保留标记以便全部忽略。
      return true;
    }
  } catch {
    // 原子替换期间目标文件可能短暂不存在，保留标记等待后续事件。
    return true;
  }
  internalNoteWrites.delete(key);
  return false;
}

// 扫描时跳过所有点目录（.git / .notice-note / 系统元数据等），
// 只有回顾目录 .study_notice 单独放行，否则它会被当成内部目录而脱离回顾体系。
function isInternalDirectory(name) {
  return shouldSkipScanEntry(name, true, REVIEW_FOLDER_NAME);
}

async function loadNoteMetadata() {
  const parsed = await readJsonWithCorruptFallback(getNoteMetadataPath(), {});
  noteMetadata = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
}

async function saveNoteMetadata() {
  await atomicWriteJson(getNoteMetadataPath(), noteMetadata);
}

async function loadResourceMetadata() {
  resourceMetadata = await loadResourceMetadataFile(getResourceMetadataFilePath());
}

async function saveResourceMetadata() {
  await saveResourceMetadataFile(getResourceMetadataFilePath(), resourceMetadata);
}

function setResourceMetadata(filePath, file) {
  resourceMetadata[getNoteMetadataKey(filePath)] = createResourceMetadataEntry(file);
}

function deleteResourceMetadata(filePath) {
  delete resourceMetadata[getNoteMetadataKey(filePath)];
}

function setNoteMetadata(filePath, note, fileId = null) {
  const metadataKey = getNoteMetadataKey(filePath);
  noteMetadata[metadataKey] = {
    id: note.id,
    title: note.title,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
    reminders: note.reminders,
    reviewDate: typeof note.reviewDate === 'string' ? note.reviewDate : null,
    fileId: fileId || noteMetadata[metadataKey]?.fileId || null
  };
}

function moveNoteMetadata(oldPath, newPath) {
  const oldKey = getNoteMetadataKey(oldPath);
  const newKey = getNoteMetadataKey(newPath);
  if (noteMetadata[oldKey]) {
    noteMetadata[newKey] = noteMetadata[oldKey];
    delete noteMetadata[oldKey];
  }
}

function moveNoteMetadataTree(oldPath, newPath) {
  const oldPrefix = `${getNoteMetadataKey(oldPath).replace(/\/$/, '')}/`;
  const newPrefix = `${getNoteMetadataKey(newPath).replace(/\/$/, '')}/`;
  for (const key of Object.keys(noteMetadata)) {
    if (key.startsWith(oldPrefix)) {
      noteMetadata[`${newPrefix}${key.slice(oldPrefix.length)}`] = noteMetadata[key];
      delete noteMetadata[key];
    }
  }

  for (const [noteId, filePath] of noteFileMap) {
    const relativePath = path.relative(oldPath, filePath);
    if (!relativePath.startsWith('..') && !path.isAbsolute(relativePath)) {
      noteFileMap.set(noteId, path.join(newPath, relativePath));
    }
  }
}

function deleteNoteMetadataTree(folderPath) {
  const prefix = `${getNoteMetadataKey(folderPath).replace(/\/$/, '')}/`;
  for (const key of Object.keys(noteMetadata)) {
    if (key.startsWith(prefix)) {
      delete noteMetadata[key];
    }
  }
}

async function backupLegacyMarkdown(filePath, content) {
  const relativePath = path.relative(getNotesPath(), filePath);
  const backupPath = path.join(getAppDataPath(), NOTE_BACKUP_DIR_NAME, relativePath);
  try {
    await fs.access(backupPath);
  } catch {
    await fs.mkdir(path.dirname(backupPath), { recursive: true });
    markInternalNoteWrite(backupPath, content);
    await atomicWriteFile(backupPath, content, { encoding: 'utf8' });
  }
}

function getFolderPath(folderId) {
  if (!folderId) return getNotesPath();
  const folder = folders.find(f => f.id === folderId);
  if (!folder) return getNotesPath();

  const parts = [];
  let current = folder;
  while (current) {
    parts.unshift(current.name);
    current = folders.find(f => f.id === current.parentId);
  }
  return path.join(getNotesPath(), ...parts);
}

async function getUniqueFilePath(dir, baseName, extension = '.md') {
  let filePath = path.join(dir, `${baseName}${extension}`);
  try {
    await fs.access(filePath);
  } catch {
    return filePath;
  }

  let counter = 2;
  while (counter < 1000) {
    filePath = path.join(dir, `${baseName}(${counter})${extension}`);
    try {
      await fs.access(filePath);
    } catch {
      return filePath;
    }
    counter++;
  }
  return path.join(dir, `${baseName}-${Date.now()}${extension}`);
}

function getImageExtension(fileName, mimeType) {
  const fromName = path.extname(fileName || '').toLowerCase();
  const allowedExtensions = new Set(['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.svg']);
  if (allowedExtensions.has(fromName)) {
    return fromName;
  }

  const mimeMap = {
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/gif': '.gif',
    'image/bmp': '.bmp',
    'image/webp': '.webp',
    'image/svg+xml': '.svg'
  };

  return mimeMap[String(mimeType || '').toLowerCase()] || '.png';
}

function getAccessibleNote(noteId) {
  const note = notes.find((item) => item.id === noteId);
  if (!note) {
    throw new Error('笔记不存在');
  }
  assertFolderAccessible(note.folderId);
  return note;
}

async function writeUniqueImageFile(assetDir, extension, writer) {
  await fs.mkdir(assetDir, { recursive: true });
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const targetPath = path.join(assetDir, `${randomUUID()}${extension}`);
    try {
      await writer(targetPath);
      return targetPath;
    } catch (error) {
      if (error.code !== 'EEXIST') {
        throw error;
      }
    }
  }
  throw new Error('无法创建唯一的图片文件');
}

async function copyImageForNote(noteId, sourcePath) {
  getAccessibleNote(noteId);
  const sourceExt = getImageExtension(sourcePath, '');
  const assetDir = getImageAssetDir();
  const targetPath = await writeUniqueImageFile(assetDir, sourceExt, (filePath) => {
    return fs.copyFile(sourcePath, filePath, fsConstants.COPYFILE_EXCL);
  });
  const altText = sanitizeFileName(path.basename(sourcePath, sourceExt));

  return {
    absolutePath: targetPath,
    fileUrl: pathToFileURL(targetPath).href,
    markdown: `![${altText}](${pathToFileURL(targetPath).href})`
  };
}

async function saveClipboardImageForNote(noteId, payload) {
  const hasBytes = Array.isArray(payload?.bytes) || ArrayBuffer.isView(payload?.bytes);
  if (!hasBytes || payload.bytes.length === 0) {
    return null;
  }
  getAccessibleNote(noteId);

  const imageBuffer = Buffer.from(payload.bytes);
  if (imageBuffer.length > MAX_REMOTE_IMAGE_BYTES) {
    throw new Error('图片不能超过 20MB');
  }

  const assetDir = getImageAssetDir();
  const ext = getImageExtension(payload.fileName, payload.mimeType);
  const targetPath = await writeUniqueImageFile(assetDir, ext, (filePath) => {
    return fs.writeFile(filePath, imageBuffer, { flag: 'wx' });
  });

  const altText = sanitizeFileName(path.basename(payload.fileName || 'image', ext));
  return {
    absolutePath: targetPath,
    fileUrl: pathToFileURL(targetPath).href,
    markdown: `![${altText}](${pathToFileURL(targetPath).href})`
  };
}

// 错过的复习日只存在内存里的话，应用在渲染层 ack 前退出就永久丢失（config 已记
// missedReminderNoticeDate，当天也不会重算）。这里把待发汇总一起持久化。
function normalizePendingMissedReminderNotice(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }
  if (!isValidReviewDate(raw.date) || !Array.isArray(raw.dayKeys)) {
    return null;
  }
  const dayKeys = [...new Set(raw.dayKeys.filter((key) => isValidReviewDate(key)))].sort();
  if (dayKeys.length === 0) {
    return null;
  }
  return {
    date: raw.date,
    dayKeys,
    systemNoticeSent: raw.systemNoticeSent === true
  };
}

// 侧边栏顺序只接受字符串 id 数组：去重、去空，异常结构一律回退空数组，
// 空数组的语义是「完全按默认规则排」，所以旧配置不需要迁移。
function normalizeSidebarOrder(value) {
  const pick = (list) => (Array.isArray(list)
    ? [...new Set(list.filter((id) => typeof id === 'string' && id))]
    : []);
  const source = value && typeof value === 'object' ? value : {};
  return {
    folders: pick(source.folders),
    notes: pick(source.notes),
    files: pick(source.files)
  };
}

async function loadConfig() {
  // config 损坏时回退默认配置并保留损坏副本，不再让应用直接退出。
  const rawConfig = await readJsonWithCorruptFallback(getConfigPath(), null);
  const config = rawConfig && typeof rawConfig === 'object' && !Array.isArray(rawConfig)
    ? rawConfig
    : null;
  if (config) {
    dailyReviewEnabled = config.dailyReviewEnabled !== false;
    dailyReviewSelection = config.dailyReviewSelection
      && typeof config.dailyReviewSelection === 'object'
      ? {
        date: config.dailyReviewSelection.date || null,
        entryKey: config.dailyReviewSelection.entryKey || null
      }
      : { date: null, entryKey: null };
    // 历史可能来自旧版（note:/file: 键），先原样载入，启动时由迁移函数归一到天级键
    dailyReviewHistory = config.dailyReviewHistory
      && typeof config.dailyReviewHistory === 'object'
      && !Array.isArray(config.dailyReviewHistory)
      ? config.dailyReviewHistory
      : {};
    dailyReviewOrder = Array.isArray(config.dailyReviewOrder)
      ? [...new Set(config.dailyReviewOrder.filter((dayKey) => isValidReviewDate(dayKey)))]
      : [];
    sidebarOrder = normalizeSidebarOrder(config.sidebarOrder);
    reviewDayOrder = normalizeReviewDayOrder(config.reviewDayOrder, isValidReviewDate);
    reviewDatePrefillDone = config.reviewDatePrefillDone === true;
    dayReminders = Array.isArray(config.dayReminders)
      ? config.dayReminders.filter((item) => item && isValidReviewDate(item.date) && isValidReviewDate(item.dayKey))
      : [];
    dayRemindersMigrated = config.dayRemindersMigrated === true;
    dayReviewLog = Array.isArray(config.dayReviewLog)
      ? config.dayReviewLog.filter((item) =>
        item && isValidReviewDate(item.dayKey) && typeof item.reviewedAt === 'string')
      : [];
    dailyReviewHandledDate = config.dailyReviewHandledDate || null;
    missedReminderNoticeDate = isValidReviewDate(config.missedReminderNoticeDate)
      ? config.missedReminderNoticeDate
      : null;
    pendingMissedReminderNotice = normalizePendingMissedReminderNotice(config.pendingMissedReminderNotice);
    dailyReviewDeferred = config.dailyReviewDeferred
      && typeof config.dailyReviewDeferred === 'object'
      ? {
        date: config.dailyReviewDeferred.date || null,
        entryKey: config.dailyReviewDeferred.entryKey || null
      }
      : { date: null, entryKey: null };
    if (typeof config.notesPath === 'string' && config.notesPath) {
      // 兼容旧配置：如果路径指向 .json 文件，转换为同级 notes/ 目录
      if (config.notesPath.endsWith('.json')) {
        notesPath = path.join(path.dirname(config.notesPath), NOTES_DIR_NAME);
      } else {
        notesPath = config.notesPath;
      }
    } else {
      notesPath = getDefaultNotesPath();
    }
  } else {
    notesPath = getDefaultNotesPath();
    dailyReviewEnabled = true;
    dailyReviewSelection = { date: null, entryKey: null };
    dailyReviewHistory = {};
    dailyReviewOrder = [];
    sidebarOrder = { folders: [], notes: [], files: [] };
    reviewDayOrder = {};
    dailyReviewHandledDate = null;
    dailyReviewDeferred = { date: null, entryKey: null };
    reviewDatePrefillDone = false;
    dayReminders = [];
    dayRemindersMigrated = false;
    dayReviewLog = [];
    missedReminderNoticeDate = null;
    pendingMissedReminderNotice = null;
  }
}

async function saveConfig() {
  await atomicWriteJson(getConfigPath(), {
    notesPath: getNotesPath(),
    dailyReviewEnabled,
    dailyReviewSelection,
    dailyReviewHistory,
    dailyReviewOrder,
    sidebarOrder,
    reviewDayOrder,
    dailyReviewHistoryVersion: 3,
    dailyReviewHandledDate,
    dailyReviewDeferred,
    reviewDatePrefillDone,
    dayReminders,
    dayRemindersMigrated,
    dayReviewLog,
    missedReminderNoticeDate,
    pendingMissedReminderNotice
  });
}

// 每日回顾候选：以「天」为单位。
// 两套调度并存（手动排期照推、自动选天照选），但还挂着未完成提醒的那套内容
// 先走完提醒阶段，再进入自动回顾轮转——提醒负责「该看了」，回顾负责「再看一遍」。
// 产品规则（已确认）：密码保护目录一律不参与每日自动回顾，
// 即使本次会话已解锁也不参与，解锁状态变化不会让同一套内容时有时无。
// 通知正文复用同一判定，避免把锁定目录的标题写进系统通知。
function isProtectedFromDailyReview(folderId) {
  return Boolean(getLockedFolderForFolderId(folderId, new Set(), true));
}

function getDailyReviewCandidates() {
  const isProtected = isProtectedFromDailyReview;
  const pendingDayKeys = new Set(
    dayReminders.filter((record) => !record.done).map((record) => record.dayKey)
  );
  const dayMap = new Map();

  const ensureDay = (dayKey) => {
    if (!dayMap.has(dayKey)) {
      dayMap.set(dayKey, { key: `day:${dayKey}`, dayKey, notes: [], files: [] });
    }
    return dayMap.get(dayKey);
  };

  for (const note of notes) {
    if (!note.isReviewFile || isProtected(note.folderId)) {
      continue;
    }
    ensureDay(getNoteReviewDayKey(note)).notes.push(note);
  }
  for (const file of resourceFiles) {
    if (!file.isReviewFile || !file.canOpen || isProtected(file.folderId)) {
      continue;
    }
    ensureDay(getResourceReviewDayKey(file)).files.push(file);
  }

  return [...dayMap.values()]
    .filter((day) => (day.notes.length + day.files.length) > 0)
    .filter((day) => !pendingDayKeys.has(day.dayKey))
    .sort((a, b) => a.dayKey.localeCompare(b.dayKey));
}

function updateDailyReviewSelection() {
  const dayKeyOf = (note) => getNoteReviewDayKey(note);
  const dayKeyOfFile = (file) => getResourceReviewDayKey(file);
  for (const note of notes) {
    note.isDailyReview = false;
    note.dailyReviewLastReviewedAt = dailyReviewHistory[`day:${dayKeyOf(note)}`] || null;
  }
  for (const file of resourceFiles) {
    file.isDailyReview = false;
    file.dailyReviewLastReviewedAt = dailyReviewHistory[`day:${dayKeyOfFile(file)}`] || null;
  }

  const now = new Date();
  const today = toLocalDateKey(now);
  const isWeekend = now.getDay() === 0 || now.getDay() === 6;
  const eligibleCandidates = dailyReviewEnabled ? getDailyReviewCandidates() : [];
  const deferredDue = Boolean(dailyReviewDeferred.date) && dailyReviewDeferred.date <= today;
  const candidates = !isWeekend || deferredDue ? eligibleCandidates : [];
  let stateChanged = false;

  // 候选池变化时顺手清掉手动顺序里已失效的天，避免数组越积越长、失效项挡住新内容。
  // 挂着未完成提醒的天虽然暂时不在候选池里，但它的手动位置要留着——提醒结束后还要按原顺序推。
  // 用 eligibleCandidates 而不是 candidates：周末不推，但不能因此把手动顺序清空。
  const pendingReminderDayKeys = new Set(
    dayReminders.filter((record) => !record.done).map((record) => record.dayKey)
  );
  const prunedOrder = pruneReviewOrder(dailyReviewOrder, eligibleCandidates, {
    keep: [...pendingReminderDayKeys]
  });
  if (prunedOrder.length !== dailyReviewOrder.length) {
    dailyReviewOrder = prunedOrder;
    stateChanged = true;
  }

  let selected = null;

  if (dailyReviewHandledDate !== today) {
    selected = dailyReviewSelection.date === today
      ? candidates.find((candidate) => candidate.key === dailyReviewSelection.entryKey)
      : null;
    if (!selected && deferredDue) {
      selected = candidates.find((candidate) => candidate.key === dailyReviewDeferred.entryKey) || null;
    }
    if (!selected && candidates.length > 0) {
      selected = sortReviewQueue(candidates, {
        order: dailyReviewOrder,
        history: dailyReviewHistory
      })[0];
    }
  }

  if (dailyReviewDeferred.date && dailyReviewDeferred.date <= today) {
    dailyReviewDeferred = { date: null, entryKey: null };
    stateChanged = true;
  }

  const nextSelection = selected
    ? { date: today, entryKey: selected.key }
    : { date: today, entryKey: null };
  const changed = dailyReviewSelection.date !== nextSelection.date
    || dailyReviewSelection.entryKey !== nextSelection.entryKey;
  dailyReviewSelection = nextSelection;
  if (selected) {
    // 当天的一整套文件都标记为今日回顾
    for (const note of selected.notes) {
      note.isDailyReview = true;
    }
    for (const file of selected.files) {
      file.isDailyReview = true;
    }
  }
  return changed || stateChanged;
}

// 日历用的回顾事件：只包含用户真的点过「完成回顾」的记录，按时间升序
function getDayReviewLog() {
  return [...dayReviewLog].sort((a, b) =>
    String(a.reviewedAt).localeCompare(String(b.reviewedAt)));
}

// 回顾面板要展示的「接下来的推送顺序」：手动顺序优先，其余按最久没看。
// 只给渲染层看，不落盘；落盘的是 dailyReviewOrder。
function getReviewQueue() {
  const today = toLocalDateKey(new Date());
  const selectedKey = dailyReviewSelection.date === today
    ? dailyReviewSelection.entryKey
    : null;
  return sortReviewQueue(getDailyReviewCandidates(), {
    order: dailyReviewOrder,
    history: dailyReviewHistory
  }).map((item) => {
    const first = item.notes[0] || item.files[0] || null;
    return {
      dayKey: item.dayKey,
      title: first?.title || first?.name || '未命名',
      count: item.notes.length + item.files.length,
      isToday: item.key === selectedKey
    };
  });
}

function getAppSettings() {
  const selectedNote = notes.find((note) => note.isDailyReview);
  const selectedFile = resourceFiles.find((file) => file.isDailyReview);
  const dayTitle = selectedNote?.title || selectedFile?.name || null;
  // 只有「今天」选中的那一套才算今日回顾日：应用跨天没重启时，
  // dailyReviewSelection 里可能还是昨天那套，不能拿它当今天的回顾目标。
  const todayEntryKey = dailyReviewSelection.date === toLocalDateKey(new Date())
    ? dailyReviewSelection.entryKey
    : null;
  return {
    dailyReviewEnabled,
    dailyReviewTitle: dayTitle,
    dailyReviewDayKey: todayEntryKey || null,
    reviewQueue: getReviewQueue(),
    sidebarOrder,
    reviewDayOrder,
    dayReminders: listDayReminders(),
    dayReviewLog: getDayReviewLog()
  };
}

function getFolderNameById(folderId) {
  if (!folderId) {
    return '全部笔记';
  }

  return folders.find((folder) => folder.id === folderId)?.name || '未命名文件夹';
}

function getFolderBreadcrumb(folderId) {
  const folder = folders.find((item) => item.id === folderId);
  return folder ? getFolderPathParts(folder).join(' / ') : '全部笔记';
}

function createMobileNoteSummary(note) {
  const plainContent = String(note.content || '').replace(/\s+/g, ' ').trim();
  return {
    id: note.id,
    title: note.title,
    folderId: note.folderId || null,
    folderName: getFolderNameById(note.folderId),
    folderPath: getFolderBreadcrumb(note.folderId),
    fileType: note.fileType,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
    reminders: note.reminders,
    isDailyReview: Boolean(note.isDailyReview),
    isReviewFile: Boolean(note.isReviewFile),
    reviewDate: isValidReviewDate(note.reviewDate) ? note.reviewDate : null,
    preview: plainContent.slice(0, 120)
  };
}

function createMobileFolderSummary(folder, visibleNotes) {
  return {
    id: folder.id,
    name: folder.name,
    parentId: folder.parentId || null,
    path: getFolderPathParts(folder).join(' / '),
    isProtected: isFolderProtected(folder),
    // 离线包永远是明文：手机端没有密码校验能力，不能谎报「已解锁」。
    isUnlocked: false,
    isPlaintextExport: isFolderProtected(folder),
    noteCount: visibleNotes.filter((note) => note.folderId === folder.id).length
  };
}

async function createMobileExportSnapshot() {
  const exportedFolders = getVisibleFolders();
  const exportedNotes = getVisibleNotes();
  const assetPaths = new Set();
  const syncedNotes = exportedNotes.map((note) => {
    const content = convertNoteImages(note.content || '', noteFileMap.get(note.id));
    for (const match of content.matchAll(/mobile-image:\/\/([^)]+)/g)) {
      assetPaths.add(decodeURIComponent(match[1].trim()));
    }
    return {
      ...createMobileNoteSummary(note),
      content
    };
  });

  const syncedResources = getVisibleResourceFiles()
    .filter((file) => file.canOpen)
    .map((file) => {
      const source = path.relative(getNotesPath(), file.path).replace(/\\/g, '/');
      assetPaths.add(source);
      return {
        id: file.id,
        name: file.name,
        folderId: file.folderId || null,
        folderPath: getFolderBreadcrumb(file.folderId),
        extension: file.extension,
        kind: file.kind,
        typeLabel: file.typeLabel,
        canOpen: file.canOpen,
        size: file.size,
        createdAt: file.createdAt,
        updatedAt: file.updatedAt,
        localAssetPath: source
      };
    });

  const assets = [];
  for (const source of assetPaths) {
    const filePath = path.resolve(getNotesPath(), source);
    if (!isPathInside(path.resolve(getNotesPath()), filePath)) {
      continue;
    }
    try {
      const stats = await fs.stat(filePath);
      if (stats.isFile()) {
        assets.push({
          source,
          size: stats.size,
          updatedAt: stats.mtime.toISOString(),
          mimeType: getMimeType(filePath)
        });
      }
    } catch {
      // 同步时忽略已被移动或删除的附件
    }
  }

  return {
    version: 1,
    app: {
      name: 'Notice Note',
      generatedAt: new Date().toISOString()
    },
    folders: exportedFolders.map((folder) => createMobileFolderSummary(folder, exportedNotes)),
    notes: syncedNotes,
    resources: syncedResources,
    assets
  };
}

function isRelativeMarkdownImagePath(value) {
  return Boolean(value) && !/^(?:[a-z][a-z\d+.-]*:|\/\/|\/|#)/i.test(value);
}

function convertNoteImages(content, noteSourcePath) {
  const text = String(content || '');
  const notesDir = path.resolve(getNotesPath());
  return text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, imageSource) => {
    try {
      const source = String(imageSource || '').trim();
      let filePath;
      if (source.startsWith('file:')) {
        filePath = path.resolve(fileURLToPath(source));
      } else if (noteSourcePath && isRelativeMarkdownImagePath(source)) {
        const relativePath = decodeURIComponent(source.split(/[?#]/, 1)[0]);
        filePath = path.resolve(path.dirname(noteSourcePath), relativePath);
      } else {
        return match;
      }
      if (!isPathInside(notesDir, filePath)) {
        return match;
      }
      const relPath = path.relative(notesDir, filePath).replace(/\\/g, '/');
      const encodedRelPath = encodeURI(relPath).replace(/\(/g, '%28').replace(/\)/g, '%29');
      return `![${alt}](mobile-image://${encodedRelPath})`;
    } catch {
      return match;
    }
  });
}

async function exportMobilePackage() {
  const lockedFolder = folders.find((folder) => isFolderProtected(folder) && !unlockedFolderIds.has(folder.id));
  if (lockedFolder) {
    throw new Error(`请先在文件列表中解锁密码保护目录「${lockedFolder.name}」，再导出手机离线包`);
  }
  const datePart = new Date().toISOString().slice(0, 10);
  const result = await dialog.showSaveDialog(mainWindow, {
    title: '导出手机离线包',
    defaultPath: `Notice-Note-${datePart}.${MOBILE_EXPORT_EXTENSION}`,
    filters: [
      { name: 'Notice Note 手机离线包', extensions: [MOBILE_EXPORT_EXTENSION] }
    ]
  });
  if (result.canceled || !result.filePath) {
    return { canceled: true };
  }

  const snapshot = await createMobileExportSnapshot();
  const assetFiles = [];
  for (const asset of snapshot.assets) {
    const filePath = path.resolve(getNotesPath(), asset.source);
    if (!isPathInside(path.resolve(getNotesPath()), filePath)) {
      continue;
    }
    try {
      const stats = await fs.stat(filePath);
      if (stats.isFile()) {
        assetFiles.push({ filePath, asset: { ...asset, size: stats.size } });
      }
    } catch {
      // 导出时忽略已经被移动或删除的附件
    }
  }
  snapshot.assets = assetFiles.map((item) => item.asset);

  const manifestBuffer = Buffer.from(JSON.stringify({
    format: 'notice-note-mobile',
    formatVersion: MOBILE_PACKAGE_VERSION,
    snapshot
  }), 'utf8');
  const header = Buffer.alloc(MOBILE_PACKAGE_MAGIC.length + 8);
  MOBILE_PACKAGE_MAGIC.copy(header, 0);
  header.writeUInt32LE(MOBILE_PACKAGE_VERSION, MOBILE_PACKAGE_MAGIC.length);
  header.writeUInt32LE(manifestBuffer.length, MOBILE_PACKAGE_MAGIC.length + 4);

  const tempPath = path.join(
    path.dirname(result.filePath),
    `.${path.basename(result.filePath)}.${randomUUID()}.tmp`
  );
  const output = createWriteStream(tempPath, { flags: 'wx' });
  let packageSize = header.length + manifestBuffer.length;
  try {
    await writeStreamChunk(output, header);
    await writeStreamChunk(output, manifestBuffer);
    for (const { filePath, asset } of assetFiles) {
      let writtenSize = 0;
      for await (const chunk of createReadStream(filePath)) {
        await writeStreamChunk(output, chunk);
        writtenSize += chunk.length;
      }
      if (writtenSize !== asset.size) {
        throw new Error(`导出期间文件发生变化：${asset.source}`);
      }
      packageSize += writtenSize;
    }
    output.end();
    await finished(output);
    await fs.copyFile(tempPath, result.filePath);
  } finally {
    if (!output.closed) {
      output.destroy();
    }
    await fs.rm(tempPath, { force: true }).catch(() => {});
  }
  return {
    canceled: false,
    filePath: result.filePath,
    noteCount: snapshot.notes.length,
    resourceCount: snapshot.resources.length,
    assetCount: assetFiles.length,
    size: packageSize
  };
}

function writeStreamChunk(stream, chunk) {
  return new Promise((resolve, reject) => {
    stream.write(chunk, (error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

async function updateAppSettings(_event, input = {}) {
  if (Object.hasOwn(input, 'dailyReviewEnabled')) {
    dailyReviewEnabled = Boolean(input.dailyReviewEnabled);
    if (!dailyReviewEnabled) {
      dailyReviewSelection = { date: null, entryKey: null };
    }
    updateDailyReviewSelection();
  }

  await saveConfig();
  sendNotesChanged();
  sendPdfFilesChanged();
  return getAppSettings();
}

function assertFolderPasswordChangeAllowed(folder, currentPassword) {
  assertFolderAccessible(folder.parentId);
  if (isFolderProtected(folder)
    && !unlockedFolderIds.has(folder.id)
    && !verifyFolderPassword(folder, currentPassword)) {
    throw new Error('当前密码不正确');
  }
}

async function setFolderPassword(_event, folderId, password, currentPassword = '') {
  const folder = getFolderById(folderId);
  if (!folder) {
    throw new Error('文件夹不存在');
  }
  assertFolderPasswordChangeAllowed(folder, currentPassword);
  const normalizedPassword = String(password || '').trim();
  if (normalizedPassword.length < 1) {
    throw new Error('密码不能为空');
  }
  const previousPassword = {
    passwordSalt: folder.passwordSalt,
    passwordHash: folder.passwordHash
  };
  const { salt, hash } = hashFolderPassword(normalizedPassword);
  folder.passwordSalt = salt;
  folder.passwordHash = hash;
  try {
    await saveFolderMetadata();
  } catch (error) {
    Object.assign(folder, previousPassword);
    throw error;
  }
  unlockedFolderIds.delete(folder.id);
  sendFoldersChanged();
  sendNotesChanged();
  sendPdfFilesChanged();
  return sanitizeFolderForClient(folder);
}

async function clearFolderPassword(_event, folderId, currentPassword = '') {
  const folder = getFolderById(folderId);
  if (!folder) {
    throw new Error('文件夹不存在');
  }
  assertFolderPasswordChangeAllowed(folder, currentPassword);
  const previousPassword = {
    passwordSalt: folder.passwordSalt,
    passwordHash: folder.passwordHash
  };
  folder.passwordSalt = '';
  folder.passwordHash = '';
  try {
    await saveFolderMetadata();
  } catch (error) {
    Object.assign(folder, previousPassword);
    throw error;
  }
  unlockedFolderIds.delete(folder.id);
  sendFoldersChanged();
  sendNotesChanged();
  sendPdfFilesChanged();
  return sanitizeFolderForClient(folder);
}

async function unlockFolder(_event, folderId, password) {
  const folder = getFolderById(folderId);
  if (!folder) {
    throw new Error('文件夹不存在');
  }
  if (!isFolderProtected(folder)) {
    return sanitizeFolderForClient(folder);
  }
  if (!verifyFolderPassword(folder, password)) {
    throw new Error('密码不正确');
  }
  unlockedFolderIds.add(folder.id);
  sendFoldersChanged();
  sendNotesChanged();
  sendPdfFilesChanged();
  return sanitizeFolderForClient(folder);
}

async function lockFolder(_event, folderId) {
  if (!folderId) {
    return;
  }
  unlockedFolderIds.delete(folderId);
  sendFoldersChanged();
  sendNotesChanged();
  sendPdfFilesChanged();
}

function sortNotesByCreatedAt() {
  notes.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

// 回顾目录的收敛入口：迁移旧名 + 不存在时创建。
// 启动时调用，切换存储位置后同样调用（R4：以前只在启动做，切库后「+ 新建」会失败）。
async function migrateReviewFolder() {
  const result = await ensureReviewFolder(getNotesPath(), {
    reviewFolderName: REVIEW_FOLDER_NAME,
    legacyFolderName: LEGACY_REVIEW_FOLDER_NAME
  });
  if (result.migrated) {
    console.log('已迁移回顾文件夹:', LEGACY_REVIEW_FOLDER_NAME, '->', REVIEW_FOLDER_NAME);
  }
  if (result.created) {
    console.log('已创建回顾文件夹:', result.reviewPath);
  }
  return result.migrated;
}

// 一次性迁移：回顾文件按文件名日期预填 reviewDate（让历史文件按命名意图归天）。
// 此后新文件一律按创建时间归天，需要时可在界面手工改回顾日期。
async function prefillReviewDatesFromFilename() {
  if (reviewDatePrefillDone) {
    return false;
  }
  let changed = false;
  for (const note of notes) {
    if (!note.isReviewFile || note.reviewDate) {
      continue;
    }
    const filePath = noteFileMap.get(note.id);
    if (!filePath) {
      continue;
    }
    const matched = /^(\d{4})[.\-](\d{1,2})[.\-](\d{1,2})/.exec(path.basename(filePath));
    if (!matched) {
      continue;
    }
    const dayKey = `${matched[1]}-${matched[2].padStart(2, '0')}-${matched[3].padStart(2, '0')}`;
    note.reviewDate = dayKey;
    const stats = await fs.stat(filePath).catch(() => null);
    setNoteMetadata(filePath, note, stats ? String(stats.ino) : null);
    changed = true;
  }
  reviewDatePrefillDone = true;
  if (changed) {
    await saveNoteMetadata();
  }
  await saveConfig();
  return changed;
}

// 一次性迁移：回顾历史从「按文件」升级为「按天」（旧键 note:/file: 合并到 day:）
async function migrateDailyReviewHistoryToDays() {
  const hasLegacyKeys = Object.keys(dailyReviewHistory).some((key) => !key.startsWith('day:'));
  const legacySelection = [dailyReviewSelection.entryKey, dailyReviewDeferred.entryKey]
    .some((key) => typeof key === 'string' && key.startsWith('note:'));
  if (!hasLegacyKeys && !legacySelection) {
    return false;
  }

  const dayKeyOfLegacyKey = (key) => {
    if (typeof key !== 'string') {
      return null;
    }
    if (key.startsWith('note:')) {
      const note = notes.find((item) => item.id === key.slice(5));
      return note ? getNoteReviewDayKey(note) : null;
    }
    if (key.startsWith('file:')) {
      const relativePath = key.slice(5);
      const file = resourceFiles.find((item) => getNoteMetadataKey(item.path) === relativePath);
      return file ? getResourceReviewDayKey(file) : null;
    }
    return null;
  };

  const nextHistory = {};
  for (const [key, value] of Object.entries(dailyReviewHistory)) {
    if (key.startsWith('day:')) {
      nextHistory[key] = value;
      continue;
    }
    const dayKey = dayKeyOfLegacyKey(key);
    if (!dayKey) {
      continue;
    }
    const dayHistoryKey = `day:${dayKey}`;
    if (!nextHistory[dayHistoryKey] || String(value) > String(nextHistory[dayHistoryKey])) {
      nextHistory[dayHistoryKey] = value;
    }
  }
  dailyReviewHistory = nextHistory;

  const migrateEntryKey = (key) => {
    if (typeof key !== 'string' || !key) {
      return null;
    }
    if (key.startsWith('day:')) {
      return key;
    }
    const dayKey = dayKeyOfLegacyKey(key);
    return dayKey ? `day:${dayKey}` : null;
  };
  dailyReviewSelection = {
    date: dailyReviewSelection.date,
    entryKey: migrateEntryKey(dailyReviewSelection.entryKey)
  };
  dailyReviewDeferred = {
    date: dailyReviewDeferred.date,
    entryKey: migrateEntryKey(dailyReviewDeferred.entryKey)
  };

  await saveConfig();
  return true;
}

async function loadFolders() {
  const notesDir = getNotesPath();
  await fs.mkdir(notesDir, { recursive: true });
  const previousFolders = folders;
  folders = [];
  await loadFolderMetadata();
  try {
    await scanFolderDirectory(notesDir, null);
    await saveFolderMetadata();
    await removeObsoleteMobileImageCache();
  } catch (error) {
    folders = previousFolders;
    throw error;
  }

  return folders;
}

async function scanFolderDirectory(dirPath, parentId) {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory() || isInternalDirectory(entry.name)) {
      continue;
    }

    const folderPath = path.join(dirPath, entry.name);
    const metadataKey = getFolderMetadataKey(folderPath);
    const metaPath = path.join(folderPath, '.folder.json');
    const stats = await fs.stat(folderPath);
    const fileId = Number(stats.ino) > 0 ? String(stats.ino) : null;
    const metadataByFileId = fileId
      ? Object.values(folderMetadata).find((item) => item?.fileId === fileId)
      : null;
    let data = folderMetadata[metadataKey] || metadataByFileId || {};

    if (!folderMetadata[metadataKey]) {
      try {
        const meta = await fs.readFile(metaPath, 'utf8');
        data = JSON.parse(meta);
      } catch {
        data = {};
      }
    }

    const folder = {
      id: data.id || getStableFolderId(folderPath),
      name: entry.name,
      parentId,
      createdAt: data.createdAt || new Date().toISOString(),
      fileId,
      isReviewFolder: isReviewFolderName(entry.name),
      passwordSalt: typeof data.passwordSalt === 'string' ? data.passwordSalt : '',
      passwordHash: typeof data.passwordHash === 'string' ? data.passwordHash : ''
    };
    folders.push(folder);
    await scanFolderDirectory(folderPath, folder.id);
  }
}

// 文件夹结构变化后统一重扫资源并广播，避免渲染层短暂显示已删除目录里的幽灵文件。
async function refreshAfterFolderStructureChange() {
  await loadPdfFiles();
  sendPdfFilesChanged();
  sendNotesChanged();
}

function assertMutableFolder(folder, action) {
  if (folder.isReviewFolder) {
    throw new Error(`回顾目录「${folder.name}」不能${action}，否则其中的内容会脱离回顾体系`);
  }
}

async function createFolder(_event, name, parentId) {
  const folderName = sanitizeFolderName(name);
  if (isInternalFolderName(name) || isInternalFolderName(folderName)) {
    throw new Error('该名称是应用内部保留目录名，请换一个名称');
  }
  const normalizedParentId = parentId || null;
  if (normalizedParentId && !folders.some((folder) => folder.id === normalizedParentId)) {
    throw new Error('父文件夹不存在');
  }
  assertFolderAccessible(normalizedParentId);

  const parentPath = getFolderPath(normalizedParentId);
  const folderPath = path.join(parentPath, folderName);

  try {
    await fs.access(folderPath);
    throw new Error('文件夹已存在');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  await fs.mkdir(folderPath, { recursive: true });
  const stats = await fs.stat(folderPath);

  const folder = {
    id: getStableFolderId(folderPath),
    name: folderName,
    parentId: normalizedParentId,
    createdAt: new Date().toISOString(),
    fileId: Number(stats.ino) > 0 ? String(stats.ino) : null,
    passwordSalt: '',
    passwordHash: ''
  };

  folders.push(folder);
  // 手动排过顺序时，新文件夹默认放最上面，否则会落到列表末尾找不到。
  // 顺序只是显示偏好，写 config 失败不该让建目录失败。
  if (sidebarOrder.folders.length > 0) {
    sidebarOrder = { ...sidebarOrder, folders: [folder.id, ...sidebarOrder.folders] };
    await saveConfig().catch((error) => console.error('保存文件夹顺序失败:', error));
  }
  try {
    await saveFolderMetadata();
  } catch (error) {
    folders = folders.filter((item) => item !== folder);
    await fs.rmdir(folderPath).catch(() => {});
    throw error;
  }
  sendFoldersChanged();
  return folder;
}

async function renameFolder(_event, folderId, newName) {
  const folder = folders.find(f => f.id === folderId);
  if (!folder) throw new Error('文件夹不存在');
  assertFolderAccessible(folderId);
  assertMutableFolder(folder, '重命名');

  const newFolderName = sanitizeFolderName(newName);
  if (isInternalFolderName(newName) || isInternalFolderName(newFolderName)) {
    throw new Error('该名称是应用内部保留目录名，请换一个名称');
  }
  const oldPath = getFolderPath(folderId);
  const newPath = path.join(getNotesPath(), ...getFolderPathParts(folder).slice(0, -1), newFolderName);

  const previousNoteMetadata = structuredClone(noteMetadata);
  const previousResourceMetadata = structuredClone(resourceMetadata);
  const previousNoteFileMap = new Map(noteFileMap);
  await fs.rename(oldPath, newPath);
  try {
    moveNoteMetadataTree(oldPath, newPath);
    moveResourceMetadataTree(resourceMetadata, getNoteMetadataKey(oldPath), getNoteMetadataKey(newPath));
    folder.name = newFolderName;
    await Promise.all([saveNoteMetadata(), saveResourceMetadata(), saveFolderMetadata()]);
  } catch (error) {
    await fs.rename(newPath, oldPath).catch((rollbackError) => {
      console.error('回滚文件夹重命名失败:', rollbackError);
    });
    folder.name = path.basename(oldPath);
    noteMetadata = previousNoteMetadata;
    resourceMetadata = previousResourceMetadata;
    noteFileMap = previousNoteFileMap;
    await Promise.allSettled([
      saveNoteMetadata(),
      saveResourceMetadata(),
      saveFolderMetadata()
    ]);
    throw error;
  }

  sendFoldersChanged();
  await refreshAfterFolderStructureChange();
  return folder;
}

async function deleteFolder(_event, folderId) {
  const folder = folders.find(f => f.id === folderId);
  if (!folder) throw new Error('文件夹不存在');
  assertFolderAccessible(folderId);
  assertMutableFolder(folder, '删除');

  // 先把整棵子树算出来：删除父目录同样会连带删掉回顾目录，必须提前拦住（R10）。
  const deletedFolderIds = new Set([folderId]);
  let foundChild = true;
  while (foundChild) {
    foundChild = false;
    for (const item of folders) {
      if (item.parentId && deletedFolderIds.has(item.parentId) && !deletedFolderIds.has(item.id)) {
        deletedFolderIds.add(item.id);
        foundChild = true;
      }
    }
  }
  if (folders.some((item) => deletedFolderIds.has(item.id) && item.isReviewFolder)) {
    throw new Error('不能删除包含回顾目录的文件夹，否则其中的内容会脱离回顾体系');
  }

  const folderPath = getFolderPath(folderId);
  await shell.trashItem(folderPath);
  deleteNoteMetadataTree(folderPath);
  deleteResourceMetadataTree(resourceMetadata, getNoteMetadataKey(folderPath));
  await Promise.all([saveNoteMetadata(), saveResourceMetadata()]);

  const notesToDelete = notes.filter((note) => deletedFolderIds.has(note.folderId));
  for (const note of notesToDelete) {
    noteFileMap.delete(note.id);
  }
  notes = notes.filter((note) => !deletedFolderIds.has(note.folderId));
  folders = folders.filter((item) => !deletedFolderIds.has(item.id));
  await saveFolderMetadata();

  if (notes.length === 0) {
    const note = createEmptyNote();
    notes.push(note);
    await saveNote(note);
  }

  if (updateDailyReviewSelection()) {
    await saveConfig();
  }
  sendFoldersChanged();
  await refreshAfterFolderStructureChange();
  return folders;
}

function getFolderPathParts(folder) {
  const parts = [];
  let current = folder;
  while (current) {
    parts.unshift(current.name);
    current = folders.find(f => f.id === current.parentId);
  }
  return parts;
}

function getStableFolderId(folderPath) {
  const relativePath = path.relative(getNotesPath(), folderPath).split(path.sep).join('/');
  return `path:${relativePath.toLocaleLowerCase('zh-CN')}`;
}

function getFolderById(folderId) {
  return folders.find((folder) => folder.id === folderId) || null;
}

function isFolderProtected(folder) {
  return Boolean(folder?.passwordHash && folder?.passwordSalt);
}

function sanitizeFolderForClient(folder, unlockedSet = unlockedFolderIds) {
  return {
    id: folder.id,
    name: folder.name,
    parentId: folder.parentId || null,
    createdAt: folder.createdAt,
    isReviewFolder: Boolean(folder.isReviewFolder),
    isProtected: isFolderProtected(folder),
    isUnlocked: unlockedSet.has(folder.id)
  };
}

function hashFolderPassword(password, salt = randomBytes(16).toString('hex')) {
  const normalizedPassword = String(password || '');
  return {
    salt,
    hash: scryptSync(normalizedPassword, salt, 64).toString('hex')
  };
}

function verifyFolderPassword(folder, password) {
  if (!isFolderProtected(folder)) {
    return true;
  }
  const expected = Buffer.from(folder.passwordHash, 'hex');
  const actual = Buffer.from(hashFolderPassword(password, folder.passwordSalt).hash, 'hex');
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function getLockedFolderForFolderId(folderId, unlockedSet = unlockedFolderIds, includeSelf = true) {
  let current = folderId ? getFolderById(folderId) : null;
  while (current) {
    const isSelf = current.id === folderId;
    if ((includeSelf || !isSelf) && isFolderProtected(current) && !unlockedSet.has(current.id)) {
      return current;
    }
    current = current.parentId ? getFolderById(current.parentId) : null;
  }
  return null;
}

function assertFolderAccessible(folderId, unlockedSet = unlockedFolderIds) {
  const lockedFolder = getLockedFolderForFolderId(folderId, unlockedSet, true);
  if (!lockedFolder) {
    return;
  }
  const error = new Error(`文件夹「${lockedFolder.name}」受应用内密码保护，请先输入密码`);
  error.code = 'FOLDER_LOCKED';
  error.folderId = lockedFolder.id;
  error.folderName = lockedFolder.name;
  throw error;
}

function assertFolderTargetAccessible(folderId) {
  if (folderId && !getFolderById(folderId)) {
    throw new Error('目标文件夹不存在');
  }
  assertFolderAccessible(folderId);
}

function isFolderVisibleToClient(folder, unlockedSet = unlockedFolderIds) {
  return !getLockedFolderForFolderId(folder.parentId, unlockedSet, true);
}

function getVisibleFolders(unlockedSet = unlockedFolderIds) {
  return folders
    .filter((folder) => isFolderVisibleToClient(folder, unlockedSet))
    .map((folder) => sanitizeFolderForClient(folder, unlockedSet));
}

function createClientNote(note) {
  const sourcePath = noteFileMap.get(note.id);
  return {
    ...note,
    sourceUrl: sourcePath ? pathToFileURL(sourcePath).href : null
  };
}

function getVisibleNotes(unlockedSet = unlockedFolderIds) {
  return notes
    .filter((note) => !getLockedFolderForFolderId(note.folderId, unlockedSet, true))
    .map(createClientNote);
}

function getVisibleResourceFiles(unlockedSet = unlockedFolderIds) {
  return resourceFiles.filter((file) => !getLockedFolderForFolderId(file.folderId, unlockedSet, true));
}

function getVisiblePdfFiles(unlockedSet = unlockedFolderIds) {
  return pdfFiles.filter((file) => !getLockedFolderForFolderId(file.folderId, unlockedSet, true));
}

function cleanupUnlockedFolders() {
  const validFolderIds = new Set(folders.map((folder) => folder.id));
  for (const folderId of [...unlockedFolderIds]) {
    if (!validFolderIds.has(folderId)) {
      unlockedFolderIds.delete(folderId);
    }
  }
}

function sendFoldersChanged() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('folders:changed', getVisibleFolders());
  }
}

async function loadNotes() {
  if (noteLoadPromise) {
    return noteLoadPromise;
  }

  noteLoadPromise = performLoadNotes();
  try {
    return await noteLoadPromise;
  } finally {
    noteLoadPromise = null;
  }
}

async function performLoadNotes() {
  if (resourceLoadPromise) {
    await resourceLoadPromise;
  }

  const notesDir = getNotesPath();
  let shouldCreateInitialFile = false;
  await loadNoteMetadata();

  // 检查是否有旧的 notes.json 需要迁移（默认路径和自定义路径）
  const oldJsonPaths = [
    getOldNotesJsonPath(),
    // 如果自定义路径是从 .json 转换来的，也检查原路径
    ...(notesPath ? [path.join(path.dirname(notesPath), OLD_NOTE_FILE_NAME)] : [])
  ];
  const uniqueOldPaths = [...new Set(oldJsonPaths)];

  for (const oldJsonPath of uniqueOldPaths) {
    if (await pathExists(oldJsonPath)) {
      await migrateFromJson(oldJsonPath, notesDir);
    }
  }

  // 加载文件夹
  await loadFolders();
  await loadPdfFiles();

  const previousNotes = notes;
  const previousNoteFileMap = noteFileMap;
  const storedMetadataByPath = noteMetadata;
  try {
    notes = [];
    noteFileMap = new Map();
    noteMetadata = {};

    // 递归扫描目录
    await scanDirectory(notesDir, null, storedMetadataByPath, new Set());
    // 元数据读写与正文读取分开：内容没变就不要每次刷新都全量写一次盘。
    // 用排序后的键做稳定比较，避免对象键顺序差异造成误判。
    const stableMetadata = (value) => JSON.stringify(
      Object.keys(value || {}).sort().map((key) => [key, value[key]])
    );
    if (stableMetadata(noteMetadata) !== stableMetadata(storedMetadataByPath)) {
      await saveNoteMetadata();
    }
  } catch (error) {
    const rootMissing = error.code === 'ENOENT' && !await pathExists(notesDir);
    if (!rootMissing) {
      dialog.showErrorBox('读取笔记失败', `无法读取笔记目录：${error.message}`);
      noteMetadata = storedMetadataByPath;
      notes = previousNotes;
      noteFileMap = previousNoteFileMap;
      return;
    }
    shouldCreateInitialFile = true;
    notes = [];
    noteFileMap = new Map();
    noteMetadata = storedMetadataByPath;
  }

  if (notes.length === 0 && shouldCreateInitialFile) {
    const note = createEmptyNote();
    notes.push(note);
    await saveNote(note);
  }

  if (notes.length === 0) {
    const note = createEmptyNote();
    notes.push(note);
    await saveNote(note);
  }

  sortNotesByCreatedAt();
  if (updateDailyReviewSelection()) {
    await saveConfig();
  }
  cleanupUnlockedFolders();
}

async function scanDirectory(dirPath, folderId, storedMetadataByPath, claimedMetadataIds) {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    const fileExtension = path.extname(entry.name).toLowerCase();

    // R9：点文件（.hidden.md / .temp.txt 等）不是用户笔记，不能进资料库。
    if (entry.isFile() && shouldSkipScanEntry(entry.name, false, REVIEW_FOLDER_NAME)) {
      continue;
    }

    if (entry.isFile() && ['.md', '.txt', '.json'].includes(fileExtension)
      && entry.name !== '.folder.json') {
      const metadataKey = getNoteMetadataKey(fullPath);
      try {
        const raw = await fs.readFile(fullPath, 'utf8');
        const stats = await fs.stat(fullPath);
        const parsed = fileExtension === '.md' ? matter(raw) : { data: {}, content: raw };
        const isLegacyNote = fileExtension === '.md' && Boolean(parsed.data.id
          && parsed.data.title
          && parsed.data.createdAt
          && parsed.data.updatedAt
          && Array.isArray(parsed.data.reminders));
        const fileId = Number(stats.ino) > 0 ? String(stats.ino) : null;
        const metadataByPath = storedMetadataByPath[metadataKey];
        const metadataByFileId = fileId
          ? Object.values(storedMetadataByPath).find((item) => {
            return item.fileId === fileId && !claimedMetadataIds.has(item.id);
          })
          : null;
        const storedMetadata = metadataByPath || metadataByFileId || {};
        const wasRenamedExternally = !metadataByPath && Boolean(metadataByFileId);
        if (storedMetadata.id) {
          claimedMetadataIds.add(storedMetadata.id);
        }
        const fileTitle = path.basename(entry.name, path.extname(entry.name));
        const noteData = {
          ...(isLegacyNote ? parsed.data : {}),
          ...storedMetadata,
          title: wasRenamedExternally
            ? fileTitle
            : storedMetadata.title || (isLegacyNote ? parsed.data.title : null) || fileTitle,
          content: isLegacyNote ? parsed.content : raw,
          fileType: fileExtension.slice(1),
          folderId,
          createdAt: storedMetadata.createdAt
            || (isLegacyNote ? parsed.data.createdAt : null)
            || stats.birthtime.toISOString(),
          updatedAt: getLatestDateTime(
            storedMetadata.updatedAt,
            isLegacyNote ? parsed.data.updatedAt : null,
            stats.mtime.toISOString()
          )
        };
        const normalizedNote = normalizeLoadedNote(noteData);
        normalizedNote.isReviewFile = isReviewFolderId(folderId);
        normalizedNote.reviewDate = isValidReviewDate(storedMetadata.reviewDate)
          ? storedMetadata.reviewDate
          : null;
        notes.push(normalizedNote);
        noteFileMap.set(normalizedNote.id, fullPath);
        setNoteMetadata(fullPath, normalizedNote, fileId);

        if (isLegacyNote) {
          await backupLegacyMarkdown(fullPath, raw);
          markInternalNoteWrite(fullPath, parsed.content);
          await atomicWriteFile(fullPath, parsed.content, { encoding: 'utf8' });
          await fs.utimes(fullPath, stats.atime, stats.mtime);
        }
      } catch (error) {
        if (storedMetadataByPath[metadataKey]) {
          noteMetadata[metadataKey] = storedMetadataByPath[metadataKey];
        }
        console.error(`读取笔记文件失败: ${entry.name}`, error);
      }
    } else if (entry.isDirectory() && !isInternalDirectory(entry.name)) {
      // 查找对应的文件夹记录
      const folder = folders.find(f => f.name === entry.name && f.parentId === folderId);
      if (folder) {
        await scanDirectory(fullPath, folder.id, storedMetadataByPath, claimedMetadataIds);
      }
    }
  }
}

function classifyResourceFile(extension) {
  if (extension === '.pdf') {
    return { kind: 'pdf', typeLabel: 'PDF', canOpen: true };
  }
  if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'].includes(extension)) {
    return { kind: 'image', typeLabel: extension.slice(1).toUpperCase(), canOpen: true };
  }
  if (['.docx', '.doc'].includes(extension)) {
    return { kind: 'word', typeLabel: extension === '.doc' ? 'DOC' : 'WORD', canOpen: true };
  }
  if (extension === '.xlsx') {
    return { kind: 'spreadsheet', typeLabel: 'EXCEL', canOpen: true };
  }
  if (['.zip', '.rar', '.7z', '.tar', '.gz'].includes(extension)) {
    return { kind: 'archive', typeLabel: extension.slice(1).toUpperCase(), canOpen: false };
  }
  return {
    kind: 'other',
    typeLabel: extension ? extension.slice(1).toUpperCase() : 'FILE',
    canOpen: false
  };
}

async function scanResourceDirectory(dirPath, folderId) {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    const extension = path.extname(entry.name).toLowerCase();

    // 点文件（.DS_Store / .gitignore 等）不是用户资料，不能进资源列表和日历。
    if (entry.isFile() && shouldSkipScanEntry(entry.name, false, REVIEW_FOLDER_NAME)) {
      continue;
    }

    if (entry.isFile()
      && !['.md', '.txt', '.json'].includes(extension)
      && entry.name !== '.folder.json') {
      try {
        const stats = await fs.stat(fullPath);
        const type = classifyResourceFile(extension);
        const scanned = {
          id: fullPath,
          name: entry.name,
          path: fullPath,
          fileUrl: pathToFileURL(fullPath).href,
          folderId,
          extension,
          ...type,
          size: stats.size,
          createdAt: stats.birthtime.toISOString(),
          updatedAt: stats.mtime.toISOString(),
          isReviewFile: isReviewFolderId(folderId)
        };
        // 归天日期从落盘元数据回填，刷新/移动/重启后不丢。
        resourceFiles.push(
          applyResourceMetadata(scanned, resourceMetadata, getNoteMetadataKey(fullPath))
        );
      } catch (error) {
        console.error(`读取资源文件失败: ${entry.name}`, error);
      }
    } else if (entry.isDirectory() && !shouldSkipScanEntry(entry.name, true, REVIEW_FOLDER_NAME)) {
      const folder = folders.find((item) => item.name === entry.name && item.parentId === folderId);
      if (folder) {
        await scanResourceDirectory(fullPath, folder.id);
      }
    }
  }
}

async function loadPdfFiles() {
  if (resourceLoadPromise) {
    return resourceLoadPromise;
  }

  resourceLoadPromise = performLoadPdfFiles();
  try {
    return await resourceLoadPromise;
  } finally {
    resourceLoadPromise = null;
  }
}

async function performLoadPdfFiles() {
  const previousResourceFiles = resourceFiles;
  const previousPdfFiles = pdfFiles;
  const previousResourceMetadata = resourceMetadata;
  resourceFiles = [];
  pdfFiles = [];

  try {
    // 每次全量重建前先读回落盘的归天日期。
    await loadResourceMetadata();
    await scanResourceDirectory(getNotesPath(), null);
    resourceFiles.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
    pdfFiles = resourceFiles.filter((file) => file.kind === 'pdf');
    pdfFiles.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
  } catch (error) {
    resourceFiles = previousResourceFiles;
    pdfFiles = previousPdfFiles;
    resourceMetadata = previousResourceMetadata;
    throw error;
  }
}

function sendPdfFilesChanged() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('pdfs:changed', getVisiblePdfFiles());
    mainWindow.webContents.send('files:changed', getVisibleResourceFiles());
  }
}

async function previewResourceFile(fileId) {
  const file = resourceFiles.find((item) => item.id === fileId);
  if (!file || !file.canOpen) {
    throw new Error('该文件类型不支持预览');
  }
  assertFolderAccessible(file.folderId);

  if (file.kind === 'image') {
    return { kind: 'image', fileUrl: file.fileUrl };
  }
  if (file.kind === 'word') {
    if (file.extension === '.doc') {
      try {
        const extractor = new WordExtractor();
        const extracted = await extractor.extract(file.path);
        const text = extracted.getBody() || '';
        const paragraphs = text
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean)
          .map((line) => `<p class="word-document-paragraph">${escapeHtml(line)}</p>`)
          .join('');
        return { kind: 'word', html: paragraphs || '<p class="word-document-paragraph">文档内容为空</p>' };
      } catch (docErr) {
        console.error('word-extractor 解析 .doc 失败，尝试 fallback', docErr);
      }
    }

    try {
      const result = await mammoth.convertToHtml({ path: file.path }, {
        styleMap: [
          "p[style-name='Title'] => h1.word-document-title:fresh",
          "p[style-name='Subtitle'] => p.word-document-subtitle:fresh",
          "p[style-name='Heading 1'] => h1:fresh",
          "p[style-name='Heading 2'] => h2:fresh",
          "p[style-name='Heading 3'] => h3:fresh",
          "p[style-name='Heading 4'] => h4:fresh",
          "p[style-name='Heading 5'] => h5:fresh",
          "p[style-name='Heading 6'] => h6:fresh",
          "p[style-name='heading 1'] => h1:fresh",
          "p[style-name='heading 2'] => h2:fresh",
          "p[style-name='heading 3'] => h3:fresh",
          "p[style-name='heading 4'] => h4:fresh",
          "p[style-name='heading 5'] => h5:fresh",
          "p[style-name='heading 6'] => h6:fresh",
          "p[style-name='toc 1'] => p.word-toc.word-toc-1:fresh",
          "p[style-name='toc 2'] => p.word-toc.word-toc-2:fresh",
          "p[style-name='toc 3'] => p.word-toc.word-toc-3:fresh"
        ]
      });
      return { kind: 'word', html: result.value || '' };
    } catch (docxErr) {
      try {
        const extractor = new WordExtractor();
        const extracted = await extractor.extract(file.path);
        const text = extracted.getBody() || '';
        const paragraphs = text
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean)
          .map((line) => `<p class="word-document-paragraph">${escapeHtml(line)}</p>`)
          .join('');
        return { kind: 'word', html: paragraphs || '<p class="word-document-paragraph">文档内容为空</p>' };
      } catch (fallbackErr) {
        throw new Error('无法读取 Word 文档内容: ' + docxErr.message);
      }
    }
  }
  if (file.kind === 'spreadsheet') {
    // 解析在主进程跑，大工作簿会长时间独占事件循环。
    // 这里不做 worker（asar 打包下 worker 脚本路径需要额外解包，风险高），
    // 改成：文件大小上限 + 每 100 行/每个 sheet 让出一次事件循环，
    // 保证窗口拖动、通知、IPC 在解析期间仍能响应。
    const MAX_SPREADSHEET_PREVIEW_BYTES = 20 * 1024 * 1024;
    const fileStats = await fs.stat(file.path).catch(() => null);
    if (fileStats && fileStats.size > MAX_SPREADSHEET_PREVIEW_BYTES) {
      throw new Error('这个工作簿超过 20MB，应用内预览会拖慢整个应用，请用「外部打开」查看');
    }
    const yieldToEventLoop = () => new Promise((resolve) => setImmediate(resolve));
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(file.path);
    await yieldToEventLoop();
    const sheets = [];
    for (const worksheet of workbook.worksheets.slice(0, 20)) {
      const rowCount = Math.min(worksheet.rowCount, 500);
      const columnCount = Math.min(worksheet.columnCount, 50);
      const mergeMap = getSpreadsheetMergeMap(worksheet, rowCount, columnCount);
      const columns = [];
      for (let columnNumber = 1; columnNumber <= columnCount; columnNumber++) {
        const width = Number(worksheet.getColumn(columnNumber).width) || 10;
        columns.push({ width: Math.min(600, Math.max(42, Math.round(width * 7 + 12))) });
      }
      const rows = [];
      for (let rowNumber = 1; rowNumber <= rowCount; rowNumber++) {
        const cells = [];
        for (let columnNumber = 1; columnNumber <= columnCount; columnNumber++) {
          const merge = mergeMap.get(`${rowNumber}:${columnNumber}`);
          if (merge?.skip) {
            cells.push({ skip: true });
            continue;
          }
          cells.push({
            ...serializeSpreadsheetCell(worksheet.getCell(rowNumber, columnNumber)),
            rowSpan: merge?.rowSpan || 1,
            columnSpan: merge?.columnSpan || 1
          });
        }
        const height = Number(worksheet.getRow(rowNumber).height);
        rows.push({
          height: Number.isFinite(height) ? Math.round(height * 4 / 3) : null,
          cells
        });
        if (rowNumber % 100 === 0) {
          await yieldToEventLoop();
        }
      }
      sheets.push({
        name: worksheet.name,
        columns,
        rows,
        truncated: worksheet.rowCount > rowCount || worksheet.columnCount > columnCount
      });
      await yieldToEventLoop();
    }
    return { kind: 'spreadsheet', sheets };
  }
  throw new Error('该文件类型不支持预览');
}

function resolveLibraryEntryPath(entry) {
  if (!entry || typeof entry !== 'object') {
    return null;
  }

  if (entry.type === 'note') {
    return noteFileMap.get(entry.id) || null;
  }

  if (entry.type === 'file') {
    return resourceFiles.find((item) => item.id === entry.id)?.path || null;
  }

  if (entry.type === 'folder') {
    const folder = folders.find((item) => item.id === entry.id);
    return folder ? getFolderPath(folder.id) : null;
  }

  // 兼容旧调用方传 { path }（Word/Excel 预览页曾用它）。
  // 只允许笔记目录内的路径，避免借 IPC 打开任意文件。
  if (typeof entry.path === 'string' && entry.path) {
    const resolved = path.resolve(entry.path);
    if (isPathInside(path.resolve(getNotesPath()), resolved)) {
      return resolved;
    }
  }

  return null;
}

async function deleteResourceFile(_event, fileId) {
  const file = resourceFiles.find((item) => item.id === fileId);
  if (!file) {
    throw new Error('文件不存在');
  }
  assertFolderAccessible(file.folderId);

  await shell.trashItem(file.path);
  deleteResourceMetadata(file.path);
  await saveResourceMetadata();
  await loadPdfFiles();
  if (updateDailyReviewSelection()) {
    await saveConfig();
  }
  sendPdfFilesChanged();
  return resourceFiles;
}

async function moveResourceFile(_event, fileId, targetFolderId) {
  const file = resourceFiles.find((item) => item.id === fileId);
  if (!file) {
    throw new Error('文件不存在');
  }
  assertFolderAccessible(file.folderId);

  const normalizedTargetFolderId = targetFolderId || null;
  assertFolderTargetAccessible(normalizedTargetFolderId);
  if ((file.folderId || null) === normalizedTargetFolderId) {
    return resourceFiles;
  }

  const targetDir = getFolderPath(normalizedTargetFolderId);
  await fs.mkdir(targetDir, { recursive: true });
  const extension = path.extname(file.name);
  const baseName = path.basename(file.name, extension);
  const targetPath = await getUniqueFilePath(targetDir, baseName, extension);
  const previousResourceMetadata = structuredClone(resourceMetadata);
  await fs.rename(file.path, targetPath);
  // 归天日期按相对路径索引，移动后必须跟着换 key，否则设置会丢。
  try {
    if (moveResourceMetadataTree(resourceMetadata, getNoteMetadataKey(file.path), getNoteMetadataKey(targetPath))) {
      await saveResourceMetadata();
    }
  } catch (error) {
    await fs.rename(targetPath, file.path).catch((rollbackError) => {
      console.error('回滚移动资源文件失败:', rollbackError);
    });
    // R8：文件回滚了，内存里的元数据也必须回滚，否则旧 key 丢失、新 key 残留，
    // 后续任意一次资源保存都会把这份半套状态写进磁盘。
    resourceMetadata = previousResourceMetadata;
    await saveResourceMetadata().catch((rollbackError) => {
      console.error('回滚资源元数据失败:', rollbackError);
    });
    throw error;
  }
  await loadPdfFiles();
  if (updateDailyReviewSelection()) {
    await saveConfig();
  }
  sendPdfFilesChanged();
  return resourceFiles;
}

// 回顾操作按「天」进行：entry 为 { type: 'day', dayKey }
function resolveDailyReviewTarget(entry) {
  if (entry?.type !== 'day' || !isValidReviewDate(entry.dayKey)) {
    return null;
  }
  const dayNotes = notes.filter((note) => note.isReviewFile && getNoteReviewDayKey(note) === entry.dayKey);
  const dayFiles = resourceFiles.filter((file) => file.isReviewFile && getResourceReviewDayKey(file) === entry.dayKey);
  if (dayNotes.length === 0 && dayFiles.length === 0) {
    return null;
  }
  return {
    key: `day:${entry.dayKey}`,
    dayKey: entry.dayKey,
    notes: dayNotes,
    files: dayFiles,
    folderId: (dayNotes[0] || dayFiles[0]).folderId
  };
}

async function handleDailyReview(_event, entry, action) {
  if (!['complete', 'defer'].includes(action)) {
    throw new Error('未知的回顾操作');
  }
  const resolved = resolveDailyReviewTarget(entry);
  if (!resolved) {
    throw new Error('这一天没有可回顾的内容');
  }
  assertFolderAccessible(resolved.folderId);
  const today = toLocalDateKey(new Date());
  // 「完成回顾」允许对回顾面板里任意一天操作（补上闭环：以前不点完成就会一直推同一套）；
  // 「明天再看」仍然只针对今日自动选中的那一套，因为它依赖 selection 状态。
  const isTodaysSelection = dailyReviewSelection.date === today
    && dailyReviewSelection.entryKey === resolved.key;
  if (action === 'defer' && !isTodaysSelection) {
    throw new Error('只有今日自动选中的内容可以「明天再看」');
  }

  let lastReviewedAt = dailyReviewHistory[resolved.key] || null;
  let deferredUntil = null;
  if (action === 'complete') {
    lastReviewedAt = new Date().toISOString();
    dailyReviewHistory[resolved.key] = lastReviewedAt;
    // 完成过的套不占手动位置：否则排在队首的那套会被一直推回来。
    dailyReviewOrder = dailyReviewOrder.filter((key) => key !== resolved.dayKey);
    // 只有用户真的完成回顾才记一条事件；提醒触发/过期结算只写排序锚点，不进日志
    dayReviewLog.push({
      id: randomUUID(),
      dayKey: resolved.dayKey,
      reviewedAt: lastReviewedAt
    });
    if (dayReviewLog.length > DAY_REVIEW_LOG_LIMIT) {
      dayReviewLog = dayReviewLog.slice(-DAY_REVIEW_LOG_LIMIT);
    }
  } else {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    deferredUntil = toLocalDateKey(tomorrow);
    dailyReviewDeferred = { date: deferredUntil, entryKey: resolved.key };
  }

  // 补看历史某一天不应把「今天已处理」也一起记上，否则今天该推的那套会被跳过。
  if (isTodaysSelection) {
    dailyReviewHandledDate = today;
    dailyReviewSelection = { date: today, entryKey: null };
  }
  updateDailyReviewSelection();
  await saveConfig();
  sendNotesChanged();
  sendPdfFilesChanged();
  sendDayRemindersChanged();
  return { action, lastReviewedAt, deferredUntil, dayKey: resolved.dayKey };
}

// 调整回顾顺序：以「当前完整顺序」为基准移动一条，再整体固化到 dailyReviewOrder。
// 只记住被移动的那一条、其余让它退回算法顺序的话，界面看起来会跳位。
async function reorderDailyReview(_event, dayKey, action) {
  if (!isValidReviewDate(dayKey)) {
    throw new Error('回顾日期格式无效');
  }
  if (!['top', 'up', 'down'].includes(action)) {
    throw new Error('未知的排序操作');
  }
  const ordered = sortReviewQueue(getDailyReviewCandidates(), {
    order: dailyReviewOrder,
    history: dailyReviewHistory
  }).map((item) => item.dayKey);
  const next = moveInQueue(ordered, dayKey, action);
  if (!next) {
    throw new Error('这一套不在回顾队列里');
  }
  dailyReviewOrder = next;
  // 顺序变了就按新顺序重选今天这一套；今天已完成回顾时 updateDailyReviewSelection 内部会跳过。
  if (dailyReviewHandledDate !== toLocalDateKey(new Date())) {
    dailyReviewSelection = { date: null, entryKey: null };
  }
  updateDailyReviewSelection();
  await saveConfig();
  sendNotesChanged();
  sendPdfFilesChanged();
  return getAppSettings();
}

// 侧边栏三组（目录 / 笔记 / 资源文件）各自的「当前完整顺序」。
// 手动顺序数组只决定同组内的先后；目录整体在前、笔记次之、资源文件最后的分组不变。
function getSidebarOrderBase(kind) {
  if (kind === 'folders') {
    return folders.map((folder) => folder.id);
  }
  if (kind === 'notes') {
    const sorted = [...notes].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    // 稳定排序：今日回顾置顶，其余保持创建时间倒序。
    sorted.sort((a, b) => Number(Boolean(b.isDailyReview)) - Number(Boolean(a.isDailyReview)));
    return sorted.map((note) => note.id);
  }
  const sorted = [...resourceFiles].sort((a, b) => (
    Number(Boolean(b.isDailyReview)) - Number(Boolean(a.isDailyReview))
  ));
  return sorted.map((file) => file.id);
}

// 把某一条拖到另一条的前/后：以「当前完整顺序」为基准移动后整体固化，
// 这样界面看到的顺序会和落盘的一致，不会出现「拖了一步、刷新跳回去」。
async function reorderSidebar(_event, kind, dragId, targetId, position) {
  if (!['folders', 'notes', 'files'].includes(kind)) {
    throw new Error('未知的排序分组');
  }
  if (!['before', 'after'].includes(position)) {
    throw new Error('未知的排序位置');
  }
  if (typeof dragId !== 'string' || typeof targetId !== 'string') {
    throw new Error('条目 id 无效');
  }
  if (dragId === targetId) {
    return { sidebarOrder };
  }
  const base = getSidebarOrderBase(kind);
  if (!base.includes(dragId) || !base.includes(targetId)) {
    throw new Error('条目不在当前列表里');
  }
  const merged = mergeSidebarOrder(base, sidebarOrder[kind]);
  const next = moveSidebarEntry(merged, dragId, targetId, position);
  if (!next) {
    throw new Error('移动无效');
  }
  sidebarOrder = { ...sidebarOrder, [kind]: next };
  await saveConfig();
  return { sidebarOrder };
}

// 回顾面板某一天的默认顺序：笔记（最近修改在前）+ 资源文件，与渲染层一致。
// 口径必须和面板看到的一致（用可见性过滤，而不是「回顾池」那套排除密码目录的规则），
// 否则解锁后的受保护目录里的文件能看见却拖不动。
function getReviewDayOrderBase(dayKey) {
  const visible = (folderId) => !getLockedFolderForFolderId(folderId, unlockedFolderIds, true);
  const dayNotes = notes.filter((note) => (
    note.isReviewFile && visible(note.folderId) && getNoteReviewDayKey(note) === dayKey
  ));
  const dayFiles = resourceFiles.filter((file) => (
    file.isReviewFile && visible(file.folderId) && getResourceReviewDayKey(file) === dayKey
  ));
  return buildDefaultReviewDayOrder(dayNotes, dayFiles);
}

// 回顾面板里把当天某个文件拖到另一个文件的前/后。
// 与侧边栏排序同一套做法：以「当前完整顺序」为基准移动后整体固化，
// 保证界面看到的顺序和落盘的一致。
async function reorderReviewDayFile(_event, dayKey, dragKey, targetKey, position) {
  if (!isValidReviewDate(dayKey)) {
    throw new Error('日期无效');
  }
  if (!['before', 'after'].includes(position)) {
    throw new Error('未知的排序位置');
  }
  if (typeof dragKey !== 'string' || typeof targetKey !== 'string') {
    throw new Error('条目 id 无效');
  }
  if (dragKey === targetKey) {
    return { reviewDayOrder };
  }
  const base = getReviewDayOrderBase(dayKey);
  if (!base.includes(dragKey) || !base.includes(targetKey)) {
    throw new Error('条目不在当前列表里');
  }
  const merged = mergeSidebarOrder(base, reviewDayOrder[dayKey] || []);
  const next = moveSidebarEntry(merged, dragKey, targetKey, position);
  if (!next) {
    throw new Error('移动无效');
  }
  reviewDayOrder = { ...reviewDayOrder, [dayKey]: next };
  await saveConfig();
  return { reviewDayOrder };
}

// 归天改动的保存与回滚：笔记写 metadata.json，资源写 resource-metadata.json。
// 任何一步写盘失败都要把内存状态与两份元数据一起复原，不能留「界面变了、磁盘没变」。
function captureReviewState() {
  return {
    notes: notes.map((note) => ({ note, reviewDate: note.reviewDate })),
    files: resourceFiles.map((file) => ({ file, reviewDate: file.reviewDate })),
    noteMetadata: structuredClone(noteMetadata),
    resourceMetadata: structuredClone(resourceMetadata)
  };
}

async function restoreReviewState(snapshot, error) {
  for (const item of snapshot.notes) {
    item.note.reviewDate = item.reviewDate;
  }
  for (const item of snapshot.files) {
    item.file.reviewDate = item.reviewDate;
  }
  noteMetadata = snapshot.noteMetadata;
  resourceMetadata = snapshot.resourceMetadata;
  await Promise.allSettled([saveNoteMetadata(), saveResourceMetadata()]);
  throw new Error(`保存回顾设置失败，已回滚：${error.message}`, { cause: error });
}

async function persistReviewMetadata(entry, target, filePath) {
  if (entry.type === 'note') {
    const stats = await fs.stat(filePath).catch(() => null);
    setNoteMetadata(filePath, target, stats ? String(stats.ino) : null);
    await saveNoteMetadata();
  } else {
    setResourceMetadata(filePath, target);
    await saveResourceMetadata();
  }
}

// 设置文件的回顾日期（归天）；传 null 恢复为按创建时间归天
async function setReviewDate(_event, entry, reviewDate) {
  if (!entry || !['note', 'file'].includes(entry.type)) {
    throw new Error('只能设置笔记的回顾日期');
  }
  if (reviewDate !== null && !isValidReviewDate(reviewDate)) {
    throw new Error('回顾日期格式无效');
  }

  let target;
  let filePath;
  if (entry.type === 'note') {
    target = notes.find((item) => item.id === entry.id);
    filePath = target ? noteFileMap.get(target.id) : null;
  } else {
    target = resourceFiles.find((item) => item.id === entry.id);
    filePath = target?.path || null;
  }
  if (!target || !filePath) {
    throw new Error('文件不存在');
  }
  assertFolderAccessible(target.folderId);

  const nextDate = reviewDate || null;
  if (target.reviewDate === nextDate) {
    return { reviewDate: nextDate };
  }
  const snapshot = captureReviewState();
  target.reviewDate = nextDate;
  try {
    await persistReviewMetadata(entry, target, filePath);
  } catch (error) {
    await restoreReviewState(snapshot, error);
  }
  if (updateDailyReviewSelection()) {
    await saveConfig();
  }
  sendNotesChanged();
  sendPdfFilesChanged();
  return { reviewDate: nextDate };
}

async function copyLibraryEntryPath(_event, entry) {
  if (entry?.type === 'note') {
    assertFolderAccessible(notes.find((item) => item.id === entry.id)?.folderId || null);
  } else if (entry?.type === 'file') {
    assertFolderAccessible(resourceFiles.find((item) => item.id === entry.id)?.folderId || null);
  } else if (entry?.type === 'folder') {
    assertFolderAccessible(entry.id);
  }
  const targetPath = resolveLibraryEntryPath(entry);
  if (!targetPath) {
    throw new Error('路径不存在');
  }

  clipboard.writeText(targetPath);
  return targetPath;
}

async function showLibraryEntryInFolder(_event, entry) {
  if (entry?.type === 'note') {
    assertFolderAccessible(notes.find((item) => item.id === entry.id)?.folderId || null);
  } else if (entry?.type === 'file') {
    assertFolderAccessible(resourceFiles.find((item) => item.id === entry.id)?.folderId || null);
  } else if (entry?.type === 'folder') {
    assertFolderAccessible(entry.id);
  }
  const targetPath = resolveLibraryEntryPath(entry);
  if (!targetPath) {
    throw new Error('路径不存在');
  }

  if (entry.type === 'folder') {
    const result = await shell.openPath(targetPath);
    if (result) {
      throw new Error(result);
    }
    return targetPath;
  }

  shell.showItemInFolder(targetPath);
  return targetPath;
}

async function openLibraryEntry(_event, entry) {
  if (entry?.type === 'note') {
    assertFolderAccessible(notes.find((item) => item.id === entry.id)?.folderId || null);
  } else if (entry?.type === 'file') {
    assertFolderAccessible(resourceFiles.find((item) => item.id === entry.id)?.folderId || null);
  }
  const targetPath = resolveLibraryEntryPath(entry);
  if (!targetPath || entry?.type === 'folder') {
    throw new Error('文件不存在');
  }

  const result = await shell.openPath(targetPath);
  if (result) {
    throw new Error(result);
  }
  return targetPath;
}

async function openExternalUrl(_event, value) {
  const url = new URL(String(value || ''));
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('仅支持打开 HTTP 或 HTTPS 链接');
  }
  await shell.openExternal(url.href);
  return true;
}

const pendingNoteReloadPaths = new Set();
let forceFullNoteReload = false;
let folderReloadTimer = null;

function schedulePdfReload(changedRelativePath = null) {
  clearTimeout(pdfReloadTimer);
  pdfReloadTimer = setTimeout(() => {
    const pendingNoteLoad = noteLoadPromise || Promise.resolve();
    pendingNoteLoad
      .then(() => loadPdfFiles())
      .then(async () => {
        if (updateDailyReviewSelection()) {
          await saveConfig();
        }
        sendPdfFilesChanged();
        sendNotesChanged();
      })
      .catch((error) => console.error('同步 PDF 列表失败:', error));
  }, 300);
}

// 文件夹元数据（.folder.json）变化只影响文件夹列表，不必重读所有笔记正文。
function scheduleFolderReload() {
  clearTimeout(folderReloadTimer);
  folderReloadTimer = setTimeout(() => {
    loadFolders()
      .then(() => {
        sendFoldersChanged();
        sendNotesChanged();
      })
      .catch((error) => console.error('同步文件夹列表失败:', error));
  }, 300);
}

// 单个已存在的笔记在外部被改动时，只重读这一篇，避免整库正文重扫 + 元数据全量写盘。
// 新增/删除/重命名/多文件变化仍走全量 loadNotes()，由文件身份（inode）逻辑处理。
async function reloadExternalNoteContent(relativePath) {
  const fullPath = path.join(getNotesPath(), relativePath);
  const existing = notes.find((note) => noteFileMap.get(note.id) === fullPath);
  if (!existing || !await pathExists(fullPath)) {
    return false;
  }
  const raw = await fs.readFile(fullPath, 'utf8');
  const stats = await fs.stat(fullPath);
  const extension = path.extname(fullPath).toLowerCase();
  const parsed = extension === '.md' ? matter(raw) : { data: {}, content: raw };
  const isLegacyNote = extension === '.md' && Boolean(parsed.data.id
    && parsed.data.title && parsed.data.createdAt && parsed.data.updatedAt
    && Array.isArray(parsed.data.reminders));
  const content = isLegacyNote ? parsed.content : raw;
  const mtime = stats.mtime.toISOString();
  if (existing.content === content && existing.updatedAt >= mtime) {
    return true;
  }
  existing.content = content;
  existing.updatedAt = mtime;
  setNoteMetadata(fullPath, existing, Number(stats.ino) > 0 ? String(stats.ino) : null);
  await saveNoteMetadata();
  return true;
}

function broadcastNoteReload() {
  scheduleReminderCheck();
  sendNotesChanged();
  sendFoldersChanged();
  sendPdfFilesChanged();
}

function scheduleNoteReload(changedRelativePath = undefined) {
  if (changedRelativePath) {
    pendingNoteReloadPaths.add(changedRelativePath);
  }
  if (changedRelativePath === null) {
    // 目录级变化（新建/删除/移动）无法用单文件增量推断，必须全量重扫。
    forceFullNoteReload = true;
  }
  clearTimeout(noteReloadTimer);
  noteReloadTimer = setTimeout(async () => {
    const paths = [...pendingNoteReloadPaths];
    const forceFull = forceFullNoteReload;
    pendingNoteReloadPaths.clear();
    forceFullNoteReload = false;

    if (!forceFull && paths.length === 1) {
      try {
        if (await reloadExternalNoteContent(paths[0])) {
          broadcastNoteReload();
          return;
        }
      } catch (error) {
        console.error('增量同步笔记失败，回退全量扫描:', error);
      }
    }
    loadNotes()
      .then(broadcastNoteReload)
      .catch((error) => console.error('同步 Markdown 列表失败:', error));
  }, 400);
}

function watchPdfFiles() {
  pdfWatcher?.close();
  pdfWatcher = null;

  try {
    pdfWatcher = watch(getNotesPath(), { recursive: true }, (_eventType, fileName) => {
      const relativePath = String(fileName || '').split(path.sep).join('/');
      const extension = path.extname(relativePath).toLowerCase();
      const baseName = path.basename(relativePath).toLowerCase();
      const normalizedRelativePath = relativePath.toLowerCase();
      if (
        normalizedRelativePath === APP_DATA_DIR_NAME
        || normalizedRelativePath.startsWith(`${APP_DATA_DIR_NAME}/`)
      ) {
        return;
      }
      if (
        baseName.startsWith('.')
        && (baseName.endsWith('.tmp') || baseName.endsWith('.rollback'))
      ) {
        return;
      }
      // 按变更路径分流：资源变化只重扫资源，笔记变化才全量重读正文。
      // 收集路径到 pendingNoteReloadPaths，debounce 后一次处理，避免一次操作触发多次 loadNotes。
      if (extension === '.pdf') {
        schedulePdfReload(relativePath);
      } else if (['.md', '.txt', '.json'].includes(extension)
        && path.basename(relativePath) !== '.folder.json') {
        const key = relativePath.toLowerCase();
        if (internalNoteWrites.has(key)) {
          const fullPath = path.join(getNotesPath(), relativePath);
          isExpectedInternalNoteWrite(fullPath, key)
            .then((isInternal) => {
              if (!isInternal) {
                scheduleNoteReload(relativePath);
              }
            })
            .catch(() => scheduleNoteReload(relativePath));
          return;
        }
        scheduleNoteReload(relativePath);
      } else if (!extension && relativePath) {
        scheduleNoteReload(null);
        schedulePdfReload(relativePath);
      } else if (path.basename(relativePath) === '.folder.json') {
        // 文件夹元数据（密码/结构）变化只需刷新文件夹列表，不必重读所有笔记正文。
        scheduleFolderReload();
      } else {
        schedulePdfReload(relativePath);
      }
    });
    pdfWatcher.on('error', (error) => console.error('监听资料库文件失败:', error));
  } catch (error) {
    console.error('启动资料库文件监听失败:', error);
  }
}

async function migrateFromJson(jsonPath, notesDir) {
  const raw = await fs.readFile(jsonPath, 'utf8');
  const parsed = JSON.parse(raw);
  const isLegacyNotes = Array.isArray(parsed)
    && parsed.length > 0
    && parsed.every((item) => item
      && typeof item === 'object'
      && !Array.isArray(item)
      && typeof item.id === 'string'
      && typeof item.title === 'string'
      && typeof item.content === 'string'
      && (item.reminders === undefined || Array.isArray(item.reminders))
      && (item.createdAt === undefined || typeof item.createdAt === 'string')
      && (item.updatedAt === undefined || typeof item.updatedAt === 'string'));
  if (!isLegacyNotes) {
    return;
  }

  await fs.mkdir(notesDir, { recursive: true });
  const backupPath = await getUniqueFilePath(
    path.dirname(jsonPath),
    path.basename(jsonPath),
    '.bak'
  );
  const previousMetadata = noteMetadata;
  noteMetadata = { ...noteMetadata };
  const generatedPaths = [];
  try {
    for (const noteData of parsed) {
      const normalizedNote = normalizeLoadedNote(noteData);
      const baseName = sanitizeNoteFilename(normalizedNote.title);
      const filePath = await getUniqueFilePath(notesDir, baseName);
      markInternalNoteWrite(filePath, normalizedNote.content || '');
      await atomicWriteFile(filePath, normalizedNote.content || '', { encoding: 'utf8' });
      generatedPaths.push(filePath);
      setNoteMetadata(filePath, normalizedNote);
    }
    await saveNoteMetadata();
    // 所有新文件和元数据都落盘后才移动旧库，保证迁移可重试。
    await fs.rename(jsonPath, backupPath);
  } catch (error) {
    for (const generatedPath of generatedPaths) {
      await fs.rm(generatedPath, { force: true }).catch(() => {});
    }
    noteMetadata = previousMetadata;
    await saveNoteMetadata().catch((restoreError) => {
      console.error('恢复迁移前元数据失败:', restoreError);
    });
    throw error;
  }
}

async function saveNote(note) {
  const targetDir = getFolderPath(note.folderId);
  await fs.mkdir(targetDir, { recursive: true });

  let filePath = noteFileMap.get(note.id);
  if (!filePath) {
    const baseName = sanitizeNoteFilename(note.title);
    filePath = await getUniqueFilePath(targetDir, baseName, getNoteFileExtension(note.fileType));
  }

  markInternalNoteWrite(filePath, note.content || '');
  await atomicWriteFile(filePath, note.content || '', { encoding: 'utf8' });
  noteFileMap.set(note.id, filePath);
  const stats = await fs.stat(filePath);
  setNoteMetadata(filePath, note, Number(stats.ino) > 0 ? String(stats.ino) : null);
  await saveNoteMetadata();
}

function getStorageInfo() {
  const notesPath = getNotesPath();
  return {
    notesPath,
    notesUrl: pathToFileURL(`${path.resolve(notesPath)}${path.sep}`).href,
    defaultNotesPath: getDefaultNotesPath(),
    isDefault: notesPath === getDefaultNotesPath(),
    format: 'markdown'
  };
}

function sendStorageChanged() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('storage:changed', getStorageInfo());
  }
}

function sendReminderFired(payload) {
  // 提醒到达时不再主动拉起窗口，仅投递到应用内通知面板（系统通知在 fireDueReminders 中单独发出）。
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  mainWindow.webContents.send('reminder:fired', payload);
}

// 点击系统通知 / 通知中心条目后，把回顾面板定位到这一套内容所属的那一天
function sendDayReminderOpen(dayKey) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('day-reminder:open', dayKey);
  }
}

// 天级提醒 / 回顾日志有变动时同步给渲染层（回顾面板 chips、日历 Tab 都读 appSettings）
function sendDayRemindersChanged() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('day-reminders:changed', {
      dayReminders: listDayReminders(),
      dayReviewLog: getDayReviewLog()
    });
  }
}

function sendNotesChanged() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('notes:changed', getVisibleNotes());
  }
}

async function upsertNote(_event, input) {
  const note = normalizeNote(input);
  let index = notes.findIndex((item) => item.id === note.id);
  let targetNote;
  let renamedPaths = null;

  if (index < 0 && typeof input.sourceUrl === 'string') {
    try {
      const sourcePath = fileURLToPath(input.sourceUrl);
      if (isPathInside(getNotesPath(), sourcePath) && await pathExists(sourcePath)) {
        const resolvedSourcePath = path.resolve(sourcePath).toLowerCase();
        const existingEntry = [...noteFileMap].find(([, filePath]) => {
          return path.resolve(filePath).toLowerCase() === resolvedSourcePath;
        });
        if (existingEntry) {
          const [existingId] = existingEntry;
          index = notes.findIndex((item) => item.id === existingId);
          if (existingId !== note.id) {
            noteFileMap.delete(existingId);
            noteFileMap.set(note.id, sourcePath);
          }
        } else {
          noteFileMap.set(note.id, sourcePath);
        }
      }
    } catch {
      // 无法恢复原始路径时继续按笔记 ID 处理。
    }
  }

  if (index >= 0) {
    const oldNote = notes[index];
    assertFolderAccessible(oldNote.folderId);
    assertFolderTargetAccessible(note.folderId);
    targetNote = { ...oldNote, ...note };

    // 如果标题改变了或文件夹改变了，需要移动/重命名文件
    if (oldNote.title !== note.title || oldNote.folderId !== note.folderId) {
      const oldPath = noteFileMap.get(note.id);
      if (oldPath) {
        const targetDir = getFolderPath(note.folderId);
        await fs.mkdir(targetDir, { recursive: true });
        const baseName = sanitizeNoteFilename(note.title);
        const extension = getNoteFileExtension(note.fileType);
        const newPath = await getUniqueFilePath(targetDir, baseName, extension);
        await fs.rename(oldPath, newPath);
        noteFileMap.set(note.id, newPath);
        moveNoteMetadata(oldPath, newPath);
        renamedPaths = { oldPath, newPath };
      }
    }
  } else {
    if (!noteFileMap.has(note.id)) {
      throw new Error('笔记文件不存在，请刷新后重试');
    }
    assertFolderTargetAccessible(note.folderId);
    targetNote = note;
  }

  targetNote.isReviewFile = isReviewFolderId(targetNote.folderId);

  try {
    await saveNote(targetNote);
  } catch (error) {
    if (renamedPaths) {
      try {
        await fs.rename(renamedPaths.newPath, renamedPaths.oldPath);
        noteFileMap.set(note.id, renamedPaths.oldPath);
        moveNoteMetadata(renamedPaths.newPath, renamedPaths.oldPath);
      } catch (rollbackError) {
        console.error('回滚笔记重命名失败:', rollbackError);
      }
    }
    throw error;
  }

  let sidebarOrderChanged = false;
  if (index >= 0) {
    notes[index] = targetNote;
  } else {
    notes.unshift(targetNote);
    // 手动排过顺序时新笔记放最上面，避免落到列表末尾找不到。
    if (sidebarOrder.notes.length > 0 && !sidebarOrder.notes.includes(targetNote.id)) {
      sidebarOrder = { ...sidebarOrder, notes: [targetNote.id, ...sidebarOrder.notes] };
      sidebarOrderChanged = true;
    }
  }
  sortNotesByCreatedAt();
  if (updateDailyReviewSelection() || sidebarOrderChanged) {
    await saveConfig();
  }
  scheduleReminderCheck();
  // 当前编辑器已直接收到保存结果，文件监听会忽略这次内部写入，避免重复刷新列表。
  return targetNote;
}

// 收集笔记正文里指向「应用内图片资产目录」的本地图片。
// 外部 file:// 图片与相对路径图片不属于我们生成的资产，不能删。
function extractLocalImageAssets(content) {
  const root = path.resolve(getAppDataPath(), IMAGE_ASSET_DIR_NAME);
  const result = new Set();
  for (const match of String(content || '').matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)) {
    const source = String(match[1] || '').trim();
    if (!source.startsWith('file:')) {
      continue;
    }
    try {
      const filePath = path.resolve(fileURLToPath(source));
      if (isPathInside(root, filePath)) {
        result.add(filePath);
      }
    } catch {
      // 非法的 file URL 忽略
    }
  }
  return [...result];
}

// 删除笔记后，把它引用过、且已无任何笔记引用的图片移到回收站。
// 跨笔记共享的图片会被保留；只处理我们自己的资产目录，绝不碰用户文件。
async function cleanupOrphanImageAssets(candidates) {
  if (candidates.length === 0) {
    return 0;
  }
  const remainingContent = notes.map((note) => note.content || '').join('\n');
  let removed = 0;
  for (const filePath of candidates) {
    const fileUrl = pathToFileURL(filePath).href;
    if (remainingContent.includes(fileUrl) || remainingContent.includes(filePath)) {
      continue;
    }
    try {
      await shell.trashItem(filePath);
      removed += 1;
    } catch (error) {
      console.error('清理孤儿图片失败:', filePath, error);
    }
  }
  return removed;
}

async function deleteNote(_event, noteId) {
  const targetNote = notes.find((note) => note.id === noteId);
  if (!targetNote) {
    throw new Error('笔记不存在');
  }
  assertFolderAccessible(targetNote.folderId);
  const orphanImageCandidates = extractLocalImageAssets(targetNote.content);

  // 删除文件
  const filePath = noteFileMap.get(noteId);
  if (filePath) {
    await shell.trashItem(filePath);
    delete noteMetadata[getNoteMetadataKey(filePath)];
    noteFileMap.delete(noteId);
    await saveNoteMetadata();
  }

  notes = notes.filter((note) => note.id !== noteId);
  await cleanupOrphanImageAssets(orphanImageCandidates);

  if (notes.length === 0) {
    const note = createEmptyNote();
    notes.push(note);
    await saveNote(note);
  }

  sortNotesByCreatedAt();
  if (updateDailyReviewSelection()) {
    await saveConfig();
  }
  scheduleReminderCheck();
  sendNotesChanged();
  return notes;
}

async function useNotesPath(nextPath) {
  if (noteLoadPromise) {
    await noteLoadPromise;
  }
  // 「恢复默认」在已经处于默认目录时不应清空任何状态。
  if (path.resolve(nextPath) === path.resolve(getNotesPath())) {
    return {
      notes,
      storage: getStorageInfo()
    };
  }
  const previousState = {
    notesPath,
    notes,
    folders,
    pdfFiles,
    resourceFiles,
    noteFileMap,
    noteMetadata,
    resourceMetadata: structuredClone(resourceMetadata),
    folderMetadata,
    dailyReviewSelection,
    dailyReviewHistory,
    sidebarOrder: { ...sidebarOrder },
    reviewDayOrder: { ...reviewDayOrder },
    dailyReviewHandledDate,
    dailyReviewDeferred,
    dayReminders: dayReminders.map((item) => ({ ...item })),
    dayRemindersMigrated,
    dayReviewLog: dayReviewLog.map((item) => ({ ...item })),
    missedReminderNoticeDate,
    pendingMissedReminderNotice: pendingMissedReminderNotice
      ? { ...pendingMissedReminderNotice, dayKeys: [...pendingMissedReminderNotice.dayKeys] }
      : null,
    unlockedFolderIds: new Set(unlockedFolderIds)
  };
  notesPath = nextPath;
  unlockedFolderIds.clear();
  // 提醒与回顾记录按库隔离：切换到一个新库不应沿用旧库的复习日、日志与历史。
  dayReminders = [];
  dayRemindersMigrated = false;
  dayReviewLog = [];
  dailyReviewSelection = { date: null, entryKey: null };
  dailyReviewHistory = {};
  sidebarOrder = { folders: [], notes: [], files: [] };
  reviewDayOrder = {};
  dailyReviewOrder = [];
  dailyReviewHandledDate = null;
  dailyReviewDeferred = { date: null, entryKey: null };
  missedReminderNoticeDate = null;
  pendingMissedReminderNotice = null;
  try {
    // R4：切换存储位置后同样要确保回顾目录存在，否则回顾面板「+ 新建」会一直失败到重启。
    await migrateReviewFolder();
    await loadNotes();
    // 新库可能带着旧版 note.reminders，切换后按同一规则迁移一次。
    await migrateRemindersToDays();
    updateDailyReviewSelection();
    await saveConfig();
  } catch (error) {
    notesPath = previousState.notesPath;
    notes = previousState.notes;
    folders = previousState.folders;
    pdfFiles = previousState.pdfFiles;
    resourceFiles = previousState.resourceFiles;
    noteFileMap = previousState.noteFileMap;
    noteMetadata = previousState.noteMetadata;
    // R7：loadNotes() 会经 loadPdfFiles() 读入新目录的资源元数据；
    // 切换失败时若不恢复，之后任何一次保存都会把新目录的数据写回旧目录。
    resourceMetadata = previousState.resourceMetadata;
    folderMetadata = previousState.folderMetadata;
    dailyReviewSelection = previousState.dailyReviewSelection;
    dailyReviewHistory = previousState.dailyReviewHistory;
    sidebarOrder = previousState.sidebarOrder;
    reviewDayOrder = previousState.reviewDayOrder;
    dailyReviewHandledDate = previousState.dailyReviewHandledDate;
    dailyReviewDeferred = previousState.dailyReviewDeferred;
    dayReminders = previousState.dayReminders;
    dayRemindersMigrated = previousState.dayRemindersMigrated;
    dayReviewLog = previousState.dayReviewLog;
    missedReminderNoticeDate = previousState.missedReminderNoticeDate;
    pendingMissedReminderNotice = previousState.pendingMissedReminderNotice;
    unlockedFolderIds.clear();
    for (const folderId of previousState.unlockedFolderIds) {
      unlockedFolderIds.add(folderId);
    }
    await saveConfig();
    throw error;
  }
  watchPdfFiles();
  scheduleReminderCheck();
  sendNotesChanged();
  sendFoldersChanged();
  sendPdfFilesChanged();
  sendDayRemindersChanged();
  sendStorageChanged();
  return {
    notes,
    storage: getStorageInfo()
  };
}

async function chooseNotesPath() {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '选择笔记保存目录',
    defaultPath: getNotesPath(),
    properties: ['openDirectory', 'createDirectory']
  });

  if (result.canceled || !result.filePaths.length) {
    return null;
  }

  return useNotesPath(result.filePaths[0]);
}

async function resetNotesPath() {
  return useNotesPath(getDefaultNotesPath());
}

async function insertImageForNote(_event, payload) {
  if (!payload || !payload.noteId) {
    return null;
  }
  getAccessibleNote(payload.noteId);

  const result = await dialog.showOpenDialog(mainWindow, {
    title: '选择图片',
    properties: ['openFile'],
    filters: [
      { name: '图片', extensions: ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'svg'] }
    ]
  });

  if (result.canceled || !result.filePaths.length) {
    return null;
  }

  return copyImageForNote(payload.noteId, result.filePaths[0]);
}

// ---------- 天级提醒 ----------
// 一条记录 = 「dayKey 那一天的整套内容」在「date 这个复习日」提醒一次。
// 与每日自动回顾是两套独立调度（各自推送，互不抢占），只共享 dailyReviewHistory 作为「最近看过」依据。
// 旧版 note.reminders[] 只在一次性迁移时读取，之后不再参与任何调度。

function formatDayKeyShort(dayKey) {
  const [, month, day] = dayKey.split('-');
  return `${Number(month)}月${Number(day)}日`;
}

function getDayReminderDueTime(record) {
  const timePart = typeof record.time === 'string' ? record.time.slice(11, 16) : '';
  const slot = /^\d{2}:\d{2}$/.test(timePart) ? timePart : DAILY_REMINDER_TIMES[0];
  const parsed = new Date(`${record.date}T${slot}:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

// 一次性迁移：把旧的单篇提醒按「内容天 + 复习日」归并成天级记录，保留已触发状态避免重复弹
async function migrateRemindersToDays() {
  if (dayRemindersMigrated) {
    return false;
  }
  const merged = new Map();
  for (const note of notes) {
    const dayKey = getNoteReviewDayKey(note);
    if (!dayKey || !Array.isArray(note.reminders)) {
      continue;
    }
    for (const reminder of note.reminders) {
      const date = isValidReviewDate(reminder.date) ? reminder.date : null;
      if (!date) {
        continue;
      }
      const key = `${dayKey}|${date}`;
      const existing = merged.get(key);
      const firedAt = reminder.firedAt || null;
      if (existing) {
        // 同组全部旧提醒都完成过，才算这一整套已提醒过
        existing.done = existing.done && Boolean(reminder.done);
        if (firedAt && (!existing.firedAt || firedAt > existing.firedAt)) {
          existing.firedAt = firedAt;
        }
      } else {
        merged.set(key, {
          id: randomUUID(),
          dayKey,
          date,
          time: reminder.time || `${date}T${DAILY_REMINDER_TIMES[0]}:00.000`,
          done: Boolean(reminder.done),
          firedAt
        });
      }
    }
  }
  dayReminders = [...merged.values()].sort((a, b) =>
    a.date.localeCompare(b.date) || a.dayKey.localeCompare(b.dayKey));
  dayRemindersMigrated = true;
  await saveConfig();
  return merged.size > 0;
}

function listDayReminders(dayKey = null) {
  const items = dayKey ? dayReminders.filter((item) => item.dayKey === dayKey) : dayReminders;
  return [...items].sort((a, b) => a.date.localeCompare(b.date));
}

// 天级提醒变化会改变自动回顾候选池，统一在这里重算选中态并同步渲染层
async function syncDayReminderChange() {
  updateDailyReviewSelection();
  await saveConfig();
  scheduleReminderCheck();
  sendNotesChanged();
  sendDayRemindersChanged();
}

function makeDayReminder(dayKey, date) {
  return {
    id: randomUUID(),
    dayKey,
    date,
    time: `${date}T${DAILY_REMINDER_TIMES[0]}:00.000`,
    done: false,
    firedAt: null
  };
}

async function addDayReminder(_event, dayKey, date) {
  if (!isValidReviewDate(dayKey) || !isValidReviewDate(date)) {
    throw new Error('提醒日期格式无效');
  }
  // UI 的 min 只是提示，IPC 是唯一可信边界：不允许排到今天之前。
  if (date < toLocalDateKey(new Date())) {
    throw new Error('复习日不能早于今天');
  }
  if (!dayReminders.some((item) => item.dayKey === dayKey && item.date === date)) {
    dayReminders.push(makeDayReminder(dayKey, date));
    await syncDayReminderChange();
  }
  return listDayReminders(dayKey);
}

async function removeDayReminder(_event, id) {
  const target = dayReminders.find((item) => item.id === id);
  if (!target) {
    return listDayReminders();
  }
  dayReminders = dayReminders.filter((item) => item.id !== id);
  await syncDayReminderChange();
  return listDayReminders(target.dayKey);
}

// 改复习日：只动日期，时刻沿用默认档；等价于「先删掉这条、再排到新日期」，
// 但保留原 id，界面上的行不会跳成另一条记录。
async function updateDayReminderDate(_event, id, date) {
  if (!isValidReviewDate(date)) {
    throw new Error('提醒日期格式无效');
  }
  if (date < toLocalDateKey(new Date())) {
    throw new Error('复习日不能早于今天');
  }
  const target = dayReminders.find((item) => item.id === id);
  if (!target) {
    throw new Error('提醒不存在');
  }
  if (target.done) {
    throw new Error('已经提醒过的记录不能改日期');
  }
  if (target.date === date) {
    return listDayReminders();
  }
  // 同一套内容在同一天只排一次，避免改期后出现重复推送
  if (dayReminders.some((item) =>
    item.id !== id && item.dayKey === target.dayKey && item.date === date)) {
    throw new Error('这一天已经为同一套内容排过提醒');
  }
  target.date = date;
  target.time = `${date}T${DAILY_REMINDER_TIMES[0]}:00.000`;
  target.firedAt = null;
  await syncDayReminderChange();
  return listDayReminders();
}

// 「第 2/3/7/15/30 天」是天级复习日，不跳周末（与已下线的旧按笔记提醒不同）。
// 今天算第 1 天，所以偏移是 1/2/6/14/29；到点当天 09:30 触发。
function getAutoReminderDates() {
  const today = new Date();
  return [...new Set(
    AUTO_REMINDER_DAY_OFFSETS.map((offset) => toLocalDateKey(addDays(today, offset)))
  )];
}

async function autoScheduleDayReminders(_event, dayKey) {
  if (!isValidReviewDate(dayKey)) {
    throw new Error('回顾日期格式无效');
  }
  for (const date of getAutoReminderDates()) {
    if (!dayReminders.some((item) => item.dayKey === dayKey && item.date === date)) {
      dayReminders.push(makeDayReminder(dayKey, date));
    }
  }
  await syncDayReminderChange();
  return listDayReminders(dayKey);
}

// 某一天那一整套内容（回顾文件夹内的笔记 + 可打开资源）。
// includeProtected=false 用于系统通知：锁定目录的文件名/标题绝不外泄。
function getReviewDayContent(dayKey, { includeProtected = false } = {}) {
  const accessible = (item) => includeProtected || !isProtectedFromDailyReview(item.folderId);
  const dayNotes = notes.filter((note) =>
    note.isReviewFile && getNoteReviewDayKey(note) === dayKey && accessible(note));
  const dayFiles = resourceFiles.filter((file) =>
    file.isReviewFile && file.canOpen && getResourceReviewDayKey(file) === dayKey && accessible(file));
  return { dayNotes, dayFiles };
}

function getPendingDayReminders() {
  const now = new Date();
  const todayKey = toLocalDateKey(now);
  return dayReminders.filter((record) => {
    if (record.done || record.date !== todayKey) {
      return false;
    }
    const due = getDayReminderDueTime(record);
    return due && due <= now;
  });
}

async function markDayReminderFired(record) {
  record.done = true;
  record.firedAt = new Date().toISOString();
  // 一次整套内容的接触，按天写回顾历史，避免隔天又被当成「从未看过」而重复推
  dailyReviewHistory[`day:${record.dayKey}`] = record.firedAt;
}

/**
 * 结算已经过期的天级提醒：复习日已过却没触发（当天应用没开），补记为已完成。
 * 这里刻意不写 dailyReviewHistory 锚点——应用没运行 ≠ 用户看过，
 * 写锚点会把错过的内容在自动回顾排序里往后推，等于假装复习过了。
 * 改为补一条汇总通知（通知中心 + 系统通知），按本地日期去重。
 */
async function settleExpiredReminders() {
  const today = toLocalDateKey(new Date());
  let changed = false;
  const missedDayKeys = [];
  for (const record of dayReminders) {
    if (record.done || !record.date || record.date >= today) {
      continue;
    }
    const due = getDayReminderDueTime(record);
    record.done = true;
    record.firedAt = due ? due.toISOString() : new Date().toISOString();
    missedDayKeys.push(record.dayKey);
    changed = true;
  }
  if (!changed) {
    return false;
  }
  // 同一天已经发过、且渲染层已 ack 的情况下，若又出现新的过期记录，也重新生成待发通知；
  // 否则只在当天第一次结算时生成。旧 pending 未 ack 时合并 dayKeys，避免丢记录。
  if (missedReminderNoticeDate !== today || !pendingMissedReminderNotice) {
    missedReminderNoticeDate = today;
    const mergedKeys = new Set([
      ...(pendingMissedReminderNotice?.dayKeys || []),
      ...missedDayKeys
    ]);
    pendingMissedReminderNotice = {
      date: today,
      dayKeys: [...mergedKeys].sort(),
      systemNoticeSent: pendingMissedReminderNotice?.systemNoticeSent === true
    };
  }
  // 应用运行中跨午夜结算时，渲染层已经订阅，直接推一份；启动阶段消息会丢，
  // 由 boot 的 takePendingReminders 兜底。
  if (pendingMissedReminderNotice) {
    sendReminderFired(buildMissedReminderPayload(pendingMissedReminderNotice));
  }
  updateDailyReviewSelection();
  await saveConfig();
  sendNotesChanged();
  sendDayRemindersChanged();
  return true;
}

function buildMissedReminderPayload(notice) {
  const count = notice.dayKeys.length;
  return {
    // 合成稳定 id：以前回退链会生成 "undefined:日期:dayKey"。
    id: `missed:${notice.date}`,
    dayReminderId: null,
    dayKey: notice.dayKeys[0] || notice.date,
    date: notice.date,
    title: '错过的复习日',
    body: `应用未运行期间有 ${count} 个复习日已过期，可到回顾面板补看。`,
    count,
    missed: true
  };
}

// 只负责系统通知。应用内通知中心改由渲染层 boot 主动 takePendingReminders 拉取：
// 以前 createWindow() 之后立即 webContents.send，页面还没订阅 'reminder:fired'，
// 消息直接丢失且 pending 被清空，当天不会重试（R2）。
// systemNoticeSent 也持久化：应用在 ack 前退出时，下次启动仍能从通知中心看到，
// 但不会重复弹系统通知。
async function flushMissedReminderNotice() {
  const notice = pendingMissedReminderNotice;
  if (!notice || notice.systemNoticeSent || !Notification.isSupported()) {
    return;
  }
  notice.systemNoticeSent = true;
  const payload = buildMissedReminderPayload(notice);
  const notification = new Notification({
    title: `Notice Note：${payload.title}`,
    body: payload.body
  });
  notification.on('click', () => {
    showMainWindow();
    if (notice.dayKeys[0]) {
      sendDayReminderOpen(notice.dayKeys[0]);
    }
  });
  notification.show();
  await saveConfig().catch((error) => {
    console.error('保存待发提醒状态失败:', error);
  });
}

async function fireDueReminders() {
  await settleExpiredReminders();
  await flushMissedReminderNotice();

  const dueItems = getPendingDayReminders();
  for (const record of dueItems) {
    // 通知正文只用非锁定目录的标题；保护目录只贡献一个数量，不泄露任何名字。
    const visible = getReviewDayContent(record.dayKey, { includeProtected: false });
    const all = getReviewDayContent(record.dayKey, { includeProtected: true });
    const visibleCount = visible.dayNotes.length + visible.dayFiles.length;
    const allCount = all.dayNotes.length + all.dayFiles.length;
    const { decision, notice } = buildDayReminderNotice({
      dayReminderId: record.id,
      dayKey: record.dayKey,
      date: record.date,
      label: formatDayKeyShort(record.dayKey),
      titles: [
        ...visible.dayNotes.map((note) => note.title || '未命名笔记'),
        ...visible.dayFiles.map((file) => file.name)
      ],
      visibleCount,
      protectedCount: Math.max(0, allCount - visibleCount)
    });

    if (notice) {
      sendReminderFired(notice);
      if (Notification.isSupported()) {
        const notification = new Notification({
          title: `复习提醒：${notice.title}`,
          body: notice.body
        });
        notification.on('click', () => {
          showMainWindow();
          sendDayReminderOpen(record.dayKey);
        });
        notification.show();
      }
    }

    if (decision.markAsReviewed) {
      // 提醒真的发过了，写「最近看过」锚点，避免隔天又推同一套。
      await markDayReminderFired(record);
    } else {
      // 内容已删空：只结算，绝不写锚点（没提醒过就不算看过）。
      record.done = true;
      record.firedAt = new Date().toISOString();
    }
  }

  const dailyReviewChanged = updateDailyReviewSelection();
  if (dueItems.length > 0 || dailyReviewChanged) {
    await saveConfig();
    sendNotesChanged();
    sendPdfFilesChanged();
    sendDayRemindersChanged();
  }

  scheduleReminderCheck();
}

function getNextReminderDelay() {
  const now = Date.now();
  const futureTimes = dayReminders
    .filter((record) => !record.done)
    .map((record) => getDayReminderDueTime(record))
    .filter((due) => due && due.getTime() > now)
    .map((due) => due.getTime())
    .sort((a, b) => a - b);

  if (futureTimes.length === 0) {
    return REMINDER_CHECK_INTERVAL;
  }

  return Math.max(1000, Math.min(futureTimes[0] - now, REMINDER_CHECK_INTERVAL));
}

function scheduleReminderCheck() {
  clearTimeout(reminderTimer);
  reminderTimer = setTimeout(() => {
    fireDueReminders().catch((error) => {
      dialog.showErrorBox('提醒检查失败', error.message);
    });
  }, getNextReminderDelay());
}

async function migrateImageAssetDir() {
  const oldAssetDir = path.join(getNotesPath(), IMAGE_ASSET_DIR_NAME);
  const newAssetDir = path.join(getAppDataPath(), IMAGE_ASSET_DIR_NAME);
  if (!await pathExists(oldAssetDir)) {
    return;
  }

  await fs.mkdir(newAssetDir, { recursive: true });
  const urlMappings = new Map();

  async function mergeAssetDirectory(sourceDir, relativeDir = '') {
    const entries = await fs.readdir(sourceDir, { withFileTypes: true });
    for (const entry of entries) {
      const sourcePath = path.join(sourceDir, entry.name);
      const relativePath = path.join(relativeDir, entry.name);
      if (entry.isDirectory()) {
        await mergeAssetDirectory(sourcePath, relativePath);
        continue;
      }
      if (!entry.isFile()) {
        continue;
      }

      let targetPath = path.join(newAssetDir, relativePath);
      await fs.mkdir(path.dirname(targetPath), { recursive: true });
      if (await pathExists(targetPath)) {
        const sourceBuffer = await fs.readFile(sourcePath);
        const targetBuffer = await fs.readFile(targetPath);
        if (!sourceBuffer.equals(targetBuffer)) {
          const digest = createHash('sha256').update(sourceBuffer).digest('hex').slice(0, 16);
          const extension = path.extname(entry.name);
          targetPath = path.join(
            path.dirname(targetPath),
            `${path.basename(entry.name, extension)}-migrated-${digest}${extension}`
          );
          if (!await pathExists(targetPath)) {
            await fs.copyFile(sourcePath, targetPath, fsConstants.COPYFILE_EXCL);
          }
        }
      } else {
        await fs.copyFile(sourcePath, targetPath, fsConstants.COPYFILE_EXCL);
      }
      urlMappings.set(pathToFileURL(sourcePath).href, pathToFileURL(targetPath).href);
    }
  }

  await mergeAssetDirectory(oldAssetDir);

  async function updateNoteFiles(dirPath) {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory() && !isInternalDirectory(entry.name)) {
        await updateNoteFiles(fullPath);
      } else if (entry.isFile() && ['.md', '.txt', '.json'].includes(path.extname(entry.name).toLowerCase())) {
        const raw = await fs.readFile(fullPath, 'utf8');
        let updated = raw;
        for (const [oldUrl, newUrl] of urlMappings) {
          updated = updated.split(oldUrl).join(newUrl);
        }
        if (updated !== raw) {
          await backupLegacyMarkdown(fullPath, raw);
          markInternalNoteWrite(fullPath, updated);
          await atomicWriteFile(fullPath, updated, { encoding: 'utf8' });
        }
      }
    }
  }

  await updateNoteFiles(getNotesPath());

  if (await pathExists(oldAssetDir)) {
    await fs.rm(oldAssetDir, { recursive: true, force: true });
  }
}

app.whenReady().then(async () => {

  await loadConfig();
  await saveConfig();
  await migrateImageAssetDir();
  await migrateReviewFolder();
  await loadNotes();
  await prefillReviewDatesFromFilename();
  await migrateDailyReviewHistoryToDays();
  // 旧的单篇提醒按「内容天 + 复习日」归并成天级记录，之后一律以 dayReminders 为准。
  await migrateRemindersToDays();
  // 启动时先结算过期提醒，保证渲染进程第一次拉列表时状态就是对的。
  await settleExpiredReminders();
  // 自动清理无法看见渲染进程中的未落盘草稿，停用后避免误删草稿图片。

  // IPC 传输层：handler 已按域抽取到 src/ipc/，此处组装依赖上下文并注册。
  // ctx 中的状态使用 getter/setter，保证各模块读写的都是 main.js 的同一份变量。
  const ipcContext = {
    ipcMain,
    clipboard,
    shell,
    nativeImage: require('electron').nativeImage,
    fs,
    path,
    fileURLToPath,
    isPathInside,
    IMAGE_ASSET_DIR_NAME,
    isReviewFolderId,
    getNoteMetadataKey,
    get notes() { return notes; },
    get folders() { return folders; },
    get pdfFiles() { return pdfFiles; },
    get resourceFiles() { return resourceFiles; },
    get noteFileMap() { return noteFileMap; },
    // 只有 getter 时 ipc/folders.js 的回滚赋值会被静默忽略，必须补齐 setter。
    set noteFileMap(value) { noteFileMap = value; },
    get noteMetadata() { return noteMetadata; },
    set noteMetadata(value) { noteMetadata = value; },
    get resourceMetadata() { return resourceMetadata; },
    set resourceMetadata(value) { resourceMetadata = value; },
    saveResourceMetadata,
    moveResourceMetadataTree,
    deleteResourceMetadataTree,
    getVisibleNotes,
    getVisibleFolders,
    getVisiblePdfFiles,
    getVisibleResourceFiles,
    createClientNote,
    upsertNote,
    deleteNote,
    createEmptyNote,
    saveNote,
    sortNotesByCreatedAt,
    sendNotesChanged,
    getFolderPath,
    getUniqueFilePath,
    sanitizeNoteFilename,
    getNoteFileExtension,
    moveNoteMetadata,
    moveNoteMetadataTree,
    saveNoteMetadata,
    assertFolderAccessible,
    assertFolderTargetAccessible,
    assertMutableFolder,
    createFolder,
    renameFolder,
    deleteFolder,
    setFolderPassword,
    clearFolderPassword,
    unlockFolder,
    lockFolder,
    saveFolderMetadata,
    sendFoldersChanged,
    sendPdfFilesChanged,
    loadNotes,
    scheduleReminderCheck,
    previewResourceFile,
    deleteResourceFile,
    moveResourceFile,
    getStorageInfo,
    chooseNotesPath,
    resetNotesPath,
    getAppSettings,
    updateAppSettings,
    exportMobilePackage,
    copyLibraryEntryPath,
    showLibraryEntryInFolder,
    openLibraryEntry,
    openExternalUrl,
    handleDailyReview,
    reorderDailyReview,
    reorderSidebar,
    reorderReviewDayFile,
    setReviewDate,
    addDayReminder,
    updateDayReminderDate,
    removeDayReminder,
    autoScheduleDayReminders,
    insertImageForNote,
    saveClipboardImageForNote,
    downloadRemoteImage,
    getImageExtension,
    getAccessibleNote,
    getAppDataPath
  };
  registerNotesIpc(ipcContext);
  registerFoldersIpc(ipcContext);
  registerFilesIpc(ipcContext);
  registerImagesIpc(ipcContext);
  registerStorageIpc(ipcContext);
  registerLibraryIpc(ipcContext);

  Menu.setApplicationMenu(null);
  // 渲染层 boot 完成后主动拉取待发通知，成功后 ack 清空；主进程不再靠
  // 「createWindow 之后立刻 send」这种抢跑方式投递（R2）。handler 必须先于窗口注册。
  ipcMain.handle('reminders:take-pending', () => (
    pendingMissedReminderNotice ? [buildMissedReminderPayload(pendingMissedReminderNotice)] : []
  ));
  ipcMain.handle('reminders:ack-pending', async () => {
    pendingMissedReminderNotice = null;
    // 只有 ack 成功后才把「已投递」落盘；否则下次启动仍能从 config 恢复待发通知。
    await saveConfig();
    return true;
  });
  createWindow();
  createTray();
  mainWindow.webContents.once('did-finish-load', () => {
    flushMissedReminderNotice().catch((error) => {
      console.error('补发错过提醒失败:', error);
    });
  });
  watchPdfFiles();
  scheduleReminderCheck();

  app.on('activate', () => {
    showMainWindow();
  });
}).catch((error) => {
  console.error('应用启动失败:', error);
  dialog.showErrorBox('Notice Note 启动失败', error.message || String(error));
  isQuitting = true;
  app.quit();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' && isQuitting) {
    app.quit();
  }
});

app.on('before-quit', (event) => {
  if (!isQuitting) {
    // 系统关机 / 任务管理器结束也会走这里，先拦下来做一次未保存检查。
    event.preventDefault();
    requestQuit();
    return;
  }
  clearTimeout(reminderTimer);
  clearTimeout(pdfReloadTimer);
  clearTimeout(noteReloadTimer);
  clearTimeout(folderReloadTimer);
  pdfWatcher?.close();
});
