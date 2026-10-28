import React, { useEffect, useState } from 'react';
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
      <h2>Lá»‹ch sá»­ Äáº·t phÃ²ng cá»§a TÃ´i (UC-15, UC-16)</h2>
      <DataTable
        keyField="bookingId"
        data={bookings}
        columns={[
          { header: 'MÃ£ Booking', render: (b) => `#${b.bookingId}` },
          { header: 'NgÃ y nháº­n phÃ²ng', render: (b) => formatDate(b.checkInDate) },
          { header: 'NgÃ y tráº£ phÃ²ng', render: (b) => formatDate(b.checkOutDate) },
          { header: 'Tá»•ng tiá»n', render: (b) => formatVND(b.totalAmount) },
          { header: 'Tráº¡ng thÃ¡i', render: (b) => <StatusBadge status={b.status} /> },
        ]}
      />
    </div>
  );
};