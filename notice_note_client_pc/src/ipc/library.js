// 库条目操作（路径复制、定位、外部打开、每日回顾）IPC handler
module.exports = function registerLibraryIpc(ctx) {
  const { ipcMain } = ctx;

  ipcMain.handle('entries:copy-path', ctx.copyLibraryEntryPath);
  ipcMain.handle('entries:show-in-folder', ctx.showLibraryEntryInFolder);
  ipcMain.handle('entries:open-default', ctx.openLibraryEntry);
  ipcMain.handle('external-url:open', ctx.openExternalUrl);
  ipcMain.handle('daily-review:handle', ctx.handleDailyReview);
};
