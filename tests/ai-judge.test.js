// AI 判定的纯函数测试：配置归一化、prompt 结构、回复解析容错。
// 网络请求不在这一层，所以这里不需要 mock 任何东西。
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  AI_JUDGE_DEFAULT_BASE_URL,
  AI_JUDGE_DEFAULT_MODEL,
  AI_JUDGE_DEFAULTS,
  AI_JUDGE_MIN_TIMEOUT_MS,
  AI_JUDGE_MAX_TIMEOUT_MS,
  AI_JUDGE_ANSWER_MAX_LENGTH,
  AI_JUDGE_REASON_MAX_LENGTH,
  AI_JUDGE_SUGGESTION_MAX_LENGTH,
  AI_JUDGE_BACK_NOTE_MAX_LENGTH,
  VALID_RATINGS,
  AiJudgeParseError,
  normalizeAiJudgeConfig,
  isAiJudgeConfigured,
  buildJudgeEndpoint,
  buildJudgeMessages,
  buildJudgePayload,
  parseJudgeReply,
  normalizeAnswerReview,
  truncateAnswer
} = require('../notice_note_client_pc/src/lib/ai-judge');

test('normalizeAiJudgeConfig 补齐默认值并去掉 baseURL 尾斜杠', () => {
  const config = normalizeAiJudgeConfig({});
  assert.equal(config.baseUrl, AI_JUDGE_DEFAULT_BASE_URL);
  assert.equal(config.model, AI_JUDGE_DEFAULT_MODEL);
  assert.equal(config.apiKey, '');
  assert.equal(config.enabled, true);
  assert.equal(config.disableThinking, true);

  const trimmed = normalizeAiJudgeConfig({ baseUrl: 'https://example.com/v1///' });
  assert.equal(trimmed.baseUrl, 'https://example.com/v1');
});

test('normalizeAiJudgeConfig 把超时夹在合理区间，非法值回默认', () => {
  assert.equal(normalizeAiJudgeConfig({ timeoutMs: 1 }).timeoutMs, AI_JUDGE_MIN_TIMEOUT_MS);
  assert.equal(normalizeAiJudgeConfig({ timeoutMs: 1e9 }).timeoutMs, AI_JUDGE_MAX_TIMEOUT_MS);
  assert.equal(normalizeAiJudgeConfig({ timeoutMs: 'abc' }).timeoutMs, AI_JUDGE_DEFAULTS.timeoutMs);
  assert.equal(normalizeAiJudgeConfig({ timeoutMs: 8000 }).timeoutMs, 8000);
});

test('apiKey 里的斜杠必须保留：千帆的 key 形如 bce-v3/<标识>/<摘要>', () => {
  const key = 'bce-v3/FAKEKEYFORTEST/0123456789abcdef';
  assert.equal(normalizeAiJudgeConfig({ apiKey: `  ${key}  ` }).apiKey, key);
});

test('isAiJudgeConfigured 要求 key、端点、模型三样齐全且开关打开', () => {
  const base = { baseUrl: 'https://x/v1', model: 'm', apiKey: 'k' };
  assert.equal(isAiJudgeConfigured(base), true);
  assert.equal(isAiJudgeConfigured({ ...base, apiKey: '' }), false);
  assert.equal(isAiJudgeConfigured({ ...base, enabled: false }), false);
  // 模型名留空视为「用默认模型」，不算未配置（用户清空输入框时不该整个功能失灵）
  assert.equal(normalizeAiJudgeConfig({ ...base, model: '' }).model, AI_JUDGE_DEFAULT_MODEL);
  assert.equal(isAiJudgeConfigured({ ...base, model: '' }), true);
});

test('buildJudgeEndpoint 不重复拼 /chat/completions', () => {
  assert.equal(buildJudgeEndpoint('https://x/v1'), 'https://x/v1/chat/completions');
  assert.equal(buildJudgeEndpoint('https://x/v1/'), 'https://x/v1/chat/completions');
  assert.equal(
    buildJudgeEndpoint('https://x/v1/chat/completions'),
    'https://x/v1/chat/completions'
  );
});

test('buildJudgeMessages 带上正反面、本次回答与历史，且明确 easy 的门槛', () => {
  const messages = buildJudgeMessages({
    front: 'SM-2 的 ease factor 初始值？',
    back: '2.5',
    answer: '2.5，界面显示 250%',
    history: [
      { rating: 'hard', answer: '好像是 2 点几' },
      { rating: 'again', answer: '不记得' }
    ]
  });
  assert.equal(messages.length, 2);
  const [system, user] = messages;
  assert.equal(system.role, 'system');
  assert.equal(user.role, 'user');
  assert.match(system.content, /again/);
  assert.match(system.content, /easy 的前提/, '必须写清 easy 需要额外信息，否则模型会把复述判成 easy');
  assert.match(user.content, /卡片正面：SM-2 的 ease factor 初始值？/);
  assert.match(user.content, /卡片背面（标准答案）：2\.5/);
  assert.match(user.content, /用户本次回答：2\.5，界面显示 250%/);
  assert.match(user.content, /- 困难：好像是 2 点几/);
  assert.match(user.content, /- 重来：不记得/);
  // 历史只是背景，不能变成主要判据
  assert.match(user.content, /仅作背景参考/);
});

