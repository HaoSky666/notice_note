const contentPanel = document.querySelector('#contentPanel');
const importPackageButton = document.querySelector('#importPackageButton');
const packageFileInput = document.querySelector('#packageFileInput');
const msettingsButton = document.querySelector('#msettingsButton');
const searchInput = document.querySelector('#searchInput');
const pathBar = document.querySelector('#pathBar');
const statusText = document.querySelector('#statusText');
const noteList = document.querySelector('#noteList');
const noteDetailPanel = document.querySelector('#noteDetailPanel');
const noteBackButton = document.querySelector('#noteBackButton');
const noteFolder = document.querySelector('#noteFolder');
const noteView = document.querySelector('#noteView');
const noteTitle = document.querySelector('#noteTitle');
const noteContent = document.querySelector('#noteContent');
const imageLightbox = document.querySelector('#imageLightbox');
const imageLightboxStage = document.querySelector('#imageLightboxStage');
const imageLightboxImage = document.querySelector('#imageLightboxImage');
const closeImageLightboxButton = document.querySelector('#closeImageLightboxButton');
const zoomOutImageLightboxButton = document.querySelector('#zoomOutImageLightboxButton');
const zoomInImageLightboxButton = document.querySelector('#zoomInImageLightboxButton');

// 纯函数工具由 index.html 在本脚本之前引入的 lib/mobile-utils.js 提供（UMD 挂到 window）。
// 这里统一复用，避免 app.js 内再复制一份校验 / 规划 / 糊住 / 转义逻辑。
const {
  MOBILE_PACKAGE_MAGIC,
  MOBILE_PACKAGE_HEADER_SIZE,
  MOBILE_PACKAGE_VERSION,
  validateMobilePackage,
  planMobileAssets,
  computeUnusedAssetKeys,
  normalizeMobileFolder,
  splitClozeSegments,
  escapeHtml,
  isPreviewableResourceMime
} = window.NoticeNoteMobileUtils;

const NAVIGATION_STATE_KEY = 'notice-note-mobile-state';
// 数据库、附件 URL 缓存、待回传变更统一由 store.js（NoticeNoteStore）管理，
// 这里复用同一份实例，日历/回顾/记忆 Tab 与同步客户端也从那里取数据。
const SNAPSHOT_STORE = NoticeNoteStore.SNAPSHOT_STORE;
const ASSET_STORE = NoticeNoteStore.ASSET_STORE;
let library = null;
let currentFolderId = null;
let isApplyingNavigationState = false;
let exitPromptExpiresAt = 0;
let exitPromptTimer = null;
let activeNote = null;
let isHandlingSystemBack = false;
let hasQueuedSystemBack = false;
let isMobileSessionSuspended = false;
let mobileResumePromise = null;
let isMobileAppActive = true;
let searchTimer = null;
let libraryRequestId = 0;
const offlineAssetUrls = NoticeNoteStore.assetUrls;

const exitPromptToast = document.createElement('div');
exitPromptToast.className = 'exit-toast';
exitPromptToast.setAttribute('role', 'status');
exitPromptToast.setAttribute('aria-live', 'polite');
document.body.append(exitPromptToast);

let imageLightboxPreviousFocus = null;
let imageLightboxZoom = 1;
const IMAGE_LIGHTBOX_MIN_ZOOM = 0.25;
const IMAGE_LIGHTBOX_MAX_ZOOM = 5;

function updateImageLightboxZoomControls() {
  const canZoom = Number(imageLightboxImage.dataset.baseWidth) > 0;
  zoomOutImageLightboxButton.disabled = !canZoom || imageLightboxZoom <= IMAGE_LIGHTBOX_MIN_ZOOM;
  zoomInImageLightboxButton.disabled = !canZoom || imageLightboxZoom >= IMAGE_LIGHTBOX_MAX_ZOOM;
}

function resetImageLightboxZoom() {
  imageLightboxZoom = 1;
  delete imageLightboxImage.dataset.baseWidth;
  delete imageLightboxImage.dataset.baseHeight;
  imageLightboxImage.style.width = '';
  imageLightboxImage.style.height = '';
  imageLightboxImage.style.maxWidth = '';
  imageLightboxImage.style.maxHeight = '';
  imageLightboxStage.scrollTop = 0;
  imageLightboxStage.scrollLeft = 0;
  updateImageLightboxZoomControls();
}

function captureImageLightboxBaseSize() {
  const rect = imageLightboxImage.getBoundingClientRect();
  if (!rect.width || !rect.height) {
    return;
  }
  imageLightboxImage.dataset.baseWidth = String(rect.width);
  imageLightboxImage.dataset.baseHeight = String(rect.height);
  updateImageLightboxZoomControls();
}

