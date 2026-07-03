import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Virtuoso } from 'react-virtuoso';
import MessageBubble from './MessageBubble';
import AppIcon from '../ui/AppIcon';
import { LoadingSpinner, MessageSkeleton } from '../ui/LoadingState';

const INTENT_CONFIG = {
  urgent: { label: 'Khẩn cấp', icon: 'alarm', color: 'text-error', bg: 'bg-error/10', border: 'border-error/30' },
  needs_reply: { label: 'Cần trả lời', icon: 'reply', color: 'text-warning', bg: 'bg-warning/10', border: 'border-warning/30' },
  decision: { label: 'Quyết định', icon: 'check_circle', color: 'text-secondary', bg: 'bg-secondary/10', border: 'border-secondary/30' },
  fyi: { label: 'Để biết', icon: 'info', color: 'text-accent', bg: 'bg-accent/10', border: 'border-accent/30' },
  remind_me: { label: 'Nhắc tôi', icon: 'bookmark', color: 'text-purple-500', bg: 'bg-purple-500/10', border: 'border-purple-500/30' },
};

const EMPTY_META_MESSAGE_IDS = new Set();

const getInitials = (name = '') =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('') || '?';

const TypingIndicator = ({ typingUsers = [], floating = false }) => {
  const visibleUsers = typingUsers.slice(0, 3);

  return (
    <div
      className={`inline-flex items-center gap-2 ${
        floating
          ? 'rounded-full border border-outline-variant bg-surface-container-lowest px-2 py-1.5 shadow-sm'
          : ''
      }`}
    >
      <div className="flex shrink-0 -space-x-2">
        {visibleUsers.map((typingUser) => (
          <span
            key={typingUser.id}
            className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full border-2 border-surface-container-lowest bg-accent-soft text-[10px] font-semibold text-on-surface"
            title={typingUser.name}
          >
            {typingUser.avatar ? (
              <img
                src={typingUser.avatar}
                alt={typingUser.name}
                className="h-full w-full object-cover"
              />
            ) : (
              getInitials(typingUser.name)
            )}
          </span>
        ))}
      </div>
      <span className="flex h-9 shrink-0 items-center gap-1 rounded-full border border-outline-variant bg-surface-container-lowest px-3 shadow-sm">
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-on-surface-variant/55" />
        <span
          className="h-1.5 w-1.5 animate-bounce rounded-full bg-on-surface-variant/55"
          style={{ animationDelay: '150ms' }}
        />
        <span
          className="h-1.5 w-1.5 animate-bounce rounded-full bg-on-surface-variant/55"
          style={{ animationDelay: '300ms' }}
        />
      </span>
    </div>
  );
};

const getDateKey = (timestamp) => {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
};

