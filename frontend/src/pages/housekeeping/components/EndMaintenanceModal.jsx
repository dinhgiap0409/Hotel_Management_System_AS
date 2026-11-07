import { useState, useEffect } from 'react';
import { Modal, Button, Form, Alert, Spinner } from 'react-bootstrap';
import { roomApi } from '../../../services/roomApi';

export const EndMaintenanceModal = ({ show, onHide, room, onSuccess }) => {
  const [resolutionNote, setResolutionNote] = useState('');
  const [cleaningStatus, setCleaningStatus] = useState('DIRTY');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (room) {
      setResolutionNote('');
      setCleaningStatus('DIRTY');
      setError(null);
    }
  }, [room, show]);

  if (!room) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await roomApi.endRoomMaintenance(room.roomId, {
        resolutionNote: resolutionNote.trim() || undefined,
        cleaningStatus: cleaningStatus,
      });
      onSuccess?.(`Phòng ${room.roomNumber} đã hoàn tất bảo trì và mở hoạt động trở lại!`);
      onHide();
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Mở lại phòng sau bảo trì thất bại.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal show={show} onHide={onHide} centered backdrop="static">
      <Modal.Header closeButton>
        <Modal.Title style={{ fontSize: '1.15rem', fontWeight: 600 }}>
          Kết Thúc Bảo Trì - Phòng {room.roomNumber}
        </Modal.Title>
      </Modal.Header>
      <Form onSubmit={handleSubmit}>
        <Modal.Body>
          {error && (
            <Alert variant="danger" className="py-2" style={{ fontSize: '0.875rem' }}>
              {error}
            </Alert>
          )}

          <div className="mb-3 p-3 bg-light rounded">
            <div className="small text-muted mb-1">Thông tin sự cố trước đó:</div>
            <div className="fw-semibold text-danger">{room.maintenanceReason || 'Không có ghi chú sự cố chi tiết.'}</div>
            {room.estimatedCompletionDate && (
              <div className="small text-muted mt-1">
                Hạn dự kiến sửa: {room.estimatedCompletionDate}
              </div>
            )}
          </div>

          <Form.Group className="mb-3">
            <Form.Label className="fw-semibold">Kết quả sửa chữa / Biên bản nghiệm thu</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              maxLength={500}
              placeholder="VD: Đã thay thế linh kiện cảm biến nhiệt, chạy thử ổn định..."
              value={resolutionNote}
              onChange={(e) => setResolutionNote(e.target.value)}
              disabled={loading}
            />
            <div className="text-muted small text-end mt-1">{resolutionNote.length}/500 ký tự</div>
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label className="fw-semibold">Trạng thái vệ sinh tiếp theo</Form.Label>
            <Form.Select
              value={cleaningStatus}
              onChange={(e) => setCleaningStatus(e.target.value)}
              disabled={loading}
            >
              <option value="DIRTY">DIRTY (Cần dọn dẹp buồng phòng sau bảo trì - Khuyên dùng)</option>
              <option value="CLEAN">CLEAN (Đã dọn dẹp sẵn sàng)</option>
            </Form.Select>
            <Form.Text className="text-muted">
              Sau khi sửa chữa, phòng nên chuyển về DIRTY để nhân viên buồng dọn dẹp bụi bẩn trước khi đón khách.
            </Form.Text>
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={onHide} disabled={loading}>
            Hủy bỏ
          </Button>
          <Button variant="success" type="submit" disabled={loading}>
            {loading ? (
              <>
                <Spinner size="sm" animation="border" className="me-2" />
                Đang xử lý...
              </>
            ) : (
              'Hoàn tất & Mở phòng'
            )}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
};

