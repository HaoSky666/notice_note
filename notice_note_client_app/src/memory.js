// 记忆卡 Tab（经典脚本，全局函数以 mem 开头）。
// 复用 PC 的 SM-2 调度器与卡片快照构建（lib/shared），判据与 PC AI 判定完全一致。
// 手机是纯客户端：不新建/编辑/删除卡片；评分改调度、作答写历史，记 dirty 待回传。
// AI 配置（端点/Key/模型）在手机本地填写，不从 PC 同步；失败退回手动四档。
let memType = null;
let memSession = null;
let memShowList = false;

const MEM_RATING_LABELS = { again: '重来', hard: '困难', good: '良好', easy: '简单' };

function memGetLibrary() {
  return NoticeNoteStore.getLibrary();
}

function memGetSnapshot() {
  const library = memGetLibrary();
  return NoticeNoteMemoryCardStore.buildMemorySnapshot(
    library?.memory?.cards || [],
    library?.memory?.settings || {},
    Date.now(),
    { type: memType }
  );
}

function memFindCard(cardId) {
  return (memGetLibrary()?.memory?.cards || []).find((card) => card.id === cardId) || null;
}

function memCreateSession(card) {
  return {
    cardId: card.id,
    phase: 'question',
    preCard: { ...card },
    answer: '',
    answerEntryId: null,
    ratedOnce: false,
    judging: false,
    judgeResult: null,
    judgeError: ''
  };
}

function memStartSession(card) {
  memSession = memCreateSession(card);
  memRender();
}

function memPersist() {
  const library = memGetLibrary();
  if (!library) {
    return;
  }
  NoticeNoteStore.runAssetTransaction({ snapshot: library }).catch((error) => {
    console.error('保存记忆卡进度失败:', error);
  });
}

// 助记编辑：手机端唯一能改的内容字段。
// 保存后给卡片打 mnemonicDirty，同步合并时才会采纳手机这一版；
// 没打标记的旧快照不会把 PC 后来改的助记顶回去。
let memMnemonicEditingId = null;

function memOpenMnemonicDialog(cardId) {
  const card = memFindCard(cardId);
  const dialog = document.querySelector('#memMnemonicDialog');
  const input = document.querySelector('#memMnemonicInput');
  const remove = document.querySelector('#memMnemonicDelete');
  if (!card || !dialog || !input) {
    return;
  }
  memMnemonicEditingId = card.id;
  input.value = card.mnemonic || '';
  if (remove) {
    remove.hidden = !String(card.mnemonic || '').trim();
  }
  // 同一个 dialog 连续 showModal 会抛错，先收起再弹。
  if (dialog.open) {
    dialog.close();
  }
  dialog.showModal();
  window.setTimeout(() => {
    input.focus();
    const end = input.value.length;
    input.setSelectionRange(end, end);
  }, 0);
}

function memCloseMnemonicDialog() {
  document.querySelector('#memMnemonicDialog')?.close();
  memMnemonicEditingId = null;
}

function memSaveMnemonic(value) {
  const cardId = memMnemonicEditingId;
  const library = memGetLibrary();
  const cards = library?.memory?.cards;
  memCloseMnemonicDialog();
  if (!cardId || !Array.isArray(cards)) {
    return;
  }
  const index = cards.findIndex((card) => card.id === cardId);
  if (index < 0) {
    return;
  }
  const next = String(value || '').trim();
  if (next === String(cards[index].mnemonic || '').trim()) {
    return;
  }
  cards[index] = {
    ...cards[index],
    mnemonic: next,
    mnemonicDirty: true,
    updatedAt: new Date().toISOString()
  };
  NoticeNoteStore.addToDirty('cardIds', cardId);
  memPersist();
  memRender();
}

function memSaveMnemonicFromDialog() {
  memSaveMnemonic(document.querySelector('#memMnemonicInput')?.value || '');
}

function memDeleteMnemonic() {
  memSaveMnemonic('');
}

