const { app, BrowserWindow, ipcMain, Notification, dialog, Menu, Tray, clipboard, shell } = require('electron');
const path = require('node:path');
const { createReadStream, createWriteStream, watch } = require('node:fs');
const fs = require('node:fs/promises');
const { finished } = require('node:stream/promises');
const {
  randomBytes,
  randomUUID,
  scryptSync,
  timingSafeEqual
} = require('node:crypto');
const { pathToFileURL, fileURLToPath } = require('node:url');
const matter = require('gray-matter');
const mammoth = require('mammoth');
const ExcelJS = require('exceljs');

const NOTES_DIR_NAME = 'notes';
const OLD_NOTE_FILE_NAME = 'notes.json';
const CONFIG_FILE_NAME = 'config.json';
const REMINDER_CHECK_INTERVAL = 30 * 1000;
const DAILY_REMINDER_TIMES = ['09:30', '15:00'];
const IMAGE_ASSET_DIR_NAME = 'notice_note_images';
const APP_DATA_DIR_NAME = '.notice-note';
const NOTE_METADATA_FILE_NAME = 'metadata.json';
const REMINDER_FILE_MARKS_NAME = 'reminder-files.json';
const FOLDER_METADATA_FILE_NAME = 'folders.json';
const NOTE_BACKUP_DIR_NAME = 'backups';
const OBSOLETE_MOBILE_IMAGE_CACHE_DIR_NAME = 'mobile-image-cache';
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
let reminderFileMarks = new Set();
let internalNoteWrites = new Map();
let dailyReviewEnabled = true;
let dailyReviewSelection = { date: null, entryKey: null };
let dailyReviewHistory = {};
let dailyReviewHandledDate = null;
let dailyReviewDeferred = { date: null, entryKey: null };
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
      click: () => {
        isQuitting = true;
        app.quit();
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

function getNoteAssetDir(noteId) {
  return path.join(getAppDataPath(), IMAGE_ASSET_DIR_NAME, noteId);
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
  try {
    const raw = await fs.readFile(getFolderMetadataPath(), 'utf8');
    const parsed = JSON.parse(raw);
    folderMetadata = parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    folderMetadata = {};
  }
}

async function saveFolderMetadata() {
  const nextMetadata = {};
  for (const folder of folders) {
    const folderPath = getFolderPath(folder.id);
    nextMetadata[getFolderMetadataKey(folderPath)] = { ...folder };
  }
  folderMetadata = nextMetadata;
  await fs.mkdir(getAppDataPath(), { recursive: true });
  await fs.writeFile(getFolderMetadataPath(), JSON.stringify(folderMetadata, null, 2), 'utf8');
}

async function removeLegacyFolderMetadataFiles(dirPath) {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isFile() && entry.name === '.folder.json') {
      await fs.unlink(path.join(dirPath, entry.name));
      continue;
    }
    if (entry.isDirectory() && !isInternalDirectory(entry.name)) {
      await removeLegacyFolderMetadataFiles(path.join(dirPath, entry.name));
    }
  }
}

async function removeObsoleteMobileImageCache() {
  await fs.rm(path.join(getAppDataPath(), OBSOLETE_MOBILE_IMAGE_CACHE_DIR_NAME), {
    recursive: true,
    force: true
  });
}

function getReminderFileMarksPath() {
  return path.join(getAppDataPath(), REMINDER_FILE_MARKS_NAME);
}

function getNoteMetadataKey(filePath) {
  return path.relative(getNotesPath(), filePath).split(path.sep).join('/');
}

function markInternalNoteWrite(filePath) {
  const key = getNoteMetadataKey(filePath).toLowerCase();
  const expiresAt = Date.now() + 2000;
  internalNoteWrites.set(key, expiresAt);
  setTimeout(() => {
    if (internalNoteWrites.get(key) === expiresAt) {
      internalNoteWrites.delete(key);
    }
  }, 2100);
}

function isInternalDirectory(name) {
  return name === APP_DATA_DIR_NAME;
}

async function loadNoteMetadata() {
  try {
    const raw = await fs.readFile(getNoteMetadataPath(), 'utf8');
    const parsed = JSON.parse(raw);
    noteMetadata = parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    noteMetadata = {};
  }
}

async function saveNoteMetadata() {
  await fs.mkdir(getAppDataPath(), { recursive: true });
  await fs.writeFile(getNoteMetadataPath(), JSON.stringify(noteMetadata, null, 2), 'utf8');
}

async function loadReminderFileMarks() {
  try {
    const raw = await fs.readFile(getReminderFileMarksPath(), 'utf8');
    const parsed = JSON.parse(raw);
    reminderFileMarks = new Set(Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : []);
  } catch {
    reminderFileMarks = new Set();
  }
}

async function saveReminderFileMarks() {
  await fs.mkdir(getAppDataPath(), { recursive: true });
  await fs.writeFile(
    getReminderFileMarksPath(),
    JSON.stringify([...reminderFileMarks].sort(), null, 2),
    'utf8'
  );
}

function getNoteReminderFileKey(noteId) {
  return `note:${noteId}`;
}

function getResourceReminderFileKey(filePath) {
  return `path:${getNoteMetadataKey(filePath)}`;
}

function moveResourceReminderFileMark(oldPath, newPath) {
  const oldKey = getResourceReminderFileKey(oldPath);
  if (!reminderFileMarks.delete(oldKey)) {
    return;
  }
  reminderFileMarks.add(getResourceReminderFileKey(newPath));
}

function moveResourceReminderFileMarkTree(oldPath, newPath) {
  const oldPrefix = `${getResourceReminderFileKey(oldPath).replace(/\/$/, '')}/`;
  const newPrefix = `${getResourceReminderFileKey(newPath).replace(/\/$/, '')}/`;
  for (const key of [...reminderFileMarks]) {
    if (key.startsWith(oldPrefix)) {
      reminderFileMarks.delete(key);
      reminderFileMarks.add(`${newPrefix}${key.slice(oldPrefix.length)}`);
    }
  }
}