function changeImageLightboxZoom(step) {
  const baseWidth = Number(imageLightboxImage.dataset.baseWidth);
  const baseHeight = Number(imageLightboxImage.dataset.baseHeight);
  if (!baseWidth || !baseHeight) {
    return;
  }
  const nextZoom = Math.min(
    IMAGE_LIGHTBOX_MAX_ZOOM,
    Math.max(IMAGE_LIGHTBOX_MIN_ZOOM, imageLightboxZoom + step)
  );
  if (nextZoom === imageLightboxZoom) {
    return;
  }
  imageLightboxZoom = nextZoom;
  imageLightboxImage.style.maxWidth = 'none';
  imageLightboxImage.style.maxHeight = 'none';
  imageLightboxImage.style.width = `${baseWidth * imageLightboxZoom}px`;
  imageLightboxImage.style.height = `${baseHeight * imageLightboxZoom}px`;
  updateImageLightboxZoomControls();
}

function openImageLightbox(image) {
  const src = image.currentSrc || image.src;
  if (!src) {
    return;
  }
  imageLightboxPreviousFocus = document.activeElement;
  resetImageLightboxZoom();
  imageLightboxImage.src = src;
  imageLightboxImage.alt = image.alt || '图片预览';
  imageLightbox.hidden = false;
  document.body.classList.add('image-lightbox-open');
  if (imageLightboxImage.complete) {
    captureImageLightboxBaseSize();
  } else {
    imageLightboxImage.addEventListener('load', captureImageLightboxBaseSize, { once: true });
  }
  closeImageLightboxButton.focus();
}

function closeImageLightbox() {
  if (imageLightbox.hidden) {
    return;
  }
  imageLightbox.hidden = true;
  resetImageLightboxZoom();
  imageLightboxImage.removeAttribute('src');
  imageLightboxImage.alt = '';
  document.body.classList.remove('image-lightbox-open');
  if (imageLightboxPreviousFocus?.isConnected) {
    imageLightboxPreviousFocus.focus();
  }
  imageLightboxPreviousFocus = null;
}

function openOfflineDatabase() {
  return NoticeNoteStore.openDatabase();
}

async function readOfflineValue(storeName, key) {
  return NoticeNoteStore.readValue(storeName, key);
}

// 导入已改为「整包预校验 + 单个跨 store 事务」，事务执行统一在 store.runAssetTransaction。
async function loadOfflineSnapshot() {
  return NoticeNoteStore.loadSnapshot();
}

// 离线包格式常量与 validateMobilePackage 已迁移到 lib/mobile-utils.js（见文件顶部解构）。

function showContentPanel() {
  contentPanel.hidden = false;
  noteDetailPanel.hidden = true;
}

function showNoteDetailPanel() {
  contentPanel.hidden = true;
  noteDetailPanel.hidden = false;
}

async function readMobilePackageManifest(file) {
  if (file.size < MOBILE_PACKAGE_HEADER_SIZE) {
    throw new Error('文件不是有效的 Notice Note 手机离线包');
  }
  const headerBytes = await file.slice(0, MOBILE_PACKAGE_HEADER_SIZE).arrayBuffer();
  const magic = new TextDecoder('ascii').decode(headerBytes.slice(0, 8));
  const header = new DataView(headerBytes);
  const version = header.getUint32(8, true);
  const manifestSize = header.getUint32(12, true);
  if (magic !== MOBILE_PACKAGE_MAGIC || version !== MOBILE_PACKAGE_VERSION
    || manifestSize < 1 || MOBILE_PACKAGE_HEADER_SIZE + manifestSize > file.size) {
    throw new Error('文件不是有效的 Notice Note 手机离线包');
  }
  const manifestBytes = await file
    .slice(MOBILE_PACKAGE_HEADER_SIZE, MOBILE_PACKAGE_HEADER_SIZE + manifestSize)
    .arrayBuffer();
  const packageData = JSON.parse(new TextDecoder().decode(manifestBytes));
  return {
    snapshot: validateMobilePackage(packageData),
    assetOffset: MOBILE_PACKAGE_HEADER_SIZE + manifestSize
  };
}

async function importMobilePackage(file) {
  importPackageButton.disabled = true;
  statusText.textContent = '正在读取离线包...';
  try {
    const { snapshot, assetOffset } = await readMobilePackageManifest(file);
    // a) 在写任何东西之前完成整包预校验，拿到完整的资产写入计划。
    //    任何一条资产不合法都会在规划阶段抛错，不会产生部分写入。
    const plan = planMobileAssets(snapshot, file.size, assetOffset);

    // 事务外读旧 snapshot，算出本次需要清理的旧资产（新包不再引用的 key）。
    const previousSnapshot = await readOfflineValue(SNAPSHOT_STORE, 'current');
    const previousSources = (previousSnapshot?.assets || []).map((asset) => asset.source);
    const nextSources = plan.map((item) => item.source);
    const unusedKeys = computeUnusedAssetKeys(previousSources, new Set(nextSources));

    // b) 所有资产写入 + snapshot 写入 + 旧资产清理放进同一个跨 store 事务。
    //    任一步失败事务自动回滚，旧 snapshot 引用的附件不会被新包部分覆盖。
    statusText.textContent = '正在写入离线包...';
    await NoticeNoteStore.runAssetTransaction({
      puts: plan.map((item) => ({
        key: item.source,
        blob: file.slice(item.start, item.end, item.mimeType)
      })),
      removedKeys: unusedKeys,
      snapshot
    });

    library = await loadOfflineSnapshot();
    NoticeNoteStore.setLibrary(library);
    currentFolderId = null;
    searchInput.value = '';
    renderLibrary();
    NoticeNoteStore.notifyLibraryChanged();
  } catch (error) {
    const cachedSnapshot = await loadOfflineSnapshot().catch(() => null);
    if (cachedSnapshot) {
      library = cachedSnapshot;
      renderLibrary();
      statusText.textContent = `${error.message} · 导入失败，已保留上次导入内容`;
    } else {
      renderDisconnectedState(error.message);
    }
    throw error;
  } finally {
    importPackageButton.disabled = false;
    packageFileInput.value = '';
  }
}

