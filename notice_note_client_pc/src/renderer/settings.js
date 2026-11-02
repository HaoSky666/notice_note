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
function renderSettings() {
  applyInterfaceTheme(getInterfaceTheme());
  dailyReviewEnabledInput.checked = appSettings?.dailyReviewEnabled !== false;
  dailyReviewCurrentTitle.textContent =
    appSettings?.dailyReviewTitle || "今天暂无可回顾文件";
  renderStorageInfo();
}
async function openSettings() {
  if (settingsMainView) settingsMainView.hidden = false;
  if (settingsThemePickerView) settingsThemePickerView.hidden = true;
  if (settingsDialog) settingsDialog.classList.remove("is-picker-view");
  appSettings = await window.noticeNote.getSettings();
  renderSettings();
  settingsDialog.showModal();
}
