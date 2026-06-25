const { app, BrowserWindow, ipcMain, Notification, dialog, Menu, Tray } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');
const { randomUUID } = require('node:crypto');
const { pathToFileURL } = require('node:url');
const matter = require('gray-matter');

const NOTES_DIR_NAME = 'notes';
const OLD_NOTE_FILE_NAME = 'notes.json';
const CONFIG_FILE_NAME = 'config.json';
const REMINDER_CHECK_INTERVAL = 30 * 1000;
const DAILY_REMINDER_TIMES = ['09:30', '15:00'];
const IMAGE_ASSET_DIR_NAME = 'notice_note_images';

let mainWindow;
let tray;
let notes = [];
let reminderTimer;
let notesPath;
let isQuitting = false;
let noteFileMap = new Map(); // noteId -> filePath

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
      nodeIntegration: false
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

async function getUniqueFilePath(dir, baseName) {
  let filePath = path.join(dir, `${baseName}.md`);
  try {
    await fs.access(filePath);
  } catch {
    return filePath;
  }

  let counter = 2;
  while (counter < 1000) {
    filePath = path.join(dir, `${baseName}(${counter}).md`);
    try {
      await fs.access(filePath);
    } catch {
      return filePath;
    }
    counter++;
  }
  return path.join(dir, `${baseName}-${Date.now()}.md`);
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
    reminders: [],
    createdAt: now,
    updatedAt: now
  };
}

function isValidDateTime(value) {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
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
    reminders: Array.isArray(input.reminders)
      ? input.reminders
        .filter((item) => item && (item.date || item.time))
        .map(normalizeReminder)
        .filter((item) => item.date)
      : [],
    createdAt,
    updatedAt
  };
}

async function loadNotes() {
  const notesDir = getNotesPath();
  let shouldCreateInitialFile = false;

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

  try {
    const files = await fs.readdir(notesDir);
    const mdFiles = files.filter(f => f.endsWith('.md'));

    notes = [];
    noteFileMap.clear();

    for (const file of mdFiles) {
      const filePath = path.join(notesDir, file);
      try {
        const raw = await fs.readFile(filePath, 'utf8');
        const { data, content } = matter(raw);
        const noteData = { ...data, content };
        const normalizedNote = normalizeLoadedNote(noteData);
        notes.push(normalizedNote);
        noteFileMap.set(normalizedNote.id, filePath);
      } catch (error) {
        console.error(`读取笔记文件失败: ${file}`, error);
      }
    }
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
    const frontmatter = {
      id: normalizedNote.id,
      title: normalizedNote.title,
      createdAt: normalizedNote.createdAt,
      updatedAt: normalizedNote.updatedAt,
      reminders: normalizedNote.reminders
    };
    const fileContent = matter.stringify(normalizedNote.content || '', frontmatter);
    await fs.writeFile(filePath, fileContent, 'utf8');
  }

  // 迁移完成后重命名旧文件
  const backupPath = jsonPath + '.bak';
  await fs.rename(jsonPath, backupPath);
}

async function saveNote(note) {
  const notesDir = getNotesPath();
  await fs.mkdir(notesDir, { recursive: true });

  let filePath = noteFileMap.get(note.id);
  if (!filePath) {
    const baseName = sanitizeNoteFilename(note.title);
    filePath = await getUniqueFilePath(notesDir, baseName);
    noteFileMap.set(note.id, filePath);
  }

  const frontmatter = {
    id: note.id,
    title: note.title,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
    reminders: note.reminders
  };
  const fileContent = matter.stringify(note.content || '', frontmatter);
  await fs.writeFile(filePath, fileContent, 'utf8');
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
    reminders: Array.isArray(input.reminders)
      ? input.reminders
        .filter((item) => item && (item.date || item.time))
        .map(normalizeReminder)
        .filter((item) => item.date)
      : [],
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

    // 如果标题改变了，需要重命名文件
    if (oldNote.title !== note.title) {
      const oldPath = noteFileMap.get(note.id);
      if (oldPath) {
        const baseName = sanitizeNoteFilename(note.title);
        const newPath = await getUniqueFilePath(getNotesPath(), baseName);
        try {
          await fs.rename(oldPath, newPath);
          noteFileMap.set(note.id, newPath);
        } catch (error) {
          console.error('重命名笔记文件失败:', error);
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
      await fs.unlink(filePath);
    } catch (error) {
      console.error('删除笔记文件失败:', error);
    }
    noteFileMap.delete(noteId);
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
  notesPath = nextPath;
  await saveConfig();
  await loadNotes();
  scheduleReminderCheck();
  sendNotesChanged();
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
  ipcMain.handle('notes:save', upsertNote);
  ipcMain.handle('notes:delete', deleteNote);
  ipcMain.handle('notes:create', async () => {
    const note = createEmptyNote();
    notes.unshift(note);
    sortNotesByCreatedAt();
    await saveNote(note);
    sendNotesChanged();
    return note;
  });
  ipcMain.handle('storage:get', () => getStorageInfo());
  ipcMain.handle('storage:choose', chooseNotesPath);
  ipcMain.handle('storage:reset', resetNotesPath);
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
});
