import { useEffect, useRef, useState } from 'react';
import EmojiPicker from './EmojiPicker';

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '😡'];
const REVOKED_MESSAGE_TEXT = 'Tin nhắn này đã được thu hồi';

const getReplyPreviewText = (replyTo) => {
  if (!replyTo) return '';
  if (replyTo.isDeleted) return REVOKED_MESSAGE_TEXT;
  return replyTo.content || replyTo.attachment?.filename || 'Tệp đính kèm';
};

const PinGlyph = ({ className = '' }) => (
  <span
    className={`material-symbols-outlined -rotate-45 ${className}`}
    style={{ fontVariationSettings: "'FILL' 1, 'wght' 500, 'GRAD' 0, 'opsz' 20" }}
  >
    push_pin
  </span>
);

const MessageBubble = ({
  message,
  isOwn = false,
  showAvatar = true,
  onReaction,
  onEditMessage,
  onDeleteMessage,
  onReplyMessage,
  onPinMessage,
  onJumpToMessage,
  isPinned = false,
}) => {
  const [showPicker, setShowPicker] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState(null);
  const longPressTimer = useRef(null);
  const messageRef = useRef(null);
  const pickerRef = useRef(null);
  const actionsRef = useRef(null);
  const mobileActionsRef = useRef(null);

  const isRevoked = Boolean(message.isDeleted);
  const canReact = Boolean(message.id) && !isRevoked && message.status !== 'sending';

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    return new Date(timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  };

  useEffect(() => {
    if (!showPicker) return;

    const handlePointerDown = (event) => {
      if (
        messageRef.current?.contains(event.target) ||
        pickerRef.current?.contains(event.target) ||
        actionsRef.current?.contains(event.target) ||
        mobileActionsRef.current?.contains(event.target)
      ) {
        return;
      }

      setShowPicker(false);
      setShowActions(false);
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setShowPicker(false);
        setShowActions(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showPicker]);

  useEffect(() => {
    return () => clearTimeout(longPressTimer.current);
  }, []);

  // Gom reactions theo emoji
  const reactionGroups = (isRevoked ? [] : message.reactions || []).reduce((acc, r) => {
    if (!acc[r.emoji]) acc[r.emoji] = { emoji: r.emoji, count: 0, users: [] };
    acc[r.emoji].count++;
    acc[r.emoji].users.push(r.userId);
    return acc;
  }, {});

  const reactionsList = Object.values(reactionGroups);

  const handleEmojiSelect = (emoji) => {
    setShowPicker(false);
    setShowActions(false);
    if (onReaction) onReaction(message.id, emoji);
  };

  const togglePicker = (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (!canReact) return;
    setShowActions(false);
    setShowPicker((current) => !current);
  };

  const openContextMenu = (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (!canReact) return;
    setShowPicker(true);
    setShowActions(true);
  };

  const handleTouchStart = () => {
    if (!canReact) return;
    longPressTimer.current = setTimeout(() => {
      setShowPicker(true);
      setShowActions(true);
    }, 520);
  };

  const handleTouchEnd = () => {
    clearTimeout(longPressTimer.current);
  };

  const closeMenus = () => {
    setShowPicker(false);
    setShowActions(false);
  };

  const handleCopy = async () => {
    if (message.content) {
      await navigator.clipboard?.writeText(message.content);
    }
    closeMenus();
  };

  const actionItems = [
    {
      key: 'reply',
      label: 'Trả lời',
      icon: 'reply',
      onClick: () => {
        onReplyMessage?.(message);
        closeMenus();
      },
    },
    { key: 'copy', label: 'Sao chép', icon: 'content_copy', onClick: handleCopy },
    {
      key: 'pin',
      label: 'Ghim',
      icon: 'push_pin',
      pinIcon: true,
      onClick: () => {
        onPinMessage?.(message);
        closeMenus();
      },
    },
    ...(isOwn && !isRevoked
      ? [
          {
            key: 'edit',
            label: 'Chỉnh sửa',
            icon: 'edit',
            onClick: () => {
              onEditMessage?.(message);
              closeMenus();
            },
          },
          {
            key: 'delete',
            label: 'Thu hồi',
            icon: 'delete',
            danger: true,
            onClick: () => {
              onDeleteMessage?.(message);
              closeMenus();
            },
          },
        ]
      : []),
    { key: 'forward', label: 'Chuyển tiếp', icon: 'forward' },
  ];

  const avatarSrc =
    message.senderAvatar ||
    'https://lh3.googleusercontent.com/aida-public/AB6AXuBahpFjkcHIiXnez71G-AraliNtmi5v8RquQh32J3n6EOHz1qvVsa2SYxXapR9iaamKNqQ30JzpziX2OAreG_C-9h3wCctRkHorqJ01Yo1MdgqGjvfPRhctrnu7ARwCdwvHK1fl42HCqMJ1A8sbW5bbHtGPpcdjeETYrHqW5A8y82nlhgH6kIfDZUHoGLWDZh1CnnzHQXHoYKEVy3EPNv_qviB9kBtZtTURL2tkJ8kXPpmPaIssR1Y1sPBi9mqbn6eO6qnCSw6q6xLP';

  return (
    <>
      {/* Lightbox */}
      {lightboxSrc && (
        <div
          className="fixed inset-0 z-50 flex cursor-pointer items-center justify-center bg-[#111111]/92"
          onClick={() => setLightboxSrc(null)}
        >
          <button
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-lg border border-white/15 bg-white/10 text-white transition-colors hover:bg-white/20"
            onClick={() => setLightboxSrc(null)}
          >
            <span className="material-symbols-outlined text-2xl">close</span>
          </button>
          <img
            src={lightboxSrc}
            alt="Ảnh trong tin nhắn"
            className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      <div
        className={`group flex animate-message-pop items-end gap-2 ${isOwn ? 'flex-row-reverse' : ''}`}
      >
        {/* Avatar */}
        <div className={`hidden w-7 shrink-0 md:block ${showAvatar ? '' : 'invisible'}`}>
          {!isOwn && (
            <div className="h-7 w-7 overflow-hidden rounded-full border border-outline-variant">
              <img src={avatarSrc} alt="Người gửi" className="h-full w-full object-cover" />
            </div>
          )}
        </div>

        {/* Bubble column */}
        <div
          className={`flex max-w-[82%] flex-col gap-1 md:max-w-[74%] ${isOwn ? 'items-end' : 'items-start'}`}
        >
          {/* Sender name */}
          {!isOwn && showAvatar && message.senderName && (
            <span className="ml-0.5 px-1 text-[11px] font-medium text-on-surface-variant">
              {message.senderName}
            </span>
          )}

          <div
            ref={messageRef}
            className="relative inline-flex max-w-full flex-col items-stretch gap-1"
            onContextMenu={openContextMenu}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchEnd}
          >
            {isPinned && !isRevoked && (
              <span
                className={`absolute -top-2 z-10 flex h-5 min-w-5 items-center justify-center rounded-full border border-[#d7c7b5] bg-accent-soft px-1 text-on-surface shadow-[0_4px_12px_rgba(40,37,32,0.1)] ${
                  isOwn ? 'right-0.5' : 'left-0.5'
                }`}
                title="Tin nhắn đã ghim"
              >
                <PinGlyph className="text-[13px]" />
              </span>
            )}

            {message.replyTo && !isRevoked && (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onJumpToMessage?.(message.replyTo.id);
                }}
                className={`max-w-[min(360px,68vw)] rounded-md border-l-2 border-accent bg-surface-container-low px-3 py-2 text-left transition-colors hover:bg-surface-container-high ${
                  isOwn ? 'self-end' : 'self-start'
                }`}
                title="Đi tới tin nhắn gốc"
              >
                <p className="truncate text-xs font-semibold text-on-surface">
                  {message.replyTo.senderName || 'Tin nhắn'}
                </p>
                <p className="truncate text-xs text-on-surface-variant">
                  {getReplyPreviewText(message.replyTo)}
                </p>
              </button>
            )}

            {/* Nội dung: image / file / text */}
            {isRevoked ? (
              <div
                className={`inline-flex items-center gap-2 rounded-lg border border-dashed border-outline-variant bg-surface-container-low px-4 py-2.5 text-[14px] italic text-on-surface-variant shadow-[0_2px_10px_rgba(40,37,32,0.02)] ${
                  isOwn ? 'text-right' : ''
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">block</span>
                <span>Tin nhắn này đã được thu hồi</span>
              </div>
            ) : message.attachment?.type === 'image' ? (
              <img
                src={message.attachment.url}
                alt={message.attachment.filename || 'Ảnh trong tin nhắn'}
                className="max-h-[360px] w-[min(520px,72vw)] cursor-pointer rounded-lg border border-outline-variant object-cover shadow-[0_2px_12px_rgba(40,37,32,0.05)] transition-opacity hover:opacity-90"
                onClick={() => setLightboxSrc(message.attachment.url)}
              />
            ) : message.attachment?.type === 'file' ? (
              <a
                href={message.attachment.url}
                download={message.attachment.filename}
                className="flex min-w-[240px] max-w-[360px] items-center gap-3 rounded-lg border border-outline-variant bg-surface-container-lowest px-4 py-3 shadow-[0_2px_10px_rgba(40,37,32,0.03)] transition-colors hover:bg-surface-container-low"
                onClick={(e) => e.stopPropagation()}
              >
                <span className="material-symbols-outlined shrink-0 text-3xl text-on-surface">
                  description
                </span>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium text-on-surface">
                    {message.attachment.filename}
                  </p>
                  <p className="text-[11px] text-on-surface-variant">
                    {Math.round(message.attachment.size / 1024)} KB
                  </p>
                </div>
                <span className="material-symbols-outlined shrink-0 text-xl text-on-surface-variant">
                  download
                </span>
              </a>
            ) : (
              <div
                className={`rounded-lg px-4 py-2.5 text-[15px] leading-relaxed break-words shadow-[0_2px_10px_rgba(40,37,32,0.03)] ${
                  isOwn
                    ? 'border border-[#ded1c1] bg-accent-soft text-on-surface'
                    : 'border border-outline-variant bg-surface-container-lowest text-on-surface'
                }`}
              >
                <span className="whitespace-pre-wrap">{message.content}</span>
              </div>
            )}

            {canReact && (
              <button
                type="button"
                aria-label="Thả cảm xúc"
                title="Thả cảm xúc"
                className={`absolute top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-outline-variant bg-surface-container-lowest text-on-surface-variant shadow-[0_2px_10px_rgba(40,37,32,0.08)] transition-all hover:bg-surface-container-low hover:text-on-surface focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 group-hover:opacity-100 ${
                  showPicker ? 'opacity-100' : 'opacity-0'
                } ${isOwn ? 'right-full mr-1.5' : 'left-full ml-1.5'}`}
                onClick={togglePicker}
              >
                <span className="material-symbols-outlined text-[18px]">add_reaction</span>
              </button>
            )}

            {showPicker && (
              <div
                ref={pickerRef}
                className={`absolute bottom-full z-20 mb-2 ${isOwn ? 'right-0' : 'left-0'} ${showActions ? 'hidden md:block' : ''}`}
                onContextMenu={(event) => event.preventDefault()}
              >
                <EmojiPicker emojis={QUICK_EMOJIS} onSelect={handleEmojiSelect} />
              </div>
            )}

            {showActions && (
              <div
                ref={actionsRef}
                className={`absolute top-full z-20 mt-2 hidden w-52 overflow-hidden rounded-lg border border-outline-variant bg-surface-container-lowest py-1 shadow-[0_16px_40px_rgba(40,37,32,0.14)] md:block ${
                  isOwn ? 'right-0' : 'left-0'
                }`}
                onContextMenu={(event) => event.preventDefault()}
              >
                {actionItems.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={item.onClick || closeMenus}
                    className={`flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors hover:bg-surface-container-low ${
                      item.danger ? 'text-error' : 'text-on-surface'
                    }`}
                  >
                    <span
                      className={`material-symbols-outlined text-[20px] ${
                        item.pinIcon ? '-rotate-45' : ''
                      }`}
                      style={
                        item.pinIcon
                          ? { fontVariationSettings: "'FILL' 1, 'wght' 500, 'GRAD' 0, 'opsz' 20" }
                          : undefined
                      }
                    >
                      {item.icon}
                    </span>
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Reactions */}
          {reactionsList.length > 0 && (
            <div className="mt-0.5 flex flex-wrap gap-1">
              {reactionsList.map(({ emoji, count }) => (
                <span
                  key={emoji}
                  className="inline-flex items-center gap-1 rounded-full border border-outline-variant bg-surface-container-lowest px-2 py-0.5 text-xs text-on-surface shadow-[0_1px_4px_rgba(40,37,32,0.04)]"
                >
                  {emoji} {count}
                </span>
              ))}
            </div>
          )}

          {/* Timestamp + status */}
          <span className={`px-1 text-[11px] text-on-surface-variant ${isOwn ? 'text-right' : ''}`}>
            {formatTime(message.timestamp)}
            {!isRevoked && message.isEdited && <span className="ml-1">Đã sửa</span>}
            {isOwn && (
              <span className="ml-1">
                {message.status === 'sending'
                  ? 'Đang gửi'
                  : message.status === 'read'
                    ? 'Đã đọc'
                    : message.status === 'delivered'
                      ? 'Đã nhận'
                      : 'Đã gửi'}
              </span>
            )}
          </span>
        </div>
      </div>

      {showActions && (
        <div
          className="fixed inset-0 z-40 bg-[#1f1d1a]/38 backdrop-blur-[1px] md:hidden"
          onClick={closeMenus}
        >
          <div
            ref={mobileActionsRef}
            className="absolute inset-x-4 bottom-4"
            onClick={(event) => event.stopPropagation()}
            onContextMenu={(event) => event.preventDefault()}
          >
            <div className="mb-3 flex justify-center">
              <EmojiPicker emojis={QUICK_EMOJIS} onSelect={handleEmojiSelect} />
            </div>
            <div className="overflow-hidden rounded-2xl border border-outline-variant bg-surface-container-lowest shadow-[0_18px_50px_rgba(40,37,32,0.16)]">
              {actionItems.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={item.onClick || closeMenus}
                  className={`flex h-14 w-full items-center gap-4 border-b border-outline-variant px-5 text-left text-[15px] last:border-b-0 ${
                    item.danger ? 'text-error' : 'text-on-surface'
                  }`}
                >
                  <span
                    className={`material-symbols-outlined text-[22px] ${
                      item.pinIcon ? '-rotate-45' : ''
                    }`}
                    style={
                      item.pinIcon
                        ? { fontVariationSettings: "'FILL' 1, 'wght' 500, 'GRAD' 0, 'opsz' 20" }
                        : undefined
                    }
                  >
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={closeMenus}
              className="mt-3 h-14 w-full rounded-2xl border border-outline-variant bg-surface-container-lowest text-[15px] font-semibold text-on-surface shadow-[0_12px_30px_rgba(40,37,32,0.12)]"
            >
              Hủy
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default MessageBubble;
