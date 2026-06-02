import { useMemo, useState } from 'react';

const fallbackAvatar =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuBahpFjkcHIiXnez71G-AraliNtmi5v8RquQh32J3n6EOHz1qvVsa2SYxXapR9iaamKNqQ30JzpziX2OAreG_C-9h3wCctRkHorqJ01Yo1MdgqGjvfPRhctrnu7ARwCdwvHK1fl42HCqMJ1A8sbW5bbHtGPpcdjeETYrHqW5A8y82nlhgH6kIfDZUHoGLWDZh1CnnzHQXHoYKEVy3EPNv_qviB9kBtZtTURL2tkJ8kXPpmPaIssR1Y1sPBi9mqbn6eO6qnCSw6q6xLP';

const tabs = [
  { key: 'media', label: 'Media' },
  { key: 'files', label: 'Tệp' },
  { key: 'links', label: 'Liên kết' },
];

const urlRegex = /(https?:\/\/[^\s]+)/g;

const formatFileSize = (size) => {
  if (!size) return '';
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

const formatDateLabel = (value) => {
  if (!value) return '';
  const date = new Date(value);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  if (diff < 24 * 60 * 60 * 1000 && date.getDate() === now.getDate()) return 'Hôm nay';
  if (diff < 48 * 60 * 60 * 1000) return 'Hôm qua';
  return `${Math.max(1, Math.round(diff / (24 * 60 * 60 * 1000)))} ngày trước`;
};

const getHostname = (url) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
};

