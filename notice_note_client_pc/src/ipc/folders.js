// 文件夹相关 IPC handler（薄传输层：通过 ctx 访问 main.js 的状态与领域函数）
module.exports = function registerFoldersIpc(ctx) {
  const { ipcMain, fs, path } = ctx;

  ipcMain.handle('folders:list', () => ctx.getVisibleFolders());
  ipcMain.handle('folders:create', ctx.createFolder);
  ipcMain.handle('folders:rename', ctx.renameFolder);
  ipcMain.handle('folders:delete', ctx.deleteFolder);
  ipcMain.handle('folders:set-password', ctx.setFolderPassword);
  ipcMain.handle('folders:clear-password', ctx.clearFolderPassword);
  ipcMain.handle('folders:unlock', ctx.unlockFolder);
  ipcMain.handle('folders:lock', ctx.lockFolder);
  ipcMain.handle('folders:move', async (_event, folderId, targetFolderId) => {
    const folder = ctx.folders.find(f => f.id === folderId);
    if (!folder) throw new Error('文件夹不存在');
    ctx.assertFolderAccessible(folderId);

    const normalizedTargetFolderId = targetFolderId || null;
    ctx.assertFolderTargetAccessible(normalizedTargetFolderId);
    let target = normalizedTargetFolderId
      ? ctx.folders.find((item) => item.id === normalizedTargetFolderId)
      : null;
    while (target) {
      if (target.id === folderId) {
        throw new Error('不能将文件夹移动到自身或其子文件夹');
      }
      target = target.parentId ? ctx.folders.find((item) => item.id === target.parentId) : null;
    }
    if ((folder.parentId || null) === normalizedTargetFolderId) {
      return folder;
    }

    const oldPath = ctx.getFolderPath(folderId);
    const targetDir = ctx.getFolderPath(normalizedTargetFolderId);
    const newPath = path.join(targetDir, folder.name);

    try {
      await fs.access(newPath);
      throw new Error('目标目录已存在同名文件夹');
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }

    const previousParentId = folder.parentId;
    const previousNoteMetadata = structuredClone(ctx.noteMetadata);
    const previousReminderMarks = new Set(ctx.reminderFileMarks);
    const previousNoteFileMap = new Map(ctx.noteFileMap);
    await fs.rename(oldPath, newPath);
    try {
      ctx.moveNoteMetadataTree(oldPath, newPath);
      ctx.moveResourceReminderFileMarkTree(oldPath, newPath);
      folder.parentId = normalizedTargetFolderId;
      await ctx.saveNoteMetadata();
      await ctx.saveReminderFileMarks();
      await ctx.saveFolderMetadata();
    } catch (error) {
      await fs.rename(newPath, oldPath).catch((rollbackError) => {
        console.error('回滚移动文件夹失败:', rollbackError);
      });
      folder.parentId = previousParentId;
      ctx.noteMetadata = previousNoteMetadata;
      ctx.reminderFileMarks = previousReminderMarks;
      ctx.noteFileMap = previousNoteFileMap;
      await Promise.allSettled([
        ctx.saveNoteMetadata(),
        ctx.saveReminderFileMarks(),
        ctx.saveFolderMetadata()
      ]);
      throw error;
    }

    await ctx.loadNotes();
    ctx.scheduleReminderCheck();
    ctx.sendNotesChanged();
    ctx.sendFoldersChanged();
    ctx.sendPdfFilesChanged();
    return ctx.folders.find((item) => item.id === folderId) || folder;
  });
};
