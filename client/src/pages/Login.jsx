import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import { Link, useNavigate, useLocation } from 'react-router-dom';

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
    <div className="grid grid-cols-1 md:grid-cols-2 bg-surface-container-low/40 backdrop-blur-2xl rounded-[2rem] overflow-hidden prism-border shadow-2xl shadow-secondary/5 w-full">
          {/* Left Side: Login */}
          <section className="p-8 md:p-12 lg:p-16 flex flex-col justify-center border-b md:border-b-0 md:border-r border-outline-variant/20 relative z-10">
            <div className="mb-10">
              <h1 className="font-headline text-4xl font-bold tracking-tighter bg-gradient-to-br from-primary via-secondary to-tertiary bg-clip-text text-transparent uppercase mb-2">
                PingMe
              </h1>
              <p className="text-on-surface-variant font-label text-sm tracking-widest uppercase">
                Truy cập Neural Hub
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6" noValidate>
              {/* Messages from Server */}
              {successMessage && (
                <div className="bg-emerald-500/10 border border-emerald-500/50 text-emerald-400 px-4 py-3 rounded-xl text-sm mb-4 font-medium backdrop-blur-md">
                  {successMessage}
                </div>
              )}
              {errors.form && (
                <div className="bg-error/10 border border-error/50 text-error px-4 py-3 rounded-xl text-sm mb-4 font-medium backdrop-blur-md">
                  {errors.form}
                </div>
              )}

              <div className="space-y-5">
                {/* Email Input */}
                <div className="group">
                  <label className="block font-label text-xs font-medium text-on-surface-variant uppercase tracking-widest mb-2 px-1">
                    ID Thần kinh <span className="text-error/80">*</span>
                  </label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline text-lg group-focus-within:text-secondary transition-colors">
                      fingerprint
                    </span>
                    <input
                      type="email"
                      name="email"
                      value={email}
                      onChange={handleEmailChange}
                      onBlur={handleEmailBlur}
                      autoComplete="email"
                      disabled={isSubmitting}
                      className={`w-full bg-surface-container-lowest border-none ring-1 ${errors.email ? 'ring-error/50 focus:ring-error/50' : 'ring-outline-variant/30 focus:ring-secondary/50'} rounded-xl py-4 pl-12 pr-4 text-on-surface placeholder:text-outline/50 focus:ring-2 transition-all outline-none`}
                      placeholder="Neural ID (Email)"
                    />
                  </div>
                  {errors.email && <p className="mt-1.5 ml-1 text-xs text-error font-medium">{errors.email}</p>}
                </div>

                {/* Password Input */}
                <div className="group">
                  <label className="block font-label text-xs font-medium text-on-surface-variant uppercase tracking-widest mb-2 px-1">
                    Mã Truy cập <span className="text-error/80">*</span>
                  </label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline text-lg group-focus-within:text-secondary transition-colors">
                      key
                    </span>
                    <input
                      type="password"
                      name="password"
                      value={password}
                      onChange={handlePasswordChange}
                      onBlur={handlePasswordBlur}
                      autoComplete="current-password"
                      disabled={isSubmitting}
                      className={`w-full bg-surface-container-lowest border-none ring-1 ${errors.password ? 'ring-error/50 focus:ring-error/50' : 'ring-outline-variant/30 focus:ring-secondary/50'} rounded-xl py-4 pl-12 pr-4 text-on-surface placeholder:text-outline/50 focus:ring-2 transition-all outline-none`}
                      placeholder="Access Code (Mật khẩu)"
                    />
                  </div>
                  {errors.password && <p className="mt-1.5 ml-1 text-xs text-error font-medium">{errors.password}</p>}
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded border-outline-variant bg-surface-container text-primary focus:ring-primary/20 bg-transparent"
                  />
                  <span className="text-xs text-on-surface-variant group-hover:text-on-surface transition-colors">
                    Ghi nhớ tôi
                  </span>
                </label>
                <a className="text-xs text-secondary hover:text-primary transition-colors font-medium" href="#">
                  Quên mã?
                </a>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full mt-4 py-4 rounded-xl font-headline font-bold text-on-primary-fixed bg-gradient-to-r from-primary-dim via-secondary to-tertiary-fixed shadow-lg shadow-primary/20 hover:shadow-secondary/40 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:scale-100"
              >
                {isSubmitting ? 'ĐANG KẾT NỐI...' : 'ĐĂNG NHẬP'}
                {!isSubmitting && <span className="material-symbols-outlined">login</span>}
              </button>
            </form>
          </section>

          {/* Right Side: Register/Uplink */}
          <section className="relative p-8 md:p-12 lg:p-16 bg-surface-container-highest/30 flex flex-col justify-center overflow-hidden z-10">
            {/* Abstract Decorative Element */}
            <div className="absolute -top-24 -right-24 w-64 h-64 bg-secondary/10 blur-[80px] rounded-full"></div>

            <div className="relative z-10 space-y-10">
              <div>
                <h2 className="font-headline text-3xl font-bold text-on-surface mb-4">New Uplink</h2>
                <p className="text-on-surface-variant leading-relaxed max-w-xs text-sm">
                  Khởi tạo kết nối thần kinh của bạn và tham gia vào mạng lưới truyền tin phi tập trung thế hệ mới.
                </p>
              </div>

              <div className="space-y-4">
                <div className="flex items-start gap-4 p-4 rounded-2xl bg-surface-container-low/50 border border-outline-variant/10">
                  <div className="bg-secondary/10 p-2 rounded-lg">
                    <span className="material-symbols-outlined text-secondary" style={{ fontVariationSettings: "'FILL' 1" }}>
                      security
                    </span>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-on-surface">Mã hóa Quantum</h4>
                    <p className="text-xs text-on-surface-variant mt-1.5 leading-relaxed">Bảo vệ dữ liệu đầu cuối bằng công nghệ tối tân.</p>
                  </div>
                </div>

                <div className="flex items-start gap-4 p-4 rounded-2xl bg-surface-container-low/50 border border-outline-variant/10">
                  <div className="bg-primary/10 p-2 rounded-lg">
                    <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>
                      speed
                    </span>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-on-surface">Độ trễ bằng 0</h4>
                    <p className="text-xs text-on-surface-variant mt-1.5 leading-relaxed">Giao tiếp thời gian thực không giới hạn khoảng cách.</p>
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => navigate('/register')}
                  className="w-full py-4 rounded-xl font-headline font-bold text-secondary border border-secondary/30 hover:bg-secondary/10 hover:border-secondary/60 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                  TẠO KẾT NỐI MỚI (ĐĂNG KÝ)
                  <span className="material-symbols-outlined">rocket_launch</span>
                </button>
              </div>

              <div className="flex justify-center gap-6 text-outline/40">
                <span className="material-symbols-outlined">hub</span>
                <span className="material-symbols-outlined">stream</span>
                <span className="material-symbols-outlined">groups</span>
                <span className="material-symbols-outlined">archive</span>
              </div>
            </div>

            {/* Subtle Light Ray Effect */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-secondary/20 to-transparent"></div>
              <div className="absolute bottom-0 right-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/20 to-transparent"></div>
            </div>
          </section>
    </div>
  );
};

export default Login;
