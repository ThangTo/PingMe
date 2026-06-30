import getAiProvider from './aiProviderFactory.js';

/**
 * aiService — Facade dùng chung cho mọi tính năng AI.
 * Consumer (catchup.service, smart-reply, ...) chỉ phụ thuộc facade này,
 * không import provider cụ thể (DIP).
 * Thêm method mới ở đây khi có tính năng AI mới, không sửa provider.
 */
export const isAiReady = () => getAiProvider().isConfigured();

const SUMMARY_MAX_OUTPUT_TOKENS = 4096;

const SUMMARY_SYSTEM_PROMPT = `Bạn là trợ lý tóm tắt tin nhắn cho người dùng.
Tóm tắt các tin nhắn thành danh sách bullet ngắn gọn, ưu tiên nội dung chính, quyết định, câu hỏi và người được nhắc đến.

Trả về JSON hợp lệ gồm các trường sau:
- "bullets": mảng object { "text": "nội dung bullet tự nhiên, không chứa ID", "sourceMessageIds": ["messageId1", "messageId2"] }
- "mentions": mảng chuỗi tên người được nhắc đến
- "decisions": mảng chuỗi quyết định được đưa ra, nếu có
- "questions": mảng chuỗi câu hỏi được đặt ra, nếu có

Quy tắc bắt buộc:
- Chỉ tóm tắt tin nhắn từ danh sách được cung cấp.
- Trả tối đa 8 bullet.
- Mỗi bullet tối đa 450 ký tự.
- Mỗi bullet tối đa 12 sourceMessageIds đại diện nhất; không cần liệt kê mọi tin nhắn trùng/rác.
- Không liệt kê hàng loạt tin nhắn rác, ký tự lặp, file hoặc câu hỏi trùng nhau; hãy gom nhóm và nêu ý chính.
- Khi tạo bullet, dùng đúng messageId trong dấu [id:...] để liên kết, nhưng trong sourceMessageIds chỉ ghi phần ObjectId, không ghi tiền tố "id:".
- Tuyệt đối không đưa messageId, ObjectId, "[id:...]" hoặc danh sách ID vào trường "text". ID chỉ được nằm trong "sourceMessageIds".
- Nếu không có tin nhắn nào, trả {"empty": true}.
- Giữ trùng lặp tối thiểu. Trả lời bằng tiếng Việt có dấu.`;

const SUMMARY_MERGE_SYSTEM_PROMPT = `Bạn là trợ lý tổng hợp nhiều bản tóm tắt tin nhắn thành một kết quả cuối cho người dùng.

Trả về JSON hợp lệ gồm các trường sau:
- "bullets": mảng object { "text": "nội dung bullet tự nhiên, không chứa ID", "sourceMessageIds": ["messageId1", "messageId2"] }
- "mentions": mảng chuỗi tên người được nhắc đến
- "decisions": mảng chuỗi quyết định được đưa ra, nếu có
- "questions": mảng chuỗi câu hỏi được đặt ra, nếu có

Quy tắc bắt buộc:
- Trả tối đa 8 bullet cuối cùng, ưu tiên nội dung quan trọng và gom trùng lặp.
- Mỗi bullet tối đa 450 ký tự.
- Mỗi bullet tối đa 12 sourceMessageIds đại diện nhất.
- Chỉ dùng sourceMessageIds có trong dữ liệu đầu vào.
- Tuyệt đối không đưa messageId, ObjectId hoặc danh sách ID vào trường "text". ID chỉ được nằm trong "sourceMessageIds".
- Nếu không có nội dung đáng tóm tắt, trả {"empty": true}.
- Trả lời bằng tiếng Việt tự nhiên, có dấu.`;

/**
 * Prompt builder chung: dòng nhập cụ thể hóa theo ngữ cảnh
 * (range, count, unread). Reused giữa summarizeUnread + summarizeMessages.
 */
const buildSummaryUserPrompt = ({ messages, contextLabel }) => {
  const conversationText = messages
    .map((msg) => `[id:${msg.messageId}] [${msg.senderName}]: ${msg.content}`)
    .join('\n');
  const intro = contextLabel ? `Hãy ${contextLabel}. ` : '';
  return `${intro}Viết bullet tự nhiên cho người đọc. Chỉ đặt messageId vào field sourceMessageIds, không viết ID trong text.\n\n${conversationText}`;
};

const formatList = (items = []) => items.filter(Boolean).join('; ');

