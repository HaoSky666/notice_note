// 文件名与文件夹名清洗（纯函数）
// Windows 约束：非法字符、设备保留名、尾部空格/点、单段长度上限。
// 这些限制在 Linux/macOS 上同样保守地生效，保证存储目录跨平台迁移不会失败。

const INVALID_FILENAME_CHARS = /[<>:"/\\|?*\x00-\x1F]/g;
const WINDOWS_RESERVED_NAMES = new Set([
  'CON', 'PRN', 'AUX', 'NUL', 'CONIN$', 'CONOUT$',
  'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
  'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'
]);
// 单段名称留到 180 字符：给扩展名、去重后缀和上层目录路径留余量。
const MAX_NAME_LENGTH = 180;
// 应用内部目录名，用户不得手工创建（会与元数据目录/回顾目录冲突）。
const INTERNAL_FOLDER_NAMES = new Set(['.notice-note', '.study_notice']);

function shortHash(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36).slice(0, 6);
}

function truncateWithHash(name) {
  if (name.length <= MAX_NAME_LENGTH) {
    return name;
  }
  const suffix = `-${shortHash(name)}`;
  return `${name.slice(0, MAX_NAME_LENGTH - suffix.length)}${suffix}`;
}

// 去掉尾部空格与点：Windows 会静默去掉，导致「目录存在但路径对不上」。
function trimWindowsTail(name) {
  return name.replace(/[ .]+$/g, '');
}

// 设备保留名带不带扩展名都被占用（CON.txt 同样非法）。
function isWindowsReservedName(name) {
  const stem = String(name || '').split('.')[0].toUpperCase();
  return WINDOWS_RESERVED_NAMES.has(stem);
}

function sanitizeBaseName(value, fallback) {
  const name = trimWindowsTail(
    String(value || fallback)
      .replace(INVALID_FILENAME_CHARS, '_')
      .replace(/\s+/g, ' ')
      .trim()
  ) || fallback;
  const safeName = isWindowsReservedName(name) ? `_${name}` : name;
  return truncateWithHash(safeName);
}

function sanitizeFileName(fileName) {
  return sanitizeBaseName(fileName, 'image');
}

function sanitizeNoteFilename(title) {
  return sanitizeBaseName(title, '未命名笔记');
}

function sanitizeFolderName(name) {
  return sanitizeBaseName(name, '新建文件夹');
}

function isInternalFolderName(name) {
  return INTERNAL_FOLDER_NAMES.has(String(name || '').trim());
}

// 扫描阶段跳过点文件/点目录；回顾目录是唯一放行的隐藏目录。
function shouldSkipScanEntry(name, isDirectory, reviewFolderName = '.study_notice') {
  if (!String(name || '').startsWith('.')) {
    return false;
  }
  return !(isDirectory && name === reviewFolderName);
}

module.exports = {
  MAX_NAME_LENGTH,
  INTERNAL_FOLDER_NAMES,
  sanitizeFileName,
  sanitizeNoteFilename,
  sanitizeFolderName,
  isWindowsReservedName,
  isInternalFolderName,
  shouldSkipScanEntry
};
