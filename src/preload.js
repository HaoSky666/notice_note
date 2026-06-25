const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('noticeNote', {
  listNotes: () => ipcRenderer.invoke('notes:list'),
  createNote: () => ipcRenderer.invoke('notes:create'),
  saveNote: (note) => ipcRenderer.invoke('notes:save', note),
  deleteNote: (noteId) => ipcRenderer.invoke('notes:delete', noteId),
  getStorage: () => ipcRenderer.invoke('storage:get'),
  chooseStorage: () => ipcRenderer.invoke('storage:choose'),
  resetStorage: () => ipcRenderer.invoke('storage:reset'),
  insertImage: (payload) => ipcRenderer.invoke('images:insert', payload),
  savePastedImage: (payload) => ipcRenderer.invoke('images:save-pasted', payload),
  onNotesChanged: (callback) => {
    const listener = (_event, notes) => callback(notes);
    ipcRenderer.on('notes:changed', listener);
    return () => ipcRenderer.removeListener('notes:changed', listener);
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
