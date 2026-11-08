import { DataTable } from '../../../components/common/DataTable';
import { StatusBadge } from '../../../components/common/StatusBadge';
import { formatVND } from '../../../lib/money';
import { formatDateTime } from '../../../lib/datetime';
import { formatOrderNotes, inputStyle, isOrderUrgent as checkIsOrderUrgent } from './serviceUtils';
import { PaginationControl } from './PaginationControl';

export const ServiceOrdersTab = ({
  orderSearchKeyword,
  setOrderSearchKeyword,
  setOrderPage,
  orderStatusFilter,
  setOrderStatusFilter,
  filteredOrders,
  orders,
  canCreateOrder,
  handleOpenCreateOrder,
  paginatedOrders,
  activeStays,
  setDetailModalData,
  canConfirm,
  handleOpenConfirmOrderModal,
  canComplete,
  handleOpenCompleteOrderConfirm,
  canVoid,
  handleOpenVoidModal,
  busy,
  orderPage,
  totalOrderPages,
  orderPageSize,
  setOrderPageSize,
  urgentAlerts = [],
}) => {
  const checkUrgent = (o) => checkIsOrderUrgent(o, urgentAlerts, activeStays);
  const displayOrders = paginatedOrders;

  return (
    <div>
      {/* Bộ lọc đơn dịch vụ phòng */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="Tìm mã đơn, phòng, tên món, ghi chú..."
            value={orderSearchKeyword}
            onChange={(e) => {
              setOrderSearchKeyword(e.target.value);
              setOrderPage(1);
            }}
            style={{ ...inputStyle, width: 260 }}
          />
          <select
            value={orderStatusFilter}
            onChange={(e) => {
              setOrderStatusFilter(e.target.value);
              setOrderPage(1);
            }}
            style={{ ...inputStyle, width: 230 }}
          >
            <option value="">Tất cả trạng thái</option>
            <option value="PENDING_CONFIRM">Chờ xác nhận (Khách mới đặt)</option>
            <option value="WAITING_SERVICE">Chờ phục vụ (Đã xác nhận)</option>
            <option value="COMPLETED">COMPLETED (Đã hoàn thành)</option>
            <option value="VOIDED">VOIDED (Đã hủy dịch vụ)</option>
          </select>
          {(orderStatusFilter || orderSearchKeyword) && (
            <button
              type="button"
              onClick={() => {
                setOrderStatusFilter('');
                setOrderSearchKeyword('');
                setOrderPage(1);
              }}
              style={{
                background: '#f1f5f9',
                border: '1px solid #cbd5e1',
                borderRadius: 6,
                padding: '6px 12px',
                fontSize: 12.5,
                cursor: 'pointer',
                color: '#475569',
              }}
            >
              Xóa lọc
            </button>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 13, color: '#64748b' }}>
            Hiển thị <strong>{filteredOrders.length}</strong> / {orders.length} đơn dịch vụ
          </div>
          {canCreateOrder && (
            <button
              type="button"
              onClick={handleOpenCreateOrder}
              style={{
                background: '#0284c7',
                color: '#fff',
                border: 'none',
                padding: '7px 14px',
                borderRadius: 6,
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: 13,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                boxShadow: '0 1px 2px rgba(2, 132, 199, 0.2)',
              }}
            >
              <span>+</span> Đặt Dịch Vụ Cho Phòng
            </button>
          )}
        </div>
      </div>

      <DataTable
        keyField="serviceOrderId"
        data={displayOrders}
        emptyMessage="Chưa có đơn gọi dịch vụ nào."
        getRowStyle={(o) => {
          if (checkUrgent(o)) {
            return {
              backgroundColor: '#fff1f2',
              boxShadow: 'inset 4px 0 0 #dc2626',
            };
          }
          return null;
        }}
        columns={[
          {
            header: 'Mã Đơn',
            width: 90,
            minWidth: 80,
            nowrap: true,
            render: (o) => <span style={{ color: '#64748b', fontWeight: 500 }}>#{o.serviceOrderId}</span>,
          },
          {
            header: 'Phòng & Khách Lưu Trú',
            minWidth: 200,
            render: (o) => {
              const isUrgent = checkUrgent(o);
              return (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2, flexWrap: 'wrap' }}>
                    <span
                      style={{
                        fontWeight: 700,
                        background: isUrgent ? '#fee2e2' : '#e0e7ff',
                        color: isUrgent ? '#b91c1c' : '#3730a3',
                        fontSize: 12,
                        padding: '2px 8px',
                        borderRadius: 6,
                        whiteSpace: 'nowrap',
                        border: isUrgent ? '1px solid #fca5a5' : 'none',
                      }}
                    >
                      {o.roomNumber ? `P.${o.roomNumber}` : '—'}
                    </span>
                    <strong style={{ color: '#0f172a' }}>{o.guestName || 'Khách vãng lai'}</strong>
                    {isUrgent && (
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: '#dc2626',
                          background: '#fff',
                          border: '1px solid #f87171',
                          padding: '1px 6px',
                          borderRadius: 4,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 3,
                          boxShadow: '0 1px 2px rgba(220, 38, 38, 0.1)',
                        }}
                      >
                        🚨 CHECK-OUT GẤP
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 11.5, color: '#64748b', whiteSpace: 'nowrap' }}>
                    Stay #{o.stayId} {o.reservationCode ? `• ${o.reservationCode}` : ''}
                  </div>
                </div>
              );
            },
          },
          {
            header: 'Dịch Vụ Sử Dụng',
            minWidth: 200,
            render: (o) => (
              <div>
                <strong style={{ color: '#0f172a' }}>{o.serviceName}</strong>
                <div style={{ fontSize: 12, color: '#64748b' }}>
                  Số lượng: <strong>{o.quantity}</strong> {o.billingUnit}
                </div>
                {o.notes && (
                  <div
                    style={{
                      marginTop: 3,
                      fontSize: 11.5,
                      color: '#64748b',
                      lineHeight: 1.35,
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 4,
                    }}
                  >
                    <span style={{ color: '#94a3b8' }}>↳</span>
                    <span>{formatOrderNotes(o.notes)}</span>
                  </div>
                )}
              </div>
            ),
          },
          {
            header: 'Thành Tiền',
            minWidth: 140,
            nowrap: true,
            render: (o) => (
              <div>
                <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 14 }}>
                  {formatVND(o.totalAmount)}
                </div>
                <div style={{ fontSize: 11, color: '#64748b', whiteSpace: 'nowrap' }}>
                  {formatVND(o.unitPrice)} / {o.billingUnit}
                </div>
              </div>
            ),
          },
          {
            header: 'Thời Gian',
            minWidth: 140,
            nowrap: true,
            render: (o) => (
              <div style={{ fontSize: 12.5, whiteSpace: 'nowrap' }}>
                <div>{formatDateTime(o.orderTime)}</div>
                {o.completedAt && (
                  <div style={{ color: '#16a34a', fontSize: 11, marginTop: 2 }}>
                    Xong: {formatDateTime(o.completedAt)}
                  </div>
                )}
                {o.cancelledAt && (
                  <div style={{ color: '#dc2626', fontSize: 11, marginTop: 2 }}>
                    Hủy: {formatDateTime(o.cancelledAt)}
                  </div>
                )}
              </div>
            ),
          },
          {
            header: 'Trạng Thái',
            minWidth: 150,
            nowrap: true,
            render: (o) => {
              const isUrgent = checkUrgent(o);
              return (
                <div>
                  {isUrgent && (
                    <div style={{ marginBottom: 4 }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '3px 8px',
                          borderRadius: 12,
                          fontSize: 10.5,
                          fontWeight: 700,
                          backgroundColor: '#dc2626',
                          color: '#fff',
                          boxShadow: '0 0 0 2px rgba(220, 38, 38, 0.25)',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        🔥 GẤP: CHỜ QUYẾT TOÁN
                      </span>
                    </div>
                  )}
                  {o.status === 'ORDERED' ? (
                    o.staffConfirmed ? (
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '4px 10px',
                          borderRadius: 14,
                          fontSize: 12,
                          fontWeight: 600,
                          backgroundColor: '#dbeafe',
                          color: '#1e40af',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        Chờ phục vụ
                      </span>
                    ) : (
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '4px 10px',
                          borderRadius: 14,
                          fontSize: 12,
                          fontWeight: 600,
                          backgroundColor: '#fef9c3',
                          color: '#854d0e',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        Chờ xác nhận
                      </span>
                    )
                  ) : (
                    <StatusBadge status={o.status} />
                  )}
                  {o.status === 'VOIDED' && o.cancelReason && (
                    <div
                      style={{
                        marginTop: 4,
                        fontSize: 11.5,
                        color: '#991b1b',
                        background: '#fef2f2',
                        padding: '3px 6px',
                        borderRadius: 4,
                        maxWidth: 220,
                        lineHeight: 1.3,
                        border: '1px solid #fee2e2',
                      }}
                    >
                      <strong>Lý do:</strong> {o.cancelReason}
                    </div>
                  )}
                </div>
              );
            },
          },
          {
            header: 'Thao Tác',
            minWidth: 140,
            nowrap: true,
            render: (o) => {
              const isUrgent = checkUrgent(o);
              return (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'nowrap', alignItems: 'center', whiteSpace: 'nowrap' }}>
                  <button
                    type="button"
                    onClick={() => {
                      const matchedStay = activeStays.find((s) => s.stayId === o.stayId);
                      setDetailModalData({ type: 'ROOM_ORDER', order: o, matchedStay });
                    }}
                    style={{
                      background: '#f8fafc',
                      color: '#0f172a',
                      border: '1px solid #cbd5e1',
                      borderRadius: 6,
                      padding: '5px 10px',
                      cursor: 'pointer',
                      fontSize: 12,
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                    }}
                    title="Xem chi tiết lịch hẹn & ghi chú yêu cầu của đơn dịch vụ này"
                  >
                    Chi tiết
                  </button>
                  {o.status === 'ORDERED' && !o.staffConfirmed && canConfirm && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleOpenConfirmOrderModal(o)}
                      style={{
                        background: '#0284c7',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 6,
                        padding: '5px 10px',
                        cursor: 'pointer',
                        fontSize: 12.5,
                        fontWeight: 600,
                        whiteSpace: 'nowrap',
                      }}
                      title="Xác nhận tiếp nhận đơn để chuyển sang Chờ phục vụ"
                    >
                      Xác nhận
                    </button>
                  )}
                  {o.status === 'ORDERED' && o.staffConfirmed && canComplete && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleOpenCompleteOrderConfirm(o)}
                      style={{
                        background: isUrgent ? '#15803d' : '#16a34a',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 6,
                        padding: '5px 10px',
                        cursor: 'pointer',
                        fontSize: 12.5,
                        fontWeight: 700,
                        whiteSpace: 'nowrap',
                        boxShadow: isUrgent ? '0 1px 3px rgba(21, 128, 61, 0.4)' : 'none',
                      }}
                      title="Xác nhận đã cung cấp dịch vụ cho khách và cộng tiền vào hóa đơn phòng"
                    >
                      Hoàn thành
                    </button>
                  )}
                  {o.status === 'ORDERED' && !o.staffConfirmed && canVoid && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleOpenVoidModal(o)}
                      style={{
                        background: '#fee2e2',
                        color: '#dc2626',
                        border: '1px solid #fecaca',
                        borderRadius: 6,
                        padding: '5px 10px',
                        cursor: 'pointer',
                        fontSize: 12.5,
                        fontWeight: 600,
                        whiteSpace: 'nowrap',
                      }}
                      title="Hủy đơn dịch vụ này (chỉ áp dụng cho đơn đang chờ xác nhận)"
                    >
                      Hủy đơn
                    </button>
                  )}
                </div>
              );
            },
          },
        ]}
      />
      <PaginationControl
        currentPage={orderPage}
        totalPages={totalOrderPages}
        totalItems={filteredOrders.length}
        pageSize={orderPageSize}
        onPageChange={setOrderPage}
        onPageSizeChange={setOrderPageSize}
      />
    </div>
  );
};

