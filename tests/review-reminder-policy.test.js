const test = require('node:test');
const assert = require('node:assert/strict');
const {
  decideDayReminderNotification,
  buildDayReminderNotice
} = require('../notice_note_client_pc/src/lib/review-reminder-policy');

test('R3：有可见内容时正常提醒，并允许写「已看过」锚点', () => {
  const decision = decideDayReminderNotification({ visibleCount: 3, protectedCount: 0 });
  assert.deepEqual(decision, {
    shouldNotify: true, kind: 'visible', count: 3, markAsReviewed: true
  });
});

test('R3：内容全在密码目录时仍提醒，但通知不含任何标题/文件名', () => {
  const decision = decideDayReminderNotification({ visibleCount: 0, protectedCount: 2 });
  assert.equal(decision.shouldNotify, true);
  assert.equal(decision.kind, 'protected');
  assert.equal(decision.markAsReviewed, true);

  const { notice } = buildDayReminderNotice({
    dayReminderId: 'r1',
    dayKey: '2026-11-13',
    date: '2026-11-13',
    label: '11月13日',
    titles: [],
    visibleCount: 0,
    protectedCount: 2
  });
  assert.ok(notice);
  assert.match(notice.body, /2 个受保护文件待复习/);
  assert.match(notice.body, /解锁/);
  assert.equal(notice.count, 2);
  assert.equal(notice.kind, 'protected');
  assert.doesNotMatch(notice.body, /秘密|secret|\.pdf|笔记标题/);
});

test('R3：内容已删空时不发通知，也不写「已看过」锚点', () => {
  const decision = decideDayReminderNotification({ visibleCount: 0, protectedCount: 0 });
  assert.equal(decision.shouldNotify, false);
  assert.equal(decision.markAsReviewed, false);

  const { notice } = buildDayReminderNotice({
    dayKey: '2026-11-13', date: '2026-11-13', label: '11月13日',
    visibleCount: 0, protectedCount: 0
  });
  assert.equal(notice, null);
});

test('混合内容：只展示非保护目录的标题，并补充受保护文件数量', () => {
  const { decision, notice } = buildDayReminderNotice({
    dayKey: '2026-11-13', date: '2026-11-13', label: '11月13日',
    titles: ['公开笔记', '公开.pdf'],
    visibleCount: 2, protectedCount: 5
  });
  assert.equal(decision.kind, 'visible');
  assert.equal(notice.count, 2);
  assert.equal(notice.protectedCount, 5);
  assert.match(notice.body, /公开笔记/);
  assert.match(notice.body, /另有 5 个受保护文件/);
  assert.doesNotMatch(notice.body, /秘密|secret/);
});

test('脏数据（负数 / 非数字）不会导致误判', () => {
  assert.equal(decideDayReminderNotification({ visibleCount: -1, protectedCount: -3 }).shouldNotify, false);
  assert.equal(decideDayReminderNotification({ visibleCount: 'x', protectedCount: 2 }).kind, 'protected');
  assert.equal(decideDayReminderNotification().shouldNotify, false);
});
