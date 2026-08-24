const noteList = document.querySelector("#noteList");
const titleInput = document.querySelector("#titleInput");
const reminderInput = document.querySelector("#reminderInput");
const reminderList = document.querySelector("#reminderList");
const editorRoot = document.querySelector("#editorRoot");
const contentShell = document.querySelector("#contentShell");
const saveButton = document.querySelector("#saveButton");
const saveStatus = document.querySelector("#saveStatus");
const newNoteButton = document.querySelector("#newNoteButton");
const addReminderButton = document.querySelector("#addReminderButton");
const deleteNoteButton = document.querySelector("#deleteNoteButton");
const autoReminderButton = document.querySelector("#autoReminderButton");
const reminderDialog = document.querySelector("#reminderDialog");
const openReminderConfigButton = document.querySelector(
  "#openReminderConfigButton",
);
const closeReminderDialogButton = document.querySelector(
  "#closeReminderDialogButton",
);
const reminderButtonCount = document.querySelector("#reminderButtonCount");
const reminderDialogCount = document.querySelector("#reminderDialogCount");
const reminderDialogNoteTitle = document.querySelector(
  "#reminderDialogNoteTitle",
);
const sidebar = document.querySelector("#sidebar");
const toggleSidebarButton = document.querySelector("#toggleSidebarButton");
const showSidebarButton = document.querySelector("#showSidebarButton");
const sidebarResizer = document.querySelector("#sidebarResizer");
const editorPanel = document.querySelector(".editor-panel");
const editorTopbar = document.querySelector("#editorTopbar");
const refreshButton = document.querySelector("#refreshButton");
const locateCurrentFileButton = document.querySelector(
  "#locateCurrentFileButton",
);
const settingsButton = document.querySelector("#settingsButton");
const settingsDialog = document.querySelector("#settingsDialog");
const closeSettingsDialogButton = document.querySelector(
  "#closeSettingsDialogButton",
);
const dailyReviewEnabledInput = document.querySelector(
  "#dailyReviewEnabledInput",
);
const dailyReviewCurrentTitle = document.querySelector(
  "#dailyReviewCurrentTitle",
);
const settingsMainView = document.querySelector("#settingsMainView");
const settingsThemePickerView = document.querySelector(
  "#settingsThemePickerView",
);
const openThemePickerButton = document.querySelector("#openThemePickerButton");
const backToSettingsMainButton = document.querySelector(
  "#backToSettingsMainButton",
);
const closeSettingsDialogButton2 = document.querySelector(
  "#closeSettingsDialogButton2",
);
const themePickerGrid = document.querySelector("#themePickerGrid");
const themePickerTabs = document.querySelectorAll(".theme-picker-tab");
const currentThemePreview = document.querySelector("#currentThemePreview");
const currentThemeName = document.querySelector("#currentThemeName");
const currentThemeDesc = document.querySelector("#currentThemeDesc");
const settingsStoragePath = document.querySelector("#settingsStoragePath");
const exportMobilePackageButton = document.querySelector(
  "#exportMobilePackageButton",
);
const exportMobilePackageStatus = document.querySelector(
  "#exportMobilePackageStatus",
);
const chooseStorageButton = document.querySelector("#chooseStorageButton");
const resetStorageButton = document.querySelector("#resetStorageButton");
const newMenuDropdown = document.querySelector("#newMenuDropdown");
const newNoteOption = document.querySelector("#newNoteOption");
const newFolderOption = document.querySelector("#newFolderOption");
const breadcrumb = document.querySelector("#breadcrumb");
const noteListSearch = document.querySelector("#noteListSearch");
const noteSearchInput = document.querySelector("#noteSearchInput");
const showAllFilesButton = document.querySelector("#showAllFilesButton");
const showReminderCalendarButton = document.querySelector(
  "#showReminderCalendarButton",
);
const showDailyReviewButton = document.querySelector("#showDailyReviewButton");
const pdfViewer = document.querySelector("#pdfViewer");
const pdfTitle = document.querySelector("#pdfTitle");
const pdfMeta = document.querySelector("#pdfMeta");
const pdfPath = document.querySelector("#pdfPath");
const pdfPages = document.querySelector("#pdfPages");
const pdfPageCount = document.querySelector("#pdfPageCount");
const pdfZoomOut = document.querySelector("#pdfZoomOut");
const pdfZoomIn = document.querySelector("#pdfZoomIn");
const pdfZoomValue = document.querySelector("#pdfZoomValue");
const pdfOutline = document.querySelector("#pdfOutline");
const pdfOutlineList = document.querySelector("#pdfOutlineList");
const pdfOutlineToggle = document.querySelector("#pdfOutlineToggle");
const pdfOutlineResizer = document.querySelector("#pdfOutlineResizer");
const workspaceTabsRoot = document.querySelector("#workspaceTabs");
const notificationBell = document.querySelector("#notificationBell");
const notificationDot = document.querySelector("#notificationDot");
const notificationPanel = document.querySelector("#notificationPanel");
const notificationList = document.querySelector("#notificationList");
const fileViewer = document.querySelector("#fileViewer");
const fileViewerIcon = document.querySelector("#fileViewerIcon");
const fileViewerTitle = document.querySelector("#fileViewerTitle");
const fileViewerMeta = document.querySelector("#fileViewerMeta");
const fileViewerType = document.querySelector("#fileViewerType");
const fileViewerPath = document.querySelector("#fileViewerPath");
const fileViewerContent = document.querySelector("#fileViewerContent");
const fileViewerToast = document.querySelector("#fileViewerToast");
const fileViewerReadOnlyNotice = document.querySelector(
  "#fileViewerReadOnlyNotice",
);
const fileViewerActions = document.querySelector("#fileViewerActions");
const fileViewerEditButton = document.querySelector("#fileViewerEditButton");
const fileViewerSaveButton = document.querySelector("#fileViewerSaveButton");
const fileViewerAddRowButton = document.querySelector("#fileViewerAddRowButton");
const fileViewerAddColButton = document.querySelector("#fileViewerAddColButton");
const fileViewerOpenExternalButton = document.querySelector("#fileViewerOpenExternalButton");
let isFileEditingMode = false;
let fileViewerToastTimer = null;
let skipNextFileReload = false;
const newDraftOption = document.querySelector("#newDraftOption");
const newDraftQuickButton = document.querySelector("#newDraftQuickButton");
const draftSaveDialog = document.querySelector("#draftSaveDialog");
const cancelDraftSaveDialogButton = document.querySelector("#cancelDraftSaveDialogButton");
const draftTitleInput = document.querySelector("#draftTitleInput");
const draftFolderSelect = document.querySelector("#draftFolderSelect");
const draftFileTypeSelect = document.querySelector("#draftFileTypeSelect");
const discardDraftButton = document.querySelector("#discardDraftButton");
const cancelDraftButton = document.querySelector("#cancelDraftButton");
const confirmSaveDraftButton = document.querySelector("#confirmSaveDraftButton");
const wordOutline = document.querySelector("#wordOutline");
const wordOutlineList = document.querySelector("#wordOutlineList");
const wordOutlineToggle = document.querySelector("#wordOutlineToggle");
const viewerSearchBar = document.querySelector("#viewerSearchBar");
const viewerSearchInput = document.querySelector("#viewerSearchInput");
const viewerSearchCount = document.querySelector("#viewerSearchCount");
const viewerSearchPrevious = document.querySelector("#viewerSearchPrevious");
const viewerSearchNext = document.querySelector("#viewerSearchNext");
const viewerSearchClose = document.querySelector("#viewerSearchClose");
const dailyReviewBar = document.querySelector("#dailyReviewBar");
const dailyReviewLastTime = document.querySelector("#dailyReviewLastTime");
const deferDailyReviewButton = document.querySelector(
  "#deferDailyReviewButton",
);
const completeDailyReviewButton = document.querySelector(
  "#completeDailyReviewButton",
);
const imageLightbox = document.querySelector("#imageLightbox");
const imageLightboxStage = document.querySelector("#imageLightboxStage");
const imageLightboxImage = document.querySelector("#imageLightboxImage");
const closeImageLightboxButton = document.querySelector(
  "#closeImageLightboxButton",
);
const zoomOutImageLightboxButton = document.querySelector(
  "#zoomOutImageLightboxButton",
);
const zoomInImageLightboxButton = document.querySelector(
  "#zoomInImageLightboxButton",
);
let notes = [];
let folders = [];
let pdfFiles = [];
let resourceFiles = [];
let activeNoteId = null;
let activePdfId = null;
let activeResourceId = null;
let activeFolderId = null;
let sidebarViewMode = "all";
let reminderCalendarMonth = new Date(
  new Date().getFullYear(),
  new Date().getMonth(),
  1,
);
let selectedReminderDate = toLocalDateKey(new Date());
const noteSaveStates = new Map();
let noteRecoveryLogCache = null;
let storageInfo = null;
let appSettings = null;
let markdownEditor = null;
let isRenderingEditor = false;
const blurRevealState = { revealed: new Map() };
let pdfLoadingTask = null;
let pdfDocument = null;
let pdfPreviewKey = null;
let pdfPreviewReadyKey = null;
let pdfPreviewPromise = null;
let pdfOutlineEntries = [];
let pdfOutlineIndexVersion = 0;
let pdfOutlineHighlightFrame = null;
let activePdfOutlineButton = null;
let pdfZoom = 1;
let pdfLoadVersion = 0;
let pdfPageRenderVersion = 0;
let imageZoom = 1;
let workspaceTabs = [];
let activeWorkspaceTabKey = null;
let draggedWorkspaceTabKey = null;
let workspaceTabDragStartedAt = 0;
let workspaceTabPointerDrag = null;
let workspaceContentRenderVersion = 0;
const workspaceTabViewStates = new Map();
let filePreviewVersion = 0;
let draftsMap = new Map();
let activeDraftId = null;
let pendingCloseDraftId = null;
let pendingCloseTabKey = null;
let wordOutlineHeadings = [];
let wordOutlineHighlightFrame = null;
let viewerSearchMatches = [];
let activeViewerSearchIndex = -1;
const SIDEBAR_COLLAPSED_KEY = "notice-note:sidebar-collapsed";
const SIDEBAR_WIDTH_KEY = "notice-note:sidebar-width";
const SIDEBAR_MIN_WIDTH = 200;
const SIDEBAR_MAX_WIDTH = 600;
const PDF_OUTLINE_WIDTH_KEY = "notice-note:pdf-outline-width";
const PDF_OUTLINE_MIN_WIDTH = 160;
const PDF_OUTLINE_MAX_WIDTH = 600;
const INTERFACE_THEME_KEY = "notice-note:interface-theme";
const DRAFTS_PERSIST_KEY = "notice-note:drafts";
const WORKSPACE_TABS_PERSIST_KEY = "notice-note:workspace-tabs";
const ACTIVE_TAB_PERSIST_KEY = "notice-note:active-workspace-tab";
const NOTE_RECOVERY_PERSIST_KEY = "notice-note:recovery-log:v1";
const THEME_LIST = [
  {
    id: "paper",
    name: "暖色纸张",
    category: "minimal",
    desc: "柔和米色，保持经典纸张质感",
    avatar: "",
  },
  {
    id: "blue",
    name: "清爽蓝",
    category: "minimal",
    desc: "明亮简洁，层次更清晰",
    avatar: "",
  },
  {
    id: "mint",
    name: "薄荷绿",
    category: "minimal",
    desc: "自然淡雅，阅读更舒缓",
    avatar: "",
  },
  {
    id: "dark",
    name: "暗夜极客",
    category: "minimal",
    desc: "深色极简，夜间沉浸高效",
    avatar: "",
  },
  {
    id: "miku",
    name: "初音未来",
    category: "anime",
    desc: "葱绿元气二次元偶像",
    avatar: "./assets/themes/miku.jpg",
  },
  {
    id: "sakura",
    name: "霓虹樱花",
    category: "anime",
    desc: "梦幻浪漫樱粉与夜色少女",
    avatar: "./assets/themes/sakura.jpg",
  },
  {
    id: "violet",
    name: "永恒之紫",
    category: "anime",
    desc: "优雅紫罗兰魔女治愈风",
    avatar: "./assets/themes/violet.jpg",
  },
  {
    id: "cyberpunk",
    name: "赛博朋克",
    category: "gaming",
    desc: "高能霓虹姬与夜幕暗紫",
    avatar: "./assets/themes/cyberpunk.jpg",
  },
  {
    id: "pixel",
    name: "复古 GameBoy",
    category: "gaming",
    desc: "8-Bit 像素小勇者与红白机回忆",
    avatar: "./assets/themes/pixel.jpg",
  },
  {
    id: "nte_city",
    name: "异环·海拉都市",
    category: "gaming",
    desc: "《异环》海拉都市夜景与荧光青异能",
    avatar: "./assets/themes/nte_city.jpg",
  },
  {
    id: "nte_mint",
    name: "异环·薄荷异象",
    category: "gaming",
    desc: "《异环》薄荷助手与异像古董店特别配色",
    avatar: "./assets/themes/nte_mint.jpg",
  },
  {
    id: "nte_anomaly",
    name: "异环·异象警告",
    category: "gaming",
    desc: "《异环》都市异象收容警告与黑黄警戒",
    avatar: "./assets/themes/nte_city.jpg",
  },
  {
    id: "nte_eloi",
    name: "异环·伊洛伊",
    category: "gaming",
    desc: "《异环》伊洛伊（薄绿发·黑粉犄角·灵属性），多小人立绘与炫彩爆棚",
    avatar: "./assets/themes/nte_eloi.png",
  },
  {
    id: "crimson",
    name: "暗黑血色",
    category: "gaming",
    desc: "深邃龙姬与炽热血红游戏风",
    avatar: "./assets/themes/crimson.jpg",
  },
];
const INTERFACE_THEMES = new Set(THEME_LIST.map((t) => t.id));
let activeThemeCategory = "all";
const REMINDER_NOTIFICATIONS_KEY = "notice-note:reminder-notifications";
const DAILY_REMINDER_SLOTS = ["09:30", "15:00"];
let reminderNotifications = readReminderNotifications();
const editorEmptyState = document.createElement("div");
editorEmptyState.className = "editor-empty-state";
editorEmptyState.hidden = true;
editorEmptyState.innerHTML =
  "<h2>欢迎使用 Notice Note</h2><p>从左侧打开一个文件，或点击左上角 + 新建内容。</p>";
contentShell.append(editorEmptyState);

let imageLightboxPreviousFocus = null;
let imageLightboxZoom = 1;
const IMAGE_LIGHTBOX_MIN_ZOOM = 0.25;
const IMAGE_LIGHTBOX_MAX_ZOOM = 5;

function updateImageLightboxZoomControls() {
  const canZoom = Number(imageLightboxImage.dataset.baseWidth) > 0;
  zoomOutImageLightboxButton.disabled =
    !canZoom || imageLightboxZoom <= IMAGE_LIGHTBOX_MIN_ZOOM;
  zoomInImageLightboxButton.disabled =
    !canZoom || imageLightboxZoom >= IMAGE_LIGHTBOX_MAX_ZOOM;
}

function resetImageLightboxZoom() {
  imageLightboxZoom = 1;
  delete imageLightboxImage.dataset.baseWidth;
  delete imageLightboxImage.dataset.baseHeight;
  imageLightboxImage.style.width = "";
  imageLightboxImage.style.height = "";
  imageLightboxImage.style.maxWidth = "";
  imageLightboxImage.style.maxHeight = "";
  imageLightboxStage.scrollTop = 0;
  imageLightboxStage.scrollLeft = 0;
  updateImageLightboxZoomControls();
}

function captureImageLightboxBaseSize() {
  const rect = imageLightboxImage.getBoundingClientRect();
  if (!rect.width || !rect.height) {
    return;
  }
  imageLightboxImage.dataset.baseWidth = String(rect.width);
  imageLightboxImage.dataset.baseHeight = String(rect.height);
  updateImageLightboxZoomControls();
}

function changeImageLightboxZoom(step) {
  const baseWidth = Number(imageLightboxImage.dataset.baseWidth);
  const baseHeight = Number(imageLightboxImage.dataset.baseHeight);
  if (!baseWidth || !baseHeight) {
    return;
  }
  const nextZoom = Math.min(
    IMAGE_LIGHTBOX_MAX_ZOOM,
    Math.max(IMAGE_LIGHTBOX_MIN_ZOOM, imageLightboxZoom + step),
  );
  if (nextZoom === imageLightboxZoom) {
    return;
  }
  imageLightboxZoom = nextZoom;
  imageLightboxImage.style.maxWidth = "none";
  imageLightboxImage.style.maxHeight = "none";
  imageLightboxImage.style.width = `${baseWidth * imageLightboxZoom}px`;
  imageLightboxImage.style.height = `${baseHeight * imageLightboxZoom}px`;
  updateImageLightboxZoomControls();
}

function openImageLightbox(image) {
  const src = image.currentSrc || image.src;
  if (!src) {
    return;
  }
  imageLightboxPreviousFocus = document.activeElement;
  resetImageLightboxZoom();
  imageLightboxImage.src = src;
  imageLightboxImage.alt = image.alt || "图片预览";
  imageLightbox.hidden = false;
  document.body.classList.add("image-lightbox-open");
  if (imageLightboxImage.complete) {
    captureImageLightboxBaseSize();
  } else {
    imageLightboxImage.addEventListener("load", captureImageLightboxBaseSize, {
      once: true,
    });
  }
  closeImageLightboxButton.focus();
}

function closeImageLightbox() {
  if (imageLightbox.hidden) {
    return;
  }
  imageLightbox.hidden = true;
  resetImageLightboxZoom();
  imageLightboxImage.removeAttribute("src");
  imageLightboxImage.alt = "";
  document.body.classList.remove("image-lightbox-open");
  if (imageLightboxPreviousFocus?.isConnected) {
    imageLightboxPreviousFocus.focus();
  }
  imageLightboxPreviousFocus = null;
}

function trapImageLightboxFocus(event) {
  const controls = [
    ...imageLightbox.querySelectorAll("button:not(:disabled)"),
  ];
  if (controls.length === 0) {
    return;
  }
  const firstControl = controls[0];
  const lastControl = controls[controls.length - 1];
  const activeElement = document.activeElement;
  const shouldWrapBackward =
    event.shiftKey &&
    (activeElement === firstControl || !imageLightbox.contains(activeElement));
  const shouldWrapForward =
    !event.shiftKey &&
    (activeElement === lastControl || !imageLightbox.contains(activeElement));
  if (controls.length === 1 || shouldWrapBackward || shouldWrapForward) {
    event.preventDefault();
    (event.shiftKey ? lastControl : firstControl).focus();
  }
}

