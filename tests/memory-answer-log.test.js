// 作答历史的纯函数测试：归一化、追加、按卡片查询、改判、清理。
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  ANSWER_LOG_VERSION,
  ANSWER_TEXT_MAX_LENGTH,
  ANSWER_KEEP_PER_CARD,
  normalizeAnswerLog,
  buildAnswerLog,
  appendAnswerEntry,
  removeAnswerEntry,
  updateAnswerRating,
  listCardAnswers,
  countCardAnswers,
  pruneAnswersForCards
} = require('../notice_note_client_pc/src/lib/memory-answer-log');

const RATINGS = ['again', 'hard', 'good', 'easy'];
const ratingValidator = (value) => (RATINGS.includes(value) ? value : null);

function entry(overrides = {}) {
  return {
    id: 'e1',
    cardId: 'c1',
    kind: 'text',
    answer: '答对了',
    rating: 'good',
    reason: '核心点答对',
    createdAt: '2026-11-17T06:00:00.000Z',
    ...overrides
  };
}

test('normalizeAnswerLog 接受裸数组与 { version, entries } 两种形态', () => {
  const fromArray = normalizeAnswerLog([entry()], { ratingValidator });
  assert.equal(fromArray.version, ANSWER_LOG_VERSION);
  assert.equal(fromArray.entries.length, 1);

  const fromObject = normalizeAnswerLog({ version: 1, entries: [entry()] }, { ratingValidator });
  assert.equal(fromObject.entries.length, 1);

  assert.deepEqual(normalizeAnswerLog(null, { ratingValidator }).entries, []);
  assert.deepEqual(normalizeAnswerLog({ entries: 'nope' }, { ratingValidator }).entries, []);
});

test('normalizeAnswerLog 丢掉缺 id / cardId / rating 的条目', () => {
  const log = normalizeAnswerLog([
    entry({ id: 'ok' }),
    entry({ id: '', cardId: 'c1' }),
    entry({ id: 'x', cardId: '' }),
    entry({ id: 'y', rating: 'unknown' })
  ], { ratingValidator });
  assert.deepEqual(log.entries.map((item) => item.id), ['ok']);
});

test('normalizeAnswerLog 按时间正序排列并去重 id', () => {
  const log = normalizeAnswerLog([
    entry({ id: 'b', createdAt: '2026-11-17T08:00:00.000Z' }),
    entry({ id: 'a', createdAt: '2026-11-17T06:00:00.000Z' }),
    entry({ id: 'a', createdAt: '2026-11-17T09:00:00.000Z' })
  ], { ratingValidator });
  assert.deepEqual(log.entries.map((item) => item.id), ['a', 'b']);
});

test('normalizeAnswerLog 补齐非法 kind / source，并截断超长回答', () => {
  const log = normalizeAnswerLog([
    entry({ kind: 'hologram', source: 'telepathy', answer: 'x'.repeat(ANSWER_TEXT_MAX_LENGTH + 10) })
  ], { ratingValidator });
  assert.equal(log.entries[0].kind, 'text');
  assert.equal(log.entries[0].source, 'ai');
  assert.equal(log.entries[0].answer.length, ANSWER_TEXT_MAX_LENGTH);
});

test('appendAnswerEntry 追加到尾部，并按卡片裁剪最老的', () => {
  let log = buildAnswerLog([]);
  for (let index = 0; index < ANSWER_KEEP_PER_CARD + 3; index += 1) {
    log = appendAnswerEntry(log, entry({
      id: `e${index}`,
      cardId: 'c1',
      createdAt: new Date(Date.UTC(2026, 0, 1, 0, index)).toISOString()
    }));
  }
  assert.equal(log.entries.length, ANSWER_KEEP_PER_CARD);
  // 最老的三条被丢掉，剩下的是后面新增的
  assert.equal(log.entries.some((item) => item.id === 'e0'), false);
  assert.equal(log.entries.at(-1).id, `e${ANSWER_KEEP_PER_CARD + 2}`);
});

