// 回顾侧边栏面板：月历导航 + 当天文件 + 当天操作
// 所有回顾功能都在侧边栏（与「日历」模式一致）；主工作区照常显示文件，
// 点侧边栏里的回顾文件即在主工作区打开。
// 注意：本文件为经典脚本，顶层 const/let 处于页面全局词法环境，跨文件共享；请勿重复声明同名标识符。

const reviewBrowserState = {
  month: null, // 当前显示月份（当月第一天）
  dayKey: null // 当前查看的日期
};

// 归天口径收敛到 day-index.js，日历与回顾面板共用同一份实现。
function getNoteReviewDayKey(note) {
  return getDayKeyOfEntry(note);
}

function getFileReviewDayKey(file) {
  return getDayKeyOfEntry(file);
}

// 回顾文件按天分组（升序），数据来自共享 dayIndex。
function getReviewDayMap() {
  return toReviewDayMap(buildDayIndex({ notes, resourceFiles }));
}

function formatReviewDayTitle(dayKey) {
  const [year, month, day] = dayKey.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  const weekdays = ["日", "一", "二", "三", "四", "五", "六"];
  return `${year}年${month}月${day}日 · 周${weekdays[date.getDay()]}`;
}

function formatReviewDayShort(dayKey) {
  if (!dayKey) {
    return "未归天";
  }
  const [, month, day] = dayKey.split("-");
  return `${Number(month)}月${Number(day)}日`;
}

