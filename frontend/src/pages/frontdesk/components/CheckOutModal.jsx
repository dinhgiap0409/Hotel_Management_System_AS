import { formatDateTime } from '../../../lib/datetime';
import { formatVND } from '../../../lib/money';

export const CheckOutModal = ({
  stay,
  onClose,
  onConfirm,
  isCheckingOut,
}) => {
  if (!stay) return null;

  const hasDebt = Number(stay.folioTotalAmount || 0) > 0;

  return (
    <div className="fd-modal-overlay">
      <div className="fd-modal-dialog" style={{ maxWidth: 520 }}>
        {/* Header */}
        <div className="fd-modal-header">
          <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', margin: 0 }}>
            Thủ Tục Trả Phòng — Phòng {stay.roomNumber}
          </h3>
          <button type="button" onClick={onClose} className="fd-modal-close-btn">
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="fd-modal-body">
          <div className="fd-info-block">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, color: '#334155' }}>
              <div>Mã Đặt: <strong>{stay.reservationCode}</strong></div>
              <div>Khách hàng: <strong>{stay.guestName}</strong></div>
              <div>Nhận phòng lúc: {formatDateTime(stay.actualCheckIn)}</div>
              <div>Mã Folio: <strong>#{stay.folioId || 'N/A'}</strong></div>
            </div>

            {Number(stay.depositPaid || 0) > 0 && (
              <div style={{ borderTop: '1px dashed #e2e8f0', marginTop: 10, paddingTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: '#16a34a', fontWeight: 600 }}>
                  <i className="bi bi-shield-check me-1"></i> Đã khấu trừ tiền cọc:
                </span>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#16a34a' }}>
                  - {formatVND(stay.depositPaid)}
                </span>
              </div>
            )}

            <div style={{ borderTop: '1px solid #e2e8f0', marginTop: 10, paddingTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#475569' }}>Dư nợ Folio còn lại phải thanh toán:</span>
              <span style={{ fontSize: 18, fontWeight: 700, color: hasDebt ? '#b91c1c' : '#16a34a' }}>
                {formatVND(stay.folioTotalAmount || 0)}
              </span>
            </div>
          </div>

          {hasDebt ? (
            <div className="fd-alert-box fd-alert-warning">
              <div style={{ fontWeight: 700, marginBottom: 4 }}>
                ⚠️ Chưa Thể Hoàn Tất Trả Phòng
              </div>
              <div>
                Phòng này còn khoản chưa thanh toán <strong>{formatVND(stay.folioTotalAmount)}</strong>. Vui lòng thanh toán hóa đơn để số dư về 0 VND trước khi hoàn tất thủ tục trả phòng.
              </div>
            </div>
          ) : (
            <div className="fd-alert-box fd-alert-success">
              <div style={{ fontWeight: 700, marginBottom: 4 }}>
                ✓ Đã hoàn tất thanh toán (0 VND)
              </div>
              <div>
                Đủ điều kiện trả phòng. Sau khi xác nhận, phòng <strong>{stay.roomNumber}</strong> sẽ được chuyển sang trạng thái <strong>Chờ dọn dẹp</strong> để bàn giao cho bộ phận Buồng phòng.
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="fd-modal-footer">
          <button
            type="button"
            onClick={onClose}
            className="fd-btn fd-btn-secondary"
          >
            Đóng
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isCheckingOut || hasDebt}
            className="fd-btn fd-btn-primary"
          >
            {isCheckingOut ? 'Đang xử lý...' : 'Xác Nhận Trả Phòng'}
          </button>
        </div>
      </div>
    </div>
  );
};