function deleteResourceReminderFileMarkTree(folderPath) {
  const prefix = `${getResourceReminderFileKey(folderPath).replace(/\/$/, '')}/`;
  for (const key of [...reminderFileMarks]) {
    if (key.startsWith(prefix)) {
      reminderFileMarks.delete(key);
    }
  }
}

async function removeStaleReminderFileMarks() {
  const validKeys = new Set([
    ...notes.map((note) => getNoteReminderFileKey(note.id)),
    ...resourceFiles.map((file) => getResourceReminderFileKey(file.path))
  ]);
  const nextMarks = new Set([...reminderFileMarks].filter((key) => validKeys.has(key)));
  if (nextMarks.size !== reminderFileMarks.size) {
    reminderFileMarks = nextMarks;
    await saveReminderFileMarks();
  }
}

function setNoteMetadata(filePath, note, fileId = null) {
  const metadataKey = getNoteMetadataKey(filePath);
  noteMetadata[metadataKey] = {
    id: note.id,
    title: note.title,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
    reminders: note.reminders,
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
    markInternalNoteWrite(backupPath);
    await fs.writeFile(backupPath, content, 'utf8');
  }
}

function sanitizeFileName(fileName) {
  return String(fileName || 'image')
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    || 'image';
}

function sanitizeNoteFilename(title) {
  let name = String(title || '未命名笔记')
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\.+$/, '');
  return name || '未命名笔记';
}

