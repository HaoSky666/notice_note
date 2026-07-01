const noteList = document.querySelector('#noteList');
const titleInput = document.querySelector('#titleInput');
const reminderInput = document.querySelector('#reminderInput');
const reminderList = document.querySelector('#reminderList');
const editorRoot = document.querySelector('#editorRoot');
const contentShell = document.querySelector('#contentShell');
const insertImageButton = document.querySelector('#insertImageButton');
const saveButton = document.querySelector('#saveButton');
const newNoteButton = document.querySelector('#newNoteButton');
const addReminderButton = document.querySelector('#addReminderButton');
const deleteNoteButton = document.querySelector('#deleteNoteButton');
const autoReminderCheckbox = document.querySelector('#autoReminderCheckbox');
const reminderDialog = document.querySelector('#reminderDialog');
const openReminderConfigButton = document.querySelector('#openReminderConfigButton');
const closeReminderDialogButton = document.querySelector('#closeReminderDialogButton');
const sidebar = document.querySelector('#sidebar');
const toggleSidebarButton = document.querySelector('#toggleSidebarButton');
const showSidebarButton = document.querySelector('#showSidebarButton');
const editorPanel = document.querySelector('.editor-panel');
const editorTopbar = document.querySelector('#editorTopbar');
const toggleReminderButton = document.querySelector('#toggleReminderButton');
const showReminderButton = document.querySelector('#showReminderButton');
const refreshButton = document.querySelector('#refreshButton');
const newMenuDropdown = document.querySelector('#newMenuDropdown');
const newNoteOption = document.querySelector('#newNoteOption');
const newFolderOption = document.querySelector('#newFolderOption');
const breadcrumb = document.querySelector('#breadcrumb');
const pdfViewer = document.querySelector('#pdfViewer');
const pdfTitle = document.querySelector('#pdfTitle');
const pdfMeta = document.querySelector('#pdfMeta');
const pdfPath = document.querySelector('#pdfPath');
const pdfPages = document.querySelector('#pdfPages');
const pdfPageCount = document.querySelector('#pdfPageCount');
const pdfZoomOut = document.querySelector('#pdfZoomOut');
const pdfZoomIn = document.querySelector('#pdfZoomIn');
const pdfZoomValue = document.querySelector('#pdfZoomValue');
const pdfOutline = document.querySelector('#pdfOutline');
const pdfOutlineList = document.querySelector('#pdfOutlineList');
const pdfOutlineToggle = document.querySelector('#pdfOutlineToggle');
const workspaceTabsRoot = document.querySelector('#workspaceTabs');
const notificationBell = document.querySelector('#notificationBell');
const notificationDot = document.querySelector('#notificationDot');
const notificationPanel = document.querySelector('#notificationPanel');
const notificationList = document.querySelector('#notificationList');
const fileViewer = document.querySelector('#fileViewer');
const fileViewerIcon = document.querySelector('#fileViewerIcon');
const fileViewerTitle = document.querySelector('#fileViewerTitle');
const fileViewerMeta = document.querySelector('#fileViewerMeta');
const fileViewerType = document.querySelector('#fileViewerType');
const fileViewerPath = document.querySelector('#fileViewerPath');
const fileViewerContent = document.querySelector('#fileViewerContent');
const viewerSearchBar = document.querySelector('#viewerSearchBar');
const viewerSearchInput = document.querySelector('#viewerSearchInput');
const viewerSearchCount = document.querySelector('#viewerSearchCount');
const viewerSearchPrevious = document.querySelector('#viewerSearchPrevious');
const viewerSearchNext = document.querySelector('#viewerSearchNext');
const viewerSearchClose = document.querySelector('#viewerSearchClose');

let notes = [];
let folders = [];
let pdfFiles = [];
let resourceFiles = [];
let activeNoteId = null;
let activePdfId = null;
let activeResourceId = null;
let activeFolderId = null;
let saveTimer;
let storageInfo = null;
let markdownEditor = null;
let isRenderingEditor = false;
let pdfLoadingTask = null;
let pdfDocument = null;
let pdfZoom = 1;
let pdfLoadVersion = 0;
let pdfPageRenderVersion = 0;
let imageZoom = 1;
let workspaceTabs = [];
let activeWorkspaceTabKey = null;
let filePreviewVersion = 0;
let viewerSearchMatches = [];
let activeViewerSearchIndex = -1;
const SIDEBAR_COLLAPSED_KEY = 'notice-note:sidebar-collapsed';
const REMINDER_COLLAPSED_KEY = 'notice-note:reminder-collapsed';
const REMINDER_NOTIFICATIONS_KEY = 'notice-note:reminder-notifications';
const DAILY_REMINDER_SLOTS = ['09:30', '15:00'];
let reminderNotifications = readReminderNotifications();
const editorEmptyState = document.createElement('div');
editorEmptyState.className = 'editor-empty-state';
editorEmptyState.hidden = true;
editorEmptyState.innerHTML = '<h2>欢迎使用 Notice Note</h2><p>从左侧打开一个文件，或点击右上角 + 新建内容。</p>';
contentShell.append(editorEmptyState);

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

