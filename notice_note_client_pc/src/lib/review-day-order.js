'use strict';

// 回顾面板「当天文件」的手动顺序。
// 每天一份 key 数组，key 形如 note:<id> / file:<id>（笔记与资源文件 id 各自的命名空间，
// 加前缀才不会撞车）。合并与移动复用 sidebar-order 的实现，这里只负责
// 「这一天的默认顺序长什么样」和「读盘时怎么把脏数据洗掉」。

const ENTRY_KEY_PATTERN = /^(?:note|file):.+/;

function makeReviewEntryKey(type, id) {
  return `${type}:${id}`;
}

// 默认顺序：笔记按最近修改倒序排在前面，资源文件按扫描顺序接在后面。
// 与 renderReviewPanelFileList 的默认渲染口径一致，否则第一次拖动会把顺序抖一下。
function buildDefaultReviewDayOrder(dayNotes, dayFiles) {
  const notes = Array.isArray(dayNotes) ? [...dayNotes] : [];
  notes.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  const files = Array.isArray(dayFiles) ? dayFiles : [];
  return [
    ...notes.map((note) => makeReviewEntryKey('note', note.id)),
    ...files.map((file) => makeReviewEntryKey('file', file.id))
  ];
}

// 只留合法日期、合法 key、去重；空数组不落盘（没有内容的天不用记顺序）。
function normalizeReviewDayOrder(value, isValidDay) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const result = {};
  for (const [dayKey, list] of Object.entries(source)) {
    if (typeof isValidDay === 'function' && !isValidDay(dayKey)) continue;
    if (!Array.isArray(list)) continue;
    const keys = [...new Set(list.filter((key) => (
      typeof key === 'string' && ENTRY_KEY_PATTERN.test(key)
    )))];
    if (keys.length > 0) {
      result[dayKey] = keys;
    }
  }
  return result;
}

module.exports = {
  ENTRY_KEY_PATTERN,
  makeReviewEntryKey,
  buildDefaultReviewDayOrder,
  normalizeReviewDayOrder
};
