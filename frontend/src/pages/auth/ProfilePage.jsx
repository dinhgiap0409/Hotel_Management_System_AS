import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { StatusBadge } from '../../components/common/StatusBadge';

export const ProfilePage = () => {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <div style={{ background: '#fff', padding: 24, borderRadius: 10, maxWidth: 600 }}>
      <h2 style={{ marginTop: 0 }}>Há»“ sÆ¡ CÃ¡ nhÃ¢n (UC-03)</h2>
      <p><strong>MÃ£ tÃ i khoáº£n:</strong> #{user.accountId}</p>
      <p><strong>Há» vÃ  tÃªn:</strong> {user.fullName}</p>
      <p><strong>Email:</strong> {user.email}</p>
      <p><strong>Vai trÃ² há»‡ thá»‘ng:</strong> <StatusBadge status={user.role} /></p>
    </div>
  );
};