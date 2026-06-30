import OpenAiProvider from './providers/OpenAiProvider.js';
import RequestyProvider from './providers/RequestyProvider.js';
import ZenMuxProvider from './providers/ZenMuxProvider.js';

/* istanbul ignore next */
class NullAiProvider {
  isConfigured() { return false; }
  async complete() {
    throw Object.assign(new Error('AI chưa được cấu hình'), { statusCode: 503 });
  }
}

// Map AI_PROVIDER -> adapter. Thêm provider mới = thêm 1 dòng ở đây (OCP).
const PROVIDER_REGISTRY = {
  openai: OpenAiProvider,
  requesty: RequestyProvider,
  zenmux: ZenMuxProvider,
};

let cachedProvider = null;

/**
 * Chọn provider theo biến môi trường AI_PROVIDER.
 * @returns {AiProvider} — Singleton; nếu không khớp thì trả NullAiProvider fail-soft.
 */
const getAiProvider = () => {
  if (cachedProvider) return cachedProvider;

  const providerName = (process.env.AI_PROVIDER || '').toLowerCase();
  const ProviderClass = PROVIDER_REGISTRY[providerName];

  cachedProvider = ProviderClass ? new ProviderClass() : new NullAiProvider();

  return cachedProvider;
};

/** Reset cache (cho test). */
export const resetProviderCache = () => {
  cachedProvider = null;
};

export default getAiProvider;
