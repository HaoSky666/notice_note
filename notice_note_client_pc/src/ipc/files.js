// 资源文件（PDF / Word / Excel 等）相关 IPC handler
module.exports = function registerFilesIpc(ctx) {
  const { ipcMain, fs } = ctx;

  ipcMain.handle('pdfs:list', () => ctx.getVisiblePdfFiles());
  ipcMain.handle('files:list', () => ctx.getVisibleResourceFiles());
  ipcMain.handle('files:preview', (_event, fileId) => ctx.previewResourceFile(fileId));
  ipcMain.handle('files:delete', ctx.deleteResourceFile);
  ipcMain.handle('files:move', ctx.moveResourceFile);
  ipcMain.handle('pdfs:read', async (_event, pdfId) => {
    const pdf = ctx.pdfFiles.find((item) => item.id === pdfId);
    if (!pdf) {
      throw new Error('PDF 文件不存在');
    }
    ctx.assertFolderAccessible(pdf.folderId);

    const buffer = await fs.readFile(pdf.path);
    return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  });
};
