const { createServer } = require('node:http');
const path = require('node:path');
const fs = require('node:fs/promises');
const {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  randomUUID,
  scryptSync,
  timingSafeEqual
} = require('node:crypto');
const { fileURLToPath } = require('node:url');
const { gzipSync } = require('node:zlib');
const matter = require('gray-matter');
const sharp = require('sharp');

const NOTES_DIR_NAME = 'notes';
const CONFIG_FILE_NAME = 'config.json';
const IMAGE_ASSET_DIR_NAME = 'notice_note_images';
const APP_DATA_DIR_NAME = '.notice-note';
const NOTE_METADATA_FILE_NAME = 'metadata.json';
const MOBILE_IMAGE_CACHE_DIR_NAME = 'mobile-image-cache';
const MOBILE_IMAGE_CACHE_VERSION = 2;
const MOBILE_IMAGE_MAX_WIDTH = 1080;
const MOBILE_IMAGE_JPEG_QUALITY = 82;
const MOBILE_IMAGE_MIN_OPTIMIZE_BYTES = 256 * 1024;
const MOBILE_IMAGE_CACHE_MAX_AGE = 30 * 24 * 60 * 60;
const MOBILE_IMAGE_OPTIMIZABLE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.bmp']);
const MOBILE_UNLOCK_SESSION_MAX_AGE = 30 * 60 * 1000;
const MOBILE_LIBRARY_CACHE_MAX_AGE = 2 * 1000;
const MOBILE_SERVER_HOST = process.env.NOTICE_NOTE_MOBILE_HOST || '127.0.0.1';
const MOBILE_SERVER_PORT = Number(process.env.NOTICE_NOTE_MOBILE_PORT || 39271);

let notesPath = null;
let mobileAccessToken = null;
const lockedFolderIds = new Set();
const mobileUnlockSessions = new Map();
const mobileLibraryCache = new Map();

function getUserDataPath() {
  if (process.env.NOTICE_NOTE_USER_DATA) {
    return process.env.NOTICE_NOTE_USER_DATA;
  }

  if (process.platform === 'win32') {
    return path.join(process.env.APPDATA || process.cwd(), 'notice-note');
  }

  if (process.platform === 'darwin') {
    return path.join(process.env.HOME || process.cwd(), 'Library', 'Application Support', 'notice-note');
  }

  return path.join(process.env.XDG_CONFIG_HOME || path.join(process.env.HOME || process.cwd(), '.config'), 'notice-note');
}

function getDefaultNotesPath() {
  return path.join(getUserDataPath(), NOTES_DIR_NAME);
}

function getConfigPath() {
  return path.join(getUserDataPath(), CONFIG_FILE_NAME);
}

function getNotesPath() {
  return notesPath || getDefaultNotesPath();
}

function getAppDataPath() {
  return path.join(getNotesPath(), APP_DATA_DIR_NAME);
}

function getMobileImageCacheDir() {
  return path.join(getAppDataPath(), MOBILE_IMAGE_CACHE_DIR_NAME);
}

function getNoteMetadataPath() {
  return path.join(getAppDataPath(), NOTE_METADATA_FILE_NAME);
}

function getNoteMetadataKey(filePath) {
  return path.relative(getNotesPath(), filePath).split(path.sep).join('/');
}

function isInternalDirectory(name) {
  return name === IMAGE_ASSET_DIR_NAME || name === APP_DATA_DIR_NAME;
}

function getStableFolderId(folderPath) {
  const relativePath = path.relative(getNotesPath(), folderPath).split(path.sep).join('/');
  return `path:${relativePath.toLocaleLowerCase('zh-CN')}`;
}

function normalizeNoteFileType(fileType) {
  return ['md', 'txt', 'json'].includes(fileType) ? fileType : 'md';
}

function normalizeReminder(input = {}) {
  return {
    id: input.id || randomUUID(),
    date: input.date || '',
    time: input.time || '',
    done: Boolean(input.done)
  };
}

function getLatestDateTime(...values) {
  const timestamps = values
    .filter(Boolean)
    .map((value) => new Date(value).getTime())
    .filter((value) => !Number.isNaN(value));
  if (timestamps.length === 0) {
    return new Date().toISOString();
  }
  return new Date(Math.max(...timestamps)).toISOString();
}

