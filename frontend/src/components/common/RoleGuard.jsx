import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ForbiddenPage } from './ForbiddenPage';

export const RoleGuard = ({ allowedRoles, children }) => {
  const { isAuthenticated, user } = useAuth();

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    return <ForbiddenPage />;
  }

  return children;
};
