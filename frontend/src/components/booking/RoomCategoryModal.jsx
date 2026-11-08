import { useEffect, useState } from 'react';
import {
  Modal,
  Row,
  Col,
  Button,
  Badge,
  Table,
  Nav,
  Form,
  Spinner,
  Alert,
} from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { resolveImageUrl } from '../../lib/imageUrl';
import { bookingApi } from '../../services/bookingApi';
import { authApi } from '../../services/authApi';
import { formatVND } from '../../lib/money';
import { formatDateTime } from '../../lib/datetime';
import {
  calculateNights,
  deriveBedLayout,
  buildDefaultDayOfWeekRates,
  formatReviewTimestamp,
  formatVietnameseDate,
  getLocalDateString,
  parseAmenities,
} from './js/bookingUtils';

export const RoomCategoryModal = ({
  selectedCategory,
  onClose,
  onBookingSuccess,
  isSearchActive,
  activeSearchMeta,
}) => {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();

  const [detailData, setDetailData] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [activeTab, setActiveTab] = useState('OVERVIEW');

  const [checkInDate, setCheckInDate] = useState(() => getLocalDateString(0));
  const [checkOutDate, setCheckOutDate] = useState(() => getLocalDateString(1));
  const [guests, setGuests] = useState(2);
  const [roomQuantity, setRoomQuantity] = useState(1);

  // UC-23 Booking Form State
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [specialNotes, setSpecialNotes] = useState('');
  const [submittingBooking, setSubmittingBooking] = useState(false);
  const [bookingError, setBookingError] = useState(null);
  const [createdBooking, setCreatedBooking] = useState(null);

  // Pre-fill customer contact info when logged in
  useEffect(() => {
    if (!isAuthenticated || !user) return;
    setContactName(user.fullName || '');
    setContactEmail(user.email || '');
    if (user.phone) {
      setContactPhone(user.phone);
    } else {
      authApi
        .getMe()
        .then((res) => {
          const me = res.data?.data || res.data;
          if (me?.phone) setContactPhone(me.phone);
          if (me?.fullName) setContactName(me.fullName);
          if (me?.email) setContactEmail(me.email);
        })
        .catch(() => {});
    }
  }, [isAuthenticated, user]);

  useEffect(() => {
    if (!selectedCategory) {
      setDetailData(null);
      setActiveTab('OVERVIEW');
      setBookingError(null);
      setCreatedBooking(null);
      return;
    }

    const initCheckIn =
      isSearchActive && activeSearchMeta?.checkInDate
        ? activeSearchMeta.checkInDate
        : getLocalDateString(0);
    const initCheckOut =
      isSearchActive && activeSearchMeta?.checkOutDate
        ? activeSearchMeta.checkOutDate
        : getLocalDateString(1);
    const initGuests =
      isSearchActive && activeSearchMeta?.guests
        ? Number(activeSearchMeta.guests)
        : Math.min(2, Number(selectedCategory.capacity || 2));

    setCheckInDate(initCheckIn);
    setCheckOutDate(initCheckOut);
    setGuests(initGuests);
    setRoomQuantity(1);
    setSpecialNotes('');
    setBookingError(null);
    setCreatedBooking(null);

    let isMounted = true;
    const loadFullDetails = async () => {
      setLoadingDetail(true);
      try {
        const res = await bookingApi.getRoomCategoryDetails(selectedCategory.roomTypeId, {
          checkInDate: initCheckIn,
          checkOutDate: initCheckOut,
        });
        if (isMounted && res?.data) {
          setDetailData(res.data);
        }
      } catch {
        if (isMounted) {
          setDetailData(null);
        }
      } finally {
        if (isMounted) {
          setLoadingDetail(false);
        }
      }
    };

    loadFullDetails();
    return () => {
      isMounted = false;
    };
  }, [selectedCategory, isSearchActive, activeSearchMeta]);

  if (!selectedCategory) return null;

  const room = detailData || selectedCategory;
  const amenities = parseAmenities(room);
  const bedLayout = deriveBedLayout(room);
  const dayOfWeekRates =
    Array.isArray(room.dayOfWeekRates) && room.dayOfWeekRates.length > 0
      ? room.dayOfWeekRates
      : buildDefaultDayOfWeekRates(room.basePrice);
  const verifiedReviews = Array.isArray(room.verifiedReviews) ? room.verifiedReviews : [];

  const stayNights = calculateNights(checkInDate, checkOutDate);
  const availableCount =
    room.availableRoomsCount ??
    selectedCategory.availableRoomsCount ??
    room.totalActiveRooms ??
    selectedCategory.totalActiveRooms ??
    1;
  const maxGuestsAllowed = Number(room.capacity || 2) * Math.max(1, roomQuantity);

  // Calculate estimated stay total using day-of-week tariffs
  const computeStayTotal = () => {
    const qty = Math.max(1, Number(roomQuantity || 1));
    // No valid night range => no stay total. Never price a 0-night stay
    // at basePrice * qty; the nightly sum below is the single price rule
    // (dayOfWeekRates from the backend, Room_Type_Price per night).
    if (stayNights <= 0) return 0;
    const rateMap = {};
    dayOfWeekRates.forEach((r) => {
      rateMap[r.dayOfWeek] = Number(r.price || room.basePrice || 0);
    });
    let singleRoomSum = 0;
    const start = new Date(`${checkInDate}T00:00:00`);
    for (let i = 0; i < stayNights; i++) {
      const cur = new Date(start);
      cur.setDate(start.getDate() + i);
      const jsDay = cur.getDay();
      const isoDow = jsDay === 0 ? 7 : jsDay;
      singleRoomSum += rateMap[isoDow] || Number(room.basePrice || 0);
    }
    return singleRoomSum * qty;
  };

  const estimatedStayTotal = computeStayTotal();
  const estimatedDeposit = Math.round(estimatedStayTotal * 0.3);

  const handleSubmitReservation = async (e) => {
    e.preventDefault();
    setBookingError(null);

    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    if (stayNights <= 0) {
      setBookingError('Ngày trả phòng phải sau ngày nhận phòng ít nhất 1 đêm.');
      return;
    }

    const trimmedPhone = contactPhone.trim();
    if (!/^(0|\+84)\d{9}$/.test(trimmedPhone)) {
      setBookingError('Số điện thoại liên hệ không hợp lệ (10 chữ số, bắt đầu bằng 0 hoặc +84).');
      return;
    }

    setSubmittingBooking(true);
    try {
      const res = await bookingApi.createReservation({
        roomTypeId: room.roomTypeId,
        checkInDate,
        checkOutDate,
        guestCount: Number(guests),
        quantity: Number(roomQuantity),
        contactName: contactName.trim(),
        contactEmail: contactEmail.trim(),
        contactPhone: trimmedPhone,
        specialNotes: specialNotes.trim() || null,
      });

      const bookingData = res.data?.data || res.data;
      setCreatedBooking(bookingData);
      setActiveTab('BOOKING');
      if (typeof onBookingSuccess === 'function') {
        onBookingSuccess(bookingData);
      }
    } catch (err) {
      const valErrors = err.response?.data?.validationErrors
        ?.map((v) => v.message)
        .filter(Boolean)
        .join('; ');
      setBookingError(
        valErrors ||
          err.response?.data?.message ||
          'Không thể tạo đơn đặt phòng. Vui lòng kiểm tra lại thông tin.'
      );
    } finally {
      setSubmittingBooking(false);
    }
  };

  const handleProceedVnPay = () => {
    if (!createdBooking?.vnpayPaymentUrl) return;
    if (createdBooking.vnpayPaymentUrl.startsWith('http://localhost:5173')) {
      const urlObj = new URL(createdBooking.vnpayPaymentUrl);
      onClose();
      navigate(`${urlObj.pathname}${urlObj.search}`);
    } else {
      window.location.href = createdBooking.vnpayPaymentUrl;
    }
  };

  return (
    <Modal
      show={Boolean(selectedCategory)}
      onHide={onClose}
      size="xl"
      centered
      scrollable
      contentClassName="border-0 rounded-4 overflow-hidden shadow-lg"
    >
      {/* Modal Banner Photo */}
      <div className="position-relative" style={{ height: 250, backgroundColor: '#141413' }}>
        <img
          src={resolveImageUrl(room.imageUrl) || '/images/hotel-bg.jpg'}
          alt={room.typeName}
          className="w-100 h-100 object-fit-cover"
          onError={(e) => {
            e.currentTarget.onerror = null;
            e.currentTarget.src = '/images/hotel-bg.jpg';
          }}
        />
        <div
          className="position-absolute top-0 start-0 end-0 bottom-0"
          style={{
            background:
              'linear-gradient(to top, rgba(20,20,19,0.92) 0%, rgba(20,20,19,0.25) 55%, rgba(20,20,19,0.4) 100%)',
          }}
        />

        {/* Top Badges & Close Button */}
        <div className="position-absolute top-0 start-0 end-0 p-3 d-flex justify-content-between align-items-center">
          <div className="d-flex align-items-center gap-2 flex-wrap">
            <span className="rounded-pill hms-pill-dark">
              Mã hạng phòng #{room.roomTypeId}
            </span>
            <span
              className={`rounded-pill ${
                availableCount > 0 ? 'hms-pill-success' : 'hms-pill-danger'
              }`}
            >
              {availableCount > 0
                ? `Còn ${availableCount} phòng trống sẵn sàng`
                : 'Tạm hết phòng trống'}
            </span>
          </div>

          <Button
            variant="dark"
            size="sm"
            onClick={onClose}
            className="rounded-circle d-flex align-items-center justify-content-center border-0"
            style={{ width: 36, height: 36, backgroundColor: 'rgba(20,20,19,0.8)' }}
          >
            ✕
          </Button>
        </div>

        {/* Bottom Title & Price Summary on Photo */}
        <div className="position-absolute bottom-0 start-0 end-0 p-4 d-flex flex-wrap justify-content-between align-items-end gap-3">
          <div>
            <div className="d-flex align-items-center gap-2 mb-1">
              <span className="hms-rating-badge">
                {room.averageRating
                  ? `★ ${room.averageRating} / 5.0 (${room.reviewCount || verifiedReviews.length} đánh giá)`
                  : '★ Hạng phòng tiêu chuẩn 5 sao'}
              </span>
              {loadingDetail && (
                <Spinner animation="border" size="sm" variant="warning" />
              )}
            </div>
            <h2 className="h3 fw-bold text-white mb-0">{room.typeName}</h2>
          </div>

          <div className="text-end">
            <div className="hms-price-label">Giá niêm yết tiêu chuẩn</div>
            <div className="hms-price-value">
              {formatVND(room.basePrice)} <span className="hms-price-unit">/ đêm</span>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs inside Modal (UC-22 & UC-23 All-in-One on Landing Page) */}
      <div className="bg-light border-bottom px-4 pt-2">
        <Nav
          variant="tabs"
          activeKey={activeTab}
          onSelect={(k) => setActiveTab(k || 'OVERVIEW')}
          className="border-0 gap-2"
        >
          <Nav.Item>
            <Nav.Link
              eventKey="OVERVIEW"
              className={`fw-semibold border-0 rounded-top-3 px-3 py-2 ${
                activeTab === 'OVERVIEW' ? 'bg-white text-dark shadow-sm' : 'text-secondary'
              }`}
            >
              <i className="bi bi-stars me-2 text-warning"></i>
              Thông số & Tiện nghi ({amenities.length})
            </Nav.Link>
          </Nav.Item>
          <Nav.Item>
            <Nav.Link
              eventKey="TARIFFS"
              className={`fw-semibold border-0 rounded-top-3 px-3 py-2 ${
                activeTab === 'TARIFFS' ? 'bg-white text-dark shadow-sm' : 'text-secondary'
              }`}
            >
              <i className="bi bi-calendar2-week me-2 text-warning"></i>
              Bảng giá 7 ngày trong tuần
            </Nav.Link>
          </Nav.Item>
          <Nav.Item>
            <Nav.Link
              eventKey="REVIEWS"
              className={`fw-semibold border-0 rounded-top-3 px-3 py-2 ${
                activeTab === 'REVIEWS' ? 'bg-white text-dark shadow-sm' : 'text-secondary'
              }`}
            >
              <i className="bi bi-chat-quote me-2 text-warning"></i>
              Đánh giá ({room.reviewCount ?? verifiedReviews.length})
            </Nav.Link>
          </Nav.Item>
          <Nav.Item>
            <Nav.Link
              eventKey="BOOKING"
              className={`fw-bold border-0 rounded-top-3 px-3 py-2 ${
                activeTab === 'BOOKING'
                  ? 'bg-white shadow-sm'
                  : 'text-dark'
              }`}
              style={{ color: activeTab === 'BOOKING' ? '#C96442' : undefined }}
            >
              <i className="bi bi-calendar2-check-fill me-2" style={{ color: '#C96442' }}></i>
              Đặt phòng trực tuyến
            </Nav.Link>
          </Nav.Item>
        </Nav>
      </div>

      <Modal.Body className="p-4" style={{ backgroundColor: '#FAF9F5' }}>
        <Row className="g-4">
          {/* Left Column: Selected Tab Content */}
          <Col lg={7}>
            {activeTab === 'OVERVIEW' && (
              <div className="bg-white rounded-4 p-4 border shadow-sm">
                <h5 className="fw-bold text-dark mb-2">Giới thiệu hạng phòng</h5>
                <p className="text-secondary mb-4" style={{ lineHeight: 1.7 }}>
                  {room.description ||
                    'Không gian nghỉ dưỡng sang trọng với thiết kế tinh tế, nội thất cao cấp và dịch vụ tiêu chuẩn 5 sao.'}
                </p>

                {/* Key Specifications Grid (UC-22 Step 2) */}
                <Row className="g-3 rounded-3 p-3 mb-4 mx-0 hms-spec-box">
                  <Col xs={6} sm={6}>
                    <div className="text-secondary small">Sức chứa tối đa</div>
                    <strong className="text-dark">
                      <i className="bi bi-people-fill me-1 text-warning"></i>
                      {room.capacity} người lớn / phòng
                    </strong>
                  </Col>
                  <Col xs={6} sm={6}>
                    <div className="text-secondary small">Cấu hình giường (Bed Layout)</div>
                    <strong className="text-dark">
                      <i className="bi bi-lamp-fill me-1 text-warning"></i>
                      {bedLayout}
                    </strong>
                  </Col>
                  <Col xs={6} sm={6}>
                    <div className="text-secondary small">Quỹ phòng hoạt động</div>
                    <strong className="text-dark">
                      Còn {availableCount} / {room.totalActiveRooms ?? availableCount} phòng trống
                    </strong>
                  </Col>
                  <Col xs={6} sm={6}>
                    <div className="text-secondary small">Vị trí tầng / Phòng</div>
                    <strong className="text-dark">
                      {Array.isArray(room.floorNumbers) && room.floorNumbers.length > 0
                        ? `Tầng ${room.floorNumbers.join(', ')}`
                        : 'Tầng cảnh quan cao cấp'}
                    </strong>
                  </Col>
                </Row>

                {/* Full Amenity Checklist */}
                <div className="mb-4">
                  <h6 className="fw-bold text-uppercase text-secondary small mb-3">
                    Danh mục tiện nghi tiêu chuẩn trong phòng
                  </h6>
                  <Row className="g-2">
                    {amenities.map((item, idx) => (
                      <Col xs={12} sm={6} key={idx}>
                        <div className="d-flex align-items-center gap-2 p-2 rounded-3 bg-light border">
                          <span className="text-success fw-bold">✓</span>
                          <span className="small fw-medium text-dark">{item}</span>
                        </div>
                      </Col>
                    ))}
                  </Row>
                </div>

                {/* Hotel Policies */}
                <div className="rounded-3 p-3 bg-light border">
                  <div className="fw-semibold text-dark small mb-2">
                    <i className="bi bi-shield-check me-2 text-success"></i>
                    Chính sách lưu trú & Quy định giữ chỗ:
                  </div>
                  <ul className="small text-secondary mb-0 ps-3" style={{ lineHeight: 1.7 }}>
                    <li>Giờ nhận phòng (Check-in): Từ <strong>14:00</strong> — Giờ trả phòng (Check-out): Trước <strong>12:00</strong> trưa.</li>
                    <li>Đơn đặt phòng trực tuyến sẽ ở trạng thái <strong>PENDING</strong> và được giữ chỗ trong <strong>24 giờ</strong> chờ thanh toán đặt cọc 30% qua VNPay.</li>
                  </ul>
                </div>
              </div>
            )}

            {activeTab === 'TARIFFS' && (
              <div className="bg-white rounded-4 p-4 border shadow-sm">
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <div>
                    <h5 className="fw-bold text-dark mb-1">
                      Biểu giá theo ngày trong tuần
                    </h5>
                    <p className="text-secondary small mb-0">
                      Giá phòng được trích xuất trực tiếp từ bảng cấu hình giá <code>Room_Type_Price</code> trong Database.
                    </p>
                  </div>
                </div>

                <Table responsive hover className="align-middle mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>Thứ trong tuần</th>
                      <th>Phân loại ngày</th>
                      <th className="text-end">Đơn giá / đêm</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dayOfWeekRates.map((rate) => (
                      <tr key={rate.dayOfWeek}>
                        <td className="fw-semibold text-dark">{rate.dayLabel}</td>
                        <td>
                          {rate.isWeekendSurcharge ? (
                            <Badge bg="warning" text="dark" className="rounded-pill px-3">
                              Cuối tuần (Thứ 6 – CN)
                            </Badge>
                          ) : (
                            <Badge bg="secondary" className="rounded-pill px-3 bg-opacity-25 text-dark">
                              Ngày thường (Thứ 2 – Thứ 5)
                            </Badge>
                          )}
                        </td>
                        <td className="text-end fw-bold" style={{ color: '#C96442' }}>
                          {formatVND(rate.price)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            )}

            {activeTab === 'REVIEWS' && (
              <div className="bg-white rounded-4 p-4 border shadow-sm">
                <div className="d-flex justify-content-between align-items-center mb-3 pb-2 border-bottom">
                  <div>
                    <h5 className="fw-bold text-dark mb-1">
                      Đánh giá thực tế từ khách đã lưu trú
                    </h5>
                    <p className="text-secondary small mb-0">
                      Chỉ hiển thị đánh giá xác thực từ các lượt lưu trú đã hoàn tất (Completed Stays).
                    </p>
                  </div>
                  <div className="text-end">
                    <div className="fs-4 fw-bold text-warning">
                      ★ {room.averageRating || '5.0'} <span className="fs-6 text-secondary">/ 5.0</span>
                    </div>
                  </div>
                </div>

                {verifiedReviews.length > 0 ? (
                  <div className="d-flex flex-column gap-3">
                    {verifiedReviews.map((rev) => (
                      <div key={rev.reviewId} className="p-3 rounded-3 border bg-light">
                        <div className="d-flex justify-content-between align-items-start mb-2">
                          <div>
                            <strong className="text-dark">{rev.customerName}</strong>
                            {rev.roomNumber && (
                              <span className="ms-2 badge bg-dark-subtle text-dark">
                                Phòng {rev.roomNumber}
                              </span>
                            )}
                            <div className="small text-secondary">
                              Ngày đánh giá: {formatReviewTimestamp(rev.reviewDate)}
                            </div>
                          </div>
                          <span className="badge bg-warning text-dark fs-6">
                            {'★'.repeat(rev.rating || 5)} ({rev.rating}/5)
                          </span>
                        </div>

                        <p className="mb-2 text-dark">{rev.comment}</p>

                        {rev.managementReply && (
                          <div
                            className="mt-2 p-2 px-3 rounded-3 border-start border-4 border-warning"
                            style={{ backgroundColor: '#FEFCE8' }}
                          >
                            <div className="small fw-bold text-dark mb-1">
                              <i className="bi bi-award-fill me-1 text-warning"></i>
                              Phản hồi từ Ban Quản lý HMS Luxury Hotel:
                            </div>
                            <div className="small text-secondary">{rev.managementReply}</div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4 text-secondary">
                    <i className="bi bi-chat-heart fs-2 d-block mb-2 text-warning"></i>
                    Hạng phòng <strong>{room.typeName}</strong> đạt tiêu chuẩn chất lượng 5 sao.
                  </div>
                )}
              </div>
            )}

            {activeTab === 'BOOKING' && (
              <div className="bg-white rounded-4 p-4 border shadow-sm">
                {/* State 1: Booking Successfully Created -> Show 24h Hold Receipt & VNPay Deposit Action */}
                {createdBooking ? (
                  <div>
                    <Alert variant="success" className="rounded-3 border-success">
                      <div className="d-flex align-items-center gap-2 mb-1">
                        <i className="bi bi-check-circle-fill fs-5 text-success"></i>
                        <strong className="fs-6">
                          Tạo đơn đặt phòng thành công! Đang giữ chỗ 24 giờ
                        </strong>
                      </div>
                      <div className="small">
                        Mã đặt phòng của quý khách là{' '}
                        <strong className="text-dark">{createdBooking.reservationCode}</strong>. Vui
                        lòng hoàn tất thanh toán đặt cọc 30% trước hạn giữ chỗ để xác nhận đơn.
                      </div>
                    </Alert>

                    <div className="p-3 rounded-3 border bg-light mb-3">
                      <Row className="g-2 small">
                        <Col sm={6}>
                          <span className="text-secondary">Mã Booking:</span>{' '}
                          <strong className="text-dark">{createdBooking.reservationCode}</strong>
                        </Col>
                        <Col sm={6}>
                          <span className="text-secondary">Trạng thái:</span>{' '}
                          <Badge bg="warning" text="dark">
                            {createdBooking.status} (Giữ chỗ 24 giờ)
                          </Badge>
                        </Col>
                        <Col sm={6}>
                          <span className="text-secondary">Hạng phòng:</span>{' '}
                          <strong className="text-dark">
                            {createdBooking.roomTypeName} × {createdBooking.roomQuantity} phòng
                          </strong>
                        </Col>
                        <Col sm={6}>
                          <span className="text-secondary">Hạn giữ chỗ:</span>{' '}
                          <strong className="text-danger">
                            {formatDateTime(createdBooking.holdExpiresAt)}
                          </strong>
                        </Col>
                        <Col sm={6}>
                          <span className="text-secondary">Tổng chi phí ({createdBooking.nights} đêm):</span>{' '}
                          <strong className="text-dark">
                            {formatVND(createdBooking.estimatedTotal)}
                          </strong>
                        </Col>
                        <Col sm={6}>
                          <span className="text-secondary">Cần đặt cọc (30% VNPay):</span>{' '}
                          <strong className="fs-6" style={{ color: '#C96442' }}>
                            {formatVND(createdBooking.depositAmount)}
                          </strong>
                        </Col>
                      </Row>
                    </div>

                    <div className="d-flex flex-wrap gap-2">
                      <Button
                        className="btn-hms-primary flex-grow-1 py-2"
                        onClick={handleProceedVnPay}
                      >
                        <i className="bi bi-credit-card-2-front-fill me-2"></i>
                        Thanh toán đặt cọc {formatVND(createdBooking.depositAmount)} qua VNPay
                      </Button>
                      <Button
                        className="btn-hms-dark py-2"
                        onClick={() => {
                          onClose();
                          navigate('/my-bookings');
                        }}
                      >
                        <i className="bi bi-journal-check me-2"></i>
                        Xem Đặt phòng của tôi
                      </Button>
                    </div>
                  </div>
                ) : !isAuthenticated ? (
                  /* State 2: Not Logged In -> Require Customer Login */
                  <div className="text-center py-4">
                    <div
                      className="mx-auto mb-3 rounded-circle d-flex align-items-center justify-content-center"
                      style={{
                        width: 64,
                        height: 64,
                        backgroundColor: 'rgba(201,100,66,0.12)',
                        color: '#C96442',
                      }}
                    >
                      <i className="bi bi-person-lock fs-2"></i>
                    </div>
                    <h5 className="fw-bold text-dark mb-2">
                      Vui lòng đăng nhập để đặt phòng trực tuyến
                    </h5>
                    <p className="text-secondary small mb-4 mx-auto" style={{ maxWidth: 440 }}>
                      Theo quy định bảo mật và quản lý giữ chỗ 24 giờ, quý khách cần đăng nhập
                      tài khoản Khách hàng trước khi xác nhận đặt phòng và thanh toán cọc VNPay.
                    </p>
                    <div className="d-flex justify-content-center gap-3">
                      <Button
                        className="btn-hms-primary px-4"
                        onClick={() => {
                          onClose();
                          navigate('/login');
                        }}
                      >
                        <i className="bi bi-box-arrow-in-right me-2"></i>
                        Đăng nhập ngay
                      </Button>
                      <Button
                        className="btn-hms-light px-4"
                        onClick={() => {
                          onClose();
                          navigate('/register');
                        }}
                      >
                        Đăng ký tài khoản mới
                      </Button>
                    </div>
                  </div>
                ) : (
                  /* State 3: Logged In -> Show UC-23 Reservation Form */
                  <Form onSubmit={handleSubmitReservation}>
                    <div className="d-flex justify-content-between align-items-center mb-3 pb-2 border-bottom">
                      <div>
                        <h5 className="fw-bold text-dark mb-1">
                          Thông tin người liên hệ & Đặt phòng
                        </h5>
                        <p className="text-secondary small mb-0">
                          Đơn đặt phòng sẽ được giữ chỗ trong <strong>24 giờ</strong> chờ thanh
                          toán đặt cọc 30% qua VNPay.
                        </p>
                      </div>
                    </div>

                    {bookingError && (
                      <Alert variant="danger" className="py-2 small rounded-3">
                        <i className="bi bi-exclamation-triangle-fill me-2"></i>
                        {bookingError}
                      </Alert>
                    )}

                    <Row className="g-3">
                      <Col sm={12}>
                        <Form.Label className="small fw-semibold text-dark mb-1">
                          Họ và tên người nhận phòng <span className="text-danger">*</span>
                        </Form.Label>
                        <Form.Control
                          type="text"
                          required
                          value={contactName}
                          onChange={(e) => setContactName(e.target.value)}
                          placeholder="Nhập họ và tên đầy đủ..."
                        />
                      </Col>
                      <Col sm={6}>
                        <Form.Label className="small fw-semibold text-dark mb-1">
                          Email nhận xác nhận <span className="text-danger">*</span>
                        </Form.Label>
                        <Form.Control
                          type="email"
                          required
                          value={contactEmail}
                          onChange={(e) => setContactEmail(e.target.value)}
                          placeholder="example@email.com"
                        />
                      </Col>
                      <Col sm={6}>
                        <Form.Label className="small fw-semibold text-dark mb-1">
                          Số điện thoại liên hệ <span className="text-danger">*</span>
                        </Form.Label>
                        <Form.Control
                          type="tel"
                          required
                          value={contactPhone}
                          onChange={(e) => setContactPhone(e.target.value)}
                          placeholder="0912345678"
                        />
                      </Col>
                      <Col sm={12}>
                        <Form.Label className="small fw-semibold text-dark mb-1">
                          Yêu cầu đặc biệt (Special Notes)
                        </Form.Label>
                        <Form.Control
                          as="textarea"
                          rows={2}
                          value={specialNotes}
                          onChange={(e) => setSpecialNotes(e.target.value)}
                          placeholder="Ví dụ: Phòng tầng cao, không hút thuốc, nhận phòng sau 18:00..."
                        />
                      </Col>
                    </Row>

                    <div className="mt-4 pt-3 border-top d-flex justify-content-end gap-2">
                      <Button
                        type="submit"
                        className="btn-hms-primary w-100 py-2"
                        disabled={submittingBooking || availableCount <= 0}
                      >
                        {submittingBooking ? (
                          <>
                            <Spinner animation="border" size="sm" className="me-2" />
                            Đang khởi tạo đơn giữ chỗ 24h...
                          </>
                        ) : (
                          <>
                            <i className="bi bi-check2-circle me-2"></i>
                            Xác nhận Đặt phòng & Giữ chỗ 24h (Đặt cọc {formatVND(estimatedDeposit)})
                          </>
                        )}
                      </Button>
                    </div>
                  </Form>
                )}
              </div>
            )}
          </Col>

          {/* Right Column: Live Stay Cost Calculator & Quick Booking Trigger */}
          <Col lg={5}>
            <div className="bg-white rounded-4 p-4 border shadow-sm h-100 d-flex flex-column justify-content-between">
              <div>
                <div className="d-flex justify-content-between align-items-center mb-3 pb-2 border-bottom">
                  <h5 className="fw-bold text-dark mb-0">
                    <i className="bi bi-calculator me-2 text-warning"></i>
                    Chi phí & Thời gian lưu trú
                  </h5>
                  <span className="badge bg-warning-subtle text-dark border border-warning-subtle">
                    Tính theo đêm
                  </span>
                </div>

                <Row className="g-2 mb-3">
                  <Col sm={6}>
                    <Form.Label className="small fw-semibold text-secondary mb-1">
                      Ngày nhận phòng
                    </Form.Label>
                    <Form.Control
                      type="date"
                      value={checkInDate}
                      min={getLocalDateString(0)}
                      disabled={Boolean(createdBooking)}
                      onChange={(e) => {
                        const nextIn = e.target.value;
                        setCheckInDate(nextIn);
                        if (checkOutDate <= nextIn) {
                          const d = new Date(`${nextIn}T00:00:00`);
                          d.setDate(d.getDate() + 1);
                          setCheckOutDate(d.toISOString().slice(0, 10));
                        }
                      }}
                    />
                  </Col>
                  <Col sm={6}>
                    <Form.Label className="small fw-semibold text-secondary mb-1">
                      Ngày trả phòng
                    </Form.Label>
                    <Form.Control
                      type="date"
                      value={checkOutDate}
                      min={checkInDate || getLocalDateString(1)}
                      disabled={Boolean(createdBooking)}
                      onChange={(e) => setCheckOutDate(e.target.value)}
                    />
                  </Col>
                  <Col sm={6} className="mt-2">
                    <Form.Label className="small fw-semibold text-secondary mb-1">
                      Số lượng phòng đặt
                    </Form.Label>
                    <Form.Select
                      value={roomQuantity}
                      disabled={Boolean(createdBooking)}
                      onChange={(e) => {
                        const nextQty = Number(e.target.value);
                        setRoomQuantity(nextQty);
                        const nextMaxGuests = Number(room.capacity || 2) * nextQty;
                        if (guests > nextMaxGuests) {
                          setGuests(nextMaxGuests);
                        }
                      }}
                    >
                      {Array.from(
                        { length: Math.max(1, Number(availableCount || 1)) },
                        (_, i) => i + 1
                      ).map((num) => (
                        <option key={num} value={num}>
                          {num} phòng (Tối đa {availableCount} trống)
                        </option>
                      ))}
                    </Form.Select>
                  </Col>
                  <Col sm={6} className="mt-2">
                    <Form.Label className="small fw-semibold text-secondary mb-1">
                      Tổng số khách
                    </Form.Label>
                    <Form.Select
                      value={guests}
                      disabled={Boolean(createdBooking)}
                      onChange={(e) => setGuests(Number(e.target.value))}
                    >
                      {Array.from({ length: maxGuestsAllowed }, (_, i) => i + 1).map((num) => (
                        <option key={num} value={num}>
                          {num} người lớn
                        </option>
                      ))}
                    </Form.Select>
                  </Col>
                </Row>

                {/* Breakdown Box */}
                <div className="hms-estimated-total-box p-3 rounded-3 mb-3">
                  <div className="d-flex justify-content-between small mb-1">
                    <span className="text-secondary">Thời gian lưu trú:</span>
                    <strong className="text-dark">
                      {stayNights > 0 ? `${stayNights} đêm` : 'Chưa hợp lệ'} × {roomQuantity} phòng
                    </strong>
                  </div>
                  <div className="d-flex justify-content-between small mb-1">
                    <span className="text-secondary">Nhận → Trả phòng:</span>
                    <span className="text-dark">
                      {formatVietnameseDate(checkInDate)} → {formatVietnameseDate(checkOutDate)}
                    </span>
                  </div>
                  <div className="d-flex justify-content-between small mb-2">
                    <span className="text-secondary">Tiền cọc giữ chỗ (30% VNPay):</span>
                    <strong style={{ color: '#C96442' }}>{formatVND(estimatedDeposit)}</strong>
                  </div>
                  <div className="border-top pt-2 mt-2 d-flex justify-content-between align-items-center">
                    <strong className="text-dark">Tổng chi phí dự kiến:</strong>
                    <span className="fs-4 fw-bold" style={{ color: '#B45309' }}>
                      {formatVND(estimatedStayTotal)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-top d-flex flex-column gap-2">
                {activeTab !== 'BOOKING' && (
                  <Button
                    className="btn-hms-primary w-100 py-2"
                    onClick={() => setActiveTab('BOOKING')}
                  >
                    <i className="bi bi-calendar2-check me-2"></i>
                    Đặt phòng ngay (Giữ chỗ 24 giờ)
                  </Button>
                )}
                <div className="d-flex justify-content-between align-items-center">
                  <Button className="btn-hms-light px-3" onClick={onClose}>
                    Đóng cửa sổ
                  </Button>
                  <div className="text-end small text-secondary">
                    <i className="bi bi-shield-lock-fill text-success me-1"></i>
                    Thanh toán bảo mật VNPay
                  </div>
                </div>
              </div>
            </div>
          </Col>
        </Row>
      </Modal.Body>
    </Modal>
  );
};
