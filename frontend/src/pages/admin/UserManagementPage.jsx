import React, { useEffect, useState } from 'react';
import { authApi } from '../../services/authApi';
import { DataTable } from '../../components/common/DataTable';
import { StatusBadge } from '../../components/common/StatusBadge';

export const UserManagementPage = () => {
  const [users, setUsers] = useState([]);

  const fetchUsers = () => {
    authApi.getAllAccounts().then((res) => setUsers(res.data.data || []));
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleToggle = async (id, currentStatus) => {
    const next = currentStatus === 'Active' ? 'Inactive' : 'Active';
    await authApi.updateAccountStatus(id, next);
    fetchUsers();
  };

  return (
    <div>
      <h2>Quáº£n trá»‹ TÃ i khoáº£n & PhÃ¢n quyá»n 10 Role (UC-04, UC-05)</h2>
      <DataTable
        keyField="accountId"
        data={users}
        columns={[
          { header: 'ID', render: (u) => `#${u.accountId}` },
          { header: 'Email', render: (u) => u.email },
          { header: 'Vai trÃ² (10 Role)', render: (u) => <StatusBadge status={u.role?.roleName || ''} /> },
          { header: 'Tráº¡ng thÃ¡i', render: (u) => <StatusBadge status={u.status} /> },
          {
            header: 'Thao tÃ¡c',
            render: (u) => (
              <button
                onClick={() => handleToggle(u.accountId, u.status)}
                style={{ padding: '4px 10px', borderRadius: 4, border: '1px solid #cbd5e1', cursor: 'pointer' }}
              >
                {u.status === 'Active' ? 'KhÃ³a' : 'Má»Ÿ khÃ³a'}
              </button>
            ),
          },
        ]}
      />
    </div>
  );
};