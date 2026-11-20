// 记忆卡视图：SM-2 间隔重复的界面与交互。
// 调度全部在主进程（ipc/memory-cards.js → main.js → lib/sm2-scheduler.js），
// 渲染层只负责展示快照和把评分回传，保证「界面看到的间隔」和「真正落盘的间隔」同源。
//
// 数据文件：notesPath/.memory_card/cards.json 与 settings.json。

const MEMORY_STATE_LABELS = {
  new: "新卡",
  learning: "学习中",
  review: "复习",
  relearning: "重学"
};

const MEMORY_RATING_KEYS = {
  "1": "again",
  "2": "hard",
  "3": "good",
  "4": "easy"
};

const MEMORY_RATING_LABELS = {
  again: "重来",
  hard: "困难",
  good: "良好",
  easy: "简单"
};

// AI 判定是否可用：快照里由主进程带上（key 配置好了才算）。
// 不可用时整条作答链路收起，退回原来的手动四档，保证断网也能复习。
function isMemoryAiReady() {
  return Boolean(memorySnapshot?.aiJudge?.configured);
}

// 类型名规则和 lib/memory-types.js 保持一致（渲染层是经典脚本，引不到 CommonJS，
// 这里保留一份同样规则的轻量实现；落盘前主进程还会再规范化一次）。
const MEMORY_TYPE_MAX_LENGTH = 24;
const MEMORY_TYPE_MAX_COUNT = 12;

const MEMORY_DEFAULT_SETTINGS_INPUT = {
  learningSteps: "1 10",
  graduatingInterval: 1,
  easyInterval: 4,
  startingEase: 250,
  maximumInterval: 36500,
  easyBonus: 130,
  intervalModifier: 100,
  relearningSteps: "10",
  newInterval: 0,
  minimumInterval: 1,
  newCardsPerDay: 20
};

function getMemoryCardById(cardId) {
  if (!cardId) {
    return null;
  }
  return (memorySnapshot?.cards || []).find((card) => card.id === cardId) || null;
}

function getMemoryQueueIds() {
  const queue = memorySnapshot?.queue;
  if (!queue) {
    return [];
  }
  return [...queue.learning, ...queue.due, ...queue.newCards];
}

