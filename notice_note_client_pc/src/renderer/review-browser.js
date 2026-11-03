// 回顾侧边栏面板：月历导航 + 当天文件 + 当天操作
// 所有回顾功能都在侧边栏（与「日历」模式一致）；主工作区照常显示文件，
// 点侧边栏里的回顾文件即在主工作区打开。
// 注意：本文件为经典脚本，顶层 const/let 处于页面全局词法环境，跨文件共享；请勿重复声明同名标识符。

const reviewBrowserState = {
  month: null, // 当前显示月份（当月第一天）
  dayKey: null // 当前查看的日期
};

function getNoteReviewDayKey(note) {
  if (note?.reviewDate) {
    return note.reviewDate;
  }
  const created = note?.createdAt ? new Date(note.createdAt) : null;
  return created && !Number.isNaN(created.getTime())
    ? toLocalDateKey(created)
    : null;
}

function getFileReviewDayKey(file) {
  if (file?.reviewDate) {
    return file.reviewDate;
  }
  const created = file?.createdAt ? new Date(file.createdAt) : null;
  return created && !Number.isNaN(created.getTime())
    ? toLocalDateKey(created)
    : null;
}

// 回顾文件按天分组（升序）
function getReviewDayMap() {
  const dayMap = new Map();
  const ensureDay = (dayKey) => {
    if (!dayMap.has(dayKey)) {
      dayMap.set(dayKey, { dayKey, notes: [], files: [] });
    }
    return dayMap.get(dayKey);
  };
  for (const note of notes) {
    if (note.isReviewFile) {
      const dayKey = getNoteReviewDayKey(note);
      if (dayKey) {
        ensureDay(dayKey).notes.push(note);
      }
    }
  }
  for (const file of resourceFiles) {
    if (file.isReviewFile) {
      const dayKey = getFileReviewDayKey(file);
      if (dayKey) {
        ensureDay(dayKey).files.push(file);
      }
    }
  }
  return new Map([...dayMap.entries()].sort((a, b) => a[0].localeCompare(b[0])));
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
function activateReviewBrowser() {
  setSidebarViewMode("reminder");
}

// 回顾操作后刷新应用设置（每日回顾选中天可能变化），再重绘侧边栏
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
  const dayKeys = [...dayMap.keys()];
  const todayKey = toLocalDateKey(new Date());

  if (!reviewBrowserState.dayKey) {
    // 初始定位：今日回顾选中天 -> 今天 -> 最近有文件的一天
    const pickedDay = appSettings?.dailyReviewDayKey?.startsWith("day:")
      ? appSettings.dailyReviewDayKey.slice(4)
      : null;
    let nextDay = null;
    if (pickedDay && dayMap.has(pickedDay)) {
      nextDay = pickedDay;
    } else if (dayMap.has(todayKey)) {
      nextDay = todayKey;
    } else if (dayKeys.length > 0) {
      nextDay = dayKeys[dayKeys.length - 1];
    } else {
      nextDay = todayKey; // 没有任何回顾文件：停靠在今天（空白日也可新建）
    }
    reviewBrowserState.dayKey = nextDay;
    const selected = parseDayKey(nextDay);
    reviewBrowserState.month = new Date(selected.getFullYear(), selected.getMonth(), 1);
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
    const todayKey = toLocalDateKey(new Date());
    if (dayMap.has(todayKey)) {
      selectReviewDay(todayKey);
      return;
    }
    // 今天没有回顾文件：只把月历切到当前月
    const today = new Date();
    reviewBrowserState.month = new Date(today.getFullYear(), today.getMonth(), 1);
    renderNoteList();
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
  wrap.append(renderReviewPanelFileList(dayMap));
  return wrap;
}

// 当天头部 + 当天操作
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

  // 第一行：‹ 日期 › 第N/M天 + 新建到当天
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

  // 第二行：今日回顾操作（当天是今日回顾选中天时）或提示
  const actions = document.createElement("div");
  actions.className = "review-panel-actions";
  const todayKey = toLocalDateKey(new Date());
  const pickedDayKey = appSettings?.dailyReviewDayKey?.startsWith("day:")
    ? appSettings.dailyReviewDayKey.slice(4)
    : null;
  const isPickedToday = pickedDayKey === reviewBrowserState.dayKey;

  if (isPickedToday) {
    const badge = document.createElement("span");
    badge.className = "daily-review-badge";
    badge.textContent = "今日回顾";
    actions.append(badge);

    const completeBtn = document.createElement("button");
    completeBtn.type = "button";
    completeBtn.className = "review-panel-button primary";
    completeBtn.textContent = "完成回顾";
    completeBtn.addEventListener("click", () => {
      completeBtn.disabled = true;
      window.noticeNote
        .handleDailyReview(reviewBrowserState.dayKey, "complete")
        .then(() => refreshAppSettingsAndRender())
        .catch((error) => {
          console.error("完成回顾失败:", error);
          alert(error.message || "完成回顾失败");
        })
        .finally(() => {
          completeBtn.disabled = false;
        });
    });

    const deferBtn = document.createElement("button");
    deferBtn.type = "button";
    deferBtn.className = "review-panel-button";
    deferBtn.textContent = "明天再看";
    deferBtn.addEventListener("click", () => {
      deferBtn.disabled = true;
      window.noticeNote
        .handleDailyReview(reviewBrowserState.dayKey, "defer")
        .then(() => refreshAppSettingsAndRender())
        .catch((error) => {
          console.error("推迟回顾失败:", error);
          alert(error.message || "推迟回顾失败");
        })
        .finally(() => {
          deferBtn.disabled = false;
        });
    });

    actions.append(completeBtn, deferBtn);
  } else {
    const hint = document.createElement("span");
    hint.className = "review-panel-hint";
    hint.textContent = pickedDayKey
      ? `今日回顾是 ${formatReviewDayShort(pickedDayKey)} 那一套`
      : "今天没有自动选中的回顾日";
    actions.append(hint);
  }

  bar.append(nav, actions);
  return bar;
}

