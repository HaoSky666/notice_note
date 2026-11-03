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
  readJsonWithBackup
} = require('./lib/fs-utils');
const {
  DAILY_REMINDER_TIMES,
  getLatestDateTime,
  toLocalDateKey,
  getReminderSlotDate,
  getReminderFiredSlots
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
  sanitizeFolderName
} = require('./lib/sanitize');
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
let folderMetadata = {};
let internalNoteWrites = new Map();
let dailyReviewEnabled = true;
let dailyReviewSelection = { date: null, entryKey: null };
let dailyReviewHistory = {};
let dailyReviewHandledDate = null;
let dailyReviewDeferred = { date: null, entryKey: null };
let reviewDatePrefillDone = false;
const unlockedFolderIds = new Set();

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
      plugins: true
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
      click: async () => {
        try {
          if (mainWindow && !mainWindow.isDestroyed()) {
            await mainWindow.webContents.executeJavaScript('window.noticeNoteFlushForQuit?.()');
          }
          isQuitting = true;
          app.quit();
        } catch (error) {
          showMainWindow();
          dialog.showErrorBox('退出前保存失败', `笔记尚未安全保存，应用未退出：${error.message}`);
        }
      }
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

function getFolderMetadataPath() {
  return path.join(getAppDataPath(), FOLDER_METADATA_FILE_NAME);
}

function getFolderMetadataKey(folderPath) {
  return path.relative(getNotesPath(), folderPath).split(path.sep).join('/');
}

async function loadFolderMetadata() {
  const parsed = await readJsonWithBackup(getFolderMetadataPath(), {});
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('文件夹元数据格式无效');
  }
  folderMetadata = parsed;
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

// 每日回顾历史的键（与文件是否标记无关，仅用于记录回顾时间）
function getNoteReminderFileKey(noteId) {
  return `note:${noteId}`;
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

// 回顾日期：YYYY-MM-DD，缺省时按创建时间归天
function isValidReviewDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

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

function isInternalDirectory(name) {
  return name === APP_DATA_DIR_NAME;
}

async function loadNoteMetadata() {
  const parsed = await readJsonWithBackup(getNoteMetadataPath(), {});
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('笔记元数据格式无效');
  }
  noteMetadata = parsed;
}

async function saveNoteMetadata() {
  await atomicWriteJson(getNoteMetadataPath(), noteMetadata);
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
    reviewRole: note.reviewRole === 'primary' || note.reviewRole === 'secondary'
      ? note.reviewRole
      : null,
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

async function loadConfig() {
  const config = await readJsonWithBackup(getConfigPath(), null);
  if (config !== null && (!config || typeof config !== 'object' || Array.isArray(config))) {
    throw new Error('应用配置格式无效');
  }
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
    reviewDatePrefillDone = config.reviewDatePrefillDone === true;
    dailyReviewHandledDate = config.dailyReviewHandledDate || null;
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
    dailyReviewHandledDate = null;
    dailyReviewDeferred = { date: null, entryKey: null };
    reviewDatePrefillDone = false;
  }
}

async function saveConfig() {
  await atomicWriteJson(getConfigPath(), {
    notesPath: getNotesPath(),
    dailyReviewEnabled,
    dailyReviewSelection,
    dailyReviewHistory,
    dailyReviewHistoryVersion: 3,
    dailyReviewHandledDate,
    dailyReviewDeferred,
    reviewDatePrefillDone
  });
}

function getResourceDailyReviewKey(filePath) {
  return `file:${getNoteMetadataKey(filePath)}`;
}

// 每日回顾候选：以「天」为单位。当天的文件里没有未完成提醒才参与挑选。
function getDailyReviewCandidates() {
  const isProtected = (folderId) => Boolean(getLockedFolderForFolderId(folderId, new Set(), true));
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
    .filter((day) => !day.notes.some((note) => isReminderPending(note)))
    .sort((a, b) => a.dayKey.localeCompare(b.dayKey));
}

function isReminderPending(note) {
  return Array.isArray(note?.reminders) && note.reminders.some((reminder) => !reminder.done);
}

/**
 * 提醒笔记的提醒全部结束时，把「当天」记一次「最近看过」的时间锚点。
 *
 * 提醒与回顾是同一批内容：提醒负责「该看了」，回顾负责「再看一遍」。所以提醒刚处理完的
 * 时刻就是一次接触，必须留下时间戳；否则它在排序里仍是「从未回顾过」，会被当成最高
 * 优先级，第二天又被推成每日回顾。
 *
 * 返回是否写入了新的锚点。
 */
