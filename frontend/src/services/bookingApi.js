import { http } from '../lib/http';

export const bookingApi = {
  searchAvailableRoomTypes: (checkIn, checkOut, guests) =>
    http.get('/bookings/search', { params: { checkIn, checkOut, guests } }),
  createBooking: (data) => http.post('/bookings', data),
  getAllBookings: () => http.get('/bookings'),
  cancelBooking: (bookingId, reason) =>
    http.post(`/bookings/${bookingId}/cancel`, null, { params: { reason } }),
};