function createListNavigationState() {
  return {
    key: NAVIGATION_STATE_KEY,
    view: 'list',
    folderId: currentFolderId
  };
}

function createNoteNavigationState(noteId) {
  return {
    key: NAVIGATION_STATE_KEY,
    view: 'note',
    folderId: currentFolderId,
    noteId
  };
}

function createExitGuardState() {
  return {
    key: NAVIGATION_STATE_KEY,
    view: 'exit-guard'
  };
}

function isMobileNavigationState(state) {
  return state?.key === NAVIGATION_STATE_KEY;
}

function isAtRootList() {
  return !currentFolderId && noteDetailPanel.hidden;
}

function replaceNavigationState(state = createListNavigationState()) {
  window.history.replaceState(state, document.title);
}

function pushNavigationState(state = createListNavigationState()) {
  if (isApplyingNavigationState) {
    return;
  }
  window.history.pushState(state, document.title);
}

function installNavigationHistory() {
  replaceNavigationState(createExitGuardState());
  window.history.pushState(createListNavigationState(), document.title);
}

function showExitPrompt() {
  exitPromptExpiresAt = Date.now() + 1800;
  exitPromptToast.textContent = '再按一次返回退出';
  exitPromptToast.classList.add('show');
  clearTimeout(exitPromptTimer);
  exitPromptTimer = setTimeout(() => {
    exitPromptToast.classList.remove('show');
  }, 1800);
}

function leaveAppOrPage() {
  if (window.NoticeNoteAndroid?.exitApp) {
    window.NoticeNoteAndroid.exitApp();
    return;
  }
  const appPlugin = window.Capacitor?.Plugins?.App;
  if (appPlugin?.exitApp) {
    appPlugin.exitApp();
    return;
  }
  if (navigator.app?.exitApp) {
    navigator.app.exitApp();
    return;
  }
  window.history.back();
}

function navigateToParentFolder() {
  const folder = getFolderById(currentFolderId);
  return openFolder(folder?.parentId || null, { pushHistory: false });
}

async function performMobileSystemBack() {
  // 其他 Tab / 设置面板优先消费返回键（回到笔记 Tab、关面板），再走笔记导航逻辑。
  if (window.NoticeNoteTabs?.handleBack()) {
    return;
  }

  if (!imageLightbox.hidden) {
    closeImageLightbox();
    return;
  }

  if (!noteDetailPanel.hidden) {
    activeNote = null;
    showContentPanel();
    renderLibrary();
    replaceNavigationState(createListNavigationState());
    return;
  }

  if (currentFolderId) {
    await navigateToParentFolder();
    replaceNavigationState(createListNavigationState());
    return;
  }

  if (Date.now() < exitPromptExpiresAt) {
    leaveAppOrPage();
    return;
  }

  showExitPrompt();
}

function handleMobileSystemBack() {
  if (isHandlingSystemBack) {
    hasQueuedSystemBack = true;
    return;
  }

  isHandlingSystemBack = true;
  Promise.resolve(performMobileSystemBack())
    .catch((error) => {
      statusText.textContent = error.message || '返回操作失败';
    })
    .finally(() => {
      isHandlingSystemBack = false;
      if (hasQueuedSystemBack) {
        hasQueuedSystemBack = false;
        handleMobileSystemBack();
      }
    });
}

function clearSensitiveMobileState() {
  closeImageLightbox();
  isHandlingSystemBack = false;
  hasQueuedSystemBack = false;
  exitPromptExpiresAt = 0;
  exitPromptToast.classList.remove('show');
}

function suspendMobileSession() {
  if (isMobileSessionSuspended) {
    return;
  }

  isMobileSessionSuspended = true;
  clearSensitiveMobileState();
}

function resumeMobileSession() {
  if (!isMobileSessionSuspended || !isMobileAppActive || mobileResumePromise) {
    return;
  }

  isMobileSessionSuspended = false;
  mobileResumePromise = loadLibrary()
    .catch((error) => {
      renderDisconnectedState(error.message || '读取本地文件失败');
    })
    .finally(() => {
      mobileResumePromise = null;
      if (isMobileSessionSuspended && isMobileAppActive) {
        resumeMobileSession();
      }
    });
}

function handleMobileAppStateChange({ isActive }) {
  isMobileAppActive = Boolean(isActive);
  if (isActive) {
    resumeMobileSession();
    return;
  }
  suspendMobileSession();
}

