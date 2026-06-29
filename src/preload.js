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
  moveFolder: (folderId, targetFolderId) => ipcRenderer.invoke('folders:move', folderId, targetFolderId),
  getStorage: () => ipcRenderer.invoke('storage:get'),
  chooseStorage: () => ipcRenderer.invoke('storage:choose'),
  resetStorage: () => ipcRenderer.invoke('storage:reset'),
  insertImage: (payload) => ipcRenderer.invoke('images:insert', payload),
  savePastedImage: (payload) => ipcRenderer.invoke('images:save-pasted', payload),
  listPdfs: () => ipcRenderer.invoke('pdfs:list'),
  listFiles: () => ipcRenderer.invoke('files:list'),
  previewFile: (fileId) => ipcRenderer.invoke('files:preview', fileId),
  refreshPdfs: () => ipcRenderer.invoke('pdfs:refresh'),
  readPdf: (pdfId) => ipcRenderer.invoke('pdfs:read', pdfId),
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
  onReminderFired: (callback) => {
    const listener = (_event, reminder) => callback(reminder);
    ipcRenderer.on('reminder:fired', listener);
    return () => ipcRenderer.removeListener('reminder:fired', listener);
  }
});
