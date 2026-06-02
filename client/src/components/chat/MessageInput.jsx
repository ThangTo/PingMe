import { useEffect, useState, useRef } from 'react';
import api from '../../config/api';

const MessageInput = ({
  onSendMessage,
  disabled = false,
  onTypingStart,
  onTypingStop,
  onFocus,
  editingMessage,
  onEditMessage,
  onCancelEditMessage,
}) => {
  const [message, setMessage] = useState('');
  const [preview, setPreview] = useState(null); // { url, type, file }
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef(null);
  const inputRef = useRef(null);
  const wasEditingRef = useRef(false);
  const typingTimeoutRef = useRef(null);

  useEffect(() => {
    if (!editingMessage) {
      if (wasEditingRef.current) {
        setMessage('');
        setPreview(null);
        setUploadError('');
        setUploadProgress(0);
        wasEditingRef.current = false;
      }

      return;
    }

    wasEditingRef.current = true;
    setMessage(editingMessage.content || '');
    setPreview(null);
    setUploadError('');
    setUploadProgress(0);

    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  }, [editingMessage]);

  const handleTextChange = (e) => {
    setMessage(e.target.value);
    if (onTypingStart) onTypingStart();
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      if (onTypingStop) onTypingStop();
    }, 1500);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isImage = file.type.startsWith('image/');
    const maxSize = isImage ? 10 * 1024 * 1024 : 25 * 1024 * 1024;

    if (file.size > maxSize) {
      setUploadError(`Kích thước tối đa ${isImage ? '10MB' : '25MB'}`);
      e.target.value = '';
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setUploadError('');
    setUploadProgress(0);
    setPreview({
      url: objectUrl,
      type: isImage ? 'image' : 'file',
      name: file.name,
      size: file.size,
      file: file, // Store the actual file object for upload
    });

    // Reset input để có thể chọn lại cùng file
    e.target.value = '';
  };

  const handleUpload = async (file) => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await api.post('/messages/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (progressEvent) => {
        if (!progressEvent.total) return;
        const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        setUploadProgress(progress);
      },
    });

    return response.data.file;
  };

  const handleSendWithAttachment = async () => {
    if (!preview || isUploading) return;

    setIsUploading(true);
    setUploadError('');
    setUploadProgress(0);
    try {
      const uploadedFile = await handleUpload(preview.file);
      onSendMessage(preview.type === 'image' ? '' : preview.name, {
        type: preview.type,
        url: uploadedFile.url,
        filename: uploadedFile.filename,
        size: uploadedFile.size,
        mimeType: uploadedFile.type,
      });
      setPreview(null);
      setUploadProgress(0);
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

      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (onTypingStop) onTypingStop();

      return;
    }

    if (preview) {
      await handleSendWithAttachment();
      return;
    }

    if (message.trim() && !disabled) {
      onSendMessage(message.trim());
      setMessage('');
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (onTypingStop) onTypingStop();
    }
  };

  const canSend = editingMessage
    ? message.trim() && !disabled
    : (message.trim() || preview) && !disabled && !isUploading;

  return (
    <footer className="shrink-0 border-t border-outline-variant bg-surface px-4 py-3 md:px-7 md:py-5">
      {/* Preview khi có file đính kèm */}
      {preview && (
        <div className="mx-auto mb-3 max-w-[860px] rounded-lg border border-outline-variant bg-surface-container-lowest p-3">
          <div className="flex items-center gap-3">
            {preview.type === 'image' ? (
              <img
                src={preview.url}
                alt="File preview"
                className="h-12 w-12 rounded-md border border-outline-variant object-cover"
              />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-md border border-outline-variant bg-surface-container-low">
                <span className="material-symbols-outlined text-xl text-on-surface-variant">
                  description
                </span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm font-medium text-on-surface">
                {preview.name || (preview.type === 'image' ? 'Ảnh đã chọn' : 'File đã chọn')}
              </p>
              <p className="text-xs text-on-surface-variant">
                {isUploading ? `Đang tải lên ${uploadProgress}%` : 'Sẵn sàng gửi'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setPreview(null);
                setUploadError('');
                setUploadProgress(0);
              }}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-on-surface-variant transition-colors hover:bg-surface-container-high"
            >
              <span className="material-symbols-outlined text-xl">close</span>
            </button>
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
          {preview && (
            <button
              type="button"
              onClick={handleSendWithAttachment}
              className="shrink-0 rounded-md bg-error px-3 py-1.5 text-xs font-semibold text-white"
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

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={
          preview?.type === 'file'
            ? '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar,.txt,.csv'
            : 'image/*'
        }
        disabled={disabled || Boolean(editingMessage)}
        onChange={handleFileChange}
        className="hidden"
      />

      <form
        onSubmit={handleSubmit}
        className="mx-auto flex h-12 max-w-[860px] items-center gap-2 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 transition-colors focus-within:border-accent"
      >
        {/* Attachment */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || Boolean(editingMessage)}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-on-surface transition-colors hover:bg-surface-container-low disabled:opacity-30"
          title="Đính kèm"
        >
          <span className="material-symbols-outlined text-xl">attach_file</span>
        </button>

        {/* Input */}
        <input
          ref={inputRef}
          type="text"
          value={message}
          onChange={handleTextChange}
          onKeyPress={handleKeyPress}
          onFocus={onFocus}
          disabled={disabled}
          autoComplete="off"
          className="min-w-0 flex-1 border-none bg-transparent py-1 text-sm text-on-surface outline-none placeholder:text-on-surface-variant"
          placeholder={
            editingMessage
              ? 'Chỉnh sửa tin nhắn...'
              : preview
                ? 'Nhấn gửi để upload'
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
