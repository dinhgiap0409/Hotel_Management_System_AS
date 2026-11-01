import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authApi } from '../../services/authApi';

export const ForgotPasswordPage = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [demoIssuedCode, setDemoIssuedCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleRequestCode = async (e) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);
    try {
      const res = await authApi.forgotPassword(email);
      const data = res.data;
      setDemoIssuedCode(data.resetCode || '');
      setResetCode(data.resetCode || '');
      setMessage(data.message || 'Đã tạo mã khôi phục mật khẩu.');
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.message || 'Không tìm thấy tài khoản với email này.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError(null);
    if (newPassword.length < 8) {
      setError('Mật khẩu mới phải có ít nhất 8 ký tự.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp.');
      return;
    }

    setLoading(true);
    try {
      await authApi.resetPassword({
        email,
        resetCode,
        newPassword,
        confirmPassword,
      });
      setMessage('Đặt lại mật khẩu thành công! Đang chuyển về trang đăng nhập...');
      setTimeout(() => navigate('/login'), 1500);
    } catch (err) {
      setError(err.response?.data?.message || 'Mã xác nhận không hợp lệ hoặc đã hết hạn.');
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
    <div style={{ maxWidth: 440, margin: '40px auto', background: '#fff', padding: 32, borderRadius: 12, boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}>
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
        <h2 style={{ margin: '0 0 6px', color: '#0f172a' }}>Khôi phục Mật khẩu</h2>
        <p style={{ color: '#64748b', fontSize: 13, margin: 0 }}>
          {step === 1
            ? 'Nhập địa chỉ email tài khoản để nhận mã xác thực khôi phục mật khẩu.'
            : 'Nhập mã xác thực 6 chữ số và thiết lập mật khẩu mới.'}
        </p>
      </div>

      {error && (
        <div style={{ padding: 12, background: '#fee2e2', color: '#991b1b', borderRadius: 6, marginBottom: 16, fontSize: 13 }}>
          {error}
        </div>
      )}
      {message && (
        <div style={{ padding: 12, background: '#dcfce7', color: '#166534', borderRadius: 6, marginBottom: 16, fontSize: 13 }}>
          {message}
          {demoIssuedCode && (
            <div style={{ marginTop: 6 }}>
              Mã xác thực: <strong style={{ fontSize: 15 }}>{demoIssuedCode}</strong>
            </div>
          )}
        </div>
      )}

      {step === 1 ? (
        <form onSubmit={handleRequestCode}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 14, fontWeight: 600 }}>Email tài khoản</label>
            <input
              type="email"
              required
              placeholder="Nhập địa chỉ email của bạn..."
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={inputStyle}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            style={{ width: '100%', padding: 12, background: '#0284c7', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer' }}
          >
            {loading ? 'Đang gửi mã...' : 'Gửi mã xác nhận'}
          </button>
        </form>
      ) : (
        <form onSubmit={handleResetPassword}>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 600 }}>Email</label>
            <input type="email" value={email} disabled style={{ ...inputStyle, background: '#f1f5f9' }} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 600 }}>Mã xác nhận (6 chữ số)</label>
            <input
              required
              value={resetCode}
              onChange={(e) => setResetCode(e.target.value)}
              placeholder="Nhập 6 chữ số..."
              style={inputStyle}
            />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 600 }}>Mật khẩu mới (tối thiểu 8 ký tự)</label>
            <input
              type="password"
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              style={inputStyle}
            />
          </div>
          <div style={{ marginBottom: 18 }}>
            <label style={{ display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 600 }}>Xác nhận mật khẩu mới</label>
            <input
              type="password"
              required
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              style={inputStyle}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            style={{ width: '100%', padding: 12, background: '#16a34a', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer' }}
          >
            {loading ? 'Đang cập nhật...' : 'Xác nhận Đặt lại Mật khẩu'}
          </button>
        </form>
      )}

      <div style={{ marginTop: 16, textAlign: 'center', fontSize: 14 }}>
        <Link to="/login" style={{ color: '#0284c7', textDecoration: 'none' }}>
          ← Quay lại Đăng nhập
        </Link>
      </div>
    </div>
  );
};