function resolveNoteImageSrc(src) {
  const imageSource = String(src || "").trim();
  if (!imageSource || /^(?:[a-z][a-z\d+.-]*:|\/\/|\/|#)/i.test(imageSource)) {
    return imageSource;
  }

  const activeNote = getActiveNote();
  if (!activeNote?.sourceUrl || !storageInfo?.notesUrl) {
    return imageSource;
  }

  try {
    const resolvedUrl = new URL(imageSource, activeNote.sourceUrl);
    return resolvedUrl.href.startsWith(storageInfo.notesUrl)
      ? resolvedUrl.href
      : "";
  } catch {
    return "";
  }
}

function readBooleanSetting(key) {
  return localStorage.getItem(key) === "true";
}

function getInterfaceTheme() {
  const savedTheme = localStorage.getItem(INTERFACE_THEME_KEY);
  return INTERFACE_THEMES.has(savedTheme) ? savedTheme : "paper";
}

function updateThemeSummaryCard(themeId) {
  const info = THEME_LIST.find((t) => t.id === themeId) || THEME_LIST[0];
  if (currentThemePreview) {
    if (info.avatar) {
      currentThemePreview.className = `settings-theme-preview theme-preview-${info.id} has-avatar`;
      currentThemePreview.innerHTML = `<img class="theme-avatar-img" src="${info.avatar}" alt="${info.name}">`;
    } else {
      currentThemePreview.className = `settings-theme-preview theme-preview-${info.id}`;
      currentThemePreview.innerHTML = `<i></i><i></i><i></i>`;
    }
  }
  if (currentThemeName) currentThemeName.textContent = info.name;
  if (currentThemeDesc) currentThemeDesc.textContent = info.desc;
}

function applyInterfaceTheme(theme) {
  const nextTheme = INTERFACE_THEMES.has(theme) ? theme : "paper";
  document.body.dataset.theme = nextTheme;
  localStorage.setItem(INTERFACE_THEME_KEY, nextTheme);
  updateThemeSummaryCard(nextTheme);
}

function renderThemePickerGrid() {
  if (!themePickerGrid) return;
  const allCount = THEME_LIST.length;
  const minimalCount = THEME_LIST.filter((t) => t.category === "minimal").length;
  const animeCount = THEME_LIST.filter((t) => t.category === "anime").length;
  const gamingCount = THEME_LIST.filter((t) => t.category === "gaming").length;

  themePickerTabs.forEach((tab) => {
    const cat = tab.dataset.category;
    const isActive = cat === activeThemeCategory;
    tab.classList.toggle("is-active", isActive);
    tab.setAttribute("aria-pressed", String(isActive));
    if (cat === "all") tab.textContent = `全部 (${allCount})`;
    else if (cat === "minimal") tab.textContent = `🌿 极简日常 (${minimalCount})`;
    else if (cat === "anime") tab.textContent = `🌸 二次元动漫 (${animeCount})`;
    else if (cat === "gaming") tab.textContent = `🎮 游戏电竞 (${gamingCount})`;
  });

  const currentTheme = getInterfaceTheme();
  const filtered =
    activeThemeCategory === "all"
      ? THEME_LIST
      : THEME_LIST.filter((t) => t.category === activeThemeCategory);

  themePickerGrid.innerHTML = filtered
    .map((t) => {
      const isSelected = t.id === currentTheme;
      const categoryBadge =
        t.category === "anime"
          ? "🌸 二次元"
          : t.category === "gaming"
            ? "🎮 游戏"
            : "🌿 极简";
      const previewHtml = t.avatar
        ? `<span class="settings-theme-preview theme-preview-${t.id} has-avatar" aria-hidden="true"><img class="theme-avatar-img" src="${t.avatar}" alt="${t.name}"></span>`
        : `<span class="settings-theme-preview theme-preview-${t.id}" aria-hidden="true"><i></i><i></i><i></i></span>`;

      return `
      <button class="theme-picker-card-item ${isSelected ? "is-selected" : ""}" type="button" data-theme-id="${t.id}" aria-label="应用主题：${t.name}。${t.desc}" aria-pressed="${isSelected}">
        ${previewHtml}
        <span class="theme-picker-card-info">
          <span class="theme-picker-card-header">
            <strong>${t.name}</strong>
            <span class="theme-category-badge category-${t.category}">${categoryBadge}</span>
          </span>
          <small>${t.desc}</small>
        </span>
        ${isSelected ? '<span class="theme-applied-badge">✓ 当前应用</span>' : '<span class="theme-apply-btn">使用</span>'}
      </button>
    `;
    })
    .join("");

  themePickerGrid
    .querySelectorAll(".theme-picker-card-item")
    .forEach((card) => {
      card.addEventListener("click", () => {
        const themeId = card.dataset.themeId;
        applyInterfaceTheme(themeId);
        renderThemePickerGrid();
      });
    });
}

function writeBooleanSetting(key, value) {
  localStorage.setItem(key, value ? "true" : "false");
}

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

function setPdfOutlineWidth(width) {
  const clamped = Math.max(
    PDF_OUTLINE_MIN_WIDTH,
    Math.min(PDF_OUTLINE_MAX_WIDTH, width),
  );
  pdfOutline.style.flexBasis = `${clamped}px`;
  localStorage.setItem(PDF_OUTLINE_WIDTH_KEY, String(clamped));
}

function initPdfOutlineResizer() {
  const savedWidth = Number(localStorage.getItem(PDF_OUTLINE_WIDTH_KEY));
  if (Number.isFinite(savedWidth)) {
    setPdfOutlineWidth(savedWidth);
  }

  let isResizing = false;
  let startX = 0;
  let startWidth = 0;

  pdfOutlineResizer.addEventListener("pointerdown", (event) => {
    if (pdfOutline.hidden || event.button !== 0) {
      return;
    }
    event.preventDefault();
    isResizing = true;
    startX = event.clientX;
    startWidth = pdfOutline.offsetWidth;
    pdfOutlineResizer.setPointerCapture(event.pointerId);
    pdfOutlineResizer.classList.add("is-resizing");
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  });

  pdfOutlineResizer.addEventListener("pointermove", (event) => {
    if (!isResizing) {
      return;
    }
    setPdfOutlineWidth(startWidth + event.clientX - startX);
  });

  const stopResizing = () => {
    if (!isResizing) {
      return;
    }
    isResizing = false;
    pdfOutlineResizer.classList.remove("is-resizing");
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  };

  pdfOutlineResizer.addEventListener("pointerup", stopResizing);
  pdfOutlineResizer.addEventListener("pointercancel", stopResizing);
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

function getNoteSearchKeyword() {
  return noteSearchInput?.value.trim().toLocaleLowerCase("zh-CN") || "";
}

function clearNoteListSearch() {
  if (noteSearchInput) {
    noteSearchInput.value = "";
  }
}

function includesNoteSearchKeyword(value, keyword) {
  return String(value || "")
    .toLocaleLowerCase("zh-CN")
    .includes(keyword);
}

function getSearchFolderIds() {
  const folderIds = new Set([activeFolderId]);
  const childrenByParent = new Map();
  for (const folder of folders) {
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

function getFilteredNotes() {
  const keyword = getNoteSearchKeyword();
  const searchFolderIds = keyword && sidebarViewMode === "all"
    ? getSearchFolderIds()
    : null;
  const visibleNotes = sidebarViewMode === "reminder"
    ? notes.filter((note) => note.isReminderFile)
    : notes.filter((note) => searchFolderIds
      ? searchFolderIds.has(note.folderId)
      : note.folderId === activeFolderId);
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
    ? resourceFiles.filter((file) => file.isReminderFile)
    : resourceFiles.filter((file) => searchFolderIds
      ? searchFolderIds.has(file.folderId)
      : file.folderId === activeFolderId);
  if (!keyword) {
    return visibleResources;
  }
  return visibleResources.filter((file) =>
    includesNoteSearchKeyword(file.name, keyword),
  );
}

function getWorkspaceTabKey(type, id) {
  return `${type}:${id}`;
}

function getWorkspaceTabResource(tab) {
  if (tab.type === "draft") {
    return draftsMap.get(tab.id) || null;
  }
  if (tab.type === "pdf") {
    return pdfFiles.find((pdf) => pdf.id === tab.id);
  }
  if (tab.type === "file") {
    return resourceFiles.find((file) => file.id === tab.id);
  }
  return notes.find((note) => note.id === tab.id);
}

function findSidebarEntry(selector, datasetKey, value) {
  return (
    [...noteList.querySelectorAll(selector)].find(
      (item) => item.dataset[datasetKey] === value,
    ) || null
  );
}

function syncSidebarToWorkspaceTab(tab) {
  const resource = getWorkspaceTabResource(tab);
  if (!resource || !noteList) {
    return;
  }

  const nextFolderId = resource.folderId || null;
  setSidebarViewMode("all", false);
  if (activeFolderId !== nextFolderId) {
    activeFolderId = nextFolderId;
  }
  renderBreadcrumb();
  renderNoteList();

  if (tab.type === "draft") {
    return;
  }

  const target =
    tab.type === "note"
      ? findSidebarEntry("[data-note-id]", "noteId", tab.id)
      : findSidebarEntry("[data-file-id]", "fileId", tab.id);
  target?.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function renderWorkspaceTabs() {
  if (draggedWorkspaceTabKey) {
    return;
  }
  workspaceTabsRoot.innerHTML = "";
  locateCurrentFileButton.disabled = !activeWorkspaceTabKey;

  for (const tab of workspaceTabs) {
    const resource = getWorkspaceTabResource(tab);
    if (!resource) {
      continue;
    }

    const tabKey = getWorkspaceTabKey(tab.type, tab.id);
    const item = document.createElement("div");
    item.className = `workspace-tab${tabKey === activeWorkspaceTabKey ? " is-active" : ""}`;
    item.dataset.tabKey = tabKey;

    const mainButton = document.createElement("button");
    mainButton.className = "workspace-tab-main";
    mainButton.type = "button";
    mainButton.setAttribute("role", "tab");
    mainButton.setAttribute(
      "aria-selected",
      String(tabKey === activeWorkspaceTabKey),
    );
    mainButton.title =
      tab.type === "note"
        ? resource.title
        : tab.type === "draft"
          ? resource.title || "未命名草稿 (临时)"
          : resource.path;

    const icon = document.createElement("span");
    const iconType =
      tab.type === "note"
        ? resource.fileType
        : tab.type === "draft"
          ? "draft"
          : resource.kind;
    icon.className = `workspace-tab-icon ${iconType}`;
    icon.textContent =
      tab.type === "note"
        ? resource.fileType.toUpperCase()
        : tab.type === "draft"
          ? "草稿"
          : resource.typeLabel;

    const label = document.createElement("span");
    label.className = "workspace-tab-label";
    label.textContent =
      tab.type === "note"
        ? resource.title || "未命名笔记"
        : tab.type === "draft"
          ? resource.title || "未命名草稿"
          : resource.name;

    const closeButton = document.createElement("button");
    closeButton.className = "workspace-tab-close";
    closeButton.type = "button";
    closeButton.title = "关闭标签";
    closeButton.setAttribute("aria-label", `关闭 ${label.textContent}`);
    closeButton.textContent = "×";

    mainButton.append(icon, label);
    mainButton.addEventListener("click", () => {
      if (Date.now() - workspaceTabDragStartedAt < 250) {
        return;
      }
      activateWorkspaceTab(tab.type, tab.id).catch(console.error);
    });
    mainButton.addEventListener("pointerdown", (event) => {
      beginWorkspaceTabPointerDrag(event, item, tabKey);
    });
    mainButton.addEventListener("pointermove", updateWorkspaceTabPointerDrag);
    mainButton.addEventListener("pointerup", finishWorkspaceTabPointerDrag);
    mainButton.addEventListener("pointercancel", cancelWorkspaceTabPointerDrag);
    closeButton.addEventListener("click", () => {
      closeWorkspaceTab(tabKey).catch(console.error);
    });
    item.append(mainButton, closeButton);
    workspaceTabsRoot.append(item);
  }
  renderDailyReviewBar();
}

function beginWorkspaceTabPointerDrag(event, item, tabKey) {
  if (event.button !== 0 || workspaceTabPointerDrag) {
    return;
  }
  workspaceTabPointerDrag = {
    pointerId: event.pointerId,
    source: event.currentTarget,
    item,
    tabKey,
    startX: event.clientX,
    startY: event.clientY,
    targetTabKey: null,
    placeAfter: false,
    started: false,
  };
  event.currentTarget.setPointerCapture(event.pointerId);
}

function updateWorkspaceTabPointerDrag(event) {
  const drag = workspaceTabPointerDrag;
  if (!drag || drag.pointerId !== event.pointerId) {
    return;
  }

  if (!drag.started) {
    const distance = Math.hypot(
      event.clientX - drag.startX,
      event.clientY - drag.startY,
    );
    if (distance < 6) {
      return;
    }
    drag.started = true;
    draggedWorkspaceTabKey = drag.tabKey;
    workspaceTabDragStartedAt = Date.now();
    drag.item.classList.add("is-dragging");
  }

  event.preventDefault();
  clearWorkspaceTabDropIndicators();
  drag.item.classList.add("is-dragging");
  const target = document
    .elementFromPoint(event.clientX, event.clientY)
    ?.closest(".workspace-tab");
  const targetTabKey = target?.dataset.tabKey || null;
  if (!target || !targetTabKey || targetTabKey === drag.tabKey) {
    drag.targetTabKey = null;
    return;
  }

  const bounds = target.getBoundingClientRect();
  drag.targetTabKey = targetTabKey;
  drag.placeAfter = event.clientX >= bounds.left + bounds.width / 2;
  target.classList.add(drag.placeAfter ? "is-drop-after" : "is-drop-before");
}

function finishWorkspaceTabPointerDrag(event) {
  const drag = workspaceTabPointerDrag;
  if (!drag || drag.pointerId !== event.pointerId) {
    return;
  }
  updateWorkspaceTabPointerDrag(event);
  if (drag.source.hasPointerCapture(event.pointerId)) {
    drag.source.releasePointerCapture(event.pointerId);
  }
  workspaceTabPointerDrag = null;
  draggedWorkspaceTabKey = null;
  clearWorkspaceTabDropIndicators();
  if (!drag.started) {
    return;
  }

  event.preventDefault();
  workspaceTabDragStartedAt = Date.now();
  if (drag.targetTabKey) {
    reorderWorkspaceTabs(drag.tabKey, drag.targetTabKey, drag.placeAfter);
  }
}

function cancelWorkspaceTabPointerDrag(event) {
  const drag = workspaceTabPointerDrag;
  if (!drag || drag.pointerId !== event.pointerId) {
    return;
  }
  if (drag.source.hasPointerCapture(event.pointerId)) {
    drag.source.releasePointerCapture(event.pointerId);
  }
  workspaceTabPointerDrag = null;
  draggedWorkspaceTabKey = null;
  clearWorkspaceTabDropIndicators();
}

function clearWorkspaceTabDropIndicators() {
  workspaceTabsRoot.querySelectorAll(".workspace-tab").forEach((item) => {
    item.classList.remove("is-dragging", "is-drop-before", "is-drop-after");
  });
}

function reorderWorkspaceTabs(draggedTabKey, targetTabKey, placeAfter) {
  const draggedIndex = workspaceTabs.findIndex((tab) => {
    return getWorkspaceTabKey(tab.type, tab.id) === draggedTabKey;
  });
  if (draggedIndex < 0) {
    return;
  }
  const [draggedTab] = workspaceTabs.splice(draggedIndex, 1);
  const targetIndex = workspaceTabs.findIndex((tab) => {
    return getWorkspaceTabKey(tab.type, tab.id) === targetTabKey;
  });
  if (targetIndex < 0) {
    workspaceTabs.splice(draggedIndex, 0, draggedTab);
    return;
  }
  workspaceTabs.splice(targetIndex + (placeAfter ? 1 : 0), 0, draggedTab);
  renderWorkspaceTabs();
  saveDraftsToStorage();
}

function updateWorkspaceTabLabel(tabKey, label) {
  if (!workspaceTabsRoot) {
    return;
  }
  const item = [...workspaceTabsRoot.querySelectorAll("[data-tab-key]")].find(
    (candidate) => candidate.dataset.tabKey === tabKey,
  );
  if (!item) {
    return;
  }
  const labelElement = item.querySelector(".workspace-tab-label");
  if (labelElement) {
    labelElement.textContent = label;
  }
  const mainButton = item.querySelector(".workspace-tab-main");
  if (mainButton) {
    mainButton.title = label;
  }
  const closeButton = item.querySelector(".workspace-tab-close");
  if (closeButton) {
    closeButton.setAttribute("aria-label", `关闭 ${label}`);
  }
}

function updateNoteTitlePresentation(note) {
  if (!note) {
    return;
  }

  const title = note.title || "未命名笔记";
  const listItem = [...(noteList?.querySelectorAll("[data-note-id]") || [])].find(
    (candidate) => candidate.dataset.noteId === note.id,
  );
  const titleElement = listItem?.querySelector(".note-title-row > strong");
  if (titleElement) {
    titleElement.textContent = title;
    titleElement.title = title;
  }
  updateWorkspaceTabLabel(getWorkspaceTabKey("note", note.id), title);
}

function updateNoteSavedPresentation(note) {
  updateNoteTitlePresentation(note);
  const listItem = [...(noteList?.querySelectorAll("[data-note-id]") || [])].find(
    (candidate) => candidate.dataset.noteId === note?.id,
  );
  const modifiedValue = listItem?.querySelectorAll(".note-meta-value")[1];
  if (modifiedValue && note.updatedAt) {
    modifiedValue.textContent = formatListDateTime(note.updatedAt);
  }
}

function saveDraftsToStorage() {
  try {
    if (activeDraftId && draftsMap.has(activeDraftId)) {
      const activeDraft = draftsMap.get(activeDraftId);
      if (titleInput) activeDraft.title = titleInput.value;
      if (typeof getEditorValue === "function") activeDraft.content = getEditorValue();
      activeDraft.updatedAt = new Date().toISOString();
    }
    const draftsArray = Array.from(draftsMap.values());
    localStorage.setItem(DRAFTS_PERSIST_KEY, JSON.stringify(draftsArray));
    localStorage.setItem(
      WORKSPACE_TABS_PERSIST_KEY,
      JSON.stringify(workspaceTabs),
    );
    localStorage.setItem(ACTIVE_TAB_PERSIST_KEY, activeWorkspaceTabKey || "");
  } catch (err) {
    console.error("保存草稿与工作区状态失败:", err);
  }
}

function loadDraftsFromStorage() {
  try {
    const rawDrafts = localStorage.getItem(DRAFTS_PERSIST_KEY);
    if (rawDrafts) {
      const draftsArray = JSON.parse(rawDrafts);
      if (Array.isArray(draftsArray)) {
        draftsMap.clear();
        for (const draft of draftsArray) {
          if (draft && draft.id) {
            draftsMap.set(draft.id, draft);
          }
        }
      }
    }

    const rawTabs = localStorage.getItem(WORKSPACE_TABS_PERSIST_KEY);
    const savedActiveKey = localStorage.getItem(ACTIVE_TAB_PERSIST_KEY);

    if (rawTabs) {
      const tabsArray = JSON.parse(rawTabs);
      if (Array.isArray(tabsArray)) {
        workspaceTabs = tabsArray.filter((tab) => {
          if (!tab || !tab.type || !tab.id) return false;
          return getWorkspaceTabResource(tab) !== null;
        });
      }
    }

    if (
      savedActiveKey &&
      workspaceTabs.some(
        (t) => getWorkspaceTabKey(t.type, t.id) === savedActiveKey,
      )
    ) {
      const activeTab = workspaceTabs.find(
        (t) => getWorkspaceTabKey(t.type, t.id) === savedActiveKey,
      );
      if (activeTab) {
        showWorkspaceTab(activeTab);
        return;
      }
    }

    if (workspaceTabs.length > 0) {
      showWorkspaceTab(workspaceTabs[0]);
    } else {
      renderWorkspaceTabs();
    }
  } catch (err) {
    console.error("恢复草稿与工作区状态失败:", err);
  }
}

function getActiveWorkspaceTab() {
  return (
    workspaceTabs.find((tab) => {
      return getWorkspaceTabKey(tab.type, tab.id) === activeWorkspaceTabKey;
    }) || null
  );
}

function renderDailyReviewBar() {
  const tab = getActiveWorkspaceTab();
  const resource = tab ? getWorkspaceTabResource(tab) : null;
  dailyReviewBar.hidden = !resource?.isDailyReview;
  if (!resource?.isDailyReview) {
    return;
  }
  dailyReviewLastTime.textContent = resource.dailyReviewLastReviewedAt
    ? `上次回顾：${formatListDateTime(resource.dailyReviewLastReviewedAt)}`
    : "上次回顾：从未完成回顾";
}

async function handleActiveDailyReview(action) {
  const tab = getActiveWorkspaceTab();
  const resource = tab ? getWorkspaceTabResource(tab) : null;
  if (!tab || !resource?.isDailyReview) {
    return;
  }

  deferDailyReviewButton.disabled = true;
  completeDailyReviewButton.disabled = true;
  try {
    const entry = { type: tab.type === "note" ? "note" : "file", id: tab.id };
    await window.noticeNote.handleDailyReview(entry, action);
    resource.isDailyReview = false;
    renderNoteList();
    renderWorkspaceTabs();
  } catch (error) {
    alert(error.message || "更新每日回顾失败");
  } finally {
    deferDailyReviewButton.disabled = false;
    completeDailyReviewButton.disabled = false;
  }
}

function saveActiveWorkspaceTabViewState() {
  if (!activeWorkspaceTabKey) {
    return;
  }

  let position = null;
  if (activePdfId) {
    position = { top: pdfPages.scrollTop, left: pdfPages.scrollLeft, pdfZoom };
  } else if (activeResourceId) {
    position = {
      top: fileViewerContent.scrollTop,
      left: fileViewerContent.scrollLeft,
      imageZoom,
    };
  } else if (activeNoteId) {
    position = markdownEditor?.getScrollPosition?.() || null;
  }
  if (position) {
    workspaceTabViewStates.set(activeWorkspaceTabKey, position);
  }
}

function restoreWorkspaceTabViewState(tabKey, target) {
  const position = workspaceTabViewStates.get(tabKey);
  if (!position) {
    return;
  }

  requestAnimationFrame(() => {
    if (activeWorkspaceTabKey !== tabKey) {
      return;
    }
    workspaceTabViewStates.delete(tabKey);
    if (target === "editor") {
      markdownEditor?.setScrollPosition?.(position);
      return;
    }
    target.scrollTo({
      top: Number(position.top) || 0,
      left: Number(position.left) || 0,
    });
  });
}

function getViewerSearchRoot() {
  if (activePdfId) {
    return pdfPages;
  }
  const file = resourceFiles.find((item) => item.id === activeResourceId);
  return file?.kind === "word"
    ? fileViewerContent.querySelector(".word-preview")
    : null;
}

function clearViewerSearchHighlights() {
  if (!window.CSS?.highlights) {
    return;
  }
  CSS.highlights.delete("viewer-search-match");
  CSS.highlights.delete("viewer-search-active");
}

function buildViewerSearchRanges(root, query) {
  const segments = [];
  let text = "";
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    const value = node.nodeValue || "";
    if (value) {
      segments.push({
        node,
        start: text.length,
        end: text.length + value.length,
      });
      text += value;
    }
    node = walker.nextNode();
  }

  const normalizedText = text.toLocaleLowerCase("zh-CN");
  const normalizedQuery = query.toLocaleLowerCase("zh-CN");
  const ranges = [];
  let searchFrom = 0;
  while (ranges.length < 500) {
    const matchStart = normalizedText.indexOf(normalizedQuery, searchFrom);
    if (matchStart < 0) {
      break;
    }
    const matchEnd = matchStart + normalizedQuery.length;
    const startSegment = segments.find(
      (segment) => matchStart >= segment.start && matchStart < segment.end,
    );
    const endSegment = segments.find(
      (segment) => matchEnd > segment.start && matchEnd <= segment.end,
    );
    if (startSegment && endSegment) {
      const range = document.createRange();
      range.setStart(startSegment.node, matchStart - startSegment.start);
      range.setEnd(endSegment.node, matchEnd - endSegment.start);
      ranges.push(range);
    }
    searchFrom = matchStart + normalizedQuery.length;
  }
  return ranges;
}

function showActiveViewerSearchMatch() {
  const match = viewerSearchMatches[activeViewerSearchIndex];
  if (!match) {
    viewerSearchCount.textContent = "0 / 0";
    return;
  }

  viewerSearchCount.textContent = `${activeViewerSearchIndex + 1} / ${viewerSearchMatches.length}`;
  if (window.CSS?.highlights && typeof window.Highlight === "function") {
    CSS.highlights.set("viewer-search-active", new Highlight(match));
  }
  match.startContainer.parentElement?.scrollIntoView({
    behavior: "smooth",
    block: "center",
    inline: "center",
  });
}

function updateViewerSearch() {
  clearViewerSearchHighlights();
  viewerSearchMatches = [];
  activeViewerSearchIndex = -1;
  const root = getViewerSearchRoot();
  const query = viewerSearchInput.value.trim();
  if (!root || !query) {
    viewerSearchCount.textContent = "0 / 0";
    return;
  }

  viewerSearchMatches = buildViewerSearchRanges(root, query);
  if (
    window.CSS?.highlights &&
    typeof window.Highlight === "function" &&
    viewerSearchMatches.length > 0
  ) {
    CSS.highlights.set(
      "viewer-search-match",
      new Highlight(...viewerSearchMatches),
    );
  }
  if (viewerSearchMatches.length > 0) {
    activeViewerSearchIndex = 0;
    showActiveViewerSearchMatch();
  } else {
    viewerSearchCount.textContent = "0 / 0";
  }
}

function moveViewerSearch(step) {
  if (viewerSearchMatches.length === 0) {
    return;
  }
  activeViewerSearchIndex =
    (activeViewerSearchIndex + step + viewerSearchMatches.length) %
    viewerSearchMatches.length;
  showActiveViewerSearchMatch();
}

function openViewerSearch() {
  if (!getViewerSearchRoot()) {
    return;
  }
  viewerSearchBar.hidden = false;
  viewerSearchInput.focus();
  viewerSearchInput.select();
  updateViewerSearch();
}

function closeViewerSearch() {
  clearViewerSearchHighlights();
  viewerSearchBar.hidden = true;
  viewerSearchMatches = [];
  activeViewerSearchIndex = -1;
  viewerSearchCount.textContent = "0 / 0";
}

function renderWorkspaceTabContent(tab) {
  if (tab.type === "draft") {
    activeDraftId = tab.id;
    activeNoteId = null;
    activePdfId = null;
    activeResourceId = null;
    renderEditor();
  } else if (tab.type === "pdf") {
    activeDraftId = null;
    activePdfId = tab.id;
    activeResourceId = null;
    renderPdf();
  } else if (tab.type === "file") {
    activeDraftId = null;
    activeResourceId = tab.id;
    activePdfId = null;
    renderResourceFile();
  } else {
    activeDraftId = null;
    activeNoteId = tab.id;
    activePdfId = null;
    activeResourceId = null;
    renderEditor();
  }
}

function showWorkspaceTab(tab, { deferContent = false } = {}) {
  closeViewerSearch();
  const tabKey = getWorkspaceTabKey(tab.type, tab.id);
  if (activeWorkspaceTabKey !== tabKey) {
    saveActiveWorkspaceTabViewState();
  }
  activeWorkspaceTabKey = tabKey;
  const renderVersion = ++workspaceContentRenderVersion;
  const renderContent = () => {
    if (
      renderVersion !== workspaceContentRenderVersion
      || activeWorkspaceTabKey !== tabKey
    ) {
      return;
    }
    renderWorkspaceTabContent(tab);
    saveDraftsToStorage();
  };

  if (deferContent) {
    renderWorkspaceTabs();
    requestAnimationFrame(renderContent);
  } else {
    renderContent();
  }
}

async function activateWorkspaceTab(type, id) {
  const tabKey = getWorkspaceTabKey(type, id);
  if (tabKey === activeWorkspaceTabKey) {
    return;
  }

  const tab = { type, id };
  if (!getWorkspaceTabResource(tab)) {
    return;
  }

  const pendingSave = flushPendingSave();
  if (
    !workspaceTabs.some(
      (item) => getWorkspaceTabKey(item.type, item.id) === tabKey,
    )
  ) {
    workspaceTabs.push(tab);
  }
  showWorkspaceTab(tab, { deferContent: true });
  pendingSave.catch(console.error);
}

async function closeWorkspaceTab(tabKey) {
  const index = workspaceTabs.findIndex(
    (tab) => getWorkspaceTabKey(tab.type, tab.id) === tabKey,
  );
  if (index < 0) {
    return;
  }

  const tab = workspaceTabs[index];
  if (tab.type === "draft") {
    const draft = draftsMap.get(tab.id);
    if (draft) {
      if (activeDraftId === draft.id) {
        draft.title = titleInput.value;
        draft.content = getEditorValue();
      }
      const hasContent = Boolean(
        (draft.title && draft.title.trim()) ||
          (draft.content && draft.content.trim()),
      );
      if (hasContent) {
        openDraftSaveDialog(tab.id, tabKey);
        return;
      } else {
        draftsMap.delete(tab.id);
      }
    }
  }

  const isActive = tabKey === activeWorkspaceTabKey;
  if (isActive) {
    await flushPendingSave();
  }
  workspaceTabs.splice(index, 1);

  if (!isActive) {
    workspaceTabViewStates.delete(tabKey);
    renderWorkspaceTabs();
    saveDraftsToStorage();
    return;
  }

  const nextTab = workspaceTabs[Math.min(index, workspaceTabs.length - 1)];
  if (nextTab) {
    showWorkspaceTab(nextTab);
    workspaceTabViewStates.delete(tabKey);
    return;
  }

  workspaceTabViewStates.delete(tabKey);
  activeWorkspaceTabKey = null;
  activeDraftId = null;
  activeNoteId = null;
  activePdfId = null;
  activeResourceId = null;
  renderEditor();
  saveDraftsToStorage();
}

async function closeOtherWorkspaceTabs(tabKey) {
  const tab = workspaceTabs.find(
    (item) => getWorkspaceTabKey(item.type, item.id) === tabKey,
  );
  if (!tab) {
    return;
  }

  await flushPendingSave();

  for (const item of [...workspaceTabs]) {
    if (getWorkspaceTabKey(item.type, item.id) !== tabKey && item.type === "draft") {
      const draft = draftsMap.get(item.id);
      if (draft) {
        const hasContent = Boolean(
          (draft.title && draft.title.trim()) ||
            (draft.content && draft.content.trim()),
        );
        if (hasContent) {
          showWorkspaceTab(item);
          openDraftSaveDialog(item.id, getWorkspaceTabKey("draft", item.id));
          return;
        } else {
          draftsMap.delete(item.id);
        }
      }
    }
  }

  workspaceTabs = [tab];
  if (tabKey === activeWorkspaceTabKey) {
    renderWorkspaceTabs();
  } else {
    showWorkspaceTab(tab);
  }
  for (const key of workspaceTabViewStates.keys()) {
    if (key !== tabKey) {
      workspaceTabViewStates.delete(key);
    }
  }
}

async function closeAllWorkspaceTabs() {
  await flushPendingSave();
  for (const tab of [...workspaceTabs]) {
    if (tab.type === "draft") {
      const draft = draftsMap.get(tab.id);
      if (draft) {
        const hasContent = Boolean(
          (draft.title && draft.title.trim()) ||
            (draft.content && draft.content.trim()),
        );
        if (hasContent) {
          showWorkspaceTab(tab);
          openDraftSaveDialog(tab.id, getWorkspaceTabKey("draft", tab.id));
          return;
        } else {
          draftsMap.delete(tab.id);
        }
      }
    }
  }

  workspaceTabs = [];
  workspaceTabViewStates.clear();
  activeWorkspaceTabKey = null;
  activeDraftId = null;
  activeNoteId = null;
  activePdfId = null;
  activeResourceId = null;
  renderEditor();
}

function reconcileWorkspaceTabs() {
  workspaceTabs = workspaceTabs.filter((tab) =>
    Boolean(getWorkspaceTabResource(tab)),
  );
  let activeTab = workspaceTabs.find((tab) => {
    return getWorkspaceTabKey(tab.type, tab.id) === activeWorkspaceTabKey;
  });

  if (!activeTab) {
    activeTab = workspaceTabs[0] || null;
    if (activeTab) {
      showWorkspaceTab(activeTab);
      return true;
    }
    activeWorkspaceTabKey = null;
    activeNoteId = null;
    activePdfId = null;
    activeResourceId = null;
  }

  renderWorkspaceTabs();
  return false;
}

function getCurrentFolders() {
  if (sidebarViewMode !== "all" || getNoteSearchKeyword()) {
    return [];
  }
  return folders.filter((folder) => folder.parentId === activeFolderId);
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
    reminderBtn.textContent = "每日回顾";
    const helpWrap = document.createElement("div");
    helpWrap.className = "daily-review-help-wrap";
    const helpButton = document.createElement("button");
    helpButton.className = "daily-review-help-button";
    helpButton.type = "button";
    helpButton.textContent = "?";
    helpButton.title = "查看每日回顾规则";
    helpButton.setAttribute("aria-label", "查看每日回顾规则");
    helpButton.setAttribute("aria-expanded", "false");
    const rules = document.createElement("section");
    rules.className = "daily-review-rules";
    rules.hidden = true;
    rules.innerHTML = `
      <strong>每日回顾规则</strong>
      <ol>
        <li>自动回顾在周一至周五生效，“明天再看”的内容可延续到周末。</li>
        <li>仅选择已加入回顾、应用能够打开的内容。</li>
        <li>存在未完成提醒的笔记不会参与今日回顾。</li>
        <li>从未完成回顾的内容优先，其次选择上次回顾时间最早的内容。</li>
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
    notes.filter((note) => note.folderId === folderId).length +
    resourceFiles.filter((file) => file.folderId === folderId).length
  );
}

function getChildFolderCount(folderId) {
  return folders.filter((folder) => folder.parentId === folderId).length;
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

async function updateDailyReviewMark(entry, target, marked) {
  if (!target) {
    return;
  }
  const result = await window.noticeNote.setReminderFileMark(entry, marked);
  target.isReminderFile = Boolean(result?.marked);
  renderNoteList();
}

function createDailyReviewToggle(entry, target) {
  const toggle = document.createElement("span");
  const isMarked = Boolean(target.isReminderFile);
  toggle.className = `daily-review-toggle${isMarked ? " is-active" : ""}`;
  toggle.role = "button";
  toggle.tabIndex = 0;
  toggle.textContent = isMarked ? "★" : "☆";
  toggle.title = isMarked ? "移出每日回顾" : "加入每日回顾";
  toggle.setAttribute("aria-label", toggle.title);
  toggle.setAttribute("aria-pressed", String(isMarked));

  const changeMark = (event) => {
    event.preventDefault();
    event.stopPropagation();
    updateDailyReviewMark(entry, target, !target.isReminderFile).catch(
      console.error,
    );
  };
  toggle.addEventListener("click", changeMark);
  toggle.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      changeMark(event);
    }
  });
  return toggle;
}

function createDailyReviewLastTime(target) {
  const lastTime = document.createElement("span");
  lastTime.className = "daily-review-last-time";
  lastTime.textContent = target.dailyReviewLastReviewedAt
    ? `上次回顾：${formatListDateTime(target.dailyReviewLastReviewedAt)}`
    : "上次回顾：尚未完成";
  return lastTime;
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
    sidebarViewMode === "reminder" &&
    filteredNotes.length === 0 &&
    filteredResources.length === 0
  ) {
    const empty = document.createElement("p");
    empty.className = "note-list-empty";
    empty.textContent = "回顾清单还是空的，可点击文件右侧的 ☆ 加入";
    noteList.append(empty);
    return;
  }

  if (
    sidebarViewMode === "all" &&
    currentFolders.length === 0 &&
    filteredNotes.length === 0 &&
    filteredResources.length === 0
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
    titleRow.append(
      createDailyReviewToggle({ type: "note", id: note.id }, note),
    );
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

    if (note.isReminderFile) {
      const reminderFileBadge = document.createElement("span");
      reminderFileBadge.className = "reminder-file-badge";
      reminderFileBadge.textContent = "回顾";
      reminderFileBadge.title = "已加入每日回顾清单";
      badgeRow.append(reminderFileBadge);
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

    if (note.isReminderFile) {
      const pendingCount = (note.reminders || []).filter(
        (reminder) => !reminder.done,
      ).length;
      const reminderMeta = document.createElement("span");
      reminderMeta.className = `note-reminder-meta${pendingCount > 0 ? " has-pending" : ""}`;
      reminderMeta.textContent =
        pendingCount > 0 ? `${pendingCount} 个提醒未完成` : "可参与今日回顾";
      item.append(reminderMeta, createDailyReviewLastTime(note));
    }

    const openNote = () => selectNote(note.id).catch(console.error);
    item.addEventListener("click", (event) => {
      if (event.target.closest(".daily-review-toggle, .note-drag-handle")) {
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
      item.addEventListener("click", (event) => {
        if (event.target.closest(".daily-review-toggle")) {
          return;
        }
        openResource();
      });
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
    if (file.canOpen || file.isReminderFile) {
      titleRow.append(
        createDailyReviewToggle({ type: "file", id: file.id }, file),
      );
    }
    if (file.isDailyReview) {
      const dailyReviewBadge = document.createElement("span");
      dailyReviewBadge.className = "daily-review-badge";
      dailyReviewBadge.textContent = "今日回顾";
      dailyReviewBadge.title = "今天选中的每日回顾内容";
      badgeRow.append(dailyReviewBadge);
    }
    if (file.isReminderFile) {
      const reminderFileBadge = document.createElement("span");
      reminderFileBadge.className = "reminder-file-badge";
      reminderFileBadge.textContent = "回顾";
      reminderFileBadge.title = "已加入每日回顾清单";
      badgeRow.append(reminderFileBadge);
    }
    titleRow.append(badge);
    item.append(titleRow);
    if (badgeRow.childElementCount > 0) {
      item.append(badgeRow);
    }
    if (sidebarViewMode === "reminder" || searchKeyword) {
      const folderPath = document.createElement("div");
      folderPath.className = "reminder-file-path";
      const pathParts = getFolderNamePath(file.folderId);
      folderPath.textContent =
        pathParts.length > 0 ? pathParts.join(" / ") : "根目录";
      folderPath.title = folderPath.textContent;
      item.append(folderPath);
    }
    item.append(meta);
    if (file.isReminderFile) {
      item.append(createDailyReviewLastTime(file));
    }
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

function hasTodayPendingReminder(note) {
  const todayKey = toLocalDateKey(new Date());
  return (note.reminders || []).some((reminder) => {
    return getReminderDateKey(reminder) === todayKey;
  });
}

function skipWeekend(date) {
  const day = date.getDay();
  if (day === 0) {
    date.setDate(date.getDate() + 1);
  } else if (day === 6) {
    date.setDate(date.getDate() + 2);
  }
  return date;
}

function createReminderDate(daysToAdd) {
  const date = new Date();
  date.setDate(date.getDate() + daysToAdd);
  skipWeekend(date);
  return toLocalDateKey(date);
}

function createNextMonthReminderDate() {
  const today = new Date();
  const targetYear =
    today.getFullYear() + Math.floor((today.getMonth() + 1) / 12);
  const targetMonth = (today.getMonth() + 1) % 12;
  const lastDayOfTargetMonth = new Date(
    targetYear,
    targetMonth + 1,
    0,
  ).getDate();
  const date = new Date(
    targetYear,
    targetMonth,
    Math.min(today.getDate(), lastDayOfTargetMonth),
  );
  skipWeekend(date);
  return toLocalDateKey(date);
}

function createReminder(date) {
  return {
    id: crypto.randomUUID(),
    date,
    time: `${date}T09:30:00.000`,
    done: false,
    firedAt: null,
    firedSlots: [],
  };
}

function getActiveNote() {
  if (activeDraftId) {
    return draftsMap.get(activeDraftId) || null;
  }
  return notes.find((note) => note.id === activeNoteId) || null;
}

function getDraftNote() {
  const activeNote = getActiveNote();
  if (!activeNote) {
    return null;
  }
  return {
    ...activeNote,
    title: titleInput.value,
    content: normalizeEditorContent(getEditorValue(), activeNote),
  };
}

function getEditorValue() {
  return markdownEditor ? markdownEditor.getMarkdown() : "";
}

function normalizeMarkdownContent(content) {
  return String(content || "").replace(/^(\s*)\*(\s+)/gm, "$1-$2");
}

function normalizeEditorContent(content, note = getActiveNote()) {
  return ["txt", "json"].includes(note?.fileType)
    ? String(content || "")
    : normalizeMarkdownContent(content);
}

function setEditorValue(value) {
  const nextValue = normalizeEditorContent(value);
  if (markdownEditor) {
    if (markdownEditor.getMarkdown() === nextValue) {
      return;
    }

    markdownEditor.setMarkdown(nextValue, false);
  }
}

async function insertImage() {
  const note = getActiveNote();
  if (!note) {
    return;
  }

  const result = await window.noticeNote.insertImage({ noteId: note.id });
  if (!result?.markdown) {
    return;
  }

  if (markdownEditor && typeof markdownEditor.insertMarkdown === "function") {
    markdownEditor.insertMarkdown(`${result.markdown}\n`);
    markdownEditor.focus?.();
  } else {
    const currentValue = getEditorValue();
    setEditorValue(
      `${currentValue}${currentValue.endsWith("\n") || !currentValue ? "" : "\n"}${result.markdown}\n`,
    );
  }

  queueSave();
}

function insertCodeBlock() {
  const note = getActiveNote();
  if (!note) {
    return;
  }

  const selectionText = window.getSelection()?.toString() || "";
  const snippet = selectionText
    ? `\n\`\`\`\n${selectionText}\n\`\`\`\n`
    : `\n\`\`\`\n\n\`\`\`\n`;

  if (markdownEditor && typeof markdownEditor.insertMarkdown === "function") {
    markdownEditor.insertMarkdown(snippet);
    markdownEditor.focus?.();
  } else {
    const currentValue = getEditorValue();
    setEditorValue(
      `${currentValue}${currentValue.endsWith("\n") || !currentValue ? "" : "\n"}${snippet}`,
    );
  }

  queueSave();
}

async function handlePastedImage(file) {
  const note = getActiveNote();
  if (!note || !file) {
    return null;
  }

  const buffer = await file.arrayBuffer();
  const result = await window.noticeNote.savePastedImage({
    noteId: note.id,
    image: {
      fileName: file.name,
      mimeType: file.type,
      bytes: Array.from(new Uint8Array(buffer)),
    },
  });

  if (!result?.markdown) {
    return null;
  }

  return `${result.markdown}\n`;
}

async function handlePastedHtml(htmlText, plainText) {
  const note = getActiveNote();
  if (!note) {
    return plainText || "";
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlText, "text/html");
  const imgElements = [...doc.querySelectorAll("img")];
  const imageSrcs = imgElements
    .map((img) => img.getAttribute("src"))
    .filter(Boolean);

  const imageMarkdownMap = new Map();
  for (const src of imageSrcs) {
    if (imageMarkdownMap.has(src)) {
      continue;
    }
    try {
      let result = null;
      if (src.startsWith("data:")) {
        const match = /^data:([^;]+);base64,(.*)$/.exec(src);
        if (match) {
          const byteString = atob(match[2]);
          const bytes = new Uint8Array(byteString.length);
          for (let i = 0; i < byteString.length; i++) {
            bytes[i] = byteString.charCodeAt(i);
          }
          const ext = match[1].includes("png")
            ? ".png"
            : match[1].includes("gif")
              ? ".gif"
              : match[1].includes("webp")
                ? ".webp"
                : match[1].includes("svg")
                  ? ".svg"
                  : ".jpg";
          result = await window.noticeNote.savePastedImage({
            noteId: note.id,
            image: {
              fileName: `pasted-${Date.now()}${ext}`,
              mimeType: match[1],
              bytes: Array.from(bytes),
            },
          });
        }
      } else if (/^https?:\/\//i.test(src)) {
        result = await window.noticeNote.saveImageFromUrl({
          noteId: note.id,
          imageUrl: src,
        });
      }

      if (result?.markdown) {
        imageMarkdownMap.set(src, result.markdown);
      } else {
        imageMarkdownMap.set(src, "");
      }
    } catch (error) {
      console.error("保存粘贴图片失败:", error);
      imageMarkdownMap.set(src, "");
    }
  }

  for (const img of imgElements) {
    const src = img.getAttribute("src");
    const alt = img.getAttribute("alt") || "图片";
    const markdown = imageMarkdownMap.get(src);
    if (markdown) {
      img.replaceWith(doc.createTextNode(`\n${markdown}\n`));
    } else {
      img.replaceWith(doc.createTextNode(alt));
    }
  }

  doc
    .querySelectorAll("style, script, meta, link, title")
    .forEach((el) => el.remove());

  let text = htmlToMarkdown(doc.body) || plainText || "";
  if (plainText && hasDroppedHtmlText(doc.body, text)) {
    const fallbackText = plainText.replace(/\r\n?/g, "\n").trim();
    const savedImages = [
      ...new Set([...imageMarkdownMap.values()].filter(Boolean)),
    ];
    text = [fallbackText, ...savedImages].filter(Boolean).join("\n\n");
    console.warn("富文本转换检测到文本缺失，已使用纯文本内容兜底。");
  }
  text = text.replace(/\n{3,}/g, "\n\n").trim();
  return text ? `${text}\n` : "";
}

function normalizeComparableText(value) {
  return String(value || "")
    .replace(/\\([\\|])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function hasDroppedHtmlText(root, markdown) {
  const convertedText = normalizeComparableText(markdown);
  const walker = root.ownerDocument.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT,
  );
  let searchOffset = 0;
  let node = walker.nextNode();
  while (node) {
    const sourceText = normalizeComparableText(node.textContent);
    if (sourceText) {
      const foundAt = convertedText.indexOf(sourceText, searchOffset);
      if (foundAt === -1) {
        return true;
      }
      searchOffset = foundAt + sourceText.length;
    }
    node = walker.nextNode();
  }
  return false;
}

function htmlToMarkdown(root) {
  const parts = [];

  function push(text, preserveLineBreak = false) {
    if (!preserveLineBreak && text === "\n" && parts.length > 0) {
      const last = parts[parts.length - 1];
      if (last === "\n") {
        return;
      }
      if (typeof last === "string" && last.endsWith("\n")) {
        return;
      }
    }
    parts.push(text);
  }

  function isBlankBlock(element) {
    const text = String(element.textContent || "")
      .replace(/[\u00a0\u200b]/g, "")
      .trim();
    if (text) {
      return false;
    }
    return !element.querySelector("hr, table, pre, ul, ol, blockquote");
  }

  function getListDepth(listElement) {
    let depth = 0;
    let parent = listElement.parentElement;
    while (parent) {
      const tag = parent.tagName?.toLowerCase();
      if (tag === "ul" || tag === "ol") {
        depth++;
      }
      parent = parent.parentElement;
    }
    return depth;
  }

  function renderList(listElement) {
    const ordered = listElement.tagName.toLowerCase() === "ol";
    const indent = "    ".repeat(getListDepth(listElement));
    let index = 1;
    push("\n");

    for (const child of listElement.children) {
      const tag = child.tagName.toLowerCase();
      if (tag === "li") {
        push(`${indent}${ordered ? `${index}.` : "-"} `);
        walkNode(child);
        push("\n");
        index++;
      } else if (tag === "ul" || tag === "ol") {
        // 兼容部分网页剪贴板把子列表放成同级节点的非标准结构。
        renderList(child);
      } else {
        walkNode(child);
      }
    }
  }

  function walkNode(node) {
    for (const child of node.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) {
        const text = child.textContent.replace(/\s+/g, " ");
        if (text.trim()) {
          push(text);
        }
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        const tag = child.tagName.toLowerCase();
        switch (tag) {
          case "br":
            push("\n", true);
            break;
          case "p":
          case "div":
            if (isBlankBlock(child)) {
              push("\n", true);
            } else {
              walkNode(child);
              push("\n");
            }
            break;
          case "h1":
          case "h2":
          case "h3":
          case "h4":
          case "h5":
          case "h6": {
            const level = Number(tag[1]);
            push("\n");
            push("#".repeat(level) + " ");
            walkNode(child);
            push("\n");
            break;
          }
          case "strong":
          case "b":
            push("**");
            walkNode(child);
            push("**");
            break;
          case "em":
          case "i":
            push("*");
            walkNode(child);
            push("*");
            break;
          case "u":
          case "ins":
            walkNode(child);
            break;
          case "s":
          case "del":
          case "strike":
            push("~~");
            walkNode(child);
            push("~~");
            break;
          case "a": {
            const href = child.getAttribute("href") || "";
            const label = child.textContent || "";
            if (href && /^https?:\/\//i.test(href)) {
              push(`[${label}](${href})`);
            } else {
              walkNode(child);
            }
            break;
          }
          case "ul":
          case "ol":
            renderList(child);
            break;
          case "li":
            walkNode(child);
            break;
          case "blockquote":
            push("\n");
            {
              const inner = htmlToMarkdown(child);
              push(
                inner
                  .split("\n")
                  .map((l) => (l.trim() ? `> ${l}` : ""))
                  .join("\n"),
              );
            }
            push("\n");
            break;
          case "hr":
            push("\n---\n");
            break;
          case "table":
            push("\n");
            {
              const rows = [...child.querySelectorAll("tr")];
              rows.forEach((tr, rowIdx) => {
                const cells = [...tr.querySelectorAll("th, td")];
                const cellTexts = cells.map((cell) => {
                  const t = htmlToMarkdown(cell).trim();
                  return t.replace(/\|/g, "\\|");
                });
                push(`| ${cellTexts.join(" | ")} |\n`);
                if (rowIdx === 0) {
                  push(`| ${cellTexts.map(() => "---").join(" | ")} |\n`);
                }
              });
            }
            break;
          case "pre":
            push("\n```\n");
            push(child.textContent);
            push("\n```\n");
            break;
          case "code":
            push("`");
            push(child.textContent);
            push("`");
            break;
          case "img":
            break;
          default:
            walkNode(child);
            break;
        }
      }
    }
  }

  walkNode(root);
  return parts
    .join("")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

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

function renderStorageInfo() {
  if (!storageInfo) {
    return;
  }
  settingsStoragePath.textContent = storageInfo.notesPath;
  settingsStoragePath.title = storageInfo.notesPath;
  resetStorageButton.disabled = storageInfo.isDefault;
}

function renderReminders() {
  const note = getActiveNote();
  reminderList.innerHTML = "";
  const reminderCount = note?.reminders?.length || 0;
  reminderButtonCount.hidden = reminderCount === 0;
  reminderButtonCount.textContent = String(reminderCount);
  reminderDialogCount.textContent = `${reminderCount} 个`;
  reminderDialogNoteTitle.textContent = note?.title || "为当前笔记安排提醒";
  openReminderConfigButton.title =
    reminderCount > 0 ? `管理 ${reminderCount} 个提醒` : "添加提醒";

  if (!note) {
    const empty = document.createElement("div");
    empty.className = "reminder-list-empty";
    empty.innerHTML =
      "<strong>当前没有打开的笔记</strong><span>打开一篇笔记后即可设置提醒</span>";
    reminderList.append(empty);
    return;
  }

  if (!note.reminders.length) {
    const empty = document.createElement("div");
    empty.className = "reminder-list-empty";
    empty.innerHTML =
      "<strong>还没有提醒</strong><span>选择日期，为这篇笔记安排第一次提醒</span>";
    reminderList.append(empty);
    return;
  }

  const sortedReminders = [...note.reminders].sort((a, b) => {
    const dateA = getReminderDateKey(a);
    const dateB = getReminderDateKey(b);
    return (
      (dateA ? Date.parse(`${dateA}T00:00:00`) : 0) -
      (dateB ? Date.parse(`${dateB}T00:00:00`) : 0)
    );
  });

  for (const reminder of sortedReminders) {
    const row = document.createElement("div");
    row.className = `reminder-row${reminder.done ? " done" : ""}`;
    const dateKey = getReminderDateKey(reminder);
    const date = parseReminderDate(dateKey);
    const dateBlock = document.createElement("div");
    dateBlock.className = "reminder-date-block";
    const dateMain = document.createElement("strong");
    dateMain.textContent = date
      ? `${date.getMonth() + 1}月${date.getDate()}日`
      : "日期无效";
    const dateMeta = document.createElement("span");
    dateMeta.textContent = date
      ? `${date.getFullYear()} · ${new Intl.DateTimeFormat("zh-CN", { weekday: "short" }).format(date)}`
      : "";
    dateBlock.append(dateMain, dateMeta);

    const reminderInfo = document.createElement("div");
    reminderInfo.className = "reminder-row-info";
    const firedCount = Array.isArray(reminder.firedSlots)
      ? reminder.firedSlots.length
      : 0;
    const status = document.createElement("span");
    status.className = `reminder-status${reminder.done ? " is-done" : ""}`;
    status.textContent = reminder.done
      ? "已完成"
      : firedCount > 0
        ? `已通知 ${Math.min(firedCount, DAILY_REMINDER_SLOTS.length)}/${DAILY_REMINDER_SLOTS.length}`
        : "待提醒";
    const slots = document.createElement("div");
    slots.className = "reminder-slots";
    const firedSlots = new Set(reminder.firedSlots || []);
    for (const slot of DAILY_REMINDER_SLOTS) {
      const slotBadge = document.createElement("span");
      slotBadge.className = firedSlots.has(slot) ? "is-fired" : "";
      slotBadge.textContent = slot;
      slots.append(slotBadge);
    }
    reminderInfo.append(status, slots);

    const removeButton = document.createElement("button");
    removeButton.className = "reminder-remove-button";
    removeButton.type = "button";
    removeButton.title = "移除提醒";
    removeButton.setAttribute(
      "aria-label",
      `移除 ${dateMain.textContent} 的提醒`,
    );
    removeButton.innerHTML =
      '<svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M2.5 4h11M6 4V2.5h4V4M5 6.5v5M8 6.5v5M11 6.5v5M4 4l.7 9.5h6.6L12 4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    removeButton.addEventListener("click", () => removeReminder(reminder.id));

    row.append(dateBlock, reminderInfo, removeButton);
    reminderList.append(row);
  }
}

function renderEditor() {
  const activeNote = getActiveNote();

  isRenderingEditor = true;
  activePdfId = null;
  activeResourceId = null;
  editorPanel.hidden = false;
  pdfViewer.hidden = true;
  fileViewer.hidden = true;
  filePreviewVersion++;

  if (!activeNote) {
    activeNoteId = null;
    // 只有在 activeDraftId 对应的草稿也不存在时才清除（防止竞态误清）
    if (activeDraftId && !draftsMap.has(activeDraftId)) {
      activeDraftId = null;
    }
    titleInput.value = "";
    editorTopbar.hidden = true;
    titleInput.disabled = true;
    openReminderConfigButton.disabled = true;
    deleteNoteButton.disabled = true;
    saveButton.disabled = true;
    editorRoot.hidden = true;
    editorEmptyState.hidden = false;
  } else {
    if (activeDraftId) {
      editorTopbar.hidden = false;
      titleInput.disabled = false;
      openReminderConfigButton.disabled = true;
      deleteNoteButton.disabled = false;
      deleteNoteButton.textContent = "丢弃草稿";
      saveButton.disabled = false;
      saveButton.textContent = "💾 保存为笔记";
      editorRoot.hidden = false;
      editorEmptyState.hidden = true;
      titleInput.value = activeNote.title || "";
      setEditorValue(activeNote.content || "");
      markdownEditor?.refresh?.();
    } else {
      activeNoteId = activeNote.id;
      editorTopbar.hidden = false;
      titleInput.disabled = false;
      openReminderConfigButton.disabled = false;
      deleteNoteButton.disabled = false;
      deleteNoteButton.textContent = "删除";
      saveButton.disabled = false;
      saveButton.textContent = "保存";
      editorRoot.hidden = false;
      editorEmptyState.hidden = true;
      titleInput.value = activeNote.title || "";
      setEditorValue(activeNote.content || "");
      markdownEditor?.refresh?.();
      restoreWorkspaceTabViewState(
        getWorkspaceTabKey("note", activeNote.id),
        "editor",
      );
    }
  }

  isRenderingEditor = false;
  renderSaveStatus();
  renderNoteList();
  renderReminders();
  renderWorkspaceTabs();
}

function destroyPdfPreview() {
  pdfLoadVersion++;
  pdfPageRenderVersion++;
  pdfLoadingTask?.destroy();
  pdfLoadingTask = null;
  pdfDocument = null;
  pdfPreviewKey = null;
  pdfPreviewReadyKey = null;
  pdfPreviewPromise = null;
  pdfOutlineEntries = [];
  pdfOutlineIndexVersion++;
  if (pdfOutlineHighlightFrame !== null) {
    cancelAnimationFrame(pdfOutlineHighlightFrame);
    pdfOutlineHighlightFrame = null;
  }
  activePdfOutlineButton = null;
  pdfPages.innerHTML = "";
  pdfPageCount.textContent = "";
  pdfOutlineList.innerHTML = "";
}

function getPdfPreviewKey(pdf) {
  return `${pdf.id}:${pdf.size}:${pdf.updatedAt || ""}`;
}

function showPdfStatus(message, isError = false) {
  pdfPages.innerHTML = "";
  const status = document.createElement("div");
  status.className = `pdf-preview-status${isError ? " is-error" : ""}`;
  status.textContent = message;
  pdfPages.append(status);
}

async function renderPdfPageCanvas(job) {
  await job.page.render({
    canvasContext: job.canvas.getContext("2d"),
    transform:
      job.outputScale === 1
        ? null
        : [job.outputScale, 0, 0, job.outputScale, 0, 0],
    viewport: job.viewport,
  }).promise;
}

async function renderPdfPageText(job) {
  const textContent = await job.page.getTextContent();
  const layer = new window.noticeNotePdf.TextLayer({
    textContentSource: textContent,
    container: job.textLayer,
    viewport: job.viewport,
  });
  await layer.render();
}

async function renderPdfPages(options = {}) {
  if (!pdfDocument) {
    return false;
  }

  const version = ++pdfPageRenderVersion;
  const documentToRender = pdfDocument;
  const availableWidth = Math.max(320, pdfPages.clientWidth - 48);
  const pageNumbers = Array.from(
    { length: documentToRender.numPages },
    (_, index) => index + 1,
  );
  const pages = await Promise.all(
    pageNumbers.map((pageNumber) => documentToRender.getPage(pageNumber)),
  );
  if (version !== pdfPageRenderVersion) {
    return false;
  }

  const fragment = document.createDocumentFragment();
  const jobs = pages.map((page, index) => {
    const pageNumber = index + 1;
    const baseViewport = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({
      scale: (availableWidth / baseViewport.width) * pdfZoom,
    });
    const outputScale = Math.min(window.devicePixelRatio || 1, 2);
    const pageElement = document.createElement("section");
    pageElement.className = "pdf-page";
    pageElement.dataset.pageNumber = String(pageNumber);
    pageElement.style.setProperty("--scale-factor", String(viewport.scale));
    pageElement.style.setProperty(
      "--user-unit",
      String(viewport.userUnit || 1),
    );
    pageElement.style.width = `${Math.floor(viewport.width)}px`;
    pageElement.style.height = `${Math.floor(viewport.height)}px`;

    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(viewport.width * outputScale);
    canvas.height = Math.floor(viewport.height * outputScale);
    canvas.style.width = `${Math.floor(viewport.width)}px`;
    canvas.style.height = `${Math.floor(viewport.height)}px`;
    canvas.setAttribute("aria-label", `第 ${pageNumber} 页`);
    const textLayer = document.createElement("div");
    textLayer.className = "textLayer";
    pageElement.append(canvas, textLayer);
    fragment.append(pageElement);
    return {
      pageNumber,
      page,
      viewport,
      outputScale,
      pageElement,
      canvas,
      textLayer,
    };
  });

  const priorityPageNumber = Number(options.priorityPageNumber) || 1;
  const priorityJob =
    jobs.find((job) => job.pageNumber === priorityPageNumber) || jobs[0];
  if (priorityJob) {
    await renderPdfPageCanvas(priorityJob);
  }
  if (version !== pdfPageRenderVersion) {
    return false;
  }

  pdfPages.replaceChildren(fragment);
  options.onLayoutReady?.();
  schedulePdfOutlineHighlight();

  if (priorityJob) {
    await renderPdfPageText(priorityJob);
  }
  if (version !== pdfPageRenderVersion) {
    return false;
  }

  const remainingJobs = jobs
    .filter((job) => job !== priorityJob)
    .sort((a, b) => {
      return (
        Math.abs(a.pageNumber - priorityPageNumber) -
        Math.abs(b.pageNumber - priorityPageNumber)
      );
    });
  for (const job of remainingJobs) {
    if (version !== pdfPageRenderVersion) {
      return false;
    }
    await renderPdfPageCanvas(job);
    if (version !== pdfPageRenderVersion) {
      return false;
    }
    await renderPdfPageText(job);
    if (version !== pdfPageRenderVersion) {
      return false;
    }
  }

  if (!viewerSearchBar.hidden) {
    updateViewerSearch();
  }
  schedulePdfOutlineHighlight();
  return true;
}

function getPdfViewportAnchor(anchor) {
  if (anchor?.page?.isConnected) {
    return anchor;
  }
  const pageElements = [...pdfPages.querySelectorAll(".pdf-page")];
  if (pageElements.length === 0) {
    return null;
  }
  const pagesRect = pdfPages.getBoundingClientRect();
  const clientX = pagesRect.left + pdfPages.clientWidth / 2;
  const clientY = pagesRect.top + pdfPages.clientHeight / 2;
  const page =
    pageElements.find((element) => {
      const rect = element.getBoundingClientRect();
      return rect.top <= clientY && rect.bottom >= clientY;
    }) ||
    pageElements.reduce((nearest, element) => {
      const rect = element.getBoundingClientRect();
      const distance = Math.min(
        Math.abs(clientY - rect.top),
        Math.abs(clientY - rect.bottom),
      );
      return !nearest || distance < nearest.distance
        ? { element, distance }
        : nearest;
    }, null)?.element;
  return page ? { page, clientX, clientY } : null;
}

async function getPdfOutlineDestination(item, documentToRead = pdfDocument) {
  if (!documentToRead || !item.dest) {
    return null;
  }

  const destination =
    typeof item.dest === "string"
      ? await documentToRead.getDestination(item.dest)
      : item.dest;
  if (!Array.isArray(destination) || destination.length === 0) {
    return null;
  }

  const pageRef = destination[0];
  const pageIndex = Number.isInteger(pageRef)
    ? pageRef
    : await documentToRead.getPageIndex(pageRef);
  return {
    pageNumber: pageIndex + 1,
    destination,
  };
}

function getPdfDestinationTop(destination) {
  const destinationType = destination?.[1]?.name;
  if (destinationType === "XYZ") {
    return destination[3];
  }
  if (destinationType === "FitH" || destinationType === "FitBH") {
    return destination[2];
  }
  if (destinationType === "FitR") {
    return destination[5];
  }
  return null;
}

async function getPdfDestinationOffsetRatio(
  target,
  documentToRead = pdfDocument,
) {
  const destinationTop = getPdfDestinationTop(target?.destination);
  if (
    !target?.pageNumber ||
    !documentToRead ||
    !Number.isFinite(destinationTop)
  ) {
    return 0;
  }

  const page = await documentToRead.getPage(target.pageNumber);
  const viewport = page.getViewport({ scale: 1 });
  const viewportY = viewport.convertToViewportPoint(0, destinationTop)[1];
  return Math.min(1, Math.max(0, viewportY / viewport.height));
}

async function scrollToPdfOutlineDestination(target, offsetRatio = null) {
  if (!target?.pageNumber || !pdfDocument) {
    return;
  }

  const documentToRead = pdfDocument;
  let pageElement = pdfPages.querySelector(
    `[data-page-number="${target.pageNumber}"]`,
  );
  if (!pageElement && pdfPreviewPromise) {
    await pdfPreviewPromise;
    if (pdfDocument !== documentToRead) {
      return;
    }
    pageElement = pdfPages.querySelector(
      `[data-page-number="${target.pageNumber}"]`,
    );
  }
  if (!pageElement) {
    return;
  }

  const normalizedOffset = Number.isFinite(offsetRatio)
    ? offsetRatio
    : await getPdfDestinationOffsetRatio(target, documentToRead);
  const offsetWithinPage = pageElement.clientHeight * normalizedOffset;

  const pagesRect = pdfPages.getBoundingClientRect();
  const pageRect = pageElement.getBoundingClientRect();
  const targetTop =
    pdfPages.scrollTop + pageRect.top - pagesRect.top + offsetWithinPage - 16;
  pdfPages.scrollTo({
    top: Math.max(0, targetTop),
    behavior: "smooth",
  });
}

function setActivePdfOutlineButton(button) {
  if (activePdfOutlineButton === button) {
    return;
  }
  activePdfOutlineButton?.classList.remove("is-current");
  activePdfOutlineButton = button || null;
  activePdfOutlineButton?.classList.add("is-current");
  if (activePdfOutlineButton && !pdfOutline.hidden) {
    activePdfOutlineButton.scrollIntoView({ block: "nearest" });
  }
}

function updateActivePdfOutline() {
  pdfOutlineHighlightFrame = null;
  const pagesRect = pdfPages.getBoundingClientRect();
  const readerPosition =
    pdfPages.scrollTop + Math.min(48, pdfPages.clientHeight * 0.12);
  const pagePositions = new Map();
  let activeEntry = null;
  let activePosition = -Infinity;
  for (const entry of pdfOutlineEntries) {
    if (!entry.pageNumber || !Number.isFinite(entry.pageOffsetRatio)) {
      continue;
    }
    let pagePosition = pagePositions.get(entry.pageNumber);
    if (!pagePosition) {
      const pageElement = pdfPages.querySelector(
        `[data-page-number="${entry.pageNumber}"]`,
      );
      if (!pageElement) {
        continue;
      }
      const pageRect = pageElement.getBoundingClientRect();
      pagePosition = {
        top: pdfPages.scrollTop + pageRect.top - pagesRect.top,
        height: pageElement.clientHeight,
      };
      pagePositions.set(entry.pageNumber, pagePosition);
    }
    const entryPosition =
      pagePosition.top + pagePosition.height * entry.pageOffsetRatio;
    if (entryPosition <= readerPosition && entryPosition >= activePosition) {
      activeEntry = entry;
      activePosition = entryPosition;
    }
  }
  if (activeEntry) {
    setActivePdfOutlineButton(activeEntry.button);
  }
}

function schedulePdfOutlineHighlight() {
  if (pdfOutlineHighlightFrame !== null) {
    return;
  }
  pdfOutlineHighlightFrame = requestAnimationFrame(updateActivePdfOutline);
}

async function indexPdfOutlineEntries(entries) {
  const version = ++pdfOutlineIndexVersion;
  const documentToRead = pdfDocument;
  let nextIndex = 0;
  const workerCount = Math.min(8, entries.length);
  const workers = Array.from({ length: workerCount }, async () => {
    while (version === pdfOutlineIndexVersion && nextIndex < entries.length) {
      const entry = entries[nextIndex++];
      try {
        const target = await getPdfOutlineDestination(
          entry.item,
          documentToRead,
        );
        entry.pageNumber = target?.pageNumber || null;
        entry.destination = target?.destination || null;
        entry.pageOffsetRatio = target
          ? await getPdfDestinationOffsetRatio(target, documentToRead)
          : null;
      } catch (_error) {
        entry.pageNumber = null;
        entry.destination = null;
        entry.pageOffsetRatio = null;
      }
      schedulePdfOutlineHighlight();
    }
  });
  await Promise.all(workers);
  if (version === pdfOutlineIndexVersion) {
    schedulePdfOutlineHighlight();
  }
}

function createPdfOutlineItems(items, entries) {
  const list = document.createElement("ul");

  for (const item of items) {
    const listItem = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = item.title || "未命名章节";
    button.disabled = !item.dest;
    if (item.bold) {
      button.classList.add("is-bold");
    }
    if (item.italic) {
      button.classList.add("is-italic");
    }
    const entry = {
      item,
      button,
      pageNumber: null,
      destination: null,
      pageOffsetRatio: null,
    };
    entries.push(entry);
    button.addEventListener("click", async () => {
      const target =
        entry.pageNumber && entry.destination
          ? { pageNumber: entry.pageNumber, destination: entry.destination }
          : await getPdfOutlineDestination(item);
      if (target?.pageNumber) {
        entry.pageNumber = target.pageNumber;
        entry.destination = target.destination;
        if (!Number.isFinite(entry.pageOffsetRatio)) {
          entry.pageOffsetRatio = await getPdfDestinationOffsetRatio(target);
        }
        setActivePdfOutlineButton(button);
      }
      await scrollToPdfOutlineDestination(target, entry.pageOffsetRatio);
    });
    listItem.append(button);

    if (Array.isArray(item.items) && item.items.length > 0) {
      listItem.append(createPdfOutlineItems(item.items, entries));
    }
    list.append(listItem);
  }

  return list;
}

function renderPdfOutline(items) {
  pdfOutlineList.innerHTML = "";
  pdfOutlineEntries = [];
  activePdfOutlineButton = null;
  pdfOutlineIndexVersion++;
  if (!Array.isArray(items) || items.length === 0) {
    const empty = document.createElement("p");
    empty.className = "pdf-outline-empty";
    empty.textContent = "该文档没有目录";
    pdfOutlineList.append(empty);
    return;
  }

  const entries = [];
  pdfOutlineList.append(createPdfOutlineItems(items, entries));
  pdfOutlineEntries = entries;
  indexPdfOutlineEntries(entries).catch(console.error);
}

function loadPdfPreview(pdf, initialZoom = 1) {
  const previewKey = getPdfPreviewKey(pdf);
  if (pdfPreviewKey === previewKey) {
    return pdfPreviewPromise || Promise.resolve();
  }

  destroyPdfPreview();
  pdfPreviewKey = previewKey;
  pdfZoom = Math.min(2, Math.max(0.5, Number(initialZoom) || 1));
  pdfZoomValue.textContent = `${Math.round(pdfZoom * 100)}%`;
  pdfZoomOut.disabled = pdfZoom <= 0.5;
  pdfZoomIn.disabled = pdfZoom >= 2;
  pdfOutline.hidden = false;
  pdfOutlineToggle.classList.add("is-active");
  pdfOutlineList.textContent = "正在读取目录…";
  showPdfStatus("正在加载 PDF…");
  const version = ++pdfLoadVersion;

  const previewPromise = (async () => {
    try {
      const bytes = await window.noticeNote.readPdf(pdf.id);
      if (version !== pdfLoadVersion) {
        return;
      }

      pdfLoadingTask = window.noticeNotePdf.getDocument({
        data: new Uint8Array(bytes),
      });
      pdfDocument = await pdfLoadingTask.promise;
      if (version !== pdfLoadVersion) {
        return;
      }

      pdfPageCount.textContent = `${pdfDocument.numPages} 页`;
      const outlinePromise = pdfDocument.getOutline().then((outline) => {
        if (version === pdfLoadVersion) {
          renderPdfOutline(outline);
        }
      });
      const [, pagesRendered] = await Promise.all([
        outlinePromise,
        renderPdfPages(),
      ]);
      if (version === pdfLoadVersion && pagesRendered) {
        pdfPreviewReadyKey = previewKey;
      }
    } catch (error) {
      if (version === pdfLoadVersion) {
        pdfPreviewKey = null;
        pdfPreviewReadyKey = null;
        showPdfStatus(`PDF 加载失败：${error.message}`, true);
      }
    }
  })();
  pdfPreviewPromise = previewPromise;
  return previewPromise.finally(() => {
    if (pdfPreviewPromise === previewPromise) {
      pdfPreviewPromise = null;
    }
  });
}

async function changePdfZoom(step, anchor = null) {
  const nextZoom = Math.min(2, Math.max(0.5, pdfZoom + step));
  if (nextZoom === pdfZoom) {
    return;
  }

  const viewportAnchor = getPdfViewportAnchor(anchor);
  const pageNumber = viewportAnchor?.page?.dataset.pageNumber;
  const pageRect = viewportAnchor?.page?.getBoundingClientRect();
  const anchorRatioX = pageRect
    ? Math.min(
        1,
        Math.max(0, (viewportAnchor.clientX - pageRect.left) / pageRect.width),
      )
    : 0;
  const anchorRatioY = pageRect
    ? Math.min(
        1,
        Math.max(0, (viewportAnchor.clientY - pageRect.top) / pageRect.height),
      )
    : 0;

  const restoreAnchor = () => {
    if (!pageNumber || pdfZoom !== nextZoom) {
      return;
    }
    const nextPage = pdfPages.querySelector(
      `[data-page-number="${pageNumber}"]`,
    );
    const nextRect = nextPage?.getBoundingClientRect();
    if (!nextRect) {
      return;
    }
    pdfPages.scrollLeft +=
      nextRect.left + nextRect.width * anchorRatioX - viewportAnchor.clientX;
    pdfPages.scrollTop +=
      nextRect.top + nextRect.height * anchorRatioY - viewportAnchor.clientY;
  };

  pdfZoom = nextZoom;
  pdfZoomValue.textContent = `${Math.round(pdfZoom * 100)}%`;
  pdfZoomOut.disabled = pdfZoom <= 0.5;
  pdfZoomIn.disabled = pdfZoom >= 2;
  const previewKey = pdfPreviewKey;
  pdfPreviewReadyKey = null;
  const pagesRendered = await renderPdfPages({
    priorityPageNumber: pageNumber,
    onLayoutReady: restoreAnchor,
  });
  if (pagesRendered && previewKey && pdfPreviewKey === previewKey) {
    pdfPreviewReadyKey = previewKey;
  }
}

function changeImageZoom(step, anchor) {
  const image = fileViewerContent.querySelector(".file-preview-image");
  if (!image?.complete || !image.naturalWidth) {
    return;
  }

  const nextZoom = Math.min(5, Math.max(0.25, imageZoom + step));
  if (nextZoom === imageZoom) {
    return;
  }

  const previousRect = image.getBoundingClientRect();
  if (imageZoom === 1) {
    image.dataset.baseWidth = String(previousRect.width);
    image.dataset.baseHeight = String(previousRect.height);
  }

  const anchorRatioX =
    (anchor.clientX - previousRect.left) / previousRect.width;
  const anchorRatioY =
    (anchor.clientY - previousRect.top) / previousRect.height;
  const baseWidth =
    Number(image.dataset.baseWidth) || previousRect.width / imageZoom;
  const baseHeight =
    Number(image.dataset.baseHeight) || previousRect.height / imageZoom;

  imageZoom = nextZoom;
  image.style.maxWidth = "none";
  image.style.maxHeight = "none";
  image.style.width = `${baseWidth * imageZoom}px`;
  image.style.height = `${baseHeight * imageZoom}px`;

  const nextRect = image.getBoundingClientRect();
  fileViewerContent.scrollLeft +=
    nextRect.left + nextRect.width * anchorRatioX - anchor.clientX;
  fileViewerContent.scrollTop +=
    nextRect.top + nextRect.height * anchorRatioY - anchor.clientY;
}

function renderPdf() {
  const pdf = pdfFiles.find((item) => item.id === activePdfId);
  if (!pdf) {
    activePdfId = null;
    renderEditor();
    return;
  }

  editorPanel.hidden = true;
  pdfViewer.hidden = false;
  fileViewer.hidden = true;
  filePreviewVersion++;
  pdfTitle.textContent = pdf.name;
  pdfMeta.textContent = `PDF 文档 · ${formatFileSize(pdf.size)} · 创建于 ${formatListDateTime(pdf.createdAt)} · 修改于 ${formatListDateTime(pdf.updatedAt)}`;
  pdfPath.textContent = pdf.path;
  pdfPath.title = pdf.path;
  const tabKey = getWorkspaceTabKey("pdf", pdf.id);
  const viewState = workspaceTabViewStates.get(tabKey);
  renderNoteList();
  renderWorkspaceTabs();
  const previewKey = getPdfPreviewKey(pdf);
  const canRestoreImmediately = pdfPreviewReadyKey === previewKey;
  const previewPromise = loadPdfPreview(pdf, viewState?.pdfZoom);
  if (canRestoreImmediately) {
    restoreWorkspaceTabViewState(tabKey, pdfPages);
  }
  previewPromise
    .then(() => {
      if (!canRestoreImmediately) {
        restoreWorkspaceTabViewState(tabKey, pdfPages);
      }
    })
    .catch((error) => showPdfStatus(`PDF 加载失败：${error.message}`, true));
}

function showFilePreviewStatus(message) {
  fileViewerContent.innerHTML = "";
  if (!message) return;
  const status = document.createElement("div");
  status.className = "file-preview-status";
  status.textContent = message;
  fileViewerContent.append(status);
}

function showFileViewerToast(message, isError = false) {
  if (!fileViewerToast) return;
  if (!message) {
    fileViewerToast.hidden = true;
    return;
  }
  fileViewerToast.textContent = message;
  fileViewerToast.className = `file-viewer-toast ${isError ? 'is-error' : 'is-success'}`;
  fileViewerToast.hidden = false;
  clearTimeout(fileViewerToastTimer);
  fileViewerToastTimer = setTimeout(() => {
    if (fileViewerToast) fileViewerToast.hidden = true;
  }, 4500);
}

function applySpreadsheetBorder(element, side, border) {
  if (!border) {
    return;
  }

  const width = [
    "medium",
    "mediumDashed",
    "mediumDashDot",
    "mediumDashDotDot",
  ].includes(border.style)
    ? 2
    : border.style === "thick"
      ? 3
      : 1;
  const lineStyle =
    border.style === "double"
      ? "double"
      : border.style.includes("dash") || border.style.includes("Dash")
        ? "dashed"
        : border.style === "dotted" || border.style === "hair"
          ? "dotted"
          : "solid";
  element.style[`border${side}Width`] =
    `${border.style === "double" ? 3 : width}px`;
  element.style[`border${side}Style`] = lineStyle;
  element.style[`border${side}Color`] = border.color || "#5f594e";
}

function applySpreadsheetCellStyle(cell, style = {}) {
  if (style.fontName) {
    cell.style.fontFamily = `"${style.fontName}", "Microsoft YaHei", sans-serif`;
  }
  if (style.fontSize) {
    cell.style.fontSize = `${style.fontSize}pt`;
  }
  cell.style.fontWeight = style.bold ? "700" : "400";
  cell.style.fontStyle = style.italic ? "italic" : "normal";
  if (style.underline || style.strike) {
    cell.style.textDecoration = [
      style.underline ? "underline" : "",
      style.strike ? "line-through" : "",
    ]
      .filter(Boolean)
      .join(" ");
  }
  if (style.fontColor) {
    cell.style.color = style.fontColor;
  }
  if (style.fillColor) {
    cell.style.backgroundColor = style.fillColor;
  }

  const horizontal =
    style.horizontal === "centerContinuous" ? "center" : style.horizontal;
  if (["left", "center", "right", "justify"].includes(horizontal)) {
    cell.style.textAlign = horizontal;
  }
  if (style.vertical === "middle") {
    cell.style.verticalAlign = "middle";
  } else if (["top", "bottom"].includes(style.vertical)) {
    cell.style.verticalAlign = style.vertical;
  }
  if (style.wrapText) {
    cell.style.whiteSpace = "normal";
    cell.style.overflowWrap = "anywhere";
  }

  applySpreadsheetBorder(cell, "Top", style.borders?.top);
  applySpreadsheetBorder(cell, "Right", style.borders?.right);
  applySpreadsheetBorder(cell, "Bottom", style.borders?.bottom);
  applySpreadsheetBorder(cell, "Left", style.borders?.left);
}

function renderSpreadsheetPreview(sheets) {
  fileViewerContent.innerHTML = "";
  const preview = document.createElement("div");
  preview.className = "spreadsheet-preview";
  const tabs = document.createElement("div");
  tabs.className = "spreadsheet-sheet-tabs";
  const sheetRoot = document.createElement("div");
  preview.append(tabs, sheetRoot);
  fileViewerContent.append(preview);

  const renderSheet = (sheet, activeButton) => {
    for (const button of tabs.querySelectorAll("button")) {
      button.classList.toggle("is-active", button === activeButton);
    }
    sheetRoot.innerHTML = "";
    const section = document.createElement("section");
    section.className = "spreadsheet-preview-sheet";
    const heading = document.createElement("h2");
    heading.textContent = sheet.name;
    const tableWrap = document.createElement("div");
    tableWrap.className = "spreadsheet-preview-table-wrap";
    const table = document.createElement("table");
    table.className = "spreadsheet-preview-table";

    const colgroup = document.createElement("colgroup");
    for (const column of sheet.columns || []) {
      const col = document.createElement("col");
      col.style.width = `${column.width}px`;
      colgroup.append(col);
    }
    const tableWidth = (sheet.columns || []).reduce(
      (total, column) => total + column.width,
      0,
    );
    if (tableWidth > 0) {
      table.style.width = `${tableWidth}px`;
    }
    table.append(colgroup);

    for (const row of sheet.rows) {
      const tr = document.createElement("tr");
      if (row.height) {
        tr.style.height = `${row.height}px`;
      }
      for (const cell of row.cells) {
        if (cell.skip) {
          continue;
        }
        const td = document.createElement("td");
        td.textContent = cell.value;
        if (cell.rowSpan > 1) {
          td.rowSpan = cell.rowSpan;
        }
        if (cell.columnSpan > 1) {
          td.colSpan = cell.columnSpan;
        }
        applySpreadsheetCellStyle(td, cell.style);
        tr.append(td);
      }
      table.append(tr);
    }
    tableWrap.append(table);
    section.append(heading, tableWrap);

    if (sheet.truncated) {
      const note = document.createElement("p");
      note.className = "spreadsheet-preview-note";
      note.textContent = "表格较大，当前仅显示前 500 行、50 列。";
      section.append(note);
    }
    sheetRoot.append(section);
  };

  for (const [index, sheet] of sheets.entries()) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = sheet.name;
    button.addEventListener("click", () => renderSheet(sheet, button));
    tabs.append(button);
    if (index === 0) {
      renderSheet(sheet, button);
    }
  }
}

function appendSanitizedWordNode(sourceNode, targetParent) {
  if (sourceNode.nodeType === Node.TEXT_NODE) {
    targetParent.append(document.createTextNode(sourceNode.textContent || ""));
    return;
  }
  if (sourceNode.nodeType !== Node.ELEMENT_NODE) {
    return;
  }

  const tagName = sourceNode.tagName.toLowerCase();
  const allowedTags = new Set([
    "p",
    "br",
    "strong",
    "em",
    "u",
    "s",
    "sup",
    "sub",
    "a",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "ul",
    "ol",
    "li",
    "table",
    "thead",
    "tbody",
    "tfoot",
    "tr",
    "th",
    "td",
    "img",
    "blockquote",
    "hr",
  ]);

  if (!allowedTags.has(tagName)) {
    for (const child of sourceNode.childNodes) {
      appendSanitizedWordNode(child, targetParent);
    }
    return;
  }

  const target = document.createElement(tagName);
  if (sourceNode.id) {
    target.id = sourceNode.id;
  }

  const wordClasses = [...sourceNode.classList].filter((className) =>
    className.startsWith("word-"),
  );
  if (wordClasses.length > 0) {
    target.className = wordClasses.join(" ");
  }

  if (tagName === "a") {
    const href = sourceNode.getAttribute("href") || "";
    if (href.startsWith("#")) {
      target.setAttribute("href", href);
    }
  } else if (tagName === "img") {
    const src = sourceNode.getAttribute("src") || "";
    if (/^data:image\/(?:png|jpe?g|gif|webp);base64,/i.test(src)) {
      target.setAttribute("src", src);
    }
    target.setAttribute("alt", sourceNode.getAttribute("alt") || "文档图片");
  } else if (tagName === "td" || tagName === "th") {
    for (const attributeName of ["colspan", "rowspan"]) {
      const value = Number(sourceNode.getAttribute(attributeName));
      if (Number.isInteger(value) && value > 1 && value <= 100) {
        target.setAttribute(attributeName, String(value));
      }
    }
  }

  for (const child of sourceNode.childNodes) {
    appendSanitizedWordNode(child, target);
  }
  targetParent.append(target);
}

function enhanceWordPreview(content) {
  const children = [...content.children];
  const tocIndex = children.findIndex((element) => {
    return (
      element.tagName === "P" &&
      element.textContent.replace(/\s/g, "") === "目录"
    );
  });
  if (tocIndex < 3) {
    return;
  }

  const coverElements = children.slice(0, tocIndex);
  const cover = document.createElement("section");
  cover.className = "word-cover";
  content.insertBefore(cover, coverElements[0]);
  cover.append(...coverElements);

  const paragraphs = [...cover.querySelectorAll(":scope > p")];
  paragraphs[0]?.classList.add("word-cover-organization");
  const title =
    paragraphs.find((paragraph) => {
      return /(规格书|方案|报告|说明书|合同|招标文件|技术要求)/.test(
        paragraph.textContent,
      );
    }) || paragraphs[1];
  title?.classList.add("word-cover-title");

  for (const paragraph of paragraphs) {
    const text = paragraph.textContent.replace(/\s/g, "");
    if (/(编制人|审核人|分管领导|主要领导|负责人)[:：]/.test(text)) {
      paragraph.classList.add("word-cover-field");
    } else if (/^\d{4}年\d{1,2}月(?:\d{1,2}日)?$/.test(text)) {
      paragraph.classList.add("word-cover-date");
    }
  }

  children[tocIndex].classList.add("word-toc-title");
}

function updateWordOutlineHighlight() {
  wordOutlineHighlightFrame = null;
  if (wordOutline.hidden || wordOutlineHeadings.length === 0) {
    return;
  }

  const viewerTop = fileViewerContent.getBoundingClientRect().top + 88;
  let activeIndex = 0;
  for (const [index, entry] of wordOutlineHeadings.entries()) {
    if (entry.target.getBoundingClientRect().top <= viewerTop) {
      activeIndex = index;
    } else {
      break;
    }
  }

  for (const [index, entry] of wordOutlineHeadings.entries()) {
    entry.button.classList.toggle("is-current", index === activeIndex);
  }
}

function scheduleWordOutlineHighlight() {
  if (wordOutlineHighlightFrame !== null) {
    return;
  }
  wordOutlineHighlightFrame = requestAnimationFrame(updateWordOutlineHighlight);
}

function renderWordOutline(content) {
  wordOutlineList.innerHTML = "";
  wordOutlineHeadings = [];

  const targetsById = new Map(
    [...content.querySelectorAll("[id]")].map((element) => [
      element.id,
      element,
    ]),
  );

  const tocTitleEl = content.querySelector(".word-toc-title");
  const tocAreaElements = new Set();
  if (tocTitleEl) {
    let sibling = tocTitleEl.nextElementSibling;
    while (sibling) {
      const text = sibling.textContent.trim();
      if (
        sibling.tagName === "P" &&
        /^\d+(?:\.\d+)*[\s.、]+[\u4e00-\u9fa5A-Za-z]/.test(text)
      ) {
        tocAreaElements.add(sibling);
        sibling = sibling.nextElementSibling;
      } else if (sibling.classList.contains("word-toc")) {
        tocAreaElements.add(sibling);
        sibling = sibling.nextElementSibling;
      } else {
        break;
      }
    }
  }

  const isInsideTocArea = (el) => {
    if (!el) return false;
    if (
      el.closest(".word-toc") ||
      el.closest(".word-cover") ||
      el.classList.contains("word-toc-title")
    ) {
      return true;
    }
    if (tocAreaElements.has(el)) return true;
    return false;
  };

  const isHeadingLikeText = (text) => {
    return /^[1-9]\d*(?:\.\d+)*(?:[\s.、]+)[\u4e00-\u9fa5A-Za-z]/.test(text);
  };

  const findBodyTargetForText = (rawText) => {
    if (!rawText) return null;
    const cleanTitle = rawText.replace(/\s+\d+\s*$/, "").trim();
    const numMatch = cleanTitle.match(/^(\d+(?:\.\d+)*)/);
    const searchNum = numMatch ? numMatch[1] : "";

    const candidates = [
      ...content.querySelectorAll("h1, h2, h3, h4, h5, h6, p, li"),
    ];
    return candidates.find((candidate) => {
      if (isInsideTocArea(candidate)) return false;
      if (candidate.closest("table")) return false;
      const candText = candidate.textContent.trim();
      if (
        searchNum &&
        (candText === cleanTitle ||
          candText.startsWith(`${searchNum} `) ||
          candText.startsWith(`${searchNum}.`))
      ) {
        return true;
      }
      return candText === cleanTitle;
    });
  };

  const tocEntries = [...content.querySelectorAll(".word-toc")]
    .map((paragraph) => {
      const link = paragraph.querySelector('a[href^="#"]');
      const targetId = link?.getAttribute("href")?.slice(1) || "";
      let target = targetId ? targetsById.get(targetId) : null;
      const rawText = (link?.textContent || paragraph.textContent)
        .replace(/\s+\d+\s*$/, "")
        .trim();

      if (!target || isInsideTocArea(target)) {
        target = findBodyTargetForText(rawText);
      }

      const levelClass = [...paragraph.classList].find((className) =>
        /^word-toc-[1-6]$/.test(className),
      );
      return {
        target: target || paragraph,
        label: rawText,
        level: Math.max(0, Number(levelClass?.slice(-1) || 1) - 1),
      };
    })
    .filter((entry) => entry.label);

  const implicitTocEntries = [];
  if (tocEntries.length === 0 && tocAreaElements.size > 0) {
    for (const el of tocAreaElements) {
      const text = el.textContent.trim();
      const cleanLabel = text.replace(/\s+\d+\s*$/, "").trim();
      if (!cleanLabel) continue;
      const target = findBodyTargetForText(cleanLabel);
      const numDotCount = (cleanLabel.match(/\./g) || []).length;
      implicitTocEntries.push({
        target: target || el,
        label: cleanLabel,
        level: Math.min(4, numDotCount),
      });
    }
  }

  const headingEntries = [
    ...content.querySelectorAll("h1, h2, h3, h4, h5, h6"),
  ]
    .filter((heading) => {
      return (
        heading.textContent.trim() &&
        !isInsideTocArea(heading) &&
        !heading.classList.contains("word-document-title")
      );
    })
    .map((heading, index) => {
      if (!heading.id) {
        heading.id = `word-heading-${index + 1}`;
      }
      return {
        target: heading,
        label: heading.textContent.trim(),
        level: Math.max(0, Number(heading.tagName.slice(1)) - 1),
      };
    });

  const numberedParagraphEntries = [
    ...content.querySelectorAll("p, li, h1, h2, h3, h4, h5, h6"),
  ]
    .filter((el) => {
      if (isInsideTocArea(el)) return false;
      if (el.closest("table")) return false;
      const text = el.textContent.trim();
      return (
        !el.classList.contains("word-document-title") &&
        isHeadingLikeText(text) &&
        text.length >= 4 &&
        text.length <= 100
      );
    })
    .map((el, index) => {
      if (!el.id) {
        el.id = `word-num-heading-${index + 1}`;
      }
      const text = el.textContent.trim();
      const numDotCount = (text.match(/\./g) || []).length;
      return {
        target: el,
        label: text,
        level: Math.min(4, numDotCount),
      };
    });

  let outlineEntries =
    tocEntries.length > 0
      ? tocEntries
      : implicitTocEntries.length > 0
        ? implicitTocEntries
        : headingEntries;
  if (outlineEntries.length === 0) {
    outlineEntries = numberedParagraphEntries;
  }

  for (const entry of outlineEntries) {
    if (!entry.target || isInsideTocArea(entry.target)) {
      const bodyTarget = findBodyTargetForText(entry.label);
      if (bodyTarget) {
        entry.target = bodyTarget;
      }
    }
  }

  if (outlineEntries.length === 0) {
    const empty = document.createElement("p");
    empty.className = "word-outline-empty";
    empty.textContent = "文档中没有可用的目录或标题。";
    wordOutlineList.append(empty);
    return;
  }

  for (const entry of outlineEntries) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = entry.label;
    button.style.paddingLeft = `${8 + entry.level * 12}px`;
    button.title = button.textContent;
    button.addEventListener("click", () => {
      if (entry.target) {
        entry.target.scrollIntoView({ behavior: "smooth", block: "start" });
        entry.target.classList.add("word-heading-highlight");
        setTimeout(
          () => entry.target.classList.remove("word-heading-highlight"),
          2000,
        );
      }
      for (const outlineEntry of wordOutlineHeadings) {
        outlineEntry.button.classList.toggle(
          "is-current",
          outlineEntry.button === button,
        );
      }
    });
    wordOutlineList.append(button);
    wordOutlineHeadings.push({ target: entry.target, button });
  }
  scheduleWordOutlineHighlight();
}

function renderWordPreview(html) {
  const content = document.createElement("article");
  content.className = "word-preview";
  const parsed = new DOMParser().parseFromString(html || "", "text/html");

  for (const child of parsed.body.childNodes) {
    appendSanitizedWordNode(child, content);
  }

  if (!content.hasChildNodes()) {
    content.textContent = "文档没有可显示的内容。";
  } else {
    enhanceWordPreview(content);
  }

  content.addEventListener("click", (event) => {
    if (isFileEditingMode) return;
    const link =
      event.target.closest("a[href^='#']") ||
      event.target.closest(".word-toc") ||
      event.target.closest("p");
    if (!link) return;
    if (link.closest("table")) return;

    const text = link.textContent.trim();

    const tocTitle = content.querySelector(".word-toc-title");
    let isInTocArea = false;
    if (tocTitle) {
      let sib = tocTitle.nextElementSibling;
      while (sib) {
        if (sib === link) {
          isInTocArea = true;
          break;
        }
        const sibText = sib.textContent.trim();
        if (
          sib.tagName === "P" &&
          /^\d+(?:\.\d+)*[\s.、]+[\u4e00-\u9fa5A-Za-z]/.test(sibText)
        ) {
          sib = sib.nextElementSibling;
        } else if (sib.classList.contains("word-toc")) {
          sib = sib.nextElementSibling;
        } else {
          break;
        }
      }
    }

    const isTocElement =
      link.classList.contains("word-toc") ||
      Boolean(link.querySelector("a[href^='#']")) ||
      isInTocArea;
    const isNumberedTocText =
      /^[1-9]\d*(?:\.\d+)*\s+\S+/.test(text) && /\s+\d+\s*$/.test(text);

    if (!isTocElement && !isNumberedTocText) return;

    const href =
      link.getAttribute?.("href") ||
      link.querySelector?.("a")?.getAttribute("href") ||
      "";
    const targetId = href.startsWith("#") ? href.slice(1) : "";

    let target = targetId
      ? content.querySelector(`#${CSS.escape(targetId)}`)
      : null;

    if (!target) {
      const cleanTitle = text.replace(/\s+\d+\s*$/, "").trim();
      const numMatch = cleanTitle.match(/^(\d+(?:\.\d+)*)/);
      const searchNum = numMatch ? numMatch[1] : "";

      const candidates = [
        ...content.querySelectorAll("h1, h2, h3, h4, h5, h6, p, li"),
      ];
      target = candidates.find((el) => {
        if (el === link || el.closest("table")) return false;
        if (
          el.closest(".word-toc") ||
          el.closest(".word-cover")
        )
          return false;
        if (tocTitle) {
          let sib2 = tocTitle.nextElementSibling;
          while (sib2) {
            if (sib2 === el) return false;
            if (
              sib2.tagName === "P" &&
              /^\d+(?:\.\d+)*[\s.、]+[\u4e00-\u9fa5A-Za-z]/.test(
                sib2.textContent.trim(),
              )
            ) {
              sib2 = sib2.nextElementSibling;
            } else if (sib2.classList.contains("word-toc")) {
              sib2 = sib2.nextElementSibling;
            } else {
              break;
            }
          }
        }
        const elText = el.textContent.trim();
        if (
          searchNum &&
          (elText === cleanTitle ||
            elText.startsWith(`${searchNum} `) ||
            elText.startsWith(`${searchNum}.`))
        ) {
          return true;
        }
        return elText === cleanTitle;
      });
    }

    if (target) {
      event.preventDefault();
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      target.classList.add("word-heading-highlight");
      setTimeout(
        () => target.classList.remove("word-heading-highlight"),
        2000,
      );
    }
  });

  fileViewerContent.append(content);
  renderWordOutline(content);
  if (!viewerSearchBar.hidden) {
    updateViewerSearch();
  }
}

async function loadResourcePreview(file, version, viewState = {}) {
  try {
    const preview = await window.noticeNote.previewFile(file.id);
    if (version !== filePreviewVersion) {
      return;
    }

    fileViewerContent.innerHTML = "";
    if (preview.kind === "image") {
      imageZoom = Math.min(4, Math.max(0.25, Number(viewState.imageZoom) || 1));
      const image = document.createElement("img");
      image.className = "file-preview-image";
      image.alt = file.name;
      const imageLoaded = new Promise((resolve) => {
        image.addEventListener(
          "load",
          () => {
            const rect = image.getBoundingClientRect();
            image.dataset.baseWidth = String(rect.width);
            image.dataset.baseHeight = String(rect.height);
            if (imageZoom !== 1) {
              image.style.maxWidth = "none";
              image.style.maxHeight = "none";
              image.style.width = `${rect.width * imageZoom}px`;
              image.style.height = `${rect.height * imageZoom}px`;
            }
            resolve();
          },
          { once: true },
        );
        image.addEventListener("error", resolve, { once: true });
      });
      image.src = preview.fileUrl;
      fileViewerContent.append(image);
      await imageLoaded;
    } else if (preview.kind === "word") {
      renderWordPreview(preview.html);
    } else if (preview.kind === "spreadsheet") {
      renderSpreadsheetPreview(preview.sheets);
    }
  } catch (error) {
    if (version === filePreviewVersion) {
      showFilePreviewStatus(`文件预览失败：${error.message}`);
    }
  }
}

function renderResourceFile() {
  const file = resourceFiles.find((item) => item.id === activeResourceId);
  if (!file || !file.canOpen || file.kind === "pdf") {
    activeResourceId = null;
    renderEditor();
    return;
  }

  editorPanel.hidden = true;
  pdfViewer.hidden = true;
  fileViewer.hidden = false;
  fileViewerIcon.textContent = file.typeLabel;
  fileViewerTitle.textContent = file.name;
  fileViewerMeta.textContent = `${formatFileSize(file.size)} · 创建于 ${formatListDateTime(file.createdAt)} · 修改于 ${formatListDateTime(file.updatedAt)}`;
  fileViewerType.textContent = file.typeLabel;
  fileViewerPath.textContent = file.path;
  fileViewerPath.title = file.path;
  const isWordPreview = file.kind === "word";
  wordOutlineToggle.hidden = !isWordPreview;
  wordOutlineToggle.classList.toggle("is-active", isWordPreview);
  wordOutlineToggle.setAttribute("aria-expanded", String(isWordPreview));
  wordOutline.hidden = !isWordPreview;
  wordOutlineList.innerHTML = "";
  wordOutlineHeadings = [];
  const tabKey = getWorkspaceTabKey("file", file.id);
  const viewState = workspaceTabViewStates.get(tabKey);
  resetFileViewerActions(file);
  showFilePreviewStatus("正在加载文件…");
  const version = ++filePreviewVersion;
  renderNoteList();
  renderWorkspaceTabs();
  loadResourcePreview(file, version, viewState)
    .then(() => restoreWorkspaceTabViewState(tabKey, fileViewerContent))
    .catch(console.error);
}

function resetFileViewerActions(file) {
  isFileEditingMode = false;
  showFileViewerToast('');
  const isOfficePreview = file && (file.kind === 'word' || file.kind === 'spreadsheet');
  if (fileViewerEditButton) {
    fileViewerEditButton.hidden = true;
    fileViewerEditButton.disabled = true;
  }
  if (fileViewerSaveButton) {
    fileViewerSaveButton.hidden = true;
    fileViewerSaveButton.disabled = true;
  }
  if (fileViewerAddRowButton) {
    fileViewerAddRowButton.hidden = true;
    fileViewerAddRowButton.disabled = true;
  }
  if (fileViewerAddColButton) {
    fileViewerAddColButton.hidden = true;
    fileViewerAddColButton.disabled = true;
  }
  if (fileViewerOpenExternalButton) {
    fileViewerOpenExternalButton.hidden = !file;
  }
  if (fileViewerReadOnlyNotice) {
    fileViewerReadOnlyNotice.hidden = !isOfficePreview;
  }
}

function toggleFileEditingMode() {
  showFileViewerToast(
    '为避免破坏原文件格式、公式和样式，请使用“外部打开”修改。',
    true,
  );
}

async function saveActiveFileChanges() {
  showFileViewerToast(
    '应用内保存已停用，以避免损坏 Word/Excel 文件；请使用“外部打开”。',
    true,
  );
}

function addSpreadsheetRow() {
  toggleFileEditingMode();
}

function addSpreadsheetCol() {
  toggleFileEditingMode();
}

function openActiveFileExternal() {
  const file = resourceFiles.find((item) => item.id === activeResourceId);
  if (!file) return;
  window.noticeNote.openEntryWithDefaultApp({ path: file.path }).catch(console.error);
}

function isEditingActiveNote() {
  return (
    document.activeElement === titleInput || Boolean(markdownEditor?.hasFocus())
  );
}

function mergeIncomingNotes(nextNotes) {
  if (activePdfId || activeResourceId) {
    notes = sortNotes(nextNotes);
    if (reconcileWorkspaceTabs()) {
      return;
    }
    renderNoteList();
    return;
  }

  const activeNote = getActiveNote();
  const activeSaveState = activeNote ? getNoteSaveState(activeNote.id) : null;
  const shouldKeepDraft =
    activeNote &&
    (isEditingActiveNote()
      || activeSaveState.dirty
      || Boolean(activeSaveState.inflight)) &&
    nextNotes.some((note) => note.id === activeNote.id);

  if (!shouldKeepDraft) {
    notes = sortNotes(nextNotes);
    if (reconcileWorkspaceTabs()) {
      return;
    }
    // 如果当前活跃的是草稿 Tab，不要调 renderEditor() 重置它，只刷新笔记列表
    if (activeDraftId) {
      renderNoteList();
      renderWorkspaceTabs();
      return;
    }
    renderEditor();
    return;
  }

  const draft = getDraftNote();
  notes = sortNotes(
    nextNotes.map((note) => {
      if (note.id !== activeNote.id) {
        return note;
      }

      return {
        ...note,
        title: draft.title,
        content: draft.content,
      };
    }),
  );
}

function createMarkdownEditor() {
  if (typeof window.createNoticeNoteEditor !== "function") {
    throw new TypeError("找不到可用的 Markdown 编辑器构造函数");
  }

  markdownEditor = window.createNoticeNoteEditor({
    parent: editorRoot,
    initialValue: "",
    placeholder: "点击这里记录 Markdown 笔记。",
    isPlainText: () => ["txt", "json"].includes(getActiveNote()?.fileType),
    revealState: blurRevealState,
    revealScope: () => getActiveNote()?.id || "",
    resolveImageSrc: resolveNoteImageSrc,
    onOpenImage: openImageLightbox,
    onOpenLink: (href) => {
      window.noticeNote
        .openExternalUrl(href)
        .catch((error) => alert(error.message || "打开链接失败"));
    },
    onPasteImage: handlePastedImage,
    onPasteHtml: handlePastedHtml,
    onError: (error) => {
      console.error("图片处理失败:", error);
    },
    onChange: (value) => {
      if (isRenderingEditor) {
        return;
      }

      const note = getActiveNote();
      if (note) {
        note.content = normalizeEditorContent(value, note);
      }
      queueSave();
    },
  });
}

async function selectNote(noteId) {
  await activateWorkspaceTab("note", noteId);
}

async function selectPdf(pdfId) {
  await activateWorkspaceTab("pdf", pdfId);
}

async function selectResourceFile(fileId) {
  const file = resourceFiles.find((item) => item.id === fileId);
  if (!file?.canOpen) {
    return;
  }
  await activateWorkspaceTab(file.kind === "pdf" ? "pdf" : "file", file.id);
}

function replaceNote(updatedNote) {
  const index = notes.findIndex((note) => note.id === updatedNote.id);
  if (index >= 0) {
    notes[index] = { ...notes[index], ...updatedNote };
  } else {
    notes.unshift(updatedNote);
  }
  notes = sortNotes(notes);
}

function getNoteSaveState(noteId) {
  let state = noteSaveStates.get(noteId);
  if (!state) {
    state = {
      dirty: false,
      inflight: null,
      generation: 0,
      timer: null,
      lastError: null,
      status: "idle",
    };
    noteSaveStates.set(noteId, state);
  }
  return state;
}

function readNoteRecoveryLog() {
  if (noteRecoveryLogCache) {
    return noteRecoveryLogCache;
  }
  try {
    const parsed = JSON.parse(
      localStorage.getItem(NOTE_RECOVERY_PERSIST_KEY) || "{}",
    );
    noteRecoveryLogCache = parsed && typeof parsed === "object" ? parsed : {};
  } catch (error) {
    console.error("读取笔记恢复日志失败:", error);
    noteRecoveryLogCache = {};
  }
  return noteRecoveryLogCache;
}

function writeNoteRecoveryLog() {
  try {
    localStorage.setItem(
      NOTE_RECOVERY_PERSIST_KEY,
      JSON.stringify(readNoteRecoveryLog()),
    );
  } catch (error) {
    console.error("写入笔记恢复日志失败:", error);
  }
}

function isNoteInProtectedFolder(note) {
  const ancestorIds = getFolderAncestorIds(note?.folderId);
  return folders.some(
    (folder) => folder.isProtected && ancestorIds.has(folder.id),
  );
}

function removeNoteRecovery(noteId) {
  const recoveryLog = readNoteRecoveryLog();
  if (!Object.hasOwn(recoveryLog, noteId)) {
    return;
  }
  delete recoveryLog[noteId];
  writeNoteRecoveryLog();
}

function persistNoteRecovery(note) {
  if (!note || activeDraftId || isNoteInProtectedFolder(note)) {
    if (note?.id) {
      removeNoteRecovery(note.id);
    }
    return;
  }
  const recoveryLog = readNoteRecoveryLog();
  recoveryLog[note.id] = {
    title: String(note.title || ""),
    content: String(note.content || ""),
    updatedAt: new Date().toISOString(),
  };
  writeNoteRecoveryLog();
}

function persistActiveNoteRecovery() {
  if (activeDraftId) {
    return;
  }
  const note = getActiveNote();
  const draft = getDraftNote();
  if (!note || !draft) {
    return;
  }
  const state = noteSaveStates.get(note.id);
  if (!state?.dirty && !state?.inflight) {
    return;
  }
  note.title = draft.title;
  note.content = draft.content;
  persistNoteRecovery(note);
}

function restoreNotesFromRecoveryLog() {
  const recoveryLog = readNoteRecoveryLog();
  const restoredTitles = [];
  for (const [noteId, recovery] of Object.entries(recoveryLog)) {
    const note = notes.find((item) => item.id === noteId);
    if (!note || isNoteInProtectedFolder(note)) {
      delete recoveryLog[noteId];
      continue;
    }
    const title = String(recovery?.title || "");
    const content = String(recovery?.content || "");
    if (note.title === title && note.content === content) {
      delete recoveryLog[noteId];
      continue;
    }
    note.title = title;
    note.content = content;
    const state = getNoteSaveState(note.id);
    state.dirty = true;
    state.generation += 1;
    state.status = "recovered";
    restoredTitles.push(note.title || "未命名笔记");
    scheduleNoteSave(note.id);
  }
  writeNoteRecoveryLog();
  return restoredTitles;
}

function getSaveErrorMessage(error) {
  return String(error?.message || "未知错误").replace(
    /^Error invoking remote method '[^']+': (?:[A-Za-z]*Error: )?/,
    "",
  );
}

function renderSaveStatus() {
  if (!saveStatus || activeDraftId || !activeNoteId) {
    if (saveStatus) {
      saveStatus.textContent = "";
      saveStatus.className = "save-status";
    }
    return;
  }
  const state = noteSaveStates.get(activeNoteId);
  saveStatus.className = "save-status";
  saveButton.textContent = state?.lastError ? "重试保存" : "保存";
  if (state?.inflight) {
    saveStatus.textContent = "正在保存…";
    saveStatus.classList.add("is-saving");
  } else if (state?.lastError) {
    saveStatus.textContent = `保存失败：${getSaveErrorMessage(state.lastError)}`;
    saveStatus.classList.add("is-error");
  } else if (state?.dirty) {
    saveStatus.textContent = state.status === "recovered"
      ? "已恢复未保存内容，等待保存…"
      : "等待自动保存…";
    saveStatus.classList.add("is-saving");
  } else if (state?.status === "saved") {
    saveStatus.textContent = "已保存";
  } else {
    saveStatus.textContent = "";
  }
}

function markNoteDirty(note, { schedule = true } = {}) {
  const state = getNoteSaveState(note.id);
  state.dirty = true;
  state.generation += 1;
  state.lastError = null;
  state.status = "dirty";
  persistNoteRecovery(note);
  if (schedule) {
    scheduleNoteSave(note.id);
  }
  renderSaveStatus();
  return state;
}

function scheduleNoteSave(noteId) {
  const state = getNoteSaveState(noteId);
  clearTimeout(state.timer);
  state.timer = setTimeout(() => {
    state.timer = null;
    requestNoteSave(noteId).catch((error) => {
      console.error("自动保存笔记失败:", error);
    });
  }, 600);
}

function requestNoteSave(noteId) {
  const state = getNoteSaveState(noteId);
  clearTimeout(state.timer);
  state.timer = null;
  if (state.inflight) {
    return state.inflight;
  }
  if (!state.dirty) {
    renderSaveStatus();
    return Promise.resolve();
  }

  state.inflight = (async () => {
    while (state.dirty) {
      state.dirty = false;
      const generation = state.generation;
      const note = notes.find((item) => item.id === noteId);
      if (!note) {
        removeNoteRecovery(noteId);
        return;
      }
      state.status = "saving";
      renderSaveStatus();
      try {
        const snapshot = JSON.parse(JSON.stringify(note));
        const savedNote = await window.noticeNote.saveNote(snapshot);
        const shouldRefreshSidebar =
          Boolean(getNoteSearchKeyword())
          || JSON.stringify(snapshot.reminders) !== JSON.stringify(savedNote.reminders)
          || snapshot.folderId !== savedNote.folderId
          || snapshot.isReminderFile !== savedNote.isReminderFile;
        state.lastError = null;
        if (state.generation === generation && !state.dirty) {
          replaceNote(savedNote);
          removeNoteRecovery(noteId);
          state.status = "saved";
          updateNoteSavedPresentation(savedNote);
          if (shouldRefreshSidebar) {
            renderNoteList();
          }
        }
        if (activeWorkspaceTabKey === getWorkspaceTabKey("note", noteId)) {
          activeNoteId = noteId;
          renderReminders();
        }
      } catch (error) {
        state.dirty = true;
        state.lastError = error;
        state.status = "error";
        throw error;
      }
    }
  })().finally(() => {
    state.inflight = null;
    renderSaveStatus();
  });
  return state.inflight;
}

async function saveActiveNote({ manual = false } = {}) {
  if (activeDraftId) {
    openDraftSaveDialog(activeDraftId);
    return;
  }
  const draft = getDraftNote();
  if (!draft) {
    return;
  }
  const note = notes.find((item) => item.id === draft.id);
  if (!note) {
    return;
  }
  const state = getNoteSaveState(note.id);
  note.title = draft.title;
  note.content = draft.content;
  markNoteDirty(note, { schedule: false });
  if (manual) {
    state.status = "saving";
    renderSaveStatus();
  }
  await requestNoteSave(note.id);
}

async function flushPendingSave() {
  persistActiveNoteRecovery();
  const pendingSaves = [];
  for (const [noteId, state] of noteSaveStates) {
    clearTimeout(state.timer);
    state.timer = null;
    if (state.dirty || state.inflight) {
      pendingSaves.push(requestNoteSave(noteId));
    }
  }
  await Promise.all(pendingSaves);
}

function queueSave() {
  if (activeDraftId) {
    const draft = draftsMap.get(activeDraftId);
    if (draft) {
      draft.title = titleInput.value;
      draft.content = getEditorValue();
      draft.updatedAt = new Date().toISOString();
      updateWorkspaceTabLabel(
        getWorkspaceTabKey("draft", activeDraftId),
        draft.title || "未命名草稿",
      );
      saveDraftsToStorage();
    }
    return;
  }

  if (!getActiveNote()) {
    return;
  }

  const note = getActiveNote();
  markNoteDirty(note);
}

async function addReminder() {
  const note = getActiveNote();
  if (!note || !reminderInput.value) {
    return;
  }

  const date = reminderInput.value;
  if (!parseReminderDate(date)) {
    return;
  }

  if (
    note.reminders.some((reminder) => getReminderDateKey(reminder) === date)
  ) {
    return;
  }

  note.reminders.push(createReminder(date));

  reminderInput.value = "";
  await saveActiveNote();
  renderReminders();
}

async function addAutoReminders() {
  const note = getActiveNote();
  if (!note) {
    return;
  }

  const reminderDates = [
    createReminderDate(1),
    createReminderDate(7),
    createNextMonthReminderDate(),
  ];
  const existingDates = new Set(note.reminders.map(getReminderDateKey));
  const nextReminders = reminderDates
    .map(createReminder)
    .filter((reminder) => !existingDates.has(reminder.date));

  if (nextReminders.length === 0) {
    return;
  }

  note.reminders.push(...nextReminders);
  await saveActiveNote();
  renderReminders();
}

async function removeReminder(reminderId) {
  const note = getActiveNote();
  note.reminders = note.reminders.filter(
    (reminder) => reminder.id !== reminderId,
  );
  await saveActiveNote();
  renderReminders();
}

async function createNote() {
  const note = await window.noticeNote.createNote(activeFolderId);
  if (!notes.some((item) => item.id === note.id)) {
    notes.unshift(note);
  }
  notes = sortNotes(notes);
  await activateWorkspaceTab("note", note.id);
  renderBreadcrumb();
}

async function refreshNotes() {
  refreshButton.disabled = true;
  try {
    await flushPendingSave();
    const activeFolderPath = getFolderNamePath(activeFolderId);
    const library = await window.noticeNote.refreshLibrary();
    notes = sortNotes(library.notes);
    folders = library.folders;
    activeFolderId = resolveFolderIdByNamePath(activeFolderPath, folders);
    pdfFiles = library.pdfFiles;
    resourceFiles = library.resourceFiles;
    renderBreadcrumb();
    if (reconcileWorkspaceTabs()) {
      return;
    }
    if (activePdfId && pdfFiles.some((pdf) => pdf.id === activePdfId)) {
      renderPdf();
    } else if (
      activeResourceId &&
      resourceFiles.some((file) => file.id === activeResourceId)
    ) {
      renderResourceFile();
    } else {
      renderEditor();
    }
  } finally {
    refreshButton.disabled = false;
  }
}

async function discardDraft(draftId) {
  const draft = draftsMap.get(draftId);
  if (!draft) return;

  const confirmed = confirm(`确定丢弃草稿「${draft.title || "未命名草稿"}」吗？`);
  if (!confirmed) return;

  const tabKey = getWorkspaceTabKey("draft", draftId);
  draftsMap.delete(draftId);
  workspaceTabViewStates.delete(tabKey);

  const index = workspaceTabs.findIndex(
    (t) => getWorkspaceTabKey(t.type, t.id) === tabKey,
  );
  if (index >= 0) {
    workspaceTabs.splice(index, 1);
  }

  if (activeDraftId === draftId) {
    const nextTab = workspaceTabs[Math.min(index, workspaceTabs.length - 1)];
    if (nextTab) {
      showWorkspaceTab(nextTab);
    } else {
      activeWorkspaceTabKey = null;
      activeDraftId = null;
      activeNoteId = null;
      activePdfId = null;
      activeResourceId = null;
      renderEditor();
    }
  } else {
    renderWorkspaceTabs();
  }
}

async function deleteActiveNote() {
  if (activeDraftId) {
    await discardDraft(activeDraftId);
    return;
  }

  const note = getActiveNote();
  if (!note) {
    return;
  }

  await deleteNoteById(note.id);
}

async function deleteNoteById(noteId) {
  const note = notes.find((item) => item.id === noteId);
  if (!note) {
    return;
  }

  const confirmed = confirm(`确定将「${note.title || "未命名笔记"}」移到回收站吗？`);
  if (!confirmed) {
    return;
  }

  if (note.id === activeNoteId) {
    const state = noteSaveStates.get(note.id);
    if (state) {
      clearTimeout(state.timer);
      state.timer = null;
    }
  }
  const deletedTabKey = getWorkspaceTabKey("note", note.id);
  notes = sortNotes(await window.noticeNote.deleteNote(note.id));
  noteSaveStates.delete(note.id);
  removeNoteRecovery(note.id);
  workspaceTabs = workspaceTabs.filter((tab) => {
    return getWorkspaceTabKey(tab.type, tab.id) !== deletedTabKey;
  });
  if (activeWorkspaceTabKey === deletedTabKey) {
    activeWorkspaceTabKey = null;
  }
  reconcileWorkspaceTabs();
}

async function deleteResourceFile(fileId) {
  const file = resourceFiles.find((item) => item.id === fileId);
  if (!file) {
    return;
  }

  const confirmed = confirm(`确定将「${file.name}」移到回收站吗？`);
  if (!confirmed) {
    return;
  }

  resourceFiles = await window.noticeNote.deleteFile(file.id);
  pdfFiles = resourceFiles.filter((item) => item.kind === "pdf");
  workspaceTabs = workspaceTabs.filter((tab) => {
    const tabKey = getWorkspaceTabKey(tab.type, tab.id);
    return (
      tabKey !== getWorkspaceTabKey("pdf", file.id) &&
      tabKey !== getWorkspaceTabKey("file", file.id)
    );
  });
  if (
    activeWorkspaceTabKey === getWorkspaceTabKey("pdf", file.id) ||
    activeWorkspaceTabKey === getWorkspaceTabKey("file", file.id)
  ) {
    activeWorkspaceTabKey = null;
  }

  if (!reconcileWorkspaceTabs()) {
    renderNoteList();
  }
}

async function boot() {
  setSidebarCollapsed(readBooleanSetting(SIDEBAR_COLLAPSED_KEY));
  initSidebarResizer();
  initPdfOutlineResizer();
  createMarkdownEditor();
  notes = sortNotes(await window.noticeNote.listNotes());
  folders = await window.noticeNote.listFolders();
  pdfFiles = await window.noticeNote.listPdfs();
  resourceFiles = await window.noticeNote.listFiles();
  storageInfo = await window.noticeNote.getStorage();
  appSettings = await window.noticeNote.getSettings();
  const restoredTitles = restoreNotesFromRecoveryLog();
  activeNoteId = null;
  workspaceTabs = [];
  activeWorkspaceTabKey = null;
  reminderInput.value = toLocalDateKey(new Date());
  renderBreadcrumb();
  renderNoteList();
  renderEditor();
  renderReminderNotifications();
  loadDraftsFromStorage();
  if (restoredTitles.length > 0) {
    setTimeout(() => {
      alert(`已恢复 ${restoredTitles.length} 篇未保存笔记，正在重新保存。`);
    }, 0);
  }

  window.noticeNote.onNotesChanged((nextNotes) => {
    mergeIncomingNotes(nextNotes);
    renderReminderNotifications();
  });

  window.noticeNote.onFoldersChanged((nextFolders) => {
    const activeFolderPath = getFolderNamePath(activeFolderId);
    folders = nextFolders;
    activeFolderId = resolveFolderIdByNamePath(activeFolderPath, folders);
    renderBreadcrumb();
    renderNoteList();
  });

  window.noticeNote.onPdfsChanged((nextPdfs) => {
    pdfFiles = nextPdfs;
    if (reconcileWorkspaceTabs()) {
      return;
    }

    if (activePdfId) {
      renderPdf();
    } else {
      renderNoteList();
    }
  });

  window.noticeNote.onFilesChanged((nextFiles) => {
    resourceFiles = nextFiles;
    pdfFiles = nextFiles.filter((file) => file.kind === "pdf");
    if (reconcileWorkspaceTabs()) {
      return;
    }

    if (activeResourceId) {
      if (skipNextFileReload) {
        skipNextFileReload = false;
        const file = resourceFiles.find((item) => item.id === activeResourceId);
        if (file) {
          fileViewerMeta.textContent = `${formatFileSize(file.size)} · 创建于 ${formatListDateTime(file.createdAt)} · 修改于 ${formatListDateTime(file.updatedAt)}`;
        }
      } else {
        renderResourceFile();
      }
    } else if (!activePdfId) {
      renderNoteList();
      renderWorkspaceTabs();
    }
  });

  window.noticeNote.onStorageChanged((nextStorageInfo) => {
    storageInfo = nextStorageInfo;
    renderStorageInfo();
  });

  window.noticeNote.onReminderFired((reminder) => {
    addReminderNotification(reminder);
  });
}

function renderSettings() {
  applyInterfaceTheme(getInterfaceTheme());
  dailyReviewEnabledInput.checked = appSettings?.dailyReviewEnabled !== false;
  dailyReviewCurrentTitle.textContent =
    appSettings?.dailyReviewTitle || "今天暂无可回顾文件";
  renderStorageInfo();
}

async function openSettings() {
  if (settingsMainView) settingsMainView.hidden = false;
  if (settingsThemePickerView) settingsThemePickerView.hidden = true;
  if (settingsDialog) settingsDialog.classList.remove("is-picker-view");
  appSettings = await window.noticeNote.getSettings();
  renderSettings();
  settingsDialog.showModal();
}

titleInput.addEventListener("input", () => {
  const note = getActiveNote();
  if (note) {
    note.title = titleInput.value;
    updateNoteTitlePresentation(note);
  }
  queueSave();
});

saveButton.addEventListener("click", () => {
  saveActiveNote({ manual: true }).catch((error) => {
    console.error("手动保存笔记失败:", error);
    renderSaveStatus();
  });
});
newNoteButton.addEventListener("click", () => {
  newMenuDropdown.classList.toggle("is-open");
});
refreshButton.addEventListener("click", () => {
  refreshNotes().catch(console.error);
});
settingsButton.addEventListener("click", () => {
  openSettings().catch(console.error);
});
closeSettingsDialogButton.addEventListener("click", () => {
  settingsDialog.close();
});
exportMobilePackageButton.addEventListener("click", async () => {
  exportMobilePackageButton.disabled = true;
  try {
    while (true) {
      const lockedFolder = folders.find(
        (folder) => folder.isProtected && !folder.isUnlocked,
      );
      if (!lockedFolder) {
        break;
      }
      exportMobilePackageStatus.textContent = `请解锁密码保护目录「${lockedFolder.name}」`;
      const unlocked = await promptUnlockFolder(lockedFolder.id);
      if (!unlocked) {
        exportMobilePackageStatus.textContent = "已取消导出";
        return;
      }
    }

    exportMobilePackageStatus.textContent = "正在生成离线包...";
    const result = await window.noticeNote.exportMobilePackage();
    if (result.canceled) {
      exportMobilePackageStatus.textContent = "已取消导出";
      return;
    }
    exportMobilePackageStatus.textContent = `已导出 ${result.noteCount} 篇笔记、${result.resourceCount} 个资料文件`;
  } catch (error) {
    const message = String(error.message || "导出失败").replace(
      /^Error invoking remote method '[^']+': (?:[A-Za-z]*Error: )?/,
      "",
    );
    exportMobilePackageStatus.textContent = `导出失败：${message}`;
  } finally {
    exportMobilePackageButton.disabled = false;
  }
});
if (openThemePickerButton) {
  openThemePickerButton.addEventListener("click", () => {
    if (settingsMainView) settingsMainView.hidden = true;
    if (settingsThemePickerView) settingsThemePickerView.hidden = false;
    if (settingsDialog) settingsDialog.classList.add("is-picker-view");
    renderThemePickerGrid();
  });
}

if (backToSettingsMainButton) {
  backToSettingsMainButton.addEventListener("click", () => {
    if (settingsMainView) settingsMainView.hidden = false;
    if (settingsThemePickerView) settingsThemePickerView.hidden = true;
    if (settingsDialog) settingsDialog.classList.remove("is-picker-view");
  });
}

if (closeSettingsDialogButton2) {
  closeSettingsDialogButton2.addEventListener("click", () => {
    settingsDialog.close();
  });
}

themePickerTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    themePickerTabs.forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    activeThemeCategory = tab.dataset.category || "all";
    renderThemePickerGrid();
  });
});
dailyReviewEnabledInput.addEventListener("change", () => {
  dailyReviewEnabledInput.disabled = true;
  window.noticeNote
    .updateSettings({ dailyReviewEnabled: dailyReviewEnabledInput.checked })
    .then((settings) => {
      appSettings = settings;
      renderSettings();
    })
    .catch(console.error)
    .finally(() => {
      dailyReviewEnabledInput.disabled = false;
    });
});
chooseStorageButton.addEventListener("click", async () => {
  chooseStorageButton.disabled = true;
  try {
    await flushPendingSave();
    const result = await window.noticeNote.chooseStorage();
    if (result?.storage) {
      storageInfo = result.storage;
      renderStorageInfo();
    }
  } catch (error) {
    console.error("更改存储位置失败:", error);
    alert(`更改存储位置失败：${getSaveErrorMessage(error)}`);
  } finally {
    chooseStorageButton.disabled = false;
  }
});
resetStorageButton.addEventListener("click", async () => {
  resetStorageButton.disabled = true;
  try {
    await flushPendingSave();
    const result = await window.noticeNote.resetStorage();
    if (result?.storage) {
      storageInfo = result.storage;
      renderStorageInfo();
    }
  } catch (error) {
    console.error("恢复默认存储位置失败:", error);
    alert(`恢复默认存储位置失败：${getSaveErrorMessage(error)}`);
  } finally {
    resetStorageButton.disabled = Boolean(storageInfo?.isDefault);
  }
});
showAllFilesButton.addEventListener("click", () => {
  openFolderWithAccessCheck(null).catch(console.error);
});
showReminderCalendarButton.addEventListener("click", () => {
  setSidebarViewMode("calendar");
});
showDailyReviewButton.addEventListener("click", () => {
  setSidebarViewMode("reminder");
});
locateCurrentFileButton.addEventListener("click", () => {
  const tab = workspaceTabs.find((item) => {
    return getWorkspaceTabKey(item.type, item.id) === activeWorkspaceTabKey;
  });
  if (tab) {
    syncSidebarToWorkspaceTab(tab);
  }
});
newDraftQuickButton?.addEventListener("click", () => {
  createDraft();
});
newDraftOption.addEventListener("click", () => {
  newMenuDropdown.classList.remove("is-open");
  createDraft();
});
newNoteOption.addEventListener("click", () => {
  newMenuDropdown.classList.remove("is-open");
  createNote().catch(console.error);
});
newFolderOption.addEventListener("click", () => {
  newMenuDropdown.classList.remove("is-open");
  createFolder().catch(console.error);
});
document.addEventListener("click", (e) => {
  if (!e.target.closest(".new-menu")) {
    newMenuDropdown.classList.remove("is-open");
  }
  const dailyReviewRules = breadcrumb.querySelector(".daily-review-rules");
  if (dailyReviewRules && !e.target.closest(".daily-review-help-wrap")) {
    dailyReviewRules.hidden = true;
    breadcrumb
      .querySelector(".daily-review-help-button")
      ?.setAttribute("aria-expanded", "false");
  }
});
addReminderButton.addEventListener("click", () => {
  addReminder().catch(console.error);
});
openReminderConfigButton.addEventListener("click", () => {
  renderReminders();
  reminderDialog.showModal();
});
closeReminderDialogButton.addEventListener("click", () => {
  reminderDialog.close();
});
autoReminderButton.addEventListener("click", () => {
  autoReminderButton.disabled = true;
  addAutoReminders()
    .catch(console.error)
    .finally(() => {
      autoReminderButton.disabled = false;
    });
});
deleteNoteButton.addEventListener("click", () => {
  deleteActiveNote().catch((error) => {
    console.error("删除笔记失败:", error);
    alert(error.message || "删除笔记失败");
  });
});
pdfZoomOut.addEventListener("click", () => {
  changePdfZoom(-0.1).catch((error) =>
    showPdfStatus(`PDF 渲染失败：${error.message}`, true),
  );
});
pdfZoomIn.addEventListener("click", () => {
  changePdfZoom(0.1).catch((error) =>
    showPdfStatus(`PDF 渲染失败：${error.message}`, true),
  );
});
pdfPages.addEventListener(
  "wheel",
  (event) => {
    if (!event.ctrlKey || event.deltaY === 0) {
      return;
    }

    event.preventDefault();
    const page = event.target.closest(".pdf-page");
    changePdfZoom(event.deltaY < 0 ? 0.1 : -0.1, {
      page,
      clientX: event.clientX,
      clientY: event.clientY,
    }).catch((error) => showPdfStatus(`PDF 渲染失败：${error.message}`, true));
  },
  { passive: false },
);
pdfPages.addEventListener("scroll", schedulePdfOutlineHighlight, {
  passive: true,
});
if (fileViewerEditButton) {
  fileViewerEditButton.addEventListener("click", toggleFileEditingMode);
}
if (fileViewerSaveButton) {
  fileViewerSaveButton.addEventListener("click", () => {
    saveActiveFileChanges().catch(console.error);
  });
}
if (fileViewerAddRowButton) {
  fileViewerAddRowButton.addEventListener("click", addSpreadsheetRow);
}
if (fileViewerAddColButton) {
  fileViewerAddColButton.addEventListener("click", addSpreadsheetCol);
}
if (fileViewerOpenExternalButton) {
  fileViewerOpenExternalButton.addEventListener("click", openActiveFileExternal);
}

