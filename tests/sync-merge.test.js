const test = require('node:test');
const assert = require('node:assert/strict');
const {
  mergeMemoryCard,
  mergeMemoryCards,
  mergeAnswerEntries,
  mergeReviewHistory,
  mergeReviewLog,
  collectRemovedIds
} = require('../notice_note_client_pc/src/lib/sync-merge');

function card(overrides = {}) {
  return {
    id: 'c1',
    front: '问题',
    back: '答案',
    types: ['基础'],
    state: 'review',
    step: 0,
    interval: 10,
    ease: 2.5,
    dueAt: '2026-12-01T00:00:00.000Z',
    reps: 3,
    lapses: 0,
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-10T00:00:00.000Z',
    lastReviewedAt: '2026-11-10T00:00:00.000Z',
    introducedAt: '2026-11-01T00:00:00.000Z',
    ...overrides
  };
}

test('手机没复习过：调度照抄 PC', () => {
  const pc = card();
  const phone = card({ interval: 1, lastReviewedAt: null, updatedAt: '2026-11-15T00:00:00.000Z' });
  const { card: merged, scheduleFrom } = mergeMemoryCard(pc, phone);
  assert.equal(scheduleFrom, 'pc');
  assert.equal(merged.interval, 10);
  assert.equal(merged.dueAt, pc.dueAt);
});

test('手机复习更近：调度取手机，内容仍取 PC', () => {
  // PC 后来修过错别字（content 是新的），手机在旧内容上复习过（调度是新的）
  const pc = card({ front: '问题（改过错别字）', updatedAt: '2026-11-12T00:00:00.000Z' });
  const phone = card({
    front: '问题（旧）',
    interval: 30,
    dueAt: '2026-12-20T00:00:00.000Z',
    reps: 5,
    lastReviewedAt: '2026-11-14T00:00:00.000Z',
    updatedAt: '2026-11-14T00:00:00.000Z'
  });
  const { card: merged, scheduleFrom } = mergeMemoryCard(pc, phone);
  assert.equal(scheduleFrom, 'phone');
  // 内容来自 PC：手机上复习过一张卡，不能把 PC 改过的文字盖回旧版
  assert.equal(merged.front, '问题（改过错别字）');
  assert.equal(merged.types[0], '基础');
  // 调度来自手机
  assert.equal(merged.interval, 30);
  assert.equal(merged.reps, 5);
  assert.equal(merged.dueAt, '2026-12-20T00:00:00.000Z');
  // updatedAt 取较晚的，避免合并结果被当成旧数据再次覆盖
  assert.equal(merged.updatedAt, '2026-11-14T00:00:00.000Z');
});

test('手机没标记改过助记：旧快照不会盖掉 PC 的值', () => {
  const pc = card({ mnemonic: 'PC 新写的口诀' });
  const phone = card({
    mnemonic: '上次同步的旧值',
    interval: 30,
    dueAt: '2026-12-20T00:00:00.000Z',
    lastReviewedAt: '2026-11-14T00:00:00.000Z'
  });
  const { card: merged, scheduleFrom } = mergeMemoryCard(pc, phone);
  assert.equal(scheduleFrom, 'phone', '调度仍然取手机');
  assert.equal(merged.mnemonic, 'PC 新写的口诀', '没有 mnemonicDirty 时助记仍以 PC 为准');
  assert.equal(merged.interval, 30);
});

test('手机改过助记：带 mnemonicDirty 就采纳，正反面仍取 PC', () => {
  const pc = card({ mnemonic: 'PC 的旧口诀', front: '问题（PC 改过）' });
  const phone = card({
    front: '问题（旧）',
    mnemonic: '手机上重写的口诀',
    mnemonicDirty: true,
    lastReviewedAt: null
  });
  const { card: merged, changed } = mergeMemoryCard(pc, phone);
  assert.equal(merged.mnemonic, '手机上重写的口诀', '手机明确改过的助记要能回传');
  assert.equal(merged.front, '问题（PC 改过）', '手机不能改正反面，仍取 PC');
  assert.equal(changed, true, '只改助记也要触发落盘');
});

test('手机清空助记（mnemonicDirty + 空串）：PC 的助记被删掉', () => {
  const pc = card({ mnemonic: '要删掉的口诀' });
  const phone = card({ mnemonic: '', mnemonicDirty: true, lastReviewedAt: null });
  const { card: merged, changed } = mergeMemoryCard(pc, phone);
  assert.equal(merged.mnemonic, '');
  assert.equal(changed, true);
});

test('PC 复习更近：整卡用 PC，手机的数据不参与', () => {
  const pc = card({ interval: 60, lastReviewedAt: '2026-11-15T00:00:00.000Z' });
  const phone = card({ interval: 30, lastReviewedAt: '2026-11-14T00:00:00.000Z' });
  const { card: merged, scheduleFrom } = mergeMemoryCard(pc, phone);
  assert.equal(scheduleFrom, 'pc');
  assert.equal(merged.interval, 60);
});

test('复习时间相同判给 PC：合并结果必须确定', () => {
  const same = '2026-11-15T00:00:00.000Z';
  const pc = card({ interval: 60, lastReviewedAt: same });
  const phone = card({ interval: 30, lastReviewedAt: same });
  const first = mergeMemoryCard(pc, phone);
  const second = mergeMemoryCard(pc, phone);
  assert.equal(first.scheduleFrom, 'pc');
  assert.equal(first.card.interval, 60);
  assert.deepEqual(first.card, second.card);
});

