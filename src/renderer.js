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
const newMenuDropdown = document.querySelector('#newMenuDropdown');
const newNoteOption = document.querySelector('#newNoteOption');
const newFolderOption = document.querySelector('#newFolderOption');
const breadcrumb = document.querySelector('#breadcrumb');

let notes = [];
let folders = [];
let activeNoteId = null;
let activeFolderId = null;
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

function getFilteredNotes() {
  return notes.filter(note => note.folderId === activeFolderId);
}

function getCurrentFolders() {
  return folders.filter(folder => folder.parentId === activeFolderId);
}

function renderBreadcrumb() {
  breadcrumb.innerHTML = '';

  const buildPath = (folderId) => {
    const path = [];
    let current = folderId ? folders.find(f => f.id === folderId) : null;
    while (current) {
      path.unshift(current);
      current = current.parentId ? folders.find(f => f.id === current.parentId) : null;
    }
    return path;
  };

  const makeBreadcrumbDropTarget = (element, targetFolderId) => {
    element.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      element.classList.add('drag-over');
    });
    element.addEventListener('dragleave', () => {
      element.classList.remove('drag-over');
    });
    element.addEventListener('drop', async (e) => {
      e.preventDefault();
      element.classList.remove('drag-over');
      const dragType = e.dataTransfer.getData('text/plain');
      if (dragType.startsWith('note:')) {
        const noteId = dragType.slice(5);
        await moveNoteToFolder(noteId, targetFolderId);
      }
    });
  };

  const rootBtn = document.createElement('button');
  rootBtn.className = `breadcrumb-item${activeFolderId === null ? ' active' : ''}`;
  rootBtn.textContent = '全部笔记';
  rootBtn.addEventListener('click', () => selectFolder(null));
  makeBreadcrumbDropTarget(rootBtn, null);
  breadcrumb.append(rootBtn);

  const path = buildPath(activeFolderId);
  for (const folder of path) {
    const sep = document.createElement('span');
    sep.className = 'breadcrumb-separator';
    sep.textContent = '>';
    breadcrumb.append(sep);

    const btn = document.createElement('button');
    btn.className = `breadcrumb-item${folder.id === activeFolderId ? ' active' : ''}`;
    btn.textContent = folder.name;
    btn.addEventListener('click', () => selectFolder(folder.id));
    makeBreadcrumbDropTarget(btn, folder.id);
    breadcrumb.append(btn);
  }
}

function getFolderNoteCount(folderId) {
  return notes.filter(n => n.folderId === folderId).length;
}

