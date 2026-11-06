import { useEffect, useState, useMemo } from 'react';
import { frontDeskApi } from '../../services/frontDeskApi';
import { bookingApi } from '../../services/bookingApi';
import { DataTable } from '../../components/common/DataTable';
import { StatusBadge } from '../../components/common/StatusBadge';
import { formatDateTime, formatDate } from '../../lib/datetime';
import { formatVND } from '../../lib/money';
import { notifyToast } from '../../lib/http';

export const FrontDeskDashboardPage = () => {
  const [activeTab, setActiveTab] = useState('direct-booking'); // 'direct-booking' | 'pending' | 'stays' | 'all-bookings'
  const [stays, setStays] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [pendingBookings, setPendingBookings] = useState([]);
  const [roomTypes, setRoomTypes] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Direct Booking Form State
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastCreatedBooking, setLastCreatedBooking] = useState(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [staysRes, allBookingsRes, pendingRes, roomTypesRes] = await Promise.all([
        frontDeskApi.getActiveStays(),
        bookingApi.getAllBookings(),
        frontDeskApi.getPendingReservations(),
        bookingApi.getRoomTypes(),
      ]);

      setStays(Array.isArray(staysRes.data) ? staysRes.data : staysRes.data?.data || []);
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

  // Compute selected room type and estimated price
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

  const handleInputChange = (field, value) => {
    setBookingForm((prev) => ({ ...prev, [field]: value }));
  };

  // Submit Direct Booking (UC-26)
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

    setIsSubmitting(true);
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

      // Reset form contact fields
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
      setIsSubmitting(false);
    }
  };

  // Confirm a Pending reservation (UC-26)
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
            Quầy Lễ Tân — Nghiệp Vụ Lưu Trú & Đặt Phòng (Module 3B)
          </h2>
          <p style={{ color: '#64748b', margin: 0, fontSize: 14 }}>
            Quản lý đặt phòng trực tiếp (Walk-in), duyệt đơn chờ, khách đang lưu trú và thủ tục nhận/trả phòng.
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
          <span>🔄</span> {isLoading ? 'Đang tải...' : 'Làm mới'}
        </button>
      </div>

      {/* Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 24 }}>
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 18 }}>
          <div style={{ fontSize: 13, color: '#64748b', fontWeight: 500 }}>Khách Đang Lưu Trú</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#0f172a', marginTop: 4 }}>
            {stays.length} <span style={{ fontSize: 13, color: '#16a34a', fontWeight: 400 }}>phòng Active</span>
          </div>
        </div>

        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 18 }}>
          <div style={{ fontSize: 13, color: '#64748b', fontWeight: 500 }}>Đơn Chờ Lễ Tân Duyệt</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#eab308', marginTop: 4 }}>
            {pendingBookings.length} <span style={{ fontSize: 13, color: '#854d0e', fontWeight: 400 }}>Pending (UC-26)</span>
          </div>
        </div>

        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 18 }}>
          <div style={{ fontSize: 13, color: '#64748b', fontWeight: 500 }}>Tổng Số Đặt Phòng</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#0f172a', marginTop: 4 }}>
            {bookings.length} <span style={{ fontSize: 13, color: '#64748b', fontWeight: 400 }}>hồ sơ</span>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', marginBottom: 20, gap: 8 }}>
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
          🏨 Đặt Phòng Trực Tiếp (Direct Booking - UC-26)
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
            <span
              style={{
                background: '#fef08a',
                color: '#854d0e',
                borderRadius: 12,
                padding: '2px 8px',
                fontSize: 11,
                fontWeight: 700,
              }}
            >
              {pendingBookings.length}
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
          🔑 Phòng Đang Lưu Trú ({stays.length})
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

      {/* TAB 1: DIRECT BOOKING FORM (UC-26) */}
      {activeTab === 'direct-booking' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.8fr) minmax(0, 1.2fr)', gap: 24 }}>
          {/* Form Area */}
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 24 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: '#0f172a', margin: '0 0 16px' }}>
              Phiếu Đặt Phòng Trực Tiếp Tại Quầy (Walk-in / Điện thoại)
            </h3>

            <form onSubmit={handleDirectBookingSubmit}>
              {/* Date selection */}
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
                    onChange={(e) => handleInputChange('checkInDate', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid #cbd5e1',
                      borderRadius: 6,
                      fontSize: 14,
                    }}
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
                    onChange={(e) => handleInputChange('checkOutDate', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid #cbd5e1',
                      borderRadius: 6,
                      fontSize: 14,
                    }}
                  />
                </div>
              </div>

              {/* Room type & quantity */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#334155', marginBottom: 6 }}>
                    Hạng Phòng *
                  </label>
                  <select
                    value={bookingForm.roomTypeId}
                    onChange={(e) => handleInputChange('roomTypeId', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid #cbd5e1',
                      borderRadius: 6,
                      fontSize: 14,
                      background: '#fff',
                    }}
                  >
                    {roomTypes.map((rt) => (
                      <option key={rt.roomTypeId} value={rt.roomTypeId}>
                        {rt.typeName} — {formatVND(rt.basePrice)}/đêm (Sức chứa: {rt.capacity || 2} người)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#334155', marginBottom: 6 }}>
                    Số Lượng Phòng
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={bookingForm.quantity}
                    onChange={(e) => handleInputChange('quantity', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid #cbd5e1',
                      borderRadius: 6,
                      fontSize: 14,
                    }}
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
                    onChange={(e) => handleInputChange('guestCount', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid #cbd5e1',
                      borderRadius: 6,
                      fontSize: 14,
                    }}
                  />
                </div>
              </div>

              {/* Customer info */}
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
                    onChange={(e) => handleInputChange('contactName', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid #cbd5e1',
                      borderRadius: 6,
                      fontSize: 14,
                    }}
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
                    onChange={(e) => handleInputChange('contactPhone', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid #cbd5e1',
                      borderRadius: 6,
                      fontSize: 14,
                    }}
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
                    onChange={(e) => handleInputChange('guestIdNumber', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid #cbd5e1',
                      borderRadius: 6,
                      fontSize: 14,
                    }}
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
                    onChange={(e) => handleInputChange('contactEmail', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid #cbd5e1',
                      borderRadius: 6,
                      fontSize: 14,
                    }}
                  />
                </div>
              </div>

              {/* Notes */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#334155', marginBottom: 6 }}>
                  Ghi Chú Yêu Cầu Đặc Biệt
                </label>
                <textarea
                  rows="2"
                  placeholder="Yêu cầu phòng tầng cao, không hút thuốc, check-in sớm..."
                  value={bookingForm.specialNotes}
                  onChange={(e) => handleInputChange('specialNotes', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #cbd5e1',
                    borderRadius: 6,
                    fontSize: 14,
                    resize: 'vertical',
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                style={{
                  width: '100%',
                  background: '#2563eb',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  padding: '12px 20px',
                  fontSize: 15,
                  fontWeight: 600,
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  opacity: isSubmitting ? 0.7 : 1,
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <span>✅</span>
                {isSubmitting ? 'Đang Xử Lý Đặt Phòng...' : 'Xác Nhận Tạo Đặt Phòng Trực Tiếp'}
              </button>
            </form>
          </div>

          {/* Booking Summary Panel */}
          <div>
            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: 8,
                padding: 20,
                marginBottom: 20,
              }}
            >
              <h4 style={{ fontSize: 15, fontWeight: 600, color: '#0f172a', margin: '0 0 14px' }}>
                Chi Tiết Tạm Tính
              </h4>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 8, color: '#475569' }}>
                <span>Hạng phòng:</span>
                <strong style={{ color: '#0f172a' }}>{selectedRoomType?.typeName || 'Chưa chọn'}</strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 8, color: '#475569' }}>
                <span>Thời gian lưu trú:</span>
                <span style={{ color: '#0f172a' }}>
                  {formatDate(bookingForm.checkInDate)} → {formatDate(bookingForm.checkOutDate)} ({stayNights} đêm)
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 8, color: '#475569' }}>
                <span>Số lượng đặt:</span>
                <span style={{ color: '#0f172a' }}>
                  {bookingForm.quantity} phòng, {bookingForm.guestCount} khách
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 8, color: '#475569' }}>
                <span>Đơn giá cơ sở:</span>
                <span style={{ color: '#0f172a' }}>{formatVND(selectedRoomType?.basePrice || 0)}/đêm</span>
              </div>

              <div
                style={{
                  borderTop: '1px dashed #cbd5e1',
                  marginTop: 14,
                  paddingTop: 14,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span style={{ fontSize: 14, fontWeight: 600, color: '#0f172a' }}>Tổng Tiền Ước Tính:</span>
                <span style={{ fontSize: 20, fontWeight: 700, color: '#2563eb' }}>
                  {formatVND(estimatedTotal)}
                </span>
              </div>
            </div>

            {/* Recently Created Booking Feedback */}
            {lastCreatedBooking && (
              <div
                style={{
                  background: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  borderRadius: 8,
                  padding: 18,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#166534', fontWeight: 600, marginBottom: 8 }}>
                  <span>🎉</span> Đặt phòng vừa tạo thành công!
                </div>
                <div style={{ fontSize: 13, color: '#15803d', lineHeight: 1.6 }}>
                  <div>Mã đặt phòng: <strong>{lastCreatedBooking.reservationCode}</strong></div>
                  <div>Khách hàng: <strong>{lastCreatedBooking.contactName}</strong></div>
                  <div>Trạng thái: <strong>{lastCreatedBooking.status}</strong></div>
                  <div>Nhận phòng: {formatDate(lastCreatedBooking.checkInDate)}</div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: PENDING RESERVATIONS (UC-26) */}
      {activeTab === 'pending' && (
        <div>
          <div style={{ marginBottom: 16 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: '#0f172a', margin: '0 0 6px' }}>
              Danh Sách Đơn Đặt Phòng Chờ Lễ Tân Duyệt (Pending)
            </h3>
            <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>
              Các đơn đặt qua cổng trực tuyến hoặc yêu cầu giữ phòng cần kiểm tra và bấm "Xác Nhận" để chuyển thành CONFIRMED.
            </p>
          </div>

          <DataTable
            keyField="reservationId"
            data={pendingBookings}
            emptyMessage="Hiện không có đơn đặt phòng nào đang chờ duyệt."
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
                header: 'Hạng Phòng',
                render: (r) => `${r.roomTypeName || 'N/A'} (x${r.roomQuantity || 1})`,
              },
              {
                header: 'Lưu Trú',
                render: (r) => `${formatDate(r.checkInDate)} → ${formatDate(r.checkOutDate)}`,
              },
              {
                header: 'Tạm Tính',
                render: (r) => formatVND(r.estimatedTotal),
              },
              {
                header: 'Trạng Thái',
                render: (r) => <StatusBadge status={r.status} />,
              },
              {
                header: 'Thao Tác',
                render: (r) => (
                  <button
                    onClick={() => handleConfirmReservation(r.reservationId)}
                    style={{
                      background: '#16a34a',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 4,
                      padding: '6px 12px',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Duyệt (Confirm)
                  </button>
                ),
              },
            ]}
          />
        </div>
      )}

      {/* TAB 3: ACTIVE STAYS (UC-28) */}
      {activeTab === 'stays' && (
        <div>
          <div style={{ marginBottom: 16 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: '#0f172a', margin: '0 0 6px' }}>
              Danh Sách Phòng Đang Lưu Trú (Active Stays)
            </h3>
            <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>
              Các phòng khách đã làm thủ tục nhận phòng (Check-in) và đang có mặt tại khách sạn.
            </p>
          </div>

          <DataTable
            keyField="stayId"
            data={stays}
            emptyMessage="Hiện không có khách nào đang lưu trú."
            columns={[
              { header: 'Stay ID', render: (s) => `#${s.stayId}` },
              { header: 'Mã Đặt Phòng', render: (s) => s.reservationCode || 'N/A' },
              {
                header: 'Phòng',
                render: (s) => (
                  <span
                    style={{
                      fontWeight: 700,
                      background: '#e0e7ff',
                      color: '#3730a3',
                      padding: '3px 8px',
                      borderRadius: 4,
                      fontSize: 13,
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
                header: 'Thời Gian Check-in',
                render: (s) => (s.actualCheckIn ? formatDateTime(s.actualCheckIn) : 'N/A'),
              },
              {
                header: 'Hóa Đơn Folio',
                render: (s) => (
                  <div>
                    <div style={{ fontWeight: 600, color: '#0f172a' }}>
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
            ]}
          />
        </div>
      )}

      {/* TAB 4: ALL BOOKINGS */}
      {activeTab === 'all-bookings' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: '#0f172a', margin: '0 0 6px' }}>
                Toàn Bộ Lịch Sử Đặt Phòng
              </h3>
              <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>
                Tra cứu nhanh tất cả đơn đặt phòng theo mã đặt phòng, tên hoặc số điện thoại khách hàng.
              </p>
            </div>
            <input
              type="text"
              placeholder="🔍 Tìm mã booking, tên khách, SĐT..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: 280,
                padding: '8px 12px',
                border: '1px solid #cbd5e1',
                borderRadius: 6,
                fontSize: 13,
              }}
            />
          </div>

          <DataTable
            keyField="reservationId"
            data={filteredBookings}
            emptyMessage="Không tìm thấy đặt phòng phù hợp."
            columns={[
              {
                header: 'Mã Booking',
                render: (b) => <strong>{b.reservationCode}</strong>,
              },
              {
                header: 'Khách hàng',
                render: (b) => (
                  <div>
                    <div style={{ fontWeight: 600 }}>{b.contactName}</div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>{b.contactPhone}</div>
                  </div>
                ),
              },
              {
                header: 'Hạng Phòng',
                render: (b) => `${b.roomTypeName || 'N/A'} (x${b.roomQuantity || 1})`,
              },
              {
                header: 'Check-in',
                render: (b) => formatDate(b.checkInDate),
              },
              {
                header: 'Check-out',
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
            ]}
          />
        </div>
      )}
    </div>
  );
};