async function installNativeAppHandlers() {
  const appPlugin = window.Capacitor?.Plugins?.App;
  window.addEventListener('notice-note-mobile-back', handleMobileSystemBack);
  if (!appPlugin?.addListener) {
    document.addEventListener('visibilitychange', () => {
      handleMobileAppStateChange({ isActive: !document.hidden });
    });
    return;
  }

  try {
    if (!window.NoticeNoteAndroid) {
      await appPlugin.addListener('backButton', handleMobileSystemBack);
    }
    await appPlugin.addListener('appStateChange', handleMobileAppStateChange);
  } catch (error) {
    console.warn('注册原生应用监听失败:', error.message);
  }
}

async function setCurrentFolder(folderId, options = {}) {
  const { pushHistory = true, resetSearch = true } = options;
  currentFolderId = folderId || null;
  if (resetSearch) {
    searchInput.value = '';
  }
  await loadLibrary();
  if (pushHistory) {
    pushNavigationState(createListNavigationState());
  }
}

function applyNavigationState(state) {
  if (!isMobileNavigationState(state)) {
    return;
  }

  if (state.view === 'exit-guard') {
    if (isAtRootList() && Date.now() < exitPromptExpiresAt) {
      leaveAppOrPage();
      return;
    }
    showContentPanel();
    currentFolderId = null;
    searchInput.value = '';
    loadLibrary().catch((error) => {
      statusText.textContent = error.message || '读取本地文件失败';
    });
    showExitPrompt();
    window.history.pushState(createListNavigationState(), document.title);
    return;
  }

  isApplyingNavigationState = true;
  if (state.view === 'note' && state.noteId) {
    currentFolderId = state.folderId || null;
    openNote(state.noteId, { pushHistory: false }).catch((error) => {
      showContentPanel();
      statusText.textContent = error.message || '读取本地文件失败';
    }).finally(() => {
      isApplyingNavigationState = false;
    });
    return;
  }

  showContentPanel();
  const targetFolderId = state.folderId || null;
  const targetFolder = targetFolderId ? getFolderById(targetFolderId) : null;
  // 手机端离线包是明文、没有真正的锁：normalizeMobileFolder 已把 isUnlocked 恒置 false，
  // unlockFolder 也不再校验密码、恒返回 true。这里让 isProtected 目录复用统一的 openFolder
  // 导航流程，行为上等价于不拦截（直接进入该目录），并不是还有一道密码锁。
  if (targetFolder?.isProtected) {
    isApplyingNavigationState = true;
    openFolder(targetFolderId, { pushHistory: false }).then((opened) => {
      if (!opened) {
        return setCurrentFolder(null, { pushHistory: false });
      }
    }).finally(() => {
      isApplyingNavigationState = false;
    });
    return;
  }
  currentFolderId = targetFolderId;
  loadLibrary().catch((error) => {
    statusText.textContent = error.message || '读取本地文件失败';
  }).finally(() => {
    isApplyingNavigationState = false;
  });
}

async function unlockFolder(folderId) {
  // 手机端离线包始终是明文：密码目录的内容已随包一起导入，没有密码校验、也没有「解锁」状态。
  // 保留 folderId 参数与既有调用点，仅为统一导航流程，直接进入即可。
  return true;
}

async function relockFoldersOnNavigate(targetFolderId) {
  return targetFolderId;
}

async function openFolder(folderId, options = {}) {
  const { pushHistory = true, resetSearch = true } = options;
  await relockFoldersOnNavigate(folderId);
  if (folderId) {
    const unlocked = await unlockFolder(folderId);
    if (!unlocked) {
      return false;
    }
  }
  await setCurrentFolder(folderId, { pushHistory, resetSearch });
  return true;
}

function formatDateTime(value) {
  if (!value) {
    return '未知时间';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, '&#96;');
}

