import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../../config/api';
import socket from '../../socket';
import AppIcon from '../ui/AppIcon';

const getIdString = (value) => value?._id?.toString?.() || value?.id?.toString?.() || value?.toString?.() || '';

const normalizeSourceMessage = (sourceMessage) => {
  const messageId = getIdString(sourceMessage?.messageId || sourceMessage?.message || sourceMessage?._id);
  if (!messageId) return null;
  return {
    messageId,
    senderName: sourceMessage.senderName || sourceMessage.sender?.username || '',
    content: sourceMessage.content || '',
  };
};

const normalizeDecision = (decision) => {
  const id = getIdString(decision?.id || decision?._id);
  if (!id) return null;
  return {
    id,
    conversationId: getIdString(decision.conversationId || decision.conversation),
    createdById: getIdString(decision.createdById || decision.createdBy),
    createdByName: decision.createdByName || decision.createdBy?.username || '',
    decidedById: getIdString(decision.decidedById || decision.decidedBy),
    decidedByName: decision.decidedByName || decision.decidedBy?.username || '',
    title: decision.title || '',
    note: decision.note || '',
    decidedAt: decision.decidedAt || decision.createdAt || null,
    sourceMessage: normalizeSourceMessage(decision.sourceMessage),
    status: decision.status || 'active',
    updatedAt: decision.updatedAt || null,
  };
};

const formatDateTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

