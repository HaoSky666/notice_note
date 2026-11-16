const test = require('node:test');
const assert = require('node:assert/strict');
const {
  MAX_NAME_LENGTH,
  sanitizeFileName,
  sanitizeNoteFilename,
  sanitizeFolderName,
  isWindowsReservedName,
  isInternalFolderName,
  shouldSkipScanEntry
} = require('../notice_note_client_pc/src/lib/sanitize');

test('Windows 设备保留名会加前缀，带扩展名也一样', () => {
  assert.equal(sanitizeNoteFilename('CON'), '_CON');
  assert.equal(sanitizeFolderName('aux'), '_aux');
  assert.equal(sanitizeFileName('COM1.png'), '_COM1.png');
  assert.equal(sanitizeNoteFilename('lpt9.txt'), '_lpt9.txt');
  assert.equal(sanitizeNoteFilename('console'), 'console');
  assert.equal(isWindowsReservedName('NUL'), true);
  assert.equal(isWindowsReservedName('NULL'), false);
});

test('非法字符、连续空白与尾部空格/点被清理', () => {
  assert.equal(sanitizeNoteFilename('  a/b:c  '), 'a_b_c');
  assert.equal(sanitizeFolderName('目录  '), '目录');
  assert.equal(sanitizeFolderName('目录...'), '目录');
  assert.equal(sanitizeNoteFilename('笔记.'), '笔记');
  assert.equal(sanitizeFolderName('a  b'), 'a b');
  assert.equal(sanitizeNoteFilename(''), '未命名笔记');
  assert.equal(sanitizeFolderName('   '), '新建文件夹');
});

test('超长名称截断且带稳定短 hash，避免不同长标题撞名', () => {
  const long = '标'.repeat(400);
  const a = sanitizeNoteFilename(long);
  const b = sanitizeNoteFilename(`${long}题`);
  assert.ok(a.length <= MAX_NAME_LENGTH);
  assert.ok(b.length <= MAX_NAME_LENGTH);
  assert.notEqual(a, b);
  assert.equal(sanitizeNoteFilename(long), a, '同一输入必须稳定');
});

test('内部目录名不允许用户手工创建', () => {
  assert.equal(isInternalFolderName('.notice-note'), true);
  assert.equal(isInternalFolderName('.study_notice'), true);
  assert.equal(isInternalFolderName('普通目录'), false);
  // 清洗后不能把保留名「洗掉」：调用方应先用 isInternalFolderName 判断再拒绝
  assert.equal(isInternalFolderName(' .notice-note '), true);
});

test('扫描时跳过点文件/点目录，但放行回顾目录', () => {
  assert.equal(shouldSkipScanEntry('.git', true), true);
  assert.equal(shouldSkipScanEntry('.DS_Store', false), true);
  assert.equal(shouldSkipScanEntry('.gitignore', false), true);
  assert.equal(shouldSkipScanEntry('.notice-note', true), true);
  assert.equal(shouldSkipScanEntry('.study_notice', true), false);
  assert.equal(shouldSkipScanEntry('.study_notice', false), true);
  assert.equal(shouldSkipScanEntry('notes', true), false);
  assert.equal(shouldSkipScanEntry('a.pdf', false), false);
});
