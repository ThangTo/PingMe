import AiProvider from '../AiProvider.js';

class OpenAiProvider extends AiProvider {
  constructor() {
    super();
    this.apiKey = process.env.AI_API_KEY || '';
    this.model = process.env.AI_MODEL || 'gpt-4o-mini';
    this.baseUrl = (process.env.AI_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, '');
  }

  isConfigured() {
    return Boolean(this.apiKey);
  }

  async complete({ system, messages, responseFormat, maxTokens, signal }) {
    if (!this.isConfigured()) {
      throw Object.assign(new Error('AI provider chưa được cấu hình (thiếu API key)'), { statusCode: 503 });
    }

    const body = {
      model: this.model,
      messages: [
        ...(system ? [{ role: 'system', content: system }] : []),
        ...messages,
      ],
    };

    if (Number.isFinite(maxTokens) && maxTokens > 0) {
      body.max_tokens = Math.floor(maxTokens);
    }

    if (responseFormat === 'json_object') {
      body.response_format = { type: 'json_object' };
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
      signal,
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      const statusCode = response.status >= 500 ? 502 : 503;
      throw Object.assign(new Error(`AI provider lỗi: ${response.status} ${errorBody}`), { statusCode });
    }

    const data = await response.json();
    const text = data?.choices?.[0]?.message?.content || '';
    return text;
  }
}

export default OpenAiProvider;
