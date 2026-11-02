import { useEffect, useState } from 'react';
import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom';
import {
  Container,
  Row,
  Col,
  Card,
  Badge,
  Button,
  Table,
  Spinner,
  Alert,
} from 'react-bootstrap';
import { bookingApi } from '../../services/bookingApi';
import { formatVND } from '../../lib/money';
import { formatDateTime } from '../../lib/datetime';
import {
  formatVietnameseDate,
  parseAmenities,
  calculateNights,
  deriveBedLayout,
  buildDefaultDayOfWeekRates,
} from '../../components/booking/js/bookingUtils';
import '../../components/booking/css/bookingTheme.css';

export const RoomDetailPage = () => {
  const { roomTypeId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const checkInDate = searchParams.get('checkInDate') || '';
  const checkOutDate = searchParams.get('checkOutDate') || '';
  const guests = searchParams.get('guests') || '2';

  const [detail, setDetail] = useState(null);
  const [activePhotoIdx, setActivePhotoIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);
    const params = {};
    if (checkInDate && checkOutDate) {
      params.checkInDate = checkInDate;
      params.checkOutDate = checkOutDate;
    }

    bookingApi
      .getRoomCategoryDetails(roomTypeId, params)
      .then((res) => {
        if (!isMounted) return;
        setDetail(res.data);
        setActivePhotoIdx(0);
      })
      .catch(async () => {
        // Fallback to catalog endpoint if Backend was not restarted yet
        try {
          const listRes = await bookingApi.getRoomTypes();
          const allTypes = Array.isArray(listRes.data) ? listRes.data : [];
          const found = allTypes.find(
            (item) => Number(item.roomTypeId) === Number(roomTypeId)
          );
          if (isMounted && found) {
            setDetail({
              ...found,
              bedLayout: deriveBedLayout(found),
              dayOfWeekRates: buildDefaultDayOfWeekRates(found.basePrice),
              verifiedReviews: [],
            });
            setActivePhotoIdx(0);
          } else if (isMounted) {
            setError('Không tìm thấy hạng phòng yêu cầu.');
          }
        } catch (fallbackErr) {
          if (isMounted) {
            setError(
              fallbackErr.response?.data?.message ||
                'Không thể tải thông tin chi tiết hạng phòng.'
            );
          }
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [roomTypeId, checkInDate, checkOutDate]);

  if (loading) {
    return (
      <Card className="border-0 shadow-sm rounded-4 text-center py-5">
        <Card.Body>
          <Spinner animation="border" variant="secondary" className="mb-2" />
          <div className="text-secondary">
            Đang tải thông số kỹ thuật, bảng giá và đánh giá thực tế của hạng phòng...
          </div>
        </Card.Body>
      </Card>
    );
  }

  if (error || !detail) {
    return (
      <Container fluid className="px-0">
        <Alert variant="danger" className="rounded-3 d-flex justify-content-between align-items-center">
          <span>
            <i className="bi bi-exclamation-triangle-fill me-2"></i>
            {error || 'Hạng phòng không tồn tại.'}
          </span>
          <Button className="btn-hms-dark" onClick={() => navigate('/')}>
            Quay lại danh mục
          </Button>
        </Alert>
      </Container>
    );
  }

  const photos =
    Array.isArray(detail.photoGallery) && detail.photoGallery.length > 0
      ? detail.photoGallery
      : [detail.imageUrl || '/images/hotel-bg.jpg'];
  const currentPhoto = photos[activePhotoIdx] || photos[0];
  const amenities = parseAmenities(detail);
  const stayNights = detail.nights || calculateNights(checkInDate, checkOutDate);
  const reviews = Array.isArray(detail.verifiedReviews) ? detail.verifiedReviews : [];
  const dayRates = Array.isArray(detail.dayOfWeekRates) ? detail.dayOfWeekRates : [];

  return (
    <Container fluid className="px-0">
      {/* Top Navigation & Breadcrumb */}
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <div className="small text-secondary">
          <Link to="/" className="text-decoration-none text-secondary">
            <i className="bi bi-house-door me-1"></i>Danh mục hạng phòng
          </Link>
          <span className="mx-2">/</span>
          <strong className="text-dark">{detail.typeName}</strong>
        </div>

        <Button
          variant="light"
          size="sm"
          className="btn-hms-light"
          onClick={() => navigate(-1)}
        >
          <i className="bi bi-arrow-left me-1"></i>Quay lại
        </Button>
      </div>

      {/* Main Header & Photo Gallery Card (UC-22 Step 2 & 3) */}
      <Card className="border-0 shadow-sm rounded-4 overflow-hidden mb-4 bg-white">
        <Row className="g-0">
          {/* Left: Photo Gallery */}
          <Col xs={12} lg={7} className="bg-dark d-flex flex-column justify-content-between">
            <div className="position-relative" style={{ minHeight: 360, height: '100%' }}>
              <img
                src={currentPhoto}
                alt={detail.typeName}
                className="w-100 h-100 object-fit-cover"
                style={{ maxHeight: 430 }}
                onError={(e) => {
                  e.currentTarget.onerror = null;
                  e.currentTarget.src = '/images/hotel-bg.jpg';
                }}
              />
              <div className="position-absolute top-0 start-0 p-3 d-flex gap-2">
                <span className="rounded-pill hms-pill-dark">
                  Mã hạng #{detail.roomTypeId}
                </span>
                <span
                  className={`rounded-pill ${
                    detail.availableRoomsCount > 0 ? 'hms-pill-success' : 'hms-pill-danger'
                  }`}
                >
                  {detail.availableRoomsCount > 0
                    ? `Còn ${detail.availableRoomsCount}/${detail.totalActiveRooms} phòng trống`
                    : 'Tạm hết phòng trống'}
                </span>
              </div>
            </div>

            {/* Thumbnail Strip */}
            {photos.length > 1 && (
              <div className="p-2 bg-dark border-top border-secondary d-flex gap-2 overflow-auto">
                {photos.map((url, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setActivePhotoIdx(idx)}
                    className={`p-0 border rounded-2 overflow-hidden ${
                      idx === activePhotoIdx ? 'border-warning border-2' : 'border-secondary opacity-75'
                    }`}
                    style={{ width: 76, height: 52, background: 'transparent' }}
                  >
                    <img
                      src={url}
                      alt={`Ảnh ${idx + 1}`}
                      className="w-100 h-100 object-fit-cover"
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = '/images/hotel-bg.jpg';
                      }}
                    />
                  </button>
                ))}
              </div>
            )}
          </Col>

          {/* Right: Specifications, Bed Layout & Base Rate */}
          <Col xs={12} lg={5}>
            <Card.Body className="p-4 d-flex flex-column h-100">
              <div className="d-flex justify-content-between align-items-start gap-2 mb-2">
                <div>
                  <Badge bg="warning" text="dark" className="mb-2">
                    ★ {detail.averageRating ? `${detail.averageRating} / 5.0` : 'Tiêu chuẩn 5 sao'} (
                    {detail.reviewCount || 0} đánh giá xác thực)
                  </Badge>
                  <h1 className="h3 fw-bold text-dark mb-1">{detail.typeName}</h1>
                </div>
              </div>

              <div className="mb-3 pb-3 border-bottom">
                <div className="text-secondary small">Giá niêm yết tiêu chuẩn</div>
                <div className="fs-3 fw-bold" style={{ color: '#C96442' }}>
                  {formatVND(detail.basePrice)}{' '}
                  <span className="fs-6 fw-normal text-secondary">/ đêm</span>
                </div>
              </div>

              <p className="text-secondary mb-3">{detail.description}</p>

              {/* Bed Layout & Room Specifications Grid */}
              <Row className="g-3 rounded-3 p-3 mb-3 mx-0 hms-spec-box">
                <Col xs={12}>
                  <div className="text-secondary small">
                    <i className="bi bi-lamp-fill me-1 text-warning"></i>Bố trí giường (Bed Layout)
                  </div>
                  <strong className="text-dark">{detail.bedLayout}</strong>
                </Col>
                <Col xs={6}>
                  <div className="text-secondary small">
                    <i className="bi bi-people-fill me-1"></i>Sức chứa tối đa
                  </div>
                  <strong className="text-dark">{detail.capacity} khách người lớn</strong>
                </Col>
                <Col xs={6}>
                  <div className="text-secondary small">
                    <i className="bi bi-layers-fill me-1"></i>Vị trí tầng
                  </div>
                  <strong className="text-dark">
                    {Array.isArray(detail.floorNumbers) && detail.floorNumbers.length > 0
                      ? `Tầng ${detail.floorNumbers.join(', ')}`
                      : 'Tầng tiêu chuẩn'}
                  </strong>
                </Col>
                {Array.isArray(detail.sampleRoomNumbers) && detail.sampleRoomNumbers.length > 0 && (
                  <Col xs={12}>
                    <div className="text-secondary small">
                      <i className="bi bi-door-open me-1"></i>Các phòng thuộc hạng này
                    </div>
                    <strong className="text-dark">
                      Phòng {detail.sampleRoomNumbers.join(', ')}
                    </strong>
                  </Col>
                )}
              </Row>

              {/* Estimated Stay Box if dates selected */}
              {stayNights > 0 && (
                <div className="hms-estimated-total-box mb-3 d-flex justify-content-between align-items-center">
                  <div>
                    <div className="small fw-bold text-dark">
                      Tổng dự kiến ({stayNights} đêm • {guests} khách)
                    </div>
                    <div className="text-secondary" style={{ fontSize: 12 }}>
                      {formatVietnameseDate(checkInDate)} → {formatVietnameseDate(checkOutDate)}
                    </div>
                  </div>
                  <div className="fs-4 fw-bold" style={{ color: '#B45309' }}>
                    {formatVND(
                      detail.estimatedTotal ?? Number(detail.basePrice || 0) * stayNights
                    )}
                  </div>
                </div>
              )}

              <div className="mt-auto pt-2 d-flex gap-2">
                <Button
                  className="btn-hms-accent flex-grow-1"
                  disabled={detail.availableRoomsCount === 0}
                  onClick={() => {
                    const q = new URLSearchParams();
                    q.set('roomTypeId', String(detail.roomTypeId));
                    if (checkInDate) q.set('checkInDate', checkInDate);
                    if (checkOutDate) q.set('checkOutDate', checkOutDate);
                    if (guests) q.set('guests', guests);
                    navigate(`/booking/checkout?${q.toString()}`);
                  }}
                >
                  <i className="bi bi-calendar2-check me-2"></i>
                  Đặt Hạng Phòng Này
                </Button>
              </div>
            </Card.Body>
          </Col>
        </Row>
      </Card>

      {/* Row 2: Amenity Checklists & Day-of-Week Tariff Table */}
      <Row className="g-4 mb-4">
        {/* Left: Amenity Checklist */}
        <Col xs={12} lg={6}>
          <Card className="border-0 shadow-sm rounded-4 h-100 bg-white">
            <Card.Body className="p-4">
              <h2 className="h5 fw-bold text-dark mb-3">
                <i className="bi bi-check2-square me-2 text-success"></i>
                Danh Mục Tiện Nghi Phòng (Amenity Checklist)
              </h2>
              <Row className="g-3">
                {amenities.map((item, idx) => (
                  <Col key={idx} xs={12} sm={6}>
                    <div className="d-flex align-items-center gap-2 p-2 rounded-3 hms-spec-box">
                      <i className="bi bi-check-circle-fill text-success"></i>
                      <span className="fw-semibold text-dark">{item}</span>
                    </div>
                  </Col>
                ))}
              </Row>
            </Card.Body>
          </Card>
        </Col>

        {/* Right: Nightly Tariff Schedule by Day of Week */}
        <Col xs={12} lg={6}>
          <Card className="border-0 shadow-sm rounded-4 h-100 bg-white">
            <Card.Body className="p-4">
              <h2 className="h5 fw-bold text-dark mb-3">
                <i className="bi bi-cash-coin me-2 text-warning"></i>
                Biểu Giá Niêm Yết Theo Ngày Trong Tuần
              </h2>
              <Table responsive hover className="align-middle mb-0 small">
                <thead className="table-light">
                  <tr>
                    <th>Ngày trong tuần</th>
                    <th>Phân loại</th>
                    <th className="text-end">Đơn giá / đêm</th>
                  </tr>
                </thead>
                <tbody>
                  {dayRates.map((rate) => (
                    <tr key={rate.dayOfWeek}>
                      <td className="fw-semibold">{rate.dayLabel}</td>
                      <td>
                        {rate.isWeekendSurcharge ? (
                          <Badge bg="warning" text="dark">
                            Cuối tuần
                          </Badge>
                        ) : (
                          <Badge bg="light" text="dark" className="border">
                            Ngày thường
                          </Badge>
                        )}
                      </td>
                      <td className="text-end fw-bold text-dark">
                        {formatVND(rate.price)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Row 3: Verified Guest Reviews & Management Replies (UC-22 Step 2 & 3) */}
      <Card className="border-0 shadow-sm rounded-4 bg-white mb-4">
        <Card.Body className="p-4">
          <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
            <div>
              <h2 className="h5 fw-bold text-dark mb-1">
                <i className="bi bi-chat-quote-fill me-2 text-primary"></i>
                Đánh Giá Xác Thực Từ Khách Đã Lưu Trú ({reviews.length})
              </h2>
              <p className="text-secondary small mb-0">
                Chỉ hiển thị các đánh giá từ khách hàng đã hoàn tất lưu trú (Completed Stay) tại hạng phòng này.
              </p>
            </div>
            {detail.averageRating && (
              <div className="px-3 py-2 rounded-3 hms-estimated-total-box fw-bold">
                ★ Điểm trung bình: {detail.averageRating} / 5.0
              </div>
            )}
          </div>

          {reviews.length === 0 ? (
            <div className="text-center py-4 text-secondary small border rounded-3 bg-light">
              Chưa có đánh giá nào được công bố cho hạng phòng này.
            </div>
          ) : (
            <div className="d-flex flex-column gap-3">
              {reviews.map((rev) => (
                <Card key={rev.reviewId} className="border rounded-3 shadow-none">
                  <Card.Body className="p-3">
                    <div className="d-flex justify-content-between align-items-start mb-2">
                      <div>
                        <strong className="text-dark me-2">{rev.customerName}</strong>
                        <Badge bg="success" className="me-2">
                          <i className="bi bi-patch-check-fill me-1"></i>Đã lưu trú
                          {rev.roomNumber ? ` (Phòng ${rev.roomNumber})` : ''}
                        </Badge>
                      </div>
                      <div className="text-warning fw-bold">
                        {'★'.repeat(rev.rating || 5)}
                        <span className="text-secondary small fw-normal ms-2">
                          {formatDateTime(rev.reviewDate)}
                        </span>
                      </div>
                    </div>

                    <p className="text-dark mb-2">{rev.comment}</p>

                    {rev.managementReply && (
                      <div className="p-3 rounded-3 bg-light border-start border-4 border-warning small mt-2">
                        <div className="fw-bold text-dark mb-1">
                          <i className="bi bi-reply-fill me-1 text-warning"></i>
                          Phản hồi từ Ban Quản lý Khách sạn HMS Luxury:
                        </div>
                        <div className="text-secondary">{rev.managementReply}</div>
                      </div>
                    )}
                  </Card.Body>
                </Card>
              ))}
            </div>
          )}
        </Card.Body>
      </Card>
    </Container>
  );
};

