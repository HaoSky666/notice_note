// 启动编排与全局事件接线
// 注意：本文件为经典脚本，顶层 const/let 处于页面全局词法环境，跨文件共享；请勿重复声明同名标识符。




































































































































































































async function boot() {
  setSidebarCollapsed(readBooleanSetting(SIDEBAR_COLLAPSED_KEY));
  initSidebarResizer();
  initPdfOutlineResizer();
  createMarkdownEditor();
  notes = sortNotes(await window.noticeNote.listNotes());
  for (const n of notes) {
    noteSavedBaselines.set(n.id, {
      title: n.title,
      content: n.content,
      reminders: JSON.parse(JSON.stringify(n.reminders || [])),
    });
  }
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
      alert(`已恢复 ${restoredTitles.length} 篇未保存笔记（未保存状态，请确认后保存）。`);
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
  // 回顾现在是主工作区的全宽浏览器；按钮负责打开/激活它
  activateReviewBrowser();
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
  // 回顾浏览器激活时，左右键按天翻页
  if (
    (event.ctrlKey || event.metaKey) &&
    event.key.toLocaleLowerCase("en-US") === "s"
  ) {
    event.preventDefault();
    if (activeDraftId) {
      saveActiveNote({ manual: true }).catch((error) => {
        console.error("保存草稿失败:", error);
      });
    } else if (activeNoteId) {
      saveActiveNote({ manual: true }).catch((error) => {
        console.error("手动保存笔记失败:", error);
        renderSaveStatus();
      });
    }
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



confirmSaveUnsavedNoteButton?.addEventListener("click", () => {
  unsavedNoteDialog?.close();
  if (pendingUnsavedNoteResolve) {
    const cb = pendingUnsavedNoteResolve;
    pendingUnsavedNoteResolve = null;
    cb("save");
  }
});

discardUnsavedNoteButton?.addEventListener("click", () => {
  unsavedNoteDialog?.close();
  if (pendingUnsavedNoteResolve) {
    const cb = pendingUnsavedNoteResolve;
    pendingUnsavedNoteResolve = null;
    cb("discard");
  }
});

cancelUnsavedNoteButton?.addEventListener("click", () => {
  unsavedNoteDialog?.close();
  if (pendingUnsavedNoteResolve) {
    const cb = pendingUnsavedNoteResolve;
    pendingUnsavedNoteResolve = null;
    cb("cancel");
  }
});

cancelUnsavedNoteDialogCloseButton?.addEventListener("click", () => {
  unsavedNoteDialog?.close();
  if (pendingUnsavedNoteResolve) {
    const cb = pendingUnsavedNoteResolve;
    pendingUnsavedNoteResolve = null;
    cb("cancel");
  }
});

unsavedNoteDialog?.addEventListener("cancel", (event) => {
  event.preventDefault();
  unsavedNoteDialog.close();
  if (pendingUnsavedNoteResolve) {
    const cb = pendingUnsavedNoteResolve;
    pendingUnsavedNoteResolve = null;
    cb("cancel");
  }
});

applyInterfaceTheme(getInterfaceTheme());
boot().catch(console.error);

