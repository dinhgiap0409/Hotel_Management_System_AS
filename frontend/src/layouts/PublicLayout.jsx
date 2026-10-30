import React from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function PublicLayout() {
  const { isAuthenticated, user, clearSession } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    clearSession();
    navigate('/login');
  };

  return (
    <div className="min-vh-100 d-flex flex-column">
      <nav className="navbar navbar-expand-lg navbar-dark bg-dark shadow-sm">
        <div className="container">
          <Link className="navbar-brand fw-bold" to="/">
            <i className="bi bi-building me-2"></i>HMS Luxury Hotel
          </Link>
          <div className="navbar-nav ms-auto align-items-center gap-2">
            <Link className="nav-link" to="/">
              TÃ¬m & Äáº·t PhÃ²ng
            </Link>
            <Link className="nav-link" to="/my-bookings">
              Tra cá»©u Äáº·t PhÃ²ng
            </Link>
            {isAuthenticated && user ? (
              <>
                {user.role !== 'CUSTOMER' && (
                  <Link className="btn btn-sm btn-warning fw-semibold" to="/staff">
                    Báº£ng Ä‘iá»u khiá»ƒn Ná»™i bá»™ ({user.role})
                  </Link>
                )}
                <Link className="btn btn-sm btn-outline-light" to="/profile">
                  <i className="bi bi-person-circle me-1"></i>
                  {user.fullName}
                </Link>
                <button className="btn btn-sm btn-danger" onClick={handleLogout}>
                  ÄÄƒng xuáº¥t
                </button>
              </>
            ) : (
              <>
                <Link className="btn btn-sm btn-outline-light" to="/login">
                  ÄÄƒng nháº­p
                </Link>
                <Link className="btn btn-sm btn-primary" to="/register">
                  ÄÄƒng kÃ½ KhÃ¡ch hÃ ng
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>
      <main className="flex-grow-1">
        <Outlet />
      </main>
      <footer className="bg-dark text-secondary py-3 text-center small mt-5">
        HMS - Hotel Management System Â© 2026 | SBA301 Group Project (FPT University)
      </footer>
    </div>
  );
}