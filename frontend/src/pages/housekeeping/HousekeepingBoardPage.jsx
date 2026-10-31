import React, { useEffect, useState } from 'react';
import { roomApi } from '../../services/roomApi';
import { DataTable } from '../../components/common/DataTable';
import { StatusBadge } from '../../components/common/StatusBadge';

export const HousekeepingBoardPage = () => {
  const [rooms, setRooms] = useState([]);
  const [tasks, setTasks] = useState([]);

  const loadData = () => {
    roomApi.getAllRooms().then((r) => setRooms(r.data.data || []));
    roomApi.getHousekeepingTasks().then((t) => setTasks(t.data.data || []));
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleMarkCleaned = async (roomId) => {
    await roomApi.updateRoomStatus(roomId, 'Available', 'Clean');
    loadData();
  };

  return (
    <div>
      <h2>Bảng Điều phối Buồng phòng & Bảo trì (UC-09, UC-10, UC-11)</h2>
      <p style={{ color: '#64748b' }}>Dành cho: Housekeeping Manager & Nhân viên Housekeeping</p>

      <h3>1. Trạng thái Vệ sinh Phòng vật lý</h3>
      <DataTable
        keyField="roomId"
        data={rooms}
        columns={[
          { header: 'Số phòng', render: (r) => <strong>{r.roomNumber}</strong> },
          { header: 'Tầng', render: (r) => r.floor },
          { header: 'Hạng phòng', render: (r) => r.roomType?.typeName },
          { header: 'Trạng thái Phòng', render: (r) => <StatusBadge status={r.status} /> },
          { header: 'Vệ sinh', render: (r) => <StatusBadge status={r.cleanliness} /> },
          {
            header: 'Hành động',
            render: (r) =>
              r.cleanliness !== 'Clean' ? (
                <button
                  onClick={() => handleMarkCleaned(r.roomId)}
                  style={{ background: '#16a34a', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: 4, cursor: 'pointer' }}
                >
                  Xác nhận Đã dọn sạch (Clean)
                </button>
              ) : (
                <span style={{ color: '#64748b', fontSize: 13 }}>Sẵn sàng đón khách</span>
              ),
          },
        ]}
      />

      <h3 style={{ marginTop: 28 }}>2. Danh sách Nhiệm vụ Dọn phòng (Housekeeping Tasks)</h3>
      <DataTable
        keyField="taskId"
        data={tasks}
        columns={[
          { header: 'Mã Task', render: (t) => `#${t.taskId}` },
          { header: 'Phòng', render: (t) => t.room?.roomNumber },
          { header: 'Loại công việc', render: (t) => t.taskType },
          { header: 'Độ ưu tiên', render: (t) => <StatusBadge status={t.priority} /> },
          { header: 'Trạng thái', render: (t) => <StatusBadge status={t.status} /> },
        ]}
      />
    </div>
  );
};