// 评分落库：从评分前的卡状态重新调度（改判也走这里），更新/追加作答记录。
function memApplyRating(rating, { source, reason = '', answer = '' }) {
  const library = memGetLibrary();
  const session = memSession;
  if (!library || !session) {
    return;
  }
  const cards = library.memory?.cards || [];
  const index = cards.findIndex((card) => card.id === session.cardId);
  if (index < 0) {
    return;
  }
  const preCard = session.preCard || cards[index];
  // 会话开始后可能改过助记；评分回写的是整张卡，不带上最新内容会把助记冲回旧值。
  // 调度仍用 preCard（改判不叠加），内容字段取当前卡。
  const base = {
    ...preCard,
    mnemonic: cards[index].mnemonic,
    mnemonicDirty: cards[index].mnemonicDirty
  };
  const next = NoticeNoteSm2Scheduler.scheduleCard(base, rating, library.memory.settings || {}, Date.now());
  // scheduleCard 内部会 normalizeCard，只保留白名单字段，标记会被洗掉，这里补回来。
  if (base.mnemonicDirty) {
    next.mnemonicDirty = true;
  }
  cards[index] = next;
  NoticeNoteStore.addToDirty('cardIds', next.id);

  if (!Array.isArray(library.memory.answers)) {
    library.memory.answers = [];
  }
  let entry = library.memory.answers.find((item) => item.id === session.answerEntryId);
  if (!entry) {
    entry = {
      id: NoticeNoteStore.randomId(),
      cardId: next.id,
      kind: 'text',
      answer: '',
      rating,
      reason: '',
      source,
      edited: false,
      createdAt: new Date().toISOString()
    };
    library.memory.answers.push(entry);
    session.answerEntryId = entry.id;
  }
  entry.answer = answer || entry.answer;
  entry.rating = rating;
  entry.reason = reason;
  entry.source = source;
  if (session.ratedOnce) {
    entry.edited = true;
  }
  session.ratedOnce = true;
  NoticeNoteStore.addToDirty('answerIds', entry.id);

  session.phase = 'revealed';
  session.judging = false;
  session.lastRating = rating;
  memPersist();
  memRender();
}

// AI 判定请求：真机优先 Capacitor 原生 HTTP（绕过 WebView CORS），浏览器调试退回 fetch。
// 端点拒绝 thinking 参数时去掉它重试一次（与 PC 主进程同策略）。
async function memAiRequest(endpoint, headers, payload, cfg) {
  const nativeHttp = window.Capacitor?.Plugins?.CapacitorHttp;
  const send = async (body) => {
    if (nativeHttp?.request) {
      const response = await nativeHttp.request({
        url: endpoint,
        method: 'POST',
        headers,
        data: body,
        connectTimeout: cfg.timeoutMs,
        readTimeout: cfg.timeoutMs
      });
      const data = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
      return { status: response.status, data };
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), cfg.timeoutMs);
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal
      });
      let data = null;
      try {
        data = await response.json();
      } catch {
        data = null;
      }
      return { status: response.status, data };
    } finally {
      clearTimeout(timer);
    }
  };

  let result = await send(payload);
  if (result.status === 400 && payload.thinking) {
    const retryPayload = { ...payload };
    delete retryPayload.thinking;
    result = await send(retryPayload);
  }
  if (result.status < 200 || result.status >= 300) {
    const message = result.data?.error?.message || result.data?.message || `AI 服务返回 ${result.status}`;
    throw new Error(String(message).slice(0, 160));
  }
  return result.data;
}