const buildMergeUserPrompt = ({ chunks, contextLabel }) => {
  const chunkText = chunks
    .map((chunk, chunkIndex) => {
      const bullets = (chunk.bullets || [])
        .map((bullet, bulletIndex) => {
          const ids = (bullet.sourceMessageIds || []).join(', ');
          return `- Bullet ${bulletIndex + 1}: ${bullet.text}\n  sourceMessageIds: [${ids}]`;
        })
        .join('\n');
      const mentions = formatList(chunk.mentions);
      const decisions = formatList(chunk.decisions);
      const questions = formatList(chunk.questions);

      return [
        `Cụm ${chunkIndex + 1}:`,
        bullets,
        mentions ? `Nhắc đến: ${mentions}` : '',
        decisions ? `Quyết định: ${decisions}` : '',
        questions ? `Câu hỏi: ${questions}` : '',
      ].filter(Boolean).join('\n');
    })
    .join('\n\n');
  const intro = contextLabel ? `Hãy tổng hợp kết quả cho yêu cầu: ${contextLabel}.` : 'Hãy tổng hợp các cụm tóm tắt.';

  return `${intro}
Gom các ý trùng nhau, bỏ nhiễu/rác, giữ quyết định và câu hỏi quan trọng. Không viết ID trong text.

${chunkText}`;
};

const stripCodeFence = (raw) => raw
  .trim()
  .replace(/^```(?:json)?\s*/i, '')
  .replace(/\s*```$/i, '')
  .trim();

const extractJsonObject = (raw) => {
  const text = stripCodeFence(raw || '');
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return text;
  return text.slice(start, end + 1);
};

const parseSummaryResponse = (raw) => {
  let parsed;
  try {
    parsed = JSON.parse(extractJsonObject(raw));
  } catch {
    throw Object.assign(new Error('Không thể đọc phản hồi từ AI, thử lại sau.'), { statusCode: 502 });
  }
  if (parsed.empty) return { empty: true };
  return {
    bullets: Array.isArray(parsed.bullets) ? parsed.bullets : [],
    mentions: Array.isArray(parsed.mentions) ? parsed.mentions : [],
    decisions: Array.isArray(parsed.decisions) ? parsed.decisions : [],
    questions: Array.isArray(parsed.questions) ? parsed.questions : [],
  };
};

/**
 * Internal core: gọi LLM và chuẩn hóa JSON output.
 * @param {object} params
 * @param {Array<{messageId:string, senderName:string, content:string}>} params.messages
 * @param {string} [params.contextLabel]
 * @param {AbortSignal} [params.signal]
 */
const callSummaryLlm = async ({ messages, contextLabel, signal }) => {
  if (!messages || messages.length === 0) {
    return { empty: true };
  }

  const provider = getAiProvider();
  if (!provider.isConfigured()) {
    throw Object.assign(new Error('Tính năng AI tóm tắt chưa được cấu hình.'), { statusCode: 503 });
  }

  const raw = await provider.complete({
    system: SUMMARY_SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: buildSummaryUserPrompt({ messages, contextLabel }),
      },
    ],
    responseFormat: 'json_object',
    maxTokens: SUMMARY_MAX_OUTPUT_TOKENS,
    signal,
  });

  return parseSummaryResponse(raw);
};

const callMergeSummaryLlm = async ({ chunks, contextLabel, signal }) => {
  const usableChunks = (chunks || []).filter((chunk) => (
    chunk &&
    !chunk.empty &&
    (
      chunk.bullets?.length ||
      chunk.mentions?.length ||
      chunk.decisions?.length ||
      chunk.questions?.length
    )
  ));

  if (usableChunks.length === 0) {
    return { empty: true };
  }

  const provider = getAiProvider();
  if (!provider.isConfigured()) {
    throw Object.assign(new Error('Tính năng AI tóm tắt chưa được cấu hình.'), { statusCode: 503 });
  }

  const raw = await provider.complete({
    system: SUMMARY_MERGE_SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: buildMergeUserPrompt({ chunks: usableChunks, contextLabel }),
      },
    ],
    responseFormat: 'json_object',
    maxTokens: SUMMARY_MAX_OUTPUT_TOKENS,
    signal,
  });

  return parseSummaryResponse(raw);
};

/**
 * Tóm tắt tin nhắn chưa đọc (banner Smart Catch-up).
 */
export const summarizeUnread = async ({ messages, signal }) =>
  callSummaryLlm({ messages, contextLabel: null, signal });

/**
 * Tóm tắt theo khoảng thời gian hoặc số lượng (popover AI assistant).
 * @param {object} params
 * @param {Array<{messageId:string, senderName:string, content:string}>} params.messages
 * @param {string} [params.contextLabel] — Mô tả ngữ cảnh người dùng, ví dụ "tóm tắt 50 tin gần nhất".
 * @param {AbortSignal} [params.signal]
 */
export const summarizeMessages = async ({ messages, contextLabel, signal }) =>
  callSummaryLlm({ messages, contextLabel, signal });

/**
 * Tổng hợp các bản tóm tắt chunk thành kết quả cuối.
 */
export const summarizeSummaryChunks = async ({ chunks, contextLabel, signal }) =>
  callMergeSummaryLlm({ chunks, contextLabel, signal });
