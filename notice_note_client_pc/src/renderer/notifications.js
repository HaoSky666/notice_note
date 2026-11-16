// 提醒通知中心（铃铛面板）
// 注意：本文件为经典脚本，顶层 const/let 处于页面全局词法环境，跨文件共享；请勿重复声明同名标识符。
const REMINDER_NOTIFICATIONS_KEY = "notice-note:reminder-notifications";
let reminderNotifications = readReminderNotifications();
function readReminderNotifications() {
  try {
    const stored = JSON.parse(
      localStorage.getItem(REMINDER_NOTIFICATIONS_KEY) || "[]",
    );
    return Array.isArray(stored) ? stored.slice(0, 50) : [];
  } catch {
    return [];
  }
}
function saveReminderNotifications() {
  localStorage.setItem(
    REMINDER_NOTIFICATIONS_KEY,
    JSON.stringify(reminderNotifications.slice(0, 50)),
  );
}
function renderReminderNotifications() {
  const today = toLocalDateKey(new Date());
  const todayNotifications = reminderNotifications.filter(
    (item) => item.date === today,
  );
  notificationList.innerHTML = "";
  notificationDot.hidden = !todayNotifications.some((item) => !item.read);

  if (todayNotifications.length === 0) {
    const empty = document.createElement("div");
    empty.className = "notification-empty";
    empty.textContent = "今天暂无提醒通知";
    notificationList.append(empty);
    return;
  }

  for (const notification of todayNotifications) {
    const button = document.createElement("button");
    button.className = `notification-item${notification.read ? "" : " is-unread"}`;
    button.type = "button";

    const title = document.createElement("strong");
    title.textContent = notification.title || "未命名笔记";
    const body = document.createElement("span");
    body.className = "notification-item-body";
    body.textContent = notification.body || "你有一条笔记提醒到了。";
    const meta = document.createElement("span");
    meta.className = "notification-item-meta";
    meta.textContent = `${formatDateOnly(notification.date)} · 整天内容`;
    button.append(title, body, meta);

    if (notification.dayKey) {
      // 天级提醒：点击定位到回顾面板的那一套内容
      button.title = "打开这一天的回顾内容";
      button.addEventListener("click", () => {
        notificationPanel.hidden = true;
        activateReviewBrowser();
        selectReviewDay(notification.dayKey);
      });
    } else {
      // 兼容旧版按单篇笔记推送的历史通知
      const noteExists = notes.some((note) => note.id === notification.noteId);
      button.disabled = !noteExists;
      if (noteExists) {
        button.addEventListener("click", () => {
          notificationPanel.hidden = true;
          selectNote(notification.noteId).catch((error) => window.showErrorToast?.(error, "操作失败"));
        });
      }
    }
    notificationList.append(button);
  }
}
function addReminderNotification(reminder) {
  // 主进程可以带稳定 id（错过复习日汇总）；普通天级提醒仍按三段键去重。
  const id = reminder.id || `${reminder.dayReminderId || reminder.reminderId || reminder.noteId}:${reminder.date || ""}:${reminder.dayKey || ""}`;
  reminderNotifications = reminderNotifications.filter(
    (item) => item.id !== id,
  );
  reminderNotifications.unshift({
    id,
    noteId: reminder.noteId,
    dayKey: reminder.dayKey,
    title: reminder.title,
    body: reminder.body,
    date: reminder.date,
    receivedAt: new Date().toISOString(),
    read: false,
  });
  reminderNotifications = reminderNotifications.slice(0, 50);
  saveReminderNotifications();
  renderReminderNotifications();
}
function toggleNotificationPanel() {
  notificationPanel.hidden = !notificationPanel.hidden;
  if (notificationPanel.hidden) {
    return;
  }
  const today = toLocalDateKey(new Date());
  reminderNotifications = reminderNotifications.map((item) => {
    return item.date === today ? { ...item, read: true } : item;
  });
  saveReminderNotifications();
  renderReminderNotifications();
}
