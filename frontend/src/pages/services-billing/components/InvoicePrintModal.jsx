import { formatVND } from '../../../lib/money';
import { formatDate, formatDateTime } from '../../../lib/datetime';

const CHARGE_TYPE_LABELS = {
  MINIBAR: 'Minibar / Đồ uống tại phòng',
  DAMAGE: 'Đền bù hư hại / Làm vỡ trang thiết bị',
  LATE_CHECKOUT: 'Phụ thu trả phòng muộn (Late check-out)',
  EXTRA_GUEST: 'Phụ thu thêm người lưu trú',
  OTHER: 'Phụ thu phát sinh khác',
};

export const InvoicePrintModal = ({ printInvoiceData, onClose }) => {
  if (!printInvoiceData) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15,23,42,0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1200,
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 12,
          width: '100%',
          maxWidth: 820,
          maxHeight: '94vh',
          overflowY: 'auto',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Thanh công cụ Modal */}
        <div
          className="no-print"
          style={{
            padding: '12px 20px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: '#f8fafc',
            borderTopLeftRadius: 12,
            borderTopRightRadius: 12,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>
            Bản Xem Trước Hóa Đơn Khách Sạn (Print-ready Invoice Preview)
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={() => window.print()}
              style={{
                background: '#16a34a',
                color: '#fff',
                border: 'none',
                padding: '6px 14px',
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span>🖨</span> In Hóa Đơn / Xuất PDF
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: '#f1f5f9',
                border: '1px solid #cbd5e1',
                color: '#475569',
                padding: '6px 12px',
                borderRadius: 6,
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              Đóng
            </button>
          </div>
        </div>

        {/* Khung nội dung hóa đơn in ấn */}
        <div
          id="printable-hotel-invoice"
          style={{
            padding: '36px 40px',
            color: '#0f172a',
            fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            lineHeight: 1.5,
          }}
        >
          {/* Header Khách sạn */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              borderBottom: '2px solid #0f172a',
              paddingBottom: 16,
              marginBottom: 20,
            }}
          >
            <div>
              <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                HMS LUXURY HOTEL &amp; RESORT
              </h1>
              <div style={{ fontSize: 12, color: '#475569', marginTop: 4 }}>
                Lô E2a-7, Đường D1, Khu Công nghệ cao, P. Long Thạnh Mỹ, TP. Thủ Đức, TP. HCM
              </div>
              <div style={{ fontSize: 12, color: '#475569' }}>
                MST: <strong>0108992345</strong> | Hotline: <strong>1900 6868</strong> | Email: reservation@hms.com
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 12, color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>
                MÃ HÓA ĐƠN
              </div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#0284c7' }}>
                {printInvoiceData.invoiceCode}
              </div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                Ngày lập: {formatDateTime(printInvoiceData.issueDate)}
              </div>
            </div>
          </div>

          {/* Tiêu đề Hóa Đơn */}
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, textTransform: 'uppercase', color: '#0f172a' }}>
              HÓA ĐƠN THANH TOÁN TIỀN PHÒNG &amp; DỊCH VỤ
            </h2>
            <div style={{ fontSize: 12, color: '#64748b', fontStyle: 'italic', marginTop: 2 }}>
              (GUEST FOLIO BILL &amp; SETTLEMENT RECEIPT)
            </div>
          </div>

          {/* Thông tin khách hàng & kỳ nghỉ */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1.2fr 1fr',
              gap: 16,
              background: '#f8fafc',
              padding: 14,
              borderRadius: 6,
              border: '1px solid #e2e8f0',
              fontSize: 12,
              marginBottom: 20,
            }}
          >
            <div>
              <div>Khách hàng: <strong>{printInvoiceData.guestName}</strong></div>
              {printInvoiceData.guestIdNumber && <div>Số CCCD / Hộ chiếu: <strong>{printInvoiceData.guestIdNumber}</strong></div>}
              <div>Số điện thoại: <strong>{printInvoiceData.guestPhone || 'N/A'}</strong></div>
              <div>Email: <strong>{printInvoiceData.guestEmail || 'N/A'}</strong></div>
            </div>

            <div>
              <div>Phòng lưu trú: <strong>P.{printInvoiceData.roomNumber}</strong> ({printInvoiceData.roomTypeName})</div>
              <div>Mã đặt phòng: <strong>{printInvoiceData.reservationCode}</strong></div>
              <div>Ngày nhận phòng: <strong>{formatDate(printInvoiceData.checkInDate || printInvoiceData.actualCheckIn)}</strong></div>
              <div>Ngày trả phòng: <strong>{formatDate(printInvoiceData.checkOutDate || printInvoiceData.actualCheckOut)}</strong></div>
            </div>
          </div>

          {/* Bảng chi tiết toàn bộ các dòng chi phí */}
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginBottom: 20 }}>
            <thead>
              <tr style={{ background: '#0f172a', color: '#fff', textAlign: 'left' }}>
                <th style={{ padding: '8px 10px', width: 35 }}>STT</th>
                <th style={{ padding: '8px 10px' }}>Diễn Giải Chi Phí</th>
                <th style={{ padding: '8px 10px', textAlign: 'center', width: 60 }}>SL</th>
                <th style={{ padding: '8px 10px', textAlign: 'right', width: 110 }}>Đơn Giá</th>
                <th style={{ padding: '8px 10px', textAlign: 'right', width: 130 }}>Thành Tiền (VND)</th>
              </tr>
            </thead>
            <tbody>
              {/* Dòng tiền phòng */}
              {printInvoiceData.roomNights && printInvoiceData.roomNights.map((rn, idx) => (
                <tr key={`rn-${idx}`} style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '7px 10px', color: '#64748b' }}>{idx + 1}</td>
                  <td style={{ padding: '7px 10px' }}>
                    Tiền phòng đêm {formatDate(rn.stayDate)} ({rn.roomTypeName})
                  </td>
                  <td style={{ padding: '7px 10px', textAlign: 'center' }}>{rn.quantity}</td>
                  <td style={{ padding: '7px 10px', textAlign: 'right' }}>{formatVND(rn.unitPrice)}</td>
                  <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 600 }}>
                    {formatVND(rn.lineTotal)}
                  </td>
                </tr>
              ))}

              {/* Dòng dịch vụ phòng */}
              {printInvoiceData.serviceOrders && printInvoiceData.serviceOrders.map((so, idx) => (
                <tr key={`so-${so.serviceOrderId}`} style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '7px 10px', color: '#64748b' }}>
                    {(printInvoiceData.roomNights?.length || 0) + idx + 1}
                  </td>
                  <td style={{ padding: '7px 10px' }}>
                    Dịch vụ: {so.serviceName} {so.category ? `[${so.category}]` : ''}
                  </td>
                  <td style={{ padding: '7px 10px', textAlign: 'center' }}>{so.quantity}</td>
                  <td style={{ padding: '7px 10px', textAlign: 'right' }}>{formatVND(so.unitPrice)}</td>
                  <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 600 }}>
                    {formatVND(so.totalAmount)}
                  </td>
                </tr>
              ))}

              {/* Dòng phụ thu */}
              {printInvoiceData.additionalCharges && printInvoiceData.additionalCharges.map((ac, idx) => (
                <tr key={`ac-${ac.additionalChargeId}`} style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '7px 10px', color: '#64748b' }}>
                    {(printInvoiceData.roomNights?.length || 0) +
                      (printInvoiceData.serviceOrders?.length || 0) +
                      idx +
                      1}
                  </td>
                  <td style={{ padding: '7px 10px' }}>
                    Phụ thu: {CHARGE_TYPE_LABELS[ac.chargeType] || ac.chargeType} ({ac.description})
                  </td>
                  <td style={{ padding: '7px 10px', textAlign: 'center' }}>1</td>
                  <td style={{ padding: '7px 10px', textAlign: 'right' }}>{formatVND(ac.amount)}</td>
                  <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 600 }}>
                    {formatVND(ac.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Bảng tổng kết tài chính */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              marginBottom: 24,
            }}
          >
            <div style={{ width: 340, fontSize: 13, lineHeight: 1.8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#475569' }}>Tổng chi phí (Subtotal):</span>
                <strong>{formatVND(printInvoiceData.totalAmount)}</strong>
              </div>

              {printInvoiceData.discountAmount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#be123c' }}>
                  <span>Giảm giá Voucher{printInvoiceData.voucherCode ? ` (${printInvoiceData.voucherCode})` : ''}:</span>
                  <strong>-{formatVND(printInvoiceData.discountAmount)}</strong>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#475569' }}>Thuế GTGT (VAT 8%):</span>
                <strong>+{formatVND(printInvoiceData.taxAmount)}</strong>
              </div>

              {printInvoiceData.depositDeducted > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#16a34a' }}>
                  <span>Trừ tiền cọc đã trả:</span>
                  <strong>-{formatVND(printInvoiceData.depositDeducted)}</strong>
                </div>
              )}

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  borderTop: '2px solid #0f172a',
                  paddingTop: 6,
                  marginTop: 6,
                  fontSize: 15,
                }}
              >
                <span style={{ fontWeight: 800 }}>TỔNG THANH TOÁN:</span>
                <strong style={{ color: '#0284c7', fontSize: 16 }}>
                  {formatVND(printInvoiceData.amountPaid || printInvoiceData.finalAmount)}
                </strong>
              </div>

              <div style={{ fontSize: 12, color: '#64748b', textAlign: 'right', marginTop: 2 }}>
                Hình thức: <strong>{printInvoiceData.paymentMethod}</strong> (ĐÃ THANH TOÁN)
              </div>
            </div>
          </div>

          {/* Phần chữ ký xác nhận */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              textAlign: 'center',
              marginTop: 30,
              fontSize: 12,
            }}
          >
            <div>
              <div style={{ fontWeight: 700, textTransform: 'uppercase' }}>Khách Hàng Ký Nhận</div>
              <div style={{ fontSize: 11, color: '#64748b', fontStyle: 'italic' }}>
                (Ký và ghi rõ họ tên)
              </div>
              <div style={{ height: 60 }} />
              <div style={{ fontWeight: 600 }}>{printInvoiceData.guestName}</div>
            </div>

            <div>
              <div style={{ fontWeight: 700, textTransform: 'uppercase' }}>Nhân Viên Thu Ngân</div>
              <div style={{ fontSize: 11, color: '#64748b', fontStyle: 'italic' }}>
                (Ký và ghi rõ họ tên)
              </div>
              <div style={{ height: 60 }} />
              <div style={{ fontWeight: 600 }}>{printInvoiceData.cashierName || 'Lễ tân HMS'}</div>
            </div>
          </div>

          {/* Lời cảm ơn */}
          <div
            style={{
              textAlign: 'center',
              marginTop: 36,
              paddingTop: 16,
              borderTop: '1px dashed #cbd5e1',
              fontSize: 11,
              color: '#64748b',
              fontStyle: 'italic',
            }}
          >
            Cảm ơn Quý khách đã tin tưởng và sử dụng dịch vụ tại HMS Luxury Hotel &amp; Resort! Hẹn gặp lại Quý khách!
          </div>
        </div>
      </div>
    </div>
  );
};

