// Markdown 编辑器、提醒、草稿、保存与崩溃恢复
// 注意：本文件为经典脚本，顶层 const/let 处于页面全局词法环境，跨文件共享；请勿重复声明同名标识符。
const DAILY_REMINDER_SLOTS = ["09:30", "15:00"];
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
          if (tab.type === "review") return false; // 旧版本持久化的回顾 Tab，已改为视图模式
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
  if (reviewBrowser) {
    reviewBrowser.hidden = true;
  }
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
function mergeIncomingNotes(nextNotes) {
  for (const n of nextNotes) {
    const saveState = noteSaveStates.get(n.id);
    if (!saveState?.dirty && !saveState?.inflight) {
      noteSavedBaselines.set(n.id, {
        title: n.title,
        content: n.content,
        reminders: JSON.parse(JSON.stringify(n.reminders || [])),
      });
    }
  }

  const mergedNotes = nextNotes.map((incomingNote) => {
    const existing = notes.find((n) => n.id === incomingNote.id);
    const saveState = existing ? noteSaveStates.get(existing.id) : null;
    if (existing && (saveState?.dirty || saveState?.inflight)) {
      return {
        ...incomingNote,
        title: existing.title,
        content: existing.content,
      };
    }
    return incomingNote;
  });

  notes = sortNotes(mergedNotes);

  if (activePdfId || activeResourceId) {
    if (reconcileWorkspaceTabs()) {
      return;
    }
    renderNoteList();
    return;
  }

  if (reconcileWorkspaceTabs()) {
    return;
  }
  if (reviewBrowserActive) {
    // 回顾浏览器激活时：刷新浏览器与侧边栏当天列表
    refreshReviewBrowserIfActive();
    renderNoteList();
    renderWorkspaceTabs();
    return;
  }
  if (activeDraftId) {
    renderNoteList();
    renderWorkspaceTabs();
    return;
  }
  renderEditor();
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
  noteSavedBaselines.set(updatedNote.id, {
    title: updatedNote.title,
    content: updatedNote.content,
    reminders: JSON.parse(JSON.stringify(updatedNote.reminders || [])),
  });
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
  }
  writeNoteRecoveryLog();
  return restoredTitles;
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
      ? "已恢复未保存内容"
      : "未保存";
    saveStatus.classList.add("is-dirty");
  } else if (state?.status === "saved") {
    saveStatus.textContent = "已保存";
  } else {
    saveStatus.textContent = "";
  }
}
function markNoteDirty(note) {
  const state = getNoteSaveState(note.id);
  state.dirty = true;
  state.generation += 1;
  state.lastError = null;
  state.status = "dirty";
  persistNoteRecovery(note);
  updateNoteTitlePresentation(note);
  renderSaveStatus();
  return state;
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
          || snapshot.folderId !== savedNote.folderId;
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
  markNoteDirty(note);
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
    if (state.inflight) {
      pendingSaves.push(state.inflight);
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
  noteSavedBaselines.set(note.id, {
    title: note.title,
    content: note.content,
    reminders: JSON.parse(JSON.stringify(note.reminders || [])),
  });
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
    mergeIncomingNotes(library.notes);
    folders = library.folders;
    activeFolderId = resolveFolderIdByNamePath(activeFolderPath, folders);
    pdfFiles = library.pdfFiles;
    resourceFiles = library.resourceFiles;
    renderBreadcrumb();
    if (reconcileWorkspaceTabs()) {
      return;
    }
    if (reviewBrowserActive) {
      // 回顾浏览器激活时保持浏览器，不要切回编辑器
      refreshReviewBrowserIfActive();
      renderNoteList();
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
let pendingUnsavedNoteResolve = null;
function promptUnsavedNoteClose(note) {
  return new Promise((resolve) => {
    pendingUnsavedNoteResolve = resolve;
    const title = (note?.title && note.title.trim()) || "未命名笔记";
    if (unsavedNoteDialogDesc) {
      unsavedNoteDialogDesc.textContent = `笔记「${title}」有未保存的修改，是否在关闭前保存？`;
    }
    if (unsavedNoteDialog) {
      unsavedNoteDialog.showModal();
    } else {
      resolve("discard");
    }
  });
}
