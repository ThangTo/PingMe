import EmailProvider from './EmailProvider.js';

const DEFAULT_API_BASE_URL = 'https://api.brevo.com/v3';
const DEFAULT_TIMEOUT_MS = 8000;
const requiredEnv = ['BREVO_API_KEY', 'BREVO_SENDER_EMAIL'];

const assertBrevoConfig = () => {
  const missing = requiredEnv.filter((key) => !process.env[key]?.trim());
  if (missing.length) {
    throw new Error(`Brevo chưa được cấu hình: thiếu ${missing.join(', ')}`);
  }
};

const parseResponseBody = async (response) => {
  const text = await response.text();
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
};

class BrevoEmailProvider extends EmailProvider {
  constructor() {
    super('brevo');
    assertBrevoConfig();
    this.apiKey = process.env.BREVO_API_KEY.trim();
    this.sender = {
      email: process.env.BREVO_SENDER_EMAIL.trim(),
      name: process.env.BREVO_SENDER_NAME?.trim() || 'PingMe',
    };
    this.endpoint = `${(process.env.BREVO_API_BASE_URL || DEFAULT_API_BASE_URL).replace(/\/+$/, '')}/smtp/email`;
    this.timeoutMs = Number(process.env.BREVO_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS;
    this.sandbox = process.env.BREVO_SANDBOX === 'true';
  }

  async sendMail({ to, subject, text, html }) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);
    timeoutId.unref?.();

    const payload = {
      sender: this.sender,
      to: [{ email: to }],
      subject,
      ...(html ? { htmlContent: html } : { textContent: text || '' }),
      ...(this.sandbox ? { headers: { 'X-Sib-Sandbox': 'drop' } } : {}),
    };

    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'api-key': this.apiKey,
          'content-type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      const responseBody = await parseResponseBody(response);

      if (!response.ok) {
        const detail = responseBody.message || responseBody.code || `HTTP ${response.status}`;
        throw new Error(`Brevo send failed: ${detail}`);
      }

      return {
        provider: this.providerName,
        messageId: responseBody.messageId || '',
      };
    } catch (error) {
      if (error?.name === 'AbortError') {
        throw new Error(`Brevo send timeout after ${this.timeoutMs}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

export default BrevoEmailProvider;
