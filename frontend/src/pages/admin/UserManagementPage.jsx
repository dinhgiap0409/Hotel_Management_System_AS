import { useEffect, useState } from 'react';
import { authApi } from '../../services/authApi';
import { useAuth } from '../../context/AuthContext';
import { DataTable } from '../../components/common/DataTable';
import { StatusBadge } from '../../components/common/StatusBadge';
import { getRoleLabel, getDepartmentLabel, getStatusLabel } from '../../config/constants';

/**
 * Mapping chuẩn giữa Phòng ban (Department) và các Vai trò (Roles) thuộc phòng ban đó
 * theo đúng cấu trúc tổ chức khách sạn trong tài liệu SRS & SDD.
 */
const DEPARTMENT_ROLES_MAP = {
  1: ['ADMIN'],                                    // Phòng Công nghệ Thông tin & Kỹ thuật
  2: ['GENERAL_MANAGER'],                          // Ban Giám đốc Điều hành
  3: ['SALES_MANAGER'],                            // Phòng Kinh doanh & Tiếp thị
  4: ['HOUSEKEEPING_MANAGER', 'HOUSEKEEPING'],     // Bộ phận Buồng phòng
  5: ['SERVICE_MANAGER', 'SERVICE_STAFF'],         // Bộ phận Dịch vụ & Tiện ích
  6: ['ACCOUNTANT'],                               // Phòng Tài chính - Kế toán
  7: ['FRONT_DESK'],                               // Bộ phận Tiền sảnh & Lễ tân
};

