import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export function ProtectedRoute({ roles, children }) {
  const { isAuthenticated, user } = useAuth();

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  if (roles && roles.length > 0 && !roles.includes(user.role)) {
    return (
      <div className="container py-5 text-center">
        <i className="bi bi-shield-x text-danger display-1"></i>
        <h2 className="mt-3">403 - KhÃ´ng cÃ³ quyá»n truy cáº­p</h2>
        <p className="text-muted">Vai trÃ² hiá»‡n táº¡i ({user.role}) khÃ´ng Ä‘Æ°á»£c phÃ©p truy cáº­p trang nÃ y.</p>
      </div>
    );
  }

  return children;
}