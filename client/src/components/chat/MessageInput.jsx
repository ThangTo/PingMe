import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import api from '../../config/api';
import FileTypeIcon from '../ui/FileTypeIcon';
import AppIcon from '../ui/AppIcon';
import VoiceTrimmer from './VoiceTrimmer';
import VoiceWave from './VoiceWave';
import MessageSummaryPopover from './MessageSummaryPopover';
import MentionDropdown from './MentionDropdown';
import { trimVoiceToWav, getPeaksFromBlob } from '../../utils/audioTrim';

const EmojiStickerPicker = lazy(() => import('./EmojiStickerPicker'));
const ScheduleMessageModal = lazy(() => import('./ScheduleMessageModal'));
const CreatePollModal = lazy(() => import('./CreatePollModal'));
const CreateEventModal = lazy(() => import('./CreateEventModal'));
const CreateChecklistModal = lazy(() => import('./CreateChecklistModal'));
const CreatePlanModal = lazy(() => import('./CreatePlanModal'));
const CreateRecurringReminderModal = lazy(() => import('./CreateRecurringReminderModal'));

const REVOKED_MESSAGE_TEXT = 'Tin nhắn này đã được thu hồi';
const MAX_ATTACHMENTS = 5;
const TYPING_IDLE_TIMEOUT_MS = 1500;
const TYPING_KEEPALIVE_MS = 2500;
const RECENT_EMOJIS_STORAGE_KEY = 'pingme_recent_emojis';
const ACCEPTED_FILE_TYPES =
  'image/*,audio/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar,.txt,.csv,.json,.js,.jsx,.ts,.tsx,.html,.css,.md';
const AUDIO_MIME_TYPES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
  'audio/ogg;codecs=opus',
];
const MENTION_WORD_CHAR_REGEX = /[\p{L}\p{N}_]/u;

const loadRecentEmojis = () => {
  try {
    const stored = JSON.parse(localStorage.getItem(RECENT_EMOJIS_STORAGE_KEY) || '[]');
    return Array.isArray(stored) ? stored.slice(0, 16) : [];
  } catch {
    return [];
  }
};

const getMessageAttachments = (message = {}) => {
  if (Array.isArray(message.attachments) && message.attachments.length > 0) {
    return message.attachments;
  }
  return message.attachment ? [message.attachment] : [];
};

const normalizeMentionName = (name = '') => name.trim().replace(/^@+/, '');

const getMentionNames = (members = []) => {
  const names = members
    .map((member) => normalizeMentionName(member.username || member.name || ''))
    .filter(Boolean);
  return [...new Set([...names, 'everyone', 'all'])].sort((a, b) => b.length - a.length);
};

const renderDraftWithMentions = (text = '', mentionNames = []) => {
  if (!text) return null;

  const parts = [];
  let cursor = 0;

  for (let i = 0; i < text.length; i += 1) {
    if (text[i] !== '@') continue;

    const matchedName = mentionNames.find((name) => {
      const token = `@${name}`;
      if (text.slice(i, i + token.length).toLocaleLowerCase('vi') !== token.toLocaleLowerCase('vi')) {
        return false;
      }
      const nextChar = text[i + token.length];
      return !nextChar || !MENTION_WORD_CHAR_REGEX.test(nextChar);
    });

    if (!matchedName) continue;

    const end = i + matchedName.length + 1;
    if (i > cursor) parts.push(text.slice(cursor, i));
    parts.push(
      <span
        key={`mention-${i}`}
        className="rounded-md bg-secondary/10 px-1 py-0.5 font-semibold text-secondary"
      >
        {text.slice(i, end)}
      </span>,
    );
    cursor = end;
    i = end - 1;
  }

  if (cursor < text.length) parts.push(text.slice(cursor));
  return parts.length > 0 ? parts : text;
};

const getReplyPreviewText = (replyingMessage) => {
  if (!replyingMessage) return '';
  if (replyingMessage.isDeleted) return REVOKED_MESSAGE_TEXT;
  if (replyingMessage.messageType === 'poll') {
    return `Bình chọn: ${replyingMessage.poll?.question || replyingMessage.content || 'Bình chọn'}`;
  }

  if (replyingMessage.messageType === 'event') {
    return `Sự kiện: ${replyingMessage.event?.title || replyingMessage.content || 'Sự kiện'}`;
  }

  if (replyingMessage.messageType === 'checklist') {
    return `Checklist: ${replyingMessage.checklist?.title || replyingMessage.content || 'Checklist'}`;
  }

  if (replyingMessage.messageType === 'plan') {
    return `Kế hoạch: ${replyingMessage.plan?.title || replyingMessage.content || 'Kế hoạch'}`;
  }

  const attachments = getMessageAttachments(replyingMessage);
  if (replyingMessage.content) return replyingMessage.content;
  if (replyingMessage.messageType === 'sticker' || replyingMessage.sticker?.url) {
    return replyingMessage.sticker?.name
      ? `Nhãn dán: ${replyingMessage.sticker.name}`
      : 'Đã gửi nhãn dán';
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

const getAttachmentType = (type = '', fallback = 'file') => {
  if (['image', 'file', 'audio', 'video'].includes(type)) return type;
  if (type.startsWith('image/')) return 'image';
  if (type.startsWith('audio/')) return 'audio';
  if (type.startsWith('video/')) return 'video';
  return fallback;
};

const getSupportedAudioMimeType = () => {
  if (typeof MediaRecorder === 'undefined') return '';
  return AUDIO_MIME_TYPES.find((mimeType) => MediaRecorder.isTypeSupported(mimeType)) || '';
};

const getAudioExtension = (mimeType = '') => {
  if (mimeType.includes('mp4')) return 'm4a';
  if (mimeType.includes('ogg')) return 'ogg';
  if (mimeType.includes('mpeg') || mimeType.includes('mp3')) return 'mp3';
  if (mimeType.includes('wav')) return 'wav';
  return 'webm';
};

const revokePreviewUrls = (items = []) => {
  items.forEach((item) => {
    if (item.url) URL.revokeObjectURL(item.url);
  });
};

const waveformBars = [
  12, 22, 16, 30, 18, 36, 24, 42, 26, 34, 20, 32, 18, 28, 14, 24, 12, 20, 10, 16,
];

const VoiceWaveform = ({ progress = 0, active = false, tone = 'accent' }) => {
  const activeColor = tone === 'error' ? 'bg-error' : 'bg-secondary';
  const mutedColor = tone === 'error' ? 'bg-error/20' : 'bg-on-surface-variant/25';

  return (
    <div className="flex h-10 min-w-0 flex-1 items-center gap-[3px]" aria-hidden="true">
      {waveformBars.map((height, index) => {
        const barProgress = ((index + 1) / waveformBars.length) * 100;
        const isFilled = active || barProgress <= progress;

        return (
          <span
            key={`${height}-${index}`}
            className={`w-[3px] rounded-full transition-colors ${isFilled ? activeColor : mutedColor} ${
              active ? 'animate-pulse' : ''
            }`}
            style={{ height }}
          />
        );
      })}
    </div>
  );
};

const VoicePreviewPlayer = ({ src, duration = 0, size = 0, peaks }) => {
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(duration || 0);
  const effectiveDuration = audioDuration || duration || 0;
  const progress =
    effectiveDuration > 0 ? Math.min((currentTime / effectiveDuration) * 100, 100) : 0;

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
        console.error('Không thể phát ghi âm preview:', error);
      }
      return;
    }

    audio.pause();
  };

  const handleSeek = (ratio) => {
    const audio = audioRef.current;
    if (!audio || !effectiveDuration) return;
    const nextTime = ratio * effectiveDuration;
    audio.currentTime = nextTime;
    setCurrentTime(nextTime);
  };

  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <button
        type="button"
        onClick={togglePlayback}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-white transition-colors hover:bg-accent-dark"
        title={isPlaying ? 'Tạm dừng' : 'Nghe lại'}
        aria-label={isPlaying ? 'Tạm dừng ghi âm' : 'Nghe lại ghi âm'}
      >
        <AppIcon name={isPlaying ? 'pause' : 'play_arrow'} className="text-[22px]" />
      </button>
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-baseline justify-between gap-2">
          <p className="truncate text-sm font-semibold text-on-surface">
            Ghi âm
            <span className="font-normal text-on-surface-variant"> · {formatFileSize(size)}</span>
          </p>
          <span className="shrink-0 text-[11px] tabular-nums text-on-surface-variant">
            {formatVoiceDuration(currentTime)} / {formatVoiceDuration(effectiveDuration)}
          </span>
        </div>
        <div
          className="cursor-pointer"
          onPointerDown={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
            handleSeek(ratio);
          }}
        >
          <VoiceWave peaks={peaks} progress={progress} active={isPlaying} height={36} />
        </div>
      </div>
      <audio ref={audioRef} src={src} preload="metadata" className="hidden" />
    </div>
  );
};

