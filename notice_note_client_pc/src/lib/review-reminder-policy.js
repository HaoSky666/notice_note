// 天级复习提醒的「发不发通知 / 写不写看过锚点」决策（纯函数，可测）。
// 三种情况必须区分：有可见内容、内容全在密码目录、内容已删空。
// 第三种不能写 dailyReviewHistory 锚点——没发过提醒就不算用户看过。

function decideDayReminderNotification({ visibleCount, protectedCount } = {}) {
  const visible = Math.max(0, Number(visibleCount) || 0);
  const protectedItems = Math.max(0, Number(protectedCount) || 0);
  if (visible > 0) {
    return { shouldNotify: true, kind: 'visible', count: visible, markAsReviewed: true };
  }
  if (protectedItems > 0) {
    // 保护目录的内容仍然要提醒，但通知里不带任何标题/文件名。
    return { shouldNotify: true, kind: 'protected', count: protectedItems, markAsReviewed: true };
  }
  return { shouldNotify: false, kind: 'empty', count: 0, markAsReviewed: false };
}

function buildDayReminderNotice({
  dayReminderId = null,
  dayKey,
  date,
  label = '',
  titles = [],
  visibleCount = 0,
  protectedCount = 0
} = {}) {
  const decision = decideDayReminderNotification({ visibleCount, protectedCount });
  if (!decision.shouldNotify) {
    return { decision, notice: null };
  }

  const protectedItems = Math.max(0, Number(protectedCount) || 0);
  const title = `${label} 那一套`;
  let body;
  if (decision.kind === 'protected') {
    body = `今天有 ${decision.count} 个受保护文件待复习，请打开应用并解锁后查看。`;
  } else {
    const shown = (Array.isArray(titles) ? titles : []).filter(Boolean).slice(0, 5);
    body = `今天要回顾 ${decision.count} 个文件：${shown.join('、')}${decision.count > shown.length ? '…' : ''}`;
    // 混合保护日：只补充数量，不出现任何受保护文件的标题/文件名。
    if (protectedItems > 0) {
      body += `；另有 ${protectedItems} 个受保护文件，请解锁后查看。`;
    }
  }

  return {
    decision,
    notice: {
      dayReminderId,
      dayKey,
      date,
      title,
      body,
      count: decision.count,
      protectedCount: protectedItems,
      kind: decision.kind
    }
  };
}

module.exports = {
  decideDayReminderNotification,
  buildDayReminderNotice
};