async function memCallAi(card, answer, history) {
  const cfg = NoticeNoteStore.getAiConfig();
  if (!NoticeNoteAiJudge.isAiJudgeConfigured(cfg)) {
    throw new Error('AI 判定未配置，请在设置里填写');
  }
  const messages = NoticeNoteAiJudge.buildJudgeMessages({
    front: card.front,
    back: card.back,
    answer,
    history
  });
  const payload = NoticeNoteAiJudge.buildJudgePayload(cfg, messages);
  const endpoint = NoticeNoteAiJudge.buildJudgeEndpoint(cfg.baseUrl);
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${cfg.apiKey}`
  };
  const data = await memAiRequest(endpoint, headers, payload, cfg);
  const content = data?.choices?.[0]?.message?.content || '';
  const parsed = NoticeNoteAiJudge.parseJudgeReply(content);
  // 和 PC 同一道去重：建议跟卡片原文一字不差就不提示。
  return { ...parsed, ...NoticeNoteAiJudge.normalizeAnswerReview(parsed, card.back) };
}

async function memSubmitAi() {
  const session = memSession;
  const card = session && memFindCard(session.cardId);
  if (!session || !card || session.judging) {
    return;
  }
  const textarea = document.querySelector('#memAnswerInput');
  const answer = String(textarea?.value || '').trim();
  if (!answer) {
    memSetStatus('请先用自己的话写下答案，再提交判定');
    return;
  }
  session.answer = answer;
  session.judging = true;
  session.judgeError = '';
  memRenderStudy();
  const library = memGetLibrary();
  const history = (library.memory?.answers || [])
    .filter((entry) => entry.cardId === card.id)
    .slice(-NoticeNoteAiJudge.AI_JUDGE_HISTORY_LIMIT)
    .reverse();
  try {
    const result = await memCallAi(card, answer, history);
    session.judgeResult = result;
    memApplyRating(result.rating, { source: 'ai', reason: result.reason, answer });
  } catch (error) {
    // 判定失败：翻面 + 手动四档兜底，与 PC 行为一致
    session.judging = false;
    session.judgeError = error.message || 'AI 判定失败';
    session.phase = 'revealed';
    memRenderStudy();
  }
}

function memSetStatus(message) {
  const status = document.querySelector('#memStatus');
  if (status) {
    status.textContent = message;
  }
}

function memNextCard() {
  const snapshot = memGetSnapshot();
  const queue = {
    learning: snapshot.queue.learning.map(memFindCard).filter(Boolean),
    due: snapshot.queue.due.map(memFindCard).filter(Boolean),
    newCards: snapshot.queue.newCards.map(memFindCard).filter(Boolean)
  };
  const next = NoticeNoteMemoryCardStore.pickNextCard(queue);
  if (!next) {
    memSession = null;
    memRender();
    return;
  }
  memStartSession(next);
}

function memRenderRatingButtons(container, { compact = false } = {}) {
  const session = memSession;
  const card = session && memFindCard(session.cardId);
  if (!card) {
    return;
  }
  const preview = NoticeNoteSm2Scheduler.previewIntervals(
    session.preCard || card,
    memGetLibrary().memory?.settings || {},
    Date.now()
  );
  const bar = document.createElement('div');
  bar.className = compact ? 'mem-rating-bar is-compact' : 'mem-rating-bar';
  for (const rating of NoticeNoteSm2Scheduler.RATINGS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `mem-rating mem-rating-${rating}`;
    const label = document.createElement('strong');
    label.textContent = MEM_RATING_LABELS[rating];
    const gap = document.createElement('span');
    gap.textContent = preview[rating]?.label || '—';
    button.append(label, gap);
    if (session.lastRating === rating) {
      button.classList.add('is-current');
    }
    button.addEventListener('click', () => {
      memApplyRating(rating, {
        source: 'manual',
        reason: session.judgeResult ? '手动改判' : '',
        answer: session.answer
      });
    });
    bar.append(button);
  }
  container.append(bar);
}

// 背面审阅：AI 认为卡片自己的答案有误/不全时，给一版可复制的替换答案。
// 手机端没有编辑入口（卡片只在 PC 上写），所以这里只提示 + 复制，
// 文案要写清「去电脑端改」，否则会以为手机上能直接改。
function memRenderAnswerReview(area, judgeResult) {
  const verdict = judgeResult?.answerVerdict;
  const suggestion = String(judgeResult?.suggestedBack || '').trim();
  if ((verdict !== 'wrong' && verdict !== 'partial') || !suggestion) {
    return;
  }
  const box = document.createElement('div');
  box.className = 'mem-answer-review';

  const head = document.createElement('div');
  head.className = 'mem-answer-review-head';
  const badge = document.createElement('strong');
  badge.className = 'mem-answer-review-badge';
  badge.dataset.verdict = verdict;
  badge.textContent = verdict === 'wrong' ? '卡片答案有误' : '卡片答案不全';
  head.append(badge);
  const note = String(judgeResult.answerNote || '').trim();
  if (note) {
    const noteEl = document.createElement('p');
    noteEl.className = 'mem-answer-review-note';
    noteEl.textContent = note;
    head.append(noteEl);
  }

  const text = document.createElement('div');
  text.className = 'mem-answer-review-text';
  text.textContent = suggestion;

  const actions = document.createElement('div');
  actions.className = 'mem-answer-review-actions';
  const hint = document.createElement('span');
  hint.className = 'mem-answer-review-hint';
  hint.textContent = '到电脑端改这张卡的背面';
  const copy = document.createElement('button');
  copy.type = 'button';
  copy.className = 'secondary-action mem-answer-review-copy';
  copy.textContent = '复制';
  copy.addEventListener('click', async () => {
    try {
      await memWriteClipboard(suggestion);
      copy.textContent = '已复制';
    } catch {
      copy.textContent = '复制失败';
    }
    window.setTimeout(() => {
      copy.textContent = '复制';
    }, 1500);
  });
  actions.append(hint, copy);

  box.append(head, text, actions);
  area.append(box);
}

// WebView 里 navigator.clipboard 偶发不可用（没焦点、权限被拒、非安全上下文），
// 这时退回 textarea + execCommand；两条都失败才报错。
async function memWriteClipboard(text) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // 继续走兜底
    }
  }
  const temp = document.createElement('textarea');
  temp.value = text;
  temp.setAttribute('readonly', '');
  temp.style.position = 'fixed';
  temp.style.opacity = '0';
  document.body.append(temp);
  temp.select();
  const ok = document.execCommand('copy');
  temp.remove();
  if (!ok) {
    throw new Error('copy failed');
  }
}

function memRenderStudy() {
  const area = document.querySelector('#memStudy');
  if (!area) {
    return;
  }
  area.innerHTML = '';
  const session = memSession;
  const card = session && memFindCard(session.cardId);
  if (!session || !card) {
    const empty = document.createElement('div');
    empty.className = 'mem-empty';
    const snapshot = memGetSnapshot();
    empty.textContent = snapshot.stats.total === 0
      ? '电脑端还没有记忆卡。在 PC 记忆页新建卡片后同步即可。'
      : '当前没有待学习的卡片，休息一下吧。';
    area.append(empty);
    return;
  }

  const front = document.createElement('div');
  front.className = 'mem-front markdown-body';
  front.innerHTML = renderMarkdown(card.front || '');
  area.append(front);

  if (card.types?.length > 0) {
    const types = document.createElement('div');
    types.className = 'mem-types';
    for (const name of card.types) {
      const chip = document.createElement('span');
      chip.textContent = `#${name}`;
      types.append(chip);
    }
    area.append(types);
  }

  const aiConfigured = NoticeNoteAiJudge.isAiJudgeConfigured(NoticeNoteStore.getAiConfig());

  if (session.phase === 'question') {
    if (aiConfigured) {
      const textarea = document.createElement('textarea');
      textarea.id = 'memAnswerInput';
      textarea.className = 'mem-answer-input';
      textarea.rows = 6;
      textarea.placeholder = '用自己的话复述答案，AI 会判定掌握程度';
      textarea.value = session.answer || '';
      area.append(textarea);
      const actions = document.createElement('div');
      actions.className = 'mem-actions';
      const submitButton = document.createElement('button');
      submitButton.type = 'button';
      submitButton.className = 'primary-action';
      submitButton.textContent = '提交 AI 判定';
      submitButton.addEventListener('click', () => {
        memSubmitAi();
      });
      const manualButton = document.createElement('button');
      manualButton.type = 'button';
      manualButton.className = 'secondary-action';
      manualButton.textContent = '跳过 AI，手动评分';
      manualButton.addEventListener('click', () => {
        session.answer = String(textarea.value || '').trim();
        session.phase = 'revealed';
        memRenderStudy();
      });
      actions.append(submitButton, manualButton);
      area.append(actions);
    } else {
      const revealButton = document.createElement('button');
      revealButton.type = 'button';
      revealButton.className = 'primary-action';
      revealButton.textContent = '显示答案';
      revealButton.addEventListener('click', () => {
        session.phase = 'revealed';
        memRenderStudy();
      });
      area.append(revealButton);
      const hint = document.createElement('p');
      hint.className = 'mem-hint';
      hint.textContent = '在设置里配置 AI 判定后，可先作答再自动判档。';
      area.append(hint);
    }
    return;
  }

  if (session.judging) {
    const judging = document.createElement('p');
    judging.className = 'mem-judging';
    judging.textContent = 'AI 判定中...';
    area.append(judging);
    return;
  }

  // revealed：答案 + 判定结果/失败提示 + 四档（首次手动评分或改判）+ 下一张
  const back = document.createElement('div');
  back.className = 'mem-back markdown-body';
  back.innerHTML = renderMarkdown(card.back || '');
  area.append(back);

  // 助记只在答案面出现，和 PC 一致；问题面给线索等于泄题。
  // 手机端可以在答案面直接写/改，这是手机上唯一能编辑的内容字段。
  const mnemonic = String(card.mnemonic || '').trim();
  if (mnemonic) {
    const note = document.createElement('div');
    note.className = 'mem-mnemonic';
    const head = document.createElement('div');
    head.className = 'mem-mnemonic-head';
    const label = document.createElement('span');
    label.className = 'mem-mnemonic-label';
    label.textContent = '助记';
    const edit = document.createElement('button');
    edit.type = 'button';
    edit.className = 'mem-mnemonic-edit';
    edit.textContent = '编辑';
    edit.addEventListener('click', () => memOpenMnemonicDialog(card.id));
    head.append(label, edit);
    const text = document.createElement('p');
    text.textContent = mnemonic;
    note.append(head, text);
    area.append(note);
  } else {
    const add = document.createElement('button');
    add.type = 'button';
    add.className = 'mem-mnemonic-add';
    add.textContent = '＋ 写助记';
    add.addEventListener('click', () => memOpenMnemonicDialog(card.id));
    area.append(add);
  }

  if (session.judgeResult) {
    const result = document.createElement('div');
    result.className = 'mem-judge-result';
    const label = document.createElement('strong');
    label.textContent = `AI 判定：${MEM_RATING_LABELS[session.judgeResult.rating]}`;
    result.append(label);
    if (session.judgeResult.reason) {
      const reason = document.createElement('p');
      reason.textContent = session.judgeResult.reason;
      result.append(reason);
    }
    area.append(result);
    memRenderAnswerReview(area, session.judgeResult);
  }
  if (session.judgeError) {
    const errorBar = document.createElement('div');
    errorBar.className = 'mem-judge-error';
    errorBar.textContent = `AI 判定失败：${session.judgeError}。请手动评分。`;
    area.append(errorBar);
  }

  memRenderRatingButtons(area);

  const nextButton = document.createElement('button');
  nextButton.type = 'button';
  nextButton.className = 'primary-action mem-next';
  nextButton.textContent = '下一张 →';
  nextButton.disabled = !session.ratedOnce;
  nextButton.addEventListener('click', memNextCard);
  area.append(nextButton);
  if (!session.ratedOnce) {
    const hint = document.createElement('p');
    hint.className = 'mem-hint';
    hint.textContent = '先选一档评分，再进入下一张。';
    area.append(hint);
  }
}

