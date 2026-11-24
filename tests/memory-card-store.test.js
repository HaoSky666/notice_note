// 记忆卡存储格式与学习队列的纯函数测试。
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeMemorySettings,
  normalizeCardStore,
  buildCardStore,
  getNewCardQuota,
  buildStudyQueue,
  buildMemorySnapshot,
  pickNextCard
} = require('../notice_note_client_pc/src/lib/memory-card-store');
const { createCard, DAY_MS } = require('../notice_note_client_pc/src/lib/sm2-scheduler');

const NOW = Date.parse('2026-11-17T09:00:00.000Z');

function reviewCard(overrides = {}) {
  return {
    id: `card-${Math.random().toString(16).slice(2)}`,
    front: 'Q',
    back: 'A',
    state: 'review',
    step: 0,
    interval: 3,
    ease: 2.5,
    dueAt: new Date(NOW).toISOString(),
    reps: 4,
    lapses: 0,
    createdAt: new Date(NOW - 10 * DAY_MS).toISOString(),
    updatedAt: new Date(NOW).toISOString(),
    lastReviewedAt: null,
    introducedAt: null,
    ...overrides
  };
}

test('normalizeMemorySettings 补齐日限额并兼容百分比', () => {
  const settings = normalizeMemorySettings({ startingEase: 250, easyBonus: 130 });
  assert.equal(settings.startingEase, 2.5);
  assert.equal(settings.easyBonus, 1.3);
  assert.equal(settings.newCardsPerDay, 20);
});

test('normalizeCardStore 兼容裸数组和 { cards }，并去掉重复 id', () => {
  const card = createCard({ id: 'same' }, NOW);
  const fromArray = normalizeCardStore([card, { ...card }], {});
  assert.equal(fromArray.version, 1);
  assert.equal(fromArray.cards.length, 1);

  const fromObject = normalizeCardStore({ version: 1, cards: [card] }, {});
  assert.equal(fromObject.cards.length, 1);
});

test('normalizeCardStore 丢弃非对象条目', () => {
  const store = normalizeCardStore([null, 'bad', 42, createCard({ id: 'ok' }, NOW)], {});
  assert.equal(store.cards.length, 1);
  assert.equal(store.cards[0].id, 'ok');
});

test('buildCardStore 输出带版本号的对象', () => {
  const store = buildCardStore([createCard({}, NOW)]);
  assert.equal(store.version, 1);
  assert.equal(store.cards.length, 1);
});

test('getNewCardQuota 扣掉今天已经引入的新卡', () => {
  const todayIso = new Date(NOW).toISOString();
  const cards = [
    reviewCard({ introducedAt: todayIso }),
    reviewCard({ introducedAt: todayIso }),
    reviewCard({ introducedAt: new Date(NOW - DAY_MS).toISOString() })
  ];
  assert.equal(getNewCardQuota(cards, { newCardsPerDay: 20 }, NOW), 18);
});

test('getNewCardQuota 不会小于 0', () => {
  const todayIso = new Date(NOW).toISOString();
  const cards = [reviewCard({ introducedAt: todayIso })];
  assert.equal(getNewCardQuota(cards, { newCardsPerDay: 1 }, NOW), 0);
});

test('mnemonic 跟着卡片落盘：新建保留，旧数据缺字段时补空串', () => {
  const card = createCard({ id: 'm1', front: 'Q', back: 'A', mnemonic: '把路口堵上' }, NOW);
  assert.equal(card.mnemonic, '把路口堵上');

  // 老版本 cards.json 没有这个字段，读回来必须是空串而不是 undefined，
  // 否则渲染层拼 'undefined'、同步时也会来回抖。
  const store = normalizeCardStore([{ ...card, mnemonic: undefined }, { id: 'm2' }], {});
  assert.equal(store.cards[0].mnemonic, '');
  assert.equal(store.cards[1].mnemonic, '');
});

test('buildStudyQueue 按日限额截断新卡', () => {
  const cards = [
    createCard({ id: 'n1' }, NOW),
    createCard({ id: 'n2' }, NOW),
    createCard({ id: 'n3' }, NOW)
  ];
  const queue = buildStudyQueue(cards, { newCardsPerDay: 2 }, NOW);
  assert.equal(queue.newCards.length, 2);
  assert.equal(queue.quota, 2);
});

test('studyOrder 默认按添加顺序，随机顺序只打散组内且当天固定', () => {
  const cards = Array.from({ length: 12 }, (_, index) => (
    createCard({ id: `n${index}` }, NOW + index * 1000)
  ));

  const byAddOrder = buildStudyQueue(cards, {}, NOW);
  assert.deepEqual(byAddOrder.newCards.map((card) => card.id), cards.map((card) => card.id));

  const random = buildStudyQueue(cards, { studyOrder: 'random' }, NOW);
  const randomAgain = buildStudyQueue(cards, { studyOrder: 'random' }, NOW);
  // 同一天内重建快照不能换顺序，否则「第 x / y 张」会跟着跳
  assert.deepEqual(
    random.newCards.map((card) => card.id),
    randomAgain.newCards.map((card) => card.id)
  );
  assert.notDeepEqual(
    random.newCards.map((card) => card.id),
    byAddOrder.newCards.map((card) => card.id)
  );

  // 跨天自动换一套：同一天的随机只固定到当天，不变成「另一套固定顺序」
  const tomorrow = buildStudyQueue(cards, { studyOrder: 'random' }, NOW + DAY_MS);
  assert.notDeepEqual(
    tomorrow.newCards.map((card) => card.id),
    random.newCards.map((card) => card.id)
  );
});

