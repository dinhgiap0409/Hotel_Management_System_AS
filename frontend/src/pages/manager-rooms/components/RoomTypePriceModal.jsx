import { useState, useEffect } from 'react';
import { Modal, Button, Table, Form, Alert } from 'react-bootstrap';
import { roomApi } from '../../../services/roomApi';
import { formatVND } from '../../../lib/money';
import { notifyToast } from '../../../lib/http';

const DAYS = [
  { day: 1, label: 'Thứ Hai' },
  { day: 2, label: 'Thứ Ba' },
  { day: 3, label: 'Thứ Tư' },
  { day: 4, label: 'Thứ Năm' },
  { day: 5, label: 'Thứ Sáu (Cuối tuần)' },
  { day: 6, label: 'Thứ Bảy (Cuối tuần)' },
  { day: 7, label: 'Chủ Nhật (Cuối tuần)' },
];

export const RoomTypePriceModal = ({ show, onHide, roomType, onSuccess }) => {
  const [prices, setPrices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().split('T')[0]);
  const [effectiveTo, setEffectiveTo] = useState('');

  useEffect(() => {
    if (show && roomType?.roomTypeId) {
      loadPrices();
    }
  }, [show, roomType]);

  const loadPrices = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await roomApi.getRoomTypePrices(roomType.roomTypeId);
      const existing = res.data || [];

      // Khởi tạo map cho 7 ngày trong tuần
      const initialPrices = DAYS.map((d) => {
        const found = existing.find((p) => p.dayOfWeek === d.day);
        return {
          dayOfWeek: d.day,
          label: d.label,
          price: found ? found.price : roomType.basePrice || 0,
          isActive: found ? found.isActive : true,
        };
      });

      if (existing.length > 0) {
        if (existing[0].effectiveFrom) setEffectiveFrom(existing[0].effectiveFrom);
        if (existing[0].effectiveTo) setEffectiveTo(existing[0].effectiveTo);
      }

      setPrices(initialPrices);
    } catch (err) {
      setErrorMsg('Không thể tải biểu giá theo thứ. Đã sử dụng giá cơ sở mặc định.');
      setPrices(
        DAYS.map((d) => ({
          dayOfWeek: d.day,
          label: d.label,
          price: roomType.basePrice || 0,
          isActive: true,
        }))
      );
    } finally {
      setLoading(false);
    }
  };

  const handlePriceChange = (dayOfWeek, newPrice) => {
    setPrices((prev) =>
      prev.map((item) => (item.dayOfWeek === dayOfWeek ? { ...item, price: newPrice } : item))
    );
  };

  const handleToggleActive = (dayOfWeek, isActive) => {
    setPrices((prev) =>
      prev.map((item) => (item.dayOfWeek === dayOfWeek ? { ...item, isActive } : item))
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!effectiveFrom) {
      setErrorMsg('Vui lòng chọn ngày bắt đầu áp dụng biểu giá.');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);
    try {
      const payload = {
        prices: prices.map((p) => ({
          dayOfWeek: p.dayOfWeek,
          price: Number(p.price) > 0 ? Number(p.price) : Number(roomType.basePrice),
          effectiveFrom,
          effectiveTo: effectiveTo || null,
          isActive: p.isActive,
        })),
      };

      await roomApi.updateRoomTypePrices(roomType.roomTypeId, payload);
      notifyToast({ type: 'SUCCESS', message: 'Cập nhật bảng giá theo thứ thành công!' });
      if (onSuccess) onSuccess();
      onHide();
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Lỗi khi lưu biểu giá theo thứ.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal show={show} onHide={onHide} centered backdrop="static" size="lg">
      <Modal.Header closeButton style={{ background: '#0f172a', color: '#fff' }}>
        <Modal.Title style={{ fontSize: 18, fontWeight: 600 }}>
          Bảng Giá Theo Thứ Trong Tuần — {roomType?.typeName}
        </Modal.Title>
      </Modal.Header>
      <Form onSubmit={handleSubmit}>
        <Modal.Body style={{ padding: 24 }}>
          {errorMsg && <Alert variant="danger" className="py-2 mb-3">{errorMsg}</Alert>}

          <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, marginBottom: 16 }}>
            <span style={{ fontSize: 13, color: '#475569' }}>
              Giá cơ sở niêm yết: <strong style={{ color: '#0f172a' }}>{formatVND(roomType?.basePrice)}</strong> / đêm.
              Bạn có thể điều chỉnh phụ trội cho các ngày cuối tuần (Thứ Sáu, Thứ Bảy, Chủ Nhật).
            </span>
          </div>

          <div className="row mb-3">
            <div className="col-md-6">
              <Form.Group>
                <Form.Label style={{ fontWeight: 600, fontSize: 13 }}>
                  Ngày bắt đầu áp dụng <span className="text-danger">*</span>
                </Form.Label>
                <Form.Control
                  type="date"
                  value={effectiveFrom}
                  onChange={(e) => setEffectiveFrom(e.target.value)}
                  required
                />
              </Form.Group>
            </div>
            <div className="col-md-6">
              <Form.Group>
                <Form.Label style={{ fontWeight: 600, fontSize: 13 }}>
                  Ngày kết thúc (Để trống nếu áp dụng vô hạn)
                </Form.Label>
                <Form.Control
                  type="date"
                  value={effectiveTo}
                  min={effectiveFrom}
                  onChange={(e) => setEffectiveTo(e.target.value)}
                />
              </Form.Group>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-4 text-muted">Đang tải biểu giá...</div>
          ) : (
            <Table bordered hover responsive style={{ fontSize: 14 }}>
              <thead style={{ background: '#f1f5f9' }}>
                <tr>
                  <th style={{ width: 180 }}>Thứ trong tuần</th>
                  <th>Đơn giá áp dụng (VNĐ / Đêm)</th>
                  <th style={{ width: 140, textAlign: 'center' }}>Áp dụng</th>
                </tr>
              </thead>
              <tbody>
                {prices.map((item) => (
                  <tr key={item.dayOfWeek}>
                    <td style={{ verticalAlign: 'middle', fontWeight: item.dayOfWeek >= 5 ? 700 : 500 }}>
                      {item.label}
                    </td>
                    <td>
                      <Form.Control
                        type="number"
                        step="10000"
                        min="10000"
                        value={item.price}
                        disabled={!item.isActive}
                        onChange={(e) => handlePriceChange(item.dayOfWeek, e.target.value)}
                        required={item.isActive}
                      />
                    </td>
                    <td style={{ verticalAlign: 'middle', textAlign: 'center' }}>
                      <Form.Check
                        type="switch"
                        id={`switch-day-${item.dayOfWeek}`}
                        checked={item.isActive}
                        onChange={(e) => handleToggleActive(item.dayOfWeek, e.target.checked)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={onHide} disabled={submitting}>
            Đóng
          </Button>
          <Button variant="primary" type="submit" disabled={submitting} style={{ background: '#0284c7', borderColor: '#0284c7' }}>
            {submitting ? 'Đang lưu...' : 'Lưu Biểu Giá Theo Thứ'}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
};
