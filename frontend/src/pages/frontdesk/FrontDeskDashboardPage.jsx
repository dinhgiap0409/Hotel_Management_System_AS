import { useEffect, useState, useMemo } from 'react';
import { frontDeskApi } from '../../services/frontDeskApi';
import { bookingApi } from '../../services/bookingApi';
import { DataTable } from '../../components/common/DataTable';
import { StatusBadge } from '../../components/common/StatusBadge';
import { formatDateTime, formatDate } from '../../lib/datetime';
import { formatVND } from '../../lib/money';
import { notifyToast } from '../../lib/http';

export const FrontDeskDashboardPage = () => {
  const [activeTab, setActiveTab] = useState('arrivals'); // 'arrivals' | 'stays' | 'direct-booking' | 'pending' | 'all-bookings'
  const [stays, setStays] = useState([]);
  const [arrivals, setArrivals] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [pendingBookings, setPendingBookings] = useState([]);
  const [roomTypes, setRoomTypes] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // --- Direct Booking Form State (UC-26) ---
  const todayStr = new Date().toISOString().split('T')[0];
  const tomorrowStr = new Date(Date.now() + 86400000).toISOString().split('T')[0];

  const [bookingForm, setBookingForm] = useState({
    checkInDate: todayStr,
    checkOutDate: tomorrowStr,
    roomTypeId: '',
    guestCount: 1,
    quantity: 1,
    contactName: '',
    contactPhone: '',
    contactEmail: '',
    guestIdNumber: '',
    specialNotes: '',
  });
  const [isSubmittingBooking, setIsSubmittingBooking] = useState(false);
  const [lastCreatedBooking, setLastCreatedBooking] = useState(null);

  // --- Check-in Modal State (UC-27) ---
  const [checkInModalData, setCheckInModalData] = useState(null); // reservation object
  const [availableRooms, setAvailableRooms] = useState([]);
  const [isLoadingRooms, setIsLoadingRooms] = useState(false);
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [checkInGuestId, setCheckInGuestId] = useState('');
  const [keyCardNumber, setKeyCardNumber] = useState('');
  const [isCheckingIn, setIsCheckingIn] = useState(false);

  // --- Check-out Modal State (UC-30) ---
  const [checkOutModalStay, setCheckOutModalStay] = useState(null); // stay object
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [voucherCode, setVoucherCode] = useState('');
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  // Load all initial data
  const loadData = async () => {
    setIsLoading(true);
    try {
      const [staysRes, arrivalsRes, allBookingsRes, pendingRes, roomTypesRes] = await Promise.all([
        frontDeskApi.getActiveStays(),
        frontDeskApi.getArrivals(),
        bookingApi.getAllBookings(),
        frontDeskApi.getPendingReservations(),
        bookingApi.getRoomTypes(),
      ]);

      setStays(Array.isArray(staysRes.data) ? staysRes.data : staysRes.data?.data || []);
      setArrivals(Array.isArray(arrivalsRes.data) ? arrivalsRes.data : arrivalsRes.data?.data || []);
      setBookings(Array.isArray(allBookingsRes.data) ? allBookingsRes.data : allBookingsRes.data?.data || []);
      setPendingBookings(Array.isArray(pendingRes.data) ? pendingRes.data : pendingRes.data?.data || []);

      const rtList = Array.isArray(roomTypesRes.data) ? roomTypesRes.data : roomTypesRes.data?.data || [];
      setRoomTypes(rtList);
      if (rtList.length > 0 && !bookingForm.roomTypeId) {
        setBookingForm((prev) => ({ ...prev, roomTypeId: rtList[0].roomTypeId }));
      }
    } catch (err) {
      notifyToast({
        type: 'danger',
        message: err.response?.data?.message || 'Lỗi khi tải dữ liệu lễ tân.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Compute selected room type and estimated price for direct booking
  const selectedRoomType = useMemo(() => {
    return roomTypes.find((rt) => String(rt.roomTypeId) === String(bookingForm.roomTypeId));
  }, [roomTypes, bookingForm.roomTypeId]);

  const stayNights = useMemo(() => {
    if (!bookingForm.checkInDate || !bookingForm.checkOutDate) return 1;
    const diff = Math.ceil(
      (new Date(bookingForm.checkOutDate) - new Date(bookingForm.checkInDate)) / (1000 * 60 * 60 * 24)
    );
    return diff > 0 ? diff : 1;
  }, [bookingForm.checkInDate, bookingForm.checkOutDate]);

  const estimatedTotal = useMemo(() => {
    if (!selectedRoomType || !selectedRoomType.basePrice) return 0;
    return Number(selectedRoomType.basePrice) * stayNights * Number(bookingForm.quantity || 1);
  }, [selectedRoomType, stayNights, bookingForm.quantity]);

  // Handle Direct Booking Submit (UC-26)
  const handleDirectBookingSubmit = async (e) => {
    e.preventDefault();
    if (!bookingForm.roomTypeId) {
      notifyToast({ type: 'warning', message: 'Vui lòng chọn hạng phòng.' });
      return;
    }
    if (!bookingForm.contactName.trim() || !bookingForm.contactPhone.trim()) {
      notifyToast({ type: 'warning', message: 'Họ tên và số điện thoại là bắt buộc.' });
      return;
    }

    setIsSubmittingBooking(true);
    try {
      const payload = {
        ...bookingForm,
        roomTypeId: Number(bookingForm.roomTypeId),
        guestCount: Number(bookingForm.guestCount),
        quantity: Number(bookingForm.quantity),
      };

      const res = await frontDeskApi.createDirectBooking(payload);
      const created = res.data?.data || res.data;
      setLastCreatedBooking(created);

      notifyToast({
        type: 'success',
        message: `Đặt phòng trực tiếp thành công! Mã: ${created.reservationCode}`,
      });

      setBookingForm((prev) => ({
        ...prev,
        contactName: '',
        contactPhone: '',
        contactEmail: '',
        guestIdNumber: '',
        specialNotes: '',
      }));

      loadData();
    } catch (err) {
      notifyToast({
        type: 'danger',
        message: err.response?.data?.message || 'Tạo đặt phòng trực tiếp thất bại.',
      });
    } finally {
      setIsSubmittingBooking(false);
    }
  };

  // Confirm Pending Reservation (UC-26)
  const handleConfirmReservation = async (reservationId) => {
    try {
      await frontDeskApi.confirmReservation(reservationId);
      notifyToast({
        type: 'success',
        message: `Đã duyệt xác nhận thành công đơn đặt phòng #${reservationId}.`,
      });
      loadData();
    } catch (err) {
      notifyToast({
        type: 'danger',
        message: err.response?.data?.message || 'Không thể xác nhận đơn đặt phòng.',
      });
    }
  };

  // Open Check-in Modal (UC-27)
  const openCheckInModal = async (reservation) => {
    setCheckInModalData(reservation);
    setCheckInGuestId(reservation.contactPhone || '');
    setKeyCardNumber('');
    setSelectedRoomId('');
    setIsLoadingRooms(true);

    try {
      const res = await frontDeskApi.getAvailableRoomsForCheckIn(reservation.roomTypeId);
      const rooms = Array.isArray(res.data) ? res.data : res.data?.data || [];
      setAvailableRooms(rooms);
      if (rooms.length > 0) {
        setSelectedRoomId(rooms[0].roomId);
        setKeyCardNumber(`CARD-${rooms[0].roomNumber}`);
      }
    } catch (err) {
      notifyToast({
        type: 'danger',
        message: err.response?.data?.message || 'Không thể tải danh sách phòng khả dụng.',
      });
    } finally {
      setIsLoadingRooms(false);
    }
  };

  const handleRoomSelectChange = (roomId) => {
    setSelectedRoomId(roomId);
    const r = availableRooms.find((room) => String(room.roomId) === String(roomId));
    if (r) {
      setKeyCardNumber(`CARD-${r.roomNumber}`);
    }
  };

  // Execute Check-in (UC-27)
  const handleExecuteCheckIn = async (e) => {
    e.preventDefault();
    if (!checkInModalData || !selectedRoomId) {
      notifyToast({ type: 'warning', message: 'Vui lòng chọn phòng vật lý để gán cho khách.' });
      return;
    }
    if (!checkInGuestId.trim()) {
      notifyToast({ type: 'warning', message: 'Vui lòng nhập số CCCD hoặc Hộ chiếu (BR-23).' });
      return;
    }

    setIsCheckingIn(true);
    try {
      const payload = {
        reservationId: checkInModalData.reservationId,
        roomId: Number(selectedRoomId),
        guestIdNumber: checkInGuestId.trim(),
        keyCardNumber: keyCardNumber.trim() || undefined,
      };

      const res = await frontDeskApi.checkIn(payload);
      const stay = res.data?.data || res.data;

      notifyToast({
        type: 'success',
        message: `Check-in thành công! Khách đã nhận phòng ${stay.roomNumber}.`,
      });

      setCheckInModalData(null);
      await loadData();
      setActiveTab('stays'); // Switch to active stays view
    } catch (err) {
      notifyToast({
        type: 'danger',
        message: err.response?.data?.message || 'Check-in không thành công.',
      });
    } finally {
      setIsCheckingIn(false);
    }
  };

  // Open Check-out Modal (UC-30)
  const openCheckOutModal = (stay) => {
    setCheckOutModalStay(stay);
    setPaymentMethod('CASH');
    setVoucherCode('');
  };

  // Execute Check-out (UC-30)
  const handleExecuteCheckOut = async () => {
    if (!checkOutModalStay) return;
    setIsCheckingOut(true);

    try {
      // Step 1: If folio has an amount, settle first via billing endpoint
      const hasFolioAmount = Number(checkOutModalStay.folioTotalAmount || 0) > 0;
      if (hasFolioAmount) {
        await frontDeskApi.settleStayFolio(checkOutModalStay.stayId, {
          voucherCode: voucherCode.trim() || undefined,
          paymentMethod: paymentMethod,
        });
      }

      // Step 2: Complete guest departure check-out
      const res = await frontDeskApi.checkOut(checkOutModalStay.stayId);
      const completed = res.data?.data || res.data;

      notifyToast({
        type: 'success',
        message: `Trả phòng thành công! Phòng ${completed.roomNumber || ''} đã chuyển sang DIRTY để buồng phòng dọn dẹp.`,
      });

      setCheckOutModalStay(null);
      await loadData();
    } catch (err) {
      notifyToast({
        type: 'danger',
        message: err.response?.data?.message || 'Lỗi khi hoàn tất thủ tục trả phòng.',
      });
    } finally {
      setIsCheckingOut(false);
    }
  };

  // Filtered all bookings
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

  return (
    <div style={{ maxWidth: 1240, margin: '0 auto', padding: '16px 20px 48px' }}>
      {/* Page Header */}
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2 style={{ fontSize: 24, fontWeight: 700, color: '#0f172a', margin: '0 0 6px' }}>
            Quầy Lễ Tân — Nghiệp Vụ Vận Hành Lưu Trú (Module 3B)
          </h2>
          <p style={{ color: '#64748b', margin: 0, fontSize: 14 }}>
            Quản lý khách đến (Arrivals), Check-in gán phòng sạch, khách đang lưu trú, Check-out trả phòng và Đặt phòng trực tiếp.
          </p>
        </div>
        <button
          onClick={loadData}
          disabled={isLoading}
          style={{
            background: '#fff',
            border: '1px solid #cbd5e1',
            borderRadius: 6,
            padding: '8px 14px',
            fontSize: 13,
            fontWeight: 500,
            color: '#334155',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <span>🔄</span> {isLoading ? 'Đang tải...' : 'Làm mới dữ liệu'}
        </button>
      </div>

      {/* Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 24 }}>
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 18 }}>
          <div style={{ fontSize: 13, color: '#64748b', fontWeight: 500 }}>Khách Đang Lưu Trú</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#2563eb', marginTop: 4 }}>
            {stays.length} <span style={{ fontSize: 13, color: '#16a34a', fontWeight: 400 }}>phòng Active (UC-28)</span>
          </div>
        </div>

        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 18 }}>
          <div style={{ fontSize: 13, color: '#64748b', fontWeight: 500 }}>Khách Dự Kiến Đến (Arrivals)</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#0f172a', marginTop: 4 }}>
            {arrivals.length} <span style={{ fontSize: 13, color: '#2563eb', fontWeight: 400 }}>chờ Check-in (UC-27)</span>
          </div>
        </div>

        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 18 }}>
          <div style={{ fontSize: 13, color: '#64748b', fontWeight: 500 }}>Đơn Chờ Lễ Tân Duyệt</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#eab308', marginTop: 4 }}>
            {pendingBookings.length} <span style={{ fontSize: 13, color: '#854d0e', fontWeight: 400 }}>Pending (UC-26)</span>
          </div>
        </div>

        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 18 }}>
          <div style={{ fontSize: 13, color: '#64748b', fontWeight: 500 }}>Tổng Hồ Sơ Đặt Phòng</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#475569', marginTop: 4 }}>
            {bookings.length} <span style={{ fontSize: 13, color: '#64748b', fontWeight: 400 }}>hồ sơ</span>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', marginBottom: 20, gap: 8, overflowX: 'auto' }}>
        <button
          onClick={() => setActiveTab('arrivals')}
          style={{
            padding: '10px 18px',
            border: 'none',
            borderBottom: activeTab === 'arrivals' ? '2px solid #2563eb' : '2px solid transparent',
            background: 'transparent',
            color: activeTab === 'arrivals' ? '#2563eb' : '#64748b',
            fontWeight: activeTab === 'arrivals' ? 600 : 500,
            cursor: 'pointer',
            fontSize: 14,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          🛎️ Khách Đến & Check-in (UC-27)
          {arrivals.length > 0 && (
            <span style={{ background: '#dbeafe', color: '#1e40af', borderRadius: 12, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>
              {arrivals.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('stays')}
          style={{
            padding: '10px 18px',
            border: 'none',
            borderBottom: activeTab === 'stays' ? '2px solid #2563eb' : '2px solid transparent',
            background: 'transparent',
            color: activeTab === 'stays' ? '#2563eb' : '#64748b',
            fontWeight: activeTab === 'stays' ? 600 : 500,
            cursor: 'pointer',
            fontSize: 14,
          }}
        >
          🔑 Phòng Đang Lưu Trú & Trả Phòng ({stays.length})
        </button>

        <button
          onClick={() => setActiveTab('direct-booking')}
          style={{
            padding: '10px 18px',
            border: 'none',
            borderBottom: activeTab === 'direct-booking' ? '2px solid #2563eb' : '2px solid transparent',
            background: 'transparent',
            color: activeTab === 'direct-booking' ? '#2563eb' : '#64748b',
            fontWeight: activeTab === 'direct-booking' ? 600 : 500,
            cursor: 'pointer',
            fontSize: 14,
          }}
        >
          🏨 Đặt Phòng Trực Tiếp (UC-26)
        </button>

        <button
          onClick={() => setActiveTab('pending')}
          style={{
            padding: '10px 18px',
            border: 'none',
            borderBottom: activeTab === 'pending' ? '2px solid #2563eb' : '2px solid transparent',
            background: 'transparent',
            color: activeTab === 'pending' ? '#2563eb' : '#64748b',
            fontWeight: activeTab === 'pending' ? 600 : 500,
            cursor: 'pointer',
            fontSize: 14,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          ⏳ Đơn Chờ Duyệt (Pending)
          {pendingBookings.length > 0 && (
            <span style={{ background: '#fef08a', color: '#854d0e', borderRadius: 12, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>
              {pendingBookings.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('all-bookings')}
          style={{
            padding: '10px 18px',
            border: 'none',
            borderBottom: activeTab === 'all-bookings' ? '2px solid #2563eb' : '2px solid transparent',
            background: 'transparent',
            color: activeTab === 'all-bookings' ? '#2563eb' : '#64748b',
            fontWeight: activeTab === 'all-bookings' ? 600 : 500,
            cursor: 'pointer',
            fontSize: 14,
          }}
        >
          📋 Toàn Bộ Đặt Phòng ({bookings.length})
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: ARRIVALS & CHECK-IN (UC-27)                                         */}
      {/* ========================================================================= */}
      {activeTab === 'arrivals' && (
        <div>
          <div style={{ marginBottom: 16 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: '#0f172a', margin: '0 0 6px' }}>
              Danh Sách Khách Đến (Arrivals) — Thủ Tục Nhận Phòng (UC-27)
            </h3>
            <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>
              Các đơn đặt phòng đã xác nhận (CONFIRMED) sẵn sàng để làm thủ tục nhận phòng, xác minh CCCD/Hộ chiếu và gán phòng sạch (VACANT + INSPECTED).
            </p>
          </div>

          <DataTable
            keyField="reservationId"
            data={arrivals}
            emptyMessage="Không có đơn đặt phòng nào đang chờ check-in."
            columns={[
              {
                header: 'Mã Booking',
                render: (r) => <strong>{r.reservationCode}</strong>,
              },
              {
                header: 'Khách hàng',
                render: (r) => (
                  <div>
                    <div style={{ fontWeight: 600 }}>{r.contactName}</div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>{r.contactPhone}</div>
                  </div>
                ),
              },
              {
                header: 'Hạng Phòng Đã Đặt',
                render: (r) => (
                  <div>
                    <span style={{ fontWeight: 600 }}>{r.roomTypeName || 'N/A'}</span>
                    <div style={{ fontSize: 12, color: '#64748b' }}>
                      {r.roomQuantity || 1} phòng • {r.guestCount || 1} khách
                    </div>
                  </div>
                ),
              },
              {
                header: 'Ngày Nhận/Trả',
                render: (r) => (
                  <div>
                    <div>{formatDate(r.checkInDate)} → {formatDate(r.checkOutDate)}</div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>({r.nights || 1} đêm)</div>
                  </div>
                ),
              },
              {
                header: 'Tạm Tính',
                render: (r) => formatVND(r.estimatedTotal || 0),
              },
              {
                header: 'Trạng Thái',
                render: (r) => <StatusBadge status={r.status} />,
              },
              {
                header: 'Thao Tác',
                render: (r) => (
                  <button
                    onClick={() => openCheckInModal(r)}
                    style={{
                      background: '#2563eb',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 4,
                      padding: '6px 14px',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <span>🔑</span> Nhận Phòng (Check-in)
                  </button>
                ),
              },
            ]}
          />
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: ACTIVE STAYS & CHECK-OUT (UC-28 / UC-30)                           */}
      {/* ========================================================================= */}
      {activeTab === 'stays' && (
        <div>
          <div style={{ marginBottom: 16 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: '#0f172a', margin: '0 0 6px' }}>
              Danh Sách Phòng Đang Lưu Trú (Active Stays) & Trả Phòng (UC-30)
            </h3>
            <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>
              Khách hiện đang lưu trú tại khách sạn. Lễ tân có thể kiểm tra hóa đơn Folio và thực hiện thủ tục Trả phòng (Check-out).
            </p>
          </div>

          <DataTable
            keyField="stayId"
            data={stays}
            emptyMessage="Hiện không có phòng nào đang lưu trú."
            columns={[
              { header: 'Stay ID', render: (s) => `#${s.stayId}` },
              { header: 'Mã Đặt Phòng', render: (s) => <strong>{s.reservationCode || 'N/A'}</strong> },
              {
                header: 'Phòng',
                render: (s) => (
                  <span
                    style={{
                      fontWeight: 700,
                      background: '#e0e7ff',
                      color: '#3730a3',
                      padding: '4px 10px',
                      borderRadius: 6,
                      fontSize: 14,
                    }}
                  >
                    {s.roomNumber || 'N/A'}
                  </span>
                ),
              },
              {
                header: 'Khách hàng',
                render: (s) => (
                  <div>
                    <div style={{ fontWeight: 600 }}>{s.guestName}</div>
                    {s.guestIdNumber && (
                      <div style={{ fontSize: 12, color: '#64748b' }}>CCCD: {s.guestIdNumber}</div>
                    )}
                  </div>
                ),
              },
              {
                header: 'Giờ Check-in',
                render: (s) => (s.actualCheckIn ? formatDateTime(s.actualCheckIn) : 'N/A'),
              },
              {
                header: 'Hóa Đơn Folio',
                render: (s) => (
                  <div>
                    <div style={{ fontWeight: 700, color: '#0f172a' }}>
                      {formatVND(s.folioTotalAmount || 0)}
                    </div>
                    {s.folioId && <div style={{ fontSize: 11, color: '#64748b' }}>Folio #{s.folioId}</div>}
                  </div>
                ),
              },
              {
                header: 'Trạng Thái',
                render: (s) => <StatusBadge status={s.status} />,
              },
              {
                header: 'Thao Tác',
                render: (s) => (
                  <button
                    onClick={() => openCheckOutModal(s)}
                    style={{
                      background: '#dc2626',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 4,
                      padding: '6px 12px',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <span>🚪</span> Trả Phòng (Check-out)
                  </button>
                ),
              },
            ]}
          />
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: DIRECT BOOKING (UC-26)                                             */}
      {/* ========================================================================= */}
      {activeTab === 'direct-booking' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.8fr) minmax(0, 1.2fr)', gap: 24 }}>
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 24 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: '#0f172a', margin: '0 0 16px' }}>
              Phiếu Đặt Phòng Trực Tiếp Tại Quầy (Walk-in / Điện thoại - UC-26)
            </h3>

            <form onSubmit={handleDirectBookingSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#334155', marginBottom: 6 }}>
                    Ngày Nhận Phòng (Check-in) *
                  </label>
                  <input
                    type="date"
                    required
                    min={todayStr}
                    value={bookingForm.checkInDate}
                    onChange={(e) => setBookingForm((prev) => ({ ...prev, checkInDate: e.target.value }))}
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 14 }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#334155', marginBottom: 6 }}>
                    Ngày Trả Phòng (Check-out) *
                  </label>
                  <input
                    type="date"
                    required
                    min={bookingForm.checkInDate || todayStr}
                    value={bookingForm.checkOutDate}
                    onChange={(e) => setBookingForm((prev) => ({ ...prev, checkOutDate: e.target.value }))}
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 14 }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#334155', marginBottom: 6 }}>
                    Hạng Phòng *
                  </label>
                  <select
                    value={bookingForm.roomTypeId}
                    onChange={(e) => setBookingForm((prev) => ({ ...prev, roomTypeId: e.target.value }))}
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 14, background: '#fff' }}
                  >
                    {roomTypes.map((rt) => (
                      <option key={rt.roomTypeId} value={rt.roomTypeId}>
                        {rt.typeName} — {formatVND(rt.basePrice)}/đêm
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#334155', marginBottom: 6 }}>
                    Số Phòng
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={bookingForm.quantity}
                    onChange={(e) => setBookingForm((prev) => ({ ...prev, quantity: e.target.value }))}
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 14 }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#334155', marginBottom: 6 }}>
                    Số Khách
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={bookingForm.guestCount}
                    onChange={(e) => setBookingForm((prev) => ({ ...prev, guestCount: e.target.value }))}
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 14 }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#334155', marginBottom: 6 }}>
                    Họ & Tên Khách Hàng *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Nguyễn Văn A"
                    value={bookingForm.contactName}
                    onChange={(e) => setBookingForm((prev) => ({ ...prev, contactName: e.target.value }))}
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 14 }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#334155', marginBottom: 6 }}>
                    Số Điện Thoại *
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="0912345678"
                    value={bookingForm.contactPhone}
                    onChange={(e) => setBookingForm((prev) => ({ ...prev, contactPhone: e.target.value }))}
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 14 }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#334155', marginBottom: 6 }}>
                    Số CCCD / Hộ Chiếu (Tùy chọn)
                  </label>
                  <input
                    type="text"
                    placeholder="00120000xxxx"
                    value={bookingForm.guestIdNumber}
                    onChange={(e) => setBookingForm((prev) => ({ ...prev, guestIdNumber: e.target.value }))}
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 14 }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#334155', marginBottom: 6 }}>
                    Email (Tùy chọn)
                  </label>
                  <input
                    type="email"
                    placeholder="khachhang@gmail.com"
                    value={bookingForm.contactEmail}
                    onChange={(e) => setBookingForm((prev) => ({ ...prev, contactEmail: e.target.value }))}
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 14 }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#334155', marginBottom: 6 }}>
                  Ghi Chú Yêu Cầu Đặc Biệt
                </label>
                <textarea
                  rows="2"
                  placeholder="Yêu cầu phòng tầng cao, check-in sớm..."
                  value={bookingForm.specialNotes}
                  onChange={(e) => setBookingForm((prev) => ({ ...prev, specialNotes: e.target.value }))}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 14, resize: 'vertical' }}
                />
              </div>

              <button
                type="submit"
                disabled={isSubmittingBooking}
                style={{
                  width: '100%',
                  background: '#2563eb',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  padding: '12px 20px',
                  fontSize: 15,
                  fontWeight: 600,
                  cursor: isSubmittingBooking ? 'not-allowed' : 'pointer',
                  opacity: isSubmittingBooking ? 0.7 : 1,
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <span>✅</span>
                {isSubmittingBooking ? 'Đang Xử Lý Đặt Phòng...' : 'Xác Nhận Tạo Đặt Phòng Trực Tiếp'}
              </button>
            </form>
          </div>

          <div>
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 20, marginBottom: 20 }}>
              <h4 style={{ fontSize: 15, fontWeight: 600, color: '#0f172a', margin: '0 0 14px' }}>
                Chi Tiết Tạm Tính
              </h4>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 8, color: '#475569' }}>
                <span>Hạng phòng:</span>
                <strong style={{ color: '#0f172a' }}>{selectedRoomType?.typeName || 'Chưa chọn'}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 8, color: '#475569' }}>
                <span>Thời gian:</span>
                <span style={{ color: '#0f172a' }}>{formatDate(bookingForm.checkInDate)} → {formatDate(bookingForm.checkOutDate)} ({stayNights} đêm)</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 8, color: '#475569' }}>
                <span>Số lượng:</span>
                <span style={{ color: '#0f172a' }}>{bookingForm.quantity} phòng, {bookingForm.guestCount} khách</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 8, color: '#475569' }}>
                <span>Đơn giá cơ sở:</span>
                <span style={{ color: '#0f172a' }}>{formatVND(selectedRoomType?.basePrice || 0)}/đêm</span>
              </div>
              <div style={{ borderTop: '1px dashed #cbd5e1', marginTop: 14, paddingTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: '#0f172a' }}>Tổng Tiền Ước Tính:</span>
                <span style={{ fontSize: 20, fontWeight: 700, color: '#2563eb' }}>{formatVND(estimatedTotal)}</span>
              </div>
            </div>

            {lastCreatedBooking && (
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: 18 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#166534', fontWeight: 600, marginBottom: 8 }}>
                  <span>🎉</span> Đặt phòng thành công!
                </div>
                <div style={{ fontSize: 13, color: '#15803d', lineHeight: 1.6 }}>
                  <div>Mã đặt phòng: <strong>{lastCreatedBooking.reservationCode}</strong></div>
                  <div>Khách hàng: <strong>{lastCreatedBooking.contactName}</strong></div>
                  <div>Trạng thái: <strong>{lastCreatedBooking.status}</strong></div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: PENDING RESERVATIONS (UC-26)                                       */}
      {/* ========================================================================= */}
      {activeTab === 'pending' && (
        <div>
          <div style={{ marginBottom: 16 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: '#0f172a', margin: '0 0 6px' }}>
              Danh Sách Đơn Đặt Phòng Chờ Lễ Tân Duyệt (Pending)
            </h3>
            <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>
              Các đơn đặt qua cổng trực tuyến hoặc yêu cầu giữ phòng cần kiểm tra và bấm "Duyệt" để chuyển thành CONFIRMED.
            </p>
          </div>

          <DataTable
            keyField="reservationId"
            data={pendingBookings}
            emptyMessage="Hiện không có đơn đặt phòng nào đang chờ duyệt."
            columns={[
              { header: 'Mã Booking', render: (r) => <strong>{r.reservationCode}</strong> },
              {
                header: 'Khách hàng',
                render: (r) => (
                  <div>
                    <div style={{ fontWeight: 600 }}>{r.contactName}</div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>{r.contactPhone}</div>
                  </div>
                ),
              },
              { header: 'Hạng Phòng', render: (r) => `${r.roomTypeName || 'N/A'} (x${r.roomQuantity || 1})` },
              { header: 'Lưu Trú', render: (r) => `${formatDate(r.checkInDate)} → ${formatDate(r.checkOutDate)}` },
              { header: 'Tạm Tính', render: (r) => formatVND(r.estimatedTotal) },
              { header: 'Trạng Thái', render: (r) => <StatusBadge status={r.status} /> },
              {
                header: 'Thao Tác',
                render: (r) => (
                  <button
                    onClick={() => handleConfirmReservation(r.reservationId)}
                    style={{ background: '#16a34a', color: '#fff', border: 'none', borderRadius: 4, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                  >
                    Duyệt (Confirm)
                  </button>
                ),
              },
            ]}
          />
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: ALL BOOKINGS                                                       */}
      {/* ========================================================================= */}
      {activeTab === 'all-bookings' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: '#0f172a', margin: '0 0 6px' }}>
                Toàn Bộ Lịch Sử Đặt Phòng
              </h3>
              <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>
                Tra cứu nhanh tất cả đơn đặt phòng theo mã đặt phòng, tên hoặc số điện thoại.
              </p>
            </div>
            <input
              type="text"
              placeholder="🔍 Tìm mã booking, tên khách, SĐT..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: 280, padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 13 }}
            />
          </div>

          <DataTable
            keyField="reservationId"
            data={filteredBookings}
            emptyMessage="Không tìm thấy đặt phòng phù hợp."
            columns={[
              { header: 'Mã Booking', render: (b) => <strong>{b.reservationCode}</strong> },
              {
                header: 'Khách hàng',
                render: (b) => (
                  <div>
                    <div style={{ fontWeight: 600 }}>{b.contactName}</div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>{b.contactPhone}</div>
                  </div>
                ),
              },
              { header: 'Hạng Phòng', render: (b) => `${b.roomTypeName || 'N/A'} (x${b.roomQuantity || 1})` },
              { header: 'Check-in', render: (b) => formatDate(b.checkInDate) },
              { header: 'Check-out', render: (b) => formatDate(b.checkOutDate) },
              { header: 'Tổng Tiền', render: (b) => formatVND(b.estimatedTotal || 0) },
              { header: 'Trạng Thái', render: (b) => <StatusBadge status={b.status} /> },
            ]}
          />
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: CHECK-IN FORM (UC-27)                                            */}
      {/* ========================================================================= */}
      {checkInModalData && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.6)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 9999,
            padding: 16,
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 10,
              maxWidth: 580,
              width: '100%',
              padding: 24,
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', margin: 0 }}>
                🔑 Thủ Tục Nhận Phòng (Check-in)
              </h3>
              <button
                onClick={() => setCheckInModalData(null)}
                style={{ background: 'transparent', border: 'none', fontSize: 20, cursor: 'pointer', color: '#64748b' }}
              >
                ✕
              </button>
            </div>

            {/* Booking Details Box */}
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 14, marginBottom: 18, fontSize: 13 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div>Mã Booking: <strong>{checkInModalData.reservationCode}</strong></div>
                <div>Khách hàng: <strong>{checkInModalData.contactName}</strong></div>
                <div>Hạng phòng: <strong style={{ color: '#2563eb' }}>{checkInModalData.roomTypeName}</strong></div>
                <div>SĐT: <strong>{checkInModalData.contactPhone}</strong></div>
                <div>Lưu trú: {formatDate(checkInModalData.checkInDate)} → {formatDate(checkInModalData.checkOutDate)}</div>
                <div>Số lượng: {checkInModalData.roomQuantity || 1} phòng, {checkInModalData.guestCount || 1} khách</div>
              </div>
            </div>

            <form onSubmit={handleExecuteCheckIn}>
              {/* Select Physical Room */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                  Gán Phòng Vật Lý (Chỉ hiển thị phòng Trống & Sạch đã kiểm tra - BR-14) *
                </label>
                {isLoadingRooms ? (
                  <div style={{ fontSize: 13, color: '#64748b' }}>Đang tìm phòng trống...</div>
                ) : availableRooms.length === 0 ? (
                  <div style={{ background: '#fee2e2', color: '#991b1b', padding: '10px 14px', borderRadius: 6, fontSize: 13 }}>
                    ⚠️ Hiện không có phòng nào ở trạng thái Trống và Sạch (INSPECTED/CLEAN) cho hạng phòng '{checkInModalData.roomTypeName}'. Vui lòng liên hệ Buồng phòng dọn dẹp.
                  </div>
                ) : (
                  <select
                    value={selectedRoomId}
                    onChange={(e) => handleRoomSelectChange(e.target.value)}
                    required
                    style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 14, background: '#fff' }}
                  >
                    {availableRooms.map((r) => (
                      <option key={r.roomId} value={r.roomId}>
                        Phòng {r.roomNumber} (Tầng {r.floor} • Trạng thái: {r.cleaningStatus})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Guest National ID */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                  Số CCCD / Hộ Chiếu Của Khách (Bắt buộc theo BR-23) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Nhập 12 số CCCD hoặc mã hộ chiếu"
                  value={checkInGuestId}
                  onChange={(e) => setCheckInGuestId(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 14 }}
                />
              </div>

              {/* Keycard Number */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                  Mã Thẻ Từ Cấp Cho Khách (Keycard Number)
                </label>
                <input
                  type="text"
                  placeholder="Ví dụ: CARD-101"
                  value={keyCardNumber}
                  onChange={(e) => setKeyCardNumber(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 14 }}
                />
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setCheckInModalData(null)}
                  style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: 6, padding: '10px 18px', fontSize: 14, color: '#475569', cursor: 'pointer' }}
                >
                  Hủy Bỏ
                </button>
                <button
                  type="submit"
                  disabled={isCheckingIn || availableRooms.length === 0}
                  style={{
                    background: '#2563eb',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 6,
                    padding: '10px 20px',
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: (isCheckingIn || availableRooms.length === 0) ? 'not-allowed' : 'pointer',
                    opacity: (isCheckingIn || availableRooms.length === 0) ? 0.6 : 1,
                  }}
                >
                  {isCheckingIn ? 'Đang Xử Lý Check-in...' : 'Hoàn Tất Nhận Phòng (Check-in)'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: CHECK-OUT & FOLIO SETTLEMENT (UC-30)                             */}
      {/* ========================================================================= */}
      {checkOutModalStay && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.6)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 9999,
            padding: 16,
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 10,
              maxWidth: 540,
              width: '100%',
              padding: 24,
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', margin: 0 }}>
                🚪 Thủ Tục Trả Phòng (Check-out) — Phòng {checkOutModalStay.roomNumber}
              </h3>
              <button
                onClick={() => setCheckOutModalStay(null)}
                style={{ background: 'transparent', border: 'none', fontSize: 20, cursor: 'pointer', color: '#64748b' }}
              >
                ✕
              </button>
            </div>

            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 14, marginBottom: 18, fontSize: 13 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div>Mã Booking: <strong>{checkOutModalStay.reservationCode}</strong></div>
                <div>Khách hàng: <strong>{checkOutModalStay.guestName}</strong></div>
                <div>Giờ nhận phòng: {formatDateTime(checkOutModalStay.actualCheckIn)}</div>
                <div>Hóa đơn Folio: <strong>Folio #{checkOutModalStay.folioId || 'N/A'}</strong></div>
              </div>

              <div style={{ borderTop: '1px dashed #cbd5e1', marginTop: 12, paddingTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: '#0f172a' }}>Tổng Công Nợ Folio:</span>
                <span style={{ fontSize: 18, fontWeight: 700, color: '#dc2626' }}>
                  {formatVND(checkOutModalStay.folioTotalAmount || 0)}
                </span>
              </div>
            </div>

            {/* If folio has amount, prompt payment method */}
            {Number(checkOutModalStay.folioTotalAmount || 0) > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 8 }}>
                  Quyết Toán Công Nợ (BR-26: Phải bằng 0 trước khi trả phòng)
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, color: '#64748b', marginBottom: 4 }}>
                      Hình Thức Thanh Toán
                    </label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      style={{ width: '100%', padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 13, background: '#fff' }}
                    >
                      <option value="CASH">Tiền Mặt (Cash)</option>
                      <option value="CARD">Thẻ Tín Dụng / POS (Card)</option>
                      <option value="TRANSFER">Chuyển Khoản Ngân Hàng</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 12, color: '#64748b', marginBottom: 4 }}>
                      Mã Voucher Khuyến Mãi (Nếu có)
                    </label>
                    <input
                      type="text"
                      placeholder="Mã giảm giá"
                      value={voucherCode}
                      onChange={(e) => setVoucherCode(e.target.value.toUpperCase())}
                      style={{ width: '100%', padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 13 }}
                    />
                  </div>
                </div>
              </div>
            )}

            <div style={{ fontSize: 13, color: '#64748b', background: '#fef3c7', padding: '10px 14px', borderRadius: 6, marginBottom: 20 }}>
              💡 Khi bấm xác nhận, phòng <strong>{checkOutModalStay.roomNumber}</strong> sẽ tự động chuyển sang trạng thái <strong>DIRTY</strong> để báo bộ phận Buồng phòng tiến hành dọn dẹp vệ sinh.
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                onClick={() => setCheckOutModalStay(null)}
                style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: 6, padding: '10px 18px', fontSize: 14, color: '#475569', cursor: 'pointer' }}
              >
                Hủy Bỏ
              </button>
              <button
                type="button"
                onClick={handleExecuteCheckOut}
                disabled={isCheckingOut}
                style={{
                  background: '#dc2626',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  padding: '10px 20px',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: isCheckingOut ? 'not-allowed' : 'pointer',
                  opacity: isCheckingOut ? 0.7 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <span>🚪</span>
                {isCheckingOut ? 'Đang Xử Lý Trả Phòng...' : 'Xác Nhận Quyết Toán & Trả Phòng'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