function parseDayKey(dayKey) {
  const [year, month, day] = dayKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function getReviewFolderId() {
  return folders.find((folder) => folder.isReviewFolder)?.id || null;
}

// 打开回顾（侧边栏模式：只切侧边栏，主工作区不动）
// 每次打开都回到今天，不再跟随「今日回顾」自动选中的那一天
function activateReviewBrowser() {
  resetReviewBrowserToToday();
  setSidebarViewMode("reminder");
  // 应用跨天没重启时 appSettings.dailyReviewDayKey 可能还停在昨天，
  // 打开面板补拉一次，避免「完成回顾」主按钮挂到错的日子上。
  refreshAppSettingsAndRender();
}

// 把回顾面板定位到今天（空白日也停住，方便直接新建）
function resetReviewBrowserToToday() {
  const today = new Date();
  reviewBrowserState.dayKey = toLocalDateKey(today);
  reviewBrowserState.month = new Date(today.getFullYear(), today.getMonth(), 1);
}

// 刷新应用设置后重绘侧边栏
// preferredDayKey：当前查看的天消失时优先跟随的目标天
async function refreshAppSettingsAndRender(preferredDayKey = null) {
  try {
    appSettings = await window.noticeNote.getSettings();
  } catch (error) {
    console.error('刷新应用设置失败:', error);
  }
  ensureReviewBrowserState(preferredDayKey);
  if (sidebarViewMode === "reminder") {
    renderNoteList();
  }
}

// 切换查看的某一天（月份跟随该天）
function selectReviewDay(dayKey) {
  reviewBrowserState.dayKey = dayKey;
  const selected = parseDayKey(dayKey);
  reviewBrowserState.month = new Date(selected.getFullYear(), selected.getMonth(), 1);
  if (sidebarViewMode === "reminder") {
    renderNoteList();
  }
}

function ensureReviewBrowserState(preferredDayKey = null) {
  const dayMap = getReviewDayMap();

  if (!reviewBrowserState.dayKey) {
    // 兜底初始化（例如启动后直接落在回顾模式）：一律定位到今天
    resetReviewBrowserToToday();
  } else if (preferredDayKey && !dayMap.has(reviewBrowserState.dayKey) && dayMap.has(preferredDayKey)) {
    // 显式把当天仅剩的文件搬走后，跟随文件去新的一天
    reviewBrowserState.dayKey = preferredDayKey;
    const selected = parseDayKey(preferredDayKey);
    reviewBrowserState.month = new Date(selected.getFullYear(), selected.getMonth(), 1);
  } else if (!reviewBrowserState.month) {
    const selected = parseDayKey(reviewBrowserState.dayKey);
    reviewBrowserState.month = new Date(selected.getFullYear(), selected.getMonth(), 1);
  }
  // 注意：空白日（当天没有回顾文件）允许停留，不强制跳转
  return dayMap;
}

// ---------- 侧边栏月历 ----------
function renderReviewSidebarCalendar(dayMap) {
  // 兜底初始化（侧边栏可能在浏览器状态未初始化时就进入回顾模式）
  if (!reviewBrowserState.month || !reviewBrowserState.dayKey) {
    ensureReviewBrowserState();
  }

  const wrap = document.createElement("section");
  wrap.className = "review-side-calendar";

  const header = document.createElement("div");
  header.className = "review-side-calendar-header";

  const prevBtn = document.createElement("button");
  prevBtn.type = "button";
  prevBtn.className = "review-side-calendar-nav";
  prevBtn.textContent = "‹";
  prevBtn.title = "上个月";
  prevBtn.setAttribute("aria-label", "上个月");
  prevBtn.addEventListener("click", () => {
    reviewBrowserState.month = new Date(
      reviewBrowserState.month.getFullYear(),
      reviewBrowserState.month.getMonth() - 1,
      1,
    );
    renderNoteList();
  });

  const monthLabel = document.createElement("strong");
  monthLabel.className = "review-side-calendar-title";
  monthLabel.textContent = `${reviewBrowserState.month.getFullYear()}年${reviewBrowserState.month.getMonth() + 1}月`;

  const nextBtn = document.createElement("button");
  nextBtn.type = "button";
  nextBtn.className = "review-side-calendar-nav";
  nextBtn.textContent = "›";
  nextBtn.title = "下个月";
  nextBtn.setAttribute("aria-label", "下个月");
  nextBtn.addEventListener("click", () => {
    reviewBrowserState.month = new Date(
      reviewBrowserState.month.getFullYear(),
      reviewBrowserState.month.getMonth() + 1,
      1,
    );
    renderNoteList();
  });

  const todayBtn = document.createElement("button");
  todayBtn.type = "button";
  todayBtn.className = "review-side-calendar-today";
  todayBtn.textContent = "今天";
  todayBtn.title = "回到今天";
  todayBtn.addEventListener("click", () => {
    // 空白日也允许停留，直接选中今天
    selectReviewDay(toLocalDateKey(new Date()));
  });

  header.append(prevBtn, monthLabel, nextBtn, todayBtn);

  const weekRow = document.createElement("div");
  weekRow.className = "review-side-calendar-week";
  for (const label of ["一", "二", "三", "四", "五", "六", "日"]) {
    const cell = document.createElement("span");
    cell.textContent = label;
    weekRow.append(cell);
  }

  const grid = document.createElement("div");
  grid.className = "review-side-calendar-grid";

  const year = reviewBrowserState.month.getFullYear();
  const month = reviewBrowserState.month.getMonth();
  const firstDay = new Date(year, month, 1);
  // 周一开头：把周日(0)换算到末尾
  const leadingBlanks = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayKey = toLocalDateKey(new Date());

  for (let i = 0; i < leadingBlanks; i++) {
    grid.append(document.createElement("span"));
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const dayKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const hasFiles = dayMap.has(dayKey);
    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = `review-side-calendar-day${hasFiles ? " has-files" : " is-blank"}${dayKey === reviewBrowserState.dayKey ? " is-selected" : ""}${dayKey === todayKey ? " is-today" : ""}`;
    cell.dataset.dayKey = dayKey;
    cell.textContent = String(day);
    if (hasFiles) {
      const count = dayMap.get(dayKey);
      const total = count.notes.length + count.files.length;
      cell.title = `${formatReviewDayTitle(dayKey)}（${total} 个文件）`;
      cell.append(document.createElement("i"));
    } else {
      cell.title = `${formatReviewDayTitle(dayKey)}（还没有回顾文件，点击可新建到当天）`;
    }
    cell.addEventListener("click", () => {
      selectReviewDay(dayKey);
    });
    grid.append(cell);
  }

  wrap.append(header, weekRow, grid);
  return wrap;
}

// ---------- 侧边栏回顾面板 ----------
function renderReviewSidebarPanel() {
  const wrap = document.createElement("div");
  wrap.className = "review-panel";
  const dayMap = getReviewDayMap();
  wrap.append(renderReviewSidebarCalendar(dayMap));
  wrap.append(renderReviewPanelDayBar(dayMap));
  const completeBar = renderReviewPanelCompleteBar(dayMap);
  if (completeBar) {
    wrap.append(completeBar);
  }
  wrap.append(renderReviewPanelReminders());
  wrap.append(renderReviewPanelFileList(dayMap));
  return wrap;
}

// 今天自动选中的那一套属于哪一天（entryKey 形如 day:2026-08-12）
function getTodayDailyReviewDayKey() {
  const entryKey = appSettings?.dailyReviewDayKey;
  if (typeof entryKey !== "string" || !entryKey) {
    return null;
  }
  return entryKey.startsWith("day:") ? entryKey.slice(4) : entryKey;
}

// 完成回顾入口分两级：
// - 今天推的那一套所在日 → 主按钮「✓ 完成回顾」，语义就是完成今天这次回顾；
// - 其他有内容的日子 → 弱化的「标记这一天已看过」，只做降权与留痕，不减未来推送次数。
// 空白日不挂按钮：没有可回顾的内容，留个灰按钮会让人误以为系统在催。
// 主进程已放开为「任意有内容的一天都可完成」，明天再看仍限今日选中套。
function renderReviewPanelCompleteBar(dayMap) {
  const day = dayMap.get(reviewBrowserState.dayKey);
  const hasContent = Boolean(
    day && (day.notes?.length || 0) + (day.files?.length || 0) > 0,
  );
  if (!hasContent) {
    return null;
  }

  const targetDayKey = reviewBrowserState.dayKey;
  const isTodayReviewDay = targetDayKey === getTodayDailyReviewDayKey();

  const bar = document.createElement("div");
  bar.className = "review-panel-bar review-panel-complete-bar";

  const button = document.createElement("button");
  button.type = "button";
  button.className = `review-panel-complete-button${isTodayReviewDay ? "" : " is-secondary"}`;
  button.textContent = isTodayReviewDay ? "✓ 完成回顾" : "标记这一天已看过";
  button.title = isTodayReviewDay
    ? "把今天这一套标记为已回顾，自动回顾会换到下一套"
    : "这一套不是今天要回顾的内容；标记后它会排到自动回顾的队尾，但不会减少以后的推送次数";
  button.addEventListener("click", async () => {
    button.disabled = true;
    try {
      await window.noticeNote.handleDailyReview(targetDayKey, "complete");
      await refreshAppSettingsAndRender();
      window.showToast?.(
        isTodayReviewDay ? "已标记完成回顾" : "已标记这一天看过了",
        "success",
      );
    } catch (error) {
      window.showErrorToast?.(error, "完成回顾失败");
      button.disabled = false;
    }
  });
  bar.append(button);
  return bar;
}

// 当天头部：‹ 日期 › 第N/M天 + 新建到当天
function renderReviewPanelDayBar(dayMap) {
  const bar = document.createElement("div");
  bar.className = "review-panel-bar";

  const dayKeys = [...dayMap.keys()];
  const currentIndex = dayKeys.indexOf(reviewBrowserState.dayKey);
  const prevDayKey = currentIndex > 0
    ? dayKeys[currentIndex - 1]
    : (currentIndex === -1
      ? (dayKeys.filter((key) => key < reviewBrowserState.dayKey).pop() || null)
      : null);
  const nextDayKey = currentIndex >= 0 && currentIndex < dayKeys.length - 1
    ? dayKeys[currentIndex + 1]
    : (currentIndex === -1
      ? (dayKeys.find((key) => key > reviewBrowserState.dayKey) || null)
      : null);

  const nav = document.createElement("div");
  nav.className = "review-panel-nav";

  const prevBtn = document.createElement("button");
  prevBtn.type = "button";
  prevBtn.className = "review-panel-arrow";
  prevBtn.textContent = "‹";
  prevBtn.title = "上一个有文件的日期";
  prevBtn.disabled = !prevDayKey;
  prevBtn.addEventListener("click", () => {
    if (prevDayKey) {
      selectReviewDay(prevDayKey);
    }
  });

  const title = document.createElement("strong");
  title.className = "review-panel-title";
  title.textContent = formatReviewDayShort(reviewBrowserState.dayKey);
  title.title = formatReviewDayTitle(reviewBrowserState.dayKey);

  const counter = document.createElement("span");
  counter.className = "review-panel-counter";
  counter.textContent = dayMap.has(reviewBrowserState.dayKey)
    ? `第 ${currentIndex + 1} / ${dayKeys.length} 天`
    : "空白日";

  const nextBtn = document.createElement("button");
  nextBtn.type = "button";
  nextBtn.className = "review-panel-arrow";
  nextBtn.textContent = "›";
  nextBtn.title = "下一个有文件的日期";
  nextBtn.disabled = !nextDayKey;
  nextBtn.addEventListener("click", () => {
    if (nextDayKey) {
      selectReviewDay(nextDayKey);
    }
  });

  const createBtn = document.createElement("button");
  createBtn.type = "button";
  createBtn.className = "review-panel-create";
  createBtn.textContent = "+ 新建";
  createBtn.title = "在回顾文件夹里新建笔记，并归到当前查看的这一天";
  createBtn.addEventListener("click", () => {
    createReviewNoteForDay(reviewBrowserState.dayKey);
  });

  nav.append(prevBtn, title, counter, nextBtn, createBtn);

  bar.append(nav);
  return bar;
}

// ---------- 按天设置提醒 ----------
// 提醒单位与回顾一致：给「这一天的一整套内容」排复习日，到那天由主进程推整套内容。
function getTomorrowDateKey() {
  const today = new Date();
  return toLocalDateKey(new Date(
    today.getFullYear(), today.getMonth(), today.getDate() + 1));
}

function runDayReminderAction(promise, button) {
  button.disabled = true;
  promise
    .then(() => refreshAppSettingsAndRender())
    .catch((error) => {
      window.showErrorToast?.(error, "设置提醒失败");
      alert(error.message || "设置提醒失败");
    })
    .finally(() => {
      button.disabled = false;
    });
}

function renderReviewPanelReminders() {
  const box = document.createElement("div");
  box.className = "review-panel-reminders";
  const dayKey = reviewBrowserState.dayKey;
  const records = (appSettings?.dayReminders || [])
    .filter((item) => item.dayKey === dayKey)
    .sort((a, b) => a.date.localeCompare(b.date));

  const head = document.createElement("div");
  head.className = "review-panel-reminders-head";

  const label = document.createElement("span");
  label.className = "review-panel-reminders-label";
  label.textContent = "提醒";

  const input = document.createElement("input");
  input.type = "date";
  input.className = "review-reminder-date-input";
  input.value = getTomorrowDateKey();
  input.min = toLocalDateKey(new Date());
  input.title = "给这一整套内容选一个复习日";
  input.addEventListener("click", (event) => event.stopPropagation());

  const addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.className = "review-reminder-add";
  addBtn.textContent = "+ 提醒";
  addBtn.title = "到那天提醒这一整天的全部内容";
  addBtn.addEventListener("click", () => {
    if (!input.value) {
      return;
    }
    runDayReminderAction(
      window.noticeNote.addDayReminder(dayKey, input.value),
      addBtn
    );
  });

  const autoBtn = document.createElement("button");
  autoBtn.type = "button";
  autoBtn.className = "review-reminder-auto";
  autoBtn.textContent = "自动排期";
  autoBtn.title = "按第 2、3、7、15、30 天各排一次（今天算第 1 天）";
  autoBtn.addEventListener("click", () => {
    runDayReminderAction(
      window.noticeNote.autoScheduleDayReminders(dayKey),
      autoBtn
    );
  });

  // 空状态并入标题行：没有复习日时不留一行空白，整块只有两行
  head.append(label);
  if (records.length === 0) {
    const hint = document.createElement("span");
    hint.className = "review-panel-reminders-empty";
    hint.textContent = "还没排复习日";
    head.append(hint);
  }
  head.append(autoBtn);

  // 日期 + 提交放在同一行：head 只放标题与次级动作，避免窄侧栏里挤成三行
  const row = document.createElement("div");
  row.className = "review-panel-reminders-row";
  row.append(input, addBtn);

  box.append(head, row);

  if (records.length > 0) {
    const chips = document.createElement("div");
    chips.className = "review-panel-reminders-chips";
    for (const record of records) {
      const chip = document.createElement("span");
      chip.className = `review-reminder-chip${record.done ? " is-done" : ""}`;
      chip.textContent = formatReviewDayShort(record.date);
      chip.title = record.done ? "已提醒过" : "待提醒";

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "review-reminder-chip-remove";
      remove.textContent = "×";
      remove.title = "取消这个复习日";
      remove.addEventListener("click", () => {
        runDayReminderAction(
          window.noticeNote.removeDayReminder(record.id),
          remove
        );
      });
      chip.append(remove);
      chips.append(chip);
    }
    box.append(chips);
  }
  return box;
}

// 当天文件列表：同一天的文件一律平级，按最近修改排序；每项带归天日期控件
// 当天文件列表：同一天的文件一律平级。默认按最近修改排序，拖过之后按手动顺序；
// 每项带归天日期控件，并挂一个拖拽手柄（手柄只在回顾面板这里出现）。
// 拖拽状态只记「哪一天的哪一个」，跨天不响应：顺序是按天存的。
let reviewFileDrag = null;

// 有手动顺序就按它排；没登记过的排在后面，彼此保持默认顺序（sort 稳定）。
function sortReviewDayEntries(entries, order) {
  if (!Array.isArray(order) || order.length === 0) {
    return entries;
  }
  const rank = new Map(order.map((key, index) => [key, index]));
  const rankOf = (key) => (rank.has(key) ? rank.get(key) : Number.MAX_SAFE_INTEGER);
  return [...entries].sort((a, b) => rankOf(a.key) - rankOf(b.key));
}

async function commitReviewDayFileOrder(dayKey, dragKey, targetKey, position) {
  try {
    const result = await window.noticeNote.reorderReviewDayFile(
      dayKey,
      dragKey,
      targetKey,
      position,
    );
    if (result?.reviewDayOrder) {
      appSettings = { ...(appSettings || {}), reviewDayOrder: result.reviewDayOrder };
    }
    renderNoteList();
  } catch (error) {
    console.error("调整回顾顺序失败:", error);
    alert(error.message || "调整顺序失败");
  }
}

function bindReviewDayFileReorder(item, dayKey, key) {
  item.addEventListener("dragover", (event) => {
    const drag = reviewFileDrag;
    if (!drag || drag.dayKey !== dayKey || drag.key === key) {
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    const edge = getDropEdge(event, item) === "before" ? "before" : "after";
    item.classList.remove("drop-before", "drop-after");
    item.classList.add(edge === "before" ? "drop-before" : "drop-after");
  });
  item.addEventListener("dragleave", (event) => {
    if (event.relatedTarget && item.contains(event.relatedTarget)) {
      return;
    }
    item.classList.remove("drop-before", "drop-after");
  });
  item.addEventListener("drop", async (event) => {
    const drag = reviewFileDrag;
    if (!drag || drag.dayKey !== dayKey || drag.key === key) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const position = item.classList.contains("drop-before") ? "before" : "after";
    item.classList.remove("drop-before", "drop-after");
    await commitReviewDayFileOrder(dayKey, drag.key, key, position);
  });
}

function renderReviewPanelFileList(dayMap) {
  const list = document.createElement("div");
  list.className = "review-panel-files";
  const dayKey = reviewBrowserState.dayKey;
  const day = dayMap.get(dayKey) || { notes: [], files: [] };

  // 默认顺序就是接口算基准的那个顺序：笔记按修改时间倒序在前，资源文件接在后面。
  const entries = [
    ...[...day.notes]
      .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
      .map((note) => ({ key: `note:${note.id}`, type: "note", item: note })),
    ...day.files.map((file) => ({ key: `file:${file.id}`, type: "file", item: file })),
  ];
  const ordered = sortReviewDayEntries(entries, appSettings?.reviewDayOrder?.[dayKey]);

  for (const entry of ordered) {
    const drag = {
      key: entry.key,
      onStart: () => {
        reviewFileDrag = { dayKey, key: entry.key };
      },
      onEnd: () => {
        reviewFileDrag = null;
        clearSidebarDropMarks();
      },
    };

    let node;
    if (entry.type === "note") {
      const note = entry.item;
      node = createReviewDayItem({
        label: note.title || "未命名笔记",
        meta: `修改 ${formatListDateTime(note.updatedAt)}`,
        badge: (note.fileType || "md").toUpperCase(),
        active: note.id === activeNoteId,
        isDailyReview: note.isDailyReview,
        onClick: () => selectNote(note.id).catch((error) => window.showErrorToast?.(error, "操作失败")),
        extra: createReviewDateControl(note),
        entry: { type: "note", id: note.id },
        drag,
      });
    } else {
      const file = entry.item;
      node = createReviewDayItem({
        label: file.name,
        meta: `${formatFileSize(file.size)} · 修改 ${formatListDateTime(file.updatedAt)}`,
        badge: file.typeLabel,
        active: file.id === activeResourceId || file.id === activePdfId,
        onClick: file.canOpen
          ? () => selectResourceFile(file.id).catch((error) => window.showErrorToast?.(error, "操作失败"))
          : null,
        extra: createReviewFileDateControl(file),
        entry: { type: "file", id: file.id },
        drag,
      });
    }
    bindReviewDayFileReorder(node, dayKey, entry.key);
    list.append(node);
  }

  if (list.childElementCount === 0) {
    const empty = document.createElement("p");
    empty.className = "note-list-empty";
    empty.textContent = dayMap.size === 0
      ? "回顾文件夹还是空的——点上方「+ 新建」把新笔记归到这一天"
      : "这一天还没有回顾文件——点上方「+ 新建」新建一篇";
    list.append(empty);
  }

  return list;
}

// ---------- 回顾顺序 / 提醒排期（标题栏小按钮 → 弹窗）----------
// 把原本藏在算法里的「接下来推哪套」和「哪天提醒哪套」显式化。
// 这两份列表都不短，塞进 ~300px 宽的侧边栏只能把标题截断，所以改成弹窗看全。
const REVIEW_OVERVIEW_KINDS = {
  queue: {
    label: "回顾顺序",
    unit: "套",
    empty: "暂无可回顾的内容。有文件、且没挂着未完成复习日的日子才会排进这里。",
  },
  schedule: {
    label: "提醒排期",
    unit: "个",
    empty: "还没有排复习日。在上方「提醒」里点「+ 提醒」或「自动排期」。",
  },
};

let reviewOverviewDialog = null;

// 同一个按钮再点一次就收起；点另一个按钮直接换成另一份列表。
function openReviewOverviewDialog(kind) {
  if (!REVIEW_OVERVIEW_KINDS[kind]) {
    return;
  }
  const togglingOff = reviewOverviewDialog?.kind === kind;
  closeReviewOverviewDialog();
  if (togglingOff) {
    return;
  }

  const overlay = document.createElement("div");
  overlay.className = "review-overview-dialog";
  overlay.tabIndex = -1;

  const content = document.createElement("div");
  content.className = "review-overview-dialog-content";
  content.setAttribute("role", "dialog");
  content.setAttribute("aria-modal", "true");
  content.setAttribute("aria-labelledby", "reviewOverviewHeading");

  const head = document.createElement("div");
  head.className = "review-overview-dialog-head";
  const heading = document.createElement("strong");
  heading.id = "reviewOverviewHeading";
  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.className = "review-overview-dialog-close";
  closeButton.textContent = "×";
  closeButton.title = "关闭";
  closeButton.setAttribute("aria-label", "关闭");
  head.append(heading, closeButton);

  const body = document.createElement("div");
  body.className = "review-overview-dialog-body";
  content.append(head, body);
  overlay.append(content);
  document.body.append(overlay);

  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) {
      closeReviewOverviewDialog();
    }
  });
  overlay.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeReviewOverviewDialog();
    }
  });
  closeButton.addEventListener("click", () => closeReviewOverviewDialog());

  reviewOverviewDialog = { overlay, heading, body, kind };
  renderReviewOverviewDialog();
  overlay.focus();
}

