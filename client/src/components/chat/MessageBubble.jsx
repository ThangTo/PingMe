import { useEffect, useRef, useState } from 'react';
import EmojiPicker from './EmojiPicker';

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '😡'];
const REVOKED_MESSAGE_TEXT = 'Tin nhắn này đã được thu hồi';

const getMessageAttachments = (message = {}) => {
  if (message.isDeleted) return [];
  if (Array.isArray(message.attachments) && message.attachments.length > 0) {
    return message.attachments;
  }
  return message.attachment ? [message.attachment] : [];
};

const getReplyPreviewText = (replyTo) => {
  if (!replyTo) return '';
  if (replyTo.isDeleted) return REVOKED_MESSAGE_TEXT;

  const attachments = getMessageAttachments(replyTo);
  if (replyTo.content) return replyTo.content;
  if (attachments.length === 1) return attachments[0].filename || 'Tệp đính kèm';
  if (attachments.length > 1 && attachments.every((item) => item.type === 'image')) {
    return `${attachments.length} ảnh`;
  }
  if (attachments.length > 1) return `${attachments.length} tệp đính kèm`;
  return 'Tệp đính kèm';
};

const formatFileSize = (size = 0) => {
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

const PinGlyph = ({ className = '' }) => (
  <span
    className={`material-symbols-outlined -rotate-45 ${className}`}
    style={{ fontVariationSettings: "'FILL' 1, 'wght' 500, 'GRAD' 0, 'opsz' 20" }}
  >
    push_pin
  </span>
);

const getReceiptAvatarSrc = (receipt) => {
  if (receipt.avatar) return receipt.avatar;

  const name = encodeURIComponent(receipt.name || 'User');
  return `https://ui-avatars.com/api/?name=${name}&background=d9c8b4&color=2a2520&bold=true`;
};

const getReceiptSummary = (receipts = []) => {
  const names = [...new Set(receipts.map((receipt) => receipt.name || 'Người dùng'))];

  if (names.length === 0) return '';
  if (names.length === 1) return `${names[0]} đã xem`;
  if (names.length === 2) return `${names[0]}, ${names[1]} đã xem`;

  return `${names[0]}, ${names[1]} và ${names.length - 2} người khác đã xem`;
};

const MessageBubble = ({
  message,
  isOwn = false,
  showAvatar = true,
  readReceipts = [],
  onReaction,
  onEditMessage,
  onDeleteMessage,
  onReplyMessage,
  onPinMessage,
  onJumpToMessage,
  isPinned = false,
  reactionUsersById = {},
  isActionMenuOpen = false,
  onOpenActionMenu,
  onCloseActionMenu,
}) => {
  const [showPicker, setShowPicker] = useState(false);
  const [activeReactionEmoji, setActiveReactionEmoji] = useState(null);
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const longPressTimer = useRef(null);
  const lightboxTouchStartX = useRef(null);
  const messageRef = useRef(null);
  const reactionDetailsRef = useRef(null);
  const pickerRef = useRef(null);
  const actionsRef = useRef(null);
  const mobileActionsRef = useRef(null);

  const isRevoked = Boolean(message.isDeleted);
  const canReact = Boolean(message.id) && !isRevoked && message.status !== 'sending';
  const attachments = getMessageAttachments(message);
  const imageAttachments = attachments.filter((attachment) => attachment.type === 'image');
  const fileAttachments = attachments.filter((attachment) => attachment.type !== 'image');
  const hasAttachments = attachments.length > 0;
  const activeLightboxImage =
    lightboxIndex === null ? null : imageAttachments[lightboxIndex] || null;
  const showActions = isActionMenuOpen;

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    return new Date(timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  };

  const openLightbox = (index) => {
    setLightboxIndex(index);
  };

  const closeLightbox = () => {
    setLightboxIndex(null);
    lightboxTouchStartX.current = null;
  };

  const showPrevImage = (event) => {
    event?.stopPropagation();
    setLightboxIndex((current) => {
      if (current === null || imageAttachments.length === 0) return current;
      return current === 0 ? imageAttachments.length - 1 : current - 1;
    });
  };

  const showNextImage = (event) => {
    event?.stopPropagation();
    setLightboxIndex((current) => {
      if (current === null || imageAttachments.length === 0) return current;
      return current === imageAttachments.length - 1 ? 0 : current + 1;
    });
  };

  const handleLightboxTouchStart = (event) => {
    lightboxTouchStartX.current = event.touches[0]?.clientX ?? null;
  };

  const handleLightboxTouchEnd = (event) => {
    if (lightboxTouchStartX.current === null) return;

    const touchEndX = event.changedTouches[0]?.clientX ?? lightboxTouchStartX.current;
    const deltaX = touchEndX - lightboxTouchStartX.current;
    lightboxTouchStartX.current = null;

    if (Math.abs(deltaX) < 48 || imageAttachments.length <= 1) return;
    if (deltaX < 0) showNextImage(event);
    else showPrevImage(event);
  };

  useEffect(() => {
    if (!showPicker && !showActions) return undefined;

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
      onCloseActionMenu?.();
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setShowPicker(false);
        onCloseActionMenu?.();
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onCloseActionMenu, showActions, showPicker]);

  useEffect(() => {
    if (!activeReactionEmoji) return undefined;

    const handlePointerDown = (event) => {
      if (reactionDetailsRef.current?.contains(event.target)) return;
      setActiveReactionEmoji(null);
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setActiveReactionEmoji(null);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeReactionEmoji]);

  useEffect(() => {
    if (lightboxIndex === null) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setLightboxIndex(null);
        return;
      }

      if (imageAttachments.length <= 1) return;

      if (event.key === 'ArrowLeft') {
        setLightboxIndex((current) => {
          if (current === null) return current;
          return current === 0 ? imageAttachments.length - 1 : current - 1;
        });
      }

      if (event.key === 'ArrowRight') {
        setLightboxIndex((current) => {
          if (current === null) return current;
          return current === imageAttachments.length - 1 ? 0 : current + 1;
        });
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [lightboxIndex, imageAttachments.length]);

  useEffect(() => {
    return () => clearTimeout(longPressTimer.current);
  }, []);

  const reactionGroups = (isRevoked ? [] : message.reactions || []).reduce((acc, r) => {
    if (!acc[r.emoji]) acc[r.emoji] = { emoji: r.emoji, count: 0, users: [] };
    const userId = r.userId?.toString?.() || r.userId || '';
    const reactionUser = reactionUsersById[userId];

    acc[r.emoji].count++;
    acc[r.emoji].users.push({
      id: userId,
      name: reactionUser?.name || r.userName || 'Người dùng',
      avatar: reactionUser?.avatar || '',
    });
    return acc;
  }, {});

  const reactionsList = Object.values(reactionGroups);
  const pinnedBadge =
    isPinned && !isRevoked ? (
      <span
        className={`absolute -top-2 z-10 flex h-5 min-w-5 items-center justify-center rounded-full border border-[#d7c7b5] bg-accent-soft px-1 text-on-surface shadow-[0_4px_12px_rgba(40,37,32,0.1)] ${
          isOwn ? 'right-0.5' : 'left-0.5'
        }`}
        title="Tin nhắn đã ghim"
      >
        <PinGlyph className="text-[13px]" />
      </span>
    ) : null;

  const closeMenus = () => {
    setShowPicker(false);
    onCloseActionMenu?.();
    setActiveReactionEmoji(null);
  };

  const handleEmojiSelect = (emoji) => {
    closeMenus();
    if (onReaction) onReaction(message.id, emoji);
  };

  const togglePicker = (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (!canReact) return;
    onCloseActionMenu?.();
    setShowPicker((current) => !current);
  };

  const openContextMenu = (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (!canReact) return;
    setShowPicker(false);
    onOpenActionMenu?.();
  };

  const handleTouchStart = () => {
    if (!canReact) return;
    longPressTimer.current = setTimeout(() => {
      setShowPicker(true);
      onOpenActionMenu?.();
    }, 520);
  };

  const handleTouchEnd = () => {
    clearTimeout(longPressTimer.current);
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
  const deliveryText =
    isOwn && !isRevoked
      ? message.status === 'sending'
        ? 'Đang gửi'
        : message.status === 'delivered'
          ? 'Đã nhận'
          : message.status === 'read'
            ? ''
            : 'Đã gửi'
      : '';
  const receiptSummary = getReceiptSummary(readReceipts);

  return (
    <>
      {activeLightboxImage && (
        <div
          className="fixed inset-0 z-50 flex cursor-pointer items-center justify-center bg-[#111111]/92 px-4 py-6"
          onClick={closeLightbox}
          onTouchStart={handleLightboxTouchStart}
          onTouchEnd={handleLightboxTouchEnd}
        >
          <button
            type="button"
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-lg border border-white/15 bg-white/10 text-white transition-colors hover:bg-white/20"
            onClick={closeLightbox}
          >
            <span className="material-symbols-outlined text-2xl">close</span>
          </button>

          {imageAttachments.length > 1 && (
            <>
              <button
                type="button"
                className="absolute left-3 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white transition-colors hover:bg-white/20 md:flex"
                onClick={showPrevImage}
                title="Ảnh trước"
              >
                <span className="material-symbols-outlined text-[28px]">chevron_left</span>
              </button>
              <button
                type="button"
                className="absolute right-3 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white transition-colors hover:bg-white/20 md:flex"
                onClick={showNextImage}
                title="Ảnh sau"
              >
                <span className="material-symbols-outlined text-[28px]">chevron_right</span>
              </button>
            </>
          )}

          <img
            src={activeLightboxImage.url}
            alt={activeLightboxImage.filename || 'Ảnh trong tin nhắn'}
            className="max-h-[84vh] max-w-[92vw] rounded-lg object-contain"
            onClick={(event) => event.stopPropagation()}
          />

          {imageAttachments.length > 1 && (
            <div
              className="absolute inset-x-4 bottom-4 flex flex-col items-center gap-3"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
                {(lightboxIndex || 0) + 1} / {imageAttachments.length}
              </div>
              <div className="no-scrollbar flex max-w-full gap-2 overflow-x-auto">
                {imageAttachments.map((attachment, index) => (
                  <button
                    key={`${attachment.url}-${index}`}
                    type="button"
                    onClick={() => setLightboxIndex(index)}
                    className={`h-12 w-12 shrink-0 overflow-hidden rounded-md border transition ${
                      index === lightboxIndex
                        ? 'border-white opacity-100'
                        : 'border-white/20 opacity-55 hover:opacity-85'
                    }`}
                  >
                    <img
                      src={attachment.url}
                      alt={attachment.filename || 'Ảnh trong album'}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div
        className={`group flex animate-message-pop items-end gap-2 ${isOwn ? 'flex-row-reverse' : ''}`}
      >
        <div className={`hidden w-7 shrink-0 md:block ${showAvatar ? '' : 'invisible'}`}>
          {!isOwn && (
            <div className="h-7 w-7 overflow-hidden rounded-full border border-outline-variant">
              <img src={avatarSrc} alt="Người gửi" className="h-full w-full object-cover" />
            </div>
          )}
        </div>

        <div
          className={`flex max-w-[82%] flex-col gap-1 md:max-w-[74%] ${isOwn ? 'items-end' : 'items-start'}`}
        >
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

            {isRevoked ? (
              <div
                className={`inline-flex items-center gap-2 rounded-lg border border-dashed border-outline-variant bg-surface-container-low px-4 py-2.5 text-[14px] italic text-on-surface-variant shadow-[0_2px_10px_rgba(40,37,32,0.02)] ${
                  isOwn ? 'text-right' : ''
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">block</span>
                <span>{REVOKED_MESSAGE_TEXT}</span>
              </div>
            ) : (
              <div
                className={`relative flex max-w-[min(540px,74vw)] flex-col gap-1 ${isOwn ? 'items-end' : 'items-start'}`}
              >
                {pinnedBadge}
                {imageAttachments.length > 0 && (
                  <>
                    <div className="md:hidden">
                      {imageAttachments.length === 1 ? (
                        <button
                          type="button"
                          onClick={() => openLightbox(0)}
                          className="block w-[min(330px,72vw)] overflow-hidden rounded-lg border border-outline-variant bg-surface-container-lowest shadow-[0_2px_12px_rgba(40,37,32,0.05)] transition-opacity hover:opacity-90"
                        >
                          <img
                            src={imageAttachments[0].url}
                            alt={imageAttachments[0].filename || 'Ảnh trong tin nhắn'}
                            className="max-h-[360px] w-full object-cover"
                            loading="lazy"
                          />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => openLightbox(0)}
                          className="relative h-[270px] w-[min(350px,74vw)] overflow-visible px-2 py-3"
                        >
                          {imageAttachments[3] && (
                            <span className="absolute left-0 top-11 h-[204px] w-[72%] overflow-hidden rounded-lg border border-outline-variant bg-surface-container-low opacity-65 shadow-[0_8px_22px_rgba(40,37,32,0.1)] -rotate-6">
                              <img
                                src={imageAttachments[3].url}
                                alt=""
                                className="h-full w-full object-cover"
                                loading="lazy"
                              />
                            </span>
                          )}
                          {imageAttachments[2] && (
                            <span className="absolute right-0 top-8 h-[214px] w-[74%] overflow-hidden rounded-lg border border-outline-variant bg-surface-container-low opacity-75 shadow-[0_8px_22px_rgba(40,37,32,0.12)] rotate-6">
                              <img
                                src={imageAttachments[2].url}
                                alt=""
                                className="h-full w-full object-cover"
                                loading="lazy"
                              />
                            </span>
                          )}
                          <span className="absolute left-7 top-5 h-[222px] w-[76%] overflow-hidden rounded-lg border border-outline-variant bg-surface-container-lowest opacity-90 shadow-[0_8px_22px_rgba(40,37,32,0.12)] -rotate-3">
                            <img
                              src={imageAttachments[1]?.url}
                              alt=""
                              className="h-full w-full object-cover"
                              loading="lazy"
                            />
                          </span>
                          <span className="relative z-20 mx-auto block h-[230px] w-[82%] overflow-hidden rounded-lg border border-outline-variant bg-surface-container-lowest shadow-[0_12px_30px_rgba(40,37,32,0.18)] rotate-1">
                            <img
                              src={imageAttachments[0].url}
                              alt={imageAttachments[0].filename || 'Ảnh trong tin nhắn'}
                              className="h-full w-full object-cover"
                              loading="lazy"
                            />
                          </span>
                          <span className="absolute right-2 top-2 z-30 rounded-full border border-white/25 bg-[#1f1d1a]/70 px-2.5 py-1 text-xs font-semibold text-white shadow-[0_4px_14px_rgba(0,0,0,0.2)]">
                            1 / {imageAttachments.length}
                          </span>
                          <span className="absolute bottom-2 left-1/2 z-30 -translate-x-1/2 rounded-full border border-outline-variant bg-surface-container-lowest px-3 py-1 text-[11px] font-semibold text-on-surface shadow-[0_6px_18px_rgba(40,37,32,0.12)]">
                            {imageAttachments.length} ảnh
                          </span>
                        </button>
                      )}
                    </div>

                    <div
                      className={`hidden overflow-hidden rounded-lg border border-outline-variant bg-surface-container-lowest shadow-[0_2px_12px_rgba(40,37,32,0.05)] md:grid ${
                        imageAttachments.length === 1
                          ? 'w-[min(520px,72vw)] grid-cols-1'
                          : 'w-[min(520px,72vw)] grid-cols-2 gap-1 p-1'
                      }`}
                    >
                      {imageAttachments.slice(0, 4).map((attachment, index) => {
                        const remainingCount = imageAttachments.length - 4;
                        const showOverlay = index === 3 && remainingCount > 0;

                        return (
                          <button
                            key={`${attachment.url}-${index}`}
                            type="button"
                            onClick={() => openLightbox(showOverlay ? 4 : index)}
                            className={`relative block overflow-hidden bg-surface-container-low transition-opacity hover:opacity-90 ${
                              imageAttachments.length === 1 ? '' : 'rounded-md'
                            }`}
                          >
                            <img
                              src={attachment.url}
                              alt={attachment.filename || 'Ảnh trong tin nhắn'}
                              className={`w-full cursor-pointer object-cover ${
                                imageAttachments.length === 1
                                  ? 'max-h-[360px]'
                                  : imageAttachments.length === 2
                                    ? 'aspect-square'
                                    : 'aspect-[4/3]'
                              }`}
                              loading="lazy"
                            />
                            {showOverlay && (
                              <span className="absolute inset-0 flex items-center justify-center bg-[#1f1d1a]/55 text-lg font-semibold text-white">
                                +{remainingCount}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}

                {fileAttachments.length > 0 && (
                  <div className="flex w-[min(420px,74vw)] flex-col gap-2">
                    {fileAttachments.map((attachment, index) => (
                      <a
                        key={`${attachment.url}-${index}`}
                        href={attachment.url}
                        download={attachment.filename}
                        className="flex min-w-[240px] items-center gap-3 rounded-lg border border-outline-variant bg-surface-container-lowest px-4 py-3 shadow-[0_2px_10px_rgba(40,37,32,0.03)] transition-colors hover:bg-surface-container-low"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <span className="material-symbols-outlined shrink-0 text-3xl text-on-surface">
                          description
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="truncate text-sm font-medium text-on-surface">
                            {attachment.filename}
                          </p>
                          <p className="text-[11px] text-on-surface-variant">
                            {formatFileSize(attachment.size)}
                          </p>
                        </div>
                        <span className="material-symbols-outlined shrink-0 text-xl text-on-surface-variant">
                          download
                        </span>
                      </a>
                    ))}
                  </div>
                )}

                {message.content || !hasAttachments ? (
                  <div
                    className={`rounded-lg px-4 py-2.5 text-[15px] leading-relaxed break-words shadow-[0_2px_10px_rgba(40,37,32,0.03)] ${
                      isOwn
                        ? 'border border-[#ded1c1] bg-accent-soft text-on-surface'
                        : 'border border-outline-variant bg-surface-container-lowest text-on-surface'
                    } ${hasAttachments ? 'max-w-[min(520px,72vw)]' : ''}`}
                  >
                    <span className="whitespace-pre-wrap">{message.content}</span>
                  </div>
                ) : null}
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
                className={`absolute bottom-full z-[90] mb-2 ${isOwn ? 'right-0' : 'left-0'} ${showActions ? 'hidden md:block' : ''}`}
                onContextMenu={(event) => event.preventDefault()}
              >
                <EmojiPicker emojis={QUICK_EMOJIS} onSelect={handleEmojiSelect} />
              </div>
            )}

            {showActions && (
              <div
                ref={actionsRef}
                className={`absolute top-1/2 z-[200] hidden w-52 -translate-y-1/2 overflow-hidden rounded-lg border border-outline-variant bg-surface-container-lowest py-1 shadow-[0_18px_48px_rgba(40,37,32,0.18)] md:block ${
                  isOwn ? 'right-full mr-3' : 'left-full ml-3'
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

          {reactionsList.length > 0 && (
            <div className="mt-0.5 flex flex-wrap gap-1">
              {reactionsList.map(({ emoji, count, users }) => (
                <span key={emoji} ref={activeReactionEmoji === emoji ? reactionDetailsRef : null} className="relative">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      setActiveReactionEmoji((current) => (current === emoji ? null : emoji));
                    }}
                    className="inline-flex items-center gap-1 rounded-full border border-outline-variant bg-surface-container-lowest px-2 py-0.5 text-xs text-on-surface shadow-[0_1px_4px_rgba(40,37,32,0.04)] transition-colors hover:bg-surface-container-low"
                    title={users.map((reactionUser) => `${reactionUser.name}: ${emoji}`).join('\n')}
                  >
                    {emoji} {count}
                  </button>

                  {activeReactionEmoji === emoji && (
                    <div
                      className={`absolute bottom-full z-30 mb-2 min-w-44 max-w-64 rounded-lg border border-outline-variant bg-surface-container-lowest p-2 text-left shadow-[0_14px_34px_rgba(40,37,32,0.14)] ${
                        isOwn ? 'right-0' : 'left-0'
                      }`}
                    >
                      <div className="mb-1 flex items-center gap-2 border-b border-outline-variant px-2 pb-2 text-xs font-semibold text-on-surface">
                        <span>{emoji}</span>
                        <span>{count} reaction</span>
                      </div>
                      <div className="max-h-44 overflow-y-auto">
                        {users.map((reactionUser, index) => (
                          <div
                            key={`${reactionUser.id}-${emoji}-${index}`}
                            className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-xs text-on-surface hover:bg-surface-container-low"
                          >
                            <span className="truncate">{reactionUser.name}</span>
                            <span className="shrink-0">{emoji}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </span>
              ))}
            </div>
          )}

          <span className={`px-1 text-[11px] text-on-surface-variant ${isOwn ? 'text-right' : ''}`}>
            {formatTime(message.timestamp)}
            {!isRevoked && message.isEdited && <span className="ml-1">Đã sửa</span>}
            {deliveryText && <span className="ml-1">{deliveryText}</span>}
          </span>

          {readReceipts.length > 0 && (
            <div className={`mt-0.5 flex px-1 ${isOwn ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`group/read-receipt relative flex items-center ${
                  isOwn ? '-space-x-1.5 space-x-reverse' : '-space-x-1.5'
                }`}
                tabIndex={0}
                aria-label={receiptSummary}
              >
                {readReceipts.slice(0, 5).map((receipt) => (
                  <span
                    key={receipt.id}
                    className="block h-4 w-4 min-w-4 max-w-4 flex-none overflow-hidden rounded-full border border-surface bg-surface-container-low shadow-[0_2px_6px_rgba(40,37,32,0.16)]"
                  >
                    <img
                      src={getReceiptAvatarSrc(receipt)}
                      alt={`${receipt.name || 'Người dùng'} đã đọc`}
                      className="block h-full w-full rounded-full object-cover"
                      loading="lazy"
                    />
                  </span>
                ))}
                {readReceipts.length > 5 && (
                  <span className="flex h-4 min-w-4 flex-none items-center justify-center rounded-full border border-surface bg-surface-container-low px-1 text-[9px] font-semibold text-on-surface-variant shadow-[0_2px_6px_rgba(40,37,32,0.12)]">
                    +{readReceipts.length - 5}
                  </span>
                )}
                <span
                  className={`pointer-events-none absolute bottom-full z-[80] mb-2 w-max max-w-[240px] rounded-md border border-outline-variant bg-[#2f2a24] px-2.5 py-1.5 text-center text-[11px] font-medium leading-4 text-white opacity-0 shadow-[0_12px_28px_rgba(40,37,32,0.2)] transition-opacity duration-150 group-hover/read-receipt:opacity-100 group-focus/read-receipt:opacity-100 ${
                    isOwn ? 'right-0' : 'left-0'
                  }`}
                >
                  {receiptSummary}
                </span>
              </div>
            </div>
          )}
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
