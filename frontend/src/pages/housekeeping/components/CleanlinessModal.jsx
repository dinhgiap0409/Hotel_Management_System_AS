import { useState, useEffect } from 'react';
import { Modal, Button, Form, Alert, Spinner } from 'react-bootstrap';
import { roomApi } from '../../../services/roomApi';
import { StatusBadge } from '../../../components/common/StatusBadge';

export const CleanlinessModal = ({ show, onHide, room, onSuccess }) => {
  const [newStatus, setNewStatus] = useState('CLEAN');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (room) {
      // Suggest logical next status: DIRTY -> CLEAN, CLEAN -> INSPECTED, INSPECTED -> DIRTY
      if (room.cleaningStatus === 'DIRTY') {
        setNewStatus('CLEAN');
      } else if (room.cleaningStatus === 'CLEAN') {
        setNewStatus('INSPECTED');
      } else {
        setNewStatus('DIRTY');
      }
      setNotes('');
      setError(null);
    }
  }, [room, show]);

  if (!room) return null;

  const isUnderMaintenance = room.status === 'UNDER_MAINTENANCE' || room.roomStatus === 'UNDER_MAINTENANCE';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (isUnderMaintenance) {
      setError('MSG07A: Phòng đang ở trạng thái bảo trì (UNDER_MAINTENANCE). Không thể đổi trạng thái vệ sinh cho đến khi hoàn tất bảo trì.');
      return;
    }

    setLoading(true);
    try {
      await roomApi.updateHousekeepingStatus(room.roomId, {
        newCleaningStatus: newStatus,
        notes: notes.trim() || undefined,
      });
      onSuccess?.('Cập nhật trạng thái vệ sinh phòng thành công!');
      onHide();
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Cập nhật trạng thái vệ sinh thất bại.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal show={show} onHide={onHide} centered backdrop="static">
      <Modal.Header closeButton>
        <Modal.Title style={{ fontSize: '1.15rem', fontWeight: 600 }}>
          Cập nhật Trạng thái Vệ sinh - Phòng {room.roomNumber}
        </Modal.Title>
      </Modal.Header>
      <Form onSubmit={handleSubmit}>
        <Modal.Body>
          {error && (
            <Alert variant="danger" className="py-2" style={{ fontSize: '0.875rem' }}>
              {error}
            </Alert>
          )}

          {isUnderMaintenance && (
            <Alert variant="warning" className="py-2" style={{ fontSize: '0.875rem' }}>
              <strong>Cảnh báo:</strong> Phòng đang trong quá trình bảo trì. Quy trình nghiệp vụ không cho phép đổi trạng thái vệ sinh phòng khi đang bảo trì.
            </Alert>
          )}

          <div className="mb-3 p-3 bg-light rounded d-flex justify-content-between align-items-center">
            <div>
              <div className="text-muted small">Hạng phòng: <strong>{room.roomTypeName || room.roomType?.typeName}</strong></div>
              <div className="text-muted small">Tầng: <strong>{room.floor}</strong> | Lưu trú: <strong>{room.stayStatus || 'AVAILABLE'}</strong></div>
            </div>
            <div className="text-end">
              <div className="small text-muted mb-1">Hiện tại:</div>
              <StatusBadge status={room.cleaningStatus || 'DIRTY'} />
            </div>
          </div>

          <Form.Group className="mb-3">
            <Form.Label className="fw-semibold">
              Trạng thái Vệ sinh Mới <span className="text-danger">*</span>
            </Form.Label>
            <Form.Select
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value)}
              disabled={loading || isUnderMaintenance}
            >
              <option value="DIRTY">DIRTY (Cần dọn dẹp / Chưa vệ sinh)</option>
              <option value="CLEAN">CLEAN (Đã dọn dẹp / Sạch sẽ)</option>
              <option value="INSPECTED">INSPECTED (Đã kiểm tra chất lượng / Đạt chuẩn đón khách)</option>
            </Form.Select>
            <Form.Text className="text-muted">
              Chu trình vệ sinh chuẩn: DIRTY (bẩn) &rarr; CLEAN (đã dọn) &rarr; INSPECTED (giám sát nghiệm thu).
            </Form.Text>
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label className="fw-semibold">Ghi chú kiểm tra / thực hiện</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              maxLength={500}
              placeholder="VD: Đã thay drap giường, bổ sung khăn tắm và kiểm tra minibar..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={loading || isUnderMaintenance}
            />
            <div className="text-muted small text-end mt-1">{notes.length}/500 ký tự</div>
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={onHide} disabled={loading}>
            Hủy bỏ
          </Button>
          <Button variant="primary" type="submit" disabled={loading || isUnderMaintenance}>
            {loading ? (
              <>
                <Spinner size="sm" animation="border" className="me-2" />
                Đang lưu...
              </>
            ) : (
              'Cập nhật trạng thái'
            )}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
};

