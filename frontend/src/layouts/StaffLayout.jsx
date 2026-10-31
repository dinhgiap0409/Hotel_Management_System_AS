import React from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ROLES } from '../config/constants';

const MENU_ITEMS = [
  {
    label: 'Quầy Lễ Tân & Lưu Trú (M3B)',
    to: '/staff/frontdesk',
    allowedRoles: [ROLES.FRONT_DESK, ROLES.GENERAL_MANAGER, ROLES.ADMIN],
  },
  {
    label: 'Buồng Phòng & Bảo Trì (M2)',
    to: '/staff/housekeeping',
    allowedRoles: [ROLES.HOUSEKEEPING, ROLES.HOUSEKEEPING_MANAGER, ROLES.GENERAL_MANAGER, ROLES.ADMIN],
  },
  {
    label: 'Hạng Phòng & Sơ Đồ Phòng (M2)',
    to: '/staff/rooms',
    allowedRoles: [ROLES.SALES_MANAGER, ROLES.HOUSEKEEPING_MANAGER, ROLES.GENERAL_MANAGER, ROLES.ADMIN],
  },
  {
    label: 'Dịch Vụ, Folio & Voucher (M4)',
    to: '/staff/services-billing',
    allowedRoles: [ROLES.SERVICE_STAFF, ROLES.SERVICE_MANAGER, ROLES.ACCOUNTANT, ROLES.SALES_MANAGER, ROLES.FRONT_DESK, ROLES.GENERAL_MANAGER, ROLES.ADMIN],
  },
  {
    label: 'Báo Cáo KPI & Đánh Giá (M5)',
    to: '/staff/reports',
    allowedRoles: [ROLES.GENERAL_MANAGER, ROLES.ACCOUNTANT, ROLES.SALES_MANAGER, ROLES.ADMIN],
  },
  {
    label: 'Quản Trị Tài Khoản & 10 Role (M1)',
    to: '/admin/users',
    allowedRoles: [ROLES.ADMIN, ROLES.GENERAL_MANAGER],
  },
];

export const StaffLayout = () => {
  const { user, clearSession } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    clearSession();
    navigate('/login');
  };

  const visibleMenu = MENU_ITEMS.filter((item) => user && item.allowedRoles.includes(user.role));

  return (
    <div style={{ minHeight: '100vh', display: 'flex', fontFamily: 'Inter, system-ui, sans-serif', background: '#f1f5f9' }}>
      <aside style={{ width: 270, background: '#0f172a', color: '#fff', padding: 20, display: 'flex', flexDirection: 'column' }}>
        <Link to="/" style={{ color: '#fff', textDecoration: 'none', fontSize: 18, fontWeight: 700, marginBottom: 16 }}>
          🏨 HMS Staff Portal
        </Link>
        {user && (
          <div style={{ background: '#1e293b', padding: 12, borderRadius: 8, marginBottom: 20, fontSize: 13 }}>
            <div style={{ color: '#94a3b8' }}>Xin chào,</div>
            <div style={{ fontWeight: 600, color: '#f8fafc', marginTop: 2 }}>{user.fullName}</div>
            <div style={{ marginTop: 6, display: 'inline-block', background: '#0284c7', color: '#fff', padding: '2px 8px', borderRadius: 4, fontSize: 11 }}>
              {user.role}
            </div>
          </div>
        )}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
          {visibleMenu.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              style={{ color: '#cbd5e1', textDecoration: 'none', padding: '10px 12px', borderRadius: 6, fontSize: 14, background: '#1e293b' }}
            >
              {item.label}
            </Link>
          ))}
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