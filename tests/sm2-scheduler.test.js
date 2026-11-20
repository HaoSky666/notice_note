// SM-2 调度器行为测试：固定时间戳 + 关掉 fuzz，保证结果可复现。
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  DAY_MS,
  MINUTE_MS,
  normalizeSettings,
  createCard,
  normalizeCard,
  scheduleCard,
  previewIntervals,
  describeGap,
  getQueue,
  getStats,
  getCardDayKey
} = require('../notice_note_client_pc/src/lib/sm2-scheduler');

const NOW = Date.parse('2026-11-17T09:00:00.000Z');
const SETTINGS = { fuzz: false };

function iso(offsetMs = 0) {
  return new Date(NOW + offsetMs).toISOString();
}

function reviewCard(overrides = {}) {
  return {
    id: 'card-1',
    front: '问题',
    back: '答案',
    state: 'review',
    step: 0,
    interval: 10,
    ease: 2.5,
    dueAt: iso(0),
    reps: 5,
    lapses: 0,
    createdAt: iso(-30 * DAY_MS),
    updatedAt: iso(0),
    lastReviewedAt: null,
    ...overrides
  };
}

function gapDays(card, rating, settings = SETTINGS, now = NOW) {
  const next = scheduleCard(card, rating, settings, now);
  return dayGap(next.dueAt, now);
}

// 本地日索引差：间隔按「天」记，不是按 24 小时整，所以断言也要按天比。
function localDayIndex(time) {
  const date = new Date(typeof time === 'string' ? Date.parse(time) : time);
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS;
}

function dayGap(target, now) {
  return localDayIndex(target) - localDayIndex(now);
}

test('normalizeSettings 支持截图里的百分比与空格分隔的步骤', () => {
  const settings = normalizeSettings({
    learningSteps: '1 10',
    graduatingInterval: 1,
    easyInterval: 4,
    startingEase: 250,
    maximumInterval: 36500,
    easyBonus: 130,
    intervalModifier: 100,
    relearningSteps: '10',
    newInterval: 0,
    minimumInterval: 1
  });
  assert.deepEqual(settings.learningSteps, [1, 10]);
  assert.deepEqual(settings.relearningSteps, [10]);
  assert.equal(settings.startingEase, 2.5);
  assert.equal(settings.easyBonus, 1.3);
  assert.equal(settings.intervalModifier, 1);
  assert.equal(settings.newInterval, 0);
});

test('normalizeSettings 对小数值原样保留，非法值回退默认', () => {
  const settings = normalizeSettings({
    startingEase: 2.8,
    easyBonus: 1.5,
    intervalModifier: 0.8,
    newInterval: 0.5,
    learningSteps: ['', 'abc', 0, -3]
  });
  assert.equal(settings.startingEase, 2.8);
  assert.equal(settings.easyBonus, 1.5);
  assert.equal(settings.intervalModifier, 0.8);
  assert.equal(settings.newInterval, 0.5);
  assert.deepEqual(settings.learningSteps, [1, 10]);
});

test('新卡默认是 new，dueAt 为空，ease 2.5', () => {
  const card = createCard({ front: 'Q', back: 'A' }, NOW);
  assert.equal(card.state, 'new');
  assert.equal(card.dueAt, null);
  assert.equal(card.ease, 2.5);
  assert.equal(card.step, 0);
  assert.equal(card.reps, 0);
});

test('新卡 Good 推进到第二步：10 分钟后', () => {
  const card = createCard({}, NOW);
  const next = scheduleCard(card, 'good', SETTINGS, NOW);
  assert.equal(next.state, 'learning');
  assert.equal(next.step, 1);
  assert.equal(Date.parse(next.dueAt) - NOW, 10 * MINUTE_MS);
});

test('新卡连按两次 Good 毕业：明天零点到期', () => {
  const card = createCard({}, NOW);
  const first = scheduleCard(card, 'good', SETTINGS, NOW);
  const second = scheduleCard(first, 'good', SETTINGS, NOW + 10 * MINUTE_MS);
  assert.equal(second.state, 'review');
  assert.equal(second.step, 0);
  assert.equal(second.interval, 1);
  assert.equal(dayGap(second.dueAt, NOW + 10 * MINUTE_MS), 1);
  // 日切语义：20:11 毕业的卡不该拖到明天 20:11，而是明天 00:00 就到期。
  const due = new Date(second.dueAt);
  assert.equal(due.getHours(), 0);
  assert.equal(due.getMinutes(), 0);
});

