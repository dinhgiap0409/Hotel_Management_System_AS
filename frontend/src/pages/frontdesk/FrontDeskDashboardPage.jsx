import React, { useEffect, useState } from 'react';
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
      <h2>Quáº§y Lá»… tÃ¢n â€” Check-in, LÆ°u trÃº & Check-out (UC-17, UC-18, UC-19, UC-20)</h2>
      <p style={{ color: '#64748b' }}>DÃ nh cho: NhÃ¢n viÃªn Lá»… tÃ¢n (Front-Desk) & General Manager</p>

      <h3>1. Danh sÃ¡ch PhÃ²ng Ä‘ang LÆ°u trÃº (Active Stays)</h3>
      <DataTable
        keyField="stayId"
        data={stays}
        columns={[
          { header: 'Stay ID', render: (s) => `#${s.stayId}` },
          { header: 'PhÃ²ng', render: (s) => <strong>{s.room?.roomNumber}</strong> },
          { header: 'KhÃ¡ch hÃ ng', render: (s) => s.booking?.customer?.fullName },
          { header: 'Giá» Check-in', render: (s) => formatDateTime(s.actualCheckIn) },
          { header: 'Tráº¡ng thÃ¡i', render: (s) => <StatusBadge status={s.status} /> },
        ]}
      />

      <h3 style={{ marginTop: 28 }}>2. Danh sÃ¡ch Äáº·t phÃ²ng (Bookings)</h3>
      <DataTable
        keyField="bookingId"
        data={bookings}
        columns={[
          { header: 'MÃ£ Booking', render: (b) => `#${b.bookingId}` },
          { header: 'KhÃ¡ch hÃ ng', render: (b) => b.customer?.fullName },
          { header: 'Check-in dá»± kiáº¿n', render: (b) => formatDate(b.checkInDate) },
          { header: 'Check-out dá»± kiáº¿n', render: (b) => formatDate(b.checkOutDate) },
          { header: 'Tá»•ng tiá»n dá»± kiáº¿n', render: (b) => formatVND(b.totalAmount) },
          { header: 'Tráº¡ng thÃ¡i', render: (b) => <StatusBadge status={b.status} /> },
        ]}
      />
    </div>
  );
};