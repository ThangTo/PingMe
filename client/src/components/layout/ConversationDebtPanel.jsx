import { useCallback, useEffect, useState } from 'react';
import api from '../../config/api';
import AppIcon from '../ui/AppIcon';
import { ListSkeleton } from '../ui/LoadingState';

const MobilePanelNav = ({ onNavigate, connectionRequestCount = 0 }) => (
  <nav className="grid h-[68px] shrink-0 grid-cols-4 border-t border-outline-variant bg-surface md:hidden">
    {[
      { key: 'messages', icon: 'chat_bubble', label: 'Tin nhắn', active: true },
      { key: 'contacts', icon: 'person', label: 'Kết nối', badge: connectionRequestCount },
      { key: 'groups', icon: 'groups', label: 'Nhóm' },
      { key: 'settings', icon: 'settings', label: 'Cài đặt' },
    ].map((item) => (
      <button
        key={item.key}
        type="button"
        onClick={() => onNavigate?.(item.key)}
        className={`relative flex flex-col items-center justify-center gap-1 text-[10px] ${
          item.active ? 'text-secondary' : 'text-on-surface-variant'
        }`}
      >
        {item.active && <span className="absolute top-0 h-0.5 w-8 rounded-full bg-secondary" />}
        <span className="relative grid h-6 w-6 place-items-center">
          <AppIcon name={item.icon} className="text-[21px]" />
          {item.badge > 0 && (
            <span className="absolute -right-2 -top-1 grid h-[17px] min-w-[17px] place-items-center rounded-full bg-error px-1 text-[9px] font-semibold text-white ring-2 ring-surface">
              {item.badge > 99 ? '99+' : item.badge}
            </span>
          )}
        </span>
        <span>{item.label}</span>
      </button>
    ))}
  </nav>
);

const INTENT_CONFIG = {
  question: { label: 'Câu hỏi', icon: 'help', color: 'text-secondary', bg: 'bg-secondary/10' },
  promise: { label: 'Lời hứa', icon: 'task_alt', color: 'text-accent', bg: 'bg-accent/10' },
  intent: { label: 'Cần trả lời', icon: 'reply', color: 'text-warning', bg: 'bg-warning/10' },
};

const formatTime = (value) =>
  value
    ? new Date(value).toLocaleString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

