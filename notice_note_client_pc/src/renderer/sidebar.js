// 侧边栏：文件夹树、文件列表、日历、每日回顾、移动对话框
// 注意：本文件为经典脚本，顶层 const/let 处于页面全局词法环境，跨文件共享；请勿重复声明同名标识符。
function setSidebarCollapsed(isCollapsed) {
  sidebar.classList.toggle("is-collapsed", isCollapsed);
  const toggleText = isCollapsed ? "显示笔记列表" : "隐藏笔记列表";
  toggleSidebarButton.title = toggleText;
  toggleSidebarButton.setAttribute("aria-label", toggleText);
  showSidebarButton.title = "显示笔记列表";
  showSidebarButton.setAttribute("aria-label", "显示笔记列表");
  writeBooleanSetting(SIDEBAR_COLLAPSED_KEY, isCollapsed);
}
function setSidebarWidth(width) {
  const clamped = Math.max(
    SIDEBAR_MIN_WIDTH,
    Math.min(SIDEBAR_MAX_WIDTH, width),
  );
  sidebar.style.width = `${clamped}px`;
  localStorage.setItem(SIDEBAR_WIDTH_KEY, String(clamped));
}
function initSidebarResizer() {
  const savedWidth = Number(localStorage.getItem(SIDEBAR_WIDTH_KEY));
  if (
    Number.isFinite(savedWidth) &&
    savedWidth >= SIDEBAR_MIN_WIDTH &&
    savedWidth <= SIDEBAR_MAX_WIDTH
  ) {
    sidebar.style.width = `${savedWidth}px`;
  }

  let isResizing = false;
  let startX = 0;
  let startWidth = 0;

  sidebarResizer.addEventListener("mousedown", (e) => {
    if (sidebar.classList.contains("is-collapsed")) {
      return;
    }
    e.preventDefault();
    isResizing = true;
    startX = e.clientX;
    startWidth = sidebar.offsetWidth;
    sidebarResizer.classList.add("is-resizing");
    sidebar.style.transition = "none";
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  });

  document.addEventListener("mousemove", (e) => {
    if (!isResizing) {
      return;
    }
    const delta = e.clientX - startX;
    setSidebarWidth(startWidth + delta);
  });

  document.addEventListener("mouseup", () => {
    if (!isResizing) {
      return;
    }
    isResizing = false;
    sidebarResizer.classList.remove("is-resizing");
    sidebar.style.transition = "";
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  });
}
function getNoteSearchKeyword() {
  return noteSearchInput?.value.trim().toLocaleLowerCase("zh-CN") || "";
}
function clearNoteListSearch() {
  if (noteSearchInput) {
    noteSearchInput.value = "";
  }
}
function getSearchFolderIds() {
  const folderIds = new Set([activeFolderId]);
  const childrenByParent = new Map();
  for (const folder of folders) {
    if (folder.isReviewFolder) {
      continue;
    }
    const children = childrenByParent.get(folder.parentId) || [];
    children.push(folder.id);
    childrenByParent.set(folder.parentId, children);
  }
  const pendingFolderIds = [activeFolderId];
  while (pendingFolderIds.length > 0) {
    const parentId = pendingFolderIds.pop();
    for (const folderId of childrenByParent.get(parentId) || []) {
      if (!folderIds.has(folderId)) {
        folderIds.add(folderId);
        pendingFolderIds.push(folderId);
      }
    }
  }
  return folderIds;
}
function getFilteredNotes() {
  const keyword = getNoteSearchKeyword();
  const searchFolderIds = keyword && sidebarViewMode === "all"
    ? getSearchFolderIds()
    : null;
  const visibleNotes = sidebarViewMode === "reminder"
    ? notes.filter((note) => note.isReviewFile)
    : notes.filter((note) => !note.isReviewFile && (searchFolderIds
      ? searchFolderIds.has(note.folderId)
      : note.folderId === activeFolderId));
  if (!keyword) {
    return visibleNotes;
  }
  return visibleNotes.filter((note) =>
    includesNoteSearchKeyword(note.title, keyword)
    || includesNoteSearchKeyword(note.content, keyword),
  );
}
function getFilteredResources() {
  const keyword = getNoteSearchKeyword();
  const searchFolderIds = keyword && sidebarViewMode === "all"
    ? getSearchFolderIds()
    : null;
  const visibleResources = sidebarViewMode === "reminder"
    ? resourceFiles.filter((file) => file.isReviewFile)
    : resourceFiles.filter((file) => !file.isReviewFile && (searchFolderIds
      ? searchFolderIds.has(file.folderId)
      : file.folderId === activeFolderId));
  if (!keyword) {
    return visibleResources;
  }
  return visibleResources.filter((file) =>
    includesNoteSearchKeyword(file.name, keyword),
  );
}
function getCurrentFolders() {
  if (sidebarViewMode !== "all" || getNoteSearchKeyword()) {
    return [];
  }
  return folders.filter(
    (folder) => folder.parentId === activeFolderId && !folder.isReviewFolder,
  );
}
function getFolderNamePath(folderId, sourceFolders = folders) {
  const names = [];
  let current = folderId
    ? sourceFolders.find((folder) => folder.id === folderId)
    : null;
  while (current) {
    names.unshift(current.name);
    current = current.parentId
      ? sourceFolders.find((folder) => folder.id === current.parentId)
      : null;
  }
  return names;
}
function resolveFolderIdByNamePath(names, sourceFolders = folders) {
  let parentId = null;
  for (const name of names) {
    const folder = sourceFolders.find(
      (item) => item.parentId === parentId && item.name === name,
    );
    if (!folder) {
      return null;
    }
    parentId = folder.id;
  }
  return parentId;
}
function renderBreadcrumb() {
  breadcrumb.innerHTML = "";
  if (noteListSearch) {
    noteListSearch.hidden = sidebarViewMode === "calendar";
  }

  if (sidebarViewMode === "reminder") {
    const reminderBtn = document.createElement("button");
    reminderBtn.className = "breadcrumb-item breadcrumb-root active";
    reminderBtn.textContent = "回顾";
    reminderBtn.title = ".study_notice 文件夹中的回顾文件";
    const helpWrap = document.createElement("div");
    helpWrap.className = "daily-review-help-wrap";
    const helpButton = document.createElement("button");
    helpButton.className = "daily-review-help-button";
    helpButton.type = "button";
    helpButton.textContent = "?";
    helpButton.title = "查看回顾说明";
    helpButton.setAttribute("aria-label", "查看回顾说明");
    helpButton.setAttribute("aria-expanded", "false");
    const rules = document.createElement("section");
    rules.className = "daily-review-rules";
    rules.hidden = true;
    rules.innerHTML = `
      <strong>回顾说明</strong>
      <ol>
        <li>这里展示 .study_notice 回顾文件夹中的全部文件（含子文件夹），不在「全部」中显示。</li>
        <li>把文件放进 .study_notice 文件夹，即可加入回顾。</li>
        <li>每日自动回顾在周一至周五生效，“明天再看”的内容可延续到周末。</li>
        <li>仅选择回顾文件夹内、应用能够打开的内容。</li>
        <li>存在未完成提醒的文件不会参与今日回顾。</li>
        <li>提醒全部完成的当天会记作一次回顾时间，避免隔天重复推送。</li>
        <li>当天选择保持不变；完成回顾后记录时间，明天再看则下次优先。</li>
      </ol>
    `;
    helpButton.addEventListener("click", (event) => {
      event.stopPropagation();
      rules.hidden = !rules.hidden;
      helpButton.setAttribute("aria-expanded", String(!rules.hidden));
    });
    rules.addEventListener("click", (event) => event.stopPropagation());
    helpWrap.append(helpButton, rules);
    breadcrumb.append(reminderBtn, helpWrap);
    return;
  }
  if (sidebarViewMode === "calendar") {
    const calendarBtn = document.createElement("button");
    calendarBtn.className = "breadcrumb-item breadcrumb-root active";
    calendarBtn.textContent = "提醒日历";
    breadcrumb.append(calendarBtn);
    return;
  }

  const buildPath = (folderId) => {
    const path = [];
    let current = folderId ? folders.find((f) => f.id === folderId) : null;
    while (current) {
      path.unshift(current);
      current = current.parentId
        ? folders.find((f) => f.id === current.parentId)
        : null;
    }
    return path;
  };

  const makeBreadcrumbDropTarget = (element, targetFolderId) => {
    element.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      element.classList.add("drag-over");
    });
    element.addEventListener("dragleave", () => {
      element.classList.remove("drag-over");
    });
    element.addEventListener("drop", async (e) => {
      e.preventDefault();
      element.classList.remove("drag-over");
      const dragType = e.dataTransfer.getData("text/plain");
      if (dragType.startsWith("note:")) {
        const noteId = dragType.slice(5);
        await moveNoteToFolder(noteId, targetFolderId);
      }
    });
  };

  const rootBtn = document.createElement("button");
  rootBtn.className = `breadcrumb-item breadcrumb-root${activeFolderId === null ? " active" : ""}`;
  rootBtn.textContent = "全部文件";
  rootBtn.addEventListener("click", () => {
    openFolderWithAccessCheck(null).catch(console.error);
  });
  makeBreadcrumbDropTarget(rootBtn, null);
  breadcrumb.append(rootBtn);

  const path = buildPath(activeFolderId);
  for (const folder of path) {
    const btn = document.createElement("button");
    btn.className = `breadcrumb-item breadcrumb-child${folder.id === activeFolderId ? " active" : ""}`;
    btn.textContent = folder.name;
    btn.title = folder.name;
    btn.addEventListener("click", () => {
      openFolderWithAccessCheck(folder.id).catch(console.error);
    });
    makeBreadcrumbDropTarget(btn, folder.id);
    breadcrumb.append(btn);
  }
}
function getFolderNoteCount(folderId) {
  return (
    notes.filter((note) => note.folderId === folderId && !note.isReviewFile).length +
    resourceFiles.filter((file) => file.folderId === folderId && !file.isReviewFile).length
  );
}
function getChildFolderCount(folderId) {
  return folders.filter(
    (folder) => folder.parentId === folderId && !folder.isReviewFolder,
  ).length;
}
function getCalendarReminderEntries() {
  const reminderEntries = notes.flatMap((note) => {
    return (note.reminders || [])
      .map((reminder) => ({
        note,
        reminder,
        date: getReminderDateKey(reminder),
      }))
      .filter((entry) => entry.date);
  });
  const dailyReviewNote = notes.find((note) => note.isDailyReview);
  const dailyReviewFile = resourceFiles.find((file) => file.isDailyReview);
  if (dailyReviewNote || dailyReviewFile) {
    reminderEntries.push({
      note: dailyReviewNote || null,
      file: dailyReviewFile || null,
      reminder: null,
      date: toLocalDateKey(new Date()),
      isDailyReview: true,
    });
  }
  return reminderEntries;
}
function renderReminderCalendar() {
  const entries = getCalendarReminderEntries();
  const entriesByDate = new Map();
  for (const entry of entries) {
    const current = entriesByDate.get(entry.date) || [];
    current.push(entry);
    entriesByDate.set(entry.date, current);
  }

  const calendar = document.createElement("section");
  calendar.className = "reminder-calendar";
  const header = document.createElement("div");
  header.className = "reminder-calendar-header";
  const previousButton = document.createElement("button");
  previousButton.type = "button";
  previousButton.title = "上个月";
  previousButton.setAttribute("aria-label", "上个月");
  previousButton.textContent = "‹";
  const monthTitle = document.createElement("strong");
  monthTitle.textContent = `${reminderCalendarMonth.getFullYear()} 年 ${reminderCalendarMonth.getMonth() + 1} 月`;
  const nextButton = document.createElement("button");
  nextButton.type = "button";
  nextButton.title = "下个月";
  nextButton.setAttribute("aria-label", "下个月");
  nextButton.textContent = "›";
  previousButton.addEventListener("click", () => {
    reminderCalendarMonth = new Date(
      reminderCalendarMonth.getFullYear(),
      reminderCalendarMonth.getMonth() - 1,
      1,
    );
    selectedReminderDate = toLocalDateKey(reminderCalendarMonth);
    renderNoteList();
  });
  nextButton.addEventListener("click", () => {
    reminderCalendarMonth = new Date(
      reminderCalendarMonth.getFullYear(),
      reminderCalendarMonth.getMonth() + 1,
      1,
    );
    selectedReminderDate = toLocalDateKey(reminderCalendarMonth);
    renderNoteList();
  });
  header.append(previousButton, monthTitle, nextButton);

  const weekdays = document.createElement("div");
  weekdays.className = "reminder-calendar-weekdays";
  for (const weekday of ["一", "二", "三", "四", "五", "六", "日"]) {
    const label = document.createElement("span");
    label.textContent = weekday;
    weekdays.append(label);
  }

  const grid = document.createElement("div");
  grid.className = "reminder-calendar-grid";
  const year = reminderCalendarMonth.getFullYear();
  const month = reminderCalendarMonth.getMonth();
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayKey = toLocalDateKey(new Date());
  for (let index = 0; index < firstWeekday; index++) {
    const spacer = document.createElement("span");
    spacer.className = "reminder-calendar-spacer";
    grid.append(spacer);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    const dateKey = toLocalDateKey(date);
    const dateEntries = entriesByDate.get(dateKey) || [];
    const dayButton = document.createElement("button");
    dayButton.type = "button";
    dayButton.className = "reminder-calendar-day";
    dayButton.classList.toggle("is-today", dateKey === todayKey);
    dayButton.classList.toggle("is-selected", dateKey === selectedReminderDate);
    dayButton.classList.toggle("has-reminder", dateEntries.length > 0);
    dayButton.classList.toggle(
      "has-daily-review",
      dateEntries.some((entry) => entry.isDailyReview),
    );
    dayButton.setAttribute(
      "aria-label",
      `${month + 1} 月 ${day} 日，${dateEntries.length} 项安排`,
    );
    const dayNumber = document.createElement("span");
    dayNumber.textContent = String(day);
    dayButton.append(dayNumber);
    if (dateEntries.length > 0) {
      const count = document.createElement("small");
      count.textContent = String(dateEntries.length);
      dayButton.append(count);
    }
    dayButton.addEventListener("click", () => {
      selectedReminderDate = dateKey;
      renderNoteList();
    });
    grid.append(dayButton);
  }

  const todayButton = document.createElement("button");
  todayButton.className = "reminder-calendar-today";
  todayButton.type = "button";
  todayButton.textContent = "回到今天";
  todayButton.addEventListener("click", () => {
    const today = new Date();
    reminderCalendarMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    selectedReminderDate = toLocalDateKey(today);
    renderNoteList();
  });
  calendar.append(header, weekdays, grid, todayButton);
  noteList.append(calendar);

  const selectedEntries = entriesByDate.get(selectedReminderDate) || [];
  const details = document.createElement("section");
  details.className = "reminder-calendar-details";
  const detailsTitle = document.createElement("h3");
  const selectedDate = parseReminderDate(selectedReminderDate);
  detailsTitle.textContent = selectedDate
    ? `${selectedDate.getMonth() + 1} 月 ${selectedDate.getDate()} 日的安排`
    : "日历详情";
  details.append(detailsTitle);

  if (selectedEntries.length === 0) {
    const empty = document.createElement("p");
    empty.className = "reminder-calendar-empty";
    empty.textContent = "当天没有提醒或回顾";
    details.append(empty);
  } else {
    for (const { note, file, reminder, isDailyReview } of selectedEntries) {
      const resource = note || file;
      const item = document.createElement("button");
      item.className = `reminder-calendar-entry${isDailyReview ? " is-daily-review" : ""}`;
      item.type = "button";
      const title = document.createElement("strong");
      title.textContent = note?.title || file?.name || "未命名文件";
      const folderPath = document.createElement("span");
      const pathParts = getFolderNamePath(resource?.folderId);
      folderPath.textContent =
        pathParts.length > 0 ? pathParts.join(" / ") : "根目录";
      const meta = document.createElement("span");
      if (isDailyReview) {
        meta.className = "daily-review-calendar-meta";
        meta.textContent = "今日回顾 · 回忆以前内容";
      } else {
        meta.className = reminder.done ? "is-done" : "";
        const reminderTimes = DAILY_REMINDER_SLOTS.join("、");
        meta.textContent = reminder.done
          ? `${reminderTimes} · 已完成`
          : `${reminderTimes} · 待提醒`;
      }
      item.append(title, folderPath, meta);
      item.addEventListener("click", () => {
        const openPromise = note
          ? selectNote(note.id)
          : selectResourceFile(file.id);
        openPromise.catch(console.error);
      });
      details.append(item);
    }
  }
  noteList.append(details);
}
function createDailyReviewLastTime(target) {
  const lastTime = document.createElement("span");
  lastTime.className = "daily-review-last-time";
  lastTime.textContent = target.dailyReviewLastReviewedAt
    ? `上次回顾：${formatListDateTime(target.dailyReviewLastReviewedAt)}`
    : "上次回顾：尚未完成";
  return lastTime;
}
// 回顾 Tab：卡片式展示回顾文件夹中的文件
function renderReviewCards(filteredNotes, filteredResources, searchKeyword) {
  const grid = document.createElement("div");
  grid.className = "review-card-grid";

  const pendingCountOf = (note) =>
    (note.reminders || []).filter((reminder) => !reminder.done).length;
  const nextReminderOf = (note) =>
    (note.reminders || [])
      .filter((reminder) => !reminder.done)
      .map((reminder) => getReminderDateKey(reminder))
      .filter(Boolean)
      .sort()[0] || null;

  const orderedNotes = [...filteredNotes].sort((a, b) => {
    const reviewDiff =
      Number(Boolean(b.isDailyReview)) - Number(Boolean(a.isDailyReview));
    if (reviewDiff !== 0) {
      return reviewDiff;
    }
    return Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
  });

  for (const note of orderedNotes) {
    const card = document.createElement("button");
    card.type = "button";
    card.className = `review-card${note.isDailyReview ? " is-daily-review" : ""}`;
    card.dataset.noteId = note.id;

    const head = document.createElement("div");
    head.className = "review-card-head";

    const title = document.createElement("strong");
    title.className = "review-card-title";
    title.textContent = note.title || "未命名笔记";
    title.title = title.textContent;

    const typeBadge = document.createElement("span");
    typeBadge.className = `file-type-badge ${note.fileType}`;
    typeBadge.textContent = note.fileType.toUpperCase();

    head.append(title, typeBadge);

    const preview = document.createElement("p");
    preview.className = "review-card-preview";
    const plainContent = String(note.content || "")
      .replace(/!\[[^\]]*\]\([^)]+\)/g, " ")
      .replace(/[#*`>]/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (searchKeyword && !includesNoteSearchKeyword(note.title, searchKeyword)) {
      const matched = createNoteSearchPreview(note.content, searchKeyword);
      preview.textContent = matched || plainContent.slice(0, 90) || "（空笔记）";
    } else {
      preview.textContent = plainContent.slice(0, 90) || "（空笔记）";
    }

    const badges = document.createElement("div");
    badges.className = "review-card-badges";
    if (note.isDailyReview) {
      const badge = document.createElement("span");
      badge.className = "daily-review-badge";
      badge.textContent = "今日回顾";
      badge.title = "今天选中的每日回顾内容";
      badges.append(badge);
    }
    if (hasTodayPendingReminder(note)) {
      const badge = document.createElement("span");
      badge.className = "today-reminder-badge";
      badge.textContent = "今日提醒";
      badge.title = "今天有提醒";
      badges.append(badge);
    }
    const pending = pendingCountOf(note);
    if (pending > 0) {
      const badge = document.createElement("span");
      badge.className = "review-card-pending";
      const nextDate = nextReminderOf(note);
      badge.textContent = nextDate ? `待提醒 ${nextDate}` : `${pending} 个提醒未完成`;
      badge.title = nextDate ? `下一个提醒：${nextDate}` : `${pending} 个提醒未完成`;
      badges.append(badge);
    }

    const foot = document.createElement("div");
    foot.className = "review-card-foot";
    const time = document.createElement("span");
    time.textContent = `修改 ${formatListDateTime(note.updatedAt)}`;
    foot.append(time);
    if (note.dailyReviewLastReviewedAt) {
      const lastTime = document.createElement("span");
      lastTime.className = "review-card-last-time";
      lastTime.textContent = `上次回顾 ${formatListDateTime(note.dailyReviewLastReviewedAt)}`;
      lastTime.title = `上次回顾：${formatListDateTime(note.dailyReviewLastReviewedAt)}`;
      foot.append(lastTime);
    }

    card.append(head, preview);
    if (badges.childElementCount > 0) {
      card.append(badges);
    }
    card.append(foot);
    card.addEventListener("click", () => {
      selectNote(note.id).catch(console.error);
    });
    grid.append(card);
  }

  for (const file of filteredResources) {
    const card = document.createElement("button");
    card.type = "button";
    card.className = `review-card review-card-resource ${file.kind}${file.canOpen ? "" : " is-unopenable"}`;
    card.dataset.fileId = file.id;
    if (!file.canOpen) {
      card.disabled = true;
      card.title = "该文件类型仅支持在列表中查看";
    }

    const head = document.createElement("div");
    head.className = "review-card-head";
    const title = document.createElement("strong");
    title.className = "review-card-title";
    title.textContent = file.name;
    title.title = file.name;
    const typeBadge = document.createElement("span");
    typeBadge.className = `file-type-badge ${file.kind}`;
    typeBadge.textContent = file.typeLabel;
    head.append(title, typeBadge);

    const preview = document.createElement("p");
    preview.className = "review-card-preview";
    preview.textContent = `${formatFileSize(file.size)} · 修改 ${formatListDateTime(file.updatedAt)}`;

    card.append(head, preview);
    if (file.canOpen) {
      card.addEventListener("click", () => {
        selectResourceFile(file.id).catch(console.error);
      });
    }
    grid.append(card);
  }

  if (grid.childElementCount === 0) {
    const empty = document.createElement("p");
    empty.className = "note-list-empty";
    empty.textContent = searchKeyword
      ? "没有找到标题或正文匹配的回顾内容"
      : "回顾文件夹还是空的，把文件放进 .study_notice 文件夹即可在这里看到";
    noteList.append(empty);
    return;
  }

  noteList.append(grid);
}
function renderNoteList() {
  if (!noteList) {
    return;
  }

  const searchKeyword = getNoteSearchKeyword();
  const currentFolders = getCurrentFolders();
  const filteredNotes = getFilteredNotes();
  const filteredResources = getFilteredResources();

  noteList.innerHTML = "";

  if (sidebarViewMode === "calendar") {
    renderReminderCalendar();
    return;
  }

  if (sidebarViewMode === "reminder") {
    renderReviewCards(filteredNotes, filteredResources, searchKeyword);
    return;
  }

  if (
    searchKeyword
    && filteredNotes.length === 0
    && filteredResources.length === 0
  ) {
    const empty = document.createElement("p");
    empty.className = "note-list-empty";
    empty.textContent = "没有找到标题或正文匹配的内容";
    noteList.append(empty);
    return;
  }

  if (
    sidebarViewMode === "all" &&
    currentFolders.length === 0
    && filteredNotes.length === 0
    && filteredResources.length === 0
  ) {
    const empty = document.createElement("p");
    empty.className = "note-list-empty";
    empty.textContent = "当前目录还是空的，可点击左上角 + 新建内容";
    noteList.append(empty);
    return;
  }

  for (const folder of currentFolders) {
    const item = document.createElement("div");
    item.className = "note-item folder-item";
    item.dataset.folderId = folder.id;
    item.setAttribute("role", "button");
    item.tabIndex = 0;
    item.setAttribute("aria-label", `打开文件夹 ${folder.name}`);

    // Drop target: accept notes/folders dragged into this folder
    item.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      item.classList.add("drag-over");
    });
    item.addEventListener("dragleave", () => {
      item.classList.remove("drag-over");
    });
    item.addEventListener("drop", async (e) => {
      e.preventDefault();
      item.classList.remove("drag-over");
      const dragType = e.dataTransfer.getData("text/plain");
      if (dragType.startsWith("note:")) {
        const noteId = dragType.slice(5);
        await moveNoteToFolder(noteId, folder.id);
      } else if (dragType.startsWith("folder:")) {
        const folderId = dragType.slice(7);
        if (folderId !== folder.id) {
          await moveFolderToFolder(folderId, folder.id);
        }
      }
    });

    const dragHandle = document.createElement("span");
    dragHandle.className = "note-drag-handle";
    dragHandle.textContent = "⋮⋮";
    dragHandle.title = "拖动文件夹到其他文件夹";
    dragHandle.setAttribute("aria-label", "拖动文件夹到其他文件夹");
    dragHandle.draggable = true;
    dragHandle.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("text/plain", `folder:${folder.id}`);
      e.dataTransfer.effectAllowed = "move";
      item.classList.add("dragging");
    });
    dragHandle.addEventListener("dragend", () => {
      item.classList.remove("dragging");
    });

    const icon = document.createElement("span");
    icon.className = "folder-icon";
    icon.innerHTML =
      '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M1.5 2.5h4.3l1.5-1h6.7a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1h-13a1 1 0 0 1-1-1v-10a1 1 0 0 1 1-1z" fill="#e8a849" stroke="#c48a30" stroke-width="0.8"/><path d="M1.5 6h13" stroke="#c48a30" stroke-width="0.6"/></svg>';
    if (folder.isProtected) {
      const lockBadge = document.createElement("span");
      lockBadge.className = `folder-lock-badge${folder.isUnlocked ? " is-unlocked" : ""}`;
      lockBadge.title = folder.isUnlocked
        ? "当前会话已解锁"
        : "进入前需要输入密码";
      if (folder.isUnlocked) {
        lockBadge.innerHTML =
          '<svg width="10" height="10" viewBox="0 0 16 16" fill="none"><rect x="3" y="7" width="10" height="7" rx="1.2" stroke="currentColor" stroke-width="1.5"/><path d="M5 7V5a3 3 0 0 1 5.5-1.6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" fill="none"/></svg>';
      } else {
        lockBadge.innerHTML =
          '<svg width="10" height="10" viewBox="0 0 16 16" fill="none"><rect x="3" y="7" width="10" height="7" rx="1.2" stroke="currentColor" stroke-width="1.5"/><path d="M5 7V5a3 3 0 0 1 6 0v2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" fill="none"/></svg>';
      }
      icon.append(lockBadge);
    }

    const name = document.createElement("span");
    name.className = "folder-name";
    name.textContent = folder.name;

    const counts = document.createElement("span");
    counts.className = "folder-counts";

    const folderCount = document.createElement("span");
    folderCount.className = "folder-count folder-count-folders";
    folderCount.textContent = `夹 ${getChildFolderCount(folder.id)}`;
    folderCount.title = "子文件夹数量";

    const fileCount = document.createElement("span");
    fileCount.className = "folder-count folder-count-files";
    fileCount.textContent = `文 ${getFolderNoteCount(folder.id)}`;
    fileCount.title = "文件数量";
    counts.append(folderCount, fileCount);

    const actions = document.createElement("span");
    actions.className = "folder-actions";

    const renameBtn = document.createElement("button");
    renameBtn.className = "folder-action-btn";
    renameBtn.type = "button";
    renameBtn.title = "重命名";
    renameBtn.innerHTML =
      '<svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M11.5 1.5l3 3-9 9H2.5v-3l9-9z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>';
    renameBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      renameFolder(folder.id, folder.name);
    });

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "folder-action-btn folder-action-danger";
    deleteBtn.type = "button";
    deleteBtn.title = "删除";
    deleteBtn.innerHTML =
      '<svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M2 4h12M5.3 4V2.5a1 1 0 0 1 1-1h3.4a1 1 0 0 1 1 1V4M6.5 7.5v5M9.5 7.5v5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/><path d="M3.5 4l.8 9.5a1 1 0 0 0 1 .9h5.4a1 1 0 0 0 1-.9L12.5 4" stroke="currentColor" stroke-width="1.2"/></svg>';
    deleteBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      deleteFolder(folder.id);
    });

    actions.append(renameBtn, deleteBtn);
    const folderMeta = document.createElement("span");
    folderMeta.className = "folder-meta";
    folderMeta.append(counts, actions);
    item.append(dragHandle, icon, name, folderMeta);
    const openFolder = () => {
      openFolderWithAccessCheck(folder.id).catch(console.error);
    };
    item.addEventListener("click", (event) => {
      if (event.target.closest(".folder-action-btn, .note-drag-handle")) {
        return;
      }
      openFolder();
    });
    item.addEventListener("keydown", (event) => {
      if (
        event.target === item &&
        (event.key === "Enter" || event.key === " ")
      ) {
        event.preventDefault();
        openFolderWithAccessCheck(folder.id).catch(console.error);
      }
    });
    noteList.append(item);
  }

  const orderedNotes = sortNotes(filteredNotes).sort((a, b) => {
    return Number(Boolean(b.isDailyReview)) - Number(Boolean(a.isDailyReview));
  });
  for (const note of orderedNotes) {
    const item = document.createElement("button");
    const isActiveNote =
      !activePdfId && !activeResourceId && note.id === activeNoteId;
    item.className = `note-item${isActiveNote ? " active" : ""}`;
    item.type = "button";
    item.dataset.noteId = note.id;
    if (isActiveNote) {
      item.setAttribute("aria-current", "page");
    }
    const dragHandle = document.createElement("span");
    dragHandle.className = "note-drag-handle";
    dragHandle.textContent = "⋮⋮";
    dragHandle.title = "拖动笔记到其他文件夹";
    dragHandle.setAttribute("aria-label", "拖动笔记到其他文件夹");
    dragHandle.draggable = true;
    dragHandle.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("text/plain", `note:${note.id}`);
      e.dataTransfer.effectAllowed = "move";
      item.classList.add("dragging");
    });
    dragHandle.addEventListener("dragend", () => {
      item.classList.remove("dragging");
    });

    const titleRow = document.createElement("div");
    titleRow.className = "note-title-row";

    const title = document.createElement("strong");
    title.textContent = note.title || "未命名笔记";
    title.title = title.textContent;
    titleRow.append(dragHandle, title);
    const badgeRow = document.createElement("div");
    badgeRow.className = "note-badge-row";

    if (hasTodayPendingReminder(note)) {
      const todayBadge = document.createElement("span");
      todayBadge.className = "today-reminder-badge";
      todayBadge.textContent = "今日";
      todayBadge.title = "今天有提醒";
      badgeRow.append(todayBadge);
    }

    if (note.isDailyReview) {
      const dailyReviewBadge = document.createElement("span");
      dailyReviewBadge.className = "daily-review-badge";
      dailyReviewBadge.textContent = "今日回顾";
      dailyReviewBadge.title = "今天选中的每日回顾内容";
      badgeRow.append(dailyReviewBadge);
    }

    if (isActiveNote) {
      const currentMarker = document.createElement("span");
      currentMarker.className = "note-current-marker";
      currentMarker.textContent = "正在查看";
      currentMarker.title = "当前打开的文件";
      badgeRow.append(currentMarker);
    }

    const textBadge = document.createElement("span");
    textBadge.className = `file-type-badge ${note.fileType}`;
    textBadge.textContent = note.fileType.toUpperCase();
    titleRow.append(textBadge);

    item.append(titleRow);
    if (badgeRow.childElementCount > 0) {
      item.append(badgeRow);
    }

    if (sidebarViewMode === "reminder" || searchKeyword) {
      const folderPath = document.createElement("div");
      folderPath.className = "reminder-file-path";
      const pathParts = getFolderNamePath(note.folderId);
      folderPath.textContent =
        pathParts.length > 0 ? pathParts.join(" / ") : "根目录";
      folderPath.title = folderPath.textContent;
      item.append(folderPath);
    }

    if (
      searchKeyword
      && !includesNoteSearchKeyword(note.title, searchKeyword)
    ) {
      const previewText = createNoteSearchPreview(note.content, searchKeyword);
      if (previewText) {
        const preview = document.createElement("div");
        preview.className = "note-search-preview";
        preview.textContent = previewText;
        item.append(preview);
      }
    }

    const timeMeta = document.createElement("div");
    timeMeta.className = "note-time-meta";
    timeMeta.innerHTML = `
      <span class="note-meta-line">
        <span class="note-meta-label">创建</span>
        <span class="note-meta-value">${formatListDateTime(note.createdAt)}</span>
      </span>
      <span class="note-meta-line">
        <span class="note-meta-label">修改</span>
        <span class="note-meta-value">${formatListDateTime(note.updatedAt)}</span>
      </span>
    `;
    item.append(timeMeta);

    const openNote = () => selectNote(note.id).catch(console.error);
    item.addEventListener("click", (event) => {
      if (event.target.closest(".note-drag-handle")) {
        return;
      }
      openNote();
    });
    noteList.append(item);
  }

  const orderedResources = [...filteredResources].sort((a, b) => {
    return Number(Boolean(b.isDailyReview)) - Number(Boolean(a.isDailyReview));
  });
  for (const file of orderedResources) {
    const item = document.createElement("button");
    const isActive =
      file.kind === "pdf"
        ? file.id === activePdfId
        : file.id === activeResourceId;
    item.className = `note-item resource-item ${file.kind}${isActive ? " active" : ""}${file.canOpen ? "" : " is-unopenable"}`;
    item.type = "button";
    item.dataset.fileId = file.id;
    if (file.canOpen) {
      const openResource = () =>
        selectResourceFile(file.id).catch(console.error);
      item.addEventListener("click", openResource);
    } else {
      item.title = "该文件类型仅支持在列表中查看";
    }

    const titleRow = document.createElement("div");
    titleRow.className = "note-title-row";

    const title = document.createElement("strong");
    title.textContent = file.name;
    title.title = file.name;
    const badgeRow = document.createElement("div");
    badgeRow.className = "note-badge-row";

    const badge = document.createElement("span");
    badge.className = `file-type-badge ${file.kind}`;
    badge.textContent = file.typeLabel;

    const meta = document.createElement("span");
    meta.className = "note-time-meta";
    meta.textContent = `${formatFileSize(file.size)} · 修改：${formatListDateTime(file.updatedAt)}`;

    titleRow.append(title);
    if (file.isDailyReview) {
      const dailyReviewBadge = document.createElement("span");
      dailyReviewBadge.className = "daily-review-badge";
      dailyReviewBadge.textContent = "今日回顾";
      dailyReviewBadge.title = "今天选中的每日回顾内容";
      badgeRow.append(dailyReviewBadge);
    }
    titleRow.append(badge);
    item.append(titleRow);
    if (badgeRow.childElementCount > 0) {
      item.append(badgeRow);
    }
    if (searchKeyword) {
      const folderPath = document.createElement("div");
      folderPath.className = "reminder-file-path";
      const pathParts = getFolderNamePath(file.folderId);
      folderPath.textContent =
        pathParts.length > 0 ? pathParts.join(" / ") : "根目录";
      folderPath.title = folderPath.textContent;
      item.append(folderPath);
    }
    item.append(meta);
    noteList.append(item);
  }
}
function selectFolder(folderId) {
  clearNoteListSearch();
  sidebarViewMode = "all";
  showAllFilesButton.classList.add("is-active");
  showReminderCalendarButton.classList.remove("is-active");
  showDailyReviewButton.classList.remove("is-active");
  activeFolderId = folderId;
  renderBreadcrumb();
  renderNoteList();
}
function getFolderAncestorIds(folderId) {
  const ancestors = new Set();
  let current = folderId ? folders.find((f) => f.id === folderId) : null;
  while (current) {
    ancestors.add(current.id);
    current = current.parentId
      ? folders.find((f) => f.id === current.parentId)
      : null;
  }
  return ancestors;
}
async function relockFoldersOnNavigate(targetFolderId) {
  if (targetFolderId === activeFolderId) {
    return;
  }
  const ancestors = getFolderAncestorIds(targetFolderId);
  const toLock = folders.filter(
    (f) => f.isProtected && f.isUnlocked && !ancestors.has(f.id),
  );
  if (toLock.length === 0) {
    return;
  }
  for (const f of toLock) {
    f.isUnlocked = false;
    await window.noticeNote.lockFolder(f.id);
  }
}
async function openFolderWithAccessCheck(folderId) {
  await relockFoldersOnNavigate(folderId);
  if (folderId) {
    const unlocked = await promptUnlockFolder(folderId);
    if (!unlocked) {
      return;
    }
  }
  selectFolder(folderId);
}
function setSidebarViewMode(mode, shouldRender = true) {
  clearNoteListSearch();
  sidebarViewMode = ["calendar", "reminder"].includes(mode) ? mode : "all";
  showAllFilesButton.classList.toggle("is-active", sidebarViewMode === "all");
  showReminderCalendarButton.classList.toggle(
    "is-active",
    sidebarViewMode === "calendar",
  );
  showDailyReviewButton.classList.toggle(
    "is-active",
    sidebarViewMode === "reminder",
  );
  if (shouldRender) {
    renderBreadcrumb();
    renderNoteList();
  }
}
async function moveNoteToFolder(noteId, folderId) {
  try {
    await window.noticeNote.moveNote(noteId, folderId);
  } catch (error) {
    console.error("移动笔记失败:", error);
    alert(error.message || "移动笔记失败");
  }
}
async function moveFolderToFolder(folderId, targetFolderId) {
  try {
    await window.noticeNote.moveFolder(folderId, targetFolderId);
  } catch (error) {
    console.error("移动文件夹失败:", error);
    alert(error.message || "移动文件夹失败");
  }
}
async function moveResourceToFolder(fileId, folderId) {
  try {
    resourceFiles = await window.noticeNote.moveFile(fileId, folderId);
    pdfFiles = resourceFiles.filter((file) => file.kind === "pdf");
    if (!reconcileWorkspaceTabs()) {
      renderNoteList();
    }
  } catch (error) {
    console.error("移动文件失败:", error);
    alert(error.message || "移动文件失败");
  }
}
function getInvalidMoveFolderIds(entry) {
  const invalidIds = new Set();
  if (entry.type !== "folder") {
    return invalidIds;
  }

  invalidIds.add(entry.id);
  let changed = true;
  while (changed) {
    changed = false;
    for (const folder of folders) {
      if (
        folder.parentId &&
        invalidIds.has(folder.parentId) &&
        !invalidIds.has(folder.id)
      ) {
        invalidIds.add(folder.id);
        changed = true;
      }
    }
  }
  return invalidIds;
}
function getMoveEntryFolderId(entry) {
  if (entry.type === "note") {
    return notes.find((note) => note.id === entry.id)?.folderId || null;
  }
  if (entry.type === "file") {
    return resourceFiles.find((file) => file.id === entry.id)?.folderId || null;
  }
  return folders.find((folder) => folder.id === entry.id)?.parentId || null;
}
function getMoveEntryName(entry) {
  if (entry.type === "note") {
    return notes.find((note) => note.id === entry.id)?.title || "未命名笔记";
  }
  if (entry.type === "file") {
    return (
      resourceFiles.find((file) => file.id === entry.id)?.name || "未命名文件"
    );
  }
  return (
    folders.find((folder) => folder.id === entry.id)?.name || "未命名文件夹"
  );
}
function showMoveToFolderDialog(entry) {
  return new Promise((resolve) => {
    const dialog = document.createElement("div");
    dialog.className = "folder-dialog";
    const content = document.createElement("div");
    content.className = "folder-dialog-content move-folder-dialog-content";
    const label = document.createElement("label");
    label.textContent = `移动「${getMoveEntryName(entry)}」到`;
    const browser = document.createElement("div");
    browser.className = "move-folder-browser";
    const pathBar = document.createElement("div");
    pathBar.className = "move-folder-path";
    const folderList = document.createElement("div");
    folderList.className = "move-folder-list";
    browser.append(pathBar, folderList);
    const invalidIds = getInvalidMoveFolderIds(entry);
    let currentFolderId = null;

    const getFolderPath = (folderId) => {
      const path = [];
      let current = folderId
        ? folders.find((folder) => folder.id === folderId)
        : null;
      while (current) {
        path.unshift(current);
        current = current.parentId
          ? folders.find((folder) => folder.id === current.parentId)
          : null;
      }
      return path;
    };

    const renderBrowser = () => {
      pathBar.innerHTML = "";
      const rootButton = document.createElement("button");
      rootButton.type = "button";
      rootButton.textContent = "全部笔记";
      rootButton.addEventListener("click", () => {
        currentFolderId = null;
        renderBrowser();
      });
      pathBar.append(rootButton);

      for (const folder of getFolderPath(currentFolderId)) {
        const separator = document.createElement("span");
        separator.textContent = "›";
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = folder.name;
        button.addEventListener("click", () => {
          currentFolderId = folder.id;
          renderBrowser();
        });
        pathBar.append(separator, button);
      }

      folderList.innerHTML = "";
      const children = folders
        .filter((folder) => folder.parentId === currentFolderId)
        .sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));
      if (children.length === 0) {
        const empty = document.createElement("div");
        empty.className = "move-folder-empty";
        empty.textContent = "此目录下没有子文件夹";
        folderList.append(empty);
        return;
      }

      for (const folder of children) {
        const button = document.createElement("button");
        button.className = "move-folder-item";
        button.type = "button";
        button.disabled = invalidIds.has(folder.id);
        const icon = document.createElement("span");
        icon.className = "move-folder-icon";
        icon.textContent = "▸";
        const name = document.createElement("span");
        name.textContent = folder.name;
        button.append(icon, name);
        button.addEventListener("click", () => {
          currentFolderId = folder.id;
          renderBrowser();
        });
        folderList.append(button);
      }
    };
    renderBrowser();

    const actions = document.createElement("div");
    actions.className = "folder-dialog-actions";
    const cancelButton = document.createElement("button");
    cancelButton.className = "secondary-button";
    cancelButton.type = "button";
    cancelButton.textContent = "取消";
    const confirmButton = document.createElement("button");
    confirmButton.className = "primary-button";
    confirmButton.type = "button";
    confirmButton.textContent = "移动到此处";
    actions.append(cancelButton, confirmButton);
    content.append(label, browser, actions);
    dialog.append(content);
    document.body.append(dialog);
    folderList.querySelector("button:not(:disabled)")?.focus();

    const close = (folderId) => {
      dialog.remove();
      resolve(folderId);
    };
    cancelButton.addEventListener("click", () => close(undefined));
    confirmButton.addEventListener("click", () => close(currentFolderId));
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) {
        close(undefined);
      }
    });
    dialog.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        close(undefined);
      }
    });
  });
}
async function moveEntryToFolder(entry) {
  const targetFolderId = await showMoveToFolderDialog(entry);
  if (
    targetFolderId === undefined ||
    targetFolderId === getMoveEntryFolderId(entry)
  ) {
    return;
  }

  await flushPendingSave();
  if (entry.type === "note") {
    await moveNoteToFolder(entry.id, targetFolderId);
  } else if (entry.type === "folder") {
    await moveFolderToFolder(entry.id, targetFolderId);
  } else if (entry.type === "file") {
    await moveResourceToFolder(entry.id, targetFolderId);
  }
}
async function createFolder() {
  const name = await showFolderNameDialog();
  if (!name) return;

  try {
    await window.noticeNote.createFolder(name, activeFolderId);
  } catch (error) {
    console.error("创建文件夹失败:", error);
    alert(error.message || "创建文件夹失败");
  }
}
function showFolderNameDialog(defaultName) {
  return new Promise((resolve) => {
    const dialog = document.createElement("div");
    dialog.className = "folder-dialog";
    dialog.innerHTML = `
      <div class="folder-dialog-content">
        <label>文件夹名称</label>
        <input type="text" id="folderNameInput" placeholder="新建文件夹" autofocus>
        <div class="folder-dialog-actions">
          <button class="secondary-button" id="folderDialogCancel">取消</button>
          <button class="primary-button" id="folderDialogConfirm">确定</button>
        </div>
      </div>
    `;
    document.body.append(dialog);

    const input = dialog.querySelector("#folderNameInput");
    const cancelBtn = dialog.querySelector("#folderDialogCancel");
    const confirmBtn = dialog.querySelector("#folderDialogConfirm");

    if (defaultName) {
      input.value = defaultName;
    }
    input.focus();
    input.select();

    const close = (value) => {
      dialog.remove();
      resolve(value);
    };

    cancelBtn.addEventListener("click", () => close(null));
    confirmBtn.addEventListener("click", () => close(input.value.trim()));
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") close(input.value.trim());
      if (e.key === "Escape") close(null);
    });
  });
}
function showFolderPasswordDialog(title, confirmLabel = "确定") {
  return new Promise((resolve) => {
    const dialog = document.createElement("dialog");
    dialog.className = "folder-dialog folder-password-dialog";
    const content = document.createElement("div");
    content.className = "folder-dialog-content";
    const label = document.createElement("label");
    label.textContent = title;
    const input = document.createElement("input");
    input.type = "password";
    input.placeholder = "输入密码";
    input.autocomplete = "current-password";
    const actions = document.createElement("div");
    actions.className = "folder-dialog-actions";
    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "secondary-button";
    cancelBtn.textContent = "取消";
    const confirmBtn = document.createElement("button");
    confirmBtn.type = "button";
    confirmBtn.className = "primary-button";
    confirmBtn.textContent = confirmLabel;
    actions.append(cancelBtn, confirmBtn);
    content.append(label, input, actions);
    dialog.append(content);
    document.body.append(dialog);
    dialog.showModal();

    input.focus();

    const close = (value) => {
      dialog.close();
      dialog.remove();
      resolve(value);
    };

    dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      close(null);
    });
    cancelBtn.addEventListener("click", () => close(null));
    confirmBtn.addEventListener("click", () => close(input.value));
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        close(input.value);
      }
      if (event.key === "Escape") {
        close(null);
      }
    });
  });
}
async function promptUnlockFolder(folderId) {
  const folder = folders.find((item) => item.id === folderId);
  if (!folder?.isProtected || folder.isUnlocked) {
    return true;
  }

  const password = await showFolderPasswordDialog(
    `输入「${folder.name}」的访问密码`,
    "解锁",
  );
  if (!password) {
    return false;
  }

  try {
    await window.noticeNote.unlockFolder(folderId, password);
    await refreshNotes();
    return true;
  } catch (error) {
    alert(error.message || "密码不正确");
    return false;
  }
}
async function setFolderPasswordForFolder(folderId) {
  const folder = folders.find((item) => item.id === folderId);
  if (!folder) {
    return;
  }
  let currentPassword = "";
  if (folder.isProtected) {
    currentPassword = await showFolderPasswordDialog(
      `输入「${folder.name}」的当前密码`,
      "下一步",
    );
    if (!currentPassword) {
      return;
    }
  }
  const password = await showFolderPasswordDialog(
    `为「${folder.name}」设置访问密码`,
    folder.isProtected ? "更新密码" : "设置密码",
  );
  if (!password) {
    return;
  }
  try {
    await window.noticeNote.setFolderPassword(
      folderId,
      password,
      currentPassword,
    );
    await refreshNotes();
  } catch (error) {
    alert(error.message || "设置密码失败");
  }
}
async function clearFolderPasswordForFolder(folderId) {
  const folder = folders.find((item) => item.id === folderId);
  if (!folder) {
    return;
  }
  const currentPassword = await showFolderPasswordDialog(
    `输入「${folder.name}」的当前密码以清除保护`,
    "清除密码",
  );
  if (!currentPassword) {
    return;
  }
  if (!confirm(`确定清除文件夹「${folder.name}」的访问密码吗？`)) {
    return;
  }
  try {
    await window.noticeNote.clearFolderPassword(folderId, currentPassword);
    await refreshNotes();
  } catch (error) {
    alert(error.message || "清除密码失败");
  }
}
async function deleteFolder(folderId) {
  const folder = folders.find((f) => f.id === folderId);
  if (!folder) return;

  const noteCount = getFolderNoteCount(folderId);
  const message =
    noteCount > 0
      ? `确定将文件夹「${folder.name}」移到回收站吗？该文件夹下有 ${noteCount} 个笔记，将会一起移动。`
      : `确定将文件夹「${folder.name}」移到回收站吗？`;

  if (!confirm(message)) return;

  try {
    await window.noticeNote.deleteFolder(folderId);
    if (activeFolderId === folderId) {
      activeFolderId = null;
      renderBreadcrumb();
      renderNoteList();
    }
  } catch (error) {
    console.error("删除文件夹失败:", error);
    alert(error.message || "删除文件夹失败");
  }
}
async function renameFolder(folderId, currentName) {
  const newName = await showFolderNameDialog(currentName);
  if (!newName || newName === currentName) return;

  try {
    await window.noticeNote.renameFolder(folderId, newName);
  } catch (error) {
    console.error("重命名文件夹失败:", error);
    alert(error.message || "重命名文件夹失败");
  }
}
