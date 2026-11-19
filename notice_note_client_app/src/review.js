// 回顾 Tab（经典脚本，全局函数以 rv 开头）。
// 语义与 PC 每日回顾一致：候选 = 复习文件按天分套，密码目录与挂着未完成提醒的天不参与自动回顾；
// 排序 = 手动顺序优先，其余按「最久没看过」；周末不自动推（可去日历手动标记）。
// 完成/标记已看过 = 写天级锚点 + 事件日志 + 移出手动顺序，记入 dirty 待同步回传。

function rvGetCandidates(library) {
  const protectedFolderIds = new Set(
    (library.folders || []).filter((folder) => folder.isProtected).map((folder) => folder.id)
  );
  const pendingDayKeys = new Set(
    (library.review?.reminders || [])
      .filter((reminder) => !reminder.done && reminder.dayKey)
      .map((reminder) => reminder.dayKey)
  );
  const dayMap = new Map();
  const add = (item, kind) => {
    // 镜像 PC getDailyReviewCandidates：只回顾 .study_notice 里的复习文件，不是全库。
    if (!item.isReviewFile) {
      return;
    }
    if (kind === 'file' && item.canOpen === false) {
      return;
    }
    if (protectedFolderIds.has(item.folderId || null)) {
      return;
    }
    const dayKey = NoticeNoteStore.getItemDayKey(item);
    if (!dayKey || pendingDayKeys.has(dayKey)) {
      return;
    }
    if (!dayMap.has(dayKey)) {
      dayMap.set(dayKey, { key: `day:${dayKey}`, dayKey, notes: [], files: [] });
    }
    const day = dayMap.get(dayKey);
    if (kind === 'note') {
      day.notes.push(item);
    } else {
      day.files.push(item);
    }
  };
  for (const note of library.notes || []) {
    add(note, 'note');
  }
  for (const file of library.resources || []) {
    add(file, 'file');
  }
  return [...dayMap.values()];
}

function rvGetSortedQueue(library) {
  const review = library.review || {};
  return NoticeNoteReviewQueue.sortReviewQueue(rvGetCandidates(library), {
    order: review.order || [],
    history: review.history || {}
  });
}

function rvIsWeekend(now = Date.now()) {
  const weekday = new Date(now).getDay();
  return weekday === 0 || weekday === 6;
}

// 完成回顾 / 标记已看过：与 PC handleDailyReview(complete) 同语义。
// 本地先落库，dirty 追踪，下次同步先回传再拉权威清单。
function rvCompleteDay(dayKey) {
  const library = NoticeNoteStore.getLibrary();
  if (!library || !/^\d{4}-\d{2}-\d{2}$/.test(dayKey)) {
    return;
  }
  const now = new Date().toISOString();
  if (!library.review) {
    library.review = { enabled: true, reminders: [], history: {}, log: [], order: [] };
  }
  library.review.history = { ...(library.review.history || {}), [`day:${dayKey}`]: now };
  const entry = { id: NoticeNoteStore.randomId(), dayKey, reviewedAt: now };
  library.review.log = [...(library.review.log || []), entry];
  library.review.order = (library.review.order || []).filter((key) => key !== dayKey);
  NoticeNoteStore.addToDirty('reviewDays', dayKey);
  NoticeNoteStore.addToDirty('reviewLogIds', entry.id);
  NoticeNoteStore.runAssetTransaction({ snapshot: library })
    .then(() => {
      NoticeNoteStore.notifyLibraryChanged();
    })
    .catch((error) => {
      console.error('保存回顾状态失败:', error);
    });
}

function rvRenderFileList(container, day) {
  const list = document.createElement('div');
  list.className = 'note-list rv-file-list';
  for (const note of day.notes) {
    list.append(renderNoteCard(note, true));
  }
  for (const file of day.files) {
    list.append(renderResourceCard(file));
  }
  list.addEventListener('click', (event) => {
    const resourceCard = event.target.closest('.resource-card');
    if (resourceCard) {
      openResourceCard(resourceCard);
      return;
    }
    const noteCard = event.target.closest('.note-card');
    if (noteCard) {
      NoticeNoteTabs.openNoteFromTab(noteCard.dataset.noteId);
    }
  });
  container.append(list);
}