export const UserManagementPage = () => {
  const { user: currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'ADMIN';

  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [departments, setDepartments] = useState([]);

  const [keyword, setKeyword] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [error, setError] = useState(null);

  const [createForm, setCreateForm] = useState({
    email: '',
    password: '',
    fullName: '',
    phone: '',
    departmentId: 7,
    roleName: 'FRONT_DESK',
    gender: 'Nam',
    address: '',
  });

  const getAllowedRolesForDepartment = (deptId) => {
    const allowed = DEPARTMENT_ROLES_MAP[Number(deptId)];
    if (allowed && allowed.length > 0) {
      return allowed;
    }
    return ['FRONT_DESK'];
  };

  const loadMetadata = () => {
    authApi.getRoles().then((res) => setRoles(res.data || [])).catch(() => {});
    authApi.getDepartments().then((res) => setDepartments(res.data || [])).catch(() => {});
  };

  const fetchUsers = () => {
    authApi
      .getUsers({
        keyword: keyword || undefined,
        role: roleFilter || undefined,
        status: statusFilter || undefined,
      })
      .then((res) => {
        const list = Array.isArray(res.data) ? res.data : res.data?.content || res.data?.data || [];
        setUsers(list);
      })
      .catch((err) => setError(err.response?.data?.message || 'Không thể tải danh sách tài khoản.'));
  };

  useEffect(() => {
    loadMetadata();
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [roleFilter, statusFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchUsers();
  };

  const handleCreateDepartmentChange = (newDeptId) => {
    const deptNum = Number(newDeptId);
    const validRoles = getAllowedRolesForDepartment(deptNum);
    setCreateForm({
      ...createForm,
      departmentId: deptNum,
      roleName: validRoles[0],
    });
  };

  const handleEditDepartmentChange = (newDeptId) => {
    const deptNum = Number(newDeptId);
    const validRoles = getAllowedRolesForDepartment(deptNum);
    setEditingUser({
      ...editingUser,
      departmentId: deptNum,
      role: validRoles.includes(editingUser.role) ? editingUser.role : validRoles[0],
    });
  };

  const handleStatusChange = async (account, nextStatus) => {
    setFeedback(null);
    setError(null);
    try {
      await authApi.updateAccountStatus(account.accountId, nextStatus);
      setFeedback(`Đã chuyển trạng thái tài khoản ${account.email} sang "${getStatusLabel(nextStatus)}".`);
      fetchUsers();
    } catch (err) {
      setError(err.response?.data?.message || 'Không thể thay đổi trạng thái tài khoản.');
    }
  };

  const handleRoleChange = async (account, newRoleName) => {
    if (newRoleName === account.role) return;
    setFeedback(null);
    setError(null);
    try {
      await authApi.assignUserRole(account.accountId, newRoleName, account.departmentId);
      setFeedback(`Đã phân quyền "${getRoleLabel(newRoleName)}" cho tài khoản ${account.email}.`);
      fetchUsers();
    } catch (err) {
      setError(err.response?.data?.message || 'Không thể cập nhật vai trò.');
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setFeedback(null);
    setError(null);
    try {
      await authApi.createUser({
        ...createForm,
        departmentId: Number(createForm.departmentId),
      });
      setFeedback(`Đã tạo mới tài khoản nhân sự ${createForm.email} (${getRoleLabel(createForm.roleName)}).`);
      setShowCreateModal(false);
      setCreateForm({
        email: '',
        password: '',
        fullName: '',
        phone: '',
        departmentId: 7,
        roleName: 'FRONT_DESK',
        gender: 'Nam',
        address: '',
      });
      fetchUsers();
    } catch (err) {
      setError(err.response?.data?.message || 'Không thể tạo tài khoản mới.');
    }
  };

  const handleUpdateUser = async (e) => {
    e.preventDefault();
    if (!editingUser) return;
    setFeedback(null);
    setError(null);
    try {
      await authApi.updateUser(editingUser.accountId, {
        fullName: editingUser.fullName,
        phone: editingUser.phone,
        departmentId: editingUser.departmentId ? Number(editingUser.departmentId) : null,
        gender: editingUser.gender,
        address: editingUser.address,
        employmentStatus: editingUser.employmentStatus,
        identityNumber: editingUser.identityNumber,
      });
      if (editingUser.role !== 'CUSTOMER' && editingUser.accountId !== currentUser?.accountId) {
        await authApi.assignUserRole(editingUser.accountId, editingUser.role, Number(editingUser.departmentId));
      }
      setFeedback(`Đã cập nhật thông tin người dùng ${editingUser.email}.`);
      setEditingUser(null);
      fetchUsers();
    } catch (err) {
      setError(err.response?.data?.message || 'Cập nhật thông tin thất bại.');
    }
  };

  const totalActive = users.filter((u) => u.status === 'ACTIVE').length;
  const totalLocked = users.filter((u) => u.status !== 'ACTIVE').length;
  const totalStaff = users.filter((u) => u.role !== 'CUSTOMER').length;

  const createModalAllowedRoles = getAllowedRolesForDepartment(createForm.departmentId);
  const editModalAllowedRoles = editingUser?.departmentId
    ? getAllowedRolesForDepartment(editingUser.departmentId)
    : [];

  const inputStyle = {
    padding: '8px 12px',
    borderRadius: 6,
    border: '1px solid #cbd5e1',
    fontSize: 13,
    boxSizing: 'border-box',
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0, color: '#0f172a' }}>Quản trị Tài khoản & Phân quyền</h2>
          <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 13 }}>
            Quản lý tài khoản người dùng, phòng ban và phân quyền theo vai trò.
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowCreateModal(true)}
            style={{
              background: '#0284c7',
              color: '#fff',
              border: 'none',
              padding: '10px 16px',
              borderRadius: 8,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            + Tạo Tài khoản Nhân sự
          </button>
        )}
      </div>

      {/* KPI Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>
        <div style={{ background: '#fff', padding: 16, borderRadius: 10, border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: 12, color: '#64748b' }}>Tổng số Tài khoản</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#0f172a' }}>{users.length}</div>
        </div>
        <div style={{ background: '#fff', padding: 16, borderRadius: 10, border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: 12, color: '#64748b' }}>Đang Hoạt động</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#16a34a' }}>{totalActive}</div>
        </div>
        <div style={{ background: '#fff', padding: 16, borderRadius: 10, border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: 12, color: '#64748b' }}>Đã Khóa / Ngừng hoạt động</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#dc2626' }}>{totalLocked}</div>
        </div>
        <div style={{ background: '#fff', padding: 16, borderRadius: 10, border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: 12, color: '#64748b' }}>Nhân sự Nội bộ</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#0284c7' }}>{totalStaff}</div>
        </div>
      </div>

      {feedback && (
        <div style={{ padding: 12, background: '#dcfce7', color: '#166534', borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
          {feedback}
        </div>
      )}
      {error && (
        <div style={{ padding: 12, background: '#fee2e2', color: '#991b1b', borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* Search & Filter Bar */}
      <form
        onSubmit={handleSearchSubmit}
        style={{
          display: 'flex',
          gap: 10,
          flexWrap: 'wrap',
          background: '#fff',
          padding: 14,
          borderRadius: 10,
          border: '1px solid #e2e8f0',
          marginBottom: 18,
          alignItems: 'center',
        }}
      >
        <input
          placeholder="Tìm theo họ tên, email, SĐT, mã nhân viên..."
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          style={{ ...inputStyle, flex: 1, minWidth: 240 }}
        />
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} style={inputStyle}>
          <option value="">-- Tất cả Vai trò --</option>
          {roles.map((r) => (
            <option key={r.roleName} value={r.roleName}>
              {getRoleLabel(r.roleName)}
            </option>
          ))}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={inputStyle}>
          <option value="">-- Tất cả Trạng thái --</option>
          <option value="ACTIVE">Đang hoạt động</option>
          <option value="LOCKED">Đang bị khóa</option>
          <option value="INACTIVE">Ngừng hoạt động</option>
        </select>
        <button
          type="submit"
          style={{ background: '#0f172a', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}
        >
          Tìm kiếm
        </button>
        <button
          type="button"
          onClick={() => {
            setKeyword('');
            setRoleFilter('');
            setStatusFilter('');
            setTimeout(fetchUsers, 0);
          }}
          style={{ background: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1', padding: '8px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}
        >
          Đặt lại
        </button>
      </form>

      {/* Users Table */}
      <DataTable
        keyField="accountId"
        data={users}
        columns={[
          {
            header: 'ID / Mã NV',
            render: (u) => (
              <div>
                <strong>#{u.accountId}</strong>
                {u.staffCode && (
                  <div style={{ fontSize: 11, color: '#0284c7', fontWeight: 600 }}>{u.staffCode}</div>
                )}
              </div>
            ),
          },
          {
            header: 'Họ tên & Email',
            render: (u) => (
              <div>
                <div style={{ fontWeight: 600 }}>{u.fullName}</div>
                <div style={{ fontSize: 12, color: '#64748b' }}>{u.email}</div>
              </div>
            ),
          },
          {
            header: 'SĐT / Phòng ban',
            render: (u) => (
              <div>
                <div>{u.phone || '-'}</div>
                <div style={{ fontSize: 12, color: '#64748b' }}>
                  {u.departmentId || u.departmentName
                    ? getDepartmentLabel(u.departmentId || u.departmentName)
                    : u.role === 'CUSTOMER'
                      ? 'Khách hàng bên ngoài'
                      : '-'}
                </div>
              </div>
            ),
          },
          {
            header: 'Vai trò',
            render: (u) => {
              const deptRoles = u.departmentId ? getAllowedRolesForDepartment(u.departmentId) : [u.role];
              if (isAdmin && u.role !== 'CUSTOMER' && u.accountId !== currentUser?.accountId && deptRoles.length > 1) {
                return (
                  <select
                    value={u.role}
                    onChange={(e) => handleRoleChange(u, e.target.value)}
                    style={{ ...inputStyle, padding: '4px 8px', fontSize: 12, fontWeight: 600 }}
                  >
                    {deptRoles.map((rName) => (
                      <option key={rName} value={rName}>
                        {getRoleLabel(rName)}
                      </option>
                    ))}
                  </select>
                );
              }
              return <StatusBadge status={u.role} />;
            },
          },
          {
            header: 'Trạng thái',
            render: (u) => (
              <div>
                <StatusBadge status={u.status} />
                {u.failedLoginAttempts > 0 && (
                  <div style={{ fontSize: 11, color: '#dc2626', marginTop: 2 }}>
                    Sai mật khẩu: {u.failedLoginAttempts}/5
                  </div>
                )}
              </div>
            ),
          },
          {
            header: 'Thao tác',
            render: (u) =>
              isAdmin ? (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button
                    onClick={() => setEditingUser({ ...u })}
                    style={{
                      padding: '5px 10px',
                      fontSize: 12,
                      borderRadius: 5,
                      border: '1px solid #cbd5e1',
                      background: '#fff',
                      cursor: 'pointer',
                    }}
                  >
                    Sửa
                  </button>
                  {u.accountId !== currentUser?.accountId && (
                    <>
                      {u.status === 'ACTIVE' ? (
                        <button
                          onClick={() => handleStatusChange(u, 'LOCKED')}
                          style={{
                            padding: '5px 10px',
                            fontSize: 12,
                            borderRadius: 5,
                            border: 'none',
                            background: '#dc2626',
                            color: '#fff',
                            cursor: 'pointer',
                          }}
                        >
                          Khóa
                        </button>
                      ) : (
                        <button
                          onClick={() => handleStatusChange(u, 'ACTIVE')}
                          style={{
                            padding: '5px 10px',
                            fontSize: 12,
                            borderRadius: 5,
                            border: 'none',
                            background: '#16a34a',
                            color: '#fff',
                            cursor: 'pointer',
                          }}
                        >
                          Mở khóa
                        </button>
                      )}
                    </>
                  )}
                </div>
              ) : (
                <span style={{ fontSize: 12, color: '#64748b' }}>Chỉ xem</span>
              ),
          },
        ]}
      />

      {/* Create Staff User Modal */}
      {showCreateModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15,23,42,0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div style={{ background: '#fff', padding: 28, borderRadius: 12, width: '100%', maxWidth: 540 }}>
            <h3 style={{ marginTop: 0, marginBottom: 6 }}>Tạo Tài khoản Nhân sự Mới</h3>
            <p style={{ marginTop: 0, marginBottom: 18, fontSize: 13, color: '#64748b' }}>
              Chọn <strong>Phòng ban</strong> trước, hệ thống sẽ hiển thị các <strong>Vai trò</strong> thuộc đúng phòng ban đó.
            </p>
            <form onSubmit={handleCreateUser}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={{ display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 600 }}>Họ và tên *</label>
                  <input
                    required
                    placeholder="Nhập họ và tên..."
                    value={createForm.fullName}
                    onChange={(e) => setCreateForm({ ...createForm, fullName: e.target.value })}
                    style={{ ...inputStyle, width: '100%' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 600 }}>Số điện thoại *</label>
                  <input
                    required
                    placeholder="0901234567"
                    value={createForm.phone}
                    onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
                    style={{ ...inputStyle, width: '100%' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={{ display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 600 }}>Email đăng nhập *</label>
                  <input
                    type="email"
                    required
                    placeholder="nhanvien@hms.com"
                    value={createForm.email}
                    onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                    style={{ ...inputStyle, width: '100%' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 600 }}>Mật khẩu khởi tạo *</label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    placeholder="Tối thiểu 8 ký tự..."
                    value={createForm.password}
                    onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                    style={{ ...inputStyle, width: '100%' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={{ display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 600 }}>Phòng ban *</label>
                  <select
                    value={createForm.departmentId}
                    onChange={(e) => handleCreateDepartmentChange(e.target.value)}
                    style={{ ...inputStyle, width: '100%' }}
                  >
                    {departments.map((d) => (
                      <option key={d.departmentId} value={d.departmentId}>
                        {getDepartmentLabel(d.departmentId || d.departmentName)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 600 }}>Vai trò trong Phòng ban *</label>
                  <select
                    value={createForm.roleName}
                    onChange={(e) => setCreateForm({ ...createForm, roleName: e.target.value })}
                    style={{ ...inputStyle, width: '100%' }}
                  >
                    {createModalAllowedRoles.map((rName) => (
                      <option key={rName} value={rName}>
                        {getRoleLabel(rName)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  style={{ padding: '9px 16px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  style={{ padding: '9px 18px', borderRadius: 6, border: 'none', background: '#0284c7', color: '#fff', fontWeight: 600, cursor: 'pointer' }}
                >
                  Tạo Tài khoản
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15,23,42,0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div style={{ background: '#fff', padding: 28, borderRadius: 12, width: '100%', maxWidth: 500 }}>
            <h3 style={{ marginTop: 0 }}>Cập nhật Tài khoản #{editingUser.accountId} ({editingUser.email})</h3>
            <form onSubmit={handleUpdateUser}>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 600 }}>Họ và tên *</label>
                <input
                  required
                  value={editingUser.fullName || ''}
                  onChange={(e) => setEditingUser({ ...editingUser, fullName: e.target.value })}
                  style={{ ...inputStyle, width: '100%' }}
                />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 600 }}>Số điện thoại *</label>
                <input
                  required
                  value={editingUser.phone || ''}
                  onChange={(e) => setEditingUser({ ...editingUser, phone: e.target.value })}
                  style={{ ...inputStyle, width: '100%' }}
                />
              </div>
              {editingUser.role !== 'CUSTOMER' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 600 }}>Phòng ban</label>
                    <select
                      disabled={editingUser.accountId === currentUser?.accountId}
                      value={editingUser.departmentId || ''}
                      onChange={(e) => handleEditDepartmentChange(e.target.value)}
                      style={{ ...inputStyle, width: '100%' }}
                    >
                      {departments.map((d) => (
                        <option key={d.departmentId} value={d.departmentId}>
                          {getDepartmentLabel(d.departmentId || d.departmentName)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 600 }}>Vai trò trong Phòng ban</label>
                    <select
                      disabled={editingUser.accountId === currentUser?.accountId}
                      value={editingUser.role}
                      onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value })}
                      style={{ ...inputStyle, width: '100%' }}
                    >
                      {editModalAllowedRoles.map((rName) => (
                        <option key={rName} value={rName}>
                          {getRoleLabel(rName)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  style={{ padding: '9px 16px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }}
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  style={{ padding: '9px 18px', borderRadius: 6, border: 'none', background: '#0284c7', color: '#fff', fontWeight: 600, cursor: 'pointer' }}
                >
                  Lưu thay đổi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