wordOutlineToggle.addEventListener("click", () => {
  const shouldShow = wordOutline.hidden;
  wordOutline.hidden = !shouldShow;
  wordOutlineToggle.classList.toggle("is-active", shouldShow);
  wordOutlineToggle.setAttribute("aria-expanded", String(shouldShow));
  if (shouldShow) {
    scheduleWordOutlineHighlight();
  }
});
fileViewerContent.addEventListener("scroll", scheduleWordOutlineHighlight, {
  passive: true,
});
fileViewerContent.addEventListener(
  "wheel",
  (event) => {
    if (
      !event.ctrlKey ||
      event.deltaY === 0 ||
      !event.target.closest(".file-preview-image")
    ) {
      return;
    }

    event.preventDefault();
    changeImageZoom(event.deltaY < 0 ? 0.1 : -0.1, event);
  },
  { passive: false },
);
noteSearchInput?.addEventListener("input", renderNoteList);
noteSearchInput?.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && noteSearchInput.value) {
    event.preventDefault();
    clearNoteListSearch();
    renderNoteList();
  }
});
viewerSearchInput.addEventListener("input", updateViewerSearch);
viewerSearchInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    moveViewerSearch(event.shiftKey ? -1 : 1);
  } else if (event.key === "Escape") {
    event.preventDefault();
    closeViewerSearch();
  }
});
viewerSearchPrevious.addEventListener("click", () => moveViewerSearch(-1));
viewerSearchNext.addEventListener("click", () => moveViewerSearch(1));
viewerSearchClose.addEventListener("click", closeViewerSearch);
deferDailyReviewButton.addEventListener("click", () => {
  handleActiveDailyReview("defer").catch(console.error);
});
completeDailyReviewButton.addEventListener("click", () => {
  handleActiveDailyReview("complete").catch(console.error);
});
document.addEventListener("keydown", (event) => {
  if (
    (event.ctrlKey || event.metaKey) &&
    event.key.toLocaleLowerCase("en-US") === "s" &&
    activeResourceId &&
    isFileEditingMode
  ) {
    event.preventDefault();
    saveActiveFileChanges().catch(console.error);
  } else if (
    (event.ctrlKey || event.metaKey) &&
    event.key.toLocaleLowerCase("en-US") === "f" &&
    getViewerSearchRoot()
  ) {
    event.preventDefault();
    openViewerSearch();
  }
});
pdfOutlineToggle.addEventListener("click", () => {
  pdfOutline.hidden = !pdfOutline.hidden;
  pdfOutlineToggle.classList.toggle("is-active", !pdfOutline.hidden);
  if (!pdfOutline.hidden) {
    schedulePdfOutlineHighlight();
  }
});
notificationBell.addEventListener("click", (event) => {
  event.stopPropagation();
  toggleNotificationPanel();
});
notificationPanel.addEventListener("click", (event) => {
  event.stopPropagation();
});
toggleSidebarButton.addEventListener("click", () => {
  setSidebarCollapsed(!sidebar.classList.contains("is-collapsed"));
});
showSidebarButton.addEventListener("click", () => {
  setSidebarCollapsed(false);
});
// Right-click context menu on note list
let contextMenu = null;

