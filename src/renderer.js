const noteList = document.querySelector('#noteList');
const titleInput = document.querySelector('#titleInput');
const reminderInput = document.querySelector('#reminderInput');
const reminderList = document.querySelector('#reminderList');
const editorRoot = document.querySelector('#editorRoot');
const insertImageButton = document.querySelector('#insertImageButton');
const saveButton = document.querySelector('#saveButton');
const newNoteButton = document.querySelector('#newNoteButton');
const addReminderButton = document.querySelector('#addReminderButton');
const deleteNoteButton = document.querySelector('#deleteNoteButton');
const toastRoot = document.querySelector('#toastRoot');
const autoReminderCheckbox = document.querySelector('#autoReminderCheckbox');
const reminderDialog = document.querySelector('#reminderDialog');
const openReminderConfigButton = document.querySelector('#openReminderConfigButton');
const closeReminderDialogButton = document.querySelector('#closeReminderDialogButton');
const sidebar = document.querySelector('#sidebar');
const toggleSidebarButton = document.querySelector('#toggleSidebarButton');
const showSidebarButton = document.querySelector('#showSidebarButton');
const editorPanel = document.querySelector('.editor-panel');
const toggleReminderButton = document.querySelector('#toggleReminderButton');
const showReminderButton = document.querySelector('#showReminderButton');
const noteSortSelect = document.querySelector('#noteSortSelect');
const noteSortOrderSelect = document.querySelector('#noteSortOrderSelect');
const refreshButton = document.querySelector('#refreshButton');

let notes = [];
let activeNoteId = null;
let saveTimer;
let storageInfo = null;
let markdownEditor = null;
let isRenderingEditor = false;
const SIDEBAR_COLLAPSED_KEY = 'notice-note:sidebar-collapsed';
const REMINDER_COLLAPSED_KEY = 'notice-note:reminder-collapsed';
const NOTE_SORT_KEY = 'notice-note:note-sort';
const NOTE_SORT_ORDER_KEY = 'notice-note:note-sort-order';
const DAILY_REMINDER_SLOTS = ['09:30', '15:00'];

function readBooleanSetting(key) {
  return localStorage.getItem(key) === 'true';
}

function writeBooleanSetting(key, value) {
  localStorage.setItem(key, value ? 'true' : 'false');
}

function setSidebarCollapsed(isCollapsed) {
  sidebar.classList.toggle('is-collapsed', isCollapsed);
  const toggleText = isCollapsed ? '显示笔记列表' : '隐藏笔记列表';
  toggleSidebarButton.title = toggleText;
  toggleSidebarButton.setAttribute('aria-label', toggleText);
  showSidebarButton.title = '显示笔记列表';
  showSidebarButton.setAttribute('aria-label', '显示笔记列表');
  writeBooleanSetting(SIDEBAR_COLLAPSED_KEY, isCollapsed);
}

function setReminderCollapsed(isCollapsed) {
  editorPanel.classList.toggle('reminder-collapsed', isCollapsed);
  const toggleText = isCollapsed ? '显示提醒日期' : '隐藏提醒日期';
  toggleReminderButton.title = toggleText;
  toggleReminderButton.setAttribute('aria-label', toggleText);
  showReminderButton.title = '显示提醒日期';
  showReminderButton.setAttribute('aria-label', '显示提醒日期');
  writeBooleanSetting(REMINDER_COLLAPSED_KEY, isCollapsed);
}

function formatListDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '未知';
  }

  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

function formatDateOnly(value) {
  const date = parseReminderDate(value);
  if (!date) {
    return '日期无效';
  }

  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
}

function toLocalDateKey(date) {
  const pad = (value) => String(value).padStart(2, '0');
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate())
  ].join('-');
}

