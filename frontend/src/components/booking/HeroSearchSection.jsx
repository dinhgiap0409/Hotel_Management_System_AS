import { Card, Row, Col, Form, Button, Alert } from 'react-bootstrap';

export const HeroSearchSection = ({
  userRole,
  todayStr,
  checkInDate,
  setCheckInDate,
  checkOutDate,
  setCheckOutDate,
  guestCount,
  setGuestCount,
  onSearchSubmit,
  isSearchActive,
  onResetToAllCategories,
  searchValidationError,
}) => {
  return (
    <Card className="hms-hero-banner rounded-4 mb-4 overflow-hidden">
      <Card.Body className="p-4 p-md-5">
        <div className="d-inline-flex align-items-center gap-2 rounded-pill px-3 py-1 fw-semibold text-uppercase mb-3 hms-hero-badge">
          <span>★ HMS Luxury Collection</span>
          {userRole && <span>• Đang xem với quyền {userRole}</span>}
        </div>

        <h1 className="hms-hero-title mb-2">
          Danh Mục Hạng Phòng &amp; Tra Cứu Phòng Trống
        </h1>
        <p className="hms-hero-subtitle mb-4">
          Khám phá các hạng phòng tiêu chuẩn quốc tế tại HMS Luxury Hotel hoặc nhập ngày nhận/trả phòng
          và số lượng khách để kiểm tra phòng trống theo thời gian thực kèm tổng chi phí dự kiến.
        </p>

        {/* UC-21: Search Available Rooms Form */}
        <div className="hms-search-box p-3 p-md-4">
          <Form onSubmit={onSearchSubmit}>
            <Row className="g-3 align-items-end">
              <Col xs={12} sm={6} lg={3}>
                <Form.Group controlId="searchCheckIn">
                  <Form.Label className="small fw-bold text-dark mb-1">
                    <i className="bi bi-calendar-check me-1 text-danger"></i>
                    Ngày nhận phòng (Check-in)
                  </Form.Label>
                  <Form.Control
                    type="date"
                    min={todayStr}
                    value={checkInDate}
                    onChange={(e) => {
                      const val = e.target.value;
                      setCheckInDate(val);
                      if (checkOutDate && val >= checkOutDate) {
                        const nextDay = new Date(`${val}T00:00:00`);
                        nextDay.setDate(nextDay.getDate() + 1);
                        setCheckOutDate(nextDay.toISOString().slice(0, 10));
                      }
                    }}
                    required
                  />
                </Form.Group>
              </Col>

              <Col xs={12} sm={6} lg={3}>
                <Form.Group controlId="searchCheckOut">
                  <Form.Label className="small fw-bold text-dark mb-1">
                    <i className="bi bi-calendar-event me-1 text-danger"></i>
                    Ngày trả phòng (Check-out)
                  </Form.Label>
                  <Form.Control
                    type="date"
                    min={checkInDate || todayStr}
                    value={checkOutDate}
                    onChange={(e) => setCheckOutDate(e.target.value)}
                    required
                  />
                </Form.Group>
              </Col>

              <Col xs={12} sm={6} lg={3}>
                <Form.Group controlId="searchGuests">
                  <Form.Label className="small fw-bold text-dark mb-1">
                    <i className="bi bi-people-fill me-1 text-danger"></i>
                    Số lượng khách
                  </Form.Label>
                  <Form.Select
                    value={guestCount}
                    onChange={(e) => setGuestCount(e.target.value)}
                  >
                    <option value="1">1 khách người lớn</option>
                    <option value="2">2 khách (Cặp đôi / Tiêu chuẩn)</option>
                    <option value="3">3 khách (Phòng Premier / Gia đình nhỏ)</option>
                    <option value="4">4 khách (Gia đình / Suite)</option>
                    <option value="5">5 khách (Penthouse)</option>
                    <option value="6">6 khách (Presidential Penthouse)</option>
                    <option value="8">8 khách (Đoàn lớn - Kiểm tra hết chỗ)</option>
                  </Form.Select>
                </Form.Group>
              </Col>

              <Col xs={12} sm={6} lg={3} className="d-flex gap-2">
                <Button type="submit" className="btn-hms-accent flex-grow-1">
                  <i className="bi bi-search me-2"></i>
                  Tìm Phòng Trống
                </Button>
                {isSearchActive && (
                  <Button
                    type="button"
                    className="btn-hms-light"
                    onClick={onResetToAllCategories}
                    title="Xem tất cả hạng phòng"
                  >
                    Tất cả
                  </Button>
                )}
              </Col>
            </Row>
          </Form>

          {searchValidationError && (
            <Alert variant="danger" className="mt-3 mb-0 py-2 px-3 small d-flex align-items-center">
              <i className="bi bi-exclamation-octagon-fill me-2 fs-6"></i>
              <span>{searchValidationError}</span>
            </Alert>
          )}
        </div>
      </Card.Body>
    </Card>
  );
};

