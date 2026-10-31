import React from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ROLE_DEFAULT_ROUTES } from '../config/constants';

export const CustomerLayout = () => {
  const { isAuthenticated, user, clearSession } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    clearSession();
    navigate('/login');
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#f8fafc', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <header style={{ background: '#0f172a', color: '#fff', padding: '14px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <Link to="/" style={{ color: '#fff', textDecoration: 'none', fontWeight: 700, fontSize: 18 }}>
            🏨 HMS Luxury Hotel
          </Link>
          <Link to="/" style={{ color: '#cbd5e1', textDecoration: 'none', fontSize: 14 }}>Tìm & Đặt Phòng</Link>
          {isAuthenticated && user?.role === 'CUSTOMER' && (
            <Link to="/my-bookings" style={{ color: '#cbd5e1', textDecoration: 'none', fontSize: 14 }}>Đặt Phòng Của Tôi</Link>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {isAuthenticated && user ? (
            <>
              {user.role !== 'CUSTOMER' && (
                <Link
                  to={ROLE_DEFAULT_ROUTES[user.role] || '/staff/frontdesk'}
                  style={{ background: '#f59e0b', color: '#0f172a', padding: '6px 12px', borderRadius: 6, textDecoration: 'none', fontSize: 13, fontWeight: 600 }}
                >
                  Cổng Nội bộ ({user.role})
                </Link>
              )}
              <Link to="/profile" style={{ color: '#e2e8f0', textDecoration: 'none', fontSize: 14 }}>
                {user.fullName}
              </Link>
              <button
                onClick={handleLogout}
                style={{ background: '#dc2626', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}
              >
                Đăng xuất
              </button>
            </>
          ) : (
            <>
              <Link to="/login" style={{ color: '#fff', textDecoration: 'none', fontSize: 14 }}>Đăng nhập</Link>
              <Link to="/register" style={{ background: '#0284c7', color: '#fff', padding: '6px 14px', borderRadius: 6, textDecoration: 'none', fontSize: 14 }}>
                Đăng ký
              </Link>
            </>
          )}
        </div>
      </header>
      <main style={{ flex: 1, maxWidth: 1200, width: '100%', margin: '0 auto', padding: '24px 20px', boxSizing: 'border-box' }}>
        <Outlet />
      </main>
      <footer style={{ background: '#0f172a', color: '#94a3b8', textAlign: 'center', padding: 16, fontSize: 13 }}>
        HMS — Hotel Management System © 2026 | SBA301 Group Project (Pure React JSX + Spring Boot 3)
      </footer>
    </div>
  );
};