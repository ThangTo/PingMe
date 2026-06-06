import { useEffect, useMemo, useRef, useState } from 'react';
import api from '../../config/api';
import socket from '../../socket';
import AppIcon from '../ui/AppIcon';

const fallbackAvatar =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuBahpFjkcHIiXnez71G-AraliNtmi5v8RquQh32J3n6EOHz1qvVsa2SYxXapR9iaamKNqQ30JzpziX2OAreG_C-9h3wCctRkHorqJ01Yo1MdgqGjvfPRhctrnu7ARwCdwvHK1fl42HCqMJ1A8sbW5bbHtGPpcdjeETYrHqW5A8y82nlhgH6kIfDZUHoGLWDZh1CnnzHQXHoYKEVy3EPNv_qviB9kBtZtTURL2tkJ8kXPpmPaIssR1Y1sPBi9mqbn6eO6qnCSw6q6xLP';

const inboxTabs = [
  { key: 'all', label: 'Tất cả' },
  { key: 'unread', label: 'Chưa đọc' },
  { key: 'favorite', label: 'Yêu thích' },
  { key: 'group', label: 'Nhóm' },
];

const formatConversationTime = (value) => {
  if (!value) return '';

  const date = new Date(value);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const oneDay = 24 * 60 * 60 * 1000;

  if (diff < oneDay && date.getDate() === now.getDate()) {
    return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  }

  if (diff < oneDay * 2) return 'Hôm qua';

  return date.toLocaleDateString('vi-VN', { weekday: 'short' });
};

const getInitials = (name = '') =>
  name
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || '?';