function renderNoteList() {
  if (!noteList) {
    return;
  }

  const currentFolders = getCurrentFolders();
  const filteredNotes = getFilteredNotes();

  noteList.innerHTML = '';

  for (const folder of currentFolders) {
    const item = document.createElement('div');
    item.className = 'note-item folder-item';
    item.dataset.folderId = folder.id;

    // Drop target: accept notes/folders dragged into this folder
    item.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      item.classList.add('drag-over');
    });
    item.addEventListener('dragleave', () => {
      item.classList.remove('drag-over');
    });
    item.addEventListener('drop', async (e) => {
      e.preventDefault();
      item.classList.remove('drag-over');
      const dragType = e.dataTransfer.getData('text/plain');
      if (dragType.startsWith('note:')) {
        const noteId = dragType.slice(5);
        await moveNoteToFolder(noteId, folder.id);
      } else if (dragType.startsWith('folder:')) {
        const folderId = dragType.slice(7);
        if (folderId !== folder.id) {
          await moveFolderToFolder(folderId, folder.id);
        }
      }
    });

    // Draggable: folders can be dragged
    item.draggable = true;
    item.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', `folder:${folder.id}`);
      e.dataTransfer.effectAllowed = 'move';
      item.classList.add('dragging');
    });
    item.addEventListener('dragend', () => {
      item.classList.remove('dragging');
    });

    const icon = document.createElement('span');
    icon.className = 'folder-icon';
    icon.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M1.5 2.5h4.3l1.5-1h6.7a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1h-13a1 1 0 0 1-1-1v-10a1 1 0 0 1 1-1z" fill="#e8a849" stroke="#c48a30" stroke-width="0.8"/><path d="M1.5 6h13" stroke="#c48a30" stroke-width="0.6"/></svg>';

    const name = document.createElement('span');
    name.className = 'folder-name';
    name.textContent = folder.name;

    const count = document.createElement('span');
    count.className = 'folder-count';
    count.textContent = getFolderNoteCount(folder.id);

    const actions = document.createElement('span');
    actions.className = 'folder-actions';

    const renameBtn = document.createElement('button');
    renameBtn.className = 'folder-action-btn';
    renameBtn.type = 'button';
    renameBtn.title = '重命名';
    renameBtn.innerHTML = '<svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M11.5 1.5l3 3-9 9H2.5v-3l9-9z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>';
    renameBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      renameFolder(folder.id, folder.name);
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'folder-action-btn folder-action-danger';
    deleteBtn.type = 'button';
    deleteBtn.title = '删除';
    deleteBtn.innerHTML = '<svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M2 4h12M5.3 4V2.5a1 1 0 0 1 1-1h3.4a1 1 0 0 1 1 1V4M6.5 7.5v5M9.5 7.5v5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/><path d="M3.5 4l.8 9.5a1 1 0 0 0 1 .9h5.4a1 1 0 0 0 1-.9L12.5 4" stroke="currentColor" stroke-width="1.2"/></svg>';
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteFolder(folder.id);
    });

    actions.append(renameBtn, deleteBtn);
    item.append(icon, name, count, actions);
    item.addEventListener('click', () => selectFolder(folder.id));
    noteList.append(item);
  }

  for (const note of sortNotes(filteredNotes)) {
    const item = document.createElement('button');
    item.className = `note-item${note.id === activeNoteId ? ' active' : ''}`;
    item.type = 'button';
    item.addEventListener('click', () => selectNote(note.id));

    // Draggable: notes can be dragged into folders
    item.draggable = true;
    item.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', `note:${note.id}`);
      e.dataTransfer.effectAllowed = 'move';
      item.classList.add('dragging');
    });
    item.addEventListener('dragend', () => {
      item.classList.remove('dragging');
    });

    const title = document.createElement('strong');
    title.textContent = note.title || '未命名笔记';
    item.append(title);

    const timeMeta = document.createElement('span');
    timeMeta.className = 'note-time-meta';
    timeMeta.textContent = `创建：${formatListDateTime(note.createdAt)} · 修改：${formatListDateTime(note.updatedAt)}`;
    item.append(timeMeta);

    const reminderMeta = document.createElement('span');
    reminderMeta.className = 'note-reminder-meta';
    const pendingCount = (note.reminders || []).filter((reminder) => !reminder.done).length;
    reminderMeta.textContent = pendingCount > 0 ? `${pendingCount} 个待提醒` : '无待提醒';
    item.append(reminderMeta);

    noteList.append(item);
  }
}

function selectFolder(folderId) {
  activeFolderId = folderId;
  renderBreadcrumb();
  renderNoteList();
}

async function moveNoteToFolder(noteId, folderId) {
  try {
    await window.noticeNote.moveNote(noteId, folderId);
  } catch (error) {
    console.error('移动笔记失败:', error);
  }
}

async function moveFolderToFolder(folderId, targetFolderId) {
  try {
    await window.noticeNote.moveFolder(folderId, targetFolderId);
  } catch (error) {
    console.error('移动文件夹失败:', error);
  }
}

async function createFolder() {
  const name = await showFolderNameDialog();
  if (!name) return;

  try {
    await window.noticeNote.createFolder(name);
  } catch (error) {
    console.error('创建文件夹失败:', error);
  }
}

function showFolderNameDialog(defaultName) {
  return new Promise((resolve) => {
    const dialog = document.createElement('div');
    dialog.className = 'folder-dialog';
    dialog.innerHTML = `
      <div class="folder-dialog-content">
        <label>文件夹名称</label>
        <input type="text" id="folderNameInput" placeholder="新建文件夹" autofocus>
        <div class="folder-dialog-actions">
          <button class="secondary-button" id="folderDialogCancel">取消</button>
          <button class="primary-button" id="folderDialogConfirm">确定</button>
        </div>
      </div>
    `;
    document.body.append(dialog);

    const input = dialog.querySelector('#folderNameInput');
    const cancelBtn = dialog.querySelector('#folderDialogCancel');
    const confirmBtn = dialog.querySelector('#folderDialogConfirm');

    if (defaultName) {
      input.value = defaultName;
    }
    input.focus();
    input.select();

    const close = (value) => {
      dialog.remove();
      resolve(value);
    };

    cancelBtn.addEventListener('click', () => close(null));
    confirmBtn.addEventListener('click', () => close(input.value.trim()));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') close(input.value.trim());
      if (e.key === 'Escape') close(null);
    });
  });
}