function createContextMenuItem(label, onClick, disabled = false) {
  const item = document.createElement("button");
  item.className = "context-menu-item";
  item.type = "button";
  item.textContent = label;
  if (disabled) {
    item.disabled = true;
  }
  item.addEventListener("mousedown", (e) => {
    e.preventDefault();
  });
  item.addEventListener("click", () => {
    if (disabled) {
      return;
    }
    hideContextMenu();
    onClick();
  });
  return item;
}

function createContextMenuSeparator() {
  const separator = document.createElement("div");
  separator.className = "context-menu-separator";
  return separator;
}

function getContextMenuEntry(target) {
  const item = target.closest(".note-item");
  if (!item) {
    return null;
  }

  if (item.dataset.noteId) {
    return { type: "note", id: item.dataset.noteId };
  }
  if (item.dataset.fileId) {
    return { type: "file", id: item.dataset.fileId };
  }
  if (item.dataset.folderId) {
    return { type: "folder", id: item.dataset.folderId };
  }
  return null;
}

function showEditorContextMenu(x, y, target) {
  hideContextMenu();

  contextMenu = document.createElement("div");
  contextMenu.className = "context-menu";
  contextMenu.style.left = `${x}px`;
  contextMenu.style.top = `${y}px`;

  const activeNote = getActiveNote();
  const canInsert = Boolean(activeNote);

  const activeEl = document.activeElement;
  const selectionText = window.getSelection()?.toString() || "";
  let hasSelection = selectionText.length > 0;

  if (activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA")) {
    if (activeEl.selectionStart != null && activeEl.selectionEnd != null) {
      hasSelection = activeEl.selectionStart !== activeEl.selectionEnd;
    }
  }

  contextMenu.append(
    createContextMenuItem(
      "剪切",
      () => {
        const curActive = document.activeElement;
        const text = window.getSelection()?.toString() || "";

        if (curActive && (curActive.tagName === "INPUT" || curActive.tagName === "TEXTAREA")) {
          const start = curActive.selectionStart;
          const end = curActive.selectionEnd;
          if (start != null && end != null && start !== end) {
            const val = curActive.value;
            const cutText = val.slice(start, end);
            navigator.clipboard.writeText(cutText).catch(() => {});
            curActive.value = val.slice(0, start) + val.slice(end);
            curActive.selectionStart = curActive.selectionEnd = start;
            curActive.dispatchEvent(new Event("input", { bubbles: true }));
          } else {
            document.execCommand("cut");
          }
        } else if (
          markdownEditor &&
          (curActive?.closest("#editorRoot") ||
            editorRoot?.contains(curActive) ||
            target?.closest("#editorRoot"))
        ) {
          if (text) {
            navigator.clipboard.writeText(text).catch(() => {});
            markdownEditor.insertMarkdown("");
          } else {
            document.execCommand("cut");
          }
        } else {
          document.execCommand("cut");
        }
      },
      !hasSelection,
    ),

    createContextMenuItem(
      "复制",
      () => {
        const text = window.getSelection()?.toString();
        if (text) {
          navigator.clipboard.writeText(text).catch(() => {
            document.execCommand("copy");
          });
        } else {
          document.execCommand("copy");
        }
      },
      !hasSelection,
    ),

    createContextMenuItem("粘贴", async () => {
      try {
        const text = await navigator.clipboard.readText();
        if (!text) {
          document.execCommand("paste");
          return;
        }
        const activeEl = document.activeElement;
        if (activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA")) {
          const start = activeEl.selectionStart ?? activeEl.value.length;
          const end = activeEl.selectionEnd ?? activeEl.value.length;
          const val = activeEl.value;
          activeEl.value = val.slice(0, start) + text + val.slice(end);
          activeEl.selectionStart = activeEl.selectionEnd = start + text.length;
          activeEl.dispatchEvent(new Event("input", { bubbles: true }));
        } else if (
          markdownEditor &&
          (markdownEditor.hasFocus?.() ||
            activeEl?.closest("#editorRoot") ||
            editorRoot?.contains(activeEl) ||
            target?.closest("#editorRoot"))
        ) {
          markdownEditor.insertMarkdown(text);
        } else {
          document.execCommand("paste");
        }
      } catch (err) {
        document.execCommand("paste");
      }
    }),

    createContextMenuSeparator(),

    createContextMenuItem(
      "插入图片",
      () => {
        insertImage().catch(console.error);
      },
      !canInsert,
    ),
    createContextMenuItem(
      "插入代码块",
      () => {
        insertCodeBlock();
      },
      !canInsert,
    ),
  );

  document.body.append(contextMenu);

  const rect = contextMenu.getBoundingClientRect();
  if (rect.right > window.innerWidth) {
    contextMenu.style.left = `${x - rect.width}px`;
  }
  if (rect.bottom > window.innerHeight) {
    contextMenu.style.top = `${y - rect.height}px`;
  }
}

