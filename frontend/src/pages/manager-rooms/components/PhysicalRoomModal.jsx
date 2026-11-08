import { useState, useEffect } from 'react';
import { Modal, Button, Form, Alert } from 'react-bootstrap';
import { roomApi } from '../../../services/roomApi';
import { notifyToast } from '../../../lib/http';

export const PhysicalRoomModal = ({ show, onHide, room, roomTypes, onSuccess }) => {
  const isEdit = Boolean(room && room.roomId);

  const [formData, setFormData] = useState({
    roomTypeId: '',
    roomNumber: '',
    floor: 1,
    notes: '',
  });

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  useEffect(() => {
    if (room) {
      setFormData({
        roomTypeId: room.roomTypeId || room.roomType?.roomTypeId || '',
        roomNumber: room.roomNumber || '',
        floor: room.floor || 1,
        notes: room.notes || '',
      });
    } else {
      setFormData({
        roomTypeId: roomTypes && roomTypes.length > 0 ? roomTypes[0].roomTypeId : '',
        roomNumber: '',
        floor: 1,
        notes: '',
      });
    }
    setErrorMsg(null);
  }, [room, roomTypes, show]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!formData.roomNumber.trim()) {
      setErrorMsg('Vui lòng nhập số phòng.');
      return;
    }
    if (!formData.roomTypeId) {
      setErrorMsg('Vui lòng chọn hạng phòng.');
      return;
    }
    if (!formData.floor || Number(formData.floor) < 1) {
      setErrorMsg('Tầng lầu phải từ tầng 1 trở lên.');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        roomTypeId: Number(formData.roomTypeId),
        roomNumber: formData.roomNumber.trim(),
        floor: Number(formData.floor),
        notes: formData.notes.trim(),
      };

      if (isEdit) {
        await roomApi.updateRoom(room.roomId, payload);
        notifyToast({ type: 'SUCCESS', message: `Cập nhật thông tin phòng ${payload.roomNumber} thành công!` });
      } else {
        await roomApi.createRoom(payload);
        notifyToast({ type: 'SUCCESS', message: `Thêm mới phòng ${payload.roomNumber} thành công!` });
      }

      onSuccess();
      onHide();
    } catch (err) {
      const code = err.response?.data?.errorCode;
      if (code === 'MSG05A') {
        setErrorMsg('Số phòng đã tồn tại trong khách sạn. Vui lòng chọn số phòng khác.');
      } else {
        setErrorMsg(err.response?.data?.message || 'Không thể lưu thông tin phòng. Vui lòng kiểm tra lại.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal show={show} onHide={onHide} centered backdrop="static">
      <Modal.Header closeButton style={{ background: '#0f172a', color: '#fff' }}>
        <Modal.Title style={{ fontSize: 18, fontWeight: 600 }}>
          {isEdit ? `Cập Nhật Phòng Vật Lý #${room?.roomNumber}` : 'Thêm Mới Phòng Vật Lý'}
        </Modal.Title>
      </Modal.Header>
      <Form onSubmit={handleSubmit}>
        <Modal.Body style={{ padding: 24 }}>
          {errorMsg && <Alert variant="danger" className="py-2 mb-3">{errorMsg}</Alert>}

          <Form.Group className="mb-3">
            <Form.Label style={{ fontWeight: 600 }}>
              Hạng phòng liên kết <span className="text-danger">*</span>
            </Form.Label>
            <Form.Select
              name="roomTypeId"
              value={formData.roomTypeId}
              onChange={handleChange}
              required
            >
              <option value="">-- Chọn hạng phòng --</option>
              {roomTypes?.map((rt) => (
                <option key={rt.roomTypeId} value={rt.roomTypeId}>
                  {rt.typeName} (Tối đa {rt.capacity} khách)
                </option>
              ))}
            </Form.Select>
          </Form.Group>

          <div className="row">
            <div className="col-md-6 mb-3">
              <Form.Group>
                <Form.Label style={{ fontWeight: 600 }}>
                  Số phòng (Door No) <span className="text-danger">*</span>
                </Form.Label>
                <Form.Control
                  type="text"
                  name="roomNumber"
                  placeholder="Ví dụ: 101, 202, 305..."
                  value={formData.roomNumber}
                  onChange={handleChange}
                  maxLength={50}
                  required
                />
              </Form.Group>
            </div>
            <div className="col-md-6 mb-3">
              <Form.Group>
                <Form.Label style={{ fontWeight: 600 }}>
                  Tầng lầu <span className="text-danger">*</span>
                </Form.Label>
                <Form.Control
                  type="number"
                  name="floor"
                  min="1"
                  max="50"
                  value={formData.floor}
                  onChange={handleChange}
                  required
                />
              </Form.Group>
            </div>
          </div>

          <Form.Group className="mb-3">
            <Form.Label style={{ fontWeight: 600 }}>Ghi chú phòng</Form.Label>
            <Form.Control
              as="textarea"
              rows={2}
              name="notes"
              placeholder="Ví dụ: Phòng góc yên tĩnh, view hướng biển, cửa sổ trời..."
              value={formData.notes}
              onChange={handleChange}
              maxLength={500}
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={onHide} disabled={loading}>
            Hủy bỏ
          </Button>
          <Button variant="primary" type="submit" disabled={loading} style={{ background: '#0284c7', borderColor: '#0284c7' }}>
            {loading ? 'Đang lưu...' : isEdit ? 'Lưu Thay Đổi' : 'Thêm Phòng'}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
};

