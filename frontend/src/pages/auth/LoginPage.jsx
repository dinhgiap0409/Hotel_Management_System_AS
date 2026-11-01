import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ROLE_DEFAULT_ROUTES } from '../../config/constants';

export const LoginPage = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [touched, setTouched] = useState({ email: false, password: false });
  const [fieldErrors, setFieldErrors] = useState({ email: '', password: '' });
  const [serverError, setServerError] = useState(null);
  const [loading, setLoading] = useState(false);

  const validateEmail = (val) => {
    if (!val.trim()) return 'Vui lòng nhập địa chỉ email.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim())) return 'Định dạng email chưa hợp lệ (ví dụ: ten@domain.com).';
    return '';
  };

  const validatePassword = (val) => {
    if (!val) return 'Vui lòng nhập mật khẩu.';
    if (val.length < 6) return 'Mật khẩu cần tối thiểu 6 ký tự.';
    return '';
  };

  const handleBlur = (field) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    if (field === 'email') {
      setFieldErrors((prev) => ({ ...prev, email: validateEmail(email) }));
    } else if (field === 'password') {
      setFieldErrors((prev) => ({ ...prev, password: validatePassword(password) }));
    }
  };

  const handleEmailChange = (val) => {
    setEmail(val);
    if (touched.email && fieldErrors.email) {
      setFieldErrors((prev) => ({ ...prev, email: validateEmail(val) }));
    }
  };

  const handlePasswordChange = (val) => {
    setPassword(val);
    if (touched.password && fieldErrors.password) {
      setFieldErrors((prev) => ({ ...prev, password: validatePassword(val) }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError(null);

    const emailErr = validateEmail(email);
    const pwdErr = validatePassword(password);
    setTouched({ email: true, password: true });
    setFieldErrors({ email: emailErr, password: pwdErr });
    if (emailErr || pwdErr) return;

    setLoading(true);
    try {
      const payload = await login({ email, password });
      const role = payload?.user?.role;
      const target = ROLE_DEFAULT_ROUTES[role] || '/';
      navigate(target);
    } catch (err) {
      setServerError(err.response?.data?.message || 'Đăng nhập thất bại. Vui lòng kiểm tra lại thông tin.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        flex: 1,
        minHeight: 'calc(100vh - 112px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '44px 20px',
        backgroundImage:
          'linear-gradient(180deg, rgba(20, 20, 19, 0.56) 0%, rgba(20, 20, 19, 0.72) 100%), url("/images/hotel-bg.jpg")',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      {/* Centered Split Login Card (inspired by reference mockup) */}
      <div
        style={{
          width: '100%',
          maxWidth: 920,
          minHeight: 530,
          display: 'grid',
          gridTemplateColumns: '1.28fr 1fr',
          background: '#FAF9F5',
          borderRadius: 8,
          overflow: 'hidden',
          border: '1px solid rgba(232, 230, 220, 0.35)',
          boxShadow: '0 24px 56px rgba(20, 20, 19, 0.42)',
        }}
      >
        {/* Left Panel: Hotel Photo + Concise Introduction */}
        <div
          style={{
            position: 'relative',
            padding: '48px 42px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            color: '#FAF9F5',
            backgroundImage:
              'linear-gradient(160deg, rgba(20, 20, 19, 0.78) 0%, rgba(20, 20, 19, 0.36) 52%, rgba(20, 20, 19, 0.84) 100%), url("/images/hotel-bg.jpg")',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
          <div>
            <div
              style={{
                display: 'inline-block',
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: '#E8E6DC',
                borderBottom: '1px solid rgba(154, 102, 155, 0.85)',
                paddingBottom: 4,
                marginBottom: 20,
              }}
            >
              HMS Luxury Hospitality
            </div>

            <h1
              style={{
                margin: '0 0 16px',
                fontFamily: 'var(--font-display)',
                fontSize: 38,
                fontWeight: 400,
                lineHeight: 1.14,
                letterSpacing: '-0.02em',
                color: '#FAF9F5',
              }}
            >
              Không gian nghỉ dưỡng <br />
              <em style={{ fontStyle: 'italic', color: '#F5E6D3' }}>thanh lịch</em> &amp; trọn vẹn.
            </h1>

            <p
              style={{
                margin: 0,
                fontSize: 15,
                lineHeight: 1.65,
                color: '#E8E6DC',
                maxWidth: '42ch',
              }}
            >
              Hệ thống đặt phòng và quản trị khách sạn trực tuyến — nơi quý khách tra cứu hạng phòng theo thời gian thực, đặt kỳ nghỉ chỉ trong vài chạm và tận hưởng dịch vụ lưu trú tận tâm.
            </p>
          </div>

          <div
            style={{
              borderTop: '1px solid rgba(232, 230, 220, 0.24)',
              paddingTop: 18,
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 14,
              fontSize: 12,
              color: '#E8E6DC',
            }}
          >
            <div>
              <div style={{ fontWeight: 600, color: '#FAF9F5', marginBottom: 2 }}>Đặt phòng trực tuyến</div>
              <div style={{ color: '#D1CFC5', fontSize: 11.5 }}>Tra cứu &amp; giữ phòng tức thì</div>
            </div>
            <div>
              <div style={{ fontWeight: 600, color: '#FAF9F5', marginBottom: 2 }}>Dịch vụ nội khu</div>
              <div style={{ color: '#D1CFC5', fontSize: 11.5 }}>Ẩm thực, Spa &amp; chăm sóc phòng</div>
            </div>
            <div>
              <div style={{ fontWeight: 600, color: '#FAF9F5', marginBottom: 2 }}>Vận hành đồng bộ</div>
              <div style={{ color: '#D1CFC5', fontSize: 11.5 }}>Lễ tân, Buồng phòng &amp; Folio</div>
            </div>
          </div>
        </div>

        {/* Right Panel: Clean Login Form */}
        <div
          style={{
            padding: '46px 40px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            background: '#FAF9F5',
          }}
        >
          {/* HMS Hotel Circular Logo Badge */}
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div
              style={{
                width: 86,
                height: 86,
                borderRadius: '50%',
                margin: '0 auto 14px',
                background: '#141413',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '3px solid #E8E6DC',
                overflow: 'hidden',
                boxShadow: '0 6px 18px rgba(20, 20, 19, 0.16)',
              }}
            >
              <img
                src="/images/hms-logo.png"
                alt="HMS Hotel Logo"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                }}
              />
            </div>

            <div style={{ fontSize: 13.5, color: '#5E5D59' }}>
              Chưa có tài khoản?{' '}
              <Link to="/register" style={{ color: '#C96442', fontWeight: 600, textDecoration: 'none' }}>
                Đăng ký ngay
              </Link>
            </div>
          </div>

          {serverError && (
            <div
              role="alert"
              style={{
                background: '#FDF2F0',
                color: '#991B1B',
                padding: '10px 12px',
                borderRadius: 6,
                marginBottom: 16,
                fontSize: 13,
                border: '1px solid #F5C6CB',
              }}
            >
              {serverError}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            {/* Email Field */}
            <div style={{ marginBottom: 14 }}>
              <label
                htmlFor="login-email"
                style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: '#3D3D3A', marginBottom: 6 }}
              >
                Email đăng nhập
              </label>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  border: fieldErrors.email ? '1px solid #DC2626' : '1px solid #D5D2C6',
                  borderRadius: 6,
                  padding: '0 12px',
                  background: '#FFFFFF',
                }}
              >
                <svg
                  width="17"
                  height="17"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#5E5D59"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ marginRight: 10, flexShrink: 0 }}
                  aria-hidden="true"
                >
                  <rect width="20" height="16" x="2" y="4" rx="2" />
                  <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                </svg>
                <input
                  id="login-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => handleEmailChange(e.target.value)}
                  onBlur={() => handleBlur('email')}
                  required
                  aria-invalid={!!fieldErrors.email}
                  aria-describedby={fieldErrors.email ? 'login-email-error' : undefined}
                  placeholder="Email"
                  style={{
                    width: '100%',
                    padding: '11px 0',
                    border: 'none',
                    outline: 'none',
                    fontSize: 14,
                    color: '#141413',
                    background: 'transparent',
                  }}
                />
              </div>
              {fieldErrors.email && (
                <div
                  id="login-email-error"
                  role="alert"
                  style={{ color: '#DC2626', fontSize: 12, marginTop: 4 }}
                >
                  {fieldErrors.email}
                </div>
              )}
            </div>

            {/* Password Field */}
            <div style={{ marginBottom: 20 }}>
              <label
                htmlFor="login-password"
                style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: '#3D3D3A', marginBottom: 6 }}
              >
                Mật khẩu
              </label>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  border: fieldErrors.password ? '1px solid #DC2626' : '1px solid #D5D2C6',
                  borderRadius: 6,
                  padding: '0 12px',
                  background: '#FFFFFF',
                }}
              >
                <svg
                  width="17"
                  height="17"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#5E5D59"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ marginRight: 10, flexShrink: 0 }}
                  aria-hidden="true"
                >
                  <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                <input
                  id="login-password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => handlePasswordChange(e.target.value)}
                  onBlur={() => handleBlur('password')}
                  required
                  aria-invalid={!!fieldErrors.password}
                  aria-describedby={fieldErrors.password ? 'login-password-error' : undefined}
                  placeholder="Mật khẩu"
                  style={{
                    width: '100%',
                    padding: '11px 0',
                    border: 'none',
                    outline: 'none',
                    fontSize: 14,
                    color: '#141413',
                    background: 'transparent',
                  }}
                />
              </div>
              {fieldErrors.password && (
                <div
                  id="login-password-error"
                  role="alert"
                  style={{ color: '#DC2626', fontSize: 12, marginTop: 4 }}
                >
                  {fieldErrors.password}
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                background: '#16233B',
                color: '#FAF9F5',
                border: 'none',
                padding: '13px',
                borderRadius: 6,
                fontWeight: 600,
                fontSize: 14.5,
                letterSpacing: '0.02em',
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
            </button>
          </form>

          <div style={{ marginTop: 22, textAlign: 'center' }}>
            <Link
              to="/forgot-password"
              style={{ fontSize: 13, color: '#3D3D3A', textDecoration: 'underline', textUnderlineOffset: 3, fontWeight: 500 }}
            >
              Quên mật khẩu?
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
