import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ROLE_DEFAULT_ROUTES, ROLES, getRoleLabel } from '../../config/constants';

// Trang 403 dùng chung cho mọi trường hợp không có quyền:
// - RoleGuard / PublicBookingGuard chặn ở route đã định nghĩa.
// - NotFoundPage dùng lại trang này cho các URL nội bộ / đặt phòng
//   không tồn tại (ví dụ /booking/checkout — UC của GiapND không có
//   checkout — hoặc /admin/... với role không được phép), để người dùng
//   luôn thấy trang lỗi thay vì trang trắng.
// Nút "về trang của bạn": khách chưa đăng nhập -> /login, CUSTOMER /
// FRONT_DESK -> / (trang tìm phòng), các role staff khác -> cổng nội bộ
// của họ theo ROLE_DEFAULT_ROUTES.
export const ForbiddenPage = () => {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();

  const homeRoute = !isAuthenticated || !user
    ? '/login'
    : user.role === ROLES.CUSTOMER || user.role === ROLES.FRONT_DESK
      ? '/'
      : ROLE_DEFAULT_ROUTES[user.role] || '/';

  return (
    <div style={{ padding: 40, textAlign: 'center' }}>
      <h2 style={{ color: '#dc2626' }}>403 — Không có quyền truy cập</h2>
      <p style={{ color: '#64748b' }}>
        {isAuthenticated && user ? (
          <>
            Vai trò hiện tại của bạn (<strong>{getRoleLabel(user.role)}</strong>) không được cấp quyền sử dụng chức năng này.
          </>
        ) : (
          'Bạn cần đăng nhập với tài khoản có quyền để sử dụng chức năng này.'
        )}
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
          Về trang của bạn
        </button>
      </div>
    </div>
  );
};
