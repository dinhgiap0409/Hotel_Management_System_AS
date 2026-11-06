import { useState, useMemo, useEffect } from 'react';
import { DataTable } from '../../components/common/DataTable';
import { StatusBadge } from '../../components/common/StatusBadge';
import { formatVND } from '../../lib/money';
import { formatDate, formatDateTime } from '../../lib/datetime';
import { billingApi } from '../../services/billingApi';
import { notifyToast } from '../../lib/http';
import { ROLES } from '../../config/constants';

const CHARGE_TYPE_LABELS = {
  MINIBAR: 'Minibar / Đồ uống tại phòng',
  DAMAGE: 'Đền bù hư hại / Làm vỡ trang thiết bị',
  LATE_CHECKOUT: 'Phụ thu trả phòng muộn (Late check-out)',
  EXTRA_GUEST: 'Phụ thu thêm người lưu trú',
  OTHER: 'Phụ thu phát sinh khác',
};

export const FolioBillingTab = ({ role, activeStays, vouchers = [], onRefresh, busy, setBusy }) => {
  const canSettle = [ROLES.FRONT_DESK, ROLES.ACCOUNTANT, ROLES.GENERAL_MANAGER, ROLES.ADMIN].includes(role);
  const canManageCharges = [ROLES.FRONT_DESK, ROLES.ACCOUNTANT, ROLES.ADMIN].includes(role);

  // Filters
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'OPEN' | 'CLOSED'
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Folio detail modal state
  const [selectedStay, setSelectedStay] = useState(null);
  const [folioDetail, setFolioDetail] = useState(null);
  const [loadingFolio, setLoadingFolio] = useState(false);

  // New additional charge form
  const [showAddChargeForm, setShowAddChargeForm] = useState(false);
  const [chargeForm, setChargeForm] = useState({
    chargeType: 'MINIBAR',
    description: '',
    amount: '',
  });

  // Voucher validation in Folio modal
  const [voucherCodeInput, setVoucherCodeInput] = useState('');
  const [appliedVoucher, setAppliedVoucher] = useState(null); // { code, discountAmount, ... }
  const [voucherError, setVoucherError] = useState(null);
  const [validatingVoucher, setValidatingVoucher] = useState(false);

  // Settlement form state
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [settleNotes, setSettleNotes] = useState('');
  const [confirmSettleModal, setConfirmSettleModal] = useState(false);

  // Printable Invoice modal state
  const [printInvoiceData, setPrintInvoiceData] = useState(null);
  const [loadingInvoice, setLoadingInvoice] = useState(false);

  // Fetch Folio details when selectedStay changes
  const fetchFolioDetail = async (stayId) => {
    try {
      setLoadingFolio(true);
      const res = await billingApi.getFolioDetail(stayId);
      setFolioDetail(res.data);
      // Reset voucher input for new folio
      setVoucherCodeInput('');
      setAppliedVoucher(null);
      setVoucherError(null);
      setShowAddChargeForm(false);
    } catch {
      // Handled by HTTP interceptor
    } finally {
      setLoadingFolio(false);
    }
  };

  const handleOpenFolio = (stay) => {
    setSelectedStay(stay);
    fetchFolioDetail(stay.stayId);
  };

  const handleOpenPrintInvoice = async (stayId, invoiceId = null) => {
    try {
      setLoadingInvoice(true);
      let res;
      if (invoiceId) {
        res = await billingApi.getInvoiceDetail(invoiceId);
      } else {
        res = await billingApi.getInvoiceByStay(stayId);
      }
      setPrintInvoiceData(res.data);
    } catch {
      // Handled by HTTP interceptor
    } finally {
      setLoadingInvoice(false);
    }
  };

  const handleAddCharge = async (e) => {
    e.preventDefault();
    if (!folioDetail) return;
    const amt = Number(chargeForm.amount);
    if (isNaN(amt) || amt < 1000) {
      notifyToast({ type: 'ERROR', message: 'Số tiền phụ thu tối thiểu là 1,000 VND.' });
      return;
    }

    try {
      setBusy(true);
      await billingApi.addAdditionalCharge(folioDetail.folioId, {
        chargeType: chargeForm.chargeType,
        description: chargeForm.description.trim(),
        amount: amt,
      });
      notifyToast({ type: 'SUCCESS', message: 'Đã thêm khoản phụ thu vào hóa đơn phòng thành công.' });
      setChargeForm({ chargeType: 'MINIBAR', description: '', amount: '' });
      setShowAddChargeForm(false);
      await fetchFolioDetail(folioDetail.stayId);
      if (onRefresh) onRefresh();
    } catch {
      // Handled by HTTP interceptor
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteCharge = async (chargeId) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa khoản phụ thu này khỏi hóa đơn phòng?')) return;
    try {
      setBusy(true);
      await billingApi.deleteAdditionalCharge(chargeId);
      notifyToast({ type: 'SUCCESS', message: 'Đã xóa khoản phụ thu thành công.' });
      await fetchFolioDetail(folioDetail.stayId);
      if (onRefresh) onRefresh();
    } catch {
      // Handled by HTTP interceptor
    } finally {
      setBusy(false);
    }
  };

  const handleValidateVoucher = async (codeToValidate = null) => {
    const code = (typeof codeToValidate === 'string' ? codeToValidate : voucherCodeInput).trim().toUpperCase();
    if (!code) {
      setVoucherError('Vui lòng nhập hoặc chọn mã voucher.');
      return;
    }
    try {
      setValidatingVoucher(true);
      setVoucherError(null);
      const subtotalAmt = folioDetail?.subtotal || folioDetail?.roomSubtotal || 0;
      const res = await billingApi.validateVoucher({
        code: code,
        subtotalAmount: subtotalAmt,
      });
      const data = res.data;
      if (data.valid) {
        setAppliedVoucher(data);
        setVoucherCodeInput(data.code);
        notifyToast({
          type: 'SUCCESS',
          message: `Áp dụng mã ${data.code} thành công! Được giảm ${formatVND(data.discountAmount)}.`,
        });
      } else {
        setAppliedVoucher(null);
        const rawMsg = data.message || '';
        let cleanMsg = rawMsg;
        if (!rawMsg || rawMsg.includes('Ã') || rawMsg.includes('áº') || rawMsg.includes('á»') || rawMsg.includes('Ä')) {
          if (rawMsg.toLowerCase().includes('tồn') || rawMsg.toLowerCase().includes('tá»')) {
            cleanMsg = 'Mã khuyến mãi không tồn tại trên hệ thống.';
          } else if (rawMsg.toLowerCase().includes('ngưng') || rawMsg.toLowerCase().includes('ngÆ°ng')) {
            cleanMsg = 'Mã khuyến mãi hiện đang tạm ngưng hoạt động.';
          } else if (rawMsg.toLowerCase().includes('hết hạn') || rawMsg.toLowerCase().includes('háº¿t')) {
            cleanMsg = 'Mã khuyến mãi đã hết hạn sử dụng.';
          } else if (rawMsg.toLowerCase().includes('lượt') || rawMsg.toLowerCase().includes('lÆ°á»£t')) {
            cleanMsg = 'Mã khuyến mãi đã hết lượt sử dụng.';
          } else {
            cleanMsg = 'Mã khuyến mãi không tồn tại trên hệ thống.';
          }
        }
        setVoucherError(cleanMsg);
      }
    } catch (err) {
      setAppliedVoucher(null);
      const rawErr = err.response?.data?.message || '';
      let cleanErr = 'Mã khuyến mãi không tồn tại trên hệ thống.';
      if (rawErr && !rawErr.includes('Ã') && !rawErr.includes('áº') && !rawErr.includes('á»') && !rawErr.includes('Ä')) {
        cleanErr = rawErr;
      }
      setVoucherError(cleanErr);
    } finally {
      setValidatingVoucher(false);
    }
  };

  const handleRemoveVoucher = () => {
    setAppliedVoucher(null);
    setVoucherCodeInput('');
    setVoucherError(null);
  };

  // Tính toán số tiền quyết toán tạm tính
  const calculatedFinances = useMemo(() => {
    if (!folioDetail) {
      return {
        subtotal: 0,
        discount: 0,
        taxable: 0,
        tax: 0,
        depositPaid: 0,
        balancePayable: 0,
      };
    }
    const subtotal = folioDetail.subtotal || 0;
    const discount = appliedVoucher ? appliedVoucher.discountAmount : folioDetail.discountAmount || 0;
    const taxable = Math.max(0, subtotal - discount);
    const tax = Math.round(taxable * 0.08);
    const gross = taxable + tax;
    const depositPaid = folioDetail.depositPaid || 0;
    const balancePayable = Math.max(0, gross - depositPaid);

    return {
      subtotal,
      discount,
      taxable,
      tax,
      gross,
      depositPaid,
      balancePayable,
    };
  }, [folioDetail, appliedVoucher]);

  const handleExecuteSettlement = async () => {
    if (!folioDetail) return;
    try {
      setBusy(true);
      const codeToSend = appliedVoucher ? appliedVoucher.code : (voucherCodeInput.trim() ? voucherCodeInput.trim().toUpperCase() : null);
      const res = await billingApi.settleFolio(folioDetail.stayId, {
        voucherCode: codeToSend,
        paymentMethod: paymentMethod,
        notes: settleNotes.trim() || null,
      });
      notifyToast({
        type: 'SUCCESS',
        message: `Quyết toán hóa đơn phòng ${folioDetail.roomNumber} thành công! Đã đóng Folio.`,
      });
      setConfirmSettleModal(false);
      setSelectedStay(null);
      setFolioDetail(null);
      if (onRefresh) await onRefresh();
      // Mở ngay modal in hóa đơn
      setPrintInvoiceData(res.data);
    } catch {
      // Handled by HTTP interceptor
    } finally {
      setBusy(false);
    }
  };

  const filteredStays = useMemo(() => {
    return (activeStays || []).filter((s) => {
      if (keyword.trim()) {
        const kw = keyword.trim().toLowerCase();
        const room = (s.roomNumber || '').toLowerCase();
        const name = (s.guestName || '').toLowerCase();
        const code = (s.reservationCode || '').toLowerCase();
        if (!room.includes(kw) && !name.includes(kw) && !code.includes(kw)) {
          return false;
        }
      }
      return true;
    });
  }, [activeStays, keyword]);

  const totalPages = Math.ceil(filteredStays.length / pageSize) || 1;
  const paginatedStays = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredStays.slice(start, start + pageSize);
  }, [filteredStays, page, pageSize]);

  return (
    <div>
      {/* Header & Tiêu đề */}
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
            Quyết Toán &amp; Hóa Đơn Phòng (Folio Billing &amp; Settlement)
          </h2>
          <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>
            Tra cứu bảng kê chi phí phòng, thêm phụ thu thực tế, áp mã giảm giá, thu tiền quyết toán và xuất hóa đơn VAT chuẩn khách sạn.
          </div>
        </div>

        <button
          type="button"
          onClick={onRefresh}
          disabled={busy}
          style={{
            background: '#f8fafc',
            border: '1px solid #cbd5e1',
            color: '#334155',
            padding: '8px 14px',
            borderRadius: 8,
            fontWeight: 600,
            fontSize: 13,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <span>↻</span> Làm mới danh sách
        </button>
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
        <div style={{ flex: '1 1 280px', minWidth: 220 }}>
          <input
            type="text"
            placeholder="Tìm theo số phòng, mã đặt phòng (#BK...), tên khách..."
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
      </div>

      {/* Bảng Danh Sách Phòng Đang Lưu Trú */}
      <DataTable
        keyField="stayId"
        data={paginatedStays}
        emptyMessage="Hiện không có phòng nào đang lưu trú."
        columns={[
          {
            header: 'Stay ID',
            width: 80,
            minWidth: 70,
            nowrap: true,
            render: (s) => <span style={{ color: '#64748b', fontWeight: 500 }}>#{s.stayId}</span>,
          },
          {
            header: 'Mã Đặt Phòng',
            minWidth: 140,
            nowrap: true,
            render: (s) => <strong style={{ color: '#0f172a' }}>{s.reservationCode || 'N/A'}</strong>,
          },
          {
            header: 'Phòng',
            width: 90,
            minWidth: 80,
            nowrap: true,
            render: (s) => (
              <span
                style={{
                  fontWeight: 700,
                  background: '#e0e7ff',
                  color: '#3730a3',
                  padding: '4px 10px',
                  borderRadius: 6,
                  fontSize: 14,
                  display: 'inline-block',
                }}
              >
                {s.roomNumber || 'N/A'}
              </span>
            ),
          },
          {
            header: 'Khách hàng',
            minWidth: 180,
            render: (s) => (
              <div>
                <div style={{ fontWeight: 600, color: '#0f172a' }}>{s.guestName}</div>
                {s.phoneNumber && (
                  <div style={{ fontSize: 12, color: '#64748b' }}>SĐT: {s.phoneNumber}</div>
                )}
              </div>
            ),
          },
          {
            header: 'Giờ Check-in',
            minWidth: 140,
            nowrap: true,
            render: (s) => (
              <span style={{ color: '#475569', fontSize: 13, whiteSpace: 'nowrap' }}>
                {s.actualCheckIn
                  ? formatDateTime(s.actualCheckIn)
                  : (s.checkInDate ? formatDate(s.checkInDate) : 'N/A')}
              </span>
            ),
          },
          {
            header: 'Hóa Đơn Folio',
            minWidth: 140,
            nowrap: true,
            render: (s) => (
              <div>
                <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 14 }}>
                  {formatVND(s.totalAmount || 0)}
                </div>
                <div style={{ fontSize: 11, color: '#64748b', whiteSpace: 'nowrap' }}>
                  {s.folioStatus === 'CLOSED' ? 'Đã quyết toán' : 'Chưa quyết toán'}
                </div>
              </div>
            ),
          },
          {
            header: 'Trạng Thái',
            minWidth: 130,
            nowrap: true,
            render: (s) => (
              <span
                style={{
                  background: s.folioStatus === 'CLOSED' ? '#f1f5f9' : '#dcfce7',
                  color: s.folioStatus === 'CLOSED' ? '#475569' : '#15803d',
                  padding: '4px 10px',
                  borderRadius: 14,
                  fontSize: 12,
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  whiteSpace: 'nowrap',
                }}
              >
                {s.folioStatus === 'CLOSED' ? 'Đã quyết toán' : 'Đang hoạt động'}
              </span>
            ),
          },
          {
            header: 'Thao Tác',
            minWidth: 170,
            nowrap: true,
            render: (s) => (
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'nowrap', whiteSpace: 'nowrap' }}>
                <button
                  type="button"
                  onClick={() => handleOpenFolio(s)}
                  disabled={busy}
                  style={{
                    background: s.folioStatus === 'CLOSED' ? '#0284c7' : '#dc2626',
                    color: '#fff',
                    border: 'none',
                    padding: '7px 14px',
                    borderRadius: 6,
                    fontSize: 12.5,
                    fontWeight: 600,
                    cursor: 'pointer',
                    boxShadow: s.folioStatus === 'CLOSED' ? '0 1px 2px rgba(2, 132, 199, 0.2)' : '0 1px 2px rgba(220, 38, 38, 0.2)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    whiteSpace: 'nowrap',
                  }}
                >
                  <span>{s.folioStatus === 'CLOSED' ? '📄' : '💳'}</span>
                  {s.folioStatus === 'CLOSED' ? 'Xem Chi Tiết' : 'Quyết Toán Folio'}
                </button>

                {s.folioStatus === 'CLOSED' && (
                  <button
                    type="button"
                    onClick={() => handleOpenPrintInvoice(s.stayId)}
                    disabled={busy}
                    style={{
                      background: '#fff',
                      border: '1px solid #cbd5e1',
                      color: '#334155',
                      padding: '7px 10px',
                      borderRadius: 6,
                      fontSize: 12.5,
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      whiteSpace: 'nowrap',
                    }}
                    title="In hóa đơn thanh toán"
                  >
                    <span>🖨️</span> In Bill
                  </button>
                )}
              </div>
            ),
          },
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
            {filteredStays.length > 0 ? (page - 1) * pageSize + 1 : 0} -{' '}
            {Math.min(page * pageSize, filteredStays.length)}
          </strong>{' '}
          trong tổng số <strong>{filteredStays.length}</strong> phòng
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

      {/* ======================= MODAL: BẢNG KÊ CHI TIẾT FOLIO & QUYẾT TOÁN ======================= */}
      {selectedStay && (
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
          onClick={() => {
            if (!busy) {
              setSelectedStay(null);
              setFolioDetail(null);
            }
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 12,
              width: '100%',
              maxWidth: 960,
              maxHeight: '92vh',
              overflowY: 'auto',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)',
              display: 'flex',
              flexDirection: 'column',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '18px 24px',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: '#f8fafc',
                borderTopLeftRadius: 12,
                borderTopRightRadius: 12,
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <h3 style={{ margin: 0, color: '#0f172a', fontSize: 18, fontWeight: 700 }}>
                    Bảng Kê Hóa Đơn Phòng P.{folioDetail?.roomNumber || selectedStay.roomNumber}
                  </h3>
                  {folioDetail && (
                    <span
                      style={{
                        padding: '3px 8px',
                        borderRadius: 6,
                        fontSize: 11,
                        fontWeight: 700,
                        background: folioDetail.folioStatus === 'CLOSED' ? '#dcfce7' : '#fef3c7',
                        color: folioDetail.folioStatus === 'CLOSED' ? '#166534' : '#92400e',
                        border: folioDetail.folioStatus === 'CLOSED' ? '1px solid #bbf7d0' : '1px solid #fde68a',
                      }}
                    >
                      {folioDetail.folioStatus === 'CLOSED' ? 'ĐÃ QUYẾT TOÁN (CLOSED)' : 'CHƯA QUYẾT TOÁN (OPEN)'}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: '#475569', marginTop: 4, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <span>
                    Mã booking:{' '}
                    <strong style={{ color: '#0284c7' }}>
                      {folioDetail?.reservationCode || selectedStay.reservationCode}
                    </strong>
                  </span>
                  <span>•</span>
                  <span>
                    Khách hàng: <strong>{folioDetail?.guestName || selectedStay.guestName}</strong>
                    {(folioDetail?.guestPhone || selectedStay.phoneNumber) && ` (${folioDetail?.guestPhone || selectedStay.phoneNumber})`}
                  </span>
                  <span>•</span>
                  <span>
                    Thời gian ở:{' '}
                    <strong style={{ color: '#0f172a' }}>
                      {formatDate(folioDetail?.checkInDate || selectedStay.checkInDate || folioDetail?.actualCheckIn)}
                    </strong>{' '}
                    →{' '}
                    <strong style={{ color: '#0f172a' }}>
                      {formatDate(folioDetail?.checkOutDate || selectedStay.checkOutDate || folioDetail?.actualCheckOut)}
                    </strong>
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setSelectedStay(null);
                  setFolioDetail(null);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: 22,
                  cursor: 'pointer',
                  color: '#94a3b8',
                }}
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: 24, flex: 1 }}>
              {loadingFolio || !folioDetail ? (
                <div style={{ padding: '40px 0', textAlign: 'center', color: '#64748b' }}>
                  Đang tải chi tiết bảng kê hóa đơn phòng...
                </div>
              ) : (
                <div>
                  {/* BẢNG 1: TIỀN PHÒNG THEO ĐÊM */}
                  <div style={{ marginBottom: 20 }}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: 8,
                      }}
                    >
                      <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#0f172a' }}>
                        1. Tiền Phòng Theo Đêm (Room Nights)
                      </h4>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
                        Tạm tính: {formatVND(folioDetail.roomSubtotal || 0)}
                      </span>
                    </div>

                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', textAlign: 'left' }}>
                          <th style={{ padding: '8px 10px' }}>Ngày Ở</th>
                          <th style={{ padding: '8px 10px' }}>Hạng Phòng</th>
                          <th style={{ padding: '8px 10px', textAlign: 'center' }}>Số Lượng</th>
                          <th style={{ padding: '8px 10px', textAlign: 'right' }}>Đơn Giá / Đêm</th>
                          <th style={{ padding: '8px 10px', textAlign: 'right' }}>Thành Tiền</th>
                        </tr>
                      </thead>
                      <tbody>
                        {folioDetail.roomNights && folioDetail.roomNights.length > 0 ? (
                          folioDetail.roomNights.map((rn, idx) => (
                            <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                              <td style={{ padding: '8px 10px', fontWeight: 600 }}>{formatDate(rn.stayDate)}</td>
                              <td style={{ padding: '8px 10px' }}>{rn.roomTypeName}</td>
                              <td style={{ padding: '8px 10px', textAlign: 'center' }}>{rn.quantity}</td>
                              <td style={{ padding: '8px 10px', textAlign: 'right' }}>{formatVND(rn.unitPrice)}</td>
                              <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>
                                {formatVND(rn.lineTotal)}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan="5" style={{ padding: 12, textAlign: 'center', color: '#94a3b8' }}>
                              Không có dữ liệu giá đêm phòng.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* BẢNG 2: DỊCH VỤ PHÒNG ĐÃ SỬ DỤNG */}
                  <div style={{ marginBottom: 20 }}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: 8,
                      }}
                    >
                      <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#0f172a' }}>
                        2. Dịch Vụ Phòng Đã Hoàn Thành ({folioDetail.serviceOrders?.length || 0})
                      </h4>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
                        Tạm tính: {formatVND(folioDetail.serviceSubtotal || 0)}
                      </span>
                    </div>

                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', textAlign: 'left' }}>
                          <th style={{ padding: '8px 10px' }}>Mã Đơn</th>
                          <th style={{ padding: '8px 10px' }}>Tên Dịch Vụ</th>
                          <th style={{ padding: '8px 10px', textAlign: 'center' }}>SL</th>
                          <th style={{ padding: '8px 10px', textAlign: 'right' }}>Đơn Giá</th>
                          <th style={{ padding: '8px 10px', textAlign: 'right' }}>Thành Tiền</th>
                        </tr>
                      </thead>
                      <tbody>
                        {folioDetail.serviceOrders && folioDetail.serviceOrders.length > 0 ? (
                          folioDetail.serviceOrders.map((o) => (
                            <tr key={o.serviceOrderId} style={{ borderBottom: '1px solid #f1f5f9' }}>
                              <td style={{ padding: '8px 10px', color: '#64748b' }}>#{o.serviceOrderId}</td>
                              <td style={{ padding: '8px 10px', fontWeight: 600 }}>{o.serviceName}</td>
                              <td style={{ padding: '8px 10px', textAlign: 'center' }}>{o.quantity}</td>
                              <td style={{ padding: '8px 10px', textAlign: 'right' }}>{formatVND(o.unitPrice)}</td>
                              <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>
                                {formatVND(o.totalAmount)}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan="5" style={{ padding: 12, textAlign: 'center', color: '#94a3b8' }}>
                              Chưa có dịch vụ phòng nào hoàn thành.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* BẢNG 3: PHỤ THU PHÁT SINH */}
                  <div style={{ marginBottom: 20 }}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: 8,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#0f172a' }}>
                          3. Phụ Thu Phát Sinh (Minibar, Hư hại, Trả muộn...)
                        </h4>
                        {canManageCharges && folioDetail.folioStatus !== 'CLOSED' && (
                          <button
                            type="button"
                            onClick={() => setShowAddChargeForm((prev) => !prev)}
                            style={{
                              background: '#f0fdf4',
                              border: '1px solid #bbf7d0',
                              color: '#15803d',
                              padding: '2px 8px',
                              borderRadius: 4,
                              fontSize: 11,
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            {showAddChargeForm ? '✕ Đóng form' : '+ Thêm Phụ Thu'}
                          </button>
                        )}
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
                        Tạm tính: {formatVND(folioDetail.additionalSubtotal || 0)}
                      </span>
                    </div>

                    {/* Form thêm phụ thu inline */}
                    {showAddChargeForm && (
                      <form
                        onSubmit={handleAddCharge}
                        style={{
                          background: '#f8fafc',
                          border: '1px solid #cbd5e1',
                          padding: 12,
                          borderRadius: 8,
                          marginBottom: 10,
                          display: 'grid',
                          gridTemplateColumns: '1.2fr 2fr 1fr auto',
                          gap: 8,
                          alignItems: 'end',
                        }}
                      >
                        <div>
                          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 2 }}>
                            Loại phụ thu
                          </label>
                          <select
                            value={chargeForm.chargeType}
                            onChange={(e) => setChargeForm({ ...chargeForm, chargeType: e.target.value })}
                            style={{
                              width: '100%',
                              padding: '6px 8px',
                              borderRadius: 5,
                              border: '1px solid #cbd5e1',
                              fontSize: 12,
                              background: '#fff',
                            }}
                          >
                            <option value="MINIBAR">Minibar / Đồ uống tủ lạnh</option>
                            <option value="DAMAGE">Đền bù hư hại / Vỡ đồ</option>
                            <option value="LATE_CHECKOUT">Phụ thu trả muộn</option>
                            <option value="EXTRA_GUEST">Phụ thu thêm người</option>
                            <option value="OTHER">Phụ thu khác</option>
                          </select>
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 2 }}>
                            Mô tả chi tiết
                          </label>
                          <input
                            type="text"
                            required
                            placeholder="VD: 2 lon bia Heineken, 1 gói snack khoai tây..."
                            value={chargeForm.description}
                            onChange={(e) => setChargeForm({ ...chargeForm, description: e.target.value })}
                            style={{
                              width: '100%',
                              padding: '6px 8px',
                              borderRadius: 5,
                              border: '1px solid #cbd5e1',
                              fontSize: 12,
                              boxSizing: 'border-box',
                            }}
                          />
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 2 }}>
                            Số tiền (VND)
                          </label>
                          <input
                            type="number"
                            min="1000"
                            required
                            placeholder="120000"
                            value={chargeForm.amount}
                            onChange={(e) => setChargeForm({ ...chargeForm, amount: e.target.value })}
                            style={{
                              width: '100%',
                              padding: '6px 8px',
                              borderRadius: 5,
                              border: '1px solid #cbd5e1',
                              fontSize: 12,
                              boxSizing: 'border-box',
                            }}
                          />
                        </div>

                        <button
                          type="submit"
                          disabled={busy}
                          style={{
                            background: '#16a34a',
                            color: '#fff',
                            border: 'none',
                            padding: '6px 14px',
                            borderRadius: 5,
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: 'pointer',
                            height: 31,
                          }}
                        >
                          Lưu
                        </button>
                      </form>
                    )}

                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', textAlign: 'left' }}>
                          <th style={{ padding: '8px 10px' }}>Khoản Phụ Thu</th>
                          <th style={{ padding: '8px 10px' }}>Chi Tiết / Lý Do</th>
                          <th style={{ padding: '8px 10px' }}>Người Tạo</th>
                          <th style={{ padding: '8px 10px', textAlign: 'right' }}>Số Tiền</th>
                          {folioDetail.folioStatus !== 'CLOSED' && canManageCharges && (
                            <th style={{ padding: '8px 10px', textAlign: 'center', width: 60 }}>Xóa</th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {folioDetail.additionalCharges && folioDetail.additionalCharges.length > 0 ? (
                          folioDetail.additionalCharges.map((ac) => (
                            <tr key={ac.additionalChargeId} style={{ borderBottom: '1px solid #f1f5f9' }}>
                              <td style={{ padding: '8px 10px', fontWeight: 600 }}>
                                {CHARGE_TYPE_LABELS[ac.chargeType] || ac.chargeType}
                              </td>
                              <td style={{ padding: '8px 10px', color: '#475569' }}>{ac.description}</td>
                              <td style={{ padding: '8px 10px', fontSize: 12, color: '#64748b' }}>
                                {ac.createdByStaffName}
                              </td>
                              <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>
                                {formatVND(ac.amount)}
                              </td>
                              {folioDetail.folioStatus !== 'CLOSED' && canManageCharges && (
                                <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteCharge(ac.additionalChargeId)}
                                    disabled={busy}
                                    style={{
                                      background: 'none',
                                      border: 'none',
                                      color: '#ef4444',
                                      cursor: 'pointer',
                                      fontSize: 14,
                                    }}
                                    title="Xóa phụ thu"
                                  >
                                    ✕
                                  </button>
                                </td>
                              )}
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td
                              colSpan={folioDetail.folioStatus !== 'CLOSED' && canManageCharges ? 5 : 4}
                              style={{ padding: 12, textAlign: 'center', color: '#94a3b8' }}
                            >
                              Không có khoản phụ thu phát sinh.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* BẢNG 4: KHU VỰC VOUCHER & TIỀN CỌC ĐỐI TRỪ */}
                  <div
                    style={{
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: 8,
                      padding: 16,
                      marginBottom: 20,
                    }}
                  >
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                      {/* Cột Trái: Áp dụng Voucher */}
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>
                          Mã Khuyến Mãi (Voucher)
                        </div>
                        {folioDetail.folioStatus === 'CLOSED' ? (
                          <div style={{ fontSize: 13, color: '#475569' }}>
                            Mã đã áp dụng:{' '}
                            <strong style={{ color: (folioDetail.voucherCode || folioDetail.discountAmount > 0) ? '#059669' : '#0f172a' }}>
                              {folioDetail.voucherCode
                                ? folioDetail.voucherCode
                                : (folioDetail.discountAmount > 0
                                    ? 'Khuyến Mãi Đã Áp Dụng'
                                    : 'Không sử dụng voucher')}
                            </strong>
                            {(folioDetail.discountAmount > 0 || calculatedFinances.discount > 0) && (
                              <span style={{ marginLeft: 8, color: '#059669', fontSize: 12, fontWeight: 500 }}>
                                (Đã giảm: -{formatVND(folioDetail.discountAmount || calculatedFinances.discount)})
                              </span>
                            )}
                          </div>
                        ) : (
                          <div>
                            {appliedVoucher ? (
                              <div
                                style={{
                                  background: '#ecfdf5',
                                  border: '1px solid #a7f3d0',
                                  padding: '8px 12px',
                                  borderRadius: 6,
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                }}
                              >
                                <div>
                                  <strong style={{ color: '#065f46', fontSize: 13 }}>
                                    Mã: {appliedVoucher.code}
                                  </strong>
                                  <div style={{ fontSize: 12, color: '#047857' }}>
                                    Giảm: -{formatVND(appliedVoucher.discountAmount)}
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={handleRemoveVoucher}
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    color: '#be123c',
                                    cursor: 'pointer',
                                    fontSize: 12,
                                    fontWeight: 600,
                                  }}
                                >
                                  Gỡ mã
                                </button>
                              </div>
                            ) : (
                              <div>
                                <div style={{ display: 'flex', gap: 6 }}>
                                  <input
                                    type="text"
                                    placeholder="Nhập mã voucher (VD: WELCOME10, SUMMER200K)..."
                                    value={voucherCodeInput}
                                    onChange={(e) => setVoucherCodeInput(e.target.value.toUpperCase())}
                                    style={{
                                      flex: 1,
                                      padding: '6px 10px',
                                      borderRadius: 5,
                                      border: voucherError ? '1px solid #ef4444' : '1px solid #cbd5e1',
                                      fontSize: 12,
                                      textTransform: 'uppercase',
                                      fontWeight: 600,
                                    }}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleValidateVoucher()}
                                    disabled={validatingVoucher || busy}
                                    style={{
                                      background: '#0284c7',
                                      color: '#fff',
                                      border: 'none',
                                      padding: '6px 12px',
                                      borderRadius: 5,
                                      fontSize: 12,
                                      fontWeight: 600,
                                      cursor: 'pointer',
                                    }}
                                  >
                                    {validatingVoucher ? 'Kiểm tra...' : 'Áp dụng'}
                                  </button>
                                </div>
                                {voucherError && (
                                  <div style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>
                                    {voucherError}
                                  </div>
                                )}
                                {vouchers && vouchers.filter((v) => v.status === 'ACTIVE').length > 0 && (
                                  <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                                    <span style={{ fontSize: 11, color: '#64748b' }}>Mã gợi ý:</span>
                                    {vouchers
                                      .filter((v) => v.status === 'ACTIVE')
                                      .map((v) => (
                                        <button
                                          key={v.voucherId}
                                          type="button"
                                          onClick={() => handleValidateVoucher(v.code)}
                                          style={{
                                            background: '#f0fdf4',
                                            border: '1px solid #86efac',
                                            color: '#15803d',
                                            padding: '2px 8px',
                                            borderRadius: 4,
                                            fontSize: 11,
                                            fontWeight: 700,
                                            cursor: 'pointer',
                                          }}
                                          title={`Đơn tối thiểu: ${formatVND(v.minSpend)} • Giảm: ${v.discountType === 'PERCENTAGE' ? `${v.discountValue}%` : formatVND(v.discountValue)}`}
                                        >
                                          {v.code} ({v.discountType === 'PERCENTAGE' ? `-${v.discountValue}%` : `-${formatVND(v.discountValue)}`})
                                        </button>
                                      ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Cột Phải: Tiền Đặt Cọc Đã Thanh Toán */}
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>
                          Tiền Đặt Cọc Đã Thanh Toán
                        </div>
                        <div style={{ fontSize: 13, color: '#475569' }}>
                          Tổng cọc đã nhận:{' '}
                          <strong style={{ color: '#16a34a', fontSize: 14 }}>
                            {formatVND(folioDetail.depositPaid || 0)}
                          </strong>
                        </div>
                        <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                          Khoản tiền này sẽ được tự động khấu trừ vào số tiền quyết toán cuối cùng.
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* BẢNG 5: TỔNG KẾT TÀI CHÍNH & NÚT QUYẾT TOÁN */}
                  <div
                    style={{
                      background: '#fff',
                      border: '2px solid #e2e8f0',
                      borderRadius: 10,
                      padding: 18,
                      marginBottom: 16,
                    }}
                  >
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                      {/* Bảng chi tiết dòng tiền */}
                      <div style={{ fontSize: 13, lineHeight: 1.8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: '#475569' }}>Tổng tiền phòng:</span>
                          <strong>{formatVND(folioDetail.roomSubtotal || 0)}</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: '#475569' }}>Tổng dịch vụ phòng:</span>
                          <strong>{formatVND(folioDetail.serviceSubtotal || 0)}</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: '#475569' }}>Tổng phụ thu phát sinh:</span>
                          <strong>{formatVND(folioDetail.additionalSubtotal || 0)}</strong>
                        </div>
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            borderTop: '1px dashed #cbd5e1',
                            paddingTop: 4,
                            marginTop: 4,
                          }}
                        >
                          <span style={{ color: '#0f172a', fontWeight: 600 }}>Tổng trước thuế (Subtotal):</span>
                          <strong>{formatVND(calculatedFinances.subtotal)}</strong>
                        </div>
                        {(calculatedFinances.discount > 0 || (folioDetail.discountAmount || 0) > 0) && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#be123c', fontWeight: 600 }}>
                            <span>
                              Chiết khấu Voucher
                              {folioDetail.voucherCode ? ` (${folioDetail.voucherCode})` : (appliedVoucher?.code ? ` (${appliedVoucher.code})` : '')}:
                            </span>
                            <strong>-{formatVND(calculatedFinances.discount || folioDetail.discountAmount || 0)}</strong>
                          </div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: '#475569' }}>Thuế GTGT (VAT 8%):</span>
                          <strong>+{formatVND(calculatedFinances.tax)}</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#16a34a' }}>
                          <span>Trừ tiền cọc đã thanh toán:</span>
                          <strong>-{formatVND(calculatedFinances.depositPaid)}</strong>
                        </div>
                      </div>

                      {/* Khung số tiền thanh toán & Hình thức thu tiền */}
                      <div
                        style={{
                          background: '#f8fafc',
                          padding: 16,
                          borderRadius: 8,
                          border: '1px solid #e2e8f0',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                        }}
                      >
                        <div>
                          <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                            Số tiền thực thu quyết toán
                          </div>
                          <div
                            style={{
                              fontSize: 26,
                              fontWeight: 800,
                              color: '#0284c7',
                              marginTop: 4,
                              marginBottom: 12,
                            }}
                          >
                            {formatVND(calculatedFinances.balancePayable)}
                          </div>

                          {folioDetail.folioStatus !== 'CLOSED' && (
                            <div>
                              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                                Phương thức thanh toán thu tiền:
                              </label>
                              <select
                                value={paymentMethod}
                                onChange={(e) => setPaymentMethod(e.target.value)}
                                style={{
                                  width: '100%',
                                  padding: '7px 10px',
                                  borderRadius: 6,
                                  border: '1px solid #cbd5e1',
                                  fontSize: 13,
                                  background: '#fff',
                                  marginBottom: 8,
                                }}
                              >
                                <option value="CASH">Tiền mặt (CASH tại quầy)</option>
                                <option value="CREDIT_CARD">Thẻ tín dụng / Quẹt POS (CREDIT_CARD)</option>
                                <option value="BANK_TRANSFER">Chuyển khoản ngân hàng / QR (BANK_TRANSFER)</option>
                              </select>

                              <input
                                type="text"
                                placeholder="Ghi chú quyết toán (tùy chọn)..."
                                value={settleNotes}
                                onChange={(e) => setSettleNotes(e.target.value)}
                                style={{
                                  width: '100%',
                                  padding: '6px 10px',
                                  borderRadius: 6,
                                  border: '1px solid #cbd5e1',
                                  fontSize: 12,
                                  boxSizing: 'border-box',
                                }}
                              />
                            </div>
                          )}
                        </div>

                        <div style={{ marginTop: 14 }}>
                          {folioDetail.folioStatus === 'CLOSED' ? (
                            <button
                              type="button"
                              onClick={() => handleOpenPrintInvoice(folioDetail.stayId, folioDetail.invoiceId)}
                              style={{
                                width: '100%',
                                background: '#16a34a',
                                color: '#fff',
                                border: 'none',
                                padding: '10px 16px',
                                borderRadius: 6,
                                fontWeight: 700,
                                fontSize: 14,
                                cursor: 'pointer',
                              }}
                            >
                              In Hóa Đơn Thanh Toán (Print Bill)
                            </button>
                          ) : (
                            canSettle && (
                              <button
                                type="button"
                                onClick={() => setConfirmSettleModal(true)}
                                disabled={busy}
                                style={{
                                  width: '100%',
                                  background: '#0284c7',
                                  color: '#fff',
                                  border: 'none',
                                  padding: '10px 16px',
                                  borderRadius: 6,
                                  fontWeight: 700,
                                  fontSize: 14,
                                  cursor: 'pointer',
                                  boxShadow: '0 2px 4px rgba(2, 132, 199, 0.3)',
                                }}
                              >
                                Xác Nhận Quyết Toán &amp; Đóng Folio
                              </button>
                            )
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ======================= MODAL XÁC NHẬN QUYẾT TOÁN ======================= */}
      {confirmSettleModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15,23,42,0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100,
            padding: 16,
          }}
          onClick={() => setConfirmSettleModal(false)}
        >
          <div
            style={{
              background: '#fff',
              padding: 24,
              borderRadius: 12,
              width: '100%',
              maxWidth: 480,
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: 0, color: '#0f172a', fontSize: 17, fontWeight: 700, marginBottom: 12 }}>
              Xác Nhận Quyết Toán Hóa Đơn Phòng
            </h3>
            <div style={{ fontSize: 13, color: '#334155', lineHeight: 1.6, marginBottom: 16 }}>
              Bạn đang chuẩn bị thực hiện quyết toán cho phòng <strong>P.{folioDetail?.roomNumber}</strong> ({folioDetail?.guestName}):
              <ul style={{ margin: '8px 0', paddingLeft: 20 }}>
                <li>Số tiền thực thu: <strong style={{ color: '#0284c7' }}>{formatVND(calculatedFinances.balancePayable)}</strong></li>
                <li>Phương thức: <strong>{paymentMethod}</strong></li>
                {appliedVoucher && <li>Mã giảm giá áp dụng: <strong>{appliedVoucher.code}</strong></li>}
              </ul>
              Khi hoàn tất, hệ thống sẽ <strong>đóng Folio phòng</strong>, tạo hóa đơn <strong>Invoice trạng thái PAID</strong> và kích hoạt điều kiện để Lễ tân thực hiện Check-out trả phòng (UC-30).
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                onClick={() => setConfirmSettleModal(false)}
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
                type="button"
                onClick={handleExecuteSettlement}
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
                {busy ? 'Đang xử lý...' : 'Đồng ý Quyết Toán'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================= MODAL IN HÓA ĐƠN VAT CHUẨN A4 ======================= */}
      {printInvoiceData && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15,23,42,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1200,
            padding: 16,
          }}
          onClick={() => setPrintInvoiceData(null)}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 12,
              width: '100%',
              maxWidth: 820,
              maxHeight: '94vh',
              overflowY: 'auto',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
              display: 'flex',
              flexDirection: 'column',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Thanh công cụ Modal */}
            <div
              className="no-print"
              style={{
                padding: '12px 20px',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: '#f8fafc',
                borderTopLeftRadius: 12,
                borderTopRightRadius: 12,
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>
                Bản Xem Trước Hóa Đơn Khách Sạn (Print-ready Invoice Preview)
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => window.print()}
                  style={{
                    background: '#16a34a',
                    color: '#fff',
                    border: 'none',
                    padding: '6px 14px',
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <span>🖨</span> In Hóa Đơn / Xuất PDF
                </button>
                <button
                  type="button"
                  onClick={() => setPrintInvoiceData(null)}
                  style={{
                    background: '#f1f5f9',
                    border: '1px solid #cbd5e1',
                    color: '#475569',
                    padding: '6px 12px',
                    borderRadius: 6,
                    fontSize: 12,
                    cursor: 'pointer',
                  }}
                >
                  Đóng
                </button>
              </div>
            </div>

            {/* Khung nội dung hóa đơn in ấn */}
            <div
              id="printable-hotel-invoice"
              style={{
                padding: '36px 40px',
                color: '#0f172a',
                fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                lineHeight: 1.5,
              }}
            >
              {/* Header Khách sạn */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  borderBottom: '2px solid #0f172a',
                  paddingBottom: 16,
                  marginBottom: 20,
                }}
              >
                <div>
                  <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    HMS LUXURY HOTEL &amp; RESORT
                  </h1>
                  <div style={{ fontSize: 12, color: '#475569', marginTop: 4 }}>
                    Lô E2a-7, Đường D1, Khu Công nghệ cao, P. Long Thạnh Mỹ, TP. Thủ Đức, TP. HCM
                  </div>
                  <div style={{ fontSize: 12, color: '#475569' }}>
                    MST: <strong>0108992345</strong> | Hotline: <strong>1900 6868</strong> | Email: reservation@hms.com
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 12, color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>
                    MÃ HÓA ĐƠN
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#0284c7' }}>
                    {printInvoiceData.invoiceCode}
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                    Ngày lập: {formatDateTime(printInvoiceData.issueDate)}
                  </div>
                </div>
              </div>

              {/* Tiêu đề Hóa Đơn */}
              <div style={{ textAlign: 'center', marginBottom: 20 }}>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, textTransform: 'uppercase', color: '#0f172a' }}>
                  HÓA ĐƠN THANH TOÁN TIỀN PHÒNG &amp; DỊCH VỤ
                </h2>
                <div style={{ fontSize: 12, color: '#64748b', fontStyle: 'italic', marginTop: 2 }}>
                  (GUEST FOLIO BILL &amp; SETTLEMENT RECEIPT)
                </div>
              </div>

              {/* Thông tin khách hàng & kỳ nghỉ */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1.2fr 1fr',
                  gap: 16,
                  background: '#f8fafc',
                  padding: 14,
                  borderRadius: 6,
                  border: '1px solid #e2e8f0',
                  fontSize: 12,
                  marginBottom: 20,
                }}
              >
                <div>
                  <div>Khách hàng: <strong>{printInvoiceData.guestName}</strong></div>
                  {printInvoiceData.guestIdNumber && <div>Số CCCD / Hộ chiếu: <strong>{printInvoiceData.guestIdNumber}</strong></div>}
                  <div>Số điện thoại: <strong>{printInvoiceData.guestPhone || 'N/A'}</strong></div>
                  <div>Email: <strong>{printInvoiceData.guestEmail || 'N/A'}</strong></div>
                </div>

                <div>
                  <div>Phòng lưu trú: <strong>P.{printInvoiceData.roomNumber}</strong> ({printInvoiceData.roomTypeName})</div>
                  <div>Mã đặt phòng: <strong>{printInvoiceData.reservationCode}</strong></div>
                  <div>Ngày nhận phòng: <strong>{formatDate(printInvoiceData.checkInDate || printInvoiceData.actualCheckIn)}</strong></div>
                  <div>Ngày trả phòng: <strong>{formatDate(printInvoiceData.checkOutDate || printInvoiceData.actualCheckOut)}</strong></div>
                </div>
              </div>

              {/* Bảng chi tiết toàn bộ các dòng chi phí */}
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginBottom: 20 }}>
                <thead>
                  <tr style={{ background: '#0f172a', color: '#fff', textAlign: 'left' }}>
                    <th style={{ padding: '8px 10px', width: 35 }}>STT</th>
                    <th style={{ padding: '8px 10px' }}>Diễn Giải Chi Phí</th>
                    <th style={{ padding: '8px 10px', textAlign: 'center', width: 60 }}>SL</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right', width: 110 }}>Đơn Giá</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right', width: 130 }}>Thành Tiền (VND)</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Dòng tiền phòng */}
                  {printInvoiceData.roomNights && printInvoiceData.roomNights.map((rn, idx) => (
                    <tr key={`rn-${idx}`} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '7px 10px', color: '#64748b' }}>{idx + 1}</td>
                      <td style={{ padding: '7px 10px' }}>
                        Tiền phòng đêm {formatDate(rn.stayDate)} ({rn.roomTypeName})
                      </td>
                      <td style={{ padding: '7px 10px', textAlign: 'center' }}>{rn.quantity}</td>
                      <td style={{ padding: '7px 10px', textAlign: 'right' }}>{formatVND(rn.unitPrice)}</td>
                      <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 600 }}>
                        {formatVND(rn.lineTotal)}
                      </td>
                    </tr>
                  ))}

                  {/* Dòng dịch vụ phòng */}
                  {printInvoiceData.serviceOrders && printInvoiceData.serviceOrders.map((so, idx) => (
                    <tr key={`so-${so.serviceOrderId}`} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '7px 10px', color: '#64748b' }}>
                        {(printInvoiceData.roomNights?.length || 0) + idx + 1}
                      </td>
                      <td style={{ padding: '7px 10px' }}>
                        Dịch vụ: {so.serviceName} {so.category ? `[${so.category}]` : ''}
                      </td>
                      <td style={{ padding: '7px 10px', textAlign: 'center' }}>{so.quantity}</td>
                      <td style={{ padding: '7px 10px', textAlign: 'right' }}>{formatVND(so.unitPrice)}</td>
                      <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 600 }}>
                        {formatVND(so.totalAmount)}
                      </td>
                    </tr>
                  ))}

                  {/* Dòng phụ thu */}
                  {printInvoiceData.additionalCharges && printInvoiceData.additionalCharges.map((ac, idx) => (
                    <tr key={`ac-${ac.additionalChargeId}`} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '7px 10px', color: '#64748b' }}>
                        {(printInvoiceData.roomNights?.length || 0) +
                          (printInvoiceData.serviceOrders?.length || 0) +
                          idx +
                          1}
                      </td>
                      <td style={{ padding: '7px 10px' }}>
                        Phụ thu: {CHARGE_TYPE_LABELS[ac.chargeType] || ac.chargeType} ({ac.description})
                      </td>
                      <td style={{ padding: '7px 10px', textAlign: 'center' }}>1</td>
                      <td style={{ padding: '7px 10px', textAlign: 'right' }}>{formatVND(ac.amount)}</td>
                      <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 600 }}>
                        {formatVND(ac.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Bảng tổng kết tài chính */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  marginBottom: 24,
                }}
              >
                <div style={{ width: 340, fontSize: 13, lineHeight: 1.8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#475569' }}>Tổng chi phí (Subtotal):</span>
                    <strong>{formatVND(printInvoiceData.totalAmount)}</strong>
                  </div>

                  {printInvoiceData.discountAmount > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#be123c' }}>
                      <span>Giảm giá Voucher{printInvoiceData.voucherCode ? ` (${printInvoiceData.voucherCode})` : ''}:</span>
                      <strong>-{formatVND(printInvoiceData.discountAmount)}</strong>
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#475569' }}>Thuế GTGT (VAT 8%):</span>
                    <strong>+{formatVND(printInvoiceData.taxAmount)}</strong>
                  </div>

                  {printInvoiceData.depositDeducted > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#16a34a' }}>
                      <span>Trừ tiền cọc đã trả:</span>
                      <strong>-{formatVND(printInvoiceData.depositDeducted)}</strong>
                    </div>
                  )}

                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      borderTop: '2px solid #0f172a',
                      paddingTop: 6,
                      marginTop: 6,
                      fontSize: 15,
                    }}
                  >
                    <span style={{ fontWeight: 800 }}>TỔNG THANH TOÁN:</span>
                    <strong style={{ color: '#0284c7', fontSize: 16 }}>
                      {formatVND(printInvoiceData.amountPaid || printInvoiceData.finalAmount)}
                    </strong>
                  </div>

                  <div style={{ fontSize: 12, color: '#64748b', textAlign: 'right', marginTop: 2 }}>
                    Hình thức: <strong>{printInvoiceData.paymentMethod}</strong> (ĐÃ THANH TOÁN)
                  </div>
                </div>
              </div>

              {/* Phần chữ ký xác nhận */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  textAlign: 'center',
                  marginTop: 30,
                  fontSize: 12,
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, textTransform: 'uppercase' }}>Khách Hàng Ký Nhận</div>
                  <div style={{ fontSize: 11, color: '#64748b', fontStyle: 'italic' }}>
                    (Ký và ghi rõ họ tên)
                  </div>
                  <div style={{ height: 60 }} />
                  <div style={{ fontWeight: 600 }}>{printInvoiceData.guestName}</div>
                </div>

                <div>
                  <div style={{ fontWeight: 700, textTransform: 'uppercase' }}>Nhân Viên Thu Ngân</div>
                  <div style={{ fontSize: 11, color: '#64748b', fontStyle: 'italic' }}>
                    (Ký và ghi rõ họ tên)
                  </div>
                  <div style={{ height: 60 }} />
                  <div style={{ fontWeight: 600 }}>{printInvoiceData.cashierName || 'Lễ tân HMS'}</div>
                </div>
              </div>

              {/* Lời cảm ơn */}
              <div
                style={{
                  textAlign: 'center',
                  marginTop: 36,
                  paddingTop: 16,
                  borderTop: '1px dashed #cbd5e1',
                  fontSize: 11,
                  color: '#64748b',
                  fontStyle: 'italic',
                }}
              >
                Cảm ơn Quý khách đã tin tưởng và sử dụng dịch vụ tại HMS Luxury Hotel &amp; Resort! Hẹn gặp lại Quý khách!
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