function closeReviewOverviewDialog() {
  if (!reviewOverviewDialog) {
    return;
  }
  reviewOverviewDialog.overlay.remove();
  reviewOverviewDialog = null;
}

// 弹窗开着时，改顺序 / 改日期 / 取消提醒都要就地刷新，不能让人对着旧数据继续点。
function refreshReviewOverviewDialog() {
  if (reviewOverviewDialog) {
    renderReviewOverviewDialog();
  }
}

function renderReviewOverviewDialog() {
  if (!reviewOverviewDialog) {
    return;
  }
  const { heading, body, kind } = reviewOverviewDialog;
  const meta = REVIEW_OVERVIEW_KINDS[kind];
  const queue = Array.isArray(appSettings?.reviewQueue) ? appSettings.reviewQueue : [];
  const records = (appSettings?.dayReminders || []).filter((record) => !record.done);
  const count = kind === "queue" ? queue.length : records.length;

  heading.textContent = `${meta.label}（${count} ${meta.unit}）`;
  body.innerHTML = "";
  if (count === 0) {
    body.append(createReviewOverviewEmpty(meta.empty));
    return;
  }
  body.append(kind === "queue"
    ? renderReviewQueueList(queue)
    : renderReminderScheduleList(records, getReviewDayMap()));
}