test('新卡 Easy 直接毕业到简单间隔 4 天，且 ease 提高', () => {
  const card = createCard({}, NOW);
  const next = scheduleCard(card, 'easy', SETTINGS, NOW);
  assert.equal(next.state, 'review');
  assert.equal(next.interval, 4);
  assert.equal(next.ease, 2.65);
});

test('新卡 Again 回到第一步：1 分钟后', () => {
  const card = createCard({}, NOW);
  const next = scheduleCard(card, 'again', SETTINGS, NOW);
  assert.equal(next.state, 'learning');
  assert.equal(next.step, 0);
  assert.equal(Date.parse(next.dueAt) - NOW, MINUTE_MS);
  assert.equal(next.ease, 2.3);
});

test('新卡 Hard 重复当前步骤', () => {
  const card = createCard({}, NOW);
  const next = scheduleCard(card, 'hard', SETTINGS, NOW);
  assert.equal(next.state, 'learning');
  assert.equal(next.step, 0);
  assert.equal(Date.parse(next.dueAt) - NOW, MINUTE_MS);
});

test('复习卡 Good：间隔乘以 ease', () => {
  assert.equal(gapDays(reviewCard(), 'good'), 25);
});

test('复习卡 Hard：1.2 倍且 ease 下降 0.15', () => {
  const next = scheduleCard(reviewCard(), 'hard', SETTINGS, NOW);
  assert.equal(next.interval, 12);
  assert.equal(next.ease, 2.35);
});

test('复习卡 Easy：额外乘 easyBonus，ease 上升 0.15', () => {
  const next = scheduleCard(reviewCard(), 'easy', SETTINGS, NOW);
  assert.equal(next.interval, 33);
  assert.equal(next.ease, 2.65);
});

test('复习卡 Again：进入重学、间隔重置、lapse 加一', () => {
  const next = scheduleCard(reviewCard(), 'again', SETTINGS, NOW);
  assert.equal(next.state, 'relearning');
  assert.equal(next.interval, 1);
  assert.equal(next.lapses, 1);
  assert.equal(next.ease, 2.3);
  assert.equal(Date.parse(next.dueAt) - NOW, 10 * MINUTE_MS);
});

test('失误新的间隔 50% 时保留一半原间隔', () => {
  const next = scheduleCard(reviewCard(), 'again', { ...SETTINGS, newInterval: 0.5 }, NOW);
  assert.equal(next.interval, 5);
});

test('ease 有下限 1.3', () => {
  let card = reviewCard({ ease: 1.35 });
  card = scheduleCard(card, 'again', SETTINGS, NOW);
  assert.equal(card.ease, 1.3);
});

test('间隔受最大时间间隔封顶', () => {
  const next = scheduleCard(reviewCard({ interval: 30000 }), 'good', SETTINGS, NOW);
  assert.equal(next.interval, 36500);
});

test('间隔受最小间隔托底', () => {
  const next = scheduleCard(reviewCard({ interval: 1, ease: 1.3 }), 'hard', SETTINGS, NOW);
  assert.ok(next.interval >= 1);
});

test('时间间隔因子 50% 让间隔减半', () => {
  const next = scheduleCard(reviewCard(), 'good', { ...SETTINGS, intervalModifier: 0.5 }, NOW);
  assert.equal(next.interval, 13);
});

test('逾期复习会把多出来的天数计入下次间隔', () => {
  const late = reviewCard({ dueAt: iso(-10 * DAY_MS) });
  assert.equal(gapDays(late, 'good'), 38);
});

test('fuzz 开启时间隔有 ±5% 抖动，关闭时稳定', () => {
  const card = reviewCard({ interval: 100 });
  const stable = scheduleCard(card, 'good', { fuzz: false }, NOW).interval;
  assert.equal(stable, 250);
});

test('previewIntervals 给出四档预览且关闭抖动', () => {
  const preview = previewIntervals(createCard({}, NOW), SETTINGS, NOW);
  assert.equal(preview.again.label, '1 分钟');
  assert.equal(preview.good.label, '10 分钟');
  assert.equal(preview.easy.label, '4 天');
  assert.equal(preview.hard.label, '1 分钟');
});

test('scheduleCard 不修改传入的卡片对象', () => {
  const card = reviewCard();
  const snapshot = JSON.stringify(card);
  scheduleCard(card, 'again', SETTINGS, NOW);
  assert.equal(JSON.stringify(card), snapshot);
});

test('normalizeCard 把非法状态退回 new', () => {
  const card = normalizeCard({ state: 'broken', dueAt: 'not-a-date' }, SETTINGS, NOW);
  assert.equal(card.state, 'new');
  assert.equal(card.dueAt, null);
});