function sanitizeFolderName(name) {
  return String(name || '新建文件夹')
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    || '新建文件夹';
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
  if (fromName) {
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

async function copyImageForNote(noteId, sourcePath) {
  const sourceExt = path.extname(sourcePath) || '.png';
  const assetDir = getImageAssetDir();
  await fs.mkdir(assetDir, { recursive: true });

  const fileName = `${Date.now()}${sourceExt}`;
  const targetPath = path.join(assetDir, fileName);
  await fs.copyFile(sourcePath, targetPath);
  const altText = sanitizeFileName(path.basename(sourcePath, sourceExt));

  return {
    absolutePath: targetPath,
    fileUrl: pathToFileURL(targetPath).href,
    markdown: `![${altText}](${pathToFileURL(targetPath).href})`
  };
}

async function saveClipboardImageForNote(noteId, payload) {
  if (!payload || !Array.isArray(payload.bytes) || payload.bytes.length === 0) {
    return null;
  }

  const assetDir = getImageAssetDir();
  await fs.mkdir(assetDir, { recursive: true });

  const ext = getImageExtension(payload.fileName, payload.mimeType);
  const fileName = `${Date.now()}${ext}`;
  const targetPath = path.join(assetDir, fileName);
  await fs.writeFile(targetPath, Buffer.from(payload.bytes));

  const altText = sanitizeFileName(path.basename(payload.fileName || 'image', ext));
  return {
    absolutePath: targetPath,
    fileUrl: pathToFileURL(targetPath).href,
    markdown: `![${altText}](${pathToFileURL(targetPath).href})`
  };
}

async function loadConfig() {
  try {
    const raw = await fs.readFile(getConfigPath(), 'utf8');
    const config = JSON.parse(raw);
    dailyReviewEnabled = config.dailyReviewEnabled !== false;
    dailyReviewSelection = config.dailyReviewSelection
      && typeof config.dailyReviewSelection === 'object'
      ? {
        date: config.dailyReviewSelection.date || null,
        entryKey: config.dailyReviewSelection.entryKey || null
      }
      : { date: null, entryKey: null };
    dailyReviewHistory = config.dailyReviewHistoryVersion === 2
      && config.dailyReviewHistory
      && typeof config.dailyReviewHistory === 'object'
      && !Array.isArray(config.dailyReviewHistory)
      ? config.dailyReviewHistory
      : {};
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
  } catch (error) {
    notesPath = getDefaultNotesPath();
    dailyReviewEnabled = true;
    dailyReviewSelection = { date: null, entryKey: null };
    dailyReviewHistory = {};
    dailyReviewHandledDate = null;
    dailyReviewDeferred = { date: null, entryKey: null };
  }
}

async function saveConfig() {
  await fs.mkdir(app.getPath('userData'), { recursive: true });
  await fs.writeFile(getConfigPath(), JSON.stringify({
    notesPath: getNotesPath(),
    dailyReviewEnabled,
    dailyReviewSelection,
    dailyReviewHistory,
    dailyReviewHistoryVersion: 2,
    dailyReviewHandledDate,
    dailyReviewDeferred
  }, null, 2), 'utf8');
}

function getResourceDailyReviewKey(filePath) {
  return `file:${getNoteMetadataKey(filePath)}`;
}

function getDailyReviewCandidates() {
  const noteCandidates = notes
    .filter((note) => note.isReminderFile && !note.reminders.some((reminder) => !reminder.done))
    .map((note) => ({ key: getNoteReminderFileKey(note.id), target: note }));
  const fileCandidates = resourceFiles
    .filter((file) => file.isReminderFile && file.canOpen)
    .map((file) => ({ key: getResourceDailyReviewKey(file.path), target: file }));
  return [...noteCandidates, ...fileCandidates];
}

function updateDailyReviewSelection() {
  for (const note of notes) {
    note.isDailyReview = false;
    note.dailyReviewLastReviewedAt = dailyReviewHistory[getNoteReminderFileKey(note.id)] || null;
  }
  for (const file of resourceFiles) {
    file.isDailyReview = false;
    file.dailyReviewLastReviewedAt = dailyReviewHistory[getResourceDailyReviewKey(file.path)] || null;
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
    selected.target.isDailyReview = true;
  }
  return changed || stateChanged;
}

function getAppSettings() {
  const selectedNote = notes.find((note) => note.isDailyReview);
  const selectedFile = resourceFiles.find((file) => file.isDailyReview);
  return {
    dailyReviewEnabled,
    dailyReviewTitle: selectedNote?.title || selectedFile?.name || null
  };
}

function isPathInside(parentPath, targetPath) {
  const relativePath = path.relative(parentPath, targetPath);
  return relativePath === '' || (!relativePath.startsWith('..') && !path.isAbsolute(relativePath));
}

function getMimeType(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  const mimeTypes = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.bmp': 'image/bmp',
    '.ico': 'image/x-icon',
    '.gif': 'image/gif',
    '.pdf': 'application/pdf',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.zip': 'application/zip'
  };
  return mimeTypes[extension] || 'application/octet-stream';
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
    isReminderFile: Boolean(note.isReminderFile),
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
  const exportedFolders = folders;
  const exportedNotes = notes;
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

  const syncedResources = resourceFiles
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
    throw new Error(`请先在文件列表中解锁加密目录「${lockedFolder.name}」，再导出手机离线包`);
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

async function setFolderPassword(_event, folderId, password) {
  const folder = getFolderById(folderId);
  if (!folder) {
    throw new Error('文件夹不存在');
  }
  const normalizedPassword = String(password || '').trim();
  if (normalizedPassword.length < 1) {
    throw new Error('密码不能为空');
  }
  const { salt, hash } = hashFolderPassword(normalizedPassword);
  folder.passwordSalt = salt;
  folder.passwordHash = hash;
  unlockedFolderIds.delete(folder.id);
  await saveFolderMetadata();
  sendFoldersChanged();
  sendNotesChanged();
  sendPdfFilesChanged();
  return sanitizeFolderForClient(folder);
}

async function clearFolderPassword(_event, folderId) {
  const folder = getFolderById(folderId);
  if (!folder) {
    throw new Error('文件夹不存在');
  }
  folder.passwordSalt = '';
  folder.passwordHash = '';
  unlockedFolderIds.delete(folder.id);
  await saveFolderMetadata();
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

function createEmptyNote() {
  const now = new Date().toISOString();
  return {
    id: randomUUID(),
    title: '未命名笔记',
    content: '',
    fileType: 'md',
    reminders: [],
    createdAt: now,
    updatedAt: now
  };
}

function normalizeNoteFileType(fileType) {
  return ['txt', 'json'].includes(fileType) ? fileType : 'md';
}

function getNoteFileExtension(fileType) {
  return fileType === 'txt' ? '.txt' : fileType === 'json' ? '.json' : '.md';
}

function isValidDateTime(value) {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function getLatestDateTime(...values) {
  const validValues = values.filter(isValidDateTime);
  if (validValues.length === 0) {
    return null;
  }
  return validValues.reduce((latest, value) => {
    return Date.parse(value) > Date.parse(latest) ? value : latest;
  });
}

function padDatePart(value) {
  return String(value).padStart(2, '0');
}

function toLocalDateKey(date) {
  return [
    date.getFullYear(),
    padDatePart(date.getMonth() + 1),
    padDatePart(date.getDate())
  ].join('-');
}

function getReminderDate(reminder) {
  if (typeof reminder.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(reminder.date)) {
    return reminder.date;
  }

  const date = new Date(reminder.time);
  return Number.isNaN(date.getTime()) ? null : toLocalDateKey(date);
}

function getReminderSlotDate(reminderDate, slot) {
  return new Date(`${reminderDate}T${slot}:00`);
}

function getReminderFiredSlots(reminder) {
  if (Array.isArray(reminder.firedSlots)) {
    return reminder.firedSlots.filter((slot) => DAILY_REMINDER_TIMES.includes(slot));
  }

  return reminder.done ? [...DAILY_REMINDER_TIMES] : [];
}

function sortNotesByCreatedAt() {
  notes.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

function normalizeLoadedNote(input) {
  const now = new Date().toISOString();
  const createdAt = isValidDateTime(input.createdAt)
    ? input.createdAt
    : (isValidDateTime(input.updatedAt) ? input.updatedAt : now);
  const updatedAt = isValidDateTime(input.updatedAt) ? input.updatedAt : createdAt;

  return {
    id: input.id || randomUUID(),
    title: String(input.title || '未命名笔记').trim() || '未命名笔记',
    content: String(input.content || ''),
    fileType: normalizeNoteFileType(input.fileType),
    reminders: Array.isArray(input.reminders)
      ? input.reminders
        .filter((item) => item && (item.date || item.time))
        .map(normalizeReminder)
        .filter((item) => item.date)
      : [],
    folderId: input.folderId || null,
    createdAt,
    updatedAt
  };
}

async function loadFolders() {
  const notesDir = getNotesPath();
  folders = [];
  await loadFolderMetadata();

  try {
    await scanFolderDirectory(notesDir, null);
    await saveFolderMetadata();
    await removeLegacyFolderMetadataFiles(notesDir);
    await removeObsoleteMobileImageCache();
  } catch (error) {
    console.error('读取文件夹失败:', error);
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
    let data = folderMetadata[metadataKey] || {};

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
      name: data.name || entry.name,
      parentId,
      createdAt: data.createdAt || new Date().toISOString(),
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

  const parentPath = getFolderPath(normalizedParentId);
  const folderPath = path.join(parentPath, folderName);

  try {
    await fs.access(folderPath);
    throw new Error('文件夹已存在');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  await fs.mkdir(folderPath, { recursive: true });

  const folder = {
    id: getStableFolderId(folderPath),
    name: folderName,
    parentId: normalizedParentId,
    createdAt: new Date().toISOString(),
    passwordSalt: '',
    passwordHash: ''
  };

  folders.push(folder);
  await saveFolderMetadata();
  sendFoldersChanged();
  return folder;
}

async function renameFolder(_event, folderId, newName) {
  const folder = folders.find(f => f.id === folderId);
  if (!folder) throw new Error('文件夹不存在');

  const oldPath = getFolderPath(folderId);
  const newFolderName = sanitizeFolderName(newName);
  const newPath = path.join(getNotesPath(), ...getFolderPathParts(folder).slice(0, -1), newFolderName);

  await fs.rename(oldPath, newPath);
  moveNoteMetadataTree(oldPath, newPath);
  moveResourceReminderFileMarkTree(oldPath, newPath);
  await saveNoteMetadata();
  await saveReminderFileMarks();

  folder.name = newFolderName;
  await saveFolderMetadata();

  sendFoldersChanged();
  return folder;
}

async function deleteFolder(_event, folderId) {
  const folder = folders.find(f => f.id === folderId);
  if (!folder) throw new Error('文件夹不存在');

  const folderPath = getFolderPath(folderId);
  await fs.rm(folderPath, { recursive: true, force: true });
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
    reminderFileMarks.delete(getNoteReminderFileKey(note.id));
  }
  deleteResourceReminderFileMarkTree(folderPath);
  await saveReminderFileMarks();
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
  const error = new Error(`文件夹「${lockedFolder.name}」已加密，请先输入密码`);
  error.code = 'FOLDER_LOCKED';
  error.folderId = lockedFolder.id;
  error.folderName = lockedFolder.name;
  throw error;
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
  await loadReminderFileMarks();

  // 检查是否有旧的 notes.json 需要迁移（默认路径和自定义路径）
  const oldJsonPaths = [
    getOldNotesJsonPath(),
    // 如果自定义路径是从 .json 转换来的，也检查原路径
    ...(notesPath ? [path.join(path.dirname(notesPath), OLD_NOTE_FILE_NAME)] : [])
  ];
  const uniqueOldPaths = [...new Set(oldJsonPaths)];

  for (const oldJsonPath of uniqueOldPaths) {
    try {
      await fs.access(oldJsonPath);
      await migrateFromJson(oldJsonPath, notesDir);
    } catch {
      // 旧文件不存在，无需迁移
    }
  }

  // 加载文件夹
  await loadFolders();
  await loadPdfFiles();

  try {
    notes = [];
    noteFileMap.clear();
    const storedMetadataByPath = noteMetadata;
    noteMetadata = {};

    // 递归扫描目录
    await scanDirectory(notesDir, null, storedMetadataByPath, new Set());
    await saveNoteMetadata();
    await removeStaleReminderFileMarks();
  } catch (error) {
    if (error.code !== 'ENOENT') {
      dialog.showErrorBox('读取笔记失败', `无法读取笔记目录：${error.message}`);
    } else {
      shouldCreateInitialFile = true;
    }
    notes = [];
    noteFileMap.clear();
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
      try {
        const raw = await fs.readFile(fullPath, 'utf8');
        const stats = await fs.stat(fullPath);
        const parsed = fileExtension === '.md' ? matter(raw) : { data: {}, content: raw };
        const isLegacyNote = fileExtension === '.md' && Boolean(parsed.data.id
          && parsed.data.title
          && parsed.data.createdAt
          && parsed.data.updatedAt
          && Array.isArray(parsed.data.reminders));
        const metadataKey = getNoteMetadataKey(fullPath);
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
        normalizedNote.isReminderFile = reminderFileMarks.has(getNoteReminderFileKey(normalizedNote.id));
        notes.push(normalizedNote);
        noteFileMap.set(normalizedNote.id, fullPath);
        setNoteMetadata(fullPath, normalizedNote, fileId);

        if (isLegacyNote) {
          await backupLegacyMarkdown(fullPath, raw);
          markInternalNoteWrite(fullPath);
          await fs.writeFile(fullPath, parsed.content, 'utf8');
          await fs.utimes(fullPath, stats.atime, stats.mtime);
        }
      } catch (error) {
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
  if (extension === '.docx') {
    return { kind: 'word', typeLabel: 'WORD', canOpen: true };
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
          isReminderFile: reminderFileMarks.has(getResourceReminderFileKey(fullPath))
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
  resourceFiles = [];
  pdfFiles = [];

  try {
    await scanResourceDirectory(getNotesPath(), null);
    resourceFiles.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
    pdfFiles = resourceFiles.filter((file) => file.kind === 'pdf');
    pdfFiles.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error('读取资源文件列表失败:', error);
    }
  }
}

function sendPdfFilesChanged() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('pdfs:changed', getVisiblePdfFiles());
    mainWindow.webContents.send('files:changed', getVisibleResourceFiles());
  }
}

function formatSpreadsheetValue(value) {
  if (value === null || value === undefined) {
    return '';
  }
  if (value instanceof Date) {
    return value.toLocaleString('zh-CN');
  }
  if (typeof value === 'object') {
    if ('result' in value) {
      return formatSpreadsheetValue(value.result);
    }
    if (Array.isArray(value.richText)) {
      return value.richText.map((item) => item.text || '').join('');
    }
    return value.text || value.hyperlink || JSON.stringify(value);
  }
  return String(value);
}

function getSpreadsheetColor(color) {
  const argb = color?.argb;
  if (typeof argb !== 'string' || !/^[0-9a-f]{8}$/i.test(argb)) {
    return null;
  }
  return `#${argb.slice(2)}`;
}

function serializeSpreadsheetBorder(border) {
  if (!border?.style) {
    return null;
  }
  return {
    style: border.style,
    color: getSpreadsheetColor(border.color)
  };
}

function serializeSpreadsheetCell(cell) {
  const patternFillColors = {
    gray125: '#e7e7e7',
    lightGray: '#e2e2e2',
    mediumGray: '#b7b7b7',
    darkGray: '#7f7f7f'
  };
  const fillColor = cell.fill?.type === 'pattern'
    ? cell.fill.pattern === 'solid'
      ? getSpreadsheetColor(cell.fill.fgColor)
      : patternFillColors[cell.fill.pattern] || null
    : null;
  return {
    value: cell.text || formatSpreadsheetValue(cell.value),
    style: {
      fontName: cell.font?.name || null,
      fontSize: Number(cell.font?.size) || null,
      bold: Boolean(cell.font?.bold),
      italic: Boolean(cell.font?.italic),
      underline: Boolean(cell.font?.underline),
      strike: Boolean(cell.font?.strike),
      fontColor: getSpreadsheetColor(cell.font?.color),
      fillColor,
      horizontal: cell.alignment?.horizontal || null,
      vertical: cell.alignment?.vertical || null,
      wrapText: Boolean(cell.alignment?.wrapText),
      borders: {
        top: serializeSpreadsheetBorder(cell.border?.top),
        right: serializeSpreadsheetBorder(cell.border?.right),
        bottom: serializeSpreadsheetBorder(cell.border?.bottom),
        left: serializeSpreadsheetBorder(cell.border?.left)
      }
    }
  };
}

function parseSpreadsheetCellAddress(address) {
  const match = /^\$?([A-Z]+)\$?(\d+)$/i.exec(address);
  if (!match) {
    return null;
  }
  const column = [...match[1].toUpperCase()].reduce((value, letter) => {
    return value * 26 + letter.charCodeAt(0) - 64;
  }, 0);
  return { row: Number(match[2]), column };
}

function getSpreadsheetMergeMap(worksheet, rowCount, columnCount) {
  const mergeMap = new Map();
  for (const range of worksheet.model.merges || []) {
    const [startAddress, endAddress = startAddress] = range.split(':');
    const start = parseSpreadsheetCellAddress(startAddress);
    const end = parseSpreadsheetCellAddress(endAddress);
    if (!start || !end || start.row > rowCount || start.column > columnCount) {
      continue;
    }

    const endRow = Math.min(end.row, rowCount);
    const endColumn = Math.min(end.column, columnCount);
    for (let row = start.row; row <= endRow; row++) {
      for (let column = start.column; column <= endColumn; column++) {
        const key = `${row}:${column}`;
        mergeMap.set(key, row === start.row && column === start.column
          ? { rowSpan: endRow - start.row + 1, columnSpan: endColumn - start.column + 1 }
          : { skip: true });
      }
    }
  }
  return mergeMap;
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
    const result = await mammoth.convertToHtml({ path: file.path }, {
      styleMap: [
        "p[style-name='Title'] => h1.word-document-title:fresh",
        "p[style-name='Subtitle'] => p.word-document-subtitle:fresh",
        "p[style-name='toc 1'] => p.word-toc.word-toc-1:fresh",
        "p[style-name='toc 2'] => p.word-toc.word-toc-2:fresh",
        "p[style-name='toc 3'] => p.word-toc.word-toc-3:fresh"
      ]
    });
    return { kind: 'word', html: result.value || '' };
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

  await fs.unlink(file.path);
  reminderFileMarks.delete(getResourceReminderFileKey(file.path));
  await saveReminderFileMarks();
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

  const normalizedTargetFolderId = targetFolderId || null;
  if (normalizedTargetFolderId && !folders.some((folder) => folder.id === normalizedTargetFolderId)) {
    throw new Error('目标文件夹不存在');
  }
  if ((file.folderId || null) === normalizedTargetFolderId) {
    return resourceFiles;
  }

  const targetDir = getFolderPath(normalizedTargetFolderId);
  await fs.mkdir(targetDir, { recursive: true });
  const extension = path.extname(file.name);
  const baseName = path.basename(file.name, extension);
  const targetPath = await getUniqueFilePath(targetDir, baseName, extension);
  await fs.rename(file.path, targetPath);
  moveResourceReminderFileMark(file.path, targetPath);
  await saveReminderFileMarks();
  await loadPdfFiles();
  if (updateDailyReviewSelection()) {
    await saveConfig();
  }
  sendPdfFilesChanged();
  return resourceFiles;
}

async function setReminderFileMark(_event, entry, marked) {
  if (!entry || !['note', 'file'].includes(entry.type)) {
    throw new Error('只能标记文件');
  }

  let target;
  let key;
  if (entry.type === 'note') {
    target = notes.find((item) => item.id === entry.id);
    key = getNoteReminderFileKey(entry.id);
  } else {
    target = resourceFiles.find((item) => item.id === entry.id);
    key = target ? getResourceReminderFileKey(target.path) : null;
  }

  if (!target || !key) {
    throw new Error('文件不存在');
  }

  if (marked) {
    reminderFileMarks.add(key);
  } else {
    reminderFileMarks.delete(key);
  }
  target.isReminderFile = Boolean(marked);
  await saveReminderFileMarks();
  if (updateDailyReviewSelection()) {
    await saveConfig();
  }
  sendNotesChanged();
  sendPdfFilesChanged();
  return { marked: target.isReminderFile };
}

function resolveDailyReviewTarget(entry) {
  if (entry?.type === 'note') {
    const target = notes.find((item) => item.id === entry.id);
    return target ? { target, key: getNoteReminderFileKey(entry.id) } : null;
  }
  if (entry?.type === 'file') {
    const target = resourceFiles.find((item) => item.id === entry.id);
    return target ? { target, key: getResourceDailyReviewKey(target.path) } : null;
  }
  return null;
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
    throw new Error('当前文件不是今日回顾内容');
  }

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
  return { action, lastReviewedAt, deferredUntil };
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
      if (relativePath.toLowerCase().startsWith(`${APP_DATA_DIR_NAME}/`)) {
        return;
      }
      if (extension === '.pdf') {
        schedulePdfReload();
      } else if (['.md', '.txt', '.json'].includes(extension)
        && path.basename(relativePath) !== '.folder.json') {
        const writeExpiresAt = internalNoteWrites.get(relativePath.toLowerCase()) || 0;
        if (writeExpiresAt > Date.now()) {
          return;
        }
        scheduleNoteReload();
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
  if (!Array.isArray(parsed) || parsed.length === 0) {
    return;
  }

  await fs.mkdir(notesDir, { recursive: true });

  for (const noteData of parsed) {
    if (!noteData) continue;
    const normalizedNote = normalizeLoadedNote(noteData);
    const baseName = sanitizeNoteFilename(normalizedNote.title);
    const filePath = await getUniqueFilePath(notesDir, baseName);
    markInternalNoteWrite(filePath);
    await fs.writeFile(filePath, normalizedNote.content || '', 'utf8');
    setNoteMetadata(filePath, normalizedNote);
  }
  await saveNoteMetadata();

  // 迁移完成后重命名旧文件
  const backupPath = jsonPath + '.bak';
  await fs.rename(jsonPath, backupPath);
}

async function saveNote(note) {
  const targetDir = getFolderPath(note.folderId);
  await fs.mkdir(targetDir, { recursive: true });

  let filePath = noteFileMap.get(note.id);
  if (!filePath) {
    const baseName = sanitizeNoteFilename(note.title);
    filePath = await getUniqueFilePath(targetDir, baseName, getNoteFileExtension(note.fileType));
    noteFileMap.set(note.id, filePath);
  }

  markInternalNoteWrite(filePath);
  await fs.writeFile(filePath, note.content || '', 'utf8');
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
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  showMainWindow();
  mainWindow.flashFrame(true);
  mainWindow.webContents.send('reminder:fired', payload);
}

function normalizeReminder(reminder) {
  const date = getReminderDate(reminder);
  const firedSlots = getReminderFiredSlots(reminder);
  return {
    id: reminder.id || randomUUID(),
    date,
    time: reminder.time || (date ? `${date}T09:30:00.000` : null),
    done: firedSlots.length >= DAILY_REMINDER_TIMES.length,
    firedAt: reminder.firedAt || null,
    firedSlots
  };
}

function normalizeNote(input) {
  const now = new Date().toISOString();
  return {
    id: input.id || randomUUID(),
    title: String(input.title || '未命名笔记').trim() || '未命名笔记',
    content: String(input.content || ''),
    fileType: normalizeNoteFileType(input.fileType),
    reminders: Array.isArray(input.reminders)
      ? input.reminders
        .filter((item) => item && (item.date || item.time))
        .map(normalizeReminder)
        .filter((item) => item.date)
      : [],
    folderId: input.folderId || null,
    createdAt: isValidDateTime(input.createdAt) ? input.createdAt : now,
    updatedAt: now
  };
}

function sendNotesChanged() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('notes:changed', getVisibleNotes());
  }
}

async function upsertNote(_event, input) {
  const note = normalizeNote(input);
  const index = notes.findIndex((item) => item.id === note.id);

  if (index >= 0) {
    const oldNote = notes[index];
    notes[index] = { ...oldNote, ...note };

    // 如果标题改变了或文件夹改变了，需要移动/重命名文件
    if (oldNote.title !== note.title || oldNote.folderId !== note.folderId) {
      const oldPath = noteFileMap.get(note.id);
      if (oldPath) {
        const targetDir = getFolderPath(note.folderId);
        await fs.mkdir(targetDir, { recursive: true });
        const baseName = sanitizeNoteFilename(note.title);
        const extension = getNoteFileExtension(note.fileType);
        const newPath = await getUniqueFilePath(targetDir, baseName, extension);
        try {
          markInternalNoteWrite(oldPath);
          markInternalNoteWrite(newPath);
          await fs.rename(oldPath, newPath);
          noteFileMap.set(note.id, newPath);
          moveNoteMetadata(oldPath, newPath);
        } catch (error) {
          console.error('移动/重命名笔记文件失败:', error);
        }
      }
    }
  } else {
    notes.unshift(note);
  }

  sortNotesByCreatedAt();
  await saveNote(note);
  if (updateDailyReviewSelection()) {
    await saveConfig();
  }
  scheduleReminderCheck();
  sendNotesChanged();
  return note;
}

async function deleteNote(_event, noteId) {
  // 删除文件
  const filePath = noteFileMap.get(noteId);
  if (filePath) {
    try {
      markInternalNoteWrite(filePath);
      await fs.unlink(filePath);
    } catch (error) {
      console.error('删除笔记文件失败:', error);
    }
    delete noteMetadata[getNoteMetadataKey(filePath)];
    noteFileMap.delete(noteId);
    await saveNoteMetadata();
  }

  notes = notes.filter((note) => note.id !== noteId);
  reminderFileMarks.delete(getNoteReminderFileKey(noteId));
  await saveReminderFileMarks();

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
  notesPath = nextPath;
  await saveConfig();
  await loadNotes();
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

  reminder.firedSlots = getReminderFiredSlots(reminder);
  if (!reminder.firedSlots.includes(slot)) {
    reminder.firedSlots.push(slot);
  }
  reminder.done = reminder.firedSlots.length >= DAILY_REMINDER_TIMES.length;
  reminder.firedAt = new Date().toISOString();
  note.updatedAt = reminder.firedAt;
  await saveNote(note);
}

async function fireDueReminders() {
  const dueItems = getPendingReminders();

  for (const { note, reminder, slot } of dueItems) {
    const body = note.content.trim()
      ? note.content.trim().slice(0, 120)
      : '你有一条笔记提醒到了。';
    const payload = {
      noteId: note.id,
      reminderId: reminder.id,
      title: note.title,
      body,
      date: reminder.date,
      slot
    };

    sendReminderFired(payload);

    if (Notification.isSupported()) {
      const notification = new Notification({
        title: `提醒：${note.title}`,
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
  try {
    await fs.access(oldAssetDir);
  } catch {
    return;
  }

  await fs.mkdir(path.dirname(newAssetDir), { recursive: true });

  try {
    await fs.access(newAssetDir);
  } catch {
    await fs.rename(oldAssetDir, newAssetDir);
  }

  const oldUrlPrefix = pathToFileURL(oldAssetDir).href;
  const newUrlPrefix = pathToFileURL(newAssetDir).href;

  async function updateNoteFiles(dirPath) {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory() && !isInternalDirectory(entry.name)) {
        await updateNoteFiles(fullPath);
      } else if (entry.isFile() && ['.md', '.txt'].includes(path.extname(entry.name).toLowerCase())) {
        try {
          const raw = await fs.readFile(fullPath, 'utf8');
          if (raw.includes(oldUrlPrefix)) {
            const updated = raw.split(oldUrlPrefix).join(newUrlPrefix);
            markInternalNoteWrite(fullPath);
            await fs.writeFile(fullPath, updated, 'utf8');
          }
        } catch (error) {
          console.error('迁移笔记图片路径失败:', fullPath, error);
        }
      }
    }
  }

  await updateNoteFiles(getNotesPath());

  try {
    await fs.rm(oldAssetDir, { recursive: true, force: true });
  } catch {
    // ignore cleanup errors
  }
}

async function collectReferencedImagePaths() {
  const assetDirRoot = path.join(getAppDataPath(), IMAGE_ASSET_DIR_NAME);
  const assetDirUrl = pathToFileURL(assetDirRoot).href.toLowerCase();
  const referencedPaths = new Set();

  async function scanNoteFiles(dirPath) {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory() && !isInternalDirectory(entry.name)) {
        await scanNoteFiles(fullPath);
      } else if (entry.isFile() && ['.md', '.txt'].includes(path.extname(entry.name).toLowerCase())) {
        try {
          const raw = await fs.readFile(fullPath, 'utf8');
          const imageRegex = /!\[[^\]]*\]\(([^)]+)\)/g;
          for (const match of raw.matchAll(imageRegex)) {
            const imageUrl = match[1].trim();
            if (imageUrl.toLowerCase().startsWith(assetDirUrl)) {
              try {
                const filePath = fileURLToPath(imageUrl);
                referencedPaths.add(path.resolve(filePath));
              } catch {
                // ignore invalid URLs
              }
            }
          }
        } catch {
          // ignore read errors
        }
      }
    }
  }

  await scanNoteFiles(getNotesPath());
  return referencedPaths;
}

let imageCleanupTimer = null;

async function cleanupUnusedImages() {
  const assetDirRoot = path.join(getAppDataPath(), IMAGE_ASSET_DIR_NAME);
  try {
    await fs.access(assetDirRoot);
  } catch {
    return;
  }

  const referencedPaths = await collectReferencedImagePaths();
  let deletedCount = 0;

  async function scanAndDelete(dirPath) {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    let hasFiles = false;
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        const subHasFiles = await scanAndDelete(fullPath);
        if (subHasFiles) {
          hasFiles = true;
        } else {
          try {
            await fs.rmdir(fullPath);
          } catch {
            // ignore
          }
        }
      } else if (entry.isFile()) {
        if (!referencedPaths.has(path.resolve(fullPath))) {
          try {
            await fs.unlink(fullPath);
            deletedCount += 1;
          } catch {
            // ignore
          }
        } else {
          hasFiles = true;
        }
      }
    }
    return hasFiles;
  }

  await scanAndDelete(assetDirRoot);
  if (deletedCount > 0) {
    console.log(`已清理 ${deletedCount} 张未使用的图片`);
  }
}

