import { useEffect, useMemo, useRef, useState } from 'react';
import Header from './Header';
import MessageList from '../chat/MessageList';
import MessageInput from '../chat/MessageInput';
import AppIcon from '../ui/AppIcon';
import { useConfirmDialog } from '../ui/confirmDialogContext';

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
  if (message.messageType === 'sticker' || message.sticker?.url) {
    return message.sticker?.name ? `Nhãn dán: ${message.sticker.name}` : 'Đã gửi nhãn dán';
  }
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
  <AppIcon name="push_pin" className={`-rotate-45 ${className}`} />
);

const ChatArea = ({
  currentUser,
  messages = [],
  currentUserId,
  reactionUsersById,
  onSendMessage,
  typingUsers = [],
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
  isLoadingOlderMessages = false,
  hasOlderMessages = false,
  onLoadOlderMessages,
  messageFirstItemIndex = 100000,
  error = '',
}) => {
  const { confirm } = useConfirmDialog();
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
      const stickerName = message.sticker?.name || '';
      return `${content} ${filenames} ${stickerName}`.toLowerCase().includes(query);
    }).length;
  }, [messages, searchQuery]);
  const searchMatchIds = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return [];

    return messages
      .filter((message) => {
        const content = message.isDeleted ? REVOKED_MESSAGE_TEXT : message.content || '';
        const filenames = getMessageAttachments(message)
          .map((attachment) => attachment.filename || '')
          .join(' ');
        const stickerName = message.sticker?.name || '';
        return `${content} ${filenames} ${stickerName}`.toLowerCase().includes(query);
      })
      .map((message) => message.id)
      .filter(Boolean);
  }, [messages, searchQuery]);
  const [activeSearchIndex, setActiveSearchIndex] = useState(0);
  const safeActiveSearchIndex =
    searchMatchIds.length === 0 ? 0 : Math.min(activeSearchIndex, searchMatchIds.length - 1);
  const activeSearchMessageId = searchMatchIds[safeActiveSearchIndex] || null;

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

  const handleConfirmUnpin = async (message) => {
    const confirmed = await confirm({
      title: 'Bỏ ghim tin nhắn?',
      description: 'Tin nhắn này sẽ được gỡ khỏi danh sách ghim của cuộc trò chuyện.',
      confirmText: 'Bỏ ghim',
      tone: 'danger',
    });
    if (!confirmed) return;
    onUnpinMessage?.(message);
    closePinnedMenu();
  };

  const requestOlderMessages = () => {
    if (!hasOlderMessages || isLoadingOlderMessages || searchQuery.trim()) return;

    onLoadOlderMessages?.();
  };

  return (
    <section className="flex h-full min-w-0 flex-1 flex-col bg-background">
      {currentUser && (
        <Header
          user={currentUser}
          onBack={onBack}
          onToggleDetails={onToggleDetails}
          onToggleSearch={() => setIsSearchOpen((value) => !value)}
        />
      )}

      {latestPinnedMessage && (
        <div ref={pinnedPanelRef} className="relative shrink-0 border-b border-outline-variant bg-surface">
          <button
            type="button"
            onClick={() => {
              setIsPinnedOpen((value) => !value);
              setActivePinnedActionId(null);
            }}
            className="flex h-[44px] w-full items-center gap-2.5 px-4 text-left transition-colors hover:bg-surface-container-low md:px-5"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] text-on-surface-variant">
              <PinGlyph className="text-[17px]" />
            </div>
            <div className="min-w-0 flex-1 text-[13px]">
              <p className="truncate text-on-surface">
                <span className="font-semibold">Đã ghim: </span>
                <span className="text-on-surface-variant">
                  {latestPinnedMessage.senderName ? `${latestPinnedMessage.senderName}: ` : ''}
                  {getPinnedPreviewText(latestPinnedMessage)}
                </span>
              </p>
            </div>
            {pinnedMessageCount > 1 && (
              <span className="shrink-0 text-[13px] font-medium text-on-surface">
                {pinnedMessageCount} ghim
              </span>
            )}
            <AppIcon name={isPinnedOpen ? 'expand_less' : 'chevron_right'} className="shrink-0 text-[20px] text-on-surface-variant" />
          </button>

          {isPinnedOpen && (
            <div className="absolute left-3 right-3 top-full z-30 mt-2 max-h-[min(420px,58vh)] overflow-y-auto rounded-[12px] border border-outline-variant bg-surface-container-lowest p-2 shadow-sm md:left-[calc(50%-410px)] md:right-auto md:w-[460px]">
              <div className="px-2 pb-2 text-xs font-semibold text-on-surface-variant">
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
                      className="flex w-full items-start gap-3 rounded-[8px] px-3 py-2.5 text-left transition-colors hover:bg-surface-container-low"
                    >
                      <PinGlyph className="mt-0.5 text-[16px] text-on-surface-variant" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium text-on-surface-variant">
                          {message.senderName || 'Tin nhắn'}
                        </span>
                        <span className="block truncate text-[14px] text-on-surface">
                          {getPinnedPreviewText(message)}
                        </span>
                      </span>
                    </button>

                    {activePinnedActionId === message.id && (
                      <div className="mx-3 mb-2 overflow-hidden rounded-[8px] border border-outline-variant bg-surface shadow-sm">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleConfirmUnpin(message);
                          }}
                          className="flex w-full items-center gap-3 px-3 py-2.5 text-sm text-error transition-colors hover:bg-error-container"
                        >
                          <AppIcon name="delete" className="text-[20px]" />
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
        <div className="flex shrink-0 items-center gap-3 border-b border-outline-variant bg-surface px-4 py-2.5 md:px-5">
          <div className="relative max-w-md flex-1">
            <AppIcon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-on-surface-variant" />
            <input
              autoFocus
              value={searchQuery}
              onChange={(event) => {
                setSearchQuery(event.target.value);
                setActiveSearchIndex(0);
              }}
              placeholder="Tìm trong cuộc trò chuyện..."
              className="h-[36px] w-full rounded-[8px] border border-outline-variant bg-surface-container-lowest pl-9 pr-3 text-[16px] outline-none transition-colors focus:border-outline focus:ring-1 focus:ring-outline md:text-[14px]"
            />
          </div>
          <div className="hidden items-center gap-1.5 sm:flex">
            <span className="min-w-16 text-right text-xs text-on-surface-variant">
              {searchQuery.trim()
                ? searchMatchCount > 0
                  ? `${safeActiveSearchIndex + 1}/${searchMatchCount}`
                  : '0 kết quả'
                : 'Ctrl/Cmd+K'}
            </span>
            <button
              type="button"
              disabled={searchMatchCount === 0}
              onClick={() =>
                setActiveSearchIndex(
                  searchMatchCount === 0 ? 0 : (safeActiveSearchIndex - 1 + searchMatchCount) % searchMatchCount,
                )
              }
              className="grid h-8 w-8 place-items-center rounded-lg text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface disabled:opacity-35"
              title="Kết quả trước"
            >
              <AppIcon name="chevron_left" className="text-[18px]" />
            </button>
            <button
              type="button"
              disabled={searchMatchCount === 0}
              onClick={() =>
                setActiveSearchIndex(
                  searchMatchCount === 0 ? 0 : (safeActiveSearchIndex + 1) % searchMatchCount,
                )
              }
              className="grid h-8 w-8 place-items-center rounded-lg text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface disabled:opacity-35"
              title="Kết quả sau"
            >
              <AppIcon name="chevron_right" className="text-[18px]" />
            </button>
          </div>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setIsSearchOpen(false);
              setActiveSearchIndex(0);
            }}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-on-surface"
            title="Đóng tìm kiếm"
          >
            <AppIcon name="close" className="text-[21px]" />
          </button>
        </div>
      )}

      <div className="min-h-0 flex-1 bg-background">
        <MessageList
          messages={messages}
          conversationId={currentUser?.id}
          currentUserId={currentUserId}
          reactionUsersById={reactionUsersById}
          onReaction={onReaction}
          isLoading={isLoading}
          isLoadingOlderMessages={isLoadingOlderMessages}
          hasOlderMessages={hasOlderMessages}
          onLoadOlderMessages={requestOlderMessages}
          firstItemIndex={messageFirstItemIndex}
          error={error}
          searchQuery={searchQuery}
          searchMatchIds={searchMatchIds}
          activeSearchMessageId={activeSearchMessageId}
          pinnedMessageIds={pinnedMessageIds}
          readReceiptsByMessageId={readReceiptsByMessageId}
          jumpToMessageSignal={jumpToMessageSignal}
          typingUsers={typingUsers}
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
