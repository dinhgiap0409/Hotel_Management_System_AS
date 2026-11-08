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

  // Xác định đối tượng đang thực hiện thanh toán:
  // Nếu là nhân viên Lễ tân / Staff (role != CUSTOMER) hoặc đơn tạo tại quầy (BK-WALKIN-...) -> luôn quay về Quầy Lễ Tân (/staff/frontdesk)
  // Nếu là khách hàng cá nhân tự đặt online -> quay về Đặt phòng của tôi (/my-bookings)
  const isFrontDesk = Boolean(
    user?.role === 'FRONT_DESK' ||
    user?.roleName === 'FRONT_DESK' ||
    user?.role === 'ADMIN' ||
    user?.roleName === 'ADMIN' ||
    user?.role === 'GENERAL_MANAGER' ||
    user?.roleName === 'GENERAL_MANAGER' ||
    (user?.role && user.role !== 'CUSTOMER') ||
    (txnRef && txnRef.startsWith('BK-WALKIN-'))
  );

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
        // Fallback: nếu gọi confirm báo lỗi, truy vấn lại đơn đặt phòng
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

  // Đếm ngược 5 giây rồi tự động chuyển về trang phù hợp
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
            <Card className="border-0 shadow-lg rounded-4 text-center p-5">
              <Card.Body>
                <Spinner
                  animation="border"
                  variant="primary"
                  style={{ width: '3.5rem', height: '3.5rem' }}
                />
                <h4 className="mt-4 fw-bold text-dark">
                  Đang xác thực giao dịch VNPay...
                </h4>
                <p className="text-secondary small mb-0">
                  Hệ thống đang kiểm tra chữ ký số bảo mật và cập nhật trạng thái đơn đặt phòng #{txnRef}.
                </p>
              </Card.Body>
            </Card>
          ) : paymentSuccess ? (
            /* Giao dịch thành công */
            <Card className="border-0 shadow-lg rounded-4 overflow-hidden">
              <div
                className="p-4 text-white text-center"
                style={{
                  background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                }}
              >
                <div className="fs-1 mb-2">
                  <i className="bi bi-check-circle-fill"></i>
                </div>
                <h3 className="h4 fw-bold mb-1">
                  {isFrontDesk ? 'Xác Nhận Thanh Toán Cọc Thành Công' : 'Đặt Phòng Thành Công!'}
                </h3>
                <div className="small opacity-90 mb-2">
                  {isFrontDesk
                    ? `Đã ghi nhận thanh toán cọc đơn #${txnRef} thành công. Trạng thái đơn đã chuyển sang CONFIRMED.`
                    : `Cảm ơn bạn đã lựa chọn HMS Luxury Hotel. Mã đơn đặt phòng của bạn là:`}
                </div>
                <div className="badge bg-white text-dark fs-6 px-3 py-2 fw-bold font-monospace shadow-sm">
                  #{txnRef}
                </div>
                <div className="mt-3">
                  <Badge bg="light" text="dark" className="px-3 py-2 fw-semibold">
                    Tự động quay về {isFrontDesk ? 'Quầy Lễ Tân' : 'trang quản lý'} sau {countdown} giây...
                  </Badge>
                </div>
              </div>

              <Card.Body className="p-4">
                <div className="bg-light p-3 rounded-3 mb-4">
                  <h6 className="fw-bold text-dark mb-3">
                    <i className="bi bi-receipt me-2 text-primary"></i>
                    Chi tiết giao dịch thanh toán
                  </h6>
                  <Row className="g-2 small">
                    <Col sm={6}>
                      <span className="text-secondary">Ngân hàng / Cổng:</span>{' '}
                      <strong className="text-dark">{externalBankCode} (VNPay QR)</strong>
                    </Col>
                    {externalTransactionNo && (
                      <Col sm={6}>
                        <span className="text-secondary">Mã giao dịch VNPay:</span>{' '}
                        <strong className="text-dark font-monospace">
                          {externalTransactionNo}
                        </strong>
                      </Col>
                    )}
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
                  {isFrontDesk ? (
                    <>
                      <Button
                        className="btn-hms-light"
                        onClick={() => navigate('/staff/frontdesk', { replace: true })}
                      >
                        <i className="bi bi-card-checklist me-2"></i>
                        Xem danh sách khách đến (Arrivals)
                      </Button>
                      <Button
                        className="btn-hms-primary px-4 fw-bold"
                        onClick={() => navigate('/staff/frontdesk', { replace: true })}
                      >
                        <i className="bi bi-box-arrow-in-right me-2"></i>
                        Về Quầy Lễ Tân Làm Thủ Tục Check-in ({countdown}s)
                      </Button>
                    </>
                  ) : (
                    <>
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
                    </>
                  )}
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
                  Tự động quay về {isFrontDesk ? 'Quầy Lễ Tân' : 'trang trước'} sau {countdown} giây...
                </Badge>
              </div>

              <Card.Body className="p-4">
                <Alert variant="warning" className="small rounded-3 mb-4">
                  <i className="bi bi-info-circle-fill me-2"></i>
                  {isFrontDesk
                    ? 'Quý lễ tân có thể thu tiền mặt trực tiếp tại quầy hoặc yêu cầu khách quét lại mã QR tại Quầy Lễ Tân bất cứ lúc nào trước khi hết hạn giữ chỗ.'
                    : 'Quý khách hoặc lễ tân có thể quét lại mã QR trên Cổng VNPay hoặc lựa chọn hình thức thanh toán tiền mặt tại quầy bất cứ lúc nào trước khi hết hạn giữ chỗ.'}
                </Alert>

                <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 pt-2 border-top">
                  {isFrontDesk ? (
                    <>
                      <Button
                        className="btn-hms-light"
                        onClick={() => navigate('/staff/frontdesk', { replace: true })}
                      >
                        <i className="bi bi-arrow-left me-2"></i>
                        Xem danh sách đơn tại Quầy
                      </Button>
                      <Button
                        className="btn-hms-primary px-4 fw-bold"
                        onClick={() => navigate('/staff/frontdesk', { replace: true })}
                      >
                        <i className="bi bi-arrow-left-circle-fill me-2"></i>
                        Quay lại Quầy Lễ Tân ({countdown}s)
                      </Button>
                    </>
                  ) : (
                    <>
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
                    </>
                  )}
                </div>
              </Card.Body>
            </Card>
          )}
        </Col>
      </Row>
    </Container>
  );
};
