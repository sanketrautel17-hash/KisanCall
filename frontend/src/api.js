/**
 * KisanCall — Axios API client with JWT interceptor
 * API/WS base URLs are configurable via:
 * - VITE_API_BASE_URL (default: http://localhost:8000)
 * - VITE_WS_BASE_URL  (default derived from API base)
 */
import axios from 'axios';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000').replace(/\/+$/, '');
export const WS_BASE_URL = (
  import.meta.env.VITE_WS_BASE_URL || API_BASE_URL.replace(/^http/i, 'ws')
).replace(/\/+$/, '');

const api = axios.create({
  baseURL: API_BASE_URL,
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
