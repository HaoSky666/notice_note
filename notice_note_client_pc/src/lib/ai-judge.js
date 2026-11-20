// AI 判定：把「用户复述的答案」交给大模型，换回四档评分。
//
// 这里只做纯函数（配置归一化、prompt 构建、回复解析），网络请求留在调用方
// （PC 主进程 / 手机端 sync 层），便于单测锁住 prompt 的判定标准和 JSON 解析的容错。
//
// 端点是 OpenAI Chat Completions 兼容协议。默认值对准百度千帆的 Token Plan
// 个人版：baseURL 后面直接拼 /chat/completions。
//
// UMD：Node 走 module.exports，浏览器挂 window.NoticeNoteAiJudge（手机端复用判据）。
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.NoticeNoteAiJudge = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const AI_JUDGE_DEFAULT_BASE_URL = 'https://qianfan.baidubce.com/v2/tokenplan/personal';
  const AI_JUDGE_DEFAULT_MODEL = 'deepseek-v4.1-flash';
  const AI_JUDGE_TIMEOUT_MS = 25000;
  const AI_JUDGE_MIN_TIMEOUT_MS = 5000;
  const AI_JUDGE_MAX_TIMEOUT_MS = 120000;
  // 单条回答长度上限：正常复述一两百字就够，超长的多半是粘贴了整段原文。
  const AI_JUDGE_ANSWER_MAX_LENGTH = 4000;
  const AI_JUDGE_REASON_MAX_LENGTH = 200;
  const AI_JUDGE_HISTORY_LIMIT = 3;

  const VALID_RATINGS = ['again', 'hard', 'good', 'easy'];

  const RATING_LABELS = {
    again: '重来',
    hard: '困难',
    good: '良好',
    easy: '简单'
  };

  // 模型偶尔会无视「只输出英文枚举」的要求，直接把中文档位写回来。
  const RATING_ALIASES = {
    again: 'again',
    hard: 'hard',
    good: 'good',
    easy: 'easy',
    重来: 'again',
    困难: 'hard',
    良好: 'good',
    简单: 'easy'
  };

  const AI_JUDGE_DEFAULTS = {
    enabled: true,
    baseUrl: AI_JUDGE_DEFAULT_BASE_URL,
    apiKey: '',
    model: AI_JUDGE_DEFAULT_MODEL,
    timeoutMs: AI_JUDGE_TIMEOUT_MS,
    // 千帆的 deepseek 系列默认开推理，reasoning_tokens 会吃掉 max_tokens 导致
    // content 为空。关掉后单次判定从 4-6 秒降到 1-3 秒，输出也更稳。
    disableThinking: true
  };

  function toText(value, limit = 0) {
    const text = typeof value === 'string' ? value.trim() : '';
    if (!limit || text.length <= limit) {
      return text;
    }
    return text.slice(0, limit);
  }

  // baseURL 归一化：去掉尾斜杠，但保留用户写的路径（千帆的 tokenplan 前缀就在路径里）。
  function normalizeBaseUrl(value) {
    const text = toText(value);
    if (!text) {
      return AI_JUDGE_DEFAULT_BASE_URL;
    }
    return text.replace(/\/+$/, '');
  }

  function normalizeAiJudgeConfig(input = {}) {
    const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
    const timeout = Number(source.timeoutMs);
    return {
      enabled: source.enabled !== false,
      baseUrl: normalizeBaseUrl(source.baseUrl),
      // key 不做 trim 以外的处理：形如 bce-v3/ALTAKSP-xxx/yyy 的斜杠是协议的一部分。
      apiKey: typeof source.apiKey === 'string' ? source.apiKey.trim() : '',
      model: toText(source.model, 120) || AI_JUDGE_DEFAULT_MODEL,
      timeoutMs: Number.isFinite(timeout)
        ? Math.min(AI_JUDGE_MAX_TIMEOUT_MS, Math.max(AI_JUDGE_MIN_TIMEOUT_MS, Math.round(timeout)))
        : AI_JUDGE_TIMEOUT_MS,
      disableThinking: source.disableThinking !== false
    };
  }

  function isAiJudgeConfigured(config) {
    const normalized = normalizeAiJudgeConfig(config);
    return Boolean(normalized.enabled && normalized.apiKey && normalized.baseUrl && normalized.model);
  }

  // 已经带 /chat/completions 的不再重复拼，方便用户直接粘完整 endpoint。
  function buildJudgeEndpoint(baseUrl) {
    const base = normalizeBaseUrl(baseUrl);
    if (/\/chat\/completions$/i.test(base)) {
      return base;
    }
    return `${base}/chat/completions`;
  }

  function truncateAnswer(value) {
    const text = typeof value === 'string' ? value.trim() : '';
    if (text.length <= AI_JUDGE_ANSWER_MAX_LENGTH) {
      return text;
    }
    return `${text.slice(0, AI_JUDGE_ANSWER_MAX_LENGTH)}…`;
  }

  const JUDGE_SYSTEM_PROMPT = [
    '你是一位严格的间隔重复教练。用户刚看完一张记忆卡的答案，正用自己的话复述。',
    '请判断用户这次掌握的牢固程度，只能四选一：',
    '',
    '- again（重来）：没答上来、答错关键点，或完全跑题',
    '- hard（困难）：答对了一部分，漏掉核心点，或明显卡壳、含糊',
    '- good（良好）：核心点答对，属于正常掌握',
    '- easy（简单）：在答对的基础上还有额外信息，比如补充了边界条件、举了例子、说明了原因',
    '',
    '重要判据：如果只是准确复述了标准答案的内容，没有增加任何新信息，判 good，不要判 easy。',
    'easy 的前提是用户说出了标准答案里没有直接写出的东西。',
    '',
    '评分依据是「机制是否覆盖」，不是「数值是否背对」。',
    '卡片背面里的具体数值（如 50%、1s、10s、20 次、70~80%）是可配置的示例参数，不是必答点。',
    '用户答出对应机制（如「失败率超过阈值」「慢调用比例超阈值」）就算覆盖，不要因为没说出具体数值而扣分。',
    '背面里标为「举例」「示例」或写在括号里的参数，一律不作为评分点。',
    '反过来，只报数值不说机制（例如只回答「50%」）才算没掌握。',
    '',
    '判断要严格：结论正确但复述中暴露误解的，判 hard 或 again。',
    '不要因为用户语气自信就放松标准，也不要因为表述口语化就扣分。',
    '',
    '只输出一个 JSON 对象，不要 markdown 围栏，不要任何解释文字：',
    '{"rating":"again|hard|good|easy","reason":"一句话说明依据，指出漏了什么或对了什么"}'
  ].join('\n');

  // 历史只做背景：明确告诉模型「本次判定只看本次回答」，免得它为了体现进步而偏 easy。
  function formatHistoryLine(entry) {
    const label = RATING_LABELS[entry.rating] || entry.rating;
    const answer = toText(entry.answer, 80).replace(/\s+/g, ' ');
    return `- ${label}：${answer || '（空回答）'}`;
  }

  function buildJudgeMessages(input = {}) {
    const front = toText(input.front);
    const back = toText(input.back);
    const answer = truncateAnswer(input.answer);
    const history = Array.isArray(input.history) ? input.history : [];
    const lines = [
      `卡片正面：${front || '（空）'}`,
      '',
      `卡片背面（标准答案）：${back || '（空）'}`,
      '',
      `用户本次回答：${answer || '（空）'}`
    ];
    const recent = history
      .filter((entry) => entry && VALID_RATINGS.includes(entry.rating))
      .slice(0, AI_JUDGE_HISTORY_LIMIT);
    if (recent.length > 0) {
      lines.push(
        '',
        '这张卡最近的作答记录（仅作背景参考，本次判定只看本次回答的质量，不要因为比过去好就抬高档位）：',
        ...recent.map(formatHistoryLine)
      );
    }
    return [
      { role: 'system', content: JUDGE_SYSTEM_PROMPT },
      { role: 'user', content: lines.join('\n') }
    ];
  }

  function buildJudgePayload(config, messages) {
    const normalized = normalizeAiJudgeConfig(config);
    const payload = {
      model: normalized.model,
      messages,
      temperature: 0,
      // 关掉推理后 800 足够；万一用户关掉了 disableThinking，1200 也给推理留了余量。
      max_tokens: 1200,
      response_format: { type: 'json_object' }
    };
    if (normalized.disableThinking) {
      payload.thinking = { type: 'disabled' };
    }
    return payload;
  }

  class AiJudgeParseError extends Error {
    constructor(message, raw) {
      super(message);
      this.name = 'AiJudgeParseError';
      this.code = 'AI_JUDGE_PARSE';
      this.raw = typeof raw === 'string' ? raw.slice(0, 500) : '';
    }
  }

  function stripCodeFence(text) {
    const trimmed = text.trim();
    const fenced = trimmed.match(/^```(?:json|JSON)?\s*([\s\S]*?)\s*```$/);
    return fenced ? fenced[1].trim() : trimmed;
  }

  function pickFirstBalancedObject(text) {
    const start = text.indexOf('{');
    if (start < 0) {
      return null;
    }
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let index = start; index < text.length; index += 1) {
      const char = text[index];
      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (char === '\\') {
          escaped = true;
        } else if (char === '"') {
          inString = false;
        }
        continue;
      }
      if (char === '"') {
        inString = true;
      } else if (char === '{') {
        depth += 1;
      } else if (char === '}') {
        depth -= 1;
        if (depth === 0) {
          return text.slice(start, index + 1);
        }
      }
    }
    return null;
  }

  function normalizeRating(value) {
    const key = typeof value === 'string' ? value.trim().toLowerCase() : '';
    if (VALID_RATINGS.includes(key)) {
      return key;
    }
    return RATING_ALIASES[key] || null;
  }

  // 解析模型回复。三步容错：严格 JSON → 从文本里抠 JSON 对象 → 全文找档位词。
  // 任何一步都失败才抛错，由调用方转成「判定失败」让用户手选。
  function parseJudgeReply(raw) {
    const text = stripCodeFence(typeof raw === 'string' ? raw : '');
    if (!text) {
      throw new AiJudgeParseError('模型返回为空', raw);
    }

    const candidates = [text, pickFirstBalancedObject(text)].filter(Boolean);
    for (const candidate of candidates) {
      try {
        const parsed = JSON.parse(candidate);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          const rating = normalizeRating(parsed.rating ?? parsed.level ?? parsed.grade);
          if (rating) {
            return {
              rating,
              reason: toText(parsed.reason ?? parsed.explanation ?? parsed.comment, AI_JUDGE_REASON_MAX_LENGTH)
            };
          }
        }
      } catch {
        // 继续尝试下一个候选
      }
    }

    // 最后兜底：模型把档位写成了自然语言（如「掌握程度：良好」）。
    const lowered = text.toLowerCase();
    const matched = VALID_RATINGS.find((rating) => lowered.includes(rating))
      || Object.keys(RATING_ALIASES).find((label) => text.includes(label));
    if (matched) {
      return {
        rating: RATING_ALIASES[matched] || matched,
        reason: toText(text, AI_JUDGE_REASON_MAX_LENGTH)
      };
    }

    throw new AiJudgeParseError('模型回复里没有可识别的档位', raw);
  }

  return {
    AI_JUDGE_DEFAULT_BASE_URL,
    AI_JUDGE_DEFAULT_MODEL,
    AI_JUDGE_DEFAULTS,
    AI_JUDGE_TIMEOUT_MS,
    AI_JUDGE_MIN_TIMEOUT_MS,
    AI_JUDGE_MAX_TIMEOUT_MS,
    AI_JUDGE_ANSWER_MAX_LENGTH,
    AI_JUDGE_REASON_MAX_LENGTH,
    AI_JUDGE_HISTORY_LIMIT,
    VALID_RATINGS,
    RATING_LABELS,
    AiJudgeParseError,
    normalizeAiJudgeConfig,
    isAiJudgeConfigured,
    buildJudgeEndpoint,
    buildJudgeMessages,
    buildJudgePayload,
    parseJudgeReply,
    truncateAnswer
  };
});