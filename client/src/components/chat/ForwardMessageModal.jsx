import { useEffect, useMemo, useState } from 'react';
import AppIcon from '../ui/AppIcon';
import AppModal from '../ui/AppModal';

const getInitials = (name = '') =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('') || '?';

const getMessageAttachments = (message = {}) => {
  if (!message) return [];
  if (Array.isArray(message.attachments) && message.attachments.length > 0) return message.attachments;
  return message.attachment ? [message.attachment] : [];
};

const getForwardPreview = (message = {}) => {
  if (!message) return '';
  if (message.messageType === 'poll') return `Bình chọn: ${message.poll?.question || message.content || ''}`;
  if (message.messageType === 'event') return `Sự kiện: ${message.event?.title || message.content || ''}`;
  if (message.messageType === 'checklist') return `Checklist: ${message.checklist?.title || message.content || ''}`;
  if (message.messageType === 'sticker' || message.sticker?.url) {
    return message.sticker?.name ? `Nhãn dán: ${message.sticker.name}` : 'Nhãn dán';
  }
  if (message.content) return message.content;

  const attachments = getMessageAttachments(message);
  if (attachments.length === 1) return attachments[0].filename || 'Tệp đính kèm';
  if (attachments.length > 1 && attachments.every((item) => item.type === 'image')) return `${attachments.length} ảnh`;
  if (attachments.length > 1) return `${attachments.length} tệp đính kèm`;
  return 'Tin nhắn';
};

function ForwardMessageModal({
  open,
  onClose,
  message,
  conversations = [],
  currentConversationId = '',
  onForward,
}) {
  const [query, setQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setSelectedIds([]);
    setError('');
    setIsSubmitting(false);
  }, [message?.id, open]);

  const filteredConversations = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return conversations
      .filter((conversation) => conversation?.id)
      .filter((conversation) => {
        if (!normalizedQuery) return true;
        return `${conversation.name || ''} ${conversation.pingId || ''}`
          .toLowerCase()
          .includes(normalizedQuery);
      });
  }, [conversations, query]);

  const selectedCount = selectedIds.length;
  const preview = getForwardPreview(message);

  const toggleConversation = (conversationId) => {
    setError('');
    setSelectedIds((current) =>
      current.includes(conversationId)
        ? current.filter((id) => id !== conversationId)
        : [...current, conversationId],
    );
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (selectedIds.length === 0) {
      setError('Chọn ít nhất một cuộc trò chuyện');
      return;
    }

    try {
      setIsSubmitting(true);
      setError('');
      await onForward?.(selectedIds);
      onClose?.();
    } catch (forwardError) {
      setError(forwardError?.message || 'Không thể chuyển tiếp tin nhắn');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AppModal
      open={open}
      title="Chuyển tiếp"
      onClose={isSubmitting ? undefined : onClose}
      maxWidth="max-w-[500px]"
      footer={
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-on-surface-variant">
            {selectedCount > 0 ? `${selectedCount} đã chọn` : 'Chọn cuộc trò chuyện'}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="h-10 rounded-[8px] px-4 text-sm font-medium text-on-surface hover:bg-surface-container-low disabled:opacity-45"
            >
              Hủy
            </button>
            <button
              type="submit"
              form="forward-message-form"
              disabled={isSubmitting || selectedCount === 0}
              className="inline-flex h-10 items-center gap-2 rounded-[8px] bg-secondary px-4 text-sm font-semibold text-surface transition hover:opacity-90 disabled:opacity-45"
            >
              <AppIcon name="forward" className="text-[17px]" />
              {isSubmitting ? 'Đang gửi...' : 'Chuyển tiếp'}
            </button>
          </div>
        </div>
      }
    >
      <form id="forward-message-form" onSubmit={handleSubmit} className="space-y-4">
        <div className="rounded-[10px] border border-outline-variant bg-surface px-3 py-2.5">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-on-surface-variant">
            Tin nhắn
          </p>
          <p className="mt-1 line-clamp-3 text-sm leading-5 text-on-surface [overflow-wrap:anywhere]">
            {preview}
          </p>
        </div>

        <label className="relative block">
          <AppIcon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-[17px] text-on-surface-variant" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            disabled={isSubmitting}
            className="h-10 w-full rounded-[8px] border border-outline-variant bg-surface pl-9 pr-3 text-[15px] text-on-surface outline-none transition focus:border-outline focus:ring-1 focus:ring-outline disabled:opacity-60"
            placeholder="Tìm cuộc trò chuyện"
          />
        </label>

        <div className="max-h-[min(360px,44vh)] overflow-y-auto rounded-[10px] border border-outline-variant">
          {filteredConversations.length === 0 ? (
            <div className="px-3 py-8 text-center text-sm text-on-surface-variant">
              Không tìm thấy cuộc trò chuyện.
            </div>
          ) : (
            filteredConversations.map((conversation) => {
              const isSelected = selectedIds.includes(conversation.id);
              const isCurrent = conversation.id === currentConversationId;

              return (
                <button
                  key={conversation.id}
                  type="button"
                  onClick={() => toggleConversation(conversation.id)}
                  disabled={isSubmitting}
                  className={`flex w-full min-w-0 items-center gap-3 border-b border-outline-variant px-3 py-2.5 text-left transition last:border-b-0 disabled:opacity-60 ${
                    isSelected ? 'bg-secondary-container' : 'bg-surface hover:bg-surface-container-low'
                  }`}
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full border border-outline-variant bg-surface-container-low text-xs font-semibold text-on-surface">
                    {conversation.isSaved ? (
                      <AppIcon name="archive" className="text-[18px] text-secondary" />
                    ) : conversation.avatar ? (
                      <img src={conversation.avatar} alt="" className="h-full w-full object-cover" />
                    ) : (
                      getInitials(conversation.name)
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="truncate text-sm font-semibold text-on-surface">
                        {conversation.name || 'Cuộc trò chuyện'}
                      </span>
                      {isCurrent && (
                        <span className="shrink-0 rounded-full bg-surface-container-high px-2 py-0.5 text-[10px] font-medium text-on-surface-variant">
                          Đang mở
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-on-surface-variant">
                      {conversation.isGroup
                        ? 'Nhóm'
                        : conversation.isSaved
                          ? 'Tin nhắn đã lưu'
                          : conversation.pingId
                            ? `@${conversation.pingId}`
                            : 'Chat trực tiếp'}
                    </span>
                  </span>
                  <span
                    className={`grid h-5 w-5 shrink-0 place-items-center rounded-[6px] border ${
                      isSelected
                        ? 'border-secondary bg-secondary text-surface'
                        : 'border-outline-variant text-transparent'
                    }`}
                  >
                    <AppIcon name="check" className="text-[13px]" />
                  </span>
                </button>
              );
            })
          )}
        </div>

        {error && (
          <div className="rounded-[8px] border border-error/20 bg-error-container px-3 py-2 text-sm text-error">
            {error}
          </div>
        )}
      </form>
    </AppModal>
  );
}

export default ForwardMessageModal;
