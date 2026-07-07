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
const noteTitle = document.querySelector('#noteTitle');
const noteContent = document.querySelector('#noteContent');

const TOKEN_KEY = 'notice-note-mobile-token';
const SERVER_KEY = 'notice-note-mobile-server';
let accessToken = '';
let serverBaseUrl = '';
let library = null;
let currentFolderId = null;
let scannerStream = null;
let scannerTimer = null;

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
  return window.location.protocol === 'capacitor:';
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

function getInitialConnection() {
  const urlConnection = readConnectionFromUrl();
  return {
    token: urlConnection.token || window.localStorage.getItem(TOKEN_KEY) || '',
    server: normalizeServerUrl(
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
    : '填写 NATAPP 服务地址和访问令牌。';
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

function createFriendlyError(error) {
  const message = String(error?.message || '');
  if (!serverBaseUrl) {
    return '还没有配置服务地址。请点击右上角扫码，或进入连接配置填写 NATAPP 地址。';
  }
  if (message.includes('Invalid URL') || message.includes('parse URL')) {
    return '服务地址格式不正确。请填写完整地址，例如：http://xxxx.natappfree.cc';
  }
  if (message.includes('Failed to fetch') || message.includes('NetworkError')) {
    return '暂时连接不上桌面端。请确认电脑服务、NATAPP 隧道和网络都在运行。';
  }
  if (message.includes('访问令牌无效') || message.includes('401')) {
    return '访问令牌不正确。请重新扫码，或在连接配置里更新 token。';
  }
  if (message.includes('404')) {
    return '没有找到对应内容，可能文件刚刚被移动或删除了。';
  }
  return '连接失败。请检查服务地址和访问令牌后重试。';
}

async function requestJson(path) {
  try {
    const response = await fetch(getApiUrl(path), {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error || `HTTP ${response.status}`);
    }
    return payload;
  } catch (error) {
    throw new Error(createFriendlyError(error));
  }
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
  return /^(https?:|mailto:|tel:|file:|\/|#)/i.test(String(value || '').trim());
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
    const safeUrl = isSafeUrl(url) ? escapeAttribute(url) : '';
    return safeUrl ? `<img src="${safeUrl}" alt="${escapeAttribute(alt)}">` : escapeHtml(alt);
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
    html.push(`<p>${renderInlineMarkdown(paragraph.join(' '))}</p>`);
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
  if (!keyword) {
    return library.notes.filter((note) => (note.folderId || null) === currentFolderId);
  }

  return library.notes.filter((note) => {
    return [
      note.title,
      note.preview,
      note.folderName,
      note.folderPath
    ].some((value) => String(value || '').toLocaleLowerCase('zh-CN').includes(keyword));
  });
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
  return {
    folders: library.folders.filter((folder) => (folder.parentId || null) === folderId).length,
    notes: library.notes.filter((note) => (note.folderId || null) === folderId).length
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
    const folder = getFolderById(currentFolderId);
    currentFolderId = folder?.parentId || null;
    renderLibrary();
  });

  const breadcrumb = document.createElement('div');
  breadcrumb.className = 'path-title';
  const rootButton = document.createElement('button');
  rootButton.className = 'path-crumb';
  rootButton.type = 'button';
  rootButton.textContent = '全部文件';
  rootButton.addEventListener('click', () => {
    currentFolderId = null;
    searchInput.value = '';
    renderLibrary();
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
      currentFolderId = folder.id;
      searchInput.value = '';
      renderLibrary();
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

  const stats = document.createElement('div');
  stats.className = 'folder-stats';
  const folderCount = document.createElement('span');
  folderCount.textContent = `夹 ${counts.folders}`;
  const noteCount = document.createElement('span');
  noteCount.textContent = `文 ${counts.notes}`;
  stats.append(folderCount, noteCount);

  button.append(icon, name, stats);
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
    ? `搜索到 ${notes.length} 篇笔记 · 只读模式`
    : `${getCurrentFolderTitle()} · 夹 ${childFolders.length} · 文 ${notes.length} · 只读模式`;
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

async function openNote(noteId) {
  statusText.textContent = '正在读取笔记...';
  const note = await requestJson(`/api/notes/${encodeURIComponent(noteId)}`);
  noteFolder.textContent = `${note.folderPath || '全部笔记'} · 更新 ${formatDateTime(note.updatedAt)}`;
  noteTitle.textContent = note.title || '未命名笔记';
  noteContent.innerHTML = renderMarkdown(note.content || '');
  showNoteDetailPanel();
  window.scrollTo({ top: 0, behavior: 'smooth' });
  renderLibrary();
}

async function loadLibrary() {
  showContentPanel();
  statusText.textContent = '正在连接桌面端...';
  library = await requestJson('/api/library');
  if (currentFolderId && !getFolderById(currentFolderId)) {
    currentFolderId = null;
  }
  renderLibrary();
}

const initialConnection = getInitialConnection();
saveConnection(initialConnection.server, initialConnection.token);

saveConnectionButton.addEventListener('click', () => {
  saveConnection(serverInput.value, tokenInput.value);
  if (!accessToken) {
    openConnectionDialog('请先粘贴 token');
    return;
  }
  if (isPackagedApp() && !serverBaseUrl) {
    openConnectionDialog('App 内请填写 NATAPP 服务地址');
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
  loadLibrary().catch((error) => {
    renderDisconnectedState(createFriendlyError(error));
  });
});

noteBackButton.addEventListener('click', () => {
  showContentPanel();
  renderLibrary();
});

searchInput.addEventListener('input', renderLibrary);

noteList.addEventListener('click', (event) => {
  const folderCard = event.target.closest('.folder-card');
  if (folderCard) {
    currentFolderId = folderCard.dataset.folderId;
    searchInput.value = '';
    renderLibrary();
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

if (accessToken && (!isPackagedApp() || serverBaseUrl)) {
  loadLibrary().catch((error) => {
    showContentPanel();
    renderDisconnectedState(createFriendlyError(error));
  });
} else {
  showContentPanel();
  renderDisconnectedState();
}
