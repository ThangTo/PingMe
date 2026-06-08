import { useEffect, useMemo, useRef, useState } from 'react';
import api from '../../config/api';
import { useCall } from '../../context/CallContext';
import FileTypeIcon from '../ui/FileTypeIcon';
import AppIcon from '../ui/AppIcon';
import AppModal from '../ui/AppModal';
import Avatar from '../ui/Avatar';
import { useConfirmDialog } from '../ui/confirmDialogContext';
import { useToast } from '../ui/toastContext';

const fallbackAvatar =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuBahpFjkcHIiXnez71G-AraliNtmi5v8RquQh32J3n6EOHz1qvVsa2SYxXapR9iaamKNqQ30JzpziX2OAreG_C-9h3wCctRkHorqJ01Yo1MdgqGjvfPRhctrnu7ARwCdwvHK1fl42HCqMJ1A8sbW5bbHtGPpcdjeETYrHqW5A8y82nlhgH6kIfDZUHoGLWDZh1CnnzHQXHoYKEVy3EPNv_qviB9kBtZtTURL2tkJ8kXPpmPaIssR1Y1sPBi9mqbn6eO6qnCSw6q6xLP';

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
  onUpdateConversationNotifications,
  onBlocked,
  onClose,
}) => {
  const { confirm } = useConfirmDialog();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState('media');
  const [lightboxSrc, setLightboxSrc] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isMembersOpen, setIsMembersOpen] = useState(false);
  const [isMemberComposerOpen, setIsMemberComposerOpen] = useState(false);
  const [activeMemberMenuId, setActiveMemberMenuId] = useState(null);
  const [pendingRemoveMember, setPendingRemoveMember] = useState(null);
  const [selectedMemberIds, setSelectedMemberIds] = useState([]);
  const [memberActionError, setMemberActionError] = useState('');
  const [isAddingMembers, setIsAddingMembers] = useState(false);
  const [removingMemberId, setRemovingMemberId] = useState(null);
  const [updatingRoleMemberId, setUpdatingRoleMemberId] = useState(null);
  const [isUpdatingNotifications, setIsUpdatingNotifications] = useState(false);
  const [notificationError, setNotificationError] = useState('');
  const [serverGallery, setServerGallery] = useState(emptyGallery);
  const [isGalleryLoading, setIsGalleryLoading] = useState(false);
  const [galleryError, setGalleryError] = useState('');
  const [socialActionError, setSocialActionError] = useState('');
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportDetails, setReportDetails] = useState('');
  const [isReporting, setIsReporting] = useState(false);
  const memberMenuRef = useRef(null);
  const isGroup = Boolean(user?.isGroup);
  const { callState, initiateCall } = useCall();
  const canStartDirectCall = !isGroup && Boolean(user?.peerId) && callState.status === 'idle';
  const notificationsMuted = Boolean(user?.notificationsMuted);

  const handleStartCall = (type) => {
    if (!canStartDirectCall) return;

    initiateCall(user.peerId, type, {
      name: user.name,
      avatar: user.avatar,
      conversationId: user.id,
    });
  };

  const handleToggleConversationNotifications = async () => {
    if (!user?.id) return;

    try {
      setIsUpdatingNotifications(true);
      setNotificationError('');
      await onUpdateConversationNotifications?.(user.id, !notificationsMuted);
    } catch (error) {
      setNotificationError(
        error.response?.data?.error || 'Không thể cập nhật thông báo cuộc trò chuyện.',
      );
    } finally {
      setIsUpdatingNotifications(false);
    }
  };

  const handleBlockUser = async () => {
    if (!user?.peerId) return;
    const confirmed = await confirm({
      title: `Chặn ${user.name}?`,
      description: 'Hai người sẽ bị hủy kết bạn và không thể nhắn tin hoặc gọi trực tiếp.',
      confirmText: 'Chặn',
      tone: 'danger',
    });
    if (!confirmed) return;

    try {
      setSocialActionError('');
      await api.post(`/social/${user.peerId}/block`);
      onBlocked?.(user.peerId);
      onClose?.();
    } catch (error) {
      setSocialActionError(error.response?.data?.error || 'Không thể chặn người dùng.');
    }
  };

  const handleReportUser = () => {
    if (!user?.peerId) return;
    setReportDetails('');
    setSocialActionError('');
    setIsReportModalOpen(true);
  };

  const handleSubmitReport = async () => {
    if (!user?.peerId) return;
    try {
      setIsReporting(true);
      setSocialActionError('');
      await api.post(`/social/${user.peerId}/report`, {
        reason: 'other',
        details: reportDetails.trim(),
        conversationId: user.id,
      });
      setIsReportModalOpen(false);
      setReportDetails('');
      showToast({ title: 'Đã gửi báo cáo', tone: 'success' });
    } catch (error) {
      setSocialActionError(error.response?.data?.error || 'Không thể gửi báo cáo.');
    } finally {
      setIsReporting(false);
    }
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
    setActiveMemberMenuId(null);
    setPendingRemoveMember(null);
    setSelectedMemberIds([]);
    setMemberActionError('');
    setNotificationError('');
  }, [user?.id]);

  useEffect(() => {
    if (!activeMemberMenuId) return undefined;

    const handlePointerDown = (event) => {
      if (memberMenuRef.current?.contains(event.target)) return;
      setActiveMemberMenuId(null);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [activeMemberMenuId]);

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
  const membersByRole = useMemo(() => {
    const groups = {
      owner: [],
      admin: [],
      member: [],
    };

    (user?.members || []).forEach((member) => {
      if (member.role === 'owner') groups.owner.push(member);
      else if (member.role === 'admin') groups.admin.push(member);
      else groups.member.push(member);
    });

    return [
      { key: 'owner', label: 'Chủ nhóm', members: groups.owner },
      { key: 'admin', label: `Quản trị (${groups.admin.length})`, members: groups.admin },
      { key: 'member', label: `Thành viên (${groups.member.length})`, members: groups.member },
    ].filter((group) => group.members.length > 0);
  }, [user?.members]);
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

  const openMemberMenu = (event, member) => {
    event.stopPropagation();
    setMemberActionError('');
    setActiveMemberMenuId((current) => (current === member.id ? null : member.id));
  };

  const requestRemoveMember = (member) => {
    setActiveMemberMenuId(null);
    setPendingRemoveMember(member);
  };

  const handleRemoveMember = async (member) => {
    if (!user?.id || !member?.id) return;

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

  const handleConfirmRemoveMember = async () => {
    if (!pendingRemoveMember) return;
    const member = pendingRemoveMember;
    setPendingRemoveMember(null);
    await handleRemoveMember(member);
  };

  const handleUpdateMemberRole = async (member) => {
    if (!user?.id || !member?.id) return;

    const nextRole = member.role === 'admin' ? 'member' : 'admin';
    const label = nextRole === 'admin' ? 'Đặt làm quản trị' : 'Gỡ quyền quản trị';
    const confirmed = await confirm({
      title: `${label}?`,
      description: `${member.username || 'Thành viên này'} sẽ được cập nhật quyền trong nhóm.`,
      confirmText: 'Cập nhật',
    });
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
            <AppIcon name="close" className="text-2xl" />
          </button>
          <img
            src={lightboxSrc}
            alt="Ảnh trong thư viện"
            className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain"
            onClick={(event) => event.stopPropagation()}
          />
        </div>
      )}

      {pendingRemoveMember && (
        <div className="fixed inset-0 z-[70] flex items-end bg-[#1f1d1a]/35 px-3 pb-3 md:items-center md:justify-center md:p-6">
          <div className="w-full max-w-[360px] overflow-hidden rounded-[18px] border border-outline-variant bg-surface-container-lowest shadow-sm">
            <div className="px-5 py-4 text-center">
              <p className="text-sm font-semibold text-error">Xóa khỏi nhóm</p>
              <p className="mt-1 text-xs leading-5 text-on-surface-variant">
                {pendingRemoveMember.username || 'Thành viên này'} sẽ không còn xem và gửi tin trong nhóm này.
              </p>
            </div>
            <div className="grid grid-cols-2 border-t border-outline-variant">
              <button
                type="button"
                onClick={() => setPendingRemoveMember(null)}
                className="h-12 border-r border-outline-variant text-sm font-medium text-on-surface hover:bg-surface-container-low"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleConfirmRemoveMember}
                disabled={removingMemberId === pendingRemoveMember.id}
                className="h-12 text-sm font-semibold text-error hover:bg-error-container disabled:opacity-50"
              >
                {removingMemberId === pendingRemoveMember.id ? 'Đang xóa...' : 'Xóa'}
              </button>
            </div>
          </div>
        </div>
      )}

      <AppModal
        open={isReportModalOpen}
        title={`Báo cáo ${user?.name || 'người dùng'}`}
        description="Mô tả ngắn vấn đề để PingMe có thêm ngữ cảnh xử lý."
        onClose={() => {
          if (isReporting) return;
          setIsReportModalOpen(false);
        }}
        footer={
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setIsReportModalOpen(false)}
              disabled={isReporting}
              className="h-10 flex-1 rounded-[8px] border border-outline-variant text-sm font-medium text-on-surface hover:bg-surface-container-low disabled:opacity-50"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={handleSubmitReport}
              disabled={isReporting}
              className="h-10 flex-1 rounded-[8px] bg-error text-sm font-semibold text-white hover:bg-error/90 disabled:opacity-50"
            >
              {isReporting ? 'Đang gửi...' : 'Gửi báo cáo'}
            </button>
          </div>
        }
      >
        <textarea
          value={reportDetails}
          onChange={(event) => setReportDetails(event.target.value)}
          className="min-h-28 w-full resize-none rounded-[10px] border border-outline bg-surface px-3 py-2.5 text-sm text-on-surface outline-none focus:border-secondary"
          placeholder="Ví dụ: spam, quấy rối, nội dung không phù hợp..."
          maxLength={300}
          autoFocus
        />
        <div className="mt-2 flex items-center justify-between gap-3">
          <span className="text-xs text-error">{socialActionError}</span>
          <span className="text-xs text-on-surface-variant">{reportDetails.length}/300</span>
        </div>
      </AppModal>

      <aside className="no-scrollbar fixed inset-0 z-50 flex h-[100dvh] w-full flex-col overflow-y-auto border-l border-outline-variant bg-surface xl:static xl:z-auto xl:h-full xl:w-[390px] xl:shrink-0">
        <div className="flex items-start justify-between px-5 pb-4 pt-5 md:px-6 md:pt-6">
          <div className="flex min-w-0 items-start gap-4">
            <Avatar
              src={user?.avatar || (!isGroup ? fallbackAvatar : '')}
              name={user?.name || 'Cuộc trò chuyện'}
              online={!isGroup && user?.isOnline}
              size="xl"
            />
            <div className="min-w-0 pt-1">
              {isGroup && (
                <p className="mb-1 text-[12px] font-semibold text-on-surface-variant">Thông tin nhóm</p>
              )}
              <h2 className="truncate text-[18px] font-medium tracking-tight text-on-surface">
                {user?.name || 'Cuộc trò chuyện'}
              </h2>
              {!isGroup && user?.pingId && (
                <p className="mt-1 truncate text-[13px] font-medium text-secondary">@{user.pingId}</p>
              )}
              {isGroup && (
                <p className="mt-1 text-sm text-secondary">
                  {user?.memberCount || 0} thành viên
                </p>
              )}
              <p className={`mt-1 text-[13px] text-on-surface-variant ${isGroup ? 'hidden' : ''}`}>
                {user?.isOnline ? 'Đang online' : 'Ngoại tuyến'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-[8px] text-on-surface-variant transition-colors hover:bg-surface-container-lowest hover:text-on-surface"
            title="Đóng"
          >
            <AppIcon name="close" className="text-[22px]" />
          </button>
        </div>

        <div className={`grid gap-2 px-5 md:px-6 ${isGroup ? 'grid-cols-2' : 'grid-cols-4'}`}>
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
          ].map((item) => {
            const actionItem =
              item.icon === 'notifications_off'
                ? {
                    ...item,
                    icon: notificationsMuted ? 'notifications' : 'notifications_off',
                    label: notificationsMuted ? 'Bật thông báo' : 'Tắt thông báo',
                    active: notificationsMuted,
                    disabled: isUpdatingNotifications,
                    onClick: handleToggleConversationNotifications,
                  }
                : item;

            return (
              <button
                key={actionItem.label}
                type="button"
                onClick={actionItem.onClick}
                disabled={actionItem.disabled}
                className={`${isGroup && ['call', 'videocam'].includes(actionItem.icon) ? 'hidden' : 'flex'} h-[64px] flex-col items-center justify-center gap-2 rounded-[8px] border border-outline-variant transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${
                  actionItem.active
                    ? 'bg-surface-container-high text-on-surface'
                    : 'bg-surface-container-lowest text-on-surface hover:bg-surface-container-low'
                }`}
                title={actionItem.label}
              >
                <AppIcon name={actionItem.icon} className="text-[24px]" />
                <span className="text-[13px]">{actionItem.label}</span>
              </button>
            );
          })}
        </div>

        {notificationError && (
          <p className="mx-6 mt-3 rounded-lg border border-error/20 bg-error-container px-3 py-2 text-xs text-error">
            {notificationError}
          </p>
        )}

        {notificationsMuted && !notificationError && (
          <p className="mx-6 mt-3 rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-xs text-on-surface-variant">
            Bạn đã tắt thông báo cho cuộc trò chuyện này.
          </p>
        )}

        {!isGroup && (
          <section className="mx-6 mt-5 border-t border-outline-variant pt-5">
            <p className="text-[12px] font-medium uppercase tracking-[0.08em] text-on-surface-variant">An toàn</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleReportUser}
                className="flex h-[40px] items-center justify-center gap-2 rounded-[8px] border border-outline-variant text-[14px] font-medium hover:bg-surface-container-lowest"
              >
                <AppIcon name="shield_person" className="text-[18px]" />
                Báo cáo
              </button>
              <button
                type="button"
                onClick={handleBlockUser}
                className="flex h-[40px] items-center justify-center gap-2 rounded-[8px] bg-error/10 text-[14px] font-medium text-error hover:bg-error/20"
              >
                <AppIcon name="block" className="text-[18px]" />
                Chặn
              </button>
            </div>
            {socialActionError && <p className="mt-2 text-xs text-error">{socialActionError}</p>}
          </section>
        )}

        {isGroup && (
          <section className="mt-5 border-y border-outline-variant px-6 py-5">
            <button
              type="button"
              onClick={toggleMembersSection}
              className="flex w-full items-center justify-between gap-3 rounded-[8px] px-1 py-2 text-left transition-colors hover:bg-surface-container-lowest"
              aria-expanded={isMembersOpen}
            >
              <span className="min-w-0">
                <span className="block text-[14px] font-medium text-on-surface">Thành viên</span>
                <span className="mt-0.5 block text-[13px] text-on-surface-variant">
                  {user?.memberCount || user?.members?.length || 0} người trong nhóm
                </span>
              </span>
              <AppIcon name="expand_more" className={`text-[22px] text-on-surface-variant transition-transform ${ isMembersOpen ? 'rotate-180' : '' }`} />
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
                  <AppIcon name="person_add" className="text-[17px]" />
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
              <div className="fixed inset-x-3 bottom-3 z-[60] rounded-[18px] border border-outline-variant bg-surface-container-lowest p-4 shadow-sm md:static md:inset-auto md:z-auto md:mb-4 md:rounded-lg md:p-3">
                <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-outline md:hidden" />
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
                          <Avatar src={friend.avatar} name={friend.name} online={friend.isOnline} size="sm" />
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
                            <AppIcon name="check" className="text-[15px]" />
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

            <div className={isMembersOpen ? `${canManageMembers ? '' : 'pt-3'} space-y-4` : 'hidden'}>
              {membersByRole.map((group) => (
                <div key={group.key} className="space-y-1.5">
                  <p className="px-1.5 text-[11px] font-medium text-on-surface-variant">{group.label}</p>
                  {group.members.map((member) => {
                    const canOpenMemberMenu = canUpdateMemberRole(member) || canRemoveMember(member);
                    const isMenuOpen = activeMemberMenuId === member.id;

                    return (
                      <div
                        key={member.id}
                        className="relative flex items-center gap-3 rounded-lg px-1.5 py-1.5 transition-colors hover:bg-surface-container-low"
                      >
                        <Avatar src={member.avatar} name={member.username} online={member.isOnline} size="sm" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-on-surface">
                            {member.id === currentUserId ? 'Bạn' : member.username}
                          </p>
                          {member.pingId && (
                            <p className="truncate text-xs font-medium text-secondary">@{member.pingId}</p>
                          )}
                          <p className="text-xs text-on-surface-variant">
                            {member.isOnline ? 'Đang online' : roleLabels[member.role] || 'Thành viên'}
                          </p>
                        </div>
                        <span
                          className={`hidden shrink-0 rounded-full border px-2 py-1 text-[11px] font-medium md:inline-flex ${
                            member.role === 'owner' || member.role === 'admin'
                              ? 'border-secondary/25 bg-secondary-container text-secondary'
                              : 'border-outline-variant text-on-surface-variant'
                          }`}
                        >
                          {roleLabels[member.role] || 'Thành viên'}
                        </span>

                        {canOpenMemberMenu && (
                          <button
                            type="button"
                            onClick={(event) => openMemberMenu(event, member)}
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface"
                            title="Tùy chọn thành viên"
                          >
                            <AppIcon name="more_vert" className="text-[19px]" />
                          </button>
                        )}

                        {isMenuOpen && (
                          <div
                            ref={memberMenuRef}
                            className="absolute right-1 top-10 z-40 w-[196px] overflow-hidden rounded-[10px] border border-outline-variant bg-surface-container-lowest p-1 shadow-sm"
                          >
                            {canUpdateMemberRole(member) && (
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveMemberMenuId(null);
                                  handleUpdateMemberRole(member);
                                }}
                                disabled={updatingRoleMemberId === member.id}
                                className="flex w-full items-center gap-3 rounded-[8px] px-3 py-2.5 text-left text-sm text-on-surface transition-colors hover:bg-surface-container-low disabled:opacity-50"
                              >
                                <AppIcon
                                  name={member.role === 'admin' ? 'admin_panel_settings' : 'shield_person'}
                                  className="text-[18px]"
                                />
                                <span>{member.role === 'admin' ? 'Gỡ quyền quản trị' : 'Đặt làm quản trị'}</span>
                              </button>
                            )}

                            {canRemoveMember(member) && (
                              <button
                                type="button"
                                onClick={() => requestRemoveMember(member)}
                                disabled={removingMemberId === member.id}
                                className="flex w-full items-center gap-3 rounded-[8px] px-3 py-2.5 text-left text-sm text-error transition-colors hover:bg-error-container disabled:opacity-50"
                              >
                                <AppIcon name="person_remove" className="text-[18px]" />
                                <span>Xóa khỏi nhóm</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </section>
        )}

        <div className="mt-5 flex border-b border-outline-variant px-5 md:px-6">
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

        <div className="border-b border-outline-variant px-5 py-4 md:px-6">
          <div className="relative">
            <AppIcon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-on-surface-variant" />
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
            <section className="border-b border-outline-variant px-5 py-5 md:px-6">
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
            <section className="border-b border-outline-variant px-5 py-5 md:px-6">
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
                      target="_blank"
                      rel="noreferrer"
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
            <section className="border-b border-outline-variant px-5 py-5 md:px-6">
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
                          <AppIcon name="graphic_eq" className="text-[21px]" />
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
            <section className="px-5 py-5 md:px-6">
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
                      <AppIcon name="language" className="text-[24px] text-on-surface-variant" />
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
