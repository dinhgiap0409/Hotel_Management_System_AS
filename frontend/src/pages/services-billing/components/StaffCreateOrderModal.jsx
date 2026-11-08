import { formatVND } from '../../../lib/money';
import { notifyToast } from '../../../lib/http';
import { inputStyle, labelStyle } from './serviceUtils';

export const StaffCreateOrderModal = ({
  show,
  onClose,
  onSubmit,
  orderForm,
  setOrderForm,
  selectedStay,
  preOrdersForSelectedStay,
  setDetailModalData,
  canComplete,
  handleOpenQuickLoadAndCompleteConfirm,
  handleCancelPreOrderInStay,
  roomSearchKeyword,
  setRoomSearchKeyword,
  matchingStays,
  activeStays,
  services,
  selectedServiceForOrder,
  estimatedOrderTotal,
  busy,
}) => {
  if (!show) return null;

  return (
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
    >
      <div
        style={{
          background: '#fff',
          padding: 24,
          borderRadius: 12,
          width: '100%',
          maxWidth: 480,
          boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0, color: '#0f172a', fontSize: 18 }}>Ghi Nhận Đơn Gọi Dịch Vụ Phòng</h3>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#94a3b8' }}
          >
            &times;
          </button>
        </div>

        <form onSubmit={onSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Phòng Đang Lưu Trú Của Khách *</label>

            {/* Nếu đã chọn phòng: Hiển thị Thẻ Xác Nhận */}
            {selectedStay ? (
              <>
                <div
                  style={{
                    background: '#f0f9ff',
                    border: '1.5px solid #0284c7',
                    borderRadius: 8,
                    padding: '10px 14px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span
                        style={{
                          background: '#0284c7',
                          color: '#fff',
                          fontWeight: 700,
                          fontSize: 13,
                          padding: '3px 8px',
                          borderRadius: 4,
                        }}
                      >
                        Phòng {selectedStay.roomNumber}
                      </span>
                      <strong style={{ color: '#0f172a', fontSize: 14 }}>
                        {selectedStay.guestName}
                      </strong>
                    </div>
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                      Mã đặt: <code>{selectedStay.reservationCode || 'N/A'}</code> • Stay #{selectedStay.stayId}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOrderForm({ ...orderForm, stayId: '' })}
                    style={{
                      background: '#fee2e2',
                      color: '#dc2626',
                      border: '1px solid #fecaca',
                      borderRadius: 6,
                      padding: '5px 10px',
                      fontSize: 12,
                      cursor: 'pointer',
                      fontWeight: 600,
                    }}
                  >
                    ✕ Đổi phòng
                  </button>
                </div>

                {/* Banner Yêu cầu Đặt Trước từ Lịch Trình của Khách */}
                {preOrdersForSelectedStay.length > 0 && (() => {
                  const allHandled = preOrdersForSelectedStay.every((po) => po.orderStatus === 'COMPLETED' || po.orderStatus === 'ORDERED');
                  return (
                    <div
                      style={{
                        marginTop: 10,
                        background: allHandled ? '#f0fdf4' : '#fffbeb',
                        border: `1px solid ${allHandled ? '#bbf7d0' : '#fde68a'}`,
                        borderRadius: 8,
                        padding: '10px 12px',
                      }}
                    >
                      <div
                        style={{
                          fontWeight: 700,
                          color: allHandled ? '#166534' : '#92400e',
                          fontSize: 12.5,
                          marginBottom: 6,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        <span>
                          {allHandled
                            ? `Toàn bộ ${preOrdersForSelectedStay.length} dịch vụ đặt trước đã được tính vào tiền phòng (Đã hoàn tất):`
                            : `Khách có yêu cầu đặt trước dịch vụ (${preOrdersForSelectedStay.length}):`}
                        </span>
                      </div>
                      {preOrdersForSelectedStay.map((po, idx) => {
                        const isCompleted = po.orderStatus === 'COMPLETED';
                        const isOrdered = po.orderStatus === 'ORDERED';
                        const notCreated = po.orderStatus === 'NOT_CREATED';

                        return (
                          <div
                            key={idx}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              padding: '8px 0',
                              borderTop: idx > 0 ? `1px dashed ${allHandled ? '#bbf7d0' : '#fcd34d'}` : 'none',
                              fontSize: 12,
                            }}
                          >
                            <div style={{ flex: 1, marginRight: 8 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                <strong style={{ color: allHandled ? '#14532d' : '#78350f' }}>{po.serviceName}</strong>
                                <span style={{ color: allHandled ? '#166534' : '#92400e', fontWeight: 600 }}>(SL: {po.quantity})</span>
                                {isCompleted && (
                                  <span
                                    style={{
                                      background: '#dcfce7',
                                      color: '#166534',
                                      fontSize: 11,
                                      fontWeight: 700,
                                      padding: '1px 6px',
                                      borderRadius: 4,
                                    }}
                                  >
                                    Đã tính vào tiền phòng (Đơn #{po.orderId})
                                  </span>
                                )}
                                {isOrdered && (
                                  <span
                                    style={{
                                      background: '#fef3c7',
                                      color: '#b45309',
                                      fontSize: 11,
                                      fontWeight: 700,
                                      padding: '1px 6px',
                                      borderRadius: 4,
                                    }}
                                  >
                                    Đang phục vụ (Đơn #{po.orderId})
                                  </span>
                                )}
                                {notCreated && (
                                  <span
                                    style={{
                                      background: '#fef3c7',
                                      color: '#92400e',
                                      border: '1px solid #fde68a',
                                      fontSize: 11,
                                      fontWeight: 700,
                                      padding: '1px 6px',
                                      borderRadius: 4,
                                    }}
                                  >
                                    Chờ tính vào tiền phòng
                                  </span>
                                )}
                              </div>
                              {(po.scheduledTime || (po.details && po.details !== 'Không')) && (
                                <div style={{ display: 'flex', gap: 6, fontSize: 11.5, marginTop: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                                  {po.scheduledTime && (
                                    <span
                                      style={{
                                        background: '#fffbeb',
                                        color: '#b45309',
                                        border: '1px solid #fde68a',
                                        padding: '1px 6px',
                                        borderRadius: 4,
                                        fontWeight: 600,
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 3,
                                      }}
                                    >
                                      <span style={{ color: '#92400e', fontSize: 10.5, fontWeight: 700 }}>Hẹn:</span>
                                      <strong>{po.scheduledTime}</strong>
                                    </span>
                                  )}
                                  {po.details && po.details !== 'Không' && (
                                    <span
                                      style={{
                                        background: '#f8fafc',
                                        color: '#334155',
                                        border: '1px solid #e2e8f0',
                                        padding: '1px 6px',
                                        borderRadius: 4,
                                        fontWeight: 500,
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 3,
                                      }}
                                    >
                                      <span style={{ color: '#64748b', fontSize: 10.5, fontWeight: 700 }}>Ghi chú:</span>
                                      <strong style={{ color: '#0f172a' }}>{po.details}</strong>
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                              <button
                                type="button"
                                onClick={() =>
                                  setDetailModalData({
                                    type: 'PRE_ORDER',
                                    reservation: {
                                      reservationId: selectedStay.reservationId,
                                      reservationCode: selectedStay.reservationCode,
                                      contactName: selectedStay.guestName,
                                      contactPhone: selectedStay.phoneNumber,
                                      checkInDate: selectedStay.checkInDate || selectedStay.actualCheckIn,
                                      checkOutDate: selectedStay.checkOutDate || selectedStay.actualCheckOut,
                                    },
                                    item: {
                                      itemIndex: po.itemIndex,
                                      serviceId: po.serviceId,
                                      serviceName: po.serviceName,
                                      quantity: po.quantity,
                                      time: po.scheduledTime,
                                      detail: po.details,
                                    },
                                    matchedStay: selectedStay,
                                    existingOrder: po.matchedOrder || null,
                                  })
                                }
                                style={{
                                  background: '#f1f5f9',
                                  color: '#0f172a',
                                  border: '1px solid #cbd5e1',
                                  borderRadius: 4,
                                  padding: '4px 8px',
                                  fontSize: 11.5,
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  whiteSpace: 'nowrap',
                                }}
                                title="Xem chi tiết lịch hẹn & yêu cầu của khách"
                              >
                                Chi tiết
                              </button>
                              {isCompleted ? (
                                <span style={{ color: '#16a34a', fontSize: 11.5, fontWeight: 700 }}>
                                  Đã tính vào tiền phòng
                                </span>
                              ) : isOrdered ? (
                                <span style={{ color: '#d97706', fontSize: 11.5, fontWeight: 600 }}>
                                  Đang phục vụ
                                </span>
                              ) : (
                                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                  {canComplete && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleOpenQuickLoadAndCompleteConfirm(selectedStay, {
                                          itemIndex: po.itemIndex,
                                          serviceId: po.serviceId,
                                          serviceName: po.serviceName,
                                          quantity: po.quantity,
                                          time: po.scheduledTime,
                                          detail: po.details,
                                        })
                                      }
                                      disabled={busy}
                                      style={{
                                        background: '#16a34a',
                                        color: '#fff',
                                        border: 'none',
                                        borderRadius: 4,
                                        padding: '4px 8px',
                                        fontSize: 11.5,
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                        whiteSpace: 'nowrap',
                                      }}
                                      title="Hoàn thành đơn và cộng tiền vào hóa đơn phòng ngay"
                                    >
                                      Hoàn thành &amp; Tính tiền phòng
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => handleCancelPreOrderInStay(selectedStay, po)}
                                    disabled={busy}
                                    style={{
                                      background: '#fff',
                                      color: '#dc2626',
                                      border: '1px solid #fca5a5',
                                      borderRadius: 4,
                                      padding: '4px 8px',
                                      fontSize: 11.5,
                                      fontWeight: 600,
                                      cursor: 'pointer',
                                      whiteSpace: 'nowrap',
                                    }}
                                    title="Hủy dịch vụ đặt trước này"
                                  >
                                    Hủy hẹn
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </>
            ) : (
              /* Nếu chưa chọn: Hộp Tìm Kiếm Nhanh */
              <div>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    style={{
                      ...inputStyle,
                      paddingLeft: 12,
                      borderColor: matchingStays.length === 0 && roomSearchKeyword ? '#fca5a5' : '#cbd5e1',
                    }}
                    placeholder="Gõ số phòng (VD: 101, 201...) hoặc tên khách..."
                    value={roomSearchKeyword}
                    onChange={(e) => setRoomSearchKeyword(e.target.value)}
                    autoFocus
                  />
                  {roomSearchKeyword && (
                    <button
                      type="button"
                      onClick={() => setRoomSearchKeyword('')}
                      style={{
                        position: 'absolute',
                        right: 10,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        color: '#94a3b8',
                        cursor: 'pointer',
                        fontSize: 14,
                      }}
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Danh sách kết quả gợi ý */}
                <div
                  style={{
                    marginTop: 6,
                    maxHeight: 180,
                    overflowY: 'auto',
                    border: '1px solid #e2e8f0',
                    borderRadius: 8,
                    background: '#fff',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
                  }}
                >
                  {activeStays.length === 0 ? (
                    <div style={{ padding: 12, textAlign: 'center', fontSize: 13, color: '#dc2626' }}>
                      Hiện tại khách sạn không có phòng nào đang lưu trú (Check-in).
                    </div>
                  ) : matchingStays.length === 0 ? (
                    <div style={{ padding: 12, textAlign: 'center', fontSize: 13, color: '#64748b' }}>
                      Không tìm thấy phòng nào khớp với "{roomSearchKeyword}".
                    </div>
                  ) : (
                    matchingStays.map((s) => (
                      <div
                        key={s.stayId}
                        onClick={() => {
                          if (s.folioStatus === 'CLOSED') {
                            notifyToast({
                              type: 'WARNING',
                              message: `Phòng ${s.roomNumber} (${s.guestName}) đã hoàn tất quyết toán hóa đơn (Folio đã đóng). Không thể đặt thêm dịch vụ vào phòng này.`,
                            });
                            return;
                          }
                          setOrderForm({ ...orderForm, stayId: s.stayId });
                          setRoomSearchKeyword('');
                        }}
                        style={{
                          padding: '8px 12px',
                          borderBottom: '1px solid #f1f5f9',
                          cursor: 'pointer',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          transition: 'background 0.15s',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = '#fff')}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span
                            style={{
                              background: '#e0f2fe',
                              color: '#0369a1',
                              fontWeight: 700,
                              fontSize: 12,
                              padding: '2px 8px',
                              borderRadius: 4,
                            }}
                          >
                            Phòng {s.roomNumber}
                          </span>
                          <span style={{ fontSize: 13.5, color: '#0f172a', fontWeight: 500 }}>
                            {s.guestName}
                          </span>
                          {s.folioStatus === 'CLOSED' && (
                            <span
                              style={{
                                background: '#fee2e2',
                                color: '#b91c1c',
                                fontSize: 11,
                                fontWeight: 700,
                                padding: '1px 6px',
                                borderRadius: 4,
                                border: '1px solid #fecaca',
                              }}
                            >
                              Đã đóng Folio
                            </span>
                          )}
                        </div>
                        <span style={{ fontSize: 12, color: '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}>
                          {s.specialNotes && s.specialNotes.includes('[ĐẶT TRƯỚC]') && (
                            <span
                              style={{
                                background: '#fef3c7',
                                color: '#b45309',
                                fontSize: 11,
                                fontWeight: 600,
                                padding: '2px 6px',
                                borderRadius: 4,
                              }}
                            >
                              Có đặt trước
                            </span>
                          )}
                          <span>{s.reservationCode ? `Mã: ${s.reservationCode}` : `Stay #${s.stayId}`}</span>
                        </span>
                      </div>
                    ))
                  )}
                </div>
                {/* Thẻ input ẩn để form HTML5 bắt validate required */}
                <input
                  tabIndex={-1}
                  required
                  style={{ opacity: 0, height: 0, width: 0, position: 'absolute' }}
                  value={orderForm.stayId}
                  onChange={() => {}}
                />
              </div>
            )}
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Chọn Dịch Vụ Cần Dùng *</label>
            <select
              required
              style={inputStyle}
              value={orderForm.serviceId}
              onChange={(e) => setOrderForm({ ...orderForm, serviceId: e.target.value })}
            >
              <option value="">— Vui lòng chọn dịch vụ —</option>
              {services
                .filter((s) => s.status === 'ACTIVE')
                .map((s) => (
                  <option key={s.serviceId} value={s.serviceId}>
                    [{s.category}] {s.serviceName} — {formatVND(s.unitPrice)} / {s.billingUnit}
                  </option>
                ))}
            </select>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Số lượng *</label>
            <input
              required
              type="number"
              min="1"
              step="1"
              style={inputStyle}
              value={orderForm.quantity}
              onChange={(e) => setOrderForm({ ...orderForm, quantity: e.target.value })}
            />
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Thời gian hẹn nhận / phục vụ tại phòng *</label>
            <input
              required
              type="text"
              style={inputStyle}
              placeholder="Ví dụ: Giao ngay, 19:30 tối nay, hoặc 07:00 sáng mai..."
              value={orderForm.scheduledTime || ''}
              onChange={(e) => setOrderForm({ ...orderForm, scheduledTime: e.target.value })}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Yêu cầu / Ghi chú phục vụ (Tùy chọn)</label>
            <input
              type="text"
              style={inputStyle}
              placeholder="Ví dụ: Ít đá, không hành, gọi trước khi mang lên..."
              value={orderForm.notes || ''}
              onChange={(e) => setOrderForm({ ...orderForm, notes: e.target.value })}
            />
          </div>

          {selectedServiceForOrder && (
            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: 8,
                padding: 12,
                marginBottom: 20,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#64748b' }}>
                <span>Đơn giá dịch vụ:</span>
                <span>{formatVND(selectedServiceForOrder.unitPrice)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 700, color: '#0f172a', marginTop: 6 }}>
                <span>Tạm tính thành tiền:</span>
                <span style={{ color: '#16a34a' }}>{formatVND(estimatedOrderTotal)}</span>
              </div>
            </div>
          )}

          {/* Tùy chọn tự động hoàn thành và cộng vào Folio ngay */}
          {canComplete ? (
            <div style={{ marginBottom: 18, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, padding: '10px 12px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', margin: 0, fontSize: 13, color: '#166534', fontWeight: 600 }}>
                <input
                  type="checkbox"
                  checked={orderForm.completeImmediately ?? true}
                  onChange={(e) => setOrderForm({ ...orderForm, completeImmediately: e.target.checked })}
                  style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#16a34a' }}
                />
                <span>Tự động xác nhận hoàn thành &amp; cộng tiền vào hóa đơn phòng ngay</span>
              </label>
              <div style={{ fontSize: 11.5, color: '#15803d', marginLeft: 24, marginTop: 2 }}>
                (Nếu bỏ tích, đơn sẽ được tạo ở trạng thái <strong>Đã xác nhận - Chờ phục vụ</strong> và khóa hủy)
              </div>
            </div>
          ) : (
            <div style={{ marginBottom: 18, background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 6, padding: '10px 12px', fontSize: 12.5, color: '#1e40af' }}>
              <strong>Lễ tân đặt hộ khách:</strong> Đơn sẽ tự động được tính là <strong>Đã xác nhận (Chờ phục vụ)</strong> và chuyển thẳng cho bộ phận Dịch vụ thực hiện &amp; hoàn thành.
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: '#f1f5f9',
                color: '#475569',
                border: 'none',
                padding: '8px 16px',
                borderRadius: 6,
                cursor: 'pointer',
                fontWeight: 500,
              }}
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={busy}
              style={{
                background: '#16a34a',
                color: '#fff',
                border: 'none',
                padding: '8px 18px',
                borderRadius: 6,
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              Xác Nhận Đặt Đơn
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