function DecisionTimeline({ conversation, currentUserId, onJumpToMessage }) {
  const [status, setStatus] = useState('active');
  const [decisions, setDecisions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const conversationId = conversation?.id || '';
  const isSaved = Boolean(conversation?.isSaved);
  const currentMember = useMemo(
    () => conversation?.members?.find((member) => member.id === currentUserId) || null,
    [conversation?.members, currentUserId],
  );
  const canModerate = ['owner', 'admin'].includes(currentMember?.role);

  const loadDecisions = useCallback(async () => {
    if (!conversationId || isSaved) return;
    try {
      setIsLoading(true);
      setError('');
      const response = await api.get(`/conversations/${conversationId}/decisions`, {
        params: { status },
      });
      setDecisions(
        (response.data?.decisions || []).map(normalizeDecision).filter(Boolean),
      );
    } catch (loadError) {
      setError(loadError.response?.data?.error || 'Không thể tải quyết định');
    } finally {
      setIsLoading(false);
    }
  }, [conversationId, isSaved, status]);

  useEffect(() => {
    setStatus('active');
    setDecisions([]);
  }, [conversationId]);

  useEffect(() => {
    void loadDecisions();
  }, [loadDecisions]);

  useEffect(() => {
    if (!conversationId || isSaved) return undefined;

    const upsertDecision = (payload) => {
      const payloadConversationId = getIdString(payload?.conversationId);
      if (payloadConversationId !== conversationId) return;
      const nextDecision = normalizeDecision(payload?.decision);
      if (!nextDecision) {
        void loadDecisions();
        return;
      }

      setDecisions((current) => {
        const shouldShow = status === 'all' || nextDecision.status === status;
        const without = current.filter((decision) => decision.id !== nextDecision.id);
        const next = shouldShow ? [nextDecision, ...without] : without;
        return next.sort(
          (a, b) => new Date(b.decidedAt || 0) - new Date(a.decidedAt || 0),
        );
      });
    };

    socket.on('decision_created', upsertDecision);
    socket.on('decision_updated', upsertDecision);
    return () => {
      socket.off('decision_created', upsertDecision);
      socket.off('decision_updated', upsertDecision);
    };
  }, [conversationId, isSaved, loadDecisions, status]);

  const handleRevert = async (decision) => {
    if (!decision?.id) return;
    try {
      setError('');
      const response = await api.patch(
        `/conversations/${conversationId}/decisions/${decision.id}/revert`,
      );
      const nextDecision = normalizeDecision(response.data?.decision);
      if (nextDecision) {
        setDecisions((current) =>
          current
            .filter((item) => item.id !== nextDecision.id)
            .filter((item) => status === 'all' || item.status === status),
        );
      }
    } catch (revertError) {
      setError(revertError.response?.data?.error || 'Không thể hoàn tác quyết định');
    }
  };

  if (isSaved) {
    return (
      <div className="py-12 text-center text-sm text-on-surface-variant">
        Decision Timeline chưa áp dụng cho Tin nhắn đã lưu.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-1 rounded-[8px] bg-surface-container-low p-1">
        {[
          { value: 'active', label: 'Đang dùng' },
          { value: 'reverted', label: 'Đã hoàn tác' },
          { value: 'all', label: 'Tất cả' },
        ].map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setStatus(option.value)}
            className={`min-h-9 rounded-[7px] px-2 text-xs font-semibold transition-colors ${
              status === option.value
                ? 'bg-surface-container-lowest text-on-surface shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {isLoading && decisions.length === 0 && (
        <div className="flex min-h-32 items-center justify-center gap-2 text-sm text-on-surface-variant">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-outline border-t-secondary" />
          <span>Đang tải quyết định...</span>
        </div>
      )}

      {error && (
        <div className="rounded-[8px] border border-error/20 bg-error-container px-3 py-2 text-sm text-error">
          {error}
        </div>
      )}

      {!isLoading && decisions.length === 0 && !error && (
        <div className="py-12 text-center">
          <span className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-surface-container-high text-on-surface-variant">
            <AppIcon name="decision" className="text-[21px]" />
          </span>
          <p className="mx-auto mt-3 max-w-[280px] text-sm leading-6 text-on-surface-variant">
            Chưa có quyết định nào được đánh dấu.
          </p>
        </div>
      )}

      <div className="space-y-3">
        {decisions.map((decision) => {
          const canRevert =
            decision.status === 'active' &&
            (decision.createdById === currentUserId || canModerate);

          return (
            <article
              key={decision.id}
              className="rounded-[12px] border border-outline-variant bg-surface px-3.5 py-3"
            >
              <div className="flex items-start gap-3">
                <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-[9px] bg-secondary-container text-secondary">
                  <AppIcon name="decision" className="text-[17px]" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-2">
                    <h4 className="min-w-0 flex-1 break-words text-sm font-semibold text-on-surface">
                      {decision.title}
                    </h4>
                    <span className="shrink-0 rounded-full bg-surface-container-low px-2 py-0.5 text-[11px] text-on-surface-variant">
                      {decision.status === 'reverted' ? 'Đã hoàn tác' : 'Đang dùng'}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-on-surface-variant">
                    {decision.decidedByName ? `${decision.decidedByName} quyết định · ` : ''}
                    {formatDateTime(decision.decidedAt)}
                  </p>
                  {decision.note && (
                    <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-on-surface-variant">
                      {decision.note}
                    </p>
                  )}
                </div>
              </div>

              {decision.sourceMessage?.messageId && (
                <button
                  type="button"
                  onClick={() => onJumpToMessage?.(decision.sourceMessage.messageId)}
                  className="mt-3 flex w-full min-w-0 items-start gap-2 rounded-[9px] border border-outline-variant bg-surface-container-lowest px-2.5 py-2 text-left text-xs text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface"
                >
                  <AppIcon name="reply" className="mt-0.5 shrink-0 text-[14px]" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-on-surface">
                      Từ tin nhắn của {decision.sourceMessage.senderName || 'người dùng'}
                    </span>
                    <span className="line-clamp-2 break-words">
                      {decision.sourceMessage.content || 'Tin nhắn nguồn'}
                    </span>
                  </span>
                </button>
              )}

              {canRevert && (
                <button
                  type="button"
                  onClick={() => handleRevert(decision)}
                  className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-[8px] px-2 text-xs font-medium text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface"
                >
                  <AppIcon name="refresh" className="text-[14px]" />
                  Hoàn tác
                </button>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}

export default DecisionTimeline;