function createReviewOverviewEmpty(text) {
  const hint = document.createElement("p");
  hint.className = "review-overview-empty";
  hint.textContent = text;
  return hint;
}

function renderReviewQueueList(queue) {
  const list = document.createElement("div");
  list.className = "review-queue-list";
  queue.forEach((item, index) => {
    list.append(renderReviewQueueItem(item, index, queue.length));
  });
  return list;
}

function renderReviewQueueItem(item, index, total) {
  const row = document.createElement("div");
  row.className = `review-queue-item${item.isToday ? " is-today" : ""}`;

  const order = document.createElement("span");
  order.className = "review-queue-index";
  order.textContent = String(index + 1);

  const copy = document.createElement("div");
  copy.className = "review-queue-copy";
  // 日期放副标题：侧边栏只有 ~300px，标题前再挂「11月16日」会把正题挤成省略号。
  const title = document.createElement("strong");
  title.textContent = item.title;
  title.title = `${formatReviewDayTitle(item.dayKey)} · ${item.title} · ${item.count} 个文件`;
  const meta = document.createElement("small");
  meta.textContent = item.isToday
    ? `${formatReviewDayShort(item.dayKey)} · 今天推这一套`
    : `${formatReviewDayShort(item.dayKey)} · ${item.count} 个文件`;
  copy.append(title, meta);

  const actions = document.createElement("div");
  actions.className = "review-queue-actions";
  const addAction = (label, action, titleText, disabled) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "review-queue-action";
    btn.textContent = label;
    btn.title = titleText;
    btn.disabled = disabled;
    btn.addEventListener("click", () => runReviewReorder(item.dayKey, action, btn));
    actions.append(btn);
  };
  addAction("顶", "top", "移到队首，下一个就推它", index === 0);
  addAction("↑", "up", "往前挪一位", index === 0);
  addAction("↓", "down", "往后挪一位", index === total - 1);

  row.append(order, copy, actions);
  return row;
}

