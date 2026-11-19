const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('noticeNote', {
  listNotes: () => ipcRenderer.invoke('notes:list'),
  refreshLibrary: () => ipcRenderer.invoke('library:refresh'),
  createNote: (folderId) => ipcRenderer.invoke('notes:create', folderId),
  saveNote: (note) => ipcRenderer.invoke('notes:save', note),
  deleteNote: (noteId) => ipcRenderer.invoke('notes:delete', noteId),
  moveNote: (noteId, folderId) => ipcRenderer.invoke('notes:move', noteId, folderId),
  listFolders: () => ipcRenderer.invoke('folders:list'),
  createFolder: (name, parentId) => ipcRenderer.invoke('folders:create', name, parentId),
  renameFolder: (folderId, newName) => ipcRenderer.invoke('folders:rename', folderId, newName),
  deleteFolder: (folderId) => ipcRenderer.invoke('folders:delete', folderId),
  setFolderPassword: (folderId, password, currentPassword = '') => {
    return ipcRenderer.invoke('folders:set-password', folderId, password, currentPassword);
  },
  clearFolderPassword: (folderId, currentPassword = '') => {
    return ipcRenderer.invoke('folders:clear-password', folderId, currentPassword);
  },
  unlockFolder: (folderId, password) => ipcRenderer.invoke('folders:unlock', folderId, password),
  lockFolder: (folderId) => ipcRenderer.invoke('folders:lock', folderId),
  moveFolder: (folderId, targetFolderId) => ipcRenderer.invoke('folders:move', folderId, targetFolderId),
  getStorage: () => ipcRenderer.invoke('storage:get'),
  chooseStorage: () => ipcRenderer.invoke('storage:choose'),
  resetStorage: () => ipcRenderer.invoke('storage:reset'),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  updateSettings: (settings) => ipcRenderer.invoke('settings:update', settings),
  exportMobilePackage: () => ipcRenderer.invoke('mobile:export-package'),
  insertImage: (payload) => ipcRenderer.invoke('images:insert', payload),
  savePastedImage: (payload) => ipcRenderer.invoke('images:save-pasted', payload),
  saveImageFromUrl: (payload) => ipcRenderer.invoke('images:save-from-url', payload),
  copyImage: (payload) => ipcRenderer.invoke('images:copy', payload),
  deleteImage: (payload) => ipcRenderer.invoke('images:delete', payload),
  listPdfs: () => ipcRenderer.invoke('pdfs:list'),
  listFiles: () => ipcRenderer.invoke('files:list'),
  previewFile: (fileId) => ipcRenderer.invoke('files:preview', fileId),
  deleteFile: (fileId) => ipcRenderer.invoke('files:delete', fileId),
  moveFile: (fileId, folderId) => ipcRenderer.invoke('files:move', fileId, folderId),
  readPdf: (pdfId) => ipcRenderer.invoke('pdfs:read', pdfId),
  copyEntryPath: (entry) => ipcRenderer.invoke('entries:copy-path', entry),
  showEntryInFolder: (entry) => ipcRenderer.invoke('entries:show-in-folder', entry),
  openEntryWithDefaultApp: (entry) => ipcRenderer.invoke('entries:open-default', entry),
  openExternalUrl: (url) => ipcRenderer.invoke('external-url:open', url),
  handleDailyReview: (dayKey, action) => ipcRenderer.invoke('daily-review:handle', { type: 'day', dayKey }, action),
  reorderDailyReview: (dayKey, action) => ipcRenderer.invoke('daily-review:reorder', dayKey, action),
  reorderSidebar: (kind, dragId, targetId, position) => (
    ipcRenderer.invoke('sidebar:reorder', kind, dragId, targetId, position)
  ),
  reorderReviewDayFile: (dayKey, dragKey, targetKey, position) => (
    ipcRenderer.invoke('review-day:reorder', dayKey, dragKey, targetKey, position)
  ),
  setReviewDate: (entry, reviewDate) => ipcRenderer.invoke('entries:set-review-date', entry, reviewDate),
  addDayReminder: (dayKey, date) => ipcRenderer.invoke('day-reminders:add', dayKey, date),
  updateDayReminderDate: (id, date) => ipcRenderer.invoke('day-reminders:update-date', id, date),
  removeDayReminder: (id) => ipcRenderer.invoke('day-reminders:remove', id),
  autoScheduleDayReminders: (dayKey) => ipcRenderer.invoke('day-reminders:auto', dayKey),
  listMemoryCards: () => ipcRenderer.invoke('memory:list'),
  createMemoryCard: (payload) => ipcRenderer.invoke('memory:create', payload),
  updateMemoryCard: (payload) => ipcRenderer.invoke('memory:update', payload),
  deleteMemoryCard: (cardId) => ipcRenderer.invoke('memory:delete', cardId),
  reviewMemoryCard: (payload) => ipcRenderer.invoke('memory:review', payload),
  filterMemoryCards: (payload) => ipcRenderer.invoke('memory:filter', payload),
  updateMemorySettings: (settings) => ipcRenderer.invoke('memory:settings:update', settings),
  // AI 判定：提交作答文本，主进程判档并直接落盘调度
  judgeMemoryAnswer: (payload) => ipcRenderer.invoke('memory:judge', payload),
  rejudgeMemoryAnswer: (payload) => ipcRenderer.invoke('memory:rejudge', payload),
  listMemoryAnswers: (cardId) => ipcRenderer.invoke('memory:answers:list', cardId),
  deleteMemoryAnswer: (payload) => ipcRenderer.invoke('memory:answers:delete', payload),
  getAiJudgeSettings: () => ipcRenderer.invoke('memory:ai:get'),
  updateAiJudgeSettings: (settings) => ipcRenderer.invoke('memory:ai:update', settings),
  testAiJudge: () => ipcRenderer.invoke('memory:ai:test'),
  // 局域网同步
  getSyncStatus: () => ipcRenderer.invoke('sync:get-status'),
  setSyncEnabled: (enabled) => ipcRenderer.invoke('sync:set-enabled', enabled),
  createSyncPairCode: () => ipcRenderer.invoke('sync:create-pair-code'),
  removeSyncDevice: (token) => ipcRenderer.invoke('sync:remove-device', token),
  onSyncChanged: (callback) => {
    const listener = (_event, status) => callback(status);
    ipcRenderer.on('sync:changed', listener);
    return () => ipcRenderer.removeListener('sync:changed', listener);
  },
  onNotesChanged: (callback) => {
    const listener = (_event, notes) => callback(notes);
    ipcRenderer.on('notes:changed', listener);
    return () => ipcRenderer.removeListener('notes:changed', listener);
  },
  onFoldersChanged: (callback) => {
    const listener = (_event, folders) => callback(folders);
    ipcRenderer.on('folders:changed', listener);
    return () => ipcRenderer.removeListener('folders:changed', listener);
  },
  onPdfsChanged: (callback) => {
    const listener = (_event, pdfs) => callback(pdfs);
    ipcRenderer.on('pdfs:changed', listener);
    return () => ipcRenderer.removeListener('pdfs:changed', listener);
  },
  onFilesChanged: (callback) => {
    const listener = (_event, files) => callback(files);
    ipcRenderer.on('files:changed', listener);
    return () => ipcRenderer.removeListener('files:changed', listener);
  },
  onStorageChanged: (callback) => {
    const listener = (_event, storage) => callback(storage);
    ipcRenderer.on('storage:changed', listener);
    return () => ipcRenderer.removeListener('storage:changed', listener);
  },
  takePendingReminders: () => ipcRenderer.invoke('reminders:take-pending'),
  ackPendingReminders: () => ipcRenderer.invoke('reminders:ack-pending'),
  onReminderFired: (callback) => {
    const listener = (_event, reminder) => callback(reminder);
    ipcRenderer.on('reminder:fired', listener);
    return () => ipcRenderer.removeListener('reminder:fired', listener);
  },
  onDayReminderOpen: (callback) => {
    const listener = (_event, dayKey) => callback(dayKey);
    ipcRenderer.on('day-reminder:open', listener);
    return () => ipcRenderer.removeListener('day-reminder:open', listener);
  },
  onDayRemindersChanged: (callback) => {
    const listener = (_event, list) => callback(list);
    ipcRenderer.on('day-reminders:changed', listener);
    return () => ipcRenderer.removeListener('day-reminders:changed', listener);
  },
  onMemoryChanged: (callback) => {
    const listener = (_event, snapshot) => callback(snapshot);
    ipcRenderer.on('memory:changed', listener);
    return () => ipcRenderer.removeListener('memory:changed', listener);
  }
});
