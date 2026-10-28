import React from 'react';
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
        <h2 style={{ color: '#dc2626' }}>403 â€” KhÃ´ng cÃ³ quyá»n truy cáº­p</h2>
        <p style={{ color: '#64748b' }}>
          Vai trÃ² hiá»‡n táº¡i cá»§a báº¡n (<strong>{user.role}</strong>) khÃ´ng Ä‘Æ°á»£c cáº¥p quyá»n sá»­ dá»¥ng chá»©c nÄƒng nÃ y.
        </p>
      </div>
    );
  }

  return children;
};