async function runReviewReorder(dayKey, action, button) {
  button.disabled = true;
  try {
    appSettings = await window.noticeNote.reorderDailyReview(dayKey, action);
    renderNoteList();
    refreshReviewOverviewDialog();
  } catch (error) {
    window.showErrorToast?.(error, "调整回顾顺序失败");
    button.disabled = false;
  }
}

function renderReminderScheduleList(records, dayMap) {
  const todayKey = toLocalDateKey(new Date());
  const list = document.createElement("div");
  list.className = "review-schedule-list";
  for (const record of records) {
    list.append(renderReviewScheduleItem(record, dayMap, todayKey));
  }
  return list;
}

function renderReviewScheduleItem(record, dayMap, todayKey) {
  const day = dayMap.get(record.dayKey);
  const first = day?.notes?.[0] || day?.files?.[0] || null;
  const title = first?.title || first?.name || "内容已不在回顾文件夹";

  const row = document.createElement("div");
  row.className = "review-schedule-item";

  const head = document.createElement("div");
  head.className = "review-schedule-head";
  const dateLabel = document.createElement("strong");
  dateLabel.textContent = formatReviewDayShort(record.date);
  const arrow = document.createElement("span");
  arrow.className = "review-schedule-arrow";
  arrow.textContent = "→";
  const target = document.createElement("span");
  target.className = "review-schedule-target";
  target.textContent = `${formatReviewDayShort(record.dayKey)} ${title}`;
  target.title = `${formatReviewDayTitle(record.dayKey)} · ${title}`;
  head.append(dateLabel, arrow, target);

  const footer = document.createElement("div");
  footer.className = "review-schedule-footer";
  const input = document.createElement("input");
  input.type = "date";
  input.className = "review-schedule-date";
  input.value = record.date;
  input.min = todayKey;
  input.title = "改到哪一天提醒";
  input.addEventListener("change", () => {
    runReminderDateChange(record, input.value, input);
  });
  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "review-schedule-remove";
  remove.textContent = "取消";
  remove.title = "取消这个提醒";
  remove.addEventListener("click", () => runReminderRemove(record.id, remove));
  footer.append(input, remove);

  row.append(head, footer);
  return row;
}

