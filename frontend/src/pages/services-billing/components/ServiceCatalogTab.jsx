import { DataTable } from '../../../components/common/DataTable';
import { StatusBadge } from '../../../components/common/StatusBadge';
import { formatVND } from '../../../lib/money';
import { inputStyle } from './serviceUtils';
import { PaginationControl } from './PaginationControl';

export const ServiceCatalogTab = ({
  serviceCategoryFilter,
  setServiceCategoryFilter,
  setServicePage,
  filteredServices,
  canManageCatalog,
  handleOpenCreateService,
  paginatedServices,
  busy,
  handleOpenEditService,
  toggleStatus,
  servicePage,
  totalServicePages,
  servicePageSize,
  setServicePageSize,
}) => {
  return (
    <div>
      {/* Bộ lọc loại dịch vụ */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <span style={{ fontSize: 13, color: '#64748b', fontWeight: 500 }}>Lọc theo nhóm:</span>
          <select
            value={serviceCategoryFilter}
            onChange={(e) => {
              setServiceCategoryFilter(e.target.value);
              setServicePage(1);
            }}
            style={{ ...inputStyle, width: 180 }}
          >
            <option value="">Tất cả các nhóm</option>
            <option value="F&B">F&B (Ẩm thực &amp; Bar)</option>
            <option value="SPA">SPA &amp; Massage</option>
            <option value="LAUNDRY">LAUNDRY (Giặt là)</option>
            <option value="TRANSPORT">TRANSPORT (Đưa đón)</option>
            <option value="MINIBAR">MINIBAR (Đồ uống phòng)</option>
          </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 13, color: '#64748b' }}>
            Hiển thị <strong>{filteredServices.length}</strong> dịch vụ
          </div>
          {canManageCatalog && (
            <button
              type="button"
              onClick={handleOpenCreateService}
              style={{
                background: '#0284c7',
                color: '#fff',
                border: 'none',
                padding: '7px 14px',
                borderRadius: 6,
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: 13,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                boxShadow: '0 1px 2px rgba(2, 132, 199, 0.2)',
              }}
            >
              <span>+</span> Thêm Dịch Vụ Mới
            </button>
          )}
        </div>
      </div>

      <DataTable
        keyField="serviceId"
        data={paginatedServices}
        emptyMessage="Không tìm thấy dịch vụ nào phù hợp."
        columns={[
          {
            header: 'Mã DV',
            width: 90,
            minWidth: 80,
            nowrap: true,
            render: (s) => <code style={{ color: '#0284c7', fontWeight: 600 }}>#{s.serviceId}</code>,
          },
          {
            header: 'Tên Dịch Vụ',
            minWidth: 200,
            render: (s) => (
              <div>
                <strong style={{ color: '#0f172a' }}>{s.serviceName}</strong>
                {s.description && (
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{s.description}</div>
                )}
              </div>
            ),
          },
          {
            header: 'Nhóm Dịch Vụ',
            minWidth: 140,
            nowrap: true,
            render: (s) => (
              <span
                style={{
                  background: '#f1f5f9',
                  padding: '3px 8px',
                  borderRadius: 4,
                  fontSize: 12,
                  fontWeight: 600,
                  color: '#475569',
                  whiteSpace: 'nowrap',
                }}
              >
                {s.category}
              </span>
            ),
          },
          {
            header: 'Đơn Giá / ĐVT',
            minWidth: 140,
            nowrap: true,
            render: (s) => (
              <div>
                <strong style={{ color: '#0f172a' }}>{formatVND(s.unitPrice)}</strong>
                <span style={{ color: '#64748b', fontSize: 12, whiteSpace: 'nowrap' }}> / {s.billingUnit}</span>
              </div>
            ),
          },
          {
            header: 'Trạng Thái',
            minWidth: 120,
            nowrap: true,
            render: (s) => <StatusBadge status={s.status} />,
          },
          ...(canManageCatalog
            ? [
                {
                  header: 'Thao Tác',
                  minWidth: 180,
                  nowrap: true,
                  render: (s) => (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'nowrap', whiteSpace: 'nowrap' }}>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleOpenEditService(s)}
                        style={{
                          background: '#f8fafc',
                          color: '#0284c7',
                          border: '1px solid #cbd5e1',
                          borderRadius: 6,
                          padding: '5px 10px',
                          cursor: 'pointer',
                          fontSize: 12.5,
                          fontWeight: 600,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        Chỉnh sửa
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => toggleStatus(s)}
                        style={{
                          background: s.status === 'ACTIVE' ? '#fee2e2' : '#dcfce7',
                          color: s.status === 'ACTIVE' ? '#dc2626' : '#166534',
                          border: 'none',
                          borderRadius: 6,
                          padding: '5px 10px',
                          cursor: 'pointer',
                          fontSize: 12.5,
                          fontWeight: 600,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {s.status === 'ACTIVE' ? 'Ngừng bán' : 'Mở bán lại'}
                      </button>
                    </div>
                  ),
                },
              ]
            : []),
        ]}
      />
      <PaginationControl
        currentPage={servicePage}
        totalPages={totalServicePages}
        totalItems={filteredServices.length}
        pageSize={servicePageSize}
        onPageChange={setServicePage}
        onPageSizeChange={setServicePageSize}
      />
    </div>
  );
};

