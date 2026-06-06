import { useEffect, useMemo, useState } from 'react';
import api from '../../config/api';
import { useCall } from '../../context/CallContext';
import FileTypeIcon from '../ui/FileTypeIcon';

const fallbackAvatar =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuBahpFjkcHIiXnez71G-AraliNtmi5v8RquQh32J3n6EOHz1qvVsa2SYxXapR9iaamKNqQ30JzpziX2OAreG_C-9h3wCctRkHorqJ01Yo1MdgqGjvfPRhctrnu7ARwCdwvHK1fl42HCqMJ1A8sbW5bbHtGPpcdjeETYrHqW5A8y82nlhgH6kIfDZUHoGLWDZh1CnnzHQXHoYKEVy3EPNv_qviB9kBtZtTURL2tkJ8kXPpmPaIssR1Y1sPBi9mqbn6eO6qnCSw6q6xLP';

const getInitials = (name = '') =>
  name
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || '?';

const tabs = [
  { key: 'media', label: 'Media' },
  { key: 'audio', label: 'Audio' },
  { key: 'files', label: 'Tệp' },
  { key: 'links', label: 'Liên kết' },
];

const roleLabels = {
  owner: 'Chủ nhóm',
  admin: 'Quản trị',
  member: 'Thành viên',
};

const urlRegex = /(https?:\/\/[^\s]+)/g;
const emptyGallery = {
  media: [],
  files: [],
  audio: [],
  links: [],
};

const getMessageAttachments = (message = {}) => {
  if (message.isDeleted) return [];
  if (Array.isArray(message.attachments) && message.attachments.length > 0) {
    return message.attachments;
  }
  return message.attachment ? [message.attachment] : [];
};

