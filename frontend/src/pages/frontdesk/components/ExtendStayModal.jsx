import { formatDate, formatDateTime } from '../../../lib/datetime';
import { formatVND } from '../../../lib/money';

export const ExtendStayModal = ({
  stay,
  onClose,
  onSubmit,
  newCheckOutDate,
  setNewCheckOutDate,
  extendReason,
  setExtendReason,
  availabilityCheck,
  isExtending,
  getStayRoomPrice,
}) => {
  if (!stay) return null;

  const extraNights =
    stay.checkOutDate && newCheckOutDate && newCheckOutDate > stay.checkOutDate
      ? Math.max(1, Math.round((new Date(newCheckOutDate) - new Date(stay.checkOutDate)) / (1000 * 60 * 60 * 24)))
      : 0;
  const stayUnitPrice = getStayRoomPrice ? getStayRoomPrice(stay) : (Number(stay.roomPrice) || 0);
  const extraRoomCharge = extraNights * stayUnitPrice;
  const currentFolioBalance = stay.folioTotalAmount ? Number(stay.folioTotalAmount) : 0;
  const estimatedNewFolioBalance = currentFolioBalance + extraRoomCharge;
  const isConflict = availabilityCheck.checked && !availabilityCheck.isAvailable;

  return (
    <div className="fd-modal-overlay">
      <div className="fd-modal-dialog" style={{ maxWidth: 560 }}>
        {/* Header */}
        <div className="fd-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                background: '#0284c7',
                color: '#ffffff',
                padding: '2px 8px',
                borderRadius: 4,
              }}
            >
              Gia Hạn Lưu Trú
            </span>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', margin: 0 }}>
              Phòng {stay.roomNumber} — {stay.roomTypeName || 'Tiêu chuẩn'}
            </h3>
          </div>
          <button type="button" onClick={onClose} className="fd-modal-close-btn">
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="fd-modal-body">
          {/* Thông tin lưu trú hiện tại */}
          <div className="fd-info-block">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, color: '#334155' }}>
              <div>Mã Đặt: <strong>#{stay.reservationCode}</strong></div>
              <div>Khách hàng: <strong>{stay.guestName}</strong></div>
              <div>Giờ nhận phòng: {formatDateTime(stay.actualCheckIn)}</div>
              <div>Ngày trả hiện tại: <strong style={{ color: '#0284c7' }}>{formatDate(stay.checkOutDate)}</strong></div>
            </div>
          </div>

          <form onSubmit={onSubmit}>
            {/* Chọn ngày trả phòng mới */}
            <div style={{ marginBottom: 14 }}>
              <label className="fd-label">
                Ngày Trả Phòng Mới (New Check-out Date) *
              </label>
              <input
                type="date"
                required
                min={
                  stay.checkOutDate
                    ? new Date(new Date(stay.checkOutDate).getTime() + 86400000).toISOString().split('T')[0]
                    : ''
                }
                value={newCheckOutDate}
                onChange={(e) => setNewCheckOutDate(e.target.value)}
                className="fd-input"
                style={{ fontSize: 14, fontWeight: 600 }}
              />
            </div>

            {/* Kiểm tra Quota & Cảnh báo Xung đột Overbooking thời gian thực */}
            <div style={{ marginBottom: 14 }}>
              {availabilityCheck.checking && (
                <div style={{ fontSize: 12, color: '#64748b', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span className="spinner-border spinner-border-sm" role="status" style={{ width: 12, height: 12 }}></span>
                  Đang đối soát quỹ phòng trống với máy chủ...
                </div>
              )}

              {!availabilityCheck.checking && isConflict && (
                <div className="fd-alert-box fd-alert-danger">
                  <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <i className="bi bi-exclamation-octagon-fill"></i>
                    Xung Đột Lịch Phòng: Hạng phòng đã kín chỗ (0 phòng trống)!
                  </div>
                  <div>
                    Khách khác đã đặt cọc trước phòng của hạng này trong giai đoạn từ{' '}
                    <strong>{formatDate(stay.checkOutDate)}</strong> đến{' '}
                    <strong>{formatDate(newCheckOutDate)}</strong>. Hệ thống không cho phép gia hạn trực tiếp tại phòng này để tránh Overbooking.
                  </div>
                  <div style={{ marginTop: 6, fontWeight: 600, color: '#b91c1c' }}>
                    👉 Hướng giải quyết: Lễ tân tư vấn khách đổi sang hạng phòng khác còn trống qua chức năng <strong>Đổi Phòng (Room Transfer)</strong>.
                  </div>
                </div>
              )}

              {!availabilityCheck.checking && availabilityCheck.checked && !isConflict && extraNights > 0 && (
                <div className="fd-alert-box fd-alert-success" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <i className="bi bi-check-circle-fill"></i>
                  <span>
                    Quỹ phòng khả dụng: Còn <strong>{availabilityCheck.availableRoomsCount}</strong> phòng trống hạng này. Đủ điều kiện gia hạn thêm <strong>{extraNights} đêm</strong>.
                  </span>
                </div>
              )}
            </div>

            {/* Bảng Kê Chi Tiết Chi Phí Phát Sinh */}
            {extraNights > 0 && (
              <div
                style={{
                  border: '1px solid #e2e8f0',
                  borderRadius: 6,
                  background: '#ffffff',
                  padding: 12,
                  marginBottom: 16,
                  fontSize: 13,
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.04em', marginBottom: 8 }}>
                  Bảng Tính Chi Phí Gia Hạn
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', color: '#475569' }}>
                  <span>Đơn giá phòng ({stay.roomTypeName || 'Hạng phòng'}):</span>
                  <span style={{ fontWeight: 600 }}>{formatVND(stayUnitPrice)} / đêm</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', color: '#475569' }}>
                  <span>Số đêm gia hạn thêm:</span>
                  <span style={{ fontWeight: 600, color: '#0284c7' }}>+ {extraNights} đêm</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', color: '#0f172a', fontWeight: 600 }}>
                  <span>Tiền phòng phát sinh:</span>
                  <span style={{ color: '#0284c7', fontSize: 14 }}>+ {formatVND(extraRoomCharge)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', color: '#64748b', fontSize: 12 }}>
                  <span>Công nợ Folio hiện tại (#{stay.folioId}):</span>
                  <span>{formatVND(currentFolioBalance)}</span>
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '8px 10px',
                    background: '#f8fafc',
                    borderRadius: 4,
                    marginTop: 6,
                    borderTop: '1px dashed #cbd5e1',
                    color: '#0f172a',
                    fontWeight: 700,
                  }}
                >
                  <span>Tổng công nợ Folio sau gia hạn:</span>
                  <span style={{ color: '#0f172a', fontSize: 14 }}>{formatVND(estimatedNewFolioBalance)}</span>
                </div>
              </div>
            )}

            {/* Lý Do / Ghi Chú Gia Hạn */}
            <div style={{ marginBottom: 20 }}>
              <label className="fd-label">
                Lý Do / Ghi Chú Gia Hạn
              </label>
              <textarea
                rows={2}
                value={extendReason}
                onChange={(e) => setExtendReason(e.target.value)}
                placeholder="Ví dụ: Khách gia hạn thêm 1 ngày công tác..."
                className="fd-input"
                style={{ resize: 'none' }}
              />
            </div>

            {/* Nút hành động */}
            <div className="fd-modal-footer" style={{ padding: 0, border: 'none' }}>
              <button
                type="button"
                onClick={onClose}
                className="fd-btn fd-btn-secondary"
              >
                Hủy bỏ
              </button>
              <button
                type="submit"
                disabled={
                  isExtending ||
                  !newCheckOutDate ||
                  (stay.checkOutDate && newCheckOutDate <= stay.checkOutDate) ||
                  isConflict
                }
                title={isConflict ? 'Không thể gia hạn do hạng phòng đã kín chỗ' : undefined}
                className="fd-btn fd-btn-primary"
                style={{ background: '#0284c7' }}
              >
                {isExtending ? 'Đang xử lý...' : 'Xác Nhận Gia Hạn'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

