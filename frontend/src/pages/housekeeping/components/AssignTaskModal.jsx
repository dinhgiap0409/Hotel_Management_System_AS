import { useState, useEffect } from 'react';
import { Modal, Button, Form, Alert, Spinner } from 'react-bootstrap';
import { roomApi } from '../../../services/roomApi';

export const AssignTaskModal = ({ show, onHide, preselectedRoom, rooms = [], onSuccess }) => {
  const [roomId, setRoomId] = useState('');
  const [staffList, setStaffList] = useState([]);
  const [assignedToStaffId, setAssignedToStaffId] = useState('');
  const [taskType, setTaskType] = useState('CLEANING');
  const [priority, setPriority] = useState('NORMAL');
  const [note, setNote] = useState('');
  const [estimatedCompletionDate, setEstimatedCompletionDate] = useState('');

  const [loadingStaff, setLoadingStaff] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Today date string for minimum date
  const todayStr = new Date().toISOString().split('T')[0];

  useEffect(() => {
    if (show) {
      if (preselectedRoom) {
        setRoomId(preselectedRoom.roomId);
      } else if (rooms.length > 0) {
        setRoomId(rooms[0].roomId);
      }
      setTaskType('CLEANING');
      setPriority('NORMAL');
      setNote('');
      setEstimatedCompletionDate(todayStr);
      setError(null);
      loadStaffList();
    }
  }, [show, preselectedRoom, rooms, todayStr]);

  const loadStaffList = async () => {
    setLoadingStaff(true);
    try {
      const res = await roomApi.getHousekeepingStaff();
      const list = res.data || [];
      setStaffList(list);
      if (list.length > 0) {
        setAssignedToStaffId(list[0].staffId);
      }
    } catch (err) {
      console.error('Failed to load housekeeping staff list:', err);
      setError('Không tải được danh sách nhân viên buồng phòng.');
    } finally {
      setLoadingStaff(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!roomId) {
      setError('Vui lòng chọn phòng cần phân công nhiệm vụ.');
      return;
    }
    if (!assignedToStaffId) {
      setError('Vui lòng chọn nhân viên thực hiện.');
      return;
    }

    setSubmitting(true);
    try {
      await roomApi.createHousekeepingTask({
        roomId: Number(roomId),
        assignedToStaffId: Number(assignedToStaffId),
        taskType: taskType,
        priority: priority,
        note: note.trim() || undefined,
        estimatedCompletionDate: estimatedCompletionDate || undefined,
        scheduledAt: new Date().toISOString(),
      });
      onSuccess?.('Phân công nhiệm vụ buồng phòng thành công!');
      onHide();
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Phân công nhiệm vụ thất bại.';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal show={show} onHide={onHide} centered backdrop="static">
      <Modal.Header closeButton>
        <Modal.Title style={{ fontSize: '1.15rem', fontWeight: 600 }}>
          Phân Công Nhiệm Vụ Buồng Phòng
        </Modal.Title>
      </Modal.Header>
      <Form onSubmit={handleSubmit}>
        <Modal.Body>
          {error && (
            <Alert variant="danger" className="py-2" style={{ fontSize: '0.875rem' }}>
              {error}
            </Alert>
          )}

          {/* Select Room */}
          <Form.Group className="mb-3">
            <Form.Label className="fw-semibold">
              Chọn Phòng <span className="text-danger">*</span>
            </Form.Label>
            {preselectedRoom ? (
              <Form.Control
                type="text"
                value={`Phòng ${preselectedRoom.roomNumber} (Tầng ${preselectedRoom.floor} - ${preselectedRoom.roomTypeName || preselectedRoom.roomType?.typeName})`}
                disabled
              />
            ) : (
              <Form.Select
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                disabled={submitting}
                required
              >
                <option value="">-- Chọn phòng --</option>
                {rooms.map((r) => (
                  <option key={r.roomId} value={r.roomId}>
                    Phòng {r.roomNumber} - Tầng {r.floor} [{r.cleaningStatus || 'DIRTY'} / {r.stayStatus || 'AVAILABLE'}]
                  </option>
                ))}
              </Form.Select>
            )}
          </Form.Group>

          {/* Select Staff */}
          <Form.Group className="mb-3">
            <Form.Label className="fw-semibold">
              Nhân viên phụ trách <span className="text-danger">*</span>
            </Form.Label>
            {loadingStaff ? (
              <div className="d-flex align-items-center text-muted small py-2">
                <Spinner size="sm" animation="border" className="me-2" />
                Đang tải danh sách nhân viên...
              </div>
            ) : (
              <Form.Select
                value={assignedToStaffId}
                onChange={(e) => setAssignedToStaffId(e.target.value)}
                disabled={submitting || staffList.length === 0}
                required
              >
                {staffList.length === 0 ? (
                  <option value="">Không có nhân viên khả dụng</option>
                ) : (
                  staffList.map((s) => (
                    <option key={s.staffId} value={s.staffId}>
                      {s.fullName} ({s.roleName || 'HOUSEKEEPING'}) - {s.email}
                    </option>
                  ))
                )}
              </Form.Select>
            )}
          </Form.Group>

          {/* Task Type */}
          <Form.Group className="mb-3">
            <Form.Label className="fw-semibold">
              Loại công việc <span className="text-danger">*</span>
            </Form.Label>
            <Form.Select
              value={taskType}
              onChange={(e) => setTaskType(e.target.value)}
              disabled={submitting}
            >
              <option value="CLEANING">CLEANING (Dọn dẹp vệ sinh phòng)</option>
              <option value="MAINTENANCE">MAINTENANCE (Kiểm tra bảo dưỡng thiết bị phòng)</option>
            </Form.Select>
          </Form.Group>

          {/* Priority (UC-51, V4) */}
          <Form.Group className="mb-3">
            <Form.Label className="fw-semibold">Mức ưu tiên</Form.Label>
            <Form.Select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              disabled={submitting}
            >
              <option value="LOW">LOW (Thấp)</option>
              <option value="NORMAL">NORMAL (Bình thường)</option>
              <option value="HIGH">HIGH (Cao)</option>
              <option value="URGENT">URGENT (Khẩn cấp)</option>
            </Form.Select>
          </Form.Group>

          {/* Completion Date */}
          <Form.Group className="mb-3">
            <Form.Label className="fw-semibold">Hạn hoàn tất</Form.Label>
            <Form.Control
              type="date"
              min={todayStr}
              value={estimatedCompletionDate}
              onChange={(e) => setEstimatedCompletionDate(e.target.value)}
              disabled={submitting}
            />
          </Form.Group>

          {/* Notes */}
          <Form.Group className="mb-3">
            <Form.Label className="fw-semibold">Yêu cầu cụ thể / Hướng dẫn dọn dẹp</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              maxLength={500}
              placeholder="VD: Thay ga giường cao cấp, bổ sung bàn chải và khử mùi phòng tắm..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={submitting}
            />
            <div className="text-muted small text-end mt-1">{note.length}/500 ký tự</div>
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={onHide} disabled={submitting}>
            Hủy bỏ
          </Button>
          <Button variant="primary" type="submit" disabled={submitting || staffList.length === 0}>
            {submitting ? (
              <>
                <Spinner size="sm" animation="border" className="me-2" />
                Đang giao việc...
              </>
            ) : (
              'Xác nhận Phân công'
            )}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
};

