import { useEffect, useRef, useState } from 'react';
import api from '../../config/api';

const REVOKED_MESSAGE_TEXT = 'Tin nhắn này đã được thu hồi';
const MAX_ATTACHMENTS = 5;
const ACCEPTED_FILE_TYPES =
  'image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar,.txt,.csv';

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

const revokePreviewUrls = (items = []) => {
  items.forEach((item) => {
    if (item.url) URL.revokeObjectURL(item.url);
  });
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
  const fileInputRef = useRef(null);
  const inputRef = useRef(null);
  const wasEditingRef = useRef(false);
  const typingTimeoutRef = useRef(null);
  const previewsRef = useRef([]);
  const hasPreviews = previews.length > 0;

  useEffect(() => {
    previewsRef.current = previews;
  }, [previews]);

  useEffect(
    () => () => {
      revokePreviewUrls(previewsRef.current);
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

  useEffect(() => {
    if (!editingMessage) {
      if (wasEditingRef.current) {
        setMessage('');
        clearPreviews();
        wasEditingRef.current = false;
      }

      return;
    }

    wasEditingRef.current = true;
    setMessage(editingMessage.content || '');
    clearPreviews();

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
    const maxSize = isImage ? 10 * 1024 * 1024 : 25 * 1024 * 1024;

    if (file.size > maxSize) {
      return `Kích thước tối đa ${isImage ? '10MB' : '25MB'} cho ${file.name}`;
    }

    return '';
  };

  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length === 0) return;

    setUploadError('');
    setUploadProgress(0);

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
        const isImage = file.type.startsWith('image/');
        return {
          id: crypto.randomUUID(),
          url: URL.createObjectURL(file),
          type: isImage ? 'image' : 'file',
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
        return {
          type: preview?.type || (uploadedFile.type?.startsWith('image/') ? 'image' : 'file'),
          url: uploadedFile.url,
          filename: uploadedFile.filename || preview?.name,
          size: uploadedFile.size || preview?.size,
          mimeType: uploadedFile.type || preview?.file?.type,
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

    if (message.trim() && !disabled) {
      onSendMessage(message.trim(), null, replyingMessage, []);
      setMessage('');
      stopTypingNow();
    }
  };

  const canSend = editingMessage
    ? Boolean(message.trim()) && !disabled
    : (Boolean(message.trim()) || hasPreviews) && !disabled && !isUploading;

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
        disabled={disabled || Boolean(editingMessage)}
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
          disabled={disabled || Boolean(editingMessage)}
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
          disabled={disabled}
          autoComplete="off"
          className="min-w-0 flex-1 border-none bg-transparent py-1 text-sm text-on-surface outline-none placeholder:text-on-surface-variant"
          placeholder={
            editingMessage
              ? 'Chỉnh sửa tin nhắn...'
              : hasPreviews
                ? 'Viết chú thích...'
                : 'Nhập tin nhắn...'
          }
        />

        <button
          type="button"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-on-surface"
          title="Cảm xúc"
        >
          <span className="material-symbols-outlined text-xl">sentiment_satisfied</span>
        </button>

        {!canSend && (
          <button
            type="button"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-on-surface"
            title="Ghi âm"
          >
            <span className="material-symbols-outlined text-xl">mic</span>
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
