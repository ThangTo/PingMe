import { useState } from 'react';
import AppIcon from '../ui/AppIcon';

const getMessageAttachments = (message = {}) => {
  if (message.isDeleted) return [];
  if (Array.isArray(message.attachments) && message.attachments.length > 0) {
    return message.attachments;
  }
  return message.attachment ? [message.attachment] : [];
};

const MediaGallery = ({ messages = [], onClose }) => {
  const [lightboxSrc, setLightboxSrc] = useState(null);

  const imageMessages = messages
    .flatMap((message) =>
      getMessageAttachments(message)
        .filter((attachment) => attachment.type === 'image')
        .map((attachment, index) => ({
          id: `${message.id}-${index}`,
          attachment,
        })),
    )
    .reverse();

  return (
    <>
      {lightboxSrc && (
        <div
          className="fixed inset-0 z-50 flex cursor-pointer items-center justify-center bg-[#111111]/92"
          onClick={() => setLightboxSrc(null)}
        >
          <button
            type="button"
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-lg border border-white/15 bg-white/10 text-white transition-colors hover:bg-white/20"
            onClick={() => setLightboxSrc(null)}
          >
            <AppIcon name="close" className="text-2xl" />
          </button>
          <img
            src={lightboxSrc}
            alt="Ảnh trong thư viện"
            className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      <div className="flex h-full flex-col border-l border-outline-variant bg-surface">
        <div className="flex shrink-0 items-center justify-between border-b border-outline-variant px-5 py-4">
          <div className="flex items-center gap-3">
            <AppIcon name="photo_library" className="text-xl text-on-surface-variant" />
            <div>
              <h2 className="text-sm font-semibold text-on-surface">Ảnh và file</h2>
              <p className="text-[11px] text-on-surface-variant">{imageMessages.length} mục</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-md text-on-surface-variant transition-colors hover:bg-surface-container-high"
          >
            <AppIcon name="close" className="text-xl" />
          </button>
        </div>

        <div className="no-scrollbar flex-1 overflow-y-auto p-4">
          {imageMessages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3">
              <AppIcon name="image_not_supported" className="text-5xl text-on-surface-variant" />
              <p className="text-sm text-on-surface-variant">
                Chưa có ảnh nào được chia sẻ
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {imageMessages.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setLightboxSrc(item.attachment.url)}
                  className="aspect-square overflow-hidden rounded-lg border border-outline-variant transition-opacity hover:opacity-80"
                >
                  <img
                    src={item.attachment.url}
                    alt={item.attachment.filename || 'Media'}
                    className="h-full w-full object-cover"
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
