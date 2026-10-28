import React, { useEffect, useState } from 'react';
import { roomApi } from '../../services/roomApi';
import { DataTable } from '../../components/common/DataTable';
import { formatVND } from '../../lib/money';
import { StatusBadge } from '../../components/common/StatusBadge';

export const RoomInventoryPage = () => {
  const [roomTypes, setRoomTypes] = useState([]);
  const [rooms, setRooms] = useState([]);

  useEffect(() => {
    roomApi.getRoomTypes().then((res) => setRoomTypes(res.data.data || []));
    roomApi.getAllRooms().then((res) => setRooms(res.data.data || []));
  }, []);

  return (
    <div>
      <h2>Quáº£n lÃ½ Háº¡ng phÃ²ng, GiÃ¡ cÆ¡ sá»Ÿ & SÆ¡ Ä‘á»“ PhÃ²ng (UC-07, UC-08)</h2>
      <p style={{ color: '#64748b' }}>
        Háº¡ng phÃ²ng & GiÃ¡ cÆ¡ sá»Ÿ do <strong>Sales & Marketing Manager</strong> quáº£n lÃ½; Danh má»¥c PhÃ²ng váº­t lÃ½ do <strong>Housekeeping Manager</strong> quáº£n lÃ½.
      </p>

      <h3>Danh má»¥c Háº¡ng phÃ²ng (Room Types)</h3>
      <DataTable
        keyField="roomTypeId"
        data={roomTypes}
        columns={[
          { header: 'ID', render: (rt) => `#${rt.roomTypeId}` },
          { header: 'TÃªn Háº¡ng phÃ²ng', render: (rt) => <strong>{rt.typeName}</strong> },
          { header: 'Sá»©c chá»©a', render: (rt) => `${rt.capacity} khÃ¡ch` },
          { header: 'GiÃ¡ cÆ¡ sá»Ÿ / ÄÃªm', render: (rt) => formatVND(rt.basePrice) },
          { header: 'Tráº¡ng thÃ¡i', render: (rt) => <StatusBadge status={rt.status} /> },
        ]}
      />

      <h3 style={{ marginTop: 28 }}>Danh sÃ¡ch PhÃ²ng Váº­t lÃ½ (Physical Rooms)</h3>
      <DataTable
        keyField="roomId"
        data={rooms}
        columns={[
          { header: 'Sá»‘ phÃ²ng', render: (r) => <strong>{r.roomNumber}</strong> },
          { header: 'Táº§ng', render: (r) => `Táº§ng ${r.floor}` },
          { header: 'Háº¡ng phÃ²ng', render: (r) => r.roomType?.typeName },
          { header: 'Tráº¡ng thÃ¡i', render: (r) => <StatusBadge status={r.status} /> },
          { header: 'Äá»™ sáº¡ch', render: (r) => <StatusBadge status={r.cleanliness} /> },
        ]}
      />
    </div>
  );
};