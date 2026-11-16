const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createEmptyNote,
  normalizeNoteFileType,
  getNoteFileExtension,
  normalizeNote,
  normalizeLoadedNote,
  normalizeReminderList
} = require('../notice_note_client_pc/src/lib/note-normalize');

test('P1-14 回归：未知文件类型一律归一化为 md，扩展名只有三种', () => {
  assert.equal(normalizeNoteFileType('txt'), 'txt');
  assert.equal(normalizeNoteFileType('json'), 'json');
  assert.equal(normalizeNoteFileType('richtext'), 'md');
  assert.equal(normalizeNoteFileType(undefined), 'md');
  assert.equal(getNoteFileExtension('txt'), '.txt');
  assert.equal(getNoteFileExtension('json'), '.json');
  assert.equal(getNoteFileExtension('richtext'), '.md');
  assert.equal(getNoteFileExtension('md'), '.md');
});

test('normalizeNote 保留归天日期，丢弃非法值', () => {
  const note = normalizeNote({
    title: '  复习  ', content: '# hi',
    reviewDate: '2026-11-12'
  });
  assert.equal(note.title, '复习');
  assert.equal(note.reviewDate, '2026-11-12');
  assert.equal(note.fileType, 'md');
  assert.deepEqual(note.reminders, []);
  assert.equal(normalizeNote({ reviewDate: '2026-1-2' }).reviewDate, null);
  // 主/次文件概念已移除：旧 metadata 里的 reviewRole 读入即丢弃
  assert.equal(normalizeNote({ reviewRole: 'primary' }).reviewRole, undefined);
  assert.equal(normalizeLoadedNote({ reviewRole: 'secondary' }).reviewRole, undefined);
});

test('normalizeLoadedNote 不篡改已有时间戳（扫描时保持归天稳定）', () => {
  const loaded = normalizeLoadedNote({
    title: '旧笔记', createdAt: '2020-01-01T00:00:00.000Z',
    updatedAt: '2021-02-03T00:00:00.000Z', content: 'x'
  });
  assert.equal(loaded.createdAt, '2020-01-01T00:00:00.000Z');
  assert.equal(loaded.updatedAt, '2021-02-03T00:00:00.000Z');
});

test('旧版 reminders 作为历史数据仍可归一化（迁移链路不能断）', () => {
  const list = normalizeReminderList([
    { date: '2026-01-01', done: true },
    { time: '2026-02-03T09:30:00.000Z' },
    null,
    {}
  ]);
  assert.equal(list.length, 2);
  assert.equal(list[0].date, '2026-01-01');
  assert.deepEqual(list[0].firedSlots, ['09:30', '15:00']);
  assert.equal(list[0].done, true);
  assert.equal(list[1].date, '2026-02-03');
});

test('R1 回归：空库自动创建的笔记首屏就能被侧边栏过滤出来', () => {
  const note = createEmptyNote();
  assert.ok(note.id);
  assert.equal(note.title, '未命名笔记');
  assert.equal(note.content, '');
  assert.equal(note.fileType, 'md');
  assert.equal(note.folderId, null);
  assert.equal(note.isReviewFile, false);

  // 复刻 renderer/sidebar.js 的过滤条件：activeFolderId 初始为 null，
  // undefined !== null 会让这篇笔记在首屏消失，直到重启被重新归一。
  const activeFolderId = null;
  const visible = [note].filter(
    (item) => !item.isReviewFile && item.folderId === activeFolderId,
  );
  assert.equal(visible.length, 1, '空库首屏应显示 1 条笔记');
});
