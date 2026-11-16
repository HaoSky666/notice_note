const test = require('node:test');
const assert = require('node:assert/strict');
const {
  mergeSidebarOrder,
  moveSidebarEntry,
  sortIdsBySidebarOrder
} = require('../notice_note_client_pc/src/lib/sidebar-order');

test('没排过手动顺序时完全按默认顺序', () => {
  assert.deepEqual(mergeSidebarOrder(['a', 'b', 'c'], []), ['a', 'b', 'c']);
  assert.deepEqual(mergeSidebarOrder(['a', 'b', 'c'], null), ['a', 'b', 'c']);
});

test('手动顺序优先，没登记过的新条目接在末尾', () => {
  assert.deepEqual(
    mergeSidebarOrder(['a', 'b', 'c', 'd'], ['c', 'a']),
    ['c', 'a', 'b', 'd']
  );
});

test('手动顺序里已删除的 id 被丢掉，不会占位', () => {
  assert.deepEqual(
    mergeSidebarOrder(['a', 'b'], ['ghost', 'b', 'a']),
    ['b', 'a']
  );
});

test('拖动到目标前面 / 后面', () => {
  const base = ['a', 'b', 'c'];
  assert.deepEqual(moveSidebarEntry(base, 'c', 'a', 'before'), ['c', 'a', 'b']);
  assert.deepEqual(moveSidebarEntry(base, 'a', 'c', 'after'), ['b', 'c', 'a']);
  assert.deepEqual(moveSidebarEntry(base, 'a', 'b', 'after'), ['b', 'a', 'c']);
});

test('拖到自己身上或目标不存在时不产生新顺序', () => {
  assert.equal(moveSidebarEntry(['a', 'b'], 'a', 'a', 'before'), null);
  assert.equal(moveSidebarEntry(['a', 'b'], 'a', 'ghost', 'after'), null);
});

test('排序时未登记的 id 排最后且保持原有相对顺序', () => {
  assert.deepEqual(
    sortIdsBySidebarOrder(['a', 'b', 'c', 'd'], ['d', 'b']),
    ['d', 'b', 'a', 'c']
  );
});

test('没有手动顺序时不改变原数组顺序，也不修改入参', () => {
  const ids = ['a', 'b', 'c'];
  const sorted = sortIdsBySidebarOrder(ids, []);
  assert.deepEqual(sorted, ['a', 'b', 'c']);
  assert.deepEqual(ids, ['a', 'b', 'c']);
  assert.notEqual(sorted, ids);
});
