import { Modal, Form, Button, Spinner } from 'react-bootstrap';
import { formatVND } from '../../../lib/money';
import { formatOrderNotes } from './serviceUtils';

export const CustomerVoidRoomOrderModal = ({
  voidRoomOrderModal,
  onClose,
  voidingRoomOrder,
  onConfirmVoid,
  setVoidRoomOrderModal,
}) => {
  if (!voidRoomOrderModal) return null;

  return (
    <Modal show={!!voidRoomOrderModal} onHide={() => !voidingRoomOrder && onClose()} centered>
      <Modal.Header closeButton style={{ borderBottom: '1px solid #F1F5F9' }}>
        <Modal.Title style={{ fontSize: 16, fontWeight: 700, color: '#16233B' }}>
          Hủy Đơn Gọi Dịch Vụ Phòng #{voidRoomOrderModal?.order?.serviceOrderId}
        </Modal.Title>
      </Modal.Header>
      <Form onSubmit={onConfirmVoid}>
        <Modal.Body className="p-3">
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
              {voidRoomOrderModal?.order?.serviceName} (SL: {voidRoomOrderModal?.order?.quantity})
            </div>
            <div className="text-secondary small mt-1">
              Thành tiền: <strong className="text-dark">{formatVND(voidRoomOrderModal?.order?.totalAmount)}</strong>
            </div>
            {voidRoomOrderModal?.order?.notes && (
              <div className="text-secondary small mt-1">
                Ghi chú đã gửi: {formatOrderNotes(voidRoomOrderModal.order.notes)}
              </div>
            )}
          </div>

          <Form.Group className="mb-2">
            <Form.Label className="fw-semibold" style={{ fontSize: 13 }}>
              Lý do hủy đơn <span className="text-danger">*</span>
            </Form.Label>
            <Form.Control
              as="textarea"
              rows={2}
              required
              placeholder="VD: Đặt nhầm món, đổi sang món khác, không còn nhu cầu..."
              value={voidRoomOrderModal?.reason || ''}
              onChange={(e) =>
                setVoidRoomOrderModal((prev) => (prev ? { ...prev, reason: e.target.value } : null))
              }
              style={{ fontSize: 13 }}
            />
          </Form.Group>
          <div className="text-muted small" style={{ fontSize: 12 }}>
            Đơn đang ở trạng thái <strong>Chờ nhân viên xác nhận</strong>. Khi nhân viên đã xác nhận tiếp nhận chuẩn bị phục vụ, đơn sẽ được khóa hủy.
          </div>
        </Modal.Body>
        <Modal.Footer style={{ borderTop: '1px solid #F1F5F9', padding: '10px 16px' }}>
          <Button
            variant="outline-secondary"
            size="sm"
            onClick={onClose}
            disabled={voidingRoomOrder}
            style={{ fontSize: 12.5, borderRadius: 6 }}
          >
            Đóng
          </Button>
          <Button
            type="submit"
            variant="danger"
            size="sm"
            disabled={voidingRoomOrder}
            style={{ fontSize: 12.5, borderRadius: 6, fontWeight: 600 }}
          >
            {voidingRoomOrder ? (
              <>
                <Spinner size="sm" animation="border" className="me-1" />
                Đang hủy...
              </>
            ) : (
              'Xác nhận hủy đơn'
            )}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
};