function normalizeLoadedNote(input = {}) {
  const now = new Date().toISOString();
  const createdAt = input.createdAt || now;
  const updatedAt = getLatestDateTime(input.updatedAt, createdAt, now);
  return {
    id: input.id || randomUUID(),
    title: String(input.title || '未命名笔记').trim() || '未命名笔记',
    content: String(input.content || ''),
    fileType: normalizeNoteFileType(input.fileType),
    reminders: Array.isArray(input.reminders)
      ? input.reminders
        .filter((item) => item && (item.date || item.time))
        .map(normalizeReminder)
        .filter((item) => item.date)
      : [],
    folderId: input.folderId || null,
    createdAt,
    updatedAt
  };
}

async function loadConfig() {
  try {
    const raw = await fs.readFile(getConfigPath(), 'utf8');
    const config = JSON.parse(raw);
    notesPath = typeof config.notesPath === 'string' && config.notesPath
      ? config.notesPath
      : getDefaultNotesPath();
    mobileAccessToken = typeof config.mobileAccessToken === 'string' && config.mobileAccessToken
      ? config.mobileAccessToken
      : process.env.NOTICE_NOTE_MOBILE_TOKEN || createMobileAccessToken();
    if (!config.mobileAccessToken) {
      await saveConfig(config);
    }
  } catch {
    notesPath = process.env.NOTICE_NOTE_PATH || getDefaultNotesPath();
    mobileAccessToken = process.env.NOTICE_NOTE_MOBILE_TOKEN || createMobileAccessToken();
    await saveConfig({});
  }
}

async function saveConfig(existingConfig) {
  await fs.mkdir(getUserDataPath(), { recursive: true });
  await fs.writeFile(getConfigPath(), JSON.stringify({
    ...existingConfig,
    notesPath: getNotesPath(),
    mobileAccessToken
  }, null, 2), 'utf8');
}

function createMobileAccessToken() {
  return `${randomUUID()}-${randomUUID()}`;
}

