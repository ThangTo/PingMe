import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import EmojiPicker from './EmojiPicker';
import PollMessageCard from './PollMessageCard';
import EventMessageCard from './EventMessageCard';
import ChecklistMessageCard from './ChecklistMessageCard';
import PlanMessageCard from './PlanMessageCard';
import FileTypeIcon from '../ui/FileTypeIcon';
import AppIcon from '../ui/AppIcon';
import StickerArtwork from '../ui/StickerArtwork';

const MESSAGE_URL_REGEX = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;
const TRAILING_URL_PUNCTUATION_REGEX = /[),.!?:;]+$/;
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
  if (replyTo.messageType === 'poll') {
    return `Bình chọn: ${replyTo.poll?.question || replyTo.content || 'Bình chọn'}`;
  }

  if (replyTo.messageType === 'event') {
    return `Sự kiện: ${replyTo.event?.title || replyTo.content || 'Sự kiện'}`;
  }

  if (replyTo.messageType === 'checklist') {
    return `Checklist: ${replyTo.checklist?.title || replyTo.content || 'Checklist'}`;
  }

  if (replyTo.messageType === 'plan') {
    return `Kế hoạch: ${replyTo.plan?.title || replyTo.content || 'Kế hoạch'}`;
  }

  const attachments = getMessageAttachments(replyTo);
  if (replyTo.content) return replyTo.content;
  if (replyTo.messageType === 'sticker' || replyTo.sticker?.url) {
    return replyTo.sticker?.name ? `Nhãn dán: ${replyTo.sticker.name}` : 'Đã gửi nhãn dán';
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

const getEvolutionSourceText = (message = {}) => {
  if (message.isDeleted) return '';
  if (message.messageType === 'poll') return message.poll?.question || message.content || '';
  if (message.messageType === 'event') return message.event?.title || message.content || '';
  if (message.messageType === 'checklist') return message.checklist?.title || message.content || '';
  if (message.messageType === 'plan') return message.plan?.title || message.content || '';
  if (message.messageType === 'sticker' || message.sticker?.url) {
    return message.sticker?.name ? `Nhãn dán: ${message.sticker.name}` : 'Nhãn dán';
  }
  if (typeof message.content === 'string' && message.content.trim()) return message.content.trim();

  const attachment = getMessageAttachments(message)[0];
  if (!attachment) return '';
  if (attachment.filename) return attachment.filename;
  if (attachment.type === 'image') return 'Ảnh';
  if (attachment.type === 'audio') return 'Tin nhắn thoại';
  if (attachment.type === 'video') return 'Video';
  return 'Tệp đính kèm';
};

const SourceMessageLink = ({ sourceMessage, onJumpToMessage }) => {
  if (!sourceMessage?.messageId) return null;

  const preview = sourceMessage.content || 'Tin nhắn nguồn';

  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onJumpToMessage?.(sourceMessage.messageId);
      }}
      className="mb-2 flex w-full min-w-0 items-start gap-2 rounded-[9px] border border-outline-variant bg-surface px-2.5 py-2 text-left text-xs text-on-surface-variant transition hover:bg-surface-container-low hover:text-on-surface"
      title="Xem tin nhắn gốc"
    >
      <AppIcon name="reply" className="mt-0.5 shrink-0 text-[14px]" />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold text-on-surface">
          Từ tin nhắn của {sourceMessage.senderName || 'người dùng'}
        </span>
        <span className="line-clamp-2 break-words [overflow-wrap:anywhere]">{preview}</span>
      </span>
    </button>
  );
};

