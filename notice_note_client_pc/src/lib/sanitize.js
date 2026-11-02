// 文件名与文件夹名清洗（纯函数）

function sanitizeFileName(fileName) {
  return String(fileName || 'image')
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    || 'image';
}

function sanitizeNoteFilename(title) {
  let name = String(title || '未命名笔记')
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\.+$/, '');
  return name || '未命名笔记';
}

function sanitizeFolderName(name) {
  return String(name || '新建文件夹')
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    || '新建文件夹';
}

module.exports = {
  sanitizeFileName,
  sanitizeNoteFilename,
  sanitizeFolderName
};
