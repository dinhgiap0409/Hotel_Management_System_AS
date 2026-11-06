import { http } from '../lib/http';

export const frontDeskApi = {
  createDirectBooking: (data) => http.post('/front-desk/direct-booking', data),
  getPendingReservations: () => http.get('/front-desk/reservations/pending'),
  confirmReservation: (reservationId) => http.post(`/front-desk/reservations/${reservationId}/confirm`),
  checkIn: (data) => http.post('/front-desk/check-in', data),
  getActiveStays: () => http.get('/front-desk/active-stays'),
  checkOut: (stayId) => http.post(`/front-desk/stays/${stayId}/check-out`),
};
