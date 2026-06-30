import OpenAiProvider from './OpenAiProvider.js';

/**
 * RequestyProvider — Adapter cho Requesty (https://requesty.ai).
 * Requesty dùng OpenAI-compatible Chat Completions, nên tái sử dụng
 * complete() từ OpenAiProvider và chỉ ghi đè default base URL/model.
 *
 * Env:
 *   AI_API_KEY   — Requesty API key
 *   AI_MODEL     — model id trên Requesty (ví dụ: openai/gpt-4o-mini)
 *   AI_BASE_URL  — mặc định https://router.requesty.ai/v1
 */
class RequestyProvider extends OpenAiProvider {
  constructor() {
    super();
    this.model = process.env.AI_MODEL || 'openai/gpt-4o-mini';
    this.baseUrl = (process.env.AI_BASE_URL || 'https://router.requesty.ai/v1').replace(/\/+$/, '');
  }
}

export default RequestyProvider;