function formatFileSize(bytes) {
  const size = Number(bytes) || 0;
  if (size < 1024) {
    return `${size} B`;
  }
  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
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

function sortNotes(noteItems) {
  return [...noteItems].sort((a, b) => {
    return getTimeValue(b.createdAt) - getTimeValue(a.createdAt);
  });
}

function getFilteredNotes() {
  return notes.filter(note => note.folderId === activeFolderId);
}

function getFilteredResources() {
  return resourceFiles.filter((file) => file.folderId === activeFolderId);
}

function getWorkspaceTabKey(type, id) {
  return `${type}:${id}`;
}

function getWorkspaceTabResource(tab) {
  if (tab.type === 'pdf') {
    return pdfFiles.find((pdf) => pdf.id === tab.id);
  }
  if (tab.type === 'file') {
    return resourceFiles.find((file) => file.id === tab.id);
  }
  return notes.find((note) => note.id === tab.id);
}

function findSidebarEntry(selector, datasetKey, value) {
  return [...noteList.querySelectorAll(selector)]
    .find((item) => item.dataset[datasetKey] === value) || null;
}

function syncSidebarToWorkspaceTab(tab) {
  const resource = getWorkspaceTabResource(tab);
  if (!resource || !noteList) {
    return;
  }

  const nextFolderId = resource.folderId || null;
  if (activeFolderId !== nextFolderId) {
    activeFolderId = nextFolderId;
    renderBreadcrumb();
    renderNoteList();
  }

  const target = tab.type === 'note'
    ? findSidebarEntry('[data-note-id]', 'noteId', tab.id)
    : findSidebarEntry('[data-file-id]', 'fileId', tab.id);
  target?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function renderWorkspaceTabs() {
  workspaceTabsRoot.innerHTML = '';

  for (const tab of workspaceTabs) {
    const resource = getWorkspaceTabResource(tab);
    if (!resource) {
      continue;
    }

    const tabKey = getWorkspaceTabKey(tab.type, tab.id);
    const item = document.createElement('div');
    item.className = `workspace-tab${tabKey === activeWorkspaceTabKey ? ' is-active' : ''}`;
    item.dataset.tabKey = tabKey;

    const mainButton = document.createElement('button');
    mainButton.className = 'workspace-tab-main';
    mainButton.type = 'button';
    mainButton.title = tab.type === 'note' ? resource.title : resource.path;

    const icon = document.createElement('span');
    const iconType = tab.type === 'note' ? resource.fileType : resource.kind;
    icon.className = `workspace-tab-icon ${iconType}`;
    icon.textContent = tab.type === 'note'
      ? resource.fileType.toUpperCase()
      : resource.typeLabel;

    const label = document.createElement('span');
    label.className = 'workspace-tab-label';
    label.textContent = tab.type === 'note'
      ? resource.title || '未命名笔记'
      : resource.name;

    const closeButton = document.createElement('button');
    closeButton.className = 'workspace-tab-close';
    closeButton.type = 'button';
    closeButton.title = '关闭标签';
    closeButton.setAttribute('aria-label', `关闭 ${label.textContent}`);
    closeButton.textContent = '×';

    mainButton.append(icon, label);
    mainButton.addEventListener('click', () => {
      activateWorkspaceTab(tab.type, tab.id).catch(console.error);
    });
    closeButton.addEventListener('click', () => {
      closeWorkspaceTab(tabKey).catch(console.error);
    });
    item.append(mainButton, closeButton);
    workspaceTabsRoot.append(item);
  }
}

function getViewerSearchRoot() {
  if (activePdfId) {
    return pdfPages;
  }
  const file = resourceFiles.find((item) => item.id === activeResourceId);
  return file?.kind === 'word'
    ? fileViewerContent.querySelector('.word-preview')
    : null;
}

function clearViewerSearchHighlights() {
  if (!window.CSS?.highlights) {
    return;
  }
  CSS.highlights.delete('viewer-search-match');
  CSS.highlights.delete('viewer-search-active');
}

function buildViewerSearchRanges(root, query) {
  const segments = [];
  let text = '';
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    const value = node.nodeValue || '';
    if (value) {
      segments.push({ node, start: text.length, end: text.length + value.length });
      text += value;
    }
    node = walker.nextNode();
  }

  const normalizedText = text.toLocaleLowerCase('zh-CN');
  const normalizedQuery = query.toLocaleLowerCase('zh-CN');
  const ranges = [];
  let searchFrom = 0;
  while (ranges.length < 500) {
    const matchStart = normalizedText.indexOf(normalizedQuery, searchFrom);
    if (matchStart < 0) {
      break;
    }
    const matchEnd = matchStart + normalizedQuery.length;
    const startSegment = segments.find((segment) => matchStart >= segment.start && matchStart < segment.end);
    const endSegment = segments.find((segment) => matchEnd > segment.start && matchEnd <= segment.end);
    if (startSegment && endSegment) {
      const range = document.createRange();
      range.setStart(startSegment.node, matchStart - startSegment.start);
      range.setEnd(endSegment.node, matchEnd - endSegment.start);
      ranges.push(range);
    }
    searchFrom = matchStart + normalizedQuery.length;
  }
  return ranges;
}

function showActiveViewerSearchMatch() {
  const match = viewerSearchMatches[activeViewerSearchIndex];
  if (!match) {
    viewerSearchCount.textContent = '0 / 0';
    return;
  }

  viewerSearchCount.textContent = `${activeViewerSearchIndex + 1} / ${viewerSearchMatches.length}`;
  if (window.CSS?.highlights && typeof window.Highlight === 'function') {
    CSS.highlights.set('viewer-search-active', new Highlight(match));
  }
  match.startContainer.parentElement?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
}

function updateViewerSearch() {
  clearViewerSearchHighlights();
  viewerSearchMatches = [];
  activeViewerSearchIndex = -1;
  const root = getViewerSearchRoot();
  const query = viewerSearchInput.value.trim();
  if (!root || !query) {
    viewerSearchCount.textContent = '0 / 0';
    return;
  }

  viewerSearchMatches = buildViewerSearchRanges(root, query);
  if (window.CSS?.highlights && typeof window.Highlight === 'function' && viewerSearchMatches.length > 0) {
    CSS.highlights.set('viewer-search-match', new Highlight(...viewerSearchMatches));
  }
  if (viewerSearchMatches.length > 0) {
    activeViewerSearchIndex = 0;
    showActiveViewerSearchMatch();
  } else {
    viewerSearchCount.textContent = '0 / 0';
  }
}

function moveViewerSearch(step) {
  if (viewerSearchMatches.length === 0) {
    return;
  }
  activeViewerSearchIndex = (activeViewerSearchIndex + step + viewerSearchMatches.length)
    % viewerSearchMatches.length;
  showActiveViewerSearchMatch();
}

function openViewerSearch() {
  if (!getViewerSearchRoot()) {
    return;
  }
  viewerSearchBar.hidden = false;
  viewerSearchInput.focus();
  viewerSearchInput.select();
  updateViewerSearch();
}

function closeViewerSearch() {
  clearViewerSearchHighlights();
  viewerSearchBar.hidden = true;
  viewerSearchMatches = [];
  activeViewerSearchIndex = -1;
  viewerSearchCount.textContent = '0 / 0';
}

function showWorkspaceTab(tab) {
  closeViewerSearch();
  activeWorkspaceTabKey = getWorkspaceTabKey(tab.type, tab.id);
  if (tab.type === 'pdf') {
    activePdfId = tab.id;
    activeResourceId = null;
    renderPdf();
  } else if (tab.type === 'file') {
    activeResourceId = tab.id;
    activePdfId = null;
    renderResourceFile();
  } else {
    activeNoteId = tab.id;
    activePdfId = null;
    activeResourceId = null;
    renderEditor();
  }
  renderWorkspaceTabs();
  syncSidebarToWorkspaceTab(tab);
}

async function activateWorkspaceTab(type, id) {
  const tabKey = getWorkspaceTabKey(type, id);
  if (tabKey === activeWorkspaceTabKey) {
    syncSidebarToWorkspaceTab({ type, id });
    return;
  }

  const tab = { type, id };
  if (!getWorkspaceTabResource(tab)) {
    return;
  }

  await flushPendingSave();
  if (!workspaceTabs.some((item) => getWorkspaceTabKey(item.type, item.id) === tabKey)) {
    workspaceTabs.push(tab);
  }
  showWorkspaceTab(tab);
}

async function closeWorkspaceTab(tabKey) {
  const index = workspaceTabs.findIndex((tab) => getWorkspaceTabKey(tab.type, tab.id) === tabKey);
  if (index < 0) {
    return;
  }

  const isActive = tabKey === activeWorkspaceTabKey;
  if (isActive) {
    await flushPendingSave();
  }
  workspaceTabs.splice(index, 1);

  if (!isActive) {
    renderWorkspaceTabs();
    return;
  }

  const nextTab = workspaceTabs[Math.min(index, workspaceTabs.length - 1)];
  if (nextTab) {
    showWorkspaceTab(nextTab);
    return;
  }

  activeWorkspaceTabKey = null;
  activeNoteId = null;
  activePdfId = null;
  activeResourceId = null;
  renderEditor();
}

async function closeOtherWorkspaceTabs(tabKey) {
  const tab = workspaceTabs.find((item) => getWorkspaceTabKey(item.type, item.id) === tabKey);
  if (!tab) {
    return;
  }

  await flushPendingSave();
  workspaceTabs = [tab];
  if (tabKey === activeWorkspaceTabKey) {
    renderWorkspaceTabs();
  } else {
    showWorkspaceTab(tab);
  }
}

async function closeAllWorkspaceTabs() {
  await flushPendingSave();
  workspaceTabs = [];
  activeWorkspaceTabKey = null;
  activeNoteId = null;
  activePdfId = null;
  activeResourceId = null;
  renderEditor();
}

function reconcileWorkspaceTabs() {
  workspaceTabs = workspaceTabs.filter((tab) => Boolean(getWorkspaceTabResource(tab)));
  let activeTab = workspaceTabs.find((tab) => {
    return getWorkspaceTabKey(tab.type, tab.id) === activeWorkspaceTabKey;
  });

  if (!activeTab) {
    activeTab = workspaceTabs[0] || null;
    if (activeTab) {
      showWorkspaceTab(activeTab);
      return true;
    }
    activeWorkspaceTabKey = null;
    activeNoteId = null;
    activePdfId = null;
    activeResourceId = null;
  }

  renderWorkspaceTabs();
  return false;
}

function getCurrentFolders() {
  return folders.filter(folder => folder.parentId === activeFolderId);
}

function getFolderNamePath(folderId, sourceFolders = folders) {
  const names = [];
  let current = folderId ? sourceFolders.find((folder) => folder.id === folderId) : null;
  while (current) {
    names.unshift(current.name);
    current = current.parentId
      ? sourceFolders.find((folder) => folder.id === current.parentId)
      : null;
  }
  return names;
}

function resolveFolderIdByNamePath(names, sourceFolders = folders) {
  let parentId = null;
  for (const name of names) {
    const folder = sourceFolders.find((item) => item.parentId === parentId && item.name === name);
    if (!folder) {
      return null;
    }
    parentId = folder.id;
  }
  return parentId;
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
  rootBtn.className = `breadcrumb-item breadcrumb-root${activeFolderId === null ? ' active' : ''}`;
  rootBtn.textContent = '全部笔记';
  rootBtn.addEventListener('click', () => selectFolder(null));
  makeBreadcrumbDropTarget(rootBtn, null);
  breadcrumb.append(rootBtn);

  const path = buildPath(activeFolderId);
  for (const folder of path) {
    const btn = document.createElement('button');
    btn.className = `breadcrumb-item breadcrumb-child${folder.id === activeFolderId ? ' active' : ''}`;
    btn.textContent = folder.name;
    btn.title = folder.name;
    btn.addEventListener('click', () => selectFolder(folder.id));
    makeBreadcrumbDropTarget(btn, folder.id);
    breadcrumb.append(btn);
  }
}

function getFolderNoteCount(folderId) {
  return notes.filter((note) => note.folderId === folderId).length
    + resourceFiles.filter((file) => file.folderId === folderId).length;
}

function getChildFolderCount(folderId) {
  return folders.filter((folder) => folder.parentId === folderId).length;
}

function renderNoteList() {
  if (!noteList) {
    return;
  }

  const currentFolders = getCurrentFolders();
  const filteredNotes = getFilteredNotes();
  const filteredResources = getFilteredResources();

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

    const counts = document.createElement('span');
    counts.className = 'folder-counts';

    const folderCount = document.createElement('span');
    folderCount.className = 'folder-count folder-count-folders';
    folderCount.textContent = `夹 ${getChildFolderCount(folder.id)}`;
    folderCount.title = '子文件夹数量';

    const fileCount = document.createElement('span');
    fileCount.className = 'folder-count folder-count-files';
    fileCount.textContent = `文 ${getFolderNoteCount(folder.id)}`;
    fileCount.title = '文件数量';
    counts.append(folderCount, fileCount);

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
    item.append(icon, name, counts, actions);
    item.addEventListener('click', () => selectFolder(folder.id));
    noteList.append(item);
  }

  for (const note of sortNotes(filteredNotes)) {
    const item = document.createElement('button');
    item.className = `note-item${!activePdfId && !activeResourceId && note.id === activeNoteId ? ' active' : ''}`;
    item.type = 'button';
    item.dataset.noteId = note.id;
    item.addEventListener('click', () => selectNote(note.id).catch(console.error));

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

    const titleRow = document.createElement('div');
    titleRow.className = 'note-title-row';

    const title = document.createElement('strong');
    title.textContent = note.title || '未命名笔记';
    titleRow.append(title);

    if (hasTodayPendingReminder(note)) {
      const todayBadge = document.createElement('span');
      todayBadge.className = 'today-reminder-badge';
      todayBadge.textContent = '今日';
      todayBadge.title = '今天有提醒';
      titleRow.append(todayBadge);
    }

    const textBadge = document.createElement('span');
    textBadge.className = `file-type-badge ${note.fileType}`;
    textBadge.textContent = note.fileType.toUpperCase();
    titleRow.append(textBadge);

    item.append(titleRow);

    const timeMeta = document.createElement('div');
    timeMeta.className = 'note-time-meta';
    timeMeta.innerHTML = `
      <span class="note-meta-line">
        <span class="note-meta-label">创建</span>
        <span class="note-meta-value">${formatListDateTime(note.createdAt)}</span>
      </span>
      <span class="note-meta-line">
        <span class="note-meta-label">修改</span>
        <span class="note-meta-value">${formatListDateTime(note.updatedAt)}</span>
      </span>
    `;
    item.append(timeMeta);

    const pendingCount = (note.reminders || []).filter((reminder) => !reminder.done).length;
    const reminderMeta = document.createElement('span');
    reminderMeta.className = `note-reminder-meta${pendingCount > 0 ? ' has-pending' : ''}`;
    reminderMeta.textContent = pendingCount > 0 ? `${pendingCount} 个待提醒` : '无待提醒';
    item.append(reminderMeta);

    noteList.append(item);
  }

  for (const file of filteredResources) {
    const item = document.createElement('button');
    const isActive = file.kind === 'pdf'
      ? file.id === activePdfId
      : file.id === activeResourceId;
    item.className = `note-item resource-item ${file.kind}${isActive ? ' active' : ''}${file.canOpen ? '' : ' is-unopenable'}`;
    item.type = 'button';
    item.dataset.fileId = file.id;
    if (file.canOpen) {
      item.addEventListener('click', () => selectResourceFile(file.id).catch(console.error));
    } else {
      item.title = '该文件类型仅支持在列表中查看';
    }

    const titleRow = document.createElement('div');
    titleRow.className = 'note-title-row';

    const title = document.createElement('strong');
    title.textContent = file.name;

    const badge = document.createElement('span');
    badge.className = `file-type-badge ${file.kind}`;
    badge.textContent = file.typeLabel;

    const meta = document.createElement('span');
    meta.className = 'note-time-meta';
    meta.textContent = `${formatFileSize(file.size)} · 修改：${formatListDateTime(file.updatedAt)}`;

    titleRow.append(title, badge);
    item.append(titleRow, meta);
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
    await window.noticeNote.createFolder(name, activeFolderId);
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
  return notes.find((note) => note.id === activeNoteId) || null;
}

function getDraftNote() {
  const activeNote = getActiveNote();
  if (!activeNote) {
    return null;
  }
  return {
    ...activeNote,
    title: titleInput.value,
    content: normalizeEditorContent(getEditorValue(), activeNote)
  };
}

function getEditorValue() {
  return markdownEditor ? markdownEditor.getMarkdown() : '';
}

function normalizeMarkdownContent(content) {
  return String(content || '').replace(/^(\s*)\*(\s+)/gm, '$1-$2');
}

function normalizeEditorContent(content, note = getActiveNote()) {
  return ['txt', 'json'].includes(note?.fileType)
    ? String(content || '')
    : normalizeMarkdownContent(content);
}

function setEditorValue(value) {
  const nextValue = normalizeEditorContent(value);
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

function readReminderNotifications() {
  try {
    const stored = JSON.parse(localStorage.getItem(REMINDER_NOTIFICATIONS_KEY) || '[]');
    return Array.isArray(stored) ? stored.slice(0, 50) : [];
  } catch {
    return [];
  }
}

function saveReminderNotifications() {
  localStorage.setItem(REMINDER_NOTIFICATIONS_KEY, JSON.stringify(reminderNotifications.slice(0, 50)));
}

function renderReminderNotifications() {
  notificationList.innerHTML = '';
  notificationDot.hidden = !reminderNotifications.some((item) => !item.read);

  if (reminderNotifications.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'notification-empty';
    empty.textContent = '暂无提醒通知';
    notificationList.append(empty);
    return;
  }

  for (const notification of reminderNotifications) {
    const button = document.createElement('button');
    button.className = `notification-item${notification.read ? '' : ' is-unread'}`;
    button.type = 'button';

    const title = document.createElement('strong');
    title.textContent = notification.title || '未命名笔记';
    const body = document.createElement('span');
    body.className = 'notification-item-body';
    body.textContent = notification.body || '你有一条笔记提醒到了。';
    const meta = document.createElement('span');
    meta.className = 'notification-item-meta';
    meta.textContent = `${formatDateOnly(notification.date)} ${notification.slot || ''}`.trim();
    button.append(title, body, meta);

    const noteExists = notes.some((note) => note.id === notification.noteId);
    button.disabled = !noteExists;
    if (!noteExists) {
      button.title = '对应文件已不存在';
    } else {
      button.addEventListener('click', () => {
        notificationPanel.hidden = true;
        selectNote(notification.noteId).catch(console.error);
      });
    }
    notificationList.append(button);
  }
}

function addReminderNotification(reminder) {
  const id = `${reminder.reminderId || reminder.noteId}:${reminder.date || ''}:${reminder.slot || ''}`;
  reminderNotifications = reminderNotifications.filter((item) => item.id !== id);
  reminderNotifications.unshift({
    id,
    noteId: reminder.noteId,
    title: reminder.title,
    body: reminder.body,
    date: reminder.date,
    slot: reminder.slot,
    receivedAt: new Date().toISOString(),
    read: false
  });
  reminderNotifications = reminderNotifications.slice(0, 50);
  saveReminderNotifications();
  renderReminderNotifications();
}

function toggleNotificationPanel() {
  notificationPanel.hidden = !notificationPanel.hidden;
  if (notificationPanel.hidden) {
    return;
  }
  reminderNotifications = reminderNotifications.map((item) => ({ ...item, read: true }));
  saveReminderNotifications();
  renderReminderNotifications();
}

function renderStorageInfo() {
  if (!storageInfo) {
    return;
  }
}

function renderReminders() {
  const note = getActiveNote();
  reminderList.innerHTML = '';

  if (!note) {
    const empty = document.createElement('p');
    empty.className = 'empty-text';
    empty.textContent = '当前没有打开的笔记。';
    reminderList.append(empty);
    return;
  }

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

  isRenderingEditor = true;
  activePdfId = null;
  activeResourceId = null;
  editorPanel.hidden = false;
  pdfViewer.hidden = true;
  fileViewer.hidden = true;
  filePreviewVersion++;
  destroyPdfPreview();

  if (!activeNote) {
    activeNoteId = null;
    titleInput.value = '';
    editorTopbar.hidden = true;
    titleInput.disabled = true;
    openReminderConfigButton.disabled = true;
    insertImageButton.disabled = true;
    deleteNoteButton.disabled = true;
    saveButton.disabled = true;
    editorRoot.hidden = true;
    editorEmptyState.hidden = false;
  } else {
    activeNoteId = activeNote.id;
    editorTopbar.hidden = false;
    titleInput.disabled = false;
    openReminderConfigButton.disabled = false;
    insertImageButton.disabled = false;
    deleteNoteButton.disabled = false;
    saveButton.disabled = false;
    editorRoot.hidden = false;
    editorEmptyState.hidden = true;
    titleInput.value = activeNote.title || '';
    setEditorValue(activeNote.content || '');
    markdownEditor?.refresh?.();
  }

  isRenderingEditor = false;
  renderNoteList();
  renderReminders();
  renderWorkspaceTabs();
}

function destroyPdfPreview() {
  pdfLoadVersion++;
  pdfPageRenderVersion++;
  pdfLoadingTask?.destroy();
  pdfLoadingTask = null;
  pdfDocument = null;
  pdfPages.innerHTML = '';
  pdfPageCount.textContent = '';
  pdfOutlineList.innerHTML = '';
}

function showPdfStatus(message, isError = false) {
  pdfPages.innerHTML = '';
  const status = document.createElement('div');
  status.className = `pdf-preview-status${isError ? ' is-error' : ''}`;
  status.textContent = message;
  pdfPages.append(status);
}

async function renderPdfPages() {
  if (!pdfDocument) {
    return;
  }

  const version = ++pdfPageRenderVersion;
  const documentToRender = pdfDocument;
  const availableWidth = Math.max(320, pdfPages.clientWidth - 48);
  pdfPages.innerHTML = '';

  for (let pageNumber = 1; pageNumber <= documentToRender.numPages; pageNumber++) {
    if (version !== pdfPageRenderVersion) {
      return;
    }

    const page = await documentToRender.getPage(pageNumber);
    const baseViewport = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: (availableWidth / baseViewport.width) * pdfZoom });
    const outputScale = Math.min(window.devicePixelRatio || 1, 2);
    const pageElement = document.createElement('section');
    pageElement.className = 'pdf-page';
    pageElement.dataset.pageNumber = String(pageNumber);
    pageElement.style.setProperty('--scale-factor', String(viewport.scale));
    pageElement.style.setProperty('--user-unit', String(viewport.userUnit || 1));
    pageElement.style.width = `${Math.floor(viewport.width)}px`;
    pageElement.style.height = `${Math.floor(viewport.height)}px`;

    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(viewport.width * outputScale);
    canvas.height = Math.floor(viewport.height * outputScale);
    canvas.style.width = `${Math.floor(viewport.width)}px`;
    canvas.style.height = `${Math.floor(viewport.height)}px`;
    canvas.setAttribute('aria-label', `第 ${pageNumber} 页`);
    const textLayer = document.createElement('div');
    textLayer.className = 'textLayer';
    pageElement.append(canvas, textLayer);
    pdfPages.append(pageElement);

    const textContent = await page.getTextContent();
    await page.render({
      canvasContext: canvas.getContext('2d'),
      transform: outputScale === 1 ? null : [outputScale, 0, 0, outputScale, 0, 0],
      viewport
    }).promise;

    if (version !== pdfPageRenderVersion) {
      return;
    }

    const layer = new window.noticeNotePdf.TextLayer({
      textContentSource: textContent,
      container: textLayer,
      viewport
    });
    await layer.render();
  }

  if (!viewerSearchBar.hidden) {
    updateViewerSearch();
  }
}

