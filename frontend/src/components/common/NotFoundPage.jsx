import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ROLE_DEFAULT_ROUTES, ROLES } from '../../config/constants';
import { ForbiddenPage } from './ForbiddenPage';

// Route catch-all "*" trong router/index.jsx: mọi URL không khớp route nào
// đều rơi về đây, nên không còn trường hợp nào render ra trang trắng nữa.
// - Các đường dẫn nội bộ / đặt phòng (/admin, /staff, /my-bookings,
//   /customer, /services, /booking/ — kể cả /booking/checkout, vì UC của
//   GiapND không có checkout) thì hiện trang 403: hoặc là trang không tồn
//   tại trong UC, hoặc là user không có quyền vào.
// - Các URL khác thì hiện trang 404.
const PROTECTED_PREFIXES = ['/admin', '/staff', '/my-bookings', '/customer', '/services', '/booking/'];

export const NotFoundPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();

  const pathname = location.pathname || '';
  const isProtectedPath = PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(prefix));

  if (isProtectedPath) {
    return <ForbiddenPage />;
  }

  const homeRoute = !isAuthenticated || !user
    ? '/'
    : user.role === ROLES.CUSTOMER || user.role === ROLES.FRONT_DESK
      ? '/'
      : ROLE_DEFAULT_ROUTES[user.role] || '/';

  return (
    <div style={{ padding: 40, textAlign: 'center' }}>
      <h2 style={{ color: '#dc2626' }}>404 — Không tìm thấy trang</h2>
      <p style={{ color: '#64748b' }}>
        Đường dẫn <strong>{pathname}</strong> không tồn tại trên hệ thống.
      </p>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 16 }}>
        <button
          type="button"
          onClick={() => navigate(-1)}
          style={{
            padding: '9px 18px',
            borderRadius: 6,
            border: '1px solid #16233B',
            background: '#fff',
            color: '#16233B',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Quay lại
        </button>
        <button
          type="button"
          onClick={() => navigate(homeRoute)}
          style={{
            padding: '9px 18px',
            borderRadius: 6,
            border: 'none',
            background: '#16233B',
            color: '#FAF9F5',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Về trang chủ
        </button>
      </div>
    </div>
  );
};
