const { app, BrowserWindow, ipcMain, Notification, dialog, Menu, Tray } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');
const { randomUUID } = require('node:crypto');
const { pathToFileURL } = require('node:url');

const NOTE_FILE_NAME = 'notes.json';
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

function getNotesPath() {
  return notesPath || getDefaultNotesPath();
}

function getDefaultNotesPath() {
  return path.join(app.getPath('userData'), NOTE_FILE_NAME);
}

function getConfigPath() {
  return path.join(app.getPath('userData'), CONFIG_FILE_NAME);
}

function getNoteAssetDir(noteId) {
  return path.join(path.dirname(getNotesPath()), IMAGE_ASSET_DIR_NAME, noteId);
}

function sanitizeFileName(fileName) {
  return String(fileName || 'image')
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    || 'image';
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
    notesPath = typeof config.notesPath === 'string' && config.notesPath
      ? config.notesPath
      : getDefaultNotesPath();
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
  let shouldCreateInitialFile = false;
  let shouldSaveNormalizedNotes = false;

  try {
    const raw = await fs.readFile(getNotesPath(), 'utf8');
    const parsed = JSON.parse(raw);
    notes = Array.isArray(parsed) ? parsed.map((note) => {
      const noteData = note || {};
      const normalizedNote = normalizeLoadedNote(noteData);
      const hasLegacyReminder = Array.isArray(noteData.reminders)
        && noteData.reminders.some((reminder) => reminder && !reminder.date);
      if (!noteData.createdAt || !noteData.updatedAt || hasLegacyReminder) {
        shouldSaveNormalizedNotes = true;
      }
      return normalizedNote;
    }) : [];
  } catch (error) {
    if (error.code !== 'ENOENT') {
      dialog.showErrorBox('读取笔记失败', `无法读取本地笔记数据：${error.message}`);
    } else {
      shouldCreateInitialFile = true;
    }
    notes = [];
  }

  if (notes.length === 0 && shouldCreateInitialFile) {
    notes.push(createEmptyNote());
    await saveNotes();
  }

  if (notes.length === 0) {
    notes.push(createEmptyNote());
  }

  sortNotesByCreatedAt();
  if (shouldSaveNormalizedNotes) {
    await saveNotes();
  }
}

async function saveNotes() {
  await fs.mkdir(path.dirname(getNotesPath()), { recursive: true });
  await fs.writeFile(getNotesPath(), JSON.stringify(notes, null, 2), 'utf8');
}

function getStorageInfo() {
  return {
    notesPath: getNotesPath(),
    defaultNotesPath: getDefaultNotesPath(),
    isDefault: getNotesPath() === getDefaultNotesPath()
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
    notes[index] = { ...notes[index], ...note };
  } else {
    notes.unshift(note);
  }

  sortNotesByCreatedAt();
  await saveNotes();
  scheduleReminderCheck();
  sendNotesChanged();
  return note;
}

async function deleteNote(_event, noteId) {
  notes = notes.filter((note) => note.id !== noteId);

  if (notes.length === 0) {
    notes.push(createEmptyNote());
  }

  sortNotesByCreatedAt();
  await saveNotes();
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
  return {
    notes,
    storage: getStorageInfo()
  };
}

async function chooseNotesPath() {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: '选择笔记保存位置',
    defaultPath: getNotesPath(),
    filters: [
      { name: 'JSON 文件', extensions: ['json'] }
    ],
    properties: ['showOverwriteConfirmation']
  });

  if (result.canceled || !result.filePath) {
    return null;
  }

  try {
    await fs.access(result.filePath);
  } catch (error) {
    await fs.mkdir(path.dirname(result.filePath), { recursive: true });
    await fs.writeFile(result.filePath, JSON.stringify(notes, null, 2), 'utf8');
  }

  return useNotesPath(result.filePath);
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
  await saveNotes();
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
    await saveNotes();
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
