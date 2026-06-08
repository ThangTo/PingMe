import { useEffect, useRef, useState } from 'react';
import api from '../../config/api';
import { useAuth } from '../../context/AuthContext';
import AppIcon from '../ui/AppIcon';

const fallbackAvatar =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuBahpFjkcHIiXnez71G-AraliNtmi5v8RquQh32J3n6EOHz1qvVsa2SYxXapR9iaamKNqQ30JzpziX2OAreG_C-9h3wCctRkHorqJ01Yo1MdgqGjvfPRhctrnu7ARwCdwvHK1fl42HCqMJ1A8sbW5bbHtGPpcdjeETYrHqW5A8y82nlhgH6kIfDZUHoGLWDZh1CnnzHQXHoYKEVy3EPNv_qviB9kBtZtTURL2tkJ8kXPpmPaIssR1Y1sPBi9mqbn6eO6qnCSw6q6xLP';

const defaultPrivacySettings = {
  onlineVisibility: 'friends',
  avatarVisibility: 'everyone',
};

const privacyOptions = [
  { value: 'everyone', label: 'Mọi người' },
  { value: 'friends', label: 'Bạn bè' },
  { value: 'nobody', label: 'Không ai' },
];

const navigationItems = [
  { key: 'profile', label: 'Hồ sơ & avatar', icon: 'person' },
  { key: 'appearance', label: 'Giao diện', icon: 'theme_light' },
  { key: 'notifications', label: 'Thông báo', icon: 'notifications' },
  { key: 'privacy', label: 'Quyền riêng tư', icon: 'lock' },
  { key: 'sessions', label: 'Thiết bị đăng nhập', icon: 'monitor' },
  { key: 'blocked', label: 'Người đã chặn', icon: 'block' },
  { key: 'password', label: 'Đổi mật khẩu', icon: 'key' },
];

function SettingsMessage({ success, error }) {
  if (!success && !error) return null;
  return (
    <div
      className={`mt-4 flex items-start gap-2 rounded-[8px] border px-3 py-2.5 text-[12px] ${
        error ? 'border-error/25 bg-error-container text-error' : 'border-secondary/20 bg-secondary-container text-secondary'
      }`}
    >
      <AppIcon name={error ? 'sync_problem' : 'check'} className="mt-0.5 text-[14px]" />
      <span>{error || success}</span>
    </div>
  );
}

