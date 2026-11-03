import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ROLE_DEFAULT_ROUTES, getRoleLabel } from '../config/constants';

export const CustomerLayout = () => {
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const isFullBleedAuthPage = location.pathname === '/login';

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#F5F4ED', fontFamily: 'var(--font-sans)' }}>
      <header
        style={{
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
                onClick={handleLogout}
                style={{
                  background: 'transparent',
                  color: '#FAF9F5',
                  border: '1px solid rgba(232, 230, 220, 0.35)',
                  padding: '6px 12px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontSize: 13,
                }}
              >
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
    </div>
  );
};
