import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import AppIcon from '../components/ui/AppIcon';

/**
 * Login Page - Trang đăng nhập (Đơn giản hóa + Debug)
 */
const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Hiển thị message từ register page (nếu có)
  useEffect(() => {
    if (location.state?.message) {
      setSuccessMessage(location.state.message);
      const timer = setTimeout(() => setSuccessMessage(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [location]);

  // Validation functions
  const validateEmail = (emailValue) => {
    if (!emailValue) {
      return 'Email là bắt buộc';
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailValue)) {
      return 'Email không hợp lệ';
    }
    return '';
  };

  const validatePassword = (passwordValue) => {
    if (!passwordValue) {
      return 'Mật khẩu là bắt buộc';
    }
    if (passwordValue.length < 6) {
      return 'Mật khẩu phải có ít nhất 6 ký tự';
    }
    return '';
  };

  // Handle input changes
  const handleEmailChange = (e) => {
    const value = e.target.value;
    setEmail(value);
    // Clear error khi user bắt đầu nhập
    if (errors.email || errors.form) {
      setErrors((prev) => {
        const { email: _email, form: _form, ...rest } = prev;
        return rest;
      });
    }
  };

  const handlePasswordChange = (e) => {
    const value = e.target.value;
    setPassword(value);
    // Clear error khi user bắt đầu nhập
    if (errors.password || errors.form) {
      setErrors((prev) => {
        const { password: _password, form: _form, ...rest } = prev;
        return rest;
      });
    }
  };

  // Validate on blur
  const handleEmailBlur = () => {
    const error = validateEmail(email);
    if (error) {
      setErrors((prev) => ({ ...prev, email: error }));
    }
  };

  const handlePasswordBlur = () => {
    const error = validatePassword(password);
    if (error) {
      setErrors((prev) => ({ ...prev, password: error }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Prevent double submission
    if (isSubmitting) {
      console.log('⏸️ Already submitting, ignoring...');
      return;
    }

    setSuccessMessage('');

    // Validate all fields
    const emailError = validateEmail(email);
    const passwordError = validatePassword(password);

    const newErrors = {};
    if (emailError) newErrors.email = emailError;
    if (passwordError) newErrors.password = passwordError;

    // Nếu có lỗi validation, hiển thị và dừng
    if (Object.keys(newErrors).length > 0) {
      console.log('❌ Validation errors:', newErrors);
      setErrors(newErrors);
      return;
    }

    // Clear errors và bắt đầu submit
    setErrors({});
    setIsSubmitting(true);

    try {
      const result = await login({ email, password });

      if (result && result.success) {
        // Login thành công - redirect
        navigate('/chat', { replace: true });
      } else {
        // Login thất bại - hiển thị lỗi từ backend
        setErrors({ form: result?.error || 'Đăng nhập thất bại' });
      }
    } catch (error) {
      // Lỗi không mong đợi
      console.error('💥 Unexpected error:', error);
      setErrors({ form: error?.message || 'Có lỗi xảy ra. Vui lòng thử lại.' });
    } finally {
      console.log('🏁 Login process finished, setting isSubmitting to false');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="grid w-full max-w-[1000px] overflow-hidden rounded-[16px] border border-outline-variant bg-surface md:grid-cols-[1.05fr_0.95fr] shadow-sm">
          {/* Left Side: Login */}
          <section className="relative z-10 flex flex-col justify-center border-b border-outline-variant p-8 md:border-b-0 md:border-r md:p-12 lg:p-16 bg-surface-container-lowest">
            <div className="mb-10">
              <h1 className="mb-2 text-[28px] font-medium tracking-tight text-on-surface">
                PingMe
              </h1>
              <p className="max-w-sm text-[15px] leading-relaxed text-on-surface-variant">
                Đăng nhập để tiếp tục trò chuyện.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6" noValidate>
              {/* Messages from Server */}
              {successMessage && (
                <div className="mb-4 rounded-lg border border-secondary/20 bg-secondary-container px-4 py-3 text-sm font-medium text-secondary">
                  {successMessage}
                </div>
              )}
              {errors.form && (
                <div className="mb-4 rounded-lg border border-error/20 bg-error-container px-4 py-3 text-sm font-medium text-error">
                  {errors.form}
                </div>
              )}

              <div className="space-y-5">
                {/* Email Input */}
                <div className="group">
                  <label className="mb-2 block px-1 text-xs font-medium text-on-surface-variant">
                    Email <span className="text-error">*</span>
                  </label>
                  <div className="relative">
                    <AppIcon name="fingerprint" className="absolute left-4 top-1/2 -translate-y-1/2 text-lg text-outline transition-colors group-focus-within:text-on-surface" />
                    <input
                      type="email"
                      name="email"
                      value={email}
                      onChange={handleEmailChange}
                      onBlur={handleEmailBlur}
                      autoComplete="email"
                      disabled={isSubmitting}
                      className={`w-full rounded-[8px] border bg-surface py-3 pl-11 pr-4 text-[15px] text-on-surface outline-none transition-colors placeholder:text-on-surface-variant focus:ring-1 ${errors.email ? 'border-error focus:border-error focus:ring-error' : 'border-outline-variant focus:border-primary focus:ring-primary'}`}
                      placeholder="you@example.com"
                    />
                  </div>
                  {errors.email && <p className="ml-1 mt-1.5 text-xs font-medium text-error">{errors.email}</p>}
                </div>

                {/* Password Input */}
                <div className="group">
                  <label className="mb-2 block px-1 text-xs font-medium text-on-surface-variant">
                    Mật khẩu <span className="text-error">*</span>
                  </label>
                  <div className="relative">
                    <AppIcon name="key" className="absolute left-4 top-1/2 -translate-y-1/2 text-lg text-outline transition-colors group-focus-within:text-on-surface" />
                    <input
                      type="password"
                      name="password"
                      value={password}
                      onChange={handlePasswordChange}
                      onBlur={handlePasswordBlur}
                      autoComplete="current-password"
                      disabled={isSubmitting}
                      className={`w-full rounded-[8px] border bg-surface py-3 pl-11 pr-4 text-[15px] text-on-surface outline-none transition-colors placeholder:text-on-surface-variant focus:ring-1 ${errors.password ? 'border-error focus:border-error focus:ring-error' : 'border-outline-variant focus:border-primary focus:ring-primary'}`}
                      placeholder="Nhập mật khẩu"
                    />
                  </div>
                  {errors.password && <p className="ml-1 mt-1.5 text-xs font-medium text-error">{errors.password}</p>}
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <label className="group flex cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-outline-variant bg-surface-container text-primary focus:ring-primary/20"
                  />
                  <span className="text-xs text-on-surface-variant transition-colors group-hover:text-on-surface">
                    Ghi nhớ tôi
                  </span>
                </label>
                <span className="text-xs text-on-surface-variant">Quên mật khẩu chưa hỗ trợ</span>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-[8px] bg-primary py-3 font-medium text-surface transition-colors hover:opacity-90 active:scale-[0.98] disabled:scale-100 disabled:opacity-50"
              >
                {isSubmitting ? 'Đang đăng nhập...' : 'Đăng nhập'}
                {!isSubmitting && <AppIcon name="login" />}
              </button>
            </form>
          </section>

          {/* Right Side: Register/Uplink */}
          <section className="relative z-10 flex flex-col justify-center overflow-hidden bg-surface-container-low p-8 md:p-12 lg:p-16">
            <div className="relative z-10 space-y-10">
              <div>
                <h2 className="mb-3 text-[22px] font-medium tracking-tight text-on-surface">
                  Chưa có tài khoản?
                </h2>
                <p className="max-w-xs text-[15px] leading-relaxed text-on-surface-variant">
                  Tạo tài khoản mới để nhắn tin, gọi thoại và theo dõi trạng thái bạn bè theo thời gian thực.
                </p>
              </div>

              <div className="space-y-4">
                <div className="flex items-start gap-3 rounded-[12px] border border-outline-variant bg-surface-container-lowest p-4">
                  <div className="flex shrink-0 items-center justify-center rounded-[8px] bg-secondary-container p-2">
                    <AppIcon name="security" className="text-secondary text-[20px]" />
                  </div>
                  <div>
                    <h4 className="text-[14px] font-medium text-on-surface">Bảo mật nâng cao</h4>
                    <p className="mt-1 text-[13px] leading-relaxed text-on-surface-variant">
                      Phiên đăng nhập được mã hóa và lưu trữ an toàn.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-[12px] border border-outline-variant bg-surface-container-lowest p-4">
                  <div className="flex shrink-0 items-center justify-center rounded-[8px] bg-secondary-container p-2">
                    <AppIcon name="speed" className="text-secondary text-[20px]" />
                  </div>
                  <div>
                    <h4 className="text-[14px] font-medium text-on-surface">Realtime nhanh chóng</h4>
                    <p className="mt-1 text-[13px] leading-relaxed text-on-surface-variant">
                      Tin nhắn hiển thị tức thời nhờ Socket.IO.
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => navigate('/register')}
                  className="flex w-full items-center justify-center gap-2 rounded-[8px] border border-outline-variant bg-surface-container-lowest py-3 font-medium text-on-surface transition-colors hover:bg-surface-container-high active:scale-[0.98]"
                >
                  Tạo tài khoản
                  <AppIcon name="person_add" className="text-[18px]" />
                </button>
              </div>
            </div>
          </section>
    </div>
  );
};

export default Login;
