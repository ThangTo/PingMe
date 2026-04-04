import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import { Link, useNavigate } from 'react-router-dom';

/**
 * Register Page - Trang đăng ký (Đơn giản hóa)
 */
const Register = () => {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  // Validation functions
  const validateUsername = (username) => {
    if (!username) {
      return 'Tên người dùng là bắt buộc';
    }
    if (username.length < 3) {
      return 'Tên người dùng phải có ít nhất 3 ký tự';
    }
    if (username.length > 30) {
      return 'Tên người dùng không được vượt quá 30 ký tự';
    }
    // if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    //   return 'Tên người dùng chỉ được chứa chữ cái, số và dấu gạch dưới';
    // }
    return '';
  };

  const validateEmail = (email) => {
    if (!email) {
      return 'Email là bắt buộc';
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return 'Email không hợp lệ';
    }
    return '';
  };

  const validatePassword = (password) => {
    if (!password) {
      return 'Mật khẩu là bắt buộc';
    }
    if (password.length < 6) {
      return 'Mật khẩu phải có ít nhất 6 ký tự';
    }
    return '';
  };

  const validateConfirmPassword = (confirmPassword, password) => {
    if (!confirmPassword) {
      return 'Vui lòng xác nhận mật khẩu';
    }
    if (confirmPassword !== password) {
      return 'Mật khẩu xác nhận không khớp';
    }
    return '';
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });

    // Clear error khi user bắt đầu nhập
    if (errors[name] || errors.form) {
      const newErrors = { ...errors };
      delete newErrors[name];
      delete newErrors.form;
      setErrors(newErrors);
    }
  };

  const handleBlur = (fieldName) => {
    let error = '';
    switch (fieldName) {
      case 'username':
        error = validateUsername(formData.username);
        break;
      case 'email':
        error = validateEmail(formData.email);
        break;
      case 'password':
        error = validatePassword(formData.password);
        // Nếu password thay đổi và confirmPassword đã có giá trị, validate lại confirmPassword
        if (!error && formData.confirmPassword) {
          const confirmError = validateConfirmPassword(formData.confirmPassword, formData.password);
          if (confirmError) {
            setErrors({ ...errors, password: error, confirmPassword: confirmError });
            return;
          }
        }
        break;
      case 'confirmPassword':
        error = validateConfirmPassword(formData.confirmPassword, formData.password);
        break;
      default:
        break;
    }
    if (error) {
      setErrors({ ...errors, [fieldName]: error });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Prevent double submission
    if (isSubmitting) {
      return;
    }

    // Validate all fields
    const usernameError = validateUsername(formData.username);
    const emailError = validateEmail(formData.email);
    const passwordError = validatePassword(formData.password);
    const confirmPasswordError = validateConfirmPassword(
      formData.confirmPassword,
      formData.password,
    );

    const newErrors = {};
    if (usernameError) newErrors.username = usernameError;
    if (emailError) newErrors.email = emailError;
    if (passwordError) newErrors.password = passwordError;
    if (confirmPasswordError) newErrors.confirmPassword = confirmPasswordError;

    // Nếu có lỗi validation, hiển thị và dừng
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // Clear errors và bắt đầu submit
    setErrors({});
    setIsSubmitting(true);

    try {
      const result = await register({
        username: formData.username,
        email: formData.email,
        password: formData.password,
      });

      if (result && result.success) {
        // Đăng ký thành công - redirect về login với success message
        navigate('/login', {
          replace: true,
          state: { message: 'Đăng ký thành công! Vui lòng đăng nhập.' },
        });
      } else {
        // Đăng ký thất bại - hiển thị lỗi từ backend
        setErrors({ form: result?.error || 'Đăng ký thất bại' });
      }
    } catch (error) {
      // Lỗi không mong đợi
      setErrors({ form: error?.message || 'Có lỗi xảy ra. Vui lòng thử lại.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 bg-surface-container-low/40 backdrop-blur-2xl rounded-[2rem] overflow-hidden prism-border shadow-2xl shadow-secondary/5 w-full">
          {/* Left Side: Notice / Return to Login */}
          <section className="relative p-8 md:p-12 lg:p-16 bg-surface-container-highest/30 flex flex-col justify-center overflow-hidden z-10 hidden md:flex border-r border-outline-variant/20">
            <div className="absolute -top-24 -left-24 w-64 h-64 bg-secondary/10 blur-[80px] rounded-full"></div>
            <div className="relative z-10 space-y-10">
              <div>
                <h2 className="font-headline text-3xl font-bold text-on-surface mb-4">Neural Hub</h2>
                <p className="text-on-surface-variant leading-relaxed text-sm">
                  Cổng kết nối vào thế giới lượng tử siêu tốc. Giao tiếp realtime, không lưu vết, bảo mật tuyệt đối.
                </p>
              </div>

              <div className="flex justify-start gap-6 text-outline/40">
                <span className="material-symbols-outlined">hub</span>
                <span className="material-symbols-outlined">stream</span>
                <span className="material-symbols-outlined">groups</span>
              </div>

              <div className="pt-10">
                <p className="text-sm text-on-surface-variant mb-4 font-label uppercase tracking-widest">Đã có ID Thần kinh?</p>
                <button
                  type="button"
                  onClick={() => navigate('/login')}
                  className="w-full py-4 rounded-xl font-headline font-bold text-secondary border border-secondary/30 hover:bg-secondary/10 hover:border-secondary/60 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                  TRUY CẬP (ĐĂNG NHẬP)
                  <span className="material-symbols-outlined">login</span>
                </button>
              </div>
            </div>

            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-0 right-0 w-full h-1 bg-gradient-to-l from-transparent via-secondary/20 to-transparent"></div>
              <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-l from-transparent via-primary/20 to-transparent"></div>
            </div>
          </section>

          {/* Right Side: Register Form */}
          <section className="p-8 md:p-12 lg:p-16 flex flex-col justify-center relative z-10 bg-surface-container-lowest/20">
            <div className="mb-8">
              <h1 className="font-headline text-3xl font-bold tracking-tighter text-on-surface uppercase mb-2">
                Init Uplink
              </h1>
              <p className="text-on-surface-variant font-label text-xs tracking-widest uppercase">
                Tạo mã định danh mới
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              {errors.form && (
                <div className="bg-error/10 border border-error/50 text-error px-4 py-3 rounded-xl text-sm mb-4 font-medium backdrop-blur-md">
                  {errors.form}
                </div>
              )}

              {/* Username Input */}
              <div className="group">
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline text-lg group-focus-within:text-primary transition-colors">
                    account_circle
                  </span>
                  <input
                    type="text"
                    name="username"
                    value={formData.username}
                    onChange={handleChange}
                    onBlur={() => handleBlur('username')}
                    autoComplete="username"
                    disabled={isSubmitting}
                    className={`w-full bg-surface-container border-none ring-1 ${errors.username ? 'ring-error/50 focus:ring-error/50' : 'ring-outline-variant/30 focus:ring-primary/50'} rounded-xl py-3.5 pl-12 pr-4 text-sm text-on-surface placeholder:text-outline/50 focus:ring-2 transition-all outline-none`}
                    placeholder="Bí danh (Username)"
                  />
                </div>
                {errors.username && <p className="mt-1 ml-1 text-[11px] text-error font-medium">{errors.username}</p>}
              </div>

              {/* Email Input */}
              <div className="group">
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline text-lg group-focus-within:text-primary transition-colors">
                    alternate_email
                  </span>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    onBlur={() => handleBlur('email')}
                    autoComplete="email"
                    disabled={isSubmitting}
                    className={`w-full bg-surface-container border-none ring-1 ${errors.email ? 'ring-error/50 focus:ring-error/50' : 'ring-outline-variant/30 focus:ring-primary/50'} rounded-xl py-3.5 pl-12 pr-4 text-sm text-on-surface placeholder:text-outline/50 focus:ring-2 transition-all outline-none`}
                    placeholder="ID Liên lạc (Email)"
                  />
                </div>
                {errors.email && <p className="mt-1 ml-1 text-[11px] text-error font-medium">{errors.email}</p>}
              </div>

              {/* Password Input */}
              <div className="group">
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline text-lg group-focus-within:text-primary transition-colors">
                    password
                  </span>
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    onBlur={() => handleBlur('password')}
                    autoComplete="new-password"
                    disabled={isSubmitting}
                    className={`w-full bg-surface-container border-none ring-1 ${errors.password ? 'ring-error/50 focus:ring-error/50' : 'ring-outline-variant/30 focus:ring-primary/50'} rounded-xl py-3.5 pl-12 pr-4 text-sm text-on-surface placeholder:text-outline/50 focus:ring-2 transition-all outline-none`}
                    placeholder="Mã truy cập (Mật khẩu)"
                  />
                </div>
                {errors.password && <p className="mt-1 ml-1 text-[11px] text-error font-medium">{errors.password}</p>}
              </div>

              {/* Confirm Password Input */}
              <div className="group">
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline text-lg group-focus-within:text-primary transition-colors">
                    verified_user
                  </span>
                  <input
                    type="password"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    onBlur={() => handleBlur('confirmPassword')}
                    autoComplete="new-password"
                    disabled={isSubmitting}
                    className={`w-full bg-surface-container border-none ring-1 ${errors.confirmPassword ? 'ring-error/50 focus:ring-error/50' : 'ring-outline-variant/30 focus:ring-primary/50'} rounded-xl py-3.5 pl-12 pr-4 text-sm text-on-surface placeholder:text-outline/50 focus:ring-2 transition-all outline-none`}
                    placeholder="Xác nhận mã truy cập"
                  />
                </div>
                {errors.confirmPassword ? (
                  <p className="mt-1 ml-1 text-[11px] text-error font-medium">{errors.confirmPassword}</p>
                ) : !errors.confirmPassword && formData.confirmPassword && formData.password === formData.confirmPassword ? (
                  <p className="mt-1 ml-1 text-[11px] text-secondary font-medium">✓ Mã khóa hợp lệ</p>
                ) : null}
              </div>

              <div className="pt-3">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-4 rounded-xl font-headline font-bold text-on-primary-fixed bg-gradient-to-r from-primary-dim via-secondary to-tertiary-fixed shadow-lg shadow-primary/20 hover:shadow-secondary/40 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:scale-100 uppercase tracking-wider"
                >
                  {isSubmitting ? 'ĐANG KHỞI TẠO...' : 'TẠO ĐỊNH DANH'}
                  {!isSubmitting && <span className="material-symbols-outlined">add_moderator</span>}
                </button>
              </div>

              {/* Mobile Only Login Link */}
              <div className="md:hidden mt-6 flex flex-col items-center">
                <p className="text-xs text-on-surface-variant font-label mb-2 uppercase">Đã có tài khoản?</p>
                <button
                  type="button"
                  onClick={() => navigate('/login')}
                  className="w-full py-3 rounded-xl font-headline font-bold text-secondary border border-outline-variant/30 hover:bg-secondary/10 transition-all text-sm"
                >
                  ĐĂNG NHẬP
                </button>
              </div>
            </form>
          </section>
    </div>
  );
};

export default Register;
