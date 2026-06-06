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