const formatFileSize = (size) => {
  if (!size) return '';
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

const getAttachmentKindLabel = (attachment = {}) => {
  if (attachment.type === 'audio') return 'AUDIO';
  const extension = attachment.filename?.split('.').pop();
  return extension ? extension.toUpperCase() : 'FILE';
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

const createGalleryItem = ({ message, attachment, index, type }) => ({
  id: `${message.id}-${type}-${index}`,
  messageId: message.id,
  type,
  url: attachment.url,
  filename: attachment.filename || '',
  size: attachment.size || 0,
  mimeType: attachment.mimeType || '',
  duration: attachment.duration || 0,
  timestamp: message.timestamp,
  senderName: message.senderName || '',
});

const buildLocalGallery = (messages = []) =>
  messages.reduce(
    (gallery, message) => {
      getMessageAttachments(message).forEach((attachment, index) => {
        if (!attachment?.url) return;

        if (attachment.type === 'image') {
          gallery.media.push(createGalleryItem({ message, attachment, index, type: 'image' }));
          return;
        }

        if (attachment.type === 'audio') {
          gallery.audio.push(createGalleryItem({ message, attachment, index, type: 'audio' }));
          return;
        }

        gallery.files.push(createGalleryItem({ message, attachment, index, type: 'file' }));
      });

      if (!message.isDeleted) {
        const matches = message.content?.match(urlRegex) || [];
        matches.forEach((url, index) => {
          gallery.links.push({
            id: `${message.id}-link-${index}`,
            messageId: message.id,
            url,
            host: getHostname(url),
            timestamp: message.timestamp,
            senderName: message.senderName || '',
          });
        });
      }

      return gallery;
    },
    { media: [], files: [], audio: [], links: [] },
  );

const mergeGalleryItems = (serverItems = [], localItems = []) => {
  const itemsByKey = new Map();

  [...serverItems, ...localItems].forEach((item) => {
    const key = item.id || `${item.messageId}-${item.url}`;
    if (key) itemsByKey.set(key, item);
  });

  return [...itemsByKey.values()].sort(
    (a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0),
  );
};

const ChatDetailsPanel = ({
  user,
  messages = [],
  currentUserId,
  friendOptions = [],
  onAddGroupMembers,
  onRemoveGroupMember,
  onUpdateGroupMemberRole,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState('media');
  const [lightboxSrc, setLightboxSrc] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isMembersOpen, setIsMembersOpen] = useState(false);
  const [isMemberComposerOpen, setIsMemberComposerOpen] = useState(false);
  const [selectedMemberIds, setSelectedMemberIds] = useState([]);
  const [memberActionError, setMemberActionError] = useState('');
  const [isAddingMembers, setIsAddingMembers] = useState(false);
  const [removingMemberId, setRemovingMemberId] = useState(null);
  const [updatingRoleMemberId, setUpdatingRoleMemberId] = useState(null);
  const [serverGallery, setServerGallery] = useState(emptyGallery);
  const [isGalleryLoading, setIsGalleryLoading] = useState(false);
  const [galleryError, setGalleryError] = useState('');
  const isGroup = Boolean(user?.isGroup);
  const { callState, initiateCall } = useCall();
  const canStartDirectCall = !isGroup && Boolean(user?.peerId) && callState.status === 'idle';

  const handleStartCall = (type) => {
    if (!canStartDirectCall) return;

    initiateCall(user.peerId, type, {
      name: user.name,
      avatar: user.avatar,
      conversationId: user.id,
    });
  };

  useEffect(() => {
    if (!user?.id) {
      setServerGallery(emptyGallery);
      setGalleryError('');
      return undefined;
    }

    let isCancelled = false;

    const fetchGallery = async () => {
      try {
        setIsGalleryLoading(true);
        setGalleryError('');
        const response = await api.get(`/messages/conversation/${user.id}/gallery`, {
          params: { limit: 300 },
        });

        if (!isCancelled && response.data.success) {
          setServerGallery(response.data.gallery || emptyGallery);
        }
      } catch (error) {
        if (!isCancelled) {
          console.error('Không thể tải gallery:', error);
          setGalleryError('Không thể tải gallery.');
          setServerGallery(emptyGallery);
        }
      } finally {
        if (!isCancelled) setIsGalleryLoading(false);
      }
    };

    fetchGallery();

    return () => {
      isCancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    setIsMembersOpen(false);
    setIsMemberComposerOpen(false);
    setSelectedMemberIds([]);
    setMemberActionError('');
  }, [user?.id]);

  const localGallery = useMemo(() => buildLocalGallery(messages), [messages]);

  const media = useMemo(
    () => mergeGalleryItems(serverGallery.media, localGallery.media),
    [localGallery, serverGallery.media],
  );

  const files = useMemo(
    () => mergeGalleryItems(serverGallery.files, localGallery.files),
    [localGallery, serverGallery.files],
  );

  const audio = useMemo(
    () => mergeGalleryItems(serverGallery.audio, localGallery.audio),
    [localGallery, serverGallery.audio],
  );

  const links = useMemo(
    () => mergeGalleryItems(serverGallery.links, localGallery.links),
    [localGallery, serverGallery.links],
  );

  const normalizedSearch = searchQuery.trim().toLowerCase();
  const filteredMedia = normalizedSearch
    ? media.filter((item) =>
        `${item.filename || ''} ${item.senderName || ''}`.toLowerCase().includes(normalizedSearch),
      )
    : media;
  const filteredFiles = normalizedSearch
    ? files.filter((file) =>
        `${file.filename || ''} ${file.senderName || ''}`.toLowerCase().includes(normalizedSearch),
      )
    : files;
  const filteredAudio = normalizedSearch
    ? audio.filter((item) =>
        `${item.filename || ''} ${item.senderName || ''}`.toLowerCase().includes(normalizedSearch),
      )
    : audio;
  const filteredLinks = normalizedSearch
    ? links.filter((link) =>
        `${link.host} ${link.url} ${link.senderName || ''}`.toLowerCase().includes(normalizedSearch),
      )
    : links;
  const currentMember = useMemo(
    () => user?.members?.find((member) => member.id === currentUserId) || null,
    [currentUserId, user?.members],
  );
  const canManageMembers = ['owner', 'admin'].includes(currentMember?.role);
  const existingMemberIds = useMemo(
    () => new Set((user?.members || []).map((member) => member.id)),
    [user?.members],
  );
  const availableFriends = useMemo(
    () => friendOptions.filter((friend) => friend.peerId && !existingMemberIds.has(friend.peerId)),
    [existingMemberIds, friendOptions],
  );

  const canRemoveMember = (member) => {
    if (!canManageMembers || !member?.id || member.id === currentUserId) return false;
    if (member.role === 'owner') return false;
    if (currentMember?.role === 'owner') return true;
    return currentMember?.role === 'admin' && member.role === 'member';
  };

  const canUpdateMemberRole = (member) =>
    currentMember?.role === 'owner' && member?.id !== currentUserId && member?.role !== 'owner';

  const toggleSelectedMember = (memberId) => {
    setSelectedMemberIds((prev) =>
      prev.includes(memberId) ? prev.filter((id) => id !== memberId) : [...prev, memberId],
    );
  };

  const openMemberComposer = () => {
    setMemberActionError('');
    setSelectedMemberIds([]);
    setIsMemberComposerOpen((value) => !value);
  };

  const toggleMembersSection = () => {
    if (isMembersOpen) {
      setIsMemberComposerOpen(false);
      setSelectedMemberIds([]);
      setMemberActionError('');
    }
    setIsMembersOpen((value) => !value);
  };

  const handleAddMembers = async () => {
    if (!user?.id || selectedMemberIds.length === 0) return;

    try {
      setIsAddingMembers(true);
      setMemberActionError('');
      await onAddGroupMembers?.(user.id, selectedMemberIds);
      setSelectedMemberIds([]);
      setIsMemberComposerOpen(false);
    } catch (error) {
      setMemberActionError(error.response?.data?.error || 'Không thể thêm thành viên.');
    } finally {
      setIsAddingMembers(false);
    }
  };

  const handleRemoveMember = async (member) => {
    if (!user?.id || !member?.id) return;

    const confirmed = window.confirm(`Xóa ${member.username || 'thành viên này'} khỏi nhóm?`);
    if (!confirmed) return;

    try {
      setRemovingMemberId(member.id);
      setMemberActionError('');
      await onRemoveGroupMember?.(user.id, member.id);
    } catch (error) {
      setMemberActionError(error.response?.data?.error || 'Không thể xóa thành viên.');
    } finally {
      setRemovingMemberId(null);
    }
  };

  const handleUpdateMemberRole = async (member) => {
    if (!user?.id || !member?.id) return;

    const nextRole = member.role === 'admin' ? 'member' : 'admin';
    const label = nextRole === 'admin' ? 'phong quản trị' : 'gỡ quyền quản trị';
    const confirmed = window.confirm(`${label} cho ${member.username || 'thành viên này'}?`);
    if (!confirmed) return;

    try {
      setUpdatingRoleMemberId(member.id);
      setMemberActionError('');
      await onUpdateGroupMemberRole?.(user.id, member.id, nextRole);
    } catch (error) {
      setMemberActionError(error.response?.data?.error || 'Không thể đổi quyền thành viên.');
    } finally {
      setUpdatingRoleMemberId(null);
    }
  };

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

      <aside className="fixed inset-0 z-50 flex h-[100dvh] w-full flex-col border-l border-outline-variant bg-surface xl:static xl:z-auto xl:h-full xl:w-[390px] xl:shrink-0">
        <div className="flex items-start justify-between px-6 pb-4 pt-6">
          <div className="flex min-w-0 items-start gap-4">
            <div className="relative h-16 w-16 shrink-0">
              {user?.avatar || !isGroup ? (
                <img
                  src={user?.avatar || fallbackAvatar}
                  alt={user?.name || 'User'}
                  className="h-full w-full rounded-full border border-outline-variant object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center rounded-full border border-outline-variant bg-accent-soft text-base font-semibold text-on-surface">
                  {getInitials(user?.name)}
                </div>
              )}
              {!isGroup && user?.isOnline && (
                <span className="absolute bottom-1 right-1 h-3.5 w-3.5 rounded-full border-2 border-surface bg-secondary" />
              )}
            </div>
            <div className="min-w-0 pt-1">
              <h2 className="truncate text-lg font-semibold tracking-[-0.03em] text-on-surface">
                {user?.name || 'Cuộc trò chuyện'}
              </h2>
              {isGroup && (
                <p className="mt-1 text-sm text-secondary">
                  {user?.memberCount || 0} thành viên
                </p>
              )}
              <p className={`mt-1 text-sm text-secondary ${isGroup ? 'hidden' : ''}`}>
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

        <div className={`grid gap-2 px-6 ${isGroup ? 'grid-cols-2' : 'grid-cols-4'}`}>
          {[
            {
              icon: 'call',
              label: 'Gọi thoại',
              disabled: !canStartDirectCall,
              onClick: () => handleStartCall('voice'),
            },
            {
              icon: 'videocam',
              label: 'Gọi video',
              disabled: !canStartDirectCall,
              onClick: () => handleStartCall('video'),
            },
            { icon: 'search', label: 'Tìm kiếm' },
            { icon: 'notifications_off', label: 'Tắt thông báo' },
          ].map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={item.onClick}
              disabled={item.disabled}
              className={`${isGroup && ['call', 'videocam'].includes(item.icon) ? 'hidden' : 'flex'} h-[74px] flex-col items-center justify-center gap-2 rounded-lg border border-outline-variant bg-surface-container-lowest text-on-surface transition-colors hover:bg-surface-container-low disabled:cursor-not-allowed disabled:opacity-45`}
              title={item.label}
            >
              <span className="material-symbols-outlined text-[24px]">{item.icon}</span>
              <span className="text-xs">{item.label}</span>
            </button>
          ))}
        </div>

        {isGroup && (
          <section className="mt-5 border-y border-outline-variant px-6 py-5">
            <button
              type="button"
              onClick={toggleMembersSection}
              className="flex w-full items-center justify-between gap-3 rounded-lg px-1 py-2 text-left transition-colors hover:bg-surface-container-low"
              aria-expanded={isMembersOpen}
            >
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-on-surface">Thành viên</span>
                <span className="mt-0.5 block text-xs text-on-surface-variant">
                  {user?.memberCount || user?.members?.length || 0} người trong nhóm
                </span>
              </span>
              <span
                className={`material-symbols-outlined text-[22px] text-on-surface-variant transition-transform ${
                  isMembersOpen ? 'rotate-180' : ''
                }`}
              >
                expand_more
              </span>
            </button>

            <div
              className={`${isMembersOpen && canManageMembers ? 'mb-3 mt-3 flex' : 'hidden'} items-center justify-end gap-3`}
            >
              {canManageMembers && (
                <button
                  type="button"
                  onClick={openMemberComposer}
                  className="flex h-8 items-center gap-1.5 rounded-lg border border-outline-variant bg-surface-container-lowest px-2.5 text-xs font-medium text-on-surface transition-colors hover:bg-surface-container-low"
                >
                  <span className="material-symbols-outlined text-[17px]">person_add</span>
                  <span>Thêm</span>
                </button>
              )}
            </div>

            {isMembersOpen && memberActionError && (
              <p className="mb-3 rounded-lg border border-error/20 bg-error-container px-3 py-2 text-xs text-error">
                {memberActionError}
              </p>
            )}

            {isMembersOpen && isMemberComposerOpen && (
              <div className="mb-4 rounded-lg border border-outline-variant bg-surface-container-lowest p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-on-surface-variant">
                    Thêm bạn bè
                  </p>
                  <span className="text-xs text-on-surface-variant">
                    {selectedMemberIds.length} đã chọn
                  </span>
                </div>

                <div className="max-h-44 overflow-y-auto rounded-lg border border-outline-variant bg-surface">
                  {availableFriends.length === 0 ? (
                    <p className="px-3 py-6 text-center text-sm text-on-surface-variant">
                      Không còn bạn bè nào để thêm.
                    </p>
                  ) : (
                    availableFriends.map((friend) => {
                      const isSelected = selectedMemberIds.includes(friend.peerId);

                      return (
                        <button
                          key={friend.peerId}
                          type="button"
                          onClick={() => toggleSelectedMember(friend.peerId)}
                          className="flex w-full items-center gap-3 border-b border-outline-variant px-3 py-2.5 text-left transition-colors last:border-b-0 hover:bg-surface-container-low"
                        >
                          {friend.avatar ? (
                            <img
                              src={friend.avatar}
                              alt={friend.name}
                              className="h-9 w-9 rounded-full border border-outline-variant object-cover"
                            />
                          ) : (
                            <div className="flex h-9 w-9 items-center justify-center rounded-full border border-outline-variant bg-accent-soft text-xs font-semibold text-on-surface">
                              {getInitials(friend.name)}
                            </div>
                          )}
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-on-surface">
                              {friend.name}
                            </span>
                            <span className="block text-xs text-on-surface-variant">
                              {friend.isOnline ? 'Đang online' : 'Ngoại tuyến'}
                            </span>
                          </span>
                          <span
                            className={`flex h-5 w-5 items-center justify-center rounded-md border ${
                              isSelected
                                ? 'border-accent bg-accent text-white'
                                : 'border-outline-variant text-transparent'
                            }`}
                          >
                            <span className="material-symbols-outlined text-[15px]">check</span>
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>

                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsMemberComposerOpen(false);
                      setSelectedMemberIds([]);
                    }}
                    className="h-9 flex-1 rounded-lg border border-outline-variant text-xs font-medium text-on-surface transition-colors hover:bg-surface-container-low"
                  >
                    Hủy
                  </button>
                  <button
                    type="button"
                    onClick={handleAddMembers}
                    disabled={isAddingMembers || selectedMemberIds.length === 0}
                    className="h-9 flex-1 rounded-lg bg-primary text-xs font-semibold text-white transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-55"
                  >
                    {isAddingMembers ? 'Đang thêm...' : 'Thêm'}
                  </button>
                </div>
              </div>
            )}

            <div className={isMembersOpen ? `${canManageMembers ? '' : 'pt-3'} space-y-2` : 'hidden'}>
              {(user?.members || []).map((member) => (
                <div
                  key={member.id}
                  className="flex items-center gap-3 rounded-lg px-1.5 py-1.5 transition-colors hover:bg-surface-container-low"
                >
                  {member.avatar ? (
                    <img
                      src={member.avatar}
                      alt={member.username}
                      className="h-9 w-9 rounded-full border border-outline-variant object-cover"
                    />
                  ) : (
                    <div className="flex h-9 w-9 items-center justify-center rounded-full border border-outline-variant bg-accent-soft text-xs font-semibold text-on-surface">
                      {getInitials(member.username)}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-on-surface">
                      {member.id === currentUserId ? 'Bạn' : member.username}
                    </p>
                    <p className="text-xs text-on-surface-variant">
                      {roleLabels[member.role] || 'Thành viên'}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {canUpdateMemberRole(member) && (
                      <button
                        type="button"
                        onClick={() => handleUpdateMemberRole(member)}
                        disabled={updatingRoleMemberId === member.id}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface disabled:cursor-not-allowed disabled:opacity-50"
                        title={member.role === 'admin' ? 'Gỡ quản trị' : 'Phong quản trị'}
                      >
                        <span className="material-symbols-outlined text-[19px]">
                          {updatingRoleMemberId === member.id
                            ? 'hourglass_empty'
                            : member.role === 'admin'
                              ? 'admin_panel_settings'
                              : 'shield_person'}
                        </span>
                      </button>
                    )}

                    {canRemoveMember(member) && (
                      <button
                        type="button"
                        onClick={() => handleRemoveMember(member)}
                        disabled={removingMemberId === member.id}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-error-container hover:text-error disabled:cursor-not-allowed disabled:opacity-50"
                        title="Xóa khỏi nhóm"
                      >
                        <span className="material-symbols-outlined text-[19px]">
                          {removingMemberId === member.id ? 'hourglass_empty' : 'person_remove'}
                        </span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

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
          {(isGalleryLoading || galleryError) && (
            <div className="border-b border-outline-variant px-6 py-3">
              <p className={`text-xs ${galleryError ? 'text-error' : 'text-on-surface-variant'}`}>
                {galleryError || 'Đang tải gallery...'}
              </p>
            </div>
          )}

          {activeTab === 'media' && (
            <section className="border-b border-outline-variant px-6 py-5">
              {filteredMedia.length === 0 ? (
                <p className="py-8 text-center text-sm text-on-surface-variant">
                  {searchQuery ? 'Không tìm thấy media.' : 'Chưa có media nào.'}
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {filteredMedia.map((item) => (
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
              )}
            </section>
          )}

          {activeTab === 'files' && (
            <section className="border-b border-outline-variant px-6 py-5">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-on-surface">Tệp</h3>
                <span className="text-xs text-on-surface-variant">{files.length} mục</span>
              </div>
              {filteredFiles.length === 0 ? (
                <p className="py-4 text-sm text-on-surface-variant">
                  {searchQuery ? 'Không tìm thấy tệp.' : 'Chưa có tệp nào.'}
                </p>
              ) : (
                <div className="divide-y divide-outline-variant">
                  {filteredFiles.map((file) => (
                    <a
                      key={file.id}
                      href={file.url}
                      download={file.filename}
                      className="flex min-w-0 items-center gap-3 py-3"
                    >
                      <FileTypeIcon
                        filename={file.filename}
                        mimeType={file.mimeType}
                        type={file.type}
                        size="sm"
                      />
                      <span className="min-w-0 flex-1 overflow-hidden">
                        <span className="block truncate text-sm text-on-surface">
                          {file.filename}
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-on-surface-variant">
                          {formatFileSize(file.size)} · {getAttachmentKindLabel(file)}
                        </span>
                      </span>
                      <span className="shrink-0 text-xs text-on-surface-variant">
                        {formatDateLabel(file.timestamp)}
                      </span>
                    </a>
                  ))}
                </div>
              )}
            </section>
          )}

          {activeTab === 'audio' && (
            <section className="border-b border-outline-variant px-6 py-5">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-on-surface">Audio</h3>
                <span className="text-xs text-on-surface-variant">{audio.length} mục</span>
              </div>
              {filteredAudio.length === 0 ? (
                <p className="py-4 text-sm text-on-surface-variant">
                  {searchQuery ? 'Không tìm thấy audio.' : 'Chưa có audio nào.'}
                </p>
              ) : (
                <div className="space-y-3">
                  {filteredAudio.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-3"
                    >
                      <div className="mb-2 flex items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-on-surface">
                          <span className="material-symbols-outlined text-[21px]">graphic_eq</span>
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-on-surface">
                            Tin nhắn thoại
                          </span>
                          <span className="mt-0.5 block text-xs text-on-surface-variant">
                            {[
                              formatFileSize(item.size),
                              item.senderName,
                              formatDateLabel(item.timestamp),
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </span>
                        </span>
                      </div>
                      <audio controls src={item.url} className="h-9 w-full" />
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {activeTab === 'links' && (
            <section className="px-6 py-5">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-on-surface">Liên kết</h3>
                <span className="text-xs text-on-surface-variant">{links.length} mục</span>
              </div>
              {filteredLinks.length === 0 ? (
                <p className="py-4 text-sm text-on-surface-variant">
                  {searchQuery ? 'Không tìm thấy liên kết.' : 'Chưa có liên kết nào.'}
                </p>
              ) : (
                <div className="space-y-2">
                  {filteredLinks.map((link) => (
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
                        <span className="block truncate text-xs text-on-surface-variant">
                          {link.url}
                        </span>
                      </span>
                    </a>
                  ))}
                </div>
              )}
            </section>
          )}
        </div>
      </aside>
    </>
  );
};

export default ChatDetailsPanel;
