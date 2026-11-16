// 每日回顾的推送顺序：手动顺序优先，没排过的按「最久没看过」。
// 主进程负责持久化 dailyReviewOrder 与调用时机；这里只做纯计算，便于单测。
//
// 约定：
// - order 存的是 dayKey（内容天），用户手动调过的顺序。
// - history 是 dailyReviewHistory，key 形如 day:YYYY-MM-DD。
// - order 里已经失效的 dayKey（文件被删/移走）由 pruneReviewOrder 清掉。

function sortReviewQueue(candidates, { order = [], history = {} } = {}) {
  const rank = new Map();
  for (const dayKey of order) {
    if (typeof dayKey === 'string' && !rank.has(dayKey)) {
      rank.set(dayKey, rank.size);
    }
  }
  return [...candidates].sort((a, b) => {
    const aRank = rank.has(a.dayKey) ? rank.get(a.dayKey) : Number.MAX_SAFE_INTEGER;
    const bRank = rank.has(b.dayKey) ? rank.get(b.dayKey) : Number.MAX_SAFE_INTEGER;
    if (aRank !== bRank) {
      return aRank - bRank;
    }
    const aLast = String(history[a.key] || '');
    const bLast = String(history[b.key] || '');
    return aLast.localeCompare(bLast) || String(a.key).localeCompare(String(b.key));
  });
}

// 在完整队列上做一次移动；返回新数组，未知 dayKey 或未知操作返回 null。
// 调用方必须传「当前完整顺序」，否则只移动一条会让其余条目退回算法顺序、看起来跳位。
function moveInQueue(queue, dayKey, action) {
  const index = queue.indexOf(dayKey);
  if (index === -1) {
    return null;
  }
  const next = [...queue];
  if (action === 'top') {
    next.splice(index, 1);
    next.unshift(dayKey);
  } else if (action === 'up') {
    if (index > 0) {
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
    }
  } else if (action === 'down') {
    if (index < next.length - 1) {
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
    }
  } else {
    return null;
  }
  return next;
}

// 清掉已经不在候选池里的 dayKey，避免手动顺序越积越长、失效项挡住新内容。
// keep 用来保留「暂时不在候选池、但仍有效」的天（典型：挂着未完成提醒的那套，
// 它只是暂时退出自动回顾，提醒结束后还要按原手动顺序推）。
function pruneReviewOrder(order, candidates, { keep = [] } = {}) {
  const valid = new Set(candidates.map((item) => item.dayKey));
  for (const dayKey of keep) {
    valid.add(dayKey);
  }
  return order.filter((dayKey) => valid.has(dayKey));
}

module.exports = {
  sortReviewQueue,
  moveInQueue,
  pruneReviewOrder
};
