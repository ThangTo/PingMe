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
       alert(`Kích thước tối đa ${isImage ? '10MB' : '25MB'}`);
       return;
     }

     const objectUrl = URL.createObjectURL(file);
     setPreview({
       url: objectUrl,
       type: isImage ? 'image' : 'file',
       name: file.name,
       size: file.size,
       file: file // Store the actual file object for upload
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
       alert('Upload thất bại, thử lại');
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
    <footer className="px-5 py-4 border-t border-white/6 shrink-0">
      {/* Preview khi có file đính kèm */}
      {preview && (
        <div className="mb-3 flex items-center gap-3 p-3 bg-surface-container-low rounded-xl border border-white/6">
          {preview.type === 'image' ? (
            <img
              src={preview.url}
              alt="Preview"
              className="w-12 h-12 rounded-lg object-cover border border-white/10"
            />
          ) : (
            <div className="w-12 h-12 rounded-lg bg-surface-container-high flex items-center justify-center border border-white/10">
              <span className="material-symbols-outlined text-xl text-on-surface-variant">
                description
              </span>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm text-on-surface truncate font-medium">
              {preview.name || (preview.type === 'image' ? 'Ảnh đã chọn' : 'File đã chọn')}
            </p>
            <p className="text-xs text-on-surface-variant/50">
              {isUploading ? 'Đang tải lên...' : 'Sẵn sàng gửi'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setPreview(null);
            }}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-white/4 transition-colors shrink-0"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>
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
        className="flex items-center gap-3 bg-surface-container-low rounded-2xl px-4 py-2.5 border border-white/6 focus-within:border-primary/40 transition-colors"
      >
        {/* Attachment */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
          className="text-on-surface-variant/50 hover:text-primary transition-colors shrink-0 disabled:opacity-30"
          title="Đính kèm"
        >
          <span className="material-symbols-outlined text-xl">attach_file</span>
        </button>

        {/* Emoji */}
        <button
          type="button"
          className="text-on-surface-variant/50 hover:text-secondary transition-colors shrink-0"
          title="Biểu cảm"
        >
          <span className="material-symbols-outlined text-xl">sentiment_satisfied</span>
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
          className="flex-1 bg-transparent border-none outline-none text-sm text-on-surface placeholder:text-on-surface-variant/40 py-0.5"
          placeholder={preview ? 'Nhấn gửi để upload' : 'Nhập tin nhắn...'}
        />

        {/* Send */}
        <button
          type="submit"
          disabled={!canSend}
          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all ${
            canSend
              ? 'bg-primary text-white hover:bg-primary/90 active:scale-95'
              : 'bg-white/4 text-on-surface-variant/30 cursor-not-allowed'
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
