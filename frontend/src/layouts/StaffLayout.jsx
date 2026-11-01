import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ROLES } from '../config/constants';

const MENU_ITEMS = [
  {
    label: 'Quản Trị Tài Khoản & Phân Quyền',
    to: '/admin/users',
    allowedRoles: [ROLES.ADMIN, ROLES.GENERAL_MANAGER],
  },
  {
    label: 'Nhật Ký Kiểm Toán & Hệ Thống',
    to: '/admin/audit-logs',
    allowedRoles: [ROLES.ADMIN, ROLES.GENERAL_MANAGER],
  },
  {
    label: 'Quầy Lễ Tân & Lưu Trú',
    to: '/staff/frontdesk',
    allowedRoles: [ROLES.FRONT_DESK, ROLES.GENERAL_MANAGER, ROLES.ADMIN],
  },
  {
    label: 'Buồng Phòng & Bảo Trì',
    to: '/staff/housekeeping',
    allowedRoles: [ROLES.HOUSEKEEPING, ROLES.HOUSEKEEPING_MANAGER, ROLES.GENERAL_MANAGER, ROLES.ADMIN],
  },
  {
    label: 'Hạng Phòng & Sơ Đồ Phòng',
    to: '/staff/rooms',
    allowedRoles: [ROLES.SALES_MANAGER, ROLES.HOUSEKEEPING_MANAGER, ROLES.GENERAL_MANAGER, ROLES.ADMIN],
  },
  {
    label: 'Dịch Vụ, Hóa Đơn & Khuyến Mãi',
    to: '/staff/services-billing',
    allowedRoles: [ROLES.SERVICE_STAFF, ROLES.SERVICE_MANAGER, ROLES.ACCOUNTANT, ROLES.SALES_MANAGER, ROLES.FRONT_DESK, ROLES.GENERAL_MANAGER, ROLES.ADMIN],
  },
  {
    label: 'Báo Cáo Doanh Thu & Đánh Giá',
    to: '/staff/reports',
    allowedRoles: [ROLES.GENERAL_MANAGER, ROLES.ACCOUNTANT, ROLES.SALES_MANAGER, ROLES.ADMIN],
  },
];

export const StaffLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const visibleMenu = MENU_ITEMS.filter((item) => user && item.allowedRoles.includes(user.role));

  return (
    <div style={{ minHeight: '100vh', display: 'flex', fontFamily: 'Inter, system-ui, sans-serif', background: '#f1f5f9' }}>
      <aside style={{ width: 275, background: '#0f172a', color: '#fff', padding: 20, display: 'flex', flexDirection: 'column' }}>
        <Link
          to="/"
          style={{
            color: '#fff',
            textDecoration: 'none',
            fontSize: 17,
            fontWeight: 700,
            marginBottom: 18,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <img
            src="/images/hms-logo.png"
            alt="HMS Hotel Logo"
            style={{
              width: 40,
              height: 40,
              borderRadius: 8,
              objectFit: 'cover',
              border: '1px solid rgba(212, 168, 73, 0.4)',
            }}
          />
          <div>
            <div style={{ lineHeight: 1.2 }}>HMS Hotel</div>
            <div style={{ fontSize: 11, fontWeight: 500, color: '#94a3b8' }}>Cổng Quản Trị Nội Bộ</div>
          </div>
        </Link>
        {user && (
          <div style={{ background: '#1e293b', padding: 12, borderRadius: 8, marginBottom: 18, fontSize: 13 }}>
            <div style={{ color: '#94a3b8' }}>Xin chào,</div>
            <div style={{ fontWeight: 600, color: '#f8fafc', marginTop: 2 }}>{user.fullName}</div>
            <div style={{ marginTop: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ background: '#0284c7', color: '#fff', padding: '2px 8px', borderRadius: 4, fontSize: 11 }}>
                {user.role}
              </span>
              <Link to="/profile" style={{ color: '#38bdf8', fontSize: 12, textDecoration: 'none' }}>
                Hồ sơ cá nhân
              </Link>
            </div>
          </div>
        )}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
          {visibleMenu.map((item) => {
            const active = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                style={{
                  color: active ? '#fff' : '#cbd5e1',
                  textDecoration: 'none',
                  padding: '10px 12px',
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: active ? 600 : 400,
                  background: active ? '#0284c7' : '#1e293b',
                }}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <button
          onClick={handleLogout}
          style={{ background: '#dc2626', color: '#fff', border: 'none', padding: 10, borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}
        >
          Đăng xuất
        </button>
      </aside>
      <main style={{ flex: 1, padding: 28, overflowY: 'auto' }}>
        <Outlet />
      </main>
    </div>
  );
};
