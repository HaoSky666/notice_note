// 笔记与提醒的归一化（纯函数）
const { randomUUID } = require('node:crypto');
const {
  DAILY_REMINDER_TIMES,
  isValidDateTime,
  getReminderDate,
  getReminderFiredSlots
} = require('./date-utils');

function createEmptyNote() {
  const now = new Date().toISOString();
  return {
    id: randomUUID(),
    title: '未命名笔记',
    content: '',
    fileType: 'md',
    reminders: [],
    // 侧边栏用 `note.folderId === activeFolderId` 过滤，undefined !== null 会让
    // 空库自动创建的笔记在首屏不可见，直到重启被 normalizeLoadedNote 归一后才出现。
    folderId: null,
    isReviewFile: false,
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

function normalizeReminderList(reminders) {
  if (!Array.isArray(reminders)) {
    return [];
  }
  return reminders
    .filter((item) => item && (item.date || item.time))
    .map(normalizeReminder)
    .filter((item) => item.date);
}

function normalizeReviewDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

// 同一天的笔记与资源一律平级：不再有主/次文件的概念。
// 旧 metadata 里的 reviewRole 字段读入时直接丢弃，不再回写。
function normalizeNote(input) {
  const now = new Date().toISOString();
  return {
    id: input.id || randomUUID(),
    title: String(input.title || '未命名笔记').trim() || '未命名笔记',
    content: String(input.content || ''),
    fileType: normalizeNoteFileType(input.fileType),
    reminders: normalizeReminderList(input.reminders),
    folderId: input.folderId || null,
    createdAt: isValidDateTime(input.createdAt) ? input.createdAt : now,
    updatedAt: now,
    reviewDate: normalizeReviewDate(input.reviewDate)
  };
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
    reminders: normalizeReminderList(input.reminders),
    folderId: input.folderId || null,
    createdAt,
    updatedAt,
    reviewDate: normalizeReviewDate(input.reviewDate)
  };
}

module.exports = {
  createEmptyNote,
  normalizeNoteFileType,
  getNoteFileExtension,
  normalizeReminder,
  normalizeReminderList,
  normalizeNote,
  normalizeLoadedNote,
  normalizeReviewDate
};