async function runReminderDateChange(record, date, input) {
  if (!date || date === record.date) {
    return;
  }
  input.disabled = true;
  try {
    await window.noticeNote.updateDayReminderDate(record.id, date);
    await refreshAppSettingsAndRender();
    refreshReviewOverviewDialog();
    window.showToast?.(`已改到 ${formatReviewDayShort(date)}`, "success");
  } catch (error) {
    window.showErrorToast?.(error, "改提醒日期失败");
    input.value = record.date;
    input.disabled = false;
  }
}

async function runReminderRemove(id, button) {
  button.disabled = true;
  try {
    await window.noticeNote.removeDayReminder(id);
    await refreshAppSettingsAndRender();
    refreshReviewOverviewDialog();
  } catch (error) {
    window.showErrorToast?.(error, "取消提醒失败");
    button.disabled = false;
  }
}

// 归天控件：原生日期选择器 + 恢复创建时间按钮
function createReviewDateControl(note) {
  return createReviewDateControlInner(
    note,
    note.reviewDate || getNoteReviewDayKey(note) || "",
    (dayKey, onFailure) => applyReviewDate(note, dayKey, onFailure)
  );
}

function createReviewFileDateControl(file) {
  return createReviewDateControlInner(
    file,
    file.reviewDate || getFileReviewDayKey(file) || "",
    (dayKey, onFailure) => applyReviewFileDate(file, dayKey, onFailure)
  );
}

