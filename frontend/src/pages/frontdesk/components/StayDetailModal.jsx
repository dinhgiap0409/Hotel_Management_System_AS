import { formatDateTime, formatDate } from '../../../lib/datetime';
import { formatVND } from '../../../lib/money';

export const StayDetailModal = ({
  data,
  onClose,
  onTransferRoom,
  onExtendStay,
  onCheckOut,
}) => {
  if (!data) return null;

  const { stay, booking, roomType } = data;
  const currentPrice = stay.roomPrice || roomType?.basePrice || 0;
  const folioAmount = Number(stay.folioTotalAmount || 0);

  return (
    <div className="fd-modal-overlay">
      <div className="fd-modal-dialog" style={{ maxWidth: 620, maxHeight: '90vh' }}>
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
              Phòng {stay.roomNumber}
            </span>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', margin: 0 }}>
              Hồ Sơ Chi Tiết Lưu Trú
            </h3>
          </div>
          <button type="button" onClick={onClose} className="fd-modal-close-btn">
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="fd-modal-body">
          {/* Khối 1: Thông tin phòng & Lưu trú */}
          <div className="fd-info-block">
            <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.04em', marginBottom: 8 }}>
              Thông Tin Phòng & Thời Gian Lưu Trú
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 13, color: '#334155' }}>
              <div>Số phòng: <strong style={{ color: '#0f172a' }}>Phòng {stay.roomNumber}</strong></div>
              <div>Hạng phòng: <strong>{stay.roomTypeName || roomType?.typeName || 'Tiêu chuẩn'}</strong></div>
              <div>Đơn giá phòng: <strong>{formatVND(currentPrice)} / đêm</strong></div>
              <div>Mã lưu trú: <strong style={{ fontFamily: 'monospace' }}>#{stay.stayId}</strong></div>
              <div>Ngày nhận: <strong>{formatDate(stay.checkInDate)}</strong></div>
              <div>Ngày trả dự kiến: <strong style={{ color: '#0284c7' }}>{formatDate(stay.checkOutDate)}</strong></div>
              <div style={{ gridColumn: 'span 2' }}>
                Giờ check-in thực tế: <strong>{formatDateTime(stay.actualCheckIn)}</strong>
              </div>
            </div>
          </div>

          {/* Khối 2: Thông tin khách hàng & Đơn đặt */}
          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 6, padding: 14, marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.04em', marginBottom: 8 }}>
              Khách Hàng & Liên Hệ
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 13, color: '#334155' }}>
              <div>Họ tên khách: <strong style={{ color: '#0f172a' }}>{stay.guestName}</strong></div>
              <div>CCCD / Passport: <strong>{stay.guestIdNumber || 'Chưa cung cấp'}</strong></div>
              <div>Số điện thoại: <strong>{booking?.contactPhone || '—'}</strong></div>
              <div>Email: <strong>{booking?.contactEmail || '—'}</strong></div>
              <div>Mã đặt phòng: <strong style={{ fontFamily: 'monospace' }}>#{stay.reservationCode}</strong></div>
              <div>Số khách đăng ký: <strong>{booking?.guestCount || 2} khách</strong></div>
            </div>
          </div>

          {/* Khối 3: Tài chính & Folio */}
          <div className="fd-info-block">
            <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.04em', marginBottom: 8 }}>
              Dư Nợ Folio
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 13, color: '#475569' }}>Mã tài khoản Folio:</span>
              <strong style={{ fontFamily: 'monospace', fontSize: 13 }}>#{stay.folioId || 'N/A'}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 13, color: '#475569' }}>Dư nợ Folio:</span>
              <span style={{ fontSize: 15, fontWeight: 700, color: folioAmount > 0 ? '#b91c1c' : '#166534' }}>
                {formatVND(folioAmount)}
              </span>
            </div>
            <div style={{ fontSize: 12, color: folioAmount > 0 ? '#b45309' : '#166534', marginTop: 4 }}>
              {folioAmount > 0
                ? '• Đang có công nợ cần quyết toán trước khi trả phòng.'
                : '✓ Đã thanh toán đầy đủ (Đủ điều kiện hoàn tất thủ tục trả phòng).'}
            </div>
          </div>

          {/* Khối 4: Lịch sử ghi chú & chuyển phòng */}
          {booking?.specialNotes && (
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 6, padding: 12, marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.04em', marginBottom: 4 }}>
                Lịch Sử Lưu Trú & Ghi Chú
              </div>
              <div style={{ fontSize: 12.5, color: '#334155', lineHeight: 1.5 }}>
                {booking.specialNotes}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="fd-modal-footer" style={{ justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            {onTransferRoom && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onTransferRoom(stay);
                }}
                className="fd-btn fd-btn-secondary"
                style={{ fontSize: 12, padding: '6px 12px' }}
                title="Đổi phòng"
              >
                <i className="bi bi-arrow-left-right"></i>
                <span>Đổi phòng</span>
              </button>
            )}
            {onExtendStay && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onExtendStay(stay);
                }}
                className="fd-btn fd-btn-secondary"
                style={{ fontSize: 12, padding: '6px 12px', color: '#0284c7', borderColor: '#bae6fd' }}
                title="Gia hạn lưu trú"
              >
                <i className="bi bi-calendar-plus"></i>
                <span>Gia hạn</span>
              </button>
            )}
            {onCheckOut && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onCheckOut(stay);
                }}
                className="fd-btn fd-btn-outline-danger"
                style={{ fontSize: 12, padding: '6px 12px' }}
                title="Làm thủ tục trả phòng"
              >
                <i className="bi bi-box-arrow-right"></i>
                <span>Trả phòng</span>
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="fd-btn fd-btn-primary"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};

