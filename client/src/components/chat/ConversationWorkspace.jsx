import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import api from '../../config/api';
import socket from '../../socket';
import AppIcon from '../ui/AppIcon';
import ChecklistMessageCard from './ChecklistMessageCard';
import EventMessageCard from './EventMessageCard';
import PollMessageCard from './PollMessageCard';

const STATUS_OPTIONS = [
  { value: 'active', label: 'Đang hoạt động' },
  { value: 'archived', label: 'Đã hoàn thành' },
];

const TYPE_OPTIONS = [
  { value: 'all', label: 'Tất cả' },
  { value: 'poll', label: 'Bình chọn' },
  { value: 'event', label: 'Sự kiện' },
  { value: 'checklist', label: 'Checklist' },
];

const SECTION_META = {
  poll: { label: 'Bình chọn', icon: 'poll' },
  event: { label: 'Sự kiện', icon: 'event' },
  checklist: { label: 'Checklist', icon: 'checklist' },
};

const workspaceCacheStore = new Map();

const makeCacheKey = (conversationId, status, type) => `${conversationId}:${status}:${type}`;
const getIdString = (value) => value?._id?.toString?.() || value?.id?.toString?.() || value?.toString?.() || '';

const formatCreatedAt = (value) => {
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

const getWorkspaceStatus = (item, now = Date.now()) => {
  if (item.type === 'poll') {
    const closesAt = item.poll?.closesAt ? new Date(item.poll.closesAt).getTime() : 0;
    return closesAt > 0 && closesAt <= now ? 'archived' : 'active';
  }

  if (item.type === 'checklist') {
    const items = Array.isArray(item.checklist?.items) ? item.checklist.items : [];
    return items.length > 0 && items.every((checklistItem) => checklistItem.isDone)
      ? 'archived'
      : 'active';
  }

  const startsAt = item.event?.startsAt ? new Date(item.event.startsAt).getTime() : 0;
  return item.event?.status === 'cancelled' || (startsAt > 0 && startsAt <= now)
    ? 'archived'
    : 'active';
};

const normalizePoll = (poll) => {
  if (!poll?.question) return null;
  const options = (poll.options || []).map((option) => {
    const voterIds = (option.voterIds || []).map(String);
    return {
      ...option,
      voterIds,
      voteCount: Number.isFinite(option.voteCount) ? option.voteCount : voterIds.length,
    };
  });

  return {
    ...poll,
    options,
    totalVotes: Number.isFinite(poll.totalVotes)
      ? poll.totalVotes
      : options.reduce((total, option) => total + option.voteCount, 0),
  };
};

const normalizeChecklist = (checklist) => {
  if (!checklist?.title) return null;
  const items = Array.isArray(checklist.items) ? checklist.items : [];
  const completedItems = items.filter((item) => item.isDone).length;

  return {
    ...checklist,
    items,
    totalItems: Number.isFinite(checklist.totalItems) ? checklist.totalItems : items.length,
    completedItems: Number.isFinite(checklist.completedItems)
      ? checklist.completedItems
      : completedItems,
    isComplete: items.length > 0 && completedItems === items.length,
  };
};

const normalizeEvent = (event) => {
  if (!event?.title) return null;
  const eventId = event.id || event.eventId || '';
  return {
    ...event,
    id: eventId,
    eventId,
    rsvps: Array.isArray(event.rsvps) ? event.rsvps : [],
    isCancelled: event.status === 'cancelled' || Boolean(event.isCancelled),
    isPast: event.startsAt ? new Date(event.startsAt).getTime() <= Date.now() : false,
  };
};

function ConversationWorkspace({
  conversation,
  currentUserId,
  reactionUsersById = {},
  onPollVote,
  onEventRsvp,
  onCancelEvent,
  onChecklistToggle,
  onJumpToMessage,
}) {
  const [status, setStatus] = useState('active');
  const [type, setType] = useState('all');
  const [, setRevision] = useState(0);
  const cacheRef = useRef(new Map(workspaceCacheStore));
  const refreshTimerRef = useRef(null);
  const mountedRef = useRef(true);
  const conversationId = conversation?.id || '';
  const isGroup = Boolean(conversation?.isGroup);
  const isSaved = Boolean(conversation?.isSaved);
  const cacheKey = makeCacheKey(conversationId, status, type);
  const currentEntry = cacheRef.current.get(cacheKey) || null;
  const availableTypes = isGroup
    ? TYPE_OPTIONS
    : TYPE_OPTIONS.filter((option) => ['all', 'event'].includes(option.value));
  const canInteract = !isSaved && (!isGroup || conversation?.members?.some((member) => member.id === currentUserId));

  const commitCacheEntry = useCallback((key, updater) => {
    const previous = cacheRef.current.get(key);
    const next = typeof updater === 'function' ? updater(previous) : updater;
    cacheRef.current.set(key, next);
    workspaceCacheStore.set(key, next);
    if (mountedRef.current) setRevision((value) => value + 1);
  }, []);

  const loadWorkspace = useCallback(
    async ({ append = false, force = false } = {}) => {
      if (!conversationId) return;

      const key = makeCacheKey(conversationId, status, type);
      const previous = cacheRef.current.get(key);
      if (isSaved) {
        commitCacheEntry(key, {
          conversationId,
          status,
          type,
          items: [],
          pagination: { hasMore: false, nextCursor: null, limit: 30 },
          loaded: true,
          loading: false,
          error: '',
          fetchedAt: Date.now(),
        });
        return;
      }
      if (previous?.loading) return;
      if (!append && !force && previous?.loaded && Date.now() - previous.fetchedAt < 15_000) return;

      commitCacheEntry(key, {
        conversationId,
        status,
        type,
        items: previous?.items || [],
        pagination: previous?.pagination || { hasMore: false, nextCursor: null, limit: 30 },
        loaded: Boolean(previous?.loaded),
        loading: true,
        error: '',
        fetchedAt: previous?.fetchedAt || 0,
      });

      try {
        const response = await api.get(`/conversations/${conversationId}/workspace`, {
          params: {
            status,
            type,
            limit: 30,
            ...(append && previous?.pagination?.nextCursor
              ? { cursor: previous.pagination.nextCursor }
              : {}),
          },
        });
        const nextItems = Array.isArray(response.data?.items) ? response.data.items : [];

        commitCacheEntry(key, (latest) => {
          const merged = new Map();
          [...(append ? latest?.items || [] : []), ...nextItems].forEach((item) => {
            if (item?.id) merged.set(item.id, item);
          });

          return {
            conversationId,
            status,
            type,
            items: [...merged.values()],
            pagination: response.data?.pagination || {
              hasMore: false,
              nextCursor: null,
              limit: 30,
            },
            loaded: true,
            loading: false,
            error: '',
            fetchedAt: Date.now(),
          };
        });
      } catch (error) {
        commitCacheEntry(key, (latest) => ({
          conversationId,
          status,
          type,
          items: latest?.items || [],
          pagination: latest?.pagination || { hasMore: false, nextCursor: null, limit: 30 },
          loaded: Boolean(latest?.loaded),
          loading: false,
          error: error.response?.data?.error || 'Không thể tải kế hoạch.',
          fetchedAt: latest?.fetchedAt || 0,
        }));
      }
    },
    [commitCacheEntry, conversationId, isSaved, status, type],
  );

  const scheduleRefresh = useCallback(() => {
    window.clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = window.setTimeout(() => {
      void loadWorkspace({ force: true });
    }, 120);
  }, [loadWorkspace]);

  const patchWorkspaceItem = useCallback(
    (messageId, updater) => {
      let sourceItem = null;
      cacheRef.current.forEach((entry) => {
        if (entry?.conversationId !== conversationId || sourceItem) return;
        sourceItem = entry.items?.find((item) => item.messageId === messageId) || null;
      });
      if (!sourceItem) return false;

      const nextItem = updater(sourceItem);
      if (!nextItem) return false;
      nextItem.status = getWorkspaceStatus(nextItem);

      cacheRef.current.forEach((entry, key) => {
        if (entry?.conversationId !== conversationId) return;
        const matchesStatus = entry.status === nextItem.status;
        const matchesType = entry.type === 'all' || entry.type === nextItem.type;
        const itemsById = new Map((entry.items || []).map((item) => [item.id, item]));

        if (matchesStatus && matchesType) itemsById.set(nextItem.id, nextItem);
        else itemsById.delete(nextItem.id);

        commitCacheEntry(key, {
          ...entry,
          items: [...itemsById.values()].sort(
            (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0),
          ),
        });
      });

      return true;
    },
    [commitCacheEntry, conversationId],
  );

  const removeWorkspaceItem = useCallback(
    (messageId) => {
      cacheRef.current.forEach((entry, key) => {
        if (entry?.conversationId !== conversationId) return;
        const items = (entry.items || []).filter((item) => item.messageId !== messageId);
        if (items.length !== entry.items?.length) commitCacheEntry(key, { ...entry, items });
      });
    },
    [commitCacheEntry, conversationId],
  );

  useEffect(() => {
    setStatus('active');
    setType('all');
  }, [conversationId]);

  useEffect(() => {
    if (!availableTypes.some((option) => option.value === type)) setType('all');
  }, [availableTypes, type]);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  useEffect(() => {
    if (!conversationId || isSaved) return undefined;

    const handleMessageCreated = (payload) => {
      const payloadConversationId = getIdString(payload?.conversationId || payload?.conversation);
      const messageType =
        payload?.messageType ||
        (payload?.poll ? 'poll' : payload?.event ? 'event' : payload?.checklist ? 'checklist' : '');
      if (
        payloadConversationId === conversationId &&
        ['poll', 'event', 'checklist'].includes(messageType)
      ) {
        scheduleRefresh();
      }
    };
    const handlePollUpdated = (payload) => {
      if (getIdString(payload?.conversationId) !== conversationId) return;
      if (!payload?.messageId || !payload?.poll) {
        scheduleRefresh();
        return;
      }
      const patched = patchWorkspaceItem(payload.messageId, (item) => ({
        ...item,
        poll: normalizePoll(payload.poll) || item.poll,
        updatedAt: new Date().toISOString(),
      }));
      if (!patched) scheduleRefresh();
    };
    const handleChecklistUpdated = (payload) => {
      if (getIdString(payload?.conversationId) !== conversationId) return;
      if (!payload?.messageId || !payload?.checklist) {
        scheduleRefresh();
        return;
      }
      const patched = patchWorkspaceItem(payload.messageId, (item) => ({
        ...item,
        checklist: normalizeChecklist(payload.checklist) || item.checklist,
        updatedAt: payload.updatedAt || new Date().toISOString(),
      }));
      if (!patched) scheduleRefresh();
    };
    const handleEventUpdated = (payload) => {
      const nextEvent = normalizeEvent(payload?.event);
      const eventConversationId = getIdString(payload?.event?.conversationId || payload?.event?.conversation);
      if (eventConversationId !== conversationId) return;
      if (!nextEvent) {
        scheduleRefresh();
        return;
      }
      const patched = nextEvent.messageId
        ? patchWorkspaceItem(nextEvent.messageId, (item) => ({
            ...item,
            event: { ...item.event, ...nextEvent },
            title: nextEvent.title || item.title,
            updatedAt: nextEvent.updatedAt || new Date().toISOString(),
          }))
        : false;
      if (!patched) scheduleRefresh();
    };
    const handleMessageDeleted = (payload) => {
      if (getIdString(payload?.conversationId) !== conversationId) return;
      if (!payload?.messageId) {
        scheduleRefresh();
        return;
      }
      removeWorkspaceItem(payload.messageId);
    };

    socket.on('receive_message', handleMessageCreated);
    socket.on('message_sent', handleMessageCreated);
    socket.on('poll_vote_updated', handlePollUpdated);
    socket.on('checklist_updated', handleChecklistUpdated);
    socket.on('event_created', handleEventUpdated);
    socket.on('event_rsvp_updated', handleEventUpdated);
    socket.on('event_cancelled', handleEventUpdated);
    socket.on('message_deleted', handleMessageDeleted);

    return () => {
      socket.off('receive_message', handleMessageCreated);
      socket.off('message_sent', handleMessageCreated);
      socket.off('poll_vote_updated', handlePollUpdated);
      socket.off('checklist_updated', handleChecklistUpdated);
      socket.off('event_created', handleEventUpdated);
      socket.off('event_rsvp_updated', handleEventUpdated);
      socket.off('event_cancelled', handleEventUpdated);
      socket.off('message_deleted', handleMessageDeleted);
    };
  }, [conversationId, isSaved, patchWorkspaceItem, removeWorkspaceItem, scheduleRefresh]);

  useEffect(() => {
    if (!conversationId || isSaved) return undefined;
    const intervalId = window.setInterval(() => {
      const entry = cacheRef.current.get(makeCacheKey(conversationId, status, type));
      if (entry?.items?.some((item) => item.status !== getWorkspaceStatus(item))) {
        void loadWorkspace({ force: true });
      }
    }, 30 * 1000);

    return () => window.clearInterval(intervalId);
  }, [conversationId, isSaved, loadWorkspace, status, type]);

  useEffect(
    () => () => {
      mountedRef.current = false;
      window.clearTimeout(refreshTimerRef.current);
    },
    [],
  );

  const groupedItems = useMemo(() => {
    const groups = { poll: [], event: [], checklist: [] };
    (currentEntry?.items || []).forEach((item) => {
      if (groups[item.type]) groups[item.type].push(item);
    });
    return groups;
  }, [currentEntry?.items]);

  const renderWorkspaceItem = (item) => (
    <article key={item.id} className="min-w-0">
      <div className="mb-2 flex min-w-0 items-center gap-2 px-0.5 text-[11px] text-on-surface-variant">
        <span className="truncate font-medium text-on-surface">{item.senderName || 'Người dùng'}</span>
        <span aria-hidden="true">·</span>
        <span className="shrink-0">{formatCreatedAt(item.createdAt)}</span>
      </div>

      {item.type === 'poll' && (
        <PollMessageCard
          poll={item.poll}
          messageId={item.messageId}
          currentUserId={currentUserId}
          reactionUsersById={reactionUsersById}
          disabled={!canInteract}
          onVote={onPollVote}
          variant="workspace"
        />
      )}
      {item.type === 'event' && (
        <EventMessageCard
          event={item.event}
          currentUserId={currentUserId}
          reactionUsersById={reactionUsersById}
          disabled={!canInteract}
          onRsvp={onEventRsvp}
          onCancel={onCancelEvent}
          variant="workspace"
        />
      )}
      {item.type === 'checklist' && (
        <ChecklistMessageCard
          checklist={item.checklist}
          messageId={item.messageId}
          currentUserId={currentUserId}
          reactionUsersById={reactionUsersById}
          disabled={!canInteract}
          onToggle={onChecklistToggle}
          variant="workspace"
        />
      )}

      <button
        type="button"
        onClick={() => onJumpToMessage?.(item.messageId)}
        className="mt-2 inline-flex h-8 items-center gap-1.5 rounded-[8px] px-2 text-xs font-medium text-secondary transition-colors hover:bg-secondary-container"
      >
        <AppIcon name="chat_bubble" className="text-[15px]" />
        <span>Xem trong chat</span>
        <AppIcon name="chevron_right" className="text-[14px]" />
      </button>
    </article>
  );

  const items = currentEntry?.items || [];
  const showInitialLoading = currentEntry?.loading && items.length === 0;
  const emptyText = isSaved
    ? 'Workspace chưa áp dụng cho Tin nhắn đã lưu.'
    : isGroup
      ? 'Chưa có kế hoạch nào. Hãy tạo Bình chọn, Sự kiện hoặc Checklist từ ô soạn tin.'
      : 'Cuộc trò chuyện này chưa có sự kiện nào.';

  return (
    <div className="px-5 py-5 md:px-6">
      {!isSaved && (
        <div className="mb-5 space-y-3">
          <div className="grid grid-cols-2 gap-1 rounded-[8px] bg-surface-container-low p-1">
            {STATUS_OPTIONS.map((option) => (
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

          <div className="no-scrollbar flex gap-1.5 overflow-x-auto pb-1">
            {availableTypes.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setType(option.value)}
                className={`h-8 shrink-0 rounded-[8px] border px-3 text-xs font-medium transition-colors ${
                  type === option.value
                    ? 'border-secondary/35 bg-secondary-container text-on-surface'
                    : 'border-outline-variant bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-low'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {showInitialLoading && (
        <div className="flex min-h-40 items-center justify-center gap-2 text-sm text-on-surface-variant">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-outline border-t-secondary" />
          <span>Đang tải kế hoạch...</span>
        </div>
      )}

      {!showInitialLoading && currentEntry?.error && items.length === 0 && (
        <div className="py-12 text-center">
          <p className="text-sm text-error">{currentEntry.error}</p>
          <button
            type="button"
            onClick={() => loadWorkspace({ force: true })}
            className="mt-3 h-9 rounded-[8px] border border-outline-variant px-3 text-sm font-medium text-on-surface transition-colors hover:bg-surface-container-low"
          >
            Thử lại
          </button>
        </div>
      )}

      {!showInitialLoading && !currentEntry?.error && items.length === 0 && (
        <div className="py-12 text-center">
          <span className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-surface-container-high text-on-surface-variant">
            <AppIcon name="checklist" className="text-[21px]" />
          </span>
          <p className="mx-auto mt-3 max-w-[280px] text-sm leading-6 text-on-surface-variant">
            {emptyText}
          </p>
        </div>
      )}

      {items.length > 0 && type === 'all' && (
        <div className="space-y-7">
          {Object.entries(groupedItems).map(([sectionType, sectionItems]) => {
            if (sectionItems.length === 0) return null;
            const meta = SECTION_META[sectionType];
            return (
              <section key={sectionType}>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-on-surface">
                    <AppIcon name={meta.icon} className="text-[17px] text-on-surface-variant" />
                    <span>{meta.label}</span>
                  </h3>
                  <span className="text-xs tabular-nums text-on-surface-variant">
                    {sectionItems.length}
                  </span>
                </div>
                <div className="space-y-5">{sectionItems.map(renderWorkspaceItem)}</div>
              </section>
            );
          })}
        </div>
      )}

      {items.length > 0 && type !== 'all' && (
        <div className="space-y-5">{items.map(renderWorkspaceItem)}</div>
      )}

      {items.length > 0 && (currentEntry?.error || currentEntry?.pagination?.hasMore) && (
        <div className="mt-6 text-center">
          {currentEntry.error && <p className="mb-2 text-xs text-error">{currentEntry.error}</p>}
          <button
            type="button"
            disabled={currentEntry.loading}
            onClick={() => loadWorkspace({ append: true, force: true })}
            className="h-9 rounded-[8px] border border-outline-variant px-4 text-sm font-medium text-on-surface transition-colors hover:bg-surface-container-low disabled:opacity-50"
          >
            {currentEntry.loading ? 'Đang tải...' : currentEntry.error ? 'Thử lại' : 'Tải thêm'}
          </button>
        </div>
      )}
    </div>
  );
}

export default ConversationWorkspace;
