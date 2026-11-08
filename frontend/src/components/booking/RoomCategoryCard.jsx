import { Card, Row, Col, Button } from 'react-bootstrap';
import { formatVND } from '../../lib/money';
import { formatVietnameseDate, parseAmenities } from './js/bookingUtils';

export const RoomCategoryCard = ({
  roomType,
  isSearchActive,
  activeSearchMeta,
  onSelectCategory,
}) => {
  const imageSrc = roomType.imageUrl || '/images/hotel-bg.jpg';
  const amenities = parseAmenities(roomType);
  const stayNights = roomType.nights || activeSearchMeta?.nights || 0;
  // Single price rule: the total comes from the backend, summed nightly
  // from Room_Type_Price. Never basePrice * nights here — that under-prices
  // weekend stays and disagrees with detail/modal/deposit totals.
  const estimatedStayTotal = roomType.estimatedTotal ?? null;

  return (
    <Card className="hms-category-card h-100 overflow-hidden bg-white">
      {/* Category Photo Header with Floating Badges & Gold Price Overlay Ribbon */}
      <div className="position-relative overflow-hidden hms-card-media">
        <img
          src={imageSrc}
          alt={roomType.typeName}
          className="hms-card-img d-block"
          onError={(e) => {
            e.currentTarget.onerror = null;
            e.currentTarget.src = '/images/hotel-bg.jpg';
          }}
        />

        {/* Top Floating Pills */}
        <div className="position-absolute top-0 start-0 end-0 p-3 d-flex justify-content-between align-items-center gap-2">
          <span className="rounded-pill hms-pill-dark">
            👥 Tối đa {roomType.capacity} khách
          </span>

          {typeof roomType.availableRoomsCount === 'number' && (
            <span
              className={`rounded-pill ${
                roomType.availableRoomsCount > 0 ? 'hms-pill-success' : 'hms-pill-danger'
              }`}
            >
              {roomType.availableRoomsCount > 0
                ? `Còn ${roomType.availableRoomsCount} phòng trống`
                : 'Tạm hết phòng trống'}
            </span>
          )}
        </div>

        {/* Bottom Gradient Price Overlay Ribbon */}
        <div className="position-absolute bottom-0 start-0 end-0 d-flex justify-content-between align-items-end hms-card-price-ribbon">
          <div>
            <div className="hms-price-label">Giá niêm yết tiêu chuẩn</div>
            <div className="hms-price-value">
              {formatVND(roomType.basePrice)}{' '}
              <span className="hms-price-unit">/ đêm</span>
            </div>
          </div>

          <div className="hms-rating-badge">
            {roomType.averageRating
              ? `★ ${roomType.averageRating} (${roomType.reviewCount || 0})`
              : '★ Hạng phòng tiêu chuẩn 5 sao'}
          </div>
        </div>
      </div>

      {/* Card Body: Title, Description, Estimated Total (when searching), Capacity & Amenities */}
      <Card.Body className="d-flex flex-column p-3 p-md-4">
        <div className="d-flex justify-content-between align-items-start gap-2 mb-2">
          <h3 className="h5 fw-bold text-dark mb-0">{roomType.typeName}</h3>
          <span className="hms-code-badge text-nowrap">Mã hạng #{roomType.roomTypeId}</span>
        </div>

        <p className="text-secondary small mb-3">
          {roomType.description ||
            'Không gian nghỉ dưỡng sang trọng với nội thất hiện đại và dịch vụ phòng 24/7.'}
        </p>

        {/* UC-21 Step 4: Estimated Total Box when user searches specific dates */}
        {isSearchActive && stayNights > 0 && estimatedStayTotal !== null && (
          <div className="hms-estimated-total-box mb-3 d-flex justify-content-between align-items-center">
            <div>
              <div className="small fw-semibold text-dark">
                <i className="bi bi-calculator me-1 text-warning"></i>
                Tổng dự kiến ({stayNights} đêm)
              </div>
              <div className="text-secondary" style={{ fontSize: 11.5 }}>
                {formatVietnameseDate(activeSearchMeta?.checkInDate)} →{' '}
                {formatVietnameseDate(activeSearchMeta?.checkOutDate)}
              </div>
            </div>
            <div className="fs-5 fw-bold" style={{ color: '#B45309' }}>
              {formatVND(estimatedStayTotal)}
            </div>
          </div>
        )}

        {/* Key Specifications Row */}
        <Row className="g-2 rounded-3 p-2 mb-3 mx-0 hms-spec-box">
          <Col xs={6}>
            <span className="text-secondary">Sức chứa:</span>{' '}
            <strong className="text-dark">{roomType.capacity} người lớn</strong>
          </Col>
          <Col xs={6}>
            <span className="text-secondary">Số lượng:</span>{' '}
            <strong className="text-dark">
              {typeof roomType.totalActiveRooms === 'number'
                ? `${roomType.totalActiveRooms} phòng`
                : 'Đang hoạt động'}
            </strong>
          </Col>
        </Row>

        {/* Amenities Tags */}
        <div className="mb-3 flex-grow-1">
          <div className="text-uppercase text-secondary fw-semibold small mb-2">
            Tiện nghi nổi bật:
          </div>
          <div className="d-flex flex-wrap gap-2">
            {amenities.length > 0 ? (
              amenities.map((amenity, idx) => (
                <span key={idx} className="hms-amenity-tag">
                  ✓ {amenity}
                </span>
              ))
            ) : (
              <span className="text-secondary small">
                Wi-Fi tốc độ cao, Điều hòa, Smart TV
              </span>
            )}
          </div>
        </div>

        {/* Card Footer Action Button - Opens UC-22 Detail Modal directly on Landing Page */}
        <div className="pt-3 border-top mt-auto d-grid">
          <Button
            variant="dark"
            className="btn-hms-dark w-100"
            onClick={() => onSelectCategory(roomType)}
          >
            <i className="bi bi-info-circle me-2"></i>
            Xem chi tiết hạng phòng
          </Button>
        </div>
      </Card.Body>
    </Card>
  );
};

