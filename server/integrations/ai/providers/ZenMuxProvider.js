import OpenAiProvider from './OpenAiProvider.js';

/**
 * ZenMuxProvider — Adapter cho ZenMux (https://zenmux.ai).
 * ZenMux là LLM aggregator, API tương thích OpenAI Chat Completions
 * (chỉ cần đổi base_url + api_key), nên tái sử dụng logic complete()
 * từ OpenAiProvider (DRY). Chỉ ghi đè default base URL và model theo ZenMux.
 *
 * Env:
 *   AI_API_KEY  — ZenMux API key
 *   AI_MODEL    — model id trên ZenMux (ví dụ: glm-4.6, gemini-3-flash-preview-free, ...)
 *   AI_BASE_URL — mặc định https://api.zenmux.ai/v1
 */
class ZenMuxProvider extends OpenAiProvider {
  constructor() {
    super();
    // Ghi đè sau super() để dùng default của ZenMux; vẫn cho phép env override.
    this.model = process.env.AI_MODEL || 'glm-4.6';
    this.baseUrl = (process.env.AI_BASE_URL || 'https://api.zenmux.ai/v1').replace(/\/+$/, '');
  }
}

export default ZenMuxProvider;
