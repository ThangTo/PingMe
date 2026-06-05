import { useEffect, useMemo, useRef, useState } from 'react';
import Header from './Header';
import MessageList from '../chat/MessageList';
import MessageInput from '../chat/MessageInput';

const REVOKED_MESSAGE_TEXT = 'Tin nhắn này đã được thu hồi';

const getMessageAttachments = (message = {}) => {
  if (message.isDeleted) return [];
  if (Array.isArray(message.attachments) && message.attachments.length > 0) {
    return message.attachments;
  }
  return message.attachment ? [message.attachment] : [];
};

const getPinnedPreviewText = (message) => {
  if (!message) return '';
  if (message.isDeleted) return REVOKED_MESSAGE_TEXT;

  const attachments = getMessageAttachments(message);
  if (message.content) return message.content;
  if (attachments.length === 1 && attachments[0].type === 'audio') return 'Tin nhắn thoại';
  if (attachments.length === 1) return attachments[0].filename || 'Tệp đính kèm';
  if (attachments.length > 1 && attachments.every((item) => item.type === 'image')) {
    return `${attachments.length} ảnh`;
  }
  if (attachments.length > 1 && attachments.every((item) => item.type === 'audio')) {
    return `${attachments.length} tin nhắn thoại`;
  }
  if (attachments.length > 1) return `${attachments.length} tệp đính kèm`;
  return 'Tệp đính kèm';
};

const PinGlyph = ({ className = '' }) => (
  <span
    className={`material-symbols-outlined -rotate-45 ${className}`}
    style={{ fontVariationSettings: "'FILL' 1, 'wght' 500, 'GRAD' 0, 'opsz' 20" }}
  >
    push_pin
  </span>
);

