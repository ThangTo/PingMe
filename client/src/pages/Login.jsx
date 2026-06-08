import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import AuthPreview from '../components/layout/AuthPreview';
import AppIcon from '../components/ui/AppIcon';
import AppModal from '../components/ui/AppModal';
import PingMeLogo from '../components/ui/PingMeLogo';
import PingMeWordmark from '../components/ui/PingMeWordmark';
import { useAuth } from '../context/AuthContext';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [forgotForm, setForgotForm] = useState({
    email: '',
    otpCode: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [forgotStep, setForgotStep] = useState('email');
  const [forgotError, setForgotError] = useState('');
  const [forgotMessage, setForgotMessage] = useState('');
  const [isForgotOpen, setIsForgotOpen] = useState(false);
  const [isForgotSubmitting, setIsForgotSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login, requestPasswordReset, resetPassword, startGoogleAuth } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (location.state?.message) {
      setSuccessMessage(location.state.message);
      const timer = setTimeout(() => setSuccessMessage(''), 5000);
      return () => clearTimeout(timer);
    }
    const authError = new URLSearchParams(location.search).get('authError');
    if (authError) {
      setErrors({ form: authError });
    }
  }, [location]);

  const validateEmail = (emailValue) => {
    if (!emailValue) return 'Email là bắt buộc';
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailValue)) return 'Email không hợp lệ. Vui lòng nhập lại.';
    return '';
  };

  const validatePassword = (passwordValue) => {
    if (!passwordValue) return 'Mật khẩu là bắt buộc';
    if (passwordValue.length < 6) return 'Mật khẩu phải có ít nhất 6 ký tự';
    return '';
  };

  const clearFieldError = (field) => {
    if (!errors[field] && !errors.form) return;
    setErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      delete next.form;
      return next;
    });
  };

  const handleEmailChange = (event) => {
    setEmail(event.target.value);
    clearFieldError('email');
  };

  const handlePasswordChange = (event) => {
    setPassword(event.target.value);
    clearFieldError('password');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isSubmitting) return;

    setSuccessMessage('');
    const nextErrors = {};
    const emailError = validateEmail(email);
    const passwordError = validatePassword(password);
    if (emailError) nextErrors.email = emailError;
    if (passwordError) nextErrors.password = passwordError;

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setErrors({});
    setIsSubmitting(true);

    try {
      const result = await login({ email, password });
      if (result?.success) {
        navigate('/chat', { replace: true });
      } else {
        setErrors({ form: result?.error || 'Đăng nhập thất bại' });
      }
    } catch (error) {
      setErrors({ form: error?.message || 'Có lỗi xảy ra. Vui lòng thử lại.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const openForgotPassword = () => {
    setForgotForm((current) => ({ ...current, email }));
    setForgotStep('email');
    setForgotError('');
    setForgotMessage('');
    setIsForgotOpen(true);
  };

  const handleForgotChange = (field, value) => {
    setForgotForm((current) => ({ ...current, [field]: value }));
    setForgotError('');
  };

  const handleForgotSubmit = async (event) => {
    event.preventDefault();
    if (isForgotSubmitting) return;

    setForgotError('');
    setForgotMessage('');
    setIsForgotSubmitting(true);

    try {
      if (forgotStep === 'email') {
        const result = await requestPasswordReset({ email: forgotForm.email });
        if (!result?.success) {
          setForgotError(result?.error || 'Không thể gửi OTP đặt lại mật khẩu');
          return;
        }
        setForgotStep('reset');
        setForgotMessage(result.message || 'Nếu email tồn tại, OTP đã được gửi.');
        return;
      }

      if (!/^\d{6}$/.test(forgotForm.otpCode.trim())) {
        setForgotError('Nhập mã OTP gồm 6 chữ số');
        return;
      }

      if (!forgotForm.newPassword || forgotForm.newPassword.length < 6) {
        setForgotError('Mật khẩu mới phải có ít nhất 6 ký tự');
        return;
      }

      if (forgotForm.newPassword !== forgotForm.confirmPassword) {
        setForgotError('Mật khẩu xác nhận không khớp');
        return;
      }

      const result = await resetPassword({
        email: forgotForm.email,
        otpCode: forgotForm.otpCode,
        newPassword: forgotForm.newPassword,
      });

      if (!result?.success) {
        setForgotError(result?.error || 'Không thể đặt lại mật khẩu');
        return;
      }

      setIsForgotOpen(false);
      setSuccessMessage(result.message || 'Đã đặt lại mật khẩu. Vui lòng đăng nhập lại.');
    } finally {
      setIsForgotSubmitting(false);
    }
  };

  return (
    <div className="relative flex w-full flex-1 overflow-hidden bg-surface md:min-h-[calc(100dvh-40px)] md:rounded-[18px] md:border md:border-outline md:quiet-shadow lg:min-h-[calc(100dvh-56px)]">
      <section className="relative flex min-h-[100dvh] w-full flex-col bg-surface-container-lowest px-6 pb-7 pt-6 md:min-h-0 md:w-[49%] md:border-r md:border-outline-variant md:px-10 md:pb-5 md:pt-7 lg:px-14">
        <div className="flex items-center gap-2 font-semibold text-on-surface">
          <PingMeLogo size="sm" />
          <PingMeWordmark size="md" className="-ml-1" />
        </div>

        <div className="pointer-events-none absolute right-5 top-24 opacity-50 md:hidden">
          <span className="auth-orb grid h-16 w-16 place-items-center rounded-full">
            <AppIcon name="mode_comment" className="text-[24px] text-outline" />
          </span>
          <span className="auth-orb ml-16 mt-2 block h-10 w-12 rounded-[16px]" />
        </div>

        <div className="mx-auto flex w-full max-w-[410px] flex-1 flex-col justify-center py-10 md:py-6">
          <div className="mb-9 text-center">
            <span className="mx-auto mb-3 hidden h-14 w-14 place-items-center rounded-full bg-secondary-container text-secondary md:grid">
              <PingMeLogo size="lg" showShadow />
            </span>
            <h1 className="text-[28px] font-semibold text-on-surface md:text-[25px]">Đăng nhập</h1>
            <p className="mt-2 text-[15px] text-on-surface-variant">Chào mừng bạn trở lại 👋</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            {errors.form && (
              <div className="flex items-start gap-2 rounded-[8px] border border-error/25 bg-error-container px-3 py-2.5 text-[13px] text-error">
                <AppIcon name="sync_problem" className="mt-0.5 text-[15px]" />
                <span>{errors.form}</span>
              </div>
            )}

            <div>
              <label htmlFor="login-email" className="mb-2 block text-[12px] font-medium text-on-surface">
                Email hoặc số điện thoại
              </label>
              <input
                id="login-email"
                type="email"
                name="email"
                value={email}
                onChange={handleEmailChange}
                onBlur={() => {
                  const error = validateEmail(email);
                  if (error) setErrors((prev) => ({ ...prev, email: error }));
                }}
                autoComplete="email"
                disabled={isSubmitting}
                className={`h-12 w-full rounded-[8px] border bg-surface px-3.5 text-[15px] text-on-surface outline-none transition ${
                  errors.email
                    ? 'border-error focus:border-error focus:ring-1 focus:ring-error'
                    : 'border-outline focus:border-accent focus:ring-1 focus:ring-accent'
                }`}
                placeholder="you@example.com"
              />
              {errors.email && (
                <p className="mt-1.5 flex items-center gap-1.5 text-[11px] font-medium text-error">
                  <AppIcon name="sync_problem" className="text-[13px]" />
                  {errors.email}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="login-password" className="mb-2 block text-[12px] font-medium text-on-surface">
                Mật khẩu
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={password}
                  onChange={handlePasswordChange}
                  onBlur={() => {
                    const error = validatePassword(password);
                    if (error) setErrors((prev) => ({ ...prev, password: error }));
                  }}
                  autoComplete="current-password"
                  disabled={isSubmitting}
                  className={`h-12 w-full rounded-[8px] border bg-surface px-3.5 pr-12 text-[15px] text-on-surface outline-none transition ${
                    errors.password
                      ? 'border-error focus:border-error focus:ring-1 focus:ring-error'
                      : 'border-outline focus:border-accent focus:ring-1 focus:ring-accent'
                  }`}
                  placeholder="Nhập mật khẩu"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  className="absolute right-1 top-1 grid h-10 w-10 place-items-center rounded-[7px] text-on-surface-variant transition hover:bg-surface-container-high hover:text-on-surface"
                  aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                >
                  <AppIcon name={showPassword ? 'visibility_off' : 'visibility'} className="text-[18px]" />
                </button>
              </div>
              {errors.password && <p className="mt-1.5 text-[11px] font-medium text-error">{errors.password}</p>}
            </div>

            <div className="flex items-center justify-between gap-4 pt-0.5">
              <label className="flex cursor-pointer items-center gap-2 text-[12px] text-on-surface-variant">
                <input type="checkbox" className="h-4 w-4 rounded-[3px] border-outline accent-[#2F8A63]" />
                Ghi nhớ đăng nhập
              </label>
              <button
                type="button"
                onClick={openForgotPassword}
                className="text-[12px] font-medium text-secondary hover:underline"
              >
                Quên mật khẩu?
              </button>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-[8px] bg-secondary px-4 text-[15px] font-semibold text-white transition hover:brightness-95 active:translate-y-px disabled:cursor-wait disabled:opacity-70"
            >
              {isSubmitting ? 'Đang đăng nhập...' : 'Đăng nhập'}
              {isSubmitting && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/35 border-t-white" />}
            </button>

            <div className="flex items-center gap-4 py-1">
              <span className="h-px flex-1 bg-outline-variant" />
              <span className="text-[12px] text-on-surface-variant">hoặc</span>
              <span className="h-px flex-1 bg-outline-variant" />
            </div>

            <button
              type="button"
              onClick={() => navigate('/register')}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-[8px] border border-outline bg-surface text-[14px] font-medium text-on-surface transition hover:bg-surface-container-high md:hidden"
            >
              <AppIcon name="person_add" className="text-[17px]" />
              Tạo tài khoản
            </button>

            {/* Google auth chưa có backend, chỉ hiển thị preview trên desktop theo thiết kế. */}
            <button
              type="button"
              onClick={startGoogleAuth}
              className="hidden h-11 w-full items-center justify-center gap-2 rounded-[8px] border border-outline bg-surface text-[13px] font-medium text-on-surface transition hover:bg-surface-container-high md:flex"
              title="Đăng nhập Google chưa được kết nối"
            >
              <span className="font-semibold text-secondary">G</span>
              Tiếp tục với Google
            </button>

            <p className="hidden text-center text-[12px] text-on-surface-variant md:block">
              Chưa có tài khoản?{' '}
              <button type="button" onClick={() => navigate('/register')} className="font-medium text-secondary hover:underline">
                Tạo tài khoản
              </button>
            </p>
          </form>
        </div>

        <footer className="hidden items-center justify-between border-t border-outline-variant pt-4 text-[10px] text-on-surface-variant md:flex">
          <span className="flex items-center gap-1.5">
            <AppIcon name="language" className="text-[13px]" />
            Tiếng Việt
          </span>
          <span>Trợ giúp</span>
        </footer>
      </section>

      <section className="hidden min-w-0 flex-1 bg-surface md:block">
        <AuthPreview variant="login" />
      </section>

      <AppModal
        open={isForgotOpen}
        title="Đặt lại mật khẩu"
        description={
          forgotStep === 'email'
            ? 'Nhập email tài khoản để nhận mã OTP.'
            : 'Nhập OTP trong email và mật khẩu mới.'
        }
        onClose={() => setIsForgotOpen(false)}
      >
        <form onSubmit={handleForgotSubmit} className="space-y-3.5">
          {forgotError && (
            <div className="rounded-[8px] border border-error/25 bg-error-container px-3 py-2 text-sm text-error">
              {forgotError}
            </div>
          )}
          {forgotMessage && (
            <div className="rounded-[8px] border border-secondary/20 bg-secondary-container px-3 py-2 text-sm text-on-surface">
              {forgotMessage}
            </div>
          )}

          <label className="block text-[12px] font-medium text-on-surface">
            Email
            <input
              type="email"
              value={forgotForm.email}
              onChange={(event) => handleForgotChange('email', event.target.value)}
              disabled={isForgotSubmitting || forgotStep === 'reset'}
              className="mt-1.5 h-11 w-full rounded-[8px] border border-outline bg-surface px-3 text-[14px] text-on-surface outline-none focus:border-accent focus:ring-1 focus:ring-accent disabled:opacity-70"
              placeholder="you@example.com"
            />
          </label>

          {forgotStep === 'reset' && (
            <>
              <label className="block text-[12px] font-medium text-on-surface">
                Mã OTP
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={forgotForm.otpCode}
                  onChange={(event) =>
                    handleForgotChange('otpCode', event.target.value.replace(/\D/g, '').slice(0, 6))
                  }
                  disabled={isForgotSubmitting}
                  className="mt-1.5 h-11 w-full rounded-[8px] border border-outline bg-surface px-3 text-center text-[17px] font-semibold tracking-[0.26em] text-on-surface outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                  placeholder="000000"
                />
              </label>
              <label className="block text-[12px] font-medium text-on-surface">
                Mật khẩu mới
                <input
                  type="password"
                  value={forgotForm.newPassword}
                  onChange={(event) => handleForgotChange('newPassword', event.target.value)}
                  disabled={isForgotSubmitting}
                  className="mt-1.5 h-11 w-full rounded-[8px] border border-outline bg-surface px-3 text-[14px] text-on-surface outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                  placeholder="Nhập mật khẩu mới"
                />
              </label>
              <label className="block text-[12px] font-medium text-on-surface">
                Xác nhận mật khẩu mới
                <input
                  type="password"
                  value={forgotForm.confirmPassword}
                  onChange={(event) => handleForgotChange('confirmPassword', event.target.value)}
                  disabled={isForgotSubmitting}
                  className="mt-1.5 h-11 w-full rounded-[8px] border border-outline bg-surface px-3 text-[14px] text-on-surface outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                  placeholder="Nhập lại mật khẩu mới"
                />
              </label>
            </>
          )}

          <button
            type="submit"
            disabled={isForgotSubmitting}
            className="flex h-11 w-full items-center justify-center rounded-[8px] bg-secondary px-4 text-sm font-semibold text-white transition hover:brightness-95 disabled:cursor-wait disabled:opacity-70"
          >
            {isForgotSubmitting
              ? 'Đang xử lý...'
              : forgotStep === 'email'
                ? 'Gửi mã OTP'
                : 'Đặt lại mật khẩu'}
          </button>
        </form>
      </AppModal>

      {successMessage && (
        <div className="absolute bottom-6 left-1/2 z-20 flex w-[calc(100%-48px)] max-w-[360px] -translate-x-1/2 items-center gap-3 rounded-[10px] border border-secondary/20 bg-secondary-container px-4 py-3 quiet-shadow">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-secondary text-secondary">
            <AppIcon name="check" className="text-[16px]" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-semibold text-on-surface">Đăng ký thành công!</p>
            <p className="mt-0.5 text-[11px] text-on-surface-variant">{successMessage}</p>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMessage('')}
            className="grid h-8 w-8 place-items-center rounded-[7px] text-on-surface-variant hover:bg-surface-container-high"
            aria-label="Đóng thông báo"
          >
            <AppIcon name="close" className="text-[16px]" />
          </button>
        </div>
      )}
    </div>
  );
};

export default Login;
