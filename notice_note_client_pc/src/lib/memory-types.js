// 记忆卡的「类型」：一张卡可以同时属于多个类型，类型名就是用户输入的短标签。
//
// 类型目录不单独落盘，而是从卡片的 types 汇总出来：
// 没有卡片引用的类型自然消失，不会留下点开是空牌组的「幽灵类型」。
// 改名/合并类型时只要批量改卡片的 types 即可，没有第二份数据要对齐。
//
// UMD：Node 走 module.exports，浏览器挂 window.NoticeNoteMemoryTypes（手机端复用）。
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.NoticeNoteMemoryTypes = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const MAX_CARD_TYPES = 12;
  const MAX_TYPE_NAME_LENGTH = 24;

  // 统一入口：去 #（用户可能照着标签习惯输入「#熔断」）、去空白、截长度。
  // 返回空串表示这个类型名无效。
  function normalizeTypeName(value) {
    return String(value == null ? '' : value)
      .trim()
      .replace(/^#+/, '')
      .trim()
      .slice(0, MAX_TYPE_NAME_LENGTH);
  }

  // 一张卡的类型列表：去空、按小写去重（保留先出现的写法）、限制条数。
  function normalizeCardTypes(value) {
    if (!Array.isArray(value)) {
      return [];
    }
    const seen = new Set();
    const types = [];
    for (const item of value) {
      const name = normalizeTypeName(item);
      if (!name) {
        continue;
      }
      const key = name.toLowerCase();
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      types.push(name);
      if (types.length >= MAX_CARD_TYPES) {
        break;
      }
    }
    return types;
  }

  // 类型目录：{ name, count }[]，按名称排序。
  // 排序用中文规则，中文类型按拼音走，「限流 / 熔断 / 降级」不会按输入顺序乱跳。
  function collectCardTypes(cards) {
    const stats = new Map();
    for (const card of Array.isArray(cards) ? cards : []) {
      for (const name of normalizeCardTypes(card && card.types)) {
        const key = name.toLowerCase();
        const entry = stats.get(key);
        if (entry) {
          entry.count += 1;
        } else {
          stats.set(key, { name, count: 1 });
        }
      }
    }
    return [...stats.values()].sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'));
  }

  function hasCardType(card, type) {
    const name = normalizeTypeName(type);
    if (!name) {
      return false;
    }
    const key = name.toLowerCase();
    return normalizeCardTypes(card && card.types).some((item) => item.toLowerCase() === key);
  }

  return {
    MAX_CARD_TYPES,
    MAX_TYPE_NAME_LENGTH,
    normalizeTypeName,
    normalizeCardTypes,
    collectCardTypes,
    hasCardType
  };
});