function showContextMenu(x, y, entry = null) {
  hideContextMenu();

  contextMenu = document.createElement("div");
  contextMenu.className = "context-menu";
  contextMenu.style.left = `${x}px`;
  contextMenu.style.top = `${y}px`;

  if (entry) {
    contextMenu.append(
      createContextMenuItem("复制绝对路径", () => {
        window.noticeNote.copyEntryPath(entry).catch(console.error);
      }),
    );
    if (entry.type === "folder") {
      const folder = folders.find((item) => item.id === entry.id);
      if (folder) {
        contextMenu.append(
          createContextMenuItem(
            folder.isProtected ? "修改密码" : "设置密码",
            () => {
              setFolderPasswordForFolder(folder.id).catch(console.error);
            },
          ),
        );
        if (folder.isProtected && !folder.isUnlocked) {
          contextMenu.append(
            createContextMenuItem("输入密码解锁", () => {
              promptUnlockFolder(folder.id).catch(console.error);
            }),
          );
        }
        if (folder.isProtected) {
          contextMenu.append(
            createContextMenuItem("清除密码", () => {
              clearFolderPasswordForFolder(folder.id).catch(console.error);
            }),
          );
        }
      }
    }
    if (entry.type !== "folder") {
      contextMenu.append(
        createContextMenuItem("使用默认应用打开", () => {
          window.noticeNote.openEntryWithDefaultApp(entry).catch(console.error);
        }),
      );
      const target =
        entry.type === "note"
          ? notes.find((item) => item.id === entry.id)
          : resourceFiles.find((item) => item.id === entry.id);
      if (entry.type === "note" || target?.canOpen || target?.isReminderFile) {
        const isReminderFile = Boolean(target?.isReminderFile);
        contextMenu.append(
          createContextMenuItem(
            isReminderFile ? "移出每日回顾" : "加入每日回顾",
            () =>
              updateDailyReviewMark(entry, target, !isReminderFile).catch(
                console.error,
              ),
          ),
        );
      }
    }
    contextMenu.append(
      createContextMenuItem("打开资源管理器", () => {
        window.noticeNote.showEntryInFolder(entry).catch(console.error);
      }),
      createContextMenuItem("移动到…", () => {
        moveEntryToFolder(entry).catch(console.error);
      }),
      createContextMenuSeparator(),
      createContextMenuItem("删除", () => {
        if (entry.type === "note") {
          deleteNoteById(entry.id).catch((error) => {
            console.error("删除笔记失败:", error);
            alert(error.message || "删除笔记失败");
          });
        } else if (entry.type === "folder") {
          deleteFolder(entry.id).catch(console.error);
        } else if (entry.type === "file") {
          deleteResourceFile(entry.id).catch((error) => {
            console.error("删除资料文件失败:", error);
            alert(error.message || "删除资料文件失败");
          });
        }
      }),
    );
  } else {
    contextMenu.append(
      createContextMenuItem("新建笔记", () => {
        createNote().catch(console.error);
      }),
      createContextMenuItem("新建文件夹", () => {
        createFolder().catch(console.error);
      }),
    );
  }

  document.body.append(contextMenu);

  // Keep menu within viewport
  const rect = contextMenu.getBoundingClientRect();
  if (rect.right > window.innerWidth) {
    contextMenu.style.left = `${x - rect.width}px`;
  }
  if (rect.bottom > window.innerHeight) {
    contextMenu.style.top = `${y - rect.height}px`;
  }
}

