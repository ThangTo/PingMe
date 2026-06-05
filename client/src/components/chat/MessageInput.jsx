import { useEffect, useRef, useState } from 'react';
import api from '../../config/api';

const REVOKED_MESSAGE_TEXT = 'Tin nhắn này đã được thu hồi';
const MAX_ATTACHMENTS = 5;
const ACCEPTED_FILE_TYPES =
  'image/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar,.txt,.csv';
const AUDIO_MIME_TYPES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
  'audio/ogg;codecs=opus',
];

const getMessageAttachments = (message = {}) => {
  if (Array.isArray(message.attachments) && message.attachments.length > 0) {
    return message.attachments;
  }
  return message.attachment ? [message.attachment] : [];
};

const getReplyPreviewText = (replyingMessage) => {
  if (!replyingMessage) return '';
  if (replyingMessage.isDeleted) return REVOKED_MESSAGE_TEXT;

  const attachments = getMessageAttachments(replyingMessage);
  if (replyingMessage.content) return replyingMessage.content;
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
  if (['image', 'file', 'audio'].includes(type)) return type;
  if (type.startsWith('image/')) return 'image';
  if (type.startsWith('audio/')) return 'audio';
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

const VoicePreviewPlayer = ({ src, duration = 0, size = 0 }) => {
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
        console.error('Không thể phát ghi âm preview:', error);
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
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <button
        type="button"
        onClick={togglePlayback}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-white transition-colors hover:bg-accent-dark"
        title={isPlaying ? 'Tạm dừng' : 'Nghe lại'}
        aria-label={isPlaying ? 'Tạm dừng ghi âm' : 'Nghe lại ghi âm'}
      >
        <span
          className="material-symbols-outlined text-[22px]"
          style={{ fontVariationSettings: "'FILL' 1" }}
        >
          {isPlaying ? 'pause' : 'play_arrow'}
        </span>
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
        <button
          type="button"
          onClick={handleSeek}
          className="block h-3 w-full py-1"
          aria-label="Tua ghi âm"
        >
          <span className="block h-1 overflow-hidden rounded-full bg-on-surface-variant/25">
            <span
              className="block h-full rounded-full bg-accent transition-[width]"
              style={{ width: `${progress}%` }}
            />
          </span>
        </button>
      </div>
      <audio ref={audioRef} src={src} preload="metadata" className="hidden" />
    </div>
  );
};

