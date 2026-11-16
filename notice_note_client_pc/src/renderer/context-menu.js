// 右键上下文菜单
// 注意：本文件为经典脚本，顶层 const/let 处于页面全局词法环境，跨文件共享；请勿重复声明同名标识符。
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
  // 草稿没有真实笔记 id，插入/粘贴图片会被主进程拒绝；直接禁用入口（R5）。
  const canInsert = Boolean(activeNote) && !activeDraftId;

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
        insertImage().catch((error) => window.showErrorToast?.(error, "操作失败"));
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
// 回顾文件由回顾目录统一管理：把它移出目录等于从回顾体系里摘掉，
// 而 notes:move / files:move 不会同步 isReviewFile，会留下内存与磁盘不一致的状态。
// 所以回顾项的菜单不提供「移动到…」，其余项目与普通笔记一致。
function isReviewEntry(entry) {
  if (!entry) {
    return false;
  }
  if (entry.type === "note") {
    return Boolean(notes.find((item) => item.id === entry.id)?.isReviewFile);
  }
  if (entry.type === "file") {
    return Boolean(resourceFiles.find((item) => item.id === entry.id)?.isReviewFile);
  }
  return false;
}

function showContextMenu(x, y, entry = null) {
  hideContextMenu();

  contextMenu = document.createElement("div");
  contextMenu.className = "context-menu";
  contextMenu.style.left = `${x}px`;
  contextMenu.style.top = `${y}px`;

  if (entry) {
    const reviewEntry = isReviewEntry(entry);
    contextMenu.append(
      createContextMenuItem("复制绝对路径", () => {
        window.noticeNote.copyEntryPath(entry).catch((error) => window.showErrorToast?.(error, "操作失败"));
      }),
    );
    if (entry.type === "folder") {
      const folder = folders.find((item) => item.id === entry.id);
      if (folder) {
        contextMenu.append(
          createContextMenuItem(
            folder.isProtected ? "修改密码" : "设置密码",
            () => {
              setFolderPasswordForFolder(folder.id).catch((error) => window.showErrorToast?.(error, "操作失败"));
            },
          ),
        );
        if (folder.isProtected && !folder.isUnlocked) {
          contextMenu.append(
            createContextMenuItem("输入密码解锁", () => {
              promptUnlockFolder(folder.id).catch((error) => window.showErrorToast?.(error, "操作失败"));
            }),
          );
        }
        if (folder.isProtected) {
          contextMenu.append(
            createContextMenuItem("清除密码", () => {
              clearFolderPasswordForFolder(folder.id).catch((error) => window.showErrorToast?.(error, "操作失败"));
            }),
          );
        }
      }
    }
    if (entry.type !== "folder") {
      contextMenu.append(
        createContextMenuItem("使用默认应用打开", () => {
          window.noticeNote.openEntryWithDefaultApp(entry).catch((error) => window.showErrorToast?.(error, "操作失败"));
        }),
      );
    }
    contextMenu.append(
      createContextMenuItem("打开资源管理器", () => {
        window.noticeNote.showEntryInFolder(entry).catch((error) => window.showErrorToast?.(error, "操作失败"));
      }),
    );
    if (!reviewEntry) {
      contextMenu.append(
        createContextMenuItem("移动到…", () => {
          moveEntryToFolder(entry).catch((error) => window.showErrorToast?.(error, "操作失败"));
        }),
      );
    }
    contextMenu.append(
      createContextMenuSeparator(),
      createContextMenuItem("删除", () => {
        if (entry.type === "note") {
          deleteNoteById(entry.id).catch((error) => {
            window.showErrorToast?.(error, "删除笔记失败");
          });
        } else if (entry.type === "folder") {
          deleteFolder(entry.id).catch((error) => window.showErrorToast?.(error, "操作失败"));
        } else if (entry.type === "file") {
          deleteResourceFile(entry.id).catch((error) => {
            window.showErrorToast?.(error, "删除资料文件失败");
          });
        }
      }),
    );
  } else {
    contextMenu.append(
      createContextMenuItem("新建笔记", () => {
        createNote().catch((error) => window.showErrorToast?.(error, "操作失败"));
      }),
      createContextMenuItem("新建文件夹", () => {
        createFolder().catch((error) => window.showErrorToast?.(error, "操作失败"));
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
      closeOtherWorkspaceTabs(tabKey).catch((error) => window.showErrorToast?.(error, "操作失败"));
    }),
    createContextMenuItem("关闭所有", () => {
      closeAllWorkspaceTabs().catch((error) => window.showErrorToast?.(error, "操作失败"));
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
