// 记忆卡作答历史：用户每次作答的原文、模型判定与理由。
//
// 落盘在 notesPath/.memory_card/answers.json，跟卡片同一个目录：
// 切库自动隔离，删卡片时连带清理，备份笔记库也会带上。
//
// 与 cards.json 分开存的原因：卡片是「当前状态」，历史是「流水」，
// 混在一起会让每次评分都要重写整个牌组，且卡片快照会随历史无限膨胀。

const ANSWER_LOG_FILE_NAME = 'answers.json';
const ANSWER_LOG_VERSION = 1;
// 单条回答的保留长度。和 AI prompt 的上限一致，避免存下来的内容和发出去的不一样。
const ANSWER_TEXT_MAX_LENGTH = 4000;
// 每张卡最多保留多少条。超过就丢最老的：复习几百次之后早期的意义不大，
// 但完全不留会让「这次比上次好在哪」失去参照。
const ANSWER_KEEP_PER_CARD = 200;

const ANSWER_KINDS = ['text', 'voice'];
const ANSWER_SOURCES = ['ai', 'manual'];

function toText(value, limit = 0) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!limit || text.length <= limit) {
    return text;
  }
  return text.slice(0, limit);
}

function normalizeTimestamp(value, fallback) {
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) {
      return new Date(parsed).toISOString();
    }
  }
  return fallback;
}

// 单条历史归一化。缺 id / cardId / rating 的一律丢弃：
// 这种条目既不能展示也不能删，留着只会让计数虚高。
function normalizeAnswerEntry(input, ratingValidator, now) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return null;
  }
  const id = typeof input.id === 'string' ? input.id : '';
  const cardId = typeof input.cardId === 'string' ? input.cardId : '';
  const rating = ratingValidator(input.rating);
  if (!id || !cardId || !rating) {
    return null;
  }
  const fallbackTime = new Date(now).toISOString();
  return {
    id,
    cardId,
    kind: ANSWER_KINDS.includes(input.kind) ? input.kind : 'text',
    answer: toText(input.answer, ANSWER_TEXT_MAX_LENGTH),
    rating,
    reason: toText(input.reason, 200),
    source: ANSWER_SOURCES.includes(input.source) ? input.source : 'ai',
    // 改判过的条目留痕，界面上可以标一下，也方便回头评估模型的判断质量。
    edited: input.edited === true,
    createdAt: normalizeTimestamp(input.createdAt, fallbackTime)
  };
}

function normalizeAnswerLog(raw, options = {}) {
  const ratingValidator = typeof options.ratingValidator === 'function'
    ? options.ratingValidator
    : (value) => (typeof value === 'string' ? value : null);
  const now = Number.isFinite(options.now) ? options.now : Date.now();
  const list = Array.isArray(raw)
    ? raw
    : (raw && Array.isArray(raw.entries) ? raw.entries : []);
  const seen = new Set();
  const entries = [];
  for (const item of list) {
    const entry = normalizeAnswerEntry(item, ratingValidator, now);
    if (!entry || seen.has(entry.id)) {
      continue;
    }
    seen.add(entry.id);
    entries.push(entry);
  }
  // 落盘时按时间正序存，读回来也是正序；界面上取尾部即最新。
  entries.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  return { version: ANSWER_LOG_VERSION, entries };
}

function buildAnswerLog(entries) {
  return {
    version: ANSWER_LOG_VERSION,
    entries: Array.isArray(entries) ? entries : []
  };
}

// 同一张卡超过保留上限时丢最老的。返回新数组，不原地改。
function trimCardAnswers(entries, cardId, keep = ANSWER_KEEP_PER_CARD) {
  const list = Array.isArray(entries) ? entries : [];
  const own = list.filter((entry) => entry.cardId === cardId);
  if (own.length <= keep) {
    return list;
  }
  const dropCount = own.length - keep;
  const dropIds = new Set(
    own
      .slice()
      .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
      .slice(0, dropCount)
      .map((entry) => entry.id)
  );
  return list.filter((entry) => !dropIds.has(entry.id));
}

function appendAnswerEntry(log, input, now = Date.now()) {
  const base = log && Array.isArray(log.entries) ? log : { version: ANSWER_LOG_VERSION, entries: [] };
  const entry = {
    id: input.id || '',
    cardId: input.cardId || '',
    kind: input.kind === 'voice' ? 'voice' : 'text',
    answer: toText(input.answer, ANSWER_TEXT_MAX_LENGTH),
    rating: input.rating,
    reason: toText(input.reason, 200),
    source: input.source === 'manual' ? 'manual' : 'ai',
    edited: input.edited === true,
    createdAt: normalizeTimestamp(input.createdAt, new Date(now).toISOString())
  };
  const entries = trimCardAnswers([...base.entries, entry], entry.cardId);
  return buildAnswerLog(entries);
}

function removeAnswerEntry(log, entryId) {
  const base = log && Array.isArray(log.entries) ? log : { version: ANSWER_LOG_VERSION, entries: [] };
  if (typeof entryId !== 'string' || !entryId) {
    return buildAnswerLog(base.entries);
  }
  return buildAnswerLog(base.entries.filter((entry) => entry.id !== entryId));
}

// 改判：替换某条的档位与理由，并打上 edited 标记。
function updateAnswerRating(log, entryId, rating, reason) {
  const base = log && Array.isArray(log.entries) ? log : { version: ANSWER_LOG_VERSION, entries: [] };
  const entries = base.entries.map((entry) => {
    if (entry.id !== entryId) {
      return entry;
    }
    return {
      ...entry,
      rating,
      reason: reason == null ? entry.reason : toText(reason, 200),
      source: 'manual',
      edited: true
    };
  });
  return buildAnswerLog(entries);
}

// 某张卡的历史，按时间倒序（最新在前），供界面直接使用。
function listCardAnswers(log, cardId, limit = 0) {
  const base = log && Array.isArray(log.entries) ? log : { version: ANSWER_LOG_VERSION, entries: [] };
  const own = base.entries
    .filter((entry) => entry.cardId === cardId)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  return limit > 0 ? own.slice(0, limit) : own;
}

function countCardAnswers(log, cardId) {
  const base = log && Array.isArray(log.entries) ? log : { version: ANSWER_LOG_VERSION, entries: [] };
  return base.entries.reduce((total, entry) => (entry.cardId === cardId ? total + 1 : total), 0);
}

// 删卡片时清掉它的历史，否则 answers.json 会一直攒着再也看不到的孤儿条目。
function pruneAnswersForCards(log, keepCardIds) {
  const base = log && Array.isArray(log.entries) ? log : { version: ANSWER_LOG_VERSION, entries: [] };
  const keep = keepCardIds instanceof Set ? keepCardIds : new Set(keepCardIds || []);
  return buildAnswerLog(base.entries.filter((entry) => keep.has(entry.cardId)));
}

module.exports = {
  ANSWER_LOG_FILE_NAME,
  ANSWER_LOG_VERSION,
  ANSWER_TEXT_MAX_LENGTH,
  ANSWER_KEEP_PER_CARD,
  normalizeAnswerLog,
  buildAnswerLog,
  appendAnswerEntry,
  removeAnswerEntry,
  updateAnswerRating,
  listCardAnswers,
  countCardAnswers,
  pruneAnswersForCards,
  trimCardAnswers
};