const ChatDetailsPanel = ({ user, messages = [], onClose }) => {
  const [activeTab, setActiveTab] = useState('media');
  const [lightboxSrc, setLightboxSrc] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  const media = useMemo(
    () =>
      messages
        .filter((message) => !message.isDeleted && message.attachment?.type === 'image')
        .map((message) => ({
          id: message.id,
          url: message.attachment.url,
          filename: message.attachment.filename,
        }))
        .reverse(),
    [messages],
  );

  const files = useMemo(
    () =>
      messages
        .filter((message) => !message.isDeleted && message.attachment?.type === 'file')
        .map((message) => ({
          id: message.id,
          url: message.attachment.url,
          filename: message.attachment.filename,
          size: message.attachment.size,
          timestamp: message.timestamp,
        }))
        .reverse(),
    [messages],
  );

  const links = useMemo(
    () =>
      messages.flatMap((message) => {
        if (message.isDeleted) return [];
        const matches = message.content?.match(urlRegex) || [];
        return matches.map((url) => ({
          id: `${message.id}-${url}`,
          url,
          host: getHostname(url),
        }));
      }),
    [messages],
  );

  const normalizedSearch = searchQuery.trim().toLowerCase();
  const filteredMedia = normalizedSearch
    ? media.filter((item) => item.filename?.toLowerCase().includes(normalizedSearch))
    : media;
  const filteredFiles = normalizedSearch
    ? files.filter((file) => file.filename?.toLowerCase().includes(normalizedSearch))
    : files;
  const filteredLinks = normalizedSearch
    ? links.filter((link) => `${link.host} ${link.url}`.toLowerCase().includes(normalizedSearch))
    : links;

  return (
    <>
      {lightboxSrc && (
        <div
          className="fixed inset-0 z-50 flex cursor-pointer items-center justify-center bg-[#1f1d1a]/92"
          onClick={() => setLightboxSrc(null)}
        >
          <button
            type="button"
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-lg border border-white/15 bg-white/10 text-white transition-colors hover:bg-white/20"
            onClick={() => setLightboxSrc(null)}
          >
            <span className="material-symbols-outlined text-2xl">close</span>
          </button>
          <img
            src={lightboxSrc}
            alt="Ảnh trong thư viện"
            className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain"
            onClick={(event) => event.stopPropagation()}
          />
        </div>
      )}

      <aside className="hidden h-full w-[390px] shrink-0 flex-col border-l border-outline-variant bg-surface xl:flex">
        <div className="flex items-start justify-between px-6 pb-4 pt-6">
          <div className="flex min-w-0 items-start gap-4">
            <div className="relative h-16 w-16 shrink-0">
              <img
                src={user?.avatar || fallbackAvatar}
                alt={user?.name || 'User'}
                className="h-full w-full rounded-full border border-outline-variant object-cover"
              />
              {user?.isOnline && (
                <span className="absolute bottom-1 right-1 h-3.5 w-3.5 rounded-full border-2 border-surface bg-secondary" />
              )}
            </div>
            <div className="min-w-0 pt-1">
              <h2 className="truncate text-lg font-semibold tracking-[-0.03em] text-on-surface">
                {user?.name || 'Cuộc trò chuyện'}
              </h2>
              <p className="mt-1 text-sm text-secondary">
                {user?.isOnline ? 'Đang online' : 'Ngoại tuyến'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-on-surface transition-colors hover:bg-surface-container-low"
            title="Đóng"
          >
            <span className="material-symbols-outlined text-[22px]">close</span>
          </button>
        </div>

        <div className="grid grid-cols-4 gap-2 px-6">
          {[
            { icon: 'call', label: 'Gọi thoại' },
            { icon: 'videocam', label: 'Gọi video' },
            { icon: 'search', label: 'Tìm kiếm' },
            { icon: 'notifications_off', label: 'Tắt thông báo' },
          ].map((item) => (
            <button
              key={item.label}
              type="button"
              className="flex h-[74px] flex-col items-center justify-center gap-2 rounded-lg border border-outline-variant bg-surface-container-lowest text-on-surface transition-colors hover:bg-surface-container-low"
              title={item.label}
            >
              <span className="material-symbols-outlined text-[24px]">{item.icon}</span>
              <span className="text-xs">{item.label}</span>
            </button>
          ))}
        </div>

        <div className="mt-5 flex border-b border-outline-variant px-6">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`relative flex-1 pb-3 text-sm transition-colors ${
                activeTab === tab.key ? 'font-semibold text-on-surface' : 'text-on-surface-variant'
              }`}
            >
              {tab.label}
              {activeTab === tab.key && (
                <span className="absolute bottom-[-1px] left-0 right-0 h-0.5 bg-primary" />
              )}
            </button>
          ))}
        </div>

        <div className="border-b border-outline-variant px-6 py-4">
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-on-surface-variant">
              search
            </span>
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Tìm media, tệp, liên kết..."
              className="h-10 w-full rounded-lg border border-outline-variant bg-surface-container-lowest pl-10 pr-3 text-sm outline-none transition-colors focus:border-accent"
            />
          </div>
        </div>

        <div className="no-scrollbar flex-1 overflow-y-auto">
          {activeTab === 'media' && (
            <section className="border-b border-outline-variant px-6 py-5">
              {filteredMedia.length === 0 ? (
                <p className="py-8 text-center text-sm text-on-surface-variant">
                  {searchQuery ? 'Không tìm thấy media.' : 'Chưa có media nào.'}
                </p>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-2">
                    {filteredMedia.slice(0, 9).map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setLightboxSrc(item.url)}
                        className="aspect-[4/3] overflow-hidden rounded-md border border-outline-variant bg-surface-container-low transition-opacity hover:opacity-85"
                      >
                        <img
                          src={item.url}
                          alt={item.filename || 'Media'}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="mt-4 flex w-full items-center justify-between text-sm text-on-surface-variant transition-colors hover:text-on-surface"
                  >
                    <span>Xem tất cả media ({media.length})</span>
                    <span className="material-symbols-outlined text-[20px]">chevron_right</span>
                  </button>
                </>
              )}
            </section>
          )}

          <section className="border-b border-outline-variant px-6 py-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-on-surface">Tệp</h3>
              <button type="button" className="text-xs text-on-surface-variant hover:text-on-surface">
                Xem tất cả
              </button>
            </div>
            {filteredFiles.length === 0 ? (
              <p className="py-4 text-sm text-on-surface-variant">
                {searchQuery ? 'Không tìm thấy tệp.' : 'Chưa có tệp nào.'}
              </p>
            ) : (
              <div className="divide-y divide-outline-variant">
                {filteredFiles.slice(0, 4).map((file) => (
                  <a
                    key={file.id}
                    href={file.url}
                    download={file.filename}
                    className="flex items-center gap-3 py-3"
                  >
                    <span className="material-symbols-outlined text-[26px] text-on-surface-variant">
                      description
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-on-surface">{file.filename}</span>
                      <span className="mt-0.5 block text-xs text-on-surface-variant">
                        {formatFileSize(file.size)} · PDF
                      </span>
                    </span>
                    <span className="text-xs text-on-surface-variant">
                      {formatDateLabel(file.timestamp)}
                    </span>
                  </a>
                ))}
              </div>
            )}
          </section>

          <section className="px-6 py-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-on-surface">Liên kết</h3>
              <button type="button" className="text-xs text-on-surface-variant hover:text-on-surface">
                Xem tất cả
              </button>
            </div>
            {filteredLinks.length === 0 ? (
              <p className="py-4 text-sm text-on-surface-variant">
                {searchQuery ? 'Không tìm thấy liên kết.' : 'Chưa có liên kết nào.'}
              </p>
            ) : (
              <div className="space-y-2">
                {filteredLinks.slice(0, 4).map((link) => (
                  <a
                    key={link.id}
                    href={link.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-3 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-3 transition-colors hover:bg-surface-container-low"
                  >
                    <span className="material-symbols-outlined text-[24px] text-on-surface-variant">
                      language
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm text-on-surface">{link.host}</span>
                      <span className="block truncate text-xs text-on-surface-variant">{link.url}</span>
                    </span>
                  </a>
                ))}
              </div>
            )}
          </section>
        </div>
      </aside>
    </>
  );
};

export default ChatDetailsPanel;
