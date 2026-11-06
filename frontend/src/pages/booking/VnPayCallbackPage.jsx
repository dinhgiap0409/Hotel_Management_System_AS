successfully downloaded text file (SHA: 65af1776c4ac7a45cf8026ce40ea3d0059e1ba3e)import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Row,
  Col,
  Card,
  Button,
  Form,
  Badge,
  Alert,
  Spinner,
} from 'react-bootstrap';
import { bookingApi } from '../../services/bookingApi';
import { formatVND } from '../../lib/money';
import { formatDateTime } from '../../lib/datetime';
import { formatVietnameseDate } from '../../components/booking/js/bookingUtils';
import '../../components/booking/css/bookingTheme.css';

export const VnPayCallbackPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const mode = searchParams.get('mode') || '';
  const txnRef = searchParams.get('vnp_TxnRef') || '';
  const vnpAmountRaw = Number(searchParams.get('vnp_Amount') || 0);
  const depositVnd = vnpAmountRaw > 0 ? vnpAmountRaw / 100 : 0;
  const externalResponseCode = searchParams.get('vnp_ResponseCode');
  const externalTransactionNo = searchParams.get('vnp_TransactionNo');
  const externalBankCode = searchParams.get('vnp_BankCode');
  // All vnp_* parameters VNPay returned, forwarded verbatim so the backend
  // can recompute the HMAC-SHA512 signature. The frontend result alone is
  // never trusted — the backend is the source of truth (UC-23).
  const vnpParams = {};
  searchParams.forEach((value, key) => {
    if (key.startsWith('vnp_')) vnpParams[key] = value;
  });
  // The simulated gateway is only shown when the payment URL was generated in
  // DEMO_TMN mode (mode=gateway). In production mode this page only displays
  // the result the backend verified.
  const isDemoGateway = mode === 'gateway';

  const [bankCode, setBankCode] = useState('NCB');
  const [cardNumber, setCardNumber] = useState('9704198526191432198');
  const [cardHolder, setCardHolder] = useState('NGUYEN VAN A');
  const [issueDate, setIssueDate] = useState('07/15');
  const [otpCode, setOtpCode] = useState('123456');

  const [processing, setProcessing] = useState(false);
  const [resultBooking, setResultBooking] = useState(null);
  const [paymentSuccess, setPaymentSuccess] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  // If redirected back from external VNPay Sandbox with vnp_ResponseCode in URL
  useEffect(() => {
    if (!externalResponseCode || !txnRef) return;
    let isMounted = true;
    setProcessing(true);
    bookingApi
      .confirmVnPayCallback({
        reservationCode: txnRef,
        vnpResponseCode: externalResponseCode,
        vnpTransactionNo: externalTransactionNo || `VNP${Date.now()}`,
        bankCode: externalBankCode || 'NCB',
        vnpAmount: vnpAmountRaw > 0 ? vnpAmountRaw : undefined,
        vnpSecureHash: searchParams.get('vnp_SecureHash') || undefined,
        vnpSecureHashType: searchParams.get('vnp_SecureHashType') || undefined,
        vnpParams,
        demoMode: false,
      })
      .then((res) => {
        if (!isMounted) return;
        const data = res.data?.data || res.data;
        setResultBooking(data);
        setPaymentSuccess(externalResponseCode === '00');
      })
      .catch((err) => {
        if (!isMounted) return;
        setErrorMsg(
          err.response?.data?.message || 'Không thể xác thực kết quả giao dịch VNPay.'
        );
      })
      .finally(() => {
        if (isMounted) setProcessing(false);
      });

    return () => {
      isMounted = false;
    };
  }, [externalResponseCode, txnRef, externalTransactionNo, externalBankCode]);

  const handleSimulateGatewayResult = async (responseCode) => {
    if (!txnRef) {
      setErrorMsg('Thiếu mã đơn đặt phòng (vnp_TxnRef).');
      return;
    }
    setProcessing(true);
    setErrorMsg(null);
    try {
      const res = await bookingApi.confirmVnPayCallback({
        reservationCode: txnRef,
        vnpResponseCode: responseCode,
        vnpTransactionNo: `VNP${Date.now()}`,
        bankCode,
        vnpAmount: vnpAmountRaw > 0 ? vnpAmountRaw : undefined,
        vnpParams: { ...vnpParams, vnp_ResponseCode: responseCode },
        // Demo simulation only: the backend only honours this flag when the
        // server itself is configured with DEMO_TMN/DEMO_SECRET.
        demoMode: true,
      });
      const data = res.data?.data || res.data;
      setResultBooking(data);
      setPaymentSuccess(responseCode === '00');
    } catch (err) {
      setErrorMsg(
        err.response?.data?.message || 'Không thể xử lý kết quả thanh toán đặt cọc.'
      );
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Container className="py-4">
      <Row className="justify-content-center">
        <Col lg={8} xl={7}>
          {/* Result Screen after payment is confirmed or cancelled */}
          {resultBooking ? (
            <Card className="border-0 shadow-lg rounded-4 overflow-hidden">
              <div
                className="p-4 text-white text-center"
                style={{
                  background: paymentSuccess
                    ? 'linear-gradient(135deg, #15803d 0%, #166534 100%)'
                    : 'linear-gradient(135deg, #b45309 0%, #92400e 100%)',
                }}
              >
                <div className="fs-1 mb-2">
                  {paymentSuccess ? (
                    <i className="bi bi-check-circle-fill"></i>
                  ) : (
                    <i className="bi bi-exclamation-circle-fill"></i>
                  )}
                </div>
                <h3 className="h4 fw-bold mb-1">
                  {paymentSuccess
                    ? 'Thanh toán đặt cọc VNPay thành công!'
                    : 'Giao dịch thanh toán đặt cọc chưa hoàn tất'}
                </h3>
                <div className="small opacity-75">
                  {paymentSuccess
                    ? `Đơn đặt phòng ${resultBooking.reservationCode} đã chuyển sang trạng thái CONFIRMED (Đã xác nhận).`
                    : `Đơn đặt phòng ${resultBooking.reservationCode} vẫn đang được giữ chỗ 24h (PENDING). Quý khách có thể thanh toán lại bất cứ lúc nào trước khi hết hạn.`}
                </div>
              </div>

              <Card.Body className="p-4">
                <div className="p-3 rounded-3 border bg-light mb-4">
                  <h6 className="fw-bold text-dark border-bottom pb-2 mb-3">
                    Chi tiết biên lai đặt phòng ({resultBooking.reservationCode})
                  </h6>
                  <Row className="g-2 small">
                    <Col sm={6}>
                      <span className="text-secondary">Khách hàng:</span>{' '}
                      <strong className="text-dark">{resultBooking.contactName}</strong>
                    </Col>
                    <Col sm={6}>
                      <span className="text-secondary">Trạng thái đơn:</span>{' '}
                      <Badge bg={paymentSuccess ? 'success' : 'warning'} text={paymentSuccess ? 'light' : 'dark'}>
                        {resultBooking.status}
                      </Badge>
                    </Col>
                    <Col sm={6}>
                      <span className="text-secondary">Hạng phòng:</span>{' '}
                      <strong className="text-dark">
                        {resultBooking.roomTypeName} × {resultBooking.roomQuantity} phòng
                      </strong>
                    </Col>
                    <Col sm={6}>
                      <span className="text-secondary">Số khách:</span>{' '}
                      <strong className="text-dark">{resultBooking.guestCount} người lớn</strong>
                    </Col>
                    <Col sm={6}>
                      <span className="text-secondary">Nhận → Trả phòng:</span>{' '}
                      <strong className="text-dark">
                        {formatVietnameseDate(resultBooking.checkInDate)} →{' '}
                        {formatVietnameseDate(resultBooking.checkOutDate)} ({resultBooking.nights} đêm)
                      </strong>
                    </Col>
                    <Col sm={6}>
                      <span className="text-secondary">Trạng thái tiền cọc:</span>{' '}
                      <strong className={paymentSuccess ? 'text-success' : 'text-warning'}>
                        {resultBooking.depositPaymentStatus} ({formatVND(resultBooking.depositAmount)})
                      </strong>
                    </Col>
                    <Col sm={12} className="pt-2 border-top mt-2 d-flex justify-content-between align-items-center">
                      <span className="text-secondary fw-semibold">Tổng chi phí lưu trú:</span>
                      <span className="fs-5 fw-bold" style={{ color: '#C96442' }}>
                        {formatVND(resultBooking.estimatedTotal)}
                      </span>
                    </Col>
                  </Row>
                </div>

                <div className="d-flex flex-wrap justify-content-between gap-2">
                  <Button className="btn-hms-light" onClick={() => navigate('/')}>
                    <i className="bi bi-arrow-left me-2"></i>
                    Về trang chủ
                  </Button>
                  <Button
                    className="btn-hms-primary px-4"
                    onClick={() => navigate('/my-bookings')}
                  >
                    <i className="bi bi-journal-bookmark-fill me-2"></i>
                    Quản lý Đặt phòng của tôi
                  </Button>
                </div>
              </Card.Body>
            </Card>
          ) : !isDemoGateway ? (
            /* Production mode: no simulated gateway. This page only shows the
               result the backend verified; a fake "success" button must never
               be available outside DEMO_TMN mode. */
            <Card className="border-0 shadow-lg rounded-4 overflow-hidden">
              <Card.Body className="p-4">
                <Alert variant="warning" className="rounded-3 small mb-4">
                  <i className="bi bi-exclamation-triangle-fill me-2"></i>
                  Trang này chỉ hiển thị kết quả thanh toán do backend xác thực.
                  Cổng mô phỏng VNPay chỉ xuất hiện khi hệ thống đang chạy ở chế độ
                  DEMO (DEMO_TMN). Vui lòng quay lại trang đặt phòng và thanh toán
                  lại qua VNPay.
                </Alert>
                <div className="d-flex flex-wrap gap-2">
                  <Button className="btn-hms-light" onClick={() => navigate('/')}>
                    <i className="bi bi-arrow-left me-2"></i>
                    Về trang chủ
                  </Button>
                  <Button className="btn-hms-primary px-4" onClick={() => navigate('/my-bookings')}>
                    <i className="bi bi-journal-bookmark-fill me-2"></i>
                    Quản lý Đặt phòng của tôi
                  </Button>
                </div>
              </Card.Body>
            </Card>
          ) : (
            /* Interactive VNPay Sandbox Gateway UI (DEMO_TMN only) */
            <Card className="border-0 shadow-lg rounded-4 overflow-hidden">
              <div
                className="p-4 text-white d-flex justify-content-between align-items-center flex-wrap gap-2"
                style={{
                  background: 'linear-gradient(135deg, #005baa 0%, #003b73 100%)',
                }}
              >
                <div>
                  <span className="badge bg-warning text-dark mb-1">VNPAY SANDBOX GATEWAY</span>
                  <h3 className="h5 fw-bold mb-0">
                    Cổng Thanh Toán Đặt Cọc Trực Tuyến VNPay
                  </h3>
                </div>
                <div className="text-end">
                  <div className="small opacity-75">Mã đơn đặt phòng</div>
                  <div className="fw-bold fs-5">{txnRef || 'N/A'}</div>
                </div>
              </div>

              <Card.Body className="p-4">
                {errorMsg && (
                  <Alert variant="danger" className="rounded-3 small">
                    <i className="bi bi-exclamation-triangle-fill me-2"></i>
                    {errorMsg}
                  </Alert>
                )}

                <div className="p-3 rounded-3 mb-4 border" style={{ backgroundColor: '#F8FAFC' }}>
                  <div className="d-flex justify-content-between align-items-center mb-1">
                    <span className="text-secondary small">Nội dung thanh toán:</span>
                    <strong className="text-dark small">
                      Đặt cọc 30% giữ phòng khách sạn HMS ({txnRef})
                    </strong>
                  </div>
                  <div className="d-flex justify-content-between align-items-center">
                    <span className="text-secondary small">Số tiền thanh toán cọc:</span>
                    <span className="fs-4 fw-bold text-primary">
                      {formatVND(depositVnd)}
                    </span>
                  </div>
                </div>

                <h6 className="fw-bold text-dark mb-3">
                  <i className="bi bi-credit-card me-2 text-primary"></i>
                  Thông tin Thẻ ATM Nội địa (Thẻ Test chuẩn VNPay Sandbox)
                </h6>

                <Row className="g-3 mb-4">
                  <Col sm={6}>
                    <Form.Label className="small fw-semibold text-secondary mb-1">
                      Ngân hàng thanh toán
                    </Form.Label>
                    <Form.Select
                      value={bankCode}
                      onChange={(e) => setBankCode(e.target.value)}
                    >
                      <option value="NCB">Ngân hàng NCB (VNPay Sandbox)</option>
                      <option value="VCB">Vietcombank (VCB)</option>
                      <option value="TCB">Techcombank (TCB)</option>
                      <option value="MB">MBBank (MB)</option>
                    </Form.Select>
                  </Col>
                  <Col sm={6}>
                    <Form.Label className="small fw-semibold text-secondary mb-1">
                      Số thẻ ATM (Sandbox)
                    </Form.Label>
                    <Form.Control
                      type="text"
                      value={cardNumber}
                      onChange={(e) => setCardNumber(e.target.value)}
                    />
                  </Col>
                  <Col sm={4}>
                    <Form.Label className="small fw-semibold text-secondary mb-1">
                      Tên chủ thẻ
                    </Form.Label>
                    <Form.Control
                      type="text"
                      value={cardHolder}
                      onChange={(e) => setCardHolder(e.target.value)}
                    />
                  </Col>
                  <Col sm={4}>
                    <Form.Label className="small fw-semibold text-secondary mb-1">
                      Ngày phát hành
                    </Form.Label>
                    <Form.Control
                      type="text"
                      value={issueDate}
                      onChange={(e) => setIssueDate(e.target.value)}
                    />
                  </Col>
                  <Col sm={4}>
                    <Form.Label className="small fw-semibold text-secondary mb-1">
                      Mã OTP xác thực
                    </Form.Label>
                    <Form.Control
                      type="text"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value)}
                    />
                  </Col>
                </Row>

                <div className="d-flex flex-wrap justify-content-end gap-2 pt-3 border-top">
                  <Button
                    variant="outline-secondary"
                    disabled={processing}
                    onClick={() => handleSimulateGatewayResult('24')}
                  >
                    Hủy giao dịch (Giữ đơn ở trạng thái PENDING 24h)
                  </Button>
                  <Button
                    variant="primary"
                    className="px-4 fw-bold"
                    disabled={processing}
                    onClick={() => handleSimulateGatewayResult('00')}
                  >
                    {processing ? (
                      <>
                        <Spinner animation="border" size="sm" className="me-2" />
                        Đang xác thực giao dịch...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-shield-check me-2"></i>
                        Xác nhận Thanh toán {formatVND(depositVnd)}
                      </>
                    )}
                  </Button>
                </div>
              </Card.Body>
            </Card>
          )}
        </Col>
      </Row>
    </Container>
  );
};

