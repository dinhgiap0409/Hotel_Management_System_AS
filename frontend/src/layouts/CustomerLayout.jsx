import { useState } from 'react';
import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ROLE_DEFAULT_ROUTES, getRoleLabel } from '../config/constants';

export const CustomerLayout = () => {
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const isFullBleedAuthPage = location.pathname === '/login';

  const handleConfirmLogout = async () => {
    setShowLogoutConfirm(false);
    await logout();
    navigate('/login');
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#F5F4ED', fontFamily: 'var(--font-sans)' }}>
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 100,
          background: '#141413',
          color: '#FAF9F5',
          padding: '14px 28px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid rgba(232, 230, 220, 0.14)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
          <Link
            to="/"
            style={{
              color: '#FAF9F5',
              textDecoration: 'none',
              fontFamily: 'var(--font-display)',
              fontWeight: 500,
              fontSize: 20,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              letterSpacing: '-0.01em',
            }}
          >
            <img
              src="/images/hms-logo.png"
              alt="HMS Hotel Logo"
              style={{
                width: 38,
                height: 38,
                borderRadius: 6,
                objectFit: 'cover',
                border: '1px solid rgba(212, 168, 73, 0.35)',
              }}
            />
            HMS Luxury Hotel
          </Link>
          <Link
            to="/"
            style={{
              color: location.pathname === '/' ? '#FAF9F5' : '#E8E6DC',
              fontWeight: location.pathname === '/' ? 600 : 400,
              textDecoration: 'none',
              fontSize: 13.5,
            }}
          >
            Trang Chủ
          </Link>
          <Link
            to="/rooms"
            style={{
              color: location.pathname.startsWith('/rooms') ? '#FAF9F5' : '#E8E6DC',
              fontWeight: location.pathname.startsWith('/rooms') ? 600 : 400,
              textDecoration: 'none',
              fontSize: 13.5,
            }}
          >
            Tìm &amp; Đặt Phòng
          </Link>
          {isAuthenticated && user?.role === 'CUSTOMER' && (
            <>
              <Link
                to="/my-bookings"
                style={{
                  color: location.pathname.startsWith('/my-bookings') ? '#FAF9F5' : '#E8E6DC',
                  fontWeight: location.pathname.startsWith('/my-bookings') ? 600 : 400,
                  textDecoration: 'none',
                  fontSize: 13.5,
                }}
              >
                Đặt Phòng Của Tôi
              </Link>
              <Link
                to="/customer/room-service"
                style={{
                  color: location.pathname.startsWith('/customer/room-service') || location.pathname.startsWith('/services') ? '#FAF9F5' : '#E8E6DC',
                  fontWeight: location.pathname.startsWith('/customer/room-service') || location.pathname.startsWith('/services') ? 600 : 400,
                  textDecoration: 'none',
                  fontSize: 13.5,
                }}
              >
                Dịch Vụ Khách Sạn
              </Link>
            </>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {isAuthenticated && user ? (
            <>
              {user.role !== 'CUSTOMER' && (
                <Link
                  to={ROLE_DEFAULT_ROUTES[user.role] || '/staff/frontdesk'}
                  style={{
                    background: '#C96442',
                    color: '#FAF9F5',
                    padding: '6px 12px',
                    borderRadius: 6,
                    textDecoration: 'none',
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  Cổng Nội bộ ({getRoleLabel(user.role)})
                </Link>
              )}
              <Link to="/profile" style={{ color: '#E8E6DC', textDecoration: 'none', fontSize: 13.5 }}>
                Hồ sơ: {user.fullName}
              </Link>
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(true)}
                style={{
                  background: '#DC2626',
                  color: '#FAF9F5',
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
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                Đăng xuất
              </button>
            </>
          ) : (
            <>
              <Link to="/login" style={{ color: '#FAF9F5', textDecoration: 'none', fontSize: 13.5 }}>
                Đăng nhập
              </Link>
              <Link
                to="/register"
                style={{
                  background: '#C96442',
                  color: '#FAF9F5',
                  padding: '7px 14px',
                  borderRadius: 6,
                  textDecoration: 'none',
                  fontSize: 13.5,
                  fontWeight: 600,
                }}
              >
                Đăng ký
              </Link>
            </>
          )}
        </div>
      </header>

      {isFullBleedAuthPage ? (
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <Outlet />
        </main>
      ) : (
        <main style={{ flex: 1, maxWidth: 1200, width: '100%', margin: '0 auto', padding: '24px 20px', boxSizing: 'border-box' }}>
          <Outlet />
        </main>
      )}

      <footer
        style={{
          background: '#141413',
          color: '#9C9A92',
          textAlign: 'center',
          padding: '16px 20px',
          fontSize: 12.5,
          borderTop: '1px solid rgba(232, 230, 220, 0.12)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
        }}
      >
        <img
          src="/images/hms-logo.png"
          alt="HMS Hotel Logo"
          style={{ width: 24, height: 24, borderRadius: 4, objectFit: 'cover' }}
        />
        <span>HMS — Hotel Management System © 2026 | SBA301 Group Project</span>
      </footer>

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(20, 20, 19, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 16,
          }}
        >
          <div
            style={{
              background: '#FAF9F5',
              borderRadius: 10,
              maxWidth: 400,
              width: '100%',
              padding: 24,
              border: '1px solid #E8E6DC',
              boxShadow: '0 20px 40px rgba(20, 20, 19, 0.28)',
            }}
          >
            <h3 style={{ margin: '0 0 8px', fontSize: 17, fontWeight: 700, color: '#141413' }}>
              Xác nhận đăng xuất
            </h3>
            <p style={{ margin: '0 0 20px', fontSize: 14, color: '#5E5D59', lineHeight: 1.5 }}>
              Bạn có chắc chắn muốn đăng xuất không?
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
                style={{
                  background: '#F5F4ED',
                  color: '#3D3D3A',
                  border: '1px solid #D5D2C6',
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
                  background: '#DC2626',
                  color: '#FAF9F5',
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
