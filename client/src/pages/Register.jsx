import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import { Link, useNavigate } from 'react-router-dom';

/**
 * Register Page - Trang đăng ký
 */
const Register = () => {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!formData.username || !formData.email || !formData.password) {
      setError('Vui lòng điền đầy đủ thông tin');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Mật khẩu xác nhận không khớp');
      return;
    }

    if (formData.password.length < 6) {
      setError('Mật khẩu phải có ít nhất 6 ký tự');
      return;
    }

    const result = await register({
      username: formData.username,
      email: formData.email,
      password: formData.password,
    });

    if (result.success) {
      navigate('/login');
    } else {
      setError(result.error || 'Đăng ký thất bại');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="w-full max-w-md bg-slate-800 rounded-2xl shadow-2xl p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Tạo tài khoản PingMe</h1>
          <p className="text-slate-400">Đăng ký để bắt đầu chat</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-500/20 border border-red-500 text-red-300 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Tên người dùng</label>
            <Input
              type="text"
              name="username"
              value={formData.username}
              onChange={handleChange}
              placeholder="username"
              error={!!error}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Email</label>
            <Input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="your@email.com"
              error={!!error}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Mật khẩu</label>
            <Input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="••••••••"
              error={!!error}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Xác nhận mật khẩu</label>
            <Input
              type="password"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              placeholder="••••••••"
              error={!!error}
            />
          </div>

          <Button type="submit" variant="primary" size="lg" className="w-full">
            Đăng ký
          </Button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-slate-400">
            Đã có tài khoản?{' '}
            <Link to="/login" className="text-primary hover:text-primary-light font-medium">
              Đăng nhập
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;

