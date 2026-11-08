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
   * Uploads a room-type photo (avatar). `files` is a FileList or an array
   * of File. Returns { imageUrls: [...] } — relative public paths
   * (/uploads/room-types/xxx.jpg) to store in imageUrl exactly like a
   * pasted image URL.
   *
   * The per-request 'Content-Type: multipart/form-data' header is REQUIRED,
   * not cosmetic: the shared `http` instance defaults to
   * 'application/json', and axios turns a FormData body into a JSON string
   * ({"files":{}} — the file bytes are lost) whenever the request carries a
   * JSON content type. That made every upload fail with 415 on the backend
   * and surface as a generic 500 "Hệ thống gặp sự cố..." in the modal.
   * With this header axios lets the browser set the multipart boundary.
   */
  uploadRoomTypeImages: (files) => {
    const formData = new FormData();
    [...files].forEach((file) => formData.append('files', file));
    return http.post('/room-types/images', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
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
