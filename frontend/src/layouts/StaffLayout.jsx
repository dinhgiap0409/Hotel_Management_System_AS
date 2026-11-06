import { useState } from 'react';
import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ROLES, getRoleLabel } from '../config/constants';

const MENU_ITEMS = [
  {
    label: 'Quản Trị Tài Khoản & Phân Quyền',
    to: '/admin/users',
    allowedRoles: [ROLES.ADMIN, ROLES.GENERAL_MANAGER],
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    label: 'Nhật Ký Kiểm Toán & Hệ Thống',
    to: '/admin/audit-logs',
    allowedRoles: [ROLES.ADMIN, ROLES.GENERAL_MANAGER],
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <path d="m9 12 2 2 4-4" />
      </svg>
    ),
  },
  {
    label: 'Quầy Lễ Tân & Lưu Trú',
    to: '/staff/frontdesk',
    allowedRoles: [ROLES.FRONT_DESK, ROLES.GENERAL_MANAGER, ROLES.ADMIN],
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 20h20" />
        <path d="M5 20V8a7 7 0 0 1 14 0v12" />
        <path d="M12 4V2" />
      </svg>
    ),
  },
  {
    label: 'Buồng Phòng & Bảo Trì',
    to: '/staff/housekeeping',
    allowedRoles: [ROLES.HOUSEKEEPING, ROLES.HOUSEKEEPING_MANAGER, ROLES.ADMIN],
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
      </svg>
    ),
  },
  {
    label: 'Hạng Phòng & Sơ Đồ Phòng',
    to: '/staff/rooms',
    allowedRoles: [ROLES.SALES_MANAGER, ROLES.HOUSEKEEPING_MANAGER, ROLES.ADMIN],
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    label: 'Dịch Vụ, Hóa Đơn & Khuyến Mãi',
    to: '/staff/services-billing',
    allowedRoles: [ROLES.SERVICE_STAFF, ROLES.SERVICE_MANAGER, ROLES.ACCOUNTANT, ROLES.SALES_MANAGER, ROLES.FRONT_DESK, ROLES.GENERAL_MANAGER, ROLES.ADMIN],
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
      </svg>
    ),
  },
  {
    label: 'Báo Cáo Doanh Thu & Đánh Giá',
    to: '/staff/reports',
    allowedRoles: [ROLES.GENERAL_MANAGER, ROLES.ACCOUNTANT, ROLES.SALES_MANAGER, ROLES.ADMIN],
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    ),
  },
];

