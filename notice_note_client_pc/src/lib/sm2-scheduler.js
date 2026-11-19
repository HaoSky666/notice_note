// SM-2 间隔重复调度器（Anki legacy 参数集），纯函数实现。
// 不读写文件、不取系统时间；`now` 一律由调用方传入毫秒时间戳，便于单测与回溯。
//
// 设置项与中文界面参数一一对应（括号里是截图里的写法）：
//   learningSteps        （新卡间隔步伐(分)）      新卡当天的分钟级步骤，如 [1, 10]
//   graduatingInterval   （新卡毕业间隔(天)）      走完步骤后第一次进入复习池的天数
//   easyInterval         （新卡简单间隔(天)）      新卡直接按「简单」跳过的天数
//   startingEase         （新卡初始难度(%)）       2.5 = 250%。界面译作「难度」是错的，
//                                                   这个值越高间隔涨得越快，本质是「简易度」
//   maximumInterval      （复习最大时间间隔(天)）  间隔上限
//   easyBonus            （复习简单奖励(%)）       1.3 = 130%，按 Easy 时额外乘的系数
//   intervalModifier     （复习时间间隔因子(%)）   1.0 = 100%，所有间隔的全局倍率
//   relearningSteps      （失误间隔步伐(分)）      遗忘后的分钟级重学步骤
//   newInterval          （失误新的间隔(%)）       遗忘后保留原间隔的比例，0 = 重置
//   minimumInterval      （失误最小间隔(天)）      天级间隔下限
//
// 与 Anki 的差异只有两处，都是为了可解释性：
// 1. ease 在学习和重学阶段也按四档调整（Anki 传统调度器主要只在复习阶段调），
//    否则一张反复按 Again 的新卡会以 2.5 的 ease 毕业，明显偏乐观。
// 2. fuzz（±5% 抖动）做成开关，默认开启；预览间隔时强制关闭，保证按钮上的数字稳定。
//
// 天级间隔与 Anki 一致，按「本地日切」而不是 24 小时整：
// 间隔 1 天 = 明天零点到期，所以晚上毕业的卡第二天一早就能复习。
//
// UMD：Node 走 module.exports（依赖 require），浏览器挂 window.NoticeNoteSm2Scheduler，
// 依赖由 index.html 先加载的 NoticeNoteDateUtils / NoticeNoteMemoryTypes 提供。
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(
      require('./date-utils'),
      require('./memory-types'),
      require('node:crypto')
    );
  } else {
    // 浏览器端 randomUUID：优先原生 crypto.randomUUID；老 WebView 退回 Math.random 版。
    // 手机端不新建卡片，这个 fallback 只用于 normalizeCard 补 id 的极端情况。
    const webCrypto = root.crypto;
    const randomUUID = webCrypto && typeof webCrypto.randomUUID === 'function'
      ? () => webCrypto.randomUUID()
      : () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
        const rand = Math.random() * 16 | 0;
        return (char === 'x' ? rand : (rand & 0x3 | 0x8)).toString(16);
      });
    root.NoticeNoteSm2Scheduler = factory(
      root.NoticeNoteDateUtils,
      root.NoticeNoteMemoryTypes,
      { randomUUID }
    );
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (dateUtils, memoryTypes, cryptoLib) {
  'use strict';

  const { toLocalDateKey } = dateUtils;
  const { normalizeCardTypes } = memoryTypes;
  const { randomUUID } = cryptoLib;

  const MINUTE_MS = 60 * 1000;
  const DAY_MS = 24 * 60 * 60 * 1000;
  const MIN_EASE = 1.3;
  const MAX_EASE = 5;
  const HARD_INTERVAL_MULTIPLIER = 1.2;
  const EASE_DELTA = { again: -0.2, hard: -0.15, good: 0, easy: 0.15 };
  const FUZZ_RANGE = 0.05;
  const RATINGS = ['again', 'hard', 'good', 'easy'];
  const VALID_STATES = new Set(['new', 'learning', 'review', 'relearning']);

  const DEFAULT_SETTINGS = {
    learningSteps: [1, 10],
    graduatingInterval: 1,
    easyInterval: 4,
    startingEase: 2.5,
    maximumInterval: 36500,
    easyBonus: 1.3,
    intervalModifier: 1,
    relearningSteps: [10],
    newInterval: 0,
    minimumInterval: 1,
    fuzz: true
  };

  function toNumber(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  // 百分比兼容：界面传 250 / 130 / 100 / 0 时按百分数换算，传 2.5 / 1.3 / 1 / 0 时原样使用。
  // 阈值取 10：正常的 ease 和倍率不会超过 10，超过就只可能是百分数。
  function fromPercent(value, fallback) {
    const number = toNumber(value, fallback);
    return number > 10 ? number / 100 : number;
  }

  function normalizeSteps(value, fallback) {
    const source = Array.isArray(value)
      ? value
      : (typeof value === 'string' ? value.split(/[\s,，]+/) : []);
    const steps = source
      .map((item) => toNumber(item, NaN))
      .filter((item) => Number.isFinite(item) && item > 0)
      .map((item) => Math.max(1, Math.round(item)));
    const unique = [...new Set(steps)];
    return unique.length > 0 ? unique.sort((a, b) => a - b) : [...fallback];
  }

  function normalizeSettings(input = {}) {
    const minimumInterval = Math.max(1, Math.round(toNumber(input.minimumInterval, DEFAULT_SETTINGS.minimumInterval)));
    const maximumInterval = Math.max(
      minimumInterval,
      Math.round(toNumber(input.maximumInterval, DEFAULT_SETTINGS.maximumInterval))
    );
    return {
      learningSteps: normalizeSteps(input.learningSteps, DEFAULT_SETTINGS.learningSteps),
      graduatingInterval: Math.max(1, Math.round(toNumber(input.graduatingInterval, DEFAULT_SETTINGS.graduatingInterval))),
      easyInterval: Math.max(1, Math.round(toNumber(input.easyInterval, DEFAULT_SETTINGS.easyInterval))),
      startingEase: clamp(fromPercent(input.startingEase, DEFAULT_SETTINGS.startingEase), MIN_EASE, MAX_EASE),
      maximumInterval,
      easyBonus: clamp(fromPercent(input.easyBonus, DEFAULT_SETTINGS.easyBonus), 1, 5),
      intervalModifier: clamp(fromPercent(input.intervalModifier, DEFAULT_SETTINGS.intervalModifier), 0.1, 5),
      relearningSteps: normalizeSteps(input.relearningSteps, DEFAULT_SETTINGS.relearningSteps),
      newInterval: clamp(fromPercent(input.newInterval, DEFAULT_SETTINGS.newInterval), 0, 1),
      minimumInterval,
      fuzz: input.fuzz !== false
    };
  }

  function createCard(input = {}, now = Date.now()) {
    const time = toNumber(now, Date.now());
    const timestamp = new Date(time).toISOString();
    return {
      id: typeof input.id === 'string' && input.id ? input.id : randomUUID(),
      front: typeof input.front === 'string' ? input.front : '',
      back: typeof input.back === 'string' ? input.back : '',
      // 类型：一张卡可属于多个类型，只影响分组与筛选，不参与调度。
      types: normalizeCardTypes(input.types),
      state: 'new',
      step: 0,
      interval: 0,
      ease: DEFAULT_SETTINGS.startingEase,
      dueAt: null,
      reps: 0,
      lapses: 0,
      createdAt: typeof input.createdAt === 'string' ? input.createdAt : timestamp,
      updatedAt: timestamp,
      lastReviewedAt: null,
      // 第一次评分的时间。newCardsPerDay 用它统计「今天已经引入了几张新卡」，
      // 否则学完一批新卡后列表会继续补货，限额形同虚设。
      introducedAt: null
    };
  }

  // 从磁盘读回或外部传入时补齐字段；非法状态一律退回 new，避免一张坏卡卡住整个牌组。
  function normalizeCard(input = {}, settingsInput = {}, now = Date.now()) {
    const settings = normalizeSettings(settingsInput);
    const base = createCard(input, now);
    const state = VALID_STATES.has(input.state) ? input.state : 'new';
    const dueTime = typeof input.dueAt === 'string' ? Date.parse(input.dueAt) : NaN;
    return {
      ...base,
      front: typeof input.front === 'string' ? input.front : '',
      back: typeof input.back === 'string' ? input.back : '',
      state,
      step: Math.max(0, Math.round(toNumber(input.step, 0))),
      interval: Math.max(0, Math.round(toNumber(input.interval, 0))),
      ease: clamp(toNumber(input.ease, settings.startingEase), MIN_EASE, MAX_EASE),
      dueAt: Number.isFinite(dueTime) ? new Date(dueTime).toISOString() : null,
      reps: Math.max(0, Math.round(toNumber(input.reps, 0))),
      lapses: Math.max(0, Math.round(toNumber(input.lapses, 0))),
      createdAt: typeof input.createdAt === 'string' ? input.createdAt : base.createdAt,
      updatedAt: typeof input.updatedAt === 'string' ? input.updatedAt : base.updatedAt,
      lastReviewedAt: typeof input.lastReviewedAt === 'string' ? input.lastReviewedAt : null,
      introducedAt: typeof input.introducedAt === 'string' ? input.introducedAt : null
    };
  }

  function adjustEase(ease, rating) {
    const delta = EASE_DELTA[rating] || 0;
    return clamp(toNumber(ease, DEFAULT_SETTINGS.startingEase) + delta, MIN_EASE, MAX_EASE);
  }

  // 天级间隔的统一收口：先取整，再压上下限，最后按需抖动。
  // 抖动只对 2 天以上的间隔生效（Anki 同款），避免短期卡片被抖成 0 天。
  function applyIntervalBounds(days, settings, random) {
    let value = Math.max(settings.minimumInterval, Math.round(days));
    value = Math.min(value, settings.maximumInterval);
    if (settings.fuzz && value > 2) {
      const factor = 1 + (random() * 2 - 1) * FUZZ_RANGE;
      value = Math.round(value * factor);
    }
    return clamp(value, settings.minimumInterval, settings.maximumInterval);
  }

  function isoAt(time) {
    return new Date(time).toISOString();
  }

  function dueFromMinutes(now, minutes) {
    return isoAt(now + minutes * MINUTE_MS);
  }

  // 本地日索引：把时刻折算成「从 1970-01-01 起第几个本地日」。
  // 用 UTC 构造避免夏令时把一天算成 23/25 小时（国内没有，但这样写更稳）。
  function localDayIndex(time) {
    const date = new Date(time);
    return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS;
  }

  // Anki 的间隔按「天」记，不按 24 小时整：
  // 晚上 20:11 毕业、间隔 1 天的卡，明天零点一过就算到期，
  // 而不是等到明天 20:11 才出现。所以这里统一从「今天 00:00」往后推。
  function dueFromDays(now, days) {
    const date = new Date(now);
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + Math.max(0, Math.round(days)));
    return isoAt(date.getTime());
  }

  // 逾期天数也按整天算：昨天到期的卡今天算逾期 1 天，不管具体几点。
  function lateDaysSince(dueAt, now) {
    const dueTime = typeof dueAt === 'string' ? Date.parse(dueAt) : NaN;
    if (!Number.isFinite(dueTime)) {
      return 0;
    }
    return Math.max(0, localDayIndex(now) - localDayIndex(dueTime));
  }

  // 学习步骤内的「困难」：重复当前步骤；最后一步按 1.5 倍延长，至少 1 分钟。
  function hardStepMinutes(step, steps) {
    const index = clamp(Math.round(step), 0, steps.length - 1);
    const minutes = steps[index];
    if (index < steps.length - 1) {
      return Math.max(1, Math.round(minutes));
    }
    return Math.max(1, Math.round(minutes * 1.5));
  }

  function graduate(next, settings, interval, now) {
    next.state = 'review';
    next.step = 0;
    next.interval = applyIntervalBounds(interval, { ...settings, fuzz: false }, Math.random);
    next.dueAt = dueFromDays(now, next.interval);
    return next;
  }

  function reviewLearningCard(next, current, rating, settings, now) {
    const steps = settings.learningSteps;
    next.ease = adjustEase(current.ease, rating);

    if (rating === 'again') {
      next.state = 'learning';
      next.step = 0;
      next.dueAt = dueFromMinutes(now, steps[0]);
      return next;
    }
    if (rating === 'hard') {
      next.state = 'learning';
      next.step = clamp(current.step, 0, steps.length - 1);
      next.dueAt = dueFromMinutes(now, hardStepMinutes(current.step, steps));
      return next;
    }
    if (rating === 'easy') {
      return graduate(next, settings, settings.easyInterval, now);
    }

    const nextStep = current.step + 1;
    if (nextStep >= steps.length) {
      return graduate(next, settings, settings.graduatingInterval, now);
    }
    next.state = 'learning';
    next.step = nextStep;
    next.dueAt = dueFromMinutes(now, steps[nextStep]);
    return next;
  }

  function reviewRelearningCard(next, current, rating, settings, now) {
    const steps = settings.relearningSteps;
    next.ease = adjustEase(current.ease, rating);

    if (rating === 'again') {
      next.state = 'relearning';
      next.step = 0;
      next.dueAt = dueFromMinutes(now, steps[0]);
      return next;
    }
    if (rating === 'hard') {
      next.state = 'relearning';
      next.step = clamp(current.step, 0, steps.length - 1);
      next.dueAt = dueFromMinutes(now, hardStepMinutes(current.step, steps));
      return next;
    }
    if (rating === 'easy') {
      return graduate(next, settings, Math.max(settings.minimumInterval, current.interval), now);
    }

    const nextStep = current.step + 1;
    if (nextStep >= steps.length) {
      return graduate(next, settings, Math.max(settings.minimumInterval, current.interval), now);
    }
    next.state = 'relearning';
    next.step = nextStep;
    next.dueAt = dueFromMinutes(now, steps[nextStep]);
    return next;
  }

  function reviewReviewCard(next, current, rating, settings, now) {
    // 逾期越久，说明记忆比预期稳，Anki 会把「多出来的天数」计入下次间隔。
    const lateDays = lateDaysSince(current.dueAt, now);

    if (rating === 'again') {
      next.ease = adjustEase(current.ease, 'again');
      next.lapses = current.lapses + 1;
      next.state = 'relearning';
      next.step = 0;
      // 0% 等于不继承原间隔，直接落回最小间隔。
      next.interval = applyIntervalBounds(
        Math.max(settings.minimumInterval, current.interval * settings.newInterval),
        { ...settings, fuzz: false },
        Math.random
      );
      next.dueAt = dueFromMinutes(now, settings.relearningSteps[0]);
      return next;
    }

    let rawInterval;
    if (rating === 'hard') {
      next.ease = adjustEase(current.ease, 'hard');
      rawInterval = Math.max(current.interval * HARD_INTERVAL_MULTIPLIER, current.interval + 1)
        * settings.intervalModifier;
    } else if (rating === 'easy') {
      next.ease = adjustEase(current.ease, 'easy');
      rawInterval = (current.interval + lateDays)
        * current.ease * settings.easyBonus * settings.intervalModifier;
    } else {
      rawInterval = (current.interval + lateDays / 2)
        * current.ease * settings.intervalModifier;
    }

    next.interval = applyIntervalBounds(rawInterval, settings, Math.random);
    next.dueAt = dueFromDays(now, next.interval);
    return next;
  }

  // 核心入口：对一张卡评一档，返回新卡（不修改入参）。
  function scheduleCard(card, rating, settingsInput = {}, now = Date.now()) {
    if (!RATINGS.includes(rating)) {
      throw new Error(`未知评分: ${rating}`);
    }
    const settings = normalizeSettings(settingsInput);
    const time = toNumber(now, Date.now());
    const current = normalizeCard(card, settings, time);
    const next = { ...current };
    next.reps = current.reps + 1;
    next.lastReviewedAt = isoAt(time);
    next.updatedAt = next.lastReviewedAt;
    if (current.state === 'new' && !current.introducedAt) {
      next.introducedAt = next.lastReviewedAt;
    }

    if (current.state === 'new' || current.state === 'learning') {
      return reviewLearningCard(next, current, rating, settings, time);
    }
    if (current.state === 'relearning') {
      return reviewRelearningCard(next, current, rating, settings, time);
    }
    return reviewReviewCard(next, current, rating, settings, time);
  }

  function trimNumber(value) {
    return String(Math.round(value * 10) / 10).replace(/\.0$/, '');
  }

  // 把「距现在的时长」写成人话。
  // 跨天之后一律按「几天」说，不再报小时：日切语义下「明天零点」才是 1 天，
  // 报成「7 小时」会让人以为间隔被算错了。
  function describeGap(target, now = Date.now()) {
    if (target === null || target === undefined || target === '') {
      return '—';
    }
    const time = typeof target === 'string' ? Date.parse(target) : Number(target);
    if (!Number.isFinite(time)) {
      return '—';
    }
    if (time <= now) {
      return '现在';
    }
    const dayGap = localDayIndex(time) - localDayIndex(now);
    if (dayGap >= 1) {
      if (dayGap < 30) {
        return `${dayGap} 天`;
      }
      if (dayGap < 365) {
        return `${trimNumber(dayGap / 30)} 个月`;
      }
      return `${trimNumber(dayGap / 365)} 年`;
    }
    const diff = time - now;
    const minutes = Math.max(1, Math.round(diff / MINUTE_MS));
    if (minutes < 60) {
      return `${minutes} 分钟`;
    }
    return `${Math.round(minutes / 60)} 小时`;
  }

  // 四个按钮上的预览。强制关掉抖动，保证同一张卡每次看到的结果一致。
  function previewIntervals(card, settingsInput = {}, now = Date.now()) {
    const settings = normalizeSettings(settingsInput);
    settings.fuzz = false;
    const time = toNumber(now, Date.now());
    const result = {};
    for (const rating of RATINGS) {
      const next = scheduleCard(card, rating, settings, time);
      result[rating] = {
        dueAt: next.dueAt,
        state: next.state,
        interval: next.interval,
        ease: next.ease,
        label: describeGap(next.dueAt, time)
      };
    }
    return result;
  }

  function isCardDue(card, now = Date.now()) {
    if (!card || !card.dueAt) {
      return false;
    }
    const dueTime = Date.parse(card.dueAt);
    return Number.isFinite(dueTime) && dueTime <= now;
  }

  function byDueAt(a, b) {
    return String(a.dueAt || '').localeCompare(String(b.dueAt || ''));
  }

  // 复习队列：新卡单独一组（由调用方决定每天放几张），学习中的和到期的分开排。
  function getQueue(cards, now = Date.now()) {
    const list = Array.isArray(cards) ? cards.map((card) => normalizeCard(card, {}, now)) : [];
    const newCards = [];
    const learning = [];
    const due = [];
    const scheduled = [];
    for (const card of list) {
      if (card.state === 'new') {
        newCards.push(card);
      } else if (card.state === 'learning' || card.state === 'relearning') {
        // 分钟级步骤没到点的卡不能立刻再出现，否则按 Again 之后会原地卡住。
        if (isCardDue(card, now)) {
          learning.push(card);
        } else {
          scheduled.push(card);
        }
      } else if (isCardDue(card, now)) {
        due.push(card);
      } else {
        scheduled.push(card);
      }
    }
    newCards.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
    learning.sort(byDueAt);
    due.sort(byDueAt);
    scheduled.sort(byDueAt);
    return { newCards, learning, due, scheduled };
  }

  function getStats(cards, now = Date.now()) {
    const list = Array.isArray(cards) ? cards.map((card) => normalizeCard(card, {}, now)) : [];
    const queue = getQueue(list, now);
    const today = toLocalDateKey(new Date(now));
    const reviewedToday = list.filter((card) => (
      card.lastReviewedAt && toLocalDateKey(new Date(card.lastReviewedAt)) === today
    )).length;
    const introducedToday = list.filter((card) => (
      card.introducedAt && toLocalDateKey(new Date(card.introducedAt)) === today
    )).length;
    return {
      total: list.length,
      newCount: queue.newCards.length,
      learningCount: queue.learning.length,
      dueCount: queue.due.length,
      scheduledCount: queue.scheduled.length,
      reviewedToday,
      introducedToday
    };
  }

  // 卡片按「引用日」归档只存 createdAt 的本地日期，列表分组和导出都用它。
  function getCardDayKey(card) {
    const time = Date.parse(card && card.createdAt);
    return Number.isFinite(time) ? toLocalDateKey(new Date(time)) : '';
  }

  return {
    MINUTE_MS,
    DAY_MS,
    RATINGS,
    DEFAULT_SETTINGS,
    normalizeSettings,
    normalizeCard,
    createCard,
    scheduleCard,
    previewIntervals,
    describeGap,
    isCardDue,
    getQueue,
    getStats,
    getCardDayKey
  };
});