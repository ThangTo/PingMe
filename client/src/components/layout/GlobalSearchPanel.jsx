import { useEffect, useState } from 'react';
import api from '../../config/api';
import AppIcon from '../ui/AppIcon';

const GlobalSearchPanel = ({ conversations = [], onBack, onOpenResult }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const normalizedQuery = query.trim();
    if (normalizedQuery.length < 2) {
      setResults([]);
      setError('');
      return undefined;
    }

    const timeout = setTimeout(async () => {
      try {
        setIsLoading(true);
        setError('');
        const response = await api.get('/search/messages', { params: { q: normalizedQuery } });
        setResults(response.data.results || []);
      } catch (requestError) {
        setError(requestError.response?.data?.error || 'Không thể tìm kiếm tin nhắn.');
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [query]);

  const getConversationName = (result) =>
    result.conversationName ||
    conversations.find((conversation) => conversation.id === result.conversationId)?.name ||
    'Cuộc trò chuyện';

  return (
    <section className="flex min-w-0 flex-1 flex-col bg-surface">
      <header className="flex h-[72px] shrink-0 items-center gap-3 border-b border-outline-variant px-4 md:px-8">
        <button
          type="button"
          onClick={onBack}
          className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-surface-container-low"
          aria-label="Quay lại tin nhắn"
        >
          <AppIcon name="arrow_back" className="text-[22px]" />
        </button>
        <div>
          <h1 className="text-xl font-semibold text-on-surface">Tìm kiếm toàn bộ</h1>
          <p className="mt-0.5 text-sm text-on-surface-variant">Tìm nội dung và tên tệp trong mọi cuộc trò chuyện</p>
        </div>
      </header>

      <div className="no-scrollbar flex-1 overflow-y-auto p-4 md:p-8">
        <div className="mx-auto max-w-3xl">
          <label className="relative block">
            <AppIcon
              name="search"
              className="absolute left-4 top-1/2 -translate-y-1/2 text-[20px] text-on-surface-variant"
            />
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="h-12 w-full rounded-lg border border-outline-variant bg-surface-container-lowest pl-12 pr-4 text-sm outline-none focus:border-accent"
              placeholder="Nhập ít nhất 2 ký tự..."
            />
          </label>

          <div className="mt-5 overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest">
            {isLoading && <p className="p-6 text-sm text-on-surface-variant">Đang tìm kiếm...</p>}
            {error && <p className="p-6 text-sm text-error">{error}</p>}
            {!isLoading && !error && query.trim().length >= 2 && results.length === 0 && (
              <p className="p-8 text-center text-sm text-on-surface-variant">Không tìm thấy kết quả phù hợp.</p>
            )}
            {!isLoading && query.trim().length < 2 && (
              <p className="p-8 text-center text-sm text-on-surface-variant">Kết quả sẽ xuất hiện tại đây.</p>
            )}
            {results.map((result) => (
              <button
                key={result.id}
                type="button"
                onClick={() => onOpenResult?.(result)}
                className="flex w-full items-start gap-3 border-b border-outline-variant p-4 text-left last:border-b-0 hover:bg-surface-container-low"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-container">
                  {result.senderAvatar ? (
                    <img src={result.senderAvatar} alt={result.senderName} className="h-full w-full object-cover" />
                  ) : (
                    <AppIcon name="chat_bubble" className="text-[19px]" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-medium text-on-surface-variant">
                    {getConversationName(result)} · {result.senderName}
                  </span>
                  <span className="mt-1 block line-clamp-2 text-sm text-on-surface">
                    {result.content || result.attachment?.filename || result.attachments?.[0]?.filename}
                  </span>
                  <span className="mt-2 block text-xs text-on-surface-variant">
                    {new Date(result.createdAt).toLocaleString('vi-VN')}
                  </span>
                </span>
                <AppIcon name="chevron_right" className="mt-2 text-[18px] text-on-surface-variant" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default GlobalSearchPanel;
