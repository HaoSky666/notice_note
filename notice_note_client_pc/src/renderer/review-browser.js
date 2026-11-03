// 回顾浏览器：主工作区全宽页面
// - 顶部月历（有文件的日期带圆点，点击跳转）
// - 当天视图：主文件大卡片 + 次文件小卡片，左右键按天翻页
// - 每张卡片可改「归天日期」和主次角色；底部为当日回顾操作
// 注意：本文件为经典脚本，顶层 const/let 处于页面全局词法环境，跨文件共享；请勿重复声明同名标识符。

const REVIEW_TAB_ID = "review";
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

function parseDayKey(dayKey) {
  const [year, month, day] = dayKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function getReviewFolderId() {
  return folders.find((folder) => folder.isReviewFolder)?.id || null;
}

function ensureReviewBrowserState() {
  const dayMap = getReviewDayMap();
  const dayKeys = [...dayMap.keys()];
  if (dayKeys.length === 0) {
    reviewBrowserState.dayKey = null;
    reviewBrowserState.month = null;
    return dayMap;
  }
  if (!reviewBrowserState.dayKey || !dayMap.has(reviewBrowserState.dayKey)) {
    // 默认定位到今日回顾选中天，否则最近有文件的一天
    const todayKey = toLocalDateKey(new Date());
    const pickedDay = appSettings?.dailyReviewDayKey?.startsWith("day:")
      ? appSettings.dailyReviewDayKey.slice(4)
      : null;
    reviewBrowserState.dayKey = pickedDay && dayMap.has(pickedDay)
      ? pickedDay
      : (dayMap.includes(todayKey) ? todayKey : dayKeys[dayKeys.length - 1]);
  }
  const selected = parseDayKey(reviewBrowserState.dayKey);
  reviewBrowserState.month = new Date(selected.getFullYear(), selected.getMonth(), 1);
  return dayMap;
}

function activateReviewBrowser() {
  const existing = workspaceTabs.find((tab) => tab.type === "review");
  if (!existing) {
    workspaceTabs.unshift({ type: "review", id: REVIEW_TAB_ID });
  }
  activateWorkspaceTab("review", REVIEW_TAB_ID)
    .then(() => {
      // 侧边栏切换到回顾模式（当天紧凑列表）
      setSidebarViewMode("reminder", false);
      renderBreadcrumb();
      renderNoteList();
    })
    .catch(console.error);
}

function renderReviewBrowser() {
  const host = document.querySelector("#reviewBrowserInner");
  const panel = document.querySelector("#reviewBrowser");
  if (!host || !panel) {
    return;
  }
  panel.hidden = false;
  editorPanel.hidden = true;
  pdfViewer.hidden = true;
  fileViewer.hidden = true;
  destroyPdfPreview();

  const dayMap = ensureReviewBrowserState();
  host.innerHTML = "";

  if (dayMap.size === 0) {
    const empty = document.createElement("div");
    empty.className = "review-empty";
    empty.innerHTML = `
      <p class="review-empty-title">回顾文件夹是空的</p>
      <p class="review-empty-hint">把文件放进 notes/.study_notice 文件夹，就会按创建时间出现在这里</p>
    `;
    host.append(empty);
    return;
  }

  host.append(renderReviewCalendar(dayMap));
  host.append(renderReviewDayView(dayMap));
}

// ---------- 月历 ----------
function renderReviewCalendar(dayMap) {
  const wrap = document.createElement("section");
  wrap.className = "review-calendar";

  const header = document.createElement("div");
  header.className = "review-calendar-header";

  const prevBtn = document.createElement("button");
  prevBtn.type = "button";
  prevBtn.className = "review-calendar-nav";
  prevBtn.textContent = "‹";
  prevBtn.title = "上个月";
  prevBtn.setAttribute("aria-label", "上个月");
  prevBtn.addEventListener("click", () => {
    reviewBrowserState.month = new Date(
      reviewBrowserState.month.getFullYear(),
      reviewBrowserState.month.getMonth() - 1,
      1,
    );
    renderReviewBrowser();
  });

  const monthLabel = document.createElement("strong");
  monthLabel.className = "review-calendar-title";
  monthLabel.textContent = `${reviewBrowserState.month.getFullYear()}年${reviewBrowserState.month.getMonth() + 1}月`;

  const nextBtn = document.createElement("button");
  nextBtn.type = "button";
  nextBtn.className = "review-calendar-nav";
  nextBtn.textContent = "›";
  nextBtn.title = "下个月";
  nextBtn.setAttribute("aria-label", "下个月");
  nextBtn.addEventListener("click", () => {
    reviewBrowserState.month = new Date(
      reviewBrowserState.month.getFullYear(),
      reviewBrowserState.month.getMonth() + 1,
      1,
    );
    renderReviewBrowser();
  });

  const todayBtn = document.createElement("button");
  todayBtn.type = "button";
  todayBtn.className = "review-calendar-today";
  todayBtn.textContent = "回到今天";
  todayBtn.addEventListener("click", () => {
    const todayKey = toLocalDateKey(new Date());
    if (dayMap.has(todayKey)) {
      reviewBrowserState.dayKey = todayKey;
    }
    const today = new Date();
    reviewBrowserState.month = new Date(today.getFullYear(), today.getMonth(), 1);
    renderReviewBrowser();
  });

  header.append(prevBtn, monthLabel, nextBtn, todayBtn);

  const weekRow = document.createElement("div");
  weekRow.className = "review-calendar-week";
  for (const label of ["一", "二", "三", "四", "五", "六", "日"]) {
    const cell = document.createElement("span");
    cell.textContent = label;
    weekRow.append(cell);
  }

  const grid = document.createElement("div");
  grid.className = "review-calendar-grid";

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
    cell.className = `review-calendar-day${hasFiles ? " has-files" : ""}${dayKey === reviewBrowserState.dayKey ? " is-selected" : ""}${dayKey === todayKey ? " is-today" : ""}`;
    cell.dataset.dayKey = dayKey;
    cell.disabled = !hasFiles;
    cell.textContent = String(day);
    if (hasFiles) {
      const count = dayMap.get(dayKey);
      const total = count.notes.length + count.files.length;
      cell.title = `${formatReviewDayTitle(dayKey)}（${total} 个文件）`;
      cell.append(document.createElement("i"));
      cell.addEventListener("click", () => {
        reviewBrowserState.dayKey = dayKey;
        renderReviewBrowser();
      });
    }
    grid.append(cell);
  }

  wrap.append(header, weekRow, grid);
  return wrap;
}

