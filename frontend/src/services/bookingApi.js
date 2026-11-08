import { http } from '../lib/http';

export const bookingApi = {
  // UC-14: View Room Categories (Public Catalog of active room categories)
  getRoomCategories: () => http.get('/public/room-types'),
  getRoomTypes: () => http.get('/public/room-types'),

  // UC-21: Search Available Room Types by check-in/out dates and guest count
  searchAvailableRoomTypes: (checkInDate, checkOutDate, guests = 1) =>
    http.get('/public/rooms/search', { params: { checkInDate, checkOutDate, guests } }),

  // UC-22: View Room Details (Photo gallery, bed layout, amenities, rates, verified reviews)
  getRoomCategoryDetails: (roomTypeId, params = {}) =>
    http.get(`/public/room-types/${roomTypeId}`, { params }),

  // UC-23: Create a new room reservation (holds quota for 24h per BR-19)
  createReservation: (data) => http.post('/reservations', data),

  // UC-23: Confirm VNPay Deposit Payment Callback
  confirmVnPayCallback: (data) => http.post('/public/reservations/vnpay-callback', data),

  // UC-24: List customer's own reservations
  getMyReservations: () => http.get('/reservations/my'),

  // UC-24 & UC-26: List reservations
  getAllReservations: () => http.get('/reservations'),
  getAllBookings: () => http.get('/reservations'),

  // Find booking by reference code
  findReservationByCode: (code) => http.get(`/public/reservations/${encodeURIComponent(code)}`),

  // UC-25: Cancel an unfulfilled reservation
  cancelReservation: (reservationId, reason) =>
    http.post(`/reservations/${reservationId}/cancel`, null, { params: { reason } }),
};