function rvRender() {
  const panel = document.querySelector('#reviewPanel');
  if (!panel) {
    return;
  }
  panel.innerHTML = '';
  const library = NoticeNoteStore.getLibrary();
  if (!library) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = '还没有内容：先在笔记页点「同步」配对电脑，或导入离线包。';
    panel.append(empty);
    return;
  }

  const queue = rvGetSortedQueue(library);
  const review = library.review || {};
  const history = review.history || {};
  const todayKey = NoticeNoteDateUtils.toLocalDateKey(new Date());
  const weekend = rvIsWeekend();
  const autoEnabled = review.enabled !== false;

  const heading = document.createElement('div');
  heading.className = 'rv-heading';
  const title = document.createElement('h2');
  title.textContent = '每日回顾';
  heading.append(title);
  const dirty = NoticeNoteStore.getDirty();
  if (dirty.reviewDays.length > 0) {
    const badge = document.createElement('span');
    badge.className = 'rv-pending-badge';
    badge.textContent = `${dirty.reviewDays.length} 天待回传`;
    heading.append(badge);
  }
  panel.append(heading);

  if (queue.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = '没有可回顾的内容天。复习文件归档后会自动出现在这里。';
    panel.append(empty);
    return;
  }

  // 今日推荐：周末或关闭自动回顾时不推，但队列仍可手动标记
  const todayCard = document.createElement('section');
  todayCard.className = 'rv-today-card';
  if (weekend && autoEnabled) {
    const notice = document.createElement('p');
    notice.className = 'rv-weekend';
    notice.textContent = '今天是周末，自动回顾休息。想复习的话可以在下方或日历里手动标记。';
    todayCard.append(notice);
  } else if (!autoEnabled) {
    const notice = document.createElement('p');
    notice.className = 'rv-weekend';
    notice.textContent = '电脑端已关闭每日回顾，这里只保留手动标记。';
    todayCard.append(notice);
  } else {
    const pick = queue[0];
    const viewedAt = history[pick.key];
    const label = document.createElement('p');
    label.className = 'rv-today-label';
    label.textContent = `今日推荐 · ${pick.dayKey} · ${pick.notes.length + pick.files.length} 个文件`;
    todayCard.append(label);
    rvRenderFileList(todayCard, pick);
    const actions = document.createElement('div');
    actions.className = 'rv-actions';
    const completeButton = document.createElement('button');
    completeButton.type = 'button';
    completeButton.className = 'primary-action';
    completeButton.textContent = viewedAt ? '✓ 今天已看过 · 再看一遍' : '✓ 完成回顾';
    completeButton.addEventListener('click', () => {
      rvCompleteDay(pick.dayKey);
      rvRender();
    });
    actions.append(completeButton);
    todayCard.append(actions);
  }
  panel.append(todayCard);

  // 队列预览：其余候选天，可手动标记已看过（排到队尾）
  const rest = queue.slice(1, 8);
  if (rest.length > 0) {
    const queueTitle = document.createElement('h3');
    queueTitle.className = 'rv-queue-title';
    queueTitle.textContent = '回顾队列';
    panel.append(queueTitle);
    const list = document.createElement('div');
    list.className = 'rv-queue';
    for (const day of rest) {
      const row = document.createElement('div');
      row.className = 'rv-queue-row';
      const info = document.createElement('div');
      info.className = 'rv-queue-info';
      const date = document.createElement('strong');
      date.textContent = day.dayKey;
      const meta = document.createElement('span');
      const viewedAt = history[day.key];
      meta.textContent = `${day.notes.length + day.files.length} 个文件${viewedAt ? ` · 看过 ${formatDateTime(viewedAt)}` : ' · 没看过'}`;
      info.append(date, meta);
      const markButton = document.createElement('button');
      markButton.type = 'button';
      markButton.className = 'secondary-action';
      markButton.textContent = '标记已看过';
      markButton.addEventListener('click', () => {
        rvCompleteDay(day.dayKey);
        rvRender();
      });
      row.append(info, markButton);
      list.append(row);
    }
    panel.append(list);
  }

  const hint = document.createElement('p');
  hint.className = 'rv-hint';
  hint.textContent = '回顾进度保存在手机本地，点笔记页「同步」后回传电脑，两端保持一致。';
  panel.append(hint);
}