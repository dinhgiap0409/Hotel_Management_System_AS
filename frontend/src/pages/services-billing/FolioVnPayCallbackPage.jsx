import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { billingApi } from '../../services/billingApi';
import { formatVND } from '../../lib/money';
import { formatDateTime } from '../../lib/datetime';
import { notifyToast } from '../../lib/http';
import { InvoicePrintModal } from './components/InvoicePrintModal';

export const FolioVnPayCallbackPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const txnRef = searchParams.get('vnp_TxnRef') || '';
  const responseCode = searchParams.get('vnp_ResponseCode') || '';
  const transactionNo = searchParams.get('vnp_TransactionNo') || '';
  const bankCode = searchParams.get('vnp_BankCode') || '';
  const amountRaw = searchParams.get('vnp_Amount') || '0';
  const secureHash = searchParams.get('vnp_SecureHash') || '';
  const secureHashType = searchParams.get('vnp_SecureHashType') || '';

  const [processing, setProcessing] = useState(true);
  const [invoiceDetail, setInvoiceDetail] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [showPrintModal, setShowPrintModal] = useState(false);

  const processedRef = useRef(false);

  useEffect(() => {
    if (processedRef.current) return;
    if (!txnRef || !responseCode) {
      setProcessing(false);
      setErrorMessage('Không tìm thấy thông tin giao dịch VNPay hợp lệ.');
      return;
    }

    processedRef.current = true;

    const vnpParams = {};
    for (const [key, value] of searchParams.entries()) {
      if (key.startsWith('vnp_')) {
        vnpParams[key] = value;
      }
    }

    const parsedVnpAmount = Number(amountRaw);

    billingApi
      .processFolioVnPayCallback({
        txnRef,
        vnpResponseCode: responseCode,
        vnpTransactionNo: transactionNo,
        bankCode,
        vnpAmount: Number.isFinite(parsedVnpAmount) && parsedVnpAmount > 0 ? parsedVnpAmount : null,
        vnpSecureHash: secureHash || null,
        vnpSecureHashType: secureHashType || null,
        vnpParams,
      })
      .then((res) => {
        const data = res.data?.data || res.data;
        setInvoiceDetail(data);
        notifyToast({
          type: 'SUCCESS',
          message: `Quyết toán qua cổng VNPay thành công! Đã đóng Folio phòng P.${data?.roomNumber || ''}.`,
        });
      })
      .catch((err) => {
        const msg =
          err?.response?.data?.message ||
          (responseCode === '24'
            ? 'Giao dịch thanh toán VNPay đã bị hủy bởi người dùng.'
            : 'Giao dịch thanh toán VNPay không thành công hoặc chữ ký không hợp lệ.');
        setErrorMessage(msg);
      })
      .finally(() => {
        setProcessing(false);
      });
  }, [txnRef, responseCode, transactionNo, bankCode, amountRaw, secureHash, secureHashType, searchParams]);

  const isSuccess = responseCode === '00' && invoiceDetail && !errorMessage;

  return (
    <div style={{ maxWidth: 680, margin: '24px auto', padding: '0 16px' }}>
      <div
        className="card"
        style={{
          padding: 32,
          borderRadius: 14,
          boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.1)',
          border: '1px solid #e2e8f0',
          background: '#fff',
        }}
      >
        {processing ? (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <div style={{ fontSize: 44, marginBottom: 14 }}>⏳</div>
            <h2 style={{ margin: '0 0 8px 0', color: '#0f172a', fontSize: 20 }}>
              Đang xác thực giao dịch quyết toán VNPay...
            </h2>
            <p style={{ margin: 0, color: '#64748b', fontSize: 14 }}>
              Hệ thống đang kiểm tra chữ ký số HMAC-SHA512, cập nhật hóa đơn VAT và đóng bảng kê chi phí phòng.
            </p>
          </div>
        ) : isSuccess ? (
          <div>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div
                style={{
                  width: 68,
                  height: 68,
                  borderRadius: '50%',
                  background: '#dcfce7',
                  color: '#16a34a',
                  fontSize: 34,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 14px auto',
                  boxShadow: '0 4px 12px rgba(22, 163, 74, 0.2)',
                }}
              >
                ✓
              </div>
              <h2 style={{ margin: '0 0 6px 0', color: '#15803d', fontSize: 22, fontWeight: 800 }}>
                Quyết Toán Hóa Đơn Qua VNPay Thành Công!
              </h2>
              <p style={{ margin: 0, color: '#475569', fontSize: 13.5 }}>
                Bảng kê chi phí phòng <strong>P.{invoiceDetail.roomNumber}</strong> đã chuyển sang trạng thái{' '}
                <strong style={{ color: '#16a34a' }}>CLOSED (Đã Quyết Toán)</strong>.
              </p>
            </div>

            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #cbd5e1',
                borderRadius: 10,
                padding: '18px 20px',
                marginBottom: 24,
                fontSize: 13.5,
                lineHeight: 1.9,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed #cbd5e1', paddingBottom: 6, marginBottom: 6 }}>
                <span style={{ color: '#64748b' }}>Mã Hóa Đơn VAT:</span>
                <strong style={{ color: '#0284c7', fontSize: 15 }}>{invoiceDetail.invoiceCode}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Phòng &amp; Khách lưu trú:</span>
                <strong>
                  P.{invoiceDetail.roomNumber} — {invoiceDetail.guestName}
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Mã đặt phòng:</span>
                <strong>{invoiceDetail.reservationCode}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Mã tham chiếu VNPay (TxnRef):</span>
                <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{txnRef}</span>
              </div>
              {transactionNo && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Mã giao dịch VNPay:</span>
                  <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{transactionNo}</span>
                </div>
              )}
              {bankCode && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Ngân hàng / Cổng thẻ:</span>
                  <strong>{bankCode}</strong>
                </div>
              )}
              {invoiceDetail.voucherCode && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#be123c' }}>
                  <span>Voucher áp dụng ({invoiceDetail.voucherCode}):</span>
                  <strong>-{formatVND(invoiceDetail.discountAmount || 0)}</strong>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Thời gian thanh toán:</span>
                <span>{formatDateTime(invoiceDetail.paidAt || invoiceDetail.issueDate)}</span>
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  borderTop: '2px solid #0f172a',
                  marginTop: 8,
                  paddingTop: 8,
                  fontSize: 15,
                }}
              >
                <strong style={{ color: '#0f172a' }}>Số tiền đã thanh toán qua VNPay:</strong>
                <strong style={{ color: '#16a34a', fontSize: 18 }}>
                  {formatVND(invoiceDetail.amountPaid ?? Number(amountRaw) / 100)}
                </strong>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setShowPrintModal(true)}
                style={{
                  background: '#16a34a',
                  color: '#fff',
                  border: 'none',
                  padding: '11px 22px',
                  borderRadius: 8,
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  boxShadow: '0 2px 6px rgba(22, 163, 74, 0.3)',
                }}
              >
                <span>🖨️</span>
                <span>In Hóa Đơn VAT (A4 Print Bill)</span>
              </button>
              <button
                type="button"
                onClick={() => navigate('/staff/services-billing?tab=folios')}
                style={{
                  background: '#0284c7',
                  color: '#fff',
                  border: 'none',
                  padding: '11px 22px',
                  borderRadius: 8,
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <span>📋</span>
                <span>Quay Lại Quyết Toán Folio</span>
              </button>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: '50%',
                background: '#fee2e2',
                color: '#dc2626',
                fontSize: 32,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 14px auto',
              }}
            >
              ✕
            </div>
            <h2 style={{ margin: '0 0 8px 0', color: '#b91c1c', fontSize: 21, fontWeight: 800 }}>
              Thanh Toán Quyết Toán Qua VNPay Chưa Thành Công
            </h2>
            <p style={{ margin: '0 0 18px 0', color: '#475569', fontSize: 14, lineHeight: 1.6 }}>
              {errorMessage || `Giao dịch không thành công (Mã phản hồi: ${responseCode || 'N/A'}).`}
              <br />
              Bảng kê chi phí phòng (Folio) vẫn đang ở trạng thái <strong>OPEN</strong>. Lễ tân có thể thực hiện thanh toán lại qua VNPay hoặc đổi sang thu Tiền mặt tại quầy.
            </p>
            <button
              type="button"
              onClick={() => navigate('/staff/services-billing?tab=folios')}
              style={{
                background: '#0284c7',
                color: '#fff',
                border: 'none',
                padding: '10px 22px',
                borderRadius: 8,
                fontWeight: 700,
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              Quay Lại Bảng Kê Hóa Đơn Phòng (Folio)
            </button>
          </div>
        )}
      </div>

      <InvoicePrintModal
        printInvoiceData={showPrintModal ? invoiceDetail : null}
        onClose={() => setShowPrintModal(false)}
      />
    </div>
  );
};