test('buildJudgeMessages 不把历史当成判定依据、最多取三条', () => {
  const messages = buildJudgeMessages({
    front: 'q',
    back: 'a',
    answer: 'x',
    history: [
      { rating: 'again', answer: '1' },
      { rating: 'again', answer: '2' },
      { rating: 'good', answer: '3' },
      { rating: 'easy', answer: '4' }
    ]
  });
  const user = messages[1].content;
  assert.doesNotMatch(user, /- .*：4$/m, '第四条历史不该进 prompt');
  assert.match(user, /- 良好：3/);
});

test('buildJudgeMessages 忽略 rating 非法的历史条目', () => {
  const messages = buildJudgeMessages({
    front: 'q',
    back: 'a',
    answer: 'x',
    history: [{ rating: 'unknown', answer: '脏数据' }]
  });
  assert.doesNotMatch(messages[1].content, /脏数据/);
});

test('buildJudgePayload 关闭 thinking 并带 json_object', () => {
  const payload = buildJudgePayload({ apiKey: 'k', model: 'm', disableThinking: true }, []);
  assert.equal(payload.temperature, 0);
  assert.deepEqual(payload.thinking, { type: 'disabled' });
  assert.deepEqual(payload.response_format, { type: 'json_object' });
  assert.ok(payload.max_tokens >= 2000, '要留出写整版替换答案的空间，1200 会被截成半个 JSON');

  const open = buildJudgePayload({ apiKey: 'k', model: 'm', disableThinking: false }, []);
  assert.equal(open.thinking, undefined, '不关思考时不能带 thinking 参数，否则部分端点 400');
});

test('truncateAnswer 超长截断并加省略号', () => {
  const long = 'x'.repeat(AI_JUDGE_ANSWER_MAX_LENGTH + 50);
  const result = truncateAnswer(long);
  assert.equal(result.length, AI_JUDGE_ANSWER_MAX_LENGTH + 1);
  assert.ok(result.endsWith('…'));
  assert.equal(truncateAnswer('  短  '), '短');
  assert.equal(truncateAnswer(null), '');
});

test('parseJudgeReply 标准 JSON', () => {
  const result = parseJudgeReply('{"rating":"good","reason":"核心点答对"}');
  assert.equal(result.rating, 'good');
  assert.equal(result.reason, '核心点答对');
  // 老 prompt / 老模型只回两字段时，背面审阅必须是「没问题」，不能渲染空块
  assert.equal(result.answerVerdict, 'ok');
  assert.equal(result.answerNote, '');
  assert.equal(result.suggestedBack, '');
});

test('buildJudgeMessages 要求模型顺手审卡片背面，并给出替换答案的字段', () => {
  const system = buildJudgeMessages({ front: 'q', back: 'a', answer: 'x' })[0].content;
  assert.match(system, /审阅这张卡的「背面（标准答案）」本身/);
  assert.match(system, /answerVerdict/);
  assert.match(system, /suggestedBack/);
  // 没有真问题就必须闭嘴：否则每次判定都会塞一条「建议润色」
  assert.match(system, /宁可漏报，也不要硬找问题/);
  // 背面写错而用户答对时，不能因为「跟背面不一致」扣分
  assert.match(system, /不要因为和背面不一致就扣分/);
});

test('parseJudgeReply 解析背面有误与替换答案', () => {
  const raw = JSON.stringify({
    rating: 'good',
    reason: '答对了要点',
    answerVerdict: 'wrong',
    answerNote: '把 429 说成了 503',
    suggestedBack: '降级返回 429 + Retry-After'
  });
  const result = parseJudgeReply(raw);
  assert.equal(result.rating, 'good');
  assert.equal(result.answerVerdict, 'wrong');
  assert.equal(result.answerNote, '把 429 说成了 503');
  assert.equal(result.suggestedBack, '降级返回 429 + Retry-After');
});

test('parseJudgeReply 接受中文 verdict 与同义字段名', () => {
  const partial = parseJudgeReply(JSON.stringify({
    rating: 'hard', reason: '漏了开关', answerVerdict: '不全', answerNote: '少了两种落地方式', suggestedBack: '完整版'
  }));
  assert.equal(partial.answerVerdict, 'partial');
  assert.equal(partial.suggestedBack, '完整版');

  const nested = parseJudgeReply(JSON.stringify({
    rating: 'hard',
    reason: '漏了',
    answerReview: { verdict: '错误', note: '事实有误', suggested: '修正版' }
  }));
  assert.equal(nested.answerVerdict, 'wrong');
  assert.equal(nested.answerNote, '事实有误');
  assert.equal(nested.suggestedBack, '修正版');
});

