const { createServer } = require('node:http');
const path = require('node:path');
const fs = require('node:fs/promises');
const { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } = require('node:crypto');
const matter = require('gray-matter');

const NOTES_DIR_NAME = 'notes';
const CONFIG_FILE_NAME = 'config.json';
const IMAGE_ASSET_DIR_NAME = 'notice_note_images';
const APP_DATA_DIR_NAME = '.notice-note';
const NOTE_METADATA_FILE_NAME = 'metadata.json';
const MOBILE_SERVER_HOST = process.env.NOTICE_NOTE_MOBILE_HOST || '127.0.0.1';
const MOBILE_SERVER_PORT = Number(process.env.NOTICE_NOTE_MOBILE_PORT || 39271);

let notesPath = null;
let mobileAccessToken = null;

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
      path: ''
    };
    folders.push(folder);
    await scanFolderDirectory(folderPath, folder.id, folders);
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

async function loadLibrary() {
  const folders = [];
  const notes = [];
  const metadata = await loadNoteMetadata();
  await scanFolderDirectory(getNotesPath(), null, folders);
  fillFolderPaths(folders);
  await scanNotesDirectory(getNotesPath(), null, folders, metadata, notes);
  notes.sort((left, right) => new Date(right.updatedAt) - new Date(left.updatedAt));

  return {
    app: {
      name: 'Notice Note',
      storagePath: getNotesPath(),
      readOnly: true,
      standalone: true,
      generatedAt: new Date().toISOString()
    },
    folders,
    notes: notes.map((note) => createMobileNoteSummary(note, folders)),
    noteDetails: notes,
    files: []
  };
}

function getMobileStaticDir() {
  return path.join(__dirname, 'mobile');
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
    '.ico': 'image/x-icon'
  };
  return mimeTypes[extension] || 'application/octet-stream';
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
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(payload), 'utf8'),
    cipher.final()
  ]);
  const tag = cipher.getAuthTag();
  return {
    encrypted: true,
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

function handleMobileApiPayload(apiRequest, library) {
  const method = String(apiRequest?.method || 'GET').toUpperCase();
  const requestPath = String(apiRequest?.path || '');
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
        readOnly: true,
        standalone: true,
        noteCount: library.notes.length,
        folderCount: library.folders.length,
        fileCount: library.files.length
      }
    };
  }

  if (requestPath === '/api/library') {
    const { noteDetails, ...payload } = library;
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
    return {
      statusCode: 200,
      payload: {
        ...createMobileNoteSummary(note, library.folders),
        content: note.content || ''
      }
    };
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
    const library = await loadLibrary();
    const { statusCode, payload } = handleMobileApiPayload(apiRequest, library);
    writeEncryptedJson(response, statusCode, payload);
  } catch (error) {
    writeEncryptedJson(response, 400, { error: '加密请求解析失败' });
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
    response.writeHead(200, {
      'Content-Type': getMimeType(targetPath),
      'Cache-Control': 'no-cache'
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
