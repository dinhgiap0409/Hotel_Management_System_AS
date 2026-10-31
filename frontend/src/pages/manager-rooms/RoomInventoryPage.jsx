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
      <h2>Quản lý Hạng phòng, Giá cơ sở & Sơ đồ Phòng (UC-07, UC-08)</h2>
      <p style={{ color: '#64748b' }}>
        Hạng phòng & Giá cơ sở do <strong>Sales & Marketing Manager</strong> quản lý; Danh mục Phòng vật lý do <strong>Housekeeping Manager</strong> quản lý.
      </p>

      <h3>Danh mục Hạng phòng (Room Types)</h3>
      <DataTable
        keyField="roomTypeId"
        data={roomTypes}
        columns={[
          { header: 'ID', render: (rt) => `#${rt.roomTypeId}` },
          { header: 'Tên Hạng phòng', render: (rt) => <strong>{rt.typeName}</strong> },
          { header: 'Sức chứa', render: (rt) => `${rt.capacity} khách` },
          { header: 'Giá cơ sở / Đêm', render: (rt) => formatVND(rt.basePrice) },
          { header: 'Trạng thái', render: (rt) => <StatusBadge status={rt.status} /> },
        ]}
      />

      <h3 style={{ marginTop: 28 }}>Danh sách Phòng Vật lý (Physical Rooms)</h3>
      <DataTable
        keyField="roomId"
        data={rooms}
        columns={[
          { header: 'Số phòng', render: (r) => <strong>{r.roomNumber}</strong> },
          { header: 'Tầng', render: (r) => `Tầng ${r.floor}` },
          { header: 'Hạng phòng', render: (r) => r.roomType?.typeName },
          { header: 'Trạng thái', render: (r) => <StatusBadge status={r.status} /> },
          { header: 'Độ sạch', render: (r) => <StatusBadge status={r.cleanliness} /> },
        ]}
      />
    </div>
  );
};