test('随机顺序不打乱组间优先级：学习中的卡仍然排在最前', () => {
  const cards = [
    createCard({ id: 'new-1' }, NOW),
    reviewCard({ id: 'due-1', dueAt: new Date(NOW - 1000).toISOString() }),
    reviewCard({
      id: 'learning-1',
      state: 'learning',
      step: 1,
      dueAt: new Date(NOW - 1000).toISOString()
    })
  ];
  const queue = buildStudyQueue(cards, { studyOrder: 'random' }, NOW);
  assert.equal(pickNextCard(queue).id, 'learning-1');
  assert.equal(queue.learning.length, 1);
  assert.equal(queue.due.length, 1);
  assert.equal(queue.newCards.length, 1);
});

test('studyOrder 非法值回落按顺序，随机设置能透传到快照', () => {
  assert.equal(normalizeMemorySettings({}).studyOrder, 'sequential');
  assert.equal(normalizeMemorySettings({ studyOrder: 'random' }).studyOrder, 'random');
  assert.equal(normalizeMemorySettings({ studyOrder: 'shuffle' }).studyOrder, 'sequential');

  // 快照里的 settings 要带出去，渲染层才能回填下拉框
  const snapshot = buildMemorySnapshot([createCard({ id: 'n1' }, NOW)], { studyOrder: 'random' }, NOW);
  assert.equal(snapshot.settings.studyOrder, 'random');
});

test('pickNextCard 优先学习中的卡，其次是到期复习，最后新卡', () => {
  const cards = [
    createCard({ id: 'new-1' }, NOW),
    reviewCard({ id: 'due-1', dueAt: new Date(NOW - DAY_MS).toISOString() }),
    reviewCard({
      id: 'learning-1',
      state: 'learning',
      step: 1,
      dueAt: new Date(NOW - 60 * 1000).toISOString()
    })
  ];
  const queue = buildStudyQueue(cards, {}, NOW);
  assert.equal(pickNextCard(queue).id, 'learning-1');
  assert.equal(pickNextCard({ learning: [], due: queue.due, newCards: queue.newCards }).id, 'due-1');
  assert.equal(pickNextCard({ learning: [], due: [], newCards: queue.newCards }).id, 'new-1');
  assert.equal(pickNextCard({ learning: [], due: [], newCards: [] }), null);
});

test('buildMemorySnapshot 输出渲染层直接可用的形状', () => {
  const cards = [
    createCard({ id: 'n1', front: '新卡' }, NOW),
    reviewCard({ id: 'due-1', dueAt: new Date(NOW - DAY_MS).toISOString() }),
    reviewCard({ id: 'later-1', dueAt: new Date(NOW + 3 * DAY_MS).toISOString() })
  ];
  const snapshot = buildMemorySnapshot(cards, { newCardsPerDay: 5 }, NOW);
  assert.equal(snapshot.cards.length, 3);
  assert.equal(snapshot.cards[0].dueLabel, '未开始');
  assert.equal(snapshot.cards[1].dueLabel, '现在');
  assert.equal(snapshot.cards[2].dueLabel, '3 天');
  assert.deepEqual(snapshot.queue.newCards, ['n1']);
  assert.deepEqual(snapshot.queue.due, ['due-1']);
  assert.deepEqual(snapshot.queue.scheduled, ['later-1']);
  assert.equal(snapshot.settings.newCardsPerDay, 5);
  assert.equal(snapshot.stats.total, 3);
  assert.ok(snapshot.cards[0].preview.good.label);
});

test('buildMemorySnapshot 按类型筛选卡片、队列与统计，目录保持全量', () => {
  const cards = [
    createCard({ id: 'a1', types: ['限流'] }, NOW),
    createCard({ id: 'a2', types: ['限流', '熔断'] }, NOW),
    createCard({ id: 'b1', types: ['降级'] }, NOW),
    createCard({ id: 'n0' }, NOW)
  ];
  const snapshot = buildMemorySnapshot(cards, {}, NOW, { type: '限流' });

  assert.deepEqual(snapshot.cards.map((card) => card.id).sort(), ['a1', 'a2']);
  assert.deepEqual([...snapshot.queue.newCards].sort(), ['a1', 'a2']);
  assert.equal(snapshot.stats.total, 2);
  assert.equal(snapshot.stats.allTotal, 4);
  assert.equal(snapshot.type, '限流');

  // 切换条要能看到别的类型，所以目录和计数始终基于全部卡片
  const counts = Object.fromEntries(snapshot.types.map((item) => [item.name, item.count]));
  assert.deepEqual(counts, { 限流: 2, 熔断: 1, 降级: 1 });
});

test('buildMemorySnapshot 的类型筛选大小写不敏感，不传类型就是全部', () => {
  const cards = [
    createCard({ id: 'x1', types: ['Redis'] }, NOW),
    createCard({ id: 'x2', types: ['限流'] }, NOW)
  ];
  const filtered = buildMemorySnapshot(cards, {}, NOW, { type: 'redis' });
  assert.deepEqual(filtered.cards.map((card) => card.id), ['x1']);
  // 目录里的写法是 Redis，回传也用它，前端拿它比选中态
  assert.equal(filtered.type, 'Redis');

  const all = buildMemorySnapshot(cards, {}, NOW);
  assert.equal(all.cards.length, 2);
  assert.equal(all.type, null);
  assert.equal(all.stats.allTotal, 2);
});
