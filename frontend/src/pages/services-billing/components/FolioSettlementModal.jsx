import { useState, useMemo } from 'react';
import { formatVND } from '../../../lib/money';
import { formatDate, formatDateTime } from '../../../lib/datetime';
import { notifyToast } from '../../../lib/http';
import { triggerUrgentCheckoutAlert, formatOrderNotes } from './serviceUtils';

export const FolioSettlementModal = ({
  selectedStay,
  loadingFolio,
  folioDetail,
  onClose,
  busy,
  canManageCharges,
  canSettle,
  showAddChargeForm,
  setShowAddChargeForm,
  chargeForm,
  setChargeForm,
  chargeError,
  setChargeError,
  handleAddCharge,
  handleQuickAddAmount,
  handleResetAmount,
  setChargeToDelete,
  appliedVoucher,
  handleRemoveVoucher,
  voucherCodeInput,
  setVoucherCodeInput,
  voucherError,
  validatingVoucher,
  handleValidateVoucher,
  vouchers,
  calculatedFinances,
  paymentMethod,
  setPaymentMethod,
  settleNotes,
  setSettleNotes,
  setConfirmSettleModal,
  handleOpenPrintInvoice,
  getOverdueInfo,
  stayPendingOrders = [],
  stayPreOrderAnalysis = { items: [], unchargedCount: 0, unchargedAmount: 0 },
  handleCompletePendingOrder,
  handleVoidPendingOrder,
  handleChargePreOrder,
  handleCancelPreOrderItem,
  handleChargeAllUnsettledServices,
  handleVoidAllUnsettledServices,
  onRefreshFolio,
}) => {
  if (!selectedStay) return null;

  const [urgentNotified, setUrgentNotified] = useState(false);

  // XÂY DỰNG DANH SÁCH GỘP DUY NHẤT: KHÔNG TRÙNG LẶP GIỮA ĐẶT TRƯỚC VÀ ĐƠN PHÒNG
  const unifiedUnsettledList = useMemo(() => {
    const list = [];
    const processedOrderIds = new Set();

    // 1. Duyệt qua các dịch vụ đặt trước:
    (stayPreOrderAnalysis?.items || []).forEach((it) => {
      if (it.matchedOrder) {
        // Đã tạo thành đơn phòng
        if (it.matchedOrder.status === 'ORDERED') {
          processedOrderIds.add(it.matchedOrder.serviceOrderId);
          list.push({
            id: `po-order-${it.matchedOrder.serviceOrderId}`,
            orderId: it.matchedOrder.serviceOrderId,
            serviceName: it.serviceName,
            sourceType: 'PRE_ORDER',
            sourceLabel: 'Dịch vụ đặt trước',
            quantity: it.quantity || it.matchedOrder.quantity || 1,
            unitPrice: it.unitPrice || it.matchedOrder.unitPrice || 0,
            totalAmount: it.totalAmount || it.matchedOrder.totalAmount || 0,
            status: it.matchedOrder.staffConfirmed ? 'Chờ phục vụ' : 'Chờ xác nhận',
            isConfirmed: Boolean(it.matchedOrder.staffConfirmed),
            rawOrder: it.matchedOrder,
            timeAndDetail: [it.time && it.time !== 'Không' ? `Giờ hẹn: ${it.time}` : null, it.detail && it.detail !== 'Không' ? `Yêu cầu: ${it.detail}` : null]
              .filter(Boolean)
              .join(' | '),
          });
        }
      } else if (it.isUncharged) {
        // Đặt trước chưa tạo đơn / chưa nạp vào hóa đơn
        list.push({
          id: `po-uncharged-${it.id || it.serviceId || it.serviceName}`,
          orderId: null,
          serviceName: it.serviceName,
          sourceType: 'PRE_ORDER_UNCHARGED',
          sourceLabel: 'Dịch vụ đặt trước (Chưa nạp đơn)',
          quantity: it.quantity || 1,
          unitPrice: it.unitPrice || 0,
          totalAmount: it.totalAmount || 0,
          status: 'Chưa nạp vào hóa đơn',
          isConfirmed: false,
          rawPreOrder: it,
          timeAndDetail: [it.time && it.time !== 'Không' ? `Giờ hẹn: ${it.time}` : null, it.detail && it.detail !== 'Không' ? `Yêu cầu: ${it.detail}` : null]
            .filter(Boolean)
            .join(' | '),
        });
      }
    });

    // 2. Duyệt qua các đơn dịch vụ phòng (ORDERED) chưa được tính ở bước 1:
    (stayPendingOrders || []).forEach((o) => {
      if (!processedOrderIds.has(o.serviceOrderId)) {
        processedOrderIds.add(o.serviceOrderId);
        list.push({
          id: `room-order-${o.serviceOrderId}`,
          orderId: o.serviceOrderId,
          serviceName: o.serviceName,
          sourceType: 'ROOM_ORDER',
          sourceLabel: 'Đơn gọi tại phòng',
          quantity: o.quantity || 1,
          unitPrice: o.unitPrice || 0,
          totalAmount: o.totalAmount || 0,
          status: o.staffConfirmed ? 'Chờ phục vụ' : 'Chờ xác nhận',
          isConfirmed: Boolean(o.staffConfirmed),
          rawOrder: o,
          notes: o.notes ? formatOrderNotes(o.notes) : null,
        });
      }
    });

    return list;
  }, [stayPreOrderAnalysis, stayPendingOrders]);

  const totalUnsettledAmount = unifiedUnsettledList.reduce((acc, it) => acc + (Number(it.totalAmount) || 0), 0);
  const totalUnsettledCount = unifiedUnsettledList.length;

  const handleSendUrgentAlert = () => {
    if (!selectedStay) return;
    const room = folioDetail?.roomNumber || selectedStay.roomNumber || '';

    // Gộp cả dịch vụ đặt trước và dịch vụ phòng vào 1 thông báo duy nhất!
    const orderItems = unifiedUnsettledList.filter((it) => it.orderId);
    const unchargedItems = unifiedUnsettledList.filter((it) => !it.orderId);

    const parts = [];
    if (orderItems.length > 0) {
      parts.push(
        `Đơn dịch vụ phòng: ${orderItems.map((it) => `${it.serviceName} (#${it.orderId}${it.sourceType === 'PRE_ORDER' ? ' - Đặt trước' : ''})`).join(', ')}`
      );
    }
    if (unchargedItems.length > 0) {
      parts.push(
        `Dịch vụ đặt trước chưa nạp: ${unchargedItems.map((it) => it.serviceName).join(', ')}`
      );
    }

    const summaryText = parts.join(' • ');

    triggerUrgentCheckoutAlert({
      stayId: selectedStay.stayId,
      roomNumber: room,
      reservationCode: selectedStay.reservationCode || '',
      orderIds: orderItems.map((it) => it.orderId),
      preOrderNames: unchargedItems.map((it) => it.serviceName),
      summaryText,
    });

    setUrgentNotified(true);
    notifyToast({
      type: 'SUCCESS',
      message: `Đã gửi 1 thông báo tổng hợp đến bộ phận Dịch vụ! Phòng P.${room}: ${summaryText}.`,
    });
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15,23,42,0.65)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 16,
      }}
      onClick={() => {
        if (!busy) {
          onClose();
        }
      }}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 16,
          width: '100%',
          maxWidth: 1180,
          height: '90vh',
          maxHeight: '90vh',
          boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.35)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          border: '1px solid #e2e8f0',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '16px 24px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: '#ffffff',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  background: '#0284c7',
                  color: '#ffffff',
                  fontWeight: 800,
                  fontSize: 16,
                  padding: '4px 12px',
                  borderRadius: 8,
                  letterSpacing: '0.5px',
                }}
              >
                P.{folioDetail?.roomNumber || selectedStay.roomNumber}
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <h3 style={{ margin: 0, color: '#0f172a', fontSize: 17, fontWeight: 700 }}>
                    {folioDetail?.guestName || selectedStay.guestName}
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
                      {folioDetail.folioStatus === 'CLOSED' ? '✓ ĐÃ QUYẾT TOÁN' : '⏳ CHỜ QUYẾT TOÁN'}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 2, display: 'flex', gap: 12 }}>
                  <span>Mã đặt phòng: <strong style={{ color: '#0284c7' }}>{folioDetail?.reservationCode || selectedStay.reservationCode}</strong></span>
                  {(folioDetail?.guestPhone || selectedStay.phoneNumber) && (
                    <span>SĐT: <strong>{folioDetail?.guestPhone || selectedStay.phoneNumber}</strong></span>
                  )}
                  <span>Hạng phòng: <strong>{folioDetail?.roomTypeName || selectedStay.roomTypeName || 'Tiêu chuẩn'}</strong></span>
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ textAlign: 'right', fontSize: 12, color: '#64748b' }}>
              <div>
                Thời gian ở:{' '}
                <strong style={{ color: '#0f172a' }}>
                  {formatDate(folioDetail?.checkInDate || selectedStay.checkInDate || folioDetail?.actualCheckIn)}
                </strong>{' '}
                →{' '}
                <strong style={{ color: '#0f172a' }}>
                  {formatDate(folioDetail?.checkOutDate || selectedStay.checkOutDate || folioDetail?.actualCheckOut)}
                </strong>
              </div>
              {(() => {
                const ov = getOverdueInfo ? getOverdueInfo(selectedStay || folioDetail) : { isOverdue: false };
                if (ov.isOverdue && folioDetail?.folioStatus !== 'CLOSED') {
                  return (
                    <div style={{ color: '#dc2626', fontWeight: 700, marginTop: 2 }}>
                      ⚠️ Trễ hạn trả phòng {ov.days} ngày
                    </div>
                  );
                }
                return null;
              })()}
            </div>

            <button
              type="button"
              onClick={onClose}
              style={{
                background: '#f1f5f9',
                border: 'none',
                borderRadius: 8,
                width: 32,
                height: 32,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 18,
                cursor: 'pointer',
                color: '#64748b',
                transition: 'all 0.15s ease',
              }}
              title="Đóng cửa sổ"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Modal Body: 2-Column POS Layout */}
        <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
          {loadingFolio || !folioDetail ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>⏳</div>
                <div>Đang tải chi tiết hóa đơn & dịch vụ phòng...</div>
              </div>
            </div>
          ) : (
            <>
              {/* LEFT COLUMN: CHI TIẾT CÁC KHOẢN PHÍ & ĐIỀU CHỈNH (58%) */}
              <div
                style={{
                  flex: '1.3 1 0%',
                  minWidth: 0,
                  minHeight: 0,
                  height: '100%',
                  overflowY: 'auto',
                  padding: '20px 24px',
                  borderRight: '1px solid #e2e8f0',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 18,
                  background: '#ffffff',
                }}
              >
                {/* Cảnh báo quá hạn trả phòng (Overdue banner) */}
                {(() => {
                  const ov = getOverdueInfo ? getOverdueInfo(selectedStay || folioDetail) : { isOverdue: false };
                  if (!ov.isOverdue || folioDetail.folioStatus === 'CLOSED') return null;
                  return (
                    <div
                      style={{
                        background: '#fef2f2',
                        border: '1px solid #fecaca',
                        borderRadius: 10,
                        padding: '12px 16px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 12,
                        flexShrink: 0,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: '#991b1b' }}>
                        <span style={{ fontSize: 20 }}>⚠️</span>
                        <div>
                          <strong style={{ color: '#b91c1c' }}>Phòng quá hạn trả phòng {ov.days} ngày!</strong>
                          <div style={{ fontSize: 12, color: '#7f1d1d', marginTop: 1 }}>
                            Dự kiến checkout: {formatDate(folioDetail?.checkOutDate || selectedStay?.checkOutDate)}. Vui lòng tính thêm phụ thu trễ hạn nếu có.
                          </div>
                        </div>
                      </div>
                      {canManageCharges && (
                        <button
                          type="button"
                          onClick={() => {
                            setChargeForm({
                              chargeType: 'LATE_CHECKOUT',
                              description: `Phụ thu quá hạn trả phòng (${ov.days} ngày trễ)`,
                              amount: '',
                            });
                            setChargeError(null);
                            setShowAddChargeForm(true);
                          }}
                          style={{
                            background: '#dc2626',
                            color: '#fff',
                            border: 'none',
                            padding: '6px 12px',
                            borderRadius: 6,
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          + Tính Phụ Thu Trễ
                        </button>
                      )}
                    </div>
                  );
                })()}

                {/* CARD 1: TIỀN PHÒNG THEO ĐÊM */}
                <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden', flexShrink: 0 }}>
                  <div
                    style={{
                      background: '#f8fafc',
                      padding: '10px 14px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      borderBottom: '1px solid #e2e8f0',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 15 }}>🛏️</span>
                      <span style={{ fontWeight: 700, fontSize: 13.5, color: '#0f172a' }}>
                        Tiền Phòng Theo Đêm ({folioDetail.roomNights?.length || 0} đêm)
                      </span>
                    </div>
                    <span style={{ fontWeight: 700, fontSize: 13.5, color: '#0284c7' }}>
                      {formatVND(folioDetail.roomSubtotal || 0)}
                    </span>
                  </div>

                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                    <thead>
                      <tr style={{ background: '#ffffff', borderBottom: '1px solid #f1f5f9', color: '#64748b', textAlign: 'left' }}>
                        <th style={{ padding: '8px 14px' }}>Ngày Ở</th>
                        <th style={{ padding: '8px 14px' }}>Hạng Phòng</th>
                        <th style={{ padding: '8px 14px', textAlign: 'center' }}>SL</th>
                        <th style={{ padding: '8px 14px', textAlign: 'right' }}>Đơn Giá / Đêm</th>
                        <th style={{ padding: '8px 14px', textAlign: 'right' }}>Thành Tiền</th>
                      </tr>
                    </thead>
                    <tbody>
                      {folioDetail.roomNights && folioDetail.roomNights.length > 0 ? (
                        folioDetail.roomNights.map((rn, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '8px 14px', fontWeight: 600, color: '#334155' }}>{formatDate(rn.stayDate)}</td>
                            <td style={{ padding: '8px 14px', color: '#64748b' }}>{rn.roomTypeName}</td>
                            <td style={{ padding: '8px 14px', textAlign: 'center', color: '#64748b' }}>{rn.quantity}</td>
                            <td style={{ padding: '8px 14px', textAlign: 'right', color: '#64748b' }}>{formatVND(rn.unitPrice)}</td>
                            <td style={{ padding: '8px 14px', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>
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

                {/* ================= KHUNG THỐNG KÊ CẢNH BÁO (CHỈ THỐNG KÊ, KHÔNG LIỆT KÊ BẢNG BÊN DƯỚI) ================= */}
                {unifiedUnsettledList.length > 0 && (
                  <div
                    style={{
                      background: '#fffbeb',
                      border: '1.5px solid #f59e0b',
                      borderRadius: 10,
                      padding: '14px 16px',
                      boxShadow: '0 2px 6px rgba(245, 158, 11, 0.12)',
                      flexShrink: 0,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                      <div style={{ flex: 1, minWidth: 280 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, color: '#92400e', fontSize: 14 }}>
                          <span style={{ fontSize: 18 }}>⚠️</span>
                          <span>CẢNH BÁO: Phòng P.{folioDetail?.roomNumber} đang có {unifiedUnsettledList.length} dịch vụ chưa hoàn tất!</span>
                        </div>
                        <div style={{ fontSize: 12.5, color: '#78350f', marginTop: 4, lineHeight: 1.5 }}>
                          Tổng giá trị liên quan: <strong style={{ color: '#b45309', fontSize: 13.5 }}>{formatVND(totalUnsettledAmount)}</strong>.
                          {' '}(Bao gồm cả đơn phòng dở dang và dịch vụ đặt trước chưa nạp tiền).
                          <div style={{ marginTop: 6, color: '#92400e' }}>
                            👉 Bấm <strong>"Báo Bên Dịch Vụ Xử Lý Gấp"</strong> để thông báo cho nhân viên phục vụ (bếp/spa/giặt là) hoàn thành hoặc hủy đơn. Sau khi bên dịch vụ thao tác, bấm <strong>"Làm mới số liệu"</strong> trước khi quyết toán.
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', alignSelf: 'center', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={handleSendUrgentAlert}
                          style={{
                            background: urgentNotified ? '#059669' : '#dc2626',
                            color: '#fff',
                            border: 'none',
                            padding: '8px 16px',
                            borderRadius: 6,
                            fontSize: 12.5,
                            fontWeight: 700,
                            cursor: 'pointer',
                            boxShadow: '0 2px 4px rgba(220, 38, 38, 0.25)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                          }}
                          title="Gửi 1 thông báo tổng hợp cả dịch vụ đặt trước và dịch vụ phòng đến bộ phận Dịch vụ"
                        >
                          <span>{urgentNotified ? '✓' : '🔔'}</span>
                          <span>{urgentNotified ? 'Đã báo Dịch vụ (Báo lại)' : 'Báo Bên Dịch Vụ Xử Lý Gấp'}</span>
                        </button>
                        {onRefreshFolio && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={onRefreshFolio}
                            style={{
                              background: '#fff',
                              color: '#0284c7',
                              border: '1px solid #bae6fd',
                              padding: '8px 14px',
                              borderRadius: 6,
                              fontSize: 12.5,
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 5,
                            }}
                            title="Tải lại số liệu hóa đơn sau khi bộ phận dịch vụ đã cập nhật"
                          >
                            <span>🔄</span>
                            <span>Làm mới số liệu</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* CARD 2: DỊCH VỤ PHÒNG ĐÃ HOÀN THÀNH */}
                <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden', flexShrink: 0 }}>
                  <div
                    style={{
                      background: '#f8fafc',
                      padding: '10px 14px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      borderBottom: '1px solid #e2e8f0',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 15 }}>🛎️</span>
                      <span style={{ fontWeight: 700, fontSize: 13.5, color: '#0f172a' }}>
                        Dịch Vụ Phòng Đã Hoàn Thành ({folioDetail.serviceOrders?.length || 0})
                      </span>
                    </div>
                    <span style={{ fontWeight: 700, fontSize: 13.5, color: '#0284c7' }}>
                      {formatVND(folioDetail.serviceSubtotal || 0)}
                    </span>
                  </div>

                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                    <thead>
                      <tr style={{ background: '#ffffff', borderBottom: '1px solid #f1f5f9', color: '#64748b', textAlign: 'left' }}>
                        <th style={{ padding: '8px 14px' }}>Mã Đơn</th>
                        <th style={{ padding: '8px 14px' }}>Tên Dịch Vụ</th>
                        <th style={{ padding: '8px 14px', textAlign: 'center' }}>SL</th>
                        <th style={{ padding: '8px 14px', textAlign: 'right' }}>Đơn Giá</th>
                        <th style={{ padding: '8px 14px', textAlign: 'right' }}>Thành Tiền</th>
                      </tr>
                    </thead>
                    <tbody>
                      {folioDetail.serviceOrders && folioDetail.serviceOrders.length > 0 ? (
                        folioDetail.serviceOrders.map((o) => (
                          <tr key={o.serviceOrderId} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '8px 14px', color: '#64748b' }}>#{o.serviceOrderId}</td>
                            <td style={{ padding: '8px 14px', fontWeight: 600, color: '#334155' }}>{o.serviceName}</td>
                            <td style={{ padding: '8px 14px', textAlign: 'center', color: '#64748b' }}>{o.quantity}</td>
                            <td style={{ padding: '8px 14px', textAlign: 'right', color: '#64748b' }}>{formatVND(o.unitPrice)}</td>
                            <td style={{ padding: '8px 14px', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>
                              {formatVND(o.totalAmount)}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="5" style={{ padding: 12, textAlign: 'center', color: '#94a3b8' }}>
                            Chưa có dịch vụ phòng nào phát sinh.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* CARD 3: PHỤ THU PHÁT SINH */}
                <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden', flexShrink: 0 }}>
                  <div
                    style={{
                      background: '#f8fafc',
                      padding: '10px 14px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      borderBottom: '1px solid #e2e8f0',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 15 }}>🏷️</span>
                      <span style={{ fontWeight: 700, fontSize: 13.5, color: '#0f172a' }}>
                        Phụ Thu Phát Sinh ({folioDetail.additionalCharges?.length || 0})
                      </span>
                      {canManageCharges && folioDetail.folioStatus !== 'CLOSED' && (
                        <button
                          type="button"
                          onClick={() => {
                            setShowAddChargeForm((prev) => !prev);
                            setChargeError(null);
                          }}
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
                    <span style={{ fontWeight: 700, fontSize: 13.5, color: '#0284c7' }}>
                      {formatVND(folioDetail.additionalSubtotal || 0)}
                    </span>
                  </div>

                  {/* Form thêm phụ thu: Bố cục rộng rãi 2 dòng, không bao giờ bị che hoặc tràn */}
                  {showAddChargeForm && (
                    <div
                      style={{
                        background: '#f8fafc',
                        borderBottom: '1px solid #cbd5e1',
                        padding: '14px 16px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 10,
                      }}
                    >
                      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr', gap: 10 }}>
                        <div>
                          <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: '#475569', marginBottom: 3 }}>
                            Loại phụ thu
                          </label>
                          <select
                            value={chargeForm.chargeType}
                            onChange={(e) => {
                              setChargeForm({ ...chargeForm, chargeType: e.target.value });
                              setChargeError(null);
                            }}
                            style={{
                              width: '100%',
                              padding: '7px 10px',
                              borderRadius: 6,
                              border: '1px solid #cbd5e1',
                              fontSize: 12.5,
                              background: '#fff',
                              boxSizing: 'border-box',
                            }}
                          >
                            <option value="MINIBAR">Minibar đồ uống</option>
                            <option value="DAMAGE">Bồi thường hư hại đồ dùng</option>
                            <option value="LAUNDRY_EXTRA">Giặt ủi đặc biệt</option>
                            <option value="LATE_CHECKOUT">Phụ thu trả phòng muộn</option>
                            <option value="OTHER">Phụ thu khác</option>
                          </select>
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: '#475569', marginBottom: 3 }}>
                            Diễn giải chi tiết
                          </label>
                          <input
                            type="text"
                            placeholder="VD: 2 lon nước ngọt, vỡ ly trà..."
                            value={chargeForm.description}
                            onChange={(e) => {
                              setChargeForm({ ...chargeForm, description: e.target.value });
                              setChargeError(null);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleAddCharge(e);
                              }
                            }}
                            style={{
                              width: '100%',
                              padding: '7px 10px',
                              borderRadius: 6,
                              border: chargeError && !chargeForm.description.trim() ? '1.5px solid #ef4444' : '1px solid #cbd5e1',
                              fontSize: 12.5,
                              boxSizing: 'border-box',
                              background: '#fff',
                            }}
                          />
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr auto', gap: 10, alignItems: 'end' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: '#475569', marginBottom: 3 }}>
                            Số tiền phụ thu (VND, tối thiểu 1,000)
                          </label>
                          <input
                            type="number"
                            min="1000"
                            step="1000"
                            placeholder="50,000"
                            value={chargeForm.amount}
                            onChange={(e) => {
                              setChargeForm({ ...chargeForm, amount: e.target.value });
                              setChargeError(null);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleAddCharge(e);
                              }
                            }}
                            style={{
                              width: '100%',
                              padding: '7px 10px',
                              borderRadius: 6,
                              border: chargeError && Number(chargeForm.amount) < 1000 ? '1.5px solid #ef4444' : '1px solid #cbd5e1',
                              fontSize: 12.5,
                              boxSizing: 'border-box',
                              background: '#fff',
                            }}
                          />
                        </div>

                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            type="button"
                            onClick={handleAddCharge}
                            disabled={busy}
                            style={{
                              background: '#16a34a',
                              color: '#fff',
                              border: 'none',
                              padding: '7px 18px',
                              borderRadius: 6,
                              fontSize: 13,
                              fontWeight: 600,
                              cursor: 'pointer',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {busy ? 'Đang lưu...' : 'Lưu Phụ Thu'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setShowAddChargeForm(false);
                              setChargeError(null);
                            }}
                            style={{
                              background: '#e2e8f0',
                              color: '#475569',
                              border: 'none',
                              padding: '7px 12px',
                              borderRadius: 6,
                              fontSize: 13,
                              cursor: 'pointer',
                            }}
                          >
                            Hủy
                          </button>
                        </div>
                      </div>

                      {/* Chọn nhanh mốc tiền (Cộng dồn vào số tiền hiện tại mỗi lần bấm) */}
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', paddingTop: 2 }}>
                        <span style={{ fontSize: 11, color: '#64748b' }}>Cộng dồn tiền:</span>
                        {[20000, 50000, 100000, 150000, 200000, 500000].map((quickAmt) => (
                          <button
                            key={quickAmt}
                            type="button"
                            onClick={() => handleQuickAddAmount(quickAmt)}
                            style={{
                              background: '#ffffff',
                              border: '1px solid #cbd5e1',
                              padding: '3px 8px',
                              borderRadius: 5,
                              fontSize: 11.5,
                              cursor: 'pointer',
                              color: '#0284c7',
                              fontWeight: 700,
                              boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                            }}
                            title={`Cộng thêm ${formatVND(quickAmt)} vào số tiền hiện tại`}
                          >
                            +{formatVND(quickAmt)}
                          </button>
                        ))}
                        {Number(chargeForm.amount) > 0 && (
                          <button
                            type="button"
                            onClick={handleResetAmount}
                            style={{
                              background: '#f1f5f9',
                              border: '1px solid #cbd5e1',
                              padding: '3px 8px',
                              borderRadius: 5,
                              fontSize: 11,
                              cursor: 'pointer',
                              color: '#64748b',
                              fontWeight: 600,
                            }}
                          >
                            ↺ Đặt lại 0đ
                          </button>
                        )}
                      </div>

                      {/* Thông báo lỗi đỏ nếu có */}
                      {chargeError && (
                        <div
                          style={{
                            background: '#fef2f2',
                            border: '1px solid #fecaca',
                            color: '#b91c1c',
                            padding: '6px 10px',
                            borderRadius: 6,
                            fontSize: 12,
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                          }}
                        >
                          <span>⚠️</span>
                          <span>{chargeError}</span>
                        </div>
                      )}
                    </div>
                  )}

                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                    <thead>
                      <tr style={{ background: '#ffffff', borderBottom: '1px solid #f1f5f9', color: '#64748b', textAlign: 'left' }}>
                        <th style={{ padding: '8px 14px' }}>Thời Điểm</th>
                        <th style={{ padding: '8px 14px' }}>Loại Phụ Thu</th>
                        <th style={{ padding: '8px 14px' }}>Diễn Giải</th>
                        <th style={{ padding: '8px 14px', textAlign: 'right' }}>Số Tiền</th>
                        {folioDetail.folioStatus !== 'CLOSED' && canManageCharges && (
                          <th style={{ padding: '8px 14px', textAlign: 'center', width: 40 }}>Xóa</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {folioDetail.additionalCharges && folioDetail.additionalCharges.length > 0 ? (
                        folioDetail.additionalCharges.map((ch, idx) => (
                          <tr key={ch.additionalChargeId || ch.chargeId || idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '8px 14px', color: '#64748b' }}>{formatDateTime(ch.createdAt)}</td>
                            <td style={{ padding: '8px 14px', fontWeight: 600, color: '#334155' }}>
                              {ch.chargeType === 'MINIBAR' && 'Minibar'}
                              {ch.chargeType === 'DAMAGE' && 'Bồi thường'}
                              {ch.chargeType === 'LAUNDRY_EXTRA' && 'Giặt ủi'}
                              {ch.chargeType === 'LATE_CHECKOUT' && 'Trả phòng muộn'}
                              {ch.chargeType === 'OTHER' && 'Khác'}
                            </td>
                            <td style={{ padding: '8px 14px', color: '#64748b' }}>{ch.description}</td>
                            <td style={{ padding: '8px 14px', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>
                              {formatVND(ch.amount)}
                            </td>
                            {folioDetail.folioStatus !== 'CLOSED' && canManageCharges && (
                              <td style={{ padding: '8px 14px', textAlign: 'center' }}>
                                <button
                                  type="button"
                                  onClick={() => setChargeToDelete(ch)}
                                  style={{
                                    background: '#fee2e2',
                                    border: '1px solid #fecaca',
                                    color: '#dc2626',
                                    borderRadius: 6,
                                    width: 24,
                                    height: 24,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    fontSize: 12,
                                    fontWeight: 700,
                                  }}
                                  title="Xóa khoản phụ thu này"
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
                            Không có khoản phụ thu phát sinh nào.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* CARD 4: MÃ KHUYẾN MÃI (VOUCHER) */}
                <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 14, background: '#f8fafc', flexShrink: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 13, color: '#0f172a' }}>
                      <span>🎟️</span>
                      <span>Mã Khuyến Mãi (Voucher)</span>
                    </div>
                    {appliedVoucher && (
                      <span style={{ fontSize: 12, color: '#059669', fontWeight: 700 }}>
                        Đã giảm: -{formatVND(appliedVoucher.discountAmount)}
                      </span>
                    )}
                  </div>

                  {folioDetail.folioStatus === 'CLOSED' || !canSettle ? (
                    <div style={{ fontSize: 12.5, color: '#475569' }}>
                      Mã áp dụng:{' '}
                      <strong style={{ color: (folioDetail.voucherCode || folioDetail.discountAmount > 0) ? '#059669' : '#0f172a' }}>
                        {folioDetail.voucherCode || (folioDetail.discountAmount > 0 ? 'Khuyến Mãi Đã Áp Dụng' : 'Không sử dụng voucher')}
                      </strong>
                      {(folioDetail.discountAmount > 0 || calculatedFinances.discount > 0) && (
                        <span style={{ marginLeft: 8, color: '#059669', fontWeight: 600 }}>
                          (-{formatVND(folioDetail.discountAmount || calculatedFinances.discount)})
                        </span>
                      )}
                    </div>
                  ) : appliedVoucher ? (
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
                        <strong style={{ color: '#065f46', fontSize: 13 }}>Mã: {appliedVoucher.code}</strong>
                        <div style={{ fontSize: 11.5, color: '#047857', marginTop: 1 }}>
                          Giảm giá: -{formatVND(appliedVoucher.discountAmount)}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleRemoveVoucher}
                        style={{
                          background: '#ffffff',
                          border: '1px solid #fecaca',
                          color: '#be123c',
                          padding: '4px 10px',
                          borderRadius: 4,
                          cursor: 'pointer',
                          fontSize: 11.5,
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
                            borderRadius: 6,
                            border: voucherError ? '1px solid #ef4444' : '1px solid #cbd5e1',
                            fontSize: 12,
                            textTransform: 'uppercase',
                            fontWeight: 600,
                            background: '#fff',
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
                            padding: '6px 14px',
                            borderRadius: 6,
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          {validatingVoucher ? 'Kiểm tra...' : 'Áp dụng'}
                        </button>
                      </div>
                      {voucherError && (
                        <div style={{ fontSize: 11.5, color: '#ef4444', marginTop: 4 }}>
                          {voucherError}
                        </div>
                      )}
                      {vouchers && vouchers.filter((v) => v.status === 'ACTIVE').length > 0 && (
                        <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                          <span style={{ fontSize: 11, color: '#64748b' }}>Gợi ý:</span>
                          {vouchers
                            .filter((v) => v.status === 'ACTIVE')
                            .map((v) => (
                              <button
                                key={v.voucherId}
                                type="button"
                                onClick={() => handleValidateVoucher(v.code)}
                                style={{
                                  background: '#ffffff',
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

                {/* CARD 5: TIỀN ĐẶT CỌC GIỮ PHÒNG & CẤN TRỪ QUYẾT TOÁN */}
                <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 14, background: '#ffffff', flexShrink: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 13.5, color: '#0f172a' }}>
                      <span>💳</span>
                      <span>Tiền Đặt Cọc Giữ Phòng (Deposit Deduction)</span>
                    </div>
                    {calculatedFinances.depositPaid > 0 ? (
                      <span style={{ fontSize: 12, color: '#16a34a', fontWeight: 700, background: '#dcfce7', padding: '2px 8px', borderRadius: 6, border: '1px solid #bbf7d0' }}>
                        ✓ Đã Cấn Trừ: -{formatVND(calculatedFinances.depositPaid)}
                      </span>
                    ) : (
                      <span style={{ fontSize: 11.5, color: '#64748b', background: '#f1f5f9', padding: '2px 8px', borderRadius: 6 }}>
                        0 đ (Không có cọc)
                      </span>
                    )}
                  </div>

                  {calculatedFinances.depositPaid > 0 ? (
                    <div>
                      <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '10px 14px', marginBottom: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: '#166534' }}>
                              Đã thanh toán trước: {formatVND(calculatedFinances.depositPaid)}
                            </div>
                            <div style={{ fontSize: 11.5, color: '#15803d', marginTop: 2 }}>
                              Khoản tiền này khách đã nộp khi đặt phòng. Hệ thống tự động khấu trừ 100% vào hóa đơn quyết toán.
                            </div>
                          </div>
                          <span style={{ fontSize: 20 }}>🛡️</span>
                        </div>
                      </div>

                      {folioDetail.depositPayments && folioDetail.depositPayments.length > 0 && (
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, background: '#f8fafc', borderRadius: 6 }}>
                          <thead>
                            <tr style={{ borderBottom: '1px solid #e2e8f0', color: '#64748b', textAlign: 'left' }}>
                              <th style={{ padding: '6px 10px' }}>Mã GD Cọc</th>
                              <th style={{ padding: '6px 10px' }}>Thời Gian</th>
                              <th style={{ padding: '6px 10px' }}>Hình Thức</th>
                              <th style={{ padding: '6px 10px' }}>Trạng Thái</th>
                              <th style={{ padding: '6px 10px', textAlign: 'right' }}>Số Tiền Cọc</th>
                            </tr>
                          </thead>
                          <tbody>
                            {folioDetail.depositPayments.map((dp, idx) => (
                              <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                <td style={{ padding: '6px 10px', fontWeight: 600, color: '#334155' }}>#{dp.paymentId}</td>
                                <td style={{ padding: '6px 10px', color: '#64748b' }}>{formatDateTime(dp.paidAt)}</td>
                                <td style={{ padding: '6px 10px' }}>
                                  <span style={{ background: '#e0f2fe', color: '#0369a1', padding: '1px 6px', borderRadius: 4, fontWeight: 600 }}>
                                    {dp.method || 'VNPAY'}
                                  </span>
                                </td>
                                <td style={{ padding: '6px 10px', color: '#16a34a', fontWeight: 600 }}>✓ {dp.status || 'PAID'}</td>
                                <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 700, color: '#16a34a' }}>
                                  {formatVND(dp.amount)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  ) : (
                    <div style={{ background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#64748b' }}>
                      Phòng này <strong>không có khoản tiền cọc trước</strong> (khách chọn hình thức thanh toán trực tiếp toàn bộ 100% tại quầy khi trả phòng).
                    </div>
                  )}
                </div>
              </div>

              {/* RIGHT COLUMN: BẢNG POS QUYẾT TOÁN & THU NGÂN (42%) */}
              <div
                style={{
                  flex: '1 1 0%',
                  minWidth: 0,
                  minHeight: 0,
                  height: '100%',
                  overflowY: 'auto',
                  background: '#f8fafc',
                  padding: '20px 24px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  {/* Hero Card: Số tiền thanh toán */}
                  <div
                    style={{
                      background: '#ffffff',
                      borderRadius: 12,
                      padding: '16px 20px',
                      border: '2px solid #0284c7',
                      boxShadow: '0 4px 6px -1px rgba(2, 132, 199, 0.1)',
                      marginBottom: 16,
                    }}
                  >
                    <div style={{ fontSize: 11.5, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Số Tiền Thực Thu Quyết Toán
                    </div>
                    <div
                      style={{
                        fontSize: 30,
                        fontWeight: 800,
                        color: '#0284c7',
                        marginTop: 4,
                        marginBottom: 4,
                        letterSpacing: '-0.5px',
                      }}
                    >
                      {formatVND(calculatedFinances.balancePayable)}
                    </div>
                    <div style={{ fontSize: 12, color: '#475569' }}>
                      {calculatedFinances.depositPaid > 0 ? (
                        <div style={{ color: '#166534', background: '#dcfce7', padding: '4px 8px', borderRadius: 6, display: 'inline-block', fontWeight: 600, border: '1px solid #bbf7d0', marginTop: 2 }}>
                          ✓ Đã cấn trừ tiền cọc: -{formatVND(calculatedFinances.depositPaid)}
                        </div>
                      ) : (
                        <div style={{ color: '#64748b', marginTop: 2 }}>
                          Đã gồm 8% VAT • Thu đủ 100% khi trả phòng (Không có cọc)
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Chi tiết bảng kê tài chính */}
                  <div
                    style={{
                      background: '#ffffff',
                      borderRadius: 10,
                      padding: '14px 16px',
                      border: '1px solid #e2e8f0',
                      fontSize: 13,
                      lineHeight: '1.9',
                      marginBottom: 16,
                    }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 6, textTransform: 'uppercase' }}>
                      Bảng Kê Đối Soát Tài Chính
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748b' }}>Tiền phòng:</span>
                      <span style={{ fontWeight: 600 }}>{formatVND(folioDetail.roomSubtotal || 0)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748b' }}>Dịch vụ phòng:</span>
                      <span style={{ fontWeight: 600 }}>{formatVND(folioDetail.serviceSubtotal || 0)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748b' }}>Phụ thu phát sinh:</span>
                      <span style={{ fontWeight: 600 }}>{formatVND(folioDetail.additionalSubtotal || 0)}</span>
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
                      <span style={{ color: '#0f172a', fontWeight: 600 }}>Tổng trước thuế:</span>
                      <strong style={{ color: '#0f172a' }}>{formatVND(calculatedFinances.subtotal)}</strong>
                    </div>
                    {(calculatedFinances.discount > 0 || (folioDetail.discountAmount || 0) > 0) && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#059669', fontWeight: 600 }}>
                        <span>
                          Chiết khấu Voucher
                          {folioDetail.voucherCode ? ` (${folioDetail.voucherCode})` : (appliedVoucher?.code ? ` (${appliedVoucher.code})` : '')}:
                        </span>
                        <span>-{formatVND(calculatedFinances.discount || folioDetail.discountAmount || 0)}</span>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748b' }}>Thuế GTGT (VAT 8%):</span>
                      <span>+{formatVND(calculatedFinances.tax)}</span>
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
                      <span style={{ color: '#0f172a', fontWeight: 600 }}>Tổng chi phí hóa đơn:</span>
                      <strong style={{ color: '#0f172a' }}>{formatVND(calculatedFinances.gross)}</strong>
                    </div>

                    {/* Dòng trừ cọc hiển thị rõ ràng cả khi có cọc hoặc không có cọc */}
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        color: calculatedFinances.depositPaid > 0 ? '#16a34a' : '#64748b',
                        fontWeight: calculatedFinances.depositPaid > 0 ? 700 : 400,
                        background: calculatedFinances.depositPaid > 0 ? '#f0fdf4' : 'transparent',
                        padding: calculatedFinances.depositPaid > 0 ? '2px 6px' : 0,
                        borderRadius: 4,
                        marginTop: 2,
                      }}
                    >
                      <span>
                        Cấn trừ tiền cọc đã thu trước:
                        {calculatedFinances.depositPaid > 0 && folioDetail.depositPayments?.[0]?.paymentId && (
                          <span style={{ fontSize: 11, fontWeight: 400, marginLeft: 4, color: '#15803d' }}>
                            (GD #{folioDetail.depositPayments[0].paymentId})
                          </span>
                        )}
                      </span>
                      <span>
                        {calculatedFinances.depositPaid > 0
                          ? `-${formatVND(calculatedFinances.depositPaid)}`
                          : '- 0 VND (Không có cọc)'}
                      </span>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        borderTop: '2px solid #0f172a',
                        paddingTop: 6,
                        marginTop: 6,
                        fontSize: 14,
                      }}
                    >
                      <strong style={{ color: '#0f172a' }}>Thực thu cần thanh toán:</strong>
                      <strong style={{ color: '#0284c7', fontSize: 17 }}>
                        {formatVND(calculatedFinances.balancePayable)}
                      </strong>
                    </div>
                  </div>

                  {/* Phương thức thanh toán (Chỉ Tiền mặt & Cổng VNPay, chỉ hiển thị cho Lễ tân/Quản lý có quyền thu tiền) */}
                  {folioDetail.folioStatus !== 'CLOSED' && canSettle && (
                    <div style={{ marginBottom: 16 }}>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                        Hình Thức Thu Tiền:
                      </label>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                        {[
                          { id: 'CASH', icon: '💵', label: 'Tiền mặt tại quầy' },
                          { id: 'VNPAY', icon: '🌐', label: 'Cổng VNPay' },
                        ].map((method) => {
                          const isActive = paymentMethod === method.id;
                          const isVnPay = method.id === 'VNPAY';
                          return (
                            <button
                              key={method.id}
                              type="button"
                              onClick={() => setPaymentMethod(method.id)}
                              style={{
                                padding: '8px 6px',
                                borderRadius: 6,
                                border: isActive
                                  ? isVnPay
                                    ? '2px solid #005baa'
                                    : '2px solid #0284c7'
                                  : '1px solid #cbd5e1',
                                background: isActive
                                  ? isVnPay
                                    ? 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)'
                                    : '#e0f2fe'
                                  : '#ffffff',
                                color: isActive ? (isVnPay ? '#1e40af' : '#0369a1') : '#475569',
                                fontWeight: isActive ? 700 : 500,
                                fontSize: 12,
                                cursor: 'pointer',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: 2,
                                transition: 'all 0.15s ease',
                                position: 'relative',
                              }}
                            >
                              <span style={{ fontSize: 16 }}>{method.icon}</span>
                              <span>{method.label}</span>
                              {isVnPay && (
                                <span
                                  style={{
                                    fontSize: 9.5,
                                    color: isActive ? '#dc2626' : '#64748b',
                                    fontWeight: 700,
                                  }}
                                >
                                  QR / ATM / Quốc tế
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>

                      {paymentMethod === 'VNPAY' && (
                        <div
                          style={{
                            background: '#eff6ff',
                            border: '1px solid #bfdbfe',
                            borderRadius: 6,
                            padding: '8px 10px',
                            marginBottom: 10,
                            fontSize: 11.5,
                            color: '#1e3a8a',
                            lineHeight: 1.45,
                          }}
                        >
                          <div style={{ fontWeight: 700, marginBottom: 2 }}>
                            🔒 Thanh toán trực tuyến qua Cổng VNPay (Bên thứ 3)
                          </div>
                          <div>
                            Hệ thống sẽ chuyển hướng sang cổng <strong>VNPay Sandbox</strong> để quét mã QR / nhập thẻ ATM nội địa hoặc thẻ Quốc tế. Sau khi thanh toán thành công, hệ thống tự động đóng Folio và xuất hóa đơn VAT.
                          </div>
                        </div>
                      )}

                      <input
                        type="text"
                        placeholder="Ghi chú thu ngân (tùy chọn)..."
                        value={settleNotes}
                        onChange={(e) => setSettleNotes(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '8px 10px',
                          borderRadius: 6,
                          border: '1px solid #cbd5e1',
                          fontSize: 12,
                          background: '#fff',
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>
                  )}
                </div>

                {/* Action CTA Buttons */}
                <div style={{ paddingTop: 10, borderTop: '1px solid #e2e8f0' }}>
                  {folioDetail.folioStatus === 'CLOSED' ? (
                    <button
                      type="button"
                      onClick={() => handleOpenPrintInvoice(folioDetail.stayId, folioDetail.invoiceId)}
                      style={{
                        width: '100%',
                        background: '#16a34a',
                        color: '#fff',
                        border: 'none',
                        padding: '12px 18px',
                        borderRadius: 8,
                        fontWeight: 700,
                        fontSize: 14,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        boxShadow: '0 2px 4px rgba(22, 163, 74, 0.3)',
                      }}
                    >
                      <span>🖨️</span>
                      <span>In Hóa Đơn Thanh Toán (A4 Print Bill)</span>
                    </button>
                  ) : canSettle ? (
                    <button
                      type="button"
                      onClick={() => setConfirmSettleModal(true)}
                      disabled={busy}
                      style={{
                        width: '100%',
                        background: paymentMethod === 'VNPAY' ? '#005baa' : '#0284c7',
                        color: '#fff',
                        border: 'none',
                        padding: '12px 18px',
                        borderRadius: 8,
                        fontWeight: 700,
                        fontSize: 14,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        boxShadow:
                          paymentMethod === 'VNPAY'
                            ? '0 2px 6px rgba(0, 91, 170, 0.35)'
                            : '0 2px 6px rgba(2, 132, 199, 0.35)',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <span>{paymentMethod === 'VNPAY' ? '🌐' : '💳'}</span>
                      <span>
                        {paymentMethod === 'VNPAY'
                          ? `Thanh Toán Qua Cổng VNPay (${formatVND(calculatedFinances.balancePayable)})`
                          : `Xác Nhận Quyết Toán (${formatVND(calculatedFinances.balancePayable)})`}
                      </span>
                    </button>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div
                        style={{
                          background: '#eff6ff',
                          border: '1px solid #bfdbfe',
                          borderRadius: 8,
                          padding: '10px 12px',
                          fontSize: 12,
                          color: '#1e3a8a',
                          lineHeight: 1.45,
                        }}
                      >
                        <strong>🔍 Chế độ Kế toán Đối soát (Read-only):</strong> Thao tác thu tiền quyết toán, áp mã giảm giá và thêm/xóa phụ thu do <strong>Lễ tân tại quầy (Front-Desk)</strong> trực tiếp thực hiện.
                      </div>
                      <button
                        type="button"
                        onClick={() => handleOpenPrintInvoice(folioDetail.stayId, folioDetail.invoiceId)}
                        style={{
                          width: '100%',
                          background: '#0284c7',
                          color: '#fff',
                          border: 'none',
                          padding: '11px 16px',
                          borderRadius: 8,
                          fontWeight: 700,
                          fontSize: 13.5,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 8,
                        }}
                      >
                        <span>🖨️</span>
                        <span>Xem / In Bản Tạm Tính Folio (Proforma)</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