function isSafeUrl(value) {
  return /^(https?:|mailto:|tel:|file:|data:|blob:|\/|#)/i.test(String(value || '').trim());
}

function resolveImageUrl(url) {
  const trimmed = String(url || '').trim();
  if (!trimmed) {
    return '';
  }
  if (trimmed.startsWith('mobile-image://')) {
    const relPath = trimmed.slice('mobile-image://'.length);
    return offlineAssetUrls.get(decodeURIComponent(relPath)) || '';
  }
  return trimmed;
}

function renderInlineMarkdown(text) {
  const placeholders = [];
  let value = escapeHtml(text);

  // {{ ... }} 糊住块优先抽成占位符：与 PC 一致的「视觉遮挡、点击展开」语义。
  // 抽离后真实内容只存在于 placeholders 里，不会被后续代码/链接/粗体/斜体正则二次改写。
  // splitClozeSegments 跑在已 escapeHtml 的文本上，{{ }} 不跨行（与 PC 一致）。
  const clozeParts = [];
  for (const segment of splitClozeSegments(value)) {
    if (segment.type === 'cloze') {
      const key = `\u0000${placeholders.length}\u0000`;
      // segment.value 已 HTML 转义，只需补转义反引号（不重复 escapeHtml，避免实体被二次转义）。
      const content = segment.value.replace(/`/g, '&#96;');
      placeholders.push(`<span class="cloze" data-cloze="${content}" role="button" tabindex="0">点击查看</span>`);
      clozeParts.push(key);
    } else {
      clozeParts.push(segment.value);
    }
  }
  value = clozeParts.join('');

  value = value.replace(/`([^`]+)`/g, (_match, code) => {
    const key = `\u0000${placeholders.length}\u0000`;
    placeholders.push(`<code>${code}</code>`);
    return key;
  });

  value = value.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_match, alt, url) => {
    const key = `\u0000${placeholders.length}\u0000`;
    if (url.startsWith('mobile-image://')) {
      const resolvedUrl = resolveImageUrl(url);
      placeholders.push(`<img src="${escapeAttribute(resolvedUrl)}" alt="${escapeAttribute(alt)}" loading="lazy">`);
      return key;
    }
    const resolvedUrl = resolveImageUrl(url);
    const safeUrl = isSafeUrl(resolvedUrl) ? escapeAttribute(resolvedUrl) : '';
    placeholders.push(safeUrl
      ? `<img src="${safeUrl}" alt="${escapeAttribute(alt)}" loading="lazy">`
      : escapeHtml(alt));
    return key;
  });

  value = value.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label, url) => {
    const safeUrl = isSafeUrl(url) ? escapeAttribute(url) : '';
    return safeUrl ? `<a href="${safeUrl}" target="_blank" rel="noreferrer">${label}</a>` : label;
  });

  value = value
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(?<![a-zA-Z0-9])__([^_]+?)__(?![a-zA-Z0-9])/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/(?<![a-zA-Z0-9])_([^_]+?)_(?![a-zA-Z0-9])/g, '<em>$1</em>')
    .replace(/~~([^~]+)~~/g, '<del>$1</del>');

  return value.replace(/\u0000(\d+)\u0000/g, (_match, index) => placeholders[Number(index)] || '');
}

function renderTable(lines) {
  const rows = lines.map((line) => {
    return line.trim()
      .replace(/^\|/, '')
      .replace(/\|$/, '')
      .split('|')
      .map((cell) => cell.trim());
  });
  const header = rows[0] || [];
  const body = rows.slice(2);
  const headerHtml = header.map((cell) => `<th>${renderInlineMarkdown(cell)}</th>`).join('');
  const bodyHtml = body
    .map((row) => `<tr>${row.map((cell) => `<td>${renderInlineMarkdown(cell)}</td>`).join('')}</tr>`)
    .join('');
  return `<div class="markdown-table-wrap"><table><thead><tr>${headerHtml}</tr></thead><tbody>${bodyHtml}</tbody></table></div>`;
}

function isTableSeparator(line) {
  return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
}

function renderMarkdown(markdown) {
  const lines = String(markdown || '').replace(/\r\n/g, '\n').split('\n');
  const html = [];
  let paragraph = [];
  let listType = null;
  let listItems = [];
  let quoteLines = [];
  let codeLines = [];
  let inCodeBlock = false;

  function flushParagraph() {
    if (paragraph.length === 0) return;
    html.push(`<p>${paragraph.map(renderInlineMarkdown).join('<br>')}</p>`);
    paragraph = [];
  }

  function flushList() {
    if (!listType) return;
    html.push(`<${listType}>${listItems.map((item) => `<li>${renderInlineMarkdown(item)}</li>`).join('')}</${listType}>`);
    listType = null;
    listItems = [];
  }

  function flushQuote() {
    if (quoteLines.length === 0) return;
    html.push(`<blockquote>${renderMarkdown(quoteLines.join('\n'))}</blockquote>`);
    quoteLines = [];
  }

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.trim();

    if (trimmed.startsWith('```')) {
      if (inCodeBlock) {
        html.push(`<pre><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`);
        codeLines = [];
        inCodeBlock = false;
      } else {
        flushParagraph();
        flushList();
        flushQuote();
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeLines.push(line);
      continue;
    }

    if (!trimmed) {
      flushParagraph();
      flushList();
      flushQuote();
      continue;
    }

    if (index + 1 < lines.length && trimmed.includes('|') && isTableSeparator(lines[index + 1])) {
      flushParagraph();
      flushList();
      flushQuote();
      const tableLines = [line, lines[index + 1]];
      index += 2;
      while (index < lines.length && lines[index].trim().includes('|')) {
        tableLines.push(lines[index]);
        index += 1;
      }
      index -= 1;
      html.push(renderTable(tableLines));
      continue;
    }

    const heading = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      flushList();
      flushQuote();
      const level = heading[1].length;
      html.push(`<h${level}>${renderInlineMarkdown(heading[2])}</h${level}>`);
      continue;
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      flushParagraph();
      flushList();
      flushQuote();
      html.push('<hr>');
      continue;
    }

    const quote = trimmed.match(/^>\s?(.*)$/);
    if (quote) {
      flushParagraph();
      flushList();
      quoteLines.push(quote[1]);
      continue;
    }

    const unordered = trimmed.match(/^[-*+]\s+(.+)$/);
    const ordered = trimmed.match(/^\d+\.\s+(.+)$/);
    if (unordered || ordered) {
      flushParagraph();
      flushQuote();
      const nextType = unordered ? 'ul' : 'ol';
      if (listType && listType !== nextType) {
        flushList();
      }
      listType = nextType;
      listItems.push((unordered || ordered)[1]);
      continue;
    }

    paragraph.push(trimmed);
  }

  if (inCodeBlock) {
    html.push(`<pre><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`);
  }
  flushParagraph();
  flushList();
  flushQuote();

  return html.join('\n');
}