async function loadNoteMetadata() {
  try {
    const raw = await fs.readFile(getNoteMetadataPath(), 'utf8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

async function scanFolderDirectory(dirPath, parentId, folders) {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory() || isInternalDirectory(entry.name)) {
      continue;
    }

    const folderPath = path.join(dirPath, entry.name);
    const metaPath = path.join(folderPath, '.folder.json');
    let data = {};
    try {
      data = JSON.parse(await fs.readFile(metaPath, 'utf8'));
    } catch {
      data = {};
    }

    const folder = {
      id: data.id || getStableFolderId(folderPath),
      name: data.name || entry.name,
      parentId,
      path: '',
      passwordSalt: typeof data.passwordSalt === 'string' ? data.passwordSalt : '',
      passwordHash: typeof data.passwordHash === 'string' ? data.passwordHash : ''
    };
    folders.push(folder);
    await scanFolderDirectory(folderPath, folder.id, folders);
  }
}

function getFolderById(folderId, folders) {
  return folders.find((folder) => folder.id === folderId) || null;
}

function isFolderProtected(folder) {
  return Boolean(folder?.passwordHash && folder?.passwordSalt);
}

function sanitizeFolderForClient(folder, unlockedSet = lockedFolderIds) {
  return {
    id: folder.id,
    name: folder.name,
    parentId: folder.parentId || null,
    path: folder.path || '',
    isProtected: isFolderProtected(folder),
    isUnlocked: unlockedSet.has(folder.id)
  };
}

function hashFolderPassword(password, salt = randomBytes(16).toString('hex')) {
  const normalizedPassword = String(password || '');
  return {
    salt,
    hash: scryptSync(normalizedPassword, salt, 64).toString('hex')
  };
}

function verifyFolderPassword(folder, password) {
  if (!isFolderProtected(folder)) {
    return true;
  }
  const expected = Buffer.from(folder.passwordHash, 'hex');
  const actual = Buffer.from(hashFolderPassword(password, folder.passwordSalt).hash, 'hex');
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function getLockedFolderForFolderId(folderId, folders, unlockedSet = lockedFolderIds, includeSelf = true) {
  let current = folderId ? getFolderById(folderId, folders) : null;
  while (current) {
    const isSelf = current.id === folderId;
    if ((includeSelf || !isSelf) && isFolderProtected(current) && !unlockedSet.has(current.id)) {
      return current;
    }
    current = current.parentId ? getFolderById(current.parentId, folders) : null;
  }
  return null;
}

function assertFolderAccessible(folderId, folders, unlockedSet = lockedFolderIds) {
  const lockedFolder = getLockedFolderForFolderId(folderId, folders, unlockedSet, true);
  if (!lockedFolder) {
    return;
  }
  const error = new Error(`文件夹「${lockedFolder.name}」已加密，请先输入密码`);
  error.code = 'FOLDER_LOCKED';
  error.folderId = lockedFolder.id;
  error.folderName = lockedFolder.name;
  throw error;
}

function isFolderVisibleToClient(folder, folders, unlockedSet = lockedFolderIds) {
  return !getLockedFolderForFolderId(folder.parentId, folders, unlockedSet, true);
}

function getVisibleNotes(notes, folders, unlockedSet = lockedFolderIds) {
  return notes.filter((note) => !getLockedFolderForFolderId(note.folderId, folders, unlockedSet, true));
}

function cleanupUnlockedFolders(folders, unlockedSet = lockedFolderIds) {
  const validFolderIds = new Set(folders.map((folder) => folder.id));
  for (const folderId of [...unlockedSet]) {
    if (!validFolderIds.has(folderId)) {
      unlockedSet.delete(folderId);
    }
  }
}

function getFolderPathParts(folder, folders) {
  const parts = [];
  let current = folder;
  while (current) {
    parts.unshift(current.name);
    current = folders.find((item) => item.id === current.parentId);
  }
  return parts;
}

function fillFolderPaths(folders) {
  for (const folder of folders) {
    folder.path = getFolderPathParts(folder, folders).join(' / ');
  }
}

async function scanNotesDirectory(dirPath, folderId, folders, metadata, notes) {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    const fileExtension = path.extname(entry.name).toLowerCase();

    if (entry.isFile() && ['.md', '.txt', '.json'].includes(fileExtension) && entry.name !== '.folder.json') {
      try {
        const raw = await fs.readFile(fullPath, 'utf8');
        const stats = await fs.stat(fullPath);
        const parsed = fileExtension === '.md' ? matter(raw) : { data: {}, content: raw };
        const metadataKey = getNoteMetadataKey(fullPath);
        const storedMetadata = metadata[metadataKey] || {};
        const fileTitle = path.basename(entry.name, fileExtension);
        const isLegacyNote = fileExtension === '.md' && Boolean(parsed.data.id
          && parsed.data.title
          && parsed.data.createdAt
          && parsed.data.updatedAt
          && Array.isArray(parsed.data.reminders));
        const note = normalizeLoadedNote({
          ...(isLegacyNote ? parsed.data : {}),
          ...storedMetadata,
          title: storedMetadata.title || (isLegacyNote ? parsed.data.title : null) || fileTitle,
          content: isLegacyNote ? parsed.content : raw,
          fileType: fileExtension.slice(1),
          folderId,
          createdAt: storedMetadata.createdAt
            || (isLegacyNote ? parsed.data.createdAt : null)
            || stats.birthtime.toISOString(),
          updatedAt: getLatestDateTime(
            storedMetadata.updatedAt,
            isLegacyNote ? parsed.data.updatedAt : null,
            stats.mtime.toISOString()
          )
        });
        note.sourcePath = fullPath;
        note.sourceIsLegacy = isLegacyNote;
        notes.push(note);
      } catch (error) {
        console.error(`读取笔记文件失败: ${entry.name}`, error);
      }
    } else if (entry.isDirectory() && !isInternalDirectory(entry.name)) {
      const folder = folders.find((item) => item.name === entry.name && item.parentId === folderId);
      if (folder) {
        await scanNotesDirectory(fullPath, folder.id, folders, metadata, notes);
      }
    }
  }
}

function getFolderNameById(folderId, folders) {
  if (!folderId) {
    return '全部笔记';
  }
  return folders.find((folder) => folder.id === folderId)?.name || '未命名文件夹';
}

function getFolderBreadcrumb(folderId, folders) {
  const folder = folders.find((item) => item.id === folderId);
  return folder ? folder.path : '全部笔记';
}

function createMobileNoteSummary(note, folders) {
  const plainContent = String(note.content || '').replace(/\s+/g, ' ').trim();
  return {
    id: note.id,
    title: note.title,
    folderId: note.folderId || null,
    folderName: getFolderNameById(note.folderId, folders),
    folderPath: getFolderBreadcrumb(note.folderId, folders),
    fileType: note.fileType,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
    reminders: note.reminders,
    isDailyReview: false,
    isReminderFile: false,
    preview: plainContent.slice(0, 120)
  };
}

function createMobileFolderSummary(folder, unlockedSet = lockedFolderIds) {
  return {
    ...sanitizeFolderForClient(folder, unlockedSet),
    path: folder.path || ''
  };
}

async function loadLibrary(mobileUnlockedFolderIds) {
  const folders = [];
  const notes = [];
  const metadata = await loadNoteMetadata();
  await scanFolderDirectory(getNotesPath(), null, folders);
  fillFolderPaths(folders);
  await scanNotesDirectory(getNotesPath(), null, folders, metadata, notes);
  notes.sort((left, right) => new Date(right.updatedAt) - new Date(left.updatedAt));
  cleanupUnlockedFolders(folders, mobileUnlockedFolderIds);
  const visibleFolders = folders.filter((folder) => {
    return isFolderVisibleToClient(folder, folders, mobileUnlockedFolderIds);
  });
  const visibleNotes = getVisibleNotes(notes, folders, mobileUnlockedFolderIds);

  return {
    app: {
      name: 'Notice Note',
      storagePath: getNotesPath(),
      readOnly: false,
      standalone: true,
      generatedAt: new Date().toISOString()
    },
    folders: visibleFolders.map((folder) => createMobileFolderSummary(folder, mobileUnlockedFolderIds)),
    notes: visibleNotes.map((note) => createMobileNoteSummary(note, folders)),
    noteDetails: notes,
    allFolders: folders,
    files: []
  };
}

async function loadCachedLibrary(mobileUnlockedFolderIds) {
  for (const [key, entry] of mobileLibraryCache) {
    if (entry.expiresAt <= Date.now()) {
      mobileLibraryCache.delete(key);
    }
  }
  const cacheKey = [...mobileUnlockedFolderIds].sort().join('\n');
  const cached = mobileLibraryCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.library;
  }
  const library = await loadLibrary(mobileUnlockedFolderIds);
  mobileLibraryCache.set(cacheKey, {
    library,
    expiresAt: Date.now() + MOBILE_LIBRARY_CACHE_MAX_AGE
  });
  return library;
}

