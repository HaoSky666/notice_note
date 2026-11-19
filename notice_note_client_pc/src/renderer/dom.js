// DOM 元素引用（按 index.html 结构集中查询）
// 注意：本文件为经典脚本，顶层 const/let 处于页面全局词法环境，跨文件共享；请勿重复声明同名标识符。
const noteList = document.querySelector("#noteList");
const titleInput = document.querySelector("#titleInput");
const editorRoot = document.querySelector("#editorRoot");
const contentShell = document.querySelector("#contentShell");
const saveButton = document.querySelector("#saveButton");
const saveStatus = document.querySelector("#saveStatus");
const newNoteButton = document.querySelector("#newNoteButton");
const deleteNoteButton = document.querySelector("#deleteNoteButton");
const appToastHost = document.querySelector("#appToastHost");
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
// 设置里的 AI 判定配置
const aiJudgeEnabledInput = document.querySelector("#aiJudgeEnabledInput");
const aiJudgeBaseUrlInput = document.querySelector("#aiJudgeBaseUrlInput");
const aiJudgeModelInput = document.querySelector("#aiJudgeModelInput");
const aiJudgeApiKeyInput = document.querySelector("#aiJudgeApiKeyInput");
const testAiJudgeButton = document.querySelector("#testAiJudgeButton");
const saveAiJudgeButton = document.querySelector("#saveAiJudgeButton");
const aiJudgeStatus = document.querySelector("#aiJudgeStatus");
// 设置里的局域网同步
const syncEnabledInput = document.querySelector("#syncEnabledInput");
const syncStatusText = document.querySelector("#syncStatusText");
const syncPairCodeDisplay = document.querySelector("#syncPairCodeDisplay");
const createSyncPairCodeButton = document.querySelector("#createSyncPairCodeButton");
const syncDeviceList = document.querySelector("#syncDeviceList");
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
// 记忆卡视图（SM-2）
const showMemoryButton = document.querySelector("#showMemoryButton");
const memoryView = document.querySelector("#memoryView");
const memorySubtitle = document.querySelector("#memorySubtitle");
const memorySettingsButton = document.querySelector("#memorySettingsButton");
const memoryNewCardButton = document.querySelector("#memoryNewCardButton");
const memoryStatsBar = document.querySelector("#memoryStatsBar");
const memoryTypeBar = document.querySelector("#memoryTypeBar");
const memoryStudyPanel = document.querySelector("#memoryStudyPanel");
const memoryCardMeta = document.querySelector("#memoryCardMeta");
const memoryStageProgress = document.querySelector("#memoryStageProgress");
const memoryEditCardButton = document.querySelector("#memoryEditCardButton");
const memoryCardFront = document.querySelector("#memoryCardFront");
const memoryCardBack = document.querySelector("#memoryCardBack");
const memoryRevealButton = document.querySelector("#memoryRevealButton");
const memoryRatingBar = document.querySelector("#memoryRatingBar");
const memoryPreviewAgain = document.querySelector("#memoryPreviewAgain");
const memoryPreviewHard = document.querySelector("#memoryPreviewHard");
const memoryPreviewGood = document.querySelector("#memoryPreviewGood");
const memoryPreviewEasy = document.querySelector("#memoryPreviewEasy");
// AI 判定：作答输入、判定结果条、作答历史
const memoryAnswerZone = document.querySelector("#memoryAnswerZone");
const memoryAnswerInput = document.querySelector("#memoryAnswerInput");
const memoryAnswerHint = document.querySelector("#memoryAnswerHint");
const memoryAnswerSubmitButton = document.querySelector("#memoryAnswerSubmitButton");
// 注意与 state 里的 memoryJudgeResult 区分：那个是数据，这个是结果条元素。
const memoryJudgeResultBar = document.querySelector("#memoryJudgeResult");
const memoryJudgeBadge = document.querySelector("#memoryJudgeBadge");
const memoryJudgeReason = document.querySelector("#memoryJudgeReason");
const memoryJudgeOverrideButton = document.querySelector("#memoryJudgeOverrideButton");
const memoryJudgeNextButton = document.querySelector("#memoryJudgeNextButton");
const memoryAnswerHistory = document.querySelector("#memoryAnswerHistory");
const memoryAnswerHistoryToggle = document.querySelector("#memoryAnswerHistoryToggle");
const memoryAnswerHistoryCount = document.querySelector("#memoryAnswerHistoryCount");
const memoryAnswerHistoryList = document.querySelector("#memoryAnswerHistoryList");
const memoryStudyHint = document.querySelector("#memoryStudyHint");
const memoryEditorPanel = document.querySelector("#memoryEditorPanel");
const memoryEditorTitle = document.querySelector("#memoryEditorTitle");
const memoryFrontInput = document.querySelector("#memoryFrontInput");
const memoryBackInput = document.querySelector("#memoryBackInput");
const memoryDeleteCardButton = document.querySelector("#memoryDeleteCardButton");
const memoryTypeChips = document.querySelector("#memoryTypeChips");
const memoryTypeInput = document.querySelector("#memoryTypeInput");
const memoryTypeSuggestions = document.querySelector("#memoryTypeSuggestions");
const memoryCancelEditButton = document.querySelector("#memoryCancelEditButton");
const memorySaveCardButton = document.querySelector("#memorySaveCardButton");
const memorySettingsPanel = document.querySelector("#memorySettingsPanel");
const memorySettingLearningSteps = document.querySelector("#memorySettingLearningSteps");
const memorySettingGraduatingInterval = document.querySelector("#memorySettingGraduatingInterval");
const memorySettingEasyInterval = document.querySelector("#memorySettingEasyInterval");
const memorySettingStartingEase = document.querySelector("#memorySettingStartingEase");
const memorySettingMaximumInterval = document.querySelector("#memorySettingMaximumInterval");
const memorySettingEasyBonus = document.querySelector("#memorySettingEasyBonus");
const memorySettingIntervalModifier = document.querySelector("#memorySettingIntervalModifier");
const memorySettingRelearningSteps = document.querySelector("#memorySettingRelearningSteps");
const memorySettingNewInterval = document.querySelector("#memorySettingNewInterval");
const memorySettingMinimumInterval = document.querySelector("#memorySettingMinimumInterval");
const memorySettingNewCardsPerDay = document.querySelector("#memorySettingNewCardsPerDay");
const memoryResetSettingsButton = document.querySelector("#memoryResetSettingsButton");
const memoryCancelSettingsButton = document.querySelector("#memoryCancelSettingsButton");
const memorySaveSettingsButton = document.querySelector("#memorySaveSettingsButton");
const memoryEmptyState = document.querySelector("#memoryEmptyState");
const memoryEmptyCreateButton = document.querySelector("#memoryEmptyCreateButton");
