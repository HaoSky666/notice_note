/* 同步合并：把 PC 与手机两端的数据合成一份。
 *
 * 合并只跑在 PC 端——手机是纯客户端，拉清单、推变更、照单全收。所以这里
 * 只有一份实现，不用两端各写一遍，也就不存在两套逻辑漂移的问题。
 * （UMD 双端可用：手机端只取 collectRemovedIds 算删除，合并本身仍在 PC 跑。）
 *
 * 三条规则（改之前先看明白为什么这样定）：
 *
 * 1. 记忆卡的内容和调度分开比时间。
 *    手机能改的只有调度（评分），PC 能改的只有内容（正面/背面/类型）。
 *    如果整卡按一个时间戳取新，会出现两种互相伤害的情况：
 *      · 手机上复习过、PC 后来改了错别字 → 整卡取 PC，复习进度没了
 *      · PC 上复习过、手机在旧内容上评过分 → 整卡取手机，改的错别字被盖回去
 *    所以内容恒取 PC，调度按 lastReviewedAt 谁新用谁。
 *
 * 2. PC 是权威集合。手机端本期不新建、不编辑、不删除笔记和卡片，
 *    因此「手机有、PC 没有」只可能是 PC 已经删了，直接丢。
 *    这也让笔记/文件夹/附件不需要墓碑字段。
 *
 * 3. 时间相同一律判给 PC。合并结果必须是确定的，
 *    否则两端各点一次同步会得到两种结果。
 *
 * 回顾状态（天级「已看过」锚点 + 完成事件日志）沿用同一套规则：
 * 锚点按 reviewedAt 谁新用谁、平局判 PC；日志是追加型，按 id 取并集。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.NoticeNoteSyncMerge = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const CARD_CONTENT_FIELDS = ['front', 'back', 'types'];
  const CARD_SCHEDULE_FIELDS = [
    'state',
    'step',
    'interval',
    'ease',
    'dueAt',
    'reps',
    'lapses',
    'introducedAt',
    'lastReviewedAt'
  ];

  function toTime(value) {
    if (!value) {
      return 0;
    }
    const time = Date.parse(value);
    return Number.isFinite(time) ? time : 0;
  }

  function pickFields(source, fields) {
    const picked = {};
    for (const field of fields) {
      if (Object.prototype.hasOwnProperty.call(source, field)) {
        picked[field] = source[field];
      }
    }
    return picked;
  }

  // 一张卡的合并结果。scheduleFrom 说明调度是谁的，界面可以据此提示
  // 「这张卡的复习进度来自手机」。
  function mergeMemoryCard(pcCard, phoneCard) {
    const base = { ...pcCard };
    if (!phoneCard) {
      return { card: base, scheduleFrom: 'pc', changed: false };
    }
    const pcReviewedAt = toTime(pcCard.lastReviewedAt);
    const phoneReviewedAt = toTime(phoneCard.lastReviewedAt);
    // 手机没复习过，或 PC 的复习更近：调度照抄 PC
    if (!phoneReviewedAt || phoneReviewedAt <= pcReviewedAt) {
      return { card: base, scheduleFrom: 'pc', changed: false };
    }
    const merged = {
      ...base,
      ...pickFields(phoneCard, CARD_SCHEDULE_FIELDS)
    };
    // updatedAt 取两端较晚的，避免同步完又被当成「旧数据」
    if (toTime(phoneCard.updatedAt) > toTime(pcCard.updatedAt)) {
      merged.updatedAt = phoneCard.updatedAt;
    }
    return { card: merged, scheduleFrom: 'phone', changed: true };
  }

  // 牌组合并。pcCards 是权威集合，顺序也以 PC 为准（列表排序不因同步而跳动）。
  function mergeMemoryCards(pcCards, phoneCards) {
    const pcList = Array.isArray(pcCards) ? pcCards : [];
    const phoneList = Array.isArray(phoneCards) ? phoneCards : [];
    const phoneById = new Map();
    for (const card of phoneList) {
      if (card && typeof card.id === 'string' && !phoneById.has(card.id)) {
        phoneById.set(card.id, card);
      }
    }

    const cards = [];
    const adoptedIds = [];
    let adoptedFromPhone = 0;
    for (const pcCard of pcList) {
      if (!pcCard || typeof pcCard.id !== 'string') {
        continue;
      }
      const result = mergeMemoryCard(pcCard, phoneById.get(pcCard.id));
      cards.push(result.card);
      if (result.changed) {
        adoptedFromPhone += 1;
        adoptedIds.push(pcCard.id);
      }
    }

    const pcIds = new Set(pcList.map((card) => card && card.id).filter(Boolean));
    const adoptedSet = new Set(adoptedIds);
    const droppedFromPhone = phoneList
      .filter((card) => card && typeof card.id === 'string' && !pcIds.has(card.id))
      .map((card) => card.id);
    const unchanged = phoneList.filter(
      (card) => card && typeof card.id === 'string' && pcIds.has(card.id) && !adoptedSet.has(card.id)
    ).length;

    return {
      cards,
      stats: {
        total: cards.length,
        adoptedFromPhone,
        adoptedIds,
        // 手机有、PC 没有：PC 已经删掉了，或者手机端产生了 PC 不认识的数据。
        // 前一种是正常情况，后一种说明手机端越权写了，值得报警。
        droppedFromPhone,
        // 两端都有但调度没变过的卡，同步时不必上传
        unchanged
      }
    };
  }

  // 作答历史是追加型日志：按 id 取并集即可，不存在真正的冲突。
  // 同一条被改判过时（PC 端「改判」会原地更新），保留 edited 为 true 的那份。
  function mergeAnswerEntries(pcEntries, phoneEntries) {
    const pcList = Array.isArray(pcEntries) ? pcEntries : [];
    const phoneList = Array.isArray(phoneEntries) ? phoneEntries : [];
    const merged = new Map();
    for (const entry of pcList) {
      if (entry && typeof entry.id === 'string') {
        merged.set(entry.id, { ...entry });
      }
    }
    let addedFromPhone = 0;
    for (const entry of phoneList) {
      if (!entry || typeof entry.id !== 'string') {
        continue;
      }
      const existing = merged.get(entry.id);
      if (!existing) {
        merged.set(entry.id, { ...entry });
        addedFromPhone += 1;
        continue;
      }
      if (!existing.edited && entry.edited) {
        merged.set(entry.id, { ...entry });
      }
    }
    const entries = [...merged.values()].sort(
      (a, b) => toTime(a.createdAt) - toTime(b.createdAt)
    );
    return { entries, stats: { total: entries.length, addedFromPhone } };
  }

  // 回顾锚点：key 形如 day:YYYY-MM-DD，value 是最后一次「已看过」的 ISO 时间。
  // 手机只回传它完成过的天；谁新用谁，平局判 PC（规则 3）。
  // adoptedDayKeys 供主进程把这些天从手动顺序里移除（与 PC 端完成回顾同语义）。
  function mergeReviewHistory(pcHistory, phoneHistory) {
    const pcMap = pcHistory && typeof pcHistory === 'object' && !Array.isArray(pcHistory)
      ? pcHistory
      : {};
    const phoneMap = phoneHistory && typeof phoneHistory === 'object' && !Array.isArray(phoneHistory)
      ? phoneHistory
      : {};
    const history = { ...pcMap };
    const adoptedDayKeys = [];
    for (const [key, value] of Object.entries(phoneMap)) {
      if (!/^day:\d{4}-\d{2}-\d{2}$/.test(key) || typeof value !== 'string' || !toTime(value)) {
        continue;
      }
      if (toTime(value) > toTime(pcMap[key])) {
        history[key] = value;
        adoptedDayKeys.push(key.slice(4));
      }
    }
    return { history, adoptedDayKeys };
  }

  // 回顾事件日志：追加型，按 id 取并集（与作答历史同规则），按时间升序。
  // 条数上限由主进程收口，这里只做合并，保持纯函数。
  function mergeReviewLog(pcLog, phoneLog) {
    const pcList = Array.isArray(pcLog) ? pcLog : [];
    const phoneList = Array.isArray(phoneLog) ? phoneLog : [];
    const merged = new Map();
    const isValid = (item) => item && typeof item.id === 'string'
      && /^\d{4}-\d{2}-\d{2}$/.test(item.dayKey) && typeof item.reviewedAt === 'string';
    for (const item of pcList) {
      if (isValid(item)) {
        merged.set(item.id, { ...item });
      }
    }
    let addedFromPhone = 0;
    for (const item of phoneList) {
      if (!isValid(item) || merged.has(item.id)) {
        continue;
      }
      merged.set(item.id, { ...item });
      addedFromPhone += 1;
    }
    const log = [...merged.values()].sort(
      (a, b) => toTime(a.reviewedAt) - toTime(b.reviewedAt)
    );
    return { log, stats: { total: log.length, addedFromPhone } };
  }

  // 手机端本地有、但清单里没有的 id = 应该删掉。清单必须是全量的，
  // 增量清单算不出删除，所以这里显式接收「全量 id 集合」。
  // keepIds 缺失时直接报错而不是当成空集合：当成空集合会把手机上的数据全删了。
  function collectRemovedIds(localIds, keepIds) {
    if (!Array.isArray(keepIds) && !(keepIds instanceof Set)) {
      throw new TypeError('collectRemovedIds 需要全量 id 集合');
    }
    const keep = keepIds instanceof Set ? keepIds : new Set(keepIds);
    const local = Array.isArray(localIds) ? localIds : [];
    return local.filter((id) => typeof id === 'string' && !keep.has(id));
  }

  return {
    CARD_CONTENT_FIELDS,
    CARD_SCHEDULE_FIELDS,
    mergeMemoryCard,
    mergeMemoryCards,
    mergeAnswerEntries,
    mergeReviewHistory,
    mergeReviewLog,
    collectRemovedIds
  };
});