function showWorkspaceTabContextMenu(x, y, tabKey) {
  hideContextMenu();

  contextMenu = document.createElement("div");
  contextMenu.className = "context-menu";
  contextMenu.style.left = `${x}px`;
  contextMenu.style.top = `${y}px`;
  contextMenu.append(
    createContextMenuItem("关闭其他", () => {
      closeOtherWorkspaceTabs(tabKey).catch(console.error);
    }),
    createContextMenuItem("关闭所有", () => {
      closeAllWorkspaceTabs().catch(console.error);
    }),
  );
  document.body.append(contextMenu);

  const rect = contextMenu.getBoundingClientRect();
  if (rect.right > window.innerWidth) {
    contextMenu.style.left = `${x - rect.width}px`;
  }
  if (rect.bottom > window.innerHeight) {
    contextMenu.style.top = `${y - rect.height}px`;
  }
}

function hideContextMenu() {
  if (contextMenu) {
    contextMenu.remove();
    contextMenu = null;
  }
}

noteList.addEventListener("contextmenu", (e) => {
  e.preventDefault();
  showContextMenu(e.clientX, e.clientY, getContextMenuEntry(e.target));
});

workspaceTabsRoot.addEventListener("contextmenu", (e) => {
  const tab = e.target.closest(".workspace-tab");
  if (!tab?.dataset.tabKey) {
    return;
  }

  e.preventDefault();
  showWorkspaceTabContextMenu(e.clientX, e.clientY, tab.dataset.tabKey);
});

