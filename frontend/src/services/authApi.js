import { http } from '../lib/http';

export const authApi = {
  login: (email, password) => http.post('/auth/login', { email, password }),
  register: (payload) => http.post('/auth/register', payload),
  getMe: () => http.get('/auth/me'),
  getAllAccounts: () => http.get('/admin/accounts'),
  updateAccountStatus: (id, status) => http.patch(`/admin/accounts/${id}/status`, null, { params: { status } }),
};