const formatFileSize = (size = 0) => {
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

const formatVoiceDuration = (seconds = 0) => {
  const safeSeconds = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

const formatMessageTime = (timestamp) => {
  if (!timestamp) return '';
  return new Date(timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
};

const normalizeLinkHref = (url) => (/^https?:\/\//i.test(url) ? url : `https://${url}`);

const stopInteractiveBubbleEvent = (event) => {
  event.stopPropagation();
};

const isInteractiveMessageTarget = (target) =>
  Boolean(
    target?.closest?.(
      'a, button, input, textarea, select, audio, video, [role="button"], [data-message-interactive="true"]',
    ),
  );

const renderMessageContent = (content = '') => {
  if (!content) return null;

  const parts = [];
  let lastIndex = 0;
  MESSAGE_URL_REGEX.lastIndex = 0;

  for (const match of content.matchAll(MESSAGE_URL_REGEX)) {
    const rawUrl = match[0];
    const startIndex = match.index ?? 0;

    if (startIndex > lastIndex) {
      parts.push(content.slice(lastIndex, startIndex));
    }

    const displayUrl = rawUrl.replace(TRAILING_URL_PUNCTUATION_REGEX, '');
    const trailingText = rawUrl.slice(displayUrl.length);

    parts.push(
      <a
        key={`${displayUrl}-${startIndex}`}
        href={normalizeLinkHref(displayUrl)}
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium text-primary underline decoration-primary/35 underline-offset-2 transition-colors [overflow-wrap:anywhere] hover:text-primary-dark hover:decoration-primary"
        onClick={stopInteractiveBubbleEvent}
        onPointerDown={stopInteractiveBubbleEvent}
        onTouchStart={stopInteractiveBubbleEvent}
        onContextMenu={stopInteractiveBubbleEvent}
      >
        {displayUrl}
      </a>,
    );

    if (trailingText) {
      parts.push(trailingText);
    }

    lastIndex = startIndex + rawUrl.length;
  }

  if (lastIndex < content.length) {
    parts.push(content.slice(lastIndex));
  }

  return parts;
};

const LinkPreviewCard = ({ preview }) => {
  if (!preview?.url) return null;

  return (
    <a
      href={preview.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block w-[min(430px,72vw)] overflow-hidden rounded-[12px] border border-outline-variant bg-surface-container-lowest text-left transition-colors hover:bg-surface-container-low"
      onClick={stopInteractiveBubbleEvent}
      onPointerDown={stopInteractiveBubbleEvent}
      onTouchStart={stopInteractiveBubbleEvent}
      onContextMenu={stopInteractiveBubbleEvent}
    >
      {preview.image && (
        <img
          src={preview.image}
          alt={preview.title || preview.hostname || 'Link preview'}
          className="aspect-[1.9/1] w-full bg-surface-container-low object-cover"
          loading="lazy"
        />
      )}
      <span className="block px-3.5 py-3">
        <span className="block truncate text-[11px] font-semibold uppercase tracking-[0.08em] text-on-surface-variant">
          {preview.siteName || preview.hostname || 'Liên kết'}
        </span>
        <span className="mt-1 block line-clamp-2 text-sm font-semibold leading-5 text-on-surface">
          {preview.title || preview.url}
        </span>
        {preview.description && (
          <span className="mt-1 block line-clamp-2 text-xs leading-5 text-on-surface-variant">
            {preview.description}
          </span>
        )}
        <span className="mt-2 block truncate text-[11px] text-on-surface-variant">
          {preview.hostname || preview.url}
        </span>
      </span>
    </a>
  );
};

const getSafeBubbleThemeId = (themeId = 'classic') =>
  ['classic', 'cloud', 'cat', 'bear', 'bunny'].includes(themeId) ? themeId : 'classic';

const ThemedTextBubble = ({ isOwn = false, themeId = 'classic', children }) => {
  const safeThemeId = getSafeBubbleThemeId(themeId);
  const isClassic = safeThemeId === 'classic';
  const themeClass = isClassic ? '' : `chat-bubble-themed chat-bubble-theme-${safeThemeId}`;

  return (
    <div
      className={`min-w-0 max-w-[min(320px,64vw)] px-3.5 py-2.5 text-[15px] leading-relaxed break-words [overflow-wrap:anywhere] md:max-w-[min(520px,68vw)] ${
        isClassic ? 'rounded-[12px]' : 'mt-2 rounded-[16px]'
      } ${
        isOwn
          ? 'bg-surface-container-high text-on-surface rounded-br-[4px]'
          : 'border border-outline-variant bg-surface-container-lowest text-on-surface rounded-bl-[4px]'
      } ${themeClass}`}
    >
      {children}
    </div>
  );
};

const CompactVoicePlayer = ({ src, duration = 0 }) => {
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(duration || 0);
  const effectiveDuration = audioDuration || duration || 0;
  const progress = effectiveDuration > 0 ? Math.min((currentTime / effectiveDuration) * 100, 100) : 0;

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return undefined;

    const handleLoadedMetadata = () => {
      if (Number.isFinite(audio.duration)) setAudioDuration(audio.duration);
    };
    const handleTimeUpdate = () => setCurrentTime(audio.currentTime || 0);
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(audio.duration || 0);
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.pause();
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [src]);

  const togglePlayback = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (audio.paused) {
      try {
        await audio.play();
      } catch (error) {
        console.error('Không thể phát tin nhắn thoại:', error);
      }
      return;
    }

    audio.pause();
  };

  const handleSeek = (event) => {
    const audio = audioRef.current;
    if (!audio || !effectiveDuration) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1);
    const nextTime = ratio * effectiveDuration;
    audio.currentTime = nextTime;
    setCurrentTime(nextTime);
  };

  return (
    <div
      className="flex min-w-0 items-center gap-2"
      onPointerDown={(event) => event.stopPropagation()}
      onTouchStart={(event) => event.stopPropagation()}
      onTouchEnd={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        onClick={togglePlayback}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface text-on-surface transition-colors hover:bg-surface-container-high"
        title={isPlaying ? 'Tạm dừng' : 'Phát'}
        aria-label={isPlaying ? 'Tạm dừng tin nhắn thoại' : 'Phát tin nhắn thoại'}
      >
        <AppIcon name={isPlaying ? 'pause' : 'play_arrow'} className="text-[21px]" />
      </button>

      <button
        type="button"
        onClick={handleSeek}
        className="h-5 min-w-0 flex-1"
        aria-label="Tua tin nhắn thoại"
      >
        <span className="block h-1 overflow-hidden rounded-full bg-on-surface-variant/30">
          <span
            className="block h-full rounded-full bg-on-surface transition-[width]"
            style={{ width: `${progress}%` }}
          />
        </span>
      </button>

      <span className="w-20 shrink-0 text-right text-[11px] font-medium tabular-nums text-on-surface-variant">
        {formatVoiceDuration(currentTime)} / {formatVoiceDuration(effectiveDuration)}
      </span>

      <audio ref={audioRef} src={src} preload="metadata" className="hidden" />
    </div>
  );
};

const PinGlyph = ({ className = '' }) => (
  <AppIcon name="push_pin" className={`-rotate-45 ${className}`} />
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

const getCallMessageMeta = (message = {}) => {
  const details = message.callDetails || {};
  const callType = details.callType === 'video' ? 'video' : 'voice';
  const typeLabel = callType === 'video' ? 'video' : 'thoại';
  const durationSeconds = details.durationSeconds || 0;
  const durationLabel =
    details.status === 'ended' && durationSeconds > 0
      ? ` · ${formatVoiceDuration(durationSeconds)}`
      : '';

  if (details.status === 'missed') {
    return {
      icon: 'call_end',
      title: message.content || `Cuộc gọi ${typeLabel} bị nhỡ`,
      tone: 'text-error',
    };
  }

  if (details.status === 'rejected') {
    return {
      icon: 'call_end',
      title: message.content || `Cuộc gọi ${typeLabel} đã bị từ chối`,
      tone: 'text-error',
    };
  }

  if (details.status === 'cancelled') {
    return {
      icon: 'call_end',
      title: message.content || `Cuộc gọi ${typeLabel} đã bị hủy`,
      tone: 'text-on-surface-variant',
    };
  }

  if (details.status === 'busy' || details.status === 'failed') {
    return {
      icon: 'call_end',
      title: message.content || `Cuộc gọi ${typeLabel} không thành công`,
      tone: 'text-on-surface-variant',
    };
  }

  return {
    icon: callType === 'video' ? 'videocam' : 'call',
    title: message.content || `Cuộc gọi ${typeLabel} đã kết thúc${durationLabel}`,
    tone: 'text-secondary',
  };
};

const MessageBubble = ({
  message,
  isOwn = false,
  showAvatar = true,
  readReceipts = [],
  currentUserId = '',
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
  onJumpToMessage,
  onOpenSenderProfile,
  bubbleThemeId = 'classic',
  isPinned = false,
  showMeta = true,
  onToggleMeta,
  reactionUsersById = {},
  isActionMenuOpen = false,
  onOpenActionMenu,
  onCloseActionMenu,
}) => {
  const [showPicker, setShowPicker] = useState(false);
  const [activeReactionEmoji, setActiveReactionEmoji] = useState(null);
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const [actionMenuPlacement, setActionMenuPlacement] = useState('center');
  const longPressTimer = useRef(null);
  const lightboxTouchStartX = useRef(null);
  const messageRef = useRef(null);
  const reactionDetailsRef = useRef(null);
  const pickerRef = useRef(null);
  const actionsRef = useRef(null);
  const mobileActionsRef = useRef(null);

  const isRevoked = Boolean(message.isDeleted);
  const isCallMessage = message.messageType === 'call';
  const isPollMessage = !isRevoked && message.messageType === 'poll' && message.poll;
  const isEventMessage = !isRevoked && message.messageType === 'event' && message.event;
  const isChecklistMessage = !isRevoked && message.messageType === 'checklist' && message.checklist;
  const isPlanMessage = !isRevoked && message.messageType === 'plan' && message.plan;
  const isStickerMessage =
    !isRevoked && Boolean(message.sticker?.url) && (message.messageType === 'sticker' || message.sticker?.url);
  const evolutionSourceText = useMemo(() => getEvolutionSourceText(message), [message]);
  const attachments = useMemo(() => getMessageAttachments(message), [message]);
  const { imageAttachments, audioAttachments, fileAttachments } = useMemo(
    () => ({
      imageAttachments: attachments.filter((attachment) => attachment.type === 'image'),
      audioAttachments: attachments.filter((attachment) => attachment.type === 'audio'),
      fileAttachments: attachments.filter(
        (attachment) => attachment.type !== 'image' && attachment.type !== 'audio',
      ),
    }),
    [attachments],
  );
  const formattedTime = useMemo(() => formatMessageTime(message.timestamp), [message.timestamp]);
  const renderedMessageContent = useMemo(
    () => renderMessageContent(message.content),
    [message.content],
  );
  const canReact = Boolean(message.id) && !isRevoked && !isCallMessage && message.status !== 'sending';
  const canEvolve =
    Boolean(onEvolveMessage) &&
    Boolean(message.id) &&
    !isRevoked &&
    !isCallMessage &&
    message.status !== 'sending' &&
    Boolean(evolutionSourceText);
  const hasAttachments = attachments.length > 0;
  const canForward =
    Boolean(onForwardMessage) &&
    Boolean(message.id) &&
    !isRevoked &&
    !isCallMessage &&
    message.status !== 'sending' &&
    (Boolean(message.content?.trim?.()) ||
      hasAttachments ||
      isStickerMessage ||
      isPollMessage ||
      isEventMessage ||
      isChecklistMessage);
  const shouldRenderTextBubble =
    !isPollMessage &&
    !isEventMessage &&
    !isChecklistMessage &&
    (Boolean(message.content) || (!hasAttachments && !isStickerMessage));
  const linkPreview = !isRevoked ? message.linkPreview : null;
  const activeLightboxImage =
    lightboxIndex === null ? null : imageAttachments[lightboxIndex] || null;
  const showActions = isActionMenuOpen;

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
      onCloseActionMenu?.(message.id);
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setShowPicker(false);
        onCloseActionMenu?.(message.id);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [message.id, onCloseActionMenu, showActions, showPicker]);

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
        className={`absolute -top-2 z-10 flex h-5 w-5 items-center justify-center rounded-full border border-outline-variant bg-surface-container-lowest text-on-surface shadow-sm ${
          isOwn ? '-right-1' : '-left-1'
        }`}
        title="Tin nhắn đã ghim"
      >
        <PinGlyph className="text-[13px]" />
      </span>
    ) : null;

  const closeMenus = () => {
    setShowPicker(false);
    onCloseActionMenu?.(message.id);
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
    onCloseActionMenu?.(message.id);
    setShowPicker((current) => !current);
  };

  const openContextMenu = (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (!canReact) return;
    setShowPicker(false);
    onOpenActionMenu?.(message.id);
  };

  const handleTouchStart = () => {
    if (!canReact) return;
    longPressTimer.current = setTimeout(() => {
      setShowPicker(true);
      onOpenActionMenu?.(message.id);
    }, 520);
  };

  const handleTouchEnd = () => {
    clearTimeout(longPressTimer.current);
  };

  const handleMessageClick = (event) => {
    if (event.button !== 0 || showActions || showPicker) return;
    if (isInteractiveMessageTarget(event.target)) return;
    onToggleMeta?.(message.id);
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
    ...(canEvolve
      ? [
          {
            key: 'evolve',
            label: 'Biến thành...',
            icon: 'sparkles',
            onClick: () => {
              onEvolveMessage?.(message);
              closeMenus();
            },
          },
        ]
      : []),
    ...(canForward
      ? [
          {
            key: 'forward',
            label: 'Chuyển tiếp',
            icon: 'forward',
            onClick: () => {
              onForwardMessage?.(message);
              closeMenus();
            },
          },
        ]
      : []),
  ];

  const visibleActionItems = isPollMessage || isEventMessage || isChecklistMessage || isPlanMessage
    ? actionItems.filter((item) => item.key !== 'edit')
    : actionItems;
  const actionMenuVerticalClass =
    actionMenuPlacement === 'above'
      ? 'bottom-0'
      : actionMenuPlacement === 'below'
        ? 'top-0'
        : 'top-1/2 -translate-y-1/2';

  useEffect(() => {
    if (!showActions) return undefined;

    const updateActionMenuPlacement = () => {
      const menuElement = actionsRef.current;
      const anchorElement = messageRef.current;
      if (!menuElement || !anchorElement) return;

      const anchorRect = anchorElement.getBoundingClientRect();
      const menuHeight = menuElement.offsetHeight || visibleActionItems.length * 42;
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
      const topSafeArea = 72;
      const bottomSafeArea = 112;
      const anchorCenterY = anchorRect.top + anchorRect.height / 2;

      if (anchorCenterY + menuHeight / 2 > viewportHeight - bottomSafeArea) {
        setActionMenuPlacement('above');
        return;
      }

      if (anchorCenterY - menuHeight / 2 < topSafeArea) {
        setActionMenuPlacement('below');
        return;
      }

      setActionMenuPlacement('center');
    };

    const frameId = window.requestAnimationFrame(updateActionMenuPlacement);
    window.addEventListener('resize', updateActionMenuPlacement);
    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener('resize', updateActionMenuPlacement);
    };
  }, [showActions, visibleActionItems.length]);

  const avatarName = encodeURIComponent(message.senderName || 'User');
  const avatarSrc =
    message.senderAvatar ||
    `https://ui-avatars.com/api/?name=${avatarName}&background=d9c8b4&color=2a2520&bold=true`;
  const openSenderProfile = (event) => {
    event.stopPropagation();
    if (!message.senderId) return;
    onOpenSenderProfile?.({
      id: message.senderId,
      username: message.senderName || '',
      pingId: message.senderPingId || '',
      avatar: message.senderAvatar || '',
      relationshipStatus: 'friend',
    });
  };
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

  if (isCallMessage) {
    const callMeta = getCallMessageMeta(message);

    return (
      <div
        className={`group flex animate-message-pop items-start gap-2 ${isOwn ? 'flex-row-reverse' : ''}`}
        onClick={handleMessageClick}
      >
        <div className={`w-7 shrink-0 ${isOwn ? 'hidden md:block' : 'block'} ${showAvatar ? '' : 'invisible'}`}>
          {!isOwn && (
            <button
              type="button"
              onClick={openSenderProfile}
              className="h-7 w-7 overflow-hidden rounded-full border border-outline-variant"
              title="Xem hồ sơ người gọi"
            >
              <img src={avatarSrc} alt="Người gọi" className="h-full w-full object-cover" />
            </button>
          )}
        </div>

        <div className={`flex max-w-[82%] flex-col gap-1 md:max-w-[74%] ${isOwn ? 'items-end' : 'items-start'}`}>
          {!isOwn && showAvatar && message.senderName && (
            <button
              type="button"
              onClick={openSenderProfile}
              className="ml-0.5 hidden px-1 text-left text-[11px] font-medium text-on-surface-variant hover:text-secondary md:inline"
            >
              {message.senderName}
            </button>
          )}

          <div className="inline-flex max-w-[min(420px,86vw)] items-center gap-2 rounded-full border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm text-on-surface">
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-container-low ${callMeta.tone}`}
            >
              <AppIcon name={callMeta.icon} className="text-[16px]" />
            </span>
            <span className="min-w-0 truncate font-medium">{callMeta.title}</span>
            {showMeta && (
              <span className="shrink-0 text-[11px] text-on-surface-variant">
                {formattedTime}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {activeLightboxImage && typeof document !== 'undefined' && createPortal((
        <div
          className="fixed inset-0 z-[1000] flex cursor-pointer items-center justify-center bg-[#111111]/92 px-4 py-6"
          onClick={closeLightbox}
          onTouchStart={handleLightboxTouchStart}
          onTouchEnd={handleLightboxTouchEnd}
        >
          <button
            type="button"
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-lg border border-white/15 bg-white/10 text-white transition-colors hover:bg-white/20"
            onClick={closeLightbox}
          >
            <AppIcon name="close" className="text-2xl" />
          </button>

          {imageAttachments.length > 1 && (
            <>
              <button
                type="button"
                className="absolute left-3 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white transition-colors hover:bg-white/20 md:flex"
                onClick={showPrevImage}
                title="Ảnh trước"
              >
                <AppIcon name="chevron_left" className="text-[28px]" />
              </button>
              <button
                type="button"
                className="absolute right-3 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white transition-colors hover:bg-white/20 md:flex"
                onClick={showNextImage}
                title="Ảnh sau"
              >
                <AppIcon name="chevron_right" className="text-[28px]" />
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
      ), document.body)}

      <div
        className={`group flex animate-message-pop items-start gap-2 ${isOwn ? 'flex-row-reverse' : ''}`}
      >
        <div className={`w-7 shrink-0 ${isOwn ? 'hidden md:block' : 'block'} ${showAvatar ? '' : 'invisible'}`}>
          {!isOwn && (
            <button
              type="button"
              onClick={openSenderProfile}
              className="h-7 w-7 overflow-hidden rounded-full border border-outline-variant"
              title="Xem hồ sơ người gửi"
            >
              <img src={avatarSrc} alt="Người gửi" className="h-full w-full object-cover" />
            </button>
          )}
        </div>

        <div
          className={`flex min-w-0 max-w-[78%] flex-col gap-1 md:max-w-[70%] ${isOwn ? 'items-end' : 'items-start'}`}
        >
          {!isOwn && showAvatar && message.senderName && (
            <button
              type="button"
              onClick={openSenderProfile}
              className="ml-0.5 hidden px-1 text-left text-[11px] font-medium text-on-surface-variant hover:text-secondary md:inline"
            >
              {message.senderName}
            </button>
          )}

          <div
            ref={messageRef}
            className="relative inline-flex min-w-0 max-w-full flex-col items-stretch gap-1"
            onContextMenu={openContextMenu}
            onClick={handleMessageClick}
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
                className={`max-w-[min(360px,68vw)] rounded-[8px] border-l-2 border-secondary bg-surface-container-low px-3 py-2 text-left transition-colors hover:bg-surface-container-high ${
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
                className={`inline-flex items-center gap-2 rounded-[12px] border border-dashed border-outline-variant bg-surface-container-low px-3.5 py-2 text-[14px] italic text-on-surface-variant ${
                  isOwn ? 'text-right rounded-br-[4px]' : 'rounded-bl-[4px]'
                }`}
              >
                <AppIcon name="block" className="text-[18px]" />
                <span>{REVOKED_MESSAGE_TEXT}</span>
              </div>
            ) : (
              <div
                className={`relative flex min-w-0 max-w-[min(350px,76vw)] flex-col gap-1 md:max-w-[min(560px,70vw)] ${isOwn ? 'items-end' : 'items-start'}`}
              >
                {pinnedBadge}
                {message.sourceMessage && (isPollMessage || isEventMessage || isChecklistMessage || isPlanMessage) && (
                  <SourceMessageLink
                    sourceMessage={message.sourceMessage}
                    onJumpToMessage={onJumpToMessage}
                  />
                )}
                {isPollMessage && (
                  <PollMessageCard
                    poll={message.poll}
                    messageId={message.id}
                    currentUserId={currentUserId}
                    reactionUsersById={reactionUsersById}
                    disabled={message.status === 'sending'}
                    onVote={onPollVote}
                    isOwn={isOwn}
                  />
                )}
                {isEventMessage && (
                  <EventMessageCard
                    event={message.event}
                    currentUserId={currentUserId}
                    reactionUsersById={reactionUsersById}
                    disabled={message.status === 'sending'}
                    onRsvp={onEventRsvp}
                    onCancel={onCancelEvent}
                    isOwn={isOwn}
                    />
                  )}
                  {isChecklistMessage && (
                    <ChecklistMessageCard
                      checklist={message.checklist}
                      messageId={message.id}
                      currentUserId={currentUserId}
                      reactionUsersById={reactionUsersById}
                      disabled={message.status === 'sending'}
                      onToggle={onChecklistToggle}
                      onJumpToMessage={onJumpToMessage}
                      isOwn={isOwn}
                    />
                  )}
                  {isPlanMessage && (
                    <PlanMessageCard
                      plan={message.plan}
                      messageId={message.id}
                      disabled={message.status === 'sending'}
                      onOpen={onOpenPlan}
                    />
                  )}
                  {isStickerMessage && (
                  <div className={`relative ${isOwn ? 'self-end' : 'self-start'}`}>
                    <StickerArtwork
                      sticker={message.sticker}
                      className="h-32 w-32 object-contain drop-shadow-sm md:h-40 md:w-40"
                    />
                    {message.sticker.name && (
                      <span className="sr-only">{message.sticker.name}</span>
                    )}
                  </div>
                )}
                {imageAttachments.length > 0 && (
                  <>
                    <div className="md:hidden">
                      {imageAttachments.length === 1 ? (
                        <button
                          type="button"
                          onClick={() => openLightbox(0)}
                          className="block w-[min(330px,72vw)] overflow-hidden rounded-[12px] border border-outline-variant bg-surface-container-lowest transition-opacity hover:opacity-90"
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
                            <span className="absolute left-0 top-11 h-[204px] w-[72%] overflow-hidden rounded-lg border border-outline-variant bg-surface-container-low opacity-65 shadow-sm -rotate-6">
                              <img
                                src={imageAttachments[3].url}
                                alt=""
                                className="h-full w-full object-cover"
                                loading="lazy"
                              />
                            </span>
                          )}
                          {imageAttachments[2] && (
                            <span className="absolute right-0 top-8 h-[214px] w-[74%] overflow-hidden rounded-lg border border-outline-variant bg-surface-container-low opacity-75 shadow-sm rotate-6">
                              <img
                                src={imageAttachments[2].url}
                                alt=""
                                className="h-full w-full object-cover"
                                loading="lazy"
                              />
                            </span>
                          )}
                          <span className="absolute left-7 top-5 h-[222px] w-[76%] overflow-hidden rounded-lg border border-outline-variant bg-surface-container-lowest opacity-90 shadow-sm -rotate-3">
                            <img
                              src={imageAttachments[1]?.url}
                              alt=""
                              className="h-full w-full object-cover"
                              loading="lazy"
                            />
                          </span>
                          <span className="relative z-20 mx-auto block h-[230px] w-[82%] overflow-hidden rounded-lg border border-outline-variant bg-surface-container-lowest shadow-sm rotate-1">
                            <img
                              src={imageAttachments[0].url}
                              alt={imageAttachments[0].filename || 'Ảnh trong tin nhắn'}
                              className="h-full w-full object-cover"
                              loading="lazy"
                            />
                          </span>
                          <span className="absolute right-2 top-2 z-30 rounded-full border border-white/25 bg-[#1f1d1a]/70 px-2.5 py-1 text-xs font-semibold text-white shadow-sm">
                            1 / {imageAttachments.length}
                          </span>
                          <span className="absolute bottom-2 left-1/2 z-30 -translate-x-1/2 rounded-full border border-outline-variant bg-surface-container-lowest px-3 py-1 text-[11px] font-semibold text-on-surface shadow-sm">
                            {imageAttachments.length} ảnh
                          </span>
                        </button>
                      )}
                    </div>

                    <div
                      className={`hidden overflow-hidden rounded-lg border border-outline-variant bg-surface-container-lowest shadow-sm md:grid ${
                        imageAttachments.length === 1
                          ? 'w-[min(430px,72vw)] grid-cols-1'
                          : 'w-[min(430px,72vw)] grid-cols-2 gap-1 p-1'
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

                {audioAttachments.length > 0 && (
                  <div className="flex w-[min(280px,72vw)] flex-col gap-2 md:w-[min(390px,74vw)]">
                    {audioAttachments.map((attachment, index) => (
                      <div
                        key={`${attachment.url}-${index}`}
                        className={`rounded-[12px] ${
                          isOwn
                            ? 'bg-surface-container-high rounded-br-[4px]'
                            : 'border border-outline-variant bg-surface-container-lowest rounded-bl-[4px]'
                        }`}
                        onClick={(event) => event.stopPropagation()}
                      >
                        <div className="px-2.5 py-2 md:hidden">
                          <CompactVoicePlayer src={attachment.url} duration={attachment.duration} />
                        </div>

                        <div className="hidden min-w-[250px] flex-col gap-2 px-3 py-3 md:flex">
                          <div className="flex items-center gap-3">
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface text-on-surface">
                              <AppIcon name="graphic_eq" className="text-[21px]" />
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold text-on-surface">
                                Tin nhắn thoại
                              </p>
                              <p className="text-[11px] text-on-surface-variant">
                                {[
                                  attachment.duration ? formatVoiceDuration(attachment.duration) : '',
                                  formatFileSize(attachment.size),
                                ]
                                  .filter(Boolean)
                                  .join(' · ')}
                              </p>
                            </div>
                          </div>
                          <audio controls src={attachment.url} className="h-9 w-full" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {fileAttachments.length > 0 && (
                  <div className="flex w-[min(390px,74vw)] flex-col gap-2">
                    {fileAttachments.map((attachment, index) => (
                      <div
                        key={`${attachment.url}-${index}`}
                        role="button"
                        tabIndex={0}
                        className={`flex min-w-[240px] items-center gap-3 rounded-[12px] px-3.5 py-2.5 transition-colors hover:bg-surface-container-low ${
                          isOwn ? 'bg-surface-container-high rounded-br-[4px]' : 'border border-outline-variant bg-surface-container-lowest rounded-bl-[4px]'
                        }`}
                        onClick={(event) => {
                          event.stopPropagation();
                          window.open(attachment.url, '_blank', 'noopener,noreferrer');
                        }}
                        onKeyDown={(event) => {
                          if (event.key !== 'Enter' && event.key !== ' ') return;
                          event.preventDefault();
                          window.open(attachment.url, '_blank', 'noopener,noreferrer');
                        }}
                      >
                        <FileTypeIcon
                          filename={attachment.filename}
                          mimeType={attachment.mimeType}
                          type={attachment.type}
                          size="md"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="truncate text-sm font-medium text-on-surface">
                            {attachment.filename}
                          </p>
                          <p className="text-[11px] text-on-surface-variant">
                            {formatFileSize(attachment.size)}
                          </p>
                        </div>
                        <button
                          type="button"
                          className="grid h-9 w-9 shrink-0 place-items-center rounded-[8px] text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface"
                          title="Tải xuống"
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            const link = document.createElement('a');
                            link.href = attachment.url;
                            link.download = attachment.filename || 'file';
                            document.body.appendChild(link);
                            link.click();
                            link.remove();
                          }}
                        >
                          <AppIcon name="download" className="text-xl" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {shouldRenderTextBubble ? (
                  <ThemedTextBubble isOwn={isOwn} themeId={bubbleThemeId}>
                    <span className="block whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                      {renderedMessageContent}
                    </span>
                  </ThemedTextBubble>
                ) : null}

                {linkPreview && <LinkPreviewCard preview={linkPreview} />}
              </div>
            )}

            {canReact && (
              <button
                type="button"
                aria-label="Thả cảm xúc"
                title="Thả cảm xúc"
                className={`absolute top-1/2 z-10 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-outline-variant bg-surface-container-lowest text-on-surface-variant shadow-sm transition-all hover:bg-surface-container-low hover:text-on-surface focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 group-hover:opacity-100 md:flex ${
                  showPicker ? 'opacity-100' : 'opacity-0'
                } ${isOwn ? 'right-full mr-1.5' : 'left-full ml-1.5'}`}
                onClick={togglePicker}
              >
                <AppIcon name="add_reaction" className="text-[18px]" />
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
                className={`no-scrollbar absolute z-[220] hidden max-h-[min(360px,calc(100dvh-128px))] w-48 overflow-y-auto rounded-[12px] border border-outline-variant bg-surface-container-lowest py-1 shadow-sm md:block ${actionMenuVerticalClass} ${
                  isOwn ? 'right-full mr-3' : 'left-full ml-3'
                }`}
                onContextMenu={(event) => event.preventDefault()}
              >
                {visibleActionItems.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={item.onClick || closeMenus}
                    className={`flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors hover:bg-surface-container-low ${
                      item.danger ? 'text-error' : 'text-on-surface'
                    }`}
                  >
                    <AppIcon name={item.icon} className={`text-[20px] ${ item.pinIcon ? '-rotate-45' : '' }`} />
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
                    className="inline-flex items-center gap-1 rounded-full border border-outline-variant bg-surface-container-lowest px-2 py-0.5 text-xs text-on-surface shadow-sm transition-colors hover:bg-surface-container-low"
                    title={users.map((reactionUser) => `${reactionUser.name}: ${emoji}`).join('\n')}
                  >
                    {emoji} {count}
                  </button>

                  {activeReactionEmoji === emoji && (
                    <div
                      className={`absolute bottom-full z-30 mb-2 min-w-44 max-w-64 rounded-lg border border-outline-variant bg-surface-container-lowest p-2 text-left shadow-sm ${
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
          <span
            className={`px-1 text-[11px] text-on-surface-variant ${showMeta ? '' : 'hidden'} ${isOwn ? 'text-right' : ''}`}
          >
            {formattedTime}
            {!isRevoked && message.isEdited && <span className="ml-1">đã sửa</span>}
            {deliveryText && <span className="ml-1">{deliveryText}</span>}
          </span>

          {showMeta && readReceipts.length > 0 && (
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
                    className="block h-4 w-4 min-w-4 max-w-4 flex-none overflow-hidden rounded-full border border-surface bg-surface-container-low shadow-sm"
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
                  <span className="flex h-4 min-w-4 flex-none items-center justify-center rounded-full border border-surface bg-surface-container-low px-1 text-[9px] font-semibold text-on-surface-variant shadow-sm">
                    +{readReceipts.length - 5}
                  </span>
                )}
              <span className={`pointer-events-none absolute bottom-full z-[80] mb-2 w-max max-w-[240px] rounded-md border border-outline-variant bg-[#2f2a24] px-2.5 py-1.5 text-center text-[11px] font-medium leading-4 text-white opacity-0 shadow-sm transition-opacity duration-150 group-hover/read-receipt:opacity-100 group-focus/read-receipt:opacity-100 ${ isOwn ? 'right-0' : 'left-0' }`}>
                {receiptSummary}
              </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {showActions && (
        <div
          className="fixed inset-0 z-[210] bg-[#1f1d1a]/42 md:hidden"
          onClick={closeMenus}
        >
          <div
            ref={mobileActionsRef}
            className="absolute inset-x-0 bottom-0 px-3 pb-[max(12px,env(safe-area-inset-bottom))]"
            onClick={(event) => event.stopPropagation()}
            onContextMenu={(event) => event.preventDefault()}
          >
            <div className="mb-2 flex justify-center rounded-[16px] border border-outline-variant bg-surface-container-lowest p-2 shadow-sm">
              <EmojiPicker emojis={QUICK_EMOJIS} onSelect={handleEmojiSelect} />
            </div>
            <div className="overflow-hidden rounded-[16px] border border-outline-variant bg-surface-container-lowest shadow-sm">
              {visibleActionItems.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={item.onClick || closeMenus}
                  className={`flex h-[52px] w-full items-center gap-4 border-b border-outline-variant px-5 text-left text-[15px] last:border-b-0 ${
                    item.danger ? 'text-error' : 'text-on-surface'
                  }`}
                >
                  <AppIcon name={item.icon} className={`text-[22px] ${ item.pinIcon ? '-rotate-45' : '' }`} />
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={closeMenus}
              className="mt-2 h-[52px] w-full rounded-[16px] border border-outline-variant bg-surface-container-lowest text-[15px] font-semibold text-on-surface shadow-sm"
            >
              Hủy
            </button>
          </div>
        </div>
      )}
    </>
  );
};

const stringifyComparable = (value) => {
  try {
    return JSON.stringify(value) || '';
  } catch {
    return String(value || '');
  }
};

const getMessageCompareKey = (message = {}) =>
  stringifyComparable({
    id: message.id,
    conversationId: message.conversationId,
    senderId: message.senderId,
    senderName: message.senderName,
    senderPingId: message.senderPingId,
    senderAvatar: message.senderAvatar,
    content: message.content,
    messageType: message.messageType,
    sticker: message.sticker,
    poll: message.poll,
    event: message.event,
    checklist: message.checklist,
    plan: message.plan,
    sourceMessage: message.sourceMessage,
    callDetails: message.callDetails,
    timestamp: message.timestamp,
    status: message.status,
    reactions: message.reactions,
    attachment: message.attachment,
    attachments: message.attachments,
    linkPreview: message.linkPreview,
    isEdited: message.isEdited,
    editedAt: message.editedAt,
    isDeleted: message.isDeleted,
    deletedAt: message.deletedAt,
    replyTo: message.replyTo,
  });

const hasSameActionSurface = (prevProps, nextProps) =>
  Boolean(prevProps.onReaction) === Boolean(nextProps.onReaction) &&
  Boolean(prevProps.onPollVote) === Boolean(nextProps.onPollVote) &&
  Boolean(prevProps.onEventRsvp) === Boolean(nextProps.onEventRsvp) &&
  Boolean(prevProps.onChecklistToggle) === Boolean(nextProps.onChecklistToggle) &&
  Boolean(prevProps.onOpenPlan) === Boolean(nextProps.onOpenPlan) &&
  Boolean(prevProps.onCancelEvent) === Boolean(nextProps.onCancelEvent) &&
  Boolean(prevProps.onEditMessage) === Boolean(nextProps.onEditMessage) &&
  Boolean(prevProps.onDeleteMessage) === Boolean(nextProps.onDeleteMessage) &&
  Boolean(prevProps.onReplyMessage) === Boolean(nextProps.onReplyMessage) &&
  Boolean(prevProps.onPinMessage) === Boolean(nextProps.onPinMessage) &&
  Boolean(prevProps.onEvolveMessage) === Boolean(nextProps.onEvolveMessage) &&
  Boolean(prevProps.onForwardMessage) === Boolean(nextProps.onForwardMessage) &&
  Boolean(prevProps.onJumpToMessage) === Boolean(nextProps.onJumpToMessage) &&
  Boolean(prevProps.onOpenSenderProfile) === Boolean(nextProps.onOpenSenderProfile);

const areMessageBubblePropsEqual = (prevProps, nextProps) =>
  getMessageCompareKey(prevProps.message) === getMessageCompareKey(nextProps.message) &&
  prevProps.isOwn === nextProps.isOwn &&
  prevProps.showAvatar === nextProps.showAvatar &&
  prevProps.currentUserId === nextProps.currentUserId &&
  prevProps.isPinned === nextProps.isPinned &&
  prevProps.showMeta === nextProps.showMeta &&
  prevProps.bubbleThemeId === nextProps.bubbleThemeId &&
  prevProps.isActionMenuOpen === nextProps.isActionMenuOpen &&
  prevProps.reactionUsersById === nextProps.reactionUsersById &&
  stringifyComparable(prevProps.readReceipts) === stringifyComparable(nextProps.readReceipts) &&
  hasSameActionSurface(prevProps, nextProps);

export default memo(MessageBubble, areMessageBubblePropsEqual);
