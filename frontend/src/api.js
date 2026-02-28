/**
 * KisanCall — Axios API client with JWT interceptor
 * All requests go to http://localhost:8000
 */
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:8000',
  timeout: 30000,
});

// ── Request interceptor: attach JWT token ─────────────────────────────────
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('kc_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Response interceptor: handle 401 globally ─────────────────────────────
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('kc_token');
      localStorage.removeItem('kc_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
