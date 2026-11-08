import { formatVND } from '../../../lib/money';

export const RoomTransferModal = ({
  stay,
  onClose,
  onSubmit,
  transferAvailableRooms,
  isLoadingTransferRooms,
  transferTargetRoomId,
  setTransferTargetRoomId,
  transferReason,
  setTransferReason,
  transferAdditionalCharge,
  setTransferAdditionalCharge,
  isTransferring,
  getStayRoomPrice,
}) => {
  if (!stay) return null;

  const selectedTargetRoom = transferAvailableRooms.find((r) => r.roomId === Number(transferTargetRoomId));
  const currentRoomPrice = getStayRoomPrice ? getStayRoomPrice(stay) : (Number(stay.roomPrice) || 0);
  const targetRoomPrice = selectedTargetRoom?.basePrice ? Number(selectedTargetRoom.basePrice) : 0;
  const priceDiff = selectedTargetRoom ? Math.max(0, targetRoomPrice - currentRoomPrice) : 0;
  const quickReasons = [
    'Sự cố thiết bị / điều hòa',
    'Khách phàn nàn tiếng ồn',
    'Khách yêu cầu đổi loại giường',
    'Nâng hạng dịch vụ (Room Upgrade)',
    'Yêu cầu phòng tầng cao hơn',
  ];

  return (
    <div className="fd-modal-overlay">
      <div className="fd-modal-dialog" style={{ maxWidth: 580, maxHeight: '90vh' }}>
        {/* Header */}
        <div className="fd-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                background: '#475569',
                color: '#ffffff',
                padding: '2px 8px',
                borderRadius: 4,
              }}
            >
              Đổi Phòng
            </span>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', margin: 0 }}>
              Thủ Tục Chuyển Phòng
            </h3>
          </div>
          <button type="button" onClick={onClose} className="fd-modal-close-btn">
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="fd-modal-body">
          {/* Thông tin phòng hiện tại */}
          <div className="fd-info-block">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, color: '#334155' }}>
              <div>Phòng hiện tại: <strong style={{ color: '#0f172a' }}>Phòng {stay.roomNumber}</strong></div>
              <div>Hạng phòng: <strong>{stay.roomTypeName || 'Tiêu chuẩn'}</strong></div>
              <div>Khách hàng: <strong>{stay.guestName}</strong></div>
              <div>Mã đặt phòng: <strong style={{ fontFamily: 'monospace' }}>#{stay.reservationCode}</strong></div>
            </div>
          </div>

          <form onSubmit={onSubmit}>
            {/* Chọn phòng mới */}
            <div style={{ marginBottom: 14 }}>
              <label className="fd-label">
                Phòng Mới Chuyển Đến *
              </label>
              {isLoadingTransferRooms ? (
                <div style={{ fontSize: 13, color: '#64748b', fontStyle: 'italic', padding: 8 }}>
                  Đang tải danh sách phòng khả dụng...
                </div>
              ) : transferAvailableRooms.length === 0 ? (
                <div className="fd-alert-box fd-alert-danger" style={{ marginBottom: 0 }}>
                  ⚠️ Hiện không có phòng trống và sạch nào khả dụng để chuyển.
                </div>
              ) : (
                <select
                  required
                  value={transferTargetRoomId}
                  onChange={(e) => {
                    const rId = e.target.value;
                    setTransferTargetRoomId(rId);
                    const sel = transferAvailableRooms.find((r) => r.roomId === Number(rId));
                    if (sel && sel.basePrice && currentRoomPrice && Number(sel.basePrice) > currentRoomPrice) {
                      setTransferAdditionalCharge(Number(sel.basePrice) - currentRoomPrice);
                    } else {
                      setTransferAdditionalCharge(0);
                    }
                  }}
                  className="fd-select"
                >
                  <option value="">-- Chọn phòng mới chuyển đến ({transferAvailableRooms.length} phòng khả dụng) --</option>
                  {transferAvailableRooms.map((r) => (
                    <option key={r.roomId} value={r.roomId}>
                      Phòng {r.roomNumber} (Tầng {r.floor}) • {r.roomTypeName} — {formatVND(r.basePrice || 0)}/đêm
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Khối so sánh phòng & Chênh lệch */}
            {selectedTargetRoom && (
              <div
                style={{
                  border: '1px solid #e2e8f0',
                  borderRadius: 6,
                  background: '#f8fafc',
                  padding: 12,
                  marginBottom: 14,
                  fontSize: 12.5,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ color: '#64748b' }}>Phòng cũ:</span>
                  <strong>Phòng {stay.roomNumber} ({formatVND(currentRoomPrice)}/đêm)</strong>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ color: '#64748b' }}>Phòng mới:</span>
                  <strong style={{ color: '#0284c7' }}>
                    Phòng {selectedTargetRoom.roomNumber} ({formatVND(selectedTargetRoom.basePrice || 0)}/đêm)
                  </strong>
                </div>
                {priceDiff > 0 ? (
                  <div style={{ color: '#b45309', fontSize: 12, marginTop: 4, fontWeight: 500 }}>
                    ★ Nâng hạng phòng: Đơn giá phòng mới cao hơn +{formatVND(priceDiff)}/đêm.
                  </div>
                ) : (
                  <div style={{ color: '#166534', fontSize: 12, marginTop: 4, fontWeight: 500 }}>
                    ✓ Chuyển phòng ngang hạng (Cùng đơn giá hoặc thấp hơn).
                  </div>
                )}
              </div>
            )}

            {/* Phụ thu đổi phòng / nâng hạng */}
            <div style={{ marginBottom: 14 }}>
              <label className="fd-label">
                Phụ Thu Đổi Phòng / Nâng Hạng
              </label>
              <input
                type="text"
                readOnly
                value={formatVND(transferAdditionalCharge)}
                className="fd-input"
                style={{
                  color: transferAdditionalCharge > 0 ? '#0284c7' : '#0f172a',
                  fontWeight: 600,
                  background: '#f8fafc',
                  cursor: 'not-allowed',
                }}
              />
              <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 4 }}>
                Số tiền phụ thu sẽ được ghi nhận trực tiếp vào Folio của khách.
              </div>
            </div>

            {/* Lý do đổi phòng */}
            <div style={{ marginBottom: 20 }}>
              <label className="fd-label">
                Lý Do Đổi Phòng *
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                {quickReasons.map((reason) => (
                  <button
                    key={reason}
                    type="button"
                    onClick={() => setTransferReason(reason)}
                    style={{
                      background: transferReason === reason ? '#0f172a' : '#f1f5f9',
                      color: transferReason === reason ? '#ffffff' : '#475569',
                      border: 'none',
                      borderRadius: 4,
                      padding: '3px 8px',
                      fontSize: 11,
                      fontWeight: 500,
                      cursor: 'pointer',
                    }}
                  >
                    {reason}
                  </button>
                ))}
              </div>
              <textarea
                required
                rows={2}
                value={transferReason}
                onChange={(e) => setTransferReason(e.target.value)}
                placeholder="Mô tả nguyên nhân chuyển phòng..."
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
                disabled={isTransferring || !transferTargetRoomId || !transferReason.trim()}
                className="fd-btn fd-btn-primary"
              >
                {isTransferring ? 'Đang xử lý...' : 'Xác Nhận Đổi Phòng'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