function getMobileStaticDir() {
  return path.resolve(__dirname, '../notice_note_client_app/src');
}

function getMobileAccessUrl() {
  return `http://${MOBILE_SERVER_HOST}:${MOBILE_SERVER_PORT}/?token=${encodeURIComponent(mobileAccessToken)}`;
}

function isPathInside(parentPath, targetPath) {
  const relativePath = path.relative(parentPath, targetPath);
  return relativePath === '' || (!relativePath.startsWith('..') && !path.isAbsolute(relativePath));
}

function getMimeType(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  const mimeTypes = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.bmp': 'image/bmp',
    '.ico': 'image/x-icon'
  };
  return mimeTypes[extension] || 'application/octet-stream';
}

function getMobileImageCacheKey(filePath, sourceStats) {
  return createHash('sha256')
    .update([
      path.resolve(filePath),
      String(sourceStats.size),
      String(Math.trunc(sourceStats.mtimeMs)),
      String(MOBILE_IMAGE_CACHE_VERSION),
      String(MOBILE_IMAGE_MAX_WIDTH),
      String(MOBILE_IMAGE_JPEG_QUALITY)
    ].join('\n'))
    .digest('hex');
}

async function createOptimizedMobileImage(filePath, sourceStats) {
  const extension = path.extname(filePath).toLowerCase();
  if (!MOBILE_IMAGE_OPTIMIZABLE_EXTENSIONS.has(extension)
    || sourceStats.size < MOBILE_IMAGE_MIN_OPTIMIZE_BYTES) {
    return null;
  }

  const cacheKey = getMobileImageCacheKey(filePath, sourceStats);
  const candidates = [
    { extension: '.jpg', mimeType: 'image/jpeg' },
    { extension: '.png', mimeType: 'image/png' }
  ];

  for (const candidate of candidates) {
    const cachePath = path.join(getMobileImageCacheDir(), `${cacheKey}${candidate.extension}`);
    try {
      return {
        content: await fs.readFile(cachePath),
        mimeType: candidate.mimeType,
        cacheKey
      };
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  const sourceImage = sharp(filePath, { failOn: 'none' });
  const metadata = await sourceImage.metadata();
  if (!metadata.width || !metadata.height || Number(metadata.pages || 1) > 1) {
    return null;
  }

  const outputImage = sourceImage
    .rotate()
    .resize({
      width: MOBILE_IMAGE_MAX_WIDTH,
      fit: 'inside',
      withoutEnlargement: true
    });
  let preserveTransparency = false;
  if (metadata.hasAlpha) {
    const pixelStats = await sharp(filePath, { failOn: 'none' }).stats();
    preserveTransparency = !pixelStats.isOpaque;
  }
  const outputExtension = preserveTransparency ? '.png' : '.jpg';
  const outputMimeType = preserveTransparency ? 'image/png' : 'image/jpeg';
  const content = await (preserveTransparency
    ? outputImage.png({ compressionLevel: 9, adaptiveFiltering: true })
    : outputImage.jpeg({
      quality: MOBILE_IMAGE_JPEG_QUALITY,
      mozjpeg: true,
      chromaSubsampling: '4:4:4'
    })).toBuffer();

  if (!content.length || content.length >= sourceStats.size) {
    return null;
  }

  await fs.mkdir(getMobileImageCacheDir(), { recursive: true });
  await fs.writeFile(path.join(getMobileImageCacheDir(), `${cacheKey}${outputExtension}`), content);
  return {
    content,
    mimeType: outputMimeType,
    cacheKey
  };
}

function createMobileImageEtag(filePath, sourceStats, variantKey = 'original') {
  const signature = [
    path.resolve(filePath),
    String(sourceStats.size),
    String(Math.trunc(sourceStats.mtimeMs)),
    variantKey
  ].join('\n');
  return `"${createHash('sha256').update(signature).digest('hex').slice(0, 32)}"`;
}

function writeCorsHeaders(response) {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
}

function writeJson(response, statusCode, payload) {
  writeCorsHeaders(response);
  response.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(payload));
}

function getMobileCryptoKey(token = mobileAccessToken) {
  return createHash('sha256').update(String(token || ''), 'utf8').digest();
}

function encryptMobilePayload(payload, token = mobileAccessToken) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', getMobileCryptoKey(token), iv);
  const compressed = gzipSync(Buffer.from(JSON.stringify(payload), 'utf8'));
  const encrypted = Buffer.concat([
    cipher.update(compressed),
    cipher.final()
  ]);
  const tag = cipher.getAuthTag();
  return {
    encrypted: true,
    compression: 'gzip',
    iv: iv.toString('base64'),
    data: Buffer.concat([encrypted, tag]).toString('base64')
  };
}

