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
      <h2>Báº£ng Äiá»u phá»‘i Buá»“ng phÃ²ng & Báº£o trÃ¬ (UC-09, UC-10, UC-11)</h2>
      <p style={{ color: '#64748b' }}>DÃ nh cho: Housekeeping Manager & NhÃ¢n viÃªn Housekeeping</p>

      <h3>1. Tráº¡ng thÃ¡i Vá»‡ sinh PhÃ²ng váº­t lÃ½</h3>
      <DataTable
        keyField="roomId"
        data={rooms}
        columns={[
          { header: 'Sá»‘ phÃ²ng', render: (r) => <strong>{r.roomNumber}</strong> },
          { header: 'Táº§ng', render: (r) => r.floor },
          { header: 'Háº¡ng phÃ²ng', render: (r) => r.roomType?.typeName },
          { header: 'Tráº¡ng thÃ¡i PhÃ²ng', render: (r) => <StatusBadge status={r.status} /> },
          { header: 'Vá»‡ sinh', render: (r) => <StatusBadge status={r.cleanliness} /> },
          {
            header: 'HÃ nh Ä‘á»™ng',
            render: (r) =>
              r.cleanliness !== 'Clean' ? (
                <button
                  onClick={() => handleMarkCleaned(r.roomId)}
                  style={{ background: '#16a34a', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: 4, cursor: 'pointer' }}
                >
                  XÃ¡c nháº­n ÄÃ£ dá»n sáº¡ch (Clean)
                </button>
              ) : (
                <span style={{ color: '#64748b', fontSize: 13 }}>Sáºµn sÃ ng Ä‘Ã³n khÃ¡ch</span>
              ),
          },
        ]}
      />

      <h3 style={{ marginTop: 28 }}>2. Danh sÃ¡ch Nhiá»‡m vá»¥ Dá»n phÃ²ng (Housekeeping Tasks)</h3>
      <DataTable
        keyField="taskId"
        data={tasks}
        columns={[
          { header: 'MÃ£ Task', render: (t) => `#${t.taskId}` },
          { header: 'PhÃ²ng', render: (t) => t.room?.roomNumber },
          { header: 'Loáº¡i cÃ´ng viá»‡c', render: (t) => t.taskType },
          { header: 'Äá»™ Æ°u tiÃªn', render: (t) => <StatusBadge status={t.priority} /> },
          { header: 'Tráº¡ng thÃ¡i', render: (t) => <StatusBadge status={t.status} /> },
        ]}
      />
    </div>
  );
};