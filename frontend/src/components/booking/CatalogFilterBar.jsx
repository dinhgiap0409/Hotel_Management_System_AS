import { Card, Row, Col, Form } from 'react-bootstrap';

export const CatalogFilterBar = ({
  keyword,
  setKeyword,
  minCapacity,
  setMinCapacity,
  sortBy,
  setSortBy,
}) => {
  return (
    <Card className="hms-filter-card rounded-3 mb-4 bg-white">
      <Card.Body className="p-3 p-md-4">
        <Row className="g-3 align-items-end">
          <Col xs={12} lg={6}>
            <Form.Group controlId="filterKeyword">
              <Form.Label className="small fw-semibold text-secondary mb-1">
                <i className="bi bi-search me-1"></i>Tìm theo tên hạng phòng hoặc tiện nghi
              </Form.Label>
              <Form.Control
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="VD: Deluxe, Suite, Penthouse, Bathtub, Balcony, Smart TV..."
              />
            </Form.Group>
          </Col>

          <Col xs={12} sm={6} lg={3}>
            <Form.Group controlId="filterCapacity">
              <Form.Label className="small fw-semibold text-secondary mb-1">
                <i className="bi bi-people me-1"></i>Sức chứa tối thiểu
              </Form.Label>
              <Form.Select
                value={minCapacity}
                onChange={(e) => setMinCapacity(e.target.value)}
              >
                <option value="ALL">Tất cả sức chứa</option>
                <option value="2">Từ 2 khách trở lên</option>
                <option value="3">Từ 3 khách trở lên</option>
                <option value="4">Gia đình (4+ khách)</option>
                <option value="6">Nhóm lớn / Penthouse (6+ khách)</option>
              </Form.Select>
            </Form.Group>
          </Col>

          <Col xs={12} sm={6} lg={3}>
            <Form.Group controlId="filterSort">
              <Form.Label className="small fw-semibold text-secondary mb-1">
                <i className="bi bi-sort-down me-1"></i>Sắp xếp theo
              </Form.Label>
              <Form.Select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              >
                <option value="DEFAULT">Mặc định (Tất cả hạng phòng)</option>
                <option value="PRICE_ASC">Giá tiêu chuẩn: Thấp → Cao</option>
                <option value="PRICE_DESC">Giá tiêu chuẩn: Cao → Thấp</option>
                <option value="CAPACITY_DESC">Sức chứa: Lớn → Nhỏ</option>
                <option value="NAME_ASC">Tên hạng phòng (A → Z)</option>
              </Form.Select>
            </Form.Group>
          </Col>
        </Row>
      </Card.Body>
    </Card>
  );
};