async function deleteFolder(folderId) {
  const folder = folders.find(f => f.id === folderId);
  if (!folder) return;

  const noteCount = getFolderNoteCount(folderId);
  const message = noteCount > 0
    ? `确定删除文件夹「${folder.name}」吗？该文件夹下有 ${noteCount} 个笔记，将会一起删除。`
    : `确定删除文件夹「${folder.name}」吗？`;

  if (!confirm(message)) return;

  try {
    await window.noticeNote.deleteFolder(folderId);
    if (activeFolderId === folderId) {
      activeFolderId = null;
      renderBreadcrumb();
      renderNoteList();
    }
  } catch (error) {
    console.error('删除文件夹失败:', error);
  }
}

async function renameFolder(folderId, currentName) {
  const newName = await showFolderNameDialog(currentName);
  if (!newName || newName === currentName) return;

  try {
    await window.noticeNote.renameFolder(folderId, newName);
  } catch (error) {
    console.error('重命名文件夹失败:', error);
  }
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
  const note = await window.noticeNote.createNote(activeFolderId);
  if (!notes.some((item) => item.id === note.id)) {
    notes.unshift(note);
  }
  notes = sortNotes(notes);
  activeNoteId = note.id;
  renderEditor();
  renderBreadcrumb();
}

async function refreshNotes() {
  notes = sortNotes(await window.noticeNote.listNotes());
  folders = await window.noticeNote.listFolders();
  if (!notes.some((note) => note.id === activeNoteId)) {
    activeNoteId = notes[0]?.id || null;
  }
  renderBreadcrumb();
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
  folders = await window.noticeNote.listFolders();
  storageInfo = await window.noticeNote.getStorage();
  activeNoteId = notes[0]?.id || null;
  reminderInput.value = toLocalDateKey(new Date());
  renderBreadcrumb();
  renderNoteList();
  renderEditor();

  window.noticeNote.onNotesChanged((nextNotes) => {
    mergeIncomingNotes(nextNotes);
  });

  window.noticeNote.onFoldersChanged((nextFolders) => {
    folders = nextFolders;
    renderBreadcrumb();
    renderNoteList();
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
  newMenuDropdown.classList.toggle('is-open');
});
refreshButton.addEventListener('click', () => {
  refreshNotes().catch(console.error);
});
newNoteOption.addEventListener('click', () => {
  newMenuDropdown.classList.remove('is-open');
  createNote().catch(console.error);
});
newFolderOption.addEventListener('click', () => {
  newMenuDropdown.classList.remove('is-open');
  createFolder().catch(console.error);
});
document.addEventListener('click', (e) => {
  if (!e.target.closest('.new-menu')) {
    newMenuDropdown.classList.remove('is-open');
  }
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

// Right-click context menu on note list
let contextMenu = null;

function showContextMenu(x, y) {
  hideContextMenu();

  contextMenu = document.createElement('div');
  contextMenu.className = 'context-menu';
  contextMenu.style.left = `${x}px`;
  contextMenu.style.top = `${y}px`;

  const newNoteItem = document.createElement('button');
  newNoteItem.className = 'context-menu-item';
  newNoteItem.type = 'button';
  newNoteItem.innerHTML = '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M14 1H2a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1zM8 11V5M5 8h6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg> 新建笔记';
  newNoteItem.addEventListener('click', () => {
    hideContextMenu();
    createNote().catch(console.error);
  });

  const newFolderItem = document.createElement('button');
  newFolderItem.className = 'context-menu-item';
  newFolderItem.type = 'button';
  newFolderItem.innerHTML = '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M1.5 2.5h4.3l1.5-1h6.7a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1h-13a1 1 0 0 1-1-1v-10a1 1 0 0 1 1-1z" fill="#e8a849" stroke="#c48a30" stroke-width="0.8"/><path d="M1.5 6h13" stroke="#c48a30" stroke-width="0.6"/></svg> 新建文件夹';
  newFolderItem.addEventListener('click', () => {
    hideContextMenu();
    createFolder().catch(console.error);
  });

  contextMenu.append(newNoteItem, newFolderItem);
  document.body.append(contextMenu);

  // Keep menu within viewport
  const rect = contextMenu.getBoundingClientRect();
  if (rect.right > window.innerWidth) {
    contextMenu.style.left = `${x - rect.width}px`;
  }
  if (rect.bottom > window.innerHeight) {
    contextMenu.style.top = `${y - rect.height}px`;
  }
}

function hideContextMenu() {
  if (contextMenu) {
    contextMenu.remove();
    contextMenu = null;
  }
}

noteList.addEventListener('contextmenu', (e) => {
  // Only show on the empty area or on items (right-click)
  e.preventDefault();
  showContextMenu(e.clientX, e.clientY);
});

document.addEventListener('click', (e) => {
  if (contextMenu && !contextMenu.contains(e.target)) {
    hideContextMenu();
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    hideContextMenu();
  }
});

  boot().catch(console.error);
