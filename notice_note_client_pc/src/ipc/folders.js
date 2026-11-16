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
    // 回顾目录被移走后就不在笔记根目录下，回顾体系会静默失效（R10）。
    ctx.assertMutableFolder(folder, '移动');
    const movingIds = new Set([folderId]);
    let foundDescendant = true;
    while (foundDescendant) {
      foundDescendant = false;
      for (const item of ctx.folders) {
        if (item.parentId && movingIds.has(item.parentId) && !movingIds.has(item.id)) {
          movingIds.add(item.id);
          foundDescendant = true;
        }
      }
    }
    if (ctx.folders.some((item) => movingIds.has(item.id) && item.isReviewFolder)) {
      throw new Error('不能移动包含回顾目录的文件夹，否则其中的内容会脱离回顾体系');
    }

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
    const previousResourceMetadata = structuredClone(ctx.resourceMetadata);
    // ctx.noteFileMap 现在有 setter，回滚赋值不再被静默忽略。
    const previousNoteFileMap = new Map(ctx.noteFileMap);
    await fs.rename(oldPath, newPath);
    try {
      ctx.moveNoteMetadataTree(oldPath, newPath);
      ctx.moveResourceMetadataTree(
        ctx.resourceMetadata,
        ctx.getNoteMetadataKey(oldPath),
        ctx.getNoteMetadataKey(newPath)
      );
      folder.parentId = normalizedTargetFolderId;
      await Promise.all([
        ctx.saveNoteMetadata(),
        ctx.saveResourceMetadata(),
        ctx.saveFolderMetadata()
      ]);
    } catch (error) {
      await fs.rename(newPath, oldPath).catch((rollbackError) => {
        console.error('回滚移动文件夹失败:', rollbackError);
      });
      folder.parentId = previousParentId;
      ctx.noteMetadata = previousNoteMetadata;
      ctx.resourceMetadata = previousResourceMetadata;
      ctx.noteFileMap = previousNoteFileMap;
      await Promise.allSettled([
        ctx.saveNoteMetadata(),
        ctx.saveResourceMetadata(),
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