test('牌组集合以 PC 为准：手机多出来的丢弃，PC 独有的保留', () => {
  const { cards, stats } = mergeMemoryCards(
    [card({ id: 'keep-1' }), card({ id: 'keep-2' })],
    [card({ id: 'keep-1' }), card({ id: 'ghost' })]
  );
  assert.deepEqual(cards.map((item) => item.id), ['keep-1', 'keep-2']);
  assert.deepEqual(stats.droppedFromPhone, ['ghost']);
  assert.equal(stats.total, 2);
});

test('牌组顺序跟 PC 走，不因同步而跳动', () => {
  const { cards } = mergeMemoryCards(
    [card({ id: 'b' }), card({ id: 'a' })],
    [card({ id: 'a', lastReviewedAt: '2026-11-16T00:00:00.000Z' })]
  );
  assert.deepEqual(cards.map((item) => item.id), ['b', 'a']);
});

test('作答历史按 id 取并集，顺序按时间正序', () => {
  const { entries, stats } = mergeAnswerEntries(
    [{ id: 'e1', createdAt: '2026-11-10T00:00:00.000Z', rating: 'good', answer: 'A' }],
    [
      { id: 'e2', createdAt: '2026-11-11T00:00:00.000Z', rating: 'hard', answer: 'B' },
      { id: 'e1', createdAt: '2026-11-10T00:00:00.000Z', rating: 'good', answer: 'A' }
    ]
  );
  assert.deepEqual(entries.map((item) => item.id), ['e1', 'e2']);
  assert.equal(stats.addedFromPhone, 1);
});

test('同一作答记录被改判过：保留 edited 的那份', () => {
  const { entries } = mergeAnswerEntries(
    [{ id: 'e1', createdAt: '2026-11-10T00:00:00.000Z', rating: 'good', edited: false }],
    [{ id: 'e1', createdAt: '2026-11-10T00:00:00.000Z', rating: 'easy', edited: true }]
  );
  assert.equal(entries.length, 1);
  assert.equal(entries[0].rating, 'easy');
  assert.equal(entries[0].edited, true);
});

test('collectRemovedIds 找出本地多出来的 id', () => {
  assert.deepEqual(
    collectRemovedIds(['a', 'b', 'c'], new Set(['a', 'c', 'd'])),
    ['b']
  );
  assert.deepEqual(collectRemovedIds([], ['a']), []);
});

test('collectRemovedIds 缺少清单时直接报错，绝不把本地全删', () => {
  // 当成空集合的后果是手机上的笔记全被清掉，宁可同步失败也不能静默清库
  assert.throws(() => collectRemovedIds(['a'], undefined), TypeError);
  assert.throws(() => collectRemovedIds(['a'], null), TypeError);
});

test('回顾锚点谁新用谁：手机完成更晚的天被采纳，并报告 dayKey', () => {
  const { history, adoptedDayKeys } = mergeReviewHistory(
    { 'day:2026-11-10': '2026-11-10T09:00:00.000Z', 'day:2026-11-12': '2026-11-12T09:00:00.000Z' },
    { 'day:2026-11-10': '2026-11-11T20:00:00.000Z', 'day:2026-11-12': '2026-11-11T08:00:00.000Z' }
  );
  // 11-10 手机更晚 → 采纳；11-12 PC 更晚 → 保持 PC
  assert.equal(history['day:2026-11-10'], '2026-11-11T20:00:00.000Z');
  assert.equal(history['day:2026-11-12'], '2026-11-12T09:00:00.000Z');
  assert.deepEqual(adoptedDayKeys, ['2026-11-10']);
});

test('回顾锚点时间相同判给 PC，手机没看过的天不受影响', () => {
  const same = '2026-11-15T09:00:00.000Z';
  const { history, adoptedDayKeys } = mergeReviewHistory(
    { 'day:2026-11-10': same, 'day:2026-11-11': '2026-11-11T09:00:00.000Z' },
    { 'day:2026-11-10': same }
  );
  assert.equal(history['day:2026-11-10'], same);
  assert.equal(history['day:2026-11-11'], '2026-11-11T09:00:00.000Z');
  assert.deepEqual(adoptedDayKeys, []);
});

test('回顾锚点只收合法的天级键与时间，脏数据直接忽略', () => {
  const { history, adoptedDayKeys } = mergeReviewHistory(
    {},
    {
      'day:2026-11-10': '2026-11-10T09:00:00.000Z',
      'day:not-a-date': '2026-11-10T09:00:00.000Z',
      'note:abc': '2026-11-10T09:00:00.000Z',
      'day:2026-11-11': '不是时间',
      'day:2026-11-12': 123
    }
  );
  assert.deepEqual(Object.keys(history), ['day:2026-11-10']);
  assert.deepEqual(adoptedDayKeys, ['2026-11-10']);
});

test('回顾日志按 id 取并集、按时间正序，重复 id 不重复计数', () => {
  const { log, stats } = mergeReviewLog(
    [{ id: 'r1', dayKey: '2026-11-10', reviewedAt: '2026-11-10T09:00:00.000Z' }],
    [
      { id: 'r2', dayKey: '2026-11-11', reviewedAt: '2026-11-11T09:00:00.000Z' },
      { id: 'r1', dayKey: '2026-11-10', reviewedAt: '2026-11-10T09:00:00.000Z' },
      { id: 'bad', dayKey: '乱写', reviewedAt: '2026-11-11T09:00:00.000Z' }
    ]
  );
  assert.deepEqual(log.map((item) => item.id), ['r1', 'r2']);
  assert.equal(stats.addedFromPhone, 1);
  assert.equal(stats.total, 2);
});
