import { useState, useEffect } from 'react';
import { useNavigate, Link, Navigate } from 'react-router-dom';
import { authApi } from '../../services/authApi';
import { useAuth } from '../../context/AuthContext';

const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com',
  'yopmail.com',
  '10minutemail.com',
  'tempmail.com',
  'temp-mail.org',
  'guerrillamail.com',
  'sharklasers.com',
  'trashmail.com',
  'dispostable.com',
  'fakeinbox.com',
  'maildrop.cc',
  'getnada.com',
  'throwawaymail.com',
  'mohmal.com',
  'emailondeck.com',
  'example.com',
  'test.com',
]);

export const RegisterPage = () => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState(1); // 1: Điền thông tin, 2: Xác thực OTP Email
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    identityNumber: '',
    password: '',
    confirmPassword: '',
  });
  const [otpCode, setOtpCode] = useState('');
  const [fallbackCode, setFallbackCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState(null);
  const [infoMsg, setInfoMsg] = useState(null);
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

  const extractErrorMessage = (err, fallback) => {
    const validationMsg = err.response?.data?.validationErrors
      ?.map((v) => v.message)
      .filter(Boolean)
      .join('; ');
    return validationMsg || err.response?.data?.message || fallback;
  };

  const handleRequestOtp = async (e) => {
    e.preventDefault();
    setError(null);
    setInfoMsg(null);
    setFallbackCode('');

    const normalizedEmail = form.email.trim().toLowerCase();
    if (!/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(normalizedEmail)) {
      setError('Định dạng địa chỉ email không hợp lệ (ví dụ: ten@gmail.com).');
      return;
    }

    const domain = normalizedEmail.split('@')[1];
    if (DISPOSABLE_DOMAINS.has(domain)) {
      setError('Vui lòng sử dụng địa chỉ email cá nhân hợp lệ (không chấp nhận email ảo / email dùng một lần).');
      return;
    }

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
      const res = await authApi.requestRegisterOtp({
        fullName: form.fullName.trim(),
        email: normalizedEmail,
        phone: trimmedPhone,
        identityNumber: trimmedIdentity || null,
        password: form.password,
      });
      const data = res.data || {};
      if (data.mailSent === 'false' && data.verificationCode) {
        setFallbackCode(data.verificationCode);
      }
      setForm((prev) => ({ ...prev, email: normalizedEmail }));
      setOtpCode('');
      setInfoMsg(
        data.message ||
          `Mã xác thực gồm 6 chữ số đã được gửi tới hộp thư ${normalizedEmail}. Vui lòng nhập mã để hoàn tất đăng ký.`
      );
      setCooldown(30);
      setStep(2);
    } catch (err) {
      setError(extractErrorMessage(err, 'Không thể gửi mã xác thực đăng ký. Vui lòng kiểm tra lại thông tin.'));
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async (forceImmediate = false) => {
    if (resending || loading || (!forceImmediate && cooldown > 0)) return;
    setError(null);
    setInfoMsg(null);
    setFallbackCode('');
    setResending(true);
    try {
      const normalizedEmail = form.email.trim().toLowerCase();
      const res = await authApi.resendRegisterOtp(normalizedEmail);
      const data = res.data || {};
      if (data.mailSent === 'false' && data.verificationCode) {
        setFallbackCode(data.verificationCode);
      }
      setOtpCode('');
      setInfoMsg(
        data.message ||
          `Đã gửi lại mã xác thực (6 chữ số) mới tới ${normalizedEmail}. Mã mới có hiệu lực trong 15 phút.`
      );
      setCooldown(30);
    } catch (err) {
      setError(extractErrorMessage(err, 'Không thể gửi lại mã xác thực. Vui lòng thử lại.'));
    } finally {
      setResending(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError(null);

    const cleanedOtp = otpCode.trim();
    if (!/^\d{6}$/.test(cleanedOtp)) {
      setError('Vui lòng nhập đủ 6 chữ số của mã xác thực.');
      return;
    }

    setLoading(true);
    try {
      const normalizedEmail = form.email.trim().toLowerCase();
      await authApi.verifyRegisterOtp(normalizedEmail, cleanedOtp);
      setInfoMsg('Xác thực email và tạo tài khoản thành công! Đang chuyển sang trang đăng nhập...');
      setTimeout(() => {
        navigate('/login', {
          replace: true,
          state: {
            email: normalizedEmail,
            resetSuccessMessage: `Xác thực email thành công! Tài khoản ${normalizedEmail} đã sẵn sàng để đăng nhập.`,
          },
        });
      }, 1200);
    } catch (err) {
      setError(extractErrorMessage(err, 'Mã xác thực không chính xác hoặc đã hết hạn.'));
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

  const eyeBtnStyle = {
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
  };

  const renderEyeIcon = (visible) =>
    visible ? (
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
    );

  return (
    <div style={{ maxWidth: 460, margin: '36px auto', background: '#fff', padding: 32, borderRadius: 12, boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}>
      <div style={{ textAlign: 'center', marginBottom: 18 }}>
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
        <h2 style={{ margin: '0 0 6px', color: '#0f172a' }}>
          {step === 1 ? 'Đăng ký Tài khoản Khách hàng' : 'Xác thực Địa chỉ Email'}
        </h2>
        <p style={{ color: '#64748b', fontSize: 13, margin: 0 }}>
          {step === 1
            ? 'Bước 1/2: Nhập thông tin cá nhân và nhận mã xác thực qua email thật.'
            : 'Bước 2/2: Nhập mã xác thực 6 chữ số vừa gửi tới email của bạn.'}
        </p>
      </div>

      {/* Step progress bar */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 18 }}>
        <div style={{ height: 4, borderRadius: 999, background: '#0284c7' }} />
        <div style={{ height: 4, borderRadius: 999, background: step === 2 ? '#0284c7' : '#e2e8f0', transition: 'background 0.25s ease' }} />
      </div>

      {error && (
        <div style={{ padding: 12, background: '#fee2e2', color: '#991b1b', borderRadius: 6, marginBottom: 16, fontSize: 13 }}>
          <div>{error}</div>
          {step === 2 && (
            <button
              type="button"
              disabled={resending || loading}
              onClick={() => {
                setCooldown(0);
                handleResendOtp(true);
              }}
              style={{
                marginTop: 8,
                padding: '6px 12px',
                background: '#fff',
                color: '#991b1b',
                border: '1px solid #fca5a5',
                borderRadius: 6,
                fontSize: 12.5,
                fontWeight: 600,
                cursor: resending || loading ? 'not-allowed' : 'pointer',
              }}
            >
              {resending ? 'Đang gửi mã mới...' : 'Gửi lại mã xác thực mới ngay'}
            </button>
          )}
        </div>
      )}

      {infoMsg && (
        <div style={{ padding: 12, background: '#dcfce7', color: '#166534', borderRadius: 6, marginBottom: 16, fontSize: 13 }}>
          <div>{infoMsg}</div>
          {fallbackCode && (
            <div style={{ marginTop: 8, padding: '8px 10px', background: '#fff', borderRadius: 6, border: '1px dashed #16a34a', fontWeight: 700, textAlign: 'center', letterSpacing: 4, fontSize: 18 }}>
              {fallbackCode}
            </div>
          )}
        </div>
      )}

      {step === 1 ? (
        <form key="register-step-1" onSubmit={handleRequestOtp}>
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
            <label style={{ display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 600 }}>Email nhận mã xác thực *</label>
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
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                required
                minLength={8}
                placeholder="Nhập mật khẩu..."
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                style={{ ...inputStyle, paddingRight: 40 }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                style={eyeBtnStyle}
              >
                {renderEyeIcon(showPassword)}
              </button>
            </div>
          </div>

          <div style={{ marginBottom: 18 }}>
            <label style={{ display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 600 }}>Xác nhận mật khẩu *</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                autoComplete="new-password"
                required
                minLength={8}
                placeholder="Nhập lại mật khẩu..."
                value={form.confirmPassword}
                onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                style={{ ...inputStyle, paddingRight: 40 }}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((prev) => !prev)}
                aria-label={showConfirmPassword ? 'Ẩn mật khẩu xác nhận' : 'Hiện mật khẩu xác nhận'}
                style={eyeBtnStyle}
              >
                {renderEyeIcon(showConfirmPassword)}
              </button>
            </div>
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
            {loading ? 'Đang kiểm tra & gửi mã xác thực...' : 'Tiếp tục & Nhận mã xác thực'}
          </button>
        </form>
      ) : (
        <form key="register-step-2" onSubmit={handleVerifyOtp}>
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <label htmlFor="register-email-readonly" style={{ fontSize: 13, fontWeight: 600 }}>
                Email nhận mã
              </label>
              <button
                type="button"
                disabled={loading || resending}
                onClick={() => {
                  setStep(1);
                  setError(null);
                  setInfoMsg(null);
                  setOtpCode('');
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  color: '#0284c7',
                  fontSize: 12.5,
                  fontWeight: 600,
                  cursor: loading || resending ? 'not-allowed' : 'pointer',
                }}
              >
                Sửa thông tin / Đổi email
              </button>
            </div>
            <input
              id="register-email-readonly"
              type="email"
              value={form.email}
              readOnly
              style={{ ...inputStyle, background: '#f1f5f9', color: '#475569' }}
            />
          </div>

          <div style={{ marginBottom: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <label htmlFor="register-otp-code" style={{ fontSize: 13, fontWeight: 600 }}>
                Mã xác thực (6 chữ số) *
              </label>
              <button
                type="button"
                onClick={() => handleResendOtp(false)}
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
                    : 'Gửi lại mã xác thực'}
              </button>
            </div>
            <input
              id="register-otp-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              required
              autoFocus
              placeholder="Nhập 6 chữ số từ email..."
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              style={{
                ...inputStyle,
                fontSize: 20,
                fontWeight: 700,
                letterSpacing: 6,
                textAlign: 'center',
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading || resending}
            style={{
              width: '100%',
              padding: 12,
              background: '#0284c7',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              fontWeight: 600,
              fontSize: 15,
              cursor: loading || resending ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Đang xác thực & tạo tài khoản...' : 'Xác nhận & Hoàn tất Đăng ký'}
          </button>
        </form>
      )}

      <div style={{ marginTop: 16, textAlign: 'center', fontSize: 14 }}>
        Đã có tài khoản?{' '}
        <Link to="/login" style={{ color: '#0284c7', fontWeight: 600, textDecoration: 'none' }}>
          Đăng nhập
        </Link>
      </div>
    </div>
  );
};
