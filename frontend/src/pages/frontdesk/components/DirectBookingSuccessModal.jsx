import { formatDate } from '../../../lib/datetime';
import { formatVND } from '../../../lib/money';

export const DirectBookingSuccessModal = ({
  data,
  onClose,
  isCashPaidConfirmed,
  onConfirmCash,
  isProcessingCash,
  onCancelPendingBooking,
  onProceedCheckIn,
}) => {
  if (!data) return null;

  const isPaid = isCashPaidConfirmed || data.depositPaymentStatus === 'PAID';
  const depositVal = data.depositAmount || data.estimatedTotal || 0;
  const payUrl =
    data.vnpayPaymentUrl ||
    `http://localhost:5173/booking/payment-callback?vnp_TxnRef=${encodeURIComponent(
      data.reservationCode
    )}`;

  return (
    <div className="fd-modal-overlay">
      <div className="fd-modal-dialog" style={{ maxWidth: 480, maxHeight: '92vh', borderRadius: 12, padding: '18px 20px' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 14 }}>
          {isPaid ? (
            <>
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: '50%',
                  background: '#ecfdf5',
                  color: '#059669',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 20,
                  marginBottom: 6,
                }}
              >
                <i className="bi bi-check-lg"></i>
              </div>
              <h3 style={{ fontSize: 17, fontWeight: 700, margin: '0 0 2px', color: '#0f172a' }}>
                Đặt Phòng & Đặt Cọc Thành Công
              </h3>
              <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>
                Đã ghi nhận thanh toán cọc đơn #{data.reservationCode}.
              </p>
            </>
          ) : (
            <>
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: '50%',
                  background: '#eff6ff',
                  color: '#0284c7',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 20,
                  marginBottom: 6,
                }}
              >
                <i className="bi bi-qr-code-scan"></i>
              </div>
              <h3 style={{ fontSize: 17, fontWeight: 700, margin: '0 0 2px', color: '#0f172a' }}>
                Thanh Toán Tiền Cọc
              </h3>
              <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>
                Quét mã QR VNPay hoặc thanh toán tiền mặt tại quầy.
              </p>
            </>
          )}
        </div>

        {/* Thông tin đơn đặt phòng */}
        <div className="fd-info-block" style={{ borderRadius: 8, padding: '10px 14px', marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
            <span style={{ color: '#64748b' }}>Mã đặt phòng:</span>
            <strong style={{ color: '#0f172a' }}>{data.reservationCode}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
            <span style={{ color: '#64748b' }}>Khách hàng:</span>
            <span style={{ color: '#0f172a', fontWeight: 600 }}>{data.contactName} ({data.contactPhone})</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
            <span style={{ color: '#64748b' }}>Hạng phòng:</span>
            <span style={{ color: '#0f172a', fontWeight: 500 }}>{data.roomTypeName}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
            <span style={{ color: '#64748b' }}>Thời gian lưu trú:</span>
            <span style={{ color: '#0f172a' }}>
              {formatDate(data.checkInDate)} → {formatDate(data.checkOutDate)}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #e2e8f0', paddingTop: 5, marginTop: 4 }}>
            <span style={{ color: '#475569', fontWeight: 600 }}>Tổng tiền dự kiến:</span>
            <strong style={{ color: '#0f172a' }}>{formatVND(data.estimatedTotal)}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
            <span style={{ color: '#0369a1', fontWeight: 600 }}>Tiền cọc yêu cầu (30%):</span>
            <strong style={{ color: '#0369a1', fontSize: 14 }}>
              {formatVND(depositVal)}
            </strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
            <span style={{ color: '#64748b' }}>Trạng thái thanh toán:</span>
            {isPaid ? (
              <span className="fd-badge fd-badge-success" style={{ fontSize: 12 }}>
                <i className="bi bi-check-circle-fill me-1"></i> Đã thanh toán cọc
              </span>
            ) : (
              <span className="fd-badge fd-badge-warning" style={{ fontSize: 12 }}>
                <i className="bi bi-clock-history me-1"></i> Chờ thanh toán cọc
              </span>
            )}
          </div>
        </div>

        {/* Khối Trạng thái & QR Code Thanh Toán */}
        {isPaid ? (
          <div
            style={{
              background: '#ecfdf5',
              border: '1px solid #a7f3d0',
              borderRadius: 8,
              padding: '14px 16px',
              textAlign: 'center',
              marginBottom: 14,
            }}
          >
            <div style={{ color: '#059669', fontSize: 26, marginBottom: 2 }}>
              <i className="bi bi-check-circle-fill"></i>
            </div>
            <div style={{ fontWeight: 700, color: '#065f46', fontSize: 13, marginBottom: 2 }}>
              Đã Ghi Nhận Thanh Toán Đặt Cọc
            </div>
            <div style={{ fontSize: 12, color: '#047857' }}>
              Lễ tân có thể tiếp tục làm thủ tục Check-in phòng cho khách.
            </div>
          </div>
        ) : (
          <div
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: 8,
              padding: '12px 14px',
              marginBottom: 14,
              textAlign: 'center',
            }}
          >
            <div
              onClick={() => window.open(payUrl, '_blank')}
              title="Bấm vào mã QR để mở Cổng thanh toán VNPay"
              style={{
                display: 'inline-block',
                cursor: 'pointer',
                padding: 6,
                background: '#ffffff',
                borderRadius: 8,
                border: '1px solid #cbd5e1',
                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.04)',
                transition: 'transform 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.02)')}
              onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1.0)')}
            >
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=140x140&margin=3&data=${encodeURIComponent(
                  payUrl
                )}`}
                alt="VNPay QR Code"
                style={{ width: 140, height: 140, display: 'block', borderRadius: 4 }}
              />
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 12, justifyContent: 'center' }}>
              <button
                type="button"
                onClick={() => window.open(payUrl, '_blank')}
                style={{
                  flex: 1,
                  background: '#005baa',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 6,
                  padding: '8px 12px',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                <i className="bi bi-qr-code"></i>
                <span>Cổng VNPay</span>
              </button>
              <button
                type="button"
                onClick={() => onConfirmCash?.(data.reservationCode)}
                disabled={isProcessingCash}
                style={{
                  flex: 1,
                  background: '#16a34a',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 6,
                  padding: '8px 12px',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: isProcessingCash ? 'not-allowed' : 'pointer',
                  opacity: isProcessingCash ? 0.7 : 1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                <i className="bi bi-cash-stack"></i>
                <span>{isProcessingCash ? 'Đang xử lý...' : 'Khách Trả Tiền Mặt'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Nút chân modal */}
        <div style={{ display: 'flex', gap: 10 }}>
          {isPaid ? (
            <>
              <button
                type="button"
                onClick={onClose}
                className="fd-btn fd-btn-secondary"
                style={{ flex: 1, padding: '9px 14px' }}
              >
                Tạo Đơn Mới
              </button>
              <button
                type="button"
                onClick={onProceedCheckIn}
                className="fd-btn fd-btn-primary"
                style={{ flex: 1, padding: '9px 14px' }}
              >
                <i className="bi bi-box-arrow-in-right"></i>
                <span>Tiến Hành Nhận Phòng Ngay</span>
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => onCancelPendingBooking?.(data.reservationCode)}
                className="fd-btn fd-btn-outline-danger"
                style={{ flex: 1, padding: '9px 14px', background: '#fff1f2' }}
              >
                <i className="bi bi-x-circle"></i>
                <span>Hủy Đơn Này (Không cọc)</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="fd-btn fd-btn-secondary"
                style={{ flex: 1, padding: '9px 14px' }}
              >
                Đóng (Chờ cọc)
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

