import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: attach Authorization header from localStorage
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('nex_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: on 401, clear token and redirect to /login
// Skip redirect for auth endpoints (login/change-password handle their own errors)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const isAuthRoute = error.config?.url?.startsWith('/auth/');
    if (error.response?.status === 401 && !isAuthRoute) {
      localStorage.removeItem('nex_token');
      localStorage.removeItem('nex_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
