import { Modal, Form, Button, Spinner } from 'react-bootstrap';

export const CustomerCancelPreOrderModal = ({
  cancelModalData,
  onClose,
  cancellingPreOrder,
  onConfirmCancel,
  setCancelModalData,
}) => {
  if (!cancelModalData) return null;

  return (
    <Modal show={!!cancelModalData} onHide={() => !cancellingPreOrder && onClose()} centered>
      <Modal.Header closeButton style={{ borderBottom: '1px solid #F1F5F9' }}>
        <Modal.Title style={{ fontSize: 16, fontWeight: 700, color: '#16233B' }}>
          Xác Nhận Hủy Dịch Vụ Đặt Trước
        </Modal.Title>
      </Modal.Header>
      <Modal.Body className="p-3">
        <p className="text-secondary mb-2" style={{ fontSize: 13.5 }}>
          Quý khách có chắc chắn muốn hủy yêu cầu đặt trước dịch vụ này cho chuyến đi{' '}
          <strong className="text-dark">#{cancelModalData?.reservationCode}</strong>?
        </p>

        <div
          style={{
            background: '#FFF1F2',
            border: '1px solid #FFE4E6',
            borderRadius: 8,
            padding: '12px 14px',
            fontSize: 13,
            marginBottom: 12,
          }}
        >
          <div className="fw-bold" style={{ color: '#BE123C', fontSize: 14 }}>
            {cancelModalData?.serviceName} (SL: {cancelModalData?.quantity})
          </div>
          {cancelModalData?.scheduledTime && (
            <div className="text-secondary small mt-1">
              Thời gian hẹn: <strong className="text-dark">{cancelModalData.scheduledTime}</strong>
            </div>
          )}
          {cancelModalData?.details && cancelModalData.details !== 'Không' && (
            <div className="text-secondary small">
              Chi tiết: {cancelModalData.details}
            </div>
          )}
        </div>

        {Number(cancelModalData?.quantity) > 1 && (
          <div className="mb-3 p-2.5 rounded-2" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', padding: '10px 12px' }}>
            <Form.Label className="fw-semibold mb-1 text-dark" style={{ fontSize: 12.5 }}>
              Số lượng muốn hủy (Đang đặt: {cancelModalData?.quantity} suất):
            </Form.Label>
            <div className="d-flex align-items-center gap-2">
              <Form.Select
                size="sm"
                value={cancelModalData?.cancelQty || cancelModalData?.quantity}
                onChange={(e) =>
                  setCancelModalData((prev) => ({
                    ...prev,
                    cancelQty: Number(e.target.value),
                  }))
                }
                style={{ maxWidth: 210, fontSize: 13 }}
              >
                {Array.from({ length: Number(cancelModalData?.quantity) || 1 }, (_, i) => i + 1).map((num) => (
                  <option key={num} value={num}>
                    {num === Number(cancelModalData?.quantity)
                      ? `Hủy toàn bộ (${num} suất)`
                      : `Hủy ${num} suất (Giữ lại ${Number(cancelModalData?.quantity) - num} suất)`}
                  </option>
                ))}
              </Form.Select>
            </div>
          </div>
        )}

        <Form.Group className="mb-2">
          <Form.Label className="fw-semibold" style={{ fontSize: 13 }}>
            Lý do hủy dịch vụ đặt trước <span className="text-danger">* (Bắt buộc)</span>
          </Form.Label>
          <Form.Control
            as="textarea"
            rows={2}
            required
            placeholder="VD: Đổi lịch trình chuyến đi, đặt nhầm khung giờ, không còn nhu cầu..."
            value={cancelModalData?.reason || ''}
            onChange={(e) =>
              setCancelModalData((prev) => (prev ? { ...prev, reason: e.target.value } : null))
            }
            style={{ fontSize: 13 }}
          />
        </Form.Group>

        <div className="text-muted small" style={{ fontSize: 12 }}>
          Sau khi hủy, yêu cầu sẽ được cập nhật khỏi lịch trình đón tiếp của khách sạn. Quý khách vẫn có thể đặt lại bất kỳ lúc nào trước khi dịch vụ được xác nhận.
        </div>
      </Modal.Body>
      <Modal.Footer style={{ borderTop: '1px solid #F1F5F9', padding: '10px 16px' }}>
        <Button
          variant="outline-secondary"
          size="sm"
          onClick={onClose}
          disabled={!!cancellingPreOrder}
          style={{ fontSize: 12.5, borderRadius: 6 }}
        >
          Giữ lại
        </Button>
        <Button
          variant="danger"
          size="sm"
          onClick={onConfirmCancel}
          disabled={!!cancellingPreOrder || !cancelModalData?.reason?.trim()}
          style={{ fontSize: 12.5, borderRadius: 6, fontWeight: 600 }}
        >
          {cancellingPreOrder ? (
            <>
              <Spinner size="sm" animation="border" className="me-1" />
              Đang hủy...
            </>
          ) : (
            'Xác nhận hủy'
          )}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

