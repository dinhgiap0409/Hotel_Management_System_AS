import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button, Badge, Spinner, Alert } from 'react-bootstrap';
import { bookingApi } from '../../services/bookingApi';
import { DataTable } from '../../components/common/DataTable';
import { StatusBadge } from '../../components/common/StatusBadge';
import { formatVND } from '../../lib/money';
import { formatDate, formatDateTime } from '../../lib/datetime';
import '../../components/booking/css/bookingTheme.css';

export const MyBookingsPage = () => {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [cancellingId, setCancellingId] = useState(null);

  const loadBookings = () => {
    setLoading(true);
    setError(null);
    bookingApi
      .getMyReservations()
      .then((res) => {
        const list = res.data?.data || res.data || [];
        setBookings(Array.isArray(list) ? list : []);
      })
      .catch((err) => {
        setError(err.response?.data?.message || 'Không thể tải danh sách đặt phòng.');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadBookings();
  }, []);

  // UC-25: Huy dat phong. Chi hien nut Huy voi booking con huy duoc
  // (PENDING hoac CONFIRMED); backend chan huy khi da CHECKED_IN hoac
  // COMPLETED. Quy tac coc (user chot 06/11/2026, giu nguyen): huy thi
  // MAT coc da tra, khong hoan tien. Chi truong hop da tra coc moi hien
  // luu y mat coc; booking chua tra coc / chi moi giu cho thi huy khong
  // mat gi nen chi hoi xac nhan binh thuong, khong ghi ve tien.
  // Khong co component xac nhan dung chung trong app nen dung
  // window.confirm.
  const handleCancelBooking = (b) => {
    if (!b) return;
    const isPaid = b.depositPaymentStatus === 'PAID' || b.status === 'CONFIRMED';
    const message = isPaid
      ? `Quý khách lưu ý: đơn đặt phòng ${b.reservationCode} đã được thanh toán đặt cọc ${formatVND(b.depositAmount)}. Nếu hủy đơn này, khoản đặt cọc sẽ không được hoàn lại. Quý khách có chắc chắn muốn hủy không?`
      : `Quý khách có chắc chắn muốn hủy đơn đặt phòng ${b.reservationCode} không?`;
    if (!window.confirm(message)) return;
    setCancellingId(b.reservationId);
    setError(null);
    setSuccess(null);
    // Backend khong nhan query param reason (controller chi nhan
    // reservationId) nen goi khong truyen reason.
    bookingApi
      .cancelReservation(b.reservationId)
      .then(() => {
        setSuccess(`Đã hủy đơn đặt phòng ${b.reservationCode}.`);
        loadBookings();
      })
      .catch((err) => {
        setError(err.response?.data?.message || 'Không thể hủy đơn đặt phòng. Vui lòng thử lại.');
      })
      .finally(() => setCancellingId(null));
  };

  const handlePayDeposit = (b) => {
    if (!b?.vnpayPaymentUrl) return;
    if (b.vnpayPaymentUrl.startsWith('http://localhost:5173')) {
      const urlObj = new URL(b.vnpayPaymentUrl);
      navigate(`${urlObj.pathname}${urlObj.search}`);
    } else {
      window.location.href = b.vnpayPaymentUrl;
    }
  };

  return (
    <div className="py-2">
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-4">
        <div>
          <h2 className="h4 fw-bold text-dark mb-1">Đặt phòng của tôi</h2>
          <p className="text-secondary small mb-0">
            Theo dõi trạng thái đơn đặt phòng, thời hạn giữ chỗ 24h và thanh toán đặt cọc VNPay.
          </p>
        </div>
        <Button className="btn-hms-primary" onClick={() => navigate('/rooms')}>
          <i className="bi bi-plus-circle me-2"></i>
          Đặt thêm phòng mới
        </Button>
      </div>

      {error && (
        <Alert variant="danger" className="rounded-3 small">
          {error}
        </Alert>
      )}

      {success && (
        <Alert variant="success" className="rounded-3 small">
          {success}
        </Alert>
      )}

      {loading ? (
        <Card className="border-0 shadow-sm rounded-4 text-center py-5">
          <Card.Body>
            <Spinner animation="border" variant="secondary" className="mb-2" />
            <div className="text-secondary small">Đang tải danh sách đơn đặt phòng...</div>
          </Card.Body>
        </Card>
      ) : (
        <Card className="border-0 shadow-sm rounded-4 overflow-hidden">
          <Card.Body className="p-0">
            <DataTable
              keyField="reservationId"
              data={bookings}
              columns={[
                {
                  header: 'Mã Booking',
                  render: (b) => (
                    <div>
                      <strong className="text-dark">{b.reservationCode}</strong>
                      <div className="small text-secondary">
                        {b.guestCount} khách • {b.nights} đêm
                      </div>
                    </div>
                  ),
                },
                {
                  header: 'Hạng phòng',
                  render: (b) => (
                    <div>
                      <strong className="text-dark">{b.roomTypeName}</strong>
                      <div className="small text-secondary">Số lượng: {b.roomQuantity} phòng</div>
                    </div>
                  ),
                },
                {
                  header: 'Nhận → Trả phòng',
                  render: (b) => (
                    <div className="small">
                      <div>Nhận: <strong>{formatDate(b.checkInDate)}</strong></div>
                      <div>Trả: <strong>{formatDate(b.checkOutDate)}</strong></div>
                    </div>
                  ),
                },
                {
                  header: 'Tổng tiền & Đặt cọc',
                  render: (b) => {
                    const isPaid = b.depositPaymentStatus === 'PAID' || b.status === 'CONFIRMED' || b.status === 'COMPLETED';
                    return (
                      <div>
                        <strong style={{ color: '#B45309' }}>{formatVND(b.estimatedTotal)}</strong>
                        <div className="small text-secondary">
                          Cọc 30%: {formatVND(b.depositAmount)}{' '}
                          <Badge
                            bg={isPaid ? 'success' : 'secondary'}
                            className="ms-1"
                          >
                            {isPaid ? 'Đã cọc' : 'Chờ cọc'}
                          </Badge>
                        </div>
                      </div>
                    );
                  },
                },
                {
                  header: 'Trạng thái & Hạn giữ chỗ',
                  render: (b) => (
                    <div>
                      <StatusBadge status={b.status} />
                      {b.status === 'PENDING' && b.holdExpiresAt && (
                        <div className="small text-danger mt-1" style={{ fontSize: 11.5 }}>
                          Giữ đến: {formatDateTime(b.holdExpiresAt)}
                        </div>
                      )}
                    </div>
                  ),
                },
                {
                  header: 'Thao tác',
                  render: (b) => (
                    <div className="d-flex gap-2">
                      {b.status === 'PENDING' && b.vnpayPaymentUrl && (
                        <Button
                          size="sm"
                          className="btn-hms-primary"
                          onClick={() => handlePayDeposit(b)}
                        >
                          <i className="bi bi-credit-card me-1"></i>
                          Đặt cọc VNPay
                        </Button>
                      )}
                      {(b.status === 'PENDING' || b.status === 'CONFIRMED') && (
                        <Button
                          size="sm"
                          variant="outline-danger"
                          disabled={cancellingId === b.reservationId}
                          onClick={() => handleCancelBooking(b)}
                        >
                          <i className="bi bi-x-circle me-1"></i>
                          {cancellingId === b.reservationId ? 'Đang hủy...' : 'Hủy đặt phòng'}
                        </Button>
                      )}
                    </div>
                  ),
                },
              ]}
            />
          </Card.Body>
        </Card>
      )}
    </div>
  );
};
