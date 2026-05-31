import { useState } from 'react';

const MediaGallery = ({ messages = [], onClose }) => {
  const [lightboxSrc, setLightboxSrc] = useState(null);

  // Lọc chỉ lấy messages có ảnh
  const imageMessages = messages
    .filter((msg) => msg.attachment?.type === 'image')
    .reverse(); // Mới nhất trước

  return (
    <>
      {/* Lightbox */}
      {lightboxSrc && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center cursor-pointer"
          onClick={() => setLightboxSrc(null)}
        >
          <button
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
            onClick={() => setLightboxSrc(null)}
          >
            <span className="material-symbols-outlined text-2xl">close</span>
          </button>
          <img
            src={lightboxSrc}
            alt="Preview"
            className="max-w-[90vw] max-h-[90vh] object-contain rounded-xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Gallery Panel */}
      <div className="flex flex-col h-full bg-surface border-l border-white/6">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/6 shrink-0">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-xl text-secondary">photo_library</span>
            <div>
              <h2 className="text-sm font-headline font-bold text-on-surface">Ảnh & File</h2>
              <p className="text-[11px] text-on-surface-variant">{imageMessages.length} mục</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-white/4 transition-colors"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto no-scrollbar p-4">
          {imageMessages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center gap-3 opacity-50">
              <span className="material-symbols-outlined text-5xl text-on-surface-variant">image_not_supported</span>
              <p className="text-sm text-on-surface-variant font-label">Chưa có ảnh nào được chia sẻ</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {imageMessages.map((msg) => (
                <button
                  key={msg.id}
                  onClick={() => setLightboxSrc(msg.attachment.url)}
                  className="aspect-square rounded-xl overflow-hidden border border-white/6 hover:opacity-80 transition-opacity"
                >
                  <img
                    src={msg.attachment.url}
                    alt={msg.attachment.filename}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default MediaGallery;
