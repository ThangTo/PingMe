import { useState } from 'react';
import Avatar from '../ui/Avatar';
import SearchBar from '../ui/SearchBar';
import { useAuth } from '../../context/AuthContext';

/**
 * Sidebar Component - Danh sách conversations (giống Messenger)
 */
const Sidebar = ({ conversations = [], onSelectConversation, selectedConversationId }) => {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');

  // Filter conversations theo search query
  const filteredConversations = conversations.filter((conv) =>
    conv.name?.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div className="w-80 bg-slate-800 border-r border-slate-700 flex flex-col h-full">
      {/* Header với user info */}
      <div className="p-4 border-b border-slate-700 flex items-center gap-3">
        <Avatar src={user?.avatar} size="md" online={true} />
        <div className="flex-1 min-w-0">
          <h3 className="text-white font-semibold truncate">{user?.username || 'User'}</h3>
          <p className="text-xs text-slate-400">Đang hoạt động</p>
        </div>
      </div>

      {/* Search bar */}
      <div className="p-3 border-b border-slate-700">
        <SearchBar
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Tìm kiếm cuộc trò chuyện..."
        />
      </div>

      {/* Conversations list */}
      <div className="flex-1 overflow-y-auto">
        {filteredConversations.length === 0 ? (
          <div className="p-4 text-center text-slate-400 text-sm">
            {searchQuery ? 'Không tìm thấy cuộc trò chuyện' : 'Chưa có cuộc trò chuyện nào'}
          </div>
        ) : (
          filteredConversations.map((conversation) => (
            <div
              key={conversation.id}
              onClick={() => onSelectConversation?.(conversation.id)}
              className={`p-3 flex items-center gap-3 cursor-pointer hover:bg-slate-700 transition-colors ${
                selectedConversationId === conversation.id ? 'bg-slate-700 border-l-2 border-primary' : ''
              }`}
            >
              <Avatar src={conversation.avatar} size="md" online={conversation.isOnline} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h4 className="text-white font-medium truncate">{conversation.name}</h4>
                  {conversation.unreadCount > 0 && (
                    <span className="bg-primary text-white text-xs px-2 py-0.5 rounded-full">
                      {conversation.unreadCount}
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-400 truncate">{conversation.lastMessage}</p>
                <p className="text-xs text-slate-500 mt-0.5">{conversation.lastMessageTime}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Sidebar;

