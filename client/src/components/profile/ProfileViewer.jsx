import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../../config/api';
import { useAuth } from '../../context/AuthContext';
import { getPresenceText } from '../../utils/presence';
import { withRedirectParam } from '../../utils/authRedirect';
import AppIcon from '../ui/AppIcon';
import Avatar from '../ui/Avatar';

const OPEN_CONVERSATION_EVENT = 'pingme:open-conversation';

const normalizeProfile = (profile = {}) => {
  if (!profile) return null;
  const id = profile.id || profile._id || '';
  if (!id && !profile.pingId) return null;

  return {
    id,
    username: profile.username || profile.name || 'Người dùng PingMe',
    pingId: profile.pingId || '',
    avatar: profile.avatar || '',
    bio: profile.bio || '',
    isOnline: Boolean(profile.isOnline),
    lastSeen: profile.lastSeen || null,
    canViewPresence: profile.canViewPresence ?? true,
    relationshipStatus: profile.relationshipStatus || profile.status || 'none',
    mutualFriendCount: profile.mutualFriendCount || 0,
    mutualFriends: profile.mutualFriends || [],
  };
};

const getRelationshipLabel = (status) => {
  if (status === 'self') return 'Đây là hồ sơ của bạn';
  if (status === 'friend') return 'Đã là bạn bè';
  if (status === 'sent') return 'Đã gửi lời mời';
  if (status === 'received') return 'Đang chờ bạn phản hồi';
  if (status === 'anonymous') return 'Hồ sơ công khai';
  return 'Người dùng PingMe';
};

const getMutualText = (profile) => {
  const count = profile?.mutualFriendCount || 0;
  if (count <= 0) return '';
  const names = (profile.mutualFriends || []).map((friend) => friend.username).filter(Boolean);
  if (names.length === 0) return `${count} bạn chung`;
  if (count === 1) return `Bạn chung với ${names[0]}`;
  if (count <= names.length) return `Bạn chung với ${names.join(', ')}`;
  return `Bạn chung với ${names.join(', ')} và ${count - names.length} người khác`;
};

