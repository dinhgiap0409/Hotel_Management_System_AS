import { Route } from 'react-router-dom';
import { LoginPage } from '../pages/auth/LoginPage';
import { RegisterPage } from '../pages/auth/RegisterPage';
import { ProfilePage } from '../pages/auth/ProfilePage';
import { UserManagementPage } from '../pages/admin/UserManagementPage';
import { RoleGuard } from '../components/common/RoleGuard';
import { ROLES } from '../config/constants';

export const authPublicRoutes = (
  <>
    <Route path="/login" element={<LoginPage />} />
    <Route path="/register" element={<RegisterPage />} />
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
  <Route
    path="/admin/users"
    element={
      <RoleGuard allowedRoles={[ROLES.ADMIN, ROLES.GENERAL_MANAGER]}>
        <UserManagementPage />
      </RoleGuard>
    }
  />
);