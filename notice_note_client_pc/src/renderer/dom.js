// DOM 元素引用（按 index.html 结构集中查询）
// 注意：本文件为经典脚本，顶层 const/let 处于页面全局词法环境，跨文件共享；请勿重复声明同名标识符。
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
const reviewBrowser = document.querySelector("#reviewBrowser");
const reviewBrowserInner = document.querySelector("#reviewBrowserInner");
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
const fileViewerOpenExternalButton = document.querySelector("#fileViewerOpenExternalButton");
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
const unsavedNoteDialog = document.querySelector("#unsavedNoteDialog");
const unsavedNoteDialogTitle = document.querySelector("#unsavedNoteDialogTitle");
const unsavedNoteDialogDesc = document.querySelector("#unsavedNoteDialogDesc");
const cancelUnsavedNoteDialogCloseButton = document.querySelector(
  "#cancelUnsavedNoteDialogCloseButton",
);
const discardUnsavedNoteButton = document.querySelector("#discardUnsavedNoteButton");
const cancelUnsavedNoteButton = document.querySelector("#cancelUnsavedNoteButton");
const confirmSaveUnsavedNoteButton = document.querySelector(
  "#confirmSaveUnsavedNoteButton",
);
const noteSavedBaselines = new Map();
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
