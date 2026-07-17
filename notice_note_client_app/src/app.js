const connectionDialog = document.querySelector('#connectionDialog');
const contentPanel = document.querySelector('#contentPanel');
const serverInput = document.querySelector('#serverInput');
const tokenInput = document.querySelector('#tokenInput');
const toggleTokenVisibilityButton = document.querySelector('#toggleTokenVisibilityButton');
const scanPairingButton = document.querySelector('#scanPairingButton');
const connectionSettingsButton = document.querySelector('#connectionSettingsButton');
const closeConnectionDialogButton = document.querySelector('#closeConnectionDialogButton');
const saveConnectionButton = document.querySelector('#saveConnectionButton');
const connectionDialogTitle = document.querySelector('#connectionDialogTitle');
const connectionDialogDescription = document.querySelector('#connectionDialogDescription');
const manualConnectionPanel = document.querySelector('#manualConnectionPanel');
const scannerPanel = document.querySelector('#scannerPanel');
const scannerVideo = document.querySelector('#scannerVideo');
const scannerStatus = document.querySelector('#scannerStatus');
const stopScanButton = document.querySelector('#stopScanButton');
const refreshButton = document.querySelector('#refreshButton');
const searchInput = document.querySelector('#searchInput');
const pathBar = document.querySelector('#pathBar');
const statusText = document.querySelector('#statusText');
const noteList = document.querySelector('#noteList');
const noteDetailPanel = document.querySelector('#noteDetailPanel');
const noteBackButton = document.querySelector('#noteBackButton');
const noteFolder = document.querySelector('#noteFolder');
const editNoteButton = document.querySelector('#editNoteButton');
const noteView = document.querySelector('#noteView');
const noteTitle = document.querySelector('#noteTitle');
const noteContent = document.querySelector('#noteContent');
const noteEditor = document.querySelector('#noteEditor');
const noteTitleInput = document.querySelector('#noteTitleInput');
const noteContentInput = document.querySelector('#noteContentInput');
const noteEditStatus = document.querySelector('#noteEditStatus');
const cancelNoteEditButton = document.querySelector('#cancelNoteEditButton');
const saveNoteEditButton = document.querySelector('#saveNoteEditButton');
const imageLightbox = document.querySelector('#imageLightbox');
const imageLightboxStage = document.querySelector('#imageLightboxStage');
const imageLightboxImage = document.querySelector('#imageLightboxImage');
const closeImageLightboxButton = document.querySelector('#closeImageLightboxButton');
const zoomOutImageLightboxButton = document.querySelector('#zoomOutImageLightboxButton');
const zoomInImageLightboxButton = document.querySelector('#zoomInImageLightboxButton');

const NAVIGATION_STATE_KEY = 'notice-note-mobile-state';
const TOKEN_KEY = 'notice-note-mobile-token';
const SERVER_KEY = 'notice-note-mobile-server';
const LEGACY_TAILSCALE_HOST = '100.95.22.24';
const EASYTIER_HOST = '10.144.144.1';
let accessToken = '';
let serverBaseUrl = '';
let library = null;
let currentFolderId = null;
let scannerStream = null;
let scannerTimer = null;
let isApplyingNavigationState = false;
let exitPromptExpiresAt = 0;
let exitPromptTimer = null;
let activeDialogResolver = null;
let activeNote = null;
let isEditingNote = false;
let isHandlingSystemBack = false;
let hasQueuedSystemBack = false;
let mobileSessionId = createMobileSessionId();
let isMobileSessionSuspended = false;
let mobileResumePromise = null;
let isMobileAppActive = true;
let searchTimer = null;
let libraryRequestId = 0;

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

function createMobileSessionId() {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }
  const bytes = window.crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
}

function readConnectionFromUrl() {
  const url = new URL(window.location.href);
  const token = url.searchParams.get('token');
  const server = url.searchParams.get('server');

  if (token) {
    url.searchParams.delete('token');
  }
  if (server) {
    url.searchParams.delete('server');
  }
  if (token || server) {
    window.history.replaceState({}, document.title, url.toString());
  }

  return { token: token || '', server: server || '' };
}

function isPackagedApp() {
  const platform = window.Capacitor?.getPlatform?.();
  return platform === 'android'
    || platform === 'ios'
    || window.location.protocol === 'capacitor:'
    || window.location.protocol === 'file:';
}