const ChatArea = ({
  currentUser,
  messages = [],
  currentUserId,
  reactionUsersById,
  onSendMessage,
  isTyping,
  onTypingStart,
  onTypingStop,
  onFocusInput,
  onReaction,
  onBack,
  onToggleDetails,
  editingMessage,
  replyingMessage,
  onStartEditMessage,
  onStartReplyMessage,
  onPinMessage,
  onUnpinMessage,
  onJumpToPinnedMessage,
  jumpToMessageSignal,
  onEditMessage,
  onCancelEditMessage,
  onCancelReplyMessage,
  onDeleteMessage,
  isLoading = false,
  error = '',
}) => {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isPinnedOpen, setIsPinnedOpen] = useState(false);
  const [activePinnedActionId, setActivePinnedActionId] = useState(null);
  const pinnedPanelRef = useRef(null);
  const longPressTimerRef = useRef(null);

  const pinnedMessages = currentUser?.pinnedMessages || (currentUser?.pinnedMessage ? [currentUser.pinnedMessage] : []);
  const latestPinnedMessage =
    currentUser?.latestPinnedMessage || currentUser?.pinnedMessage || pinnedMessages[0] || null;
  const pinnedMessageCount = currentUser?.pinnedMessageCount ?? pinnedMessages.length;
  const pinnedMessageIds = pinnedMessages.map((message) => message.id).filter(Boolean);
  const readReceiptsByMessageId = useMemo(() => {
    const membersById = new Map(
      (currentUser?.members || []).map((member) => [
        member.id,
        {
          name: member.username || '',
          avatar: member.avatar || '',
        },
      ]),
    );
    const receiptsByMessageId = {};

    (currentUser?.readStates || []).forEach((readState) => {
      if (!readState?.lastReadMessageId || readState.userId === currentUserId) return;

      const member = membersById.get(readState.userId);
      const receipt = {
        id: readState.userId,
        name: readState.userName || member?.name || 'Người dùng',
        avatar: readState.avatar || member?.avatar || '',
        lastReadAt: readState.lastReadAt || null,
      };

      if (!receiptsByMessageId[readState.lastReadMessageId]) {
        receiptsByMessageId[readState.lastReadMessageId] = [];
      }

      receiptsByMessageId[readState.lastReadMessageId].push(receipt);
    });

    Object.values(receiptsByMessageId).forEach((receipts) => {
      receipts.sort((a, b) => new Date(b.lastReadAt || 0) - new Date(a.lastReadAt || 0));
    });

    return receiptsByMessageId;
  }, [currentUser?.members, currentUser?.readStates, currentUserId]);

  const searchMatchCount = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return 0;

    return messages.filter((message) => {
      const content = message.isDeleted ? 'Tin nhắn này đã được thu hồi' : message.content || '';
      const filenames = getMessageAttachments(message)
        .map((attachment) => attachment.filename || '')
        .join(' ');
      return `${content} ${filenames}`.toLowerCase().includes(query);
    }).length;
  }, [messages, searchQuery]);

  useEffect(() => {
    if (!isPinnedOpen) return undefined;

    const handlePointerDown = (event) => {
      if (pinnedPanelRef.current?.contains(event.target)) return;
      setIsPinnedOpen(false);
      setActivePinnedActionId(null);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [isPinnedOpen]);

  useEffect(() => {
    return () => clearTimeout(longPressTimerRef.current);
  }, []);

  const closePinnedMenu = () => {
    setIsPinnedOpen(false);
    setActivePinnedActionId(null);
  };

  const handlePinnedSelect = (message) => {
    setSearchQuery('');
    setIsSearchOpen(false);
    closePinnedMenu();
    onJumpToPinnedMessage?.(message);
  };

  const openPinnedAction = (event, message) => {
    event.preventDefault();
    event.stopPropagation();
    setActivePinnedActionId(message.id);
  };

  const handlePinnedTouchStart = (message) => {
    clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = setTimeout(() => {
      setActivePinnedActionId(message.id);
    }, 520);
  };

  const handlePinnedTouchEnd = () => {
    clearTimeout(longPressTimerRef.current);
  };

  const handleConfirmUnpin = (message) => {
    const confirmed = window.confirm('Bỏ ghim tin nhắn này?');
    if (!confirmed) return;
    onUnpinMessage?.(message);
    closePinnedMenu();
  };

  return (
    <section className="flex h-full min-w-0 flex-1 flex-col bg-surface">
      {currentUser && (
        <Header
          user={currentUser}
          onBack={onBack}
          onToggleDetails={onToggleDetails}
          onToggleSearch={() => setIsSearchOpen((value) => !value)}
        />
      )}

      {latestPinnedMessage && (
        <div ref={pinnedPanelRef} className="relative shrink-0 border-b border-outline-variant">
          <button
            type="button"
            onClick={() => {
              setIsPinnedOpen((value) => !value);
              setActivePinnedActionId(null);
            }}
            className="flex w-full items-center gap-3 bg-surface-container-lowest px-4 py-2.5 text-left transition-colors hover:bg-surface-container-low md:px-7"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-on-surface">
              <PinGlyph className="text-[18px]" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-on-surface-variant">
                  Tin nhắn đã ghim
                </p>
                {pinnedMessageCount > 1 && (
                  <span className="rounded-full border border-outline-variant bg-surface px-2 py-0.5 text-[11px] font-semibold text-on-surface">
                    {pinnedMessageCount}
                  </span>
                )}
              </div>
              <p className="truncate text-sm text-on-surface">
                {latestPinnedMessage.senderName ? `${latestPinnedMessage.senderName}: ` : ''}
                {getPinnedPreviewText(latestPinnedMessage)}
              </p>
            </div>
            <span className="material-symbols-outlined shrink-0 text-[22px] text-on-surface-variant">
              {isPinnedOpen ? 'expand_less' : 'expand_more'}
            </span>
          </button>

          {isPinnedOpen && (
            <div className="absolute left-4 right-4 top-full z-30 mt-2 max-h-[min(420px,55vh)] overflow-y-auto rounded-lg border border-outline-variant bg-surface-container-lowest p-2 shadow-[0_18px_48px_rgba(40,37,32,0.16)] md:left-7 md:right-auto md:w-[460px]">
              <div className="px-2 pb-2 text-xs font-semibold uppercase tracking-[0.08em] text-on-surface-variant">
                {pinnedMessageCount} tin nhắn đã ghim
              </div>

              <div className="space-y-1">
                {pinnedMessages.map((message) => (
                  <div
                    key={message.id}
                    className="relative rounded-lg"
                    onContextMenu={(event) => openPinnedAction(event, message)}
                    onTouchStart={() => handlePinnedTouchStart(message)}
                    onTouchEnd={handlePinnedTouchEnd}
                    onTouchCancel={handlePinnedTouchEnd}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        if (activePinnedActionId === message.id) return;
                        handlePinnedSelect(message);
                      }}
                      className="flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-surface-container-low"
                    >
                      <PinGlyph className="mt-0.5 text-[16px] text-on-surface-variant" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-medium text-on-surface-variant">
                          {message.senderName || 'Tin nhắn'}
                        </span>
                        <span className="block truncate text-sm text-on-surface">
                          {getPinnedPreviewText(message)}
                        </span>
                      </span>
                    </button>

                    {activePinnedActionId === message.id && (
                      <div className="mx-3 mb-2 overflow-hidden rounded-lg border border-outline-variant bg-surface shadow-[0_10px_28px_rgba(40,37,32,0.12)]">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleConfirmUnpin(message);
                          }}
                          className="flex w-full items-center gap-3 px-3 py-2.5 text-sm text-error transition-colors hover:bg-error-container"
                        >
                          <span className="material-symbols-outlined text-[20px]">delete</span>
                          <span>Bỏ ghim</span>
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {isSearchOpen && (
        <div className="flex shrink-0 items-center gap-3 border-b border-outline-variant bg-surface px-4 py-3 md:px-7">
          <div className="relative max-w-md flex-1">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[19px] text-on-surface-variant">
              search
            </span>
            <input
              autoFocus
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Tìm trong cuộc trò chuyện..."
              className="h-10 w-full rounded-lg border border-outline-variant bg-surface-container-lowest pl-10 pr-3 text-sm outline-none transition-colors focus:border-accent"
            />
          </div>
          <span className="hidden text-xs text-on-surface-variant sm:block">
            {searchQuery.trim() ? `${searchMatchCount} kết quả` : 'Ctrl/Cmd+K để tìm hội thoại'}
          </span>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setIsSearchOpen(false);
            }}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-on-surface"
            title="Đóng tìm kiếm"
          >
            <span className="material-symbols-outlined text-[21px]">close</span>
          </button>
        </div>
      )}

      <div className="no-scrollbar flex-1 overflow-y-auto bg-surface">
        <MessageList
          messages={messages}
          currentUserId={currentUserId}
          reactionUsersById={reactionUsersById}
          isTyping={isTyping}
          onReaction={onReaction}
          isLoading={isLoading}
          error={error}
          searchQuery={searchQuery}
          pinnedMessageIds={pinnedMessageIds}
          readReceiptsByMessageId={readReceiptsByMessageId}
          jumpToMessageSignal={jumpToMessageSignal}
          onEditMessage={onStartEditMessage}
          onDeleteMessage={onDeleteMessage}
          onReplyMessage={onStartReplyMessage}
          onPinMessage={onPinMessage}
        />
      </div>

      <MessageInput
        onSendMessage={onSendMessage}
        onTypingStart={onTypingStart}
        onTypingStop={onTypingStop}
        onFocus={onFocusInput}
        editingMessage={editingMessage}
        replyingMessage={replyingMessage}
        onEditMessage={onEditMessage}
        onCancelEditMessage={onCancelEditMessage}
        onCancelReplyMessage={onCancelReplyMessage}
      />
    </section>
  );
};

export default ChatArea;