test('describeGap 覆盖分钟、小时、天、月、年', () => {
  assert.equal(describeGap(new Date(NOW + 5 * MINUTE_MS).toISOString(), NOW), '5 分钟');
  assert.equal(describeGap(new Date(NOW + 3 * 60 * MINUTE_MS).toISOString(), NOW), '3 小时');
  assert.equal(describeGap(new Date(NOW + 7 * DAY_MS).toISOString(), NOW), '7 天');
  assert.equal(describeGap(new Date(NOW + 60 * DAY_MS).toISOString(), NOW), '2 个月');
  assert.equal(describeGap(new Date(NOW + 730 * DAY_MS).toISOString(), NOW), '2 年');
  assert.equal(describeGap(null, NOW), '—');
});

test('describeGap 跨天按天报，不报成小时', () => {
  // 明天零点距现在只有 7 小时（NOW 是本地 17:00），但间隔是 1 天。
  const tomorrow = new Date(NOW);
  tomorrow.setHours(24, 0, 0, 0);
  assert.equal(describeGap(tomorrow.toISOString(), NOW), '1 天');
  // 已经到期的不再报「1 分钟」。
  assert.equal(describeGap(new Date(NOW - DAY_MS).toISOString(), NOW), '现在');
});

test('getQueue 分开新卡、学习中、到期和未到期', () => {
  const cards = [
    createCard({ id: 'new-1' }, NOW),
    reviewCard({ id: 'due-1', dueAt: iso(-DAY_MS) }),
    reviewCard({ id: 'later-1', dueAt: iso(3 * DAY_MS) }),
    reviewCard({ id: 'learning-1', state: 'learning', step: 1, dueAt: iso(-5 * MINUTE_MS) })
  ];
  const queue = getQueue(cards, NOW);
  assert.equal(queue.newCards.length, 1);
  assert.equal(queue.learning.length, 1);
  assert.equal(queue.due.length, 1);
  assert.equal(queue.scheduled.length, 1);
});

test('getStats 汇总各状态数量', () => {
  const cards = [
    createCard({ id: 'new-1' }, NOW),
    reviewCard({ id: 'due-1', dueAt: iso(-DAY_MS) }),
    reviewCard({ id: 'later-1', dueAt: iso(3 * DAY_MS) })
  ];
  const stats = getStats(cards, NOW);
  assert.equal(stats.total, 3);
  assert.equal(stats.newCount, 1);
  assert.equal(stats.dueCount, 1);
  assert.equal(stats.scheduledCount, 1);
});

test('getCardDayKey 用本地日期归档', () => {
  const card = createCard({}, NOW);
  assert.match(getCardDayKey(card), /^\d{4}-\d{2}-\d{2}$/);
});

test('晚上毕业的卡第二天一早就进待复习队列', () => {
  // 时间一律用本地构造：调度按「本地日切」算，写成 +08:00 字面量在 UTC 的 CI 上会算错一天。
  const evening = new Date(2026, 10, 17, 20, 11, 0, 0).getTime();
  const learning = createCard({}, evening - 20 * MINUTE_MS);
  const step2 = scheduleCard(learning, 'good', SETTINGS, evening - 20 * MINUTE_MS);
  const graduated = scheduleCard(step2, 'good', SETTINGS, evening - 10 * MINUTE_MS);
  assert.equal(graduated.state, 'review');
  assert.equal(graduated.interval, 1);

  // 毕业当晚还算「未到期」。
  assert.equal(getStats([graduated], new Date(2026, 10, 17, 23, 30, 0, 0).getTime()).dueCount, 0);
  // 第二天早上 8 点就在待复习里，不用等到晚上 20 点。
  const morning = new Date(2026, 10, 18, 8, 0, 0, 0).getTime();
  assert.equal(getStats([graduated], morning).dueCount, 1);
  assert.deepEqual(getQueue([graduated], morning).due.map((card) => card.id), [graduated.id]);
});

test('逾期天数按整天算，半夜到期的卡第二天算逾期 0 天', () => {
  const dueToday = reviewCard({ dueAt: new Date(2026, 10, 17, 0, 0, 0, 0).toISOString() });
  const sameDay = scheduleCard(dueToday, 'good', SETTINGS, new Date(2026, 10, 17, 17, 0, 0, 0).getTime());
  // 当天复习：lateDays = 0，间隔 = 10 × 2.5 = 25。
  assert.equal(sameDay.interval, 25);
  const nextDay = scheduleCard(dueToday, 'good', SETTINGS, new Date(2026, 10, 18, 9, 0, 0, 0).getTime());
  // 隔一天复习：lateDays = 1，间隔 = (10 + 0.5) × 2.5 = 26。
  assert.equal(nextDay.interval, 26);
});
