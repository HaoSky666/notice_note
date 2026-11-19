// 局域网同步 IPC handler。
// 薄传输层：服务生命周期与合并逻辑都在 main.js 的领域函数里，这里只转发。
module.exports = function registerSyncIpc(ctx) {
  const { ipcMain } = ctx;

  ipcMain.handle('sync:get-status', () => ctx.getSyncStatus());
  ipcMain.handle('sync:set-enabled', (_event, enabled) => ctx.setSyncEnabled(enabled));
  ipcMain.handle('sync:create-pair-code', () => ctx.createSyncPairCode());
  ipcMain.handle('sync:remove-device', (_event, token) => ctx.removeSyncDevice(token));
};