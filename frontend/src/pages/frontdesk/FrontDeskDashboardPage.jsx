import { useEffect, useState } from 'react';
import { frontDeskApi } from '../../services/frontDeskApi';
import { bookingApi } from '../../services/bookingApi';
import { DataTable } from '../../components/common/DataTable';
import { StatusBadge } from '../../components/common/StatusBadge';
import { formatDateTime, formatDate } from '../../lib/datetime';
import { formatVND } from '../../lib/money';

export const FrontDeskDashboardPage = () => {
  const [stays, setStays] = useState([]);
  const [bookings, setBookings] = useState([]);

  useEffect(() => {
    frontDeskApi.getActiveStays().then((res) => setStays(res.data.data || []));
    bookingApi.getAllBookings().then((res) => setBookings(res.data.data || []));
  }, []);

  return (
    <div>
      <h2>Quầy Lễ tân — Check-in, Lưu trú & Check-out</h2>
      <p style={{ color: '#64748b' }}>Quản lý khách nhận phòng, danh sách phòng đang lưu trú và thủ tục trả phòng.</p>

      <h3>1. Danh sách Phòng đang Lưu trú</h3>
      <DataTable
        keyField="stayId"
        data={stays}
        columns={[
          { header: 'Stay ID', render: (s) => `#${s.stayId}` },
          { header: 'Phòng', render: (s) => <strong>{s.room?.roomNumber}</strong> },
          { header: 'Khách hàng', render: (s) => s.booking?.customer?.fullName },
          { header: 'Giờ Check-in', render: (s) => formatDateTime(s.actualCheckIn) },
          { header: 'Trạng thái', render: (s) => <StatusBadge status={s.status} /> },
        ]}
      />

      <h3 style={{ marginTop: 28 }}>2. Danh sách Đặt phòng</h3>
      <DataTable
        keyField="bookingId"
        data={bookings}
        columns={[
          { header: 'Mã Booking', render: (b) => `#${b.bookingId}` },
          { header: 'Khách hàng', render: (b) => b.customer?.fullName },
          { header: 'Check-in dự kiến', render: (b) => formatDate(b.checkInDate) },
          { header: 'Check-out dự kiến', render: (b) => formatDate(b.checkOutDate) },
          { header: 'Tổng tiền dự kiến', render: (b) => formatVND(b.totalAmount) },
          { header: 'Trạng thái', render: (b) => <StatusBadge status={b.status} /> },
        ]}
      />
    </div>
  );
};
