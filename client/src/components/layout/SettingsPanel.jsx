import { useEffect, useState } from 'react';
import api from '../../config/api';
import { useAuth } from '../../context/AuthContext';
import AppIcon from '../ui/AppIcon';

const fallbackAvatar =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuBahpFjkcHIiXnez71G-AraliNtmi5v8RquQh32J3n6EOHz1qvVsa2SYxXapR9iaamKNqQ30JzpziX2OAreG_C-9h3wCctRkHorqJ01Yo1MdgqGjvfPRhctrnu7ARwCdwvHK1fl42HCqMJ1A8sbW5bbHtGPpcdjeETYrHqW5A8y82nlhgH6kIfDZUHoGLWDZh1CnnzHQXHoYKEVy3EPNv_qviB9kBtZtTURL2tkJ8kXPpmPaIssR1Y1sPBi9mqbn6eO6qnCSw6q6xLP';

const SettingsPanel = ({ onBack }) => {
  const { user, updateUser, logout } = useAuth();
  const [profile, setProfile] = useState({
    username: user?.username || user?.name || '',
    email: user?.email || '',
    avatar: user?.avatar || '',
    bio: user?.bio || '',
    provider: 'local',
    notificationSettings: user?.notificationSettings || { muteAll: false },
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
  });
  const [themePreference, setThemePreference] = useState(
    () => localStorage.getItem('pingme_theme') || 'system',
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState('');
  const [profileError, setProfileError] = useState('');
  const [passwordMessage, setPasswordMessage] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [isNotificationSaving, setIsNotificationSaving] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');
  const [notificationError, setNotificationError] = useState('');
  const [sessions, setSessions] = useState([]);
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [accountControlError, setAccountControlError] = useState('');
  const notificationsMuted = Boolean(profile.notificationSettings?.muteAll);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setIsLoading(true);
        const response = await api.get('/users/me');
        if (response.data.success) {
          setProfile(response.data.user);
          updateUser(response.data.user);
        }
      } catch (error) {
        setProfileError(error.message || 'Không thể tải profile');
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfile();
    // Chỉ fetch một lần khi mở settings.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const fetchAccountControls = async () => {
      try {
        const [sessionsResponse, blockedResponse] = await Promise.all([
          api.get('/auth/sessions'),
          api.get('/social/blocked'),
        ]);
        setSessions(sessionsResponse.data.sessions || []);
        setBlockedUsers(blockedResponse.data.users || []);
      } catch (error) {
        setAccountControlError(error.response?.data?.error || 'Không thể tải dữ liệu bảo mật.');
      }
    };

    fetchAccountControls();
  }, []);

  const handleProfileSubmit = async (event) => {
    event.preventDefault();
    setIsSaving(true);
    setProfileMessage('');
    setProfileError('');

    try {
      const response = await api.patch('/users/me', {
        username: profile.username,
        avatar: profile.avatar,
        bio: profile.bio,
      });

      if (response.data.success) {
        setProfile(response.data.user);
        updateUser(response.data.user);
        setProfileMessage('Đã lưu profile');
      }
    } catch (error) {
      setProfileError(error.message || 'Không thể lưu profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePasswordSubmit = async (event) => {
    event.preventDefault();
    setPasswordMessage('');
    setPasswordError('');

    try {
      const response = await api.patch('/users/me/password', passwordForm);
      if (response.data.success) {
        setPasswordForm({ currentPassword: '', newPassword: '' });
        setPasswordMessage('Đã đổi mật khẩu');
      }
    } catch (error) {
      setPasswordError(error.message || 'Không thể đổi mật khẩu');
    }
  };

  const handleLogout = async () => {
    await logout();
  };

  const handleThemeChange = (theme) => {
    setThemePreference(theme);
    localStorage.setItem('pingme_theme', theme);
    window.dispatchEvent(new Event('pingme-theme-change'));
  };

  const handleNotificationToggle = async () => {
    const nextMuteAll = !notificationsMuted;
    setIsNotificationSaving(true);
    setNotificationMessage('');
    setNotificationError('');

    try {
      const response = await api.patch('/users/me/notifications', {
        muteAll: nextMuteAll,
      });

      if (response.data.success) {
        setProfile(response.data.user);
        updateUser(response.data.user);
        setNotificationMessage(
          nextMuteAll ? 'Đã tắt toàn bộ thông báo PingMe.' : 'Đã bật lại thông báo PingMe.',
        );
      }
    } catch (error) {
      setNotificationError(
        error.response?.data?.error || error.message || 'Không thể cập nhật thông báo.',
      );
    } finally {
      setIsNotificationSaving(false);
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
      setSessions((prev) => prev.filter((item) => item.id !== session.id));
    } catch (error) {
      setAccountControlError(error.response?.data?.error || 'Không thể thu hồi phiên đăng nhập.');
    }
  };

  const handleRevokeOtherSessions = async () => {
    try {
      await api.delete('/auth/sessions/others');
      setSessions((prev) => prev.filter((session) => session.current));
    } catch (error) {
      setAccountControlError(error.response?.data?.error || 'Không thể thu hồi các phiên khác.');
    }
  };

  const handleUnblock = async (blockedUserId) => {
    try {
      await api.delete(`/social/${blockedUserId}/block`);
      setBlockedUsers((prev) => prev.filter((blockedUser) => blockedUser._id !== blockedUserId));
    } catch (error) {
      setAccountControlError(error.response?.data?.error || 'Không thể bỏ chặn người dùng.');
    }
  };

  return (
    <section className="flex min-w-0 flex-1 flex-col bg-surface">
      <header className="flex h-[72px] shrink-0 items-center gap-3 border-b border-outline-variant px-4 md:px-8">
        <button
          type="button"
          onClick={onBack}
          className="flex h-10 w-10 items-center justify-center rounded-lg text-on-surface transition-colors hover:bg-surface-container-low"
          title="Quay lại tin nhắn"
        >
          <AppIcon name="arrow_back" className="text-[23px]" />
        </button>
        <div>
          <h1 className="text-xl font-semibold tracking-[-0.04em] text-on-surface">Cài đặt</h1>
          <p className="mt-1 text-sm text-on-surface-variant">Profile, mật khẩu và tài khoản</p>
        </div>
      </header>

      <div className="no-scrollbar flex-1 overflow-y-auto px-4 py-6 md:px-8">
        <div className="mx-auto grid max-w-[960px] gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-6">
            <form
              onSubmit={handleProfileSubmit}
              className="rounded-xl border border-outline-variant bg-surface-container-lowest p-5 md:p-6"
            >
              <div className="mb-6 flex items-center gap-4">
                <img
                  src={profile.avatar || fallbackAvatar}
                  alt={profile.username || 'Avatar'}
                  className="h-16 w-16 rounded-full border border-outline-variant object-cover"
                />
                <div className="min-w-0">
                  <h2 className="truncate text-lg font-semibold tracking-[-0.03em] text-on-surface">
                    Profile cơ bản
                  </h2>
                  <p className="mt-1 text-sm text-on-surface-variant">
                    Tên, ảnh đại diện và giới thiệu ngắn.
                  </p>
                </div>
              </div>

              <div className="grid gap-4">
                <label className="grid gap-2 text-sm font-medium text-on-surface">
                  Tên hiển thị
                  <input
                    value={profile.username || ''}
                    onChange={(event) =>
                      setProfile((prev) => ({ ...prev, username: event.target.value }))
                    }
                    className="h-11 rounded-lg border border-outline-variant bg-surface px-3 text-sm outline-none transition-colors focus:border-accent"
                    maxLength={30}
                    minLength={3}
                    required
                  />
                </label>

                <label className="grid gap-2 text-sm font-medium text-on-surface">
                  Avatar URL
                  <input
                    value={profile.avatar || ''}
                    onChange={(event) =>
                      setProfile((prev) => ({ ...prev, avatar: event.target.value }))
                    }
                    className="h-11 rounded-lg border border-outline-variant bg-surface px-3 text-sm outline-none transition-colors focus:border-accent"
                    placeholder="https://..."
                  />
                </label>

                <label className="grid gap-2 text-sm font-medium text-on-surface">
                  Bio
                  <textarea
                    value={profile.bio || ''}
                    onChange={(event) =>
                      setProfile((prev) => ({ ...prev, bio: event.target.value }))
                    }
                    className="min-h-24 resize-none rounded-lg border border-outline-variant bg-surface px-3 py-3 text-sm outline-none transition-colors focus:border-accent"
                    maxLength={160}
                    placeholder="Một câu giới thiệu ngắn..."
                  />
                  <span className="text-xs font-normal text-on-surface-variant">
                    {(profile.bio || '').length}/160
                  </span>
                </label>
              </div>

              {profileError && <p className="mt-4 text-sm text-error">{profileError}</p>}
              {profileMessage && <p className="mt-4 text-sm text-secondary">{profileMessage}</p>}

              <button
                type="submit"
                disabled={isSaving || isLoading}
                className="mt-6 h-11 rounded-lg bg-primary px-5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSaving ? 'Đang lưu...' : 'Lưu profile'}
              </button>
            </form>

            <section className="rounded-xl border border-outline-variant bg-surface-container-lowest p-5 md:p-6">
              <h2 className="text-lg font-semibold tracking-[-0.03em] text-on-surface">
                Giao diện
              </h2>
              <p className="mt-1 text-sm text-on-surface-variant">
                Chọn theme cho thiết bị này.
              </p>

              <div className="mt-5 grid gap-2 sm:grid-cols-3">
                {[
                  { key: 'light', label: 'Sáng', icon: 'light_mode' },
                  { key: 'dark', label: 'Tối', icon: 'dark_mode' },
                  { key: 'system', label: 'Hệ thống', icon: 'desktop_windows' },
                ].map((theme) => (
                  <button
                    key={theme.key}
                    type="button"
                    onClick={() => handleThemeChange(theme.key)}
                    className={`flex h-12 items-center justify-center gap-2 rounded-lg border text-sm font-medium transition-colors ${
                      themePreference === theme.key
                        ? 'border-accent bg-accent-soft text-on-surface'
                        : 'border-outline-variant text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface'
                    }`}
                  >
                    <AppIcon name={theme.icon} className="text-[20px]" />
                    <span>{theme.label}</span>
                  </button>
                ))}
              </div>
            </section>

            <section className="rounded-xl border border-outline-variant bg-surface-container-lowest p-5 md:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold tracking-[-0.03em] text-on-surface">
                    Thông báo
                  </h2>
                  <p className="mt-1 text-sm leading-6 text-on-surface-variant">
                    Tắt toàn bộ thông báo PingMe cho tài khoản này, gồm thông báo trong app và Web Push.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleNotificationToggle}
                  disabled={isNotificationSaving || isLoading}
                  className={`flex h-11 shrink-0 items-center justify-center gap-2 rounded-lg border px-4 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-55 ${
                    notificationsMuted
                      ? 'border-accent bg-accent-soft text-on-surface hover:bg-surface-container-low'
                      : 'border-outline-variant bg-surface text-on-surface hover:bg-surface-container-low'
                  }`}
                >
                  <AppIcon
                    name={notificationsMuted ? 'notifications' : 'notifications_off'}
                    className="text-[19px]"
                  />
                  <span>
                    {isNotificationSaving
                      ? 'Đang lưu...'
                      : notificationsMuted
                        ? 'Bật thông báo'
                        : 'Tắt thông báo'}
                  </span>
                </button>
              </div>

              <div className="mt-4 rounded-lg border border-outline-variant bg-surface px-3 py-3 text-sm text-on-surface-variant">
                {notificationsMuted
                  ? 'Bạn đang tắt toàn bộ thông báo. Tin nhắn vẫn nhận bình thường, chỉ không bật nhắc nhở.'
                  : 'Thông báo đang bật. Bạn vẫn có thể tắt riêng từng cuộc trò chuyện trong phần chi tiết.'}
              </div>

              {notificationError && <p className="mt-4 text-sm text-error">{notificationError}</p>}
              {notificationMessage && (
                <p className="mt-4 text-sm text-secondary">{notificationMessage}</p>
              )}
            </section>

            <section className="rounded-xl border border-outline-variant bg-surface-container-lowest p-5 md:p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-on-surface">Thiết bị đăng nhập</h2>
                  <p className="mt-1 text-sm text-on-surface-variant">
                    Kiểm tra và thu hồi các phiên đang còn hiệu lực.
                  </p>
                </div>
                {sessions.some((session) => !session.current) && (
                  <button
                    type="button"
                    onClick={handleRevokeOtherSessions}
                    className="shrink-0 rounded-lg border border-error/30 px-3 py-2 text-xs font-semibold text-error hover:bg-error-container"
                  >
                    Thu hồi phiên khác
                  </button>
                )}
              </div>
              <div className="mt-4 divide-y divide-outline-variant rounded-lg border border-outline-variant">
                {sessions.length === 0 && (
                  <p className="p-4 text-sm text-on-surface-variant">
                    Phiên hiện tại sẽ xuất hiện sau lần đăng nhập tiếp theo.
                  </p>
                )}
                {sessions.map((session) => (
                  <div key={session.id} className="flex items-center gap-3 p-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-container">
                      <AppIcon name="desktop_windows" className="text-[19px]" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-on-surface">
                        {session.userAgent || 'Thiết bị không xác định'}
                      </span>
                      <span className="mt-0.5 block text-xs text-on-surface-variant">
                        {session.current ? 'Phiên hiện tại · ' : ''}
                        {session.ip || 'IP không xác định'} ·{' '}
                        {new Date(session.lastUsedAt).toLocaleString('vi-VN')}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRevokeSession(session)}
                      className="rounded-lg p-2 text-error hover:bg-error-container"
                      aria-label="Thu hồi phiên đăng nhập"
                    >
                      <AppIcon name="delete" className="text-[18px]" />
                    </button>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-xl border border-outline-variant bg-surface-container-lowest p-5 md:p-6">
              <h2 className="text-lg font-semibold text-on-surface">Người đã chặn</h2>
              <p className="mt-1 text-sm text-on-surface-variant">
                Người bị chặn không thể nhắn tin hoặc gọi trực tiếp cho bạn.
              </p>
              <div className="mt-4 divide-y divide-outline-variant rounded-lg border border-outline-variant">
                {blockedUsers.length === 0 && (
                  <p className="p-4 text-sm text-on-surface-variant">Bạn chưa chặn ai.</p>
                )}
                {blockedUsers.map((blockedUser) => (
                  <div key={blockedUser._id} className="flex items-center gap-3 p-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-container">
                      {blockedUser.avatar ? (
                        <img src={blockedUser.avatar} alt={blockedUser.username} className="h-full w-full object-cover" />
                      ) : (
                        <AppIcon name="person" className="text-[18px]" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-on-surface">
                      {blockedUser.username}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleUnblock(blockedUser._id)}
                      className="rounded-lg border border-outline-variant px-3 py-2 text-xs font-semibold hover:bg-surface-container-low"
                    >
                      Bỏ chặn
                    </button>
                  </div>
                ))}
              </div>
              {accountControlError && <p className="mt-4 text-sm text-error">{accountControlError}</p>}
            </section>

            <form
              onSubmit={handlePasswordSubmit}
              className="rounded-xl border border-outline-variant bg-surface-container-lowest p-5 md:p-6"
            >
              <h2 className="text-lg font-semibold tracking-[-0.03em] text-on-surface">
                Đổi mật khẩu
              </h2>
              <p className="mt-1 text-sm text-on-surface-variant">
                Chỉ áp dụng với tài khoản đăng nhập bằng email/mật khẩu.
              </p>

              <div className="mt-5 grid gap-4">
                <label className="grid gap-2 text-sm font-medium text-on-surface">
                  Mật khẩu hiện tại
                  <input
                    type="password"
                    value={passwordForm.currentPassword}
                    onChange={(event) =>
                      setPasswordForm((prev) => ({ ...prev, currentPassword: event.target.value }))
                    }
                    className="h-11 rounded-lg border border-outline-variant bg-surface px-3 text-sm outline-none transition-colors focus:border-accent"
                  />
                </label>

                <label className="grid gap-2 text-sm font-medium text-on-surface">
                  Mật khẩu mới
                  <input
                    type="password"
                    value={passwordForm.newPassword}
                    onChange={(event) =>
                      setPasswordForm((prev) => ({ ...prev, newPassword: event.target.value }))
                    }
                    className="h-11 rounded-lg border border-outline-variant bg-surface px-3 text-sm outline-none transition-colors focus:border-accent"
                    minLength={6}
                  />
                </label>
              </div>

              {passwordError && <p className="mt-4 text-sm text-error">{passwordError}</p>}
              {passwordMessage && <p className="mt-4 text-sm text-secondary">{passwordMessage}</p>}

              <button
                type="submit"
                className="mt-6 h-11 rounded-lg border border-outline-variant px-5 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-low"
              >
                Đổi mật khẩu
              </button>
            </form>
          </div>

          <aside className="h-fit rounded-xl border border-outline-variant bg-surface-container-lowest p-5">
            <h2 className="text-sm font-semibold text-on-surface">Tài khoản</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="text-on-surface-variant">Email</dt>
                <dd className="mt-1 break-all font-medium text-on-surface">{profile.email}</dd>
              </div>
              <div>
                <dt className="text-on-surface-variant">Provider</dt>
                <dd className="mt-1 font-medium capitalize text-on-surface">{profile.provider}</dd>
              </div>
            </dl>

            <button
              type="button"
              onClick={handleLogout}
              className="mt-6 h-11 w-full rounded-lg border border-error/30 text-sm font-semibold text-error transition-colors hover:bg-error-container"
            >
              Đăng xuất
            </button>
          </aside>
        </div>
      </div>
    </section>
  );
};

export default SettingsPanel;
