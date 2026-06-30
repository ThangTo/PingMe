/**
 * AiProvider — Abstract base / port cho mọi AI provider.
 * Tất cả provider cụ thể (OpenAI, Anthropic, Gemini, ...) phải extends class này.
 * Consumer chỉ phụ thuộc abstraction này (DIP), không import provider cụ thể.
 */
class AiProvider {
  /**
   * Provider đã được cấu hình (có API key, base URL) hay chưa?
   * @returns {boolean}
   */
  isConfigured() {
    throw new Error('NotImplemented: isConfigured() phải được override');
  }

  /**
   * Gọi LLM completions.
   * @param {object} params
   * @param {string} params.system - System prompt
   * @param {Array<{role:string,content:string}>} params.messages - Lịch sử hỏi đáp
   * @param {'text'|'json_object'} [params.responseFormat] - Định dạng phản hồi mong muốn
   * @param {number} [params.maxTokens] - Số token output tối đa
   * @param {AbortSignal} [params.signal] - AbortController signal để timeout
   * @returns {Promise<string>} - Text response từ LLM
   */
  async complete({ system, messages, responseFormat, maxTokens, signal }) {
    throw new Error('NotImplemented: complete() phải được override');
  }
}

export default AiProvider;
