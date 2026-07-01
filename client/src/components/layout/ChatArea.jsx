import { useEffect, useMemo, useRef, useState } from 'react';
import Header from './Header';
import MessageList from '../chat/MessageList';
import MessageInput from '../chat/MessageInput';
import SmartCatchupBanner from '../chat/SmartCatchupBanner';
import AppIcon from '../ui/AppIcon';
import { useConfirmDialog } from '../ui/confirmDialogContext';
import { normalizeConversationAppearance } from '../../utils/conversationAppearance';

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
  if (message.messageType === 'poll') {
    return `Bình chọn: ${message.poll?.question || message.content || 'Bình chọn'}`;
  }

  if (message.messageType === 'event') {
    return `Sự kiện: ${message.event?.title || message.content || 'Sự kiện'}`;
  }

  if (message.messageType === 'checklist') {
    return `Checklist: ${message.checklist?.title || message.content || 'Checklist'}`;
  }
  if (message.messageType === 'plan') {
    return `Kế hoạch: ${message.plan?.title || message.content || 'Kế hoạch'}`;
  }

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

const formatScheduledTime = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

const getScheduledPreviewText = (scheduledMessage) => {
  const content = typeof scheduledMessage?.content === 'string' ? scheduledMessage.content.trim() : '';
  if (!content) return 'Tin nhắn hẹn gửi';
  if (content.length <= 90) return content;
  return `${content.slice(0, 89)}...`;
};

const formatEventTime = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

const getEventPreviewText = (event) => {
  const title = typeof event?.title === 'string' ? event.title.trim() : '';
  if (!title) return 'Sự kiện';
  if (title.length <= 90) return title;
  return `${title.slice(0, 89)}...`;
};

const REMINDER_FREQUENCY_LABELS = {
  daily: 'Hằng ngày',
  weekly: 'Hằng tuần',
  monthly: 'Hằng tháng',
};

const formatReminderTime = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

const getReminderPreviewText = (reminder) => {
  const title = typeof reminder?.title === 'string' ? reminder.title.trim() : '';
  if (!title) return 'Nhắc hẹn';
  if (title.length <= 90) return title;
  return `${title.slice(0, 89)}...`;
};