function scheduleImageCleanup() {
  if (imageCleanupTimer) {
    clearInterval(imageCleanupTimer);
  }
  cleanupUnusedImages().catch((error) => {
    console.error('图片清理失败:', error);
  });
  imageCleanupTimer = setInterval(() => {
    cleanupUnusedImages().catch((error) => {
      console.error('图片清理失败:', error);
    });
  }, 24 * 60 * 60 * 1000);
}

app.whenReady().then(async () => {
  await loadConfig();
  await saveConfig();
  await migrateImageAssetDir();
  await loadNotes();
  scheduleImageCleanup();

  ipcMain.handle('notes:list', () => getVisibleNotes());
  ipcMain.handle('library:refresh', async () => {
    await loadNotes();
    scheduleReminderCheck();
    return {
      notes: getVisibleNotes(),
      folders: getVisibleFolders(),
      pdfFiles: getVisiblePdfFiles(),
      resourceFiles: getVisibleResourceFiles()
    };
  });
  ipcMain.handle('pdfs:list', () => getVisiblePdfFiles());
  ipcMain.handle('files:list', () => getVisibleResourceFiles());
  ipcMain.handle('files:preview', (_event, fileId) => previewResourceFile(fileId));
  ipcMain.handle('files:delete', deleteResourceFile);
  ipcMain.handle('files:move', moveResourceFile);
  ipcMain.handle('pdfs:refresh', async () => {
    await loadPdfFiles();
    if (updateDailyReviewSelection()) {
      await saveConfig();
    }
    return getVisiblePdfFiles();
  });
  ipcMain.handle('pdfs:read', async (_event, pdfId) => {
    const pdf = pdfFiles.find((item) => item.id === pdfId);
    if (!pdf) {
      throw new Error('PDF 文件不存在');
    }
    assertFolderAccessible(pdf.folderId);

    const buffer = await fs.readFile(pdf.path);
    return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  });
  ipcMain.handle('notes:save', async (event, input) => createClientNote(await upsertNote(event, input)));
  ipcMain.handle('notes:delete', async (event, noteId) => {
    await deleteNote(event, noteId);
    return getVisibleNotes();
  });
  ipcMain.handle('notes:create', async (_event, folderId) => {
    const note = createEmptyNote();
    note.folderId = folderId || null;
    notes.unshift(note);
    sortNotesByCreatedAt();
    await saveNote(note);
    sendNotesChanged();
    return createClientNote(note);
  });
  ipcMain.handle('notes:move', async (_event, noteId, folderId) => {
    const note = notes.find(n => n.id === noteId);
    if (!note) throw new Error('笔记不存在');

    const oldPath = noteFileMap.get(noteId);
    if (oldPath) {
      const targetDir = getFolderPath(folderId);
      await fs.mkdir(targetDir, { recursive: true });
      const baseName = sanitizeNoteFilename(note.title);
      const extension = getNoteFileExtension(note.fileType);
      const newPath = await getUniqueFilePath(targetDir, baseName, extension);
      markInternalNoteWrite(oldPath);
      markInternalNoteWrite(newPath);
      await fs.rename(oldPath, newPath);
      noteFileMap.set(noteId, newPath);
      moveNoteMetadata(oldPath, newPath);
    }

    note.folderId = folderId || null;
    note.updatedAt = new Date().toISOString();
    await saveNote(note);
    sendNotesChanged();
    return createClientNote(note);
  });
  ipcMain.handle('folders:list', () => getVisibleFolders());
  ipcMain.handle('folders:create', createFolder);
  ipcMain.handle('folders:rename', renameFolder);
  ipcMain.handle('folders:delete', deleteFolder);
  ipcMain.handle('folders:set-password', setFolderPassword);
  ipcMain.handle('folders:clear-password', clearFolderPassword);
  ipcMain.handle('folders:unlock', unlockFolder);
  ipcMain.handle('folders:lock', lockFolder);
  ipcMain.handle('folders:move', async (_event, folderId, targetFolderId) => {
    const folder = folders.find(f => f.id === folderId);
    if (!folder) throw new Error('文件夹不存在');

    const normalizedTargetFolderId = targetFolderId || null;
    let target = normalizedTargetFolderId
      ? folders.find((item) => item.id === normalizedTargetFolderId)
      : null;
    while (target) {
      if (target.id === folderId) {
        throw new Error('不能将文件夹移动到自身或其子文件夹');
      }
      target = target.parentId ? folders.find((item) => item.id === target.parentId) : null;
    }
    if ((folder.parentId || null) === normalizedTargetFolderId) {
      return folder;
    }

    const oldPath = getFolderPath(folderId);
    const targetDir = getFolderPath(normalizedTargetFolderId);
    const newPath = path.join(targetDir, folder.name);

    try {
      await fs.access(newPath);
      throw new Error('目标目录已存在同名文件夹');
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }

    await fs.rename(oldPath, newPath);
    moveNoteMetadataTree(oldPath, newPath);
    moveResourceReminderFileMarkTree(oldPath, newPath);
    await saveNoteMetadata();
    await saveReminderFileMarks();

    folder.parentId = normalizedTargetFolderId;
    await saveFolderMetadata();

    await loadNotes();
    scheduleReminderCheck();
    sendNotesChanged();
    sendFoldersChanged();
    sendPdfFilesChanged();
    return folders.find((item) => item.id === folderId) || folder;
  });
  ipcMain.handle('storage:get', () => getStorageInfo());
  ipcMain.handle('storage:choose', chooseNotesPath);
  ipcMain.handle('storage:reset', resetNotesPath);
  ipcMain.handle('settings:get', () => getAppSettings());
  ipcMain.handle('settings:update', updateAppSettings);
  ipcMain.handle('mobile:export-package', exportMobilePackage);
  ipcMain.handle('entries:copy-path', copyLibraryEntryPath);
  ipcMain.handle('entries:show-in-folder', showLibraryEntryInFolder);
  ipcMain.handle('entries:open-default', openLibraryEntry);
  ipcMain.handle('external-url:open', openExternalUrl);
  ipcMain.handle('entries:set-reminder-file', setReminderFileMark);
  ipcMain.handle('daily-review:handle', handleDailyReview);
  ipcMain.handle('images:insert', insertImageForNote);
  ipcMain.handle('images:save-pasted', async (_event, payload) => {
    if (!payload || !payload.noteId) {
      return null;
    }

    return saveClipboardImageForNote(payload.noteId, payload.image);
  });
  ipcMain.handle('images:save-from-url', async (_event, payload) => {
    if (!payload || !payload.noteId || !payload.imageUrl) {
      return null;
    }

    try {
      const { net } = require('electron');
      const response = await net.fetch(payload.imageUrl, {
        redirect: 'follow',
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      if (!response.ok) {
        return null;
      }
      const buffer = Buffer.from(await response.arrayBuffer());
      const contentType = response.headers.get('content-type') || '';
      const ext = contentType.includes('png') ? '.png'
        : contentType.includes('gif') ? '.gif'
        : contentType.includes('webp') ? '.webp'
        : contentType.includes('bmp') ? '.bmp'
        : contentType.includes('svg') ? '.svg'
        : '.jpg';
      const fileName = `pasted-${Date.now()}${ext}`;
      return saveClipboardImageForNote(payload.noteId, {
        fileName,
        mimeType: contentType,
        bytes: Array.from(new Uint8Array(buffer))
      });
    } catch (error) {
      console.error('下载图片失败:', error);
      return null;
    }
  });
  ipcMain.handle('images:copy', async (_event, payload) => {
    if (!payload || !payload.imageUrl) {
      return false;
    }
    try {
      let filePath;
      if (payload.imageUrl.startsWith('file:')) {
        filePath = fileURLToPath(payload.imageUrl);
      } else {
        return false;
      }
      const imageBuffer = await fs.readFile(filePath);
      const nativeImage = require('electron').nativeImage;
      const img = nativeImage.createFromBuffer(imageBuffer);
      clipboard.writeImage(img);
      return true;
    } catch (error) {
      console.error('复制图片失败:', error);
      return false;
    }
  });
  ipcMain.handle('images:delete', async (_event, payload) => {
    if (!payload || !payload.imageUrl) {
      return false;
    }
    try {
      let filePath;
      if (payload.imageUrl.startsWith('file:')) {
        filePath = fileURLToPath(payload.imageUrl);
      } else {
        return false;
      }
      const notesDir = path.resolve(getNotesPath());
      if (!isPathInside(notesDir, filePath)) {
        return false;
      }
      await fs.unlink(filePath);
      return true;
    } catch (error) {
      console.error('删除图片失败:', error);
      return false;
    }
  });

  Menu.setApplicationMenu(null);
  createWindow();
  createTray();
  watchPdfFiles();
  scheduleReminderCheck();

  app.on('activate', () => {
    showMainWindow();
  });
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
clearInterval(imageCleanupTimer);
pdfWatcher?.close();
});