test('appendAnswerEntry 只裁剪同一张卡，不碰别的卡', () => {
  let log = buildAnswerLog([
    entry({ id: 'other', cardId: 'c2', createdAt: '2026-01-01T00:00:00.000Z' })
  ]);
  log = appendAnswerEntry(log, entry({ id: 'new', cardId: 'c1' }));
  assert.equal(log.entries.length, 2);
});

test('removeAnswerEntry 删掉指定条目，缺失 id 时原样返回', () => {
  const log = buildAnswerLog([entry({ id: 'a' }), entry({ id: 'b' })]);
  assert.deepEqual(removeAnswerEntry(log, 'a').entries.map((item) => item.id), ['b']);
  assert.equal(removeAnswerEntry(log, '').entries.length, 2);
  assert.equal(removeAnswerEntry(log, 'not-exist').entries.length, 2);
});

test('updateAnswerRating 改档位、打改判标记、来源转 manual', () => {
  const log = buildAnswerLog([entry({ id: 'a', rating: 'good', source: 'ai' })]);
  const next = updateAnswerRating(log, 'a', 'easy', '补充了边界条件');
  assert.equal(next.entries[0].rating, 'easy');
  assert.equal(next.entries[0].reason, '补充了边界条件');
  assert.equal(next.entries[0].edited, true);
  assert.equal(next.entries[0].source, 'manual');
});

test('updateAnswerRating 不传理由时保留原理由', () => {
  const log = buildAnswerLog([entry({ id: 'a', reason: '原来的理由' })]);
  assert.equal(updateAnswerRating(log, 'a', 'hard').entries[0].reason, '原来的理由');
});

test('listCardAnswers 按卡片过滤并倒序（最新在前）', () => {
  const log = buildAnswerLog([
    entry({ id: 'a', cardId: 'c1', createdAt: '2026-11-17T06:00:00.000Z' }),
    entry({ id: 'b', cardId: 'c2', createdAt: '2026-11-17T07:00:00.000Z' }),
    entry({ id: 'c', cardId: 'c1', createdAt: '2026-11-17T08:00:00.000Z' })
  ]);
  assert.deepEqual(listCardAnswers(log, 'c1').map((item) => item.id), ['c', 'a']);
  assert.deepEqual(listCardAnswers(log, 'c1', 1).map((item) => item.id), ['c']);
  assert.deepEqual(listCardAnswers(log, 'nope'), []);
});

test('countCardAnswers 统计某张卡的条数', () => {
  const log = buildAnswerLog([
    entry({ id: 'a', cardId: 'c1' }),
    entry({ id: 'b', cardId: 'c1' }),
    entry({ id: 'c', cardId: 'c2' })
  ]);
  assert.equal(countCardAnswers(log, 'c1'), 2);
  assert.equal(countCardAnswers(log, 'c2'), 1);
  assert.equal(countCardAnswers(log, 'c3'), 0);
});

test('pruneAnswersForCards 删卡片后清掉孤儿历史', () => {
  const log = buildAnswerLog([
    entry({ id: 'a', cardId: 'c1' }),
    entry({ id: 'b', cardId: 'c2' })
  ]);
  const pruned = pruneAnswersForCards(log, new Set(['c1']));
  assert.deepEqual(pruned.entries.map((item) => item.id), ['a']);
  assert.deepEqual(pruneAnswersForCards(log, ['c2']).entries.map((item) => item.id), ['b']);
  assert.equal(pruneAnswersForCards(log, []).entries.length, 0);
});

test('历史条目带上改判标记后仍然可读可删', () => {
  let log = appendAnswerEntry(buildAnswerLog([]), entry({ id: 'a', rating: 'good' }));
  log = updateAnswerRating(log, 'a', 'again', '其实答错了');
  const [saved] = listCardAnswers(log, 'c1');
  assert.equal(saved.rating, 'again');
  assert.equal(saved.edited, true);
  assert.equal(removeAnswerEntry(log, 'a').entries.length, 0);
});