const Sidebar = ({
  conversations = [],
  viewMode = 'messages',
  onSelectConversation,
  selectedConversationId,
  onFriendAdded,
  isChatOpen = false,
  isLoading = false,
  error = '',
  focusSearchSignal = 0,
  onOpenSettings,
  onOpenNotifications,
  onOpenGlobalSearch,
  notificationCount = 0,
  onConversationCreated,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [friendRequests, setFriendRequests] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [isGroupComposerOpen, setIsGroupComposerOpen] = useState(false);
  const [groupTitle, setGroupTitle] = useState('');
  const [selectedGroupMemberIds, setSelectedGroupMemberIds] = useState([]);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [createGroupError, setCreateGroupError] = useState('');
  const searchInputRef = useRef(null);

  const isDirectoryMode = activeTab === 'search' || activeTab === 'requests';

  useEffect(() => {
    if (viewMode === 'contacts') {
      setActiveTab('search');
      return;
    }
    if (viewMode === 'groups') {
      setActiveTab('group');
      return;
    }
    if (viewMode === 'messages') setActiveTab('all');
  }, [viewMode]);

  useEffect(() => {
    const fetchRequests = async () => {
      try {
        const response = await api.get('/users/requests');
        setFriendRequests(response.data.requests || []);
      } catch (error) {
        console.error('Lỗi lấy lời mời:', error);
      }
    };

    fetchRequests();
  }, []);

  useEffect(() => {
    if (focusSearchSignal > 0) {
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    }
  }, [focusSearchSignal]);

  useEffect(() => {
    const refreshRequests = async () => {
      try {
        const response = await api.get('/users/requests');
        setFriendRequests(response.data.requests || []);
      } catch (error) {
        console.error('Không thể đồng bộ lời mời kết bạn:', error);
      }
    };
    const handleRequestReceived = ({ requester }) => {
      if (!requester?._id) {
        refreshRequests();
        return;
      }
      setFriendRequests((prev) => [
        requester,
        ...prev.filter((request) => request._id !== requester._id),
      ]);
    };
    const handleRequestCancelled = ({ requesterId }) => {
      setFriendRequests((prev) => prev.filter((request) => request._id !== requesterId));
    };

    socket.on('friend_request_received', handleRequestReceived);
    socket.on('friend_request_cancelled', handleRequestCancelled);
    socket.on('friend_request_accepted', refreshRequests);
    socket.on('relationship_updated', refreshRequests);

    return () => {
      socket.off('friend_request_received', handleRequestReceived);
      socket.off('friend_request_cancelled', handleRequestCancelled);
      socket.off('friend_request_accepted', refreshRequests);
      socket.off('relationship_updated', refreshRequests);
    };
  }, []);

  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (activeTab === 'search' && searchQuery.trim().length > 1) {
        try {
          const res = await api.get(`/users/search?q=${encodeURIComponent(searchQuery)}`);
          setSearchResults(res.data.users || []);
        } catch (err) {
          console.error(err);
        }
      } else if (activeTab === 'search') {
        setSearchResults([]);
      }
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, activeTab]);

  const handleAddFriend = async (userId) => {
    try {
      await api.post('/users/request', { recipientId: userId });
      setSearchResults((prev) =>
        prev.map((u) => (u._id === userId ? { ...u, status: 'sent' } : u)),
      );
    } catch (err) {
      console.error(err);
    }
  };

  const handleCancelRequest = async (recipientId) => {
    try {
      await api.post('/users/cancel-request', { recipientId });
      setSearchResults((prev) =>
        prev.map((u) => (u._id === recipientId ? { ...u, status: 'none' } : u)),
      );
    } catch (err) {
      console.error(err);
    }
  };

  const handleAccept = async (requesterId) => {
    try {
      const response = await api.post('/users/accept', { requesterId });
      if (response.data.success) {
        setFriendRequests((prev) => prev.filter((r) => r._id !== requesterId));
        onFriendAdded?.();
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleReject = async (requesterId) => {
    try {
      const response = await api.post('/users/reject', { requesterId });
      if (response.data.success) {
        setFriendRequests((prev) => prev.filter((r) => r._id !== requesterId));
        setSearchResults((prev) =>
          prev.map((u) => (u._id === requesterId ? { ...u, status: 'none' } : u)),
        );
      }
    } catch (error) {
      console.error(error);
    }
  };

  const filteredConversations = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return conversations
      .filter((conv) => {
        if (activeTab === 'unread') return (conv.unreadCount || 0) > 0;
        if (activeTab === 'favorite') return conv.isFavorite;
        if (activeTab === 'group') return conv.isGroup;
        return true;
      })
      .filter((conv) => conv.name?.toLowerCase().includes(normalizedQuery));
  }, [activeTab, conversations, searchQuery]);

  const friendOptions = useMemo(
    () => conversations.filter((conversation) => !conversation.isGroup && conversation.peerId),
    [conversations],
  );

  const resetGroupComposer = () => {
    setGroupTitle('');
    setSelectedGroupMemberIds([]);
    setCreateGroupError('');
    setIsCreatingGroup(false);
  };

  const closeGroupComposer = () => {
    setIsGroupComposerOpen(false);
    resetGroupComposer();
  };

  const toggleGroupMember = (memberId) => {
    setSelectedGroupMemberIds((prev) =>
      prev.includes(memberId) ? prev.filter((id) => id !== memberId) : [...prev, memberId],
    );
  };

  const handleCreateGroup = async (event) => {
    event.preventDefault();
    const title = groupTitle.trim();

    if (!title || selectedGroupMemberIds.length === 0) {
      setCreateGroupError('Đặt tên nhóm và chọn ít nhất 1 thành viên.');
      return;
    }

    try {
      setIsCreatingGroup(true);
      setCreateGroupError('');
      const response = await api.post('/conversations/groups', {
        title,
        memberIds: selectedGroupMemberIds,
      });

      if (response.data.success) {
        onConversationCreated?.(response.data.conversation);
        closeGroupComposer();
        setActiveTab('group');
      }
    } catch (error) {
      setCreateGroupError(error.response?.data?.error || 'Không thể tạo nhóm.');
    } finally {
      setIsCreatingGroup(false);
    }
  };

  const openDirectory = () => {
    setActiveTab('search');
    setSearchQuery('');
  };

  const title = isDirectoryMode ? 'Danh bạ' : 'Tin nhắn';
  const subtitle = isDirectoryMode
    ? `${friendRequests.length} lời mời đang chờ`
    : `${filteredConversations.length} cuộc trò chuyện`;

  return (
    <aside
      className={`h-full w-full shrink-0 flex-col border-r border-outline-variant bg-surface md:w-[376px] ${
        isChatOpen ? 'hidden md:flex' : 'flex'
      }`}
    >
      <div className="shrink-0 border-b border-outline-variant bg-surface px-5 pb-4 pt-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="min-w-0 md:hidden">
            <h1 className="truncate text-2xl font-semibold tracking-[-0.04em] text-on-surface">
              PingMe
            </h1>
          </div>

          <div className="hidden min-w-0 md:block">
            <h1 className="truncate text-xl font-semibold tracking-[-0.04em] text-on-surface">
              {title}
            </h1>
            <p className="mt-1 text-xs text-on-surface-variant">{subtitle}</p>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={onOpenGlobalSearch}
              className="flex h-10 w-10 items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container-low md:hidden"
              aria-label="Tìm kiếm toàn bộ tin nhắn"
            >
              <AppIcon name="search" className="text-[21px]" />
            </button>
            <button
              type="button"
              onClick={onOpenNotifications}
              className="relative flex h-10 w-10 items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container-low md:hidden"
              aria-label="Mở thông báo"
            >
              <AppIcon name="notifications" className="text-[21px]" />
              {notificationCount > 0 && (
                <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[9px] font-semibold text-white">
                  {notificationCount > 99 ? '99+' : notificationCount}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setIsGroupComposerOpen(true)}
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-outline-variant bg-surface-container-lowest text-on-surface transition-colors hover:bg-surface-container-low active:scale-[0.98]"
              title="Tạo nhóm"
            >
              <AppIcon name="group_add" className="text-[22px]" />
            </button>
            <button
              type="button"
              onClick={openDirectory}
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-outline-variant bg-surface-container-lowest text-on-surface transition-colors hover:bg-surface-container-low active:scale-[0.98]"
              title="Tìm bạn mới"
            >
              <AppIcon name="edit_square" className="text-[21px]" />
            </button>
            <button
              type="button"
              onClick={() => setActiveTab(activeTab === 'requests' ? 'all' : 'requests')}
              className="relative flex h-10 w-10 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-on-surface md:hidden"
              title="Lời mời"
            >
              <AppIcon name="person_add" className="text-[22px]" />
              {friendRequests.length > 0 && (
                <span className="absolute right-1 top-1 flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-white">
                  {friendRequests.length}
                </span>
              )}
            </button>
          </div>
        </div>

        <div className="relative">
          <AppIcon name="search" className="absolute left-4 top-1/2 -translate-y-1/2 text-[20px] text-on-surface-variant" />
          <input
            ref={searchInputRef}
            className="h-12 w-full rounded-lg border border-outline-variant bg-surface-container-lowest pl-12 pr-4 text-sm text-on-surface outline-none transition-colors placeholder:text-on-surface-variant focus:border-accent"
            placeholder={activeTab === 'search' ? 'Tìm người dùng...' : 'Tìm kiếm'}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {isDirectoryMode ? (
          <div className="mt-4 grid grid-cols-2 gap-2">
            {[
              { key: 'search', label: 'Tìm bạn' },
              { key: 'requests', label: 'Lời mời', badge: friendRequests.length },
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => {
                  setActiveTab(tab.key);
                  setSearchQuery('');
                }}
                className={`rounded-lg border px-4 py-2.5 text-sm transition-colors ${
                  activeTab === tab.key
                    ? 'border-accent bg-accent-soft text-on-surface'
                    : 'border-outline-variant bg-surface-container-lowest text-on-surface-variant hover:text-on-surface'
                }`}
              >
                {tab.label}
                {tab.badge > 0 ? ` (${tab.badge})` : ''}
              </button>
            ))}
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-4 gap-2">
            {inboxTabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`h-10 rounded-lg text-sm transition-colors ${
                  activeTab === tab.key
                    ? 'border border-accent bg-accent-soft font-medium text-on-surface'
                    : 'border border-transparent bg-surface-container-low text-on-surface-variant hover:bg-surface-container-lowest hover:text-on-surface'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="no-scrollbar flex-1 overflow-y-auto">
        {activeTab === 'search' ? (
          <div className="divide-y divide-outline-variant">
            {searchQuery.length < 2 ? (
              <p className="px-6 py-12 text-center text-sm text-on-surface-variant">
                Nhập ít nhất 2 ký tự để tìm người dùng.
              </p>
            ) : searchResults.length === 0 ? (
              <p className="px-6 py-12 text-center text-sm text-on-surface-variant">
                Không tìm thấy người dùng.
              </p>
            ) : (
              searchResults.map((u) => (
                <div key={u._id} className="flex items-center gap-3 px-5 py-4">
                  <img
                    alt={u.username}
                    src={u.avatar || fallbackAvatar}
                    className="h-12 w-12 rounded-full border border-outline-variant object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-on-surface">{u.username}</p>
                    <p className="mt-0.5 truncate text-xs text-on-surface-variant">
                      {u.status === 'friend'
                        ? 'Đã là bạn'
                        : u.status === 'sent'
                          ? 'Đã gửi lời mời'
                          : 'Người dùng PingMe'}
                    </p>
                  </div>
                  {u.status === 'none' && (
                    <button
                      type="button"
                      onClick={() => handleAddFriend(u._id)}
                      className="rounded-lg bg-primary px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-primary-dark active:scale-[0.98]"
                    >
                      Kết nối
                    </button>
                  )}
                  {u.status === 'sent' && (
                    <button
                      type="button"
                      onClick={() => handleCancelRequest(u._id)}
                      className="rounded-lg border border-outline-variant px-3 py-2 text-xs font-medium text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-on-surface active:scale-[0.98]"
                    >
                      Hủy lời mời
                    </button>
                  )}
                  {u.status === 'received' && (
                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        onClick={() => handleAccept(u._id)}
                        className="rounded-lg bg-primary px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-primary-dark active:scale-[0.98]"
                      >
                        Chấp nhận
                      </button>
                      <button
                        type="button"
                        onClick={() => handleReject(u._id)}
                        className="rounded-lg border border-outline-variant px-3 py-2 text-xs font-medium text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-on-surface active:scale-[0.98]"
                      >
                        Từ chối
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        ) : activeTab === 'requests' ? (
          <div className="divide-y divide-outline-variant">
            {friendRequests.length === 0 ? (
              <p className="px-6 py-12 text-center text-sm text-on-surface-variant">
                Không có lời mời kết bạn nào.
              </p>
            ) : (
              friendRequests.map((req) => (
                <div key={req._id} className="flex items-center gap-3 px-5 py-4">
                  <img
                    alt={req.username}
                    src={req.avatar || fallbackAvatar}
                    className="h-12 w-12 rounded-full border border-outline-variant object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-on-surface">{req.username}</p>
                    <p className="mt-0.5 text-xs text-on-surface-variant">Muốn kết nối với bạn</p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => handleAccept(req._id)}
                      className="rounded-lg bg-primary px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-primary-dark active:scale-[0.98]"
                    >
                      Chấp nhận
                    </button>
                    <button
                      type="button"
                      onClick={() => handleReject(req._id)}
                      className="rounded-lg border border-outline-variant px-3 py-2 text-xs font-medium text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-on-surface active:scale-[0.98]"
                    >
                      Từ chối
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="divide-y divide-outline-variant">
            {isLoading ? (
              <div className="space-y-4 px-5 py-5">
                {[1, 2, 3, 4, 5].map((item) => (
                  <div key={item} className="grid animate-pulse grid-cols-[56px_minmax(0,1fr)_36px] gap-3">
                    <div className="h-12 w-12 rounded-full bg-surface-container-low" />
                    <div className="space-y-2 self-center">
                      <div className="h-3 w-28 rounded bg-surface-container-low" />
                      <div className="h-3 w-40 rounded bg-surface-container-low" />
                    </div>
                    <div className="h-3 rounded bg-surface-container-low" />
                  </div>
                ))}
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center gap-3 px-8 py-14 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-error-container">
                  <AppIcon name="wifi_off" className="text-[28px] text-error" />
                </div>
                <p className="text-sm text-error">{error}</p>
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 px-8 py-14 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-surface-container-low">
                  <AppIcon name="chat_bubble" className="text-[28px] text-on-surface-variant" />
                </div>
                <p className="text-sm text-on-surface-variant">
                  {searchQuery ? 'Không tìm thấy cuộc trò chuyện.' : 'Chưa có cuộc trò chuyện nào.'}
                </p>
              </div>
            ) : (
              filteredConversations.map((conv) => {
                const isSelected = selectedConversationId === conv.id;

                return (
                  <button
                    key={conv.id}
                    type="button"
                    onClick={() => onSelectConversation(conv.id)}
                    className={`grid w-full grid-cols-[56px_minmax(0,1fr)_auto] gap-3 px-5 py-4 text-left transition-colors ${
                      isSelected ? 'bg-surface-container-low' : 'hover:bg-surface-container-lowest'
                    }`}
                  >
                    <div className="relative h-12 w-12 shrink-0">
                      {conv.avatar ? (
                        <img
                          alt={conv.name || 'Avatar'}
                          className="h-full w-full rounded-full border border-outline-variant object-cover"
                          src={conv.avatar}
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center rounded-full border border-outline-variant bg-accent-soft text-sm font-semibold text-on-surface">
                          {getInitials(conv.name)}
                        </div>
                      )}
                      {conv.isOnline ? (
                        <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-surface bg-secondary" />
                      ) : null}
                    </div>

                    <div className="min-w-0 self-center">
                      <p className="truncate text-[15px] font-semibold tracking-[-0.02em] text-on-surface">
                        {conv.name}
                      </p>
                      <p
                        className={`mt-1 truncate text-sm ${
                          conv.unreadCount > 0
                            ? 'font-medium text-on-surface'
                            : 'text-on-surface-variant'
                        }`}
                      >
                        {conv.lastMessage || 'Bắt đầu trò chuyện'}
                      </p>
                    </div>

                    <div className="flex min-w-[44px] flex-col items-end gap-2 self-center">
                      <span className="flex items-center gap-1 text-xs text-on-surface-variant">
                        {conv.notificationsMuted && (
                          <AppIcon name="notifications_off" className="text-[13px]" />
                        )}
                        <span>{formatConversationTime(conv.lastMessageAt)}</span>
                      </span>
                      {conv.unreadCount > 0 ? (
                        <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-accent px-2 text-xs font-semibold text-white">
                          {conv.unreadCount}
                        </span>
                      ) : (
                        <span className="h-6 text-xs text-on-surface-variant">
                          {conv.lastMessageAt ? '✓✓' : ''}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>

      {isGroupComposerOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end bg-[#1f1d1a]/35 backdrop-blur-[1px] md:items-center md:justify-center"
          onClick={closeGroupComposer}
        >
          <form
            onSubmit={handleCreateGroup}
            className="w-full rounded-t-2xl border border-outline-variant bg-surface-container-lowest p-5 shadow-[0_24px_70px_rgba(40,37,32,0.18)] md:max-w-[460px] md:rounded-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-5 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-lg font-semibold tracking-[-0.03em] text-on-surface">
                  Tạo nhóm
                </h2>
                <p className="mt-1 text-sm text-on-surface-variant">
                  Chọn bạn bè để bắt đầu cuộc trò chuyện nhóm.
                </p>
              </div>
              <button
                type="button"
                onClick={closeGroupComposer}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-on-surface"
                title="Đóng"
              >
                <AppIcon name="close" className="text-[22px]" />
              </button>
            </div>

            <label className="mb-4 block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-on-surface-variant">
                Tên nhóm
              </span>
              <input
                value={groupTitle}
                onChange={(event) => setGroupTitle(event.target.value)}
                maxLength={80}
                className="h-11 w-full rounded-lg border border-outline-variant bg-surface px-3 text-sm text-on-surface outline-none transition-colors placeholder:text-on-surface-variant focus:border-accent"
                placeholder="Ví dụ: Team Marketing"
              />
            </label>

            <div className="mb-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-[0.08em] text-on-surface-variant">
                  Thành viên
                </span>
                <span className="text-xs text-on-surface-variant">
                  {selectedGroupMemberIds.length} đã chọn
                </span>
              </div>

              <div className="max-h-[320px] overflow-y-auto rounded-lg border border-outline-variant bg-surface">
                {friendOptions.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-on-surface-variant">
                    Kết bạn trước khi tạo nhóm.
                  </div>
                ) : (
                  friendOptions.map((friend) => {
                    const isSelected = selectedGroupMemberIds.includes(friend.peerId);

                    return (
                      <button
                        key={friend.peerId}
                        type="button"
                        onClick={() => toggleGroupMember(friend.peerId)}
                        className="flex w-full items-center gap-3 border-b border-outline-variant px-3 py-3 text-left transition-colors last:border-b-0 hover:bg-surface-container-low"
                      >
                        <div className="relative h-10 w-10 shrink-0">
                          {friend.avatar ? (
                            <img
                              src={friend.avatar}
                              alt={friend.name}
                              className="h-full w-full rounded-full border border-outline-variant object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center rounded-full border border-outline-variant bg-accent-soft text-xs font-semibold text-on-surface">
                              {getInitials(friend.name)}
                            </div>
                          )}
                          {friend.isOnline && (
                            <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-surface bg-secondary" />
                          )}
                        </div>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-on-surface">
                            {friend.name}
                          </span>
                          <span className="mt-0.5 block truncate text-xs text-on-surface-variant">
                            {friend.isOnline ? 'Đang online' : 'Ngoại tuyến'}
                          </span>
                        </span>
                        <span
                          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border transition-colors ${
                            isSelected
                              ? 'border-accent bg-accent text-white'
                              : 'border-outline-variant text-transparent'
                          }`}
                        >
                          <AppIcon name="check" className="text-[18px]" />
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {createGroupError && (
              <p className="mb-3 rounded-lg border border-error/20 bg-error-container px-3 py-2 text-sm text-error">
                {createGroupError}
              </p>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={closeGroupComposer}
                className="h-11 flex-1 rounded-lg border border-outline-variant text-sm font-medium text-on-surface transition-colors hover:bg-surface-container-low"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={isCreatingGroup || !groupTitle.trim() || selectedGroupMemberIds.length === 0}
                className="h-11 flex-1 rounded-lg bg-primary text-sm font-semibold text-white transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-55"
              >
                {isCreatingGroup ? 'Đang tạo...' : 'Tạo nhóm'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid h-[72px] grid-cols-3 border-t border-outline-variant bg-surface md:hidden">
        {[
          { icon: 'chat_bubble', label: 'Tin nhắn', active: true },
          { icon: 'person', label: 'Danh bạ' },
          { icon: 'settings', label: 'Cài đặt', onClick: onOpenSettings },
        ].map((item) => (
          <button
            key={item.label}
            type="button"
            onClick={item.onClick}
            className={`flex flex-col items-center justify-center gap-1 text-xs ${
              item.active ? 'text-accent' : 'text-on-surface-variant'
            }`}
          >
            <AppIcon name={item.icon} className="text-[22px]" />
            <span>{item.label}</span>
          </button>
        ))}
      </div>
    </aside>
  );
};

export default Sidebar;
