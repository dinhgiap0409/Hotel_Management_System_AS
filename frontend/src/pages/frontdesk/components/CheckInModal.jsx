import { formatDate } from '../../../lib/datetime';
import { formatVND } from '../../../lib/money';

export const CheckInModal = ({
  data,
  onClose,
  isLoadingRooms,
  checkInCategories,
  checkInSlots,
  availableRoomsByType,
  activeCheckingInSlotId,
  handleCheckInSingleSlot,
  handleSlotRoomChange,
  updateSlotField,
  handleCheckInAllSlots,
  isCheckingIn,
  checkInDepositAmount,
  setCheckInDepositAmount,
  checkInDepositMethod,
  setCheckInDepositMethod,
  checkInSavedCCCD,
  setCheckInSavedCCCD,
  checkInIncludeBreakfast,
  setCheckInIncludeBreakfast,
  checkInStaffNotes,
  setCheckInStaffNotes,
}) => {
  if (!data) return null;

  return (
    <div className="fd-modal-overlay">
      <div
        className="fd-modal-dialog"
        style={{
          maxWidth: 1040,
          maxHeight: '92vh',
        }}
      >
        {/* Header bar */}
        <div className="fd-modal-header" style={{ padding: '16px 24px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  background: '#0f172a',
                  color: '#ffffff',
                  padding: '2px 8px',
                  borderRadius: 4,
                }}
              >
                Check-in
              </span>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', margin: 0 }}>
                Thủ Tục Nhận Phòng — Mã Đặt: #{data.reservationCode}
              </h3>
              {data.checkedInRoomsCount > 0 && (
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: '#0284c7',
                    background: '#e0f2fe',
                    padding: '2px 8px',
                    borderRadius: 4,
                  }}
                >
                  Đang nhận dở ({data.checkedInRoomsCount}/{data.totalBookedRoomsCount || data.roomQuantity || 1} phòng)
                </span>
              )}
            </div>
            <div style={{ fontSize: 13, color: '#64748b', display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              <span>Khách chính: <strong style={{ color: '#0f172a' }}>{data.contactName}</strong> ({data.contactPhone})</span>
              <span>•</span>
              <span>Thời gian: <strong style={{ color: '#0f172a' }}>{formatDate(data.checkInDate)} → {formatDate(data.checkOutDate)}</strong> ({data.nights || 1} đêm)</span>
              <span>•</span>
              <span>Sức chứa: <strong>{data.guestCount || 2} khách</strong></span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="fd-modal-close-btn"
            style={{ fontSize: 20 }}
          >
            ✕
          </button>
        </div>

        {/* Modal Body: 2 Columns (68% / 32%) */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1.9fr) minmax(300px, 1.1fr)',
            gap: 20,
            padding: 24,
            overflowY: 'auto',
            flex: 1,
          }}
        >
          {/* CỘT TRÁI (68%): PHÂN BỔ PHÒNG & KHÁCH Ở CÁC PHÒNG */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h4 style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Phân Bổ Phòng Vật Lý & Khách Lưu Trú
              </h4>
              <span style={{ fontSize: 12, color: '#64748b' }}>
                Chỉ chọn các phòng Trống và Sạch (Clean/Inspected)
              </span>
            </div>

            {isLoadingRooms ? (
              <div style={{ padding: '40px 16px', textAlign: 'center', color: '#64748b', background: '#f8fafc', borderRadius: 6 }}>
                Đang tra cứu danh sách phòng vật lý trống sạch...
              </div>
            ) : checkInSlots.length === 0 ? (
              <div style={{ padding: '24px 16px', textAlign: 'center', color: '#64748b', background: '#f8fafc', borderRadius: 6 }}>
                Không tìm thấy danh sách phòng cho đơn đặt này.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {checkInCategories.map((category) => {
                  const categorySlots = checkInSlots.filter((s) => s.roomTypeId === category.roomTypeId);
                  const typeRooms = availableRoomsByType[category.roomTypeId] || [];
                  const isAllCheckedIn = category.pendingCount === 0;

                  return (
                    <div
                      key={category.roomTypeId}
                      style={{
                        border: `1px solid ${isAllCheckedIn ? '#bbf7d0' : '#cbd5e1'}`,
                        borderRadius: 8,
                        overflow: 'hidden',
                        background: isAllCheckedIn ? '#f0fdf4' : '#f8fafc',
                      }}
                    >
                      {/* Category Header */}
                      <div
                        style={{
                          background: isAllCheckedIn ? '#166534' : '#0f172a',
                          color: '#ffffff',
                          padding: '10px 16px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: 8,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                          <i className="bi bi-door-open-fill" style={{ fontSize: 16 }}></i>
                          <span style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                            Hạng phòng: {category.roomTypeName}
                          </span>
                          <span
                            style={{
                              fontSize: 12,
                              fontWeight: 600,
                              color: isAllCheckedIn ? '#166534' : '#0f172a',
                              background: '#ffffff',
                              padding: '2px 8px',
                              borderRadius: 4,
                            }}
                          >
                            Đã nhận: {category.checkedInCount}/{category.totalQty} phòng
                          </span>
                          {category.pendingCount > 0 && (
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 600,
                                color: '#fef08a',
                                background: 'rgba(255,255,255,0.15)',
                                padding: '2px 8px',
                                borderRadius: 4,
                              }}
                            >
                              Còn lại: {category.pendingCount} phòng cần nhận
                            </span>
                          )}
                        </div>
                        {category.unitPrice && (
                          <span style={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0' }}>
                            {formatVND(category.unitPrice)} / đêm
                          </span>
                        )}
                      </div>

                      {/* Slots list for this Category */}
                      <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {category.checkedInCount > 0 && (
                          <div
                            style={{
                              background: '#dcfce7',
                              border: '1px solid #86efac',
                              borderRadius: 6,
                              padding: '8px 12px',
                              fontSize: 12,
                              color: '#15803d',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                            }}
                          >
                            <i className="bi bi-check-circle-fill"></i>
                            <span>
                              <strong>Phòng đã nhận ({category.checkedInCount} phòng):</strong>{' '}
                              {category.checkedInRoomNumbers.map((rn) => `Phòng ${rn}`).join(', ')}
                            </span>
                          </div>
                        )}

                        {isAllCheckedIn ? (
                          <div style={{ fontSize: 13, color: '#166534', fontWeight: 500, padding: '4px 0' }}>
                            ✓ Hạng phòng này đã hoàn tất nhận toàn bộ {category.totalQty} phòng. Không còn phòng nào chờ nhận.
                          </div>
                        ) : (
                          categorySlots.map((slot) => {
                            const assignedOtherRoomIds = new Set(
                              checkInSlots
                                .filter((s) => s.slotId !== slot.slotId && s.selectedRoomId)
                                .map((s) => Number(s.selectedRoomId))
                            );
                            const filteredTypeRooms = typeRooms.filter(
                              (r) => !assignedOtherRoomIds.has(r.roomId) || r.roomId === Number(slot.selectedRoomId)
                            );

                            return (
                              <div
                                key={slot.slotId}
                                style={{
                                  background: '#ffffff',
                                  border: '1px solid #e2e8f0',
                                  borderRadius: 6,
                                  padding: 14,
                                  boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                                }}
                              >
                                {/* Slot Header */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span
                                      style={{
                                        fontSize: 12,
                                        fontWeight: 700,
                                        color: '#0f172a',
                                        background: '#f1f5f9',
                                        padding: '2px 8px',
                                        borderRadius: 4,
                                      }}
                                    >
                                      Phòng {slot.slotIndex}/{slot.totalSlotsForType}
                                    </span>
                                    <span style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>
                                      Cần nhận: {slot.roomTypeName}
                                    </span>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() => handleCheckInSingleSlot(slot)}
                                    disabled={activeCheckingInSlotId === slot.slotId || isCheckingIn || !slot.selectedRoomId}
                                    className="fd-btn fd-btn-primary"
                                    style={{ fontSize: 12, padding: '5px 12px' }}
                                  >
                                    {activeCheckingInSlotId === slot.slotId ? 'Đang check-in...' : 'Check-in Phòng Này'}
                                  </button>
                                </div>

                                {/* Slot Form Fields */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                                  <div>
                                    <label className="fd-label" style={{ fontSize: 11, marginBottom: 4 }}>
                                      Gán Phòng Vật Lý * (Chỉ hiện phòng {category.roomTypeName})
                                    </label>
                                    {filteredTypeRooms.length === 0 ? (
                                      <div style={{ fontSize: 12, color: '#ef4444', padding: '6px 0' }}>
                                        Hết phòng sạch trống cho {category.roomTypeName}
                                      </div>
                                    ) : (
                                      <select
                                        value={slot.selectedRoomId}
                                        onChange={(e) => handleSlotRoomChange(slot.slotId, e.target.value)}
                                        className="fd-select"
                                      >
                                        {filteredTypeRooms.map((r) => (
                                          <option key={r.roomId} value={r.roomId}>
                                            Phòng {r.roomNumber} (Tầng {r.floor} • {r.cleaningStatus})
                                          </option>
                                        ))}
                                      </select>
                                    )}
                                  </div>

                                  <div>
                                    <label className="fd-label" style={{ fontSize: 11, marginBottom: 4 }}>
                                      Mã Thẻ Từ (Keycard)
                                    </label>
                                    <input
                                      type="text"
                                      value={slot.keyCardNumber}
                                      onChange={(e) => updateSlotField(slot.slotId, 'keyCardNumber', e.target.value)}
                                      placeholder="Ví dụ: CARD-101"
                                      className="fd-input"
                                    />
                                  </div>

                                  <div>
                                    <label className="fd-label" style={{ fontSize: 11, marginBottom: 4 }}>
                                      Khách Đại Diện Ở Phòng Này
                                    </label>
                                    <input
                                      type="text"
                                      value={slot.guestName}
                                      onChange={(e) => updateSlotField(slot.slotId, 'guestName', e.target.value)}
                                      placeholder="Họ và tên khách"
                                      className="fd-input"
                                    />
                                  </div>

                                  <div>
                                    <label className="fd-label" style={{ fontSize: 11, marginBottom: 4 }}>
                                      Số CCCD / Passport *
                                    </label>
                                    <input
                                      type="text"
                                      value={slot.guestIdNumber}
                                      onChange={(e) => updateSlotField(slot.slotId, 'guestIdNumber', e.target.value)}
                                      placeholder="Nhập số CCCD/Passport"
                                      className="fd-input"
                                    />
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* CỘT PHẢI (32%): TÀI CHÍNH, TIỆN ÍCH & NÚT HOÀN TẤT */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Khối 1: Thông tin thanh toán */}
            <div className="fd-info-block" style={{ padding: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 12 }}>
                Thông Tin Thanh Toán
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13, color: '#334155' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Tổng tiền phòng:</span>
                  <strong style={{ color: '#0f172a' }}>{formatVND(data.estimatedTotal || 0)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Đã thanh toán / cọc:</span>
                  <span style={{ color: '#16a34a', fontWeight: 600 }}>{formatVND(data.depositAmount || 0)}</span>
                </div>
                <div style={{ borderTop: '1px dashed #cbd5e1', paddingTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontWeight: 600, color: '#475569' }}>Còn phải thu:</span>
                  <strong style={{ fontSize: 15, color: '#0f172a' }}>
                    {formatVND(Math.max(0, (data.estimatedTotal || 0) - (data.depositAmount || 0)))}
                  </strong>
                </div>
              </div>
            </div>

            {/* Khối 2: Đặt cọc / Ký quỹ (Deposit) */}
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 6, padding: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>
                Đặt Cọc / Ký Quỹ (Deposit)
              </div>
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 10 }}>
                Bảo đảm minibar, giặt là và thẻ từ khi bàn giao phòng.
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 10 }}>
                <div>
                  <label className="fd-label" style={{ fontSize: 11, marginBottom: 4 }}>
                    Tiền Cọc (VNĐ)
                  </label>
                  <input
                    type="number"
                    value={checkInDepositAmount}
                    onChange={(e) => setCheckInDepositAmount(e.target.value)}
                    placeholder="500000"
                    className="fd-input"
                  />
                </div>
                <div>
                  <label className="fd-label" style={{ fontSize: 11, marginBottom: 4 }}>
                    Hình Thức
                  </label>
                  <select
                    value={checkInDepositMethod}
                    onChange={(e) => setCheckInDepositMethod(e.target.value)}
                    className="fd-select"
                  >
                    <option value="CASH">Tiền mặt</option>
                    <option value="CARD">Quẹt thẻ POS</option>
                    <option value="TRANSFER">Chuyển khoản QR</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Khối 3: Tiện ích Check-in & Ghi chú */}
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 6, padding: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 10 }}>
                Thủ Tục Kèm Theo & Ghi Chú
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13, color: '#334155', marginBottom: 12 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={checkInSavedCCCD}
                    onChange={(e) => setCheckInSavedCCCD(e.target.checked)}
                  />
                  <span>Đã chụp & lưu bản sao CCCD/Passport</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={checkInIncludeBreakfast}
                    onChange={(e) => setCheckInIncludeBreakfast(e.target.checked)}
                  />
                  <span>Kèm phiếu ăn sáng ({data.guestCount || 2} suất)</span>
                </label>
              </div>

              <div>
                <label className="fd-label" style={{ fontSize: 11, marginBottom: 4 }}>
                  Ghi Chú Ca Trực Lễ Tân
                </label>
                <textarea
                  rows={2}
                  value={checkInStaffNotes}
                  onChange={(e) => setCheckInStaffNotes(e.target.value)}
                  placeholder="Ghi chú ca trực, yêu cầu của khách..."
                  className="fd-input"
                  style={{ resize: 'none' }}
                />
              </div>
            </div>

            {/* Bottom Action: Hoàn tất nhận tất cả các phòng */}
            <div style={{ marginTop: 'auto', paddingTop: 8 }}>
              <button
                type="button"
                onClick={handleCheckInAllSlots}
                disabled={isCheckingIn || checkInSlots.length === 0}
                className="fd-btn fd-btn-primary"
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  fontSize: 14,
                  boxShadow: '0 2px 4px rgba(15,23,42,0.15)',
                }}
              >
                {isCheckingIn
                  ? 'Đang hoàn tất nhận phòng...'
                  : checkInSlots.length === 0
                    ? 'Đã nhận đủ toàn bộ phòng'
                    : `Hoàn Tất Check-in (${checkInSlots.length} phòng còn lại)`}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