function createReviewDateControlInner(entry, currentDay, onApply) {
  const wrap = document.createElement("span");
  wrap.className = "review-date-control";

  const label = document.createElement("span");
  label.className = "review-date-control-label";
  label.textContent = "归到";

  const input = document.createElement("input");
  input.type = "date";
  input.className = "review-date-input";
  input.value = currentDay;
  input.title = "更改这个文件归属于哪一天";
  input.addEventListener("click", (event) => event.stopPropagation());
  // 失败时把控件值回弹到旧日期，避免界面显示一个其实没保存成功的新值（R11）。
  const restoreValue = () => {
    input.value = currentDay;
  };
  input.addEventListener("change", () => {
    const value = input.value.trim();
    onApply(value || null, restoreValue);
  });

  wrap.append(label, input);

  if (entry.reviewDate) {
    const reset = document.createElement("button");
    reset.type = "button";
    reset.className = "review-date-reset";
    reset.textContent = "↺";
    reset.title = "恢复按创建时间归天";
    reset.addEventListener("click", (event) => {
      event.stopPropagation();
      onApply(null, restoreValue);
    });
    wrap.append(reset);
  }

  return wrap;
}

function applyReviewDate(note, dayKey, onFailure = null) {
  return window.noticeNote
    .setReviewDate({ type: "note", id: note.id }, dayKey)
    .then(() => refreshAppSettingsAndRender(dayKey))
    .catch((error) => {
      window.showErrorToast?.(error, "改归天日期失败");
      onFailure?.();
    });
}