function SettingsSection({ title, description, children, action }) {
  return (
    <section className="min-w-0">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[16px] font-semibold text-on-surface">{title}</h2>
          {description && <p className="mt-1 text-[12px] leading-5 text-on-surface-variant">{description}</p>}
        </div>
        {action}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function SettingsPanel({ onBack, onNavigate }) {
  const { user, updateUser, logout } = useAuth();
  const avatarInputRef = useRef(null);
  const [activeSection, setActiveSection] = useState(() =>
    window.matchMedia('(max-width: 767px)').matches ? 'overview' : 'profile',
  );
  const [profile, setProfile] = useState({
    username: user?.username || user?.name || '',
    email: user?.email || '',
    avatar: user?.avatar || '',
    bio: user?.bio || '',
    provider: 'local',
    notificationSettings: user?.notificationSettings || { muteAll: false },
    privacySettings: user?.privacySettings || defaultPrivacySettings,
  });
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '' });
  const [themePreference, setThemePreference] = useState(
    () => localStorage.getItem('pingme_theme') || 'system',
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isAvatarUploading, setIsAvatarUploading] = useState(false);
  const [isNotificationSaving, setIsNotificationSaving] = useState(false);
  const [isPrivacySaving, setIsPrivacySaving] = useState(false);
  const [messages, setMessages] = useState({});
  const [sessions, setSessions] = useState([]);
  const [blockedUsers, setBlockedUsers] = useState([]);
  const notificationsMuted = Boolean(profile.notificationSettings?.muteAll);

  const setFeedback = (scope, success = '', error = '') => {
    setMessages((current) => ({ ...current, [scope]: { success, error } }));
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const [profileResponse, sessionsResponse, blockedResponse] = await Promise.all([
          api.get('/users/me'),
          api.get('/auth/sessions'),
          api.get('/social/blocked'),
        ]);
        if (profileResponse.data.success) {
          const nextUser = {
            ...profileResponse.data.user,
            privacySettings: {
              ...defaultPrivacySettings,
              ...(profileResponse.data.user.privacySettings || {}),
            },
          };
          setProfile(nextUser);
          updateUser(nextUser);
        }
        setSessions(sessionsResponse.data.sessions || []);
        setBlockedUsers(blockedResponse.data.users || []);
      } catch (error) {
        setFeedback('account', '', error.response?.data?.error || 'Không thể tải dữ liệu cài đặt.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
    // Chỉ tải một lần khi mở cài đặt.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleProfileSubmit = async (event) => {
    event.preventDefault();
    setIsSaving(true);
    setFeedback('profile');
    try {
      const response = await api.patch('/users/me', {
        username: profile.username,
        bio: profile.bio,
      });
      if (response.data.success) {
        setProfile(response.data.user);
        updateUser(response.data.user);
        setFeedback('profile', 'Đã lưu thay đổi thành công.');
      }
    } catch (error) {
      setFeedback('profile', '', error.response?.data?.error || 'Không thể lưu hồ sơ.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAvatarFileChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setFeedback('profile', '', 'Vui lòng chọn file ảnh.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setFeedback('profile', '', 'Avatar tối đa 5MB.');
      return;
    }

    setIsAvatarUploading(true);
    setFeedback('profile');
    try {
      const formData = new FormData();
      formData.append('avatar', file);
      const response = await api.post('/users/me/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (response.data.success) {
        const nextUser = {
          ...response.data.user,
          privacySettings: {
            ...defaultPrivacySettings,
            ...(response.data.user.privacySettings || {}),
          },
        };
        setProfile(nextUser);
        updateUser(nextUser);
        setFeedback('profile', 'Đã cập nhật ảnh đại diện.');
      }
    } catch (error) {
      setFeedback('profile', '', error.response?.data?.error || 'Không thể tải ảnh đại diện.');
    } finally {
      setIsAvatarUploading(false);
    }
  };

  const handleThemeChange = (theme) => {
    setThemePreference(theme);
    localStorage.setItem('pingme_theme', theme);
    window.dispatchEvent(new Event('pingme-theme-change'));
  };

  const handleNotificationToggle = async () => {
    const nextMuteAll = !notificationsMuted;
    setIsNotificationSaving(true);
    setFeedback('notifications');
    try {
      const response = await api.patch('/users/me/notifications', { muteAll: nextMuteAll });
      if (response.data.success) {
        setProfile(response.data.user);
        updateUser(response.data.user);
        setFeedback(
          'notifications',
          nextMuteAll ? 'Đã tắt toàn bộ thông báo PingMe.' : 'Đã bật lại thông báo PingMe.',
        );
      }
    } catch (error) {
      setFeedback('notifications', '', error.response?.data?.error || 'Không thể cập nhật thông báo.');
    } finally {
      setIsNotificationSaving(false);
    }
  };

  const handlePrivacySubmit = async () => {
    setIsPrivacySaving(true);
    setFeedback('privacy');
    try {
      const response = await api.patch('/users/me/privacy', {
        ...defaultPrivacySettings,
        ...(profile.privacySettings || {}),
      });
      if (response.data.success) {
        setProfile(response.data.user);
        updateUser(response.data.user);
        setFeedback('privacy', 'Đã lưu quyền riêng tư.');
      }
    } catch (error) {
      setFeedback('privacy', '', error.response?.data?.error || 'Không thể lưu quyền riêng tư.');
    } finally {
      setIsPrivacySaving(false);
    }
  };

  const handlePasswordSubmit = async (event) => {
    event.preventDefault();
    setFeedback('password');
    try {
      const response = await api.patch('/users/me/password', passwordForm);
      if (response.data.success) {
        setPasswordForm({ currentPassword: '', newPassword: '' });
        setFeedback('password', 'Đã đổi mật khẩu.');
      }
    } catch (error) {
      setFeedback('password', '', error.response?.data?.error || 'Không thể đổi mật khẩu.');
    }
  };

  const handleRevokeSession = async (session) => {
    const confirmed = window.confirm(
      session.current ? 'Thu hồi phiên hiện tại và đăng xuất?' : 'Thu hồi phiên đăng nhập này?',
    );
    if (!confirmed) return;
    try {
      const response = await api.delete(`/auth/sessions/${encodeURIComponent(session.id)}`);
      if (response.data.currentSessionRevoked) {
        await logout();
        return;
      }
      setSessions((current) => current.filter((item) => item.id !== session.id));
    } catch (error) {
      setFeedback('sessions', '', error.response?.data?.error || 'Không thể thu hồi phiên đăng nhập.');
    }
  };

  const handleRevokeOtherSessions = async () => {
    try {
      await api.delete('/auth/sessions/others');
      setSessions((current) => current.filter((session) => session.current));
      setFeedback('sessions', 'Đã đăng xuất khỏi các thiết bị khác.');
    } catch (error) {
      setFeedback('sessions', '', error.response?.data?.error || 'Không thể thu hồi các phiên khác.');
    }
  };

  const handleUnblock = async (blockedUserId) => {
    try {
      await api.delete(`/social/${blockedUserId}/block`);
      setBlockedUsers((current) => current.filter((blockedUser) => blockedUser._id !== blockedUserId));
    } catch (error) {
      setFeedback('blocked', '', error.response?.data?.error || 'Không thể bỏ chặn người dùng.');
    }
  };

  const renderProfile = () => (
    <form onSubmit={handleProfileSubmit}>
      <SettingsSection
        title="Hồ sơ của bạn"
        description="Cập nhật ảnh đại diện và thông tin hiển thị."
        action={
          <button
            type="submit"
            disabled={isSaving || isLoading}
            className="hidden h-10 rounded-[8px] bg-secondary px-4 text-[12px] font-semibold text-white hover:brightness-95 disabled:opacity-50 md:block"
          >
            {isSaving ? 'Đang lưu...' : 'Lưu thay đổi'}
          </button>
        }
      >
        <div className="grid gap-6 md:grid-cols-[150px_minmax(0,1fr)]">
          <div className="text-center">
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              disabled={isAvatarUploading}
              className="group relative mx-auto block h-28 w-28 rounded-full"
            >
              <img
                src={profile.avatar || fallbackAvatar}
                alt={profile.username || 'Avatar'}
                className="h-full w-full rounded-full border border-outline object-cover"
              />
              <span className="absolute bottom-0 right-0 grid h-9 w-9 place-items-center rounded-full border border-outline bg-surface text-on-surface quiet-shadow">
                <AppIcon name="photo_library" className="text-[16px]" />
              </span>
            </button>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarFileChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              className="mt-3 text-[11px] font-medium text-on-surface"
            >
              {isAvatarUploading ? 'Đang tải ảnh...' : 'Tải ảnh lên'}
            </button>
            <p className="mt-1 text-[9px] text-on-surface-variant">JPG, PNG, tối đa 5MB</p>
          </div>

          <div className="grid gap-4">
            <label className="grid gap-1.5 text-[11px] font-medium text-on-surface">
              Tên hiển thị
              <input
                value={profile.username || ''}
                onChange={(event) => setProfile((current) => ({ ...current, username: event.target.value }))}
                className="h-11 rounded-[8px] border border-outline bg-surface px-3 text-[13px] outline-none focus:border-secondary"
                maxLength={30}
                minLength={3}
                required
              />
            </label>
            <label className="grid gap-1.5 text-[11px] font-medium text-on-surface">
              Email
              <input
                value={profile.email || ''}
                disabled
                className="h-11 rounded-[8px] border border-outline-variant bg-surface-container-low px-3 text-[13px] text-on-surface-variant"
              />
            </label>
            <label className="grid gap-1.5 text-[11px] font-medium text-on-surface">
              Giới thiệu
              <textarea
                value={profile.bio || ''}
                onChange={(event) => setProfile((current) => ({ ...current, bio: event.target.value }))}
                className="min-h-20 resize-none rounded-[8px] border border-outline bg-surface px-3 py-2.5 text-[13px] outline-none focus:border-secondary"
                maxLength={160}
                placeholder="Một câu giới thiệu ngắn..."
              />
              <span className="text-right text-[9px] font-normal text-on-surface-variant">
                {(profile.bio || '').length}/160
              </span>
            </label>
          </div>
        </div>
        <SettingsMessage {...messages.profile} />
        <button
          type="submit"
          disabled={isSaving || isLoading}
          className="mt-5 h-11 w-full rounded-[8px] bg-secondary text-[13px] font-semibold text-white md:hidden"
        >
          {isSaving ? 'Đang lưu...' : 'Lưu thay đổi'}
        </button>
      </SettingsSection>
    </form>
  );

  const renderAppearance = () => (
    <SettingsSection title="Giao diện" description="Chọn theme cho thiết bị này.">
      <div className="grid grid-cols-3 gap-2">
        {[
          { key: 'light', label: 'Sáng', icon: 'light_mode' },
          { key: 'dark', label: 'Tối', icon: 'dark_mode' },
          { key: 'system', label: 'Hệ thống', icon: 'desktop_windows' },
        ].map((theme) => (
          <button
            key={theme.key}
            type="button"
            onClick={() => handleThemeChange(theme.key)}
            className={`flex h-12 items-center justify-center gap-2 rounded-[8px] border text-[12px] font-medium ${
              themePreference === theme.key
                ? 'border-secondary/40 bg-secondary-container text-secondary'
                : 'border-outline bg-surface text-on-surface-variant hover:bg-surface-container-low'
            }`}
          >
            <AppIcon name={theme.icon} className="text-[17px]" />
            {theme.label}
          </button>
        ))}
      </div>
    </SettingsSection>
  );

  const renderNotifications = () => (
    <SettingsSection title="Thông báo" description="Kiểm soát nhắc nhở trong app và Web Push.">
      <div className="flex items-center gap-4 rounded-[10px] border border-outline bg-surface px-4 py-4">
        <span className="grid h-10 w-10 place-items-center rounded-full bg-surface-container-high text-on-surface">
          <AppIcon name={notificationsMuted ? 'notifications_off' : 'notifications'} className="text-[19px]" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium text-on-surface">Thông báo toàn cục</p>
          <p className="mt-1 text-[11px] leading-5 text-on-surface-variant">
            {notificationsMuted ? 'Tin nhắn vẫn đến nhưng không bật nhắc nhở.' : 'Nhận thông báo cho tin nhắn, cuộc gọi và hoạt động.'}
          </p>
        </div>
        <button
          type="button"
          onClick={handleNotificationToggle}
          disabled={isNotificationSaving}
          className={`relative h-6 w-11 rounded-full transition-colors ${notificationsMuted ? 'bg-outline' : 'bg-secondary'}`}
          aria-label={notificationsMuted ? 'Bật thông báo' : 'Tắt thông báo'}
        >
          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${notificationsMuted ? 'left-0.5' : 'left-[22px]'}`} />
        </button>
      </div>
      <SettingsMessage {...messages.notifications} />
    </SettingsSection>
  );

  const renderPrivacy = () => (
    <SettingsSection
      title="Bảo mật & quyền riêng tư"
      description="Kiểm soát thông tin người khác có thể nhìn thấy."
      action={
        <button
          type="button"
          onClick={handlePrivacySubmit}
          disabled={isPrivacySaving}
          className="hidden h-10 rounded-[8px] bg-secondary px-4 text-[12px] font-semibold text-white md:block"
        >
          {isPrivacySaving ? 'Đang lưu...' : 'Lưu'}
        </button>
      }
    >
      <div className="divide-y divide-outline-variant overflow-hidden rounded-[10px] border border-outline bg-surface">
        {[
          { key: 'onlineVisibility', label: 'Ai thấy trạng thái online' },
          { key: 'avatarVisibility', label: 'Ai thấy avatar' },
        ].map((item) => (
          <div key={item.key} className="flex items-center gap-4 px-4 py-3.5">
            <span className="min-w-0 flex-1 text-[13px] text-on-surface">{item.label}</span>
            <select
              value={(profile.privacySettings || defaultPrivacySettings)[item.key]}
              onChange={(event) =>
                setProfile((current) => ({
                  ...current,
                  privacySettings: { ...defaultPrivacySettings, ...current.privacySettings, [item.key]: event.target.value },
                }))
              }
              className="rounded-[7px] border border-outline bg-surface-container-low px-2 py-1.5 text-[11px] text-on-surface outline-none"
            >
              {privacyOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
        ))}
      </div>
      <SettingsMessage {...messages.privacy} />
      <button
        type="button"
        onClick={handlePrivacySubmit}
        disabled={isPrivacySaving}
        className="mt-5 h-11 w-full rounded-[8px] bg-secondary text-[13px] font-semibold text-white md:hidden"
      >
        {isPrivacySaving ? 'Đang lưu...' : 'Lưu quyền riêng tư'}
      </button>
    </SettingsSection>
  );

  const renderSessions = () => (
    <SettingsSection
      title={`Thiết bị đăng nhập (${sessions.length})`}
      description="Kiểm tra và thu hồi các phiên đang còn hiệu lực."
      action={
        sessions.some((session) => !session.current) && (
          <button
            type="button"
            onClick={handleRevokeOtherSessions}
            className="hidden h-9 rounded-[8px] border border-error/35 px-3 text-[11px] font-medium text-error md:block"
          >
            Đăng xuất thiết bị khác
          </button>
        )
      }
    >
      <div className="divide-y divide-outline-variant overflow-hidden rounded-[10px] border border-outline bg-surface">
        {sessions.length === 0 && <p className="p-4 text-[12px] text-on-surface-variant">Chưa có dữ liệu thiết bị.</p>}
        {sessions.map((session) => (
          <div key={session.id} className="flex items-center gap-3 px-4 py-3">
            <span className="grid h-9 w-9 place-items-center rounded-[8px] bg-surface-container-high">
              <AppIcon name="monitor" className="text-[18px]" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] font-medium text-on-surface">{session.userAgent || 'Thiết bị không xác định'}</p>
              <p className="mt-1 truncate text-[10px] text-on-surface-variant">
                {session.current ? 'Thiết bị hiện tại · ' : ''}{session.ip || 'IP không xác định'} · {new Date(session.lastUsedAt).toLocaleString('vi-VN')}
              </p>
            </div>
            {!session.current && (
              <button
                type="button"
                onClick={() => handleRevokeSession(session)}
                className="rounded-[7px] px-2 py-1.5 text-[11px] font-medium text-error hover:bg-error-container"
              >
                Đăng xuất
              </button>
            )}
          </div>
        ))}
      </div>
      <SettingsMessage {...messages.sessions} />
    </SettingsSection>
  );

  const renderBlocked = () => (
    <SettingsSection title={`Người đã chặn (${blockedUsers.length})`} description="Quản lý những người không thể nhắn tin hoặc gọi trực tiếp cho bạn.">
      <div className="divide-y divide-outline-variant overflow-hidden rounded-[10px] border border-outline bg-surface">
        {blockedUsers.length === 0 && <p className="p-4 text-[12px] text-on-surface-variant">Bạn chưa chặn ai.</p>}
        {blockedUsers.map((blockedUser) => (
          <div key={blockedUser._id} className="flex items-center gap-3 px-4 py-3">
            <span className="h-9 w-9 overflow-hidden rounded-full bg-surface-container-high">
              {blockedUser.avatar ? (
                <img src={blockedUser.avatar} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="grid h-full w-full place-items-center"><AppIcon name="person" /></span>
              )}
            </span>
            <p className="min-w-0 flex-1 truncate text-[12px] font-medium text-on-surface">{blockedUser.username}</p>
            <button
              type="button"
              onClick={() => handleUnblock(blockedUser._id)}
              className="rounded-[7px] border border-outline px-3 py-1.5 text-[11px] font-medium text-on-surface hover:bg-surface-container-low"
            >
              Bỏ chặn
            </button>
          </div>
        ))}
      </div>
      <SettingsMessage {...messages.blocked} />
    </SettingsSection>
  );

  const renderPassword = () => (
    <form onSubmit={handlePasswordSubmit}>
      <SettingsSection title="Đổi mật khẩu" description="Chỉ áp dụng với tài khoản đăng nhập bằng email và mật khẩu.">
        <div className="grid gap-4">
          <label className="grid gap-1.5 text-[11px] font-medium text-on-surface">
            Mật khẩu hiện tại
            <input
              type="password"
              value={passwordForm.currentPassword}
              onChange={(event) => setPasswordForm((current) => ({ ...current, currentPassword: event.target.value }))}
              className="h-11 rounded-[8px] border border-outline bg-surface px-3 text-[13px] outline-none focus:border-secondary"
            />
          </label>
          <label className="grid gap-1.5 text-[11px] font-medium text-on-surface">
            Mật khẩu mới
            <input
              type="password"
              value={passwordForm.newPassword}
              onChange={(event) => setPasswordForm((current) => ({ ...current, newPassword: event.target.value }))}
              className="h-11 rounded-[8px] border border-outline bg-surface px-3 text-[13px] outline-none focus:border-secondary"
              minLength={6}
            />
          </label>
        </div>
        <SettingsMessage {...messages.password} />
        <button type="submit" className="mt-5 h-11 rounded-[8px] bg-secondary px-5 text-[12px] font-semibold text-white">
          Đổi mật khẩu
        </button>
      </SettingsSection>
    </form>
  );

  const renderActiveSection = () => {
    const sections = {
      profile: renderProfile,
      appearance: renderAppearance,
      notifications: renderNotifications,
      privacy: renderPrivacy,
      sessions: renderSessions,
      blocked: renderBlocked,
      password: renderPassword,
    };
    return sections[activeSection]?.() || renderProfile();
  };

  const renderOverview = () => (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex h-[64px] shrink-0 items-center border-b border-outline-variant px-5">
        <h1 className="text-[22px] font-semibold text-on-surface">Cài đặt</h1>
      </header>
      <div className="no-scrollbar flex-1 overflow-y-auto">
        <button
          type="button"
          onClick={() => setActiveSection('profile')}
          className="flex w-full items-center gap-4 border-b border-outline-variant px-5 py-5 text-left"
        >
          <span className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full border border-outline">
            <img src={profile.avatar || fallbackAvatar} alt="" className="h-full w-full object-cover" />
            <span className="absolute bottom-0 right-0 h-4 w-4 rounded-full border-2 border-surface bg-secondary" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[16px] font-semibold text-on-surface">{profile.username || 'Tài khoản'}</span>
            <span className="mt-1 block truncate text-[12px] text-on-surface-variant">{profile.email}</span>
            <span className="mt-1 block text-[11px] text-secondary">● Đang online</span>
          </span>
          <AppIcon name="chevron_right" className="text-[18px] text-on-surface-variant" />
        </button>

        <div className="divide-y divide-outline-variant px-5">
          {navigationItems.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setActiveSection(item.key)}
              className="flex h-[64px] w-full items-center gap-4 text-left"
            >
              <AppIcon name={item.icon} className="text-[21px] text-on-surface" />
              <span className="min-w-0 flex-1 text-[14px] text-on-surface">{item.label}</span>
              {item.key === 'appearance' && <span className="text-[11px] text-on-surface-variant">{themePreference === 'dark' ? 'Tối' : themePreference === 'light' ? 'Sáng' : 'Hệ thống'}</span>}
              {item.key === 'sessions' && <span className="text-[11px] text-on-surface-variant">{sessions.length} thiết bị</span>}
              {item.key === 'blocked' && <span className="text-[11px] text-on-surface-variant">{blockedUsers.length} người</span>}
              <AppIcon name="chevron_right" className="text-[17px] text-on-surface-variant" />
            </button>
          ))}
        </div>

        <div className="mt-3 border-y border-outline-variant px-5">
          <button type="button" className="flex h-[64px] w-full items-center gap-4 text-left">
            <AppIcon name="help" className="text-[21px]" />
            <span className="flex-1 text-[14px]">Trợ giúp</span>
            <AppIcon name="chevron_right" className="text-[17px] text-on-surface-variant" />
          </button>
        </div>
        <div className="px-5">
          <button type="button" onClick={logout} className="flex h-[64px] w-full items-center gap-4 text-left text-error">
            <AppIcon name="logout" className="text-[21px]" />
            <span className="text-[14px]">Đăng xuất</span>
          </button>
        </div>
      </div>
      <nav className="grid h-[68px] shrink-0 grid-cols-4 border-t border-outline-variant bg-surface md:hidden">
        {[
          { key: 'messages', icon: 'chat_bubble', label: 'Tin nhắn' },
          { key: 'contacts', icon: 'person', label: 'Danh bạ' },
          { key: 'groups', icon: 'groups', label: 'Nhóm' },
          { key: 'settings', icon: 'settings', label: 'Cài đặt' },
        ].map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => (item.key === 'messages' ? onBack?.() : onNavigate?.(item.key))}
            className={`relative flex flex-col items-center justify-center gap-1 text-[10px] ${
              item.key === 'settings' ? 'text-secondary' : 'text-on-surface-variant'
            }`}
          >
            {item.key === 'settings' && <span className="absolute top-0 h-0.5 w-8 rounded-full bg-secondary" />}
            <AppIcon name={item.icon} className="text-[21px]" />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );

  if (activeSection === 'overview') {
    return <section className="flex min-w-0 flex-1 flex-col bg-surface">{renderOverview()}</section>;
  }

  return (
    <section className="flex min-w-0 flex-1 flex-col bg-surface">
      <header className="flex h-[64px] shrink-0 items-center gap-3 border-b border-outline-variant px-4 md:px-6">
        <button
          type="button"
          onClick={() => {
            if (window.matchMedia('(max-width: 767px)').matches) setActiveSection('overview');
            else onBack?.();
          }}
          className="grid h-9 w-9 place-items-center rounded-[8px] text-on-surface-variant hover:bg-surface-container-low"
          aria-label="Quay lại"
        >
          <AppIcon name="arrow_back" className="text-[20px]" />
        </button>
        <h1 className="text-[19px] font-semibold text-on-surface">
          <span className="hidden md:inline">Cài đặt</span>
          <span className="md:hidden">{navigationItems.find((item) => item.key === activeSection)?.label}</span>
        </h1>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-[240px] shrink-0 border-r border-outline-variant px-3 py-5 md:block">
          <nav className="space-y-1">
            {navigationItems.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setActiveSection(item.key)}
                className={`relative flex h-11 w-full items-center gap-3 rounded-[8px] px-3 text-left text-[12px] font-medium ${
                  activeSection === item.key
                    ? 'bg-surface-container-high text-on-surface'
                    : 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface'
                }`}
              >
                {activeSection === item.key && <span className="absolute left-[-12px] h-5 w-0.5 rounded-full bg-secondary" />}
                <AppIcon name={item.icon} className={`text-[17px] ${activeSection === item.key ? 'text-secondary' : ''}`} />
                {item.label}
              </button>
            ))}
          </nav>
        </aside>

        <main className="no-scrollbar min-w-0 flex-1 overflow-y-auto px-5 py-6 md:px-7">
          <div className="mx-auto max-w-[760px] rounded-[12px] border border-outline bg-surface-container-lowest p-5 md:p-6">
            {renderActiveSection()}
          </div>
          <SettingsMessage {...messages.account} />
        </main>
      </div>
    </section>
  );
}

export default SettingsPanel;