function getFilteredNotes() {
  const keyword = searchInput.value.trim().toLocaleLowerCase('zh-CN');
  return (library.notes || []).filter((note) => {
    // 复习文件归回顾/日历管，浏览与搜索都不展示（镜像 PC）。
    if (note.isReviewFile) {
      return false;
    }
    if (keyword) {
      return [note.title, note.preview, note.folderPath, note.content]
        .some((value) => String(value || '').toLocaleLowerCase('zh-CN').includes(keyword));
    }
    return (note.folderId || null) === currentFolderId;
  });
}

function getFilteredResources() {
  const keyword = searchInput.value.trim().toLocaleLowerCase('zh-CN');
  return (library.resources || []).filter((file) => {
    if (file.isReviewFile) {
      return false;
    }
    if (keyword) {
      return [file.name, file.folderPath, file.typeLabel]
        .some((value) => String(value || '').toLocaleLowerCase('zh-CN').includes(keyword));
    }
    return (file.folderId || null) === currentFolderId;
  });
}

function getChildFolders(folderId) {
  return library.folders
    .filter((folder) => (folder.parentId || null) === folderId && !isReviewBrowseFolder(folder.id))
    .sort((left, right) => left.name.localeCompare(right.name, 'zh-CN'));
}

function getFolderById(folderId) {
  return library.folders.find((folder) => folder.id === folderId) || null;
}

// 镜像 PC 侧边栏：回顾文件夹（.study_notice）及其子目录不在浏览树里出现，
// 它们的内容只供回顾/日历使用。沿祖先链判断，子目录也一并隐藏。
function isReviewBrowseFolder(folderId) {
  let current = getFolderById(folderId);
  while (current) {
    if (current.isReviewFolder) {
      return true;
    }
    current = current.parentId ? getFolderById(current.parentId) : null;
  }
  return false;
}

function getFolderPath(folderId) {
  const path = [];
  let current = getFolderById(folderId);
  while (current) {
    path.unshift(current);
    current = current.parentId ? getFolderById(current.parentId) : null;
  }
  return path;
}

function getFolderCounts(folderId) {
  const folder = getFolderById(folderId);
  return {
    folders: library.folders.filter((folder) => (folder.parentId || null) === folderId && !isReviewBrowseFolder(folder.id)).length,
    notes: folder?.noteCount || 0
  };
}

function getCurrentFolderTitle() {
  return currentFolderId ? getFolderById(currentFolderId)?.name || '未知目录' : '全部笔记';
}

function renderPathBar() {
  pathBar.innerHTML = '';
  const backButton = document.createElement('button');
  backButton.className = 'path-back';
  backButton.type = 'button';
  backButton.textContent = currentFolderId ? '← 返回' : '根目录';
  backButton.disabled = !currentFolderId;
  backButton.addEventListener('click', () => {
    if (currentFolderId) {
      navigateToParentFolder().finally(() => {
        replaceNavigationState(createListNavigationState());
      });
    }
  });

  const breadcrumb = document.createElement('div');
  breadcrumb.className = 'path-title';
  const rootButton = document.createElement('button');
  rootButton.className = 'path-crumb';
  rootButton.type = 'button';
  rootButton.textContent = '全部文件';
  rootButton.addEventListener('click', () => {
    openFolder(null, { pushHistory: false }).finally(() => {
      replaceNavigationState(createListNavigationState());
    });
  });
  breadcrumb.append(rootButton);

  for (const folder of getFolderPath(currentFolderId)) {
    const separator = document.createElement('span');
    separator.className = 'path-separator';
    separator.textContent = '/';
    const folderButton = document.createElement('button');
    folderButton.className = 'path-crumb';
    folderButton.type = 'button';
    folderButton.textContent = folder.name;
    folderButton.addEventListener('click', () => {
      openFolder(folder.id, { pushHistory: false }).then((opened) => {
        if (opened) {
          replaceNavigationState(createListNavigationState());
        }
      }).catch((error) => {
        statusText.textContent = error.message || '读取本地文件失败';
      });
    });
    breadcrumb.append(separator, folderButton);
  }

  pathBar.append(backButton, breadcrumb);
}

function renderFolderCard(folder) {
  const counts = getFolderCounts(folder.id);
  const button = document.createElement('button');
  button.className = 'folder-card';
  button.type = 'button';
  button.dataset.folderId = folder.id;

  const icon = document.createElement('span');
  icon.className = 'folder-icon';
  icon.textContent = '📁';

  const name = document.createElement('strong');
  name.textContent = folder.name || '未命名文件夹';

  const titleWrap = document.createElement('div');
  titleWrap.className = 'folder-title-wrap';
  titleWrap.append(name);

  if (folder.isProtected) {
    // 离线包是明文，手机端没有密码保护：用文字徽章如实说明，不再显示开锁/闭锁 SVG。
    const badge = document.createElement('span');
    badge.className = 'folder-lock-badge is-plaintext';
    badge.title = '密码目录在离线包中是明文，手机端没有密码保护';
    badge.textContent = '此离线包未加密';
    titleWrap.append(badge);
  }

  const stats = document.createElement('div');
  stats.className = 'folder-stats';
  const folderCount = document.createElement('span');
  folderCount.textContent = `夹 ${counts.folders}`;
  const noteCount = document.createElement('span');
  noteCount.textContent = `文 ${counts.notes}`;
  stats.append(folderCount, noteCount);

  button.append(icon, titleWrap, stats);
  return button;
}

