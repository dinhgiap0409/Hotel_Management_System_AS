import { formatVND } from '../../../lib/money';

export const ConfirmSettleModal = ({
  show,
  folioDetail,
  balancePayable,
  paymentMethod,
  appliedVoucher,
  busy,
  onClose,
  onConfirm,
  stayPendingOrders = [],
  stayPreOrderAnalysis = { items: [], unchargedCount: 0, unchargedAmount: 0 },
  onConfirmWithCompleteOrders,
}) => {
  if (!show || !folioDetail) return null;

  const isVnPay = paymentMethod === 'VNPAY';
  const methodLabel =
    paymentMethod === 'VNPAY'
      ? '🌐 Cổng thanh toán VNPay (QR / ATM / Quốc tế)'
      : paymentMethod === 'CASH'
        ? '💵 Tiền mặt (CASH)'
        : paymentMethod === 'CREDIT_CARD'
          ? '💳 Thẻ POS (CREDIT_CARD)'
          : paymentMethod;

  const pendingOrdersAmount = (stayPendingOrders || []).reduce((a, b) => a + (Number(b.totalAmount) || 0), 0);
  const unchargedPreOrdersCount = stayPreOrderAnalysis?.unchargedCount || 0;
  const unchargedPreOrdersAmount = stayPreOrderAnalysis?.unchargedAmount || 0;
  const totalUnsettledCount = (stayPendingOrders || []).length + unchargedPreOrdersCount;
  const totalUnsettledAmount = pendingOrdersAmount + unchargedPreOrdersAmount;

  return (
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
      onClick={() => !busy && onClose()}
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
          {isVnPay ? '🌐 Xác Nhận Thanh Toán Quyết Toán Qua VNPay' : 'Xác Nhận Quyết Toán Hóa Đơn Phòng'}
        </h3>
        <div style={{ fontSize: 13, color: '#334155', lineHeight: 1.6, marginBottom: 16 }}>
          Bạn đang chuẩn bị thực hiện quyết toán cho phòng <strong>P.{folioDetail?.roomNumber}</strong> ({folioDetail?.guestName}):
          <ul style={{ margin: '8px 0', paddingLeft: 20 }}>
            <li>
              Số tiền thực thu: <strong style={{ color: '#0284c7' }}>{formatVND(balancePayable)}</strong>
            </li>
            <li>
              Phương thức: <strong>{methodLabel}</strong>
            </li>
            {appliedVoucher && (
              <li>
                Mã giảm giá áp dụng: <strong>{appliedVoucher.code}</strong>
              </li>
            )}
          </ul>
          {isVnPay ? (
            <span>
              Hệ thống sẽ chuyển hướng sang <strong>Cổng thanh toán VNPay Sandbox</strong>. Sau khi khách hoàn tất giao dịch trên VNPay, hệ thống sẽ tự động <strong>đóng bảng kê chi phí phòng</strong>, tạo hóa đơn <strong>Invoice trạng thái PAID</strong> và xuất biên lai VAT.
            </span>
          ) : (
            <span>
              Khi hoàn tất, hệ thống sẽ <strong>đóng bảng kê chi phí phòng</strong>, tạo hóa đơn <strong>Invoice trạng thái PAID</strong> và kích hoạt điều kiện để Lễ tân thực hiện thủ tục trả phòng (Check-out).
            </span>
          )}
        </div>

        {totalUnsettledCount > 0 && (
          <div
            style={{
              background: '#fffbeb',
              border: '1.5px solid #f59e0b',
              borderRadius: 8,
              padding: '12px 14px',
              marginBottom: 16,
              fontSize: 12.5,
              color: '#92400e',
              lineHeight: 1.5,
            }}
          >
            <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <span>⚠️</span>
              <span>Cảnh báo: Phòng còn {totalUnsettledCount} dịch vụ chưa thanh toán!</span>
            </div>
            <div>
              {stayPendingOrders.length > 0 && (
                <div>• {stayPendingOrders.length} đơn dịch vụ phòng đang dở dang: <strong>{formatVND(pendingOrdersAmount)}</strong></div>
              )}
              {unchargedPreOrdersCount > 0 && (
                <div>• {unchargedPreOrdersCount} dịch vụ khách đặt trước chưa nạp tiền: <strong>{formatVND(unchargedPreOrdersAmount)}</strong></div>
              )}
              <div style={{ marginTop: 4 }}>
                Tổng chưa nạp: <strong style={{ color: '#b45309', fontSize: 13 }}>{formatVND(totalUnsettledAmount)}</strong>.
                Nếu bạn quyết toán ngay, các khoản phí này sẽ <strong>không được thu tiền</strong>. Vui lòng liên hệ bộ phận Dịch vụ để hoàn thành hoặc hủy trước khi chốt hóa đơn.
              </div>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button
            type="button"
            onClick={onClose}
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
            {totalUnsettledCount > 0 ? 'Đóng & Chờ Dịch Vụ Xử Lý' : 'Hủy bỏ'}
          </button>
          {totalUnsettledCount > 0 ? (
            <button
              type="button"
              onClick={onConfirm}
              disabled={busy}
              style={{
                background: '#fff',
                color: '#b45309',
                border: '1px solid #f59e0b',
                padding: '8px 14px',
                borderRadius: 6,
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: 12.5,
              }}
              title="Bỏ qua các đơn dịch vụ chưa hoàn thành và chỉ quyết toán các khoản hiện có"
            >
              Bỏ qua &amp; Vẫn quyết toán
            </button>
          ) : (
            <button
              type="button"
              onClick={onConfirm}
              disabled={busy}
              style={{
                background: isVnPay ? '#005baa' : '#0284c7',
                color: '#fff',
                border: 'none',
                padding: '8px 18px',
                borderRadius: 6,
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: 13,
                boxShadow: '0 1px 3px rgba(2, 132, 199, 0.25)',
              }}
            >
              {busy
                ? isVnPay
                  ? 'Đang chuyển sang cổng VNPay...'
                  : 'Đang quyết toán...'
                : isVnPay
                  ? '🌐 Chuyển Đến Cổng VNPay'
                  : 'Đồng Ý Quyết Toán'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