function ProfileViewer({
  pingId,
  userId,
  initialProfile = null,
  onClose,
  onRelationshipChange,
  onFriendAdded,
  compact = false,
  className = '',
}) {
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [profile, setProfile] = useState(() => normalizeProfile(initialProfile));
  const [isLoading, setIsLoading] = useState(Boolean(pingId));
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionLoading, setActionLoading] = useState('');

  const targetPingId = useMemo(
    () => (pingId || initialProfile?.pingId || '').replace(/^@+/, '').toLowerCase(),
    [initialProfile?.pingId, pingId],
  );
  const targetUserId = userId || initialProfile?.id || initialProfile?._id || '';

  const redirectPath = `${location.pathname}${location.search || ''}`;

  useEffect(() => {
    setProfile(normalizeProfile(initialProfile));
  }, [initialProfile]);

  useEffect(() => {
    if (!targetPingId && !targetUserId) {
      setIsLoading(false);
      return undefined;
    }

    let ignore = false;
    const fetchProfile = async () => {
      try {
        setIsLoading(true);
        setError('');
        const endpoint = targetPingId
          ? `/users/public/${encodeURIComponent(targetPingId)}`
          : `/users/public/id/${encodeURIComponent(targetUserId)}`;
        const response = await api.get(endpoint);
        if (ignore) return;
        setProfile(normalizeProfile(response.data.profile));
      } catch (requestError) {
        if (ignore) return;
        setError(requestError.response?.data?.error || 'Không thể tải hồ sơ.');
      } finally {
        if (!ignore) setIsLoading(false);
      }
    };

    fetchProfile();
    return () => {
      ignore = true;
    };
  }, [targetPingId, targetUserId]);

  const updateRelationship = (nextStatus) => {
    setProfile((current) => {
      const nextProfile = { ...(current || profile), relationshipStatus: nextStatus };
      onRelationshipChange?.(nextProfile, nextStatus);
      return nextProfile;
    });
  };

  const runProfileAction = async (key, action) => {
    if (!profile?.id) return;
    try {
      setActionLoading(key);
      setActionError('');
      await action();
    } catch (requestError) {
      setActionError(requestError.response?.data?.error || requestError.message || 'Không thể thực hiện thao tác.');
    } finally {
      setActionLoading('');
    }
  };

  const handleAddFriend = () =>
    runProfileAction('add', async () => {
      await api.post('/users/request', { recipientId: profile.id });
      updateRelationship('sent');
    });

  const handleCancelRequest = () =>
    runProfileAction('cancel', async () => {
      await api.post('/users/cancel-request', { recipientId: profile.id });
      updateRelationship('none');
    });

  const handleAccept = () =>
    runProfileAction('accept', async () => {
      await api.post('/users/accept', { requesterId: profile.id });
      updateRelationship('friend');
      onFriendAdded?.(profile);
    });

  const handleReject = () =>
    runProfileAction('reject', async () => {
      await api.post('/users/reject', { requesterId: profile.id });
      updateRelationship('none');
    });

  const handleMessage = () =>
    runProfileAction('message', async () => {
      const response = await api.get(`/messages/${encodeURIComponent(profile.id)}`);
      const conversationId = response.data.conversationId;
      if (!conversationId) throw new Error('Không tìm thấy cuộc trò chuyện.');

      window.dispatchEvent(
        new CustomEvent(OPEN_CONVERSATION_EVENT, {
          detail: { conversationId, conversation: response.data.conversation || null },
        }),
      );
      navigate(`/chat?conversationId=${encodeURIComponent(conversationId)}`);
      onClose?.();
    });

  const renderActions = () => {
    if (isAuthLoading) return null;

    if (!isAuthenticated || profile?.relationshipStatus === 'anonymous') {
      return (
        <div className="grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => navigate(withRedirectParam('/login', redirectPath))}
            className="flex h-10 items-center justify-center gap-2 rounded-[8px] bg-secondary px-4 text-[12px] font-semibold text-white hover:brightness-95"
          >
            <AppIcon name="login" className="text-[15px]" />
            Đăng nhập để kết nối
          </button>
          <button
            type="button"
            onClick={() => navigate(withRedirectParam('/register', redirectPath))}
            className="flex h-10 items-center justify-center gap-2 rounded-[8px] border border-outline bg-surface px-4 text-[12px] font-semibold text-on-surface hover:bg-surface-container-low"
          >
            <AppIcon name="person_add" className="text-[15px]" />
            Tạo tài khoản
          </button>
        </div>
      );
    }

    if (profile?.relationshipStatus === 'self') {
      return (
        <button
          type="button"
          onClick={() => navigate('/chat?panel=settings')}
          className="flex h-10 items-center justify-center gap-2 rounded-[8px] border border-outline bg-surface px-4 text-[12px] font-semibold text-on-surface hover:bg-surface-container-low"
        >
          <AppIcon name="settings" className="text-[15px]" />
          Mở cài đặt hồ sơ
        </button>
      );
    }

    if (profile?.relationshipStatus === 'friend') {
      return (
        <button
          type="button"
          onClick={handleMessage}
          disabled={actionLoading === 'message'}
          className="flex h-10 items-center justify-center gap-2 rounded-[8px] bg-secondary px-4 text-[12px] font-semibold text-white hover:brightness-95 disabled:opacity-60"
        >
          <AppIcon name="chat_bubble" className="text-[15px]" />
          {actionLoading === 'message' ? 'Đang mở...' : 'Nhắn tin'}
        </button>
      );
    }

    if (profile?.relationshipStatus === 'sent') {
      return (
        <button
          type="button"
          onClick={handleCancelRequest}
          disabled={actionLoading === 'cancel'}
          className="flex h-10 items-center justify-center rounded-[8px] border border-outline bg-surface px-4 text-[12px] font-semibold text-on-surface-variant hover:bg-surface-container-low disabled:opacity-60"
        >
          {actionLoading === 'cancel' ? 'Đang hủy...' : 'Hủy lời mời'}
        </button>
      );
    }

    if (profile?.relationshipStatus === 'received') {
      return (
        <div className="grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={handleAccept}
            disabled={actionLoading === 'accept'}
            className="h-10 rounded-[8px] border border-secondary/35 bg-secondary-container px-4 text-[12px] font-semibold text-secondary hover:bg-secondary-container/80 disabled:opacity-60"
          >
            {actionLoading === 'accept' ? 'Đang nhận...' : 'Chấp nhận'}
          </button>
          <button
            type="button"
            onClick={handleReject}
            disabled={actionLoading === 'reject'}
            className="h-10 rounded-[8px] border border-error/30 bg-surface px-4 text-[12px] font-semibold text-error hover:bg-error-container disabled:opacity-60"
          >
            {actionLoading === 'reject' ? 'Đang từ chối...' : 'Từ chối'}
          </button>
        </div>
      );
    }

    return (
      <button
        type="button"
        onClick={handleAddFriend}
        disabled={actionLoading === 'add'}
        className="flex h-10 items-center justify-center gap-2 rounded-[8px] bg-secondary px-4 text-[12px] font-semibold text-white hover:brightness-95 disabled:opacity-60"
      >
        <AppIcon name="person_add" className="text-[15px]" />
        {actionLoading === 'add' ? 'Đang gửi...' : 'Kết nối'}
      </button>
    );
  };

  if (isLoading && !profile) {
    return (
      <div className={`animate-pulse rounded-[10px] border border-outline-variant bg-surface px-5 py-6 ${className}`}>
        <div className="h-16 w-16 rounded-full bg-surface-container-high" />
        <div className="mt-5 h-4 w-40 rounded bg-surface-container-high" />
        <div className="mt-3 h-3 w-28 rounded bg-surface-container-high" />
        <div className="mt-6 h-10 rounded bg-surface-container-high" />
      </div>
    );
  }

  if (error && !profile) {
    return (
      <div className={`rounded-[10px] border border-error/25 bg-error-container px-5 py-6 text-center text-error ${className}`}>
        <AppIcon name="sync_problem" className="text-[24px]" />
        <p className="mt-3 text-sm">{error}</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className={`rounded-[10px] border border-outline-variant bg-surface px-5 py-8 text-center ${className}`}>
        <AppIcon name="person" className="text-[28px] text-on-surface-variant" />
        <p className="mt-3 text-sm text-on-surface-variant">Chọn một người để xem hồ sơ.</p>
      </div>
    );
  }

  const presenceText = getPresenceText(profile, {
    onlineText: 'Đang hoạt động',
    hiddenText: '',
    fallbackText: '',
  });
  const mutualText = getMutualText(profile);

  return (
    <article className={`min-w-0 rounded-[10px] border border-outline-variant bg-surface px-5 py-5 ${className}`}>
      <div className="flex items-start gap-4">
        <Avatar src={profile.avatar} name={profile.username} online={profile.isOnline} size="xl" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <h2 className={`${compact ? 'text-[17px]' : 'text-[20px]'} truncate font-semibold text-on-surface`}>
                {profile.username}
              </h2>
              {profile.pingId && (
                <p className="mt-0.5 truncate text-[12px] font-medium text-secondary">@{profile.pingId}</p>
              )}
            </div>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-[8px] text-on-surface-variant hover:bg-surface-container-low"
                aria-label="Đóng hồ sơ"
              >
                <AppIcon name="close" className="text-[17px]" />
              </button>
            )}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-full border border-outline-variant px-2.5 py-1 text-[11px] text-on-surface-variant">
              {getRelationshipLabel(profile.relationshipStatus)}
            </span>
            {presenceText && (
              <span className="rounded-full border border-secondary/20 bg-secondary-container px-2.5 py-1 text-[11px] text-secondary">
                {presenceText}
              </span>
            )}
          </div>
        </div>
      </div>

      {profile.bio ? (
        <p className="mt-5 whitespace-pre-line text-[13px] leading-6 text-on-surface">{profile.bio}</p>
      ) : (
        <p className="mt-5 text-[13px] leading-6 text-on-surface-variant">Chưa có giới thiệu.</p>
      )}

      {mutualText && (
        <div className="mt-5 border-t border-outline-variant pt-4">
          <p className="text-[11px] font-semibold uppercase text-on-surface-variant">Bạn chung</p>
          <div className="mt-3 flex items-center gap-2">
            <div className="flex -space-x-2">
              {(profile.mutualFriends || []).slice(0, 3).map((friend) => (
                <Avatar
                  key={friend._id || friend.id || friend.pingId}
                  src={friend.avatar}
                  name={friend.username}
                  size="sm"
                  className="rounded-full ring-2 ring-surface"
                />
              ))}
            </div>
            <p className="min-w-0 flex-1 truncate text-[12px] text-on-surface-variant">{mutualText}</p>
          </div>
        </div>
      )}

      <div className="mt-5">{renderActions()}</div>
      {actionError && (
        <p className="mt-3 rounded-[8px] border border-error/25 bg-error-container px-3 py-2 text-[12px] text-error">
          {actionError}
        </p>
      )}
    </article>
  );
}

export default ProfileViewer;