document.addEventListener("click", (e) => {
  if (contextMenu && !contextMenu.contains(e.target)) {
    hideContextMenu();
  }
  if (!notificationPanel.hidden && !e.target.closest(".notification-center")) {
    notificationPanel.hidden = true;
  }
});

if (editorPanel) {
  editorPanel.addEventListener("contextmenu", (event) => {
    if (event.target.closest("button, select, a, dialog")) {
      return;
    }
    if (
      event.target.closest(
        ".cm-rendered-image img, .cm-image-preview-below img",
      )
    ) {
      return;
    }
    if (
      event.target.closest(
        ".cm-table-column-menu-button, .cm-table-row-menu-button, .cm-table-column-menu",
      )
    ) {
      return;
    }

    event.preventDefault();
    showEditorContextMenu(event.clientX, event.clientY, event.target);
  });
}

document.addEventListener("contextmenu", (event) => {
  const image = event.target.closest?.(
    ".cm-rendered-image img, .cm-image-preview-below img",
  );
  if (!image) {
    return;
  }
  event.preventDefault();

  const imageSrc = image.src || "";
  if (!imageSrc.startsWith("file:")) {
    return;
  }

  hideContextMenu();
  contextMenu = document.createElement("div");
  contextMenu.className = "context-menu";
  contextMenu.style.left = `${event.clientX}px`;
  contextMenu.style.top = `${event.clientY}px`;
  contextMenu.append(
    createContextMenuItem("复制图片", async () => {
      hideContextMenu();
      const success = await window.noticeNote.copyImage({ imageUrl: imageSrc });
      if (!success) {
        alert("复制图片失败");
      }
    }),
    createContextMenuItem("删除图片", async () => {
      hideContextMenu();
      if (!confirm("确定从笔记中移除这张图片，并将图片文件移到回收站吗？")) {
        return;
      }
      if (markdownEditor && activeNoteId) {
        const previousContent = markdownEditor.getMarkdown();
        const removed = markdownEditor.removeImageByUrl?.(imageSrc);
        if (!removed) {
          const content = markdownEditor.getMarkdown();
          const lines = content.split("\n");
          const filteredLines = lines.filter((line) => {
            const imgMatch = line.match(/!\[[^\]]*\]\(([^)]+)\)/);
            if (!imgMatch) {
              return true;
            }
            const url = imgMatch[1].trim();
            return url !== imageSrc;
          });
          const newContent = filteredLines.join("\n");
          markdownEditor.setMarkdown(newContent);
        }
        const note = getActiveNote();
        if (note) {
          note.content = normalizeEditorContent(
            markdownEditor.getMarkdown(),
            note,
          );
          markNoteDirty(note, { schedule: false });
          try {
            await requestNoteSave(note.id);
          } catch (error) {
            markdownEditor.setMarkdown(previousContent);
            note.content = normalizeEditorContent(previousContent, note);
            markNoteDirty(note);
            alert(`移除图片引用失败：${getSaveErrorMessage(error)}`);
            return;
          }
        }
      }
      const success = await window.noticeNote.deleteImage({
        imageUrl: imageSrc,
        noteId: activeNoteId,
      });
      if (!success) {
        alert("图片已从笔记移除，但图片文件仍保留在内部存储中");
      }
    }),
  );
  document.body.append(contextMenu);

  const rect = contextMenu.getBoundingClientRect();
  if (rect.right > window.innerWidth) {
    contextMenu.style.left = `${event.clientX - rect.width}px`;
  }
  if (rect.bottom > window.innerHeight) {
    contextMenu.style.top = `${event.clientY - rect.height}px`;
  }
});

