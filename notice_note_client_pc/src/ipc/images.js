// 图片相关 IPC handler（插入、粘贴、远程下载、复制、删除）
module.exports = function registerImagesIpc(ctx) {
  const { ipcMain, fs, path, fileURLToPath, shell, nativeImage } = ctx;
  const { IMAGE_ASSET_DIR_NAME } = ctx;

  ipcMain.handle('images:insert', ctx.insertImageForNote);
  ipcMain.handle('images:save-pasted', async (_event, payload) => {
    if (!payload || !payload.noteId) {
      return null;
    }

    return ctx.saveClipboardImageForNote(payload.noteId, payload.image);
  });
  ipcMain.handle('images:save-from-url', async (_event, payload) => {
    if (!payload || !payload.noteId || !payload.imageUrl) {
      return null;
    }

    ctx.getAccessibleNote(payload.noteId);
    const { buffer, contentType } = await ctx.downloadRemoteImage(payload.imageUrl);
    return ctx.saveClipboardImageForNote(payload.noteId, {
      fileName: `remote-image${ctx.getImageExtension('', contentType)}`,
      mimeType: contentType,
      bytes: buffer
    });
  });
  ipcMain.handle('images:copy', async (_event, payload) => {
    if (!payload || !payload.imageUrl) {
      return false;
    }
    try {
      let filePath;
      if (payload.imageUrl.startsWith('file:')) {
        filePath = fileURLToPath(payload.imageUrl);
      } else {
        return false;
      }
      const imageAssetRoot = path.resolve(ctx.getAppDataPath(), IMAGE_ASSET_DIR_NAME);
      const resolvedFilePath = path.resolve(filePath);
      if (!ctx.isPathInside(imageAssetRoot, resolvedFilePath)) {
        const resource = ctx.resourceFiles.find((item) => path.resolve(item.path) === resolvedFilePath);
        if (!resource || resource.kind !== 'image') {
          return false;
        }
        ctx.assertFolderAccessible(resource.folderId);
      }
      const imageBuffer = await fs.readFile(filePath);
      const img = nativeImage.createFromBuffer(imageBuffer);
      ctx.clipboard.writeImage(img);
      return true;
    } catch (error) {
      console.error('复制图片失败:', error);
      return false;
    }
  });
  ipcMain.handle('images:delete', async (_event, payload) => {
    if (!payload || !payload.imageUrl || !payload.noteId) {
      return false;
    }
    try {
      ctx.getAccessibleNote(payload.noteId);
      if (ctx.notes.some((note) => note.id !== payload.noteId && note.content.includes(payload.imageUrl))) {
        throw new Error('该图片仍被其他笔记引用，已保留图片文件');
      }
      let filePath;
      if (payload.imageUrl.startsWith('file:')) {
        filePath = fileURLToPath(payload.imageUrl);
      } else {
        return false;
      }
      const imageAssetRoot = path.resolve(ctx.getAppDataPath(), IMAGE_ASSET_DIR_NAME);
      if (!ctx.isPathInside(imageAssetRoot, path.resolve(filePath))) {
        return false;
      }
      await shell.trashItem(filePath);
      return true;
    } catch (error) {
      console.error('删除图片失败:', error);
      return false;
    }
  });
};
