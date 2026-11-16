const test = require('node:test');
const assert = require('node:assert/strict');
const {
  sortReviewQueue,
  moveInQueue,
  pruneReviewOrder
} = require('../notice_note_client_pc/src/lib/review-queue');

function candidate(dayKey) {
  return { key: `day:${dayKey}`, dayKey };
}

test('没有手动顺序时按「最久没看过」排，其次按日期', () => {
  const candidates = [candidate('2026-08-03'), candidate('2026-08-01'), candidate('2026-08-02')];
  const ordered = sortReviewQueue(candidates, {
    history: {
      'day:2026-08-01': '2026-11-01T00:00:00.000Z',
      'day:2026-08-03': '2026-11-10T00:00:00.000Z'
      // 2026-08-02 从没回顾过 → 排最前
    }
  });
  assert.deepEqual(ordered.map((item) => item.dayKey), ['2026-08-02', '2026-08-01', '2026-08-03']);
});

test('手动顺序优先于历史排序', () => {
  const candidates = [candidate('2026-08-01'), candidate('2026-08-02'), candidate('2026-08-03')];
  const ordered = sortReviewQueue(candidates, {
    order: ['2026-08-03', '2026-08-01'],
    history: { 'day:2026-08-01': '2026-11-10T00:00:00.000Z' }
  });
  assert.deepEqual(ordered.map((item) => item.dayKey), ['2026-08-03', '2026-08-01', '2026-08-02']);
});

test('顺序里失效的 dayKey 不占位置，候选中没有的天直接忽略', () => {
  const candidates = [candidate('2026-08-01'), candidate('2026-08-02')];
  const ordered = sortReviewQueue(candidates, {
    order: ['2026-01-01', '2026-08-02']
  });
  assert.deepEqual(ordered.map((item) => item.dayKey), ['2026-08-02', '2026-08-01']);
});

test('moveInQueue 支持置顶、上移、下移，边界上不越界', () => {
  const queue = ['a', 'b', 'c'];
  assert.deepEqual(moveInQueue(queue, 'c', 'top'), ['c', 'a', 'b']);
  assert.deepEqual(moveInQueue(queue, 'b', 'up'), ['b', 'a', 'c']);
  assert.deepEqual(moveInQueue(queue, 'b', 'down'), ['a', 'c', 'b']);
  assert.deepEqual(moveInQueue(queue, 'a', 'up'), ['a', 'b', 'c']);
  assert.deepEqual(moveInQueue(queue, 'c', 'down'), ['a', 'b', 'c']);
  assert.equal(moveInQueue(queue, 'missing', 'up'), null);
  assert.equal(moveInQueue(queue, 'a', 'sideways'), null);
  // 原数组不被就地修改
  assert.deepEqual(queue, ['a', 'b', 'c']);
});

test('pruneReviewOrder 只保留仍在候选里的天', () => {
  const candidates = [candidate('2026-08-01'), candidate('2026-08-02')];
  assert.deepEqual(
    pruneReviewOrder(['2026-08-02', '2026-01-01', '2026-08-01'], candidates),
    ['2026-08-02', '2026-08-01']
  );
});

test('pruneReviewOrder 保留挂着未完成提醒的天（只是暂时退出候选池）', () => {
  const candidates = [candidate('2026-08-01')];
  assert.deepEqual(
    pruneReviewOrder(['2026-08-02', '2026-08-01'], candidates, { keep: ['2026-08-02'] }),
    ['2026-08-02', '2026-08-01']
  );
});
