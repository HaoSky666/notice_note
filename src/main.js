const { app, BrowserWindow, ipcMain, Notification, dialog, Menu, Tray, clipboard, shell } = require('electron');
const path = require('node:path');
const { watch } = require('node:fs');
const fs = require('node:fs/promises');
const { randomUUID } = require('node:crypto');
const { pathToFileURL } = require('node:url');
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
const NOTE_BACKUP_DIR_NAME = 'backups';

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
let internalNoteWrites = new Map();

if (process.platform === 'win32') {
  app.setAppUserModelId('com.notice-note.app');
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 900,
    minHeight: 620,
    title: 'Notice Note',
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

  tray = new Tray(path.join(__dirname, 'assets', 'tray.png'));
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

function createAppMenu() {
  const isMac = process.platform === 'darwin';

  const template = [
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    }] : []),
    {
      label: 'File',
      submenu: [
        {
          label: '更改保存位置',
          click: () => chooseNotesPath()
        },
        {
          label: '恢复默认位置',
          click: () => resetNotesPath(),
          enabled: getNotesPath() !== getDefaultNotesPath()
        },
        { type: 'separator' },
        {
          label: `保存位置: ${getNotesPath()}`,
          enabled: false
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac ? [
          { type: 'separator' },
          { role: 'front' }
        ] : [
          { role: 'close' }
        ])
      ]
    }
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
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
  return path.join(getNotesPath(), IMAGE_ASSET_DIR_NAME, noteId);
}

function getAppDataPath() {
  return path.join(getNotesPath(), APP_DATA_DIR_NAME);
}

function getNoteMetadataPath() {
  return path.join(getAppDataPath(), NOTE_METADATA_FILE_NAME);
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
  return name === IMAGE_ASSET_DIR_NAME || name === APP_DATA_DIR_NAME;
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
  const assetDir = getNoteAssetDir(noteId);
  await fs.mkdir(assetDir, { recursive: true });

  const fileName = sanitizeFileName(`${Date.now()}-${randomUUID()}${sourceExt}`);
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

  const assetDir = getNoteAssetDir(noteId);
  await fs.mkdir(assetDir, { recursive: true });

  const ext = getImageExtension(payload.fileName, payload.mimeType);
  const fileName = sanitizeFileName(`${Date.now()}-${randomUUID()}${ext}`);
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
  }
}