document.addEventListener("click", (event) => {
  const image = event.target.closest?.(
    ".cm-rendered-image img, .cm-image-preview-below img, .word-preview img, .file-preview-image",
  );
  if (!image) {
    return;
  }
  event.preventDefault();
  openImageLightbox(image);
});

closeImageLightboxButton.addEventListener("click", closeImageLightbox);
zoomOutImageLightboxButton.addEventListener("click", () =>
  changeImageLightboxZoom(-0.25),
);
zoomInImageLightboxButton.addEventListener("click", () =>
  changeImageLightboxZoom(0.25),
);
imageLightbox.addEventListener("click", (event) => {
  if (event.target === imageLightbox) {
    closeImageLightbox();
  }
});
imageLightbox.addEventListener(
  "wheel",
  (event) => {
    if (imageLightbox.hidden || event.deltaY === 0) {
      return;
    }
    event.preventDefault();
    changeImageLightboxZoom(event.deltaY < 0 ? 0.15 : -0.15);
  },
  { passive: false },
);

document.addEventListener("keydown", (e) => {
  if (!imageLightbox.hidden && e.key === "Tab") {
    trapImageLightboxFocus(e);
    return;
  }
  if (e.key === "Escape") {
    if (!imageLightbox.hidden) {
      e.preventDefault();
      closeImageLightbox();
      return;
    }
    hideContextMenu();
    notificationPanel.hidden = true;
  }
});

function createDraft() {
  const draftId = `draft-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const draft = {
    id: draftId,
    type: "draft",
    title: "",
    content: "",
    fileType: "md",
    reminders: [],
    folderId: activeFolderId || null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  draftsMap.set(draftId, draft);
  const tab = { type: "draft", id: draftId };
  const tabKey = getWorkspaceTabKey("draft", draftId);
  if (!workspaceTabs.some((t) => getWorkspaceTabKey(t.type, t.id) === tabKey)) {
    workspaceTabs.push(tab);
  }
  showWorkspaceTab(tab);
  saveDraftsToStorage();
  // 用 requestAnimationFrame 确保 Tab 栏在所有同步操作完成后一定重新渲染
  requestAnimationFrame(() => renderWorkspaceTabs());
  titleInput.focus();
}

function openDraftSaveDialog(draftId, tabKey = null) {
  const draft = draftsMap.get(draftId);
  if (!draft) return;

  pendingCloseDraftId = draftId;
  pendingCloseTabKey = tabKey || getWorkspaceTabKey("draft", draftId);

  if (activeDraftId === draftId) {
    draft.title = titleInput.value;
    draft.content = getEditorValue();
  }

  draftTitleInput.value = draft.title || "";
  draftFolderSelect.innerHTML = "";
  const rootOpt = document.createElement("option");
  rootOpt.value = "";
  rootOpt.textContent = "📁 根目录";
  draftFolderSelect.append(rootOpt);

  for (const folder of folders) {
    const opt = document.createElement("option");
    opt.value = folder.id;
    opt.textContent = `📁 ${getFolderNamePath(folder.id)}`;
    if (folder.id === (draft.folderId || activeFolderId)) {
      opt.selected = true;
    }
    draftFolderSelect.append(opt);
  }

  draftFileTypeSelect.value = draft.fileType || "md";
  draftSaveDialog.showModal();
  requestAnimationFrame(() => {
    draftTitleInput?.focus?.();
  });
}

confirmSaveDraftButton?.addEventListener("click", async () => {
  if (!pendingCloseDraftId) return;
  const draft = draftsMap.get(pendingCloseDraftId);
  if (!draft) return;

  confirmSaveDraftButton.disabled = true;
  try {
    const selectedFolderId = draftFolderSelect.value || null;
    const title = draftTitleInput.value.trim() || "未命名笔记";
    const fileType = draftFileTypeSelect.value || "md";
    const content = draft.content || "";

    const newNote = await window.noticeNote.createNote(selectedFolderId);
    newNote.title = title;
    newNote.content = content;
    newNote.fileType = fileType;
    const savedNote = await window.noticeNote.saveNote(newNote);
    replaceNote(savedNote);

    const draftId = pendingCloseDraftId;
    const tabKey = pendingCloseTabKey;
    draftsMap.delete(draftId);

    const tabIndex = workspaceTabs.findIndex(
      (t) => getWorkspaceTabKey(t.type, t.id) === tabKey,
    );
    const noteTab = { type: "note", id: savedNote.id };
    if (tabIndex >= 0) {
      workspaceTabs[tabIndex] = noteTab;
    } else {
      workspaceTabs.push(noteTab);
    }

    draftSaveDialog.close();
    pendingCloseDraftId = null;
    pendingCloseTabKey = null;

    await activateWorkspaceTab("note", savedNote.id);
    renderNoteList();
    renderWorkspaceTabs();
    saveDraftsToStorage();
  } catch (err) {
    console.error("保存草稿失败:", err);
  } finally {
    confirmSaveDraftButton.disabled = false;
  }
});

discardDraftButton?.addEventListener("click", () => {
  if (!pendingCloseDraftId) return;
  const draftId = pendingCloseDraftId;
  const tabKey = pendingCloseTabKey;

  draftsMap.delete(draftId);
  const index = workspaceTabs.findIndex(
    (t) => getWorkspaceTabKey(t.type, t.id) === tabKey,
  );
  if (index >= 0) {
    workspaceTabs.splice(index, 1);
  }

  draftSaveDialog.close();
  pendingCloseDraftId = null;
  pendingCloseTabKey = null;

  if (activeWorkspaceTabKey === tabKey) {
    const nextTab = workspaceTabs[Math.min(index, workspaceTabs.length - 1)];
    if (nextTab) {
      showWorkspaceTab(nextTab);
    } else {
      activeWorkspaceTabKey = null;
      activeDraftId = null;
      activeNoteId = null;
      renderEditor();
    }
  } else {
    renderWorkspaceTabs();
  }
  saveDraftsToStorage();
});

window.addEventListener("beforeunload", () => {
  persistActiveNoteRecovery();
  saveDraftsToStorage();
});

window.noticeNoteFlushForQuit = flushPendingSave;

cancelDraftButton?.addEventListener("click", () => {
  draftSaveDialog.close();
  pendingCloseDraftId = null;
  pendingCloseTabKey = null;
});

cancelDraftSaveDialogButton?.addEventListener("click", () => {
  draftSaveDialog.close();
  pendingCloseDraftId = null;
  pendingCloseTabKey = null;
});

applyInterfaceTheme(getInterfaceTheme());
boot().catch(console.error);