const MessageInput = ({
  onSendMessage,
  disabled = false,
  onTypingStart,
  onTypingStop,
  onFocus,
  editingMessage,
  replyingMessage,
  onEditMessage,
  onCancelEditMessage,
  onCancelReplyMessage,
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
  const fileInputRef = useRef(null);
  const inputRef = useRef(null);
  const wasEditingRef = useRef(false);
  const typingTimeoutRef = useRef(null);
  const previewsRef = useRef([]);
  const voicePreviewRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const voiceChunksRef = useRef([]);
  const voiceStreamRef = useRef(null);
  const voiceTimerRef = useRef(null);
  const recordingStartedAtRef = useRef(null);
  const discardVoiceRef = useRef(false);
  const hasPreviews = previews.length > 0;
  const hasVoicePreview = Boolean(voicePreview);

  useEffect(() => {
    previewsRef.current = previews;
  }, [previews]);

  useEffect(() => {
    voicePreviewRef.current = voicePreview;
  }, [voicePreview]);

  useEffect(
    () => () => {
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
      voiceStreamRef.current?.getTracks().forEach((track) => track.stop());
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    },
    [],
  );

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
  };

  useEffect(() => {
    if (!editingMessage) {
      if (wasEditingRef.current) {
        setMessage('');
        clearPreviews();
        clearVoicePreview();
        wasEditingRef.current = false;
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
  }, [editingMessage]);

  useEffect(() => {
    if (!replyingMessage || editingMessage) return;

    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  }, [replyingMessage, editingMessage]);

  const stopTypingNow = () => {
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    if (onTypingStop) onTypingStop();
  };

  const handleTextChange = (e) => {
    setMessage(e.target.value);
    if (onTypingStart) onTypingStart();
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      if (onTypingStop) onTypingStop();
    }, 1500);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const validateFile = (file) => {
    const isImage = file.type.startsWith('image/');
    const isAudio = file.type.startsWith('audio/');
    const maxSize = isImage ? 10 * 1024 * 1024 : 25 * 1024 * 1024;

    if (file.size > maxSize) {
      return `Kích thước tối đa ${isImage ? '10MB' : '25MB'} cho ${isAudio ? 'ghi âm' : file.name}`;
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
        setUploadError(`Chỉ nhận thêm ${availableSlots} file, tối đa ${MAX_ATTACHMENTS} file mỗi tin nhắn`);
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
          filename: uploadedFile.filename || preview?.name,
          size: uploadedFile.size || preview?.size,
          mimeType,
        };
      });

      onSendMessage(message.trim(), attachments[0] || null, replyingMessage, attachments);
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

      recorder.ondataavailable = (event) => {
        if (event.data?.size > 0) {
          voiceChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const startedAt = recordingStartedAtRef.current || Date.now();
        clearVoiceTimer();
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

        const duration = Math.max(
          1,
          Math.round((Date.now() - startedAt) / 1000),
        );

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
      };

      recorder.onerror = () => {
        clearVoiceTimer();
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
        filename: uploadedFile.filename || voiceFile.name,
        size: uploadedFile.size || voicePreview.size,
        mimeType: uploadedFile.mimeType || voiceFile.type,
        duration: voicePreview.duration,
      };

      onSendMessage(message.trim(), attachment, replyingMessage, [attachment]);
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

  const handleSubmit = async (e) => {
    e.preventDefault();

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
      onSendMessage(message.trim(), null, replyingMessage, []);
      setMessage('');
      stopTypingNow();
    }
  };

  const canSend = editingMessage
    ? Boolean(message.trim()) && !disabled
    : (Boolean(message.trim()) || hasPreviews || hasVoicePreview) &&
      !disabled &&
      !isUploading &&
      !isUploadingVoice &&
      !isRecordingVoice;
  const canRecordVoice =
    !disabled &&
    !editingMessage &&
    !hasPreviews &&
    !hasVoicePreview &&
    !isUploading &&
    !isUploadingVoice;

  return (
    <footer className="shrink-0 border-t border-outline-variant bg-surface px-4 py-3 md:px-7 md:py-5">
      {hasPreviews && (
        <div className="mx-auto mb-3 max-w-[860px] rounded-lg border border-outline-variant bg-surface-container-lowest p-3">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-on-surface">
                {previews.length} tệp sẵn sàng gửi
              </p>
              <p className="text-xs text-on-surface-variant">
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
              <span className="material-symbols-outlined text-xl">close</span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">
            {previews.map((preview, index) => (
              <div
                key={preview.id}
                className="relative overflow-hidden rounded-lg border border-outline-variant bg-surface-container-low"
              >
                {preview.type === 'image' ? (
                  <img
                    src={preview.url}
                    alt={preview.name || 'Ảnh đã chọn'}
                    className="aspect-square w-full object-cover"
                  />
                ) : preview.type === 'audio' ? (
                  <div className="flex aspect-square flex-col items-center justify-center gap-2 px-2 text-center">
                    <span className="material-symbols-outlined text-3xl text-on-surface-variant">
                      graphic_eq
                    </span>
                    <span className="line-clamp-2 text-xs font-medium text-on-surface">
                      {preview.name}
                    </span>
                    <audio controls src={preview.url} className="h-8 w-full" />
                  </div>
                ) : (
                  <div className="flex aspect-square flex-col items-center justify-center gap-2 px-2 text-center">
                    <span className="material-symbols-outlined text-3xl text-on-surface-variant">
                      description
                    </span>
                    <span className="line-clamp-2 text-xs font-medium text-on-surface">
                      {preview.name}
                    </span>
                  </div>
                )}

                {previews.length > 1 && (
                  <span className="absolute left-1.5 top-1.5 rounded-full bg-[#1f1d1a]/70 px-2 py-0.5 text-[11px] font-semibold text-white">
                    {index + 1}
                  </span>
                )}

                <button
                  type="button"
                  onClick={() => removePreview(preview.id)}
                  disabled={isUploading}
                  className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-[#1f1d1a]/70 text-white transition-colors hover:bg-[#1f1d1a] disabled:opacity-40"
                  title="Bỏ file này"
                >
                  <span className="material-symbols-outlined text-[17px]">close</span>
                </button>

                <div className="border-t border-outline-variant bg-surface-container-lowest px-2 py-1.5">
                  <p className="truncate text-[11px] font-medium text-on-surface">{preview.name}</p>
                  <p className="text-[10px] text-on-surface-variant">{formatFileSize(preview.size)}</p>
                </div>
              </div>
            ))}
          </div>

          {isUploading && (
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-container-low">
              <div
                className="h-full rounded-full bg-accent transition-[width]"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          )}
        </div>
      )}

      {uploadError && (
        <div className="mx-auto mb-3 flex max-w-[860px] items-center justify-between gap-3 rounded-md border border-error/20 bg-error-container px-3 py-2 text-sm text-error">
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

      {(isRecordingVoice || hasVoicePreview) && (
        <div className="mx-auto mb-3 max-w-[860px] rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2.5 sm:py-3">
          {isRecordingVoice ? (
            <div className="flex items-center gap-3">
              <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-error-container text-error">
                <span className="absolute h-2.5 w-2.5 animate-ping rounded-full bg-error/45" />
                <span className="h-2.5 w-2.5 rounded-full bg-error" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-on-surface">Đang ghi âm</p>
                <p className="text-xs text-on-surface-variant">
                  {formatVoiceDuration(voiceDuration)}
                </p>
              </div>
              <button
                type="button"
                onClick={cancelVoiceRecording}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-on-surface"
                title="Hủy ghi âm"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
              <button
                type="button"
                onClick={stopVoiceRecording}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent text-white transition-colors hover:bg-accent-dark"
                title="Dừng ghi âm"
              >
                <span className="material-symbols-outlined text-xl">stop</span>
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 sm:hidden">
                <VoicePreviewPlayer
                  src={voicePreview.url}
                  duration={voicePreview.duration}
                  size={voicePreview.size}
                />
                <button
                  type="button"
                  onClick={clearVoicePreview}
                  disabled={isUploadingVoice}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-on-surface disabled:opacity-40"
                  title="Bỏ ghi âm"
                >
                  <span className="material-symbols-outlined text-xl">close</span>
                </button>
              </div>

              <div className="hidden gap-3 sm:flex sm:items-center">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-on-surface">
                    <span
                      className="material-symbols-outlined text-[22px]"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      graphic_eq
                    </span>
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-on-surface">Ghi âm sẵn sàng gửi</p>
                    <p className="text-xs text-on-surface-variant">
                      {formatVoiceDuration(voicePreview.duration)} · {formatFileSize(voicePreview.size)}
                    </p>
                  </div>
                </div>
                <audio
                  controls
                  src={voicePreview.url}
                  className="h-9 min-w-0 flex-1 sm:max-w-[320px]"
                />
                <button
                  type="button"
                  onClick={clearVoicePreview}
                  disabled={isUploadingVoice}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-on-surface disabled:opacity-40"
                  title="Bỏ ghi âm"
                >
                  <span className="material-symbols-outlined text-xl">close</span>
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {voiceError && (
        <div className="mx-auto mb-3 flex max-w-[860px] items-center justify-between gap-3 rounded-md border border-error/20 bg-error-container px-3 py-2 text-sm text-error">
          <p>{voiceError}</p>
          {hasVoicePreview && (
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
        <div className="mx-auto mb-3 flex max-w-[860px] items-center justify-between gap-3 rounded-lg border border-accent bg-accent-soft px-3 py-2">
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
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>
      )}

      {replyingMessage && !editingMessage && (
        <div className="mx-auto mb-3 flex max-w-[860px] items-center justify-between gap-3 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2">
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
            <span className="material-symbols-outlined text-xl">close</span>
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

      <form
        onSubmit={handleSubmit}
        className="mx-auto flex h-12 max-w-[860px] items-center gap-2 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 transition-colors focus-within:border-accent"
      >
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || Boolean(editingMessage) || isRecordingVoice || hasVoicePreview}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-on-surface transition-colors hover:bg-surface-container-low disabled:opacity-30"
          title="Đính kèm"
        >
          <span className="material-symbols-outlined text-xl">attach_file</span>
        </button>

        <input
          ref={inputRef}
          type="text"
          value={message}
          onChange={handleTextChange}
          onKeyDown={handleKeyDown}
          onFocus={onFocus}
          disabled={disabled || isRecordingVoice}
          autoComplete="off"
          className="min-w-0 flex-1 border-none bg-transparent py-1 text-sm text-on-surface outline-none placeholder:text-on-surface-variant"
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

        <button
          type="button"
          disabled={isRecordingVoice}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-on-surface disabled:opacity-30"
          title="Cảm xúc"
        >
          <span className="material-symbols-outlined text-xl">sentiment_satisfied</span>
        </button>

        {!canSend && (
          <button
            type="button"
            onClick={isRecordingVoice ? stopVoiceRecording : startVoiceRecording}
            disabled={!isRecordingVoice && !canRecordVoice}
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors disabled:opacity-30 ${
              isRecordingVoice
                ? 'bg-error-container text-error hover:bg-error/15'
                : 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface'
            }`}
            title={isRecordingVoice ? 'Dừng ghi âm' : 'Ghi âm'}
          >
            <span className="material-symbols-outlined text-xl">
              {isRecordingVoice ? 'stop' : 'mic'}
            </span>
          </button>
        )}

        <button
          type="submit"
          disabled={!canSend}
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-all ${
            canSend ? 'bg-accent text-white hover:bg-accent-dark active:scale-[0.98]' : 'hidden'
          }`}
          title={editingMessage ? 'Lưu chỉnh sửa' : 'Gửi tin nhắn'}
        >
          <span
            className="material-symbols-outlined text-xl"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            {editingMessage ? 'check' : 'send'}
          </span>
        </button>
      </form>
    </footer>
  );
};

export default MessageInput;
