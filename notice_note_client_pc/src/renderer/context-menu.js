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
    }
    if (entry.type === "note") {
      const note = notes.find((item) => item.id === entry.id);
      if (note?.isReviewFile) {
        const isPrimary = note.reviewRole === "primary";
        contextMenu.append(
          createContextMenuSeparator(),
          createContextMenuItem("设置回顾日期…", () => {
            promptReviewDate(note);
          }),
          createContextMenuItem(isPrimary ? "取消主文件" : "设为主文件", () => {
            window.noticeNote
              .setReviewRole({ type: "note", id: note.id }, isPrimary ? null : "primary")
              .then(() => {
                renderNoteList();
              })
              .catch((error) => console.error("设置主次失败:", error));
          }),
          createContextMenuItem(
            note.reviewRole === "secondary" ? "取消次文件" : "设为次文件",
            () => {
              window.noticeNote
                .setReviewRole(
                  { type: "note", id: note.id },
                  note.reviewRole === "secondary" ? null : "secondary",
                )
                .then(() => {
                  renderNoteList();
                })
                .catch((error) => console.error("设置主次失败:", error));
            },
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
