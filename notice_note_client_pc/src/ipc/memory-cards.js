// 记忆卡（SM-2 间隔重复）IPC handler。
// 薄传输层：真正的读写与调度都在 main.js 的领域函数里，这里只转发。
module.exports = function registerMemoryIpc(ctx) {
  const { ipcMain } = ctx;

  ipcMain.handle('memory:list', async () => {
    await ctx.ensureMemoryCardsLoaded();
    return ctx.getMemoryCardSnapshot();
  });
  ipcMain.handle('memory:create', ctx.createMemoryCard);
  ipcMain.handle('memory:update', ctx.updateMemoryCard);
  ipcMain.handle('memory:delete', ctx.deleteMemoryCard);
  ipcMain.handle('memory:review', ctx.reviewMemoryCard);
  ipcMain.handle('memory:filter', ctx.filterMemoryCards);
  ipcMain.handle('memory:settings:update', ctx.updateMemoryCardSettings);

  // AI 判定：作答文本 → 模型四档 → 直接落盘调度
  ipcMain.handle('memory:judge', ctx.judgeMemoryAnswer);
  ipcMain.handle('memory:rejudge', ctx.rejudgeMemoryAnswer);
  // 作答历史：按卡片查、按条目删
  ipcMain.handle('memory:answers:list', ctx.listMemoryAnswers);
  ipcMain.handle('memory:answers:delete', ctx.deleteMemoryAnswer);
  // AI 配置：读写 + 连通性测试
  ipcMain.handle('memory:ai:get', async () => ctx.getAiJudgeSettings());
  ipcMain.handle('memory:ai:update', ctx.updateAiJudgeSettings);
  ipcMain.handle('memory:ai:test', async () => ctx.testAiJudgeConnection());
};
