// 日期与提醒时间工具（纯函数）
// UMD：Node 走 module.exports（PC 主进程与 tests），浏览器挂 window.NoticeNoteDateUtils（手机端复用）。
// 手机端副本由 scripts/sync-mobile-libs.js 自动复制，请勿直接编辑副本。
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.NoticeNoteDateUtils = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const DAILY_REMINDER_TIMES = ['09:30', '15:00'];

  // 自动排期的节奏：把点「自动排期」的那天算第 1 天，之后在第 2/3/7/15/30 天各排一次。
  // 这里存的是「距基点天数」，所以 1 = 第二天（明天）、29 = 第三十天。
  const AUTO_REMINDER_DAY_OFFSETS = [1, 2, 6, 14, 29];

  function isValidDateTime(value) {
    return typeof value === 'string' && Number.isFinite(Date.parse(value));
  }

  function getLatestDateTime(...values) {
    const validValues = values.filter(isValidDateTime);
    if (validValues.length === 0) {
      return null;
    }
    return validValues.reduce((latest, value) => {
      return Date.parse(value) > Date.parse(latest) ? value : latest;
    });
  }

  function padDatePart(value) {
    return String(value).padStart(2, '0');
  }

  function toLocalDateKey(date) {
    return [
      date.getFullYear(),
      padDatePart(date.getMonth() + 1),
      padDatePart(date.getDate())
    ].join('-');
  }

  function getReminderDate(reminder) {
    if (typeof reminder.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(reminder.date)) {
      return reminder.date;
    }

    const date = new Date(reminder.time);
    return Number.isNaN(date.getTime()) ? null : toLocalDateKey(date);
  }

  function getReminderSlotDate(reminderDate, slot) {
    return new Date(`${reminderDate}T${slot}:00`);
  }

  function getReminderFiredSlots(reminder) {
    if (Array.isArray(reminder.firedSlots)) {
      return reminder.firedSlots.filter((slot) => DAILY_REMINDER_TIMES.includes(slot));
    }

    return reminder.done ? [...DAILY_REMINDER_TIMES] : [];
  }

  // 回顾日期只接受本地日历日 YYYY-MM-DD；不校验真实存在性，避免跨时区/历史日期被误杀。
  function isValidReviewDate(value) {
    return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
  }

  // 按月加减并把日期 clamp 到目标月的最后一天。
  // new Date(y, m + 1, d) 在 1/31 会溢出成 3/3，复习日必须用这个版本。
  function addMonthsClamped(date, months) {
    const source = date instanceof Date ? new Date(date.getTime()) : new Date(date);
    if (Number.isNaN(source.getTime()) || !Number.isInteger(months)) {
      return null;
    }
    const targetFirstDay = new Date(
      source.getFullYear(), source.getMonth() + months, 1,
      source.getHours(), source.getMinutes(), source.getSeconds(), source.getMilliseconds()
    );
    const lastDay = new Date(targetFirstDay.getFullYear(), targetFirstDay.getMonth() + 1, 0).getDate();
    return new Date(
      targetFirstDay.getFullYear(), targetFirstDay.getMonth(),
      Math.min(source.getDate(), lastDay),
      source.getHours(), source.getMinutes(), source.getSeconds(), source.getMilliseconds()
    );
  }

  function addDays(date, days) {
    const source = date instanceof Date ? new Date(date.getTime()) : new Date(date);
    if (Number.isNaN(source.getTime()) || !Number.isInteger(days)) {
      return null;
    }
    return new Date(
      source.getFullYear(), source.getMonth(), source.getDate() + days,
      source.getHours(), source.getMinutes(), source.getSeconds(), source.getMilliseconds()
    );
  }

  return {
    DAILY_REMINDER_TIMES,
    AUTO_REMINDER_DAY_OFFSETS,
    isValidDateTime,
    getLatestDateTime,
    padDatePart,
    toLocalDateKey,
    getReminderDate,
    getReminderSlotDate,
    getReminderFiredSlots,
    isValidReviewDate,
    addMonthsClamped,
    addDays
  };
});