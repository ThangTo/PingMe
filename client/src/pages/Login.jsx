import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import { Link, useNavigate } from 'react-router-dom';

/**
 * Login Page - Trang đăng nhập
 */
const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Vui lòng điền đầy đủ thông tin');
      return;
    }

    const result = await login({ email, password });
    if (result.success) {
      navigate('/chat');
    } else {
      setError(result.error || 'Đăng nhập thất bại');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="w-full max-w-md bg-slate-800 rounded-2xl shadow-2xl p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">PingMe</h1>
          <p className="text-slate-400">Đăng nhập để tiếp tục</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-500/20 border border-red-500 text-red-300 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Email</label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              error={!!error}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Mật khẩu</label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              error={!!error}
            />
          </div>

          <Button type="submit" variant="primary" size="lg" className="w-full">
            Đăng nhập
          </Button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-slate-400">
            Chưa có tài khoản?{' '}
            <Link to="/register" className="text-primary hover:text-primary-light font-medium">
              Đăng ký ngay
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;