function renderNoteCard(note, compact = false) {
  const button = document.createElement('button');
  button.className = compact ? 'note-card compact-note' : 'note-card';
  button.type = 'button';
  button.dataset.noteId = note.id;

  const title = document.createElement('h3');
  title.textContent = note.title || '未命名笔记';

  const meta = document.createElement('div');
  meta.className = 'note-meta';
  const folderMeta = document.createElement('span');
  folderMeta.textContent = compact ? 'MD' : note.folderPath || '全部笔记';
  const updatedMeta = document.createElement('span');
  updatedMeta.textContent = compact ? `修改 ${formatDateTime(note.updatedAt)}` : `更新 ${formatDateTime(note.updatedAt)}`;
  meta.append(folderMeta, updatedMeta);
  if (note.isDailyReview) {
    const dailyMeta = document.createElement('span');
    dailyMeta.textContent = '今日复习';
    meta.append(dailyMeta);
  }

  const preview = document.createElement('p');
  preview.className = 'note-preview';
  preview.textContent = note.preview || '没有正文预览';

  button.append(title, meta, preview);
  return button;
}

function renderResourceCard(file) {
  const button = document.createElement('button');
  button.className = 'note-card resource-card';
  button.type = 'button';
  button.dataset.assetSource = file.localAssetPath;
  button.dataset.resourceName = file.name;
  // 资源本身不带 mimeType，用 localAssetPath 关联到离线包 assets 里的同一份附件。
  const asset = (library.assets || []).find((item) => item.source === file.localAssetPath);
  button.dataset.resourceMime = asset?.mimeType || '';

  const title = document.createElement('h3');
  title.textContent = file.name;
  const meta = document.createElement('div');
  meta.className = 'note-meta';
  const type = document.createElement('span');
  type.textContent = file.typeLabel || 'FILE';
  const size = document.createElement('span');
  size.textContent = `${Math.max(1, Math.round((file.size || 0) / 1024))} KB · 本地`;
  meta.append(type, size);
  const preview = document.createElement('p');
  preview.className = 'note-preview';
  preview.textContent = file.canOpen ? '文件已保存到手机本地，手机端暂不预览' : '文件已保存到手机本地';
  button.append(title, meta, preview);
  return button;
}

function renderEmptyState(message) {
  const emptyState = document.createElement('div');
  emptyState.className = 'empty-state';
  emptyState.textContent = message;
  noteList.append(emptyState);
}

function renderDisconnectedState(message = '点右上角「同步」配对电脑，或「导入文件」选择离线包。') {
  library = null;
  pathBar.innerHTML = '';
  statusText.textContent = '手机本地还没有导入内容';
  noteList.innerHTML = '';
  renderEmptyState(message);
}

function renderLibrary() {
  if (!library) {
    pathBar.innerHTML = '';
    noteList.innerHTML = '';
    return;
  }

  const keyword = searchInput.value.trim();
  const notes = getFilteredNotes();
  const resources = getFilteredResources();
  const childFolders = keyword ? [] : getChildFolders(currentFolderId);
  renderPathBar();
  const syncTime = formatDateTime(library.app?.generatedAt);
  statusText.textContent = keyword
    ? `搜索到 ${notes.length + resources.length} 个本地文件 · 上次导入 ${syncTime}`
    : `${getCurrentFolderTitle()} · 夹 ${childFolders.length} · 文件 ${notes.length + resources.length} · 上次导入 ${syncTime}`;
  noteList.innerHTML = '';

  for (const folder of childFolders) {
    noteList.append(renderFolderCard(folder));
  }

  if (notes.length === 0 && resources.length === 0) {
    if (childFolders.length > 0) {
      return;
    }
    renderEmptyState(keyword
      ? '没有找到匹配的笔记，换个关键词试试。'
      : '当前目录还没有文件。');
    return;
  }

  for (const note of notes) {
    noteList.append(renderNoteCard(note, !keyword));
  }
  for (const file of resources) {
    noteList.append(renderResourceCard(file));
  }
}

function renderOpenedNote(note, saved = false) {
  activeNote = note;
  noteFolder.textContent = `${note.folderPath || '全部笔记'} · 更新 ${formatDateTime(note.updatedAt)}${saved ? ' · 已保存' : ''}`;
  noteTitle.textContent = note.title || '未命名笔记';
  noteContent.innerHTML = renderMarkdown(note.content || '');
  noteView.hidden = false;
}

async function openNote(noteId, options = {}) {
  const { pushHistory = true } = options;
  const note = (library?.notes || []).find((item) => item.id === noteId);
  if (!note) {
    throw new Error('手机本地没有这个文件，请重新导入离线包');
  }
  renderOpenedNote(note);
  showNoteDetailPanel();
  window.scrollTo({ top: 0, behavior: 'smooth' });
  renderLibrary();
  if (pushHistory) {
    pushNavigationState(createNoteNavigationState(noteId));
  }
}

