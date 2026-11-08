import { useState, useEffect } from 'react';
import { Link, useNavigate, Navigate } from 'react-router-dom';
import { authApi } from '../../services/authApi';
import { useAuth } from '../../context/AuthContext';

export const ForgotPasswordPage = () => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [fallbackCode, setFallbackCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = setInterval(() => {
      setCooldown((prev) => (prev > 1 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const handleRequestCode = async (e) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setFallbackCode('');
    setLoading(true);
    try {
      const normalizedEmail = email.trim();
      const res = await authApi.forgotPassword(normalizedEmail);
      const data = res.data || {};
      if (data.mailSent === 'false' && data.resetCode) {
        setFallbackCode(data.resetCode);
      }
      setEmail(normalizedEmail);
      setResetCode('');
      setNewPassword('');
      setConfirmPassword('');
      setMessage(data.message || 'Mã xác nhận khôi phục mật khẩu đã được gửi tới email của bạn.');
      setCooldown(30);
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.message || 'Không tìm thấy tài khoản với email này.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (resending || loading || cooldown > 0) return;
    setError(null);
    setMessage(null);
    setFallbackCode('');
    setResending(true);
    try {
      const normalizedEmail = email.trim();
      const res = await authApi.forgotPassword(normalizedEmail);
      const data = res.data || {};
      if (data.mailSent === 'false' && data.resetCode) {
        setFallbackCode(data.resetCode);
      }
      setResetCode('');
      setMessage(
        data.mailSent === 'false'
          ? data.message
          : `Đã gửi lại mã xác nhận (6 chữ số) mới tới ${normalizedEmail}. Mã mới có hiệu lực trong 15 phút.`
      );
      setCooldown(30);
    } catch (err) {
      setError(err.response?.data?.message || 'Không thể gửi lại mã xác nhận. Vui lòng thử lại.');
    } finally {
      setResending(false);
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
      const normalizedEmail = email.trim();
      await authApi.resetPassword({
        email: normalizedEmail,
        resetCode: resetCode.trim(),
        newPassword,
        confirmPassword,
      });
      setMessage('Đặt lại mật khẩu thành công! Đang chuyển về trang đăng nhập...');
      setTimeout(() => {
        navigate('/login', {
          replace: true,
          state: {
            email: normalizedEmail,
            resetSuccessMessage: `Đã đặt lại mật khẩu mới cho tài khoản ${normalizedEmail}. Vui lòng nhập mật khẩu mới để đăng nhập.`,
          },
        });
      }, 1200);
    } catch (err) {
      setCooldown(0);
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
            ? 'Nhập địa chỉ email tài khoản để nhận mã xác thực khôi phục mật khẩu qua email.'
            : 'Kiểm tra hộp thư email, nhập mã xác thực 6 chữ số và thiết lập mật khẩu mới.'}
        </p>
      </div>

      {error && (
        <div style={{ padding: 12, background: '#fee2e2', color: '#991b1b', borderRadius: 6, marginBottom: 16, fontSize: 13 }}>
          <div>{error}</div>
          {step === 2 && (
            <div style={{ marginTop: 8 }}>
              <button
                type="button"
                onClick={handleResendCode}
                disabled={resending || loading}
                style={{
                  background: '#991b1b',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 4,
                  padding: '5px 10px',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: resending || loading ? 'not-allowed' : 'pointer',
                }}
              >
                {resending ? 'Đang gửi lại mã...' : 'Gửi lại mã xác nhận mới ngay'}
              </button>
            </div>
          )}
        </div>
      )}
      {message && (
        <div style={{ padding: 12, background: '#dcfce7', color: '#166534', borderRadius: 6, marginBottom: 16, fontSize: 13 }}>
          {message}
          {fallbackCode && (
            <div style={{ marginTop: 6 }}>
              Mã xác thực: <strong style={{ fontSize: 15 }}>{fallbackCode}</strong>
            </div>
          )}
        </div>
      )}

      {step === 1 ? (
        <form key="forgot-step-1" onSubmit={handleRequestCode}>
          <div style={{ marginBottom: 16 }}>
            <label htmlFor="forgot-email-input" style={{ display: 'block', marginBottom: 6, fontSize: 14, fontWeight: 600 }}>
              Email tài khoản
            </label>
            <input
              id="forgot-email-input"
              name="email"
              type="email"
              autoComplete="email"
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
            {loading ? 'Đang gửi email...' : 'Gửi mã xác nhận qua Email'}
          </button>
        </form>
      ) : (
        <form key="forgot-step-2" onSubmit={handleResetPassword} autoComplete="off">
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <label htmlFor="reset-email-readonly" style={{ fontSize: 13, fontWeight: 600 }}>
                Email tài khoản
              </label>
              <button
                type="button"
                onClick={() => {
                  setStep(1);
                  setError(null);
                  setMessage(null);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  color: '#0284c7',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Đổi email khác
              </button>
            </div>
            <input
              id="reset-email-readonly"
              name="username"
              type="email"
              autoComplete="username"
              value={email}
              readOnly
              style={{ ...inputStyle, background: '#f1f5f9', color: '#475569' }}
            />
          </div>

          <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <label htmlFor="reset-otp-code" style={{ fontSize: 13, fontWeight: 600 }}>
                Mã xác nhận (6 chữ số từ Email)
              </label>
              <button
                type="button"
                onClick={handleResendCode}
                disabled={resending || loading || cooldown > 0}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  color: resending || loading || cooldown > 0 ? '#94a3b8' : '#0284c7',
                  fontSize: 12.5,
                  fontWeight: 600,
                  cursor: resending || loading || cooldown > 0 ? 'not-allowed' : 'pointer',
                }}
              >
                {resending
                  ? 'Đang gửi lại mã...'
                  : cooldown > 0
                    ? `Gửi lại mã (${cooldown}s)`
                    : 'Gửi lại mã xác nhận'}
              </button>
            </div>
            <input
              id="reset-otp-code"
              name="resetCode"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              value={resetCode}
              onChange={(e) => setResetCode(e.target.value)}
              placeholder="Nhập 6 chữ số trong email..."
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label htmlFor="reset-new-password" style={{ display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 600 }}>
              Mật khẩu mới (tối thiểu 8 ký tự)
            </label>
            <div style={{ position: 'relative' }}>
              <input
                id="reset-new-password"
                name="newPassword"
                type={showNewPassword ? 'text' : 'password'}
                autoComplete="new-password"
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Nhập mật khẩu mới..."
                style={{ ...inputStyle, paddingRight: 40 }}
              />
              <button
                type="button"
                onClick={() => setShowNewPassword((prev) => !prev)}
                aria-label={showNewPassword ? 'Ẩn mật khẩu mới' : 'Hiện mật khẩu mới'}
                style={{
                  position: 'absolute',
                  right: 10,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  padding: 4,
                  cursor: 'pointer',
                  color: '#64748b',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                {showNewPassword ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <div style={{ marginBottom: 18 }}>
            <label htmlFor="reset-confirm-password" style={{ display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 600 }}>
              Xác nhận mật khẩu mới
            </label>
            <div style={{ position: 'relative' }}>
              <input
                id="reset-confirm-password"
                name="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                autoComplete="new-password"
                required
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Nhập lại mật khẩu mới..."
                style={{ ...inputStyle, paddingRight: 40 }}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((prev) => !prev)}
                aria-label={showConfirmPassword ? 'Ẩn mật khẩu xác nhận' : 'Hiện mật khẩu xác nhận'}
                style={{
                  position: 'absolute',
                  right: 10,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  padding: 4,
                  cursor: 'pointer',
                  color: '#64748b',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                {showConfirmPassword ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || resending}
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
