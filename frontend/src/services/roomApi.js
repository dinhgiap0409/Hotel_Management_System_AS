import { http } from '../lib/http';

export const roomApi = {
  getRoomTypes: () => http.get('/room-types'),
  createRoomType: (data) => http.post('/room-types', data),
  getAllRooms: () => http.get('/rooms'),
  updateRoomStatus: (roomId, status, cleanliness) =>
    http.patch(`/rooms/${roomId}/status`, null, { params: { status, cleanliness } }),
  getHousekeepingTasks: () => http.get('/housekeeping/tasks'),
  createMaintenanceLog: (data) => http.post('/maintenance', data),
};