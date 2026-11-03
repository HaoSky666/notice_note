// 工作区 Tab 系统（打开/关闭/拖拽/视图状态）
// 注意：本文件为经典脚本，顶层 const/let 处于页面全局词法环境，跨文件共享；请勿重复声明同名标识符。
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
  if (tab.type === "review") {
    return { id: tab.id, title: "回顾", isReviewBrowser: true };
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

  if (tab.type === "review") {
    setSidebarViewMode("reminder", false);
    renderBreadcrumb();
    renderNoteList();
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
          : tab.type === "review"
            ? "回顾浏览器"
            : resource.path;

    const icon = document.createElement("span");
    const iconType =
      tab.type === "note"
        ? resource.fileType
        : tab.type === "draft"
          ? "draft"
          : tab.type === "review"
            ? "review"
            : resource.kind;
    icon.className = `workspace-tab-icon ${iconType}`;
    icon.textContent =
      tab.type === "note"
        ? resource.fileType.toUpperCase()
        : tab.type === "draft"
          ? "草稿"
          : tab.type === "review"
            ? "📅"
            : resource.typeLabel;

    const isNoteDirty =
      tab.type === "note" && Boolean(noteSaveStates.get(tab.id)?.dirty);
    const label = document.createElement("span");
    label.className = "workspace-tab-label";
    const tabTitle =
      tab.type === "note"
        ? resource.title || "未命名笔记"
        : tab.type === "draft"
          ? resource.title || "未命名草稿"
          : tab.type === "review"
            ? "回顾"
            : resource.name;
    label.textContent = isNoteDirty ? `${tabTitle} •` : tabTitle;
    if (isNoteDirty) {
      item.classList.add("is-dirty");
    }

    const isReviewTab = tab.type === "review";
    const closeButton = document.createElement("button");
    closeButton.className = "workspace-tab-close";
    closeButton.type = "button";
    closeButton.title = "关闭标签";
    closeButton.setAttribute("aria-label", `关闭 ${label.textContent}`);
    closeButton.textContent = "×";
    closeButton.hidden = isReviewTab;

    mainButton.append(icon, label);
    mainButton.addEventListener("click", () => {
      if (Date.now() - workspaceTabDragStartedAt < 250) {
        return;
      }
      activateWorkspaceTab(tab.type, tab.id).catch(console.error);
    });
    mainButton.addEventListener("pointerdown", (event) => {
      if (!isReviewTab) {
        beginWorkspaceTabPointerDrag(event, item, tabKey);
      }
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
  const isDirty = Boolean(noteSaveStates.get(note.id)?.dirty);
  updateWorkspaceTabLabel(
    getWorkspaceTabKey("note", note.id),
    isDirty ? `${title} •` : title,
  );
  const tabItem = [...(workspaceTabsRoot?.querySelectorAll(".workspace-tab") || [])].find(
    (candidate) => candidate.dataset.tabKey === getWorkspaceTabKey("note", note.id),
  );
  if (tabItem) {
    tabItem.classList.toggle("is-dirty", isDirty);
  }
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
    // 回顾操作按天进行：解析当前文件所属的回顾日
    const dayKey = tab.type === "note"
      ? getNoteReviewDayKey(resource)
      : getFileReviewDayKey(resource);
    if (!dayKey) {
      throw new Error("无法确定当前文件的回顾日期");
    }
    await window.noticeNote.handleDailyReview(dayKey, action);
    resource.isDailyReview = false;
    renderNoteList();
    renderWorkspaceTabs();
    refreshReviewBrowserIfActive();
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
  } else if (tab.type === "review") {
    activeDraftId = null;
    activeNoteId = null;
    activePdfId = null;
    activeResourceId = null;
    renderReviewBrowser();
  } else {
    activeDraftId = null;
    activeNoteId = tab.id;
    activePdfId = null;
    activeResourceId = null;
    renderEditor();
  }
}
function clearBlurRevealScope(scope) {
  if (!scope) {
    return;
  }
  const prefix = `${scope}:`;
  for (const key of [...blurRevealState.revealed.keys()]) {
    if (String(key).startsWith(prefix)) {
      blurRevealState.revealed.delete(key);
    }
  }
}
function showWorkspaceTab(tab, { deferContent = false } = {}) {
  closeViewerSearch();
  const tabKey = getWorkspaceTabKey(tab.type, tab.id);
  if (activeWorkspaceTabKey !== tabKey) {
    saveActiveWorkspaceTabViewState();
    clearBlurRevealScope(tab.id);
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

  if (
    !workspaceTabs.some(
      (item) => getWorkspaceTabKey(item.type, item.id) === tabKey,
    )
  ) {
    workspaceTabs.push(tab);
  }
  showWorkspaceTab(tab, { deferContent: true });
}
async function closeWorkspaceTab(tabKey) {
  const index = workspaceTabs.findIndex(
    (tab) => getWorkspaceTabKey(tab.type, tab.id) === tabKey,
  );
  if (index < 0) {
    return;
  }

  const tab = workspaceTabs[index];
  if (tab.type === "review") {
    return; // 回顾浏览器是常驻视图，不可关闭
  }
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
  } else if (tab.type === "note") {
    const note = notes.find((item) => item.id === tab.id);
    if (note) {
      if (activeNoteId === note.id) {
        note.title = titleInput.value;
        note.content = getEditorValue();
      }
      const saveState = noteSaveStates.get(note.id);
      if (saveState?.dirty) {
        const choice = await promptUnsavedNoteClose(note);
        if (choice === "cancel") {
          return;
        } else if (choice === "save") {
          try {
            await requestNoteSave(note.id);
          } catch (error) {
            alert(`保存失败：${getSaveErrorMessage(error)}`);
            return;
          }
        } else if (choice === "discard") {
          const baseline = noteSavedBaselines.get(note.id);
          if (baseline) {
            note.title = baseline.title;
            note.content = baseline.content;
            if (baseline.reminders) {
              note.reminders = JSON.parse(JSON.stringify(baseline.reminders));
            }
          }
          saveState.dirty = false;
          saveState.lastError = null;
          saveState.status = "idle";
          removeNoteRecovery(note.id);
          updateNoteSavedPresentation(note);
        }
      }
    }
  }

  const isActive = tabKey === activeWorkspaceTabKey;
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
  const keepTab = workspaceTabs.find(
    (item) => getWorkspaceTabKey(item.type, item.id) === tabKey,
  );
  if (!keepTab) {
    return;
  }

  for (const item of [...workspaceTabs]) {
    const itemKey = getWorkspaceTabKey(item.type, item.id);
    if (itemKey === tabKey || item.type === "review") {
      continue;
    }

    if (item.type === "draft") {
      const draft = draftsMap.get(item.id);
      if (draft) {
        const hasContent = Boolean(
          (draft.title && draft.title.trim()) ||
            (draft.content && draft.content.trim()),
        );
        if (hasContent) {
          showWorkspaceTab(item);
          openDraftSaveDialog(item.id, itemKey);
          return;
        } else {
          draftsMap.delete(item.id);
        }
      }
    } else if (item.type === "note") {
      const note = notes.find((n) => n.id === item.id);
      const saveState = note ? noteSaveStates.get(note.id) : null;
      if (note && saveState?.dirty) {
        showWorkspaceTab(item);
        const choice = await promptUnsavedNoteClose(note);
        if (choice === "cancel") {
          return;
        } else if (choice === "save") {
          try {
            await requestNoteSave(note.id);
          } catch (error) {
            alert(`保存失败：${getSaveErrorMessage(error)}`);
            return;
          }
        } else if (choice === "discard") {
          const baseline = noteSavedBaselines.get(note.id);
          if (baseline) {
            note.title = baseline.title;
            note.content = baseline.content;
            if (baseline.reminders) {
              note.reminders = JSON.parse(JSON.stringify(baseline.reminders));
            }
          }
          saveState.dirty = false;
          saveState.lastError = null;
          saveState.status = "idle";
          removeNoteRecovery(note.id);
          updateNoteSavedPresentation(note);
        }
      }
    }
  }

  workspaceTabs = [keepTab];
  if (tabKey === activeWorkspaceTabKey) {
    renderWorkspaceTabs();
  } else {
    showWorkspaceTab(keepTab);
  }
  for (const key of workspaceTabViewStates.keys()) {
    if (key !== tabKey) {
      workspaceTabViewStates.delete(key);
    }
  }
  saveDraftsToStorage();
}
async function closeAllWorkspaceTabs() {
  for (const item of [...workspaceTabs]) {
    const itemKey = getWorkspaceTabKey(item.type, item.id);
    if (item.type === "draft") {
      const draft = draftsMap.get(item.id);
      if (draft) {
        const hasContent = Boolean(
          (draft.title && draft.title.trim()) ||
            (draft.content && draft.content.trim()),
        );
        if (hasContent) {
          showWorkspaceTab(item);
          openDraftSaveDialog(item.id, itemKey);
          return;
        } else {
          draftsMap.delete(item.id);
        }
      }
    } else if (item.type === "note") {
      const note = notes.find((n) => n.id === item.id);
      const saveState = note ? noteSaveStates.get(note.id) : null;
      if (note && saveState?.dirty) {
        showWorkspaceTab(item);
        const choice = await promptUnsavedNoteClose(note);
        if (choice === "cancel") {
          return;
        } else if (choice === "save") {
          try {
            await requestNoteSave(note.id);
          } catch (error) {
            alert(`保存失败：${getSaveErrorMessage(error)}`);
            return;
          }
        } else if (choice === "discard") {
          const baseline = noteSavedBaselines.get(note.id);
          if (baseline) {
            note.title = baseline.title;
            note.content = baseline.content;
            if (baseline.reminders) {
              note.reminders = JSON.parse(JSON.stringify(baseline.reminders));
            }
          }
          saveState.dirty = false;
          saveState.lastError = null;
          saveState.status = "idle";
          removeNoteRecovery(note.id);
          updateNoteSavedPresentation(note);
        }
      }
    }
  }

  workspaceTabs = workspaceTabs.filter((tab) => tab.type === "review");
  workspaceTabViewStates.clear();
  activeDraftId = null;
  activeNoteId = null;
  activePdfId = null;
  activeResourceId = null;
  const reviewTab = workspaceTabs[0] || null;
  if (reviewTab) {
    showWorkspaceTab(reviewTab);
  } else {
    activeWorkspaceTabKey = null;
    renderEditor();
  }
  saveDraftsToStorage();
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