async function loadLibrary() {
  const requestId = ++libraryRequestId;
  showContentPanel();
  const nextLibrary = NoticeNoteStore.getLibrary() || library || await loadOfflineSnapshot();
  if (requestId !== libraryRequestId) {
    return;
  }
  if (!nextLibrary) {
    renderDisconnectedState('还没有内容：点右上角「同步」配对电脑拉取，或「导入文件」选择离线包。');
    return;
  }
  library = nextLibrary;
  NoticeNoteStore.setLibrary(nextLibrary);
  if (currentFolderId && !getFolderById(currentFolderId)) {
    currentFolderId = null;
  }
  renderLibrary();
}

installNavigationHistory();
installNativeAppHandlers();

importPackageButton.addEventListener('click', () => {
  packageFileInput.click();
});

packageFileInput.addEventListener('change', () => {
  const file = packageFileInput.files?.[0];
  if (file) {
    importMobilePackage(file).catch(() => {});
  }
});

noteBackButton.addEventListener('click', () => {
  activeNote = null;
  showContentPanel();
  renderLibrary();
  replaceNavigationState(createListNavigationState());
});

searchInput.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    loadLibrary().catch((error) => {
      statusText.textContent = error.message || '读取本地文件失败';
    });
  }, 300);
});

window.addEventListener('popstate', (event) => {
  const state = event.state;
  const targetFolderId = isMobileNavigationState(state)
    && (state.view === 'list' || state.view === 'note')
    ? state.folderId || null
    : null;
  relockFoldersOnNavigate(targetFolderId)
    .catch((error) => {
      statusText.textContent = error.message || '读取本地文件失败';
    })
    .finally(() => {
      applyNavigationState(state);
    });
});

// 资源打开逻辑抽成全局函数：笔记列表、日历、回顾页共用同一套行为。
function openResourceCard(resourceCard) {
  const url = offlineAssetUrls.get(resourceCard.dataset.assetSource);
  if (!url) {
    alert('手机本地文件不存在，请重新同步或导入离线包。');
    return;
  }
  // Android WebView 里打开新窗口的方式不可用：图片走页面内 lightbox，其余资源明确提示仅保存不预览。
  if (isPreviewableResourceMime(resourceCard.dataset.resourceMime)) {
    openImageLightbox({
      src: url,
      currentSrc: url,
      alt: resourceCard.dataset.resourceName
    });
  } else {
    alert('该文件已保存在手机本地，手机端暂不预览，请在电脑端打开。');
  }
}

noteList.addEventListener('click', (event) => {
  const folderCard = event.target.closest('.folder-card');
  if (folderCard) {
    openFolder(folderCard.dataset.folderId).catch((error) => {
      statusText.textContent = error.message || '读取本地文件失败';
    });
    return;
  }

  const resourceCard = event.target.closest('.resource-card');
  if (resourceCard) {
    openResourceCard(resourceCard);
    return;
  }

  const card = event.target.closest('.note-card');
  if (!card) {
    return;
  }

  openNote(card.dataset.noteId).catch((error) => {
    statusText.textContent = error.message || '读取本地文件失败';
  });
});

noteContent.addEventListener('click', (event) => {
  const cloze = event.target.closest?.('.cloze');
  if (cloze) {
    // 切换显示/隐藏真实内容；textContent 写回不会把 data 里的原文当 HTML 执行。
    const revealed = cloze.classList.toggle('is-revealed');
    cloze.textContent = revealed ? (cloze.dataset.cloze || '') : '点击查看';
    return;
  }
  const image = event.target.closest?.('img');
  if (!image) {
    return;
  }
  event.preventDefault();
  openImageLightbox(image);
});

closeImageLightboxButton.addEventListener('click', closeImageLightbox);
zoomOutImageLightboxButton.addEventListener('click', () => changeImageLightboxZoom(-0.25));
zoomInImageLightboxButton.addEventListener('click', () => changeImageLightboxZoom(0.25));
imageLightbox.addEventListener('click', (event) => {
  if (event.target === imageLightbox) {
    closeImageLightbox();
  }
});
imageLightbox.addEventListener('wheel', (event) => {
  if (imageLightbox.hidden || event.deltaY === 0) {
    return;
  }
  event.preventDefault();
  changeImageLightboxZoom(event.deltaY < 0 ? 0.15 : -0.15);
}, { passive: false });
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !imageLightbox.hidden) {
    event.preventDefault();
    closeImageLightbox();
  }
});

// 同步客户端落库后广播：笔记 Tab 刷新列表（其他 Tab 各自监听同一事件）。
window.addEventListener('nn-library-changed', () => {
  const next = NoticeNoteStore.getLibrary();
  if (next) {
    library = next;
    if (currentFolderId && !getFolderById(currentFolderId)) {
      currentFolderId = null;
    }
    renderLibrary();
  }
});

loadLibrary().catch((error) => {
  showContentPanel();
  renderDisconnectedState(error.message || '读取手机本地文件失败');
});
