import { useState } from 'react';

const MediaGallery = ({ messages = [], onClose }) => {
  const [lightboxSrc, setLightboxSrc] = useState(null);

  // Lọc chỉ lấy messages có ảnh
  const imageMessages = messages
    .filter((msg) => !msg.isDeleted && msg.attachment?.type === 'image')
    .reverse(); // Mới nhất trước

  return (
    <>
      {/* Lightbox */}
      {lightboxSrc && (
        <div
          className="fixed inset-0 z-50 flex cursor-pointer items-center justify-center bg-[#111111]/92"
          onClick={() => setLightboxSrc(null)}
        >
          <button
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-lg border border-white/15 bg-white/10 text-white transition-colors hover:bg-white/20"
            onClick={() => setLightboxSrc(null)}
          >
            <span className="material-symbols-outlined text-2xl">close</span>
          </button>
          <img
            src={lightboxSrc}
            alt="Ảnh trong thư viện"
            className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Gallery Panel */}
      <div className="flex h-full flex-col border-l border-outline-variant bg-surface">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-outline-variant px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-xl text-on-surface-variant">photo_library</span>
            <div>
              <h2 className="text-sm font-semibold text-on-surface">Ảnh và file</h2>
              <p className="text-[11px] text-on-surface-variant">{imageMessages.length} mục</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-md text-on-surface-variant transition-colors hover:bg-surface-container-high"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {/* Grid */}
        <div className="no-scrollbar flex-1 overflow-y-auto p-4">
          {imageMessages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3">
              <span className="material-symbols-outlined text-5xl text-on-surface-variant">image_not_supported</span>
              <p className="text-sm text-on-surface-variant">Chưa có ảnh nào được chia sẻ</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {imageMessages.map((msg) => (
                <button
                  key={msg.id}
                  onClick={() => setLightboxSrc(msg.attachment.url)}
                  className="aspect-square overflow-hidden rounded-lg border border-outline-variant transition-opacity hover:opacity-80"
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
