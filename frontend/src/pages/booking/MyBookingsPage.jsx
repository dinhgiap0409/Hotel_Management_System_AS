import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button, Badge, Spinner, Alert, Modal } from 'react-bootstrap';
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
  const [cancelTarget, setCancelTarget] = useState(null);
  const [isCancelling, setIsCancelling] = useState(false);

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

  // UC-25: Hủy đặt phòng bằng Modal giao diện đẹp (thay thế window.confirm)
  const handleConfirmCancel = async () => {
    if (!cancelTarget) return;
    setIsCancelling(true);
    setError(null);
    setSuccess(null);
    try {
      await bookingApi.cancelReservation(cancelTarget.reservationId);
      setSuccess(`Đã hủy thành công đơn đặt phòng #${cancelTarget.reservationCode}.`);
      setCancelTarget(null);
      loadBookings();
    } catch (err) {
      setError(err.response?.data?.message || 'Không thể hủy đơn đặt phòng. Vui lòng thử lại.');
    } finally {
      setIsCancelling(false);
    }
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
            Theo dõi trạng thái đơn đặt phòng và thanh toán đặt cọc VNPay.
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
                  header: 'Trạng thái & Hạn thanh toán',
                  render: (b) => (
                    <div>
                      <StatusBadge status={b.status} />
                      {b.status === 'PENDING' && b.holdExpiresAt && (
                        <div className="small text-danger mt-1" style={{ fontSize: 11.5 }}>
                          Hạn thanh toán: {formatDateTime(b.holdExpiresAt)}
                        </div>
                      )}
                    </div>
                  ),
                },
                {
                  header: 'Thao tác & QR Thanh Toán',
                  render: (b) => (
                    <div className="d-flex gap-2 align-items-center">
                      {b.status === 'PENDING' && b.vnpayPaymentUrl && (
                        <div
                          className="d-flex align-items-center gap-2 p-1 bg-white border rounded"
                          style={{ borderColor: '#bfdbfe' }}
                        >
                          <img
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=52x52&margin=1&data=${encodeURIComponent(
                              b.vnpayPaymentUrl
                            )}`}
                            alt="QR Pay"
                            style={{ width: 38, height: 38, cursor: 'pointer', borderRadius: 4 }}
                            onClick={() => handlePayDeposit(b)}
                            title="Bấm hoặc quét mã QR để thanh toán cọc qua VNPay"
                          />
                          <Button
                            size="sm"
                            className="btn-hms-primary"
                            onClick={() => handlePayDeposit(b)}
                            style={{ fontSize: 12, padding: '4px 10px' }}
                          >
                            <i className="bi bi-credit-card me-1"></i>
                            Đặt cọc VNPay
                          </Button>
                        </div>
                      )}
                      {(b.status === 'PENDING' || b.status === 'CONFIRMED') && (
                        <Button
                          size="sm"
                          variant="outline-danger"
                          disabled={isCancelling && cancelTarget?.reservationId === b.reservationId}
                          onClick={() => setCancelTarget(b)}
                        >
                          <i className="bi bi-x-circle me-1"></i>
                          Hủy đặt phòng
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

      {/* Modal xác nhận hủy đơn đặt phòng (thay thế window.confirm) */}
      <Modal
        show={!!cancelTarget}
        onHide={() => !isCancelling && setCancelTarget(null)}
        centered
        backdrop="static"
        keyboard={!isCancelling}
      >
        <div style={{ borderRadius: 12, overflow: 'hidden' }}>
          <div
            style={{
              padding: '16px 20px',
              borderBottom: '1px solid #f1f5f9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: '#ffffff',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span
                style={{
                  background: '#fee2e2',
                  color: '#dc2626',
                  width: 34,
                  height: 34,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 16,
                }}
              >
                <i className="bi bi-exclamation-triangle-fill"></i>
              </span>
              <h5 style={{ margin: 0, fontWeight: 700, fontSize: 16, color: '#0f172a' }}>
                Xác Nhận Hủy Đặt Phòng
              </h5>
            </div>
            <button
              type="button"
              onClick={() => setCancelTarget(null)}
              disabled={isCancelling}
              style={{
                border: 'none',
                background: 'transparent',
                fontSize: 18,
                color: '#94a3b8',
                cursor: isCancelling ? 'not-allowed' : 'pointer',
                lineHeight: 1,
              }}
            >
              ✕
            </button>
          </div>

          <div style={{ padding: '20px', background: '#ffffff' }}>
            {cancelTarget && (
              <>
                <div
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: 8,
                    padding: '12px 16px',
                    marginBottom: 16,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontWeight: 700, fontFamily: 'monospace', fontSize: 14, color: '#0f172a' }}>
                      #{cancelTarget.reservationCode}
                    </span>
                    <span
                      style={{
                        fontSize: 12,
                        padding: '2px 8px',
                        borderRadius: 4,
                        fontWeight: 600,
                        background: '#e0f2fe',
                        color: '#0369a1',
                      }}
                    >
                      {cancelTarget.roomTypeName}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, color: '#64748b', display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span>Thời gian lưu trú:</span>
                    <strong style={{ color: '#334155' }}>
                      {formatDate(cancelTarget.checkInDate)} → {formatDate(cancelTarget.checkOutDate)}
                    </strong>
                  </div>
                  <div style={{ fontSize: 13, color: '#64748b', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Tiền đặt cọc (30%):</span>
                    <strong style={{ color: cancelTarget.depositPaymentStatus === 'PAID' || cancelTarget.status === 'CONFIRMED' ? '#dc2626' : '#64748b' }}>
                      {formatVND(cancelTarget.depositAmount)}{' '}
                      {cancelTarget.depositPaymentStatus === 'PAID' || cancelTarget.status === 'CONFIRMED' ? '(Đã cọc)' : '(Chưa cọc)'}
                    </strong>
                  </div>
                </div>

                {cancelTarget.depositPaymentStatus === 'PAID' || cancelTarget.status === 'CONFIRMED' ? (
                  <div
                    style={{
                      background: '#fffbeb',
                      border: '1px solid #fde68a',
                      borderRadius: 8,
                      padding: '12px 14px',
                      fontSize: 13,
                      color: '#92400e',
                      lineHeight: 1.5,
                    }}
                  >
                    <div style={{ fontWeight: 600, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <i className="bi bi-info-circle-fill" style={{ color: '#d97706' }}></i>
                      Lưu ý quan trọng về chính sách tiền cọc:
                    </div>
                    Đơn đặt phòng này <strong>đã được thanh toán tiền cọc {formatVND(cancelTarget.depositAmount)}</strong>. Theo quy định chính sách hủy phòng của khách sạn, nếu quý khách hủy đơn thì <strong>khoản tiền cọc này sẽ không được hoàn lại</strong>. Quý khách có chắc chắn muốn hủy đơn không?
                  </div>
                ) : (
                  <div
                    style={{
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: 8,
                      padding: '12px 14px',
                      fontSize: 13,
                      color: '#475569',
                      lineHeight: 1.5,
                    }}
                  >
                    Đơn đặt phòng đang ở trạng thái chờ thanh toán cọc. Khi hủy, đơn sẽ chuyển sang trạng thái <strong>HỦY (CANCELLED)</strong> ngay lập tức.
                  </div>
                )}
              </>
            )}
          </div>

          <div
            style={{
              padding: '12px 20px',
              borderTop: '1px solid #f1f5f9',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 10,
              background: '#f8fafc',
            }}
          >
            <Button
              variant="outline-secondary"
              size="sm"
              disabled={isCancelling}
              onClick={() => setCancelTarget(null)}
              style={{ padding: '6px 14px', fontSize: 13, borderRadius: 6 }}
            >
              Quay lại
            </Button>
            <Button
              variant="danger"
              size="sm"
              disabled={isCancelling}
              onClick={handleConfirmCancel}
              style={{ padding: '6px 14px', fontSize: 13, borderRadius: 6, fontWeight: 600 }}
            >
              {isCancelling ? (
                <>
                  <Spinner size="sm" animation="border" className="me-1" />
                  Đang hủy đơn...
                </>
              ) : (
                'Xác nhận hủy đặt phòng'
              )}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};