// ---------- 当天视图 ----------
function renderReviewDayView(dayMap) {
  const dayKeys = [...dayMap.keys()];
  const day = dayMap.get(reviewBrowserState.dayKey);
  const section = document.createElement("section");
  section.className = "review-day";

  // 日期导航
  const nav = document.createElement("div");
  nav.className = "review-day-nav";

  const currentIndex = dayKeys.indexOf(reviewBrowserState.dayKey);
  const prevBtn = document.createElement("button");
  prevBtn.type = "button";
  prevBtn.className = "review-day-arrow";
  prevBtn.textContent = "‹";
  prevBtn.title = "上一天";
  prevBtn.disabled = currentIndex <= 0;
  prevBtn.addEventListener("click", () => {
    if (currentIndex > 0) {
      reviewBrowserState.dayKey = dayKeys[currentIndex - 1];
      renderReviewBrowser();
    }
  });

  const title = document.createElement("strong");
  title.className = "review-day-title";
  title.textContent = formatReviewDayTitle(reviewBrowserState.dayKey);

  const counter = document.createElement("span");
  counter.className = "review-day-counter";
  counter.textContent = `第 ${currentIndex + 1} / ${dayKeys.length} 天`;

  const nextBtn = document.createElement("button");
  nextBtn.type = "button";
  nextBtn.className = "review-day-arrow";
  nextBtn.textContent = "›";
  nextBtn.title = "下一天";
  nextBtn.disabled = currentIndex >= dayKeys.length - 1;
  nextBtn.addEventListener("click", () => {
    if (currentIndex < dayKeys.length - 1) {
      reviewBrowserState.dayKey = dayKeys[currentIndex + 1];
      renderReviewBrowser();
    }
  });

  nav.append(prevBtn, title, counter, nextBtn);
  section.append(nav);

  // 文件卡片：主文件 -> 次文件 -> 未指定
  const orderedNotes = [...day.notes].sort((a, b) => {
    const rank = (note) => (note.reviewRole === "primary" ? 0 : note.reviewRole === "secondary" ? 1 : 2);
    return rank(a) - rank(b) || Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
  });

  const cardList = document.createElement("div");
  cardList.className = "review-day-cards";
  for (const note of orderedNotes) {
    cardList.append(renderReviewNoteCard(note));
  }
  for (const file of day.files) {
    cardList.append(renderReviewFileCard(file));
  }
  section.append(cardList);

  // 底部操作栏
  section.append(renderReviewDayActions(day));
  return section;
}

