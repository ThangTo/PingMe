import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import MessageBubble from './MessageBubble';
import AppIcon from '../ui/AppIcon';

const getMessageAttachments = (message = {}) => {
  if (message.isDeleted) return [];
  if (Array.isArray(message.attachments) && message.attachments.length > 0) {
    return message.attachments;
  }
  return message.attachment ? [message.attachment] : [];
};

const messageMatchesSearch = (message, query) => {
  if (!query) return true;
  const normalizedQuery = query.toLowerCase();
  const content = message.isDeleted ? 'Tin nhắn này đã được thu hồi' : message.content || '';
  const filenames = getMessageAttachments(message)
    .map((attachment) => attachment.filename || '')
    .join(' ');
  return `${content} ${filenames}`.toLowerCase().includes(normalizedQuery);
};

const EMPTY_META_MESSAGE_IDS = new Set();

const MessageList = ({
  messages = [],
  conversationId,
  currentUserId,
  reactionUsersById = {},
  isTyping,
  onReaction,
  onEditMessage,
  onDeleteMessage,
  onReplyMessage,
  onPinMessage,
  isLoading = false,
  isLoadingOlderMessages = false,
  hasOlderMessages = false,
  onLoadOlderMessages,
  error = '',
  searchQuery = '',
  pinnedMessageIds = [],
  readReceiptsByMessageId = {},
  jumpToMessageSignal,
}) => {
  const messagesEndRef = useRef(null);
  const messageRefs = useRef(new Map());
  const highlightTimeoutRef = useRef(null);
  const previousLastMessageIdRef = useRef(null);
  const previousMessageCountRef = useRef(0);
  const previousConversationIdRef = useRef(conversationId);
  const [highlightedMessageId, setHighlightedMessageId] = useState(null);
  const [activeActionMessageId, setActiveActionMessageId] = useState(null);
  const [expandedMetaState, setExpandedMetaState] = useState(() => ({
    conversationId,
    ids: new Set(),
  }));
  const visibleMessages = searchQuery.trim()
    ? messages.filter((message) => messageMatchesSearch(message, searchQuery.trim()))
    : messages;
  const latestMessageId = messages[messages.length - 1]?.id || null;
  const expandedMetaMessageIds =
    expandedMetaState.conversationId === conversationId ? expandedMetaState.ids : EMPTY_META_MESSAGE_IDS;

  useLayoutEffect(() => {
    if (previousConversationIdRef.current === conversationId) return;

    previousConversationIdRef.current = conversationId;
    previousLastMessageIdRef.current = null;
    previousMessageCountRef.current = 0;
  }, [conversationId]);

  useLayoutEffect(() => {
    const lastMessage = messages[messages.length - 1];
    const lastMessageId = lastMessage?.id || null;
    const previousLastMessageId = previousLastMessageIdRef.current;
    const previousMessageCount = previousMessageCountRef.current;
    const shouldScrollToBottom =
      previousMessageCount === 0 ||
      (lastMessageId && lastMessageId !== previousLastMessageId) ||
      isTyping;

    previousLastMessageIdRef.current = lastMessageId;
    previousMessageCountRef.current = messages.length;

    if (!shouldScrollToBottom) return undefined;

    const behavior = previousMessageCount === 0 ? 'auto' : 'smooth';
    messagesEndRef.current?.scrollIntoView({ behavior, block: 'end' });

    const frameId = requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior, block: 'end' });
    });

    return () => cancelAnimationFrame(frameId);
  }, [messages, isTyping]);

  const toggleMessageMeta = (messageId) => {
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
  };

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

  const handleJumpToMessage = useCallback((messageId) => {
    const target = messageRefs.current.get(messageId);
    if (!target) return;

    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setHighlightedMessageId(messageId);

    if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
    highlightTimeoutRef.current = setTimeout(() => {
      setHighlightedMessageId(null);
    }, 1400);
  }, []);

  useEffect(() => {
    if (!jumpToMessageSignal?.messageId) return;
    const frameId = requestAnimationFrame(() => {
      handleJumpToMessage(jumpToMessageSignal.messageId);
    });

    return () => cancelAnimationFrame(frameId);
  }, [handleJumpToMessage, jumpToMessageSignal]);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-[900px] space-y-4 px-4 py-8 md:px-7">
        {[1, 2, 3, 4].map((item) => (
          <div
            key={item}
            className={`flex animate-pulse ${item % 2 === 0 ? 'justify-end' : 'justify-start'}`}
          >
            <div className="h-12 w-[min(420px,72%)] rounded-lg bg-surface-container-low" />
          </div>
        ))}
      </div>
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
    <div className="mx-auto min-h-full max-w-[900px] space-y-3 px-4 py-6 md:px-7">
      {!searchQuery.trim() && (hasOlderMessages || isLoadingOlderMessages) && (
        <div className="flex justify-center pb-1">
          <button
            type="button"
            onClick={onLoadOlderMessages}
            disabled={isLoadingOlderMessages}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 text-xs font-medium text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-on-surface disabled:cursor-not-allowed disabled:opacity-60"
          >
            <AppIcon
              name={isLoadingOlderMessages ? 'hourglass_empty' : 'expand_less'}
              className={`text-[18px] ${isLoadingOlderMessages ? 'animate-spin' : ''}`}
            />
            <span>{isLoadingOlderMessages ? 'Đang tải...' : 'Tải tin cũ hơn'}</span>
          </button>
        </div>
      )}

      <div className="mb-5 flex justify-center">
        <span className="rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-1.5 text-xs text-on-surface-variant">
          Hôm nay
        </span>
      </div>

      {visibleMessages.length === 0 && searchQuery.trim() ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-surface-container-low">
            <AppIcon name="search_off" className="text-[28px] text-on-surface-variant" />
          </div>
          <p className="text-sm text-on-surface-variant">Không tìm thấy tin nhắn phù hợp.</p>
        </div>
      ) : null}

      {visibleMessages.map((message, index) => {
        const isOwn = message.senderId === currentUserId;
        const prevMessage = visibleMessages[index - 1];
        const showAvatar = !prevMessage || prevMessage.senderId !== message.senderId;
        const isActionMenuOpen = activeActionMessageId === message.id;
        const readReceipts = readReceiptsByMessageId[message.id] || [];
        const showMeta = message.id === latestMessageId || expandedMetaMessageIds.has(message.id);

        return (
          <div
            key={message.id || index}
            ref={(node) => {
              if (!message.id) return;
              if (node) messageRefs.current.set(message.id, node);
              else messageRefs.current.delete(message.id);
            }}
            className={`relative rounded-xl transition-colors duration-300 ${
              isActionMenuOpen ? 'z-[150]' : 'z-0'
            } ${
              highlightedMessageId === message.id ? 'bg-accent-soft/70' : ''
            }`}
          >
            <MessageBubble
              message={message}
              isOwn={isOwn}
              showAvatar={showAvatar}
              reactionUsersById={reactionUsersById}
              readReceipts={readReceipts}
              onReaction={onReaction}
              onEditMessage={onEditMessage}
              onDeleteMessage={onDeleteMessage}
              onReplyMessage={onReplyMessage}
              onPinMessage={onPinMessage}
              isPinned={pinnedMessageIds.includes(message.id)}
              showMeta={showMeta}
              onToggleMeta={toggleMessageMeta}
              onJumpToMessage={handleJumpToMessage}
              isActionMenuOpen={isActionMenuOpen}
              onOpenActionMenu={() => openActionMenu(message.id)}
              onCloseActionMenu={() => closeActionMenu(message.id)}
            />
          </div>
        );
      })}

      {isTyping && (
        <div className="flex max-w-[72%] items-end gap-2 md:max-w-[58%]">
          <div className="h-7 w-7 shrink-0 overflow-hidden rounded-full border border-outline-variant bg-surface-container-low">
            <AppIcon name="person" className="flex h-full w-full items-center justify-center text-sm text-on-surface-variant" />
          </div>
          <div className="flex items-center gap-1 rounded-lg border border-outline-variant bg-surface-container-lowest px-4 py-3 shadow-[0_2px_10px_rgba(40,37,32,0.03)]">
            <span
              className="h-1.5 w-1.5 animate-bounce rounded-full bg-on-surface-variant/50"
              style={{ animationDelay: '0ms' }}
            />
            <span
              className="h-1.5 w-1.5 animate-bounce rounded-full bg-on-surface-variant/50"
              style={{ animationDelay: '150ms' }}
            />
            <span
              className="h-1.5 w-1.5 animate-bounce rounded-full bg-on-surface-variant/50"
              style={{ animationDelay: '300ms' }}
            />
          </div>
        </div>
      )}

      <div ref={messagesEndRef} />
    </div>
  );
};

export default MessageList;