async function getPdfOutlinePageNumber(item) {
  if (!pdfDocument || !item.dest) {
    return null;
  }

  const destination = typeof item.dest === 'string'
    ? await pdfDocument.getDestination(item.dest)
    : item.dest;
  if (!Array.isArray(destination) || destination.length === 0) {
    return null;
  }

  const pageRef = destination[0];
  const pageIndex = Number.isInteger(pageRef)
    ? pageRef
    : await pdfDocument.getPageIndex(pageRef);
  return pageIndex + 1;
}

function createPdfOutlineItems(items) {
  const list = document.createElement('ul');

  for (const item of items) {
    const listItem = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = item.title || '未命名章节';
    button.disabled = !item.dest;
    if (item.bold) {
      button.classList.add('is-bold');
    }
    if (item.italic) {
      button.classList.add('is-italic');
    }
    button.addEventListener('click', async () => {
      const pageNumber = await getPdfOutlinePageNumber(item);
      const page = pageNumber
        ? pdfPages.querySelector(`[data-page-number="${pageNumber}"]`)
        : null;
      page?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    listItem.append(button);

    if (Array.isArray(item.items) && item.items.length > 0) {
      listItem.append(createPdfOutlineItems(item.items));
    }
    list.append(listItem);
  }

  return list;
}

function renderPdfOutline(items) {
  pdfOutlineList.innerHTML = '';
  if (!Array.isArray(items) || items.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'pdf-outline-empty';
    empty.textContent = '该文档没有目录';
    pdfOutlineList.append(empty);
    return;
  }

  pdfOutlineList.append(createPdfOutlineItems(items));
}

async function loadPdfPreview(pdf) {
  destroyPdfPreview();
  pdfZoom = 1;
  pdfZoomValue.textContent = '100%';
  pdfZoomOut.disabled = false;
  pdfZoomIn.disabled = false;
  pdfOutline.hidden = false;
  pdfOutlineToggle.classList.add('is-active');
  showPdfStatus('正在加载 PDF…');
  const version = ++pdfLoadVersion;

  try {
    const bytes = await window.noticeNote.readPdf(pdf.id);
    if (version !== pdfLoadVersion) {
      return;
    }

    pdfLoadingTask = window.noticeNotePdf.getDocument({ data: new Uint8Array(bytes) });
    pdfDocument = await pdfLoadingTask.promise;
    if (version !== pdfLoadVersion) {
      return;
    }

    pdfPageCount.textContent = `${pdfDocument.numPages} 页`;
    const outline = await pdfDocument.getOutline();
    await renderPdfPages();
    if (version === pdfLoadVersion) {
      renderPdfOutline(outline);
    }
  } catch (error) {
    if (version === pdfLoadVersion) {
      showPdfStatus(`PDF 加载失败：${error.message}`, true);
    }
  }
}

async function changePdfZoom(step, anchor = null) {
  const nextZoom = Math.min(2, Math.max(0.5, pdfZoom + step));
  if (nextZoom === pdfZoom) {
    return;
  }

  const pageNumber = anchor?.page?.dataset.pageNumber;
  const pageRect = anchor?.page?.getBoundingClientRect();
  const anchorRatioX = pageRect ? (anchor.clientX - pageRect.left) / pageRect.width : 0;
  const anchorRatioY = pageRect ? (anchor.clientY - pageRect.top) / pageRect.height : 0;

  pdfZoom = nextZoom;
  pdfZoomValue.textContent = `${Math.round(pdfZoom * 100)}%`;
  pdfZoomOut.disabled = pdfZoom <= 0.5;
  pdfZoomIn.disabled = pdfZoom >= 2;
  await renderPdfPages();

  if (!pageNumber || pdfZoom !== nextZoom) {
    return;
  }

  const nextPage = pdfPages.querySelector(`[data-page-number="${pageNumber}"]`);
  const nextRect = nextPage?.getBoundingClientRect();
  if (nextRect) {
    pdfPages.scrollLeft += nextRect.left + (nextRect.width * anchorRatioX) - anchor.clientX;
    pdfPages.scrollTop += nextRect.top + (nextRect.height * anchorRatioY) - anchor.clientY;
  }
}

function changeImageZoom(step, anchor) {
  const image = fileViewerContent.querySelector('.file-preview-image');
  if (!image?.complete || !image.naturalWidth) {
    return;
  }

  const nextZoom = Math.min(5, Math.max(0.25, imageZoom + step));
  if (nextZoom === imageZoom) {
    return;
  }

  const previousRect = image.getBoundingClientRect();
  if (imageZoom === 1) {
    image.dataset.baseWidth = String(previousRect.width);
    image.dataset.baseHeight = String(previousRect.height);
  }

  const anchorRatioX = (anchor.clientX - previousRect.left) / previousRect.width;
  const anchorRatioY = (anchor.clientY - previousRect.top) / previousRect.height;
  const baseWidth = Number(image.dataset.baseWidth) || previousRect.width / imageZoom;
  const baseHeight = Number(image.dataset.baseHeight) || previousRect.height / imageZoom;

  imageZoom = nextZoom;
  image.style.maxWidth = 'none';
  image.style.maxHeight = 'none';
  image.style.width = `${baseWidth * imageZoom}px`;
  image.style.height = `${baseHeight * imageZoom}px`;

  const nextRect = image.getBoundingClientRect();
  fileViewerContent.scrollLeft += nextRect.left + (nextRect.width * anchorRatioX) - anchor.clientX;
  fileViewerContent.scrollTop += nextRect.top + (nextRect.height * anchorRatioY) - anchor.clientY;
}

function renderPdf() {
  const pdf = pdfFiles.find((item) => item.id === activePdfId);
  if (!pdf) {
    activePdfId = null;
    renderEditor();
    return;
  }

  editorPanel.hidden = true;
  pdfViewer.hidden = false;
  fileViewer.hidden = true;
  filePreviewVersion++;
  pdfTitle.textContent = pdf.name;
  pdfMeta.textContent = `PDF 文档 · ${formatFileSize(pdf.size)} · 创建于 ${formatListDateTime(pdf.createdAt)} · 修改于 ${formatListDateTime(pdf.updatedAt)}`;
  pdfPath.textContent = pdf.path;
  pdfPath.title = pdf.path;
  renderNoteList();
  renderWorkspaceTabs();
  loadPdfPreview(pdf).catch((error) => showPdfStatus(`PDF 加载失败：${error.message}`, true));
}

function showFilePreviewStatus(message) {
  fileViewerContent.innerHTML = '';
  const status = document.createElement('div');
  status.className = 'file-preview-status';
  status.textContent = message;
  fileViewerContent.append(status);
}

function applySpreadsheetBorder(element, side, border) {
  if (!border) {
    return;
  }

  const width = ['medium', 'mediumDashed', 'mediumDashDot', 'mediumDashDotDot'].includes(border.style)
    ? 2
    : border.style === 'thick' ? 3 : 1;
  const lineStyle = border.style === 'double'
    ? 'double'
    : border.style.includes('dash') || border.style.includes('Dash')
      ? 'dashed'
      : border.style === 'dotted' || border.style === 'hair'
        ? 'dotted'
        : 'solid';
  element.style[`border${side}Width`] = `${border.style === 'double' ? 3 : width}px`;
  element.style[`border${side}Style`] = lineStyle;
  element.style[`border${side}Color`] = border.color || '#5f594e';
}

function applySpreadsheetCellStyle(cell, style = {}) {
  if (style.fontName) {
    cell.style.fontFamily = `"${style.fontName}", "Microsoft YaHei", sans-serif`;
  }
  if (style.fontSize) {
    cell.style.fontSize = `${style.fontSize}pt`;
  }
  cell.style.fontWeight = style.bold ? '700' : '400';
  cell.style.fontStyle = style.italic ? 'italic' : 'normal';
  if (style.underline || style.strike) {
    cell.style.textDecoration = [style.underline ? 'underline' : '', style.strike ? 'line-through' : '']
      .filter(Boolean)
      .join(' ');
  }
  if (style.fontColor) {
    cell.style.color = style.fontColor;
  }
  if (style.fillColor) {
    cell.style.backgroundColor = style.fillColor;
  }

  const horizontal = style.horizontal === 'centerContinuous' ? 'center' : style.horizontal;
  if (['left', 'center', 'right', 'justify'].includes(horizontal)) {
    cell.style.textAlign = horizontal;
  }
  if (style.vertical === 'middle') {
    cell.style.verticalAlign = 'middle';
  } else if (['top', 'bottom'].includes(style.vertical)) {
    cell.style.verticalAlign = style.vertical;
  }
  if (style.wrapText) {
    cell.style.whiteSpace = 'normal';
    cell.style.overflowWrap = 'anywhere';
  }

  applySpreadsheetBorder(cell, 'Top', style.borders?.top);
  applySpreadsheetBorder(cell, 'Right', style.borders?.right);
  applySpreadsheetBorder(cell, 'Bottom', style.borders?.bottom);
  applySpreadsheetBorder(cell, 'Left', style.borders?.left);
}

function renderSpreadsheetPreview(sheets) {
  fileViewerContent.innerHTML = '';
  const preview = document.createElement('div');
  preview.className = 'spreadsheet-preview';
  const tabs = document.createElement('div');
  tabs.className = 'spreadsheet-sheet-tabs';
  const sheetRoot = document.createElement('div');
  preview.append(tabs, sheetRoot);
  fileViewerContent.append(preview);

  const renderSheet = (sheet, activeButton) => {
    for (const button of tabs.querySelectorAll('button')) {
      button.classList.toggle('is-active', button === activeButton);
    }
    sheetRoot.innerHTML = '';
    const section = document.createElement('section');
    section.className = 'spreadsheet-preview-sheet';
    const heading = document.createElement('h2');
    heading.textContent = sheet.name;
    const tableWrap = document.createElement('div');
    tableWrap.className = 'spreadsheet-preview-table-wrap';
    const table = document.createElement('table');
    table.className = 'spreadsheet-preview-table';

    const colgroup = document.createElement('colgroup');
    for (const column of sheet.columns || []) {
      const col = document.createElement('col');
      col.style.width = `${column.width}px`;
      colgroup.append(col);
    }
    const tableWidth = (sheet.columns || []).reduce((total, column) => total + column.width, 0);
    if (tableWidth > 0) {
      table.style.width = `${tableWidth}px`;
    }
    table.append(colgroup);

    for (const row of sheet.rows) {
      const tr = document.createElement('tr');
      if (row.height) {
        tr.style.height = `${row.height}px`;
      }
      for (const cell of row.cells) {
        if (cell.skip) {
          continue;
        }
        const td = document.createElement('td');
        td.textContent = cell.value;
        if (cell.rowSpan > 1) {
          td.rowSpan = cell.rowSpan;
        }
        if (cell.columnSpan > 1) {
          td.colSpan = cell.columnSpan;
        }
        applySpreadsheetCellStyle(td, cell.style);
        tr.append(td);
      }
      table.append(tr);
    }
    tableWrap.append(table);
    section.append(heading, tableWrap);

    if (sheet.truncated) {
      const note = document.createElement('p');
      note.className = 'spreadsheet-preview-note';
      note.textContent = '表格较大，当前仅显示前 500 行、50 列。';
      section.append(note);
    }
    sheetRoot.append(section);
  };

  for (const [index, sheet] of sheets.entries()) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = sheet.name;
    button.addEventListener('click', () => renderSheet(sheet, button));
    tabs.append(button);
    if (index === 0) {
      renderSheet(sheet, button);
    }
  }
}

function appendSanitizedWordNode(sourceNode, targetParent) {
  if (sourceNode.nodeType === Node.TEXT_NODE) {
    targetParent.append(document.createTextNode(sourceNode.textContent || ''));
    return;
  }
  if (sourceNode.nodeType !== Node.ELEMENT_NODE) {
    return;
  }

  const tagName = sourceNode.tagName.toLowerCase();
  const allowedTags = new Set([
    'p', 'br', 'strong', 'em', 'u', 's', 'sup', 'sub', 'a',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li',
    'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
    'img', 'blockquote', 'hr'
  ]);

  if (!allowedTags.has(tagName)) {
    for (const child of sourceNode.childNodes) {
      appendSanitizedWordNode(child, targetParent);
    }
    return;
  }

  const target = document.createElement(tagName);
  if (sourceNode.id) {
    target.id = sourceNode.id;
  }

  const wordClasses = [...sourceNode.classList].filter((className) => className.startsWith('word-'));
  if (wordClasses.length > 0) {
    target.className = wordClasses.join(' ');
  }

  if (tagName === 'a') {
    const href = sourceNode.getAttribute('href') || '';
    if (href.startsWith('#')) {
      target.setAttribute('href', href);
    }
  } else if (tagName === 'img') {
    const src = sourceNode.getAttribute('src') || '';
    if (/^data:image\/(?:png|jpe?g|gif|webp);base64,/i.test(src)) {
      target.setAttribute('src', src);
    }
    target.setAttribute('alt', sourceNode.getAttribute('alt') || '文档图片');
  } else if (tagName === 'td' || tagName === 'th') {
    for (const attributeName of ['colspan', 'rowspan']) {
      const value = Number(sourceNode.getAttribute(attributeName));
      if (Number.isInteger(value) && value > 1 && value <= 100) {
        target.setAttribute(attributeName, String(value));
      }
    }
  }

  for (const child of sourceNode.childNodes) {
    appendSanitizedWordNode(child, target);
  }
  targetParent.append(target);
}

function enhanceWordPreview(content) {
  const children = [...content.children];
  const tocIndex = children.findIndex((element) => {
    return element.tagName === 'P' && element.textContent.replace(/\s/g, '') === '目录';
  });
  if (tocIndex < 3) {
    return;
  }

  const coverElements = children.slice(0, tocIndex);
  const cover = document.createElement('section');
  cover.className = 'word-cover';
  content.insertBefore(cover, coverElements[0]);
  cover.append(...coverElements);

  const paragraphs = [...cover.querySelectorAll(':scope > p')];
  paragraphs[0]?.classList.add('word-cover-organization');
  const title = paragraphs.find((paragraph) => {
    return /(规格书|方案|报告|说明书|合同|招标文件|技术要求)/.test(paragraph.textContent);
  }) || paragraphs[1];
  title?.classList.add('word-cover-title');

  for (const paragraph of paragraphs) {
    const text = paragraph.textContent.replace(/\s/g, '');
    if (/(编制人|审核人|分管领导|主要领导|负责人)[:：]/.test(text)) {
      paragraph.classList.add('word-cover-field');
    } else if (/^\d{4}年\d{1,2}月(?:\d{1,2}日)?$/.test(text)) {
      paragraph.classList.add('word-cover-date');
    }
  }

  children[tocIndex].classList.add('word-toc-title');
}

function renderWordPreview(html) {
  const content = document.createElement('article');
  content.className = 'word-preview';
  const parsed = new DOMParser().parseFromString(html || '', 'text/html');

  for (const child of parsed.body.childNodes) {
    appendSanitizedWordNode(child, content);
  }

  if (!content.hasChildNodes()) {
    content.textContent = '文档没有可显示的内容。';
  } else {
    enhanceWordPreview(content);
  }
  fileViewerContent.append(content);
  if (!viewerSearchBar.hidden) {
    updateViewerSearch();
  }
}

async function loadResourcePreview(file, version) {
  try {
    const preview = await window.noticeNote.previewFile(file.id);
    if (version !== filePreviewVersion) {
      return;
    }

    fileViewerContent.innerHTML = '';
    if (preview.kind === 'image') {
      imageZoom = 1;
      const image = document.createElement('img');
      image.className = 'file-preview-image';
      image.alt = file.name;
      image.addEventListener('load', () => {
        const rect = image.getBoundingClientRect();
        image.dataset.baseWidth = String(rect.width);
        image.dataset.baseHeight = String(rect.height);
      }, { once: true });
      image.src = preview.fileUrl;
      fileViewerContent.append(image);
    } else if (preview.kind === 'word') {
      renderWordPreview(preview.html);
    } else if (preview.kind === 'spreadsheet') {
      renderSpreadsheetPreview(preview.sheets);
    }
  } catch (error) {
    if (version === filePreviewVersion) {
      showFilePreviewStatus(`文件预览失败：${error.message}`);
    }
  }
}

function renderResourceFile() {
  const file = resourceFiles.find((item) => item.id === activeResourceId);
  if (!file || !file.canOpen || file.kind === 'pdf') {
    activeResourceId = null;
    renderEditor();
    return;
  }

  destroyPdfPreview();
  editorPanel.hidden = true;
  pdfViewer.hidden = true;
  fileViewer.hidden = false;
  fileViewerIcon.textContent = file.typeLabel;
  fileViewerTitle.textContent = file.name;
  fileViewerMeta.textContent = `${formatFileSize(file.size)} · 创建于 ${formatListDateTime(file.createdAt)} · 修改于 ${formatListDateTime(file.updatedAt)}`;
  fileViewerType.textContent = file.typeLabel;
  fileViewerPath.textContent = file.path;
  fileViewerPath.title = file.path;
  showFilePreviewStatus('正在加载文件…');
  const version = ++filePreviewVersion;
  renderNoteList();
  renderWorkspaceTabs();
  loadResourcePreview(file, version).catch(console.error);
}

function isEditingActiveNote() {
  return document.activeElement === titleInput
    || Boolean(markdownEditor?.hasFocus());
}

function mergeIncomingNotes(nextNotes) {
  if (activePdfId || activeResourceId) {
    notes = sortNotes(nextNotes);
    if (reconcileWorkspaceTabs()) {
      return;
    }
    renderNoteList();
    return;
  }

  const activeNote = getActiveNote();
  const shouldKeepDraft = activeNote
    && isEditingActiveNote()
    && nextNotes.some((note) => note.id === activeNote.id);

  if (!shouldKeepDraft) {
    notes = sortNotes(nextNotes);
    if (reconcileWorkspaceTabs()) {
      return;
    }
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
  renderWorkspaceTabs();
}

function createMarkdownEditor() {
  if (typeof window.createNoticeNoteEditor !== 'function') {
    throw new TypeError('找不到可用的 Markdown 编辑器构造函数');
  }

  markdownEditor = window.createNoticeNoteEditor({
    parent: editorRoot,
    initialValue: '',
    placeholder: '点击这里记录 Markdown 笔记。',
    isPlainText: () => ['txt', 'json'].includes(getActiveNote()?.fileType),
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
        note.content = normalizeEditorContent(value, note);
      }
      queueSave();
    }
  });
}

