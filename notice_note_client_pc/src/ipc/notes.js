// 笔记相关 IPC handler（薄传输层：通过 ctx 访问 main.js 的状态与领域函数）
module.exports = function registerNotesIpc(ctx) {
  const { ipcMain, fs, path } = ctx;

  ipcMain.handle('notes:list', () => ctx.getVisibleNotes());
  ipcMain.handle('library:refresh', async () => {
    await ctx.loadNotes();
    ctx.scheduleReminderCheck();
    return {
      notes: ctx.getVisibleNotes(),
      folders: ctx.getVisibleFolders(),
      pdfFiles: ctx.getVisiblePdfFiles(),
      resourceFiles: ctx.getVisibleResourceFiles()
    };
  });
  ipcMain.handle('notes:save', async (event, input) => ctx.createClientNote(await ctx.upsertNote(event, input)));
  ipcMain.handle('notes:delete', async (event, noteId) => {
    await ctx.deleteNote(event, noteId);
    return ctx.getVisibleNotes();
  });
  ipcMain.handle('notes:create', async (_event, folderId) => {
    const normalizedFolderId = folderId || null;
    ctx.assertFolderTargetAccessible(normalizedFolderId);
    const note = ctx.createEmptyNote();
    note.folderId = normalizedFolderId;
    note.isReviewFile = ctx.isReviewFolderId(normalizedFolderId);
    await ctx.saveNote(note);
    ctx.notes.unshift(note);
    ctx.sortNotesByCreatedAt();
    ctx.sendNotesChanged();
    return ctx.createClientNote(note);
  });
  ipcMain.handle('notes:move', async (_event, noteId, folderId) => {
    const note = ctx.notes.find(n => n.id === noteId);
    if (!note) throw new Error('笔记不存在');
    ctx.assertFolderAccessible(note.folderId);
    const normalizedFolderId = folderId || null;
    ctx.assertFolderTargetAccessible(normalizedFolderId);
    if ((note.folderId || null) === normalizedFolderId) {
      return ctx.createClientNote(note);
    }

    const oldPath = ctx.noteFileMap.get(noteId);
    let newPath = null;
    if (oldPath) {
      const targetDir = ctx.getFolderPath(normalizedFolderId);
      await fs.mkdir(targetDir, { recursive: true });
      const baseName = ctx.sanitizeNoteFilename(note.title);
      const extension = ctx.getNoteFileExtension(note.fileType);
      newPath = await ctx.getUniqueFilePath(targetDir, baseName, extension);
      await fs.rename(oldPath, newPath);
      ctx.noteFileMap.set(noteId, newPath);
      ctx.moveNoteMetadata(oldPath, newPath);
    }

    const movedNote = {
      ...note,
      folderId: normalizedFolderId,
      updatedAt: new Date().toISOString()
    };
    try {
      await ctx.saveNote(movedNote);
    } catch (error) {
      if (oldPath && newPath) {
        try {
          await fs.rename(newPath, oldPath);
          ctx.noteFileMap.set(noteId, oldPath);
          ctx.moveNoteMetadata(newPath, oldPath);
        } catch (rollbackError) {
          console.error('回滚移动笔记失败:', rollbackError);
        }
      }
      throw error;
    }
    Object.assign(note, movedNote);
    ctx.sendNotesChanged();
    return ctx.createClientNote(note);
  });
};
