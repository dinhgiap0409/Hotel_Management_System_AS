import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authApi } from '../../services/authApi';

export const RegisterPage = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    identityNumber: '',
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const trimmedPhone = form.phone.trim();
    if (!/^(0|\+84)\d{9}$/.test(trimmedPhone)) {
      setError('Số điện thoại Việt Nam không hợp lệ (10 chữ số, bắt đầu bằng 0 hoặc +84).');
      return;
    }

    const trimmedIdentity = form.identityNumber.trim();
    if (trimmedIdentity && !/^[A-Za-z0-9]{9,12}$/.test(trimmedIdentity)) {
      setError('Số CCCD/Passport không hợp lệ (gồm 9 đến 12 ký tự chữ hoặc số).');
      return;
    }

    if (form.password.length < 8) {
      setError('Mật khẩu phải có ít nhất 8 ký tự.');
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError('Mật khẩu xác nhận không khớp.');
      return;
    }

    setLoading(true);
    try {
      await authApi.register({
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        phone: trimmedPhone,
        identityNumber: trimmedIdentity || null,
        password: form.password,
      });
      setSuccessMsg('Đăng ký tài khoản thành công! Đang chuyển sang trang đăng nhập...');
      setTimeout(() => navigate('/login'), 1500);
    } catch (err) {
      const validationMsg = err.response?.data?.validationErrors
        ?.map((v) => v.message)
        .filter(Boolean)
        .join('; ');
      setError(validationMsg || err.response?.data?.message || 'Có lỗi xảy ra khi đăng ký tài khoản.');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 6,
    border: '1px solid #cbd5e1',
    boxSizing: 'border-box',
    fontSize: 14,
  };

  return (
    <div style={{ maxWidth: 460, margin: '36px auto', background: '#fff', padding: 32, borderRadius: 12, boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}>
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <img
          src="/images/hms-logo.png"
          alt="HMS Hotel Logo"
          style={{
            width: 68,
            height: 68,
            borderRadius: '50%',
            objectFit: 'cover',
            border: '2px solid #e2e8f0',
            marginBottom: 8,
          }}
        />
        <h2 style={{ margin: '0 0 6px', color: '#0f172a' }}>Đăng ký Tài khoản Khách hàng</h2>
        <p style={{ color: '#64748b', fontSize: 13, margin: 0 }}>
          Tạo tài khoản để đặt phòng trực tuyến, theo dõi lịch sử lưu trú và nhận ưu đãi.
        </p>
      </div>

      {error && (
        <div style={{ padding: 12, background: '#fee2e2', color: '#991b1b', borderRadius: 6, marginBottom: 16, fontSize: 13 }}>
          {error}
        </div>
      )}
      {successMsg && (
        <div style={{ padding: 12, background: '#dcfce7', color: '#166534', borderRadius: 6, marginBottom: 16, fontSize: 13 }}>
          {successMsg}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 600 }}>Họ và tên *</label>
          <input
            required
            placeholder="Ví dụ: Nguyễn Văn An"
            value={form.fullName}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            style={inputStyle}
          />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 600 }}>Email *</label>
          <input
            type="email"
            required
            placeholder="example@gmail.com"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            style={inputStyle}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={{ display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 600 }}>Số điện thoại *</label>
            <input
              required
              placeholder="0912345678"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 600 }}>Số CCCD / Passport</label>
            <input
              placeholder="9 - 12 ký tự (VD: 001200012345)"
              value={form.identityNumber}
              onChange={(e) => setForm({ ...form, identityNumber: e.target.value })}
              style={inputStyle}
            />
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 600 }}>Mật khẩu (tối thiểu 8 ký tự) *</label>
          <input
            type="password"
            required
            minLength={8}
            placeholder="Nhập mật khẩu..."
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            style={inputStyle}
          />
        </div>

        <div style={{ marginBottom: 18 }}>
          <label style={{ display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 600 }}>Xác nhận mật khẩu *</label>
          <input
            type="password"
            required
            minLength={8}
            placeholder="Nhập lại mật khẩu..."
            value={form.confirmPassword}
            onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
            style={inputStyle}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            padding: 12,
            background: '#0284c7',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            fontWeight: 600,
            fontSize: 15,
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? 'Đang đăng ký...' : 'Tạo Tài Khoản'}
        </button>
      </form>

      <div style={{ marginTop: 16, textAlign: 'center', fontSize: 14 }}>
        Đã có tài khoản?{' '}
        <Link to="/login" style={{ color: '#0284c7', fontWeight: 600, textDecoration: 'none' }}>
          Đăng nhập
        </Link>
      </div>
    </div>
  );
};
