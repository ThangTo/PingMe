import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AuthPreview from '../components/layout/AuthPreview';
import AppIcon from '../components/ui/AppIcon';
import PingMeLogo from '../components/ui/PingMeLogo';
import PingMeWordmark from '../components/ui/PingMeWordmark';
import { useAuth } from '../context/AuthContext';

const Register = () => {
  const [formData, setFormData] = useState({
    username: '',
    pingId: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [otpCode, setOtpCode] = useState('');
  const [otpRequested, setOtpRequested] = useState(false);
  const [otpMessage, setOtpMessage] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { register, requestRegisterOtp, startGoogleAuth } = useAuth();
  const navigate = useNavigate();

  const passwordStrength = useMemo(() => {
    const value = formData.password;
    if (!value) return 0;
    let score = 0;
    if (value.length >= 6) score += 1;
    if (value.length >= 8) score += 1;
    if (/[A-Z]/.test(value) && /[a-z]/.test(value)) score += 1;
    if (/\d/.test(value) || /[^A-Za-z0-9]/.test(value)) score += 1;
    return score;
  }, [formData.password]);

  const validateUsername = (username) => {
    if (!username) return 'Tên hiển thị là bắt buộc';
    if (username.length < 3) return 'Tên hiển thị phải có ít nhất 3 ký tự';
    if (username.length > 30) return 'Tên hiển thị không được vượt quá 30 ký tự';
    return '';
  };

  const normalizePingId = (value = '') => value.trim().replace(/^@+/, '').toLowerCase();

  const validatePingId = (pingId) => {
    const normalized = normalizePingId(pingId);
    if (!normalized) return 'PingMe ID là bắt buộc';
    if (normalized.length < 5) return 'PingMe ID phải có ít nhất 5 ký tự';
    if (normalized.length > 32) return 'PingMe ID không được vượt quá 32 ký tự';
    if (!/^[a-z][a-z0-9_]{4,31}$/.test(normalized)) {
      return 'Bắt đầu bằng chữ cái, chỉ gồm chữ thường, số và dấu gạch dưới';
    }
    return '';
  };

  const validateEmail = (email) => {
    if (!email) return 'Email là bắt buộc';
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return 'Email không hợp lệ';
    return '';
  };

  const validatePassword = (password) => {
    if (!password) return 'Mật khẩu là bắt buộc';
    if (password.length < 6) return 'Mật khẩu phải có ít nhất 6 ký tự';
    return '';
  };

  const validateConfirmPassword = (confirmPassword, password) => {
    if (!confirmPassword) return 'Vui lòng xác nhận mật khẩu';
    if (confirmPassword !== password) return 'Mật khẩu nhập lại không khớp';
    return '';
  };

  const validateField = (fieldName) => {
    const validators = {
      username: () => validateUsername(formData.username),
      pingId: () => validatePingId(formData.pingId),
      email: () => validateEmail(formData.email),
      password: () => validatePassword(formData.password),
      confirmPassword: () => validateConfirmPassword(formData.confirmPassword, formData.password),
    };
    const error = validators[fieldName]?.() || '';
    if (error) setErrors((prev) => ({ ...prev, [fieldName]: error }));
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    const nextValue = name === 'pingId' ? normalizePingId(value) : value;
    setFormData((current) => ({ ...current, [name]: nextValue }));
    if (otpRequested) {
      setOtpRequested(false);
      setOtpCode('');
      setOtpMessage('');
    }
    if (errors[name] || errors.form) {
      setErrors((current) => {
        const next = { ...current };
        delete next[name];
        delete next.form;
        return next;
      });
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isSubmitting) return;

    const nextErrors = {
      username: validateUsername(formData.username),
      pingId: validatePingId(formData.pingId),
      email: validateEmail(formData.email),
      password: validatePassword(formData.password),
      confirmPassword: validateConfirmPassword(formData.confirmPassword, formData.password),
    };

    Object.keys(nextErrors).forEach((key) => {
      if (!nextErrors[key]) delete nextErrors[key];
    });

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setErrors({});
    setIsSubmitting(true);

    try {
      if (!otpRequested) {
        const otpResult = await requestRegisterOtp({
          username: formData.username,
          pingId: normalizePingId(formData.pingId),
          email: formData.email,
          password: formData.password,
        });

        if (otpResult?.success) {
          setOtpRequested(true);
          setOtpMessage(otpResult.message || 'Đã gửi OTP đến email của bạn.');
        } else {
          setErrors({ form: otpResult?.error || 'Không thể gửi OTP đăng ký' });
        }
        return;
      }

      if (!/^\d{6}$/.test(otpCode.trim())) {
        setErrors({ otpCode: 'Nhập mã OTP gồm 6 chữ số' });
        return;
      }

      const result = await register({
        username: formData.username,
        pingId: normalizePingId(formData.pingId),
        email: formData.email,
        password: formData.password,
        otpCode: otpCode.trim(),
      });

      if (result?.success) {
        navigate('/login', {
          replace: true,
          state: { message: 'Vui lòng đăng nhập để tiếp tục.' },
        });
      } else {
        setErrors({ form: result?.error || 'Đăng ký thất bại' });
      }
    } catch (error) {
      setErrors({ form: error?.message || 'Có lỗi xảy ra. Vui lòng thử lại.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClass = (hasError) =>
    `h-11 w-full rounded-[8px] border bg-surface px-3.5 text-[14px] text-on-surface outline-none transition ${
      hasError
        ? 'border-error focus:border-error focus:ring-1 focus:ring-error'
        : 'border-outline focus:border-accent focus:ring-1 focus:ring-accent'
    }`;

  return (
    <div className="relative flex w-full flex-1 overflow-hidden bg-surface md:min-h-[calc(100dvh-40px)] md:rounded-[18px] md:border md:border-outline md:quiet-shadow lg:min-h-[calc(100dvh-56px)]">
      <section className="relative flex min-h-[100dvh] w-full flex-col bg-surface-container-lowest px-5 pb-7 pt-5 md:min-h-0 md:w-[39%] md:border-r md:border-outline-variant md:px-7 md:pb-5 md:pt-7 lg:px-10">
        <div className="flex items-center justify-center gap-2 font-semibold text-on-surface md:justify-start">
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="absolute left-4 grid h-10 w-10 place-items-center rounded-[8px] text-on-surface transition hover:bg-surface-container-high md:hidden"
            aria-label="Quay lại đăng nhập"
          >
            <AppIcon name="arrow_back" className="text-[20px]" />
          </button>
          <PingMeLogo size="sm" />
          <PingMeWordmark size="md" className="-ml-1" />
        </div>

        <div className="mx-auto flex w-full max-w-[430px] flex-1 flex-col justify-center py-7 md:py-4">
          <div className="mb-6">
            <h1 className="text-[28px] font-semibold text-on-surface md:text-[25px]">Tạo tài khoản</h1>
            <p className="mt-2 max-w-[310px] text-[14px] leading-relaxed text-on-surface-variant">
              Tham gia PingMe để kết nối với bạn bè và đồng nghiệp.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3.5" noValidate>
            {errors.form && (
              <div className="flex items-start gap-2 rounded-[8px] border border-error/25 bg-error-container px-3 py-2.5 text-[12px] text-error">
                <AppIcon name="sync_problem" className="mt-0.5 text-[14px]" />
                <span>{errors.form}</span>
              </div>
            )}

            <div>
              <label htmlFor="register-username" className="mb-1.5 block text-[11px] font-medium text-on-surface">
                Tên hiển thị
              </label>
              <div className="relative">
                <input
                  id="register-username"
                  type="text"
                  name="username"
                  value={formData.username}
                  onChange={handleChange}
                  onBlur={() => validateField('username')}
                  autoComplete="username"
                  disabled={isSubmitting}
                  className={`${inputClass(errors.username)} pr-11`}
                  placeholder="Tên của bạn"
                />
                {formData.username && !errors.username && (
                  <AppIcon name="check" className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[16px] text-secondary" />
                )}
              </div>
              {errors.username && <p className="mt-1 text-[10px] font-medium text-error">{errors.username}</p>}
            </div>

            <div>
              <label htmlFor="register-ping-id" className="mb-1.5 block text-[11px] font-medium text-on-surface">
                PingMe ID
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[14px] text-on-surface-variant">
                  @
                </span>
                <input
                  id="register-ping-id"
                  type="text"
                  name="pingId"
                  value={formData.pingId}
                  onChange={handleChange}
                  onBlur={() => validateField('pingId')}
                  autoComplete="username"
                  disabled={isSubmitting}
                  className={`${inputClass(errors.pingId)} pl-8 pr-11`}
                  placeholder="thangto"
                />
                {formData.pingId && !errors.pingId && (
                  <AppIcon name="check" className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[16px] text-secondary" />
                )}
              </div>
              <p className="mt-1 text-[9px] text-on-surface-variant">
                Dùng để người khác tìm bạn. ID là duy nhất, tên hiển thị vẫn có thể trùng.
              </p>
              {errors.pingId && <p className="mt-1 text-[10px] font-medium text-error">{errors.pingId}</p>}
            </div>

            <div>
              <label htmlFor="register-email" className="mb-1.5 block text-[11px] font-medium text-on-surface">
                Email
              </label>
              <div className="relative">
                <input
                  id="register-email"
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  onBlur={() => validateField('email')}
                  autoComplete="email"
                  disabled={isSubmitting}
                  className={`${inputClass(errors.email)} pr-11`}
                  placeholder="you@example.com"
                />
                {formData.email && !errors.email && (
                  <AppIcon name="check" className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[16px] text-secondary" />
                )}
              </div>
              {errors.email && <p className="mt-1 text-[10px] font-medium text-error">{errors.email}</p>}
            </div>

            <div>
              <label htmlFor="register-password" className="mb-1.5 block text-[11px] font-medium text-on-surface">
                Mật khẩu
              </label>
              <div className="relative">
                <input
                  id="register-password"
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  onBlur={() => validateField('password')}
                  autoComplete="new-password"
                  disabled={isSubmitting}
                  className={`${inputClass(errors.password)} pr-11`}
                  placeholder="Tạo mật khẩu"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  className="absolute right-0.5 top-0.5 grid h-10 w-10 place-items-center rounded-[7px] text-on-surface-variant hover:bg-surface-container-high"
                  aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                >
                  <AppIcon name={showPassword ? 'visibility_off' : 'visibility'} className="text-[17px]" />
                </button>
              </div>
              <div className="mt-2 flex items-center gap-1">
                {[1, 2, 3, 4].map((level) => (
                  <span
                    key={level}
                    className={`h-1 flex-1 rounded-full ${
                      passwordStrength >= level ? 'bg-secondary' : 'bg-surface-container-highest'
                    }`}
                  />
                ))}
                <span className="ml-2 text-[10px] font-medium text-secondary">
                  {passwordStrength >= 3 ? 'Mạnh' : passwordStrength > 0 ? 'Đang tăng' : ''}
                </span>
              </div>
              <p className="mt-1 text-[9px] text-on-surface-variant">
                Ít nhất 8 ký tự, gồm chữ hoa, chữ thường, số và ký tự đặc biệt.
              </p>
              {errors.password && <p className="mt-1 text-[10px] font-medium text-error">{errors.password}</p>}
            </div>

            <div>
              <label htmlFor="register-confirm-password" className="mb-1.5 block text-[11px] font-medium text-on-surface">
                Nhập lại mật khẩu
              </label>
              <div className="relative">
                <input
                  id="register-confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  onBlur={() => validateField('confirmPassword')}
                  autoComplete="new-password"
                  disabled={isSubmitting}
                  className={`${inputClass(errors.confirmPassword)} pr-11`}
                  placeholder="Nhập lại mật khẩu"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((current) => !current)}
                  className="absolute right-0.5 top-0.5 grid h-10 w-10 place-items-center rounded-[7px] text-on-surface-variant hover:bg-surface-container-high"
                  aria-label={showConfirmPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                >
                  <AppIcon name={showConfirmPassword ? 'visibility_off' : 'visibility'} className="text-[17px]" />
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="mt-1 flex items-center gap-1 text-[10px] font-medium text-error">
                  <AppIcon name="sync_problem" className="text-[12px]" />
                  {errors.confirmPassword}
                </p>
              )}
            </div>

            {otpRequested && (
              <div className="rounded-[10px] border border-secondary/20 bg-secondary-container/60 px-3 py-2.5">
                <label htmlFor="register-otp" className="mb-1.5 block text-[11px] font-medium text-on-surface">
                  Mã OTP email
                </label>
                <input
                  id="register-otp"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={otpCode}
                  onChange={(event) => {
                    setOtpCode(event.target.value.replace(/\D/g, '').slice(0, 6));
                    if (errors.otpCode || errors.form) {
                      setErrors((current) => {
                        const next = { ...current };
                        delete next.otpCode;
                        delete next.form;
                        return next;
                      });
                    }
                  }}
                  disabled={isSubmitting}
                  className={`${inputClass(errors.otpCode)} text-center text-[18px] font-semibold tracking-[0.28em]`}
                  placeholder="000000"
                />
                {otpMessage && <p className="mt-1.5 text-[10px] text-on-surface-variant">{otpMessage}</p>}
                {errors.otpCode && <p className="mt-1 text-[10px] font-medium text-error">{errors.otpCode}</p>}
              </div>
            )}

            <label className="flex cursor-pointer items-start gap-2.5 py-1 text-[11px] leading-relaxed text-on-surface-variant">
              <input type="checkbox" defaultChecked className="mt-0.5 h-4 w-4 rounded-[3px] border-outline accent-[#2F8A63]" />
              <span>
                Tôi đồng ý với <span className="font-medium text-secondary">Điều khoản sử dụng</span> và{' '}
                <span className="font-medium text-secondary">Chính sách bảo mật</span>.
              </span>
            </label>

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-[8px] bg-secondary px-4 text-[15px] font-semibold text-white transition hover:brightness-95 active:translate-y-px disabled:cursor-wait disabled:opacity-70"
            >
              {isSubmitting ? 'Đang tạo tài khoản...' : 'Tạo tài khoản'}
              {isSubmitting && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/35 border-t-white" />}
            </button>

            <div className="hidden items-center gap-4 py-1 md:flex">
              <span className="h-px flex-1 bg-outline-variant" />
              <span className="text-[11px] text-on-surface-variant">hoặc</span>
              <span className="h-px flex-1 bg-outline-variant" />
            </div>

            {/* Google auth chưa có backend, chỉ hiển thị preview trên desktop theo thiết kế. */}
            <button
              type="button"
              onClick={startGoogleAuth}
              className="hidden h-11 w-full items-center justify-center gap-2 rounded-[8px] border border-outline bg-surface text-[13px] font-medium text-on-surface transition hover:bg-surface-container-high md:flex"
              title="Đăng ký Google chưa được kết nối"
            >
              <span className="font-semibold text-secondary">G</span>
              Tiếp tục với Google
            </button>

            <p className="pt-2 text-center text-[12px] text-on-surface-variant">
              Đã có tài khoản?{' '}
              <button type="button" onClick={() => navigate('/login')} className="font-medium text-secondary hover:underline">
                Đăng nhập
              </button>
            </p>
          </form>
        </div>
      </section>

      <section className="hidden min-w-0 flex-1 bg-surface md:block">
        <AuthPreview variant="register" />
      </section>
    </div>
  );
};

export default Register;