function applyReviewFileDate(file, dayKey, onFailure = null) {
  return window.noticeNote
    .setReviewDate({ type: "file", id: file.id }, dayKey)
    .then(() => refreshAppSettingsAndRender(dayKey))
    .catch((error) => {
      window.showErrorToast?.(error, "改归天日期失败");
      onFailure?.();
    });
}

// 归天只走列表里的日期控件：右键菜单不再提供入口。
// 这里曾有一个 prompt 版「设置回顾日期」，与控件改的是同一个字段，
// 两个入口并存只会让人以为它们是两件事。
async function createReviewNoteForDay(dayKey) {
  let folderId = getReviewFolderId();
  if (!folderId) {
    // 主进程启动时会确保 .study_notice 存在；这里再拉一次文件夹列表兜底
    // （切换存储位置后渲染层可能还拿着旧列表），失败则给出可读提示而不是静默返回。
    try {
      const nextFolders = await window.noticeNote.listFolders();
      if (Array.isArray(nextFolders)) {
        folders = nextFolders;
      }
      folderId = getReviewFolderId();
    } catch (error) {
      window.showErrorToast?.(error, "刷新文件夹列表失败");
    }
  }
  if (!folderId) {
    window.showErrorToast?.(
      new Error("未找到回顾目录 .study_notice，请点资料库刷新后重试"),
      "新建到当天失败",
    );
    return;
  }
  try {
    const note = await window.noticeNote.createNote(folderId);
    await window.noticeNote.setReviewDate({ type: "note", id: note.id }, dayKey);
    await selectNote(note.id);
    refreshAppSettingsAndRender();
  } catch (error) {
    window.showErrorToast?.(error, "新建到当天失败");
  }
}
