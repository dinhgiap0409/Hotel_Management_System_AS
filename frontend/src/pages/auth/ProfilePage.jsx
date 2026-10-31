import { useAuth } from '../../context/AuthContext';
import { StatusBadge } from '../../components/common/StatusBadge';

export const ProfilePage = () => {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <div style={{ background: '#fff', padding: 24, borderRadius: 10, maxWidth: 600 }}>
      <h2 style={{ marginTop: 0 }}>Hồ sơ Cá nhân (UC-03)</h2>
      <p><strong>Mã tài khoản:</strong> #{user.accountId}</p>
      <p><strong>Họ và tên:</strong> {user.fullName}</p>
      <p><strong>Email:</strong> {user.email}</p>
      <p><strong>Vai trò hệ thống:</strong> <StatusBadge status={user.role} /></p>
    </div>
  );
};