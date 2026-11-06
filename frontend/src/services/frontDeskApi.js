import { http } from '../lib/http';

export const frontDeskApi = {
  createDirectBooking: (data) => http.post('/front-desk/direct-booking', data),
  getPendingReservations: () => http.get('/front-desk/reservations/pending'),
  getArrivals: () => http.get('/front-desk/arrivals'),
  getAvailableRoomsForCheckIn: (roomTypeId) =>
    http.get('/front-desk/available-rooms', { params: roomTypeId ? { roomTypeId } : {} }),
  confirmReservation: (reservationId) => http.post(`/front-desk/reservations/${reservationId}/confirm`),
  checkIn: (data) => http.post('/front-desk/check-in', data),
  getActiveStays: () => http.get('/front-desk/active-stays'),
  checkOut: (stayId) => http.post(`/front-desk/stays/${stayId}/check-out`),
  settleStayFolio: (stayId, params) => http.post(`/billing/stays/${stayId}/settle`, null, { params }),
};
