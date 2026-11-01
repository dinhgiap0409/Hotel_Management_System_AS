import axios from 'axios';
import { API_BASE_URL } from '../config/constants';

let inMemoryAccessToken = sessionStorage.getItem('hms_access_token') || null;

export function setAccessToken(token) {
  inMemoryAccessToken = token;
  if (token) {
    sessionStorage.setItem('hms_access_token', token);
  } else {
    sessionStorage.removeItem('hms_access_token');
  }
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
    const message = data?.message || error.message || 'Đã xảy ra lỗi kết nối máy chủ.';

    if (!status || status >= 500) {
      notifyToast({ type: 'SYSTEM_ERROR', message, traceId });
    } else if (status === 403) {
      notifyToast({ type: 'ERROR', message: data?.message || 'Bạn không có quyền thực hiện thao tác này (403).' });
    } else if (status === 409 || status === 422 || status === 400) {
      notifyToast({ type: 'ERROR', message });
    } else if (status === 429) {
      notifyToast({ type: 'WARNING', message: 'Thao tác quá nhanh, vui lòng thử lại sau giây lát.' });
    }
    return Promise.reject(error);
  }
);
