/* 日历 / 回顾共用的「天」索引（UMD + 浏览器全局）
 * 以前 sidebar.js 的 getCalendarReminderEntries 与 review-browser.js 的 getReviewDayMap
 * 各自组装数据，同一天在两处可能显示不同数量/状态。这里把 dayKey -> 内容 收敛成唯一来源。
 * Node 侧 module.exports 供 tests/day-index.test.js 直接测试。
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    for (var key in api) {
      if (Object.prototype.hasOwnProperty.call(api, key)) {
        root[key] = api[key];
      }
    }
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function pad(value) {
    return String(value).padStart(2, '0');
  }

  function localDateKey(date) {
    return [date.getFullYear(), pad(date.getMonth() + 1), pad(date.getDate())].join('-');
  }

  // 归天日期优先，否则按创建时间；非法日期返回 null（不进索引）。
  function getDayKeyOfEntry(item) {
    if (item && typeof item.reviewDate === 'string'
      && /^\d{4}-\d{2}-\d{2}$/.test(item.reviewDate)) {
      return item.reviewDate;
    }
    if (!item || !item.createdAt) {
      return null;
    }
    const created = new Date(item.createdAt);
    return Number.isNaN(created.getTime()) ? null : localDateKey(created);
  }

  function buildDayIndex(source) {
    const input = source || {};
    const notes = Array.isArray(input.notes) ? input.notes : [];
    const resourceFiles = Array.isArray(input.resourceFiles) ? input.resourceFiles : [];
    const dayReminders = Array.isArray(input.dayReminders) ? input.dayReminders : [];
    const dayReviewLog = Array.isArray(input.dayReviewLog) ? input.dayReviewLog : [];
    const index = new Map();

    const ensure = (dayKey) => {
      if (!index.has(dayKey)) {
        index.set(dayKey, {
          dayKey,
          notes: [],
          files: [],
          reminders: [],
          reviewEvents: [],
          lastReviewedAt: null
        });
      }
      return index.get(dayKey);
    };

    for (const note of notes) {
      if (!note || !note.isReviewFile) continue;
      const dayKey = getDayKeyOfEntry(note);
      if (dayKey) ensure(dayKey).notes.push(note);
    }
    for (const file of resourceFiles) {
      if (!file || !file.isReviewFile) continue;
      const dayKey = getDayKeyOfEntry(file);
      if (dayKey) ensure(dayKey).files.push(file);
    }
    for (const record of dayReminders) {
      if (record && typeof record.dayKey === 'string') {
        ensure(record.dayKey).reminders.push(record);
      }
    }
    for (const event of dayReviewLog) {
      if (!event || typeof event.dayKey !== 'string') continue;
      const day = ensure(event.dayKey);
      day.reviewEvents.push(event);
      if (typeof event.reviewedAt === 'string'
        && (!day.lastReviewedAt || event.reviewedAt > day.lastReviewedAt)) {
        day.lastReviewedAt = event.reviewedAt;
      }
    }
    return new Map([...index.entries()].sort((a, b) => a[0].localeCompare(b[0])));
  }

  // 回顾面板只要「有文件的天」；提醒/日志产生的空天不显示。
  function toReviewDayMap(index) {
    const map = new Map();
    for (const [dayKey, day] of index) {
      if (day.notes.length > 0 || day.files.length > 0) {
        map.set(dayKey, { dayKey, notes: day.notes, files: day.files });
      }
    }
    return map;
  }

  // 提醒日历条目：复习日 / 已回顾 / 今日自动回顾，全部从同一份索引展开。
  function buildCalendarEntries(source, todayKey) {
    const input = source || {};
    const index = buildDayIndex(input);
    const entries = [];
    for (const [dayKey, day] of index) {
      for (const record of day.reminders) {
        if (record.date) {
          entries.push({ date: record.date, dayKey, kind: 'reminder', done: Boolean(record.done) });
        }
      }
      for (const event of day.reviewEvents) {
        const reviewedAt = event.reviewedAt ? new Date(event.reviewedAt) : null;
        if (reviewedAt && !Number.isNaN(reviewedAt.getTime())) {
          entries.push({ date: localDateKey(reviewedAt), dayKey, kind: 'reviewed', reviewedAt });
        }
      }
    }
    const notes = Array.isArray(input.notes) ? input.notes : [];
    const resourceFiles = Array.isArray(input.resourceFiles) ? input.resourceFiles : [];
    const todayNote = notes.find((note) => note && note.isDailyReview);
    const todayFile = resourceFiles.find((file) => file && file.isDailyReview);
    if (todayNote || todayFile) {
      const dayKey = getDayKeyOfEntry(todayNote || todayFile);
      if (dayKey) {
        entries.push({ date: todayKey || localDateKey(new Date()), dayKey, kind: 'today' });
      }
    }
    return entries;
  }

  return {
    localDateKey: localDateKey,
    getDayKeyOfEntry: getDayKeyOfEntry,
    buildDayIndex: buildDayIndex,
    toReviewDayMap: toReviewDayMap,
    buildCalendarEntries: buildCalendarEntries
  };
});