function anchorReviewAfterRemindersFinished(note, hadPendingReminder) {
  if (!note || !hadPendingReminder || isReminderPending(note)) {
    return false;
  }
  const dayKey = getNoteReviewDayKey(note);
  if (!dayKey) {
    return false;
  }
  dailyReviewHistory[`day:${dayKey}`] = new Date().toISOString();
  return true;
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
  let selected = null;

  if (dailyReviewHandledDate !== today) {
    selected = dailyReviewSelection.date === today
      ? candidates.find((candidate) => candidate.key === dailyReviewSelection.entryKey)
      : null;
    if (!selected && deferredDue) {
      selected = candidates.find((candidate) => candidate.key === dailyReviewDeferred.entryKey) || null;
    }
    if (!selected && candidates.length > 0) {
      selected = [...candidates].sort((a, b) => {
        const aLastReview = String(dailyReviewHistory[a.key] || '');
        const bLastReview = String(dailyReviewHistory[b.key] || '');
        return aLastReview.localeCompare(bLastReview) || a.key.localeCompare(b.key);
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

function getAppSettings() {
  const selectedNote = notes.find((note) => note.isDailyReview);
  const selectedFile = resourceFiles.find((file) => file.isDailyReview);
  const dayTitle = selectedNote?.title || selectedFile?.name || null;
  return {
    dailyReviewEnabled,
    dailyReviewTitle: dayTitle,
    dailyReviewDayKey: dailyReviewSelection.entryKey || null
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
    reviewRole: note.reviewRole === 'primary' || note.reviewRole === 'secondary'
      ? note.reviewRole
      : null,
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
    isUnlocked: true,
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

// 一次性迁移：旧回顾文件夹 study_notice 改名为 .study_notice。
// 文件夹 ID 与笔记 ID 按 inode 匹配，改名后下次扫描会自动重新关联。
async function migrateReviewFolder() {
  const notesDir = getNotesPath();
  const legacyPath = path.join(notesDir, LEGACY_REVIEW_FOLDER_NAME);
  const reviewPath = path.join(notesDir, REVIEW_FOLDER_NAME);
  if (!await pathExists(legacyPath) || await pathExists(reviewPath)) {
    return false;
  }
  await fs.rename(legacyPath, reviewPath);
  console.log('已迁移回顾文件夹:', LEGACY_REVIEW_FOLDER_NAME, '->', REVIEW_FOLDER_NAME);
  return true;
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

async function createFolder(_event, name, parentId) {
  const folderName = sanitizeFolderName(name);
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

  const oldPath = getFolderPath(folderId);
  const newFolderName = sanitizeFolderName(newName);
  const newPath = path.join(getNotesPath(), ...getFolderPathParts(folder).slice(0, -1), newFolderName);

  const previousNoteMetadata = structuredClone(noteMetadata);
  const previousNoteFileMap = new Map(noteFileMap);
  await fs.rename(oldPath, newPath);
  try {
    moveNoteMetadataTree(oldPath, newPath);
    folder.name = newFolderName;
    await saveNoteMetadata();
    await saveFolderMetadata();
  } catch (error) {
    await fs.rename(newPath, oldPath).catch((rollbackError) => {
      console.error('回滚文件夹重命名失败:', rollbackError);
    });
    folder.name = path.basename(oldPath);
    noteMetadata = previousNoteMetadata;
    noteFileMap = previousNoteFileMap;
    await Promise.allSettled([
      saveNoteMetadata(),
      saveFolderMetadata()
    ]);
    throw error;
  }

  sendFoldersChanged();
  return folder;
}

async function deleteFolder(_event, folderId) {
  const folder = folders.find(f => f.id === folderId);
  if (!folder) throw new Error('文件夹不存在');
  assertFolderAccessible(folderId);

  const folderPath = getFolderPath(folderId);
  await shell.trashItem(folderPath);
  deleteNoteMetadataTree(folderPath);
  await saveNoteMetadata();

  // 删除该文件夹及所有子文件夹下的笔记
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
  sendNotesChanged();
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
    await saveNoteMetadata();
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
        normalizedNote.reviewRole = storedMetadata.reviewRole === 'primary'
          || storedMetadata.reviewRole === 'secondary'
          ? storedMetadata.reviewRole
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

    if (entry.isFile()
      && !['.md', '.txt', '.json'].includes(extension)
      && entry.name !== '.folder.json') {
      try {
        const stats = await fs.stat(fullPath);
        const type = classifyResourceFile(extension);
        resourceFiles.push({
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
        });
      } catch (error) {
        console.error(`读取资源文件失败: ${entry.name}`, error);
      }
    } else if (entry.isDirectory() && !isInternalDirectory(entry.name)) {
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
  resourceFiles = [];
  pdfFiles = [];

  try {
    await scanResourceDirectory(getNotesPath(), null);
    resourceFiles.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
    pdfFiles = resourceFiles.filter((file) => file.kind === 'pdf');
    pdfFiles.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
  } catch (error) {
    resourceFiles = previousResourceFiles;
    pdfFiles = previousPdfFiles;
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
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(file.path);
    const sheets = workbook.worksheets.slice(0, 20).map((worksheet) => {
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
      }
      return {
        name: worksheet.name,
        columns,
        rows,
        truncated: worksheet.rowCount > rowCount || worksheet.columnCount > columnCount
      };
    });
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

  return null;
}

async function deleteResourceFile(_event, fileId) {
  const file = resourceFiles.find((item) => item.id === fileId);
  if (!file) {
    throw new Error('文件不存在');
  }
  assertFolderAccessible(file.folderId);

  await shell.trashItem(file.path);
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
  await fs.rename(file.path, targetPath);
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
  const today = toLocalDateKey(new Date());
  if (!resolved
    || dailyReviewSelection.date !== today
    || dailyReviewSelection.entryKey !== resolved.key) {
    throw new Error('当前日期不是今日回顾内容');
  }
  assertFolderAccessible(resolved.folderId);

  let lastReviewedAt = dailyReviewHistory[resolved.key] || null;
  let deferredUntil = null;
  if (action === 'complete') {
    lastReviewedAt = new Date().toISOString();
    dailyReviewHistory[resolved.key] = lastReviewedAt;
  } else {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    deferredUntil = toLocalDateKey(tomorrow);
    dailyReviewDeferred = { date: deferredUntil, entryKey: resolved.key };
  }

  dailyReviewHandledDate = today;
  dailyReviewSelection = { date: today, entryKey: null };
  updateDailyReviewSelection();
  await saveConfig();
  sendNotesChanged();
  sendPdfFilesChanged();
  return { action, lastReviewedAt, deferredUntil, dayKey: resolved.dayKey };
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
  target.reviewDate = nextDate;
  if (entry.type === 'note') {
    const stats = await fs.stat(filePath).catch(() => null);
    setNoteMetadata(filePath, target, stats ? String(stats.ino) : null);
    await saveNoteMetadata();
  }
  if (updateDailyReviewSelection()) {
    await saveConfig();
  }
  sendNotesChanged();
  sendPdfFilesChanged();
  return { reviewDate: nextDate };
}

// 设置文件的主次角色；同一天只能有一个主文件（设置新主文件时旧主文件降级）
async function setReviewRole(_event, entry, role) {
  if (!entry || !['note', 'file'].includes(entry.type)) {
    throw new Error('只能设置笔记的主次角色');
  }
  if (role !== null && role !== 'primary' && role !== 'secondary') {
    throw new Error('主次角色无效');
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

  const nextRole = role || null;
  if (target.reviewRole === nextRole) {
    return { reviewRole: nextRole };
  }
  target.reviewRole = nextRole;

  if (nextRole === 'primary' && entry.type === 'note') {
    // 同一天的其它主文件降级为次文件
    const dayKey = getNoteReviewDayKey(target);
    for (const note of notes) {
      if (note.id !== target.id
        && note.reviewRole === 'primary'
        && getNoteReviewDayKey(note) === dayKey) {
        note.reviewRole = 'secondary';
        const otherPath = noteFileMap.get(note.id);
        if (otherPath) {
          setNoteMetadata(otherPath, note, null);
        }
      }
    }
  }

  if (entry.type === 'note') {
    const stats = await fs.stat(filePath).catch(() => null);
    setNoteMetadata(filePath, target, stats ? String(stats.ino) : null);
    await saveNoteMetadata();
  }
  sendNotesChanged();
  sendPdfFilesChanged();
  return { reviewRole: nextRole };
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

function schedulePdfReload() {
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

function scheduleNoteReload() {
  clearTimeout(noteReloadTimer);
  noteReloadTimer = setTimeout(() => {
    loadNotes()
      .then(() => {
        scheduleReminderCheck();
        sendNotesChanged();
        sendFoldersChanged();
        sendPdfFilesChanged();
      })
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
      if (extension === '.pdf') {
        schedulePdfReload();
      } else if (['.md', '.txt', '.json'].includes(extension)
        && path.basename(relativePath) !== '.folder.json') {
        const key = relativePath.toLowerCase();
        if (internalNoteWrites.has(key)) {
          const fullPath = path.join(getNotesPath(), relativePath);
          isExpectedInternalNoteWrite(fullPath, key)
            .then((isInternal) => {
              if (!isInternal) {
                scheduleNoteReload();
              }
            })
            .catch(() => scheduleNoteReload());
          return;
        }
        scheduleNoteReload();
      } else if (!extension && relativePath) {
        scheduleNoteReload();
        schedulePdfReload();
      } else if (path.basename(relativePath) !== '.folder.json') {
        schedulePdfReload();
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
  let hadPendingReminder = false;

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
    hadPendingReminder = isReminderPending(oldNote);
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

  if (index >= 0) {
    notes[index] = targetNote;
  } else {
    notes.unshift(targetNote);
  }
  sortNotesByCreatedAt();
  // 锚点必须在重新挑选今日回顾之前写入，否则本次挑选仍会看到旧的排序依据。
  const anchored = anchorReviewAfterRemindersFinished(targetNote, hadPendingReminder);
  if (anchored || updateDailyReviewSelection()) {
    await saveConfig();
  }
  scheduleReminderCheck();
  // 当前编辑器已直接收到保存结果，文件监听会忽略这次内部写入，避免重复刷新列表。
  return targetNote;
}

async function deleteNote(_event, noteId) {
  const targetNote = notes.find((note) => note.id === noteId);
  if (!targetNote) {
    throw new Error('笔记不存在');
  }
  assertFolderAccessible(targetNote.folderId);

  // 删除文件
  const filePath = noteFileMap.get(noteId);
  if (filePath) {
    await shell.trashItem(filePath);
    delete noteMetadata[getNoteMetadataKey(filePath)];
    noteFileMap.delete(noteId);
    await saveNoteMetadata();
  }

  notes = notes.filter((note) => note.id !== noteId);

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
  const previousState = {
    notesPath,
    notes,
    folders,
    pdfFiles,
    resourceFiles,
    noteFileMap,
    noteMetadata,
    folderMetadata,
    dailyReviewSelection,
    dailyReviewHistory,
    dailyReviewHandledDate,
    dailyReviewDeferred,
    unlockedFolderIds: new Set(unlockedFolderIds)
  };
  notesPath = nextPath;
  unlockedFolderIds.clear();
  try {
    await loadNotes();
    await saveConfig();
  } catch (error) {
    notesPath = previousState.notesPath;
    notes = previousState.notes;
    folders = previousState.folders;
    pdfFiles = previousState.pdfFiles;
    resourceFiles = previousState.resourceFiles;
    noteFileMap = previousState.noteFileMap;
    noteMetadata = previousState.noteMetadata;
    folderMetadata = previousState.folderMetadata;
    dailyReviewSelection = previousState.dailyReviewSelection;
    dailyReviewHistory = previousState.dailyReviewHistory;
    dailyReviewHandledDate = previousState.dailyReviewHandledDate;
    dailyReviewDeferred = previousState.dailyReviewDeferred;
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

function getPendingReminders() {
  const now = new Date();
  const todayKey = toLocalDateKey(now);
  return notes.flatMap((note) => note.reminders
    .flatMap((reminder) => {
      if (!reminder.date || reminder.date !== todayKey) {
        return [];
      }

      const firedSlots = new Set(getReminderFiredSlots(reminder));
      return DAILY_REMINDER_TIMES
        .filter((slot) => !firedSlots.has(slot) && getReminderSlotDate(reminder.date, slot) <= now)
        .map((slot) => ({ note, reminder, slot }));
    }));
}

async function markReminderSlotFired(noteId, reminderId, slot) {
  const note = notes.find((item) => item.id === noteId);
  if (!note) {
    return;
  }

  const reminder = note.reminders.find((item) => item.id === reminderId);
  if (!reminder) {
    return;
  }

  const hadPendingReminder = isReminderPending(note);

  reminder.firedSlots = getReminderFiredSlots(reminder);
  if (!reminder.firedSlots.includes(slot)) {
    reminder.firedSlots.push(slot);
  }
  reminder.done = reminder.firedSlots.length >= DAILY_REMINDER_TIMES.length;
  reminder.firedAt = new Date().toISOString();
  note.updatedAt = reminder.firedAt;
  await saveNote(note);

  if (anchorReviewAfterRemindersFinished(note, hadPendingReminder)) {
    await saveConfig();
  }
}

function getReminderAnchorIso(reminder) {
  const parsed = new Date(reminder.time || `${reminder.date}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

/**
 * 结算已经过期的提醒。
 *
 * 提醒只会在「提醒日期 == 今天」时被处理，所以如果提醒当天应用没有运行，那一次的时段就
 * 永远不会触发，reminder.done 会一直停在 false：提醒列表里永远显示「待提醒」，而且这篇
 * 提醒笔记再也没法进入回顾池。
 *
 * 这里把过期提醒一次性结算为已完成，并以它自己的提醒时间作为「最近看过」锚点——用提醒
 * 当天而非「现在」，这样错过的那条内容不会被无意义地往后推。
 */
async function settleExpiredReminders() {
  const today = toLocalDateKey(new Date());
  const settleTargets = [];

  for (const note of notes) {
    const expired = note.reminders.filter((reminder) => {
      return !reminder.done && reminder.date && reminder.date < today;
    });
    if (expired.length === 0) {
      continue;
    }

    let anchor = null;
    for (const reminder of expired) {
      reminder.firedSlots = [...DAILY_REMINDER_TIMES];
      reminder.done = true;
      reminder.firedAt = reminder.firedAt || new Date().toISOString();
      const reminderAnchor = getReminderAnchorIso(reminder);
      if (!anchor || reminderAnchor > anchor) {
        anchor = reminderAnchor;
      }
    }
    settleTargets.push({ note, anchor });
  }

  if (settleTargets.length === 0) {
    return false;
  }

  for (const { note, anchor } of settleTargets) {
    if (!isReminderPending(note) && anchor) {
      const key = getNoteReminderFileKey(note.id);
      if (anchor > String(dailyReviewHistory[key] || '')) {
        dailyReviewHistory[key] = anchor;
      }
    }
    note.updatedAt = new Date().toISOString();
    await saveNote(note);
  }

  updateDailyReviewSelection();
  await saveConfig();
  sendNotesChanged();
  return true;
}

async function fireDueReminders() {
  await settleExpiredReminders();

  const dueItems = getPendingReminders();

  for (const { note, reminder, slot } of dueItems) {
    const isProtected = Boolean(getLockedFolderForFolderId(note.folderId, new Set(), true));
    const body = isProtected
      ? '一条受密码保护的笔记提醒到了，请打开应用并解锁后查看。'
      : note.content.trim()
        ? note.content.trim().slice(0, 120)
        : '你有一条笔记提醒到了。';
    const title = isProtected ? '受保护笔记提醒' : note.title;
    const payload = {
      noteId: note.id,
      reminderId: reminder.id,
      title,
      body,
      date: reminder.date,
      slot,
      protected: isProtected
    };

    sendReminderFired(payload);

    if (Notification.isSupported()) {
      const notification = new Notification({
        title: `提醒：${title}`,
        body
      });
      notification.on('click', () => {
        showMainWindow();
      });
      notification.show();
    }

    await markReminderSlotFired(note.id, reminder.id, slot);
  }

  const dailyReviewChanged = updateDailyReviewSelection();
  if (dailyReviewChanged) {
    await saveConfig();
  }
  if (dueItems.length > 0 || dailyReviewChanged) {
    sendNotesChanged();
    sendPdfFilesChanged();
  }

  scheduleReminderCheck();
}

function getNextReminderDelay() {
  const now = Date.now();
  const futureTimes = notes.flatMap((note) => note.reminders.flatMap((reminder) => {
    if (!reminder.date) {
      return [];
    }

    const firedSlots = new Set(getReminderFiredSlots(reminder));
    return DAILY_REMINDER_TIMES
      .filter((slot) => !firedSlots.has(slot))
      .map((slot) => getReminderSlotDate(reminder.date, slot).getTime());
  }))
    .filter((time) => Number.isFinite(time))
    .filter((time) => time > now)
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
    get notes() { return notes; },
    get folders() { return folders; },
    get pdfFiles() { return pdfFiles; },
    get resourceFiles() { return resourceFiles; },
    get noteFileMap() { return noteFileMap; },
    get noteMetadata() { return noteMetadata; },
    set noteMetadata(value) { noteMetadata = value; },
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
    setReviewDate,
    setReviewRole,
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
  createWindow();
  createTray();
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

app.on('before-quit', () => {
isQuitting = true;
clearTimeout(reminderTimer);
clearTimeout(pdfReloadTimer);
clearTimeout(noteReloadTimer);
pdfWatcher?.close();
});
