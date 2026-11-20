// 手机端设置面板（经典脚本，全局函数以 mset 开头）。
// 两块：局域网同步（配对/断开/立即同步）与 AI 判定配置（Key 只存手机本机）。
const msettingsDialog = document.querySelector('#msettingsDialog');
const msetHostInput = document.querySelector('#msetHostInput');
const msetCodeInput = document.querySelector('#msetCodeInput');
const msetPairButton = document.querySelector('#msetPairButton');
const msetUnpairButton = document.querySelector('#msetUnpairButton');
const msetSyncButton = document.querySelector('#msetSyncButton');
const msetSyncStatus = document.querySelector('#msetSyncStatus');
const msetAiEnabledInput = document.querySelector('#msetAiEnabledInput');
const msetAiBaseUrlInput = document.querySelector('#msetAiBaseUrlInput');
const msetAiModelInput = document.querySelector('#msetAiModelInput');
const msetAiKeyInput = document.querySelector('#msetAiKeyInput');
const msetAiSaveButton = document.querySelector('#msetAiSaveButton');
const msetAiStatus = document.querySelector('#msetAiStatus');
const msetThemeList = document.querySelector('#msetThemeList');
const closeMsettingsButton = document.querySelector('#closeMsettingsButton');
const syncProgress = document.querySelector('#syncProgress');
const syncProgressText = document.querySelector('#syncProgressText');
const syncProgressCloseButton = document.querySelector('#syncProgressCloseButton');

function msetRender() {
  // 主题卡片每次都按当前选择重画，点击后立即换色并更新「✓ 当前应用」
  NoticeNoteThemes.renderPicker(msetThemeList);

  const connection = NoticeNoteStore.getConnection();
  if (msetSyncStatus) {
    msetSyncStatus.textContent = connection
      ? `已配对 ${connection.serverName || 'Notice Note'}（${connection.host}）${connection.lastSyncAt ? ` · 上次同步 ${formatDateTime(connection.lastSyncAt)}` : ' · 还没同步过'}`
      : '未配对。手机和电脑连同一个 WiFi，在电脑端「设置 → 局域网同步」生成配对码。';
  }
  if (msetHostInput && connection?.host && !msetHostInput.value) {
    msetHostInput.value = connection.host;
  }
  if (msetPairButton) {
    msetPairButton.textContent = connection ? '重新配对' : '配对';
  }
  if (msetUnpairButton) {
    msetUnpairButton.hidden = !connection;
  }
  if (msetSyncButton) {
    msetSyncButton.disabled = !connection;
  }

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

function msetShowProgress(text) {
  if (syncProgress) {
    syncProgress.hidden = false;
  }
  if (syncProgressText) {
    syncProgressText.textContent = text;
  }
  if (syncProgressCloseButton) {
    syncProgressCloseButton.hidden = true;
  }
}

function msetHideProgress() {
  if (syncProgress) {
    syncProgress.hidden = true;
  }
}

async function msetRunSync() {
  const connection = NoticeNoteStore.getConnection();
  if (!connection) {
    msetOpen();
    return;
  }
  if (msetSyncButton) {
    msetSyncButton.disabled = true;
  }
  if (syncButton) {
    syncButton.disabled = true;
  }
  msetShowProgress('正在同步...');
  try {
    const result = await syncNow((stage, detail) => {
      msetShowProgress(detail || '正在同步...');
    });
    msetHideProgress();
    if (msetSyncStatus) {
      msetSyncStatus.textContent = `同步完成：${result.noteCount} 篇笔记 · ${result.resourceCount} 个资料 · 下载 ${result.assetDownloads} 个附件${result.pushed ? ' · 已回传复习进度' : ''}`;
    }
    msetRender();
  } catch (error) {
    if (syncProgressText) {
      syncProgressText.textContent = `同步失败：${error.message || '网络错误'}`;
    }
    if (syncProgressCloseButton) {
      syncProgressCloseButton.hidden = false;
    }
    msetRender();
  } finally {
    if (msetSyncButton) {
      msetSyncButton.disabled = !NoticeNoteStore.getConnection();
    }
    if (syncButton) {
      syncButton.disabled = false;
    }
  }
}

msetPairButton?.addEventListener('click', async () => {
  const host = String(msetHostInput?.value || '').trim();
  const code = String(msetCodeInput?.value || '').trim();
  if (!host || !code) {
    if (msetSyncStatus) {
      msetSyncStatus.textContent = '请填写电脑内网 IP 和 6 位配对码';
    }
    return;
  }
  msetPairButton.disabled = true;
  if (msetSyncStatus) {
    msetSyncStatus.textContent = '正在配对...';
  }
  try {
    const device = /Android/i.test(navigator.userAgent) ? 'Android 手机' : '浏览器调试';
    const connection = await syncPair(host, code, device);
    if (msetCodeInput) {
      msetCodeInput.value = '';
    }
    if (msetSyncStatus) {
      msetSyncStatus.textContent = `配对成功：${connection.serverName}。点「立即同步」拉取内容。`;
    }
    msetRender();
  } catch (error) {
    if (msetSyncStatus) {
      msetSyncStatus.textContent = `配对失败：${error.message || '网络错误'}。确认同一 WiFi、电脑端已开启同步并生成配对码。`;
    }
  } finally {
    msetPairButton.disabled = false;
  }
});

msetUnpairButton?.addEventListener('click', () => {
  NoticeNoteStore.saveConnection(null);
  msetRender();
});

msetSyncButton?.addEventListener('click', () => {
  msetRunSync();
});

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

syncProgressCloseButton?.addEventListener('click', msetHideProgress);

// 设置面板第一次打开前就把主题卡片铺好：renderPicker 只动主题区，不依赖同步状态
NoticeNoteThemes.renderPicker(msetThemeList);