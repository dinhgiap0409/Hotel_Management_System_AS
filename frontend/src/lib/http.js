import axios from 'axios';
import { API_BASE_URL } from '../config/constants';

/**
 * In-memory token store (SDD Section 4.1.5.2: Access token is kept in memory only, not localStorage).
 */
let inMemoryAccessToken = null;

export function setAccessToken(token) {
  inMemoryAccessToken = token;
}

export function getAccessToken() {
  return inMemoryAccessToken;
}

const toastListeners = new Set();

export function subscribeToToasts(listener) {
  toastListeners.add(listener);
  return () => toastListeners.delete(listener);
}

export function notifyToast(toast) {
  toastListeners.forEach((fn) => fn(toast));
}

/**
 * Single configured Axios instance with centralized error interceptor (SDD Section 4.1.2.2).
 */
export const http = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json; charset=UTF-8',
  },
  withCredentials: true,
});

http.interceptors.request.use((config) => {
  if (inMemoryAccessToken) {
    config.headers.Authorization = `Bearer ${inMemoryAccessToken}`;
  }
  config.headers['Accept-Language'] = document.documentElement.lang || 'vi';
  return config;
});

http.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const data = error.response?.data;
    const traceId = data?.traceId || error.response?.headers?.['x-trace-id'];
    const message = data?.message || error.message || 'ÄÃ£ xáº£y ra lá»—i káº¿t ná»‘i mÃ¡y chá»§.';

    if (!status || status >= 500) {
      notifyToast({ type: 'SYSTEM_ERROR', message, traceId });
    } else if (status === 403) {
      notifyToast({ type: 'ERROR', message: data?.message || 'Báº¡n khÃ´ng cÃ³ quyá»n thá»±c hiá»‡n thao tÃ¡c nÃ y (403).' });
    } else if (status === 409 || status === 422 || status === 400) {
      notifyToast({ type: 'ERROR', message });
    } else if (status === 429) {
      notifyToast({ type: 'WARNING', message: 'Thao tÃ¡c quÃ¡ nhanh, vui lÃ²ng thá»­ láº¡i sau giÃ¢y lÃ¡t.' });
    }
    return Promise.reject(error);
  }
);