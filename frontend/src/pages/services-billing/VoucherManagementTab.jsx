import { useState, useMemo } from 'react';
import { DataTable } from '../../components/common/DataTable';
import { StatusBadge } from '../../components/common/StatusBadge';
import { formatVND } from '../../lib/money';
import { formatDate, formatDateTime } from '../../lib/datetime';
import { billingApi } from '../../services/billingApi';
import { notifyToast } from '../../lib/http';
import { ROLES } from '../../config/constants';

const EMPTY_VOUCHER_FORM = {
  code: '',
  discountType: 'PERCENTAGE',
  discountValue: '',
  maxDiscountAmount: '0',
  minSpend: '0',
  validFrom: '',
  validTo: '',
  usageLimit: 100,
  status: 'ACTIVE',
};

export const VoucherManagementTab = ({ role, vouchers, onRefresh, busy, setBusy }) => {
  const canManage = [ROLES.SALES_MANAGER, ROLES.ADMIN].includes(role);

  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Modal create/edit
  const [showModal, setShowModal] = useState(false);
  const [editingVoucherId, setEditingVoucherId] = useState(null);
  const [voucherForm, setVoucherForm] = useState(EMPTY_VOUCHER_FORM);
  const [formErrors, setFormErrors] = useState({});

  // Format Instant to datetime-local input string YYYY-MM-DDTHH:mm
  const toInputDateTime = (instantStr) => {
    if (!instantStr) return '';
    try {
      const d = new Date(instantStr);
      if (isNaN(d.getTime())) return '';
      const pad = (n) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    } catch {
      return '';
    }
  };

  const filteredVouchers = useMemo(() => {
    return vouchers.filter((v) => {
      if (keyword.trim()) {
        const kw = keyword.trim().toLowerCase();
        const code = (v.code || '').toLowerCase();
        if (!code.includes(kw)) return false;
      }
      if (statusFilter !== 'ALL' && v.status !== statusFilter) return false;
      if (typeFilter !== 'ALL' && v.discountType !== typeFilter) return false;
      return true;
    });
  }, [vouchers, keyword, statusFilter, typeFilter]);

  const totalPages = Math.ceil(filteredVouchers.length / pageSize) || 1;
  const paginatedVouchers = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredVouchers.slice(start, start + pageSize);
  }, [filteredVouchers, page, pageSize]);

  const handleOpenCreate = () => {
    setEditingVoucherId(null);
    const now = new Date();
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    setVoucherForm({
      ...EMPTY_VOUCHER_FORM,
      validFrom: toInputDateTime(now.toISOString()),
      validTo: toInputDateTime(nextMonth.toISOString()),
    });
    setFormErrors({});
    setShowModal(true);
  };

  const handleOpenEdit = (v) => {
    setEditingVoucherId(v.voucherId);
    setVoucherForm({
      code: v.code || '',
      discountType: v.discountType || 'PERCENTAGE',
      discountValue: v.discountValue != null ? String(v.discountValue) : '',
      maxDiscountAmount: v.maxDiscountAmount != null ? String(v.maxDiscountAmount) : '0',
      minSpend: v.minSpend != null ? String(v.minSpend) : '0',
      validFrom: toInputDateTime(v.validFrom),
      validTo: toInputDateTime(v.validTo),
      usageLimit: v.usageLimit != null ? v.usageLimit : 100,
      status: v.status || 'ACTIVE',
    });
    setFormErrors({});
    setShowModal(true);
  };

  const handleToggleStatus = async (v) => {
    const nextStatus = v.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      setBusy(true);
      await billingApi.toggleVoucherStatus(v.voucherId, nextStatus);
      notifyToast({
        type: 'SUCCESS',
        message: nextStatus === 'ACTIVE' ? `Đã kích hoạt mã "${v.code}".` : `Đã tạm ngưng mã "${v.code}".`,
      });
      if (onRefresh) await onRefresh();
    } catch {
      // Handled by HTTP interceptor
    } finally {
      setBusy(false);
    }
  };

  const handleSubmitForm = async (e) => {
    e.preventDefault();
    const errors = {};

    if (!voucherForm.code.trim()) {
      errors.code = 'Mã voucher không được để trống.';
    }
    const val = Number(voucherForm.discountValue);
    if (isNaN(val) || val <= 0) {
      errors.discountValue = 'Giá trị giảm phải lớn hơn 0.';
    } else if (voucherForm.discountType === 'PERCENTAGE' && val > 100) {
      errors.discountValue = 'Giảm theo phần trăm tối đa là 100%.';
    }

    if (!voucherForm.validFrom) {
      errors.validFrom = 'Vui lòng chọn thời gian bắt đầu.';
    }
    if (!voucherForm.validTo) {
      errors.validTo = 'Vui lòng chọn thời gian kết thúc.';
    }
    if (voucherForm.validFrom && voucherForm.validTo) {
      const from = new Date(voucherForm.validFrom);
      const to = new Date(voucherForm.validTo);
      if (to <= from) {
        errors.validTo = 'Thời gian kết thúc phải sau thời gian bắt đầu.';
      }
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    try {
      setBusy(true);
      const payload = {
        code: voucherForm.code.trim().toUpperCase(),
        discountType: voucherForm.discountType,
        discountValue: Number(voucherForm.discountValue),
        maxDiscountAmount: Number(voucherForm.maxDiscountAmount || 0),
        minSpend: Number(voucherForm.minSpend || 0),
        validFrom: new Date(voucherForm.validFrom).toISOString(),
        validTo: new Date(voucherForm.validTo).toISOString(),
        usageLimit: Number(voucherForm.usageLimit || 1),
        status: voucherForm.status,
      };

      if (editingVoucherId) {
        await billingApi.updateVoucher(editingVoucherId, payload);
        notifyToast({ type: 'SUCCESS', message: `Cập nhật mã "${payload.code}" thành công!` });
      } else {
        await billingApi.createVoucher(payload);
        notifyToast({ type: 'SUCCESS', message: `Tạo mới mã khuyến mãi "${payload.code}" thành công!` });
      }

      setShowModal(false);
      if (onRefresh) await onRefresh();
    } catch {
      // Handled by HTTP interceptor
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      {/* Thanh công cụ & Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
          marginBottom: 16,
        }}
      >
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: '#0f172a' }}>
            Quản Lý Mã Khuyến Mãi (Vouchers)
          </h2>
          <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>
            {canManage
              ? 'Phân quyền Trưởng phòng KD (Sales Manager) & Admin: Tạo mới, cập nhật tỷ lệ chiết khấu, hạn mức và thời gian áp dụng.'
              : 'Dành cho Lễ tân và Kế toán tra cứu mã khuyến mãi đang hoạt động để tư vấn cho khách hàng tại quầy.'}
          </div>
        </div>

        {canManage && (
          <button
            type="button"
            onClick={handleOpenCreate}
            disabled={busy}
            style={{
              background: '#0284c7',
              color: '#fff',
              border: 'none',
              padding: '9px 18px',
              borderRadius: 8,
              fontWeight: 600,
              fontSize: 13,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              boxShadow: '0 1px 2px rgba(2, 132, 199, 0.2)',
            }}
          >
            <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> Tạo Mã Voucher Mới
          </button>
        )}
      </div>

      {/* Thanh Bộ Lọc & Tìm Kiếm */}
      <div
        style={{
          display: 'flex',
          gap: 10,
          flexWrap: 'wrap',
          alignItems: 'center',
          marginBottom: 14,
          background: '#fff',
          padding: 12,
          borderRadius: 8,
          border: '1px solid #e2e8f0',
        }}
      >
        <div style={{ flex: '1 1 240px', minWidth: 200 }}>
          <input
            type="text"
            placeholder="Tìm theo mã voucher (VD: SUMMER2026, VIP10)..."
            value={keyword}
            onChange={(e) => {
              setKeyword(e.target.value);
              setPage(1);
            }}
            style={{
              width: '100%',
              padding: '7px 12px',
              borderRadius: 6,
              border: '1px solid #cbd5e1',
              fontSize: 13,
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 13, color: '#64748b' }}>Loại ưu đãi:</span>
          <select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              setPage(1);
            }}
            style={{
              padding: '7px 10px',
              borderRadius: 6,
              border: '1px solid #cbd5e1',
              fontSize: 13,
              background: '#fff',
            }}
          >
            <option value="ALL">Tất cả hình thức</option>
            <option value="PERCENTAGE">Giảm theo %</option>
            <option value="FIXED_AMOUNT">Giảm số tiền cố định</option>
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 13, color: '#64748b' }}>Trạng thái:</span>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            style={{
              padding: '7px 10px',
              borderRadius: 6,
              border: '1px solid #cbd5e1',
              fontSize: 13,
              background: '#fff',
            }}
          >
            <option value="ALL">Tất cả trạng thái</option>
            <option value="ACTIVE">Đang hoạt động (ACTIVE)</option>
            <option value="INACTIVE">Tạm ngưng (INACTIVE)</option>
          </select>
        </div>
      </div>

      {/* Bảng Dữ Liệu Vouchers */}
      <DataTable
        keyField="voucherId"
        data={paginatedVouchers}
        emptyMessage="Không tìm thấy mã khuyến mãi nào phù hợp với bộ lọc."
        columns={[
          {
            header: 'Mã Voucher',
            minWidth: 150,
            render: (v) => (
              <div>
                <code
                  style={{
                    background: '#f1f5f9',
                    border: '1px solid #cbd5e1',
                    padding: '3px 8px',
                    borderRadius: 5,
                    fontWeight: 700,
                    color: '#0f172a',
                    fontSize: 13,
                  }}
                >
                  {v.code}
                </code>
              </div>
            ),
          },
          {
            header: 'Hình Thức Giảm',
            minWidth: 160,
            render: (v) => (
              <span style={{ fontSize: 13, color: '#334155' }}>
                {v.discountType === 'PERCENTAGE' ? 'Giảm theo phần trăm (%)' : 'Giảm số tiền cố định'}
              </span>
            ),
          },
          {
            header: 'Mức Giảm',
            minWidth: 130,
            render: (v) => (
              <strong style={{ color: '#0284c7', fontSize: 14 }}>
                {v.discountType === 'PERCENTAGE' ? `${v.discountValue}%` : formatVND(v.discountValue)}
              </strong>
            ),
          },
          {
            header: 'Giảm Tối Đa',
            minWidth: 130,
            render: (v) => (
              <span style={{ fontSize: 13, color: '#475569' }}>
                {v.discountType === 'PERCENTAGE'
                  ? v.maxDiscountAmount > 0
                    ? formatVND(v.maxDiscountAmount)
                    : 'Không giới hạn'
                  : '-'}
              </span>
            ),
          },
          {
            header: 'Đơn Tối Thiểu',
            minWidth: 130,
            render: (v) => (
              <span style={{ fontSize: 13, color: '#475569' }}>
                {v.minSpend > 0 ? formatVND(v.minSpend) : '0 VND (Mọi đơn)'}
              </span>
            ),
          },
          {
            header: 'Thời Gian Áp Dụng',
            minWidth: 200,
            render: (v) => (
              <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.4 }}>
                <div>Từ: {formatDate(v.validFrom)}</div>
                <div>Đến: {formatDate(v.validTo)}</div>
              </div>
            ),
          },
          {
            header: 'Lượt Dùng',
            minWidth: 140,
            render: (v) => {
              const pct = v.usageLimit > 0 ? Math.min(100, Math.round((v.usedCount / v.usageLimit) * 100)) : 0;
              const isFull = v.usedCount >= v.usageLimit;
              return (
                <div style={{ fontSize: 12, color: '#334155' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                    <strong>{v.usedCount}</strong>
                    <span style={{ color: isFull ? '#ef4444' : '#64748b' }}>/ {v.usageLimit}</span>
                  </div>
                  <div style={{ background: '#e2e8f0', height: 5, borderRadius: 3, overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${pct}%`,
                        height: '100%',
                        background: isFull ? '#ef4444' : '#0284c7',
                      }}
                    />
                  </div>
                </div>
              );
            },
          },
          {
            header: 'Trạng Thái',
            minWidth: 120,
            render: (v) => <StatusBadge status={v.status} />,
          },
          ...(canManage
            ? [
                {
                  header: 'Thao Tác',
                  minWidth: 150,
                  whiteSpace: 'nowrap',
                  render: (v) => (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(v)}
                        disabled={busy}
                        style={{
                          background: '#f1f5f9',
                          border: '1px solid #cbd5e1',
                          color: '#0f172a',
                          padding: '4px 10px',
                          borderRadius: 5,
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        Sửa
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(v)}
                        disabled={busy}
                        style={{
                          background: v.status === 'ACTIVE' ? '#fff1f2' : '#f0fdf4',
                          border: v.status === 'ACTIVE' ? '1px solid #fecdd3' : '1px solid #bbf7d0',
                          color: v.status === 'ACTIVE' ? '#be123c' : '#15803d',
                          padding: '4px 10px',
                          borderRadius: 5,
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        {v.status === 'ACTIVE' ? 'Tạm ngưng' : 'Kích hoạt'}
                      </button>
                    </div>
                  ),
                },
              ]
            : []),
        ]}
      />

      {/* Phân trang */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: 14,
          flexWrap: 'wrap',
          gap: 10,
        }}
      >
        <div style={{ fontSize: 13, color: '#64748b' }}>
          Hiển thị{' '}
          <strong>
            {filteredVouchers.length > 0 ? (page - 1) * pageSize + 1 : 0} -{' '}
            {Math.min(page * pageSize, filteredVouchers.length)}
          </strong>{' '}
          trong tổng số <strong>{filteredVouchers.length}</strong> mã khuyến mãi
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
            style={{
              padding: '5px 8px',
              borderRadius: 6,
              border: '1px solid #cbd5e1',
              fontSize: 12,
              background: '#fff',
            }}
          >
            <option value={5}>5 / trang</option>
            <option value={10}>10 / trang</option>
            <option value={20}>20 / trang</option>
          </select>

          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            style={{
              padding: '5px 12px',
              borderRadius: 6,
              border: '1px solid #cbd5e1',
              background: page <= 1 ? '#f8fafc' : '#fff',
              color: page <= 1 ? '#94a3b8' : '#0f172a',
              cursor: page <= 1 ? 'not-allowed' : 'pointer',
              fontSize: 12,
              fontWeight: 500,
            }}
          >
            « Trước
          </button>
          <span style={{ fontSize: 13, color: '#334155', fontWeight: 600 }}>
            {page} / {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            style={{
              padding: '5px 12px',
              borderRadius: 6,
              border: '1px solid #cbd5e1',
              background: page >= totalPages ? '#f8fafc' : '#fff',
              color: page >= totalPages ? '#94a3b8' : '#0f172a',
              cursor: page >= totalPages ? 'not-allowed' : 'pointer',
              fontSize: 12,
              fontWeight: 500,
            }}
          >
            Sau »
          </button>
        </div>
      </div>

      {/* ======================= MODAL: TẠO / SỬA VOUCHER ======================= */}
      {showModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15,23,42,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 16,
          }}
          onClick={() => setShowModal(false)}
        >
          <div
            style={{
              background: '#fff',
              padding: 24,
              borderRadius: 12,
              width: '100%',
              maxWidth: 560,
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, color: '#0f172a', fontSize: 17, fontWeight: 700 }}>
                {editingVoucherId ? 'Cập Nhật Mã Khuyến Mãi' : 'Tạo Mã Khuyến Mãi Mới'}
              </h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: 20,
                  cursor: 'pointer',
                  color: '#94a3b8',
                }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitForm}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                    Mã Voucher <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="VD: SUMMER2026, VIP10..."
                    value={voucherForm.code}
                    onChange={(e) =>
                      setVoucherForm({ ...voucherForm, code: e.target.value.toUpperCase().replace(/\s+/g, '') })
                    }
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: 6,
                      border: formErrors.code ? '1px solid #ef4444' : '1px solid #cbd5e1',
                      fontSize: 13,
                      boxSizing: 'border-box',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                    }}
                  />
                  {formErrors.code && (
                    <div style={{ fontSize: 11, color: '#ef4444', marginTop: 2 }}>{formErrors.code}</div>
                  )}
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                    Hình Thức Giảm Giá <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <select
                    value={voucherForm.discountType}
                    onChange={(e) => setVoucherForm({ ...voucherForm, discountType: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: 6,
                      border: '1px solid #cbd5e1',
                      fontSize: 13,
                      boxSizing: 'border-box',
                      background: '#fff',
                    }}
                  >
                    <option value="PERCENTAGE">Giảm theo phần trăm (%)</option>
                    <option value="FIXED_AMOUNT">Giảm số tiền cố định (VND)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                    Giá Trị Giảm {voucherForm.discountType === 'PERCENTAGE' ? '(%)' : '(VND)'}{' '}
                    <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={voucherForm.discountType === 'PERCENTAGE' ? '100' : undefined}
                    required
                    placeholder={voucherForm.discountType === 'PERCENTAGE' ? '10' : '200000'}
                    value={voucherForm.discountValue}
                    onChange={(e) => setVoucherForm({ ...voucherForm, discountValue: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: 6,
                      border: formErrors.discountValue ? '1px solid #ef4444' : '1px solid #cbd5e1',
                      fontSize: 13,
                      boxSizing: 'border-box',
                    }}
                  />
                  {formErrors.discountValue && (
                    <div style={{ fontSize: 11, color: '#ef4444', marginTop: 2 }}>{formErrors.discountValue}</div>
                  )}
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                    Giảm Tối Đa (VND)
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0 nếu không giới hạn"
                    disabled={voucherForm.discountType === 'FIXED_AMOUNT'}
                    value={voucherForm.maxDiscountAmount}
                    onChange={(e) => setVoucherForm({ ...voucherForm, maxDiscountAmount: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: 6,
                      border: '1px solid #cbd5e1',
                      fontSize: 13,
                      boxSizing: 'border-box',
                      background: voucherForm.discountType === 'FIXED_AMOUNT' ? '#f1f5f9' : '#fff',
                    }}
                  />
                  <span style={{ fontSize: 11, color: '#64748b' }}>Áp dụng chặn trần cho chiết khấu %</span>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                    Đơn Tối Thiểu (VND)
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0 nếu áp dụng mọi đơn"
                    value={voucherForm.minSpend}
                    onChange={(e) => setVoucherForm({ ...voucherForm, minSpend: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: 6,
                      border: '1px solid #cbd5e1',
                      fontSize: 13,
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                    Giới Hạn Lượt Dùng Toàn Hệ Thống <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={voucherForm.usageLimit}
                    onChange={(e) => setVoucherForm({ ...voucherForm, usageLimit: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: 6,
                      border: '1px solid #cbd5e1',
                      fontSize: 13,
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                    Bắt Đầu Hiệu Lực <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={voucherForm.validFrom}
                    onChange={(e) => setVoucherForm({ ...voucherForm, validFrom: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: 6,
                      border: formErrors.validFrom ? '1px solid #ef4444' : '1px solid #cbd5e1',
                      fontSize: 13,
                      boxSizing: 'border-box',
                    }}
                  />
                  {formErrors.validFrom && (
                    <div style={{ fontSize: 11, color: '#ef4444', marginTop: 2 }}>{formErrors.validFrom}</div>
                  )}
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                    Hết Hạn Hiệu Lực <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={voucherForm.validTo}
                    onChange={(e) => setVoucherForm({ ...voucherForm, validTo: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: 6,
                      border: formErrors.validTo ? '1px solid #ef4444' : '1px solid #cbd5e1',
                      fontSize: 13,
                      boxSizing: 'border-box',
                    }}
                  />
                  {formErrors.validTo && (
                    <div style={{ fontSize: 11, color: '#ef4444', marginTop: 2 }}>{formErrors.validTo}</div>
                  )}
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                  Trạng Thái Kích Hoạt
                </label>
                <select
                  value={voucherForm.status}
                  onChange={(e) => setVoucherForm({ ...voucherForm, status: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: 6,
                    border: '1px solid #cbd5e1',
                    fontSize: 13,
                    background: '#fff',
                  }}
                >
                  <option value="ACTIVE">Kích hoạt ngay (ACTIVE)</option>
                  <option value="INACTIVE">Tạm ngưng (INACTIVE)</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  disabled={busy}
                  style={{
                    background: '#f1f5f9',
                    color: '#475569',
                    border: 'none',
                    padding: '8px 16px',
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: 13,
                  }}
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  style={{
                    background: '#0284c7',
                    color: '#fff',
                    border: 'none',
                    padding: '8px 20px',
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: 13,
                  }}
                >
                  {busy ? 'Đang lưu...' : editingVoucherId ? 'Cập Nhật Voucher' : 'Tạo Voucher'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

