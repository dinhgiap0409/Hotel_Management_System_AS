import { useState, useEffect } from 'react';
import { Modal, Button, Form, Alert, Spinner } from 'react-bootstrap';
import { roomApi } from '../../../services/roomApi';
import { StatusBadge } from '../../../components/common/StatusBadge';

export const SetMaintenanceModal = ({ show, onHide, room, onSuccess }) => {
  const [maintenanceReason, setMaintenanceReason] = useState('');
  const [estimatedCompletionDate, setEstimatedCompletionDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Tomorrow date string for min date attribute
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  useEffect(() => {
    if (room) {
      setMaintenanceReason('');
      setEstimatedCompletionDate(tomorrowStr);
      setError(null);
    }
  }, [room, show, tomorrowStr]);

  if (!room) return null;

  const isOccupied = room.stayStatus === 'OCCUPIED';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (isOccupied) {
      setError('MSG08A: Không thể khóa bảo trì phòng đang có khách ở (OCCUPIED). Vui lòng đổi phòng cho khách trước.');
      return;
    }

    if (!maintenanceReason.trim()) {
      setError('Vui lòng nhập lý do bảo trì / sự cố thiết bị.');
      return;
    }

    if (!estimatedCompletionDate) {
      setError('Vui lòng chọn ngày dự kiến hoàn tất sửa chữa.');
      return;
    }

    setLoading(true);
    try {
      await roomApi.setRoomMaintenance(room.roomId, {
        maintenanceReason: maintenanceReason.trim(),
        estimatedCompletionDate: estimatedCompletionDate,
      });
      onSuccess?.(`Phòng ${room.roomNumber} đã được khóa bảo trì thành công!`);
      onHide();
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Khóa phòng bảo trì thất bại.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal show={show} onHide={onHide} centered backdrop="static">
      <Modal.Header closeButton>
        <Modal.Title style={{ fontSize: '1.15rem', fontWeight: 600 }}>
          Khóa Bảo Trì - Phòng {room.roomNumber}
        </Modal.Title>
      </Modal.Header>
      <Form onSubmit={handleSubmit}>
        <Modal.Body>
          {error && (
            <Alert variant="danger" className="py-2" style={{ fontSize: '0.875rem' }}>
              {error}
            </Alert>
          )}

          {isOccupied && (
            <Alert variant="danger" className="py-2" style={{ fontSize: '0.875rem' }}>
              <strong>Chặn nghiệp vụ (MSG08A):</strong> Phòng hiện đang có khách lưu trú. Bạn không được phép đưa phòng vào bảo trì.
            </Alert>
          )}

          <div className="mb-3 p-3 bg-light rounded d-flex justify-content-between align-items-center">
            <div>
              <div className="text-muted small">Hạng phòng: <strong>{room.roomTypeName || room.roomType?.typeName}</strong></div>
              <div className="text-muted small">Tầng: <strong>{room.floor}</strong></div>
            </div>
            <div className="text-end">
              <div className="small text-muted mb-1">Trạng thái phòng:</div>
              <StatusBadge status={room.stayStatus || 'AVAILABLE'} />
            </div>
          </div>

          <Form.Group className="mb-3">
            <Form.Label className="fw-semibold">
              Lý do bảo trì / Sự cố thiết bị <span className="text-danger">*</span>
            </Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              maxLength={500}
              placeholder="VD: Hỏng điều hòa nhiệt độ không mát, rò rỉ đường ống nước bồn rửa mặt..."
              value={maintenanceReason}
              onChange={(e) => setMaintenanceReason(e.target.value)}
              disabled={loading || isOccupied}
              required
            />
            <div className="text-muted small text-end mt-1">{maintenanceReason.length}/500 ký tự</div>
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label className="fw-semibold">
              Ngày dự kiến sửa xong <span className="text-danger">*</span>
            </Form.Label>
            <Form.Control
              type="date"
              min={tomorrowStr}
              value={estimatedCompletionDate}
              onChange={(e) => setEstimatedCompletionDate(e.target.value)}
              disabled={loading || isOccupied}
              required
            />
            <Form.Text className="text-muted">
              Ngày dự kiến hoàn tất phải sau ngày hiện tại ít nhất 1 ngày.
            </Form.Text>
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={onHide} disabled={loading}>
            Hủy bỏ
          </Button>
          <Button variant="danger" type="submit" disabled={loading || isOccupied}>
            {loading ? (
              <>
                <Spinner size="sm" animation="border" className="me-2" />
                Đang khóa phòng...
              </>
            ) : (
              'Xác nhận Khóa bảo trì'
            )}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
};