function memRender() {
  const panel = document.querySelector('#memoryPanel');
  if (!panel) {
    return;
  }
  panel.innerHTML = '';
  const library = memGetLibrary();
  if (!library) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = '还没有内容：先在笔记页点「同步」配对电脑，或导入离线包。';
    panel.append(empty);
    return;
  }

  const snapshot = memGetSnapshot();
  const stats = snapshot.stats;

  // 页面标题：没有它时四格统计直接贴顶，看着像内容被截了一段。
  const heading = document.createElement('div');
  heading.className = 'tab-heading';
  const headingTitle = document.createElement('h2');
  headingTitle.textContent = '记忆卡片';
  heading.append(headingTitle);
  panel.append(heading);

  const statsRow = document.createElement('div');
  statsRow.className = 'mem-stats';
  const items = [
    ['待复习', stats.dueCount],
    ['学习中', stats.learningCount],
    ['新卡', stats.newCount],
    ['今日已评', stats.reviewedToday]
  ];
  for (const [label, value] of items) {
    const item = document.createElement('div');
    item.className = 'mem-stat';
    const number = document.createElement('strong');
    number.textContent = String(value);
    const text = document.createElement('span');
    text.textContent = label;
    item.append(number, text);
    statsRow.append(item);
  }
  panel.append(statsRow);

  // 类型筛选
  const typeBar = document.createElement('div');
  typeBar.className = 'mem-type-bar';
  const allChip = document.createElement('button');
  allChip.type = 'button';
  allChip.className = memType ? 'mem-type-chip' : 'mem-type-chip is-active';
  allChip.textContent = `全部 ${stats.allTotal}`;
  allChip.addEventListener('click', () => {
    memType = null;
    memSession = null;
    memRender();
  });
  typeBar.append(allChip);
  for (const type of snapshot.types) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = memType === type.name ? 'mem-type-chip is-active' : 'mem-type-chip';
    chip.textContent = `${type.name} ${type.count}`;
    chip.addEventListener('click', () => {
      memType = type.name;
      memSession = null;
      memRender();
    });
    typeBar.append(chip);
  }
  panel.append(typeBar);

  const status = document.createElement('p');
  status.id = 'memStatus';
  status.className = 'mem-status';
  status.setAttribute('role', 'status');
  panel.append(status);

  const study = document.createElement('section');
  study.id = 'memStudy';
  study.className = 'mem-study';
  panel.append(study);
  // 进入页面 / 切筛选后自动取下一张（学习中到期 → 到期复习 → 限额内新卡），
  // 与 PC 记忆页一致；队列真为空时才显示休息提示。
  if (!memSession) {
    const queue = {
      learning: snapshot.queue.learning.map(memFindCard).filter(Boolean),
      due: snapshot.queue.due.map(memFindCard).filter(Boolean),
      newCards: snapshot.queue.newCards.map(memFindCard).filter(Boolean)
    };
    const next = NoticeNoteMemoryCardStore.pickNextCard(queue);
    if (next) {
      memSession = memCreateSession(next);
    }
  }
  memRenderStudy();

  // 卡片列表（浏览/点选学习）
  const listToggle = document.createElement('button');
  listToggle.type = 'button';
  listToggle.className = 'secondary-action mem-list-toggle';
  listToggle.textContent = memShowList ? '收起卡片列表' : `浏览卡片列表（${snapshot.cards.length}）`;
  listToggle.addEventListener('click', () => {
    memShowList = !memShowList;
    memRender();
  });
  panel.append(listToggle);

  if (memShowList) {
    const list = document.createElement('div');
    list.className = 'mem-card-list';
    for (const card of snapshot.cards) {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'mem-card-row';
      const frontText = document.createElement('span');
      frontText.className = 'mem-card-front';
      frontText.textContent = (card.front || '').replace(/\s+/g, ' ').slice(0, 60) || '（空正面）';
      const due = document.createElement('span');
      due.className = card.isDue || card.state === 'new' ? 'mem-card-due is-due' : 'mem-card-due';
      due.textContent = card.dueLabel;
      row.append(frontText, due);
      row.addEventListener('click', () => {
        memStartSession(card);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
      list.append(row);
    }
    panel.append(list);
  }

  const hint = document.createElement('p');
  hint.className = 'mem-hint';
  hint.textContent = '评分与作答保存在手机本地，点笔记页「同步」后回传电脑。';
  panel.append(hint);
}
// 助记弹框只有一份，脚本在 body 末尾加载，这里绑一次即可。
document.querySelector('#memMnemonicSave')?.addEventListener('click', memSaveMnemonicFromDialog);
document.querySelector('#memMnemonicCancel')?.addEventListener('click', memCloseMnemonicDialog);
document.querySelector('#memMnemonicDelete')?.addEventListener('click', memDeleteMnemonic);
document.querySelector('#memMnemonicDialog')?.addEventListener('close', () => {
  memMnemonicEditingId = null;
});
