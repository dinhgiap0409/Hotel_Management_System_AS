import { Card, Button } from 'react-bootstrap';
import { formatVietnameseDate } from './js/bookingUtils';

export const NoVacancyState = ({
  isSearchActive,
  activeSearchMeta,
  checkInDate,
  checkOutDate,
  guestCount,
  onApplyAlternativeDates,
  onSearchWithTwoGuests,
  onResetAll,
}) => {
  return (
    <Card className="border-0 shadow-sm rounded-4 text-center py-5 px-3 bg-white">
      <Card.Body>
        <div className="mb-3">
          <span
            className="d-inline-flex align-items-center justify-content-center rounded-circle"
            style={{ width: 64, height: 64, background: '#FEF2F2', color: '#DC2626', fontSize: 28 }}
          >
            <i className="bi bi-calendar-x"></i>
          </span>
        </div>
        <h3 className="h5 fw-bold text-dark mb-2">
          Không còn hạng phòng trống phù hợp với tiêu chí của bạn
        </h3>
        <p className="text-secondary small mb-4 mx-auto" style={{ maxWidth: 580 }}>
          {isSearchActive
            ? `Hiện không có hạng phòng trống nào đáp ứng đủ cho ${
                activeSearchMeta?.guests || guestCount
              } khách từ ngày ${formatVietnameseDate(
                activeSearchMeta?.checkInDate || checkInDate
              )} đến ${formatVietnameseDate(
                activeSearchMeta?.checkOutDate || checkOutDate
              )}. Bạn có thể chọn ngày lưu trú thay thế gợi ý bên dưới:`
            : 'Hiện không có hạng phòng đang hoạt động nào khớp với từ khóa hoặc bộ lọc sức chứa của bạn.'}
        </p>

        <div className="d-flex flex-wrap justify-content-center gap-2">
          {isSearchActive && (
            <>
              <Button
                className="btn-hms-accent"
                onClick={() => onApplyAlternativeDates(1, Math.min(Number(guestCount), 4))}
              >
                <i className="bi bi-calendar-plus me-1"></i>
                Gợi ý 1: Nhận phòng ngày mai (2 đêm)
              </Button>
              <Button
                className="btn-hms-dark"
                onClick={() => onApplyAlternativeDates(3, Math.min(Number(guestCount), 4))}
              >
                <i className="bi bi-calendar2-week me-1"></i>
                Gợi ý 2: Dời sang 3 ngày tới
              </Button>
              {Number(guestCount) > 4 && (
                <Button className="btn-hms-light" onClick={onSearchWithTwoGuests}>
                  <i className="bi bi-people me-1"></i>
                  Tìm phòng tiêu chuẩn 2 khách (Đặt tách nhiều phòng)
                </Button>
              )}
            </>
          )}
          <Button className="btn-hms-light" onClick={onResetAll}>
            <i className="bi bi-grid me-1"></i>
            Xem toàn bộ hạng phòng
          </Button>
        </div>
      </Card.Body>
    </Card>
  );
};