export const StaffLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem('hms_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const toggleSidebar = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('hms_sidebar_collapsed', String(next));
      } catch {
        // ignore storage errors
      }
      return next;
    });
  };

  const handleConfirmLogout = async () => {
    setShowLogoutConfirm(false);
    await logout();
    navigate('/login');
  };

  const visibleMenu = MENU_ITEMS.filter((item) => user && item.allowedRoles.includes(user.role));
  const currentMenuItem = visibleMenu.find((item) => location.pathname.startsWith(item.to));

  return (
    <div style={{ minHeight: '100vh', display: 'flex', fontFamily: 'Inter, system-ui, sans-serif', background: '#f1f5f9' }}>
      {/* Sticky Full-Height Collapsible Sidebar */}
      <aside
        style={{
          width: collapsed ? 76 : 280,
          minWidth: collapsed ? 76 : 280,
          height: '100vh',
          position: 'sticky',
          top: 0,
          background: '#0f172a',
          color: '#fff',
          padding: collapsed ? '16px 10px' : '18px 16px',
          display: 'flex',
          flexDirection: 'column',
          boxSizing: 'border-box',
          transition: 'width 0.2s ease, min-width 0.2s ease, padding 0.2s ease',
          zIndex: 50,
          borderRight: '1px solid #1e293b',
        }}
      >
        {/* Brand + Collapse Toggle Row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'space-between',
            marginBottom: 18,
            gap: 8,
          }}
        >
          {!collapsed && (
            <Link
              to="/"
              style={{
                color: '#fff',
                textDecoration: 'none',
                fontSize: 16,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                overflow: 'hidden',
                whiteSpace: 'nowrap',
              }}
            >
              <img
                src="/images/hms-logo.png"
                alt="HMS Hotel Logo"
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 8,
                  objectFit: 'cover',
                  border: '1px solid rgba(212, 168, 73, 0.4)',
                  flexShrink: 0,
                }}
              />
              <div>
                <div style={{ lineHeight: 1.2 }}>HMS Hotel</div>
                <div style={{ fontSize: 11, fontWeight: 500, color: '#94a3b8' }}>Cổng Quản Trị Nội Bộ</div>
              </div>
            </Link>
          )}

          <button
            type="button"
            onClick={toggleSidebar}
            title={collapsed ? 'Mở rộng thanh điều hướng' : 'Thu gọn thanh điều hướng'}
            aria-label={collapsed ? 'Mở rộng thanh điều hướng' : 'Thu gọn thanh điều hướng'}
            style={{
              background: '#1e293b',
              color: '#e2e8f0',
              border: '1px solid #334155',
              width: 36,
              height: 36,
              borderRadius: 8,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {collapsed ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            )}
          </button>
        </div>

        {/* User Summary Card (when expanded) */}
        {user && !collapsed && (
          <div style={{ background: '#1e293b', padding: 12, borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
            <div style={{ color: '#94a3b8', fontSize: 11.5 }}>Xin chào,</div>
            <div style={{ fontWeight: 600, color: '#f8fafc', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user.fullName}
            </div>
            <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ background: '#0284c7', color: '#fff', padding: '2px 8px', borderRadius: 4, fontSize: 11 }}>
                {getRoleLabel(user.role)}
              </span>
              <Link to="/profile" style={{ color: '#38bdf8', fontSize: 12, textDecoration: 'none' }}>
                Hồ sơ cá nhân
              </Link>
            </div>
          </div>
        )}

        {/* Navigation Links */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, overflowY: 'auto' }}>
          {visibleMenu.map((item) => {
            const active = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                title={collapsed ? item.label : undefined}
                style={{
                  color: active ? '#fff' : '#cbd5e1',
                  textDecoration: 'none',
                  padding: collapsed ? '11px 0' : '10px 12px',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: active ? 600 : 400,
                  background: active ? '#0284c7' : '#1e293b',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  gap: 10,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                }}
              >
                <span style={{ display: 'inline-flex', flexShrink: 0 }}>{item.icon}</span>
                {!collapsed && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.label}</span>}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main Content Area with Sticky Top Navbar */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <header
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 40,
            background: '#ffffff',
            borderBottom: '1px solid #e2e8f0',
            padding: '10px 28px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 16,
          }}
        >
          <span style={{ fontSize: 14.5, fontWeight: 600, color: '#0f172a' }}>
            {currentMenuItem ? currentMenuItem.label : 'Cổng Quản Trị Nội Bộ'}
          </span>

          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <Link
              to="/"
              style={{
                color: '#475569',
                textDecoration: 'none',
                fontSize: 13,
                fontWeight: 500,
              }}
            >
              Trang chủ khách sạn
            </Link>
            {user && (
              <>
                <Link
                  to="/profile"
                  style={{
                    color: '#0f172a',
                    textDecoration: 'none',
                    fontSize: 13,
                    fontWeight: 600,
                    background: '#f1f5f9',
                    padding: '6px 12px',
                    borderRadius: 6,
                    border: '1px solid #e2e8f0',
                  }}
                >
                  {user.fullName} ({getRoleLabel(user.role)})
                </Link>
                <button
                  type="button"
                  onClick={() => setShowLogoutConfirm(true)}
                  style={{
                    background: '#dc2626',
                    color: '#ffffff',
                    border: 'none',
                    padding: '6px 12px',
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: 600,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                  Đăng xuất
                </button>
              </>
            )}
          </div>
        </header>

        <main style={{ flex: 1, padding: 28 }}>
          <Outlet />
        </main>
      </div>

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 16,
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: 12,
              maxWidth: 400,
              width: '100%',
              padding: 24,
              boxShadow: '0 20px 40px rgba(15, 23, 42, 0.25)',
            }}
          >
            <h3 style={{ margin: '0 0 8px', fontSize: 17, fontWeight: 700, color: '#0f172a' }}>
              Xác nhận đăng xuất
            </h3>
            <p style={{ margin: '0 0 20px', fontSize: 14, color: '#475569', lineHeight: 1.5 }}>
              Bạn có chắc chắn muốn đăng xuất không?
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
                style={{
                  background: '#f1f5f9',
                  color: '#334155',
                  border: '1px solid #cbd5e1',
                  padding: '8px 16px',
                  borderRadius: 6,
                  fontSize: 13.5,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleConfirmLogout}
                style={{
                  background: '#dc2626',
                  color: '#ffffff',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: 6,
                  fontSize: 13.5,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Đăng xuất
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
