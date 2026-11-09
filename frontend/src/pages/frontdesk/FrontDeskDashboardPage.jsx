import { useEffect, useState, useMemo } from 'react';
import { frontDeskApi } from '../../services/frontDeskApi';
import { bookingApi } from '../../services/bookingApi';
import { DataTable } from '../../components/common/DataTable';
import { StatusBadge } from '../../components/common/StatusBadge';
import { formatDateTime, formatDate } from '../../lib/datetime';
import { formatVND } from '../../lib/money';
import { notifyToast } from '../../lib/http';
import './frontDesk.css';
import { CheckInModal } from './components/CheckInModal';
import { ExtendStayModal } from './components/ExtendStayModal';
import { RoomTransferModal } from './components/RoomTransferModal';
import { CheckOutModal } from './components/CheckOutModal';
import { StayDetailModal } from './components/StayDetailModal';
import { CancelOverdueArrivalModal } from './components/CancelOverdueArrivalModal';
import { DirectBookingSuccessModal } from './components/DirectBookingSuccessModal';

const PaginationControl = ({ totalItems, currentPage, pageSize, onPageChange, onPageSizeChange }) => {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  if (totalItems === 0) return null;

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '12px 16px',
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderTop: 'none',
        borderRadius: '0 0 8px 8px',
        fontSize: 13,
        color: '#64748b',
        flexWrap: 'wrap',
        gap: 12,
        marginTop: -1,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span>
          Hiển thị <strong>{startItem} - {endItem}</strong> trong <strong>{totalItems}</strong> kết quả
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>Số hàng/trang:</span>
          <select
            value={pageSize}
            onChange={(e) => {
              onPageSizeChange(Number(e.target.value));
              onPageChange(1);
            }}
            style={{
              padding: '3px 8px',
              borderRadius: 4,
              border: '1px solid #cbd5e1',
              fontSize: 12,
              color: '#334155',
              background: '#fff',
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <button
          type="button"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          style={{
            padding: '4px 10px',
            borderRadius: 4,
            border: '1px solid #cbd5e1',
            background: currentPage <= 1 ? '#f8fafc' : '#ffffff',
            color: currentPage <= 1 ? '#94a3b8' : '#0f172a',
            cursor: currentPage <= 1 ? 'not-allowed' : 'pointer',
            fontSize: 12,
            fontWeight: 500,
          }}
        >
          <i className="bi bi-chevron-left"></i> Trước
        </button>

        {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => {
          if (totalPages > 7) {
            if (p !== 1 && p !== totalPages && Math.abs(p - currentPage) > 2) {
              if (p === 2 || p === totalPages - 1) {
                return (
                  <span key={p} style={{ padding: '0 4px', color: '#94a3b8' }}>
                    ...
                  </span>
                );
              }
              return null;
            }
          }
          const isCurrent = p === currentPage;
          return (
            <button
              key={p}
              type="button"
              onClick={() => onPageChange(p)}
              style={{
                minWidth: 28,
                height: 28,
                padding: '0 6px',
                borderRadius: 4,
                border: isCurrent ? '1px solid #0f172a' : '1px solid #cbd5e1',
                background: isCurrent ? '#0f172a' : '#ffffff',
                color: isCurrent ? '#ffffff' : '#334155',
                fontWeight: isCurrent ? 700 : 500,
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              {p}
            </button>
          );
        })}

        <button
          type="button"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          style={{
            padding: '4px 10px',
            borderRadius: 4,
            border: '1px solid #cbd5e1',
            background: currentPage >= totalPages ? '#f8fafc' : '#ffffff',
            color: currentPage >= totalPages ? '#94a3b8' : '#0f172a',
            cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer',
            fontSize: 12,
            fontWeight: 500,
          }}
        >
          Sau <i className="bi bi-chevron-right"></i>
        </button>
      </div>
    </div>
  );
};

export const FrontDeskDashboardPage = () => {
  const [activeTab, setActiveTab] = useState('arrivals'); // 'arrivals' | 'stays' | 'direct-booking' | 'all-bookings'
  const [stays, setStays] = useState([]);
  const [arrivals, setArrivals] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [roomTypes, setRoomTypes] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Danh sách các đơn chờ đặt cọc (áp dụng cho cả đặt Online lẫn tại Quầy)
  const pendingDeposits = useMemo(() => {
    return bookings
      .filter((b) => {
        if (['CANCELLED', 'CHECKED_IN', 'COMPLETED'].includes(b.status)) return false;
        return b.status === 'PENDING' || (b.depositPaymentStatus && b.depositPaymentStatus !== 'PAID');
      })
      .sort((a, b) => new Date(b.reservationDate || b.checkInDate) - new Date(a.reservationDate || a.checkInDate));
  }, [bookings]);

  // --- Direct Booking Form State (Multi-room selection) ---
  const todayStr = new Date().toISOString().split('T')[0];
  const tomorrowStr = new Date(Date.now() + 86400000).toISOString().split('T')[0];

  const getNextDayStr = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    d.setDate(d.getDate() + 1);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [bookingForm, setBookingForm] = useState({
    checkInDate: todayStr,
    checkOutDate: tomorrowStr,
    contactName: '',
    contactPhone: '',
    contactEmail: '',
    guestIdNumber: '',
    specialNotes: '',
  });

  const handleCheckInDateChange = (newCheckIn) => {
    const minNext = getNextDayStr(newCheckIn);
    setBookingForm((prev) => {
      let nextCheckOut = prev.checkOutDate;
      if (!nextCheckOut || nextCheckOut <= newCheckIn) {
        nextCheckOut = minNext;
      }
      return { ...prev, checkInDate: newCheckIn, checkOutDate: nextCheckOut };
    });
    setBookingQuote(null);
  };

  const handleCheckOutDateChange = (newCheckOut) => {
    setBookingForm((prev) => {
      const minNext = getNextDayStr(prev.checkInDate);
      const safeCheckOut = newCheckOut && newCheckOut > prev.checkInDate ? newCheckOut : minNext;
      return { ...prev, checkOutDate: safeCheckOut };
    });
    setBookingQuote(null);
  };

  // Step 1 & Step 2 Booking Availability Filtering
  const [filterGuestCount, setFilterGuestCount] = useState(2);
  const [availableRoomTypes, setAvailableRoomTypes] = useState([]);
  const [isFilterDone, setIsFilterDone] = useState(false);
  const [isCheckingAvailability, setIsCheckingAvailability] = useState(false);

  // Direct Booking Room Selection Matrix: { [roomTypeId]: quantity }
  const [roomQuantities, setRoomQuantities] = useState({});
  const [bookingQuote, setBookingQuote] = useState(null);
  const [isCalculatingQuote, setIsCalculatingQuote] = useState(false);

  const [isSubmittingBooking, setIsSubmittingBooking] = useState(false);
  const [lastCreatedBooking, setLastCreatedBooking] = useState(null);
  const [successModalData, setSuccessModalData] = useState(null);
  const [isCashPaidConfirmed, setIsCashPaidConfirmed] = useState(false);
  const [isProcessingCash, setIsProcessingCash] = useState(false);

  // --- Check-in Modal State (70% / 30% Wireframe & Partial Check-in) ---
  const [checkInModalData, setCheckInModalData] = useState(null);
  const [checkInCategories, setCheckInCategories] = useState([]);
  const [availableRoomsByType, setAvailableRoomsByType] = useState({});
  const [checkInSlots, setCheckInSlots] = useState([]);
  const [isLoadingRooms, setIsLoadingRooms] = useState(false);
  const [checkInDepositAmount, setCheckInDepositAmount] = useState('500000');
  const [checkInDepositMethod, setCheckInDepositMethod] = useState('CASH');
  const [checkInSavedCCCD, setCheckInSavedCCCD] = useState(true);
  const [checkInIncludeBreakfast, setCheckInIncludeBreakfast] = useState(true);
  const [checkInStaffNotes, setCheckInStaffNotes] = useState('');
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [activeCheckingInSlotId, setActiveCheckingInSlotId] = useState(null);

  // --- Check-out Modal State (Zero-Folio Check per BR-26 & MSG10) ---
  const [checkOutModalStay, setCheckOutModalStay] = useState(null);
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  // --- Extend Stay Modal State (UC-29) ---
  const [extendStayModal, setExtendStayModal] = useState(null);
  const [newCheckOutDate, setNewCheckOutDate] = useState('');
  const [extendReason, setExtendReason] = useState('');
  const [isExtending, setIsExtending] = useState(false);
  const [availabilityCheck, setAvailabilityCheck] = useState({
    checking: false,
    checked: false,
    availableRoomsCount: null,
    isAvailable: true,
    message: '',
  });

  // --- Room Transfer Modal State (UC-28) ---
  const [transferModalStay, setTransferModalStay] = useState(null);
  const [transferTargetRoomId, setTransferTargetRoomId] = useState('');
  const [transferReason, setTransferReason] = useState('');
  const [transferAdditionalCharge, setTransferAdditionalCharge] = useState(0);
  const [transferAvailableRooms, setTransferAvailableRooms] = useState([]);
  const [isLoadingTransferRooms, setIsLoadingTransferRooms] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);

  // --- Stay & Room Details Modal State ---
  const [stayDetailModal, setStayDetailModal] = useState(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [staysRes, arrivalsRes, allBookingsRes, roomTypesRes, availRes] = await Promise.all([
        frontDeskApi.getActiveStays(),
        frontDeskApi.getArrivals(),
        bookingApi.getAllBookings(),
        bookingApi.getRoomTypes(),
        frontDeskApi
          .getAvailableRoomTypes({
            checkInDate: todayStr,
            checkOutDate: tomorrowStr,
            guests: filterGuestCount,
          })
          .catch(() => ({ data: [] })),
      ]);

      setStays(Array.isArray(staysRes.data) ? staysRes.data : staysRes.data?.data || []);
      setArrivals(Array.isArray(arrivalsRes.data) ? arrivalsRes.data : arrivalsRes.data?.data || []);
      setBookings(Array.isArray(allBookingsRes.data) ? allBookingsRes.data : allBookingsRes.data?.data || []);

      const rtList = Array.isArray(roomTypesRes.data) ? roomTypesRes.data : roomTypesRes.data?.data || [];
      setRoomTypes(rtList);

      const availList = Array.isArray(availRes.data) ? availRes.data : availRes.data?.data || [];
      setAvailableRoomTypes(availList);

      if (availList.length > 0) {
        setIsFilterDone(true);
      }
    } catch (err) {
      notifyToast({
        type: 'danger',
        message: err.response?.data?.message || 'Không thể đồng bộ dữ liệu quầy lễ tân.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const getStayRoomPrice = (stay) => {
    if (!stay) return 0;
    if (stay.roomPrice) return Number(stay.roomPrice);
    if (stay.roomTypeId && roomTypes.length > 0) {
      const found = roomTypes.find((rt) => rt.roomTypeId === stay.roomTypeId);
      if (found && found.basePrice) return Number(found.basePrice);
    }
    return 0;
  };

  // UC-29: Real-time Quota & Overbooking Conflict Check when Extending Stay
  useEffect(() => {
    if (!extendStayModal || !newCheckOutDate || !extendStayModal.checkOutDate) {
      setAvailabilityCheck({ checking: false, checked: false, availableRoomsCount: null, isAvailable: true, message: '' });
      return;
    }

    if (newCheckOutDate <= extendStayModal.checkOutDate) {
      setAvailabilityCheck({
        checking: false,
        checked: true,
        availableRoomsCount: 0,
        isAvailable: false,
        message: 'Ngày trả mới phải sau ngày trả hiện tại.',
      });
      return;
    }

    let isMounted = true;
    setAvailabilityCheck((prev) => ({ ...prev, checking: true }));

    const timer = setTimeout(async () => {
      try {
        const res = await frontDeskApi.getAvailableRoomTypes({
          checkInDate: extendStayModal.checkOutDate,
          checkOutDate: newCheckOutDate,
        });
        const list = Array.isArray(res.data) ? res.data : res.data?.data || [];
        const matched = list.find((item) => item.roomTypeId === extendStayModal.roomTypeId);
        if (isMounted) {
          if (matched) {
            const count = matched.availableRoomsCount ?? 0;
            setAvailabilityCheck({
              checking: false,
              checked: true,
              availableRoomsCount: count,
              isAvailable: count > 0,
              message:
                count > 0
                  ? `Còn ${count} phòng khả dụng trong khoảng thời gian này.`
                  : 'Hạng phòng đã hết chỗ (0 phòng trống khả dụng) do khách khác đã cọc trước.',
            });
          } else {
            setAvailabilityCheck({
              checking: false,
              checked: true,
              availableRoomsCount: 0,
              isAvailable: false,
              message: 'Hạng phòng đã kín chỗ (0 phòng trống khả dụng) trong giai đoạn gia hạn.',
            });
          }
        }
      } catch (err) {
        if (isMounted) {
          setAvailabilityCheck({
            checking: false,
            checked: true,
            availableRoomsCount: null,
            isAvailable: true,
            message: 'Không thể kết nối đối soát quota, hệ thống sẽ xác thực khi gửi yêu cầu.',
          });
        }
      }
    }, 350);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [extendStayModal, newCheckOutDate]);

  const stayNights = useMemo(() => {
    if (!bookingForm.checkInDate || !bookingForm.checkOutDate) return 1;
    const diff = Math.ceil(
      (new Date(bookingForm.checkOutDate) - new Date(bookingForm.checkInDate)) / (1000 * 60 * 60 * 24)
    );
    return diff > 0 ? diff : 1;
  }, [bookingForm.checkInDate, bookingForm.checkOutDate]);

  // Direct Booking Room Matrix Handlers
  const handleQuantityChange = (roomTypeId, delta) => {
    setRoomQuantities((prev) => {
      const current = prev[roomTypeId] || 0;
      const list = availableRoomTypes.length > 0 ? availableRoomTypes : roomTypes;
      const rt = list.find((t) => t.roomTypeId === roomTypeId);
      const maxAvailable = rt?.availableRoomsCount ?? 10;
      const next = Math.max(0, Math.min(maxAvailable, current + delta));
      return { ...prev, [roomTypeId]: next };
    });
    setBookingQuote(null);
  };

  const handleCalculateQuote = async () => {
    if (selectedRoomsList.length === 0) {
      notifyToast({ type: 'WARNING', message: 'Vui lòng chọn ít nhất một phòng từ bảng danh sách bên trái trước khi tính giá.' });
      return;
    }
    if (!bookingForm.checkInDate || !bookingForm.checkOutDate) {
      notifyToast({ type: 'WARNING', message: 'Vui lòng chọn ngày nhận và ngày trả phòng.' });
      return;
    }

    setIsCalculatingQuote(true);
    try {
      const payload = {
        checkInDate: bookingForm.checkInDate,
        checkOutDate: bookingForm.checkOutDate,
        guestCount: filterGuestCount,
        roomItems: selectedRoomsList.map((r) => ({
          roomTypeId: r.roomTypeId,
          quantity: r.quantity,
        })),
      };
      const res = await frontDeskApi.calculateBookingQuote(payload);
      const quoteData = res.data?.data || res.data;
      setBookingQuote(quoteData);
      notifyToast({
        type: 'SUCCESS',
        message: 'Máy chủ đã tính chi tiết biểu giá cho từng đêm lưu trú.',
      });
    } catch (err) {
      notifyToast({
        type: 'ERROR',
        message: err.response?.data?.message || 'Không thể tính giá đơn đặt phòng.',
      });
    } finally {
      setIsCalculatingQuote(false);
    }
  };

  const selectedRoomsList = useMemo(() => {
    const list = availableRoomTypes.length > 0 ? availableRoomTypes : roomTypes;
    return Object.entries(roomQuantities)
      .filter(([_, qty]) => qty > 0)
      .map(([rtId, qty]) => {
        const rt = list.find((t) => String(t.roomTypeId) === String(rtId));
        const periodPrice =
          rt?.totalPeriodPrice != null
            ? Number(rt.totalPeriodPrice)
            : (rt?.basePrice ? Number(rt.basePrice) * stayNights : 0);
        return {
          roomTypeId: Number(rtId),
          quantity: qty,
          typeName: rt?.typeName || 'Chưa chọn',
          basePrice: rt?.basePrice ? Number(rt.basePrice) : 0,
          periodPrice,
          capacity: rt?.capacity || 2,
          availableRoomsCount: rt?.availableRoomsCount,
          dailyTariffs: rt?.dailyTariffs || [],
          lineTotal: periodPrice * qty,
        };
      });
  }, [roomQuantities, availableRoomTypes, roomTypes, stayNights]);

  // Compute breakdown and total price across all selected room types
  const priceCalculation = useMemo(() => {
    let grandTotal = 0;
    let totalRoomsCount = 0;
    let totalCapacity = 0;

    selectedRoomsList.forEach((item) => {
      grandTotal += item.lineTotal;
      totalRoomsCount += item.quantity;
      totalCapacity += item.capacity * item.quantity;
    });

    return {
      items: selectedRoomsList,
      grandTotal,
      totalRoomsCount,
      totalCapacity,
    };
  }, [selectedRoomsList]);

  // Chỉ hiển thị các hạng phòng khả dụng còn phòng trống (> 0)
  const displayedRoomTypes = useMemo(() => {
    const list = availableRoomTypes.length > 0 ? availableRoomTypes : roomTypes;
    return list.filter((rt) => (rt.availableRoomsCount ?? 0) > 0);
  }, [availableRoomTypes, roomTypes]);

  const formatDong = (amount) => {
    if (amount == null) return '0 ₫';
    return Number(amount).toLocaleString('vi-VN') + ' ₫';
  };

  const formatShortPeriod = (label, shortLabel) => {
    if (shortLabel && !shortLabel.includes('Thứ')) return shortLabel;
    if (!label) return '';
    let s = label
      .replace(/Thứ Hai/g, 'T2')
      .replace(/Thứ Ba/g, 'T3')
      .replace(/Thứ Tư/g, 'T4')
      .replace(/Thứ Năm/g, 'T5')
      .replace(/Thứ Sáu/g, 'T6')
      .replace(/Thứ Bảy/g, 'T7')
      .replace(/Chủ Nhật/g, 'CN')
      .replace(/\/\d{4}/g, '')
      .replace(/ → /g, ' – ')
      .replace(/[()]/g, ' ');

    s = s.replace(/\s+/g, ' ').trim();
    s = s.replace(/(T\d|CN)\s+(\d{2}\/\d{2})/g, '$1, $2');

    return s;
  };

  // Tự động tính toán & phân rã chi tiết đơn giá theo ngày từ máy chủ
  useEffect(() => {
    if (selectedRoomsList.length === 0 || !bookingForm.checkInDate || !bookingForm.checkOutDate) {
      setBookingQuote(null);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const payload = {
          checkInDate: bookingForm.checkInDate,
          checkOutDate: bookingForm.checkOutDate,
          guestCount: filterGuestCount,
          roomItems: selectedRoomsList.map((r) => ({
            roomTypeId: r.roomTypeId,
            quantity: r.quantity,
          })),
        };
        const res = await frontDeskApi.calculateBookingQuote(payload);
        const quoteData = res.data?.data || res.data;
        setBookingQuote(quoteData);
      } catch (err) {
        // Tự động tính toán ngầm
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [roomQuantities, bookingForm.checkInDate, bookingForm.checkOutDate, filterGuestCount]);

  // Step 1: Filter available room types handler
  const handleFilterRooms = async (e) => {
    if (e) e.preventDefault();
    if (!bookingForm.checkInDate || !bookingForm.checkOutDate) {
      notifyToast({ type: 'warning', message: 'Vui lòng chọn ngày nhận và ngày trả phòng.' });
      return;
    }
    if (new Date(bookingForm.checkInDate) >= new Date(bookingForm.checkOutDate)) {
      notifyToast({ type: 'warning', message: 'Ngày trả phòng phải sau ngày nhận phòng.' });
      return;
    }

    setIsCheckingAvailability(true);
    try {
      const res = await frontDeskApi.getAvailableRoomTypes({
        checkInDate: bookingForm.checkInDate,
        checkOutDate: bookingForm.checkOutDate,
        guests: filterGuestCount,
      });
      const list = Array.isArray(res.data) ? res.data : res.data?.data || [];
      setAvailableRoomTypes(list);
      setIsFilterDone(true);

      // Clamp existing selections to new availability
      setRoomQuantities((prev) => {
        const next = {};
        list.forEach((rt) => {
          if (prev[rt.roomTypeId]) {
            const avail = rt.availableRoomsCount || 0;
            const clamped = Math.min(prev[rt.roomTypeId], avail);
            if (clamped > 0) next[rt.roomTypeId] = clamped;
          }
        });
        return next;
      });

      notifyToast({
        type: 'SUCCESS',
        message: `Đã kiểm tra kho phòng: tìm thấy ${list.length} hạng phòng.`,
      });
    } catch (err) {
      notifyToast({
        type: 'ERROR',
        message: err.response?.data?.message || 'Không thể kiểm tra phòng trống.',
      });
    } finally {
      setIsCheckingAvailability(false);
    }
  };

  // Submit Direct Booking
  const handleDirectBookingSubmit = async (e) => {
    e.preventDefault();
    if (!bookingForm.contactName.trim() || !bookingForm.contactPhone.trim()) {
      notifyToast({ type: 'WARNING', message: 'Họ tên và số điện thoại khách hàng là bắt buộc.' });
      return;
    }

    const phoneRegex = /^0\d{9}$/;
    if (!phoneRegex.test(bookingForm.contactPhone.trim())) {
      notifyToast({
        type: 'WARNING',
        message: 'Số điện thoại không hợp lệ: Yêu cầu đúng 10 chữ số và bắt đầu bằng số 0 (ví dụ: 0912345678).',
      });
      return;
    }

    if (new Date(bookingForm.checkInDate) >= new Date(bookingForm.checkOutDate)) {
      notifyToast({
        type: 'WARNING',
        message: 'Ngày trả phòng phải sau ngày nhận phòng ít nhất 1 đêm.',
      });
      return;
    }

    if (selectedRoomsList.length === 0) {
      notifyToast({ type: 'WARNING', message: 'Vui lòng chọn ít nhất một phòng từ bảng danh sách bên trái.' });
      return;
    }

    setIsSubmittingBooking(true);
    try {
      const payload = {
        ...bookingForm,
        roomItems: selectedRoomsList.map((r) => ({
          roomTypeId: r.roomTypeId,
          quantity: r.quantity,
        })),
        guestCount: filterGuestCount || priceCalculation.totalCapacity,
      };

      const res = await frontDeskApi.createDirectBooking(payload);
      const created = res.data?.data || res.data;
      setLastCreatedBooking(created);
      setIsCashPaidConfirmed(false);
      setSuccessModalData(created);

      notifyToast({
        type: 'INFO',
        message: `Đã khởi tạo đơn ${created.reservationCode}. Vui lòng thu tiền cọc của khách.`,
      });

      // Reset form contact info
      setBookingForm({
        checkInDate: todayStr,
        checkOutDate: tomorrowStr,
        contactName: '',
        contactPhone: '',
        contactEmail: '',
        guestIdNumber: '',
        specialNotes: '',
      });

      // Reset guest count
      setFilterGuestCount(2);

      // Reset room quantities to empty
      setRoomQuantities({});

      loadData();
    } catch (err) {
      notifyToast({
        type: 'ERROR',
        message: err.response?.data?.message || 'Tạo đặt phòng trực tiếp thất bại.',
      });
    } finally {
      setIsSubmittingBooking(false);
    }
  };

  const handleConfirmCash = async (reservationCode) => {
    setIsProcessingCash(true);
    try {
      await frontDeskApi.confirmCashPayment(reservationCode);
      setIsCashPaidConfirmed(true);
      notifyToast({
        type: 'SUCCESS',
        message: 'Đã xác nhận thanh toán tiền mặt thành công!',
      });
      loadData();
    } catch (err) {
      notifyToast({
        type: 'ERROR',
        message: err.response?.data?.message || 'Xác nhận tiền mặt thất bại.',
      });
    } finally {
      setIsProcessingCash(false);
    }
  };

  // Real-time polling trạng thái thanh toán từ Database khi Modal thanh toán đang mở
  useEffect(() => {
    if (!successModalData || isCashPaidConfirmed || successModalData.depositPaymentStatus === 'PAID') {
      return;
    }

    const interval = setInterval(async () => {
      try {
        const res = await frontDeskApi.getPaymentStatus(successModalData.reservationCode);
        const data = res.data;
        if (data && (data.depositPaymentStatus === 'PAID' || data.reservationStatus === 'CONFIRMED')) {
          setIsCashPaidConfirmed(true);
          setSuccessModalData((prev) => (prev ? { ...prev, depositPaymentStatus: 'PAID', status: 'CONFIRMED' } : null));
          notifyToast({
            type: 'SUCCESS',
            message: 'Đã nhận được thanh toán tiền cọc thành công!',
          });
          loadData();
        }
      } catch {
        // bỏ qua lỗi polling mạng tạm thời
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [successModalData, isCashPaidConfirmed]);

  const handleCancelPendingBooking = async (code) => {
    if (!window.confirm(`Bạn có chắc chắn muốn hủy đơn đặt phòng ${code} do khách chưa đặt cọc?`)) {
      return;
    }
    try {
      await frontDeskApi.cancelDirectBooking(code, 'Khách không đặt cọc tại quầy');
      setSuccessModalData(null);
      notifyToast({
        type: 'INFO',
        message: `Đã hủy đơn ${code}`,
      });
      loadData();
    } catch (err) {
      notifyToast({
        type: 'ERROR',
        message: err.response?.data?.message || 'Hủy đơn thất bại.',
      });
    }
  };

  const handleConfirmCancelArrival = async () => {
    if (!cancelArrivalModalData) return;
    setIsCancellingArrival(true);
    try {
      await frontDeskApi.cancelDirectBooking(
        cancelArrivalModalData.reservationCode,
        cancelArrivalReason || 'Khách không đến nhận phòng quá thời gian quy định (No-show)'
      );
      notifyToast({
        type: 'SUCCESS',
        message: `Đã hủy đơn #${cancelArrivalModalData.reservationCode} do quá thời gian thành công. Quota phòng đã được giải phóng.`,
      });
      setCancelArrivalModalData(null);
      loadData();
    } catch (err) {
      notifyToast({
        type: 'ERROR',
        message: err.response?.data?.message || 'Hủy đơn thất bại.',
      });
    } finally {
      setIsCancellingArrival(false);
    }
  };

  const openCheckInModal = async (reservation) => {
    // Đơn đã check-in một phần (đang nhận dở) hoặc status CHECKED_IN thì không bao giờ bị chặn cọc
    const isPartial =
      (reservation.checkedInRoomsCount || 0) > 0 ||
      reservation.status === 'CHECKED_IN';

    if (!isPartial && reservation.depositPaymentStatus && reservation.depositPaymentStatus !== 'PAID') {
      notifyToast({
        type: 'WARNING',
        message: `Đơn #${reservation.reservationCode} chưa hoàn tất thanh toán tiền cọc! Vui lòng thu tiền cọc trước khi làm thủ tục Check-in.`,
      });
      return;
    }

    setCheckInModalData(reservation);
    setIsLoadingRooms(true);
    setCheckInDepositAmount('500000');
    setCheckInDepositMethod('CASH');
    setCheckInSavedCCCD(true);
    setCheckInIncludeBreakfast(true);
    setCheckInStaffNotes(reservation.specialNotes || '');

    try {
      let rawCategories = [];
      if (reservation.bookedDetails && reservation.bookedDetails.length > 0) {
        rawCategories = reservation.bookedDetails;
      } else {
        // Smart parse fallback for roomTypeName e.g. "Standard Twin (x1), Family Suite (x1)"
        const raw = reservation.roomTypeName || '';
        const parts = raw.split(',').map((p) => p.trim()).filter(Boolean);
        rawCategories = parts.map((part) => {
          const m = part.match(/^(.*?)(?:\s*\(x(\d+)\))?$/);
          const name = m ? m[1].trim() : part;
          const qty = m && m[2] ? parseInt(m[2], 10) : 1;
          const matched =
            (roomTypes || []).find((rt) => rt.typeName.toLowerCase() === name.toLowerCase()) ||
            (availableRoomTypes || []).find((rt) => rt.typeName.toLowerCase() === name.toLowerCase()) ||
            { roomTypeId: reservation.roomTypeId, typeName: name, basePrice: 0 };
          return {
            roomTypeId: matched.roomTypeId,
            roomTypeName: matched.typeName || name,
            quantity: qty,
            unitPrice: matched.basePrice || 0,
            checkedInRoomNumbers: [],
          };
        });

        if (rawCategories.length === 0) {
          rawCategories = [
            {
              roomTypeId: reservation.roomTypeId,
              roomTypeName: reservation.roomTypeName || 'Tiêu chuẩn',
              quantity: reservation.roomQuantity || 1,
              unitPrice: reservation.estimatedTotal,
              checkedInRoomNumbers: [],
            },
          ];
        }
      }

      // Aggregate / deduplicate categories by roomTypeId:
      const catMap = new Map();
      rawCategories.forEach((cat) => {
        if (!cat.roomTypeId) return;
        if (catMap.has(cat.roomTypeId)) {
          const existing = catMap.get(cat.roomTypeId);
          existing.quantity = (existing.quantity || 1) + (cat.quantity || 1);
          const combinedAssigned = Array.from(
            new Set([...(existing.checkedInRoomNumbers || []), ...(cat.checkedInRoomNumbers || [])])
          );
          existing.checkedInRoomNumbers = combinedAssigned;
        } else {
          catMap.set(cat.roomTypeId, {
            ...cat,
            quantity: cat.quantity || 1,
            checkedInRoomNumbers: cat.checkedInRoomNumbers || [],
          });
        }
      });

      // Compute checkedInCount & pendingCount for each category
      const categories = Array.from(catMap.values()).map((cat) => {
        const assignedFromNumbers = (cat.checkedInRoomNumbers || []).length;
        const totalQty = cat.quantity || reservation.totalBookedRoomsCount || reservation.roomQuantity || 1;
        // Nếu đã có phòng nhận dở nhưng assignedFromNumbers rỗng, đồng bộ theo checkedInRoomsCount
        const checkedInCount = assignedFromNumbers > 0 ? assignedFromNumbers : Math.min(totalQty, reservation.checkedInRoomsCount || 0);
        const pendingCount = Math.max(0, totalQty - checkedInCount);
        return {
          ...cat,
          totalQty,
          checkedInCount,
          pendingCount,
        };
      });

      setCheckInCategories(categories);

      // Fetch available physical rooms for each category
      const map = {};
      for (const d of categories) {
        if (d.roomTypeId) {
          const res = await frontDeskApi.getAvailableRoomsForCheckIn(d.roomTypeId);
          map[d.roomTypeId] = Array.isArray(res.data) ? res.data : res.data?.data || [];
        }
      }
      setAvailableRoomsByType(map);

      // Build room assignment slots ONLY FOR REMAINING PENDING ROOMS
      const slots = [];
      const usedRoomIds = new Set();

      categories.forEach((cat) => {
        const typeAvailRooms = map[cat.roomTypeId] || [];

        for (let i = 0; i < cat.pendingCount; i++) {
          const slotNum = cat.checkedInCount + i + 1;
          const slotId = `${cat.roomTypeId}-pending-${i}`;

          const initialRoom = typeAvailRooms.find((r) => !usedRoomIds.has(r.roomId));
          if (initialRoom) usedRoomIds.add(initialRoom.roomId);

          slots.push({
            slotId,
            roomTypeId: cat.roomTypeId,
            roomTypeName: cat.roomTypeName,
            unitPrice: cat.unitPrice,
            slotIndex: slotNum,
            totalSlotsForType: cat.totalQty,
            selectedRoomId: initialRoom ? initialRoom.roomId : (typeAvailRooms[0]?.roomId || ''),
            keyCardNumber: initialRoom ? `CARD-${initialRoom.roomNumber}` : (typeAvailRooms[0] ? `CARD-${typeAvailRooms[0].roomNumber}` : ''),
            guestName: reservation.contactName || '',
            guestIdNumber: reservation.contactPhone || reservation.guestIdNumber || '001200000001',
          });
        }
      });

      setCheckInSlots(slots);
    } catch (err) {
      notifyToast({
        type: 'DANGER',
        message: err.response?.data?.message || 'Không thể tải danh sách phòng khả dụng.',
      });
    } finally {
      setIsLoadingRooms(false);
    }
  };

  const handleSlotRoomChange = (slotId, newRoomId) => {
    setCheckInSlots((prev) =>
      prev.map((s) => {
        if (s.slotId !== slotId) return s;
        const typeRooms = availableRoomsByType[s.roomTypeId] || [];
        const found = typeRooms.find((r) => String(r.roomId) === String(newRoomId));
        return {
          ...s,
          selectedRoomId: newRoomId,
          keyCardNumber: found ? `CARD-${found.roomNumber}` : s.keyCardNumber,
        };
      })
    );
  };

  const updateSlotField = (slotId, field, value) => {
    setCheckInSlots((prev) =>
      prev.map((s) => (s.slotId === slotId ? { ...s, [field]: value } : s))
    );
  };

  const handleCheckInSingleSlot = async (slot) => {
    if (!slot.selectedRoomId) {
      notifyToast({
        type: 'WARNING',
        message: `Vui lòng chọn phòng vật lý cho ${slot.roomTypeName} (Phòng ${slot.slotIndex}/${slot.totalSlotsForType}).`,
      });
      return;
    }
    if (!slot.guestIdNumber || !slot.guestIdNumber.trim()) {
      notifyToast({
        type: 'WARNING',
        message: `Vui lòng nhập số CCCD/Passport cho phòng ${slot.slotIndex}/${slot.totalSlotsForType} (BR-23).`,
      });
      return;
    }

    setActiveCheckingInSlotId(slot.slotId);
    try {
      const payload = {
        reservationId: checkInModalData.reservationId,
        roomId: Number(slot.selectedRoomId),
        guestIdNumber: slot.guestIdNumber.trim(),
        keyCardNumber: slot.keyCardNumber.trim() || undefined,
      };
      const res = await frontDeskApi.checkIn(payload);
      const stay = res.data?.data || res.data;

      notifyToast({
        type: 'SUCCESS',
        message: `Nhận phòng thành công: Phòng ${stay.roomNumber || ''} (${slot.roomTypeName}) đã bàn giao thẻ từ.`,
      });

      // Update category counts and remove completed slot immediately
      setCheckInCategories((prev) =>
        prev.map((c) => {
          if (c.roomTypeId !== slot.roomTypeId) return c;
          const updatedNumbers = [...(c.checkedInRoomNumbers || []), stay.roomNumber];
          const newCheckedCount = updatedNumbers.length;
          return {
            ...c,
            checkedInRoomNumbers: updatedNumbers,
            checkedInCount: newCheckedCount,
            pendingCount: Math.max(0, c.totalQty - newCheckedCount),
          };
        })
      );

      setCheckInSlots((prev) => prev.filter((s) => s.slotId !== slot.slotId));

      await loadData();
    } catch (err) {
      notifyToast({
        type: 'DANGER',
        message: err.response?.data?.message || 'Check-in phòng này không thành công.',
      });
    } finally {
      setActiveCheckingInSlotId(null);
    }
  };

  const handleCheckInAllSlots = async () => {
    if (checkInSlots.length === 0) {
      notifyToast({ type: 'INFO', message: 'Tất cả các phòng trong đơn đặt này đã được nhận.' });
      return;
    }

    for (const s of checkInSlots) {
      if (!s.selectedRoomId) {
        notifyToast({
          type: 'WARNING',
          message: `Chưa chọn số phòng vật lý cho ${s.roomTypeName} (Phòng ${s.slotIndex}/${s.totalSlotsForType}).`,
        });
        return;
      }
      if (!s.guestIdNumber || !s.guestIdNumber.trim()) {
        notifyToast({
          type: 'WARNING',
          message: `Vui lòng nhập số CCCD/Passport cho ${s.roomTypeName} (Phòng ${s.slotIndex}/${s.totalSlotsForType}).`,
        });
        return;
      }
    }

    setIsCheckingIn(true);
    let successCount = 0;
    try {
      for (const s of checkInSlots) {
        const payload = {
          reservationId: checkInModalData.reservationId,
          roomId: Number(s.selectedRoomId),
          guestIdNumber: s.guestIdNumber.trim(),
          keyCardNumber: s.keyCardNumber.trim() || undefined,
        };
        await frontDeskApi.checkIn(payload);
        successCount++;
      }

      notifyToast({
        type: 'SUCCESS',
        message: `Đã hoàn tất nhận ${successCount} phòng thành công cho đơn ${checkInModalData.reservationCode}!`,
      });

      setCheckInModalData(null);
      await loadData();
      setActiveTab('stays');
    } catch (err) {
      notifyToast({
        type: 'DANGER',
        message: err.response?.data?.message || `Lỗi khi nhận phòng (đã nhận được ${successCount}/${checkInSlots.length} phòng).`,
      });
      await loadData();
    } finally {
      setIsCheckingIn(false);
    }
  };

  const openExtendStayModal = (stay) => {
    let enrichedStay = { ...stay };
    if (!enrichedStay.roomTypeName || !enrichedStay.roomPrice) {
      const b = bookings.find((item) => item.reservationId === stay.reservationId);
      if (b) {
        if (!enrichedStay.roomTypeId && b.roomTypeId) enrichedStay.roomTypeId = b.roomTypeId;
        if (!enrichedStay.roomTypeName && b.roomTypeName) enrichedStay.roomTypeName = b.roomTypeName;
      }
      if (enrichedStay.roomTypeId) {
        const rt = roomTypes.find((r) => r.roomTypeId === enrichedStay.roomTypeId);
        if (rt) {
          if (!enrichedStay.roomTypeName) enrichedStay.roomTypeName = rt.typeName;
          if (!enrichedStay.roomPrice) enrichedStay.roomPrice = rt.basePrice;
        }
      }
    }
    setExtendStayModal(enrichedStay);
    const curr = stay.checkOutDate ? new Date(stay.checkOutDate) : new Date();
    const nextDay = new Date(curr.getTime() + 86400000).toISOString().split('T')[0];
    setNewCheckOutDate(nextDay);
    setExtendReason('');
  };

  const handleExecuteExtendStay = async (e) => {
    e.preventDefault();
    if (!extendStayModal || !newCheckOutDate) return;

    if (extendStayModal.checkOutDate && newCheckOutDate <= extendStayModal.checkOutDate) {
      notifyToast({
        type: 'WARNING',
        message: `Ngày trả phòng mới phải sau ngày trả hiện tại (${formatDate(extendStayModal.checkOutDate)}).`,
      });
      return;
    }

    setIsExtending(true);
    try {
      const res = await frontDeskApi.extendStay(extendStayModal.stayId, {
        newCheckOutDate,
        reason: extendReason.trim() || undefined,
      });
      const updated = res.data?.data || res.data;

      notifyToast({
        type: 'SUCCESS',
        message: `Gia hạn thành công phòng ${updated.roomNumber || extendStayModal.roomNumber} đến ngày ${formatDate(newCheckOutDate)}.`,
      });

      setExtendStayModal(null);
      await loadData();
    } catch (err) {
      notifyToast({
        type: 'DANGER',
        message: err.response?.data?.message || 'Gia hạn lưu trú không thành công.',
      });
    } finally {
      setIsExtending(false);
    }
  };

  const openCheckOutModal = (stay) => {
    setCheckOutModalStay(stay);
  };

  const handleExecuteCheckOut = async () => {
    if (!checkOutModalStay) return;
    const hasFolioAmount = Number(checkOutModalStay.folioTotalAmount || 0) > 0;
    if (hasFolioAmount) {
      notifyToast({
        type: 'DANGER',
        message: 'Số dư công nợ phải bằng 0 trước khi hoàn tất trả phòng (MSG10).',
      });
      return;
    }

    setIsCheckingOut(true);
    try {
      const res = await frontDeskApi.checkOut(checkOutModalStay.stayId);
      const completed = res.data?.data || res.data;

      notifyToast({
        type: 'SUCCESS',
        message: `Trả phòng thành công. Phòng ${completed.roomNumber || checkOutModalStay.roomNumber} đã chuyển sang trạng thái chờ dọn dẹp (DIRTY).`,
      });

      setCheckOutModalStay(null);
      await loadData();
    } catch (err) {
      notifyToast({
        type: 'DANGER',
        message: err.response?.data?.message || 'Lỗi khi hoàn tất thủ tục trả phòng.',
      });
    } finally {
      setIsCheckingOut(false);
    }
  };

  // --- Room Transfer Handlers (UC-28) ---
  const openTransferRoomModal = async (stay) => {
    let enrichedStay = { ...stay };
    if (!enrichedStay.roomTypeName || !enrichedStay.roomPrice) {
      const b = bookings.find((item) => item.reservationId === stay.reservationId);
      if (b) {
        if (!enrichedStay.roomTypeId && b.roomTypeId) enrichedStay.roomTypeId = b.roomTypeId;
        if (!enrichedStay.roomTypeName && b.roomTypeName) enrichedStay.roomTypeName = b.roomTypeName;
      }
      if (enrichedStay.roomTypeId) {
        const rt = roomTypes.find((r) => r.roomTypeId === enrichedStay.roomTypeId);
        if (rt) {
          if (!enrichedStay.roomTypeName) enrichedStay.roomTypeName = rt.typeName;
          if (!enrichedStay.roomPrice) enrichedStay.roomPrice = rt.basePrice;
        }
      }
    }
    setTransferModalStay(enrichedStay);
    setTransferTargetRoomId('');
    setTransferReason('');
    setTransferAdditionalCharge(0);
    setIsLoadingTransferRooms(true);

    try {
      const res = await frontDeskApi.getAvailableRoomsForCheckIn();
      const rooms = Array.isArray(res.data) ? res.data : res.data?.data || [];
      const filtered = rooms.filter((rm) => rm.roomNumber !== stay.roomNumber);
      setTransferAvailableRooms(filtered);
    } catch (err) {
      notifyToast({
        type: 'DANGER',
        message: 'Không thể tải danh sách phòng khả dụng cho thủ tục đổi phòng.',
      });
      setTransferAvailableRooms([]);
    } finally {
      setIsLoadingTransferRooms(false);
    }
  };

  const handleExecuteTransferRoom = async (e) => {
    e.preventDefault();
    if (!transferModalStay || !transferTargetRoomId) return;

    if (!transferReason.trim()) {
      notifyToast({
        type: 'WARNING',
        message: 'Vui lòng nhập lý do đổi phòng theo quy định nghiệp vụ (BR-28).',
      });
      return;
    }

    setIsTransferring(true);
    try {
      const res = await frontDeskApi.transferRoom(transferModalStay.stayId, {
        targetRoomId: Number(transferTargetRoomId),
        reason: transferReason.trim(),
        additionalCharge: Number(transferAdditionalCharge) || 0,
      });
      const updated = res.data?.data || res.data;

      notifyToast({
        type: 'SUCCESS',
        message: `Đổi sang phòng ${updated.roomNumber} thành công. Phòng cũ ${transferModalStay.roomNumber} đã chuyển sang chờ dọn dẹp.`,
      });

      setTransferModalStay(null);
      await loadData();
    } catch (err) {
      notifyToast({
        type: 'DANGER',
        message: err.response?.data?.message || 'Đổi phòng không thành công.',
      });
    } finally {
      setIsTransferring(false);
    }
  };

  const openStayDetailModal = (stay) => {
    let enrichedStay = { ...stay };
    const b = bookings.find((item) => item.reservationId === stay.reservationId);
    let rt = null;
    if (enrichedStay.roomTypeId) {
      rt = roomTypes.find((r) => r.roomTypeId === enrichedStay.roomTypeId);
    } else if (b && b.roomTypeId) {
      enrichedStay.roomTypeId = b.roomTypeId;
      rt = roomTypes.find((r) => r.roomTypeId === b.roomTypeId);
    }
    if (rt) {
      if (!enrichedStay.roomTypeName) enrichedStay.roomTypeName = rt.typeName;
      if (!enrichedStay.roomPrice) enrichedStay.roomPrice = rt.basePrice;
    }
    setStayDetailModal({ stay: enrichedStay, booking: b, roomType: rt });
  };

  const filteredBookings = useMemo(() => {
    if (!searchQuery.trim()) return bookings;
    const q = searchQuery.toLowerCase();
    return bookings.filter(
      (b) =>
        (b.reservationCode && b.reservationCode.toLowerCase().includes(q)) ||
        (b.contactName && b.contactName.toLowerCase().includes(q)) ||
        (b.contactPhone && b.contactPhone.includes(q))
    );
  }, [bookings, searchQuery]);

  // --- Search & Filter States ---
  const [arrivalsSearchQuery, setArrivalsSearchQuery] = useState('');
  const [staysSearchQuery, setStaysSearchQuery] = useState('');

  // --- Modal: Cancel Overdue Arrival States ---
  const [cancelArrivalModalData, setCancelArrivalModalData] = useState(null);
  const [cancelArrivalReason, setCancelArrivalReason] = useState('Khách không đến nhận phòng quá thời gian quy định (No-show)');
  const [isCancellingArrival, setIsCancellingArrival] = useState(false);

  const checkOverdueArrival = (r) => {
    if (!r) return { isOverdue: false, reason: '' };
    // Đơn đã check-in một phần (khách đã nhận ít nhất 1 phòng) thì đang lưu trú, không tính No-show/quá hạn
    if ((r.checkedInRoomsCount || 0) > 0) {
      return { isOverdue: false, reason: '' };
    }
    const now = new Date();
    if (r.holdExpiresAt && new Date(r.holdExpiresAt) < now) {
      return { isOverdue: true, reason: 'Quá thời hạn giữ chỗ' };
    }
    const todayStr = new Date().toLocaleDateString('en-CA');
    if (r.checkInDate && r.checkInDate < todayStr) {
      return { isOverdue: true, reason: `Quá ngày nhận phòng (${formatDate(r.checkInDate)})` };
    }
    if (r.checkInDate === todayStr && now.getHours() >= 18) {
      return { isOverdue: true, reason: 'Quá 18:00 ngày nhận phòng (No-show)' };
    }
    return { isOverdue: false, reason: '' };
  };

  const filteredArrivals = useMemo(() => {
    if (!arrivalsSearchQuery.trim()) return arrivals;
    const q = arrivalsSearchQuery.toLowerCase().trim();
    return arrivals.filter(
      (r) =>
        (r.reservationCode && r.reservationCode.toLowerCase().includes(q)) ||
        (r.contactName && r.contactName.toLowerCase().includes(q)) ||
        (r.contactPhone && r.contactPhone.includes(q)) ||
        (r.roomTypeName && r.roomTypeName.toLowerCase().includes(q))
    );
  }, [arrivals, arrivalsSearchQuery]);

  const filteredStays = useMemo(() => {
    if (!staysSearchQuery.trim()) return stays;
    const q = staysSearchQuery.toLowerCase().trim();
    return stays.filter(
      (s) =>
        (s.roomNumber && s.roomNumber.toLowerCase().includes(q)) ||
        (s.guestName && s.guestName.toLowerCase().includes(q)) ||
        (s.guestIdNumber && s.guestIdNumber.toLowerCase().includes(q)) ||
        (s.reservationCode && s.reservationCode.toLowerCase().includes(q)) ||
        (s.roomTypeName && s.roomTypeName.toLowerCase().includes(q)) ||
        String(s.stayId || '').includes(q)
    );
  }, [stays, staysSearchQuery]);

  // --- Pagination States ---
  const [arrivalsPage, setArrivalsPage] = useState(1);
  const [arrivalsPageSize, setArrivalsPageSize] = useState(10);

  const [pendingPage, setPendingPage] = useState(1);
  const [pendingPageSize, setPendingPageSize] = useState(10);

  const [staysPage, setStaysPage] = useState(1);
  const [staysPageSize, setStaysPageSize] = useState(10);

  const [bookingsPage, setBookingsPage] = useState(1);
  const [bookingsPageSize, setBookingsPageSize] = useState(10);

  // Paginated Data
  const paginatedArrivals = useMemo(() => {
    const start = (arrivalsPage - 1) * arrivalsPageSize;
    return filteredArrivals.slice(start, start + arrivalsPageSize);
  }, [filteredArrivals, arrivalsPage, arrivalsPageSize]);

  const paginatedPendingDeposits = useMemo(() => {
    const start = (pendingPage - 1) * pendingPageSize;
    return pendingDeposits.slice(start, start + pendingPageSize);
  }, [pendingDeposits, pendingPage, pendingPageSize]);

  const paginatedStays = useMemo(() => {
    const start = (staysPage - 1) * staysPageSize;
    return filteredStays.slice(start, start + staysPageSize);
  }, [filteredStays, staysPage, staysPageSize]);

  const paginatedBookings = useMemo(() => {
    const start = (bookingsPage - 1) * bookingsPageSize;
    return filteredBookings.slice(start, start + bookingsPageSize);
  }, [filteredBookings, bookingsPage, bookingsPageSize]);

  return (
    <div style={{ maxWidth: 1480, margin: '0 auto', padding: '20px 24px 64px', color: '#0f172a' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, letterSpacing: '-0.02em', color: '#0f172a' }}>
            Nghiệp Vụ Lễ Tân & Quản Lý Lưu Trú
          </h1>
        </div>
        <button
          onClick={loadData}
          disabled={isLoading}
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: 6,
            padding: '7px 14px',
            fontSize: 13,
            fontWeight: 500,
            color: '#334155',
            cursor: isLoading ? 'default' : 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
          }}
        >
          <i className={`bi bi-arrow-clockwise ${isLoading ? 'spin' : ''}`} style={{ fontSize: 14 }}></i>
          <span>{isLoading ? 'Đang đồng bộ...' : 'Làm mới'}</span>
        </button>
      </div>

      {/* Operational Metric Bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
        <div
          onClick={() => setActiveTab('arrivals')}
          style={{
            background: activeTab === 'arrivals' ? '#f8fafc' : '#ffffff',
            border: activeTab === 'arrivals' ? '2px solid #0f172a' : '1px solid #e2e8f0',
            borderRadius: 8,
            padding: '16px 20px',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Khách Nhận Phòng Hôm Nay
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 8 }}>
            <span style={{ fontSize: 26, fontWeight: 700, color: '#0f172a' }}>{arrivals.length}</span>
            <span style={{ fontSize: 12, color: '#2563eb', fontWeight: 500 }}>chờ check-in</span>
          </div>
        </div>

        <div
          onClick={() => setActiveTab('pending-deposits')}
          style={{
            background: activeTab === 'pending-deposits' ? '#fffbeb' : '#ffffff',
            border: activeTab === 'pending-deposits' ? '2px solid #f59e0b' : '1px solid #e2e8f0',
            borderRadius: 8,
            padding: '16px 20px',
            cursor: 'pointer',
            boxShadow: activeTab === 'pending-deposits' ? '0 4px 6px -1px rgba(245, 158, 11, 0.15)' : 'none',
            transition: 'all 0.15s ease',
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Đơn Chờ Đặt Cọc</span>
            <i className="bi bi-hourglass-split" style={{ color: '#f59e0b', fontSize: 14 }}></i>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 8 }}>
            <span style={{ fontSize: 26, fontWeight: 700, color: '#d97706' }}>{pendingDeposits.length}</span>
            <span style={{ fontSize: 12, color: '#d97706', fontWeight: 600 }}>chờ thu cọc</span>
          </div>
        </div>

        <div
          onClick={() => setActiveTab('stays')}
          style={{
            background: activeTab === 'stays' ? '#f8fafc' : '#ffffff',
            border: activeTab === 'stays' ? '2px solid #0f172a' : '1px solid #e2e8f0',
            borderRadius: 8,
            padding: '16px 20px',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Phòng Đang Lưu Trú
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 8 }}>
            <span style={{ fontSize: 26, fontWeight: 700, color: '#0f172a' }}>{stays.length}</span>
            <span style={{ fontSize: 12, color: '#16a34a', fontWeight: 500 }}>đang phục vụ</span>
          </div>
        </div>

        <div
          onClick={() => setActiveTab('all-bookings')}
          style={{
            background: activeTab === 'all-bookings' ? '#f8fafc' : '#ffffff',
            border: activeTab === 'all-bookings' ? '2px solid #0f172a' : '1px solid #e2e8f0',
            borderRadius: 8,
            padding: '16px 20px',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Tổng Đặt Phòng Hệ Thống
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 8 }}>
            <span style={{ fontSize: 26, fontWeight: 700, color: '#0f172a' }}>{bookings.length}</span>
            <span style={{ fontSize: 12, color: '#64748b', fontWeight: 400 }}>hồ sơ ghi nhận</span>
          </div>
        </div>
      </div>

      {/* Primary Tab Navigation */}
      <div style={{ borderBottom: '1px solid #e2e8f0', marginBottom: 24, display: 'flex', gap: 24 }}>
        {[
          { id: 'arrivals', label: 'Khách Nhận Phòng', count: arrivals.length, icon: 'bi-box-arrow-in-right' },
          {
            id: 'pending-deposits',
            label: 'Đơn Chờ Cọc',
            count: pendingDeposits.length,
            icon: 'bi-hourglass-split',
            isSpecial: true,
          },
          { id: 'stays', label: 'Đang Lưu Trú', count: stays.length, icon: 'bi-door-closed' },
          { id: 'direct-booking', label: 'Đặt Phòng Tại Quầy', icon: 'bi-calendar-plus' },
          { id: 'all-bookings', label: 'Tra Cứu Booking', icon: 'bi-search' },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                background: 'transparent',
                border: 'none',
                borderBottom: isActive ? '2px solid #0f172a' : '2px solid transparent',
                padding: '10px 4px 14px',
                fontSize: 14,
                fontWeight: isActive ? 600 : 500,
                color: isActive ? '#0f172a' : '#64748b',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                transition: 'color 0.15s ease',
              }}
            >
              <i
                className={`bi ${tab.icon}`}
                style={{
                  fontSize: 15,
                  color: tab.isSpecial && tab.count > 0 ? '#d97706' : isActive ? '#0f172a' : '#94a3b8',
                }}
              ></i>
              <span>{tab.label}</span>
              {typeof tab.count === 'number' && tab.count > 0 && (
                <span
                  style={{
                    background: tab.isSpecial
                      ? isActive
                        ? '#d97706'
                        : '#fef3c7'
                      : isActive
                      ? '#0f172a'
                      : '#e2e8f0',
                    color: tab.isSpecial
                      ? isActive
                        ? '#ffffff'
                        : '#b45309'
                      : isActive
                      ? '#ffffff'
                      : '#475569',
                    borderRadius: 10,
                    padding: '1px 7px',
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: ARRIVALS & CHECK-IN                                                */}
      {/* ========================================================================= */}
      {activeTab === 'arrivals' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: '#0f172a' }}>
                Danh Sách Khách Đến (Arrivals)
              </h2>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                Tổng cộng {filteredArrivals.length} đơn chờ nhận phòng
              </div>
            </div>
            <div style={{ position: 'relative', width: 320 }}>
              <i
                className="bi bi-search"
                style={{ position: 'absolute', left: 12, top: 10, fontSize: 13, color: '#94a3b8' }}
              ></i>
              <input
                type="text"
                placeholder="Tìm mã đặt, tên khách, SĐT, loại phòng..."
                value={arrivalsSearchQuery}
                onChange={(e) => {
                  setArrivalsSearchQuery(e.target.value);
                  setArrivalsPage(1);
                }}
                style={{
                  width: '100%',
                  padding: '8px 12px 8px 34px',
                  border: '1px solid #cbd5e1',
                  borderRadius: 6,
                  fontSize: 13,
                  color: '#0f172a',
                }}
              />
            </div>
          </div>

          <DataTable
            keyField="reservationId"
            data={paginatedArrivals}
            emptyMessage={arrivalsSearchQuery.trim() ? "Không tìm thấy khách đến nào phù hợp với từ khóa tìm kiếm." : "Không có khách nào đang chờ làm thủ tục nhận phòng."}
            columns={[
              {
                header: 'Mã Đặt Phòng',
                render: (r) => (
                  <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#0f172a' }}>
                    {r.reservationCode}
                  </span>
                ),
              },
              {
                header: 'Khách Hàng',
                render: (r) => (
                  <div>
                    <div style={{ fontWeight: 600, color: '#0f172a' }}>{r.contactName}</div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>{r.contactPhone}</div>
                  </div>
                ),
              },
              {
                header: 'Hạng Phòng & Số Lượng',
                render: (r) => (
                  <div>
                    <div style={{ fontWeight: 500, color: '#0f172a' }}>{r.roomTypeName || 'N/A'}</div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>
                      Tổng: {r.roomQuantity || 1} phòng • Sức chứa {r.guestCount || 1} khách
                    </div>
                  </div>
                ),
              },
              {
                header: 'Lịch Lưu Trú',
                render: (r) => {
                  const overdueInfo = checkOverdueArrival(r);
                  return (
                    <div style={{ fontSize: 13 }}>
                      <div>{formatDate(r.checkInDate)} → {formatDate(r.checkOutDate)}</div>
                      <div style={{ fontSize: 12, color: '#64748b' }}>{r.nights || 1} đêm</div>
                      {overdueInfo.isOverdue && (
                        <div style={{ marginTop: 3 }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 3,
                              fontSize: 11,
                              fontWeight: 600,
                              color: '#b91c1c',
                              background: '#fee2e2',
                              padding: '1px 6px',
                              borderRadius: 4,
                            }}
                            title={overdueInfo.reason}
                          >
                            <i className="bi bi-exclamation-triangle-fill"></i> Quá giờ nhận
                          </span>
                        </div>
                      )}
                    </div>
                  );
                },
              },
              {
                header: 'Tạm Tính',
                render: (r) => (
                  <span style={{ fontWeight: 600, color: '#0f172a' }}>
                    {formatVND(r.estimatedTotal || 0)}
                  </span>
                ),
              },
              {
                header: 'Tiền Cọc',
                render: (r) => {
                  const isPaid = r.depositPaymentStatus === 'PAID';
                  return (
                    <div>
                      <div style={{ fontWeight: 600, color: '#0f172a' }}>
                        {formatVND(r.depositAmount || 0)}
                      </div>
                      <div style={{ marginTop: 2 }}>
                        {isPaid ? (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              fontSize: 11,
                              fontWeight: 700,
                              color: '#16a34a',
                              background: '#dcfce7',
                              padding: '2px 8px',
                              borderRadius: 4,
                            }}
                          >
                            <i className="bi bi-check-circle-fill"></i> Đã cọc
                          </span>
                        ) : (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              fontSize: 11,
                              fontWeight: 700,
                              color: '#d97706',
                              background: '#fef3c7',
                              padding: '2px 8px',
                              borderRadius: 4,
                            }}
                          >
                            <i className="bi bi-clock-history"></i> Chưa cọc
                          </span>
                        )}
                      </div>
                    </div>
                  );
                },
              },
              {
                header: 'Trạng Thái',
                render: (r) => <StatusBadge status={r.status} />,
              },
              {
                header: 'Thao Tác',
                render: (r) => {
                  const totalRooms = r.totalBookedRoomsCount || r.roomQuantity || 1;
                  const checkedInCount = r.checkedInRoomsCount || 0;
                  const isPartial = checkedInCount > 0 && checkedInCount < totalRooms;
                  const isDepositPaid = r.depositPaymentStatus === 'PAID';
                  const overdueInfo = checkOverdueArrival(r);

                  // 1. Đơn check-in một phần: Tiếp tục nhận các phòng còn lại, không hiện nút hủy
                  if (isPartial) {
                    return (
                      <button
                        type="button"
                        onClick={() => openCheckInModal(r)}
                        style={{
                          background: '#0284c7',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: 6,
                          padding: '6px 14px',
                          fontSize: 13,
                          fontWeight: 500,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        <i className="bi bi-key" style={{ fontSize: 14 }}></i>
                        <span>Nhận tiếp ({checkedInCount}/{totalRooms})</span>
                      </button>
                    );
                  }

                  // 2. Đơn quá thời gian: Hiện nút HỦY ĐƠN QUÁ HẠN và ẨN NÚT CHECK-IN
                  if (overdueInfo.isOverdue) {
                    return (
                      <button
                        type="button"
                        onClick={() => {
                          setCancelArrivalModalData(r);
                          setCancelArrivalReason(`Quá thời gian nhận phòng (${overdueInfo.reason})`);
                        }}
                        title={`Đơn đã quá thời gian (${overdueInfo.reason}). Bấm để hủy đơn và giải phóng phòng.`}
                        style={{
                          background: '#fee2e2',
                          color: '#b91c1c',
                          border: '1px solid #f87171',
                          borderRadius: 6,
                          padding: '6px 12px',
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          transition: 'all 0.15s ease',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = '#fecaca';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = '#fee2e2';
                        }}
                      >
                        <i className="bi bi-x-circle-fill"></i>
                        <span>Hủy đơn quá hạn</span>
                      </button>
                    );
                  }

                  // 3. Đơn chưa quá hạn: Nếu đã cọc thì cho Check-in, nếu chưa thì Chờ cọc
                  if (isDepositPaid) {
                    return (
                      <button
                        type="button"
                        onClick={() => openCheckInModal(r)}
                        style={{
                          background: '#0f172a',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: 6,
                          padding: '6px 14px',
                          fontSize: 13,
                          fontWeight: 500,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        <i className="bi bi-key" style={{ fontSize: 14 }}></i>
                        <span>Check-in</span>
                      </button>
                    );
                  }

                  return (
                    <button
                      type="button"
                      disabled
                      title="Đơn này chưa hoàn tất thanh toán tiền cọc"
                      style={{
                        background: '#f1f5f9',
                        color: '#94a3b8',
                        border: '1px solid #cbd5e1',
                        borderRadius: 6,
                        padding: '6px 14px',
                        fontSize: 13,
                        fontWeight: 500,
                        cursor: 'not-allowed',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <i className="bi bi-lock-fill" style={{ fontSize: 13 }}></i>
                      <span>Chờ cọc</span>
                    </button>
                  );
                },
              },
            ]}
          />
          <PaginationControl
            totalItems={filteredArrivals.length}
            currentPage={arrivalsPage}
            pageSize={arrivalsPageSize}
            onPageChange={setArrivalsPage}
            onPageSizeChange={setArrivalsPageSize}
          />
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB: PENDING DEPOSITS (ĐƠN CHỜ CỌC - ONLINE & TẠI QUẦY)                   */}
      {/* ========================================================================= */}
      {activeTab === 'pending-deposits' && (
        <div>
          <div style={{ marginBottom: 16 }}>
            <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: '#0f172a' }}>
              Danh Sách Đơn Đang Chờ Đặt Cọc (Online & Tại Quầy)
            </h2>
          </div>

          <DataTable
            keyField="reservationId"
            data={paginatedPendingDeposits}
            emptyMessage="Hiện tại không có đơn nào đang chờ đặt cọc."
            columns={[
              {
                header: 'Mã Đặt Phòng',
                render: (r) => (
                  <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#0f172a' }}>
                    {r.reservationCode}
                  </span>
                ),
              },
              {
                header: 'Kênh Đặt',
                render: (r) => {
                  const isWalkin = (r.reservationCode || '').startsWith('BK-WALKIN');
                  return isWalkin ? (
                    <span
                      style={{
                        background: '#e0f2fe',
                        color: '#0369a1',
                        borderRadius: 4,
                        padding: '2px 8px',
                        fontSize: 11,
                        fontWeight: 700,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <i className="bi bi-shop"></i> Tại Quầy
                    </span>
                  ) : (
                    <span
                      style={{
                        background: '#ede9fe',
                        color: '#6d28d9',
                        borderRadius: 4,
                        padding: '2px 8px',
                        fontSize: 11,
                        fontWeight: 700,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <i className="bi bi-globe"></i> Online
                    </span>
                  );
                },
              },
              {
                header: 'Khách Hàng',
                render: (r) => (
                  <div>
                    <div style={{ fontWeight: 600, color: '#0f172a' }}>{r.contactName}</div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>{r.contactPhone}</div>
                  </div>
                ),
              },
              {
                header: 'Hạng Phòng',
                render: (r) => (
                  <div>
                    <div style={{ fontWeight: 500, color: '#0f172a' }}>{r.roomTypeName || 'N/A'}</div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>
                      {r.roomQuantity || 1} phòng • {r.guestCount || 1} khách
                    </div>
                  </div>
                ),
              },
              {
                header: 'Lịch Lưu Trú',
                render: (r) => (
                  <div style={{ fontSize: 13 }}>
                    <div>{formatDate(r.checkInDate)} → {formatDate(r.checkOutDate)}</div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>{r.nights || 1} đêm</div>
                  </div>
                ),
              },
              {
                header: 'Tiền Cọc Cần Thu',
                render: (r) => (
                  <div>
                    <strong style={{ color: '#0369a1', fontSize: 14 }}>
                      {formatVND(r.depositAmount || r.estimatedTotal || 0)}
                    </strong>
                    <div style={{ marginTop: 2 }}>
                      <span
                        style={{
                          background: '#fef3c7',
                          color: '#b45309',
                          borderRadius: 4,
                          padding: '2px 8px',
                          fontSize: 11,
                          fontWeight: 700,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        <i className="bi bi-clock-history"></i> Chờ cọc
                      </span>
                    </div>
                  </div>
                ),
              },
              {
                header: 'Mã QR Thanh Toán',
                render: (r) => {
                  const payUrl =
                    r.vnpayPaymentUrl ||
                    `http://localhost:5173/booking/payment-callback?vnp_TxnRef=${r.reservationCode}`;
                  return (
                    <div
                      onClick={() => {
                        setIsCashPaidConfirmed(false);
                        setSuccessModalData(r);
                      }}
                      title="Click để phóng to mã QR & thu cọc"
                      style={{
                        display: 'inline-flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        cursor: 'pointer',
                        padding: '4px 6px',
                        background: '#ffffff',
                        border: '1px dashed #0284c7',
                        borderRadius: 6,
                        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                        transition: 'transform 0.15s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.05)')}
                      onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1.0)')}
                    >
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=64x64&margin=2&data=${encodeURIComponent(
                          payUrl
                        )}`}
                        alt="QR Pay"
                        style={{ width: 56, height: 56, borderRadius: 4, display: 'block' }}
                      />
                      <span style={{ fontSize: 10, color: '#0284c7', fontWeight: 600, marginTop: 3 }}>
                        <i className="bi bi-zoom-in"></i> Phóng to / Cọc
                      </span>
                    </div>
                  );
                },
              },
              {
                header: 'Thao Tác',
                render: (r) => (
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <button
                      onClick={() => {
                        setIsCashPaidConfirmed(false);
                        setSuccessModalData(r);
                      }}
                      title="Mở Modal Thu tiền mặt hoặc quét mã QR VNPay cho đơn này"
                      style={{
                        background: '#005baa',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: 6,
                        padding: '6px 12px',
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <i className="bi bi-qr-code-scan"></i>
                      <span>Thu Cọc / QR</span>
                    </button>
                    <button
                      onClick={() => handleCancelPendingBooking(r.reservationCode)}
                      title="Hủy đơn này do khách không đặt cọc"
                      style={{
                        background: '#fff1f2',
                        color: '#e11d48',
                        border: '1px solid #fecdd3',
                        borderRadius: 6,
                        padding: '6px 10px',
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <i className="bi bi-trash3"></i>
                      <span>Hủy</span>
                    </button>
                  </div>
                ),
              },
            ]}
          />
          <PaginationControl
            totalItems={pendingDeposits.length}
            currentPage={pendingPage}
            pageSize={pendingPageSize}
            onPageChange={setPendingPage}
            onPageSizeChange={setPendingPageSize}
          />
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: IN-HOUSE STAYS & CHECK-OUT                                         */}
      {/* ========================================================================= */}
      {activeTab === 'stays' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: '#0f172a' }}>
                Danh Sách Phòng Đang Phục Vụ Lưu Trú
              </h2>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                Tổng cộng {filteredStays.length} phòng đang có khách
              </div>
            </div>
            <div style={{ position: 'relative', width: 320 }}>
              <i
                className="bi bi-search"
                style={{ position: 'absolute', left: 12, top: 10, fontSize: 13, color: '#94a3b8' }}
              ></i>
              <input
                type="text"
                placeholder="Tìm số phòng, tên khách, CCCD, mã lưu trú..."
                value={staysSearchQuery}
                onChange={(e) => {
                  setStaysSearchQuery(e.target.value);
                  setStaysPage(1);
                }}
                style={{
                  width: '100%',
                  padding: '8px 12px 8px 34px',
                  border: '1px solid #cbd5e1',
                  borderRadius: 6,
                  fontSize: 13,
                  color: '#0f172a',
                }}
              />
            </div>
          </div>

          <DataTable
            keyField="stayId"
            data={paginatedStays}
            emptyMessage={staysSearchQuery.trim() ? "Không tìm thấy phòng lưu trú nào phù hợp với từ khóa tìm kiếm." : "Hiện tại không có phòng nào đang có khách lưu trú."}
            columns={[
              {
                header: 'Mã Lưu Trú',
                render: (s) => <span style={{ color: '#64748b', fontSize: 13 }}>#{s.stayId}</span>,
              },
              {
                header: 'Số Phòng',
                render: (s) => (
                  <button
                    type="button"
                    onClick={() => openStayDetailModal(s)}
                    style={{
                      fontWeight: 700,
                      background: '#f8fafc',
                      color: '#0284c7',
                      border: '1px solid #bae6fd',
                      padding: '3px 9px',
                      borderRadius: 5,
                      fontSize: 13,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                    title="Nhấn để xem bảng thông tin chi tiết phòng & lưu trú"
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#e0f2fe';
                      e.currentTarget.style.borderColor = '#7dd3fc';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = '#f8fafc';
                      e.currentTarget.style.borderColor = '#bae6fd';
                    }}
                  >
                    <span>{s.roomNumber || 'N/A'}</span>
                    <i className="bi bi-info-circle" style={{ fontSize: 11, opacity: 0.85 }}></i>
                  </button>
                ),
              },
              {
                header: 'Khách Hàng',
                render: (s) => (
                  <div>
                    <div style={{ fontWeight: 600, color: '#0f172a' }}>{s.guestName}</div>
                    {s.guestIdNumber && (
                      <div style={{ fontSize: 12, color: '#64748b' }}>Giấy tờ: {s.guestIdNumber}</div>
                    )}
                  </div>
                ),
              },
              {
                header: 'Giờ Nhận Phòng',
                render: (s) => (
                  <span style={{ fontSize: 13, color: '#334155' }}>
                    {s.actualCheckIn ? formatDateTime(s.actualCheckIn) : 'N/A'}
                  </span>
                ),
              },
              {
                header: 'Dư Nợ Folio',
                render: (s) => (
                  <div>
                    <div style={{ fontWeight: 700, color: Number(s.folioTotalAmount || 0) > 0 ? '#b91c1c' : '#16a34a' }}>
                      {formatVND(s.folioTotalAmount || 0)}
                    </div>
                    {Number(s.depositPaid || 0) > 0 && (
                      <div style={{ fontSize: 11, color: '#16a34a', fontWeight: 500, marginTop: 2 }}>
                        <i className="bi bi-shield-check me-1"></i> Đã trừ cọc: {formatVND(s.depositPaid)}
                      </div>
                    )}
                    {s.folioId && <div style={{ fontSize: 11, color: '#64748b', marginTop: 1 }}>Folio #{s.folioId}</div>}
                  </div>
                ),
              },
              {
                header: 'Ngày Trả Dự Kiến',
                render: (s) => (
                  <span style={{ fontSize: 13, color: '#0f172a', fontWeight: 500 }}>
                    {s.checkOutDate ? formatDate(s.checkOutDate) : 'N/A'}
                  </span>
                ),
              },
              {
                header: 'Trạng Thái',
                render: (s) => <StatusBadge status={s.status} />,
              },
              {
                header: 'Thao Tác',
                render: (s) => (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => openTransferRoomModal(s)}
                      style={{
                        background: '#ffffff',
                        color: '#475569',
                        border: '1px solid #cbd5e1',
                        borderRadius: 6,
                        padding: '6px 12px',
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                      title="Đổi phòng"
                    >
                      <i className="bi bi-arrow-left-right"></i>
                      <span>Đổi phòng</span>
                    </button>
                    <button
                      onClick={() => openExtendStayModal(s)}
                      style={{
                        background: '#ffffff',
                        color: '#0284c7',
                        border: '1px solid #bae6fd',
                        borderRadius: 6,
                        padding: '6px 12px',
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                      title="Gia hạn lưu trú"
                    >
                      <i className="bi bi-calendar-plus"></i>
                      <span>Gia hạn</span>
                    </button>
                    <button
                      onClick={() => openCheckOutModal(s)}
                      style={{
                        background: '#ffffff',
                        color: '#b91c1c',
                        border: '1px solid #fecaca',
                        borderRadius: 6,
                        padding: '6px 12px',
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                      title="Làm thủ tục trả phòng"
                    >
                      <i className="bi bi-box-arrow-right"></i>
                      <span>Trả phòng</span>
                    </button>
                  </div>
                ),
              },
            ]}
          />
          <PaginationControl
            totalItems={filteredStays.length}
            currentPage={staysPage}
            pageSize={staysPageSize}
            onPageChange={setStaysPage}
            onPageSizeChange={setStaysPageSize}
          />
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: DIRECT BOOKING FORM (Enterprise 65% / 35% Flat Matrix)             */}
      {/* ========================================================================= */}
      {activeTab === 'direct-booking' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Header & Top Horizontal Filter Bar */}
          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '16px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: '#0f172a' }}>
                  Đặt Phòng Tại Quầy (Walk-in / Phone)
                </h2>
              </div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', background: '#f1f5f9', padding: '4px 10px', borderRadius: 4 }}>
                Mã đơn tạm: <span style={{ color: '#0f172a' }}>#TMP-{new Date().toISOString().slice(0, 10).replace(/-/g, '')}-WALKIN</span>
              </div>
            </div>

            {/* Horizontal Filter Bar */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1.2fr 1.2fr 0.8fr 1fr auto',
                gap: 14,
                alignItems: 'end',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: 6,
                padding: '12px 16px',
              }}
            >
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                  Ngày Nhận (Check-in) *
                </label>
                <input
                  type="date"
                  required
                  min={todayStr}
                  value={bookingForm.checkInDate}
                  onChange={(e) => handleCheckInDateChange(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '7px 10px',
                    border: '1px solid #cbd5e1',
                    borderRadius: 6,
                    fontSize: 13,
                    color: '#0f172a',
                    background: '#ffffff',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                  Ngày Trả (Check-out) *
                </label>
                <input
                  type="date"
                  required
                  min={getNextDayStr(bookingForm.checkInDate) || tomorrowStr}
                  value={bookingForm.checkOutDate}
                  onChange={(e) => handleCheckOutDateChange(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '7px 10px',
                    border: '1px solid #cbd5e1',
                    borderRadius: 6,
                    fontSize: 13,
                    color: '#0f172a',
                    background: '#ffffff',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                  Thời Gian Lưu Trú
                </label>
                <div
                  style={{
                    padding: '7px 10px',
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: 6,
                    fontSize: 13,
                    fontWeight: 600,
                    color: '#0f172a',
                    textAlign: 'center',
                  }}
                >
                  {stayNights} đêm
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                  Số Khách Đến *
                </label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  required
                  value={filterGuestCount}
                  onChange={(e) => setFilterGuestCount(Math.max(1, Number(e.target.value) || 1))}
                  style={{
                    width: '100%',
                    padding: '7px 10px',
                    border: '1px solid #cbd5e1',
                    borderRadius: 6,
                    fontSize: 13,
                    color: '#0f172a',
                    background: '#ffffff',
                  }}
                />
              </div>

              <div>
                <button
                  type="button"
                  onClick={handleFilterRooms}
                  disabled={isCheckingAvailability}
                  style={{
                    background: '#0f172a',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: 6,
                    padding: '8px 18px',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: isCheckingAvailability ? 'default' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    whiteSpace: 'nowrap',
                    opacity: isCheckingAvailability ? 0.7 : 1,
                  }}
                >
                  <i className="bi bi-search"></i>
                  <span>{isCheckingAvailability ? 'Đang kiểm tra...' : 'Kiểm Tra Phòng Trống'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Main 2-column Grid: 60% / 40% */}
          <div style={{ display: 'grid', gridTemplateColumns: '60fr 40fr', gap: 20, alignItems: 'start' }}>
            {/* CỘT TRÁI (65%): BẢNG MA TRẬN TÌNH TRẠNG & CHỌN PHÒNG */}
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Hạng Phòng Khả Dụng ({displayedRoomTypes.length})
                </div>
                <div style={{ fontSize: 12, color: '#64748b' }}>
                  Chỉ hiển thị các hạng phòng còn trống • Bấm <strong style={{ color: '#0f172a' }}>[+]</strong> để chọn
                </div>
              </div>

              {/* Flat Table */}
              <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: 6 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 600, fontSize: 12 }}>
                      <th style={{ padding: '10px 12px' }}>Hạng Phòng</th>
                      <th style={{ padding: '10px 12px', textAlign: 'center' }}>Sức Chứa</th>
                      <th style={{ padding: '10px 12px' }}>Đơn Giá/Đêm</th>
                      <th style={{ padding: '10px 12px', textAlign: 'center' }}>Còn Trống</th>
                      <th style={{ padding: '10px 12px', textAlign: 'center' }}>Số Lượng Chọn</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedRoomTypes.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ padding: '36px 16px', textAlign: 'center', color: '#64748b' }}>
                          <div style={{ fontSize: 24, marginBottom: 8, color: '#f59e0b' }}>
                            <i className="bi bi-door-closed"></i>
                          </div>
                          <div style={{ fontWeight: 600, color: '#0f172a', fontSize: 14, marginBottom: 4 }}>
                            Tất cả các hạng phòng đều đã hết phòng trống
                          </div>
                          <div style={{ fontSize: 12, color: '#64748b' }}>
                            Vui lòng chọn ngày nhận/trả phòng khác để kiểm tra lại kho phòng khả dụng.
                          </div>
                        </td>
                      </tr>
                    ) : (
                      displayedRoomTypes.map((rt) => {
                        const avail = rt.availableRoomsCount ?? 0;
                        const isLowStock = avail === 1;
                        const selectedQty = roomQuantities[rt.roomTypeId] || 0;

                        return (
                          <tr
                            key={rt.roomTypeId}
                            style={{
                              borderBottom: '1px solid #f1f5f9',
                              background: selectedQty > 0 ? '#f0fdf4' : '#ffffff',
                              transition: 'background-color 0.15s ease',
                            }}
                          >
                            {/* Hạng phòng */}
                            <td style={{ padding: '12px', fontWeight: 600, color: '#0f172a' }}>
                              <div>{rt.typeName}</div>
                              {rt.description && (
                                <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 400, marginTop: 2, maxWidth: 200, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {rt.description}
                                </div>
                              )}
                            </td>

                            {/* Sức chứa */}
                            <td style={{ padding: '12px', color: '#475569', textAlign: 'center', whiteSpace: 'nowrap' }}>
                              <span>{rt.capacity || 2} người</span>
                            </td>

                            {/* Đơn giá / Biểu giá theo khoảng ngày */}
                            <td style={{ padding: '12px', color: '#0f172a', verticalAlign: 'middle' }}>
                              {rt.priceRanges && rt.priceRanges.length > 0 ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                  {rt.priceRanges.map((pr, idx) => (
                                    <div
                                      key={idx}
                                      style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        fontSize: 12,
                                        padding: '3px 8px',
                                        borderRadius: 4,
                                        whiteSpace: 'nowrap',
                                        background: pr.startDayOfWeek >= 5 ? '#fef3c7' : '#f8fafc',
                                        border: pr.startDayOfWeek >= 5 ? '1px solid #fde68a' : '1px solid #e2e8f0',
                                      }}
                                    >
                                      <span style={{ color: pr.startDayOfWeek >= 5 ? '#b45309' : '#475569', fontWeight: 500, marginRight: 12 }}>
                                        {pr.dayRange}:
                                      </span>
                                      <strong style={{ color: '#0f172a', fontWeight: 600 }}>
                                        {formatDong(pr.price)}
                                      </strong>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div>
                                  <div style={{ fontWeight: 600 }}>{formatDong(rt.basePrice)}</div>
                                  <div style={{ fontSize: 11, color: '#64748b' }}>/đêm (giá tiêu chuẩn)</div>
                                </div>
                              )}
                            </td>

                            {/* Tình trạng còn */}
                            <td style={{ padding: '12px', textAlign: 'center' }}>
                              {isLowStock ? (
                                <span
                                  style={{
                                    background: '#fff7ed',
                                    color: '#c2410c',
                                    border: '1px solid #fed7aa',
                                    padding: '2px 8px',
                                    borderRadius: 4,
                                    fontSize: 11,
                                    fontWeight: 600,
                                  }}
                                >
                                  Còn 1 phòng
                                </span>
                              ) : (
                                <span
                                  style={{
                                    background: '#f1f5f9',
                                    color: '#334155',
                                    border: '1px solid #cbd5e1',
                                    padding: '2px 8px',
                                    borderRadius: 4,
                                    fontSize: 11,
                                    fontWeight: 600,
                                  }}
                                >
                                  Còn {avail} phòng
                                </span>
                              )}
                            </td>

                            {/* Bộ đếm [-] 0 [+] trực tiếp */}
                            <td style={{ padding: '12px', textAlign: 'center' }}>
                              <div
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  border: '1px solid #cbd5e1',
                                  borderRadius: 6,
                                  overflow: 'hidden',
                                  background: '#ffffff',
                                }}
                              >
                                <button
                                  type="button"
                                  disabled={selectedQty <= 0}
                                  onClick={() => handleQuantityChange(rt.roomTypeId, -1)}
                                  style={{
                                    background: selectedQty > 0 ? '#f1f5f9' : '#f8fafc',
                                    border: 'none',
                                    borderRight: '1px solid #cbd5e1',
                                    width: 28,
                                    height: 28,
                                    cursor: selectedQty > 0 ? 'pointer' : 'default',
                                    fontSize: 14,
                                    fontWeight: 700,
                                    color: selectedQty > 0 ? '#0f172a' : '#cbd5e1',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                  }}
                                >
                                  −
                                </button>
                                <span
                                  style={{
                                    width: 36,
                                    textAlign: 'center',
                                    fontSize: 13,
                                    fontWeight: 700,
                                    color: selectedQty > 0 ? '#0f172a' : '#64748b',
                                  }}
                                >
                                  {selectedQty}
                                </span>
                                <button
                                  type="button"
                                  disabled={selectedQty >= avail}
                                  onClick={() => handleQuantityChange(rt.roomTypeId, 1)}
                                  style={{
                                    background: selectedQty < avail ? '#f1f5f9' : '#f8fafc',
                                    border: 'none',
                                    borderLeft: '1px solid #cbd5e1',
                                    width: 28,
                                    height: 28,
                                    cursor: selectedQty < avail ? 'pointer' : 'default',
                                    fontSize: 14,
                                    fontWeight: 700,
                                    color: selectedQty < avail ? '#0f172a' : '#cbd5e1',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                  }}
                                >
                                  +
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* CỘT PHẢI (35% - STICKY): THÔNG TIN KHÁCH & THANH TOÁN */}
            <div style={{ position: 'sticky', top: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <form onSubmit={handleDirectBookingSubmit} style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 18 }}>
                {/* Khối Thông tin khách hàng */}
                <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <i className="bi bi-person-badge"></i>
                  <span>Thông Tin Khách Hàng</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                      Họ & Tên Khách Hàng *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Nguyễn Văn A"
                      value={bookingForm.contactName}
                      onChange={(e) => setBookingForm((prev) => ({ ...prev, contactName: e.target.value }))}
                      style={{
                        width: '100%',
                        padding: '7px 10px',
                        border: '1px solid #cbd5e1',
                        borderRadius: 6,
                        fontSize: 13,
                        color: '#0f172a',
                      }}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                        Số Điện Thoại (10 số, bắt đầu 0) *
                      </label>
                      <input
                        type="tel"
                        required
                        maxLength={10}
                        pattern="^0[0-9]{9}$"
                        placeholder="0912345678"
                        value={bookingForm.contactPhone}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                          setBookingForm((prev) => ({ ...prev, contactPhone: val }));
                        }}
                        style={{
                          width: '100%',
                          padding: '7px 10px',
                          border: `1px solid ${
                            bookingForm.contactPhone && !/^0\d{9}$/.test(bookingForm.contactPhone)
                              ? '#ef4444'
                              : '#cbd5e1'
                          }`,
                          borderRadius: 6,
                          fontSize: 13,
                          color: '#0f172a',
                        }}
                      />
                      {bookingForm.contactPhone && !/^0\d{9}$/.test(bookingForm.contactPhone) && (
                        <div style={{ fontSize: 11, color: '#ef4444', marginTop: 3 }}>
                          * Bắt buộc đúng 10 số và bắt đầu bằng số 0
                        </div>
                      )}
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                        CCCD / Passport
                      </label>
                      <input
                        type="text"
                        placeholder="00120100xxxx"
                        value={bookingForm.guestIdNumber}
                        onChange={(e) => setBookingForm((prev) => ({ ...prev, guestIdNumber: e.target.value }))}
                        style={{
                          width: '100%',
                          padding: '7px 10px',
                          border: '1px solid #cbd5e1',
                          borderRadius: 6,
                          fontSize: 13,
                          color: '#0f172a',
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                      Địa Chỉ Email
                    </label>
                    <input
                      type="email"
                      placeholder="khachhang@domain.com"
                      value={bookingForm.contactEmail}
                      onChange={(e) => setBookingForm((prev) => ({ ...prev, contactEmail: e.target.value }))}
                      style={{
                        width: '100%',
                        padding: '7px 10px',
                        border: '1px solid #cbd5e1',
                        borderRadius: 6,
                        fontSize: 13,
                        color: '#0f172a',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                      Yêu Cầu Đặc Biệt
                    </label>
                    <textarea
                      rows="2"
                      placeholder="Tầng cao, phòng yên tĩnh, check-in sớm..."
                      value={bookingForm.specialNotes}
                      onChange={(e) => setBookingForm((prev) => ({ ...prev, specialNotes: e.target.value }))}
                      style={{
                        width: '100%',
                        padding: '7px 10px',
                        border: '1px solid #cbd5e1',
                        borderRadius: 6,
                        fontSize: 13,
                        color: '#0f172a',
                        resize: 'vertical',
                      }}
                    />
                  </div>
                </div>

                {/* Khối Bảng tính tiền & Tóm tắt */}
                <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 14, marginBottom: 16 }}>
                  {/* Header Bảng Tính Tiền kèm nút icon xoay nhỏ gọn */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <i className="bi bi-receipt-cutoff" style={{ color: '#0284c7' }}></i>
                      <span>BẢNG TÍNH TIỀN & BÁO GIÁ</span>
                    </div>

                    <button
                      type="button"
                      onClick={handleCalculateQuote}
                      disabled={isCalculatingQuote || priceCalculation.items.length === 0}
                      title="Tính lại biểu giá từ máy chủ"
                      style={{
                        background: '#f8fafc',
                        border: '1px solid #cbd5e1',
                        borderRadius: 4,
                        padding: '4px 8px',
                        fontSize: 11.5,
                        fontWeight: 600,
                        color: priceCalculation.items.length === 0 ? '#94a3b8' : '#0284c7',
                        cursor: priceCalculation.items.length === 0 || isCalculatingQuote ? 'not-allowed' : 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <i className={`bi bi-arrow-clockwise ${isCalculatingQuote ? 'bi-spin' : ''}`}></i>
                      <span>{isCalculatingQuote ? 'Đang tính...' : 'Cập nhật giá'}</span>
                    </button>
                  </div>

                  {/* Danh sách phòng đã chọn */}
                  {priceCalculation.items.length === 0 ? (
                    <div style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic', marginBottom: 12, background: '#f8fafc', padding: '12px', borderRadius: 6, textAlign: 'center', border: '1px dashed #cbd5e1' }}>
                      Chưa chọn phòng nào. Vui lòng bấm [+] ở bảng bên trái.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
                      {/* Hiển thị chi tiết từng hạng phòng dạng Grid phẳng tối giản */}
                      {bookingQuote && bookingQuote.items ? (
                        bookingQuote.items.map((it) => (
                          <div
                            key={it.roomTypeId}
                            style={{
                              background: '#ffffff',
                              border: '1px solid #e2e8f0',
                              borderRadius: 6,
                              padding: '12px 14px',
                              display: 'flex',
                              flexDirection: 'column',
                            }}
                          >
                            {/* Hàng 1: Tên phòng  •  Số lượng phòng | Tổng tiền */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div style={{ fontSize: 13.5, fontWeight: 700, color: '#0f172a' }}>
                                {it.typeName}
                                <span style={{ color: '#94a3b8', margin: '0 6px', fontWeight: 400 }}>•</span>
                                <span style={{ color: '#0284c7', fontWeight: 600 }}>{it.quantity} phòng</span>
                              </div>
                              <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap' }}>
                                {formatDong(it.lineTotal)}
                              </div>
                            </div>

                            {/* Hàng 2: Thời gian lưu trú */}
                            <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 2, marginBottom: 8 }}>
                              {formatDate(bookingQuote.checkInDate)} – {formatDate(bookingQuote.checkOutDate)} ({bookingQuote.totalNights} đêm)
                            </div>

                            {/* Bảng Grid các đêm / khoảng giá (đã rút gọn ngày & dùng ₫) */}
                            {it.breakdowns && it.breakdowns.length > 0 && (
                              <div style={{ borderTop: '1px solid #f1f5f9', borderBottom: '1px solid #f1f5f9', padding: '8px 0', display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {it.breakdowns.map((b, bIdx) => {
                                  const shortPeriod = formatShortPeriod(b.periodLabel, b.shortLabel);
                                  const isWeekendDay = shortPeriod.includes('T7') || shortPeriod.includes('CN');

                                  return (
                                    <div
                                      key={bIdx}
                                      style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        fontSize: 12,
                                        gap: 12,
                                      }}
                                    >
                                      <span style={{ color: isWeekendDay ? '#b45309' : '#334155', fontWeight: isWeekendDay ? 600 : 400, whiteSpace: 'nowrap' }}>
                                        • {shortPeriod}
                                      </span>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 14, whiteSpace: 'nowrap' }}>
                                        <span style={{ color: '#64748b', fontSize: 11.5, textAlign: 'right' }}>
                                          {b.nights} đêm × {formatDong(b.unitPrice)}
                                        </span>
                                        <span style={{ textAlign: 'right', fontWeight: 600, color: '#0f172a', minWidth: 80 }}>
                                          {formatDong(b.subtotalPerRoom)}
                                        </span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            {/* Dòng tổng kết phòng */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, fontSize: 12, color: '#475569' }}>
                              <span>Tổng cộng ({it.quantity} phòng × {bookingQuote.totalNights} đêm)</span>
                              <span style={{ fontWeight: 700, color: '#0f172a', fontSize: 14, whiteSpace: 'nowrap' }}>
                                {formatDong(it.lineTotal)}
                              </span>
                            </div>
                          </div>
                        ))
                      ) : (
                        /* Khi đang chờ phản hồi từ máy chủ */
                        priceCalculation.items.map((it) => (
                          <div
                            key={it.roomTypeId}
                            style={{
                              background: '#ffffff',
                              border: '1px solid #e2e8f0',
                              borderRadius: 6,
                              padding: '12px 14px',
                              display: 'flex',
                              flexDirection: 'column',
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div style={{ fontSize: 13.5, fontWeight: 700, color: '#0f172a' }}>
                                {it.typeName}
                                <span style={{ color: '#94a3b8', margin: '0 6px', fontWeight: 400 }}>•</span>
                                <span style={{ color: '#0284c7', fontWeight: 600 }}>{it.quantity} phòng</span>
                              </div>
                              <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap' }}>
                                {formatDong(it.lineTotal)}
                              </div>
                            </div>
                            <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 4 }}>
                              Đang đối chiếu biểu giá theo ngày từ máy chủ...
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {/* Sức chứa */}
                  <div
                    style={{
                      padding: '8px 12px',
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 600,
                      marginBottom: 12,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: priceCalculation.totalCapacity >= filterGuestCount ? '#ecfdf5' : '#fffbeb',
                      border: `1px solid ${priceCalculation.totalCapacity >= filterGuestCount ? '#a7f3d0' : '#fde68a'}`,
                      color: priceCalculation.totalCapacity >= filterGuestCount ? '#047857' : '#b45309',
                    }}
                  >
                    <span>
                      {priceCalculation.totalCapacity >= filterGuestCount ? (
                        <i className="bi bi-check-circle" style={{ marginRight: 6 }}></i>
                      ) : (
                        <i className="bi bi-exclamation-triangle" style={{ marginRight: 6 }}></i>
                      )}
                      Sức chứa: <strong>{priceCalculation.totalCapacity}/{filterGuestCount} khách</strong>
                    </span>
                    <span>
                      {priceCalculation.totalCapacity >= filterGuestCount ? 'Đạt yêu cầu' : 'Chưa đủ'}
                    </span>
                  </div>

                  {/* Khối Tổng Tiền Hóa Đơn (Đã làm gọn & rõ ràng) */}
                  <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: 6, padding: '12px 14px', marginBottom: 16 }}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'baseline',
                      }}
                    >
                      <span style={{ fontSize: 13.5, fontWeight: 700, color: '#0f172a', textTransform: 'uppercase' }}>
                        TỔNG CỘNG:
                      </span>
                      <span style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', whiteSpace: 'nowrap' }}>
                        {formatDong(bookingQuote ? bookingQuote.grandTotal : priceCalculation.grandTotal)}
                      </span>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'baseline',
                        marginTop: 4,
                        paddingTop: 6,
                        borderTop: '1px dashed #cbd5e1',
                      }}
                    >
                      <span style={{ fontSize: 12.5, fontWeight: 600, color: '#0369a1' }}>
                        Tiền cọc yêu cầu (30%):
                      </span>
                      <span style={{ fontSize: 16, fontWeight: 700, color: '#0369a1', whiteSpace: 'nowrap' }}>
                        {formatDong(Math.round((bookingQuote ? bookingQuote.grandTotal : priceCalculation.grandTotal) * 0.3))}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Nút Submit */}
                <button
                  type="submit"
                  disabled={isSubmittingBooking || priceCalculation.items.length === 0}
                  style={{
                    width: '100%',
                    background: '#0f172a',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: 6,
                    padding: '10px 16px',
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: isSubmittingBooking || priceCalculation.items.length === 0 ? 'not-allowed' : 'pointer',
                    opacity: isSubmittingBooking || priceCalculation.items.length === 0 ? 0.6 : 1,
                    display: 'inline-flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <i className="bi bi-check2-circle"></i>
                  <span>{isSubmittingBooking ? 'Đang khởi tạo đơn...' : 'Xác Nhận Đặt Phòng'}</span>
                </button>
              </form>

              {/* Thông báo đơn vừa tạo thành công */}
              {lastCreatedBooking && (
                <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: 8, padding: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#166534', fontWeight: 600, fontSize: 13, marginBottom: 6 }}>
                    <i className="bi bi-check-circle-fill"></i>
                    <span>Đơn vừa tạo thành công</span>
                  </div>
                  <div style={{ fontSize: 12, color: '#334155', lineHeight: 1.5 }}>
                    <div>Mã đặt phòng: <strong style={{ color: '#0f172a' }}>{lastCreatedBooking.reservationCode}</strong></div>
                    <div>Khách hàng: <strong>{lastCreatedBooking.contactName}</strong></div>
                    <div>Hạng phòng: <span>{lastCreatedBooking.roomTypeName}</span></div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: ALL BOOKINGS SEARCH                                                */}
      {/* ========================================================================= */}
      {activeTab === 'all-bookings' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: '#0f172a' }}>
                Hồ Sơ Đặt Phòng Toàn Hệ Thống
              </h2>
            </div>
            <div style={{ position: 'relative', width: 300 }}>
              <i
                className="bi bi-search"
                style={{ position: 'absolute', left: 12, top: 10, fontSize: 13, color: '#94a3b8' }}
              ></i>
              <input
                type="text"
                placeholder="Tìm mã, họ tên, số điện thoại..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setBookingsPage(1);
                }}
                style={{
                  width: '100%',
                  padding: '8px 12px 8px 34px',
                  border: '1px solid #cbd5e1',
                  borderRadius: 6,
                  fontSize: 13,
                  color: '#0f172a',
                }}
              />
            </div>
          </div>

          <DataTable
            keyField="reservationId"
            data={paginatedBookings}
            emptyMessage="Không tìm thấy hồ sơ đặt phòng phù hợp."
            columns={[
              {
                header: 'Mã Đặt Phòng',
                render: (b) => (
                  <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#0f172a' }}>
                    {b.reservationCode}
                  </span>
                ),
              },
              {
                header: 'Khách Hàng',
                render: (b) => (
                  <div>
                    <div style={{ fontWeight: 600, color: '#0f172a' }}>{b.contactName}</div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>{b.contactPhone}</div>
                  </div>
                ),
              },
              {
                header: 'Hạng Phòng Đặt',
                render: (b) => `${b.roomTypeName || 'N/A'} (x${b.roomQuantity || 1})`,
              },
              {
                header: 'Nhận Phòng',
                render: (b) => formatDate(b.checkInDate),
              },
              {
                header: 'Trả Phòng',
                render: (b) => formatDate(b.checkOutDate),
              },
              {
                header: 'Tổng Tiền',
                render: (b) => formatVND(b.estimatedTotal || 0),
              },
              {
                header: 'Trạng Thái',
                render: (b) => <StatusBadge status={b.status} />,
              },
              {
                header: 'Thao Tác / QR',
                render: (b) => {
                  if (b.status === 'PENDING') {
                    const payUrl =
                      b.vnpayPaymentUrl ||
                      `http://localhost:5173/booking/payment-callback?vnp_TxnRef=${b.reservationCode}`;
                    return (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div
                          onClick={() => {
                            setIsCashPaidConfirmed(false);
                            setSuccessModalData(b);
                          }}
                          title="Click xem mã QR phóng to & thu cọc"
                          style={{
                            cursor: 'pointer',
                            padding: '2px 4px',
                            background: '#ffffff',
                            border: '1px dashed #0284c7',
                            borderRadius: 4,
                            display: 'inline-flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                          }}
                        >
                          <img
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=48x48&margin=1&data=${encodeURIComponent(
                              payUrl
                            )}`}
                            alt="QR"
                            style={{ width: 38, height: 38, display: 'block', borderRadius: 2 }}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setIsCashPaidConfirmed(false);
                            setSuccessModalData(b);
                          }}
                          style={{
                            background: '#005baa',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: 4,
                            padding: '6px 10px',
                            fontSize: 11,
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          <i className="bi bi-qr-code-scan"></i>
                          <span>Thu Cọc</span>
                        </button>
                      </div>
                    );
                  }
                  return <span style={{ fontSize: 12, color: '#94a3b8' }}>—</span>;
                },
              },
            ]}
          />
          <PaginationControl
            totalItems={filteredBookings.length}
            currentPage={bookingsPage}
            pageSize={bookingsPageSize}
            onPageChange={setBookingsPage}
            onPageSizeChange={setBookingsPageSize}
          />
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODALS REFACTORED INTO INDEPENDENT COMPONENTS                             */}
      {/* ========================================================================= */}
      <CheckInModal
        data={checkInModalData}
        onClose={() => setCheckInModalData(null)}
        isLoadingRooms={isLoadingRooms}
        checkInCategories={checkInCategories}
        checkInSlots={checkInSlots}
        availableRoomsByType={availableRoomsByType}
        activeCheckingInSlotId={activeCheckingInSlotId}
        handleCheckInSingleSlot={handleCheckInSingleSlot}
        handleSlotRoomChange={handleSlotRoomChange}
        updateSlotField={updateSlotField}
        handleCheckInAllSlots={handleCheckInAllSlots}
        isCheckingIn={isCheckingIn}
        checkInDepositAmount={checkInDepositAmount}
        setCheckInDepositAmount={setCheckInDepositAmount}
        checkInDepositMethod={checkInDepositMethod}
        setCheckInDepositMethod={setCheckInDepositMethod}
        checkInSavedCCCD={checkInSavedCCCD}
        setCheckInSavedCCCD={setCheckInSavedCCCD}
        checkInIncludeBreakfast={checkInIncludeBreakfast}
        setCheckInIncludeBreakfast={setCheckInIncludeBreakfast}
        checkInStaffNotes={checkInStaffNotes}
        setCheckInStaffNotes={setCheckInStaffNotes}
      />

      <ExtendStayModal
        stay={extendStayModal}
        onClose={() => setExtendStayModal(null)}
        onSubmit={handleExecuteExtendStay}
        newCheckOutDate={newCheckOutDate}
        setNewCheckOutDate={setNewCheckOutDate}
        extendReason={extendReason}
        setExtendReason={setExtendReason}
        availabilityCheck={availabilityCheck}
        isExtending={isExtending}
        getStayRoomPrice={getStayRoomPrice}
      />

      <RoomTransferModal
        stay={transferModalStay}
        onClose={() => setTransferModalStay(null)}
        onSubmit={handleExecuteTransferRoom}
        transferAvailableRooms={transferAvailableRooms}
        isLoadingTransferRooms={isLoadingTransferRooms}
        transferTargetRoomId={transferTargetRoomId}
        setTransferTargetRoomId={setTransferTargetRoomId}
        transferReason={transferReason}
        setTransferReason={setTransferReason}
        transferAdditionalCharge={transferAdditionalCharge}
        setTransferAdditionalCharge={setTransferAdditionalCharge}
        isTransferring={isTransferring}
        getStayRoomPrice={getStayRoomPrice}
      />

      <CheckOutModal
        stay={checkOutModalStay}
        onClose={() => setCheckOutModalStay(null)}
        onConfirm={handleExecuteCheckOut}
        isCheckingOut={isCheckingOut}
      />

      <StayDetailModal
        data={stayDetailModal}
        onClose={() => setStayDetailModal(null)}
        onTransferRoom={(stay) => openTransferRoomModal(stay)}
        onExtendStay={(stay) => openExtendStayModal(stay)}
        onCheckOut={(stay) => openCheckOutModal(stay)}
      />

      <CancelOverdueArrivalModal
        data={cancelArrivalModalData}
        onClose={() => setCancelArrivalModalData(null)}
        onSuccess={loadData}
        checkOverdueArrival={checkOverdueArrival}
      />

      <DirectBookingSuccessModal
        data={successModalData}
        onClose={() => setSuccessModalData(null)}
        isCashPaidConfirmed={isCashPaidConfirmed}
        onConfirmCash={handleConfirmCash}
        isProcessingCash={isProcessingCash}
        onCancelPendingBooking={handleCancelPendingBooking}
        onProceedCheckIn={() => {
          setSuccessModalData(null);
          setActiveTab('arrivals');
        }}
      />

      </div>
  );
};