async function selectNote(noteId) {
  await activateWorkspaceTab('note', noteId);
}

async function selectPdf(pdfId) {
  await activateWorkspaceTab('pdf', pdfId);
}

async function selectResourceFile(fileId) {
  const file = resourceFiles.find((item) => item.id === fileId);
  if (!file?.canOpen) {
    return;
  }
  await activateWorkspaceTab(file.kind === 'pdf' ? 'pdf' : 'file', file.id);
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
  clearTimeout(saveTimer);
  saveTimer = null;
  const draft = getDraftNote();
  if (!draft) {
    return;
  }
  const savedNote = await window.noticeNote.saveNote(draft);
  replaceNote(savedNote);
  if (activeWorkspaceTabKey === getWorkspaceTabKey('note', savedNote.id)) {
    activeNoteId = savedNote.id;
    renderReminders();
  }
  renderNoteList();
  renderWorkspaceTabs();
}

async function flushPendingSave() {
  if (!saveTimer) {
    return;
  }

  clearTimeout(saveTimer);
  saveTimer = null;
  await saveActiveNote();
}

function queueSave() {
  if (!getActiveNote()) {
    return;
  }

  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
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
  await activateWorkspaceTab('note', note.id);
  renderBreadcrumb();
}

async function refreshNotes() {
  refreshButton.disabled = true;
  try {
    const activeFolderPath = getFolderNamePath(activeFolderId);
    const library = await window.noticeNote.refreshLibrary();
    notes = sortNotes(library.notes);
    folders = library.folders;
    activeFolderId = resolveFolderIdByNamePath(activeFolderPath, folders);
    pdfFiles = library.pdfFiles;
    resourceFiles = library.resourceFiles;
    renderBreadcrumb();
    if (reconcileWorkspaceTabs()) {
      return;
    }
    if (activePdfId && pdfFiles.some((pdf) => pdf.id === activePdfId)) {
      renderPdf();
    } else if (activeResourceId && resourceFiles.some((file) => file.id === activeResourceId)) {
      renderResourceFile();
    } else {
      renderEditor();
    }
  } finally {
    refreshButton.disabled = false;
  }
}