const getDateLabel = (timestamp) => {
  if (!timestamp) return '';

  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '';

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const messageDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((today - messageDay) / 86400000);

  if (diffDays === 0) return 'Hôm nay';
  if (diffDays === 1) return 'Hôm qua';

  return date.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

const MessageList = ({
  messages = [],
  conversationId,
  currentUserId,
  conversationMembers = [],
  reactionUsersById = {},
  onReaction,
  onPollVote,
  onEventRsvp,
  onChecklistToggle,
  onOpenPlan,
  onCancelEvent,
  onEditMessage,
  onDeleteMessage,
  onReplyMessage,
  onPinMessage,
  onEvolveMessage,
  onForwardMessage,
  onSetMessageIntent,
  onOpenSenderProfile,
  isLoading = false,
  isLoadingOlderMessages = false,
  hasOlderMessages = false,
  onLoadOlderMessages,
  firstItemIndex = 100000,
  error = '',
  searchQuery = '',
  searchMatchIds = [],
  activeSearchMessageId = null,
  pinnedMessageIds = [],
  readReceiptsByMessageId = {},
  jumpToMessageSignal,
  typingUsers = [],
  bubbleThemeId = 'classic',
  hasFloatingSummaryAction = false,
}) => {
  const virtuosoRef = useRef(null);
  const highlightTimeoutRef = useRef(null);
  const isAtBottomRef = useRef(true);
  const physicalAtBottomRef = useRef(true);
  const isLatestMessageVisibleRef = useRef(true);
  const previousLatestMessageIdRef = useRef(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState(null);
  const [activeActionMessageId, setActiveActionMessageId] = useState(null);
  const [activeIntentFilter, setActiveIntentFilter] = useState(null);
  const [isNearLatestMessage, setIsNearLatestMessage] = useState(true);
  const [expandedMetaState, setExpandedMetaState] = useState(() => ({
    conversationId,
    ids: new Set(),
  }));
  const normalizedSearchQuery = searchQuery.trim();
  const isSearchMode = Boolean(normalizedSearchQuery);
  const visibleMessages = activeIntentFilter
    ? messages.filter((msg) => msg.intent === activeIntentFilter)
    : messages;

  const hasIntentMessages = useMemo(
    () => messages.some((msg) => msg.intent && INTENT_CONFIG[msg.intent]),
    [messages],
  );
  const searchMatchIdSet = useMemo(() => new Set(searchMatchIds), [searchMatchIds]);
  const pinnedMessageIdSet = useMemo(() => new Set(pinnedMessageIds), [pinnedMessageIds]);
  const messageIndexById = useMemo(() => {
    const next = new Map();
    visibleMessages.forEach((message, index) => {
      if (message.id) next.set(message.id, index);
    });
    return next;
  }, [visibleMessages]);
  const latestMessageId = messages[messages.length - 1]?.id || null;
  const latestVisibleMessage = visibleMessages[visibleMessages.length - 1] || null;
  const latestVisibleMessageId = latestVisibleMessage?.id || null;
  const expandedMetaMessageIds =
    expandedMetaState.conversationId === conversationId ? expandedMetaState.ids : EMPTY_META_MESSAGE_IDS;
  const safeFirstItemIndex = Math.max(0, firstItemIndex);
  const hasTypingUsers = typingUsers.length > 0;

  const updateNearLatestMessage = useCallback((nextValue) => {
    isAtBottomRef.current = nextValue;
    setIsNearLatestMessage((currentValue) => (currentValue === nextValue ? currentValue : nextValue));
  }, []);

  const scrollToBottom = useCallback(
    (behavior = 'smooth') => {
      if (visibleMessages.length === 0) return;

      virtuosoRef.current?.scrollToIndex({
        index: visibleMessages.length - 1,
        align: 'end',
        behavior,
      });
    },
    [visibleMessages.length],
  );

  const scrollToListBottom = useCallback((behavior = 'smooth') => {
    virtuosoRef.current?.scrollTo({
      top: Number.MAX_SAFE_INTEGER,
      behavior,
    });
  }, []);

  const toggleMessageMeta = useCallback((messageId) => {
    if (!messageId || messageId === latestMessageId) return;

    setExpandedMetaState((current) => {
      const currentIds =
        current.conversationId === conversationId ? current.ids : EMPTY_META_MESSAGE_IDS;
      const next = new Set(currentIds);
      if (next.has(messageId)) {
        next.delete(messageId);
      } else {
        next.add(messageId);
      }
      return { conversationId, ids: next };
    });
  }, [conversationId, latestMessageId]);

  useEffect(() => {
    return () => {
      if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
    };
  }, []);

  const openActionMenu = useCallback((messageId) => {
    setActiveActionMessageId(messageId);
  }, []);

  const closeActionMenu = useCallback((messageId) => {
    setActiveActionMessageId((currentId) => (currentId === messageId ? null : currentId));
  }, []);

  const handleJumpToMessage = useCallback(
    (messageId) => {
      const targetIndex = messageIndexById.get(messageId);
      if (targetIndex === undefined) return;

      virtuosoRef.current?.scrollToIndex({
        index: targetIndex,
        align: 'center',
        behavior: 'smooth',
      });
      setHighlightedMessageId(messageId);

      if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
      highlightTimeoutRef.current = setTimeout(() => {
        setHighlightedMessageId(null);
      }, 1400);
    },
    [messageIndexById],
  );

  useEffect(() => {
    if (!jumpToMessageSignal?.messageId) return;
    const frameId = requestAnimationFrame(() => {
      handleJumpToMessage(jumpToMessageSignal.messageId);
    });

    return () => cancelAnimationFrame(frameId);
  }, [handleJumpToMessage, jumpToMessageSignal]);

  useEffect(() => {
    if (!activeSearchMessageId) return;
    const frameId = requestAnimationFrame(() => {
      handleJumpToMessage(activeSearchMessageId);
    });

    return () => cancelAnimationFrame(frameId);
  }, [activeSearchMessageId, handleJumpToMessage]);

  useEffect(() => {
    if (!hasTypingUsers || !isAtBottomRef.current || isSearchMode) return undefined;

    const frameId = requestAnimationFrame(() => {
      scrollToListBottom('smooth');
    });
    const settleFrameId = requestAnimationFrame(() => {
      requestAnimationFrame(() => scrollToListBottom('smooth'));
    });

    return () => {
      cancelAnimationFrame(frameId);
      cancelAnimationFrame(settleFrameId);
    };
  }, [hasTypingUsers, isSearchMode, scrollToListBottom]);

  useEffect(() => {
    const previousLatestMessageId = previousLatestMessageIdRef.current;
    previousLatestMessageIdRef.current = latestVisibleMessageId;

    if (!latestVisibleMessageId || previousLatestMessageId === latestVisibleMessageId || isSearchMode) {
      return undefined;
    }

    const isInitialPage = !previousLatestMessageId;
    const isOwnMessage = latestVisibleMessage?.senderId === currentUserId;
    const shouldFollow = isInitialPage || isOwnMessage || isAtBottomRef.current;

    if (!shouldFollow) return undefined;

    const behavior = isInitialPage ? 'auto' : 'smooth';
    const frameId = requestAnimationFrame(() => {
      scrollToBottom(behavior);
    });
    const settleFrameId = requestAnimationFrame(() => {
      requestAnimationFrame(() => scrollToBottom(behavior));
    });

    return () => {
      cancelAnimationFrame(frameId);
      cancelAnimationFrame(settleFrameId);
    };
  }, [
    currentUserId,
    isSearchMode,
    latestVisibleMessage,
    latestVisibleMessageId,
    scrollToBottom,
  ]);

  const handleAtTopStateChange = useCallback(
    (atTop) => {
      if (!atTop || isSearchMode || !hasOlderMessages || isLoadingOlderMessages) return;
      onLoadOlderMessages?.();
    },
    [hasOlderMessages, isLoadingOlderMessages, isSearchMode, onLoadOlderMessages],
  );

  const handleAtBottomStateChange = useCallback(
    (atBottom) => {
      physicalAtBottomRef.current = atBottom;
      updateNearLatestMessage(atBottom || isLatestMessageVisibleRef.current);
    },
    [updateNearLatestMessage],
  );

  const handleRangeChanged = useCallback(
    (range) => {
      const lastDataIndex = visibleMessages.length - 1;
      const lastItemIndex = safeFirstItemIndex + lastDataIndex;
      const isAbsoluteRange = range.endIndex >= safeFirstItemIndex;
      const isLatestMessageVisible =
        lastDataIndex < 0 ||
        (isAbsoluteRange ? range.endIndex >= lastItemIndex : range.endIndex >= lastDataIndex);

      isLatestMessageVisibleRef.current = isLatestMessageVisible;
      updateNearLatestMessage(physicalAtBottomRef.current || isLatestMessageVisible);
    },
    [safeFirstItemIndex, updateNearLatestMessage, visibleMessages.length],
  );

  const renderHeader = useCallback(
    () => (
      <div className="w-full px-4 pb-2 pt-5 md:px-5">
        {isLoadingOlderMessages && !isSearchMode && (
          <div className="flex justify-center">
            <div className="inline-flex h-8 items-center gap-2 rounded-full border border-outline-variant bg-surface-container-lowest px-3 text-xs font-medium text-on-surface-variant shadow-sm">
              <LoadingSpinner size="sm" />
              <span>Đang tải...</span>
            </div>
          </div>
        )}
      </div>
    ),
    [isLoadingOlderMessages, isSearchMode],
  );

  const renderFooter = useCallback(
    () => (
      <div className={`w-full px-4 pt-1 md:px-5 ${hasFloatingSummaryAction ? 'pb-20' : 'pb-6'}`}>
        {hasTypingUsers && (
          <div className="flex max-w-[72%] items-end gap-2 md:max-w-[58%]">
            <TypingIndicator typingUsers={typingUsers} />
          </div>
        )}
      </div>
    ),
    [hasFloatingSummaryAction, hasTypingUsers, typingUsers],
  );

  const virtuosoComponents = useMemo(
    () => ({
      Header: renderHeader,
      Footer: renderFooter,
    }),
    [renderFooter, renderHeader],
  );

  const renderMessage = useCallback(
    (virtualIndex, message) => {
      const dataIndex =
        (message.id ? messageIndexById.get(message.id) : undefined) ?? visibleMessages.indexOf(message);
      if (dataIndex < 0) return null;

      const isOwn = message.senderId === currentUserId;
      const prevMessage = visibleMessages[dataIndex - 1];
      const shouldShowDateSeparator =
        !prevMessage || getDateKey(prevMessage.timestamp) !== getDateKey(message.timestamp);
      const dateLabel = getDateLabel(message.timestamp);
      const showAvatar =
        shouldShowDateSeparator || !prevMessage || prevMessage.senderId !== message.senderId;
      const startsSenderGroup =
        Boolean(prevMessage) && prevMessage.senderId !== message.senderId && !shouldShowDateSeparator;
      const isActionMenuOpen = activeActionMessageId === message.id;
      const readReceipts = readReceiptsByMessageId[message.id] || [];
      const showMeta = message.id === latestMessageId || expandedMetaMessageIds.has(message.id);

      return (
        <div
          data-message-row="true"
          data-message-index={virtualIndex}
          className={`w-full px-4 pb-2 md:px-5 ${startsSenderGroup ? 'pt-2 md:pt-2.5' : ''}`}
        >
          {shouldShowDateSeparator && dateLabel && (
            <div className="mb-4 mt-2 flex items-center justify-center gap-3">
              <span className="h-px w-16 bg-outline-variant" />
              <span
                data-date-separator="true"
                className="rounded-[8px] border border-outline-variant bg-surface-container-lowest px-3 py-1 text-[12px] text-on-surface-variant"
              >
                {dateLabel}
              </span>
              <span className="h-px w-16 bg-outline-variant" />
            </div>
          )}

          <div
            className={`relative rounded-xl transition-colors duration-300 ${
              isActionMenuOpen ? 'z-[150]' : 'z-0'
            } ${
              highlightedMessageId === message.id
                ? 'bg-secondary-container'
                : searchMatchIdSet.has(message.id)
                  ? 'bg-accent-soft/70'
                  : ''
            }`}
          >
            <MessageBubble
              message={message}
              isOwn={isOwn}
              showAvatar={showAvatar}
              currentUserId={currentUserId}
              conversationMembers={conversationMembers}
              reactionUsersById={reactionUsersById}
              readReceipts={readReceipts}
              onReaction={onReaction}
              onPollVote={onPollVote}
              onEventRsvp={onEventRsvp}
              onChecklistToggle={onChecklistToggle}
              onOpenPlan={onOpenPlan}
              onCancelEvent={onCancelEvent}
              onEditMessage={onEditMessage}
              onDeleteMessage={onDeleteMessage}
              onReplyMessage={onReplyMessage}
              onPinMessage={onPinMessage}
              onEvolveMessage={onEvolveMessage}
              onForwardMessage={onForwardMessage}
              onSetMessageIntent={onSetMessageIntent}
              onOpenSenderProfile={onOpenSenderProfile}
              bubbleThemeId={bubbleThemeId}
              isPinned={pinnedMessageIdSet.has(message.id)}
              showMeta={showMeta}
              onToggleMeta={toggleMessageMeta}
              onJumpToMessage={handleJumpToMessage}
              isActionMenuOpen={isActionMenuOpen}
              onOpenActionMenu={openActionMenu}
              onCloseActionMenu={closeActionMenu}
            />
          </div>
        </div>
      );
    },
    [
      activeActionMessageId,
      currentUserId,
      conversationMembers,
      expandedMetaMessageIds,
      handleJumpToMessage,
      highlightedMessageId,
      latestMessageId,
      messageIndexById,
      onDeleteMessage,
      onEditMessage,
      onEventRsvp,
      onChecklistToggle,
      onOpenPlan,
      onCancelEvent,
      onEvolveMessage,
      onForwardMessage,
      onSetMessageIntent,
      onPinMessage,
      onOpenSenderProfile,
      onPollVote,
      onReaction,
      onReplyMessage,
      openActionMenu,
      closeActionMenu,
      bubbleThemeId,
      pinnedMessageIdSet,
      reactionUsersById,
      readReceiptsByMessageId,
      searchMatchIdSet,
      toggleMessageMeta,
      visibleMessages,
    ],
  );

  if (isLoading) {
    return (
      <MessageSkeleton rows={4} className="px-4 py-8 md:px-5" />
    );
  }

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-error-container">
          <AppIcon name="sync_problem" className="text-3xl text-error" />
        </div>
        <p className="text-sm text-error">{error}</p>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-6">
        <div className="flex h-16 w-16 items-center justify-center rounded-full border border-outline-variant bg-surface-container-lowest">
          <AppIcon name="chat_bubble" className="text-3xl text-on-surface-variant/50" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-on-surface">Chưa có tin nhắn nào</p>
          <p className="mt-1 text-xs text-on-surface-variant">Gửi tin nhắn đầu tiên</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full bg-transparent">
      {hasIntentMessages && (
        <div className="sticky top-0 z-30 flex shrink-0 gap-1.5 overflow-x-auto border-b border-outline-variant bg-surface px-4 py-2 md:px-5">
          <button
            type="button"
            onClick={() => setActiveIntentFilter(null)}
            className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[12px] font-medium transition-colors ${
              !activeIntentFilter
                ? 'border-secondary bg-secondary/10 text-secondary'
                : 'border-outline-variant text-on-surface-variant hover:border-outline hover:text-on-surface'
            }`}
          >
            Tất cả
          </button>
          {Object.entries(INTENT_CONFIG).map(([key, cfg]) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveIntentFilter((current) => (current === key ? null : key))}
              className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[12px] font-medium transition-colors ${
                activeIntentFilter === key ? `${cfg.bg} ${cfg.color} ${cfg.border}` : 'border-outline-variant text-on-surface-variant hover:border-outline hover:text-on-surface'
              }`}
            >
              <AppIcon name={cfg.icon} className="text-[14px]" />
              {cfg.label}
            </button>
          ))}
        </div>
      )}
      <Virtuoso
        key={conversationId || 'conversation'}
        ref={virtuosoRef}
        data={visibleMessages}
        className="no-scrollbar h-full bg-transparent"
        data-message-total={visibleMessages.length}
        firstItemIndex={safeFirstItemIndex}
        initialTopMostItemIndex={{ index: 'LAST', align: 'end' }}
        alignToBottom
        followOutput={(isAtBottom) => (isAtBottom ? 'smooth' : false)}
        atBottomThreshold={160}
        increaseViewportBy={{ top: 640, bottom: 720 }}
        atTopStateChange={handleAtTopStateChange}
        atBottomStateChange={handleAtBottomStateChange}
        rangeChanged={handleRangeChanged}
        computeItemKey={(index, message) => message.id || `${conversationId || 'message'}-${index}`}
        components={virtuosoComponents}
        itemContent={renderMessage}
      />

      {hasTypingUsers && !isNearLatestMessage && !isSearchMode && (
        <div className="pointer-events-none absolute bottom-3 left-4 z-40 md:left-7">
          <TypingIndicator typingUsers={typingUsers} floating />
        </div>
      )}
    </div>
  );
};

export default MessageList;