async function saveConfig() {
  await fs.mkdir(app.getPath('userData'), { recursive: true });
  await fs.writeFile(getConfigPath(), JSON.stringify({ notesPath: getNotesPath() }, null, 2), 'utf8');
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

  try {
    await scanFolderDirectory(notesDir, null);
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
    const metaPath = path.join(folderPath, '.folder.json');
    let data = {};

    try {
      const meta = await fs.readFile(metaPath, 'utf8');
      data = JSON.parse(meta);
    } catch {
      data = {};
    }

    const folder = {
      id: data.id || getStableFolderId(folderPath),
      name: data.name || entry.name,
      parentId,
      createdAt: data.createdAt || new Date().toISOString()
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
    id: randomUUID(),
    name: folderName,
    parentId: normalizedParentId,
    createdAt: new Date().toISOString()
  };

  const metaPath = path.join(folderPath, '.folder.json');
  await fs.writeFile(metaPath, JSON.stringify(folder, null, 2), 'utf8');

  folders.push(folder);
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
  await saveNoteMetadata();

  folder.name = newFolderName;
  const metaPath = path.join(newPath, '.folder.json');
  await fs.writeFile(metaPath, JSON.stringify(folder, null, 2), 'utf8');

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
  }
  notes = notes.filter((note) => !deletedFolderIds.has(note.folderId));
  folders = folders.filter((item) => !deletedFolderIds.has(item.id));

  if (notes.length === 0) {
    const note = createEmptyNote();
    notes.push(note);
    await saveNote(note);
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

function sendFoldersChanged() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('folders:changed', folders);
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
          updatedAt: stats.mtime.toISOString()
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
    mainWindow.webContents.send('pdfs:changed', pdfFiles);
    mainWindow.webContents.send('files:changed', resourceFiles);
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
  await loadPdfFiles();
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
  await loadPdfFiles();
  sendPdfFilesChanged();
  return resourceFiles;
}

async function copyLibraryEntryPath(_event, entry) {
  const targetPath = resolveLibraryEntryPath(entry);
  if (!targetPath) {
    throw new Error('路径不存在');
  }

  clipboard.writeText(targetPath);
  return targetPath;
}

async function showLibraryEntryInFolder(_event, entry) {
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

function schedulePdfReload() {
  clearTimeout(pdfReloadTimer);
  pdfReloadTimer = setTimeout(() => {
    const pendingNoteLoad = noteLoadPromise || Promise.resolve();
    pendingNoteLoad
      .then(() => loadPdfFiles())
      .then(sendPdfFilesChanged)
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
  return {
    notesPath: getNotesPath(),
    defaultNotesPath: getDefaultNotesPath(),
    isDefault: getNotesPath() === getDefaultNotesPath(),
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
    mainWindow.webContents.send('notes:changed', notes);
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

  if (notes.length === 0) {
    const note = createEmptyNote();
    notes.push(note);
    await saveNote(note);
  }

  sortNotesByCreatedAt();
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
  createAppMenu();
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

  if (dueItems.length > 0) {
    sendNotesChanged();
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

app.whenReady().then(async () => {
  await loadConfig();
  await loadNotes();

  ipcMain.handle('notes:list', () => notes);
  ipcMain.handle('library:refresh', async () => {
    await loadNotes();
    scheduleReminderCheck();
    return { notes, folders, pdfFiles, resourceFiles };
  });
  ipcMain.handle('pdfs:list', () => pdfFiles);
  ipcMain.handle('files:list', () => resourceFiles);
  ipcMain.handle('files:preview', (_event, fileId) => previewResourceFile(fileId));
  ipcMain.handle('files:delete', deleteResourceFile);
  ipcMain.handle('files:move', moveResourceFile);
  ipcMain.handle('pdfs:refresh', async () => {
    await loadPdfFiles();
    return pdfFiles;
  });
  ipcMain.handle('pdfs:read', async (_event, pdfId) => {
    const pdf = pdfFiles.find((item) => item.id === pdfId);
    if (!pdf) {
      throw new Error('PDF 文件不存在');
    }

    const buffer = await fs.readFile(pdf.path);
    return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  });
  ipcMain.handle('notes:save', upsertNote);
  ipcMain.handle('notes:delete', deleteNote);
  ipcMain.handle('notes:create', async (_event, folderId) => {
    const note = createEmptyNote();
    note.folderId = folderId || null;
    notes.unshift(note);
    sortNotesByCreatedAt();
    await saveNote(note);
    sendNotesChanged();
    return note;
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
    return note;
  });
  ipcMain.handle('folders:list', () => folders);
  ipcMain.handle('folders:create', createFolder);
  ipcMain.handle('folders:rename', renameFolder);
  ipcMain.handle('folders:delete', deleteFolder);
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
    await saveNoteMetadata();

    folder.parentId = normalizedTargetFolderId;
    const metaPath = path.join(newPath, '.folder.json');
    await fs.writeFile(metaPath, JSON.stringify(folder, null, 2), 'utf8');

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
  ipcMain.handle('entries:copy-path', copyLibraryEntryPath);
  ipcMain.handle('entries:show-in-folder', showLibraryEntryInFolder);
  ipcMain.handle('entries:open-default', openLibraryEntry);
  ipcMain.handle('images:insert', insertImageForNote);
  ipcMain.handle('images:save-pasted', async (_event, payload) => {
    if (!payload || !payload.noteId) {
      return null;
    }

    return saveClipboardImageForNote(payload.noteId, payload.image);
  });

  createWindow();
  createTray();
  createAppMenu();
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
  pdfWatcher?.close();
});