function normalizeServerUrl(value) {
  return String(value || '')
    .trim()
    .replace(/\\/g, '/')
    .replace(/\/+$/, '');
}

function getCurrentPageServerUrl() {
  if (isPackagedApp() || window.location.protocol === 'file:') {
    return '';
  }
  return normalizeServerUrl(window.location.origin);
}

function migrateLegacyServerUrl(value) {
  const normalizedValue = normalizeServerUrl(value);
  if (!normalizedValue) {
    return '';
  }
  try {
    const url = new URL(normalizedValue);
    if (url.hostname === LEGACY_TAILSCALE_HOST) {
      url.hostname = EASYTIER_HOST;
      return normalizeServerUrl(url.toString());
    }
  } catch (_error) {
    return normalizedValue;
  }
  return normalizedValue;
}

function getInitialConnection() {
  const urlConnection = readConnectionFromUrl();
  return {
    token: urlConnection.token || window.localStorage.getItem(TOKEN_KEY) || '',
    server: migrateLegacyServerUrl(
      urlConnection.server
      || window.localStorage.getItem(SERVER_KEY)
      || getCurrentPageServerUrl()
    )
  };
}

function saveConnection(server, token) {
  accessToken = token.trim();
  serverBaseUrl = normalizeServerUrl(server);
  if (accessToken) {
    window.localStorage.setItem(TOKEN_KEY, accessToken);
  }
  if (serverBaseUrl) {
    window.localStorage.setItem(SERVER_KEY, serverBaseUrl);
  }
}

function parsePairingText(text) {
  const url = new URL(String(text || '').trim());
  const token = url.searchParams.get('token') || '';
  const server = url.searchParams.get('server') || `${url.protocol}//${url.host}`;
  if (!token || !server) {
    throw new Error('二维码缺少服务地址或 token');
  }
  return { server, token };
}

async function applyPairingText(text) {
  const pairing = parsePairingText(text);
  saveConnection(pairing.server, pairing.token);
  serverInput.value = serverBaseUrl;
  tokenInput.value = accessToken;
  closeConnectionDialog();
  await loadLibrary();
}

function stopScanner() {
  clearInterval(scannerTimer);
  scannerTimer = null;
  if (scannerStream) {
    for (const track of scannerStream.getTracks()) {
      track.stop();
    }
  }
  scannerStream = null;
  scannerVideo.srcObject = null;
  scannerPanel.hidden = true;
}

async function startScanner() {
  if (!('BarcodeDetector' in window)) {
    scannerStatus.textContent = '当前 WebView 不支持扫码识别，请用系统相机打开二维码或手动填写。';
    scannerPanel.hidden = false;
    return;
  }

  scannerPanel.hidden = false;
  scannerStatus.textContent = '正在打开摄像头...';
  const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
  scannerStream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'environment' },
    audio: false
  });
  scannerVideo.srcObject = scannerStream;
  await scannerVideo.play();
  scannerStatus.textContent = '将二维码放入取景框';

  scannerTimer = setInterval(() => {
    detector.detect(scannerVideo)
      .then((codes) => {
        const value = codes[0]?.rawValue;
        if (!value) {
          return;
        }
        return applyPairingText(value);
      })
      .catch((error) => {
        scannerStatus.textContent = `扫码失败：${error.message}`;
      });
  }, 600);
}

function openConnectionDialog(message = '', mode = 'manual') {
  if (mode !== 'scan') {
    stopScanner();
  }
  if (!serverBaseUrl) {
    serverBaseUrl = getCurrentPageServerUrl();
  }
  serverInput.value = serverBaseUrl;
  tokenInput.value = accessToken;
  const isScanMode = mode === 'scan';
  connectionDialogTitle.textContent = isScanMode ? '扫码连接' : '连接配置';
  connectionDialogDescription.textContent = isScanMode
    ? '扫描 PC 端生成的连接二维码，自动设置域名和 token。'
    : '填写电脑的 EasyTier 服务地址和访问令牌。';
  manualConnectionPanel.hidden = isScanMode;
  scannerPanel.hidden = !isScanMode;
  if (message) {
    tokenInput.placeholder = message;
  }
  if (!connectionDialog.open) {
    connectionDialog.showModal();
  }
}

function closeConnectionDialog() {
  stopScanner();
  if (connectionDialog.open) {
    connectionDialog.close();
  }
}