function normalizeMemoryTypeName(value) {
  return String(value == null ? "" : value)
    .trim()
    .replace(/^#+/, "")
    .trim()
    .slice(0, MEMORY_TYPE_MAX_LENGTH);
}

// 所有快照统一从这里进内存：顺带镜像主进程的「按类型学习」筛选，
// 免得哪条链路漏同步，切换条和列表对不上。
function applyMemorySnapshot(snapshot) {
  memorySnapshot = snapshot;
  memoryTypeFilter = (snapshot && snapshot.type) || null;
  return snapshot;
}

// 快照对应哪一天。间隔按本地日切算，所以跨天后「今日待复习 / 新卡」都会变，
// 缓存不能跨天复用，否则早上打开还显示昨晚的数字。
let memorySnapshotDay = "";

function currentMemoryDayStamp() {
  const now = new Date();
  return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
}

async function ensureMemorySnapshot(force = false) {
  const dayChanged = memorySnapshotDay !== currentMemoryDayStamp();
  if (memorySnapshot && !force && !dayChanged) {
    return memorySnapshot;
  }
  if (!window.noticeNote?.listMemoryCards) {
    throw new Error("当前版本不支持记忆卡");
  }
  memorySnapshotDay = currentMemoryDayStamp();
  return applyMemorySnapshot(await window.noticeNote.listMemoryCards());
}

async function openMemoryView() {
  setSidebarViewMode("memory", false);
  renderBreadcrumb();
  memoryView.hidden = false;
  editorPanel.hidden = true;
  pdfViewer.hidden = true;
  fileViewer.hidden = true;
  memoryViewMode = "study";
  // 每次进视图都重取一次：跨天、外部改过文件、切换笔记库后都能立刻对齐。
  await ensureMemorySnapshot(true);
  if (!getMemoryCardById(memoryCurrentCardId)) {
    memoryCurrentCardId = getMemoryQueueIds()[0] || memorySnapshot.cards[0]?.id || null;
  }
  memoryRevealed = false;
  resetMemoryJudgeState();
  renderNoteList();
  renderMemoryView();
  focusMemoryAnswerInput();
  loadMemoryAnswersForCard(memoryCurrentCardId);
}

// 离开记忆视图时恢复原来的编辑器/阅读器，由 editor.js 的 renderEditor 统一接管。
function closeMemoryView() {
  if (!memoryView || memoryView.hidden) {
    return;
  }
  memoryView.hidden = true;
  memoryViewMode = "study";
  memoryRevealed = false;
  resetMemoryJudgeState();
  memoryAnswersExpanded = false;
  renderEditor();
}

function renderMemoryStats() {
  if (!memoryStatsBar) {
    return;
  }
  const stats = memorySnapshot?.stats;
  const items = [
    ["张卡片", stats?.total ?? 0],
    ["待复习", stats?.dueCount ?? 0, (stats?.dueCount ?? 0) > 0],
    ["学习中", stats?.learningCount ?? 0],
    ["新卡", stats?.newCount ?? 0],
    ["今日已复习", stats?.reviewedToday ?? 0]
  ];
  memoryStatsBar.innerHTML = "";
  for (const [label, value, highlighted] of items) {
    const cell = document.createElement("div");
    cell.className = "memory-stat";
    if (highlighted) {
      cell.classList.add("is-highlight");
    }
    const strong = document.createElement("strong");
    strong.textContent = String(value);
    const span = document.createElement("span");
    span.textContent = label;
    cell.append(strong, span);
    memoryStatsBar.append(cell);
  }
}

// 类型切换条：没有任何类型时整条隐藏（不给空牌组留一个孤零零的「全部」）。
// 只有学习页展示 —— 编辑/参数页切类型会把正在编辑的卡筛出去，没必要冒这个险。
function renderMemoryTypeBar() {
  if (!memoryTypeBar) {
    return;
  }
  const catalog = memorySnapshot?.types || [];
  const visible = memoryViewMode === "study" && catalog.length > 0;
  memoryTypeBar.hidden = !visible;
  if (!visible) {
    memoryTypeBar.innerHTML = "";
    return;
  }
  const entries = [
    { name: null, count: memorySnapshot?.stats?.allTotal ?? 0 },
    ...catalog
  ];
  memoryTypeBar.innerHTML = "";
  for (const entry of entries) {
    const isActive = entry.name ? entry.name === memoryTypeFilter : !memoryTypeFilter;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "memory-type-chip";
    if (isActive) {
      button.classList.add("is-active");
    }
    const label = document.createElement("span");
    label.textContent = entry.name || "全部";
    const count = document.createElement("small");
    count.textContent = String(entry.count);
    button.append(label, count);
    button.addEventListener("click", () => {
      if (!isActive) {
        setMemoryTypeFilter(entry.name);
      }
    });
    memoryTypeBar.append(button);
  }
}

async function setMemoryTypeFilter(typeName) {
  if (!window.noticeNote?.filterMemoryCards) {
    return;
  }
  try {
    applyMemorySnapshot(await window.noticeNote.filterMemoryCards({ type: typeName || null }));
    memoryCurrentCardId = getMemoryQueueIds()[0] || memorySnapshot.cards[0]?.id || null;
    memoryRevealed = false;
    memoryViewMode = "study";
    renderNoteList();
    renderMemoryView();
  } catch (error) {
    console.error("切换记忆卡类型失败:", error);
    window.showErrorToast?.(error, "切换类型失败");
  }
}

function renderMemoryStudyPanel() {
  let card = getMemoryCardById(memoryCurrentCardId);
  if (!card) {
    const fallbackId = getMemoryQueueIds()[0] || null;
    card = getMemoryCardById(fallbackId);
    memoryCurrentCardId = card ? card.id : null;
  }
  if (!card) {
    memoryStudyPanel.hidden = true;
    memoryEmptyState.hidden = false;
    return;
  }

  memoryStudyPanel.hidden = false;
  memoryEmptyState.hidden = true;
  const cardTypes = card.types || [];
  const typeSuffix = cardTypes.length
    ? ` · ${cardTypes.slice(0, 2).join("、")}${cardTypes.length > 2 ? "…" : ""}`
    : "";
  memoryCardMeta.textContent = `${MEMORY_STATE_LABELS[card.state] || card.state} · ${card.dueLabel}${typeSuffix}`;
  // 进度用「本轮第几张」表示，比单纯报总数更能说明还要点几次。
  const queueIds = getMemoryQueueIds();
  const index = queueIds.indexOf(card.id);
  memoryStageProgress.textContent = index >= 0
    ? `第 ${index + 1} / ${queueIds.length} 张`
    : "队列外";
  memoryCardFront.textContent = card.front || "（正面为空）";
  memoryCardBack.textContent = card.back || "（背面为空）";
  memoryCardBack.hidden = !memoryRevealed;

  const preview = card.preview || {};
  memoryPreviewAgain.textContent = preview.again?.label || "";
  memoryPreviewHard.textContent = preview.hard?.label || "";
  memoryPreviewGood.textContent = preview.good?.label || "";
  memoryPreviewEasy.textContent = preview.easy?.label || "";

  // 四个区域互斥：作答输入（只在问题面）/ 判定结果 / 手动四档（兜底或改判）/ 显示答案（无 AI 时）。
  renderMemoryAnswerZone(card);
  renderMemoryJudgeResultBar();
  renderMemoryAnswerHistory(card);
  renderMemoryStudyHint();
}

// 作答区：只在答案还没翻开时出现。看得见答案的地方不能让人回忆，否则等于抄。
// 提交 → 判定 → 才翻面，判定中转为禁用态，出结果后整块收起。
function renderMemoryAnswerZone(card) {
  if (!memoryAnswerZone) {
    return;
  }
  const aiReady = isMemoryAiReady();
  const showResult = memoryJudgeState === "result" || memoryJudgeState === "override";
  const showAnswerInput = aiReady && !showResult && !memoryRevealed;
  // 四档只在三种情况下出现：没配 AI（退回旧行为）、判定失败兜底、用户主动改判。
  const showRatingBar = memoryRevealed
    && (!aiReady || memoryJudgeState === "error" || memoryJudgeState === "override");
  // 配了 AI 就没有「先偷看再回答」这条路：答案由判定结果带出来。
  memoryRevealButton.hidden = memoryRevealed || aiReady;
  memoryAnswerZone.hidden = !showAnswerInput;
  memoryRatingBar.hidden = !showRatingBar;
  if (!showAnswerInput) {
    return;
  }

  // 草稿按卡片隔离：切卡才清空。后台重渲染（notes:changed、窗口 focus）
  // 不能把正在敲的内容冲掉，和编辑器面板同一个道理。
  if (memoryAnswerDraftCardId !== card.id) {
    memoryAnswerDraftCardId = card.id;
    memoryAnswerDraft = "";
  }
  if (memoryAnswerInput && memoryAnswerInput.value !== memoryAnswerDraft) {
    memoryAnswerInput.value = memoryAnswerDraft;
  }

  const judging = memoryJudgeState === "judging";
  if (memoryAnswerInput) {
    memoryAnswerInput.disabled = judging;
    memoryAnswerInput.placeholder = judging
      ? "正在等模型判断…"
      : "先别翻答案，用自己的话回忆一遍。Shift + Enter 提交后才会看到答案。";
  }
  if (memoryAnswerSubmitButton) {
    memoryAnswerSubmitButton.disabled = judging;
    memoryAnswerSubmitButton.textContent = judging ? "判定中…" : "提交判定";
  }
  if (memoryAnswerHint) {
    memoryAnswerHint.textContent = judging
      ? "通常需要 1–4 秒"
      : "Shift + Enter 提交 · Enter 换行 · 完全不会就写「不会」";
    memoryAnswerHint.classList.remove("is-error");
    memoryAnswerHint.hidden = false;
  }
}

// 新卡进来就把光标放进作答框：整条流程是「敲字 → Shift + Enter → 看答案 → 回车下一张」，
// 中间不该有必须动鼠标的地方。
function focusMemoryAnswerInput() {
  if (!isMemoryAiReady() || memoryRevealed || memoryViewMode !== "study") {
    return;
  }
  window.setTimeout(() => {
    if (memoryRevealed || memoryViewMode !== "study" || memoryAnswerZone?.hidden) {
      return;
    }
    memoryAnswerInput?.focus({ preventScroll: true });
  }, 0);
}

// 判定结果条：档位 + 一句理由 + 改判 / 下一张。判定失败时同一条位置换成告警，
// 因为那一轮答案已经翻开、输入框收了，提示只能落在这里。
function renderMemoryJudgeResultBar() {
  if (!memoryJudgeResultBar) {
    return;
  }
  const failed = memoryJudgeState === "error";
  const showResult = memoryJudgeState === "result" || memoryJudgeState === "override" || failed;
  memoryJudgeResultBar.hidden = !showResult;
  if (!showResult) {
    memoryJudgeBadge.hidden = false;
    memoryJudgeBadge.textContent = "";
    memoryJudgeBadge.dataset.rating = "";
    memoryJudgeReason.textContent = "";
    memoryJudgeOverrideButton.hidden = false;
    memoryJudgeNextButton.hidden = false;
    memoryJudgeResultBar.classList.remove("is-error");
    for (const button of document.querySelectorAll("[data-memory-rating]")) {
      button.classList.remove("is-current");
    }
    return;
  }
  const result = memoryJudgeResult || {};
  memoryJudgeBadge.hidden = failed;
  memoryJudgeBadge.textContent = failed
    ? ""
    : (MEMORY_RATING_LABELS[result.rating] || result.rating || "");
  memoryJudgeBadge.dataset.rating = failed ? "" : (result.rating || "");
  memoryJudgeReason.textContent = failed
    ? `判定失败：${memoryJudgeError || "未知错误"} — 请自己选一档`
    : (memoryJudgeError || result.reason || "");
  // 改判已经把四档铺开了，就不再显示「改判」按钮；失败时没有档位可改。
  memoryJudgeOverrideButton.hidden = memoryJudgeState === "override" || failed;
  // 失败时还没落调度，必须先选一档，不能直接跳过。
  memoryJudgeNextButton.hidden = failed;
  memoryJudgeResultBar.classList.toggle("is-override", memoryJudgeState === "override");
  memoryJudgeResultBar.classList.toggle("is-error", failed);
  // 改判时把当前档位标出来：否则「良好」按钮自带强调色，会被误认成已选中的那一档。
  for (const button of document.querySelectorAll("[data-memory-rating]")) {
    const isCurrent = memoryJudgeState === "override"
      && result.rating === button.dataset.memoryRating;
    button.classList.toggle("is-current", isCurrent);
  }
}

function renderMemoryStudyHint() {
  if (!memoryStudyHint) {
    return;
  }
  if (!isMemoryAiReady()) {
    memoryStudyHint.textContent = "空格显示答案 · 1 重来 / 2 困难 / 3 良好 / 4 简单 · E 编辑";
    return;
  }
  if (memoryJudgeState === "result") {
    memoryStudyHint.textContent = "Enter 下一张 · E 编辑";
    return;
  }
  if (memoryJudgeState === "error") {
    memoryStudyHint.textContent = "模型没判成，直接选一档 · E 编辑";
    return;
  }
  memoryStudyHint.textContent = "写完整答案按 Shift + Enter 提交 · 提交后答案才翻开 · E 编辑";
}

function formatMemoryAnswerTime(value) {
  const time = Date.parse(value);
  if (!Number.isFinite(time)) {
    return "";
  }
  const date = new Date(time);
  const pad = (number) => String(number).padStart(2, "0");
  const sameYear = date.getFullYear() === new Date().getFullYear();
  const day = `${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const clock = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  return sameYear ? `${day} ${clock}` : `${date.getFullYear()}-${day} ${clock}`;
}

// 作答历史：默认折叠，只露一行标题和条数。
// 列表每次重建，条目上直接挂删除监听，不留旧引用。
function renderMemoryAnswerHistory(card) {
  if (!memoryAnswerHistory) {
    return;
  }
  const entries = memoryAnswersCardId === card.id ? memoryAnswers : [];
  // 历史里存着上次的作答原文，摊在问题面上等于把答案提前漏了。翻面之后再给看。
  memoryAnswerHistory.hidden = !memoryRevealed || entries.length === 0;
  if (entries.length === 0) {
    memoryAnswerHistoryList.innerHTML = "";
    return;
  }
  memoryAnswerHistoryCount.textContent = `${entries.length} 条`;
  memoryAnswerHistoryToggle.setAttribute("aria-expanded", memoryAnswersExpanded ? "true" : "false");
  memoryAnswerHistoryToggle.classList.toggle("is-open", memoryAnswersExpanded);
  memoryAnswerHistoryList.hidden = !memoryAnswersExpanded;
  if (!memoryAnswersExpanded) {
    memoryAnswerHistoryList.innerHTML = "";
    return;
  }

  memoryAnswerHistoryList.innerHTML = "";
  for (const entry of entries) {
    const item = document.createElement("li");
    item.className = "memory-history-item";

    const head = document.createElement("div");
    head.className = "memory-history-item-head";
    const badge = document.createElement("span");
    badge.className = "memory-history-badge";
    badge.dataset.rating = entry.rating;
    badge.textContent = MEMORY_RATING_LABELS[entry.rating] || entry.rating;
    const time = document.createElement("span");
    time.className = "memory-history-time";
    time.textContent = formatMemoryAnswerTime(entry.createdAt);
    head.append(badge, time);
    if (entry.edited) {
      const edited = document.createElement("span");
      edited.className = "memory-history-edited";
      edited.textContent = "已改判";
      head.append(edited);
    }

    const text = document.createElement("p");
    text.className = "memory-history-text";
    text.textContent = entry.answer || "（空回答）";

    const reason = document.createElement("p");
    reason.className = "memory-history-reason";
    reason.textContent = entry.reason || "";

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "memory-history-remove";
    remove.textContent = "删除";
    remove.title = "删除这条作答记录";
    remove.setAttribute("aria-label", "删除这条作答记录");
    remove.addEventListener("click", () => deleteMemoryAnswerEntry(entry.id));

    item.append(head, text, reason, remove);
    memoryAnswerHistoryList.append(item);
  }
}

function renderMemoryEditorPanel() {
  const card = memoryEditingCardId ? getMemoryCardById(memoryEditingCardId) : null;
  memoryEditorTitle.textContent = card ? "编辑卡片" : "新建卡片";
  memoryDeleteCardButton.hidden = !card;
  memorySaveCardButton.textContent = card ? "保存修改" : "保存卡片";
  // 只有「新开一次编辑」才回填表单。窗口重新获得焦点、快照广播这类后台重渲染
  // 也会走到这里，若无条件回填，Alt+Tab 切回来刚敲的正反面就被清空了。
  if (memoryEditorRenderedSession === memoryEditorSession) {
    return;
  }
  memoryEditorRenderedSession = memoryEditorSession;
  // 新建卡时把当前筛选的类型带进去：在「限流」下点新建，大概率就是要加一张限流的卡。
  memoryEditorTypes = card
    ? [...(card.types || [])]
    : (memoryTypeFilter ? [memoryTypeFilter] : []);
  memoryTypeInput.value = "";
  memoryFrontInput.value = card ? card.front : "";
  memoryBackInput.value = card ? card.back : "";
  renderMemoryTypeChips();
  window.setTimeout(() => memoryFrontInput.focus(), 0);
}

// 已选类型（带 × 可移除）＋「已有类型」候选（点一下加进来）
function renderMemoryTypeChips() {
  if (!memoryTypeChips) {
    return;
  }
  memoryTypeChips.innerHTML = "";
  for (const name of memoryEditorTypes) {
    const chip = document.createElement("span");
    chip.className = "memory-type-chip is-selected";
    const label = document.createElement("span");
    label.textContent = name;
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "memory-type-chip-remove";
    remove.textContent = "×";
    remove.title = `移除「${name}」`;
    remove.setAttribute("aria-label", `移除类型 ${name}`);
    remove.addEventListener("click", () => {
      memoryEditorTypes = memoryEditorTypes.filter((item) => item !== name);
      renderMemoryTypeChips();
    });
    chip.append(label, remove);
    memoryTypeChips.append(chip);
  }
  if (memoryEditorTypes.length === 0) {
    const hint = document.createElement("span");
    hint.className = "memory-type-empty";
    hint.textContent = "还没有类型";
    memoryTypeChips.append(hint);
  }
  renderMemoryTypeSuggestions();
}

function renderMemoryTypeSuggestions() {
  if (!memoryTypeSuggestions) {
    return;
  }
  const query = normalizeMemoryTypeName(memoryTypeInput?.value || "").toLowerCase();
  const selected = new Set(memoryEditorTypes.map((name) => name.toLowerCase()));
  const options = (memorySnapshot?.types || []).filter((item) => {
    const key = item.name.toLowerCase();
    return !selected.has(key) && (!query || key.includes(query));
  });
  memoryTypeSuggestions.innerHTML = "";
  memoryTypeSuggestions.hidden = options.length === 0;
  if (options.length === 0) {
    return;
  }
  const label = document.createElement("span");
  label.className = "memory-type-suggestions-label";
  label.textContent = "已有类型";
  memoryTypeSuggestions.append(label);
  for (const item of options) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "memory-type-chip is-ghost";
    chip.textContent = item.name;
    chip.addEventListener("click", () => addMemoryEditorType(item.name));
    memoryTypeSuggestions.append(chip);
  }
}

// 支持一次贴/敲多个：逗号、顿号、分号、换行都当分隔符。
function addMemoryEditorType(raw) {
  const names = String(raw == null ? "" : raw).split(/[,，、;；\n]/);
  let added = false;
  for (const item of names) {
    const name = normalizeMemoryTypeName(item);
    if (!name) {
      continue;
    }
    if (memoryEditorTypes.some((existing) => existing.toLowerCase() === name.toLowerCase())) {
      continue;
    }
    if (memoryEditorTypes.length >= MEMORY_TYPE_MAX_COUNT) {
      window.showToast?.(`一张卡最多 ${MEMORY_TYPE_MAX_COUNT} 个类型`, "warning");
      break;
    }
    memoryEditorTypes = [...memoryEditorTypes, name];
    added = true;
  }
  memoryTypeInput.value = "";
  if (added) {
    renderMemoryTypeChips();
  } else {
    renderMemoryTypeSuggestions();
  }
}

function commitMemoryTypeInput() {
  const pending = memoryTypeInput?.value || "";
  if (!pending.trim()) {
    return;
  }
  addMemoryEditorType(pending);
}

function formatSteps(steps) {
  return Array.isArray(steps) ? steps.join(" ") : "";
}

function formatPercent(value) {
  return String(Math.round(Number(value) * 100));
}

function renderMemorySettingsPanel() {
  const settings = memorySnapshot?.settings;
  if (!settings) {
    return;
  }
  memorySettingLearningSteps.value = formatSteps(settings.learningSteps);
  memorySettingGraduatingInterval.value = String(settings.graduatingInterval);
  memorySettingEasyInterval.value = String(settings.easyInterval);
  memorySettingStartingEase.value = formatPercent(settings.startingEase);
  memorySettingMaximumInterval.value = String(settings.maximumInterval);
  memorySettingEasyBonus.value = formatPercent(settings.easyBonus);
  memorySettingIntervalModifier.value = formatPercent(settings.intervalModifier);
  memorySettingRelearningSteps.value = formatSteps(settings.relearningSteps);
  memorySettingNewInterval.value = formatPercent(settings.newInterval);
  memorySettingMinimumInterval.value = String(settings.minimumInterval);
  memorySettingNewCardsPerDay.value = String(settings.newCardsPerDay);
}

function renderMemoryView() {
  if (!memoryView || memoryView.hidden) {
    return;
  }
  const hasCards = (memorySnapshot?.cards || []).length > 0;
  renderMemoryStats();
  memoryEditorPanel.hidden = memoryViewMode !== "editor";
  memorySettingsPanel.hidden = memoryViewMode !== "settings";
  memoryStudyPanel.hidden = memoryViewMode !== "study" || !hasCards;
  memoryEmptyState.hidden = !(memoryViewMode === "study" && !hasCards);
  renderMemoryTypeBar();

  if (memoryViewMode === "study" && hasCards) {
    renderMemoryStudyPanel();
  } else if (memoryViewMode === "editor") {
    renderMemoryEditorPanel();
  } else if (memoryViewMode === "settings") {
    renderMemorySettingsPanel();
  }
  // 卡面换了，侧边栏的选中态要一起走；只改 class 不重建列表，
  // 否则点一下远处的卡，列表滚动位置会弹回顶部。
  syncMemorySidebarActive();
}

// 侧边栏每项带 data-memory-card-id，选中态以「当前卡」为准。
function syncMemorySidebarActive() {
  if (!noteList) {
    return;
  }
  for (const item of noteList.querySelectorAll("[data-memory-card-id]")) {
    item.classList.toggle("is-active", item.dataset.memoryCardId === memoryCurrentCardId);
  }
}

function selectMemoryCard(cardId) {
  if (memoryCurrentCardId !== cardId) {
    resetMemoryJudgeState();
    memoryAnswers = [];
    memoryAnswersCardId = null;
    memoryAnswersExpanded = false;
    memoryAnswerDraft = "";
    memoryAnswerDraftCardId = null;
  }
  memoryCurrentCardId = cardId;
  memoryRevealed = false;
  memoryViewMode = "study";
  renderMemoryView();
  focusMemoryAnswerInput();
  loadMemoryAnswersForCard(cardId);
}

function resetMemoryJudgeState() {
  memoryJudgeState = "idle";
  memoryJudgeResult = null;
  memoryJudgeError = "";
}

// 翻开答案。只有没配 AI 时才走这条路；配了 AI 由判定结果负责翻面，
// 免得用户先偷看再作答。
function revealMemoryAnswer() {
  if (memoryRevealed) {
    return;
  }
  memoryRevealed = true;
  renderMemoryStudyPanel();
}

// 提交作答 → 主进程调模型 → 直接落盘调度。
// 判定结果和快照一起回来，界面只切状态，不自己算档位。
async function submitMemoryAnswer() {
  const card = getMemoryCardById(memoryCurrentCardId);
  if (!card || memoryJudgeState === "judging") {
    return;
  }
  const answer = (memoryAnswerInput?.value || "").trim();
  if (!answer) {
    window.showToast?.("先写点内容再提交", "warning");
    memoryAnswerInput?.focus();
    return;
  }
  const cardId = card.id;
  memoryAnswerDraft = answer;
  memoryJudgeState = "judging";
  memoryJudgeError = "";
  renderMemoryStudyPanel();
  try {
    const result = await window.noticeNote.judgeMemoryAnswer({ cardId, answer });
    applyMemorySnapshot(result.snapshot);
    memoryJudgeResult = result.judgment;
    memoryJudgeState = "result";
    memoryJudgeError = "";
    // 判完才翻答案：先看答案再作答，回忆就白做了。
    memoryRevealed = true;
    memoryAnswerDraft = "";
    memoryAnswerDraftCardId = null;
    if (memoryCurrentCardId === cardId) {
      renderMemoryView();
      loadMemoryAnswersForCard(cardId);
    }
  } catch (error) {
    console.error("AI 判定失败:", error);
    // 判定失败不能卡住流程：翻开答案、露出四档，这一张降级成手动。
    // 此时答案已经看得见，不再留重试入口——看了答案再判一次只会虚高。
    memoryJudgeState = "error";
    memoryJudgeError = String(error?.message || "判定失败").replace(/^Error invoking remote method '[^']+':\s*/, "");
    memoryRevealed = true;
    renderMemoryView();
    window.showErrorToast?.(error, "AI 判定失败，可以手动选一档");
  }
}

// 改判：把已经应用的那次评分换成另一档。主进程会用评分前的卡片状态重算，
// 不会在已经改过的间隔上再乘一次。
function openMemoryJudgeOverride() {
  if (memoryJudgeState !== "result") {
    return;
  }
  memoryJudgeState = "override";
  renderMemoryView();
}

async function applyMemoryJudgeOverride(rating) {
  const result = memoryJudgeResult;
  if (!result?.cardId) {
    return;
  }
  const cardId = result.cardId;
  try {
    const response = await window.noticeNote.rejudgeMemoryAnswer({ cardId, rating });
    applyMemorySnapshot(response.snapshot);
    memoryJudgeResult = { ...response.judgment, cardId };
    memoryJudgeState = "result";
    renderMemoryView();
    loadMemoryAnswersForCard(cardId);
  } catch (error) {
    console.error("改判失败:", error);
    window.showErrorToast?.(error, "改判失败");
  }
}

function goToNextMemoryCard() {
  resetMemoryJudgeState();
  memoryCurrentCardId = getMemoryQueueIds()[0] || null;
  memoryRevealed = false;
  memoryAnswerDraft = "";
  memoryAnswerDraftCardId = null;
  memoryAnswers = [];
  memoryAnswersCardId = null;
  memoryAnswersExpanded = false;
  renderNoteList();
  renderMemoryView();
  focusMemoryAnswerInput();
  loadMemoryAnswersForCard(memoryCurrentCardId);
}

// 拉当前卡的作答历史。切卡快时旧请求可能后到，用序号丢弃过期结果。
async function loadMemoryAnswersForCard(cardId) {
  if (!cardId || !window.noticeNote?.listMemoryAnswers) {
    return;
  }
  const seq = memoryAnswersSeq + 1;
  memoryAnswersSeq = seq;
  try {
    const result = await window.noticeNote.listMemoryAnswers(cardId);
    if (seq !== memoryAnswersSeq) {
      return;
    }
    memoryAnswers = Array.isArray(result?.entries) ? result.entries : [];
    memoryAnswersCardId = cardId;
    const card = getMemoryCardById(memoryCurrentCardId);
    if (card && card.id === cardId && memoryView && !memoryView.hidden) {
      renderMemoryAnswerHistory(card);
    }
  } catch (error) {
    console.error("加载作答历史失败:", error);
  }
}

async function deleteMemoryAnswerEntry(entryId) {
  const cardId = memoryAnswersCardId;
  if (!entryId || !cardId) {
    return;
  }
  try {
    const result = await window.noticeNote.deleteMemoryAnswer({ cardId, entryId });
    memoryAnswers = Array.isArray(result?.entries) ? result.entries : [];
    const card = getMemoryCardById(memoryCurrentCardId);
    if (card) {
      renderMemoryAnswerHistory(card);
    }
  } catch (error) {
    console.error("删除作答记录失败:", error);
    window.showErrorToast?.(error, "删除记录失败");
  }
}

function toggleMemoryAnswerHistory() {
  memoryAnswersExpanded = !memoryAnswersExpanded;
  const card = getMemoryCardById(memoryCurrentCardId);
  if (card) {
    renderMemoryAnswerHistory(card);
  }
}

async function rateMemoryCard(rating) {
  const card = getMemoryCardById(memoryCurrentCardId);
  if (!card) {
    return;
  }
  // 改判走另一条链路：要基于评分前的状态重算。
  if (memoryJudgeState === "override") {
    await applyMemoryJudgeOverride(rating);
    return;
  }
  try {
    applyMemorySnapshot(await window.noticeNote.reviewMemoryCard({ id: card.id, rating }));
    // 评完就从队列里取下一张；按 Again 的卡要等分钟级步骤到期才会回来。
    memoryCurrentCardId = getMemoryQueueIds()[0] || null;
    memoryRevealed = false;
    resetMemoryJudgeState();
    memoryAnswers = [];
    memoryAnswersCardId = null;
    renderNoteList();
    renderMemoryView();
    loadMemoryAnswersForCard(memoryCurrentCardId);
  } catch (error) {
    console.error("提交记忆卡评分失败:", error);
    window.showErrorToast?.(error, "提交评分失败");
  }
}

function openMemoryEditor(cardId = null) {
  memoryEditingCardId = cardId;
  // 新开一次编辑会话，允许 renderMemoryEditorPanel 回填表单
  memoryEditorSession += 1;
  memoryViewMode = "editor";
  memoryRevealed = false;
  renderMemoryView();
}

async function saveMemoryCardFromEditor() {
  // 输入框里还没回车的类型也算数，别让人敲完直接点保存结果丢了
  commitMemoryTypeInput();
  const front = memoryFrontInput.value.trim();
  const back = memoryBackInput.value.trim();
  const types = [...memoryEditorTypes];
  if (!front && !back) {
    window.showToast?.("正面或背面至少填一个", "warning");
    memoryFrontInput.focus();
    return;
  }
  memorySaveCardButton.disabled = true;
  try {
    const before = new Set((memorySnapshot?.cards || []).map((card) => card.id));
    const result = memoryEditingCardId
      ? await window.noticeNote.updateMemoryCard({ id: memoryEditingCardId, front, back, types })
      : await window.noticeNote.createMemoryCard({ front, back, types });
    applyMemorySnapshot(result);
    const added = memorySnapshot.cards.find((card) => !before.has(card.id));
    memoryCurrentCardId = memoryEditingCardId || added?.id || memoryCurrentCardId;
    memoryEditingCardId = null;
    memoryViewMode = "study";
    memoryRevealed = false;
    renderNoteList();
    renderMemoryView();
  } catch (error) {
    console.error("保存记忆卡失败:", error);
    window.showErrorToast?.(error, "保存记忆卡失败");
  } finally {
    memorySaveCardButton.disabled = false;
  }
}

async function deleteMemoryCardFromEditor() {
  if (!memoryEditingCardId) {
    return;
  }
  if (!window.confirm("删除这张卡片？它的复习记录也会一起删除。")) {
    return;
  }
  try {
    applyMemorySnapshot(await window.noticeNote.deleteMemoryCard(memoryEditingCardId));
    memoryEditingCardId = null;
    memoryCurrentCardId = getMemoryQueueIds()[0] || null;
    memoryViewMode = "study";
    memoryRevealed = false;
    renderNoteList();
    renderMemoryView();
  } catch (error) {
    console.error("删除记忆卡失败:", error);
    window.showErrorToast?.(error, "删除记忆卡失败");
  }
}

function readMemorySettingsFromPanel() {
  // 界面上按百分数填写（250 / 130 / 100 / 0），提交前统一换算成小数，
  // 避免 10% 这类小值被调度器的「>10 视为百分数」兼容逻辑误判成 10 倍。
  const percent = (value) => Number(value) / 100;
  return {
    learningSteps: memorySettingLearningSteps.value,
    graduatingInterval: Number(memorySettingGraduatingInterval.value),
    easyInterval: Number(memorySettingEasyInterval.value),
    startingEase: percent(memorySettingStartingEase.value),
    maximumInterval: Number(memorySettingMaximumInterval.value),
    easyBonus: percent(memorySettingEasyBonus.value),
    intervalModifier: percent(memorySettingIntervalModifier.value),
    relearningSteps: memorySettingRelearningSteps.value,
    newInterval: percent(memorySettingNewInterval.value),
    minimumInterval: Number(memorySettingMinimumInterval.value),
    newCardsPerDay: Number(memorySettingNewCardsPerDay.value)
  };
}

async function saveMemorySettingsFromPanel() {
  memorySaveSettingsButton.disabled = true;
  try {
    applyMemorySnapshot(await window.noticeNote.updateMemorySettings(readMemorySettingsFromPanel()));
    memoryViewMode = "study";
    renderNoteList();
    renderMemoryView();
    window.showToast?.("算法参数已保存");
  } catch (error) {
    console.error("保存记忆卡参数失败:", error);
    window.showErrorToast?.(error, "保存参数失败");
  } finally {
    memorySaveSettingsButton.disabled = false;
  }
}

function resetMemorySettingsInputs() {
  const defaults = MEMORY_DEFAULT_SETTINGS_INPUT;
  memorySettingLearningSteps.value = defaults.learningSteps;
  memorySettingGraduatingInterval.value = String(defaults.graduatingInterval);
  memorySettingEasyInterval.value = String(defaults.easyInterval);
  memorySettingStartingEase.value = String(defaults.startingEase);
  memorySettingMaximumInterval.value = String(defaults.maximumInterval);
  memorySettingEasyBonus.value = String(defaults.easyBonus);
  memorySettingIntervalModifier.value = String(defaults.intervalModifier);
  memorySettingRelearningSteps.value = defaults.relearningSteps;
  memorySettingNewInterval.value = String(defaults.newInterval);
  memorySettingMinimumInterval.value = String(defaults.minimumInterval);
  memorySettingNewCardsPerDay.value = String(defaults.newCardsPerDay);
}

function startMemoryStudyFromSidebar() {
  const firstId = getMemoryQueueIds()[0] || memorySnapshot?.cards?.[0]?.id || null;
  if (!firstId) {
    openMemoryEditor(null);
    return;
  }
  if (memoryView.hidden) {
    openMemoryView().catch((error) => window.showErrorToast?.(error, "打开记忆卡失败"));
    return;
  }
  memoryViewMode = "study";
  selectMemoryCard(firstId);
}

// 侧边栏「记忆」列表：先显示今天的队列，再显示其余卡片。
// 由 sidebar.js 的 renderNoteList 分发进来，元素每次重建，不保留旧监听。
function renderMemorySidebar() {
  if (!noteList) {
    return;
  }
  if (!memorySnapshot) {
    noteList.innerHTML = "";
    const loading = document.createElement("p");
    loading.className = "memory-sidebar-empty";
    loading.textContent = "正在加载记忆卡…";
    noteList.append(loading);
    ensureMemorySnapshot()
      .then(() => {
        if (sidebarViewMode === "memory") {
          renderMemorySidebar();
        }
        renderMemoryView();
      })
      .catch((error) => {
        console.error("加载记忆卡失败:", error);
        loading.textContent = "加载失败，点「记忆」重试";
      });
    return;
  }

  noteList.innerHTML = "";
  const stats = memorySnapshot.stats || {};
  const header = document.createElement("div");
  header.className = "memory-sidebar-header";
  const title = document.createElement("strong");
  title.textContent = memoryTypeFilter ? `记忆卡 · ${memoryTypeFilter}` : "记忆卡";
  const count = document.createElement("span");
  count.textContent = memoryTypeFilter
    ? `${stats.total ?? 0} / ${stats.allTotal ?? 0} 张`
    : `${stats.total ?? 0} 张`;
  header.append(title, count);

  const startButton = document.createElement("button");
  startButton.type = "button";
  startButton.className = "primary-button memory-sidebar-start";
  const queueCount = getMemoryQueueIds().length;
  startButton.textContent = queueCount > 0 ? `开始学习（${queueCount}）` : "新建一张卡";
  startButton.addEventListener("click", startMemoryStudyFromSidebar);

  noteList.append(header, startButton);

  const list = document.createElement("div");
  list.className = "memory-sidebar-list";
  const queueIds = getMemoryQueueIds();
  const queueSet = new Set(queueIds);
  const restIds = memorySnapshot.cards
    .filter((card) => !queueSet.has(card.id))
    .map((card) => card.id);

  for (const id of [...queueIds, ...restIds]) {
    const card = getMemoryCardById(id);
    if (!card) {
      continue;
    }
    const item = document.createElement("button");
    item.type = "button";
    item.className = "memory-sidebar-item";
    item.dataset.memoryCardId = card.id;
    if (card.id === memoryCurrentCardId) {
      item.classList.add("is-active");
    }
    const front = document.createElement("span");
    front.className = "memory-sidebar-item-title";
    front.textContent = card.front || "（空白正面）";
    const meta = document.createElement("span");
    meta.className = "memory-sidebar-item-meta";
    // 「全部」视图里把类型带上，一眼看出为什么它属于哪个分组；
    // 已经按类型筛选时不重复显示同一个后缀。
    const typeSuffix = !memoryTypeFilter && card.types?.length
      ? ` · ${card.types.join("、")}`
      : "";
    meta.textContent = `${MEMORY_STATE_LABELS[card.state] || card.state} · ${card.dueLabel}${typeSuffix}`;
    item.append(front, meta);
    item.addEventListener("click", () => {
      memoryViewMode = "study";
      selectMemoryCard(card.id);
    });
    list.append(item);
  }
  noteList.append(list);
}

function handleMemoryKeydown(event) {
  if (!memoryView || memoryView.hidden || memoryViewMode !== "study") {
    return;
  }
  const tag = event.target && event.target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
    return;
  }
  // 判定结果出来后，空格和 Enter 都是「下一张」。
  // 焦点在按钮上时让原生 click 处理，否则会和这里各走一遍。
  if (memoryJudgeState === "result" && tag !== "BUTTON"
    && (event.code === "Space" || event.key === "Enter")) {
    event.preventDefault();
    goToNextMemoryCard();
    return;
  }
  // 光标在别处时，回车和空格都把焦点送回作答框——想答题的人不该先摸鼠标。
  // 只在「问题面 + 还没判定」成立时这么做；判定中按空格不能把答案翻出来。
  if (isMemoryAiReady() && !memoryRevealed && memoryJudgeState === "idle"
    && tag !== "BUTTON" && (event.key === "Enter" || event.code === "Space")) {
    event.preventDefault();
    memoryAnswerInput?.focus();
    return;
  }
  if (event.code === "Space") {
    event.preventDefault();
    // 配了 AI 时答案只能由判定结果翻出来，空格不承担「显示答案」。
    if (!isMemoryAiReady()) {
      revealMemoryAnswer();
    }
    return;
  }
  // E 编辑当前卡（Anki 的习惯键位）；带修饰键时让给系统快捷键。
  if (!event.ctrlKey && !event.metaKey && !event.altKey && (event.key === "e" || event.key === "E")) {
    if (memoryCurrentCardId) {
      event.preventDefault();
      openMemoryEditor(memoryCurrentCardId);
    }
    return;
  }
  // 数字键只在四档真的露出来时才生效：AI 模式下作答区还开着，
  // 按一下 1 就被判「重来」显然不是用户想要的。
  if (!memoryRevealed || !memoryRatingBar || memoryRatingBar.hidden) {
    return;
  }
  const rating = MEMORY_RATING_KEYS[event.key];
  if (rating) {
    event.preventDefault();
    rateMemoryCard(rating);
  }
}

// ---- 从笔记右键快速建卡 ------------------------------------------------
// 入口在 context-menu.js：「制作成记忆卡片」→ openMemoryQuickCreate(noteId)。
// 字段和记忆视图的编辑器一样（正面 / 背面 / 类型），但状态各自独立：
// memoryQuickTypes 不复用 memoryEditorTypes，免得一边编辑卡片一边右键把草稿冲掉。
//
// 卡片结构由 sm2-scheduler 的 normalizeCard 固定（front/back/types + 调度字段），
// 多写的字段会被丢掉，所以这里不做「来源笔记」关联。

// 背面预填上限：整篇笔记原样塞进去就当不了卡片，超出按段落截断并提示。
const MEMORY_QUICK_BACK_LIMIT = 4000;

// 卡片正文是纯文本（renderMemoryStudyPanel 用 textContent），markdown 标记会原样显出来，
// 所以预填时把图片、链接语法、标题井号这类纯噪音清掉，正文本身不动。
function memoryQuickStripMarkdown(raw) {
  return String(raw || "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/`([^`\n]+)`/g, "$1")
    // 只去成对的双星号（粗体）：单星号在 glob / 正则里太常见，动了容易误伤
    .replace(/\*\*([^*\n]+)\*\*/g, "$1")
    .replace(/^[ \t]{0,3}#{1,6}[ \t]+/gm, "")
    .replace(/^[ \t]{0,3}>[ \t]?/gm, "")
    .replace(/^[ \t]{0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/gm, "")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function buildMemoryQuickBack(content) {
  const text = memoryQuickStripMarkdown(content);
  if (text.length <= MEMORY_QUICK_BACK_LIMIT) {
    return { text, truncated: false };
  }
  const slice = text.slice(0, MEMORY_QUICK_BACK_LIMIT);
  // 尽量在段落或句子边界断开，别把一句话劈成两半
  const boundary = Math.max(
    slice.lastIndexOf("\n\n"),
    slice.lastIndexOf("。"),
    slice.lastIndexOf("！"),
    slice.lastIndexOf("？"),
    slice.lastIndexOf("\n"),
  );
  const keep = boundary > MEMORY_QUICK_BACK_LIMIT * 0.6 ? boundary + 1 : MEMORY_QUICK_BACK_LIMIT;
  return { text: slice.slice(0, keep).trim(), truncated: true };
}

async function openMemoryQuickCreate(noteId) {
  const note = (notes || []).find((item) => item.id === noteId);
  if (!note) {
    window.showToast?.("这篇笔记不在当前列表里，刷新后再试", "warning");
    return;
  }
  // 类型建议来自快照；没进过记忆视图时顺手拉一次，失败也不挡建卡。
  try {
    await ensureMemorySnapshot();
  } catch (error) {
    console.error("读取记忆卡快照失败:", error);
  }

  memoryQuickNoteId = noteId;
  memoryQuickTypes = [];
  const back = buildMemoryQuickBack(note.content);
  memoryQuickFront.value = note.title || "";
  memoryQuickBack.value = back.text;
  memoryQuickSource.textContent = `来自《${note.title || "未命名笔记"}》`;
  memoryQuickHint.textContent = back.truncated
    ? `原笔记较长，背面只预填了前 ${back.text.length} 字，可按需删减。Ctrl + Enter 保存。`
    : "加入后按间隔重复复习，原笔记不会改动。Ctrl + Enter 保存。";
  memoryQuickTypeInput.value = "";
  renderMemoryQuickTypes();

  if (memoryQuickDialog.open) {
    memoryQuickDialog.close();
  }
  memoryQuickDialog.showModal();
  // 正面预填的是标题，整段选中方便直接替换
  window.setTimeout(() => {
    memoryQuickFront.focus();
    memoryQuickFront.select();
  }, 0);
}

function renderMemoryQuickTypes() {
  if (!memoryQuickTypeChips) {
    return;
  }
  memoryQuickTypeChips.innerHTML = "";
  for (const name of memoryQuickTypes) {
    const chip = document.createElement("span");
    chip.className = "memory-type-chip is-selected";
    const label = document.createElement("span");
    label.textContent = name;
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "memory-type-chip-remove";
    remove.textContent = "×";
    remove.title = `移除「${name}」`;
    remove.setAttribute("aria-label", `移除类型 ${name}`);
    remove.addEventListener("click", () => {
      memoryQuickTypes = memoryQuickTypes.filter((item) => item !== name);
      renderMemoryQuickTypes();
    });
    chip.append(label, remove);
    memoryQuickTypeChips.append(chip);
  }
  if (memoryQuickTypes.length === 0) {
    const hint = document.createElement("span");
    hint.className = "memory-type-empty";
    hint.textContent = "还没有类型";
    memoryQuickTypeChips.append(hint);
  }
  renderMemoryQuickTypeSuggestions();
}

// 已有类型候选：规则与记忆视图编辑器一致（去重不分大小写、最多 12 个）。
function renderMemoryQuickTypeSuggestions() {
  if (!memoryQuickTypeSuggestions) {
    return;
  }
  const query = normalizeMemoryTypeName(memoryQuickTypeInput?.value || "").toLowerCase();
  const selected = new Set(memoryQuickTypes.map((name) => name.toLowerCase()));
  const options = (memorySnapshot?.types || []).filter((item) => {
    const key = item.name.toLowerCase();
    return !selected.has(key) && (!query || key.includes(query));
  });
  memoryQuickTypeSuggestions.innerHTML = "";
  memoryQuickTypeSuggestions.hidden = options.length === 0;
  if (options.length === 0) {
    return;
  }
  const label = document.createElement("span");
  label.className = "memory-type-suggestions-label";
  label.textContent = "已有类型";
  memoryQuickTypeSuggestions.append(label);
  for (const item of options) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "memory-type-chip is-ghost";
    chip.textContent = item.name;
    chip.addEventListener("click", () => addMemoryQuickTypes(item.name));
    memoryQuickTypeSuggestions.append(chip);
  }
}

function addMemoryQuickTypes(raw) {
  // 一次贴/敲多个：逗号、顿号、分号、换行都当分隔符
  const names = String(raw == null ? "" : raw).split(/[,，、;；\n]/);
  let added = false;
  for (const item of names) {
    const name = normalizeMemoryTypeName(item);
    if (!name) {
      continue;
    }
    if (memoryQuickTypes.some((existing) => existing.toLowerCase() === name.toLowerCase())) {
      continue;
    }
    if (memoryQuickTypes.length >= MEMORY_TYPE_MAX_COUNT) {
      window.showToast?.(`一张卡最多 ${MEMORY_TYPE_MAX_COUNT} 个类型`, "warning");
      break;
    }
    memoryQuickTypes = [...memoryQuickTypes, name];
    added = true;
  }
  memoryQuickTypeInput.value = "";
  if (added) {
    renderMemoryQuickTypes();
  } else {
    renderMemoryQuickTypeSuggestions();
  }
}

async function saveMemoryQuickCardFromDialog() {
  // 输入框里还没回车的类型也算数
  const pending = memoryQuickTypeInput?.value || "";
  if (pending.trim()) {
    addMemoryQuickTypes(pending);
  }
  const front = memoryQuickFront.value.trim();
  const back = memoryQuickBack.value.trim();
  if (!front && !back) {
    window.showToast?.("正面或背面至少填一个", "warning");
    memoryQuickFront.focus();
    return;
  }
  const types = [...memoryQuickTypes];
  memoryQuickSaveButton.disabled = true;
  try {
    const before = new Set((memorySnapshot?.cards || []).map((card) => card.id));
    applyMemorySnapshot(await window.noticeNote.createMemoryCard({ front, back, types }));
    const added = (memorySnapshot?.cards || []).find((card) => !before.has(card.id));
    memoryQuickDialog.close();
    // 已经在记忆视图里，就把新卡设为当前卡：切过去直接看到刚建的那张
    if (memoryView && !memoryView.hidden) {
      memoryCurrentCardId = added?.id || memoryCurrentCardId;
      memoryViewMode = "study";
      memoryRevealed = false;
      renderNoteList();
      renderMemoryView();
    } else if (sidebarViewMode === "memory") {
      renderNoteList();
    }
    window.showToast?.(
      types.length ? `已加入记忆卡片 · ${types.join(" / ")}` : "已加入记忆卡片",
      "success",
    );
  } catch (error) {
    console.error("加入记忆卡片失败:", error);
    window.showErrorToast?.(error, "加入记忆卡片失败");
  } finally {
    memoryQuickSaveButton.disabled = false;
  }
}

function bindMemoryCardEvents() {
  memoryNewCardButton?.addEventListener("click", () => openMemoryEditor(null));
  memoryEmptyCreateButton?.addEventListener("click", () => openMemoryEditor(null));
  memorySettingsButton?.addEventListener("click", () => {
    memoryViewMode = "settings";
    renderMemoryView();
  });
  memoryRevealButton?.addEventListener("click", revealMemoryAnswer);
  memoryAnswerSubmitButton?.addEventListener("click", submitMemoryAnswer);
  memoryJudgeNextButton?.addEventListener("click", goToNextMemoryCard);
  memoryJudgeOverrideButton?.addEventListener("click", openMemoryJudgeOverride);
  memoryAnswerHistoryToggle?.addEventListener("click", toggleMemoryAnswerHistory);
  memoryAnswerInput?.addEventListener("input", () => {
    memoryAnswerDraft = memoryAnswerInput.value;
    memoryAnswerDraftCardId = memoryCurrentCardId;
  });
  memoryAnswerInput?.addEventListener("keydown", (event) => {
    // 中文输入法还在拼写时按回车是「选词」，不能当成提交。
    if (event.isComposing || event.keyCode === 229) {
      return;
    }
    // Esc 交还键盘：光标在输入框里时 E / 空格都是普通字符，想用快捷键得先退出。
    if (event.key === "Escape") {
      event.preventDefault();
      memoryAnswerInput.blur();
      return;
    }
    // Enter 换行、Shift + Enter 提交：写长答案时回车几乎都是想换行，
    // 用组合键提交才不会边写边误提交。
    if (event.key === "Enter" && event.shiftKey) {
      event.preventDefault();
      submitMemoryAnswer();
    }
  });
  // 卡片页里直接进编辑器：修改/删除都在那里，不用回侧边栏绕一圈。
  memoryEditCardButton?.addEventListener("click", () => {
    if (memoryCurrentCardId) {
      openMemoryEditor(memoryCurrentCardId);
    }
  });
  memoryCancelEditButton?.addEventListener("click", () => {
    memoryEditingCardId = null;
    memoryViewMode = "study";
    renderMemoryView();
  });
  memorySaveCardButton?.addEventListener("click", saveMemoryCardFromEditor);
  memoryDeleteCardButton?.addEventListener("click", deleteMemoryCardFromEditor);
  memoryTypeInput?.addEventListener("keydown", (event) => {
    // 中文输入法还在拼写时按回车是「选词」，不能当成提交类型名
    if (event.isComposing || event.keyCode === 229) {
      return;
    }
    if (event.key === "Enter" || event.key === "," || event.key === "，" || event.key === "、") {
      event.preventDefault();
      commitMemoryTypeInput();
      return;
    }
    // 空输入按退格删掉最后一个类型，和常见标签输入一致
    if (event.key === "Backspace" && !memoryTypeInput.value && memoryEditorTypes.length > 0) {
      event.preventDefault();
      memoryEditorTypes = memoryEditorTypes.slice(0, -1);
      renderMemoryTypeChips();
    }
  });
  memoryTypeInput?.addEventListener("input", renderMemoryTypeSuggestions);
  // 点到别处（比如直接点保存）时把没回车的类型一起收下；
  // 但切窗口造成的 blur 不算，免得输入一半的类型被 Alt+Tab 切成 chip。
  memoryTypeInput?.addEventListener("blur", () => {
    if (document.hasFocus()) {
      commitMemoryTypeInput();
    }
  });
  memoryResetSettingsButton?.addEventListener("click", resetMemorySettingsInputs);
  memoryCancelSettingsButton?.addEventListener("click", () => {
    memoryViewMode = "study";
    renderMemoryView();
  });
  memorySaveSettingsButton?.addEventListener("click", saveMemorySettingsFromPanel);
  for (const button of document.querySelectorAll("[data-memory-rating]")) {
    button.addEventListener("click", () => rateMemoryCard(button.dataset.memoryRating));
  }
  // 切换笔记库时主进程会整组换牌，这里跟着换快照；当前卡失效就回退到队首。
  window.noticeNote?.onMemoryChanged?.((snapshot) => {
    applyMemorySnapshot(snapshot);
    memorySnapshotDay = currentMemoryDayStamp();
    if (!getMemoryCardById(memoryCurrentCardId)) {
      memoryCurrentCardId = getMemoryQueueIds()[0] || snapshot.cards[0]?.id || null;
      memoryRevealed = false;
    }
    // 切库或别处删卡后，正在编辑的卡可能已经不在了：退回学习页，
    // 免得编辑面板挂着上一副牌组的内容。
    if (memoryViewMode === "editor" && memoryEditingCardId && !getMemoryCardById(memoryEditingCardId)) {
      memoryEditingCardId = null;
      memoryViewMode = "study";
      memoryRevealed = false;
    }
    if (sidebarViewMode === "memory") {
      renderMemorySidebar();
    }
    if (memoryView && !memoryView.hidden) {
      renderMemoryView();
    }
  });
  // 快速建卡弹框：笔记右键进入，字段与编辑器同款但状态独立（见上方 memoryQuick* 一组）。
  memoryQuickCloseButton?.addEventListener("click", () => memoryQuickDialog?.close());
  memoryQuickCancelButton?.addEventListener("click", () => memoryQuickDialog?.close());
  memoryQuickSaveButton?.addEventListener("click", saveMemoryQuickCardFromDialog);
  memoryQuickDialog?.addEventListener("close", () => {
    // 关掉即清场，下次打开从新笔记重新预填，不残留上一篇的类型
    memoryQuickNoteId = null;
    memoryQuickTypes = [];
    if (memoryQuickTypeInput) {
      memoryQuickTypeInput.value = "";
    }
  });
  memoryQuickDialog?.addEventListener("keydown", (event) => {
    if (event.isComposing || event.keyCode === 229) {
      return;
    }
    // Ctrl / Cmd + Enter 保存；纯 Enter 留给 textarea 换行
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      saveMemoryQuickCardFromDialog();
    }
  });
  memoryQuickTypeInput?.addEventListener("keydown", (event) => {
    if (event.isComposing || event.keyCode === 229) {
      return;
    }
    if (event.key === "Enter" || event.key === "," || event.key === "，" || event.key === "、") {
      event.preventDefault();
      addMemoryQuickTypes(memoryQuickTypeInput.value);
      return;
    }
    if (event.key === "Backspace" && !memoryQuickTypeInput.value && memoryQuickTypes.length > 0) {
      event.preventDefault();
      memoryQuickTypes = memoryQuickTypes.slice(0, -1);
      renderMemoryQuickTypes();
    }
  });
  memoryQuickTypeInput?.addEventListener("input", renderMemoryQuickTypeSuggestions);
  memoryQuickTypeInput?.addEventListener("blur", () => {
    // 切换窗口造成的 blur 不算，否则输入一半的类型被 Alt+Tab 切成 chip
    if (document.hasFocus() && memoryQuickTypeInput.value.trim()) {
      addMemoryQuickTypes(memoryQuickTypeInput.value);
    }
  });
  document.addEventListener("keydown", handleMemoryKeydown);

  // 应用一直开着跨过零点时，昨晚的数字会一直挂着。回到窗口时对一次日期。
  window.addEventListener("focus", () => {
    if (sidebarViewMode !== "memory" && (!memoryView || memoryView.hidden)) {
      return;
    }
    ensureMemorySnapshot()
      .then((snapshot) => {
        applyMemorySnapshot(snapshot);
        if (sidebarViewMode === "memory") {
          renderMemorySidebar();
        }
        if (!memoryView || memoryView.hidden) {
          return;
        }
        // 正在编辑卡片或改参数时只刷统计，不重画面板：
        // 重画会把输入框写回快照值，Alt+Tab 切回来刚敲的内容就没了。
        if (memoryViewMode === "study") {
          renderMemoryView();
        } else {
          renderMemoryStats();
        }
      })
      .catch((error) => console.error("刷新记忆卡快照失败:", error));
  });
}

bindMemoryCardEvents();