const ConversationDebtPanel = ({ onBack, onJumpToMessage, onNavigate, connectionRequestCount = 0 }) => {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchDebt = useCallback(async () => {
    try {
      setError('');
      const response = await api.get('/conversations/debt');
      const data = response.data.data || { items: [], total: 0 };
      setItems(data.items || []);
      setTotal(data.total || 0);
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Không thể tải danh sách nợ phản hồi.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDebt();
  }, [fetchDebt]);

  const handleJump = (conversationId, messageId) => {
    onJumpToMessage?.({ conversationId, messageId });
    onBack?.();
  };

  return (
    <section className="flex min-w-0 flex-1 flex-col bg-surface">
      <header className="flex h-[64px] shrink-0 items-center gap-3 border-b border-outline-variant px-4 md:px-7">
        <button
          type="button"
          onClick={onBack}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-[8px] text-on-surface-variant hover:bg-surface-container-low md:hidden"
          aria-label="Quay lại"
        >
          <AppIcon name="arrow_back" className="text-[21px]" />
        </button>
        <h1 className="text-[19px] font-semibold text-on-surface md:text-[22px]">Nợ phản hồi</h1>
        {total > 0 && (
          <span className="grid h-5 min-w-5 place-items-center rounded-full bg-error px-1.5 text-[10px] font-semibold text-white">
            {total}
          </span>
        )}
      </header>

      <div className="no-scrollbar flex-1 overflow-y-auto">
        <div className="mx-auto grid min-h-full max-w-[1040px] md:grid-cols-[minmax(0,1fr)_280px]">
          <main className="min-w-0 border-outline-variant px-4 py-5 md:border-r md:px-7 md:py-7">
            {isLoading && <ListSkeleton rows={5} className="py-5" />}

            {error && (
              <div className="mt-4 flex items-center gap-3 border-y border-error/20 bg-error-container px-4 py-4 text-[12px] text-error">
                <AppIcon name="sync_problem" className="text-[18px]" />
                {error}
              </div>
            )}

            {!isLoading && !error && items.length === 0 && (
              <div className="border-b border-outline-variant px-6 py-14 text-center">
                <span className="mx-auto grid h-14 w-14 place-items-center rounded-full border border-outline bg-surface-container-low">
                  <AppIcon name="mark_chat_unread" className="text-[24px] text-on-surface-variant" />
                </span>
                <p className="mt-4 text-[13px] font-medium text-on-surface">Không có tin nào đang chờ phản hồi</p>
                <p className="mt-1 text-[11px] text-on-surface-variant">
                  Tin nhắn cần trả lời sẽ xuất hiện tại đây sau 4 giờ
                </p>
              </div>
            )}

            {!isLoading && !error && items.length > 0 && (
              <section>
                {items.map((item) => {
                  const badgeConfig = INTENT_CONFIG[item.detection] || INTENT_CONFIG.intent;
                  return (
                    <div
                      key={item._id}
                      className="group flex items-start gap-3 border-b border-outline-variant px-2 py-3.5 transition-colors hover:bg-surface-container-low"
                    >
                      <span className="relative grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full border border-outline-variant bg-surface-container-high text-on-surface">
                        {item.senderAvatar ? (
                          <img src={item.senderAvatar} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <AppIcon name="person" className="text-[18px]" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-start gap-2">
                          <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-on-surface">
                            {item.senderName}
                          </span>
                          <span className="shrink-0 text-[10px] text-on-surface-variant">
                            {formatTime(item.createdAt)}
                          </span>
                        </span>
                        <span className="mt-0.5 block text-[11px] text-on-surface-variant">
                          {item.conversationType === 'direct' ? '' : `${item.conversationName} · `}
                          {item.waitingHours >= 24
                            ? `${Math.floor(item.waitingHours / 24)} ngày chưa rep`
                            : `${item.waitingHours} giờ chưa rep`}
                        </span>
                        {item.content && (
                          <span className="mt-1 block line-clamp-2 text-[12px] leading-5 text-on-surface">
                            {item.content.length > 80
                              ? `${item.content.slice(0, 80)}...`
                              : item.content}
                          </span>
                        )}
                        <span className="mt-2 flex items-center gap-2">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${badgeConfig.color} ${badgeConfig.bg}`}
                          >
                            <AppIcon name={badgeConfig.icon} className="text-[11px]" />
                            {badgeConfig.label}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleJump(item.conversationId, item._id)}
                            className="ml-auto rounded-[6px] border border-outline-variant px-2.5 py-1 text-[10px] font-medium text-secondary opacity-0 transition-opacity hover:bg-secondary/5 group-hover:opacity-100"
                          >
                            Đến tin nhắn
                          </button>
                        </span>
                      </span>
                    </div>
                  );
                })}
              </section>
            )}
          </main>

          <aside className="hidden px-6 py-7 md:block">
            <span className="grid h-12 w-12 place-items-center rounded-full border border-outline bg-surface-container-low text-secondary">
              <AppIcon name="reply" className="text-[21px]" />
            </span>
            <h2 className="mt-5 text-[16px] font-semibold text-on-surface">Những tin chưa trả lời</h2>
            <p className="mt-2 text-[11px] leading-5 text-on-surface-variant">
              Tin nhắn có câu hỏi, lời hứa hoặc gắn nhãn "Cần trả lời" mà bạn chưa phản hồi sau 4 giờ.
            </p>
            <div className="mt-7 border-t border-outline-variant pt-5">
              <div className="flex items-center justify-between py-2 text-[11px]">
                <span className="text-on-surface-variant">Đang chờ</span>
                <span className="font-semibold text-on-surface">{total}</span>
              </div>
            </div>
          </aside>
        </div>
      </div>

      <MobilePanelNav onNavigate={onNavigate} connectionRequestCount={connectionRequestCount} />
    </section>
  );
};

export default ConversationDebtPanel;
