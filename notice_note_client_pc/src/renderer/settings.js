// 设置弹窗
// 注意：本文件为经典脚本，顶层 const/let 处于页面全局词法环境，跨文件共享；请勿重复声明同名标识符。

function renderStorageInfo() {
  if (!storageInfo) {
    return;
  }
  settingsStoragePath.textContent = storageInfo.notesPath;
  settingsStoragePath.title = storageInfo.notesPath;
  resetStorageButton.disabled = storageInfo.isDefault;
}
// IPC 抛回来的错误带一段 "Error invoking remote method 'xxx': Error: " 前缀，
// 直接显示给用户太吵，统一剥掉。
function cleanSettingsError(error) {
  return String(error?.message || error || "未知错误").replace(
    /^Error invoking remote method '[^']+': (?:[A-Za-z]*Error: )?/,
    "",
  );
}
function renderAiJudgeSettings() {
  if (!aiJudgeEnabledInput) {
    return;
  }
  const settings = aiJudgeSettings || {};
  aiJudgeEnabledInput.checked = settings.enabled !== false;
  aiJudgeBaseUrlInput.value = settings.baseUrl || "";
  aiJudgeModelInput.value = settings.model || "";
  aiJudgeApiKeyInput.value = settings.apiKey || "";
  if (aiJudgeStatus) {
    aiJudgeStatus.textContent = "";
  }
}
async function persistAiJudgeSettings() {
  aiJudgeSettings = await window.noticeNote.updateAiJudgeSettings({
    enabled: Boolean(aiJudgeEnabledInput?.checked),
    baseUrl: aiJudgeBaseUrlInput?.value.trim() || "",
    model: aiJudgeModelInput?.value.trim() || "",
    apiKey: aiJudgeApiKeyInput?.value.trim() || "",
  });
  return aiJudgeSettings;
}
async function saveAiJudgeSettings() {
  if (!saveAiJudgeButton) {
    return;
  }
  saveAiJudgeButton.disabled = true;
  try {
    const saved = await persistAiJudgeSettings();
    if (aiJudgeStatus) {
      aiJudgeStatus.textContent = saved.configured
        ? "已保存"
        : "已保存，但还缺 API Key，暂时不会启用判定";
    }
  } catch (error) {
    if (aiJudgeStatus) {
      aiJudgeStatus.textContent = `保存失败：${cleanSettingsError(error)}`;
    }
  } finally {
    saveAiJudgeButton.disabled = false;
  }
}
async function testAiJudgeConnection() {
  if (!testAiJudgeButton) {
    return;
  }
  testAiJudgeButton.disabled = true;
  if (aiJudgeStatus) {
    aiJudgeStatus.textContent = "正在测试连接...";
  }
  try {
    // 先落盘再测：否则测的是上一次保存的配置，改了 key 却报「连接失败」会很迷惑。
    await persistAiJudgeSettings();
    const result = await window.noticeNote.testAiJudge();
    const label = { again: "重来", hard: "困难", good: "良好", easy: "简单" }[result.rating]
      || result.rating;
    if (aiJudgeStatus) {
      aiJudgeStatus.textContent = `连接正常 · ${result.model} · 测试题判为「${label}」`;
    }
  } catch (error) {
    if (aiJudgeStatus) {
      aiJudgeStatus.textContent = `连接失败：${cleanSettingsError(error)}`;
    }
  } finally {
    testAiJudgeButton.disabled = false;
  }
}
function renderSettings() {
  applyInterfaceTheme(getInterfaceTheme());
  dailyReviewEnabledInput.checked = appSettings?.dailyReviewEnabled !== false;
  dailyReviewCurrentTitle.textContent =
    appSettings?.dailyReviewTitle || "今天暂无可回顾文件";
  renderStorageInfo();
  renderAiJudgeSettings();
}
async function openSettings() {
  if (settingsMainView) settingsMainView.hidden = false;
  if (settingsThemePickerView) settingsThemePickerView.hidden = true;
  if (settingsDialog) settingsDialog.classList.remove("is-picker-view");
  appSettings = await window.noticeNote.getSettings();
  aiJudgeSettings = await window.noticeNote.getAiJudgeSettings();
  renderSettings();
  settingsDialog.showModal();
}
