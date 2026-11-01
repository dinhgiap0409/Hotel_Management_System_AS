import { useEffect, useState } from 'react';
import { authApi } from '../../services/authApi';
import { useAuth } from '../../context/AuthContext';
import { DataTable } from '../../components/common/DataTable';
import { StatusBadge } from '../../components/common/StatusBadge';
import { formatDateTime } from '../../lib/datetime';

export const AuditLogPage = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const [activeTab, setActiveTab] = useState('audit');
  const [logs, setLogs] = useState([]);
  const [errorLogs, setErrorLogs] = useState([]);
  const [config, setConfig] = useState({
    auditEnabled: true,
    logSecurityEvents: true,
    logOperationalEvents: true,
    retentionDays: 365,
    updatedAt: null,
    updatedBy: 'SYSTEM',
  });

  const [keyword, setKeyword] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [feedback, setFeedback] = useState(null);

  const loadAuditLogs = () => {
    authApi
      .getAuditLogs({
        keyword: keyword || undefined,
        action: actionFilter || undefined,
      })
      .then((res) => {
        const list = Array.isArray(res.data) ? res.data : res.data?.content || res.data?.data || [];
        setLogs(list);
      })
      .catch(() => {});
  };

  const loadAuditConfig = () => {
    authApi
      .getAuditConfig()
      .then((res) => setConfig(res.data))
      .catch(() => {});
  };

  const loadErrorLogs = () => {
    authApi
      .getErrorLogs()
      .then((res) => setErrorLogs(res.data || []))
      .catch(() => {});
  };

  useEffect(() => {
    loadAuditLogs();
    loadAuditConfig();
    loadErrorLogs();
  }, [actionFilter]);

  const handleSearch = (e) => {
    e.preventDefault();
    loadAuditLogs();
  };

  const handleSaveConfig = async (e) => {
    e.preventDefault();
    setFeedback(null);
    const res = await authApi.updateAuditConfig(config);
    setConfig(res.data);
    setFeedback('Đã lưu cấu hình tham số kiểm toán thành công!');
    loadAuditLogs();
  };

  const handleResolveError = async (id) => {
    await authApi.updateErrorLogStatus(id, 'RESOLVED');
    loadErrorLogs();
  };

  const tabButtonStyle = (tabKey) => ({
    padding: '10px 18px',
    borderRadius: 8,
    border: 'none',
    fontWeight: 600,
    fontSize: 13,
    cursor: 'pointer',
    background: activeTab === tabKey ? '#0284c7' : '#e2e8f0',
    color: activeTab === tabKey ? '#fff' : '#334155',
  });

  return (
    <div>
      <h2 style={{ marginTop: 0, color: '#0f172a' }}>Nhật ký Kiểm toán, Cấu hình Audit & Lỗi Hệ thống</h2>
      <p style={{ color: '#64748b', fontSize: 13, marginBottom: 18 }}>
        Theo dõi lịch sử thao tác bảo mật, vận hành và kiểm soát lỗi hệ thống.
      </p>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <button style={tabButtonStyle('audit')} onClick={() => setActiveTab('audit')}>
          1. Nhật ký Kiểm toán
        </button>
        <button style={tabButtonStyle('config')} onClick={() => setActiveTab('config')}>
          2. Cấu hình Tham số Audit
        </button>
        <button style={tabButtonStyle('errors')} onClick={() => setActiveTab('errors')}>
          3. Nhật ký Lỗi Hệ thống
        </button>
      </div>

      {feedback && (
        <div style={{ padding: 12, background: '#dcfce7', color: '#166534', borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
          {feedback}
        </div>
      )}

      {/* TAB 1: AUDIT LOGS */}
      {activeTab === 'audit' && (
        <div>
          <form
            onSubmit={handleSearch}
            style={{
              display: 'flex',
              gap: 10,
              background: '#fff',
              padding: 14,
              borderRadius: 10,
              border: '1px solid #e2e8f0',
              marginBottom: 16,
              alignItems: 'center',
            }}
          >
            <input
              placeholder="Tìm theo email người thực hiện, lý do, giá trị thay đổi, traceId..."
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              style={{ flex: 1, padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}
            />
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}
            >
              <option value="">-- Tất cả Hành động --</option>
              <option value="LOGIN_SUCCESS">LOGIN_SUCCESS</option>
              <option value="LOGIN_LOCKED">LOGIN_LOCKED</option>
              <option value="LOGOUT">LOGOUT</option>
              <option value="REGISTER_ACCOUNT">REGISTER_ACCOUNT</option>
              <option value="CREATE_USER">CREATE_USER</option>
              <option value="UPDATE_USER">UPDATE_USER</option>
              <option value="USER_STATUS_CHANGE">USER_STATUS_CHANGE</option>
              <option value="ROLE_CHANGE">ROLE_CHANGE</option>
              <option value="CHANGE_PASSWORD">CHANGE_PASSWORD</option>
              <option value="UPDATE_PROFILE">UPDATE_PROFILE</option>
              <option value="UPDATE_AUDIT_CONFIG">UPDATE_AUDIT_CONFIG</option>
            </select>
            <button
              type="submit"
              style={{ background: '#0f172a', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}
            >
              Lọc Nhật ký
            </button>
          </form>

          <DataTable
            keyField="auditLogId"
            data={logs}
            emptyMessage="Chưa có bản ghi Audit Log nào."
            columns={[
              { header: 'ID', render: (l) => `#${l.auditLogId}` },
              { header: 'Thời gian', render: (l) => formatDateTime(l.performedAt) },
              {
                header: 'Người thực hiện',
                render: (l) => (
                  <div>
                    <div style={{ fontWeight: 600 }}>{l.actorEmail}</div>
                    <StatusBadge status={l.actorType} />
                  </div>
                ),
              },
              { header: 'Hành động', render: (l) => <code>{l.action}</code> },
              { header: 'Đối tượng', render: (l) => `${l.entityName} #${l.recordId}` },
              {
                header: 'Chi tiết Thay đổi',
                render: (l) => (
                  <div style={{ fontSize: 12, maxWidth: 320 }}>
                    {l.oldValues && <div style={{ color: '#dc2626' }}>Cũ: {l.oldValues}</div>}
                    {l.newValues && <div style={{ color: '#16a34a' }}>Mới: {l.newValues}</div>}
                    {l.reason && (
                      <div style={{ color: '#64748b' }}>
                        Lý do: {String(l.reason).replace(/\s*\((UC|BR)-\d+\)/gi, '')}
                      </div>
                    )}
                  </div>
                ),
              },
            ]}
          />
        </div>
      )}

      {/* TAB 2: CONFIGURE AUDIT PARAMETERS */}
      {activeTab === 'config' && (
        <div style={{ background: '#fff', padding: 24, borderRadius: 12, border: '1px solid #e2e8f0', maxWidth: 560 }}>
          <h3 style={{ marginTop: 0 }}>Cấu hình Tham số Kiểm toán Hệ thống</h3>
          <form onSubmit={handleSaveConfig}>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, fontWeight: 600 }}>
                <input
                  type="checkbox"
                  disabled={!isAdmin}
                  checked={config.auditEnabled}
                  onChange={(e) => setConfig({ ...config, auditEnabled: e.target.checked })}
                />
                Kích hoạt ghi nhận Nhật ký Kiểm toán toàn hệ thống
              </label>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14 }}>
                <input
                  type="checkbox"
                  disabled={!isAdmin || !config.auditEnabled}
                  checked={config.logSecurityEvents}
                  onChange={(e) => setConfig({ ...config, logSecurityEvents: e.target.checked })}
                />
                Ghi nhận sự kiện Bảo mật & Phân quyền (Đăng nhập, Khóa TK, Đổi Role, Đổi mật khẩu)
              </label>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14 }}>
                <input
                  type="checkbox"
                  disabled={!isAdmin || !config.auditEnabled}
                  checked={config.logOperationalEvents}
                  onChange={(e) => setConfig({ ...config, logOperationalEvents: e.target.checked })}
                />
                Ghi nhận sự kiện Vận hành Nghiệp vụ (Đặt phòng, Check-in/out, Hóa đơn, Giá phòng)
              </label>
            </div>

            <div style={{ marginBottom: 18 }}>
              <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600 }}>
                Thời hạn lưu trữ tối thiểu (số ngày, tối thiểu 30 ngày):
              </label>
              <input
                type="number"
                min={30}
                max={3650}
                disabled={!isAdmin}
                value={config.retentionDays}
                onChange={(e) => setConfig({ ...config, retentionDays: Number(e.target.value) })}
                style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1', width: 140 }}
              />
            </div>

            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 16 }}>
              Cập nhật lần cuối bởi: <strong>{config.updatedBy}</strong> ({formatDateTime(config.updatedAt)})
            </div>

            {isAdmin ? (
              <button
                type="submit"
                style={{ background: '#0284c7', color: '#fff', border: 'none', padding: '10px 18px', borderRadius: 6, fontWeight: 600, cursor: 'pointer' }}
              >
                Lưu Cấu hình Audit
              </button>
            ) : (
              <div style={{ color: '#64748b', fontSize: 13 }}>Chỉ vai trò ADMIN mới được thay đổi tham số cấu hình Audit.</div>
            )}
          </form>
        </div>
      )}

      {/* TAB 3: SYSTEM ERROR LOGS */}
      {activeTab === 'errors' && (
        <DataTable
          keyField="id"
          data={errorLogs}
          emptyMessage="Hệ thống vận hành ổn định — không có lỗi hệ thống nào được ghi nhận."
          columns={[
            { header: 'ID', render: (e) => `#${e.id}` },
            { header: 'Trace ID', render: (e) => <code>{e.traceId}</code> },
            { header: 'Thời gian', render: (e) => formatDateTime(e.occurredAt) },
            { header: 'Endpoint', render: (e) => `${e.httpMethod || ''} ${e.endpoint || ''}` },
            { header: 'Mã lỗi / Nội dung', render: (e) => `${e.errorCode}: ${e.message}` },
            { header: 'Trạng thái', render: (e) => <StatusBadge status={e.status} /> },
            {
              header: 'Xử lý',
              render: (e) =>
                isAdmin && e.status !== 'RESOLVED' ? (
                  <button
                    onClick={() => handleResolveError(e.id)}
                    style={{ background: '#16a34a', color: '#fff', border: 'none', padding: '5px 10px', borderRadius: 5, fontSize: 12, cursor: 'pointer' }}
                  >
                    Đánh dấu Đã xử lý
                  </button>
                ) : (
                  '-'
                ),
            },
          ]}
        />
      )}
    </div>
  );
};
