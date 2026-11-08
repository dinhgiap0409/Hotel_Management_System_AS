import { DataTable } from '../../../components/common/DataTable';
import { formatDate, getTodayApiDate } from '../../../lib/datetime';
import {
  parseAndGroupPreOrders,
  matchPreOrderItemsToStayOrders,
  inputStyle,
  toDateStr,
  isReservationUrgent as checkReservationUrgent,
} from './serviceUtils';
import { PaginationControl } from './PaginationControl';

export const UpcomingPreOrdersTab = ({
  loadUpcomingPreOrders,
  preOrderSearchKeyword,
  setPreOrderSearchKeyword,
  setPreOrderPage,
  preOrderCheckInFilter,
  setPreOrderCheckInFilter,
  preOrderChargeFilter,
  setPreOrderChargeFilter,
  filteredPreOrders,
  upcomingPreOrders,
  paginatedPreOrders,
  activeStays,
  orders,
  setDetailModalData,
  canCreateOrder,
  canComplete,
  handleOpenQuickLoadAndCompleteConfirm,
  handleCancelPreOrder,
  handleOpenCompleteOrderConfirm,
  handleOpenQuickLoadAllConfirm,
  busy,
  preOrderPage,
  totalPreOrderPages,
  preOrderPageSize,
  setPreOrderPageSize,
  urgentAlerts = [],
}) => {
  const isReservationUrgent = (r) => checkReservationUrgent(r, urgentAlerts, activeStays);

  const displayPreOrders = paginatedPreOrders;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div>
          <h4 style={{ margin: 0, color: '#0f172a', fontSize: 16, fontWeight: 700 }}>
            Lịch Khách Đặt Trước Dịch Vụ (Đón Sân Bay, Buffet, Spa...)
          </h4>
          <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 2 }}>
            Thông tin được khách đặt trước khi nhận phòng. Nhân viên điều phối xe, tài xế và lễ tân theo dõi lịch trình để đón tiếp chu đáo.
          </div>
        </div>
        <button
          type="button"
          onClick={loadUpcomingPreOrders}
          style={{
            background: '#f8fafc',
            border: '1px solid #cbd5e1',
            padding: '6px 12px',
            borderRadius: 6,
            fontSize: 12.5,
            fontWeight: 600,
            color: '#475569',
            cursor: 'pointer',
          }}
        >
          Làm mới lịch
        </button>
      </div>

      {/* Bộ lọc lịch đặt trước dịch vụ */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 14,
          flexWrap: 'wrap',
          gap: 10,
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: 8,
          padding: '10px 14px',
        }}
      >
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="Tìm mã booking, tên khách, SĐT, dịch vụ..."
            value={preOrderSearchKeyword}
            onChange={(e) => {
              setPreOrderSearchKeyword(e.target.value);
              setPreOrderPage(1);
            }}
            style={{ ...inputStyle, width: 270 }}
          />
          <select
            value={preOrderCheckInFilter}
            onChange={(e) => {
              setPreOrderCheckInFilter(e.target.value);
              setPreOrderPage(1);
            }}
            style={{ ...inputStyle, width: 200 }}
          >
            <option value="ALL">Tất cả trạng thái lưu trú</option>
            <option value="CHECKED_IN">Đã Check-in (Đã nhận phòng)</option>
            <option value="NOT_CHECKED_IN">Chưa Check-in (Chờ nhận phòng)</option>
          </select>
          <select
            value={preOrderChargeFilter}
            onChange={(e) => {
              setPreOrderChargeFilter(e.target.value);
              setPreOrderPage(1);
            }}
            style={{ ...inputStyle, width: 220 }}
          >
            <option value="ALL">Tất cả trạng thái tiền phòng</option>
            <option value="HAS_UNCHARGED">Còn dịch vụ chờ tính tiền phòng</option>
            <option value="ALL_CHARGED">Đã tính hết vào tiền phòng</option>
          </select>
          {(preOrderSearchKeyword || preOrderCheckInFilter !== 'ALL' || preOrderChargeFilter !== 'ALL') && (
            <button
              type="button"
              onClick={() => {
                setPreOrderSearchKeyword('');
                setPreOrderCheckInFilter('ALL');
                setPreOrderChargeFilter('ALL');
                setPreOrderPage(1);
              }}
              style={{
                background: '#fff',
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

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span
            style={{
              background: '#eff6ff',
              color: '#1d4ed8',
              border: '1px solid #bfdbfe',
              padding: '4px 9px',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            ⚡ Trình tự: Ưu tiên check-out gấp &amp; trả phòng sớm nhất
          </span>
          <div style={{ fontSize: 13, color: '#64748b' }}>
            Hiển thị <strong>{filteredPreOrders.length}</strong> / {upcomingPreOrders.length} lịch đặt trước
          </div>
        </div>
      </div>

      <DataTable
        keyField="reservationId"
        data={displayPreOrders}
        emptyMessage="Hiện tại không có lịch đặt trước dịch vụ nào từ khách."
        columns={[
          {
            header: 'Mã Booking & Khách Hàng',
            render: (r) => {
              const matchedStay = activeStays.find((s) => s.reservationCode === r.reservationCode);
              const items = parseAndGroupPreOrders(r.specialNotes);
              const stayOrders = matchedStay
                ? orders.filter((o) => String(o.stayId) === String(matchedStay.stayId))
                : [];
              const matchedItems = matchPreOrderItemsToStayOrders(items, stayOrders);
              const hasUncharged = matchedStay && matchedItems.some((it) => !it.matchedOrder || it.matchedOrder.status !== 'COMPLETED');
              const urgent = isReservationUrgent(r);
              const isUrgentPending = urgent && hasUncharged;

              return (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <strong style={{ color: '#0f172a', fontSize: 13 }}>#{r.reservationCode}</strong>
                    {matchedStay ? (
                      <span
                        style={{
                          background: '#e0e7ff',
                          color: '#3730a3',
                          fontSize: 11,
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: 6,
                        }}
                        title={`Khách đã nhận phòng ${matchedStay.roomNumber}`}
                      >
                        P.{matchedStay.roomNumber}
                      </span>
                    ) : (
                      <span
                        style={{
                          background: '#f1f5f9',
                          color: '#64748b',
                          fontSize: 11,
                          fontWeight: 500,
                          padding: '2px 8px',
                          borderRadius: 6,
                        }}
                        title="Khách chưa làm thủ tục nhận phòng tại Lễ tân"
                      >
                        Chưa Check-in
                      </span>
                    )}
                    {isUrgentPending && (
                      <span
                        style={{
                          background: '#dc2626',
                          color: '#ffffff',
                          fontSize: 10.5,
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: 12,
                          boxShadow: '0 0 0 2px rgba(220, 38, 38, 0.25)',
                          whiteSpace: 'nowrap',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 3,
                        }}
                      >
                        🔥 GẤP: CHECK-OUT
                      </span>
                    )}
                  </div>
                  <div style={{ fontWeight: 600, color: '#0f172a', marginTop: 3 }}>{r.contactName}</div>
                  {r.contactPhone && (
                    <div style={{ fontSize: 12, color: '#0369a1', marginTop: 2 }}>
                      SĐT: <a href={`tel:${r.contactPhone}`} style={{ color: '#0369a1', textDecoration: 'none' }}>{r.contactPhone}</a>
                    </div>
                  )}
                </div>
              );
            },
          },
          {
            header: 'Ngày Lưu Trú & Hạng Phòng',
            render: (r) => {
              const matchedStay = activeStays.find((s) => s.reservationCode === r.reservationCode);
              const isCheckedIn = Boolean(matchedStay);
              const checkoutDateStr = toDateStr(matchedStay?.checkOutDate || r.checkOutDate);
              const todayStr = getTodayApiDate();
              const isToday = checkoutDateStr && checkoutDateStr === todayStr;
              const isPast = checkoutDateStr && checkoutDateStr < todayStr;

              return (
                <div>
                  <div style={{ fontWeight: 600, color: '#0f172a' }}>{r.roomTypeName || 'Phòng tiêu chuẩn'}</div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                    Nhận: <strong>{formatDate(r.checkInDate)}</strong>
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>
                    Trả: <strong>{formatDate(r.checkOutDate)}</strong>
                  </div>
                  {isCheckedIn && (isToday || isPast) && (
                    <div style={{ marginTop: 4 }}>
                      <span
                        style={{
                          background: isPast ? '#fee2e2' : '#fef3c7',
                          color: isPast ? '#991b1b' : '#b45309',
                          border: `1px solid ${isPast ? '#fca5a5' : '#fde68a'}`,
                          fontSize: 10.5,
                          fontWeight: 700,
                          padding: '1px 6px',
                          borderRadius: 4,
                          display: 'inline-block',
                        }}
                      >
                        {isPast ? '⚠️ Quá hạn trả phòng' : '⏳ Trả phòng hôm nay'}
                      </span>
                    </div>
                  )}
                </div>
              );
            },
          },
          {
            header: 'Dịch Vụ Khách Đặt Trước',
            render: (r) => {
              const matchedStay = activeStays.find((s) => s.reservationCode === r.reservationCode);
              const rawItems = parseAndGroupPreOrders(r.specialNotes);
              const stayOrders = matchedStay
                ? orders.filter((o) => String(o.stayId) === String(matchedStay.stayId))
                : [];
              const items = matchPreOrderItemsToStayOrders(rawItems, stayOrders);

              return (
                <div
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: 8,
                    overflow: 'hidden',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
                    minWidth: 340,
                    maxWidth: 520,
                  }}
                >
                  {items.map((it, idx) => {
                    const existingOrder = it.matchedOrder;
                    const isCompleted = existingOrder?.status === 'COMPLETED';
                    const isOrdered = existingOrder?.status === 'ORDERED';

                    return (
                      <div
                        key={idx}
                        style={{
                          padding: '7px 10px',
                          borderTop: idx > 0 ? '1px dashed #e2e8f0' : 'none',
                          fontSize: 12,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <span style={{ color: '#64748b', fontSize: 11, fontWeight: 600 }}>#{idx + 1}.</span>
                            <strong style={{ color: '#0f172a' }}>{it.serviceName}</strong>
                            <span style={{ color: '#ea580c', fontWeight: 700, fontSize: 11.5 }}>(SL: {it.quantity})</span>
                            {isCompleted && (
                              <span
                                style={{
                                  background: '#dcfce7',
                                  color: '#166534',
                                  fontSize: 10.5,
                                  fontWeight: 700,
                                  padding: '1px 5px',
                                  borderRadius: 4,
                                }}
                              >
                                Đã tính vào tiền phòng (#{existingOrder.serviceOrderId})
                              </span>
                            )}
                            {isOrdered && (
                              <span
                                style={{
                                  background: '#fef3c7',
                                  color: '#b45309',
                                  fontSize: 10.5,
                                  fontWeight: 700,
                                  padding: '1px 5px',
                                  borderRadius: 4,
                                }}
                              >
                                Đang phục vụ (#{existingOrder.serviceOrderId})
                              </span>
                            )}
                            {!existingOrder && matchedStay && (
                              <span
                                style={{
                                  background: '#fef3c7',
                                  color: '#92400e',
                                  border: '1px solid #fde68a',
                                  fontSize: 10.5,
                                  fontWeight: 700,
                                  padding: '1px 6px',
                                  borderRadius: 4,
                                }}
                              >
                                Chờ tính vào tiền phòng
                              </span>
                            )}
                            {isReservationUrgent(r) && !isCompleted && (
                              <span
                                style={{
                                  background: '#dc2626',
                                  color: '#ffffff',
                                  fontSize: 10.5,
                                  fontWeight: 700,
                                  padding: '2px 7px',
                                  borderRadius: 12,
                                  boxShadow: '0 0 0 2px rgba(220, 38, 38, 0.25)',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                🔥 GẤP: CHECK-OUT
                              </span>
                            )}
                          </div>

                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <button
                              type="button"
                              onClick={() =>
                                setDetailModalData({
                                  type: 'PRE_ORDER',
                                  reservation: r,
                                  item: it,
                                  matchedStay,
                                  existingOrder,
                                })
                              }
                              style={{
                                background: '#f1f5f9',
                                color: '#0f172a',
                                border: '1px solid #cbd5e1',
                                padding: '2px 6px',
                                borderRadius: 4,
                                fontSize: 11,
                                fontWeight: 600,
                                cursor: 'pointer',
                                whiteSpace: 'nowrap',
                              }}
                              title="Xem chi tiết lịch hẹn & yêu cầu của khách cho lượt đặt này"
                            >
                              Chi tiết
                            </button>
                            {!existingOrder && canCreateOrder && (
                              <>
                                {matchedStay && canComplete ? (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenQuickLoadAndCompleteConfirm(matchedStay, it)}
                                    disabled={busy}
                                    style={{
                                      background: '#16a34a',
                                      color: '#fff',
                                      border: 'none',
                                      padding: '2px 7px',
                                      borderRadius: 4,
                                      fontSize: 11,
                                      fontWeight: 700,
                                      cursor: 'pointer',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 3,
                                      whiteSpace: 'nowrap',
                                      boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                                    }}
                                    title="Hoàn thành đơn và cộng tiền vào hóa đơn phòng ngay"
                                  >
                                    Hoàn thành &amp; Tính tiền phòng
                                  </button>
                                ) : !matchedStay ? (
                                  <span
                                    style={{
                                      background: '#f8fafc',
                                      color: '#64748b',
                                      border: '1px dashed #cbd5e1',
                                      padding: '2px 7px',
                                      borderRadius: 4,
                                      fontSize: 11,
                                      fontWeight: 600,
                                      whiteSpace: 'nowrap',
                                      cursor: 'not-allowed',
                                    }}
                                    title="Khách chưa làm thủ tục nhận phòng. Cần chờ khách check-in trước khi tính vào hóa đơn phòng."
                                  >
                                    Chờ khách nhận phòng để tính tiền
                                  </span>
                                ) : null}
                              </>
                            )}
                            {isOrdered && canComplete && (
                              <button
                                type="button"
                                onClick={() => handleOpenCompleteOrderConfirm(existingOrder)}
                                disabled={busy}
                                style={{
                                  background: '#15803d',
                                  color: '#fff',
                                  border: 'none',
                                  padding: '2px 7px',
                                  borderRadius: 4,
                                  fontSize: 11,
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                Hoàn thành &amp; Tính tiền phòng
                              </button>
                            )}
                            {!isCompleted && (!isOrdered || !existingOrder?.staffConfirmed) && canCreateOrder && (
                              <button
                                type="button"
                                onClick={() => handleCancelPreOrder(r, it)}
                                disabled={busy}
                                style={{
                                  background: '#fff',
                                  color: '#dc2626',
                                  border: '1px solid #fca5a5',
                                  padding: '2px 7px',
                                  borderRadius: 4,
                                  fontSize: 11,
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  whiteSpace: 'nowrap',
                                }}
                                title="Hủy yêu cầu đặt trước dịch vụ này (chỉ hủy được khi chưa xác nhận)"
                              >
                                Hủy
                              </button>
                            )}
                          </div>
                        </div>
                        {(it.time || (it.detail && it.detail !== 'Không')) && (
                          <div style={{ display: 'flex', gap: 6, fontSize: 11.5, marginTop: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                            {it.time && (
                              <span
                                style={{
                                  background: '#fffbeb',
                                  color: '#b45309',
                                  border: '1px solid #fde68a',
                                  padding: '2px 7px',
                                  borderRadius: 4,
                                  fontWeight: 600,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                }}
                              >
                                <span style={{ color: '#92400e', fontSize: 10.5, fontWeight: 700 }}>Hẹn:</span>
                                <strong style={{ color: '#b45309' }}>{it.time}</strong>
                              </span>
                            )}
                            {it.detail && it.detail !== 'Không' && (
                              <span
                                style={{
                                  background: '#f8fafc',
                                  color: '#334155',
                                  border: '1px solid #e2e8f0',
                                  padding: '2px 7px',
                                  borderRadius: 4,
                                  fontWeight: 500,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                }}
                              >
                                <span style={{ color: '#64748b', fontSize: 10.5, fontWeight: 700 }}>Ghi chú:</span>
                                <strong style={{ color: '#0f172a' }}>{it.detail}</strong>
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            },
          },
          {
            header: 'Trạng Thái & Thao Tác',
            render: (r) => {
              const matchedStay = activeStays.find((s) => s.reservationCode === r.reservationCode);
              const items = parseAndGroupPreOrders(r.specialNotes);
              const stayOrders = matchedStay
                ? orders.filter((o) => String(o.stayId) === String(matchedStay.stayId))
                : [];
              const matchedItems = matchPreOrderItemsToStayOrders(items, stayOrders);
              const hasUncharged = matchedStay && matchedItems.some((it) => !it.matchedOrder || it.matchedOrder.status !== 'COMPLETED');
              const isUrgentPending = isReservationUrgent(r) && hasUncharged;

              return (
                <div>
                  {matchedStay ? (
                    <div>
                      {isUrgentPending && (
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
                            🔥 GẤP: CHECK-OUT
                          </span>
                        </div>
                      )}
                      <span
                        style={{
                          background: '#dcfce7',
                          color: '#166534',
                          fontWeight: 700,
                          fontSize: 12,
                          padding: '3px 8px',
                          borderRadius: 4,
                          display: 'inline-block',
                          marginBottom: 6,
                        }}
                      >
                        Đã nhận phòng {matchedStay.roomNumber}
                      </span>
                      {canCreateOrder && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                          {hasUncharged ? (
                            canComplete ? (
                              <button
                                type="button"
                                onClick={() => handleOpenQuickLoadAllConfirm(r, matchedStay, items)}
                                disabled={busy}
                                style={{
                                  background: '#15803d',
                                  color: '#fff',
                                  border: 'none',
                                  padding: '5px 10px',
                                  borderRadius: 4,
                                  fontSize: 12,
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                                }}
                                title="Hoàn thành toàn bộ các dịch vụ đặt trước của khách và tính vào hóa đơn phòng"
                              >
                                Tính tất cả vào tiền phòng
                              </button>
                            ) : (
                              <span
                                style={{
                                  background: '#fef3c7',
                                  color: '#92400e',
                                  border: '1px solid #fde68a',
                                  padding: '4px 8px',
                                  borderRadius: 4,
                                  fontSize: 11.5,
                                  fontWeight: 600,
                                  display: 'inline-block',
                                }}
                              >
                                Chờ tính vào tiền phòng
                              </span>
                            )
                          ) : (
                            <span
                              style={{
                                background: '#f1f5f9',
                                color: '#15803d',
                                border: '1px solid #bbf7d0',
                                padding: '5px 10px',
                                borderRadius: 4,
                                fontSize: 12,
                                fontWeight: 700,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 5,
                              }}
                            >
                              Đã tính hết vào tiền phòng
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div>
                      <span
                        style={{
                          background: '#fef3c7',
                          color: '#b45309',
                          fontWeight: 600,
                          fontSize: 12,
                          padding: '3px 8px',
                          borderRadius: 4,
                          display: 'inline-block',
                        }}
                      >
                        Chờ khách đến nhận phòng
                      </span>
                      <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 4 }}>
                        (Sẵn sàng xe / nhân sự đón)
                      </div>
                    </div>
                  )}
                </div>
              );
            },
          },
        ]}
      />
      <PaginationControl
        currentPage={preOrderPage}
        totalPages={totalPreOrderPages}
        totalItems={filteredPreOrders.length}
        pageSize={preOrderPageSize}
        onPageChange={setPreOrderPage}
        onPageSizeChange={setPreOrderPageSize}
      />
    </div>
  );
};

