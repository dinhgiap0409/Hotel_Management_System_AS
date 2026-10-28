import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ROLE_DEFAULT_ROUTES } from '../../config/constants';

export const LoginPage = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('admin@hms.vn');
  const [password, setPassword] = useState('Admin@123');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login({ email, password });
      const savedUser = JSON.parse(localStorage.getItem('hms_user') || '{}');
      const target = ROLE_DEFAULT_ROUTES[savedUser.role] || '/';
      navigate(target);
    } catch (err) {
      setError(err.response?.data?.message || 'ÄÄƒng nháº­p tháº¥t báº¡i. Vui lÃ²ng kiá»ƒm tra thÃ´ng tin.');
    } finally {
      setLoading(false);
    }
  };

  const quickFill = (roleEmail) => {
    setEmail(roleEmail);
    setPassword('Admin@123');
  };

  return (
    <div style={{ maxWidth: 460, margin: '40px auto', background: '#fff', padding: 32, borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
      <h2 style={{ marginTop: 0, color: '#0f172a' }}>ÄÄƒng nháº­p Há»‡ thá»‘ng HMS</h2>
      <p style={{ color: '#64748b', fontSize: 13, marginBottom: 20 }}>
        Há»‡ thá»‘ng phÃ¢n quyá»n 10 vai trÃ² chuyÃªn biá»‡t (Máº­t kháº©u máº«u: <code>Admin@123</code>)
      </p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 20 }}>
        {[
          { label: 'Admin', email: 'admin@hms.vn' },
          { label: 'GM', email: 'gm@hms.vn' },
          { label: 'Sales Mgr', email: 'sales.mgr@hms.vn' },
          { label: 'HK Mgr', email: 'hk.mgr@hms.vn' },
          { label: 'Service Mgr', email: 'service.mgr@hms.vn' },
          { label: 'Accountant', email: 'accountant@hms.vn' },
          { label: 'Front Desk', email: 'frontdesk@hms.vn' },
          { label: 'Housekeeping', email: 'housekeeping@hms.vn' },
          { label: 'Service Staff', email: 'service@hms.vn' },
          { label: 'Customer', email: 'customer@gmail.com' },
        ].map((acc) => (
          <button
            key={acc.email}
            type="button"
            onClick={() => quickFill(acc.email)}
            style={{
              padding: '4px 8px',
              fontSize: 11,
              borderRadius: 6,
              border: '1px solid #cbd5e1',
              background: email === acc.email ? '#0284c7' : '#f8fafc',
              color: email === acc.email ? '#fff' : '#334155',
              cursor: 'pointer',
            }}
          >
            {acc.label}
          </button>
        ))}
      </div>

      {error && (
        <div style={{ background: '#fee2e2', color: '#991b1b', padding: 10, borderRadius: 6, marginBottom: 16, fontSize: 14 }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 6, fontSize: 14, fontWeight: 600 }}>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
          />
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', marginBottom: 6, fontSize: 14, fontWeight: 600 }}>Máº­t kháº©u</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          style={{ width: '100%', background: '#0284c7', color: '#fff', border: 'none', padding: '12px', borderRadius: 6, fontWeight: 600, cursor: 'pointer' }}
        >
          {loading ? 'Äang xá»­ lÃ½...' : 'ÄÄƒng nháº­p'}
        </button>
      </form>
      <div style={{ marginTop: 16, textAlign: 'center', fontSize: 14 }}>
        ChÆ°a cÃ³ tÃ i khoáº£n khÃ¡ch hÃ ng? <Link to="/register" style={{ color: '#0284c7' }}>ÄÄƒng kÃ½ ngay</Link>
      </div>
    </div>
  );
};