function decryptMobilePayload(envelope, token = mobileAccessToken) {
  if (!envelope || envelope.encrypted !== true || !envelope.iv || !envelope.data) {
    throw new Error('加密请求格式不正确');
  }

  const raw = Buffer.from(envelope.data, 'base64');
  if (raw.length <= 16) {
    throw new Error('加密请求内容不完整');
  }

  const decipher = createDecipheriv(
    'aes-256-gcm',
    getMobileCryptoKey(token),
    Buffer.from(envelope.iv, 'base64')
  );
  decipher.setAuthTag(raw.subarray(raw.length - 16));
  const decrypted = Buffer.concat([
    decipher.update(raw.subarray(0, raw.length - 16)),
    decipher.final()
  ]);
  return JSON.parse(decrypted.toString('utf8'));
}

function writeEncryptedJson(response, statusCode, payload, token = mobileAccessToken) {
  writeJson(response, statusCode, encryptMobilePayload(payload, token));
}

async function readRequestJson(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  return raw ? JSON.parse(raw) : {};
}

function isMobileRequestAuthorized(request, requestUrl) {
  return getMobileRequestToken(request, requestUrl) === mobileAccessToken;
}

function getMobileRequestToken(request, requestUrl) {
  const authorization = request.headers.authorization || '';
  const bearerToken = authorization.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length).trim()
    : '';
  return bearerToken || requestUrl.searchParams.get('token') || '';
}

function normalizeMobileSessionId(value) {
  const sessionId = String(value || '').trim();
  return /^[a-z0-9_-]{16,128}$/i.test(sessionId) ? sessionId : '';
}

function cleanupMobileUnlockSessions(now = Date.now()) {
  for (const [sessionId, session] of mobileUnlockSessions) {
    if (now - session.lastSeenAt > MOBILE_UNLOCK_SESSION_MAX_AGE) {
      mobileUnlockSessions.delete(sessionId);
    }
  }
}

function getMobileUnlockSession(sessionId) {
  cleanupMobileUnlockSessions();
  if (!sessionId) {
    return { unlockedFolderIds: new Set(), lastSeenAt: Date.now() };
  }

  let session = mobileUnlockSessions.get(sessionId);
  if (!session) {
    session = { unlockedFolderIds: new Set(), lastSeenAt: Date.now() };
    mobileUnlockSessions.set(sessionId, session);
  } else {
    session.lastSeenAt = Date.now();
  }
  return session;
}

function clearMobileUnlockSession(sessionId, unlockedSet) {
  unlockedSet.clear();
  if (sessionId) {
    mobileUnlockSessions.delete(sessionId);
  }
}

