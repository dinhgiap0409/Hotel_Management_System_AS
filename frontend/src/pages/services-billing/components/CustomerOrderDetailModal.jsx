import { Modal, Button, Badge } from 'react-bootstrap';
import { formatVND } from '../../../lib/money';
import { formatDateTime } from '../../../lib/datetime';
import { formatOrderNotes } from './serviceUtils';

export const CustomerOrderDetailModal = ({
  customerDetailModal,
  onClose,
  friendlyRoomNumber,
}) => {
  if (!customerDetailModal) return null;

  return (
    <Modal show={!!customerDetailModal} onHide={onClose} centered>
      <Modal.Header closeButton style={{ background: '#FAF9F5', borderBottom: '1px solid #E8E6DC' }}>
        <Modal.Title style={{ fontSize: 16, fontWeight: 700, color: '#16233B' }}>
          {customerDetailModal?.mode === 'PRE_ORDER'
            ? 'Chi Tiết Lịch Đặt Trước Dịch Vụ'
            : `Chi Tiết Đơn Phục Vụ Tại Phòng #${customerDetailModal?.data?.serviceOrderId || ''}`}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body className="p-3" style={{ fontSize: 13.5 }}>
        {customerDetailModal?.mode === 'PRE_ORDER' && customerDetailModal.data && (
          <div className="d-flex flex-column gap-2">
            <div className="p-3 rounded-3" style={{ background: '#F0F9FF', border: '1px solid #BAE6FD' }}>
              <div className="fw-bold" style={{ fontSize: 15, color: '#0369A1' }}>
                {customerDetailModal.data.serviceName}
              </div>
              <div className="small text-secondary mt-1">
                Mã đặt phòng: <strong className="text-dark">#{customerDetailModal.data.reservationCode}</strong> • Hạng phòng:{' '}
                <strong className="text-dark">{customerDetailModal.data.roomTypeName}</strong>
              </div>
            </div>

            <div className="p-3 rounded-3" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
              <div className="row g-2">
                <div className="col-6">
                  <div className="text-secondary small">Số lượng đặt:</div>
                  <div className="fw-bold text-dark">{customerDetailModal.data.quantity} suất</div>
                </div>
                <div className="col-6">
                  <div className="text-secondary small">Trạng thái:</div>
                  {customerDetailModal.data.matchedOrder?.status === 'COMPLETED' ? (
                    <Badge bg="success">Đã tính vào tiền phòng</Badge>
                  ) : customerDetailModal.data.matchedOrder?.status === 'ORDERED' ? (
                    <Badge bg="primary">Đang phục vụ</Badge>
                  ) : customerDetailModal.data.isCheckedIn ? (
                    <Badge bg="warning" text="dark">Chờ phục vụ &amp; tính tiền</Badge>
                  ) : (
                    <Badge bg="info" text="dark">Đã ghi nhận (Chờ check-in)</Badge>
                  )}
                </div>
                <div className="col-12 mt-2">
                  <div className="text-secondary small">Thời gian hẹn phục vụ / đón tiếp:</div>
                  <div className="fw-semibold text-primary mt-0.5">
                    {customerDetailModal.data.scheduledTime || 'Trước khi nhận phòng (Tiêu chuẩn)'}
                  </div>
                </div>
                <div className="col-12 mt-2">
                  <div className="text-secondary small">Chi tiết chuyến bay / Yêu cầu ghi chú:</div>
                  <div
                    className="p-2 rounded-2 mt-1 text-dark"
                    style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', whiteSpace: 'pre-wrap' }}
                  >
                    {customerDetailModal.data.details || 'Không có ghi chú đặc biệt'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {customerDetailModal?.mode === 'ROOM_ORDER' && customerDetailModal.data && (
          <div className="d-flex flex-column gap-2">
            <div className="p-3 rounded-3" style={{ background: '#F0FDF4', border: '1px solid #BBF7D0' }}>
              <div className="d-flex justify-content-between align-items-start">
                <div>
                  <div className="fw-bold" style={{ fontSize: 15, color: '#166534' }}>
                    {customerDetailModal.data.serviceName}
                  </div>
                  <div className="small text-secondary mt-0.5">
                    Danh mục: {customerDetailModal.data.category || 'Dịch vụ phòng'} • Phòng: <strong>{friendlyRoomNumber}</strong>
                  </div>
                </div>
                <Badge
                  bg={
                    customerDetailModal.data.status === 'COMPLETED'
                      ? 'success'
                      : customerDetailModal.data.status === 'ORDERED' && customerDetailModal.data.staffConfirmed
                      ? 'primary'
                      : customerDetailModal.data.status === 'ORDERED'
                      ? 'warning'
                      : 'secondary'
                  }
                  text={
                    customerDetailModal.data.status === 'ORDERED' && !customerDetailModal.data.staffConfirmed
                      ? 'dark'
                      : 'white'
                  }
                >
                  {customerDetailModal.data.status === 'COMPLETED'
                    ? 'Đã phục vụ (COMPLETED)'
                    : customerDetailModal.data.status === 'ORDERED' && customerDetailModal.data.staffConfirmed
                    ? 'Đã xác nhận - Chờ phục vụ'
                    : customerDetailModal.data.status === 'ORDERED'
                    ? 'Chờ nhân viên xác nhận'
                    : 'Đã hủy (VOIDED)'}
                </Badge>
              </div>
            </div>

            <div className="p-3 rounded-3" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
              <div className="row g-2">
                <div className="col-6">
                  <div className="text-secondary small">Mã đơn dịch vụ:</div>
                  <div className="fw-bold text-dark">#{customerDetailModal.data.serviceOrderId}</div>
                </div>
                <div className="col-6">
                  <div className="text-secondary small">Thời gian đặt:</div>
                  <div className="fw-semibold text-dark">{formatDateTime(customerDetailModal.data.orderTime)}</div>
                </div>
                <div className="col-4 mt-2">
                  <div className="text-secondary small">Số lượng:</div>
                  <div className="fw-bold text-dark">{customerDetailModal.data.quantity}</div>
                </div>
                <div className="col-4 mt-2">
                  <div className="text-secondary small">Đơn giá:</div>
                  <div className="text-dark">{formatVND(customerDetailModal.data.unitPrice)}</div>
                </div>
                <div className="col-4 mt-2">
                  <div className="text-secondary small">Thành tiền:</div>
                  <div className="fw-bold" style={{ color: '#C96442' }}>
                    {formatVND(
                      customerDetailModal.data.totalAmount ||
                        customerDetailModal.data.unitPrice * customerDetailModal.data.quantity
                    )}
                  </div>
                </div>
                <div className="col-12 mt-2">
                  <div className="text-secondary small">Ghi chú / Thời gian muốn nhận tại phòng:</div>
                  <div
                    className="p-2 rounded-2 mt-1 text-dark"
                    style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', whiteSpace: 'pre-wrap' }}
                  >
                    {formatOrderNotes(customerDetailModal.data.notes) || 'Giao ngay tiêu chuẩn (Không có ghi chú riêng)'}
                  </div>
                </div>
                {customerDetailModal.data.status === 'VOIDED' && customerDetailModal.data.cancelReason && (
                  <div className="col-12 mt-2">
                    <div className="text-danger small fw-semibold">Lý do hủy đơn:</div>
                    <div
                      className="p-2 rounded-2 mt-1 text-danger"
                      style={{ background: '#FFF1F2', border: '1px solid #FFE4E6' }}
                    >
                      {customerDetailModal.data.cancelReason}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal.Body>
      <Modal.Footer style={{ borderTop: '1px solid #F1F5F9', padding: '10px 16px' }}>
        <Button
          variant="secondary"
          size="sm"
          onClick={onClose}
          style={{ fontSize: 12.5, borderRadius: 6 }}
        >
          Đóng
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

