import { useEffect, useState } from 'react';
import { Modal, Row, Col, Button, Badge, Table, Nav, Form, Spinner } from 'react-bootstrap';
import { bookingApi } from '../../services/bookingApi';
import { formatVND } from '../../lib/money';
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
  isSearchActive,
  activeSearchMeta,
}) => {
  const [detailData, setDetailData] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [activeTab, setActiveTab] = useState('OVERVIEW');

  const [checkInDate, setCheckInDate] = useState(() => getLocalDateString(0));
  const [checkOutDate, setCheckOutDate] = useState(() => getLocalDateString(1));
  const [guests, setGuests] = useState(2);

  useEffect(() => {
    if (!selectedCategory) {
      setDetailData(null);
      setActiveTab('OVERVIEW');
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
        // Fallback seamlessly to selectedCategory from Landing Page if backend was not restarted yet
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

  // Calculate estimated stay total using day-of-week tariffs if available
  const computeStayTotal = () => {
    if (stayNights <= 0) return Number(room.basePrice || 0);
    const rateMap = {};
    dayOfWeekRates.forEach((r) => {
      rateMap[r.dayOfWeek] = Number(r.price || room.basePrice || 0);
    });
    let sum = 0;
    const start = new Date(`${checkInDate}T00:00:00`);
    for (let i = 0; i < stayNights; i++) {
      const cur = new Date(start);
      cur.setDate(start.getDate() + i);
      const jsDay = cur.getDay(); // 0=Sun, 1=Mon..6=Sat
      const isoDow = jsDay === 0 ? 7 : jsDay;
      sum += rateMap[isoDow] || Number(room.basePrice || 0);
    }
    return sum;
  };

  const estimatedStayTotal = computeStayTotal();
  const availableCount =
    room.availableRoomsCount ??
    selectedCategory.availableRoomsCount ??
    room.totalActiveRooms ??
    selectedCategory.totalActiveRooms ??
    0;

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
      <div className="position-relative" style={{ height: 270, backgroundColor: '#141413' }}>
        <img
          src={room.imageUrl || '/images/hotel-bg.jpg'}
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

      {/* Navigation Tabs inside Modal (UC-22 All-in-One on Landing Page) */}
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
              <i className="bi bi-Stars me-2 text-warning"></i>
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
              Đánh giá từ khách lưu trú ({room.reviewCount ?? verifiedReviews.length})
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
                      {room.capacity} người lớn
                    </strong>
                  </Col>
                  <Col xs={6} sm={6}>
                    <div className="text-secondary small">Cấu hình giường (Bed Layout)</div>
                    <strong className="text-dark">
                      <i className="bi bi-Shop-window me-1 text-warning"></i>
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
                    Chính sách lưu trú & Quy định tính giá (Theo đêm):
                  </div>
                  <ul className="small text-secondary mb-0 ps-3" style={{ lineHeight: 1.7 }}>
                    <li>Giờ nhận phòng (Check-in): Từ <strong>14:00</strong> — Giờ trả phòng (Check-out): Trước <strong>12:00</strong> trưa.</li>
                    <li>Đơn giá tính theo đêm lưu trú (Nightly Rate). Đặt phòng trực tuyến được giữ chỗ tối đa 24 giờ (BR-19).</li>
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
                    {room.reviewCount > 0 && (
                      <div className="small mt-1">
                        Điểm đánh giá trung bình: <strong>★ {room.averageRating} / 5.0</strong> ({room.reviewCount} lượt đánh giá).
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </Col>

          {/* Right Column: Live Stay Cost Calculator & Availability Summary on Landing Page */}
          <Col lg={5}>
            <div className="bg-white rounded-4 p-4 border shadow-sm h-100 d-flex flex-column justify-content-between">
              <div>
                <div className="d-flex justify-content-between align-items-center mb-3 pb-2 border-bottom">
                  <h5 className="fw-bold text-dark mb-0">
                    <i className="bi bi-calculator me-2 text-warning"></i>
                    Ước tính chi phí lưu trú
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
                      onChange={(e) => setCheckOutDate(e.target.value)}
                    />
                  </Col>
                  <Col sm={12} className="mt-2">
                    <Form.Label className="small fw-semibold text-secondary mb-1">
                      Số lượng khách dự kiến
                    </Form.Label>
                    <Form.Select
                      value={guests}
                      onChange={(e) => setGuests(Number(e.target.value))}
                    >
                      {Array.from({ length: Number(room.capacity || 2) }, (_, i) => i + 1).map(
                        (num) => (
                          <option key={num} value={num}>
                            {num} người lớn (Tối đa {room.capacity} khách)
                          </option>
                        )
                      )}
                    </Form.Select>
                  </Col>
                </Row>

                {/* Breakdown Box */}
                <div className="hms-estimated-total-box p-3 rounded-3 mb-3">
                  <div className="d-flex justify-content-between small mb-1">
                    <span className="text-secondary">Thời gian lưu trú:</span>
                    <strong className="text-dark">
                      {stayNights > 0 ? `${stayNights} đêm` : 'Chưa hợp lệ'} (
                      {formatVietnameseDate(checkInDate)} → {formatVietnameseDate(checkOutDate)})
                    </strong>
                  </div>
                  <div className="d-flex justify-content-between small mb-2">
                    <span className="text-secondary">Giá niêm yết cơ bản:</span>
                    <span className="text-dark">{formatVND(room.basePrice)} / đêm</span>
                  </div>
                  <div className="border-top pt-2 mt-2 d-flex justify-content-between align-items-center">
                    <strong className="text-dark">Tổng chi phí dự kiến:</strong>
                    <span className="fs-4 fw-bold" style={{ color: '#B45309' }}>
                      {formatVND(estimatedStayTotal)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-top d-flex justify-content-between align-items-center gap-2">
                <Button className="btn-hms-light px-4" onClick={onClose}>
                  Đóng cửa sổ
                </Button>
                <div className="text-end small text-secondary">
                  <i className="bi bi-check-circle-fill text-success me-1"></i>
                  Đã bao gồm thuế & phí dịch vụ
                </div>
              </div>
            </div>
          </Col>
        </Row>
      </Modal.Body>
    </Modal>
  );
};
