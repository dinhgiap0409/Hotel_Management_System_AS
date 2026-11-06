import { useAuth } from '../../context/AuthContext';
import { ROLES } from '../../config/constants';

// GiapND scope (UC-14, UC-21, UC-22) — public room catalog / search / detail.
// Allowed: guests (not logged in), CUSTOMER and FRONT_DESK only. Every other
// role (ADMIN, GENERAL_MANAGER, SALES_MANAGER, HOUSEKEEPING_MANAGER,
// SERVICE_MANAGER, ACCOUNTANT, HOUSEKEEPING, SERVICE_STAFF) gets the 403 page
// below, even when they type the URL directly in the address bar.
//
// This guard deliberately does NOT reuse RoleGuard: RoleGuard redirects
// anyone not logged in to /login, which would break UC-21 (search available
// rooms without login). Here, not being logged in means "guest", which is
// allowed through.
export const PublicBookingGuard = ({ children }) => {
  const { isAuthenticated, user } = useAuth();

  if (
    isAuthenticated &&
    user &&
    user.role !== ROLES.CUSTOMER &&
    user.role !== ROLES.FRONT_DESK
  ) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <h2 style={{ color: '#dc2626' }}>403 — Không có quyền truy cập</h2>
        <p style={{ color: '#64748b' }}>
          Vai trò hiện tại của bạn (<strong>{user.role}</strong>) không được cấp quyền sử dụng chức năng này.
        </p>
      </div>
    );
  }

  return children;
};
