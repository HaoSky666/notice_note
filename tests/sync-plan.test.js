const test = require('node:test');
const assert = require('node:assert/strict');
const {
  planNoteSync,
  planAssetSync,
  assembleNotes
} = require('../notice_note_client_app/src/lib/sync-plan');

test('笔记差量：新笔记与 updatedAt 变化的要拉，没变的不拉', () => {
  const local = [
    { id: 'a', updatedAt: '2026-11-10T00:00:00.000Z', content: '旧A' },
    { id: 'b', updatedAt: '2026-11-10T00:00:00.000Z', content: 'B' }
  ];
  const manifest = [
    { id: 'a', updatedAt: '2026-11-12T00:00:00.000Z' },
    { id: 'b', updatedAt: '2026-11-10T00:00:00.000Z' },
    { id: 'c', updatedAt: '2026-11-12T00:00:00.000Z' }
  ];
  const { fetchIds, removedIds } = planNoteSync(local, manifest);
  assert.deepEqual(fetchIds, ['a', 'c']);
  assert.deepEqual(removedIds, []);
});

test('笔记差量：清单里没有的本地笔记要删（PC 已删）', () => {
  const { fetchIds, removedIds } = planNoteSync(
    [{ id: 'a', updatedAt: 'x' }, { id: 'gone', updatedAt: 'y' }],
    [{ id: 'a', updatedAt: 'x' }]
  );
  assert.deepEqual(fetchIds, []);
  assert.deepEqual(removedIds, ['gone']);
});

test('首次同步没有本地快照：全量拉取，不误删', () => {
  const { fetchIds, removedIds } = planNoteSync(null, [{ id: 'a', updatedAt: 'x' }]);
  assert.deepEqual(fetchIds, ['a']);
  assert.deepEqual(removedIds, []);
});

test('附件差量：size 或 updatedAt 变化才重新下载', () => {
  const local = [
    { source: 'img/a.png', size: 100, updatedAt: '2026-11-10T00:00:00.000Z' },
    { source: 'img/b.png', size: 200, updatedAt: '2026-11-10T00:00:00.000Z' },
    { source: 'old.pdf', size: 1, updatedAt: '2026-11-01T00:00:00.000Z' }
  ];
  const manifest = [
    { source: 'img/a.png', size: 100, updatedAt: '2026-11-10T00:00:00.000Z', mimeType: 'image/png' },
    { source: 'img/b.png', size: 201, updatedAt: '2026-11-10T00:00:00.000Z', mimeType: 'image/png' },
    { source: 'img/c.png', size: 5, updatedAt: '2026-11-12T00:00:00.000Z', mimeType: 'image/png' }
  ];
  const { fetchAssets, removedKeys } = planAssetSync(local, manifest);
  assert.deepEqual(fetchAssets.map((item) => item.source), ['img/b.png', 'img/c.png']);
  assert.deepEqual(removedKeys, ['old.pdf']);
});

test('assembleNotes：新正文优先，未变更的沿用本地正文', () => {
  const notes = assembleNotes(
    [{ id: 'a', updatedAt: 'new' }, { id: 'b', updatedAt: 'same' }],
    [{ id: 'a', content: '新A' }],
    [{ id: 'a', content: '旧A' }, { id: 'b', content: 'B' }]
  );
  assert.deepEqual(notes.map((note) => note.content), ['新A', 'B']);
});

test('assembleNotes：拉取遗漏时给空串兜底而不是崩溃', () => {
  const notes = assembleNotes([{ id: 'a' }], [], []);
  assert.equal(notes[0].content, '');
});