test('只有说有问题、却给不出替换答案的，一律当没问题', () => {
  // 只留一句抱怨最烦人：用户没法动手，结果条还常驻
  const noSuggestion = parseJudgeReply(JSON.stringify({
    rating: 'good', reason: 'ok', answerVerdict: 'partial', answerNote: '写得不全'
  }));
  assert.equal(noSuggestion.answerVerdict, 'ok');
  assert.equal(noSuggestion.answerNote, '');

  const noVerdict = parseJudgeReply(JSON.stringify({
    rating: 'good', reason: 'ok', suggestedBack: '一版新答案'
  }));
  assert.equal(noVerdict.answerVerdict, 'ok', '没说有问题就不该提示');
  assert.equal(noVerdict.suggestedBack, '');
});

test('建议答案去掉代码围栏、超长截断，note 单独限长', () => {
  const fenced = parseJudgeReply(JSON.stringify({
    rating: 'good',
    reason: 'ok',
    answerVerdict: 'partial',
    answerNote: '补两点',
    suggestedBack: '```markdown\n第一点\n第二点\n```'
  }));
  assert.equal(fenced.suggestedBack, '第一点\n第二点');

  const longBack = 'x'.repeat(AI_JUDGE_SUGGESTION_MAX_LENGTH + 100);
  const longNote = 'y'.repeat(AI_JUDGE_BACK_NOTE_MAX_LENGTH + 50);
  const truncated = parseJudgeReply(JSON.stringify({
    rating: 'good', reason: 'ok', answerVerdict: 'partial', answerNote: longNote, suggestedBack: longBack
  }));
  assert.equal(truncated.suggestedBack.length, AI_JUDGE_SUGGESTION_MAX_LENGTH);
  assert.equal(truncated.answerNote.length, AI_JUDGE_BACK_NOTE_MAX_LENGTH);
});

test('normalizeAnswerReview：建议与卡片背面相同就当没提', () => {
  const back = '降级返回 429';
  const same = normalizeAnswerReview({
    answerVerdict: 'partial', answerNote: '补一下', suggestedBack: `  ${back}  `
  }, back);
  assert.equal(same.answerVerdict, 'ok', '一字不差的「改写」不该弹提示');
  assert.equal(same.suggestedBack, '');

  const changed = normalizeAnswerReview({
    answerVerdict: 'partial', answerNote: '补一下', suggestedBack: '降级返回 429 + Retry-After'
  }, back);
  assert.equal(changed.answerVerdict, 'partial');
  assert.equal(changed.suggestedBack, '降级返回 429 + Retry-After');
});

test('纯文本回复走兜底时，不虚构背面审阅结果', () => {
  const result = parseJudgeReply('这个回答只能算 hard，因为漏了核心点。');
  assert.equal(result.answerVerdict, 'ok');
  assert.equal(result.suggestedBack, '');
});

test('parseJudgeReply 容忍 markdown 围栏与前后废话', () => {
  const fenced = parseJudgeReply('```json\n{"rating":"hard","reason":"漏了数值"}\n```');
  assert.equal(fenced.rating, 'hard');

  const chatty = parseJudgeReply('好的，我的判断是：{"rating":"again","reason":"答错"} 以上。');
  assert.equal(chatty.rating, 'again');
  assert.equal(chatty.reason, '答错');
});

test('parseJudgeReply 接受中文档位与同义字段名', () => {
  assert.equal(parseJudgeReply('{"rating":"良好","reason":"ok"}').rating, 'good');
  assert.equal(parseJudgeReply('{"level":"简单","reason":"ok"}').rating, 'easy');
  assert.equal(parseJudgeReply('掌握程度：困难').rating, 'hard');
});

test('parseJudgeReply 在纯文本回复里也能找到档位', () => {
  const result = parseJudgeReply('这个回答只能算 hard，因为漏了核心点。');
  assert.equal(result.rating, 'hard');
  assert.match(result.reason, /漏了核心点/);
});

test('parseJudgeReply 空回复与无法识别都抛 AiJudgeParseError', () => {
  assert.throws(() => parseJudgeReply(''), AiJudgeParseError);
  assert.throws(() => parseJudgeReply('   '), AiJudgeParseError);
  assert.throws(() => parseJudgeReply('我觉得还行吧，说不好。'), AiJudgeParseError);
  try {
    parseJudgeReply('我完全判断不了');
  } catch (error) {
    assert.equal(error.code, 'AI_JUDGE_PARSE');
  }
});

test('parseJudgeReply 理由超长截断，不把整段推理塞进结果条', () => {
  const longReason = '很长的理由'.repeat(100);
  const result = parseJudgeReply(JSON.stringify({ rating: 'good', reason: longReason }));
  assert.equal(result.reason.length, AI_JUDGE_REASON_MAX_LENGTH);
});

test('VALID_RATINGS 与 SM-2 调度器的档位保持一致', () => {
  const { RATINGS } = require('../notice_note_client_pc/src/lib/sm2-scheduler');
  assert.deepEqual([...VALID_RATINGS].sort(), [...RATINGS].sort());
});
