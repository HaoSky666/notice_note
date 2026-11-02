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
    meta.textContent =
      `${formatDateOnly(notification.date)} ${notification.slot || ""}`.trim();
    button.append(title, body, meta);

    const noteExists = notes.some((note) => note.id === notification.noteId);
    button.disabled = !noteExists;
    if (!noteExists) {
      button.title = "对应文件已不存在";
    } else {
      button.addEventListener("click", () => {
        notificationPanel.hidden = true;
        selectNote(notification.noteId).catch(console.error);
      });
    }
    notificationList.append(button);
  }
}
function addReminderNotification(reminder) {
  const id = `${reminder.reminderId || reminder.noteId}:${reminder.date || ""}:${reminder.slot || ""}`;
  reminderNotifications = reminderNotifications.filter(
    (item) => item.id !== id,
  );
  reminderNotifications.unshift({
    id,
    noteId: reminder.noteId,
    title: reminder.title,
    body: reminder.body,
    date: reminder.date,
    slot: reminder.slot,
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
