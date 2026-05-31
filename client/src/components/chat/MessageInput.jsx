import { useState, useRef } from 'react';
import api from '../../config/api';

const MessageInput = ({
  onSendMessage,
  disabled = false,
  onTypingStart,
  onTypingStop,
  onFocus,
}) => {
  const [message, setMessage] = useState('');
  const [preview, setPreview] = useState(null); // { url, type, file }
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef(null);
  const inputRef = useRef(null);
  const typingTimeoutRef = useRef(null);

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
    });

    return response.data.file;
  };

  const handleSendWithAttachment = async () => {
    if (!preview || isUploading) return;

    setIsUploading(true);
    setUploadError('');
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
    } catch (error) {
      console.error('Upload thất bại:', error);
      setUploadError('Upload thất bại, thử lại');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

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

  const canSend = (message.trim() || preview) && !disabled && !isUploading;

  return (
    <footer className="shrink-0 border-t border-outline-variant bg-surface-container-lowest px-6 py-4">
      {/* Preview khi có file đính kèm */}
      {preview && (
        <div className="mb-3 flex items-center gap-3 rounded-lg border border-outline-variant bg-surface-container p-3">
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
              {isUploading ? 'Đang tải lên...' : 'Sẵn sàng gửi'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setPreview(null);
            }}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-on-surface-variant transition-colors hover:bg-surface-container-high"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>
      )}

      {uploadError && (
        <p className="mb-3 rounded-md border border-error/20 bg-error-container px-3 py-2 text-sm text-error">
          {uploadError}
        </p>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={preview?.type === 'file' ? '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar,.txt,.csv' : 'image/*'}
        onChange={handleFileChange}
        className="hidden"
      />

      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-3 rounded-lg border border-outline-variant bg-surface-container px-3 py-2.5 transition-colors focus-within:border-primary"
      >
        {/* Attachment */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface disabled:opacity-30"
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
          className="flex-1 border-none bg-transparent py-1 text-sm text-on-surface outline-none placeholder:text-on-surface-variant"
          placeholder={preview ? 'Nhấn gửi để upload' : 'Nhập tin nhắn...'}
        />

        {/* Send */}
        <button
          type="submit"
          disabled={!canSend}
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md transition-all ${
            canSend
              ? 'bg-primary text-white hover:bg-primary-dark active:scale-[0.98]'
              : 'cursor-not-allowed bg-surface-container-high text-on-surface-variant'
          }`}
          title="Gửi tin nhắn"
        >
          <span
            className="material-symbols-outlined text-xl"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            send
          </span>
        </button>
      </form>
    </footer>
  );
};

export default MessageInput;