function renderReviewNoteCard(note) {
  const isPrimary = note.reviewRole === "primary";
  const card = document.createElement("article");
  card.className = `review-day-card${isPrimary ? " is-primary" : ""}${note.isDailyReview ? " is-daily-review" : ""}`;

  const head = document.createElement("div");
  head.className = "review-day-card-head";

  const roleTag = document.createElement("span");
  roleTag.className = `review-role-tag${isPrimary ? " is-primary" : ""}`;
  roleTag.textContent = isPrimary ? "主文件" : note.reviewRole === "secondary" ? "次文件" : "未指定";

  const title = document.createElement("strong");
  title.className = "review-day-card-title";
  title.textContent = note.title || "未命名笔记";
  title.title = title.textContent;

  const typeBadge = document.createElement("span");
  typeBadge.className = `file-type-badge ${note.fileType}`;
  typeBadge.textContent = note.fileType.toUpperCase();

  head.append(roleTag, title, typeBadge);

  const preview = document.createElement("p");
  preview.className = "review-day-card-preview";
  const plain = String(note.content || "")
    .replace(/!\[[^\]]*\]\([^)]+\)/g, " ")
    .replace(/[#*`>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  preview.textContent = plain.slice(0, 120) || "（空笔记）";

  const meta = document.createElement("div");
  meta.className = "review-day-card-meta";
  const time = document.createElement("span");
  time.textContent = `修改 ${formatListDateTime(note.updatedAt)}`;
  const lastReview = document.createElement("span");
  lastReview.textContent = note.dailyReviewLastReviewedAt
    ? `上次回顾 ${formatListDateTime(note.dailyReviewLastReviewedAt)}`
    : "上次回顾：从未";
  meta.append(time, lastReview);

  const actions = document.createElement("div");
  actions.className = "review-day-card-actions";
  actions.append(
    createReviewOpenButton("打开", () => selectNote(note.id).catch(console.error)),
    createReviewRoleButton(note),
    createReviewDateDropdown(note),
  );

  card.append(head, preview, meta, actions);
  card.addEventListener("dblclick", () => selectNote(note.id).catch(console.error));
  return card;
}

function renderReviewFileCard(file) {
  const card = document.createElement("article");
  card.className = `review-day-card is-resource ${file.kind}${file.canOpen ? "" : " is-unopenable"}`;

  const head = document.createElement("div");
  head.className = "review-day-card-head";
  const title = document.createElement("strong");
  title.className = "review-day-card-title";
  title.textContent = file.name;
  title.title = file.name;
  const typeBadge = document.createElement("span");
  typeBadge.className = `file-type-badge ${file.kind}`;
  typeBadge.textContent = file.typeLabel;
  head.append(title, typeBadge);

  const preview = document.createElement("p");
  preview.className = "review-day-card-preview";
  preview.textContent = `${formatFileSize(file.size)} · 修改 ${formatListDateTime(file.updatedAt)}`;

  const meta = document.createElement("div");
  meta.className = "review-day-card-meta";
  const time = document.createElement("span");
  time.textContent = `归到：${file.reviewDate || "按创建时间"}`;
  meta.append(time);

  const actions = document.createElement("div");
  actions.className = "review-day-card-actions";
  if (file.canOpen) {
    actions.append(
      createReviewOpenButton("打开", () => selectResourceFile(file.id).catch(console.error)),
    );
  }
  card.append(head, preview, meta, actions);
  return card;
}

function createReviewOpenButton(label, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "review-card-action primary";
  button.textContent = label;
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    onClick();
  });
  return button;
}

