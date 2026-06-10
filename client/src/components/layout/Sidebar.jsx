import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import api from '../../config/api';
import socket from '../../socket';
import { getPresenceText } from '../../utils/presence';
import AppIcon from '../ui/AppIcon';
import Avatar from '../ui/Avatar';
import { ListSkeleton } from '../ui/LoadingState';
import PingMeLogo from '../ui/PingMeLogo';
import PingMeWordmark from '../ui/PingMeWordmark';

const inboxTabs = [
  { key: 'all', label: 'Tất cả' },
  { key: 'unread', label: 'Chưa đọc' },
  { key: 'favorite', label: 'Yêu thích' },
  { key: 'group', label: 'Nhóm' },
];

const DIRECTORY_PAGE_SIZE = 20;

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
  onOpenMessages,
  onOpenContacts,
  onOpenGroups,
  onOpenNotifications,
  onOpenGlobalSearch,
  notificationCount = 0,
  onFriendRequestCountChange,
  showMessageBrand = false,
  onConversationCreated,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [friendRequests, setFriendRequests] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [directoryUsers, setDirectoryUsers] = useState([]);
  const [directoryPagination, setDirectoryPagination] = useState({
    page: 1,
    hasMore: false,
    nextPage: null,
  });
  const [isDirectoryLoading, setIsDirectoryLoading] = useState(false);
  const [isDirectoryLoadingMore, setIsDirectoryLoadingMore] = useState(false);
  const [directoryError, setDirectoryError] = useState('');
  const [searchPagination, setSearchPagination] = useState({
    page: 1,
    hasMore: false,
    nextPage: null,
  });
  const [isSearchLoadingMore, setIsSearchLoadingMore] = useState(false);
  const [selectedConnectionUserId, setSelectedConnectionUserId] = useState('');
  const [isGroupComposerOpen, setIsGroupComposerOpen] = useState(false);
  const [groupTitle, setGroupTitle] = useState('');
  const [groupMemberQuery, setGroupMemberQuery] = useState('');
  const [selectedGroupMemberIds, setSelectedGroupMemberIds] = useState([]);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [createGroupError, setCreateGroupError] = useState('');
  const searchInputRef = useRef(null);

  const isDirectoryMode =
    activeTab === 'search' || activeTab === 'discover' || activeTab === 'requests';

  const fetchDirectoryUsers = useCallback(async ({ page = 1, append = false } = {}) => {
    try {
      if (append) {
        setIsDirectoryLoadingMore(true);
      } else {
        setIsDirectoryLoading(true);
      }
      setDirectoryError('');
      const response = await api.get('/users', {
        params: { page, limit: DIRECTORY_PAGE_SIZE },
      });
      const nextUsers = response.data.users || [];
      setDirectoryUsers((prev) => {
        if (!append) return nextUsers;
        const existingIds = new Set(prev.map((user) => user._id));
        return [...prev, ...nextUsers.filter((user) => !existingIds.has(user._id))];
      });
      setDirectoryPagination(response.data.pagination || {
        page,
        hasMore: false,
        nextPage: null,
      });
    } catch (error) {
      console.error('Không thể lấy danh sách người dùng:', error);
      setDirectoryError('Không thể tải danh sách kết nối.');
    } finally {
      setIsDirectoryLoading(false);
      setIsDirectoryLoadingMore(false);
    }
  }, []);

  const loadMoreDirectoryUsers = useCallback(() => {
    if (!directoryPagination.hasMore || isDirectoryLoadingMore) return;
    fetchDirectoryUsers({
      page: directoryPagination.nextPage || directoryPagination.page + 1,
      append: true,
    });
  }, [directoryPagination, fetchDirectoryUsers, isDirectoryLoadingMore]);

  useEffect(() => {
    if (viewMode === 'contacts') {
      setActiveTab('discover');
      return;
    }
    if (viewMode === 'groups') {
      setActiveTab('group');
      return;
    }
    if (viewMode === 'messages') setActiveTab('all');
  }, [viewMode]);

  useEffect(() => {
    if (isDirectoryMode) {
      fetchDirectoryUsers();
    }
  }, [fetchDirectoryUsers, isDirectoryMode]);

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
    onFriendRequestCountChange?.(friendRequests.length);
  }, [friendRequests.length, onFriendRequestCountChange]);

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
    socket.on('friend_request_accepted', fetchDirectoryUsers);
    socket.on('relationship_updated', refreshRequests);
    socket.on('relationship_updated', fetchDirectoryUsers);

    return () => {
      socket.off('friend_request_received', handleRequestReceived);
      socket.off('friend_request_cancelled', handleRequestCancelled);
      socket.off('friend_request_accepted', refreshRequests);
      socket.off('friend_request_accepted', fetchDirectoryUsers);
      socket.off('relationship_updated', refreshRequests);
      socket.off('relationship_updated', fetchDirectoryUsers);
    };
  }, [fetchDirectoryUsers]);

  useEffect(() => {
    const applyPresence = (users, data) =>
      users.map((item) =>
        item._id === data.userId
          ? {
              ...item,
              isOnline: data.canViewPresence !== false && data.status === 'online',
              lastSeen:
                data.canViewPresence !== false ? data.lastSeen || item.lastSeen || null : null,
              canViewPresence: data.canViewPresence ?? true,
            }
          : item,
      );

    const handleStatusChanged = (data) => {
      if (!data?.userId) return;
      setFriendRequests((prev) => applyPresence(prev, data));
      setSearchResults((prev) => applyPresence(prev, data));
      setDirectoryUsers((prev) => applyPresence(prev, data));
    };

    socket.on('user_status_changed', handleStatusChanged);
    return () => socket.off('user_status_changed', handleStatusChanged);
  }, []);

  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if ((activeTab === 'search' || activeTab === 'discover') && searchQuery.trim().length > 1) {
        try {
          const res = await api.get('/users/search', {
            params: { q: searchQuery, page: 1, limit: DIRECTORY_PAGE_SIZE },
          });
          setSearchResults(res.data.users || []);
          setSearchPagination(res.data.pagination || {
            page: 1,
            hasMore: false,
            nextPage: null,
          });
        } catch (err) {
          console.error(err);
        }
      } else if (activeTab === 'search' || activeTab === 'discover') {
        setSearchResults([]);
        setSearchPagination({ page: 1, hasMore: false, nextPage: null });
      }
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, activeTab]);

  const loadMoreSearchResults = useCallback(async () => {
    const normalizedQuery = searchQuery.trim();
    if (normalizedQuery.length < 2 || !searchPagination.hasMore || isSearchLoadingMore) return;

    try {
      setIsSearchLoadingMore(true);
      const response = await api.get('/users/search', {
        params: {
          q: normalizedQuery,
          page: searchPagination.nextPage || searchPagination.page + 1,
          limit: DIRECTORY_PAGE_SIZE,
        },
      });
      const nextUsers = response.data.users || [];
      setSearchResults((prev) => {
        const existingIds = new Set(prev.map((user) => user._id));
        return [...prev, ...nextUsers.filter((user) => !existingIds.has(user._id))];
      });
      setSearchPagination(response.data.pagination || {
        page: searchPagination.page,
        hasMore: false,
        nextPage: null,
      });
    } catch (error) {
      console.error(error);
    } finally {
      setIsSearchLoadingMore(false);
    }
  }, [isSearchLoadingMore, searchPagination, searchQuery]);

  const handleAddFriend = async (userId) => {
    try {
      await api.post('/users/request', { recipientId: userId });
      setSearchResults((prev) =>
        prev.map((u) => (u._id === userId ? { ...u, status: 'sent' } : u)),
      );
      setDirectoryUsers((prev) =>
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
      setDirectoryUsers((prev) =>
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
        setSearchResults((prev) =>
          prev.map((u) => (u._id === requesterId ? { ...u, status: 'friend' } : u)),
        );
        setDirectoryUsers((prev) =>
          prev.map((u) => (u._id === requesterId ? { ...u, status: 'friend' } : u)),
        );
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
        setDirectoryUsers((prev) =>
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
      .filter((conv) =>
        `${conv.name || ''} ${conv.pingId || ''}`.toLowerCase().includes(normalizedQuery),
      );
  }, [activeTab, conversations, searchQuery]);
  const totalUnreadCount = useMemo(
    () => conversations.reduce((total, conversation) => total + (conversation.unreadCount || 0), 0),
    [conversations],
  );

  const friendOptions = useMemo(
    () => conversations.filter((conversation) => !conversation.isGroup && conversation.peerId),
    [conversations],
  );
  const filteredGroupFriends = useMemo(() => {
    const normalizedQuery = groupMemberQuery.trim().toLowerCase();
    if (!normalizedQuery) return friendOptions;
    return friendOptions.filter((friend) =>
      `${friend.name || ''} ${friend.pingId || ''}`.toLowerCase().includes(normalizedQuery),
    );
  }, [friendOptions, groupMemberQuery]);

  const directoryUserById = useMemo(() => {
    const map = new Map();
    directoryUsers.forEach((user) => map.set(user._id, user));
    searchResults.forEach((user) => map.set(user._id, user));
    return map;
  }, [directoryUsers, searchResults]);
  const suggestedUsers = useMemo(
    () =>
      directoryUsers
        .filter((user) => user.status === 'none' && (user.mutualFriendCount || 0) > 0)
        .sort((a, b) => (b.mutualFriendCount || 0) - (a.mutualFriendCount || 0)),
    [directoryUsers],
  );
  const sentRequestUsers = useMemo(
    () => directoryUsers.filter((user) => user.status === 'sent').slice(0, 6),
    [directoryUsers],
  );
  const receivedRequestUsers = useMemo(
    () => friendRequests.map((user) => ({ ...user, status: 'received' })),
    [friendRequests],
  );
  const discoverList = searchQuery.trim().length > 1 ? searchResults : suggestedUsers;
  const selectedConnectionUser =
    directoryUserById.get(selectedConnectionUserId) ||
    discoverList[0] ||
    receivedRequestUsers[0] ||
    null;
  const selectedConnectionPresenceText = getPresenceText(selectedConnectionUser, {
    onlineText: 'Đang hoạt động',
  });

  const getRelationshipText = (status) => {
    if (status === 'friend') return 'Đã là bạn';
    if (status === 'sent') return 'Đã gửi lời mời';
    if (status === 'received') return 'Đang chờ bạn phản hồi';
    return 'Người dùng PingMe';
  };

  const getMutualText = (user) => {
    const count = user?.mutualFriendCount || 0;
    if (count <= 0) return '';
    const names = (user.mutualFriends || []).map((friend) => friend.username).filter(Boolean);
    if (names.length === 0) return `${count} bạn chung`;
    if (count === 1) return `Bạn chung với ${names[0]}`;
    if (count <= names.length) return `Bạn chung với ${names.join(', ')}`;
    return `Bạn chung với ${names.join(', ')} và ${count - names.length} người khác`;
  };

  const renderLoadMoreButton = ({ visible, loading, onClick }) => {
    if (!visible) return null;
    return (
      <div className="px-5 py-4">
        <button
          type="button"
          onClick={onClick}
          disabled={loading}
          className="h-9 w-full rounded-[8px] border border-outline-variant bg-surface-container-lowest text-xs font-semibold text-on-surface transition-colors hover:bg-surface-container-low disabled:opacity-50"
        >
          {loading ? 'Äang táº£i...' : 'Táº£i thÃªm'}
        </button>
      </div>
    );
  };

  const renderConnectionActions = (user, compact = false) => {
    if (!user) return null;
    const buttonClass = compact
      ? 'h-8 rounded-[7px] px-3 text-[11px] font-medium'
      : 'h-10 rounded-[8px] px-4 text-[12px] font-semibold';

    if (user.status === 'friend') {
      return (
        <span
          className={`${buttonClass} inline-flex items-center justify-center border border-outline-variant text-on-surface-variant`}
        >
          Đã là bạn
        </span>
      );
    }

    if (user.status === 'sent') {
      return (
        <button
          type="button"
          onClick={() => handleCancelRequest(user._id)}
          className={`${buttonClass} border border-outline-variant text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-on-surface`}
        >
          Hủy lời mời
        </button>
      );
    }

    if (user.status === 'received') {
      return (
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => handleAccept(user._id)}
            className={`${buttonClass} border border-secondary/35 bg-surface-container-lowest text-secondary transition-colors hover:bg-secondary-container`}
          >
            Chấp nhận
          </button>
          <button
            type="button"
            onClick={() => handleReject(user._id)}
            className={`${buttonClass} border border-error/30 bg-surface-container-lowest text-error transition-colors hover:bg-error-container`}
          >
            Từ chối
          </button>
        </div>
      );
    }

    return (
      <button
        type="button"
        onClick={() => handleAddFriend(user._id)}
        className={`${buttonClass} bg-secondary text-white transition-colors hover:brightness-95`}
      >
        Kết nối
      </button>
    );
  };

  const renderDirectoryUserRow = (user) => {
    const presenceText = getPresenceText(user, { onlineText: 'Đang hoạt động' });
    const secondaryText =
      presenceText ||
      (user.status === 'none' && getMutualText(user)
        ? getMutualText(user)
        : getRelationshipText(user.status));

    return (
      <div
        key={user._id}
        className={`flex items-center gap-3 px-5 py-4 transition-colors ${
          selectedConnectionUserId === user._id
            ? 'bg-surface-container-high'
            : 'hover:bg-surface-container-low'
        }`}
      >
        <button
          type="button"
          onClick={() => setSelectedConnectionUserId(user._id)}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <Avatar src={user.avatar} name={user.username} online={user.isOnline} size="lg" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-on-surface">
              {user.username}
            </span>
            {user.pingId && (
              <span className="mt-0.5 block truncate text-[11px] text-secondary">@{user.pingId}</span>
            )}
            <span className="mt-0.5 block truncate text-xs text-on-surface-variant">
              {secondaryText}
            </span>
          </span>
        </button>
        {renderConnectionActions(user, true)}
      </div>
    );
  };

  const resetGroupComposer = () => {
    setGroupTitle('');
    setGroupMemberQuery('');
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
    setSearchQuery('');
    onOpenContacts?.();
    setActiveTab('discover');
  };

  const title = isDirectoryMode ? 'Kết nối' : viewMode === 'groups' ? 'Nhóm' : 'Tin nhắn';
  const shouldShowMessageBrand = viewMode === 'messages' && !isDirectoryMode && showMessageBrand;
  const subtitle = isDirectoryMode
    ? `${friendRequests.length} lời mời đang chờ`
    : `${filteredConversations.length} cuộc trò chuyện`;

  return (
    <aside
      className={`h-full w-full shrink-0 flex-col border-r border-outline-variant bg-surface ${
        isDirectoryMode ? 'md:w-full' : 'md:w-[356px]'
      } ${isChatOpen ? 'hidden md:flex' : 'flex'}`}
    >
      <div className="shrink-0 border-b border-outline-variant bg-surface px-4 pb-4 pt-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2 md:hidden">
            <PingMeLogo size="md" />
            <PingMeWordmark size="lg" className="-ml-1 hidden" />
          </div>

          <div className="hidden min-w-0 md:block">
            <div className="relative h-12 min-w-[190px]">
              <div
                className={`absolute left-0 top-1/2 -translate-y-1/2 transition-all duration-200 ease-out ${
                  shouldShowMessageBrand
                    ? 'opacity-100 translate-x-0 scale-100'
                    : 'pointer-events-none opacity-0 -translate-x-2 scale-95'
                }`}
              >
                <PingMeWordmark size="md" className="-ml-4" />
              </div>
              <h1
                className={`absolute left-0 top-1/2 -translate-y-1/2 truncate text-[22px] font-semibold text-on-surface transition-all duration-200 ease-out ${
                  shouldShowMessageBrand
                    ? 'pointer-events-none opacity-0 translate-x-2 scale-95'
                    : 'opacity-100 translate-x-0 scale-100'
                }`}
              >
                {title}
              </h1>
            </div>
            {isDirectoryMode && (
              <p className="mt-1 text-[11px] text-on-surface-variant">{subtitle}</p>
            )}
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
          <AppIcon
            name="search"
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[18px] text-on-surface-variant"
          />
          <input
            ref={searchInputRef}
            className="h-11 w-full rounded-[8px] border border-outline bg-surface-container-lowest pl-10 pr-4 text-[16px] text-on-surface outline-none transition-colors placeholder:text-on-surface-variant focus:border-accent focus:ring-1 focus:ring-accent md:text-[13px]"
            placeholder={
              activeTab === 'discover'
                ? 'Tìm toàn bộ hệ thống theo tên hoặc ID'
                : activeTab === 'search'
                  ? 'Tìm người theo tên hoặc ID'
                  : activeTab === 'requests'
                    ? 'Tìm kiếm lời mời'
                    : 'Tìm kiếm cuộc trò chuyện'
            }
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {isDirectoryMode ? (
          <div className="mt-4 grid grid-cols-3 gap-2">
            {[
              { key: 'search', label: 'Tìm bạn' },
              { key: 'discover', label: 'Kết nối mới', badge: suggestedUsers.length },
              { key: 'requests', label: 'Lời mời', badge: friendRequests.length },
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => {
                  setActiveTab(tab.key);
                  setSearchQuery('');
                }}
                className={`rounded-[6px] border px-4 py-2 text-[13px] font-medium transition-colors ${
                  activeTab === tab.key
                    ? 'border-secondary/25 bg-secondary-container text-secondary'
                    : 'border-transparent bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface'
                }`}
              >
                {tab.label}
                {tab.badge > 0 ? ` (${tab.badge})` : ''}
              </button>
            ))}
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-4 gap-1">
            {inboxTabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`relative flex h-8 items-center justify-center rounded-[6px] px-1 text-[13px] font-medium transition-colors ${
                  activeTab === tab.key
                    ? 'bg-secondary-container text-secondary'
                    : 'bg-transparent text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface'
                }`}
              >
                {tab.label}
                {tab.key === 'unread' && totalUnreadCount > 0 && (
                  <span className="ml-1.5 grid h-[17px] min-w-[17px] place-items-center rounded-full bg-error px-1 text-[9px] font-semibold text-white">
                    {totalUnreadCount > 99 ? '99+' : totalUnreadCount}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      <div
        className={`no-scrollbar flex-1 overflow-y-auto ${
          isDirectoryMode ? 'md:grid md:grid-cols-[minmax(0,680px)_1fr] md:overflow-hidden' : ''
        }`}
      >
        {activeTab === 'search' ? (
          <div className="no-scrollbar divide-y divide-outline-variant md:overflow-y-auto">
            {searchQuery.length < 2 ? (
              <div>
                {friendRequests.length > 0 && (
                  <section>
                    <div className="flex items-center justify-between px-5 pb-2 pt-5">
                      <h2 className="text-[11px] font-semibold uppercase text-on-surface-variant">
                        Lời mời nhận được ({friendRequests.length})
                      </h2>
                    </div>
                    {friendRequests.slice(0, 3).map((request) => (
                      <div
                        key={request._id}
                        className="flex items-center gap-3 border-b border-outline-variant px-5 py-3"
                      >
                        <Avatar
                          src={request.avatar}
                          name={request.username}
                          online={request.isOnline}
                          size="contact"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-semibold text-on-surface">
                            {request.username}
                          </span>
                          <span className="mt-1 block text-[11px] text-on-surface-variant">
                            Muốn kết nối với bạn
                          </span>
                        </span>
                        <button
                          type="button"
                          onClick={() => handleAccept(request._id)}
                          className="h-8 rounded-[7px] border border-secondary/35 bg-surface-container-lowest px-3 text-[11px] font-medium text-secondary transition-colors hover:bg-secondary-container"
                        >
                          Chấp nhận
                        </button>
                        <button
                          type="button"
                          onClick={() => handleReject(request._id)}
                          className="h-8 rounded-[7px] border border-error/25 px-3 text-[11px] font-medium text-error hover:bg-error-container"
                        >
                          Từ chối
                        </button>
                      </div>
                    ))}
                  </section>
                )}

                <section>
                  <div className="flex items-center justify-between px-5 pb-2 pt-5">
                    <h2 className="text-[11px] font-semibold uppercase text-on-surface-variant">
                      Bạn bè ({friendOptions.length})
                    </h2>
                    <span className="text-[10px] text-on-surface-variant">Tìm để kết nối thêm</span>
                  </div>
                  {friendOptions.length === 0 ? (
                    <p className="px-6 py-12 text-center text-sm text-on-surface-variant">
                      Nhập ít nhất 2 ký tự để tìm người dùng.
                    </p>
                  ) : (
                    friendOptions.map((friend) => {
                      const friendPresenceText = getPresenceText(friend, {
                        onlineText: 'Đang hoạt động',
                        fallbackText: 'Bắt đầu trò chuyện',
                        hiddenText: 'Bắt đầu trò chuyện',
                      });

                      return (
                        <button
                          key={friend.id}
                          type="button"
                          onClick={() => onSelectConversation(friend.id)}
                          className="flex w-full items-center gap-3 border-b border-outline-variant px-5 py-3 text-left hover:bg-surface-container-low"
                        >
                          <Avatar
                            src={friend.avatar}
                            name={friend.name}
                            online={friend.isOnline}
                            size="contact"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13px] font-semibold text-on-surface">
                              {friend.name}
                            </span>
                            {friend.pingId && (
                              <span className="mt-0.5 block truncate text-[11px] font-medium text-secondary">
                                @{friend.pingId}
                              </span>
                            )}
                            <span className="mt-1 block truncate text-[11px] text-on-surface-variant">
                              {friendPresenceText}
                            </span>
                          </span>
                          <span className="grid h-9 w-9 place-items-center rounded-[8px] border border-outline text-on-surface-variant">
                            <AppIcon name="chat_bubble" className="text-[16px]" />
                          </span>
                        </button>
                      );
                    })
                  )}
                </section>
              </div>
            ) : searchResults.length === 0 ? (
              <p className="px-6 py-12 text-center text-sm text-on-surface-variant">
                Không tìm thấy người dùng.
              </p>
            ) : (
              <>
                {searchResults.map((user) => renderDirectoryUserRow(user))}
                {renderLoadMoreButton({
                  visible: searchPagination.hasMore,
                  loading: isSearchLoadingMore,
                  onClick: loadMoreSearchResults,
                })}
              </>
            )}
          </div>
        ) : activeTab === 'discover' ? (
          <div className="no-scrollbar divide-y divide-outline-variant md:overflow-y-auto">
            {isDirectoryLoading ? (
              <ListSkeleton rows={4} action className="px-5 py-5" />
            ) : directoryError ? (
              <p className="px-6 py-12 text-center text-sm text-error">{directoryError}</p>
            ) : discoverList.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <AppIcon name="person_add" className="text-[28px] text-on-surface-variant" />
                <p className="mt-3 text-sm text-on-surface-variant">
                  {searchQuery.trim().length > 1
                    ? 'Không tìm thấy người dùng phù hợp.'
                    : 'Chưa có gợi ý từ bạn chung.'}
                </p>
              </div>
            ) : (
              <>
                <div className="px-5 pb-2 pt-5">
                  <h2 className="text-[11px] font-semibold uppercase text-on-surface-variant">
                    {searchQuery.trim().length > 1
                      ? `Kết quả (${discoverList.length})`
                      : `Người lạ có thể kết nối (${discoverList.length})`}
                  </h2>
                </div>
                {discoverList.map((user) => renderDirectoryUserRow(user))}
                {renderLoadMoreButton({
                  visible: searchQuery.trim().length > 1
                    ? searchPagination.hasMore
                    : directoryPagination.hasMore,
                  loading: searchQuery.trim().length > 1
                    ? isSearchLoadingMore
                    : isDirectoryLoadingMore,
                  onClick: searchQuery.trim().length > 1
                    ? loadMoreSearchResults
                    : loadMoreDirectoryUsers,
                })}
              </>
            )}
          </div>
        ) : activeTab === 'requests' ? (
          <div className="no-scrollbar divide-y divide-outline-variant md:overflow-y-auto">
            {friendRequests.length === 0 ? (
              <p className="px-6 py-12 text-center text-sm text-on-surface-variant">
                Không có lời mời kết bạn nào.
              </p>
            ) : (
              friendRequests.map((req) => (
                <div key={req._id} className="flex items-center gap-3 px-5 py-4">
                  <Avatar src={req.avatar} name={req.username} online={req.isOnline} size="lg" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-on-surface">{req.username}</p>
                    <p className="mt-0.5 text-xs text-on-surface-variant">Muốn kết nối với bạn</p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => handleAccept(req._id)}
                      className="rounded-lg border border-secondary/35 bg-surface-container-lowest px-3 py-2 text-xs font-medium text-secondary transition-colors hover:bg-secondary-container active:scale-[0.98]"
                    >
                      Chấp nhận
                    </button>
                    <button
                      type="button"
                      onClick={() => handleReject(req._id)}
                      className="rounded-lg border border-error/30 bg-surface-container-lowest px-3 py-2 text-xs font-medium text-error transition-colors hover:bg-error-container active:scale-[0.98]"
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
              <ListSkeleton rows={5} className="px-5 py-5" />
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
                    className={`group relative grid w-full grid-cols-[48px_minmax(0,1fr)_auto] gap-3 px-4 py-3 text-left transition-colors ${
                      isSelected ? 'bg-surface-container-high' : 'hover:bg-surface-container-low'
                    }`}
                  >
                    {isSelected && (
                      <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-secondary" />
                    )}
                    <Avatar src={conv.avatar} name={conv.name} online={conv.isOnline} size="lg" />

                    <div className="min-w-0 self-center">
                      <p
                        className={`truncate text-[15px] tracking-tight ${conv.unreadCount > 0 ? 'font-medium text-on-surface' : 'text-on-surface'}`}
                      >
                        {conv.name}
                      </p>
                      <p
                        className={`mt-0.5 truncate text-[14px] ${
                          conv.unreadCount > 0
                            ? 'font-medium text-on-surface'
                            : 'text-on-surface-variant group-hover:text-on-surface'
                        }`}
                      >
                        {conv.lastMessage || 'Bắt đầu trò chuyện'}
                      </p>
                    </div>

                    <div className="flex min-w-[44px] flex-col items-end gap-1.5 self-center">
                      <span className="flex items-center gap-1 text-[12px] text-on-surface-variant">
                        {conv.notificationsMuted && (
                          <AppIcon name="notifications_off" className="text-[13px]" />
                        )}
                        <span>{formatConversationTime(conv.lastMessageAt)}</span>
                      </span>
                      {conv.unreadCount > 0 ? (
                        <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-error px-1.5 text-[11px] font-semibold text-white">
                          {conv.unreadCount}
                        </span>
                      ) : (
                        <span className="h-5 text-[13px] text-on-surface-variant">
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

        {isDirectoryMode && (
          <section className="hidden min-w-0 flex-col border-l border-outline-variant bg-surface-container-low md:flex">
            <div className="border-b border-outline-variant px-6 py-5">
              <p className="text-[11px] font-semibold uppercase text-on-surface-variant">
                Kết nối mới
              </p>
              <h2 className="mt-1 text-[20px] font-semibold text-on-surface">Mở rộng kết nối</h2>
              <p className="mt-2 max-w-[460px] text-[12px] leading-5 text-on-surface-variant">
                Gợi ý những người là bạn của bạn bè bạn, theo dõi lời mời đang chờ và phản hồi kết
                nối mới ngay tại đây.
              </p>
              <div className="mt-5 grid grid-cols-3 gap-2">
                {[
                  { label: 'Bạn bè', value: friendOptions.length },
                  { label: 'Gợi ý', value: suggestedUsers.length },
                  { label: 'Lời mời', value: friendRequests.length },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-[10px] border border-outline-variant bg-surface px-3 py-3"
                  >
                    <p className="text-[18px] font-semibold text-on-surface">{item.value}</p>
                    <p className="mt-1 text-[10px] text-on-surface-variant">{item.label}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="no-scrollbar flex-1 overflow-y-auto px-6 py-5">
              {selectedConnectionUser ? (
                <article className="rounded-[14px] border border-outline-variant bg-surface px-5 py-5">
                  <div className="flex items-start gap-4">
                    <Avatar
                      src={selectedConnectionUser.avatar}
                      name={selectedConnectionUser.username}
                      online={selectedConnectionUser.isOnline}
                      size="xl"
                    />
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-[18px] font-semibold text-on-surface">
                        {selectedConnectionUser.username}
                      </h3>
                      {selectedConnectionUser.pingId && (
                        <p className="mt-0.5 text-[12px] font-medium text-secondary">
                          @{selectedConnectionUser.pingId}
                        </p>
                      )}
                      {selectedConnectionPresenceText && (
                        <p className="mt-1 text-[12px] text-on-surface-variant">
                          {selectedConnectionPresenceText}
                        </p>
                      )}
                      <p className="mt-1 text-[12px] text-on-surface-variant">
                        {selectedConnectionUser.status === 'none' &&
                        getMutualText(selectedConnectionUser)
                          ? getMutualText(selectedConnectionUser)
                          : getRelationshipText(selectedConnectionUser.status)}
                      </p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {renderConnectionActions(selectedConnectionUser)}
                      </div>
                    </div>
                  </div>
                </article>
              ) : (
                <div className="rounded-[14px] border border-outline-variant bg-surface px-5 py-8 text-center">
                  <AppIcon name="person_add" className="text-[30px] text-on-surface-variant" />
                  <p className="mt-3 text-sm text-on-surface-variant">
                    Chưa có người dùng để gợi ý.
                  </p>
                </div>
              )}

              {receivedRequestUsers.length > 0 && (
                <section className="mt-5">
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-[11px] font-semibold uppercase text-on-surface-variant">
                      Lời mời cần phản hồi
                    </h3>
                    <span className="text-[10px] text-on-surface-variant">
                      {receivedRequestUsers.length}
                    </span>
                  </div>
                  <div className="overflow-hidden rounded-[12px] border border-outline-variant bg-surface">
                    {receivedRequestUsers.slice(0, 4).map((user) => (
                      <div
                        key={user._id}
                        className="flex items-center gap-3 border-b border-outline-variant px-3 py-3 last:border-b-0"
                      >
                        <button
                          type="button"
                          onClick={() => setSelectedConnectionUserId(user._id)}
                          className="flex min-w-0 flex-1 items-center gap-3 text-left"
                        >
                          <Avatar
                            src={user.avatar}
                            name={user.username}
                            online={user.isOnline}
                            size="md"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13px] font-semibold text-on-surface">
                              {user.username}
                            </span>
                            <span className="mt-0.5 block text-[11px] text-on-surface-variant">
                              Muốn kết nối với bạn
                            </span>
                          </span>
                        </button>
                        {renderConnectionActions(user, true)}
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {sentRequestUsers.length > 0 && (
                <section className="mt-5">
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-[11px] font-semibold uppercase text-on-surface-variant">
                      Đã gửi lời mời
                    </h3>
                    <span className="text-[10px] text-on-surface-variant">
                      {sentRequestUsers.length}
                    </span>
                  </div>
                  <div className="overflow-hidden rounded-[12px] border border-outline-variant bg-surface">
                    {sentRequestUsers.map((user) => (
                      <div
                        key={user._id}
                        className="flex items-center gap-3 border-b border-outline-variant px-3 py-3 last:border-b-0"
                      >
                        <button
                          type="button"
                          onClick={() => setSelectedConnectionUserId(user._id)}
                          className="flex min-w-0 flex-1 items-center gap-3 text-left"
                        >
                          <Avatar
                            src={user.avatar}
                            name={user.username}
                            online={user.isOnline}
                            size="md"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13px] font-semibold text-on-surface">
                              {user.username}
                            </span>
                            <span className="mt-0.5 block text-[11px] text-on-surface-variant">
                              Đang chờ phản hồi
                            </span>
                          </span>
                        </button>
                        {renderConnectionActions(user, true)}
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>
          </section>
        )}
      </div>

      {isGroupComposerOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end bg-[#1f1d1a]/45 md:items-center md:justify-center"
          onClick={closeGroupComposer}
        >
          <form
            onSubmit={handleCreateGroup}
            className="flex h-full w-full flex-col bg-surface-container-lowest md:h-auto md:max-h-[760px] md:max-w-[480px] md:rounded-[16px] md:border md:border-outline md:quiet-shadow"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex h-[64px] shrink-0 items-center gap-3 border-b border-outline-variant px-4 md:h-auto md:border-b-0 md:px-5 md:pt-5">
              <button
                type="button"
                onClick={closeGroupComposer}
                className="grid h-10 w-10 place-items-center rounded-[8px] text-on-surface-variant hover:bg-surface-container-low md:hidden"
                aria-label="Quay lại"
              >
                <AppIcon name="arrow_back" className="text-[21px]" />
              </button>
              <div className="min-w-0 flex-1 text-center md:text-left">
                <h2 className="text-[18px] font-semibold text-on-surface">Tạo nhóm</h2>
                <p className="mt-1 hidden text-[12px] text-on-surface-variant md:block">
                  Chọn bạn bè để bắt đầu cuộc trò chuyện nhóm.
                </p>
              </div>
              <button
                type="button"
                onClick={closeGroupComposer}
                className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-on-surface md:flex"
                title="Đóng"
              >
                <AppIcon name="close" className="text-[22px]" />
              </button>
            </div>

            <div className="no-scrollbar flex-1 overflow-y-auto px-4 py-5 md:px-5">
              <label className="mb-4 block">
                <span className="mb-2 flex items-center justify-between text-[11px] font-medium text-on-surface">
                  Tên nhóm
                  <span className="font-normal text-on-surface-variant">
                    {groupTitle.length}/80
                  </span>
                </span>
                <input
                  value={groupTitle}
                  onChange={(event) => setGroupTitle(event.target.value)}
                  maxLength={80}
                  className="h-11 w-full rounded-lg border border-outline-variant bg-surface px-3 text-sm text-on-surface outline-none transition-colors placeholder:text-on-surface-variant focus:border-accent"
                  placeholder="Ví dụ: Team Marketing"
                />
                <span className="mt-2 block text-[10px] text-on-surface-variant">
                  Tên nhóm giúp mọi người dễ nhận biết.
                </span>
              </label>

              <div className="mb-4">
                <label className="relative mb-4 block">
                  <AppIcon
                    name="search"
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-[17px] text-on-surface-variant"
                  />
                  <input
                    value={groupMemberQuery}
                    onChange={(event) => setGroupMemberQuery(event.target.value)}
                    className="h-11 w-full rounded-[8px] border border-outline bg-surface pl-10 pr-3 text-[13px] outline-none placeholder:text-on-surface-variant focus:border-secondary"
                    placeholder="Tìm bạn bè để thêm"
                  />
                </label>

                {selectedGroupMemberIds.length > 0 && (
                  <div className="mb-5">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-[11px] font-medium text-on-surface">
                        Thành viên đã chọn ({selectedGroupMemberIds.length})
                      </span>
                      <button
                        type="button"
                        onClick={() => setSelectedGroupMemberIds([])}
                        className="text-[11px] font-medium text-secondary"
                      >
                        Xóa tất cả
                      </button>
                    </div>
                    <div className="no-scrollbar flex gap-4 overflow-x-auto pb-1">
                      {friendOptions
                        .filter((friend) => selectedGroupMemberIds.includes(friend.peerId))
                        .map((friend) => (
                          <button
                            key={friend.peerId}
                            type="button"
                            onClick={() => toggleGroupMember(friend.peerId)}
                            className="relative w-14 shrink-0 text-center"
                          >
                            <Avatar
                              src={friend.avatar}
                              name={friend.name}
                              online={friend.isOnline}
                              size="lg"
                              className="mx-auto block"
                            />
                            <span className="absolute right-0 top-0 grid h-5 w-5 place-items-center rounded-full border border-outline bg-surface text-on-surface">
                              <AppIcon name="close" className="text-[11px]" />
                            </span>
                            <span className="mt-1.5 block truncate text-[10px] text-on-surface">
                              {friend.name}
                            </span>
                          </button>
                        ))}
                    </div>
                  </div>
                )}

                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[11px] font-medium text-on-surface">Danh sách bạn bè</span>
                  <span className="text-[10px] text-on-surface-variant">
                    {selectedGroupMemberIds.length}/200 đã chọn
                  </span>
                </div>

                <div className="max-h-[340px] flex-1 overflow-y-auto border-y border-outline-variant bg-surface">
                  {filteredGroupFriends.length === 0 ? (
                    <div className="px-4 py-8 text-center text-sm text-on-surface-variant">
                      Không tìm thấy bạn bè phù hợp.
                    </div>
                  ) : (
                    filteredGroupFriends.map((friend) => {
                      const isSelected = selectedGroupMemberIds.includes(friend.peerId);
                      const friendPresenceText = getPresenceText(friend, {
                        fallbackText: 'Bắt đầu trò chuyện',
                        hiddenText: 'Bắt đầu trò chuyện',
                      });

                      return (
                        <button
                          key={friend.peerId}
                          type="button"
                          onClick={() => toggleGroupMember(friend.peerId)}
                          className="flex w-full items-center gap-3 border-b border-outline-variant px-3 py-3 text-left transition-colors last:border-b-0 hover:bg-surface-container-low"
                        >
                          <Avatar
                            src={friend.avatar}
                            name={friend.name}
                            online={friend.isOnline}
                            size="md"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold text-on-surface">
                              {friend.name}
                            </span>
                            <span className="mt-0.5 block truncate text-xs text-on-surface-variant">
                              {friendPresenceText}
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
            </div>

            <div className="flex shrink-0 gap-2 border-t border-outline-variant bg-surface-container-lowest p-4 md:px-5">
              <button
                type="button"
                onClick={closeGroupComposer}
                className="h-11 flex-1 rounded-lg border border-outline-variant text-sm font-medium text-on-surface transition-colors hover:bg-surface-container-low"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={
                  isCreatingGroup || !groupTitle.trim() || selectedGroupMemberIds.length === 0
                }
                className="h-11 flex-1 rounded-lg bg-primary text-sm font-semibold text-white transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-55"
              >
                {isCreatingGroup ? 'Đang tạo...' : 'Tạo nhóm'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid h-[68px] grid-cols-4 border-t border-outline-variant bg-surface md:hidden">
        {[
          {
            icon: 'chat_bubble',
            label: 'Tin nhắn',
            active: viewMode === 'messages',
            onClick: onOpenMessages,
          },
          {
            icon: 'person',
            label: 'Kết nối',
            active: viewMode === 'contacts',
            onClick: onOpenContacts,
            badge: friendRequests.length,
          },
          { icon: 'groups', label: 'Nhóm', active: viewMode === 'groups', onClick: onOpenGroups },
          { icon: 'settings', label: 'Cài đặt', onClick: onOpenSettings },
        ].map((item) => (
          <button
            key={item.label}
            type="button"
            onClick={item.onClick}
            className={`relative flex flex-col items-center justify-center gap-1 text-[10px] ${
              item.active ? 'text-secondary' : 'text-on-surface-variant'
            }`}
          >
            {item.active && <span className="absolute top-0 h-0.5 w-8 rounded-full bg-secondary" />}
            <span className="relative grid h-6 w-6 place-items-center">
              <AppIcon name={item.icon} className="text-[21px]" />
              {item.badge > 0 && (
                <span className="absolute -right-2 -top-1 grid h-[17px] min-w-[17px] place-items-center rounded-full bg-error px-1 text-[9px] font-semibold text-white ring-2 ring-surface">
                  {item.badge > 99 ? '99+' : item.badge}
                </span>
              )}
            </span>
            <span>{item.label}</span>
          </button>
        ))}
      </div>
    </aside>
  );
};

export default Sidebar;
