import { useEffect, useState } from 'react';
import { bookingApi } from '../../services/bookingApi';
import { DataTable } from '../../components/common/DataTable';
import { StatusBadge } from '../../components/common/StatusBadge';
import { formatVND } from '../../lib/money';
import { formatDate } from '../../lib/datetime';

export const MyBookingsPage = () => {
  const [bookings, setBookings] = useState([]);

  useEffect(() => {
    bookingApi.getAllBookings().then((res) => setBookings(res.data.data || []));
  }, []);

  return (
    <div>
      <h2>Lịch sử Đặt phòng của Tôi (UC-15, UC-16)</h2>
      <DataTable
        keyField="bookingId"
        data={bookings}
        columns={[
          { header: 'Mã Booking', render: (b) => `#${b.bookingId}` },
          { header: 'Ngày nhận phòng', render: (b) => formatDate(b.checkInDate) },
          { header: 'Ngày trả phòng', render: (b) => formatDate(b.checkOutDate) },
          { header: 'Tổng tiền', render: (b) => formatVND(b.totalAmount) },
          { header: 'Trạng thái', render: (b) => <StatusBadge status={b.status} /> },
        ]}
      />
    </div>
  );
};