// 当天文件列表：主文件 -> 次文件 -> 未指定；每项带归天日期控件
function renderReviewPanelFileList(dayMap) {
  const list = document.createElement("div");
  list.className = "review-panel-files";
  const day = dayMap.get(reviewBrowserState.dayKey) || { notes: [], files: [] };

  const orderedNotes = [...day.notes].sort((a, b) => {
    const rank = (note) => (note.reviewRole === "primary" ? 0 : note.reviewRole === "secondary" ? 1 : 2);
    return rank(a) - rank(b) || Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
  });

  for (const note of orderedNotes) {
    list.append(
      createReviewDayItem({
        label: note.title || "未命名笔记",
        meta: `修改 ${formatListDateTime(note.updatedAt)}`,
        badge: note.reviewRole === "primary" ? "主" : note.reviewRole === "secondary" ? "次" : note.fileType.toUpperCase(),
        active: note.id === activeNoteId,
        isDailyReview: note.isDailyReview,
        onClick: () => selectNote(note.id).catch(console.error),
        role: note.reviewRole,
        onRoleToggle: () => setReviewRoleForNote(note),
        extra: createReviewDateControl(note)
      }),
    );
  }
  for (const file of day.files) {
    list.append(
      createReviewDayItem({
        label: file.name,
        meta: `${formatFileSize(file.size)} · 修改 ${formatListDateTime(file.updatedAt)}`,
        badge: file.typeLabel,
        active: file.id === activeResourceId || file.id === activePdfId,
        onClick: file.canOpen
          ? () => selectResourceFile(file.id).catch(console.error)
          : null,
        extra: createReviewFileDateControl(file)
      }),
    );
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

// 设为主文件（再点取消）
function setReviewRoleForNote(note) {
  const nextRole = note.reviewRole === "primary" ? null : "primary";
  window.noticeNote
    .setReviewRole({ type: "note", id: note.id }, nextRole)
    .then(() => refreshAppSettingsAndRender())
    .catch((error) => console.error("设置主次失败:", error));
}

// 归天控件：原生日期选择器 + 恢复创建时间按钮
function createReviewDateControl(note) {
  return createReviewDateControlInner(
    note,
    note.reviewDate || getNoteReviewDayKey(note) || "",
    (dayKey) => applyReviewDate(note, dayKey)
  );
}

function createReviewFileDateControl(file) {
  return createReviewDateControlInner(
    file,
    file.reviewDate || getFileReviewDayKey(file) || "",
    (dayKey) => applyReviewFileDate(file, dayKey)
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
  input.addEventListener("change", () => {
    const value = input.value.trim();
    onApply(value || null);
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
      onApply(null);
    });
    wrap.append(reset);
  }

  return wrap;
}

function applyReviewDate(note, dayKey) {
  window.noticeNote
    .setReviewDate({ type: "note", id: note.id }, dayKey)
    .then(() => refreshAppSettingsAndRender(dayKey))
    .catch((error) => console.error("设置回顾日期失败:", error));
}

function applyReviewFileDate(file, dayKey) {
  window.noticeNote
    .setReviewDate({ type: "file", id: file.id }, dayKey)
    .then(() => refreshAppSettingsAndRender(dayKey))
    .catch((error) => console.error("设置回顾日期失败:", error));
}

// 右键菜单用：输入任意日期（YYYY-MM-DD），留空恢复创建时间
function promptReviewDate(note) {
  const current = note.reviewDate || getNoteReviewDayKey(note) || "";
  const input = window.prompt("设置回顾日期（YYYY-MM-DD）\n留空则按创建时间归天：", current);
  if (input === null) {
    return;
  }
  const value = input.trim();
  if (!value) {
    applyReviewDate(note, null);
    return;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value))) {
    alert("日期格式无效，请使用 YYYY-MM-DD");
    return;
  }
  applyReviewDate(note, value);
}

async function createReviewNoteForDay(dayKey) {
  const folderId = getReviewFolderId();
  if (!folderId) {
    console.error("未找到回顾文件夹");
    return;
  }
  try {
    const note = await window.noticeNote.createNote(folderId);
    await window.noticeNote.setReviewDate({ type: "note", id: note.id }, dayKey);
    await selectNote(note.id);
    refreshAppSettingsAndRender();
  } catch (error) {
    console.error("新建到当天失败:", error);
    alert(error.message || "新建到当天失败");
  }
}
