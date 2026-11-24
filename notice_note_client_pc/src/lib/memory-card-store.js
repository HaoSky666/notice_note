// 记忆卡的落盘格式与学习队列（纯函数部分，IO 留在 main.js）。
//
// 目录约定：记忆卡跟着笔记库走，落在 notesPath/.memory_card/。
// 这样切换笔记库时记忆卡自动隔离，备份笔记库也会带上记忆卡。
//
// UMD：Node 走 module.exports，浏览器挂 window.NoticeNoteMemoryCardStore（手机端复用）。
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(
      require('./sm2-scheduler'),
      require('./date-utils'),
      require('./memory-types')
    );
  } else {
    root.NoticeNoteMemoryCardStore = factory(
      root.NoticeNoteSm2Scheduler,
      root.NoticeNoteDateUtils,
      root.NoticeNoteMemoryTypes
    );
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (sm2, dateUtils, memoryTypes) {
  'use strict';

  const {
    DEFAULT_SETTINGS,
    normalizeSettings,
    normalizeCard,
    getQueue,
    getStats,
    previewIntervals,
    describeGap,
    isCardDue
  } = sm2;
  const { toLocalDateKey } = dateUtils;
  const { collectCardTypes, hasCardType, normalizeTypeName } = memoryTypes;

  const MEMORY_CARD_DIR_NAME = '.memory_card';
  const MEMORY_CARD_FILE_NAME = 'cards.json';
  const MEMORY_SETTINGS_FILE_NAME = 'settings.json';
  const MEMORY_STORE_VERSION = 1;
  const DEFAULT_NEW_CARDS_PER_DAY = 20;

  function normalizeMemorySettings(input = {}) {
    const settings = normalizeSettings(input);
    return {
      ...DEFAULT_SETTINGS,
      ...settings,
      // 每天最多引入多少张新卡。不在截图的 10 个参数里，是 Anki 的牌组日限额，
      // 没有它新卡会一次性全涌进来。
      newCardsPerDay: Math.max(
        1,
        Math.round(Number(input.newCardsPerDay) || DEFAULT_NEW_CARDS_PER_DAY)
      )
    };
  }

  // 兼容两种历史形态：裸数组，或 { version, cards }。重复 id 只保留第一张。
  function normalizeCardStore(raw, settingsInput = {}) {
    const settings = normalizeMemorySettings(settingsInput);
    const list = Array.isArray(raw)
      ? raw
      : (raw && Array.isArray(raw.cards) ? raw.cards : []);
    const seen = new Set();
    const cards = [];
    for (const item of list) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        continue;
      }
      const card = normalizeCard(item, settings, Date.now());
      if (seen.has(card.id)) {
        continue;
      }
      seen.add(card.id);
      cards.push(card);
    }
    return { version: MEMORY_STORE_VERSION, cards };
  }

  function buildCardStore(cards) {
    return {
      version: MEMORY_STORE_VERSION,
      cards: Array.isArray(cards) ? cards : []
    };
  }

  // 今天还能引入几张新卡 = 日限额 - 今天已经评过分的新卡。
  function getNewCardQuota(cards, settingsInput = {}, now = Date.now()) {
    const settings = normalizeMemorySettings(settingsInput);
    const today = toLocalDateKey(new Date(now));
    const introducedToday = (Array.isArray(cards) ? cards : []).filter((card) => (
      card.introducedAt && toLocalDateKey(new Date(card.introducedAt)) === today
    )).length;
    return Math.max(0, settings.newCardsPerDay - introducedToday);
  }

  // 一次学习会话：学习中的优先，其次到期复习，最后才是新卡（且受日限额约束）。
  // studyOrder 只影响每组内部的先后（见 sm2-scheduler 的 getQueue）。
  function buildStudyQueue(cards, settingsInput = {}, now = Date.now()) {
    const settings = normalizeMemorySettings(settingsInput);
    const queue = getQueue(cards, now, settings);
    const quota = getNewCardQuota(cards, settings, now);
    return {
      learning: queue.learning,
      due: queue.due,
      newCards: queue.newCards.slice(0, quota),
      scheduled: queue.scheduled,
      quota,
      stats: getStats(cards, now, settings)
    };
  }

  // 当前该学哪一张：学习中的卡最先（它们有分钟级到期时间），其次到期复习，最后新卡。
  function pickNextCard(queue) {
    const groups = [queue.learning, queue.due, queue.newCards];
    for (const group of groups) {
      if (Array.isArray(group) && group.length > 0) {
        return group[0];
      }
    }
    return null;
  }

  // 发给渲染层的快照：卡片带好展示用的 dueLabel / isDue / 四档预览，
  // 队列只回 id 数组，避免同一张卡在 IPC 里出现两份。
  // 放在 lib 而不是 main.js，是为了让「界面拿到的结构」也能被单测锁住。
  //
  // options.type（可选，按类型学习）：只统计、只排队该类型的卡；
  // 类型目录与 allTotal 始终基于全部卡片，否则筛选后其他类型会从切换条里消失。
  function buildMemorySnapshot(cards, settingsInput = {}, now = Date.now(), options = {}) {
    const settings = normalizeMemorySettings(settingsInput);
    const all = (Array.isArray(cards) ? cards : [])
      .map((card) => normalizeCard(card, settings, now));
    const catalog = collectCardTypes(all);
    // 目录里没有的类型名一律视为「没筛」，否则界面会拿着 'redis' 去和 'Redis' 比，
    // 切换条上的选中态永远对不上。
    const requested = normalizeTypeName(options && options.type);
    const matched = requested
      ? catalog.find((item) => item.name.toLowerCase() === requested.toLowerCase())
      : null;
    const type = matched ? matched.name : null;
    const list = type ? all.filter((card) => hasCardType(card, type)) : all;
    const queue = buildStudyQueue(list, settings, now);
    const toIds = (group) => group.map((card) => card.id);
    return {
      cards: list.map((card) => ({
        ...card,
        dueLabel: card.state === 'new'
          ? '未开始'
          : (isCardDue(card, now) ? '现在' : describeGap(card.dueAt, now)),
        isDue: isCardDue(card, now),
        preview: previewIntervals(card, settings, now)
      })),
      settings,
      type,
      types: catalog,
      queue: {
        learning: toIds(queue.learning),
        due: toIds(queue.due),
        newCards: toIds(queue.newCards),
        scheduled: toIds(queue.scheduled),
        quota: queue.quota
      },
      stats: {
        ...queue.stats,
        // 当前筛选之外的卡片总数，用来在「2 / 12 张」里显示后半截
        allTotal: all.length
      }
    };
  }

  return {
    MEMORY_CARD_DIR_NAME,
    MEMORY_CARD_FILE_NAME,
    MEMORY_SETTINGS_FILE_NAME,
    MEMORY_STORE_VERSION,
    DEFAULT_NEW_CARDS_PER_DAY,
    normalizeMemorySettings,
    normalizeCardStore,
    buildCardStore,
    getNewCardQuota,
    buildStudyQueue,
    buildMemorySnapshot,
    pickNextCard
  };
});