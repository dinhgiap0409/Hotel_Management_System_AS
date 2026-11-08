import { Modal, Form, Button, Alert, Spinner } from 'react-bootstrap';
import { formatVND } from '../../../lib/money';
import { formatDate } from '../../../lib/datetime';

export const SmartServiceOrderModal = ({
  show,
  onClose,
  submittingOrder,
  handleSubmitOrder,
  orderError,
  orderSuccess,
  selectedService,
  hasActiveStay,
  hasUpcomingBookingForPreOrder,
  orderTargetMode,
  setOrderTargetMode,
  friendlyRoomNumber,
  upcomingReservationsForPreOrder,
  selectedReservationId,
  setSelectedReservationId,
  currentUpcomingReservation,
  user,
  currentStay,
  quantity,
  setQuantity,
  scheduledTime,
  setScheduledTime,
  flightDetails,
  setFlightDetails,
  roomServiceNotes,
  setRoomServiceNotes,
  lineEstimatedTotal,
  selectedStayId,
}) => {
  if (!show) return null;

  return (
    <Modal
      show={show}
      onHide={() => !submittingOrder && onClose()}
      centered
      backdrop="static"
    >
      <Modal.Header closeButton={!submittingOrder} style={{ background: '#FAF9F5', borderBottom: '1px solid #E8E6DC' }}>
        <Modal.Title style={{ fontFamily: 'var(--font-display, serif)', fontSize: 18, color: '#16233B' }}>
          Xác Nhận Đặt Dịch Vụ Khách Sạn
        </Modal.Title>
      </Modal.Header>

      <Form onSubmit={handleSubmitOrder}>
        <Modal.Body style={{ background: '#FAF9F5', padding: 22 }}>
          {orderError && <Alert variant="danger" className="py-2 px-3 small rounded-3 mb-3">{orderError}</Alert>}
          {orderSuccess && <Alert variant="success" className="py-2 px-3 small rounded-3 mb-3">{orderSuccess}</Alert>}

          {selectedService && (
            <div className="d-flex flex-column gap-3">
              {/* Nút chuyển chế độ nếu khách vừa có phòng đang ở, vừa có chuyến sắp tới CHƯA NHẬN PHÒNG */}
              {hasActiveStay && hasUpcomingBookingForPreOrder && (
                <div style={{ background: '#F1F5F9', borderRadius: 8, padding: 5, display: 'flex', gap: 6 }}>
                  <button
                    type="button"
                    onClick={() => setOrderTargetMode('ACTIVE_STAY')}
                    className="btn btn-sm flex-fill"
                    style={{
                      background: orderTargetMode === 'ACTIVE_STAY' ? '#16233B' : 'transparent',
                      color: orderTargetMode === 'ACTIVE_STAY' ? '#FAF9F5' : '#475569',
                      fontWeight: 600,
                      border: 'none',
                      fontSize: 12.5,
                    }}
                  >
                    Giao tới {friendlyRoomNumber}
                  </button>
                  <button
                    type="button"
                    onClick={() => setOrderTargetMode('PRE_ORDER')}
                    className="btn btn-sm flex-fill"
                    style={{
                      background: orderTargetMode === 'PRE_ORDER' ? '#0284C7' : 'transparent',
                      color: orderTargetMode === 'PRE_ORDER' ? '#FAF9F5' : '#475569',
                      fontWeight: 600,
                      border: 'none',
                      fontSize: 12.5,
                    }}
                  >
                    Đặt trước cho chuyến sắp tới
                  </button>
                </div>
              )}

              {/* Thông tin đối tượng phục vụ */}
              {orderTargetMode === 'PRE_ORDER' ? (
                <div style={{ background: '#F0F9FF', border: '1px solid #BAE6FD', borderRadius: 8, padding: '12px 14px' }}>
                  <div className="small text-secondary" style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>
                    ĐẶT TRƯỚC CHO CHUYẾN ĐI SẮP TỚI
                  </div>
                  {upcomingReservationsForPreOrder.length > 1 ? (
                    <div className="mt-1">
                      <Form.Select
                        size="sm"
                        value={selectedReservationId}
                        onChange={(e) => setSelectedReservationId(e.target.value)}
                        style={{ fontSize: 12.5 }}
                      >
                        {upcomingReservationsForPreOrder.map((r) => (
                          <option key={r.reservationId} value={r.reservationId}>
                            #{r.reservationCode} — {r.roomTypeName} (Nhận phòng: {formatDate(r.checkInDate)})
                          </option>
                        ))}
                      </Form.Select>
                    </div>
                  ) : (
                    <>
                      <div className="fw-bold" style={{ color: '#0369A1', fontSize: 15 }}>
                        Đơn #{currentUpcomingReservation?.reservationCode} — {currentUpcomingReservation?.roomTypeName}
                      </div>
                      <div className="text-secondary small">
                        Ngày nhận phòng: {formatDate(currentUpcomingReservation?.checkInDate)} • Khách: {currentUpcomingReservation?.contactName || user?.fullName}
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div style={{ background: '#FFFFFF', border: '1px solid #E8E6DC', borderRadius: 8, padding: '12px 14px' }}>
                  <div className="small text-secondary" style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>
                    GIAO TỚI PHÒNG
                  </div>
                  <div className="fw-bold" style={{ color: '#16233B', fontSize: 16 }}>
                    {friendlyRoomNumber}
                  </div>
                  <div className="text-secondary small">
                    Khách: {currentStay?.guestName || user?.fullName} {currentStay?.reservationCode ? `• Mã booking: ${currentStay.reservationCode}` : ''}
                  </div>
                </div>
              )}

              {/* Thông tin dịch vụ */}
              <div style={{ background: '#FFFFFF', border: '1px solid #E8E6DC', borderRadius: 8, padding: '12px 14px' }}>
                <div className="d-flex gap-3 align-items-center">
                  {selectedService.imageUrl ? (
                    <img
                      src={selectedService.imageUrl}
                      alt={selectedService.serviceName}
                      style={{ width: 68, height: 68, borderRadius: 8, objectFit: 'cover', flexShrink: 0, border: '1px solid #E8E6DC' }}
                    />
                  ) : null}
                  <div style={{ flex: 1 }}>
                    <div className="d-flex justify-content-between align-items-center mb-1">
                      <span className="badge bg-light text-dark border">{selectedService.category}</span>
                      <span className="fw-bold" style={{ color: '#C96442' }}>
                        {formatVND(selectedService.unitPrice)} / {selectedService.unit || selectedService.billingUnit || 'Lượt'}
                      </span>
                    </div>
                    <h6 className="fw-bold text-dark mb-1">{selectedService.serviceName}</h6>
                    <p className="text-secondary small mb-0">{selectedService.description}</p>
                  </div>
                </div>
              </div>

              {/* Số lượng */}
              <div className="d-flex justify-content-between align-items-center">
                <Form.Label className="small fw-semibold text-dark mb-0">Số lượng</Form.Label>
                <div className="d-flex align-items-center gap-2">
                  <Button variant="outline-secondary" size="sm" style={{ width: 32, height: 32, padding: 0 }} onClick={() => setQuantity((q) => Math.max(1, q - 1))} disabled={quantity <= 1}>-</Button>
                  <Form.Control type="number" min="1" max="99" value={quantity} onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))} style={{ width: 56, textAlign: 'center', height: 32 }} />
                  <Button variant="outline-secondary" size="sm" style={{ width: 32, height: 32, padding: 0 }} onClick={() => setQuantity((q) => q + 1)}>+</Button>
                </div>
              </div>

              {/* Trường nhập riêng theo từng chế độ */}
              {orderTargetMode === 'PRE_ORDER' ? (
                <>
                  <div>
                    <Form.Label className="small fw-semibold text-dark mb-1">
                      Thời gian đón / phục vụ dự kiến <span className="text-danger">*</span>
                    </Form.Label>
                    <Form.Control
                      type="text"
                      placeholder="Ví dụ: 14:00 ngày 15/11/2026 hoặc Khi hạ cánh"
                      value={scheduledTime}
                      onChange={(e) => setScheduledTime(e.target.value)}
                      required
                      style={{ fontSize: 13 }}
                    />
                  </div>
                  <div>
                    <Form.Label className="small fw-semibold text-dark mb-1">
                      Chi tiết hành trình / Yêu cầu riêng
                    </Form.Label>
                    <Form.Control
                      as="textarea"
                      rows={2}
                      placeholder="Ví dụ: Chuyến bay VN214 hạ cánh 13:30 tại ga T2, 4 hành khách, 2 vali to..."
                      value={flightDetails}
                      onChange={(e) => setFlightDetails(e.target.value)}
                      style={{ fontSize: 13 }}
                    />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <Form.Label className="small fw-semibold text-dark mb-1">
                      Thời gian muốn nhận / phục vụ tại phòng <span className="text-danger">*</span>
                    </Form.Label>
                    <Form.Control
                      type="text"
                      placeholder="Ví dụ: Giao ngay, 19:30 tối nay, hoặc 07:00 sáng mai..."
                      value={scheduledTime}
                      onChange={(e) => setScheduledTime(e.target.value)}
                      required
                      style={{ fontSize: 13 }}
                    />
                  </div>
                  <div>
                    <Form.Label className="small fw-semibold text-dark mb-1">
                      Yêu cầu / Ghi chú cho phục vụ <span className="text-secondary fw-normal">(tùy chọn)</span>
                    </Form.Label>
                    <Form.Control
                      as="textarea"
                      rows={2}
                      placeholder="Ví dụ: Ít đá, không đường, mang thêm ly, gõ cửa nhẹ..."
                      value={roomServiceNotes}
                      onChange={(e) => setRoomServiceNotes(e.target.value)}
                      style={{ fontSize: 13 }}
                    />
                  </div>
                </>
              )}

              {/* Tạm tính chi phí */}
              <div style={{ background: '#F5F4ED', border: '1px dashed #D6D3C7', borderRadius: 8, padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div className="small text-secondary">Tạm tính chi phí</div>
                  <div className="text-secondary" style={{ fontSize: 11 }}>
                    {orderTargetMode === 'PRE_ORDER'
                      ? 'Chi phí sẽ được cộng vào hóa đơn phòng sau khi nhận phòng'
                      : 'Được ghi nhận vào hóa đơn phòng khi hoàn tất phục vụ'}
                  </div>
                </div>
                <strong style={{ color: '#C96442', fontSize: 18, fontFamily: 'var(--font-mono, monospace)' }}>
                  {formatVND(lineEstimatedTotal)}
                </strong>
              </div>
            </div>
          )}
        </Modal.Body>

        <Modal.Footer style={{ background: '#FAF9F5', borderTop: '1px solid #E8E6DC' }}>
          <Button variant="outline-secondary" onClick={onClose} disabled={submittingOrder} style={{ fontSize: 13 }}>
            Hủy
          </Button>
          <Button
            type="submit"
            disabled={
              submittingOrder ||
              !selectedService ||
              (orderTargetMode === 'ACTIVE_STAY' && !selectedStayId) ||
              (orderTargetMode === 'PRE_ORDER' && !selectedReservationId)
            }
            style={{
              background: orderTargetMode === 'PRE_ORDER' ? '#0284C7' : '#16233B',
              borderColor: orderTargetMode === 'PRE_ORDER' ? '#0284C7' : '#16233B',
              color: '#FAF9F5',
              fontWeight: 600,
              padding: '8px 20px',
              fontSize: 13,
            }}
          >
            {submittingOrder ? (
              <>
                <Spinner size="sm" animation="border" className="me-2" />
                Đang ghi nhận...
              </>
            ) : orderTargetMode === 'PRE_ORDER' ? (
              'Xác Nhận Đặt Trước'
            ) : (
              'Gửi Yêu Cầu Phục Vụ'
            )}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
};

