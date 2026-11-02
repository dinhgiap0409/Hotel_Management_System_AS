import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { authApi } from '../../services/authApi';
import { StatusBadge } from '../../components/common/StatusBadge';
import { formatDateTime } from '../../lib/datetime';
import { getDepartmentLabel } from '../../config/constants';

export const ProfilePage = () => {
  const { user, updateSavedUser } = useAuth();
  const [profile, setProfile] = useState(user);
  const [form, setForm] = useState({
    fullName: user?.fullName || '',
    phone: user?.phone || '',
    identityNumber: user?.identityNumber || '',
    gender: user?.gender || 'Nam',
    dateOfBirth: user?.dateOfBirth || '',
    address: user?.address || '',
  });
  const [pwdForm, setPwdForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [profileMsg, setProfileMsg] = useState(null);
  const [profileErr, setProfileErr] = useState(null);
  const [pwdMsg, setPwdMsg] = useState(null);
  const [pwdErr, setPwdErr] = useState(null);

  useEffect(() => {
    authApi
      .getMe()
      .then((res) => {
        const data = res.data;
        setProfile(data);
        updateSavedUser(data);
        setForm({
          fullName: data.fullName || '',
          phone: data.phone || '',
          identityNumber: data.identityNumber || '',
          gender: data.gender || 'Nam',
          dateOfBirth: data.dateOfBirth || '',
          address: data.address || '',
        });
      })
      .catch(() => {});
  }, []);

  if (!profile) return null;

  const isCustomer = profile.role === 'CUSTOMER';

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setProfileMsg(null);
    setProfileErr(null);

    const trimmedPhone = form.phone.trim();
    if (!/^(0|\+84)\d{9}$/.test(trimmedPhone)) {
      setProfileErr('Số điện thoại Việt Nam không hợp lệ (10 chữ số, bắt đầu bằng 0 hoặc +84).');
      return;
    }

    const trimmedIdentity = (form.identityNumber || '').trim();
    if (isCustomer && trimmedIdentity && !/^[A-Za-z0-9]{9,12}$/.test(trimmedIdentity)) {
      setProfileErr('Số CCCD/Passport không hợp lệ (gồm 9 đến 12 ký tự chữ hoặc số).');
      return;
    }

    try {
      const res = await authApi.updateProfile({
        fullName: form.fullName.trim(),
        phone: trimmedPhone,
        identityNumber: trimmedIdentity || null,
        gender: form.gender || null,
        dateOfBirth: form.dateOfBirth || null,
        address: form.address || null,
      });
      setProfile(res.data);
      updateSavedUser(res.data);
      setProfileMsg('Cập nhật hồ sơ cá nhân thành công!');
    } catch (err) {
      const validationMsg = err.response?.data?.validationErrors
        ?.map((v) => v.message)
        .filter(Boolean)
        .join('; ');
      setProfileErr(validationMsg || err.response?.data?.message || 'Không thể cập nhật thông tin hồ sơ.');
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPwdMsg(null);
    setPwdErr(null);
    if (pwdForm.newPassword.length < 8) {
      setPwdErr('Mật khẩu mới phải có ít nhất 8 ký tự.');
      return;
    }
    if (pwdForm.newPassword !== pwdForm.confirmPassword) {
      setPwdErr('Xác nhận mật khẩu mới không khớp.');
      return;
    }
    try {
      await authApi.changePassword(pwdForm);
      setPwdMsg('Đổi mật khẩu thành công!');
      setPwdForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      const validationMsg = err.response?.data?.validationErrors
        ?.map((v) => v.message)
        .filter(Boolean)
        .join('; ');
      setPwdErr(validationMsg || err.response?.data?.message || 'Đổi mật khẩu thất bại.');
    }
  };

  const inputStyle = {
    width: '100%',
    padding: '9px 12px',
    borderRadius: 6,
    border: '1px solid #cbd5e1',
    boxSizing: 'border-box',
    fontSize: 14,
  };

  return (
    <div>
      <h2 style={{ marginTop: 0, color: '#0f172a' }}>Hồ sơ Cá nhân & Bảo mật Tài khoản</h2>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 24, alignItems: 'start' }}>
        {/* Left Card: Personal Profile */}
        <div style={{ background: '#fff', padding: 24, borderRadius: 12, border: '1px solid #e2e8f0' }}>
          <h3 style={{ marginTop: 0, marginBottom: 16 }}>1. Thông tin Hồ sơ Cá nhân</h3>

          <div style={{ background: '#f8fafc', padding: 14, borderRadius: 8, marginBottom: 18, fontSize: 13 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span><strong>Mã tài khoản:</strong> #{profile.accountId}</span>
              <span><strong>Trạng thái:</strong> <StatusBadge status={profile.status} /></span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span><strong>Vai trò:</strong> <StatusBadge status={profile.role} /></span>
              {profile.staffCode && <span><strong>Mã NV:</strong> <code>{profile.staffCode}</code></span>}
            </div>
            {profile.departmentName && (
              <div style={{ marginBottom: 4 }}>
                <strong>Phòng ban:</strong> {getDepartmentLabel(profile.departmentId || profile.departmentName)}
              </div>
            )}
            <div style={{ color: '#64748b' }}>
              <strong>Ngày tạo tài khoản:</strong> {formatDateTime(profile.createdAt)}
            </div>
          </div>

          {profileMsg && (
            <div style={{ padding: 10, background: '#dcfce7', color: '#166534', borderRadius: 6, marginBottom: 14, fontSize: 13 }}>
              {profileMsg}
            </div>
          )}
          {profileErr && (
            <div style={{ padding: 10, background: '#fee2e2', color: '#991b1b', borderRadius: 6, marginBottom: 14, fontSize: 13 }}>
              {profileErr}
            </div>
          )}

          <form onSubmit={handleUpdateProfile}>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 600 }}>Email (Không thể thay đổi)</label>
              <input value={profile.email} disabled style={{ ...inputStyle, background: '#f1f5f9', color: '#64748b' }} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={{ display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 600 }}>Họ và tên *</label>
                <input
                  required
                  value={form.fullName}
                  onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 600 }}>Số điện thoại *</label>
                <input
                  required
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  style={inputStyle}
                />
              </div>
            </div>

            {isCustomer ? (
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 600 }}>Số CCCD / Passport (9 - 12 ký tự chữ hoặc số)</label>
                <input
                  value={form.identityNumber}
                  onChange={(e) => setForm({ ...form, identityNumber: e.target.value })}
                  placeholder="Nhập số CCCD (12 số) hoặc Passport..."
                  style={inputStyle}
                />
              </div>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 600 }}>Giới tính</label>
                    <select
                      value={form.gender}
                      onChange={(e) => setForm({ ...form, gender: e.target.value })}
                      style={inputStyle}
                    >
                      <option value="Nam">Nam</option>
                      <option value="Nữ">Nữ</option>
                      <option value="Khác">Khác</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 600 }}>Ngày sinh</label>
                    <input
                      type="date"
                      value={form.dateOfBirth || ''}
                      onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })}
                      style={inputStyle}
                    />
                  </div>
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 600 }}>Địa chỉ liên hệ</label>
                  <input
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    placeholder="Nhập địa chỉ..."
                    style={inputStyle}
                  />
                </div>
              </>
            )}

            <button
              type="submit"
              style={{ background: '#0284c7', color: '#fff', border: 'none', padding: '10px 18px', borderRadius: 6, fontWeight: 600, cursor: 'pointer' }}
            >
              Lưu thay đổi hồ sơ
            </button>
          </form>
        </div>

        {/* Right Card: Change Password */}
        <div style={{ background: '#fff', padding: 24, borderRadius: 12, border: '1px solid #e2e8f0' }}>
          <h3 style={{ marginTop: 0, marginBottom: 16 }}>2. Đổi Mật khẩu Bảo mật</h3>
          <p style={{ color: '#64748b', fontSize: 13, marginBottom: 16 }}>
            Mật khẩu mới phải có tối thiểu 8 ký tự và khác với mật khẩu hiện tại.
          </p>

          {pwdMsg && (
            <div style={{ padding: 10, background: '#dcfce7', color: '#166534', borderRadius: 6, marginBottom: 14, fontSize: 13 }}>
              {pwdMsg}
            </div>
          )}
          {pwdErr && (
            <div style={{ padding: 10, background: '#fee2e2', color: '#991b1b', borderRadius: 6, marginBottom: 14, fontSize: 13 }}>
              {pwdErr}
            </div>
          )}

          <form onSubmit={handleChangePassword}>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 600 }}>Mật khẩu hiện tại *</label>
              <input
                type="password"
                required
                value={pwdForm.currentPassword}
                onChange={(e) => setPwdForm({ ...pwdForm, currentPassword: e.target.value })}
                style={inputStyle}
              />
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 600 }}>Mật khẩu mới *</label>
              <input
                type="password"
                required
                minLength={8}
                value={pwdForm.newPassword}
                onChange={(e) => setPwdForm({ ...pwdForm, newPassword: e.target.value })}
                style={inputStyle}
              />
            </div>

            <div style={{ marginBottom: 18 }}>
              <label style={{ display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 600 }}>Xác nhận mật khẩu mới *</label>
              <input
                type="password"
                required
                minLength={8}
                value={pwdForm.confirmPassword}
                onChange={(e) => setPwdForm({ ...pwdForm, confirmPassword: e.target.value })}
                style={inputStyle}
              />
            </div>

            <button
              type="submit"
              style={{ background: '#0f172a', color: '#fff', border: 'none', padding: '10px 18px', borderRadius: 6, fontWeight: 600, cursor: 'pointer' }}
            >
              Cập nhật mật khẩu
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