function showContentPanel() {
  contentPanel.hidden = false;
  noteDetailPanel.hidden = true;
}

function showNoteDetailPanel() {
  contentPanel.hidden = true;
  noteDetailPanel.hidden = false;
}

function getApiUrl(path) {
  return `${serverBaseUrl}${path}`;
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
  if (!imageLightbox.hidden) {
    closeImageLightbox();
    return;
  }

  if (connectionDialog.open) {
    closeConnectionDialog();
    return;
  }

  if (activeDialogResolver) {
    closeActiveDialog(null);
    return;
  }

  if (isEditingNote) {
    cancelNoteEditing();
    return;
  }

  if (!noteDetailPanel.hidden) {
    activeNote = null;
    editNoteButton.hidden = true;
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
      statusText.textContent = createFriendlyError(error);
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
  stopScanner();
  if (activeDialogResolver) {
    closeActiveDialog(null);
  }
  if (isEditingNote) {
    cancelNoteEditing(false);
  }
  library = null;
  currentFolderId = null;
  activeNote = null;
  isEditingNote = false;
  isHandlingSystemBack = false;
  hasQueuedSystemBack = false;
  searchInput.value = '';
  noteTitle.textContent = '';
  noteFolder.textContent = '';
  noteContent.replaceChildren();
  noteView.hidden = false;
  noteEditor.hidden = true;
  editNoteButton.hidden = true;
  noteList.replaceChildren();
  showContentPanel();
  statusText.textContent = '应用已锁定';
  exitPromptExpiresAt = 0;
  exitPromptToast.classList.remove('show');
  replaceNavigationState(createListNavigationState());
}

function suspendMobileSession() {
  if (isMobileSessionSuspended) {
    return;
  }

  const previousSessionId = mobileSessionId;
  mobileSessionId = createMobileSessionId();
  isMobileSessionSuspended = true;
  clearSensitiveMobileState();

  if (accessToken && serverBaseUrl) {
    requestApi('/api/session/lock', 'POST', null, {
      sessionId: previousSessionId,
      allowStaleSession: true
    }).catch(() => {});
  }
}

function resumeMobileSession() {
  if (!isMobileSessionSuspended || !isMobileAppActive || mobileResumePromise) {
    return;
  }

  isMobileSessionSuspended = false;
  if (!accessToken || (isPackagedApp() && !serverBaseUrl)) {
    renderDisconnectedState();
    return;
  }

  mobileResumePromise = loadLibrary()
    .catch((error) => {
      renderDisconnectedState(createFriendlyError(error));
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
      statusText.textContent = createFriendlyError(error);
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
      statusText.textContent = createFriendlyError(error);
    }).finally(() => {
      isApplyingNavigationState = false;
    });
    return;
  }

  showContentPanel();
  const targetFolderId = state.folderId || null;
  const targetFolder = targetFolderId ? getFolderById(targetFolderId) : null;
  if (targetFolder?.isProtected && !targetFolder.isUnlocked) {
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
    statusText.textContent = createFriendlyError(error);
  }).finally(() => {
    isApplyingNavigationState = false;
  });
}

function createFriendlyError(error) {
  const message = String(error?.message || '');
  if (error?.code === 'MOBILE_SESSION_LOCKED') {
    return '应用已锁定';
  }
  if (error?.code === 'FOLDER_LOCKED') {
    return message || '当前文件夹已加密，请先输入密码。';
  }
  if (!serverBaseUrl) {
    return '还没有配置服务地址。请点击右上角扫码，或填写电脑的 EasyTier 地址。';
  }
  if (message.includes('加密') || message.includes('decrypt') || message.includes('crypto')) {
    return '加密通信失败。请重新扫码连接，或确认手机 WebView 支持安全加密。';
  }
  if (message.includes('Invalid URL') || message.includes('parse URL')) {
    return '服务地址格式不正确。请填写完整地址，例如：http://10.144.144.1:39271';
  }
  if (message.includes('Failed to fetch') || message.includes('NetworkError')) {
    return '暂时连接不上桌面端。请确认电脑和手机已加入同一个 EasyTier 网络，并且电脑服务正在运行。';
  }
  if (message.includes('访问令牌无效') || message.includes('401')) {
    return '访问令牌不正确。请重新扫码，或在连接配置里更新 token。';
  }
  if (message.includes('404')) {
    return '没有找到对应内容，可能文件刚刚被移动或删除了。';
  }
  return '连接失败。请检查服务地址和访问令牌后重试。';
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes.buffer;
}

