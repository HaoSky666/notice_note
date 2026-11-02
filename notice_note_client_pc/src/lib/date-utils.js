// 日期与提醒时间工具（纯函数）
const DAILY_REMINDER_TIMES = ['09:30', '15:00'];

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

module.exports = {
  DAILY_REMINDER_TIMES,
  isValidDateTime,
  getLatestDateTime,
  padDatePart,
  toLocalDateKey,
  getReminderDate,
  getReminderSlotDate,
  getReminderFiredSlots
};
