import { http } from '../lib/http';

/**
 * Module 1 (Owner: KhangND) - Authentication, Profile, Admin Users & Audit API Service
 * Covers UC-01 to UC-10, UC-48, UC-49.
 */
export const authApi = {
  // UC-01: Customer Registration (2-step with Email OTP Verification)
  requestRegisterOtp: (payload) => http.post('/auth/register/request-otp', payload),
  resendRegisterOtp: (email) => http.post('/auth/register/resend-otp', { email }),
  verifyRegisterOtp: (email, otpCode) => http.post('/auth/register/verify', { email, otpCode }),
  register: (payload) => http.post('/auth/register/request-otp', payload),

  // UC-02: Login
  login: (email, password) => http.post('/auth/login', { email, password }),

  // UC-03: Logout
  logout: () => http.post('/auth/logout'),

  // UC-04: Forgot & Reset Password
  forgotPassword: (email) => http.post('/auth/forgot-password', { email }),
  resetPassword: (payload) => http.post('/auth/reset-password', payload),

  // UC-05: View & Update Personal Profile
  getMe: () => http.get('/auth/me'),
  updateProfile: (payload) => http.put('/auth/profile', payload),

  // UC-06: Change Password
  changePassword: (payload) => http.post('/auth/change-password', payload),

  // UC-07: Admin User Management (Search, Detail, Create, Update)
  getUsers: (params = {}) => http.get('/admin/users', { params }),
  getAllAccounts: (params = {}) => http.get('/admin/users', { params }),
  getUserById: (accountId) => http.get(`/admin/users/${accountId}`),
  createUser: (payload) => http.post('/admin/users', payload),
  updateUser: (accountId, payload) => http.put(`/admin/users/${accountId}`, payload),

  // UC-08: Lock / Unlock / Toggle Account Status
  updateAccountStatus: (accountId, status) =>
    http.patch(`/admin/users/${accountId}/status`, null, { params: { status } }),

  // UC-09: Assign Specialized Role (10 Roles) & Department
  assignUserRole: (accountId, roleName, departmentId) =>
    http.patch(`/admin/users/${accountId}/role`, null, {
      params: { roleName, ...(departmentId ? { departmentId } : {}) },
    }),

  // UC-10: List 10 Roles & 7 Departments
  getRoles: () => http.get('/admin/roles'),
  getDepartments: () => http.get('/admin/departments'),

  // UC-48: Audit Configuration Parameters
  getAuditConfig: () => http.get('/admin/audit-config'),
  updateAuditConfig: (payload) => http.put('/admin/audit-config', payload),

  // UC-49: Audit Logs & System Error Logs
  getAuditLogs: (params = {}) => http.get('/admin/audit-logs', { params }),
  getErrorLogs: () => http.get('/admin/error-logs'),
  updateErrorLogStatus: (id, status) =>
    http.patch(`/admin/error-logs/${id}/status`, null, { params: { status } }),
};
