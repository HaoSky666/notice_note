// 纯工具函数（格式化 / 日期 / 搜索 / 保存错误信息）
// 注意：本文件为经典脚本，顶层 const/let 处于页面全局词法环境，跨文件共享；请勿重复声明同名标识符。
function readBooleanSetting(key) {
  return localStorage.getItem(key) === "true";
}
function writeBooleanSetting(key, value) {
  localStorage.setItem(key, value ? "true" : "false");
}
function formatListDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "未知";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
function formatFileSize(bytes) {
  const size = Number(bytes) || 0;
  if (size < 1024) {
    return `${size} B`;
  }
  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}
function formatDateOnly(value) {
  const date = parseReminderDate(value);
  if (!date) {
    return "日期无效";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
function toLocalDateKey(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join("-");
}
function parseReminderDate(value) {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T00:00:00`);
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
function getReminderDateKey(reminder) {
  if (
    typeof reminder.date === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(reminder.date)
  ) {
    return reminder.date;
  }

  const date = parseReminderDate(reminder.time);
  return date ? toLocalDateKey(date) : null;
}
function getTimeValue(value) {
  return Date.parse(value) || 0;
}
function sortNotes(noteItems) {
  return [...noteItems].sort((a, b) => {
    return getTimeValue(b.createdAt) - getTimeValue(a.createdAt);
  });
}
function includesNoteSearchKeyword(value, keyword) {
  return String(value || "")
    .toLocaleLowerCase("zh-CN")
    .includes(keyword);
}
function createNoteSearchPreview(content, keyword) {
  const normalizedContent = String(content || "")
    .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalizedContent) {
    return "";
  }

  const matchIndex = normalizedContent
    .toLocaleLowerCase("zh-CN")
    .indexOf(keyword);
  if (matchIndex < 0) {
    return normalizedContent.slice(0, 100);
  }

  const start = Math.max(0, matchIndex - 28);
  const end = Math.min(normalizedContent.length, matchIndex + keyword.length + 64);
  return `${start > 0 ? "…" : ""}${normalizedContent.slice(start, end)}${end < normalizedContent.length ? "…" : ""}`;
}
function normalizeComparableText(value) {
  return String(value || "")
    .replace(/\\([\\|])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}
function getSaveErrorMessage(error) {
  return String(error?.message || "未知错误").replace(
    /^Error invoking remote method '[^']+': (?:[A-Za-z]*Error: )?/,
    "",
  );
}
