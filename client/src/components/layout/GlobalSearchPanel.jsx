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
      <header className="flex h-[64px] shrink-0 items-center gap-3 border-b border-outline-variant px-4 md:px-8">
        <button
          type="button"
          onClick={onBack}
          className="flex h-9 w-9 items-center justify-center rounded-[8px] hover:bg-surface-container-low"
          aria-label="Quay lại tin nhắn"
        >
          <AppIcon name="arrow_back" className="text-[22px]" />
        </button>
        <div>
          <h1 className="text-[18px] font-medium tracking-tight text-on-surface">Tìm kiếm toàn bộ</h1>
          <p className="mt-0.5 text-[13px] text-on-surface-variant">Tìm nội dung và tên tệp trong mọi cuộc trò chuyện</p>
        </div>
      </header>

      <div className="no-scrollbar flex-1 overflow-y-auto p-4 md:p-8">
        <div className="mx-auto max-w-3xl">
          <label className="relative block">
            <AppIcon
              name="search"
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-on-surface-variant"
            />
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="h-[40px] w-full rounded-full border border-outline-variant bg-surface-container-lowest pl-10 pr-4 text-[14px] outline-none focus:border-outline focus:ring-1 focus:ring-outline"
              placeholder="Nhập ít nhất 2 ký tự..."
            />
          </label>

          <div className="mt-5 border-t border-outline-variant">
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
                <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-container-low">
                  {result.senderAvatar ? (
                    <img src={result.senderAvatar} alt={result.senderName} className="h-full w-full object-cover" />
                  ) : (
                    <AppIcon name="chat_bubble" className="text-[16px]" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-medium text-on-surface-variant">
                    {getConversationName(result)} · <span className="font-semibold text-on-surface">{result.senderName}</span>
                  </span>
                  <span className="mt-0.5 block line-clamp-2 text-[14px] text-on-surface">
                    {result.content || result.attachment?.filename || result.attachments?.[0]?.filename}
                  </span>
                  <span className="mt-1 block text-[12px] text-on-surface-variant">
                    {new Date(result.createdAt).toLocaleString('vi-VN')}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default GlobalSearchPanel;
