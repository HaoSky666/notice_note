// 存储位置、应用设置与手机离线包导出 IPC handler
module.exports = function registerStorageIpc(ctx) {
  const { ipcMain } = ctx;

  ipcMain.handle('storage:get', () => ctx.getStorageInfo());
  ipcMain.handle('storage:choose', ctx.chooseNotesPath);
  ipcMain.handle('storage:reset', ctx.resetNotesPath);
  ipcMain.handle('settings:get', () => ctx.getAppSettings());
  ipcMain.handle('settings:update', ctx.updateAppSettings);
  ipcMain.handle('mobile:export-package', ctx.exportMobilePackage);
};
