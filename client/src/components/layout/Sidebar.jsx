import { useState, useEffect } from 'react';
import api from '../../config/api';

const Sidebar = ({
  conversations = [],
  onSelectConversation,
  selectedConversationId,
  onFriendAdded,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('chats');
  const [friendRequests, setFriendRequests] = useState([]);
  const [searchResults, setSearchResults] = useState([]);

  useEffect(() => {
    if (activeTab === 'requests') {
      const fetchRequests = async () => {
        try {
          const response = await api.get('/users/requests');
          setFriendRequests(response.data.requests || []);
        } catch (error) {
          console.error('Lỗi lấy lời mời:', error);
        }
      };
      fetchRequests();
    }
  }, [activeTab]);

  const handleAccept = async (requesterId) => {
    try {
      const response = await api.post('/users/accept', { requesterId });
      if (response.data.success) {
        setFriendRequests((prev) => prev.filter((r) => r._id !== requesterId));
        if (onFriendAdded) onFriendAdded();
      }
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (activeTab === 'search' && searchQuery.trim().length > 1) {
        try {
          const res = await api.get(`/users/search?q=${searchQuery}`);
          setSearchResults(res.data.users || []);
        } catch (err) {
          console.error(err);
        }
      }
    }, 500);
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

  const filteredConversations = conversations.filter((conv) =>
    conv.name?.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <aside className="w-80 flex flex-col h-full bg-surface border-r border-white/[0.06] shrink-0">
      {/* Header */}
      <div className="px-5 pt-5 pb-4 border-b border-white/[0.06]">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-lg font-headline font-bold text-on-surface tracking-tight">Tin nhắn</h1>
          <button
            onClick={() => {
              setActiveTab('search');
              setSearchQuery('');
            }}
            className="w-8 h-8 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary flex items-center justify-center transition-colors"
            title="Tìm bạn mới"
          >
            <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>add</span>
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-lg">
            search
          </span>
          <input
            className="w-full bg-surface-container-low rounded-xl py-2.5 pl-10 pr-4 text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-1 focus:ring-primary/40 transition-all"
            placeholder={activeTab === 'search' ? 'Tìm người dùng...' : 'Tìm cuộc trò chuyện...'}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-3">
          {[
            { key: 'chats', label: 'Tất cả' },
            { key: 'requests', label: 'Lời mời', badge: friendRequests.length },
          ].map(({ key, label, badge }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`relative flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === key
                  ? 'bg-primary/10 text-primary-light'
                  : 'text-on-surface-variant hover:bg-white/[0.04]'
              }`}
            >
              <span className="flex items-center justify-center gap-1.5">
                {label}
                {badge > 0 && (
                  <span className="min-w-[18px] h-[18px] rounded-full bg-primary text-[10px] text-white flex items-center justify-center font-bold px-1">
                    {badge}
                  </span>
                )}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto no-scrollbar">
        {activeTab === 'search' ? (
          <div className="px-3 pt-3 space-y-1">
            {searchQuery.length < 2 ? (
              <p className="text-center text-on-surface-variant/60 text-xs py-10 font-label">
                Nhập ít nhất 2 ký tự để tìm kiếm
              </p>
            ) : searchResults.length === 0 ? (
              <p className="text-center text-on-surface-variant/60 text-xs py-10 font-label">
                Không tìm thấy người dùng
              </p>
            ) : (
              searchResults.map((u) => (
                <div
                  key={u._id}
                  className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/[0.04] transition-colors cursor-pointer group"
                >
                  <div className="relative w-10 h-10 shrink-0">
                    <img
                      src={u.avatar}
                      className="w-full h-full rounded-full object-cover border border-white/10"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-headline font-semibold text-sm text-on-surface truncate">
                      {u.username}
                    </p>
                    <p className="text-[11px] text-on-surface-variant truncate">
                      {u.status === 'friend'
                        ? 'Đã là bạn'
                        : u.status === 'sent'
                          ? 'Đã gửi lời mời'
                          : 'Người dùng'}
                    </p>
                  </div>
                  {u.status === 'none' && (
                    <button
                      onClick={() => handleAddFriend(u._id)}
                      className="shrink-0 px-3 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-xs font-headline font-semibold transition-colors"
                    >
                      Kết nối
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        ) : activeTab === 'requests' ? (
          <div className="px-3 pt-3 space-y-1">
            {friendRequests.length === 0 ? (
              <div className="flex flex-col items-center py-12 gap-3 opacity-50">
                <span className="material-symbols-outlined text-4xl text-on-surface-variant">person_add</span>
                <p className="text-xs text-on-surface-variant font-label text-center px-4">
                  Không có lời mời kết bạn nào
                </p>
              </div>
            ) : (
              friendRequests.map((req) => (
                <div
                  key={req._id}
                  className="p-4 rounded-xl bg-surface-container-low border border-white/[0.06] flex flex-col gap-3"
                >
                  <div className="flex items-center gap-3">
                    <img
                      src={req.avatar}
                      className="w-10 h-10 rounded-full object-cover border border-white/10"
                    />
                    <p className="flex-1 font-headline font-semibold text-sm text-on-surface truncate">
                      {req.username}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleAccept(req._id)}
                      className="flex-1 py-2 rounded-lg bg-secondary/15 hover:bg-secondary/25 text-secondary text-xs font-headline font-semibold transition-colors"
                    >
                      Chấp nhận
                    </button>
                    <button className="flex-1 py-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.07] text-on-surface-variant text-xs font-headline font-semibold transition-colors">
                      Từ chối
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="px-3 pt-3 space-y-1">
            {filteredConversations.length === 0 ? (
              <div className="flex flex-col items-center py-12 gap-3 opacity-50">
                <span className="material-symbols-outlined text-4xl text-on-surface-variant">chat_bubble</span>
                <p className="text-xs text-on-surface-variant font-label text-center px-4">
                  {searchQuery ? 'Không tìm thấy cuộc trò chuyện' : 'Chưa có cuộc trò chuyện nào'}
                </p>
              </div>
            ) : (
              filteredConversations.map((conv) => (
                <div
                  key={conv.id}
                  onClick={() => onSelectConversation(conv.id)}
                  className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all group ${
                    selectedConversationId === conv.id
                      ? 'bg-primary/10 border border-primary/20'
                      : 'hover:bg-white/[0.04] border border-transparent'
                  }`}
                >
                  {/* Avatar */}
                  <div className="relative w-11 h-11 shrink-0">
                    <img
                      alt="Avatar"
                      className={`w-full h-full rounded-full object-cover border-2 ${
                        selectedConversationId === conv.id
                          ? 'border-primary/60'
                          : 'border-white/10 group-hover:border-white/20'
                      }`}
                      src={conv.avatar}
                    />
                    {conv.isOnline ? (
                      <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-secondary border-2 border-surface" />
                    ) : null}
                    {conv.unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-primary text-[10px] text-white flex items-center justify-center font-bold px-1 shadow-lg">
                        {conv.unreadCount}
                      </span>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span
                        className={`text-sm font-semibold truncate ${
                          selectedConversationId === conv.id
                            ? 'text-primary-light font-bold'
                            : 'text-on-surface'
                        }`}
                      >
                        {conv.name}
                      </span>
                      <span className="text-[10px] text-on-surface-variant/70 shrink-0 ml-2">
                        12:45
                      </span>
                    </div>
                    <p
                      className={`text-xs truncate ${
                        conv.unreadCount > 0
                          ? 'text-on-surface font-medium'
                          : 'text-on-surface-variant'
                      }`}
                    >
                      {conv.lastMessage || 'Bắt đầu trò chuyện'}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;