const ScheduledMessagesStrip = ({ scheduledMessages = [], onCancelScheduledMessage }) => {
  const [isOpen, setIsOpen] = useState(false);
  const pendingMessages = useMemo(
    () =>
      [...scheduledMessages]
        .filter((item) => item?.status === 'pending')
        .sort((a, b) => new Date(a.scheduledAt || 0) - new Date(b.scheduledAt || 0)),
    [scheduledMessages],
  );
  const nearestMessage = pendingMessages[0] || null;

  if (!nearestMessage) return null;

  return (
    <div className="shrink-0 border-t border-outline-variant bg-surface">
      <button
        type="button"
        onClick={() => setIsOpen((value) => !value)}
        className="flex min-h-[44px] w-full items-center gap-2.5 px-4 text-left transition-colors hover:bg-surface-container-low md:px-5"
      >
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[8px] text-on-surface-variant">
          <AppIcon name="schedule" className="text-[18px]" />
        </span>
        <span className="min-w-0 flex-1 text-[13px]">
          <span className="font-semibold text-on-surface">{pendingMessages.length} hẹn gửi</span>
          <span className="text-on-surface-variant">
            {' '}
            · {formatScheduledTime(nearestMessage.scheduledAt)} · {getScheduledPreviewText(nearestMessage)}
          </span>
        </span>
        <AppIcon
          name={isOpen ? 'expand_less' : 'chevron_right'}
          className="shrink-0 text-[20px] text-on-surface-variant"
        />
      </button>

      {isOpen && (
        <div className="max-h-[220px] overflow-y-auto border-t border-outline-variant px-4 py-2 md:px-5">
          <div className="space-y-1">
            {pendingMessages.map((scheduledMessage) => (
              <div
                key={scheduledMessage.id}
                className="flex min-w-0 items-center gap-3 rounded-[8px] px-2 py-2 transition-colors hover:bg-surface-container-low"
              >
                <span className="min-w-[72px] shrink-0 text-xs font-semibold text-on-surface-variant">
                  {formatScheduledTime(scheduledMessage.scheduledAt)}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm text-on-surface">
                  {getScheduledPreviewText(scheduledMessage)}
                </span>
                <button
                  type="button"
                  onClick={() => onCancelScheduledMessage?.(scheduledMessage)}
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-[8px] text-on-surface-variant transition hover:bg-error-container hover:text-error"
                  title="Hủy hẹn gửi"
                >
                  <AppIcon name="close" className="text-[17px]" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const UpcomingEventsStrip = ({ events = [], currentUserId = '', onCancelEvent }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [nowMs, setNowMs] = useState(0);
  const upcomingEvents = useMemo(
    () =>
      [...events]
        .filter((item) => {
          const startsAtMs = new Date(item?.startsAt || 0).getTime();
          return (
            item?.status !== 'cancelled' &&
            !item?.isPast &&
            (!nowMs || startsAtMs > nowMs)
          );
        })
        .sort((a, b) => new Date(a.startsAt || 0) - new Date(b.startsAt || 0)),
    [events, nowMs],
  );
  const nearestEvent = upcomingEvents[0] || null;

  useEffect(() => {
    const initialTimerId = window.setTimeout(() => setNowMs(Date.now()), 0);
    const intervalId = window.setInterval(() => setNowMs(Date.now()), 60 * 1000);
    return () => {
      window.clearTimeout(initialTimerId);
      window.clearInterval(intervalId);
    };
  }, []);

  if (!nearestEvent) return null;

  return (
    <div className="shrink-0 border-t border-outline-variant bg-surface">
      <button
        type="button"
        onClick={() => setIsOpen((value) => !value)}
        className="flex min-h-[44px] w-full items-center gap-2.5 px-4 text-left transition-colors hover:bg-surface-container-low md:px-5"
      >
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[8px] text-on-surface-variant">
          <AppIcon name="event" className="text-[18px]" />
        </span>
        <span className="min-w-0 flex-1 text-[13px]">
          <span className="font-semibold text-on-surface">{upcomingEvents.length} sự kiện</span>
          <span className="text-on-surface-variant">
            {' '}
            · {formatEventTime(nearestEvent.startsAt)} · {getEventPreviewText(nearestEvent)}
          </span>
        </span>
        <AppIcon
          name={isOpen ? 'expand_less' : 'chevron_right'}
          className="shrink-0 text-[20px] text-on-surface-variant"
        />
      </button>

      {isOpen && (
        <div className="max-h-[220px] overflow-y-auto border-t border-outline-variant px-4 py-2 md:px-5">
          <div className="space-y-1">
            {upcomingEvents.map((event) => (
              <div
                key={event.id}
                className="flex min-w-0 items-center gap-3 rounded-[8px] px-2 py-2 transition-colors hover:bg-surface-container-low"
              >
                <span className="min-w-[72px] shrink-0 text-xs font-semibold text-on-surface-variant">
                  {formatEventTime(event.startsAt)}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm text-on-surface">
                  {getEventPreviewText(event)}
                </span>
                {event.creatorId === currentUserId && (
                  <button
                    type="button"
                    onClick={() => onCancelEvent?.(event)}
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-[8px] text-on-surface-variant transition hover:bg-error-container hover:text-error"
                    title="Hủy sự kiện"
                  >
                    <AppIcon name="close" className="text-[17px]" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const RecurringRemindersStrip = ({
  reminders = [],
  onSnoozeReminder,
  onDismissReminder,
  onCancelReminder,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const openReminders = useMemo(
    () =>
      [...reminders]
        .filter((item) => ['active', 'due'].includes(item?.status))
        .sort((a, b) => {
          if (a.status === 'due' && b.status !== 'due') return -1;
          if (a.status !== 'due' && b.status === 'due') return 1;
          return new Date(a.nextRunAt || 0) - new Date(b.nextRunAt || 0);
        }),
    [reminders],
  );
  const nearestReminder = openReminders[0] || null;

  if (!nearestReminder) return null;

  return (
    <div className="shrink-0 border-t border-outline-variant bg-surface">
      <button
        type="button"
        onClick={() => setIsOpen((value) => !value)}
        className="flex min-h-[44px] w-full items-center gap-2.5 px-4 text-left transition-colors hover:bg-surface-container-low md:px-5"
      >
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[8px] text-on-surface-variant">
          <AppIcon name="reminder" className="text-[18px]" />
        </span>
        <span className="min-w-0 flex-1 text-[13px]">
          <span className="font-semibold text-on-surface">
            {openReminders.length} nhắc hẹn
          </span>
          <span className="text-on-surface-variant">
            {' '}
            · {nearestReminder.status === 'due' ? 'Đến hạn' : formatReminderTime(nearestReminder.nextRunAt)} ·{' '}
            {getReminderPreviewText(nearestReminder)}
          </span>
        </span>
        <AppIcon
          name={isOpen ? 'expand_less' : 'chevron_right'}
          className="shrink-0 text-[20px] text-on-surface-variant"
        />
      </button>

      {isOpen && (
        <div className="max-h-[240px] overflow-y-auto border-t border-outline-variant px-4 py-2 md:px-5">
          <div className="space-y-1">
            {openReminders.map((reminder) => (
              <div
                key={reminder.id}
                className="flex min-w-0 flex-col gap-2 rounded-[8px] px-2 py-2 transition-colors hover:bg-surface-container-low sm:flex-row sm:items-center"
              >
                <span className="min-w-[92px] shrink-0 text-xs font-semibold text-on-surface-variant">
                  {reminder.status === 'due' ? 'Đến hạn' : formatReminderTime(reminder.nextRunAt)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-on-surface">
                    {getReminderPreviewText(reminder)}
                  </span>
                  <span className="block text-xs text-on-surface-variant">
                    {REMINDER_FREQUENCY_LABELS[reminder.frequency] || 'Nhắc hẹn'}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-1.5">
                  {reminder.status === 'due' && (
                    <>
                      <button
                        type="button"
                        onClick={() => onSnoozeReminder?.(reminder, 15)}
                        className="grid h-8 w-8 place-items-center rounded-[8px] text-on-surface-variant transition hover:bg-surface-container-high hover:text-on-surface"
                        title="Nhắc lại sau 15 phút"
                      >
                        <AppIcon name="schedule" className="text-[17px]" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDismissReminder?.(reminder)}
                        className="grid h-8 w-8 place-items-center rounded-[8px] text-on-surface-variant transition hover:bg-secondary-container hover:text-secondary"
                        title="Hoàn tất lần nhắc này"
                      >
                        <AppIcon name="check" className="text-[17px]" />
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => onCancelReminder?.(reminder)}
                    className="grid h-8 w-8 place-items-center rounded-[8px] text-on-surface-variant transition hover:bg-error-container hover:text-error"
                    title="Hủy nhắc hẹn"
                  >
                    <AppIcon name="close" className="text-[17px]" />
                  </button>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const ChatArea = ({
  currentUser,
  conversationId,
  messages = [],
  currentUserId,
  reactionUsersById,
  onSendMessage,
  onScheduleMessage,
  onCreatePoll,
  onCreateEvent,
  onCreateChecklist,
  onCreatePlan,
  onCreateReminder,
  onPollVote,
  onEventRsvp,
  onChecklistToggle,
  onOpenPlan,
  scheduledMessages = [],
  onCancelScheduledMessage,
  events = [],
  onCancelEvent,
  reminders = [],
  onSnoozeReminder,
  onDismissReminder,
  onCancelReminder,
  draftContent = '',
  onDraftChange,
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
  onEvolveMessage,
  onForwardMessage,
  onOpenSenderProfile,
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
  syncStatus = 'idle',
}) => {
  const { confirm } = useConfirmDialog();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isPinnedOpen, setIsPinnedOpen] = useState(false);
  const [activePinnedActionId, setActivePinnedActionId] = useState(null);
  const pinnedPanelRef = useRef(null);
  const longPressTimerRef = useRef(null);
  const [dismissedCatchup, setDismissedCatchup] = useState({});

  // catchupAvailable tu server: co tin chua doc tinh theo lastReadAt cua member.
  // Khac unreadCount (bi reset khi mo chat), flag nay on dinh de banner hien duoc.
  const catchupKey = `${conversationId}_${currentUser?.catchupSince || ''}`;
  const showCatchupBanner =
    Boolean(currentUser?.catchupAvailable) && !currentUser?.isSaved && !dismissedCatchup[catchupKey];

  const pinnedMessages = currentUser?.pinnedMessages || (currentUser?.pinnedMessage ? [currentUser.pinnedMessage] : []);
  const latestPinnedMessage =
    currentUser?.latestPinnedMessage || currentUser?.pinnedMessage || pinnedMessages[0] || null;
  const pinnedMessageCount = currentUser?.pinnedMessageCount ?? pinnedMessages.length;
  const pinnedMessageIds = pinnedMessages.map((message) => message.id).filter(Boolean);
  const appearance = useMemo(
    () => normalizeConversationAppearance(currentUser?.appearance),
    [currentUser?.appearance],
  );
  const background = appearance.background;
  const bubbleThemeId = appearance.bubbleTheme.presetId;
  const backgroundClass =
    background.type === 'uploaded'
      ? 'bg-surface-container-low'
      : `chat-bg-preset-${background.presetId}`;
  const uploadedBackgroundStyle = background.type === 'uploaded'
    ? {
        backgroundImage: `url(${background.imageUrl})`,
        backgroundSize: background.fit,
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        filter: background.blur ? `blur(${background.blur}px)` : undefined,
        transform: background.blur ? 'scale(1.03)' : undefined,
      }
    : undefined;
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
      const pollText = message.poll
        ? `${message.poll.question || ''} ${(message.poll.options || [])
            .map((option) => option.text || '')
            .join(' ')}`
        : '';
      const eventText = message.event
        ? `${message.event.title || ''} ${message.event.description || ''} ${message.event.location || ''}`
        : '';
      const checklistText = message.checklist
        ? `${message.checklist.title || ''} ${(message.checklist.items || [])
            .map((item) => item.text || '')
            .join(' ')}`
        : '';
      const planText = message.plan ? `${message.plan.title || ''}` : '';
      return `${content} ${filenames} ${stickerName} ${pollText} ${eventText} ${checklistText} ${planText}`.toLowerCase().includes(query);
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
        const pollText = message.poll
          ? `${message.poll.question || ''} ${(message.poll.options || [])
              .map((option) => option.text || '')
              .join(' ')}`
          : '';
        const eventText = message.event
          ? `${message.event.title || ''} ${message.event.description || ''} ${message.event.location || ''}`
          : '';
        const checklistText = message.checklist
          ? `${message.checklist.title || ''} ${(message.checklist.items || [])
              .map((item) => item.text || '')
              .join(' ')}`
          : '';
        const planText = message.plan ? `${message.plan.title || ''}` : '';
        return `${content} ${filenames} ${stickerName} ${pollText} ${eventText} ${checklistText} ${planText}`.toLowerCase().includes(query);
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
          onOpenProfile={onOpenSenderProfile}
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

      <SmartCatchupBanner
        key={conversationId}
        conversationId={conversationId}
        visible={showCatchupBanner}
        unreadCount={currentUser?.unreadCount || 0}
        catchupSince={currentUser?.catchupSince || null}
        isSaved={currentUser?.isSaved}
        onJumpToMessage={(messageId) => onJumpToPinnedMessage?.({ id: messageId })}
        onDismiss={() => setDismissedCatchup((prev) => ({ ...prev, [catchupKey]: true }))}
      />

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

      {syncStatus === 'syncing' && (
        <div className="shrink-0 border-b border-outline-variant bg-surface-container-low px-4 py-1.5 text-center text-xs font-medium text-on-surface-variant md:px-5">
          Đang đồng bộ...
        </div>
      )}

      {syncStatus === 'error' && (
        <div className="shrink-0 border-b border-outline-variant bg-error-container px-4 py-1.5 text-center text-xs font-medium text-error md:px-5">
          Chưa đồng bộ được, PingMe sẽ thử lại khi kết nối ổn định.
        </div>
      )}

      <div className="relative min-h-0 flex-1 overflow-hidden bg-background">
        <div className={`pointer-events-none absolute inset-0 ${backgroundClass}`} style={uploadedBackgroundStyle} />
        <div
          className="pointer-events-none absolute inset-0 bg-background"
          style={{
            opacity: background.dim,
            backdropFilter: background.type !== 'uploaded' && background.blur
              ? `blur(${background.blur}px)`
              : undefined,
          }}
        />
        <div className="relative z-10 h-full">
          <MessageList
            messages={messages}
            conversationId={currentUser?.id}
            currentUserId={currentUserId}
            reactionUsersById={reactionUsersById}
            onReaction={onReaction}
            onPollVote={onPollVote}
            onEventRsvp={onEventRsvp}
            onChecklistToggle={onChecklistToggle}
            onOpenPlan={onOpenPlan}
            onCancelEvent={onCancelEvent}
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
            bubbleThemeId={bubbleThemeId}
            onEditMessage={onStartEditMessage}
            onDeleteMessage={onDeleteMessage}
            onReplyMessage={onStartReplyMessage}
            onPinMessage={onPinMessage}
            onEvolveMessage={onEvolveMessage}
            onForwardMessage={onForwardMessage}
            onOpenSenderProfile={onOpenSenderProfile}
          />
        </div>
      </div>

      <ScheduledMessagesStrip
        scheduledMessages={scheduledMessages}
        onCancelScheduledMessage={onCancelScheduledMessage}
      />

      <UpcomingEventsStrip
        events={events}
        currentUserId={currentUserId}
        onCancelEvent={onCancelEvent}
      />

      <RecurringRemindersStrip
        reminders={reminders}
        onSnoozeReminder={onSnoozeReminder}
        onDismissReminder={onDismissReminder}
        onCancelReminder={onCancelReminder}
      />

      <MessageInput
        conversationId={conversationId}
        draftContent={draftContent}
        onSendMessage={onSendMessage}
        onScheduleMessage={onScheduleMessage}
        onCreatePoll={onCreatePoll}
        onCreateEvent={onCreateEvent}
        onCreateChecklist={onCreateChecklist}
        onCreatePlan={onCreatePlan}
        onCreateReminder={onCreateReminder}
        isGroupChat={Boolean(currentUser?.isGroup)}
        canCreatePoll={Boolean(currentUser?.isGroup)}
        canCreateEvent={Boolean(currentUser && !currentUser.isSaved)}
        canCreateChecklist={Boolean(currentUser?.isGroup)}
        canCreatePlan={Boolean(currentUser && !currentUser.isSaved)}
        canCreateReminder={Boolean(currentUser)}
        conversationMembers={currentUser?.members || []}
        onDraftChange={onDraftChange}
        onTypingStart={onTypingStart}
        onTypingStop={onTypingStop}
        onFocus={onFocusInput}
        editingMessage={editingMessage}
        replyingMessage={replyingMessage}
        onEditMessage={onEditMessage}
        onCancelEditMessage={onCancelEditMessage}
        onCancelReplyMessage={onCancelReplyMessage}
        isSaved={currentUser?.isSaved}
        onJumpToMessage={(messageId) => onJumpToPinnedMessage?.({ id: messageId })}
      />
    </section>
  );
};

export default ChatArea;
