import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001/api',
  withCredentials: true,
  timeout: 10000,
});

// Request interceptor (optional - để thêm token vào header nếu cần)
api.interceptors.request.use(
  (config) => {
    // Có thể thêm token vào header ở đây nếu cần
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

// Response interceptor - xử lý error response
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const requestUrl = originalRequest?.url || '';
    const isLoginRequest = requestUrl === '/auth/login';
    const serverMessage = error.response?.data?.error || error.response?.data?.message;

    // QUAN TRỌNG: Nếu lỗi 401 VÀ request đó KHÔNG PHẢI là request refresh
    if (
      originalRequest &&
      error.response?.status === 401 &&
      !isLoginRequest &&
      !originalRequest?._retry &&
      requestUrl !== '/auth/refresh'
    ) {
      originalRequest._retry = true;
      try {
        await api.post('/auth/refresh');
        return api(originalRequest);
      } catch (refreshError) {
        // Nếu refresh chính nó cũng lỗi -> Xóa session và về Login
        localStorage.removeItem('pingme_user');
        if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
          window.location.href = '/login';
        }
        return Promise.reject(refreshError);
      }
    }

    // Nếu chính lệnh refresh bị 401 thì văng ra login luôn, không retry nữa
    if (error.response?.status === 401 && requestUrl === '/auth/refresh') {
      localStorage.removeItem('pingme_user');
      if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
        window.location.href = '/login';
      }
    }

    if (serverMessage) {
      error.message = serverMessage;
    }

    return Promise.reject(error);
  },
);

export default api;