async function deleteActiveNote() {
  const note = getActiveNote();
  if (!note) {
    return;
  }

  await deleteNoteById(note.id);
}

async function deleteNoteById(noteId) {
  const note = notes.find((item) => item.id === noteId);
  if (!note) {
    return;
  }

  const confirmed = confirm(`确定删除「${note.title || '未命名笔记'}」吗？`);
  if (!confirmed) {
    return;
  }

  if (note.id === activeNoteId) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  const deletedTabKey = getWorkspaceTabKey('note', note.id);
  notes = sortNotes(await window.noticeNote.deleteNote(note.id));
  workspaceTabs = workspaceTabs.filter((tab) => {
    return getWorkspaceTabKey(tab.type, tab.id) !== deletedTabKey;
  });
  if (activeWorkspaceTabKey === deletedTabKey) {
    activeWorkspaceTabKey = null;
  }
  reconcileWorkspaceTabs();
}

async function deleteResourceFile(fileId) {
  const file = resourceFiles.find((item) => item.id === fileId);
  if (!file) {
    return;
  }

  const confirmed = confirm(`确定删除「${file.name}」吗？`);
  if (!confirmed) {
    return;
  }

  resourceFiles = await window.noticeNote.deleteFile(file.id);
  pdfFiles = resourceFiles.filter((item) => item.kind === 'pdf');
  workspaceTabs = workspaceTabs.filter((tab) => {
    const tabKey = getWorkspaceTabKey(tab.type, tab.id);
    return tabKey !== getWorkspaceTabKey('pdf', file.id)
      && tabKey !== getWorkspaceTabKey('file', file.id);
  });
  if (activeWorkspaceTabKey === getWorkspaceTabKey('pdf', file.id)
    || activeWorkspaceTabKey === getWorkspaceTabKey('file', file.id)) {
    activeWorkspaceTabKey = null;
  }

  if (!reconcileWorkspaceTabs()) {
    renderNoteList();
  }
}

