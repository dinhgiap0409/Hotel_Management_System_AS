import { useState } from 'react';
import { Modal, Button, Alert } from 'react-bootstrap';
import { roomApi } from '../../../services/roomApi';
import { notifyToast } from '../../../lib/http';

export const ConfirmArchiveModal = ({ show, onHide, room, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const isOccupied = room?.stayStatus === 'OCCUPIED';

  const handleConfirm = async () => {
    if (isOccupied) {
      setErrorMsg('Phòng hiện đang có khách lưu trú (Occupied). Không thể đưa vào trạng thái lưu trữ.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    try {
      await roomApi.archiveRoom(room.roomId);
      notifyToast({ type: 'SUCCESS', message: `Đã đưa phòng ${room.roomNumber} vào trạng thái lưu trữ (Archived)!` });
      onSuccess();
      onHide();
    } catch (err) {
      const code = err.response?.data?.errorCode;
      if (code === 'MSG08A') {
        setErrorMsg('Phòng hiện đang có khách lưu trú. Không thể xóa hoặc lưu trữ.');
      } else {
        setErrorMsg(err.response?.data?.message || 'Có lỗi xảy ra khi lưu trữ phòng.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal show={show} onHide={onHide} centered backdrop="static">
      <Modal.Header closeButton style={{ background: '#dc2626', color: '#fff' }}>
        <Modal.Title style={{ fontSize: 18, fontWeight: 600 }}>
          Xác Nhận Lưu Trữ Phòng #{room?.roomNumber} (UC-17)
        </Modal.Title>
      </Modal.Header>
      <Modal.Body style={{ padding: 24 }}>
        {errorMsg && <Alert variant="danger">{errorMsg}</Alert>}

        {isOccupied ? (
          <Alert variant="warning" className="mb-0">
            <strong>Cảnh báo:</strong> Phòng <strong>{room?.roomNumber}</strong> hiện đang có khách lưu trú (Occupied).
            Theo quy định an toàn hệ thống, bạn chỉ được phép lưu trữ phòng khi phòng đang ở trạng thái Trống (Vacant).
          </Alert>
        ) : (
          <p className="mb-0 text-muted">
            Bạn có chắc chắn muốn đưa phòng <strong>{room?.roomNumber}</strong> (Tầng {room?.floor} - {room?.roomTypeName || room?.roomType?.typeName}) vào trạng thái lưu trữ (Archived) không?
            <br />
            <br />
            <em>Lưu ý: Phòng sau khi lưu trữ sẽ không xuất hiện trong sơ đồ đặt phòng hoặc bàn giao cho khách.</em>
          </p>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide} disabled={loading}>
          Hủy bỏ
        </Button>
        <Button
          variant="danger"
          onClick={handleConfirm}
          disabled={loading || isOccupied}
        >
          {loading ? 'Đang xử lý...' : 'Xác Nhận Lưu Trữ'}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};
