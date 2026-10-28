import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authApi } from '../../services/authApi';

export const RegisterPage = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '', fullName: '', phone: '' });
  const [message, setMessage] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await authApi.register(form);
      setMessage('ÄÄƒng kÃ½ thÃ nh cÃ´ng! Äang chuyá»ƒn hÆ°á»›ng sang trang Ä‘Äƒng nháº­p...');
      setTimeout(() => navigate('/login'), 1500);
    } catch (err) {
      setMessage(err.response?.data?.message || 'CÃ³ lá»—i xáº£y ra khi Ä‘Äƒng kÃ½.');
    }
  };

  return (
    <div style={{ maxWidth: 420, margin: '40px auto', background: '#fff', padding: 32, borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
      <h2 style={{ marginTop: 0 }}>ÄÄƒng kÃ½ TÃ i khoáº£n KhÃ¡ch hÃ ng</h2>
      {message && <div style={{ padding: 10, background: '#e0f2fe', color: '#0369a1', borderRadius: 6, marginBottom: 16 }}>{message}</div>}
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', marginBottom: 4 }}>Há» vÃ  tÃªn</label>
          <input required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} style={{ width: '100%', padding: 8, boxSizing: 'border-box' }} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', marginBottom: 4 }}>Email</label>
          <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} style={{ width: '100%', padding: 8, boxSizing: 'border-box' }} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', marginBottom: 4 }}>Sá»‘ Ä‘iá»‡n thoáº¡i</label>
          <input required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} style={{ width: '100%', padding: 8, boxSizing: 'border-box' }} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 4 }}>Máº­t kháº©u</label>
          <input type="password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} style={{ width: '100%', padding: 8, boxSizing: 'border-box' }} />
        </div>
        <button type="submit" style={{ width: '100%', padding: 10, background: '#0284c7', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
          ÄÄƒng kÃ½
        </button>
      </form>
      <div style={{ marginTop: 12, textAlign: 'center', fontSize: 14 }}>
        ÄÃ£ cÃ³ tÃ i khoáº£n? <Link to="/login">ÄÄƒng nháº­p</Link>
      </div>
    </div>
  );
};