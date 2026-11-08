import { http } from '../lib/http';

/**
 * API client for Module 2: Room Types, Physical Rooms, Housekeeping & Maintenance.
 * Covers: UC-11..13, UC-15..20, UC-51.
 */
export const roomApi = {
  // =========================================================================
  // 1. Room Types & Dynamic Day-of-Week Pricing (UC-11..14)
  // =========================================================================
  getRoomTypes: (activeOnly) => http.get('/room-types', { params: { activeOnly } }),
  getRoomTypeById: (id) => http.get(`/room-types/${id}`),
  createRoomType: (data) => http.post('/room-types', data),
  updateRoomType: (id, data) => http.put(`/room-types/${id}`, data),
  /**
   * Uploads room-type photos (main image + gallery batch). `files` is a
   * FileList or an array of File. Returns { imageUrls: [...] } — relative
   * public paths (/uploads/room-types/xxx.jpg) to store in imageUrl /
   * galleryImages exactly like a pasted image URL.
   * No explicit Content-Type header: axios lets the browser set
   * multipart/form-data with the correct boundary for FormData.
   */
  uploadRoomTypeImages: (files) => {
    const formData = new FormData();
    [...files].forEach((file) => formData.append('files', file));
    return http.post('/room-types/images', formData);
  },
  toggleRoomTypeStatus: (id) => http.patch(`/room-types/${id}/status`),
  getRoomTypePrices: (id) => http.get(`/room-types/${id}/prices`),
  updateRoomTypePrices: (id, data) => http.put(`/room-types/${id}/prices`, data),

  // =========================================================================
  // 2. Physical Rooms Inventory (UC-15..18)
  // =========================================================================
  getAllRooms: (params) => http.get('/rooms', { params }),
  searchRooms: (params) => http.get('/rooms/search', { params }),
  getRoomById: (id) => http.get(`/rooms/${id}`),
  createRoom: (data) => http.post('/rooms', data),
  updateRoom: (id, data) => http.put(`/rooms/${id}`, data),
  updateRoomStatus: (id, status, cleanliness) =>
    http.patch(`/rooms/${id}/status`, null, { params: { status, cleanliness } }),
  archiveRoom: (id) => http.delete(`/rooms/${id}`),

  // =========================================================================
  // 3. Cleanliness & Maintenance Operations (UC-19, UC-20)
  // =========================================================================
  updateHousekeepingStatus: (roomId, data) =>
    http.patch(`/housekeeping/rooms/${roomId}/status`, data),
  setRoomMaintenance: (roomId, data) =>
    http.post(`/housekeeping/rooms/${roomId}/maintenance`, data),
  endRoomMaintenance: (roomId, data) =>
    http.post(`/housekeeping/rooms/${roomId}/end-maintenance`, data),

  // =========================================================================
  // 4. Housekeeping Tasks & Staff Allocation (UC-51)
  // =========================================================================
  getHousekeepingStaff: () => http.get('/housekeeping/staff'),
  getHousekeepingTasks: (params) => http.get('/housekeeping/tasks', { params }),
  getHousekeepingTaskById: (taskId) => http.get(`/housekeeping/tasks/${taskId}`),
  createHousekeepingTask: (data) => http.post('/housekeeping/tasks', data),
  updateHousekeepingTaskStatus: (taskId, data) =>
    http.patch(`/housekeeping/tasks/${taskId}/status`, data),
};
