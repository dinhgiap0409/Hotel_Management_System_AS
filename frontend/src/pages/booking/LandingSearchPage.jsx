import { useEffect, useMemo, useState } from 'react';
import { Container, Row, Col, Card, Button, Spinner, Alert, Badge } from 'react-bootstrap';
import { bookingApi } from '../../services/bookingApi';
import { roomApi } from '../../services/roomApi';
import { useAuth } from '../../context/AuthContext';
import { HeroSearchSection } from '../../components/booking/HeroSearchSection';
import { CatalogFilterBar } from '../../components/booking/CatalogFilterBar';
import { RoomCategoryCard } from '../../components/booking/RoomCategoryCard';
import { RoomCategoryModal } from '../../components/booking/RoomCategoryModal';
import { NoVacancyState } from '../../components/booking/NoVacancyState';
import {
  getLocalDateString,
  calculateNights,
  formatVietnameseDate,
} from '../../components/booking/js/bookingUtils';
import '../../components/booking/css/bookingTheme.css';

export const LandingSearchPage = () => {
  const { user } = useAuth();
  const todayStr = useMemo(() => getLocalDateString(0), []);

  // Room categories fetched 100% from Database via Backend API
  const [roomTypes, setRoomTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // UC-21 Search Available Rooms state
  const [checkInDate, setCheckInDate] = useState(() => getLocalDateString(0));
  const [checkOutDate, setCheckOutDate] = useState(() => getLocalDateString(1));
  const [guestCount, setGuestCount] = useState('2');
  const [searchValidationError, setSearchValidationError] = useState(null);
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [activeSearchMeta, setActiveSearchMeta] = useState(null);

  // UC-14 Catalog Filter & Sort states (Initially show ALL categories unfiltered)
  const [keyword, setKeyword] = useState('');
  const [minCapacity, setMinCapacity] = useState('ALL');
  const [sortBy, setSortBy] = useState('DEFAULT');
  const [selectedCategory, setSelectedCategory] = useState(null);

  const loadRoomCategories = async () => {
    setLoading(true);
    setError(null);
    setSearchValidationError(null);
    setIsSearchActive(false);
    setActiveSearchMeta(null);
    try {
      const res = await bookingApi.getRoomCategories();
      const payload = Array.isArray(res.data) ? res.data : res.data?.data || [];
      setRoomTypes(payload);
    } catch {
      try {
        const fallbackRes = await roomApi.getRoomTypes();
        const fallbackPayload = Array.isArray(fallbackRes.data)
          ? fallbackRes.data
          : fallbackRes.data?.data || [];
        setRoomTypes(fallbackPayload);
      } catch (err) {
        setError(err.response?.data?.message || 'Không thể tải danh mục hạng phòng từ cơ sở dữ liệu.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRoomCategories();
  }, []);

  // UC-21 Main Flow: Search Available Rooms by Check-in, Check-out, and Guest Count from Database
  const executeAvailabilitySearch = async (targetCheckIn, targetCheckOut, targetGuests) => {
    setSearchValidationError(null);
    setError(null);

    if (!targetCheckIn || !targetCheckOut) {
      setSearchValidationError('Vui lòng chọn đầy đủ Ngày nhận phòng và Ngày trả phòng.');
      return;
    }
    if (targetCheckIn < todayStr) {
      setSearchValidationError('Ngày nhận phòng (Check-in) không được nằm trong quá khứ.');
      return;
    }
    const nights = calculateNights(targetCheckIn, targetCheckOut);
    if (nights <= 0) {
      setSearchValidationError('Ngày trả phòng (Check-out) phải sau Ngày nhận phòng ít nhất 1 đêm.');
      return;
    }
    const guestsNum = Number(targetGuests || 1);
    if (guestsNum < 1) {
      setSearchValidationError('Số lượng khách lưu trú phải từ 1 khách trở lên.');
      return;
    }

    setLoading(true);
    try {
      const res = await bookingApi.searchAvailableRoomTypes(targetCheckIn, targetCheckOut, guestsNum);
      const apiResults = Array.isArray(res.data) ? res.data : res.data?.data || [];

      // Keep the backend total as-is: it is already the nightly
      // Room_Type_Price sum for these dates. Never recompute it flat here.
      const computedResults = apiResults.map((rt) => ({
        ...rt,
        nights: rt.nights ?? nights,
      }));

      setRoomTypes(computedResults);
      setIsSearchActive(true);
      setActiveSearchMeta({
        checkInDate: targetCheckIn,
        checkOutDate: targetCheckOut,
        guests: guestsNum,
        nights,
      });
    } catch (err) {
      const backendMsg = err.response?.data?.message;
      if (err.response?.status === 400 || err.response?.status === 422) {
        setSearchValidationError(backendMsg || 'Ngày nhận/trả phòng không hợp lệ.');
      } else {
        setError(backendMsg || 'Không thể tra cứu phòng trống từ máy chủ.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    executeAvailabilitySearch(checkInDate, checkOutDate, guestCount);
  };

  const handleApplyAlternativeDates = (shiftDays, overrideGuests = null) => {
    const newCheckIn = getLocalDateString(shiftDays);
    const newCheckOut = getLocalDateString(shiftDays + 2);
    const nextGuests = overrideGuests !== null ? String(overrideGuests) : guestCount;
    setCheckInDate(newCheckIn);
    setCheckOutDate(newCheckOut);
    setGuestCount(nextGuests);
    executeAvailabilitySearch(newCheckIn, newCheckOut, nextGuests);
  };

  const filteredCategories = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    const capFilter = minCapacity === 'ALL' ? 0 : Number(minCapacity);

    const list = roomTypes.filter((rt) => {
      if (rt.isActive === false) return false;
      if (capFilter > 0 && Number(rt.capacity || 0) < capFilter) return false;
      if (q) {
        const matchName = (rt.typeName || '').toLowerCase().includes(q);
        const matchDesc = (rt.description || '').toLowerCase().includes(q);
        const matchAmenity = (rt.amenities || '').toLowerCase().includes(q);
        if (!matchName && !matchDesc && !matchAmenity) return false;
      }
      return true;
    });

    if (sortBy === 'DEFAULT') {
      return list;
    }

    return [...list].sort((a, b) => {
      const priceA = Number(a.basePrice || 0);
      const priceB = Number(b.basePrice || 0);
      if (sortBy === 'PRICE_ASC') return priceA - priceB;
      if (sortBy === 'PRICE_DESC') return priceB - priceA;
      if (sortBy === 'CAPACITY_DESC') return Number(b.capacity || 0) - Number(a.capacity || 0);
      if (sortBy === 'NAME_ASC') return (a.typeName || '').localeCompare(b.typeName || '');
      return 0;
    });
  }, [roomTypes, keyword, minCapacity, sortBy]);

  return (
    <Container fluid className="px-0">
      {/* 1. Hero Banner & UC-21 Search Available Rooms Bar */}
      <HeroSearchSection
        userRole={user?.role}
        todayStr={todayStr}
        checkInDate={checkInDate}
        setCheckInDate={setCheckInDate}
        checkOutDate={checkOutDate}
        setCheckOutDate={setCheckOutDate}
        guestCount={guestCount}
        setGuestCount={setGuestCount}
        onSearchSubmit={handleSearchSubmit}
        isSearchActive={isSearchActive}
        onResetToAllCategories={loadRoomCategories}
        searchValidationError={searchValidationError}
      />

      {/* 2. Active Search Summary Banner (UC-21 Step 4) */}
      {isSearchActive && activeSearchMeta && (
        <Alert
          variant="warning"
          className="rounded-3 border shadow-sm mb-4 d-flex flex-wrap justify-content-between align-items-center gap-2"
        >
          <div>
            <Badge bg="dark" className="me-2 px-2 py-1">
              KẾT QUẢ TÌM PHÒNG TRỐNG
            </Badge>
            <span>
              Nhận phòng <strong>{formatVietnameseDate(activeSearchMeta.checkInDate)}</strong> → Trả phòng{' '}
              <strong>{formatVietnameseDate(activeSearchMeta.checkOutDate)}</strong> (
              <strong>{activeSearchMeta.nights} đêm</strong> •{' '}
              <strong>{activeSearchMeta.guests} khách</strong>): Tìm thấy{' '}
              <strong>{filteredCategories.length}</strong> hạng phòng đủ sức chứa và còn phòng trống.
            </span>
          </div>
          <Button size="sm" className="btn-hms-dark" onClick={loadRoomCategories}>
            <i className="bi bi-grid-3x3-gap me-1"></i>Xem toàn bộ hạng phòng
          </Button>
        </Alert>
      )}

      {/* 3. Catalog Filter & Sort Bar (UC-14) */}
      <CatalogFilterBar
        keyword={keyword}
        setKeyword={setKeyword}
        minCapacity={minCapacity}
        setMinCapacity={setMinCapacity}
        sortBy={sortBy}
        setSortBy={setSortBy}
      />

      {/* 4. Section Header */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h2 className="h4 fw-bold text-dark mb-1">
            {isSearchActive
              ? `Hạng Phòng Trống Phù Hợp (${filteredCategories.length})`
              : `Hạng Phòng Đang Hoạt Động (${filteredCategories.length})`}
          </h2>
          <p className="text-secondary small mb-0">
            {isSearchActive
              ? 'Đã loại trừ các phòng đang bảo trì, đang có khách lưu trú hoặc đã giữ chỗ trong khoảng ngày bạn chọn.'
              : 'Hiển thị đầy đủ hình ảnh, mô tả không gian, sức chứa tiêu chuẩn, tiện ích đi kèm và giá cơ bản theo đêm.'}
          </p>
        </div>
      </div>

      {/* 5. Loading / Error / Empty / Grid States */}
      {loading && (
        <Card className="border-0 shadow-sm rounded-3 text-center py-5">
          <Card.Body>
            <Spinner animation="border" variant="secondary" className="mb-2" />
            <div className="text-secondary">Đang kiểm tra dữ liệu hạng phòng từ cơ sở dữ liệu...</div>
          </Card.Body>
        </Card>
      )}

      {!loading && error && (
        <Alert variant="danger" className="d-flex justify-content-between align-items-center rounded-3">
          <span>
            <i className="bi bi-exclamation-triangle-fill me-2"></i>
            {error}
          </span>
        </Alert>
      )}

      {!loading && !error && filteredCategories.length === 0 && (
        <NoVacancyState
          isSearchActive={isSearchActive}
          activeSearchMeta={activeSearchMeta}
          checkInDate={checkInDate}
          checkOutDate={checkOutDate}
          guestCount={guestCount}
          onApplyAlternativeDates={handleApplyAlternativeDates}
          onSearchWithTwoGuests={() => executeAvailabilitySearch(checkInDate, checkOutDate, 2)}
          onResetAll={() => {
            setKeyword('');
            setMinCapacity('ALL');
            setSortBy('DEFAULT');
            loadRoomCategories();
          }}
        />
      )}

      {!loading && !error && filteredCategories.length > 0 && (
        <Row className="g-4">
          {filteredCategories.map((rt) => (
            <Col key={rt.roomTypeId} xs={12} md={6} lg={4}>
              <RoomCategoryCard
                roomType={rt}
                isSearchActive={isSearchActive}
                activeSearchMeta={activeSearchMeta}
                onSelectCategory={setSelectedCategory}
              />
            </Col>
          ))}
        </Row>
      )}

      {/* 6. Quick Category Inspection Modal */}
      <RoomCategoryModal
        selectedCategory={selectedCategory}
        onClose={() => {
          setSelectedCategory(null);
          // Auto refresh real-time room availability counts when modal closes
          loadRoomCategories();
        }}
        onBookingSuccess={() => {
          loadRoomCategories();
        }}
        isSearchActive={isSearchActive}
        activeSearchMeta={activeSearchMeta}
      />
    </Container>
  );
};
