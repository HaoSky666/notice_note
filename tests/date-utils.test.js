const test = require('node:test');
const assert = require('node:assert/strict');
const {
  toLocalDateKey,
  isValidReviewDate,
  addMonthsClamped,
  addDays,
  getReminderFiredSlots,
  getLatestDateTime,
  AUTO_REMINDER_DAY_OFFSETS
} = require('../notice_note_client_pc/src/lib/date-utils');

test('addMonthsClamped: 1/31 加一个月得到 2 月最后一天，不溢出到 3 月', () => {
  assert.equal(toLocalDateKey(addMonthsClamped(new Date(2026, 0, 31, 9, 30), 1)), '2026-02-28');
});

test('addMonthsClamped: 闰年 1/31 得到 2/29', () => {
  assert.equal(toLocalDateKey(addMonthsClamped(new Date(2024, 0, 31), 1)), '2024-02-29');
});

test('addMonthsClamped: 12 月跨年、负月份、多月份都正确', () => {
  assert.equal(toLocalDateKey(addMonthsClamped(new Date(2026, 11, 15), 1)), '2027-01-15');
  assert.equal(toLocalDateKey(addMonthsClamped(new Date(2026, 0, 31), -1)), '2025-12-31');
  assert.equal(toLocalDateKey(addMonthsClamped(new Date(2026, 0, 31), 13)), '2027-02-28');
});

test('addMonthsClamped: 保留时分秒；非法输入返回 null', () => {
  const result = addMonthsClamped(new Date(2026, 0, 31, 15, 42, 7, 123), 1);
  assert.equal(result.getHours(), 15);
  assert.equal(result.getMinutes(), 42);
  assert.equal(result.getSeconds(), 7);
  assert.equal(result.getMilliseconds(), 123);
  assert.equal(addMonthsClamped('not-a-date', 1), null);
  assert.equal(addMonthsClamped(new Date(), 1.5), null);
});

test('addDays: 跨月跨年不丢本地时间', () => {
  assert.equal(toLocalDateKey(addDays(new Date(2026, 0, 31), 1)), '2026-02-01');
  assert.equal(toLocalDateKey(addDays(new Date(2026, 11, 31), 1)), '2027-01-01');
  assert.equal(addDays(new Date(), Number.NaN), null);
});

test('自动排期的五个复习日：第 2/3/7/15/30 天（当天算第 1 天）', () => {
  // 偏移是「距当天几天」，所以 1/2/6/14/29 对应第 2/3/7/15/30 天。
  assert.deepEqual(AUTO_REMINDER_DAY_OFFSETS, [1, 2, 6, 14, 29]);
  const today = new Date(2026, 0, 31, 9, 0);
  const dates = AUTO_REMINDER_DAY_OFFSETS.map((offset) => toLocalDateKey(addDays(today, offset)));
  assert.deepEqual(dates, [
    '2026-02-01',
    '2026-02-02',
    '2026-02-06',
    '2026-02-14',
    '2026-03-01'
  ]);
  assert.equal(new Set(dates).size, 5);
});

test('isValidReviewDate 只接受 YYYY-MM-DD', () => {
  assert.equal(isValidReviewDate('2026-11-12'), true);
  assert.equal(isValidReviewDate('2026-1-2'), false);
  assert.equal(isValidReviewDate('2026-11-12T00:00:00'), false);
  assert.equal(isValidReviewDate(null), false);
  assert.equal(isValidReviewDate(20261112), false);
});

test('提醒槽位与最近时间工具保持原有语义', () => {
  assert.deepEqual(getReminderFiredSlots({ done: true }), ['09:30', '15:00']);
  assert.deepEqual(getReminderFiredSlots({ firedSlots: ['09:30', '25:99'] }), ['09:30']);
  assert.equal(getLatestDateTime('2026-01-01T00:00:00Z', '2026-03-01T00:00:00Z'), '2026-03-01T00:00:00Z');
  assert.equal(getLatestDateTime(null, undefined), null);
});