function isRelativeMarkdownImagePath(value) {
  return Boolean(value) && !/^(?:[a-z][a-z\d+.-]*:|\/\/|\/|#)/i.test(value);
}

function convertNoteImages(content, noteSourcePath) {
  const text = String(content || '');
  const notesDir = path.resolve(getNotesPath());
  return text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, imageSource) => {
    try {
      const source = String(imageSource || '').trim();
      let filePath;
      if (source.startsWith('file:')) {
        filePath = path.resolve(fileURLToPath(source));
      } else if (noteSourcePath && isRelativeMarkdownImagePath(source)) {
        const relativePath = decodeURIComponent(source.split(/[?#]/, 1)[0]);
        filePath = path.resolve(path.dirname(noteSourcePath), relativePath);
      } else {
        return match;
      }
      if (!isPathInside(notesDir, filePath)) {
        return match;
      }
      const relPath = path.relative(notesDir, filePath).replace(/\\/g, '/');
      return `![${alt}](mobile-image://${relPath})`;
    } catch {
      return match;
    }
  });
}

async function saveMobileNote(note, input) {
  const title = String(input.title || '').trim() || '未命名笔记';
  const content = String(input.content || '');
  const updatedAt = new Date().toISOString();
  let fileContent = content;

  if (note.sourceIsLegacy && note.fileType === 'md') {
    const raw = await fs.readFile(note.sourcePath, 'utf8');
    const parsed = matter(raw);
    fileContent = matter.stringify(content, {
      ...parsed.data,
      title,
      updatedAt
    });
  }

  await fs.writeFile(note.sourcePath, fileContent, 'utf8');
  const metadata = await loadNoteMetadata();
  const metadataKey = getNoteMetadataKey(note.sourcePath);
  metadata[metadataKey] = {
    ...(metadata[metadataKey] || {}),
    id: note.id,
    title,
    createdAt: note.createdAt,
    updatedAt,
    reminders: Array.isArray(note.reminders) ? note.reminders : []
  };
  await fs.mkdir(getAppDataPath(), { recursive: true });
  await fs.writeFile(getNoteMetadataPath(), JSON.stringify(metadata, null, 2), 'utf8');

  note.title = title;
  note.content = content;
  note.updatedAt = updatedAt;
  return note;
}

async function handleMobileApiPayload(apiRequest, library, mobileUnlockedFolderIds, sessionId) {
  const method = String(apiRequest?.method || 'GET').toUpperCase();
  const requestPath = String(apiRequest?.path || '');
  if (requestPath === '/api/image-data' && method === 'POST') {
    const src = apiRequest.src;
    if (!src) {
      return { statusCode: 400, payload: { error: '缺少 src 参数' } };
    }
    const notesDir = path.resolve(getNotesPath());
    let filePath;
    try {
      if (src.startsWith('file:')) {
        filePath = path.resolve(fileURLToPath(src));
      } else {
        filePath = path.resolve(notesDir, src);
      }
    } catch {
      return { statusCode: 400, payload: { error: '图片路径无效' } };
    }
    if (!isPathInside(notesDir, filePath)) {
      return { statusCode: 403, payload: { error: '禁止访问' } };
    }
    try {
      const buffer = await fs.readFile(filePath);
      const mimeType = getMimeType(filePath);
      return {
        statusCode: 200,
        payload: {
          data: buffer.toString('base64'),
          mimeType
        }
      };
    } catch {
      return { statusCode: 404, payload: { error: '图片不存在' } };
    }
  }

  const updateNoteMatch = requestPath.match(/^\/api\/notes\/([^/]+)$/);
  if (updateNoteMatch && method === 'PUT') {
    const noteId = decodeURIComponent(updateNoteMatch[1]);
    const note = library.noteDetails.find((item) => item.id === noteId);
    if (!note) {
      return { statusCode: 404, payload: { error: '笔记不存在' } };
    }
    try {
      assertFolderAccessible(note.folderId, library.allFolders || [], mobileUnlockedFolderIds);
      const updatedNote = await saveMobileNote(note, apiRequest);
      mobileLibraryCache.clear();
      return {
        statusCode: 200,
        payload: {
          ...createMobileNoteSummary(updatedNote, library.allFolders || []),
          editableContent: updatedNote.content,
          content: convertNoteImages(updatedNote.content, updatedNote.sourcePath)
        }
      };
    } catch (error) {
      if (error.code === 'FOLDER_LOCKED') {
        return {
          statusCode: 423,
          payload: {
            error: error.message,
            code: error.code,
            folderId: error.folderId,
            folderName: error.folderName
          }
        };
      }
      throw error;
    }
  }

  if (method === 'POST') {
    if (requestPath === '/api/session/lock') {
      clearMobileUnlockSession(sessionId, mobileUnlockedFolderIds);
      return {
        statusCode: 200,
        payload: { ok: true }
      };
    }
    const unlockMatch = requestPath.match(/^\/api\/folders\/([^/]+)\/unlock$/);
    if (unlockMatch) {
      if (!sessionId) {
        return {
          statusCode: 426,
          payload: { error: '当前移动端版本过旧，请安装最新版后再解锁加密文件夹' }
        };
      }
      const folder = getFolderById(decodeURIComponent(unlockMatch[1]), library.allFolders || []);
      if (!folder) {
        return {
          statusCode: 404,
          payload: { error: '文件夹不存在' }
        };
      }
      if (!isFolderProtected(folder)) {
        return {
          statusCode: 200,
          payload: sanitizeFolderForClient(folder, mobileUnlockedFolderIds)
        };
      }
      if (!verifyFolderPassword(folder, apiRequest.password)) {
        return {
          statusCode: 401,
          payload: { error: '密码不正确' }
        };
      }
      mobileUnlockedFolderIds.add(folder.id);
      return {
        statusCode: 200,
        payload: sanitizeFolderForClient(folder, mobileUnlockedFolderIds)
      };
    }
    const lockMatch = requestPath.match(/^\/api\/folders\/([^/]+)\/lock$/);
    if (lockMatch) {
      const folderId = decodeURIComponent(lockMatch[1]);
      mobileUnlockedFolderIds.delete(folderId);
      return {
        statusCode: 200,
        payload: { ok: true }
      };
    }
    return {
      statusCode: 405,
      payload: { error: '当前移动端接口不支持该操作' }
    };
  }

  if (method !== 'GET') {
    return {
      statusCode: 405,
      payload: { error: '当前移动端接口仅支持读取' }
    };
  }

  if (requestPath === '/api/health') {
    return {
      statusCode: 200,
      payload: {
        ok: true,
        readOnly: false,
        standalone: true,
        noteCount: library.notes.length,
        folderCount: library.folders.length,
        fileCount: library.files.length
      }
    };
  }

  if (requestPath === '/api/library') {
    const folderId = apiRequest.folderId || null;
    const keyword = String(apiRequest.query || '').trim().toLocaleLowerCase('zh-CN');
    const selectedNotes = keyword
      ? library.notes.filter((note) => [note.title, note.preview, note.folderName, note.folderPath]
        .some((value) => String(value || '').toLocaleLowerCase('zh-CN').includes(keyword)))
      : library.notes.filter((note) => (note.folderId || null) === folderId);
    const payload = {
      app: library.app,
      folders: library.folders.map((folder) => ({
        ...folder,
        noteCount: library.notes.filter((note) => note.folderId === folder.id).length
      })),
      notes: selectedNotes,
      total: selectedNotes.length,
      files: []
    };
    return {
      statusCode: 200,
      payload
    };
  }

  const noteMatch = requestPath.match(/^\/api\/notes\/([^/]+)$/);
  if (noteMatch) {
    const noteId = decodeURIComponent(noteMatch[1]);
    const note = library.noteDetails.find((item) => item.id === noteId);
    if (!note) {
      return {
        statusCode: 404,
        payload: { error: '笔记不存在' }
      };
    }
    try {
      assertFolderAccessible(note.folderId, library.allFolders || [], mobileUnlockedFolderIds);
      const inlinedContent = convertNoteImages(note.content || '', note.sourcePath);
      return {
        statusCode: 200,
        payload: {
          ...createMobileNoteSummary(note, library.allFolders || []),
          editableContent: note.content || '',
          content: inlinedContent
        }
      };
    } catch (error) {
      if (error.code === 'FOLDER_LOCKED') {
        return {
          statusCode: 423,
          payload: {
            error: error.message,
            code: error.code,
            folderId: error.folderId,
            folderName: error.folderName
          }
        };
      }
      throw error;
    }
  }

  return {
    statusCode: 404,
    payload: { error: '接口不存在' }
  };
}

async function handleMobileApiRequest(request, response, requestUrl) {
  if (request.method === 'OPTIONS') {
    writeCorsHeaders(response);
    response.writeHead(204);
    response.end();
    return;
  }

  const requestToken = getMobileRequestToken(request, requestUrl);
  if (!isMobileRequestAuthorized(request, requestUrl)) {
    if (requestToken) {
      writeEncryptedJson(response, 401, { error: '访问令牌无效' }, requestToken);
      return;
    }
    writeJson(response, 401, { error: '访问令牌无效' });
    return;
  }

  if (requestUrl.pathname === '/api/image' && request.method === 'GET') {
    await serveMobileImage(request, response, requestUrl);
    return;
  }

  if (requestUrl.pathname !== '/api/secure') {
    writeEncryptedJson(response, 426, { error: '请使用加密接口访问移动端数据' });
    return;
  }

  if (request.method !== 'POST') {
    writeEncryptedJson(response, 405, { error: '加密接口仅支持 POST' });
    return;
  }

  try {
    const envelope = await readRequestJson(request);
    const apiRequest = decryptMobilePayload(envelope);
    const sessionId = normalizeMobileSessionId(apiRequest.sessionId);
    const session = getMobileUnlockSession(sessionId);
    const library = await loadCachedLibrary(session.unlockedFolderIds);
    const { statusCode, payload } = await handleMobileApiPayload(
      apiRequest,
      library,
      session.unlockedFolderIds,
      sessionId
    );
    writeEncryptedJson(response, statusCode, payload);
  } catch (error) {
    writeEncryptedJson(response, 400, { error: '加密请求解析失败' });
  }
}

async function serveMobileImage(request, response, requestUrl) {
  const src = requestUrl.searchParams.get('src');
  if (!src) {
    response.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('缺少 src 参数');
    return;
  }

  const notesDir = path.resolve(getNotesPath());
  let filePath;
  try {
    if (src.startsWith('file:')) {
      filePath = path.resolve(fileURLToPath(src));
    } else {
      filePath = path.resolve(notesDir, decodeURIComponent(src));
    }
  } catch {
    response.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('图片路径无效');
    return;
  }

  if (!isPathInside(notesDir, filePath)) {
    response.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('禁止访问');
    return;
  }

  try {
    const sourceStats = await fs.stat(filePath);
    if (!sourceStats.isFile()) {
      throw new Error('图片路径不是文件');
    }
    let optimizedImage = null;
    try {
      optimizedImage = await createOptimizedMobileImage(filePath, sourceStats);
    } catch (error) {
      console.warn('生成移动端图片缓存失败，将返回原图:', error.message);
    }
    const content = optimizedImage?.content || await fs.readFile(filePath);
    const mimeType = optimizedImage?.mimeType || getMimeType(filePath);
    const etag = createMobileImageEtag(filePath, sourceStats, optimizedImage?.cacheKey);
    writeCorsHeaders(response);
    if (request.headers['if-none-match'] === etag) {
      response.writeHead(304, {
        'Cache-Control': `private, max-age=${MOBILE_IMAGE_CACHE_MAX_AGE}`,
        ETag: etag
      });
      response.end();
      return;
    }
    response.writeHead(200, {
      'Content-Type': mimeType,
      'Content-Length': content.length,
      'Cache-Control': `private, max-age=${MOBILE_IMAGE_CACHE_MAX_AGE}`,
      ETag: etag,
      'X-Content-Type-Options': 'nosniff'
    });
    response.end(content);
  } catch {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('图片不存在');
  }
}

async function serveMobileStaticFile(response, requestPath) {
  const staticDir = getMobileStaticDir();
  const normalizedPath = requestPath === '/' ? '/index.html' : requestPath;
  const targetPath = path.resolve(staticDir, `.${decodeURIComponent(normalizedPath)}`);

  if (!isPathInside(staticDir, targetPath)) {
    response.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('禁止访问');
    return;
  }

  try {
    const content = await fs.readFile(targetPath);
    const isHtml = path.extname(targetPath).toLowerCase() === '.html';
    response.writeHead(200, {
      'Content-Type': getMimeType(targetPath),
      'Cache-Control': isHtml ? 'no-cache' : 'public, max-age=86400'
    });
    response.end(content);
  } catch (error) {
    response.writeHead(error.code === 'ENOENT' ? 404 : 500, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end(error.code === 'ENOENT' ? '页面不存在' : '读取页面失败');
  }
}

async function startServer() {
  await loadConfig();

  const server = createServer((request, response) => {
    Promise.resolve()
      .then(async () => {
        const requestUrl = new URL(request.url || '/', getMobileAccessUrl());
        if (requestUrl.pathname.startsWith('/api/')) {
          await handleMobileApiRequest(request, response, requestUrl);
          return;
        }
        await serveMobileStaticFile(response, requestUrl.pathname);
      })
      .catch((error) => {
        console.error('移动端独立服务处理请求失败:', error);
        writeJson(response, 500, { error: '移动端独立服务异常' });
      });
  });

  server.listen(MOBILE_SERVER_PORT, MOBILE_SERVER_HOST, () => {
    console.log(`移动端独立服务已启动: ${getMobileAccessUrl()}`);
    console.log(`NATAPP 请反代到: ${MOBILE_SERVER_HOST}:${MOBILE_SERVER_PORT}`);
    console.log(`当前笔记目录: ${getNotesPath()}`);
  });
}

startServer().catch((error) => {
  console.error('启动移动端独立服务失败:', error);
  process.exit(1);
});
