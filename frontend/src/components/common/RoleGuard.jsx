import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export const RoleGuard = ({ allowedRoles, children }) => {
  const { isAuthenticated, user } = useAuth();

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
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