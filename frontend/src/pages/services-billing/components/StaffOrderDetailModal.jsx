import { formatVND } from '../../../lib/money';
import { formatDate, formatDateTime } from '../../../lib/datetime';
import { StatusBadge } from '../../../components/common/StatusBadge';
import { formatOrderNotes } from './serviceUtils';

export const StaffOrderDetailModal = ({
  detailModalData,
  onClose,
  canConfirm,
  canComplete,
  canVoid,
  canCreateOrder,
  onOpenConfirmOrderModal,
  onOpenCompleteOrderConfirm,
  onOpenVoidModal,
  onOpenQuickLoadAndCompleteConfirm,
  onCancelPreOrder,
}) => {
  if (!detailModalData) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.6)',
        backdropFilter: 'blur(3px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1055,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 12,
          padding: 24,
          width: 520,
          maxWidth: '94vw',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#0f172a' }}>
              {detailModalData.type === 'ROOM_ORDER'
                ? `Chi Tiết Đơn Dịch Vụ Phòng #${detailModalData.order?.serviceOrderId}`
                : `Chi Tiết Lịch Dịch Vụ Đặt Trước`}
            </h3>
            <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 2 }}>
              {detailModalData.type === 'ROOM_ORDER'
                ? `Phòng ${detailModalData.order?.roomNumber || '—'} • Khách: ${detailModalData.order?.guestName || '—'}`
                : `Mã Booking: #${detailModalData.reservation?.reservationCode} • Khách: ${detailModalData.reservation?.contactName}`}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: 18,
              color: '#64748b',
              cursor: 'pointer',
            }}
          >
            ✕
          </button>
        </div>

        {detailModalData.type === 'ROOM_ORDER' && detailModalData.order && (
          <div style={{ fontSize: 13.5, color: '#334155' }}>
            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: 8,
                padding: 14,
                marginBottom: 14,
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 10,
              }}
            >
              <div>
                <div style={{ fontSize: 11.5, color: '#64748b' }}>Phòng lưu trú</div>
                <strong style={{ color: '#0284c7', fontSize: 15 }}>Phòng {detailModalData.order.roomNumber}</strong>
              </div>
              <div>
                <div style={{ fontSize: 11.5, color: '#64748b' }}>Khách hàng</div>
                <strong>{detailModalData.order.guestName || '—'}</strong>
              </div>
              <div>
                <div style={{ fontSize: 11.5, color: '#64748b' }}>Tên dịch vụ</div>
                <strong style={{ color: '#0f172a' }}>{detailModalData.order.serviceName}</strong>
              </div>
              <div>
                <div style={{ fontSize: 11.5, color: '#64748b' }}>Số lượng & Đơn giá</div>
                <strong>
                  {detailModalData.order.quantity} {detailModalData.order.billingUnit} × {formatVND(detailModalData.order.unitPrice)}
                </strong>
              </div>
              <div>
                <div style={{ fontSize: 11.5, color: '#64748b' }}>Thời gian đặt</div>
                <strong>{formatDateTime(detailModalData.order.orderTime)}</strong>
              </div>
              <div>
                <div style={{ fontSize: 11.5, color: '#64748b' }}>Tổng thành tiền</div>
                <strong style={{ color: '#16a34a', fontSize: 15 }}>{formatVND(detailModalData.order.totalAmount)}</strong>
              </div>
              {detailModalData.matchedStay && (
                <div style={{ gridColumn: '1 / -1', background: '#f1f5f9', padding: '6px 10px', borderRadius: 6 }}>
                  <div style={{ fontSize: 11, color: '#64748b' }}>Thời gian lưu trú của phòng:</div>
                  <div style={{ fontSize: 12.5, color: '#0f172a' }}>
                    Nhận phòng: <strong>{formatDate(detailModalData.matchedStay.checkInDate || detailModalData.matchedStay.actualCheckIn)}</strong> • Trả phòng: <strong>{formatDate(detailModalData.matchedStay.checkOutDate || detailModalData.matchedStay.actualCheckOut)}</strong>
                  </div>
                </div>
              )}
            </div>

            {/* Khối hiển thị Ghi chú / Lịch hẹn phục vụ của khách */}
            <div
              style={{
                background: '#fffbeb',
                border: '1px solid #fde68a',
                borderRadius: 8,
                padding: 12,
                marginBottom: 14,
              }}
            >
              <div style={{ fontWeight: 700, color: '#92400e', fontSize: 12.5, marginBottom: 4 }}>
                Ghi chú phục vụ &amp; Thời gian khách yêu cầu:
              </div>
              <div style={{ color: '#78350f', fontSize: 13.5 }}>
                {formatOrderNotes(detailModalData.order.notes) || 'Khách không kèm ghi chú đặc biệt (Phục vụ theo tiêu chuẩn)'}
              </div>
            </div>

            {detailModalData.order.status === 'VOIDED' && detailModalData.order.cancelReason && (
              <div
                style={{
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: 8,
                  padding: 12,
                  marginBottom: 14,
                  color: '#991b1b',
                }}
              >
                <strong>Lý do hủy đơn:</strong> {detailModalData.order.cancelReason}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 18 }}>
              <div>
                {detailModalData.order.status === 'ORDERED' ? (
                  detailModalData.order.staffConfirmed ? (
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '4px 10px',
                        borderRadius: 9999,
                        fontSize: 12,
                        fontWeight: 600,
                        backgroundColor: '#dbeafe',
                        color: '#1e40af',
                      }}
                    >
                      Chờ phục vụ (Đã xác nhận - Khóa hủy)
                    </span>
                  ) : (
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '4px 10px',
                        borderRadius: 9999,
                        fontSize: 12,
                        fontWeight: 600,
                        backgroundColor: '#fef9c3',
                        color: '#854d0e',
                      }}
                    >
                      Chờ nhân viên xác nhận
                    </span>
                  )
                ) : (
                  <StatusBadge status={detailModalData.order.status} />
                )}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {detailModalData.order.status === 'ORDERED' && !detailModalData.order.staffConfirmed && canConfirm && (
                  <button
                    type="button"
                    onClick={() => {
                      const ord = detailModalData.order;
                      onClose();
                      onOpenConfirmOrderModal(ord);
                    }}
                    style={{
                      background: '#0284c7',
                      color: '#fff',
                      border: 'none',
                      padding: '7px 14px',
                      borderRadius: 6,
                      fontWeight: 600,
                      fontSize: 13,
                      cursor: 'pointer',
                    }}
                  >
                    Xác nhận đơn
                  </button>
                )}
                {detailModalData.order.status === 'ORDERED' && detailModalData.order.staffConfirmed && canComplete && (
                  <button
                    type="button"
                    onClick={() => {
                      const ord = detailModalData.order;
                      onClose();
                      onOpenCompleteOrderConfirm(ord);
                    }}
                    style={{
                      background: '#16a34a',
                      color: '#fff',
                      border: 'none',
                      padding: '7px 14px',
                      borderRadius: 6,
                      fontWeight: 600,
                      fontSize: 13,
                      cursor: 'pointer',
                    }}
                  >
                    Xác nhận Hoàn thành
                  </button>
                )}
                {detailModalData.order?.status === 'ORDERED' && !detailModalData.order?.staffConfirmed && canVoid && (
                  <button
                    type="button"
                    onClick={() => {
                      const ord = detailModalData.order;
                      onClose();
                      onOpenVoidModal(ord);
                    }}
                    style={{
                      background: '#fee2e2',
                      color: '#dc2626',
                      border: '1px solid #fecaca',
                      padding: '7px 14px',
                      borderRadius: 6,
                      fontWeight: 600,
                      fontSize: 13,
                      cursor: 'pointer',
                    }}
                  >
                    Hủy đơn
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  style={{
                    background: '#f1f5f9',
                    color: '#475569',
                    border: 'none',
                    padding: '7px 16px',
                    borderRadius: 6,
                    fontWeight: 600,
                    fontSize: 13,
                    cursor: 'pointer',
                  }}
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        )}

        {detailModalData.type === 'PRE_ORDER' && detailModalData.item && (
          <div style={{ fontSize: 13.5, color: '#334155' }}>
            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: 8,
                padding: 14,
                marginBottom: 14,
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 10,
              }}
            >
              <div>
                <div style={{ fontSize: 11.5, color: '#64748b' }}>Khách hàng & Liên hệ</div>
                <strong>{detailModalData.reservation?.contactName}</strong>
                <div style={{ fontSize: 12, color: '#64748b' }}>SĐT: {detailModalData.reservation?.contactPhone}</div>
              </div>
              <div>
                <div style={{ fontSize: 11.5, color: '#64748b' }}>Lịch lưu trú</div>
                <div>Nhận: <strong>{formatDate(detailModalData.reservation?.checkInDate)}</strong></div>
                <div>Trả: <strong>{formatDate(detailModalData.reservation?.checkOutDate)}</strong></div>
              </div>
              <div>
                <div style={{ fontSize: 11.5, color: '#64748b' }}>Dịch vụ đặt trước</div>
                <strong style={{ color: '#0f172a', fontSize: 14.5 }}>{detailModalData.item.serviceName}</strong>
              </div>
              <div>
                <div style={{ fontSize: 11.5, color: '#64748b' }}>Số lượng yêu cầu</div>
                <strong style={{ color: '#ea580c', fontSize: 14.5 }}>{detailModalData.item.quantity} suất</strong>
              </div>
              <div>
                <div style={{ fontSize: 11.5, color: '#64748b' }}>Trạng thái nhận phòng</div>
                {detailModalData.matchedStay ? (
                  <strong style={{ color: '#166534' }}>Đã nhận Phòng {detailModalData.matchedStay.roomNumber}</strong>
                ) : (
                  <strong style={{ color: '#b45309' }}>Khách chưa nhận phòng</strong>
                )}
              </div>
              <div>
                <div style={{ fontSize: 11.5, color: '#64748b' }}>Trạng thái phục vụ &amp; Tiền phòng</div>
                {detailModalData.existingOrder?.status === 'COMPLETED' ? (
                  <strong style={{ color: '#166534' }}>Đã hoàn thành &amp; Tính tiền phòng (#{detailModalData.existingOrder.serviceOrderId})</strong>
                ) : detailModalData.existingOrder?.status === 'ORDERED' ? (
                  <strong style={{ color: '#b45309' }}>Đang phục vụ (#{detailModalData.existingOrder.serviceOrderId})</strong>
                ) : detailModalData.matchedStay ? (
                  <strong style={{ color: '#b45309' }}>Chờ tính vào tiền phòng</strong>
                ) : (
                  <strong style={{ color: '#0369a1' }}>Đã ghi nhận lịch hẹn (Chờ check-in)</strong>
                )}
              </div>
            </div>

            {/* Khối Lịch Hẹn & Ghi Chú Chi Tiết */}
            <div
              style={{
                background: '#fffbeb',
                border: '1px solid #fde68a',
                borderRadius: 8,
                padding: 14,
                marginBottom: 16,
              }}
            >
              <div style={{ marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: '#92400e', fontWeight: 700, display: 'block' }}>
                  Thời gian khách hẹn nhận dịch vụ:
                </span>
                <strong style={{ fontSize: 14.5, color: '#b45309' }}>
                  {detailModalData.item.time || 'Phục vụ trong thời gian lưu trú'}
                </strong>
              </div>
              <div style={{ borderTop: '1px dashed #fcd34d', paddingTop: 8 }}>
                <span style={{ fontSize: 12, color: '#92400e', fontWeight: 700, display: 'block' }}>
                  Ghi chú &amp; Yêu cầu đặc biệt của khách:
                </span>
                <div style={{ fontSize: 13.5, color: '#0f172a', marginTop: 2, fontWeight: 500 }}>
                  {detailModalData.item.detail && detailModalData.item.detail !== 'Không'
                    ? detailModalData.item.detail
                    : 'Không có ghi chú riêng (Chuẩn bị theo tiêu chuẩn)'}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              {!detailModalData.existingOrder && canComplete && !detailModalData.matchedStay && (
                <div
                  style={{
                    background: '#eff6ff',
                    border: '1px solid #bfdbfe',
                    borderRadius: 6,
                    padding: '7px 12px',
                    fontSize: 12,
                    color: '#1e40af',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <span>Khách chưa nhận phòng. Cần chờ lễ tân làm thủ tục check-in để tạo mã lưu trú (Stay) trước khi có thể tính vào tiền phòng.</span>
                </div>
              )}
              {!detailModalData.existingOrder && canComplete && detailModalData.matchedStay && (
                <button
                  type="button"
                  onClick={() => {
                    const { matchedStay, item } = detailModalData;
                    onClose();
                    onOpenQuickLoadAndCompleteConfirm(matchedStay, item);
                  }}
                  style={{
                    background: '#16a34a',
                    color: '#fff',
                    border: 'none',
                    padding: '8px 14px',
                    borderRadius: 6,
                    fontWeight: 600,
                    fontSize: 13,
                    cursor: 'pointer',
                  }}
                >
                  Hoàn thành &amp; Tính tiền phòng
                </button>
              )}
              {detailModalData.existingOrder?.status === 'ORDERED' && canComplete && (
                <button
                  type="button"
                  onClick={() => {
                    const ord = detailModalData.existingOrder;
                    onClose();
                    onOpenCompleteOrderConfirm(ord);
                  }}
                  style={{
                    background: '#15803d',
                    color: '#fff',
                    border: 'none',
                    padding: '8px 14px',
                    borderRadius: 6,
                    fontWeight: 600,
                    fontSize: 13,
                    cursor: 'pointer',
                  }}
                >
                  Hoàn thành đơn #{detailModalData.existingOrder.serviceOrderId}
                </button>
              )}
              {(!detailModalData.existingOrder || (detailModalData.existingOrder?.status === 'ORDERED' && !detailModalData.existingOrder?.staffConfirmed)) && canCreateOrder && (
                <button
                  type="button"
                  onClick={() => {
                    const { reservation, item } = detailModalData;
                    onClose();
                    onCancelPreOrder(reservation, item);
                  }}
                  style={{
                    background: '#fee2e2',
                    color: '#dc2626',
                    border: '1px solid #fecaca',
                    padding: '8px 14px',
                    borderRadius: 6,
                    fontWeight: 600,
                    fontSize: 13,
                    cursor: 'pointer',
                  }}
                >
                  Hủy đặt trước
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                style={{
                  background: '#f1f5f9',
                  color: '#475569',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: 6,
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                Đóng
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

