const test = require('node:test');
const assert = require('node:assert/strict');
const {
  makeReviewEntryKey,
  buildDefaultReviewDayOrder,
  normalizeReviewDayOrder
} = require('../notice_note_client_pc/src/lib/review-day-order');

const isValidDay = (dayKey) => /^\d{4}-\d{2}-\d{2}$/.test(dayKey);

test('key 带类型前缀，笔记与资源文件不会撞 id', () => {
  assert.equal(makeReviewEntryKey('note', 'abc'), 'note:abc');
  assert.equal(makeReviewEntryKey('file', 'abc'), 'file:abc');
});

test('默认顺序：笔记按最近修改倒序在前，资源文件接在后面', () => {
  const notes = [
    { id: 'n1', updatedAt: '2026-11-16T08:00:00.000Z' },
    { id: 'n2', updatedAt: '2026-11-16T10:00:00.000Z' }
  ];
  const files = [{ id: 'f1' }, { id: 'f2' }];
  assert.deepEqual(buildDefaultReviewDayOrder(notes, files), [
    'note:n2', 'note:n1', 'file:f1', 'file:f2'
  ]);
});

test('默认顺序不改动入参', () => {
  const notes = [
    { id: 'n1', updatedAt: '2026-11-16T08:00:00.000Z' },
    { id: 'n2', updatedAt: '2026-11-16T10:00:00.000Z' }
  ];
  buildDefaultReviewDayOrder(notes, []);
  assert.deepEqual(notes.map((note) => note.id), ['n1', 'n2']);
});

test('默认顺序能容忍空列表与缺失字段', () => {
  assert.deepEqual(buildDefaultReviewDayOrder(undefined, undefined), []);
  assert.deepEqual(buildDefaultReviewDayOrder([], [{ id: 'f1' }]), ['file:f1']);
});

test('读盘时丢掉非法日期、非法 key 与重复项，空天不保留', () => {
  const normalized = normalizeReviewDayOrder({
    '2026-11-16': ['note:a', 'note:a', 'file:b'],
    '2026-11-17': [],
    'bad-day': ['note:c'],
    '2026-11-18': ['whatever', 42, null]
  }, isValidDay);
  assert.deepEqual(normalized, {
    '2026-11-16': ['note:a', 'file:b']
  });
});

test('不是对象的值一律当没排过', () => {
  assert.deepEqual(normalizeReviewDayOrder(null, isValidDay), {});
  assert.deepEqual(normalizeReviewDayOrder([], isValidDay), {});
  assert.deepEqual(normalizeReviewDayOrder('nope', isValidDay), {});
});
