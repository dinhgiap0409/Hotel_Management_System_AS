import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Row,
  Col,
  Card,
  Button,
  Badge,
  Alert,
  Spinner,
} from 'react-bootstrap';
import { bookingApi } from '../../services/bookingApi';
import { useAuth } from '../../context/AuthContext';
import { formatVND } from '../../lib/money';
import { formatVietnameseDate } from '../../components/booking/js/bookingUtils';
import '../../components/booking/css/bookingTheme.css';

export const VnPayCallbackPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const txnRef = searchParams.get('vnp_TxnRef') || '';
  const vnpAmountRaw = Number(searchParams.get('vnp_Amount') || 0);
  const depositVnd = vnpAmountRaw > 0 ? vnpAmountRaw / 100 : 0;
  const externalResponseCode = searchParams.get('vnp_ResponseCode');
  const externalTransactionNo =
    searchParams.get('vnp_TransactionNo') || searchParams.get('vnp_BankTranNo');
  const externalBankCode = searchParams.get('vnp_BankCode') || 'NCB';

  const vnpParams = {};
  searchParams.forEach((value, key) => {
    if (key.startsWith('vnp_')) vnpParams[key] = value;
  });

  const [processing, setProcessing] = useState(true);
  const [resultBooking, setResultBooking] = useState(null);
  const [paymentSuccess, setPaymentSuccess] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [countdown, setCountdown] = useState(5);

  // Xác định trang quay về:
  // Nếu là nhân viên lễ tân / staff hoặc đơn walk-in -> quay về Quầy Lễ Tân (/staff/frontdesk)
  // Nếu là khách hàng -> quay về Đặt phòng của tôi (/my-bookings)
  const isFrontDesk =
    user?.roleName === 'FRONT_DESK' ||
    user?.roleName === 'GENERAL_MANAGER' ||
    user?.roleName === 'ADMIN' ||
    (txnRef && txnRef.startsWith('BK-WALKIN-'));

  const targetReturnUrl = isFrontDesk ? '/staff/frontdesk' : '/my-bookings';
  const targetReturnLabel = isFrontDesk
    ? 'Quay lại Quầy Lễ Tân (Front-Desk)'
    : 'Quản lý Đặt phòng của tôi';

  useEffect(() => {
    let isMounted = true;
    if (!txnRef) {
      setProcessing(false);
      setErrorMsg('Không tìm thấy thông tin mã đặt phòng (vnp_TxnRef).');
      return;
    }

    const verifyCallback = async () => {
      try {
        setProcessing(true);
        const res = await bookingApi.confirmVnPayCallback({
          reservationCode: txnRef,
          vnpResponseCode: externalResponseCode || '00',
          vnpTransactionNo: externalTransactionNo || `VNP${Date.now()}`,
          bankCode: externalBankCode,
          vnpAmount: vnpAmountRaw > 0 ? vnpAmountRaw : undefined,
          vnpSecureHash: searchParams.get('vnp_SecureHash') || undefined,
          vnpSecureHashType: searchParams.get('vnp_SecureHashType') || undefined,
          vnpParams,
          demoMode: false,
        });

        if (!isMounted) return;
        const data = res.data?.data || res.data;
        setResultBooking(data);
        const isOk = externalResponseCode === '00' || data?.status === 'CONFIRMED';
        setPaymentSuccess(isOk);
      } catch (err) {
        if (!isMounted) return;
        // Fallback: nếu gọi confirm báo lỗi (ví dụ đã confirm trước đó), truy vấn lại đơn đặt phòng
        try {
          const fallbackRes = await bookingApi.findReservationByCode(txnRef);
          const fallbackData = fallbackRes.data?.data || fallbackRes.data;
          if (fallbackData) {
            setResultBooking(fallbackData);
            const isOk =
              fallbackData.status === 'CONFIRMED' ||
              fallbackData.depositPaymentStatus === 'PAID';
            setPaymentSuccess(isOk);
            return;
          }
        } catch {
          // ignore
        }
        setErrorMsg(
          err.response?.data?.message || 'Không thể xác thực kết quả giao dịch VNPay.'
        );
        setPaymentSuccess(false);
      } finally {
        if (isMounted) setProcessing(false);
      }
    };

    verifyCallback();

    return () => {
      isMounted = false;
    };
  }, [externalResponseCode, txnRef, externalTransactionNo, externalBankCode]);

  // Đếm ngược 5 giây rồi tự động chuyển về trang cũ
  useEffect(() => {
    if (processing) return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          navigate(targetReturnUrl, { replace: true });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [processing, targetReturnUrl, navigate]);

  return (
    <Container className="py-5">
      <Row className="justify-content-center">
        <Col lg={8} xl={7}>
          {processing ? (
            /* Trạng thái đang xác thực kết quả từ Cổng VNPay */
            <Card className="border-0 shadow-sm rounded-4 p-5 text-center">
              <div className="mb-4">
                <Spinner animation="border" variant="primary" style={{ width: 52, height: 52 }} />
              </div>
              <h4 className="fw-bold text-dark mb-2">
                Đang xác thực giao dịch từ Cổng VNPay...
              </h4>
              <p className="text-secondary small mb-0">
                Hệ thống đang kết nối Cổng Thanh Toán VNPay để kiểm tra kết quả và ghi nhận tiền cọc.
                Vui lòng không tắt hoặc tải lại trình duyệt.
              </p>
            </Card>
          ) : paymentSuccess ? (
            /* Giao dịch thành công */
            <Card className="border-0 shadow-lg rounded-4 overflow-hidden">
              <div
                className="p-4 text-white text-center"
                style={{
                  background: 'linear-gradient(135deg, #15803d 0%, #166534 100%)',
                }}
              >
                <div className="fs-1 mb-2">
                  <i className="bi bi-check-circle-fill"></i>
                </div>
                <h3 className="h4 fw-bold mb-1">
                  Thanh toán đặt cọc VNPay thành công!
                </h3>
                <div className="small opacity-90 mb-2">
                  Đơn đặt phòng <strong>{resultBooking?.reservationCode || txnRef}</strong> đã chuyển sang trạng thái CONFIRMED (Đã xác nhận).
                </div>
                <Badge bg="light" text="dark" className="px-3 py-2 fw-semibold">
                  <i className="bi bi-arrow-repeat me-1 spinner-border spinner-border-sm"></i>
                  Tự động quay về sau {countdown} giây...
                </Badge>
              </div>

              <Card.Body className="p-4">
                <div className="p-3 rounded-3 border bg-light mb-4">
                  <h6 className="fw-bold text-dark border-bottom pb-2 mb-3">
                    Chi tiết biên lai giao dịch VNPay ({resultBooking?.reservationCode || txnRef})
                  </h6>
                  <Row className="g-2 small">
                    <Col sm={6}>
                      <span className="text-secondary">Khách hàng:</span>{' '}
                      <strong className="text-dark">
                        {resultBooking?.contactName || 'Khách đặt tại quầy'}
                      </strong>
                    </Col>
                    <Col sm={6}>
                      <span className="text-secondary">Trạng thái hồ sơ:</span>{' '}
                      <Badge bg="success">
                        {resultBooking?.status || 'CONFIRMED'}
                      </Badge>
                    </Col>
                    <Col sm={6}>
                      <span className="text-secondary">Ngân hàng thanh toán:</span>{' '}
                      <strong className="text-primary">{externalBankCode}</strong>
                    </Col>
                    <Col sm={6}>
                      <span className="text-secondary">Mã GD VNPay:</span>{' '}
                      <strong className="text-dark">{externalTransactionNo || 'VNP-SUCCESS'}</strong>
                    </Col>
                    {resultBooking?.roomTypeName && (
                      <Col sm={6}>
                        <span className="text-secondary">Hạng phòng:</span>{' '}
                        <strong className="text-dark">
                          {resultBooking.roomTypeName} × {resultBooking.roomQuantity || 1} phòng
                        </strong>
                      </Col>
                    )}
                    {resultBooking?.checkInDate && (
                      <Col sm={6}>
                        <span className="text-secondary">Nhận → Trả phòng:</span>{' '}
                        <strong className="text-dark">
                          {formatVietnameseDate(resultBooking.checkInDate)} →{' '}
                          {formatVietnameseDate(resultBooking.checkOutDate)}
                        </strong>
                      </Col>
                    )}
                    <Col sm={6}>
                      <span className="text-secondary">Tiền cọc đã thanh toán (30%):</span>{' '}
                      <strong className="text-success fs-6">
                        {formatVND(depositVnd || resultBooking?.depositAmount || 0)}
                      </strong>
                    </Col>
                    {resultBooking?.estimatedTotal && (
                      <Col sm={6}>
                        <span className="text-secondary">Tổng tiền dự kiến:</span>{' '}
                        <strong className="text-dark">
                          {formatVND(resultBooking.estimatedTotal)}
                        </strong>
                      </Col>
                    )}
                  </Row>
                </div>

                <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 pt-2 border-top">
                  <Button className="btn-hms-light" onClick={() => navigate('/')}>
                    <i className="bi bi-house-door me-2"></i>
                    Về trang chủ
                  </Button>
                  <Button
                    className="btn-hms-primary px-4 fw-bold"
                    onClick={() => navigate(targetReturnUrl, { replace: true })}
                  >
                    <i className="bi bi-arrow-left-circle-fill me-2"></i>
                    {targetReturnLabel} ({countdown}s)
                  </Button>
                </div>
              </Card.Body>
            </Card>
          ) : (
            /* Giao dịch thất bại hoặc bị hủy */
            <Card className="border-0 shadow-lg rounded-4 overflow-hidden">
              <div
                className="p-4 text-white text-center"
                style={{
                  background: 'linear-gradient(135deg, #b45309 0%, #92400e 100%)',
                }}
              >
                <div className="fs-1 mb-2">
                  <i className="bi bi-exclamation-triangle-fill"></i>
                </div>
                <h3 className="h4 fw-bold mb-1">
                  Giao dịch thanh toán chưa hoàn tất
                </h3>
                <div className="small opacity-90 mb-2">
                  {errorMsg ||
                    `Giao dịch thanh toán tiền cọc đơn ${txnRef} chưa được xác nhận. Đơn đặt phòng vẫn ở trạng thái Chờ đặt cọc (PENDING).`}
                </div>
                <Badge bg="light" text="dark" className="px-3 py-2 fw-semibold">
                  Tự động quay về sau {countdown} giây...
                </Badge>
              </div>

              <Card.Body className="p-4">
                <Alert variant="warning" className="small rounded-3 mb-4">
                  <i className="bi bi-info-circle-fill me-2"></i>
                  Quý khách hoặc lễ tân có thể quét lại mã QR trên Cổng VNPay hoặc lựa chọn hình thức thanh toán tiền mặt tại quầy bất cứ lúc nào trước khi hết hạn giữ chỗ.
                </Alert>

                <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 pt-2 border-top">
                  <Button className="btn-hms-light" onClick={() => navigate('/')}>
                    <i className="bi bi-house-door me-2"></i>
                    Về trang chủ
                  </Button>
                  <Button
                    className="btn-hms-primary px-4 fw-bold"
                    onClick={() => navigate(targetReturnUrl, { replace: true })}
                  >
                    <i className="bi bi-arrow-left-circle-fill me-2"></i>
                    {targetReturnLabel} ({countdown}s)
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