async function decompressGzip(buffer) {
  if (typeof DecompressionStream !== 'function') {
    throw new Error('当前环境不支持 gzip 解压，请升级移动端应用');
  }
  const stream = new Blob([buffer]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Response(stream).arrayBuffer();
}

async function getMobileCryptoKey() {
  if (!window.crypto?.subtle) {
    throw new Error('当前环境不支持 crypto.subtle 加密');
  }

  const tokenBytes = new TextEncoder().encode(accessToken);
  const digest = await window.crypto.subtle.digest('SHA-256', tokenBytes);
  return window.crypto.subtle.importKey(
    'raw',
    digest,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
}

async function encryptMobilePayload(payload) {
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const key = await getMobileCryptoKey();
  const encoded = new TextEncoder().encode(JSON.stringify(payload));
  const encrypted = await window.crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
  return {
    encrypted: true,
    iv: arrayBufferToBase64(iv.buffer),
    data: arrayBufferToBase64(encrypted)
  };
}

async function decryptMobilePayload(envelope) {
  if (!envelope || envelope.encrypted !== true || !envelope.iv || !envelope.data) {
    throw new Error('加密响应格式不正确');
  }

  const key = await getMobileCryptoKey();
  const decrypted = await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64ToArrayBuffer(envelope.iv) },
    key,
    base64ToArrayBuffer(envelope.data)
  );
  const decoded = envelope.compression === 'gzip'
    ? await decompressGzip(decrypted)
    : decrypted;
  return JSON.parse(new TextDecoder().decode(decoded));
}

async function requestApi(path, method = 'GET', body = null, options = {}) {
  try {
    const requestSessionId = options.sessionId || mobileSessionId;
    const encryptedRequest = await encryptMobilePayload({
      method,
      path,
      sessionId: requestSessionId,
      ...(body && typeof body === 'object' ? body : {})
    });
    const response = await fetch(getApiUrl('/api/secure'), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(encryptedRequest)
    });
    const encryptedPayload = await response.json().catch(() => ({}));
    const payload = await decryptMobilePayload(encryptedPayload);
    if (!options.allowStaleSession && requestSessionId !== mobileSessionId) {
      const error = new Error('移动端会话已锁定');
      error.code = 'MOBILE_SESSION_LOCKED';
      throw error;
    }
    if (!response.ok) {
      const error = new Error(payload.error || `HTTP ${response.status}`);
      error.status = response.status;
      if (payload && typeof payload === 'object') {
        Object.assign(error, payload);
      }
      throw error;
    }
    return payload;
  } catch (error) {
    if (error?.status || error?.code === 'MOBILE_SESSION_LOCKED') {
      throw error;
    }
    throw new Error(createFriendlyError(error));
  }
}

async function requestJson(path) {
  try {
    return await requestApi(path, 'GET');
  } catch (error) {
    if (error?.status) {
      throw new Error(createFriendlyError(error));
    }
    throw error;
  }
}

function closeActiveDialog(value = null) {
  if (!activeDialogResolver) {
    return;
  }
  const resolve = activeDialogResolver;
  activeDialogResolver = null;
  resolve(value);
}

function showPasswordDialog(title, confirmLabel = '确定') {
  const overlay = document.createElement('div');
  overlay.className = 'password-dialog';
  overlay.innerHTML = `
    <div class="password-dialog-card" role="dialog" aria-modal="true" aria-label="${escapeAttribute(title)}">
      <h3>${escapeHtml(title)}</h3>
      <input type="password" class="password-dialog-input" placeholder="输入密码">
      <div class="password-dialog-actions">
        <button type="button" class="password-dialog-cancel">取消</button>
        <button type="button" class="password-dialog-confirm">${escapeHtml(confirmLabel)}</button>
      </div>
    </div>
  `;
  document.body.append(overlay);

  const input = overlay.querySelector('.password-dialog-input');
  const cancelButton = overlay.querySelector('.password-dialog-cancel');
  const confirmButton = overlay.querySelector('.password-dialog-confirm');

  return new Promise((resolve) => {
    activeDialogResolver = (value) => {
      overlay.remove();
      resolve(value);
    };

    cancelButton.addEventListener('click', () => closeActiveDialog(null));
    confirmButton.addEventListener('click', () => closeActiveDialog(input.value));
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) {
        closeActiveDialog(null);
      }
    });
    overlay.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        closeActiveDialog(null);
      }
      if (event.key === 'Enter') {
        closeActiveDialog(input.value);
      }
    });
    input.focus();
  });
}