function parseReminderDate(value) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T00:00:00`);
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getReminderDateKey(reminder) {
  if (typeof reminder.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(reminder.date)) {
    return reminder.date;
  }

  const date = parseReminderDate(reminder.time);
  return date ? toLocalDateKey(date) : null;
}

function getTimeValue(value) {
  return Date.parse(value) || 0;
}

function getReminderSortTime(note, order) {
  const pendingTimes = (note.reminders || [])
    .filter((reminder) => !reminder.done)
    .map((reminder) => {
      const dateKey = getReminderDateKey(reminder);
      return dateKey ? Date.parse(`${dateKey}T00:00:00`) : NaN;
    })
    .filter((time) => Number.isFinite(time));

  if (pendingTimes.length === 0) {
    return null;
  }

  return order === 'asc' ? Math.min(...pendingTimes) : Math.max(...pendingTimes);
}

function getNoteSortMode() {
  const mode = noteSortSelect.value || 'created';
  return ['created', 'updated', 'reminder'].includes(mode) ? mode : 'created';
}

function getNoteSortOrder() {
  return noteSortOrderSelect.value === 'asc' ? 'asc' : 'desc';
}

function sortNotes(noteItems) {
  const mode = getNoteSortMode();
  const order = getNoteSortOrder();
  const direction = order === 'asc' ? 1 : -1;

  return [...noteItems].sort((a, b) => {
    if (mode === 'updated') {
      return direction * (getTimeValue(a.updatedAt) - getTimeValue(b.updatedAt));
    }

    if (mode === 'reminder') {
      const timeA = getReminderSortTime(a, order);
      const timeB = getReminderSortTime(b, order);

      if (timeA === null && timeB === null) {
        return direction * (getTimeValue(a.updatedAt) - getTimeValue(b.updatedAt));
      }

      if (timeA === null) {
        return 1;
      }

      if (timeB === null) {
        return -1;
      }

      return direction * (timeA - timeB)
        || direction * (getTimeValue(a.updatedAt) - getTimeValue(b.updatedAt));
    }

    return direction * (getTimeValue(a.createdAt) - getTimeValue(b.createdAt));
  });
}

function hasTodayPendingReminder(note) {
  const todayKey = toLocalDateKey(new Date());
  return (note.reminders || []).some((reminder) => {
    return getReminderDateKey(reminder) === todayKey;
  });
}

function skipWeekend(date) {
  const day = date.getDay();
  if (day === 0) {
    date.setDate(date.getDate() + 1);
  } else if (day === 6) {
    date.setDate(date.getDate() + 2);
  }
  return date;
}

function createReminderDate(daysToAdd) {
  const date = new Date();
  date.setDate(date.getDate() + daysToAdd);
  skipWeekend(date);
  return toLocalDateKey(date);
}

function createNextMonthReminderDate() {
  const today = new Date();
  const targetYear = today.getFullYear() + Math.floor((today.getMonth() + 1) / 12);
  const targetMonth = (today.getMonth() + 1) % 12;
  const lastDayOfTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
  const date = new Date(
    targetYear,
    targetMonth,
    Math.min(today.getDate(), lastDayOfTargetMonth)
  );
  skipWeekend(date);
  return toLocalDateKey(date);
}

function createReminder(date) {
  return {
    id: crypto.randomUUID(),
    date,
    time: `${date}T09:30:00.000`,
    done: false,
    firedAt: null,
    firedSlots: []
  };
}

function getActiveNote() {
  return notes.find((note) => note.id === activeNoteId) || notes[0];
}

function getDraftNote() {
  const activeNote = getActiveNote();
  return {
    ...activeNote,
    title: titleInput.value,
    content: normalizeMarkdownContent(getEditorValue())
  };
}

function getEditorValue() {
  return markdownEditor ? markdownEditor.getMarkdown() : '';
}

function normalizeMarkdownContent(content) {
  return String(content || '').replace(/^(\s*)\*(\s+)/gm, '$1-$2');
}

function setEditorValue(value) {
  const nextValue = normalizeMarkdownContent(value);
  if (markdownEditor) {
    if (markdownEditor.getMarkdown() === nextValue) {
      return;
    }

    markdownEditor.setMarkdown(nextValue, false);
  }
}

async function insertImage() {
  const note = getActiveNote();
  if (!note) {
    return;
  }

  const result = await window.noticeNote.insertImage({ noteId: note.id });
  if (!result?.markdown) {
    return;
  }

  if (markdownEditor && typeof markdownEditor.insertMarkdown === 'function') {
    markdownEditor.insertMarkdown(`${result.markdown}\n`);
    markdownEditor.focus?.();
  } else {
    const currentValue = getEditorValue();
    setEditorValue(`${currentValue}${currentValue.endsWith('\n') || !currentValue ? '' : '\n'}${result.markdown}\n`);
  }

  queueSave();
}

async function handlePastedImage(file) {
  const note = getActiveNote();
  if (!note || !file) {
    return null;
  }

  const buffer = await file.arrayBuffer();
  const result = await window.noticeNote.savePastedImage({
    noteId: note.id,
    image: {
      fileName: file.name,
      mimeType: file.type,
      bytes: Array.from(new Uint8Array(buffer))
    }
  });

  if (!result?.markdown) {
    return null;
  }

  return `${result.markdown}\n`;
}

function showReminderToast(reminder) {
  const toast = document.createElement('section');
  toast.className = 'reminder-toast';

  const heading = document.createElement('div');
  heading.className = 'toast-heading';
  heading.textContent = `提醒：${reminder.title || '未命名笔记'}`;

  const body = document.createElement('div');
  body.className = 'toast-body';
  body.textContent = reminder.body || '你有一条笔记提醒到了。';

  const meta = document.createElement('div');
  meta.className = 'toast-meta';
  meta.textContent = `${formatDateOnly(reminder.date)} ${reminder.slot || ''}`.trim();

  const closeButton = document.createElement('button');
  closeButton.className = 'toast-close';
  closeButton.type = 'button';
  closeButton.textContent = '知道了';
  closeButton.addEventListener('click', () => toast.remove());

  toast.append(heading, body, meta, closeButton);
  toastRoot.append(toast);

  setTimeout(() => {
    toast.remove();
  }, 30000);
}

function renderStorageInfo() {
  if (!storageInfo) {
    return;
  }
}

function renderNoteList() {
  noteList.innerHTML = '';

  for (const note of sortNotes(notes)) {
    const item = document.createElement('button');
    item.className = `note-item${note.id === activeNoteId ? ' active' : ''}`;
    item.type = 'button';
    item.addEventListener('click', () => selectNote(note.id));

    const titleRow = document.createElement('div');
    titleRow.className = 'note-title-row';

    const title = document.createElement('strong');
    title.textContent = note.title || '未命名笔记';
    titleRow.append(title);

    if (hasTodayPendingReminder(note)) {
      const todayBadge = document.createElement('span');
      todayBadge.className = 'today-reminder-badge';
      todayBadge.textContent = '今日';
      todayBadge.title = '今天有待提醒';
      titleRow.append(todayBadge);
    }

    const timeMeta = document.createElement('span');
    timeMeta.className = 'note-time-meta';
    timeMeta.textContent = `创建：${formatListDateTime(note.createdAt)} · 修改：${formatListDateTime(note.updatedAt)}`;

    const reminderMeta = document.createElement('span');
    reminderMeta.className = 'note-reminder-meta';
    const pendingCount = (note.reminders || []).filter((reminder) => !reminder.done).length;
    reminderMeta.textContent = pendingCount > 0 ? `${pendingCount} 个待提醒` : '无待提醒';

    item.append(titleRow, timeMeta, reminderMeta);
    noteList.append(item);
  }
}

function renderReminders() {
  const note = getActiveNote();
  reminderList.innerHTML = '';

  if (!note.reminders.length) {
    const empty = document.createElement('p');
    empty.className = 'empty-text';
    empty.textContent = '还没有提醒日期。';
    reminderList.append(empty);
    return;
  }

  const sortedReminders = [...note.reminders].sort((a, b) => {
    const dateA = getReminderDateKey(a);
    const dateB = getReminderDateKey(b);
    return (dateA ? Date.parse(`${dateA}T00:00:00`) : 0)
      - (dateB ? Date.parse(`${dateB}T00:00:00`) : 0);
  });

  for (const reminder of sortedReminders) {
    const row = document.createElement('div');
    row.className = `reminder-row${reminder.done ? ' done' : ''}`;

    const text = document.createElement('span');
    const firedCount = Array.isArray(reminder.firedSlots) ? reminder.firedSlots.length : 0;
    const firedText = firedCount > 0
      ? ` · 已通知 ${Math.min(firedCount, DAILY_REMINDER_SLOTS.length)}/${DAILY_REMINDER_SLOTS.length}`
      : '';
    text.textContent = `${formatDateOnly(getReminderDateKey(reminder))}${firedText}`;

    const removeButton = document.createElement('button');
    removeButton.className = 'text-button';
    removeButton.type = 'button';
    removeButton.textContent = '移除';
    removeButton.addEventListener('click', () => removeReminder(reminder.id));

    row.append(text, removeButton);
    reminderList.append(row);
  }
}

function renderEditor() {
  const activeNote = getActiveNote();
  if (!activeNote) {
    return;
  }

  isRenderingEditor = true;
  activeNoteId = activeNote.id;
  titleInput.value = activeNote.title || '';
  setEditorValue(activeNote.content || '');
  isRenderingEditor = false;
  renderNoteList();
  renderReminders();
}

function isEditingActiveNote() {
  return document.activeElement === titleInput
    || Boolean(markdownEditor?.hasFocus());
}

function mergeIncomingNotes(nextNotes) {
  const activeNote = getActiveNote();
  const shouldKeepDraft = activeNote
    && isEditingActiveNote()
    && nextNotes.some((note) => note.id === activeNote.id);

  if (!shouldKeepDraft) {
    notes = sortNotes(nextNotes);
    activeNoteId = notes[0]?.id || null;
    renderEditor();
    return;
  }

  const draft = getDraftNote();
  notes = sortNotes(nextNotes.map((note) => {
    if (note.id !== activeNote.id) {
      return note;
    }

    return {
      ...note,
      title: draft.title,
      content: draft.content
    };
  }));

  renderNoteList();
  renderReminders();
}

function createMarkdownEditor() {
  if (typeof window.createNoticeNoteEditor !== 'function') {
    throw new TypeError('找不到可用的 Markdown 编辑器构造函数');
  }

  markdownEditor = window.createNoticeNoteEditor({
    parent: editorRoot,
    initialValue: '',
    placeholder: '点击这里记录 Markdown 笔记。',
    resolveImageSrc: (src) => src,
    onPasteImage: handlePastedImage,
    onError: (error) => {
      console.error('图片处理失败:', error);
    },
    onChange: (value) => {
      if (isRenderingEditor) {
        return;
      }

      const note = getActiveNote();
      if (note) {
        note.content = normalizeMarkdownContent(value);
      }
      queueSave();
    }
  });
}

function selectNote(noteId) {
  activeNoteId = noteId;
  renderEditor();
}

function replaceNote(updatedNote) {
  const index = notes.findIndex((note) => note.id === updatedNote.id);
  if (index >= 0) {
    notes[index] = updatedNote;
  } else {
    notes.unshift(updatedNote);
  }
  notes = sortNotes(notes);
}

async function saveActiveNote() {
  const draft = getDraftNote();
  const savedNote = await window.noticeNote.saveNote(draft);
  replaceNote(savedNote);
  activeNoteId = savedNote.id;
  renderNoteList();
  renderReminders();
}

function queueSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveActiveNote().catch(console.error);
  }, 600);
}

async function addReminder() {
  const note = getActiveNote();
  if (!note || !reminderInput.value) {
    return;
  }

  const date = reminderInput.value;
  if (!parseReminderDate(date)) {
    return;
  }

  if (note.reminders.some((reminder) => getReminderDateKey(reminder) === date)) {
    return;
  }

  note.reminders.push(createReminder(date));

  reminderInput.value = '';
  await saveActiveNote();
  renderReminders();
}

async function addAutoReminders() {
  const note = getActiveNote();
  if (!note) {
    return;
  }

  const reminderDates = [
    createReminderDate(1),
    createReminderDate(7),
    createNextMonthReminderDate()
  ];
  const existingDates = new Set(note.reminders.map(getReminderDateKey));
  const nextReminders = reminderDates
    .map(createReminder)
    .filter((reminder) => !existingDates.has(reminder.date));

  if (nextReminders.length === 0) {
    return;
  }

  note.reminders.push(...nextReminders);
  await saveActiveNote();
  renderReminders();
}

async function removeReminder(reminderId) {
  const note = getActiveNote();
  note.reminders = note.reminders.filter((reminder) => reminder.id !== reminderId);
  await saveActiveNote();
  renderReminders();
}

async function createNote() {
  const note = await window.noticeNote.createNote();
  if (!notes.some((item) => item.id === note.id)) {
    notes.unshift(note);
  }
  notes = sortNotes(notes);
  activeNoteId = note.id;
  renderEditor();
}

async function refreshNotes() {
  notes = sortNotes(await window.noticeNote.listNotes());
  if (!notes.some((note) => note.id === activeNoteId)) {
    activeNoteId = notes[0]?.id || null;
  }
  renderEditor();
}

async function deleteActiveNote() {
  const note = getActiveNote();
  if (!note) {
    return;
  }

  const confirmed = confirm(`确定删除「${note.title || '未命名笔记'}」吗？`);
  if (!confirmed) {
    return;
  }

  notes = sortNotes(await window.noticeNote.deleteNote(note.id));
  activeNoteId = notes[0]?.id || null;
  renderEditor();
}

async function boot() {
  setSidebarCollapsed(readBooleanSetting(SIDEBAR_COLLAPSED_KEY));
  setReminderCollapsed(readBooleanSetting(REMINDER_COLLAPSED_KEY));
  noteSortSelect.value = localStorage.getItem(NOTE_SORT_KEY) || 'created';
  noteSortSelect.value = getNoteSortMode();
  noteSortOrderSelect.value = localStorage.getItem(NOTE_SORT_ORDER_KEY) || 'desc';
  noteSortOrderSelect.value = getNoteSortOrder();
  createMarkdownEditor();
  notes = sortNotes(await window.noticeNote.listNotes());
  storageInfo = await window.noticeNote.getStorage();
  activeNoteId = notes[0]?.id || null;
  reminderInput.value = toLocalDateKey(new Date());
  renderStorageInfo();
  renderEditor();

  window.noticeNote.onNotesChanged((nextNotes) => {
    mergeIncomingNotes(nextNotes);
  });

  window.noticeNote.onStorageChanged((nextStorageInfo) => {
    storageInfo = nextStorageInfo;
    renderStorageInfo();
  });

  window.noticeNote.onReminderFired((reminder) => {
    showReminderToast(reminder);
  });
}

titleInput.addEventListener('input', () => {
  const note = getActiveNote();
  if (note) {
    note.title = titleInput.value;
  }
  renderNoteList();
  queueSave();
});

saveButton.addEventListener('click', () => {
  saveActiveNote().catch(console.error);
});
newNoteButton.addEventListener('click', () => {
  createNote().catch(console.error);
});
refreshButton.addEventListener('click', () => {
  refreshNotes().catch(console.error);
});
addReminderButton.addEventListener('click', () => {
  addReminder().catch(console.error);
});
openReminderConfigButton.addEventListener('click', () => {
  reminderDialog.showModal();
});
closeReminderDialogButton.addEventListener('click', () => {
  reminderDialog.close();
});
autoReminderCheckbox.addEventListener('change', () => {
  if (!autoReminderCheckbox.checked) {
    return;
  }

  addAutoReminders()
    .catch(console.error)
    .finally(() => {
      autoReminderCheckbox.checked = false;
    });
});
deleteNoteButton.addEventListener('click', () => {
  deleteActiveNote().catch(console.error);
});
insertImageButton.addEventListener('click', () => {
  insertImage().catch(console.error);
});
noteSortSelect.addEventListener('change', () => {
  localStorage.setItem(NOTE_SORT_KEY, getNoteSortMode());
  notes = sortNotes(notes);
  renderNoteList();
});
noteSortOrderSelect.addEventListener('change', () => {
  localStorage.setItem(NOTE_SORT_ORDER_KEY, getNoteSortOrder());
  notes = sortNotes(notes);
  renderNoteList();
});
toggleSidebarButton.addEventListener('click', () => {
  setSidebarCollapsed(!sidebar.classList.contains('is-collapsed'));
});
showSidebarButton.addEventListener('click', () => {
  setSidebarCollapsed(false);
});
toggleReminderButton.addEventListener('click', () => {
  setReminderCollapsed(!editorPanel.classList.contains('reminder-collapsed'));
});
showReminderButton.addEventListener('click', () => {
  setReminderCollapsed(false);
});

boot().catch(console.error);
