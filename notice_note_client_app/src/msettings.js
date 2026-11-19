// 手机端设置面板（经典脚本，全局函数以 mset 开头）。
// 目前只有一块：AI 判定配置（Key 只存手机本机，不从 PC 同步）。
const msettingsDialog = document.querySelector('#msettingsDialog');
const msetAiEnabledInput = document.querySelector('#msetAiEnabledInput');
const msetAiBaseUrlInput = document.querySelector('#msetAiBaseUrlInput');
const msetAiModelInput = document.querySelector('#msetAiModelInput');
const msetAiKeyInput = document.querySelector('#msetAiKeyInput');
const msetAiSaveButton = document.querySelector('#msetAiSaveButton');
const msetAiStatus = document.querySelector('#msetAiStatus');
const closeMsettingsButton = document.querySelector('#closeMsettingsButton');

function msetRender() {
  const cfg = NoticeNoteStore.getAiConfig();
  if (msetAiEnabledInput) {
    msetAiEnabledInput.checked = cfg.enabled;
  }
  if (msetAiBaseUrlInput && !msetAiBaseUrlInput.value) {
    msetAiBaseUrlInput.value = cfg.baseUrl;
  }
  if (msetAiModelInput && !msetAiModelInput.value) {
    msetAiModelInput.value = cfg.model;
  }
  if (msetAiKeyInput && !msetAiKeyInput.value) {
    msetAiKeyInput.value = cfg.apiKey;
  }
  if (msetAiStatus) {
    msetAiStatus.textContent = NoticeNoteAiJudge.isAiJudgeConfigured(cfg)
      ? 'AI 判定已配置，作答后自动判档；失败时退回手动。'
      : '未配置 AI：复习时手动四档评分。Key 只保存在手机本机。';
  }
}

function msetOpen() {
  msetRender();
  if (typeof msettingsDialog.showModal === 'function') {
    msettingsDialog.showModal();
  } else {
    msettingsDialog.setAttribute('open', '');
  }
}

msetAiSaveButton?.addEventListener('click', () => {
  const cfg = NoticeNoteStore.saveAiConfig({
    enabled: msetAiEnabledInput?.checked !== false,
    baseUrl: msetAiBaseUrlInput?.value || '',
    model: msetAiModelInput?.value || '',
    apiKey: msetAiKeyInput?.value || ''
  });
  if (msetAiStatus) {
    msetAiStatus.textContent = NoticeNoteAiJudge.isAiJudgeConfigured(cfg)
      ? '已保存。AI 判定已启用。'
      : '已保存。配置不完整，复习时仍用手动评分。';
  }
});

closeMsettingsButton?.addEventListener('click', () => {
  msettingsDialog.close();
});