async function boot() {
  setSidebarCollapsed(readBooleanSetting(SIDEBAR_COLLAPSED_KEY));
  setReminderCollapsed(readBooleanSetting(REMINDER_COLLAPSED_KEY));
  createMarkdownEditor();
  notes = sortNotes(await window.noticeNote.listNotes());
  folders = await window.noticeNote.listFolders();
  pdfFiles = await window.noticeNote.listPdfs();
  resourceFiles = await window.noticeNote.listFiles();
  storageInfo = await window.noticeNote.getStorage();
  activeNoteId = null;
  workspaceTabs = [];
  activeWorkspaceTabKey = null;
  reminderInput.value = toLocalDateKey(new Date());
  renderBreadcrumb();
  renderNoteList();
  renderEditor();
  renderReminderNotifications();

  window.noticeNote.onNotesChanged((nextNotes) => {
    mergeIncomingNotes(nextNotes);
    renderReminderNotifications();
  });

  window.noticeNote.onFoldersChanged((nextFolders) => {
    const activeFolderPath = getFolderNamePath(activeFolderId);
    folders = nextFolders;
    activeFolderId = resolveFolderIdByNamePath(activeFolderPath, folders);
    renderBreadcrumb();
    renderNoteList();
  });

  window.noticeNote.onPdfsChanged((nextPdfs) => {
    pdfFiles = nextPdfs;
    if (reconcileWorkspaceTabs()) {
      return;
    }

    if (activePdfId) {
      renderPdf();
    } else {
      renderNoteList();
    }
  });

  window.noticeNote.onFilesChanged((nextFiles) => {
    resourceFiles = nextFiles;
    pdfFiles = nextFiles.filter((file) => file.kind === 'pdf');
    if (reconcileWorkspaceTabs()) {
      return;
    }

    if (activeResourceId) {
      renderResourceFile();
    } else if (!activePdfId) {
      renderNoteList();
      renderWorkspaceTabs();
    }
  });

  window.noticeNote.onStorageChanged((nextStorageInfo) => {
    storageInfo = nextStorageInfo;
    renderStorageInfo();
  });

  window.noticeNote.onReminderFired((reminder) => {
    addReminderNotification(reminder);
  });
}