const MessageInput = ({
  conversationId,
  draftContent = '',
  onSendMessage,
  onScheduleMessage,
  onCreatePoll,
  onCreateEvent,
  onCreateChecklist,
  onCreatePlan,
  onCreateReminder,
  canCreatePoll = false,
  canCreateEvent = false,
  canCreateChecklist = false,
  canCreatePlan = false,
  canCreateReminder = false,
  conversationMembers = [],
  currentUserId = '',
  isGroupChat = false,
  onDraftChange,
  disabled = false,
  onTypingStart,
  onTypingStop,
  onFocus,
  editingMessage,
  replyingMessage,
  onEditMessage,
  onCancelEditMessage,
  onCancelReplyMessage,
  isSaved = false,
  onJumpToMessage,
}) => {
  const [message, setMessage] = useState('');
  const [previews, setPreviews] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState('');
  const [voicePreview, setVoicePreview] = useState(null);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [isUploadingVoice, setIsUploadingVoice] = useState(false);
  const [voiceDuration, setVoiceDuration] = useState(0);
  const [voiceError, setVoiceError] = useState('');
  const [livePeaks, setLivePeaks] = useState([]);
  const [isTrimmingVoice, setIsTrimmingVoice] = useState(false);
  const [isProcessingTrim, setIsProcessingTrim] = useState(false);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [isPollOpen, setIsPollOpen] = useState(false);
  const [isEventOpen, setIsEventOpen] = useState(false);
  const [isChecklistOpen, setIsChecklistOpen] = useState(false);
  const [isPlanOpen, setIsPlanOpen] = useState(false);
  const [isReminderOpen, setIsReminderOpen] = useState(false);
  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState(null);
  const [mentionStart, setMentionStart] = useState(-1);
  const [mentionActiveIdx, setMentionActiveIdx] = useState(0);
  const [activePickerTab, setActivePickerTab] = useState('emoji');
  const [recentEmojis, setRecentEmojis] = useState(loadRecentEmojis);
  const [selectedIntent, setSelectedIntent] = useState(null);
  const [isIntentPickerOpen, setIsIntentPickerOpen] = useState(false);

  const INTENT_OPTIONS = [
    { key: 'urgent', label: 'Khẩn cấp', color: 'text-error', bg: 'bg-error/10', icon: 'alarm' },
    { key: 'needs_reply', label: 'Cần trả lời', color: 'text-warning', bg: 'bg-warning/10', icon: 'reply' },
    { key: 'decision', label: 'Quyết định', color: 'text-secondary', bg: 'bg-secondary/10', icon: 'check_circle' },
    { key: 'fyi', label: 'Để biết', color: 'text-accent', bg: 'bg-accent/10', icon: 'info' },
    { key: 'remind_me', label: 'Nhắc tôi', color: 'text-purple-500', bg: 'bg-purple-500/10', icon: 'bookmark' },
  ];
  const fileInputRef = useRef(null);
  const inputRef = useRef(null);
  const pickerRef = useRef(null);
  const emojiButtonRef = useRef(null);
  const actionMenuRef = useRef(null);
  const actionButtonRef = useRef(null);
  const summaryButtonRef = useRef(null);
  const intentPickerRef = useRef(null);
  const intentButtonRef = useRef(null);
  const mentionOverlayRef = useRef(null);
  const wasEditingRef = useRef(false);
  const isTypingRef = useRef(false);
  const lastTypingEmitAtRef = useRef(0);
  const typingTimeoutRef = useRef(null);
  const previewsRef = useRef([]);
  const voicePreviewRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const voiceChunksRef = useRef([]);
  const voiceStreamRef = useRef(null);
  const voiceTimerRef = useRef(null);
  const recordingStartedAtRef = useRef(null);
  const discardVoiceRef = useRef(false);
  const analyserCtxRef = useRef(null);
  const analyserSourceRef = useRef(null);
  const analyserTimerRef = useRef(null);
  const trimRequestIdRef = useRef(0);
  const isTrimErrorRef = useRef(false);
  const messageRef = useRef('');
  const lastDraftConversationIdRef = useRef(conversationId || null);
  const lastLocalDraftChangeAtRef = useRef(0);
  const hasPreviews = previews.length > 0;
  const hasVoicePreview = Boolean(voicePreview);
  const imagePreviews = previews.filter((preview) => preview.type === 'image');
  const filePreviews = previews.filter((preview) => preview.type !== 'image');

  useEffect(() => {
    previewsRef.current = previews;
  }, [previews]);

  useEffect(() => {
    voicePreviewRef.current = voicePreview;
  }, [voicePreview]);

  useEffect(() => {
    messageRef.current = message;
  }, [message]);

  useEffect(
    () => () => {
      trimRequestIdRef.current++;
      revokePreviewUrls(previewsRef.current);
      if (voicePreviewRef.current?.url) URL.revokeObjectURL(voicePreviewRef.current.url);
      if (voiceTimerRef.current) clearInterval(voiceTimerRef.current);
      discardVoiceRef.current = true;
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.ondataavailable = null;
        mediaRecorderRef.current.onstop = null;
        mediaRecorderRef.current.onerror = null;
        mediaRecorderRef.current.stop();
      }
      mediaRecorderRef.current = null;
      recordingStartedAtRef.current = null;
      if (analyserTimerRef.current) clearTimeout(analyserTimerRef.current);
      if (analyserCtxRef.current) analyserCtxRef.current.close();
      if (analyserSourceRef.current) analyserSourceRef.current.disconnect();
      voiceStreamRef.current?.getTracks().forEach((track) => track.stop());
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    },
    [],
  );

  useEffect(() => {
    if (!isPickerOpen) return undefined;

    const handlePointerDown = (event) => {
      if (pickerRef.current?.contains(event.target)) return;
      if (emojiButtonRef.current?.contains(event.target)) return;
      setIsPickerOpen(false);
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setIsPickerOpen(false);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isPickerOpen]);

  useEffect(() => {
    if (!isActionMenuOpen) return undefined;

    const handlePointerDown = (event) => {
      if (actionMenuRef.current?.contains(event.target)) return;
      if (actionButtonRef.current?.contains(event.target)) return;
      setIsActionMenuOpen(false);
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setIsActionMenuOpen(false);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isActionMenuOpen]);

  useEffect(() => {
    if (!isSummaryOpen) return undefined;

    const handlePointerDown = (event) => {
      if (summaryButtonRef.current?.contains(event.target)) return;
      const popoverEl = document.querySelector('[data-summary-popover]');
      if (popoverEl?.contains(event.target)) return;
      setIsSummaryOpen(false);
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setIsSummaryOpen(false);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isSummaryOpen]);

  useEffect(() => {
    if (!isIntentPickerOpen) return;

    const handlePointerDown = (event) => {
      if (intentPickerRef.current?.contains(event.target)) return;
      if (intentButtonRef.current?.contains(event.target)) return;
      setIsIntentPickerOpen(false);
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setIsIntentPickerOpen(false);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isIntentPickerOpen]);

  const clearPreviews = () => {
    setPreviews((current) => {
      revokePreviewUrls(current);
      return [];
    });
    setUploadError('');
    setUploadProgress(0);
  };

  const clearVoiceTimer = () => {
    if (voiceTimerRef.current) {
      clearInterval(voiceTimerRef.current);
      voiceTimerRef.current = null;
    }
  };

  const stopVoiceStream = () => {
    voiceStreamRef.current?.getTracks().forEach((track) => track.stop());
    voiceStreamRef.current = null;
  };

  const clearVoicePreview = () => {
    setVoicePreview((current) => {
      if (current?.url) URL.revokeObjectURL(current.url);
      return null;
    });
    setVoiceDuration(0);
    setVoiceError('');
    setIsTrimmingVoice(false);
    isTrimErrorRef.current = false;
    trimRequestIdRef.current++;
  };

  useEffect(() => {
    if (!editingMessage) {
      if (wasEditingRef.current) {
        setMessage(draftContent || '');
        clearPreviews();
        clearVoicePreview();
        wasEditingRef.current = false;

        requestAnimationFrame(() => {
          const input = inputRef.current;
          if (!input) return;
          input.style.height = 'auto';
          input.style.height = `${Math.min(input.scrollHeight, 160)}px`;
        });
      }

      return;
    }

    wasEditingRef.current = true;
    setMessage(editingMessage.content || '');
    clearPreviews();
    clearVoicePreview();

    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  }, [draftContent, editingMessage]);

  useEffect(() => {
    if (!replyingMessage || editingMessage) return;

    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  }, [replyingMessage, editingMessage]);

  useEffect(() => {
    if (mentionQuery !== null) setMentionActiveIdx(0);
  }, [mentionQuery]);

  const mentionableMembers = useMemo(
    () =>
      conversationMembers.filter((member) => {
        const memberId = member.id || member._id || member.userId || member.user?._id || member.user;
        return memberId?.toString?.() !== currentUserId?.toString?.();
      }),
    [conversationMembers, currentUserId],
  );

  const mentionItems = useMemo(() => {
    if (mentionQuery === null) return [];
    const lower = mentionQuery.toLocaleLowerCase('vi');
    const filtered = lower
      ? mentionableMembers.filter((m) =>
          m.username?.toLocaleLowerCase('vi').includes(lower),
        )
      : mentionableMembers;
    return [
      { _id: '@all', username: 'all', isAll: true },
      ...filtered.slice(0, 5),
    ];
  }, [mentionQuery, mentionableMembers]);
  const draftMentionNames = useMemo(() => getMentionNames(mentionableMembers), [mentionableMembers]);
  const renderedDraftMessage = useMemo(
    () => renderDraftWithMentions(message, draftMentionNames),
    [draftMentionNames, message],
  );

  const stopTypingNow = useCallback(() => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    if (isTypingRef.current && onTypingStop) onTypingStop();
    isTypingRef.current = false;
    lastTypingEmitAtRef.current = 0;
  }, [onTypingStop]);

  const resizeInput = useCallback((el = inputRef.current) => {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, []);

  const syncMentionOverlayScroll = useCallback(() => {
    if (!mentionOverlayRef.current || !inputRef.current) return;
    mentionOverlayRef.current.scrollTop = inputRef.current.scrollTop;
  }, []);

  useEffect(() => {
    if (editingMessage) return;

    const nextDraft = draftContent || '';
    const isConversationChange = lastDraftConversationIdRef.current !== (conversationId || null);

    if (isConversationChange) {
      lastDraftConversationIdRef.current = conversationId || null;
      setMessage(nextDraft);
      requestAnimationFrame(() => resizeInput());
      if (!nextDraft.trim()) stopTypingNow();
      return;
    }

    const hasRecentLocalChange = Date.now() - lastLocalDraftChangeAtRef.current < 1000;
    if (hasRecentLocalChange || messageRef.current === nextDraft) return;

    setMessage(nextDraft);
    requestAnimationFrame(() => resizeInput());
    if (!nextDraft.trim()) stopTypingNow();
  }, [conversationId, draftContent, editingMessage, resizeInput, stopTypingNow]);

  const updateTypingState = (nextMessage) => {
    if (!nextMessage.trim()) {
      stopTypingNow();
      return;
    }

    const now = Date.now();
    const shouldEmitTypingStart =
      !isTypingRef.current || now - lastTypingEmitAtRef.current >= TYPING_KEEPALIVE_MS;
    if (shouldEmitTypingStart && onTypingStart) {
      onTypingStart();
      isTypingRef.current = true;
      lastTypingEmitAtRef.current = now;
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      stopTypingNow();
    }, TYPING_IDLE_TIMEOUT_MS);
  };

  const notifyDraftChange = (nextMessage) => {
    if (editingMessage) return;

    lastLocalDraftChangeAtRef.current = Date.now();
    onDraftChange?.(conversationId, nextMessage);
  };

  const handleTextChange = (e) => {
    const nextMessage = e.target.value;
    const cursor = e.target.selectionStart;

    // Detect @ mention
    const atIdx = nextMessage.lastIndexOf('@', cursor - 1);
    if (atIdx !== -1 && cursor > atIdx && !nextMessage.slice(atIdx + 1, cursor).includes(' ')) {
      setMentionQuery(nextMessage.slice(atIdx + 1, cursor));
      setMentionStart(atIdx);
    } else {
      setMentionQuery(null);
    }

    setMessage(nextMessage);
    resizeInput(e.target);
    notifyDraftChange(nextMessage);
    updateTypingState(nextMessage);
  };

  const rememberEmoji = (emoji) => {
    setRecentEmojis((current) => {
      const next = [emoji, ...current.filter((item) => item !== emoji)].slice(0, 16);
      try {
        localStorage.setItem(RECENT_EMOJIS_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Ignore storage failures in private browsing modes.
      }
      return next;
    });
  };

  const handleEmojiSelect = (emoji) => {
    const input = inputRef.current;
    const selectionStart = input?.selectionStart ?? message.length;
    const selectionEnd = input?.selectionEnd ?? message.length;
    const nextMessage = `${message.slice(0, selectionStart)}${emoji}${message.slice(selectionEnd)}`;

    setMessage(nextMessage);
    rememberEmoji(emoji);
    notifyDraftChange(nextMessage);
    updateTypingState(nextMessage);

    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(
        selectionStart + emoji.length,
        selectionStart + emoji.length,
      );
      resizeInput();
    });
  };

  const handleStickerSelect = (sticker) => {
    if (
      disabled ||
      editingMessage ||
      hasPreviews ||
      hasVoicePreview ||
      isRecordingVoice ||
      isUploading ||
      isUploadingVoice
    ) {
      return;
    }

    onSendMessage('', null, replyingMessage, [], { sticker, intent: selectedIntent });
    setSelectedIntent(null);
    setMessage('');
    notifyDraftChange('');
    setIsPickerOpen(false);

    stopTypingNow();

    requestAnimationFrame(() => {
      inputRef.current?.focus();
      resizeInput();
    });
  };

  const handleMentionSelect = (username) => {
    const input = inputRef.current;
    const cursor = input?.selectionStart ?? message.length;
    const before = message.slice(0, mentionStart);
    const after = message.slice(cursor);
    const mentionText = `@${username} `;
    const nextMessage = before + mentionText + after;

    setMessage(nextMessage);
    setMentionQuery(null);
    notifyDraftChange(nextMessage);
    updateTypingState(nextMessage);

    requestAnimationFrame(() => {
      if (!input) return;
      const newCursor = mentionStart + mentionText.length;
      input.focus();
      input.setSelectionRange(newCursor, newCursor);
      resizeInput(input);
    });
  };

  const handleKeyDown = (e) => {
    if (mentionQuery !== null && isGroupChat) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionActiveIdx((prev) =>
          prev < mentionItems.length - 1 ? prev + 1 : 0,
        );
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionActiveIdx((prev) =>
          prev > 0 ? prev - 1 : mentionItems.length - 1,
        );
        return;
      }
      if (e.key === 'Enter' && mentionItems.length > 0) {
        e.preventDefault();
        const selected = mentionItems[mentionActiveIdx];
        handleMentionSelect(selected.isAll ? 'all' : selected.username);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setMentionQuery(null);
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const validateFile = (file) => {
    const isImage = file.type.startsWith('image/');
    const isAudio = file.type.startsWith('audio/');
    const isVideo = file.type.startsWith('video/');
    const maxSize = isImage ? 10 * 1024 * 1024 : 25 * 1024 * 1024;

    if (file.size > maxSize) {
      return `Kích thước tối đa ${isImage ? '10MB' : '25MB'} cho ${
        isAudio ? 'ghi âm' : isVideo ? 'video' : file.name
      }`;
    }

    return '';
  };

  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length === 0) return;

    setUploadError('');
    setUploadProgress(0);
    clearVoicePreview();

    const validationError = selectedFiles.map(validateFile).find(Boolean);
    if (validationError) {
      setUploadError(validationError);
      e.target.value = '';
      return;
    }

    setPreviews((current) => {
      const availableSlots = MAX_ATTACHMENTS - current.length;
      if (availableSlots <= 0) {
        setUploadError(`Tối đa ${MAX_ATTACHMENTS} file mỗi tin nhắn`);
        return current;
      }

      const acceptedFiles = selectedFiles.slice(0, availableSlots);
      if (selectedFiles.length > availableSlots) {
        setUploadError(
          `Chỉ nhận thêm ${availableSlots} file, tối đa ${MAX_ATTACHMENTS} file mỗi tin nhắn`,
        );
      }

      const nextPreviews = acceptedFiles.map((file) => {
        return {
          id: crypto.randomUUID(),
          url: URL.createObjectURL(file),
          type: getAttachmentType(file.type),
          name: file.name,
          size: file.size,
          file,
        };
      });

      return [...current, ...nextPreviews];
    });

    e.target.value = '';
  };

  const removePreview = (previewId) => {
    setPreviews((current) => {
      const removed = current.find((item) => item.id === previewId);
      if (removed?.url) URL.revokeObjectURL(removed.url);
      return current.filter((item) => item.id !== previewId);
    });
    setUploadError('');
    setUploadProgress(0);
  };

  const handleUploadFiles = async () => {
    const formData = new FormData();
    previews.forEach((preview) => {
      formData.append('files', preview.file);
    });

    const response = await api.post('/messages/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (progressEvent) => {
        if (!progressEvent.total) return;
        const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        setUploadProgress(progress);
      },
    });

    if (Array.isArray(response.data.files)) return response.data.files;
    return response.data.file ? [response.data.file] : [];
  };

  const handleSendWithAttachments = async () => {
    if (!hasPreviews || isUploading) return;

    setIsUploading(true);
    setUploadError('');
    setUploadProgress(0);

    try {
      const uploadedFiles = await handleUploadFiles();
      const attachments = uploadedFiles.map((uploadedFile, index) => {
        const preview = previews[index];
        const mimeType = uploadedFile.mimeType || preview?.file?.type || uploadedFile.type || '';
        return {
          type: getAttachmentType(uploadedFile.type, preview?.type || getAttachmentType(mimeType)),
          url: uploadedFile.url,
          storageKey: uploadedFile.storageKey,
          storageProvider: uploadedFile.storageProvider,
          filename: uploadedFile.filename || preview?.name,
          size: uploadedFile.size || preview?.size,
          mimeType,
        };
      });

      onSendMessage(message.trim(), attachments[0] || null, replyingMessage, attachments, { intent: selectedIntent });
      setSelectedIntent(null);
      setMessage('');
      clearPreviews();
      stopTypingNow();
    } catch (error) {
      console.error('Upload thất bại:', error);
      setUploadError('Upload thất bại, thử lại');
    } finally {
      setIsUploading(false);
    }
  };

  const startVoiceRecording = async () => {
    if (
      disabled ||
      editingMessage ||
      hasPreviews ||
      hasVoicePreview ||
      isRecordingVoice ||
      isUploading ||
      isUploadingVoice
    ) {
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setVoiceError('Trình duyệt chưa hỗ trợ ghi âm.');
      return;
    }

    try {
      setVoiceError('');
      discardVoiceRef.current = false;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = getSupportedAudioMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

      voiceStreamRef.current = stream;
      voiceChunksRef.current = [];
      mediaRecorderRef.current = recorder;

      // Setup AnalyserNode cho sóng live
      try {
        const aCtx = new AudioContext();
        const aSource = aCtx.createMediaStreamSource(stream);
        const analyser = aCtx.createAnalyser();
        analyser.fftSize = 256;
        aSource.connect(analyser);
        analyserCtxRef.current = aCtx;
        analyserSourceRef.current = aSource;
        const bufLen = analyser.frequencyBinCount;
        const dataArr = new Uint8Array(bufLen);
        const ringBuf = [];

        const updatePeaks = () => {
          if (!analyserCtxRef.current) return;
          analyser.getByteTimeDomainData(dataArr);
          let sum = 0;
          for (let i = 0; i < bufLen; i++) {
            const n = (dataArr[i] - 128) / 128;
            sum += n * n;
          }
          const rms = Math.min(1, Math.sqrt(sum / bufLen) * 2);
          ringBuf.push(rms);
          if (ringBuf.length > 40) ringBuf.shift();
          setLivePeaks([...ringBuf]);
          analyserTimerRef.current = setTimeout(updatePeaks, 80);
        };
        analyserTimerRef.current = setTimeout(updatePeaks, 80);
      } catch (e) {
        console.warn('AnalyserNode không khả dụng:', e);
      }

      recorder.ondataavailable = (event) => {
        if (event.data?.size > 0) {
          voiceChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const startedAt = recordingStartedAtRef.current || Date.now();
        clearVoiceTimer();
        if (analyserTimerRef.current) {
          clearTimeout(analyserTimerRef.current);
          analyserTimerRef.current = null;
        }
        if (analyserCtxRef.current) {
          analyserCtxRef.current.close();
          analyserCtxRef.current = null;
        }
        if (analyserSourceRef.current) {
          analyserSourceRef.current.disconnect();
          analyserSourceRef.current = null;
        }
        setLivePeaks([]);
        stopVoiceStream();
        mediaRecorderRef.current = null;
        recordingStartedAtRef.current = null;
        setIsRecordingVoice(false);

        if (discardVoiceRef.current) {
          discardVoiceRef.current = false;
          voiceChunksRef.current = [];
          setVoiceDuration(0);
          return;
        }

        const recordedMimeType = recorder.mimeType || mimeType || 'audio/webm';
        const blob = new Blob(voiceChunksRef.current, { type: recordedMimeType });
        voiceChunksRef.current = [];

        if (blob.size === 0) {
          setVoiceDuration(0);
          setVoiceError('Không ghi được âm thanh, thử lại.');
          return;
        }

        const duration = Math.max(1, Math.round((Date.now() - startedAt) / 1000));

        setVoicePreview((current) => {
          if (current?.url) URL.revokeObjectURL(current.url);
          return {
            url: URL.createObjectURL(blob),
            blob,
            duration,
            mimeType: recordedMimeType,
            size: blob.size,
          };
        });
        setVoiceDuration(duration);

        // Rút peaks async
        getPeaksFromBlob(blob).then((peaks) => {
          setVoicePreview((prev) => {
            if (!prev || prev.blob !== blob) return prev;
            return { ...prev, peaks };
          });
        });
      };

      recorder.onerror = () => {
        clearVoiceTimer();
        if (analyserTimerRef.current) {
          clearTimeout(analyserTimerRef.current);
          analyserTimerRef.current = null;
        }
        if (analyserCtxRef.current) {
          analyserCtxRef.current.close();
          analyserCtxRef.current = null;
        }
        if (analyserSourceRef.current) {
          analyserSourceRef.current.disconnect();
          analyserSourceRef.current = null;
        }
        setLivePeaks([]);
        stopVoiceStream();
        mediaRecorderRef.current = null;
        recordingStartedAtRef.current = null;
        setIsRecordingVoice(false);
        setVoiceDuration(0);
        setVoiceError('Không thể ghi âm, thử lại.');
      };

      recordingStartedAtRef.current = Date.now();
      setVoiceDuration(0);
      setIsRecordingVoice(true);
      recorder.start();

      voiceTimerRef.current = setInterval(() => {
        setVoiceDuration(
          Math.max(1, Math.round((Date.now() - recordingStartedAtRef.current) / 1000)),
        );
      }, 500);
    } catch (error) {
      console.error('Không thể truy cập micro:', error);
      clearVoiceTimer();
      stopVoiceStream();
      mediaRecorderRef.current = null;
      recordingStartedAtRef.current = null;
      setIsRecordingVoice(false);
      setVoiceDuration(0);
      setVoiceError('Không thể truy cập micro. Hãy cấp quyền rồi thử lại.');
    }
  };

  const stopVoiceRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === 'inactive') {
      clearVoiceTimer();
      stopVoiceStream();
      mediaRecorderRef.current = null;
      recordingStartedAtRef.current = null;
      setIsRecordingVoice(false);
      return;
    }

    recorder.stop();
  };

  const cancelVoiceRecording = () => {
    discardVoiceRef.current = true;
    const recorder = mediaRecorderRef.current;

    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
    } else {
      clearVoiceTimer();
      stopVoiceStream();
      mediaRecorderRef.current = null;
      recordingStartedAtRef.current = null;
      setIsRecordingVoice(false);
      setVoiceDuration(0);
      discardVoiceRef.current = false;
    }
  };

  const handleSendVoiceMessage = async () => {
    if (!voicePreview || isUploadingVoice || disabled) return;

    setIsUploadingVoice(true);
    setVoiceError('');

    try {
      const extension = getAudioExtension(voicePreview.mimeType);
      const voiceFile = new File([voicePreview.blob], `voice-${Date.now()}.${extension}`, {
        type: voicePreview.mimeType || 'audio/webm',
      });
      const formData = new FormData();
      formData.append('files', voiceFile);

      const response = await api.post('/messages/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const uploadedFile = Array.isArray(response.data.files)
        ? response.data.files[0]
        : response.data.file;

      if (!uploadedFile?.url) {
        throw new Error('Upload voice không trả về file.');
      }

      const attachment = {
        type: 'audio',
        url: uploadedFile.url,
        storageKey: uploadedFile.storageKey,
        storageProvider: uploadedFile.storageProvider,
        filename: uploadedFile.filename || voiceFile.name,
        size: uploadedFile.size || voicePreview.size,
        mimeType: uploadedFile.mimeType || voiceFile.type,
        duration: voicePreview.duration,
        peaks: voicePreview.peaks || undefined,
      };

      onSendMessage(message.trim(), attachment, replyingMessage, [attachment], { intent: selectedIntent });
      setSelectedIntent(null);
      setMessage('');
      clearVoicePreview();
      stopTypingNow();
    } catch (error) {
      console.error('Gửi ghi âm thất bại:', error);
      setVoiceError('Gửi ghi âm thất bại, thử lại.');
    } finally {
      setIsUploadingVoice(false);
    }
  };

  const processingTrimRef = useRef(false);

  const handleConfirmTrim = useCallback(async (startSec, endSec) => {
    const currentPreview = voicePreviewRef.current;
    if (!currentPreview?.blob || processingTrimRef.current) return;
    const requestId = ++trimRequestIdRef.current;
    processingTrimRef.current = true;
    setIsProcessingTrim(true);
    setVoiceError('');
    isTrimErrorRef.current = false;
    try {
      const {
        blob: wavBlob,
        duration: newDuration,
        peaks,
      } = await trimVoiceToWav(currentPreview.blob, startSec, endSec);
      if (requestId !== trimRequestIdRef.current) return;
      if (currentPreview.url) URL.revokeObjectURL(currentPreview.url);
      setVoicePreview({
        url: URL.createObjectURL(wavBlob),
        blob: wavBlob,
        duration: newDuration,
        mimeType: 'audio/wav',
        size: wavBlob.size,
        peaks,
      });
      setIsTrimmingVoice(false);
    } catch (error) {
      if (requestId !== trimRequestIdRef.current) return;
      console.error('Cắt ghi âm thất bại:', error);
      setVoiceError('Không thể cắt ghi âm, thử lại.');
      isTrimErrorRef.current = true;
      setIsTrimmingVoice(false);
    } finally {
      setIsProcessingTrim(false);
      processingTrimRef.current = false;
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (isTrimmingVoice || isProcessingTrim) return;

    if (editingMessage) {
      if (!message.trim()) return;

      onEditMessage?.(message.trim());
      setMessage('');
      stopTypingNow();

      return;
    }

    if (hasPreviews) {
      await handleSendWithAttachments();
      return;
    }

    if (hasVoicePreview) {
      await handleSendVoiceMessage();
      return;
    }

    if (message.trim() && !disabled) {
      onSendMessage(message.trim(), null, replyingMessage, [], { intent: selectedIntent });
      setSelectedIntent(null);
      setMessage('');
      if (inputRef.current) {
        inputRef.current.style.height = 'auto';
      }
      stopTypingNow();
    }
  };

  const canSend = editingMessage
    ? Boolean(message.trim()) && !disabled
    : (Boolean(message.trim()) || hasPreviews || hasVoicePreview) &&
      !disabled &&
      !isUploading &&
      !isUploadingVoice &&
      !isRecordingVoice &&
      !isTrimmingVoice &&
      !isProcessingTrim;
  const canRecordVoice =
    !disabled &&
    !editingMessage &&
    !hasPreviews &&
    !hasVoicePreview &&
    !isUploading &&
    !isUploadingVoice;
  const canSendSticker =
    !disabled &&
    !editingMessage &&
    !hasPreviews &&
    !hasVoicePreview &&
    !isUploading &&
    !isUploadingVoice &&
    !isRecordingVoice;
  const canSchedule =
    Boolean(message.trim()) &&
    !disabled &&
    !editingMessage &&
    !hasPreviews &&
    !hasVoicePreview &&
    !isUploading &&
    !isUploadingVoice &&
    !isRecordingVoice &&
    Boolean(onScheduleMessage);
  const canOpenPoll =
    canCreatePoll &&
    !disabled &&
    !editingMessage &&
    !hasPreviews &&
    !hasVoicePreview &&
    !isUploading &&
    !isUploadingVoice &&
    !isRecordingVoice &&
    Boolean(onCreatePoll);
  const canOpenEvent =
    canCreateEvent &&
    !disabled &&
    !editingMessage &&
    !hasPreviews &&
    !hasVoicePreview &&
    !isUploading &&
    !isUploadingVoice &&
    !isRecordingVoice &&
    Boolean(onCreateEvent);
  const canOpenChecklist =
    canCreateChecklist &&
    !disabled &&
    !editingMessage &&
    !hasPreviews &&
    !hasVoicePreview &&
    !isUploading &&
    !isUploadingVoice &&
    !isRecordingVoice &&
    Boolean(onCreateChecklist);
  const canOpenPlan =
    canCreatePlan &&
    !disabled &&
    !editingMessage &&
    !hasPreviews &&
    !hasVoicePreview &&
    !isUploading &&
    !isUploadingVoice &&
    !isRecordingVoice &&
    Boolean(onCreatePlan);
  const canOpenReminder =
    canCreateReminder &&
    !disabled &&
    !editingMessage &&
    !hasPreviews &&
    !hasVoicePreview &&
    !isUploading &&
    !isUploadingVoice &&
    !isRecordingVoice &&
    Boolean(onCreateReminder);
  const composerActions = [
    canOpenPoll
      ? {
          key: 'poll',
          label: 'Bình chọn',
          description: 'Tạo poll trong nhóm',
          icon: 'poll',
          onSelect: () => setIsPollOpen(true),
        }
      : null,
    canOpenEvent
      ? {
          key: 'event',
          label: 'Sự kiện',
          description: 'Tạo lịch hẹn trong chat',
          icon: 'event',
          onSelect: () => setIsEventOpen(true),
        }
      : null,
    canOpenChecklist
      ? {
          key: 'checklist',
          label: 'Checklist',
          description: 'Chia việc trong nhóm',
          icon: 'checklist',
          onSelect: () => setIsChecklistOpen(true),
        }
      : null,
    canOpenPlan
      ? {
          key: 'plan',
          label: 'Kế hoạch',
          description: 'Tạo kế hoạch chung',
          icon: 'plan',
          onSelect: () => setIsPlanOpen(true),
        }
      : null,
    canOpenReminder
      ? {
          key: 'reminder',
          label: 'Nhắc hẹn',
          description: 'Tạo nhắc định kỳ cá nhân',
          icon: 'reminder',
          onSelect: () => setIsReminderOpen(true),
        }
      : null,
  ].filter(Boolean);
  const hasComposerActions = composerActions.length > 0;

  useEffect(() => {
    if (!canOpenPoll) setIsPollOpen(false);
  }, [canOpenPoll]);

  useEffect(() => {
    if (!canOpenEvent) setIsEventOpen(false);
  }, [canOpenEvent]);

  useEffect(() => {
    if (!canOpenChecklist) setIsChecklistOpen(false);
  }, [canOpenChecklist]);

  useEffect(() => {
    if (!canOpenPlan) setIsPlanOpen(false);
  }, [canOpenPlan]);

  useEffect(() => {
    if (!canOpenReminder) setIsReminderOpen(false);
  }, [canOpenReminder]);

  useEffect(() => {
    if (!hasComposerActions) setIsActionMenuOpen(false);
  }, [hasComposerActions]);

  const handleScheduleSubmit = async (scheduledAt) => {
    if (!canSchedule) return;

    await onScheduleMessage?.({
      content: message.trim(),
      replyTo: replyingMessage,
      scheduledAt,
    });

    setMessage('');
    notifyDraftChange('');
    onCancelReplyMessage?.();
    stopTypingNow();

    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }
  };

  const handleCreateReminderSubmit = async (reminderInput) => {
    if (!canOpenReminder) return;

    await onCreateReminder?.(reminderInput);
    setMessage('');
    notifyDraftChange('');
    stopTypingNow();

    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }
  };

  return (
    <footer className="relative shrink-0 overflow-visible border-t border-outline-variant bg-surface px-3 py-2.5 md:px-5 md:py-3">
      {isScheduleOpen && (
        <Suspense fallback={null}>
          <ScheduleMessageModal
            open
            contentPreview={message}
            onClose={() => setIsScheduleOpen(false)}
            onSchedule={handleScheduleSubmit}
          />
        </Suspense>
      )}
      {isPollOpen && (
        <Suspense fallback={null}>
          <CreatePollModal open onClose={() => setIsPollOpen(false)} onCreatePoll={onCreatePoll} />
        </Suspense>
      )}
      {isEventOpen && (
        <Suspense fallback={null}>
          <CreateEventModal
            open
            onClose={() => setIsEventOpen(false)}
            onCreateEvent={onCreateEvent}
          />
        </Suspense>
      )}
      {isChecklistOpen && (
        <Suspense fallback={null}>
          <CreateChecklistModal
            open
            onClose={() => setIsChecklistOpen(false)}
            onCreateChecklist={onCreateChecklist}
            members={conversationMembers}
          />
        </Suspense>
      )}
      {isPlanOpen && (
        <Suspense fallback={null}>
          <CreatePlanModal
            open
            initialTitle={message}
            onClose={() => setIsPlanOpen(false)}
            onCreatePlan={async (planInput) => {
              await onCreatePlan?.(planInput);
              setMessage('');
              notifyDraftChange('');
              stopTypingNow();
            }}
          />
        </Suspense>
      )}
      {isReminderOpen && (
        <Suspense fallback={null}>
          <CreateRecurringReminderModal
            open
            initialTitle={message}
            onClose={() => setIsReminderOpen(false)}
            onCreateReminder={handleCreateReminderSubmit}
          />
        </Suspense>
      )}

      {hasPreviews && (
        <div className="mb-2 w-full rounded-[16px] border border-outline-variant bg-surface-container-lowest p-3 shadow-sm md:rounded-[12px] md:p-3.5">
          <div className="mx-auto mb-3 h-1 w-12 rounded-full bg-outline md:hidden" />
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-on-surface">
                {previews.length} tệp sẵn sàng gửi
              </p>
              <p className="hidden text-xs text-on-surface-variant sm:block">
                Gõ nội dung bên dưới để gửi kèm caption
              </p>
            </div>
            <button
              type="button"
              onClick={clearPreviews}
              disabled={isUploading}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-on-surface-variant transition-colors hover:bg-surface-container-high disabled:opacity-40"
              title="Xóa tất cả"
            >
              <AppIcon name="close" className="text-xl" />
            </button>
          </div>

          {imagePreviews.length > 0 && (
            <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
              {imagePreviews.map((preview, index) => (
                <div
                  key={preview.id}
                  className="relative h-[88px] w-[88px] shrink-0 overflow-hidden rounded-[10px] border border-outline-variant bg-surface-container-low md:h-[82px] md:w-[82px]"
                >
                  <img
                    src={preview.url}
                    alt={preview.name || 'Ảnh đã chọn'}
                    className="h-full w-full object-cover"
                  />
                  <span className="absolute left-1.5 top-1.5 grid h-6 min-w-6 place-items-center rounded-full bg-surface-container-lowest/95 px-1 text-[11px] font-semibold text-on-surface shadow-sm">
                    {index + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => removePreview(preview.id)}
                    disabled={isUploading}
                    className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-[#1f1d1a]/70 text-white transition-colors hover:bg-[#1f1d1a] disabled:opacity-40"
                    title="Bỏ ảnh này"
                  >
                    <AppIcon name="close" className="text-[17px]" />
                  </button>
                </div>
              ))}

              {previews.length < MAX_ATTACHMENTS && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="grid h-[88px] w-[88px] shrink-0 place-items-center rounded-[10px] border border-dashed border-outline-variant text-on-surface-variant transition-colors hover:border-outline hover:bg-surface-container-low md:h-[82px] md:w-[82px]"
                  title="Thêm tệp"
                >
                  <AppIcon name="attach_file" className="text-[22px]" />
                </button>
              )}
            </div>
          )}

          {filePreviews.length > 0 && (
            <div
              className={`${imagePreviews.length > 0 ? 'mt-3' : ''} overflow-hidden rounded-[10px] border border-outline-variant bg-surface`}
            >
              {filePreviews.map((preview, index) => (
                <div
                  key={preview.id}
                  className="flex min-w-0 items-center gap-3 border-b border-outline-variant px-3 py-2.5 last:border-b-0"
                >
                  <FileTypeIcon
                    filename={preview.name}
                    mimeType={preview.file?.type}
                    type={preview.type}
                    size="sm"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-on-surface">{preview.name}</p>
                    <div className="mt-1 flex items-center gap-2 text-xs text-on-surface-variant">
                      <span>{formatFileSize(preview.size)}</span>
                      <span>·</span>
                      <span>
                        {preview.type === 'audio'
                          ? 'AUDIO'
                          : preview.name?.split('.').pop()?.toUpperCase() || 'FILE'}
                      </span>
                      {isUploading && index === 0 && (
                        <>
                          <span>·</span>
                          <span className="text-secondary">{uploadProgress}%</span>
                        </>
                      )}
                    </div>
                    {isUploading && index === 0 && (
                      <span className="mt-2 block h-1 overflow-hidden rounded-full bg-surface-container-low">
                        <span
                          className="block h-full rounded-full bg-secondary transition-[width]"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => removePreview(preview.id)}
                    disabled={isUploading}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-on-surface disabled:opacity-40"
                    title="Bỏ file này"
                  >
                    <AppIcon name="close" className="text-[18px]" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {isUploading && (
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-container-low">
              <div
                className="h-full rounded-full bg-secondary transition-[width]"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          )}
        </div>
      )}

      {uploadError && (
        <div className="mb-2 flex w-full items-center justify-between gap-3 rounded-[8px] border border-error/20 bg-error-container px-3 py-2 text-sm text-error">
          <p>{uploadError}</p>
          {hasPreviews && (
            <button
              type="button"
              onClick={handleSendWithAttachments}
              disabled={isUploading}
              className="shrink-0 rounded-md bg-error px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
            >
              Thử lại
            </button>
          )}
        </div>
      )}

      {(isRecordingVoice || hasVoicePreview || isTrimmingVoice) && (
        <div className="mb-2 w-full rounded-[16px] border border-outline-variant bg-surface-container-lowest px-3 py-2.5 shadow-sm sm:rounded-[12px] sm:py-3">
          {isRecordingVoice ? (
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center gap-3">
                <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-error-container text-error">
                  <span className="absolute h-2.5 w-2.5 animate-ping rounded-full bg-error/45" />
                  <span className="h-2.5 w-2.5 rounded-full bg-error" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-on-surface">Đang ghi âm...</p>
                  <p className="text-xs text-on-surface-variant">
                    {formatVoiceDuration(voiceDuration)} · nhấn dừng để xem lại
                  </p>
                </div>
                <button
                  type="button"
                  onClick={cancelVoiceRecording}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-on-surface"
                  title="Hủy ghi âm"
                >
                  <AppIcon name="close" className="text-xl" />
                </button>
                <button
                  type="button"
                  onClick={stopVoiceRecording}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-error text-white transition-colors hover:bg-error/90"
                  title="Dừng ghi âm"
                >
                  <AppIcon name="stop" className="text-xl" />
                </button>
              </div>
              <VoiceWave peaks={livePeaks} allFilled tone="error" height={40} />
            </div>
          ) : isTrimmingVoice ? (
            <VoiceTrimmer
              src={voicePreview.url}
              duration={voicePreview.duration}
              peaks={voicePreview.peaks}
              onCancel={() => {
                trimRequestIdRef.current++;
                setIsTrimmingVoice(false);
              }}
              onConfirm={handleConfirmTrim}
            />
          ) : (
            <>
              <div className="flex items-center gap-2 sm:hidden">
                <VoicePreviewPlayer
                  src={voicePreview.url}
                  duration={voicePreview.duration}
                  size={voicePreview.size}
                  peaks={voicePreview.peaks}
                />
                {voicePreview.duration >= 2 && (
                  <button
                    type="button"
                    onClick={() => setIsTrimmingVoice(true)}
                    disabled={isUploadingVoice || isProcessingTrim}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-on-surface disabled:opacity-40"
                    title="Cắt ghi âm"
                  >
                    <AppIcon name="content_cut" className="text-xl" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={clearVoicePreview}
                  disabled={isUploadingVoice}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-on-surface disabled:opacity-40"
                  title="Bỏ ghi âm"
                >
                  <AppIcon name="close" className="text-xl" />
                </button>
              </div>

              <div className="hidden gap-3 sm:flex sm:items-center">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-on-surface">
                    <AppIcon name="graphic_eq" className="text-[22px]" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-on-surface">Ghi âm sẵn sàng gửi</p>
                    <p className="text-xs text-on-surface-variant">
                      {formatVoiceDuration(voicePreview.duration)} ·{' '}
                      {formatFileSize(voicePreview.size)}
                    </p>
                  </div>
                </div>
                <div className="min-w-[180px] flex-1">
                  <VoicePreviewPlayer
                    src={voicePreview.url}
                    duration={voicePreview.duration}
                    size={voicePreview.size}
                    peaks={voicePreview.peaks}
                  />
                </div>
                {voicePreview.duration >= 2 && (
                  <button
                    type="button"
                    onClick={() => setIsTrimmingVoice(true)}
                    disabled={isUploadingVoice || isProcessingTrim}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-on-surface disabled:opacity-40"
                    title="Cắt ghi âm"
                  >
                    <AppIcon name="content_cut" className="text-xl" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={clearVoicePreview}
                  disabled={isUploadingVoice}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-on-surface disabled:opacity-40"
                  title="Bỏ ghi âm"
                >
                  <AppIcon name="close" className="text-xl" />
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {voiceError && (
        <div className="mb-2 flex w-full items-center justify-between gap-3 rounded-[8px] border border-error/20 bg-error-container px-3 py-2 text-sm text-error">
          <p>{voiceError}</p>
          {hasVoicePreview && !isTrimErrorRef.current && (
            <button
              type="button"
              onClick={handleSendVoiceMessage}
              disabled={isUploadingVoice}
              className="shrink-0 rounded-md bg-error px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
            >
              Thử lại
            </button>
          )}
        </div>
      )}

      {editingMessage && (
        <div className="mb-2 flex w-full items-center justify-between gap-3 rounded-[12px] border border-secondary bg-secondary-container px-3 py-2">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-on-surface">Đang chỉnh sửa tin nhắn</p>
            <p className="truncate text-xs text-on-surface-variant">{editingMessage.content}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setMessage('');
              onCancelEditMessage?.();
            }}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-on-surface-variant hover:bg-surface-container-low"
          >
            <AppIcon name="close" className="text-xl" />
          </button>
        </div>
      )}

      {replyingMessage && !editingMessage && (
        <div className="mb-2 flex w-full items-center justify-between gap-3 rounded-[12px] border border-outline-variant bg-surface-container-lowest px-3 py-2">
          <div className="min-w-0 border-l-2 border-accent pl-3">
            <p className="text-xs font-semibold text-on-surface">
              Đang trả lời {replyingMessage.senderName || 'tin nhắn'}
            </p>
            <p className="truncate text-xs text-on-surface-variant">
              {getReplyPreviewText(replyingMessage)}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancelReplyMessage}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-on-surface-variant hover:bg-surface-container-low"
          >
            <AppIcon name="close" className="text-xl" />
          </button>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_FILE_TYPES}
        multiple
        disabled={disabled || Boolean(editingMessage) || isRecordingVoice || hasVoicePreview}
        onChange={handleFileChange}
        className="hidden"
      />

      {conversationId && !isSaved && (
        <div className="absolute -top-14 left-3 z-[120] flex items-center md:left-5">
          <button
            ref={summaryButtonRef}
            type="button"
            onClick={() => setIsSummaryOpen((v) => !v)}
            aria-label="Mở tóm tắt AI"
            aria-expanded={isSummaryOpen}
            className={`inline-flex h-10 items-center gap-2 rounded-full border px-3.5 text-[13px] font-semibold shadow-lg shadow-black/10 backdrop-blur transition-all ${
              isSummaryOpen
                ? 'border-secondary/40 bg-secondary/10 text-secondary shadow-secondary/10'
                : 'border-secondary/20 bg-surface-container-lowest/95 text-on-surface hover:border-secondary/40 hover:bg-secondary/10 hover:text-secondary'
            }`}
            title="Tóm tắt AI theo thời gian hoặc số lượng"
          >
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full ${
                isSummaryOpen ? 'bg-secondary text-surface' : 'bg-secondary/10 text-secondary'
              }`}
            >
              <AppIcon name="sparkles" className="text-[15px]" />
            </span>
            <span>Tóm tắt AI</span>
          </button>
          <div data-summary-popover className={isSummaryOpen ? '' : 'hidden'}>
            <MessageSummaryPopover
              conversationId={conversationId}
              isSaved={isSaved}
              onJumpToMessage={onJumpToMessage}
              onClose={() => setIsSummaryOpen(false)}
            />
          </div>
        </div>
      )}

      <div className="relative">
        {mentionQuery !== null && isGroupChat && mentionableMembers.length > 0 && (
          <MentionDropdown
            members={mentionableMembers}
            query={mentionQuery}
            onSelect={handleMentionSelect}
            activeIndex={mentionActiveIdx}
            onActiveIndexChange={setMentionActiveIdx}
          />
        )}
        <form
          onSubmit={handleSubmit}
          className="flex min-h-[48px] w-full items-end gap-1.5 rounded-[14px] border border-outline-variant bg-surface-container-lowest py-1.5 pl-2.5 pr-1.5 transition-colors focus-within:border-outline focus-within:ring-1 focus-within:ring-outline"
        >
          <button
            type="button"
            onClick={() => {
              setIsActionMenuOpen(false);
              fileInputRef.current?.click();
            }}
            disabled={disabled || Boolean(editingMessage) || isRecordingVoice || hasVoicePreview}
            className="flex h-[36px] w-[36px] shrink-0 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-on-surface disabled:opacity-30"
            title="Đính kèm"
          >
            <AppIcon name="attach_file" className="text-[20px]" />
          </button>

          {hasComposerActions && (
            <button
              ref={actionButtonRef}
              type="button"
              onClick={() => {
                setIsPickerOpen(false);
                setIsActionMenuOpen((current) => !current);
              }}
              className={`flex h-[36px] w-[36px] shrink-0 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-on-surface ${
                isActionMenuOpen ? 'bg-surface-container-low text-on-surface' : ''
              }`}
              title="Thao tác"
              aria-label="Mở thao tác"
              aria-expanded={isActionMenuOpen}
            >
              <AppIcon name="add" className="text-[20px]" />
            </button>
          )}

          {canOpenPoll && (
            <button
              type="button"
              onClick={() => setIsPollOpen(true)}
              className="hidden h-[36px] w-[36px] shrink-0 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-on-surface"
              title="Tạo bình chọn"
            >
              <AppIcon name="poll" className="text-[19px]" />
            </button>
          )}

          {canOpenEvent && (
            <button
              type="button"
              onClick={() => setIsEventOpen(true)}
              className="hidden h-[36px] w-[36px] shrink-0 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-on-surface"
              title="Tạo sự kiện"
            >
              <AppIcon name="event" className="text-[19px]" />
            </button>
          )}

          {canOpenChecklist && (
            <button
              type="button"
              onClick={() => setIsChecklistOpen(true)}
              className="hidden h-[36px] w-[36px] shrink-0 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-on-surface"
              title="Tạo checklist"
            >
              <AppIcon name="checklist" className="text-[19px]" />
            </button>
          )}

          {canOpenPlan && (
            <button
              type="button"
              onClick={() => setIsPlanOpen(true)}
              className="hidden h-[36px] w-[36px] shrink-0 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-on-surface"
              title="Tạo kế hoạch"
            >
              <AppIcon name="plan" className="text-[19px]" />
            </button>
          )}

          {canOpenReminder && (
            <button
              type="button"
              onClick={() => setIsReminderOpen(true)}
              className="hidden h-[36px] w-[36px] shrink-0 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-on-surface"
              title="Tạo nhắc hẹn"
            >
              <AppIcon name="reminder" className="text-[19px]" />
            </button>
          )}

          <div className="relative min-w-0 flex-1">
            {message && !editingMessage && (
              <div
                ref={mentionOverlayRef}
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap break-words px-2 py-1.5 text-[16px] text-on-surface [overflow-wrap:anywhere] md:text-[15px]"
              >
                {renderedDraftMessage}
              </div>
            )}
            <textarea
              ref={inputRef}
              value={message}
              onChange={handleTextChange}
              onKeyDown={handleKeyDown}
              onFocus={onFocus}
              onScroll={syncMentionOverlayScroll}
              disabled={disabled || isRecordingVoice}
              autoComplete="off"
              rows={1}
              className={`relative z-10 block w-full resize-none border-none bg-transparent px-2 py-1.5 text-[16px] outline-none placeholder:text-on-surface-variant no-scrollbar caret-on-surface md:text-[15px] ${
                message && !editingMessage ? 'text-transparent' : 'text-on-surface'
              }`}
              placeholder={
                editingMessage
                  ? 'Chỉnh sửa tin nhắn...'
                  : isRecordingVoice
                    ? 'Đang ghi âm...'
                    : hasPreviews || hasVoicePreview
                      ? 'Viết chú thích...'
                      : 'Nhập tin nhắn...'
              }
            />
          </div>

          <button
            ref={emojiButtonRef}
            type="button"
            onClick={() => {
              setIsActionMenuOpen(false);
              setActivePickerTab('emoji');
              setIsPickerOpen((current) => !current);
            }}
            disabled={disabled || isRecordingVoice}
            className="flex h-[36px] w-[36px] shrink-0 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-on-surface disabled:opacity-30"
            title="Cảm xúc"
          >
            <AppIcon name="emoji_picker" className="text-[20px]" />
          </button>

          <button
            ref={intentButtonRef}
            type="button"
            onClick={() => {
              setIsActionMenuOpen(false);
              setIsPickerOpen(false);
              setIsIntentPickerOpen((current) => !current);
            }}
            disabled={disabled || isRecordingVoice || Boolean(editingMessage)}
            className={`flex h-[36px] w-[36px] shrink-0 items-center justify-center rounded-full transition-colors disabled:opacity-30 ${
              isIntentPickerOpen || selectedIntent
                ? 'bg-surface-container-low text-secondary'
                : 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface'
            }`}
            title={selectedIntent ? `Đã đánh dấu: ${INTENT_OPTIONS.find((o) => o.key === selectedIntent)?.label}` : 'Đánh dấu'}
          >
            <AppIcon name="label" className="text-[20px]" />
          </button>

          {canSchedule && (
            <button
              type="button"
              onClick={() => {
                setIsActionMenuOpen(false);
                setIsScheduleOpen(true);
              }}
              className="flex h-[36px] w-[36px] shrink-0 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-on-surface"
              title="Hẹn giờ gửi"
            >
              <AppIcon name="schedule" className="text-[19px]" />
            </button>
          )}

          {!canSend && (
            <button
              type="button"
              onClick={isRecordingVoice ? stopVoiceRecording : startVoiceRecording}
              disabled={!isRecordingVoice && !canRecordVoice}
              className={`flex h-[36px] w-[36px] shrink-0 items-center justify-center rounded-full transition-colors disabled:opacity-30 ${
                isRecordingVoice
                  ? 'bg-error text-surface hover:bg-error/90'
                  : 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface'
              }`}
              title={isRecordingVoice ? 'Dừng ghi âm' : 'Ghi âm'}
            >
              <AppIcon name={isRecordingVoice ? 'stop' : 'mic'} className="text-[20px]" />
            </button>
          )}

          <button
            type="submit"
            disabled={!canSend}
            className={`flex h-[36px] w-[36px] shrink-0 items-center justify-center rounded-full transition-all ${
              canSend ? 'bg-secondary text-surface hover:opacity-90 active:scale-[0.96]' : 'hidden'
            }`}
            title={editingMessage ? 'Lưu chỉnh sửa' : 'Gửi tin nhắn'}
          >
            <AppIcon name={editingMessage ? 'check' : 'send'} className="text-[18px]" />
          </button>
        </form>

        {selectedIntent && !editingMessage && (
          <div className="mt-1.5 flex items-center justify-between rounded-[10px] border border-outline-variant bg-surface-container-lowest px-2.5 py-1.5">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-on-surface">
              <AppIcon name={INTENT_OPTIONS.find((o) => o.key === selectedIntent)?.icon || 'label'} className={`text-[16px] ${INTENT_OPTIONS.find((o) => o.key === selectedIntent)?.color || ''}`} />
              {INTENT_OPTIONS.find((o) => o.key === selectedIntent)?.label || ''}
            </span>
            <button
              type="button"
              onClick={() => setSelectedIntent(null)}
              className="flex h-6 w-6 items-center justify-center rounded-md text-on-surface-variant hover:bg-surface-container-low"
            >
              <AppIcon name="close" className="text-[14px]" />
            </button>
          </div>
        )}

        {isIntentPickerOpen && !editingMessage && (
          <div
            ref={intentPickerRef}
            className="absolute bottom-[calc(100%+8px)] right-0 z-[130] w-56 overflow-hidden rounded-[14px] border border-outline-variant bg-surface-container-lowest p-1.5 shadow-xl"
          >
            {INTENT_OPTIONS.map((option) => {
              const isActive = selectedIntent === option.key;
              return (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => {
                    setSelectedIntent((current) => (current === option.key ? null : option.key));
                    setIsIntentPickerOpen(false);
                  }}
                  className={`flex w-full items-center gap-3 rounded-[10px] px-3 py-2.5 text-left transition-colors hover:bg-surface-container-low ${
                    isActive ? option.bg : ''
                  }`}
                >
                  <AppIcon name={option.icon} className={`text-[18px] ${option.color}`} />
                  <span className={`text-sm font-medium ${isActive ? option.color : 'text-on-surface'}`}>
                    {option.label}
                  </span>
                  {isActive && (
                    <AppIcon name="check" className="ml-auto text-[16px] text-secondary" />
                  )}
                </button>
              );
            })}
          </div>
        )}

        {isActionMenuOpen && hasComposerActions && (
          <div
            ref={actionMenuRef}
            className="absolute bottom-[calc(100%+8px)] left-0 z-[130] w-60 overflow-hidden rounded-[14px] border border-outline-variant bg-surface-container-lowest p-1.5 shadow-xl"
          >
            {composerActions.map((action) => (
              <button
                key={action.key}
                type="button"
                onClick={() => {
                  setIsActionMenuOpen(false);
                  action.onSelect();
                }}
                className="flex w-full items-center gap-3 rounded-[10px] px-3 py-2.5 text-left transition-colors hover:bg-surface-container-low"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[9px] bg-accent-soft text-on-surface">
                  <AppIcon name={action.icon} className="text-[18px]" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-on-surface">
                    {action.label}
                  </span>
                  <span className="block truncate text-xs text-on-surface-variant">
                    {action.description}
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}

        {isPickerOpen && (
          <div ref={pickerRef}>
            <Suspense
              fallback={
                <div className="fixed inset-x-3 bottom-[74px] z-[120] h-56 rounded-[18px] border border-outline-variant bg-surface-container-lowest p-3 shadow-xl md:absolute md:inset-x-auto md:bottom-[calc(100%+10px)] md:right-0 md:w-[390px]">
                  <div className="h-full animate-pulse rounded-[14px] bg-surface-container-low" />
                </div>
              }
            >
              <EmojiStickerPicker
                activeTab={activePickerTab}
                onTabChange={setActivePickerTab}
                recentEmojis={recentEmojis}
                onEmojiSelect={handleEmojiSelect}
                onStickerSelect={handleStickerSelect}
                onClose={() => setIsPickerOpen(false)}
                disableStickers={!canSendSticker}
              />
            </Suspense>
          </div>
        )}
      </div>
    </footer>
  );
};

export default MessageInput;