async function unlockFolder(folderId) {
  const folder = getFolderById(folderId);
  if (!folder?.isProtected || folder.isUnlocked) {
    return true;
  }
  const password = await showPasswordDialog(`输入「${folder.name}」的访问密码`, '解锁');
  if (!password) {
    return false;
  }
  try {
    await requestApi(`/api/folders/${encodeURIComponent(folderId)}/unlock`, 'POST', { password });
    await loadLibrary();
    return true;
  } catch (error) {
    alert(createFriendlyError(error.status ? error : new Error(error.message || '密码不正确')));
    return false;
  }
}

async function relockFoldersOnNavigate(targetFolderId) {
  if (targetFolderId === currentFolderId) {
    return;
  }
  const ancestors = new Set();
  let current = targetFolderId ? getFolderById(targetFolderId) : null;
  while (current) {
    ancestors.add(current.id);
    current = current.parentId ? getFolderById(current.parentId) : null;
  }
  const toLock = (library?.folders || []).filter((f) =>
    f.isProtected && f.isUnlocked && !ancestors.has(f.id)
  );
  if (toLock.length === 0) {
    return;
  }
  for (const f of toLock) {
    await requestApi(`/api/folders/${encodeURIComponent(f.id)}/lock`, 'POST', {});
    f.isUnlocked = false;
  }
  await loadLibrary();
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

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, '&#96;');
}

