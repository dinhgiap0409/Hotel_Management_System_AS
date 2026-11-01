import { Route } from 'react-router-dom';
import { LoginPage } from '../pages/auth/LoginPage';
import { RegisterPage } from '../pages/auth/RegisterPage';
import { ForgotPasswordPage } from '../pages/auth/ForgotPasswordPage';
import { ProfilePage } from '../pages/auth/ProfilePage';
import { UserManagementPage } from '../pages/admin/UserManagementPage';
import { AuditLogPage } from '../pages/admin/AuditLogPage';
import { RoleGuard } from '../components/common/RoleGuard';
import { ROLES } from '../config/constants';

export const authPublicRoutes = (
  <>
    <Route path="/login" element={<LoginPage />} />
    <Route path="/register" element={<RegisterPage />} />
    <Route path="/forgot-password" element={<ForgotPasswordPage />} />
    <Route
      path="/profile"
      element={
        <RoleGuard allowedRoles={Object.values(ROLES)}>
          <ProfilePage />
        </RoleGuard>
      }
    />
  </>
);

export const authStaffRoutes = (
  <>
    <Route
      path="/admin/users"
      element={
        <RoleGuard allowedRoles={[ROLES.ADMIN, ROLES.GENERAL_MANAGER]}>
          <UserManagementPage />
        </RoleGuard>
      }
    />
    <Route
      path="/admin/audit-logs"
      element={
        <RoleGuard allowedRoles={[ROLES.ADMIN, ROLES.GENERAL_MANAGER]}>
          <AuditLogPage />
        </RoleGuard>
      }
    />
  </>
);