function createReviewRoleButton(note) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "review-card-action";
  const isPrimary = note.reviewRole === "primary";
  button.textContent = isPrimary ? "设为主文件 ✓" : note.reviewRole === "secondary" ? "设为次文件 ✓" : "设为主文件";
  button.title = isPrimary ? "当天的主文件（只能有一个）" : "把这个文件设为当天主文件";
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    const nextRole = isPrimary ? null : "primary";
    window.noticeNote
      .setReviewRole({ type: "note", id: note.id }, nextRole)
      .then(() => renderReviewBrowser())
      .catch((error) => console.error("设置主次失败:", error));
  });
  return button;
}

// 归天下拉：列出当月有文件的日期 + 恢复创建时间
function createReviewDateDropdown(note) {
  const wrap = document.createElement("div");
  wrap.className = "review-date-dropdown";

  const button = document.createElement("button");
  button.type = "button";
  button.className = "review-card-action";
  button.textContent = `归到：${formatReviewDayShort(note.reviewDate || getNoteReviewDayKey(note))} ▾`;
  button.title = "更改这个文件归属于哪一天";

  const menu = document.createElement("div");
  menu.className = "review-date-menu";
  menu.hidden = true;

  const dayMap = getReviewDayMap();
  const month = reviewBrowserState.month;
  const monthPrefix = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`;
  const monthDays = [...dayMap.keys()].filter((key) => key.startsWith(monthPrefix));
  for (const dayKey of monthDays) {
    const item = document.createElement("button");
    item.type = "button";
    item.className = `review-date-menu-item${dayKey === (note.reviewDate || getNoteReviewDayKey(note)) ? " is-active" : ""}`;
    item.textContent = formatReviewDayShort(dayKey);
    item.addEventListener("click", (event) => {
      event.stopPropagation();
      menu.hidden = true;
      applyReviewDate(note, dayKey);
    });
    menu.append(item);
  }

  const resetItem = document.createElement("button");
  resetItem.type = "button";
  resetItem.className = "review-date-menu-item";
  resetItem.textContent = "按创建时间";
  resetItem.addEventListener("click", (event) => {
    event.stopPropagation();
    menu.hidden = true;
    applyReviewDate(note, null);
  });
  menu.append(resetItem);

  button.addEventListener("click", (event) => {
    event.stopPropagation();
    // 重新生成菜单（天数可能已变）
    const fresh = createReviewDateDropdown(note);
    wrap.replaceWith(fresh);
    const freshMenu = fresh.querySelector(".review-date-menu");
    const freshButton = fresh.querySelector("button");
    if (freshMenu && freshButton) {
      freshMenu.hidden = false;
      const close = (ev) => {
        if (!fresh.contains(ev.target)) {
          freshMenu.hidden = true;
          document.removeEventListener("click", close, true);
        }
      };
      document.addEventListener("click", close, true);
    }
  });

  wrap.append(button, menu);
  return wrap;
}

function formatReviewDayShort(dayKey) {
  if (!dayKey) {
    return "未归天";
  }
  const [, month, day] = dayKey.split("-");
  return `${Number(month)}月${Number(day)}日`;
}

function applyReviewDate(note, dayKey) {
  window.noticeNote
    .setReviewDate({ type: "note", id: note.id }, dayKey)
    .then(() => renderReviewBrowser())
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

// 底部：今日回顾操作 + 新建到当天
function renderReviewDayActions(day) {
  const bar = document.createElement("div");
  bar.className = "review-day-actions";

  const todayKey = toLocalDateKey(new Date());
  const pickedDayKey = appSettings?.dailyReviewDayKey?.startsWith("day:")
    ? appSettings.dailyReviewDayKey.slice(4)
    : null;
  const isPickedToday = pickedDayKey === reviewBrowserState.dayKey;

  const left = document.createElement("div");
  left.className = "review-day-actions-left";
  if (isPickedToday) {
    const badge = document.createElement("span");
    badge.className = "daily-review-badge";
    badge.textContent = "今日回顾";
    left.append(badge);

    const completeBtn = document.createElement("button");
    completeBtn.type = "button";
    completeBtn.className = "primary-button";
    completeBtn.textContent = "完成回顾";
    completeBtn.addEventListener("click", () => {
      window.noticeNote
        .handleDailyReview(reviewBrowserState.dayKey, "complete")
        .then(() => renderReviewBrowser())
        .catch((error) => console.error("完成回顾失败:", error));
    });

    const deferBtn = document.createElement("button");
    deferBtn.type = "button";
    deferBtn.className = "secondary-button";
    deferBtn.textContent = "明天再看";
    deferBtn.addEventListener("click", () => {
      window.noticeNote
        .handleDailyReview(reviewBrowserState.dayKey, "defer")
        .then(() => renderReviewBrowser())
        .catch((error) => console.error("推迟回顾失败:", error));
    });

    left.append(completeBtn, deferBtn);
  } else {
    const hint = document.createElement("span");
    hint.className = "review-day-actions-hint";
    hint.textContent = pickedDayKey
      ? `今日回顾是 ${formatReviewDayShort(pickedDayKey)} 那一套`
      : "今天没有自动选中的回顾日（周末或候选为空）";
    left.append(hint);
  }

  const createBtn = document.createElement("button");
  createBtn.type = "button";
  createBtn.className = "secondary-button";
  createBtn.textContent = "+ 新建到当天";
  createBtn.title = "在回顾文件夹里新建笔记，并归到当前查看的这一天";
  createBtn.addEventListener("click", () => {
    createReviewNoteForDay(reviewBrowserState.dayKey);
  });

  bar.append(left, createBtn);
  return bar;
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
    renderReviewBrowser();
  } catch (error) {
    console.error("新建到当天失败:", error);
  }
}

// 回顾浏览器激活时，支持左右键翻页
function handleReviewBrowserKeydown(event) {
  if (getActiveWorkspaceTab()?.type !== "review") {
    return;
  }
  if (
    event.target instanceof Element
    && event.target.closest("input, textarea, .cm-content")
  ) {
    return;
  }
  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
    return;
  }
  const dayMap = getReviewDayMap();
  const dayKeys = [...dayMap.keys()];
  const index = dayKeys.indexOf(reviewBrowserState.dayKey);
  if (index === -1) {
    return;
  }
  const nextIndex = event.key === "ArrowLeft" ? index - 1 : index + 1;
  if (nextIndex < 0 || nextIndex >= dayKeys.length) {
    return;
  }
  event.preventDefault();
  reviewBrowserState.dayKey = dayKeys[nextIndex];
  renderReviewBrowser();
}

// 数据变化后刷新（仅在回顾 tab 激活时）
function refreshReviewBrowserIfActive() {
  if (getActiveWorkspaceTab()?.type === "review") {
    renderReviewBrowser();
  }
}