function isSafeUrl(value) {
  return /^(https?:|mailto:|tel:|file:|data:|\/|#)/i.test(String(value || '').trim());
}

function resolveImageUrl(url) {
  const trimmed = String(url || '').trim();
  if (!trimmed) {
    return '';
  }
  if (trimmed.startsWith('mobile-image://')) {
    const relPath = trimmed.slice('mobile-image://'.length);
    const apiUrl = getApiUrl('/api/image');
    return `${apiUrl}?src=${encodeURIComponent(relPath)}&token=${encodeURIComponent(accessToken)}`;
  }
  if (trimmed.startsWith('file:')) {
    const apiUrl = getApiUrl('/api/image');
    return `${apiUrl}?src=${encodeURIComponent(trimmed)}&token=${encodeURIComponent(accessToken)}`;
  }
  return trimmed;
}

function renderInlineMarkdown(text) {
  const placeholders = [];
  let value = escapeHtml(text);

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
    .replace(/__([^_]+)__/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/_([^_]+)_/g, '<em>$1</em>')
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
  return library.notes;
}

function getChildFolders(folderId) {
  return library.folders
    .filter((folder) => (folder.parentId || null) === folderId)
    .sort((left, right) => left.name.localeCompare(right.name, 'zh-CN'));
}

function getFolderById(folderId) {
  return library.folders.find((folder) => folder.id === folderId) || null;
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
    folders: library.folders.filter((folder) => (folder.parentId || null) === folderId).length,
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
        statusText.textContent = createFriendlyError(error);
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
    const badge = document.createElement('span');
    badge.className = `folder-lock-badge${folder.isUnlocked ? ' is-unlocked' : ''}`;
    badge.title = folder.isUnlocked ? '当前会话已解锁' : '进入前需要输入密码';
    if (folder.isUnlocked) {
      badge.innerHTML = '<svg width="13" height="13" viewBox="0 0 16 16" fill="none"><rect x="3" y="7" width="10" height="7" rx="1.2" stroke="currentColor" stroke-width="1.3"/><path d="M5 7V5a3 3 0 0 1 5.5-1.6" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" fill="none"/></svg>';
    } else {
      badge.innerHTML = '<svg width="13" height="13" viewBox="0 0 16 16" fill="none"><rect x="3" y="7" width="10" height="7" rx="1.2" stroke="currentColor" stroke-width="1.3"/><path d="M5 7V5a3 3 0 0 1 6 0v2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" fill="none"/></svg>';
    }
    icon.append(badge);
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

function renderEmptyState(message) {
  const emptyState = document.createElement('div');
  emptyState.className = 'empty-state';
  emptyState.textContent = message;
  noteList.append(emptyState);
}

function renderDisconnectedState(message = '请点击右上角扫码或配置连接信息。') {
  library = null;
  pathBar.innerHTML = '';
  statusText.textContent = '未连接桌面端';
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
  const childFolders = keyword ? [] : getChildFolders(currentFolderId);
  renderPathBar();
  statusText.textContent = keyword
    ? `搜索到 ${library.total ?? notes.length} 篇笔记 · 可编辑`
    : `${getCurrentFolderTitle()} · 夹 ${childFolders.length} · 文 ${notes.length} · 可编辑`;
  noteList.innerHTML = '';

  for (const folder of childFolders) {
    noteList.append(renderFolderCard(folder));
  }

  if (notes.length === 0) {
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
}

function renderOpenedNote(note, saved = false) {
  activeNote = note;
  isEditingNote = false;
  noteFolder.textContent = `${note.folderPath || '全部笔记'} · 更新 ${formatDateTime(note.updatedAt)}${saved ? ' · 已保存' : ''}`;
  noteTitle.textContent = note.title || '未命名笔记';
  noteContent.innerHTML = renderMarkdown(note.content || '');
  noteView.hidden = false;
  noteEditor.hidden = true;
  editNoteButton.hidden = typeof note.editableContent !== 'string';
}

function hasUnsavedNoteChanges() {
  if (!isEditingNote || !activeNote) {
    return false;
  }
  return noteTitleInput.value !== (activeNote.title || '')
    || noteContentInput.value !== (activeNote.editableContent || '');
}

function startNoteEditing() {
  if (!activeNote || typeof activeNote.editableContent !== 'string') {
    return;
  }
  noteTitleInput.value = activeNote.title || '';
  noteContentInput.value = activeNote.editableContent;
  noteEditStatus.textContent = '';
  noteView.hidden = true;
  noteEditor.hidden = false;
  editNoteButton.hidden = true;
  isEditingNote = true;
  noteTitleInput.focus();
}

function cancelNoteEditing(confirmDiscard = true) {
  if (confirmDiscard && hasUnsavedNoteChanges()
    && !window.confirm('放弃尚未保存的修改吗？')) {
    return false;
  }
  isEditingNote = false;
  noteEditor.hidden = true;
  noteView.hidden = false;
  editNoteButton.hidden = !activeNote || typeof activeNote.editableContent !== 'string';
  noteEditStatus.textContent = '';
  return true;
}

async function saveNoteEditing() {
  if (!activeNote) {
    return;
  }
  saveNoteEditButton.disabled = true;
  cancelNoteEditButton.disabled = true;
  noteEditStatus.textContent = '正在保存...';
  try {
    const input = {
      title: noteTitleInput.value,
      content: noteContentInput.value
    };
    let savedNote;
    try {
      savedNote = await requestApi(`/api/notes/${encodeURIComponent(activeNote.id)}`, 'PUT', input);
    } catch (error) {
      if (error?.status !== 423 || !error?.folderId || !await unlockFolder(error.folderId)) {
        throw error;
      }
      savedNote = await requestApi(`/api/notes/${encodeURIComponent(activeNote.id)}`, 'PUT', input);
    }
    const summaryIndex = library.notes.findIndex((note) => note.id === savedNote.id);
    const savedSummary = { ...savedNote };
    delete savedSummary.content;
    delete savedSummary.editableContent;
    if (summaryIndex >= 0) {
      library.notes.splice(summaryIndex, 1, savedSummary);
    } else {
      library.notes.unshift(savedSummary);
    }
    renderLibrary();
    renderOpenedNote(savedNote, true);
  } catch (error) {
    noteEditStatus.textContent = `保存失败：${error.message}`;
  } finally {
    saveNoteEditButton.disabled = false;
    cancelNoteEditButton.disabled = false;
  }
}

async function openNote(noteId, options = {}) {
  const { pushHistory = true } = options;
  statusText.textContent = '正在读取笔记...';
  let note;
  try {
    note = await requestApi(`/api/notes/${encodeURIComponent(noteId)}`, 'GET');
  } catch (error) {
    if (error?.status === 423 && error?.folderId) {
      const unlocked = await unlockFolder(error.folderId);
      if (!unlocked) {
        statusText.textContent = createFriendlyError(error);
        return;
      }
      note = await requestApi(`/api/notes/${encodeURIComponent(noteId)}`, 'GET');
    } else {
      throw new Error(createFriendlyError(error));
    }
  }
  renderOpenedNote(note);
  showNoteDetailPanel();
  window.scrollTo({ top: 0, behavior: 'smooth' });
  renderLibrary();
  if (pushHistory) {
    pushNavigationState(createNoteNavigationState(noteId));
  }
}

async function loadLibrary(forceRefresh = false) {
  const requestId = ++libraryRequestId;
  showContentPanel();
  statusText.textContent = '正在连接桌面端...';
  const nextLibrary = await requestApi('/api/library', 'GET', {
    folderId: currentFolderId,
    query: searchInput.value.trim(),
    refresh: forceRefresh
  });
  if (requestId !== libraryRequestId) {
    return;
  }
  library = nextLibrary;
  if (currentFolderId && !getFolderById(currentFolderId)) {
    currentFolderId = null;
  }
  renderLibrary();
}

const initialConnection = getInitialConnection();
saveConnection(initialConnection.server, initialConnection.token);
installNavigationHistory();
installNativeAppHandlers();

saveConnectionButton.addEventListener('click', () => {
  saveConnection(serverInput.value, tokenInput.value);
  if (!accessToken) {
    openConnectionDialog('请先粘贴 token');
    return;
  }
  if (isPackagedApp() && !serverBaseUrl) {
    openConnectionDialog('App 内请填写电脑的 EasyTier 服务地址');
    return;
  }
  closeConnectionDialog();
  loadLibrary().catch((error) => {
    const message = createFriendlyError(error);
    openConnectionDialog(message);
    renderDisconnectedState(message);
  });
});

scanPairingButton.addEventListener('click', () => {
  openConnectionDialog('', 'scan');
  startScanner().catch((error) => {
    scannerPanel.hidden = false;
    scannerStatus.textContent = `无法打开扫码：${error.message}`;
  });
});

connectionSettingsButton.addEventListener('click', () => {
  openConnectionDialog('', 'manual');
});

closeConnectionDialogButton.addEventListener('click', closeConnectionDialog);

stopScanButton.addEventListener('click', stopScanner);

toggleTokenVisibilityButton.addEventListener('click', () => {
  const isHidden = tokenInput.type === 'password';
  tokenInput.type = isHidden ? 'text' : 'password';
  toggleTokenVisibilityButton.textContent = isHidden ? '🙈' : '👁';
  toggleTokenVisibilityButton.setAttribute('aria-label', isHidden ? '隐藏访问令牌' : '显示访问令牌');
});

refreshButton.addEventListener('click', () => {
  loadLibrary(true).catch((error) => {
    renderDisconnectedState(createFriendlyError(error));
  });
});

noteBackButton.addEventListener('click', () => {
  if (isEditingNote && !cancelNoteEditing()) {
    return;
  }
  activeNote = null;
  editNoteButton.hidden = true;
  showContentPanel();
  renderLibrary();
  replaceNavigationState(createListNavigationState());
});

editNoteButton.addEventListener('click', startNoteEditing);
cancelNoteEditButton.addEventListener('click', () => cancelNoteEditing());
noteEditor.addEventListener('submit', (event) => {
  event.preventDefault();
  saveNoteEditing();
});

searchInput.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    loadLibrary().catch((error) => {
      statusText.textContent = createFriendlyError(error);
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
      statusText.textContent = createFriendlyError(error);
    })
    .finally(() => {
      applyNavigationState(state);
    });
});

noteList.addEventListener('click', (event) => {
  const folderCard = event.target.closest('.folder-card');
  if (folderCard) {
    openFolder(folderCard.dataset.folderId).catch((error) => {
      statusText.textContent = createFriendlyError(error);
    });
    return;
  }

  const card = event.target.closest('.note-card');
  if (!card) {
    return;
  }

  openNote(card.dataset.noteId).catch((error) => {
    statusText.textContent = createFriendlyError(error);
  });
});

noteContent.addEventListener('click', (event) => {
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

if (accessToken && (!isPackagedApp() || serverBaseUrl)) {
  loadLibrary().catch((error) => {
    showContentPanel();
    renderDisconnectedState(createFriendlyError(error));
  });
} else {
  showContentPanel();
  renderDisconnectedState();
}
