import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import AppIcon from '../components/ui/AppIcon';

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
          state: { message: 'Đăng ký thành công. Vui lòng đăng nhập.' },
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
    <div className="grid w-full overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest md:grid-cols-[0.95fr_1.05fr]">
          {/* Left Side: Notice / Return to Login */}
          <section className="relative z-10 hidden flex-col justify-center overflow-hidden border-r border-outline-variant bg-surface-container-low p-8 md:flex md:p-12 lg:p-16">
            <div className="relative z-10 space-y-10">
              <div>
                <h2 className="mb-4 font-headline text-3xl font-semibold tracking-[-0.03em] text-on-surface">
                  PingMe
                </h2>
                <p className="text-sm leading-6 text-on-surface-variant">
                  Một app chat nhỏ để bạn học realtime, socket events và cách đồng bộ trạng thái giữa client với server.
                </p>
              </div>

              <div className="pt-10">
                <p className="mb-4 text-sm text-on-surface-variant">Đã có tài khoản?</p>
                <button
                  type="button"
                  onClick={() => navigate('/login')}
                  className="flex w-full items-center justify-center gap-2 rounded-md border border-outline-variant bg-surface-container-lowest py-4 font-headline font-semibold text-on-surface transition-colors hover:bg-surface-container-high active:scale-[0.98]"
                >
                  Đăng nhập
                  <AppIcon name="login" />
                </button>
              </div>
            </div>
          </section>

          {/* Right Side: Register Form */}
          <section className="relative z-10 flex flex-col justify-center p-8 md:p-12 lg:p-16">
            <div className="mb-8">
              <h1 className="mb-2 font-headline text-3xl font-semibold tracking-[-0.03em] text-on-surface">
                Tạo tài khoản
              </h1>
              <p className="text-sm leading-6 text-on-surface-variant">
                Nhập thông tin cơ bản để bắt đầu trò chuyện.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              {errors.form && (
                <div className="mb-4 rounded-lg border border-error/20 bg-error-container px-4 py-3 text-sm font-medium text-error">
                  {errors.form}
                </div>
              )}

              {/* Username Input */}
              <div className="group">
                <div className="relative">
                    <AppIcon name="account_circle" className="absolute left-4 top-1/2 -translate-y-1/2 text-lg text-outline transition-colors group-focus-within:text-on-surface" />
                  <input
                    type="text"
                    name="username"
                    value={formData.username}
                    onChange={handleChange}
                    onBlur={() => handleBlur('username')}
                    autoComplete="username"
                    disabled={isSubmitting}
                    className={`w-full rounded-lg border bg-surface-container-lowest py-3.5 pl-12 pr-4 text-sm text-on-surface outline-none transition-colors placeholder:text-on-surface-variant ${errors.username ? 'border-error focus:border-error' : 'border-outline-variant focus:border-primary'}`}
                    placeholder="Tên người dùng"
                  />
                </div>
                {errors.username && <p className="ml-1 mt-1 text-[11px] font-medium text-error">{errors.username}</p>}
              </div>

              {/* Email Input */}
              <div className="group">
                <div className="relative">
                    <AppIcon name="alternate_email" className="absolute left-4 top-1/2 -translate-y-1/2 text-lg text-outline transition-colors group-focus-within:text-on-surface" />
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    onBlur={() => handleBlur('email')}
                    autoComplete="email"
                    disabled={isSubmitting}
                    className={`w-full rounded-lg border bg-surface-container-lowest py-3.5 pl-12 pr-4 text-sm text-on-surface outline-none transition-colors placeholder:text-on-surface-variant ${errors.email ? 'border-error focus:border-error' : 'border-outline-variant focus:border-primary'}`}
                    placeholder="Email"
                  />
                </div>
                {errors.email && <p className="ml-1 mt-1 text-[11px] font-medium text-error">{errors.email}</p>}
              </div>

              {/* Password Input */}
              <div className="group">
                <div className="relative">
                    <AppIcon name="password" className="absolute left-4 top-1/2 -translate-y-1/2 text-lg text-outline transition-colors group-focus-within:text-on-surface" />
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    onBlur={() => handleBlur('password')}
                    autoComplete="new-password"
                    disabled={isSubmitting}
                    className={`w-full rounded-lg border bg-surface-container-lowest py-3.5 pl-12 pr-4 text-sm text-on-surface outline-none transition-colors placeholder:text-on-surface-variant ${errors.password ? 'border-error focus:border-error' : 'border-outline-variant focus:border-primary'}`}
                    placeholder="Mật khẩu"
                  />
                </div>
                {errors.password && <p className="ml-1 mt-1 text-[11px] font-medium text-error">{errors.password}</p>}
              </div>

              {/* Confirm Password Input */}
              <div className="group">
                <div className="relative">
                    <AppIcon name="verified_user" className="absolute left-4 top-1/2 -translate-y-1/2 text-lg text-outline transition-colors group-focus-within:text-on-surface" />
                  <input
                    type="password"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    onBlur={() => handleBlur('confirmPassword')}
                    autoComplete="new-password"
                    disabled={isSubmitting}
                    className={`w-full rounded-lg border bg-surface-container-lowest py-3.5 pl-12 pr-4 text-sm text-on-surface outline-none transition-colors placeholder:text-on-surface-variant ${errors.confirmPassword ? 'border-error focus:border-error' : 'border-outline-variant focus:border-primary'}`}
                    placeholder="Xác nhận mã truy cập"
                  />
                </div>
                {errors.confirmPassword ? (
                  <p className="ml-1 mt-1 text-[11px] font-medium text-error">{errors.confirmPassword}</p>
                ) : !errors.confirmPassword && formData.confirmPassword && formData.password === formData.confirmPassword ? (
                  <p className="ml-1 mt-1 text-[11px] font-medium text-secondary">Mật khẩu khớp</p>
                ) : null}
              </div>

              <div className="pt-3">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex w-full items-center justify-center gap-2 rounded-md bg-primary py-4 font-headline font-semibold text-white transition-colors hover:bg-primary-dark active:scale-[0.98] disabled:scale-100 disabled:opacity-50"
                >
                  {isSubmitting ? 'Đang tạo tài khoản...' : 'Tạo tài khoản'}
                  {!isSubmitting && <AppIcon name="add_moderator" />}
                </button>
              </div>

              {/* Mobile Only Login Link */}
              <div className="md:hidden mt-6 flex flex-col items-center">
                <p className="mb-2 text-xs text-on-surface-variant">Đã có tài khoản?</p>
                <button
                  type="button"
                  onClick={() => navigate('/login')}
                  className="w-full rounded-md border border-outline-variant py-3 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-low"
                >
                  Đăng nhập
                </button>
              </div>
            </form>
          </section>
    </div>
  );
};

export default Register;