titleInput.addEventListener('input', () => {
  const note = getActiveNote();
  if (note) {
    note.title = titleInput.value;
  }
  renderNoteList();
  renderWorkspaceTabs();
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
pdfZoomOut.addEventListener('click', () => {
  changePdfZoom(-0.1).catch((error) => showPdfStatus(`PDF 渲染失败：${error.message}`, true));
});
pdfZoomIn.addEventListener('click', () => {
  changePdfZoom(0.1).catch((error) => showPdfStatus(`PDF 渲染失败：${error.message}`, true));
});
pdfPages.addEventListener('wheel', (event) => {
  if (!event.ctrlKey || event.deltaY === 0) {
    return;
  }

  event.preventDefault();
  const page = event.target.closest('.pdf-page');
  changePdfZoom(event.deltaY < 0 ? 0.1 : -0.1, {
    page,
    clientX: event.clientX,
    clientY: event.clientY
  }).catch((error) => showPdfStatus(`PDF 渲染失败：${error.message}`, true));
}, { passive: false });
fileViewerContent.addEventListener('wheel', (event) => {
  if (!event.ctrlKey || event.deltaY === 0 || !event.target.closest('.file-preview-image')) {
    return;
  }

  event.preventDefault();
  changeImageZoom(event.deltaY < 0 ? 0.1 : -0.1, event);
}, { passive: false });
viewerSearchInput.addEventListener('input', updateViewerSearch);
viewerSearchInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    moveViewerSearch(event.shiftKey ? -1 : 1);
  } else if (event.key === 'Escape') {
    event.preventDefault();
    closeViewerSearch();
  }
});
viewerSearchPrevious.addEventListener('click', () => moveViewerSearch(-1));
viewerSearchNext.addEventListener('click', () => moveViewerSearch(1));
viewerSearchClose.addEventListener('click', closeViewerSearch);
document.addEventListener('keydown', (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase('en-US') === 'f'
    && getViewerSearchRoot()) {
    event.preventDefault();
    openViewerSearch();
  }
});
pdfOutlineToggle.addEventListener('click', () => {
  pdfOutline.hidden = !pdfOutline.hidden;
  pdfOutlineToggle.classList.toggle('is-active', !pdfOutline.hidden);
});
notificationBell.addEventListener('click', (event) => {
  event.stopPropagation();
  toggleNotificationPanel();
});
notificationPanel.addEventListener('click', (event) => {
  event.stopPropagation();
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

function createContextMenuItem(label, onClick) {
  const item = document.createElement('button');
  item.className = 'context-menu-item';
  item.type = 'button';
  item.textContent = label;
  item.addEventListener('click', () => {
    hideContextMenu();
    onClick();
  });
  return item;
}

function createContextMenuSeparator() {
  const separator = document.createElement('div');
  separator.className = 'context-menu-separator';
  return separator;
}

function getContextMenuEntry(target) {
  const item = target.closest('.note-item');
  if (!item) {
    return null;
  }

  if (item.dataset.noteId) {
    return { type: 'note', id: item.dataset.noteId };
  }
  if (item.dataset.fileId) {
    return { type: 'file', id: item.dataset.fileId };
  }
  if (item.dataset.folderId) {
    return { type: 'folder', id: item.dataset.folderId };
  }
  return null;
}

function showContextMenu(x, y, entry = null) {
  hideContextMenu();

  contextMenu = document.createElement('div');
  contextMenu.className = 'context-menu';
  contextMenu.style.left = `${x}px`;
  contextMenu.style.top = `${y}px`;

  if (entry) {
    contextMenu.append(createContextMenuItem('复制绝对路径', () => {
      window.noticeNote.copyEntryPath(entry).catch(console.error);
    }));
    if (entry.type !== 'folder') {
      contextMenu.append(createContextMenuItem('使用默认应用打开', () => {
        window.noticeNote.openEntryWithDefaultApp(entry).catch(console.error);
      }));
    }
    contextMenu.append(
      createContextMenuItem('打开资源管理器', () => {
        window.noticeNote.showEntryInFolder(entry).catch(console.error);
      }),
      createContextMenuSeparator(),
      createContextMenuItem('删除', () => {
        if (entry.type === 'note') {
          deleteNoteById(entry.id).catch(console.error);
        } else if (entry.type === 'folder') {
          deleteFolder(entry.id).catch(console.error);
        } else if (entry.type === 'file') {
          deleteResourceFile(entry.id).catch(console.error);
        }
      })
    );
  } else {
    contextMenu.append(
      createContextMenuItem('新建笔记', () => {
        createNote().catch(console.error);
      }),
      createContextMenuItem('新建文件夹', () => {
        createFolder().catch(console.error);
      })
    );
  }

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

function showWorkspaceTabContextMenu(x, y, tabKey) {
  hideContextMenu();

  contextMenu = document.createElement('div');
  contextMenu.className = 'context-menu';
  contextMenu.style.left = `${x}px`;
  contextMenu.style.top = `${y}px`;
  contextMenu.append(
    createContextMenuItem('关闭其他', () => {
      closeOtherWorkspaceTabs(tabKey).catch(console.error);
    }),
    createContextMenuItem('关闭所有', () => {
      closeAllWorkspaceTabs().catch(console.error);
    })
  );
  document.body.append(contextMenu);

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
  e.preventDefault();
  showContextMenu(e.clientX, e.clientY, getContextMenuEntry(e.target));
});

workspaceTabsRoot.addEventListener('contextmenu', (e) => {
  const tab = e.target.closest('.workspace-tab');
  if (!tab?.dataset.tabKey) {
    return;
  }

  e.preventDefault();
  showWorkspaceTabContextMenu(e.clientX, e.clientY, tab.dataset.tabKey);
});

document.addEventListener('click', (e) => {
  if (contextMenu && !contextMenu.contains(e.target)) {
    hideContextMenu();
  }
  if (!notificationPanel.hidden && !e.target.closest('.notification-center')) {
    notificationPanel.hidden = true;
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    hideContextMenu();
    notificationPanel.hidden = true;
  }
});

  boot().catch(console.error);
